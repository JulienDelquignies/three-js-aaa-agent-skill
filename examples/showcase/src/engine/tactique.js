// tactique.js — LA TÉLÉMÉTRIE TACTIQUE (01/10 : « il manque encore des infos non ? La distance de marquage, les duels, le temps libre des
// joueurs, est-ce que les choix sont cohérents ou il y avait des joueurs libres, les deuxièmes ballons, les une-deux, les triangles, les
// mouvements sans ballon ; une équipe directe doit suivre les actions plus vite ; une équipe qui presse moins doit reformer son bloc plus
// vite ? on avait des livres tactiques »).
//
// LECTURE SEULE, comme stats.js : le module lit l'état et les événements après chaque matchStep et n'écrit rien dans le monde. Les
// indicateurs et leurs cibles viennent des livres (docs/Book_vers_Moteur) — B10 le bloc, B11 les transitions, B12 le marquage, B15 les
// duels et seconds ballons, B06/B07/B09 les courses et le soutien, R02/R14 la possession et les styles, M07 la pression, M16 la télémétrie.
// Les coordonnées sont dans le SENS DE L'ÉQUIPE (elle attaque vers +x), en mètres depuis son propre but quand c'est une hauteur.
//
//   makeTactique(st) · tactiqueStep(T, st, dt) (APRÈS matchStep) · tactiqueReport(T, st) → { equipes: [..], cibles }

const hyp = Math.hypot;
// la famille de poste d'un joueur au 4-3-3 du moteur (slots 0/3 latéraux, 1/2 centraux, 4-6 milieux, 7/9 ailiers, 8 avant-centre)
const FAMILLE = ['LAT', 'DC', 'DC', 'LAT', 'MIL', 'MIL', 'MIL', 'AIL', 'ATT', 'AIL'];
const familleDe = (p) => (p.keeper ? 'GB' : FAMILLE[p.post] ?? 'MIL');

function sens(st, team, x, z) { const s = Math.sign(st.pitch.attackGoal(team).x || 1); return [x * s, z * s]; }
/** Le temps d'arrivée du premier adversaire sur un point (s) : réaction 0,3 s + distance / 6,4 m/s (la pression en TEMPS — M07, Bekkers). */
function ttpDe(st, team, x, z) { let t = 99; for (const q of st.players) { if (q.team === team || q.keeper || q.down > 0 || q.expulse || q._sub) continue; t = Math.min(t, 0.3 + Math.max(0, hyp(q.p[0] - x, q.p[2] - z) - 0.5) / 6.4); } return t; }
const champ = (st, t) => st.players.filter((p) => p.team === t && !p.keeper && !p.expulse && !p._sub);

export function makeTactique(st, { sample = 10 } = {}) {
  const E = () => ({
    marq: {}, marqN: {},                      // distance au plus proche adversaire par famille (sans le ballon)
    marqI: {}, marqIN: {}, nDef10I: 0, interI: 0, interIN: 0, instN: 0,   // (377) les mêmes en DÉFENSE INSTALLÉE : l'adversaire depuis ≥ 8 s dans ma moitié
    nDef10: 0, nDef10N: 0, inter: 0, interN: 0, soutien: 0, soutienN: 0,
    rec: 0, recPresse: 0, recOuvert: 0, recDos: 0, recTtp: 0, garde: 0, gardePresse: 0, recPresseN: 0,
    courses: {}, servies: 0, combis: {}, aeriens: 0, aeriensGagnes: 0, secondsDuels: 0, secondsGardes: 0,
    regains: 0, tirs10: 0, delaiTir: [], restDef: [], reforme: [], contrePress: 0, pressD: [],
    pointe: [], repli3: [], meute15: [], seq: 0, seqPasses: 0, seq10: 0, seqL: [], seqVit: [], decisions: 0, optionIgnoree: 0, choixTtp: 0, sorties: {},
  });
  return { e0: 0, frame: 0, sample, tOpp: 0, tOppTeam: -1, E: [E(), E()], enJeu: 0, total: 0, rec: [], courses: [], aer: null, regain: [null, null], perte: [null, null], seqC: null };
}

export function tactiqueStep(T, st, dt = 1 / 60) {
  T.frame++; T.total += dt; const jeu = !st.restart; if (jeu) T.enJeu += dt;
  const tm = st.possession?.team, car = st.possession?.carrier;
  // — la SÉQUENCE (une possession d'équipe continue) : passes, progression, durée → direct speed (R01 C19 : 1,4 possession … 2,1 direct)
  if (tm != null && tm >= 0 && jeu) {
    const bx = sens(st, tm, st.ball.p[0], st.ball.p[2])[0] + st.pitch.hx;
    if (!T.seqC || T.seqC.team !== tm) { finSeq(T, st); T.seqC = { team: tm, t0: st.t, x0: bx, xMax: bx, passes: 0 }; }
    else T.seqC.xMax = Math.max(T.seqC.xMax, bx);
  }
  if (tm !== T.tOppTeam) { T.tOppTeam = tm; T.tOpp = 0; }   // (377) le temps de l'attaque installée dans la moitié adverse
  if (jeu && tm != null && tm >= 0 && sens(st, tm, st.ball.p[0], st.ball.p[2])[0] > 0) T.tOpp += dt;
  if (jeu && T.frame % T.sample === 0 && tm != null && tm >= 0) echantillon(T, st, tm, car);
  // — le bloc REFORMÉ après la perte (B11 X15 : shapeScore > 0,75 en 8-12 s) : ≥ 7 joueurs de champ derrière le ballon ET longueur ≤ 35 m
  for (const t of [0, 1]) { const P = T.perte[t]; if (!P) continue;
    if (st.t - P.t > 25) { T.E[t].reforme.push(25); T.perte[t] = null; continue; }
    if (T.frame % 5) continue;
    const bx = sens(st, t, st.ball.p[0], st.ball.p[2])[0], xs = champ(st, t).map((p) => sens(st, t, p.p[0], p.p[2])[0]);
    if (xs.filter((x) => x < bx).length >= 7 && Math.max(...xs) - Math.min(...xs) <= 35) { T.E[t].reforme.push(st.t - P.t); T.perte[t] = null; } }
  for (; T.e0 < st.events.length; T.e0++) lire(T, st, st.events[T.e0]);
  if (T.suivis) T.suivis = T.suivis.filter((S) => {
    if (!S.fait15 && st.t - S.t >= 1.5) { S.fait15 = true; T.E[S.l].meute15.push(champ(st, S.l).filter((p) => hyp(p.p[0] - st.ball.p[0], p.p[2] - st.ball.p[2]) < 10).length); }
    if (!S.fait3 && st.t - S.t >= 3) { S.fait3 = true; T.E[S.l].repli3.push(S.c0 - S.cx(S.l)); return false; }
    return true; });
  // les réceptions en attente : gardée 3 s plus tard ? (R02 #11 : conservation sous pression 66,8 %, sans 76,5 %)
  T.rec = T.rec.filter((r) => { if (st.t - r.t < 3) return true; const E = T.E[r.team]; if (r.garde) { E.garde++; if (r.presse) E.gardePresse++; } return false; });
  T.courses = T.courses.filter((c) => st.t - c.t < 3);
  if (T.aer && st.t - T.aer.t > 3) T.aer = null;
}

function echantillon(T, st, tm, car) {
  const adv = 1 - tm, b = st.ball.p, inst = T.tOpp >= 8 && sens(st, tm, b[0], b[2])[0] > 0;   // (377) défense installée
  // le MARQUAGE (B12 T1-3 : 5,16 ± 0,6 m ; LAT 6,4 > MIL 5,6 > DC 5,5 > ATT 5,1) : la distance de chaque défenseur au plus proche adversaire
  for (const p of champ(st, adv)) { let d = 99; for (const q of champ(st, tm)) d = Math.min(d, hyp(q.p[0] - p.p[0], q.p[2] - p.p[2]));
    const f = familleDe(p), E = T.E[adv]; E.marq[f] = (E.marq[f] ?? 0) + d; E.marqN[f] = (E.marqN[f] ?? 0) + 1;
    if (inst) { E.marqI[f] = (E.marqI[f] ?? 0) + d; E.marqIN[f] = (E.marqIN[f] ?? 0) + 1; } }
  // la DENSITÉ au ballon N_def(10) (B10 T7 : 4,9 médian, 6,3 bloc bas, 4,2 haut) et l'INTERLIGNE DEF↔MIL (B10 T2 : 10-15 m, bloc bas 5-8)
  const E = T.E[adv]; const nd = champ(st, adv).filter((p) => hyp(p.p[0] - b[0], p.p[2] - b[2]) < 10).length; E.nDef10 += nd; E.nDef10N++; if (inst) { E.nDef10I += nd; E.instN++; }
  const xs = champ(st, adv).map((p) => sens(st, adv, p.p[0], p.p[2])[0]).sort((a, c) => a - c);
  if (xs.length >= 8) { const il = (xs[4] + xs[5] + xs[6]) / 3 - (xs[0] + xs[1] + xs[2] + xs[3]) / 4; E.inter += il; E.interN++; if (inst) { E.interI += il; E.interIN++; } }
  // L'ÉCART DE LA POINTE À LA LIGNE (B09 : le 9 fixe les centraux, pinCount 1,5-2,4) : la ligne de hors-jeu adverse (2e plus reculé) moins
  // l'attaquant le plus avancé, ballon encore devant la ligne (m, 0 = sur la ligne)
  { const sg = Math.sign(st.pitch.attackGoal(tm).x || 1), D = st.players.filter((q) => q.team === adv && !q.expulse).map((q) => q.p[0] * sg).sort((u, w) => w - u), lx = D[1];
    if (st.ball.p[0] * sg < lx - 5) T.E[tm].pointe.push(lx - Math.max(...champ(st, tm).map((q) => q.p[0] * sg))); }
  // la DISTANCE DE SOUTIEN au porteur (B06 #20 : 6-18 m selon la sous-phase) : les deux coéquipiers les plus proches
  const c = car >= 0 ? st.players[car] : null;
  if (c) { const ds = champ(st, tm).filter((p) => p.id !== c.id).map((p) => hyp(p.p[0] - c.p[0], p.p[2] - c.p[2])).sort((a, d) => a - d);
    if (ds.length >= 2) { T.E[tm].soutien += (ds[0] + ds[1]) / 2; T.E[tm].soutienN++; } }
}

function finSeq(T, st) {
  const S = T.seqC; if (!S) return; T.seqC = null; const E = T.E[S.team], dur = st.t - S.t0;
  E.seq++; E.seqPasses += S.passes; if (S.passes >= 10) E.seq10++; E.seqL.push(S.passes);   // (378b) la distribution : médiane, p90, maximum
  if (dur > 2) E.seqVit.push(Math.max(0, S.xMax - S.x0) / dur);
}

function lire(T, st, e) {
  const P = e.by != null && st.players[e.by] ? st.players[e.by] : null, team = P?.team ?? e.team ?? e.equipe;
  switch (e.type) {
    case 'pass': {
      if (T.seqC && P && T.seqC.team === P.team && !e.clear) T.seqC.passes++;
      // LA DÉCISION : un coéquipier LIBRE (≥ 1,5 s avant pression) et plus avancé de 8 m que le receveur choisi existait-il ? (le book cite
      // OBSO/EPV sans cible : c'est un indicateur de COHÉRENCE, pas une note)
      if (P && !P.keeper && e.to >= 0 && st.players[e.to] && !e.clear) {
        const R = st.players[e.to], xR = sens(st, P.team, R.p[0], R.p[2])[0], ttpR = ttpDe(st, P.team, R.p[0], R.p[2]);
        const libreDevant = champ(st, P.team).some((m) => m.id !== P.id && m.id !== R.id && hyp(m.p[0] - P.p[0], m.p[2] - P.p[2]) < 35
          && sens(st, P.team, m.p[0], m.p[2])[0] > xR + 8 && ttpDe(st, P.team, m.p[0], m.p[2]) > 1.5);
        const E = T.E[P.team]; E.decisions++; E.choixTtp += Math.min(3, ttpR); if (libreDevant) E.optionIgnoree++;
      }
      break;
    }
    case 'receive': case 'control': {
      if (!P || P.keeper || st.restart) break;
      // LA RÉCEPTION : temps libre (TTP), sous pression si TTP < 1,5 s (M07), ORIENTATION (B07 T7 : ouvert ≤ 45° 20-35 %, dos > 110° 15-30 %)
      const ttp = ttpDe(st, P.team, P.p[0], P.p[2]), g = st.pitch.attackGoal(P.team);
      const a = Math.abs(((P.yaw ?? 0) - Math.atan2(0 - P.p[2], g.x - P.p[0]) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) * 180 / Math.PI;
      const E = T.E[P.team]; E.rec++; E.recTtp += Math.min(4, ttp); if (ttp < 1.5) { E.recPresse++; } if (a <= 45) E.recOuvert++; if (a > 110) E.recDos++;
      T.rec.push({ t: st.t, team: P.team, presse: ttp < 1.5, garde: true });
      // la COURSE SERVIE (B09 T1 : 15-40 % des appels)
      const C = T.courses.find((c) => c.by === P.id && !c.servie); if (C) { C.servie = true; T.E[P.team].servies++; }
      if (T.aer && P) { T.aer.second = P.team; }
      break;
    }
    case 'turnover': {
      const w = e.equipe, l = 1 - w;
      for (const r of T.rec) if (r.team === l) r.garde = false;
      // LA TRANSITION : le regain (tir dans les 10 s : B11 X3, 62 % des tirs à ≤ 10 s), la REST DEFENSE du perdant (B11 X19 : 3,7 derrière le
      // ballon), et l'horloge du bloc reformé du perdant
      T.E[w].regains++; T.regain[w] = { t: st.t };
      const bx = sens(st, l, st.ball.p[0], st.ball.p[2])[0]; T.E[l].restDef.push(champ(st, l).filter((p) => sens(st, l, p.p[0], p.p[2])[0] < bx).length);
      T.perte[l] = { t: st.t };
      // LE REPLI (B11 X15-17) et LA MEUTE (B11 X13 : 3-5 joueurs à < 10 m à t0 + 1,5 s pour qui contre-presse) : le centre de gravité du
      // perdant à la perte, relu à +3 s ; les siens près du ballon à +1,5 s
      { const cx = (t2) => { const P = champ(st, t2); return P.reduce((a, p) => a + sens(st, t2, p.p[0], p.p[2])[0], 0) / Math.max(1, P.length); };
        (T.suivis ??= []).push({ t: st.t, l, c0: cx(l), fait15: false, fait3: false, cx }); }
      if (T.aer && !T.aer.second) T.aer.second = w;
      break;
    }
    case 'shot': { if (team == null || team < 0) break; const R = T.regain[team]; if (R && st.t - R.t <= 10) { T.E[team].tirs10++; T.E[team].delaiTir.push(st.t - R.t); T.regain[team] = null; } break; }
    case 'burst': if (P && ['appel', 'appel-profond', 'contre-appel'].includes(e.kind)) { T.E[P.team].courses[e.kind] = (T.E[P.team].courses[e.kind] ?? 0) + 1; T.courses.push({ t: st.t, by: P.id }); } break;
    case 'un-deux': case 'troisieme': case 'renversement': case 'combinaison': { const by = e.by ?? e.a, Q = st.players[by]; if (!Q) break; const k = e.type === 'combinaison' ? (e.kind ?? 'combinaison') : e.type; T.E[Q.team].combis[k] = (T.E[Q.team].combis[k] ?? 0) + 1; break; }
    case 'duel': if (e.kind === 'aérien' && P) { const Q = st.players[e.contre]; for (const X of [P, Q]) if (X) T.E[X.team].aeriens++; const wT = e.won ? P.team : Q?.team; if (wT != null) T.E[wT].aeriensGagnes++;
      // LE SECOND BALLON (B15 D7 : le vainqueur du duel ne récupère que 45 % au milieu)
      if (wT != null) T.aer = { t: st.t, gagnant: wT, second: null, compte: false }; } break;
    case 'contre-press': if (e.team != null) T.E[e.team].contrePress++; break;
    case 'press': { const c = st.possession?.carrier >= 0 ? st.players[st.possession.carrier] : null; if (c && e.team != null) { let d = 99; for (const q of champ(st, e.team)) d = Math.min(d, hyp(q.p[0] - c.p[0], q.p[2] - c.p[2])); T.E[e.team].pressD.push(d); } break; }
    case 'sortie': { const E = T.E[0]; E.sorties[e.out] = (E.sorties[e.out] ?? 0) + 1; break; }
  }
  if (T.aer && T.aer.second != null && !T.aer.compte) { T.aer.compte = true; const E = T.E[T.aer.gagnant]; E.secondsDuels++; if (T.aer.second === T.aer.gagnant) E.secondsGardes++; }
}

const moy = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null), med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
const r1 = (x) => (x == null || !isFinite(x) ? null : +x.toFixed(1)), pc = (a, b) => (b ? +(100 * a / b).toFixed(1) : null);

/** Le rapport de la télémétrie tactique, par équipe, avec les cibles des livres. */
export function tactiqueReport(T, st) {
  if (T.seqC) finSeq(T, st);
  const eq = (t) => { const E = T.E[t];
    return {
      marquage: Object.fromEntries(Object.keys(E.marq).map((f) => [f, r1(E.marq[f] / E.marqN[f])])),
      marquageInstalle: Object.fromEntries(Object.keys(E.marqI).map((f) => [f, r1(E.marqI[f] / E.marqIN[f])])), densiteInstalle: r1(E.nDef10I / Math.max(1, E.instN)), interligneInstalle: r1(E.interI / Math.max(1, E.interIN)), partInstalle: pc(E.instN, E.nDef10N),
      densiteBallon: r1(E.nDef10 / Math.max(1, E.nDef10N)), interligne: r1(E.inter / Math.max(1, E.interN)), distanceSoutien: r1(E.soutien / Math.max(1, E.soutienN)),
      distanceIntervention: r1(med(E.pressD)), ecartPointeLigne: r1(med(E.pointe)),
      receptions: E.rec, recSousPression: pc(E.recPresse, E.rec), recOuvert: pc(E.recOuvert, E.rec), recDos: pc(E.recDos, E.rec), tempsLibre: r1(E.recTtp / Math.max(1, E.rec)),
      conservation: pc(E.garde, E.rec), conservationSousPression: pc(E.gardePresse, E.recPresse),
      courses: E.courses, coursesServies: pc(E.servies, Object.values(E.courses).reduce((a, b) => a + b, 0)), combinaisons: E.combis,
      duelsAeriens: E.aeriens, aeriensGagnes: pc(E.aeriensGagnes, E.aeriens), secondBallonVainqueur: pc(E.secondsGardes, E.secondsDuels),
      regains: E.regains, tirsDans10s: E.tirs10, delaiRegainTir: r1(med(E.delaiTir)), restDefense: r1(moy(E.restDef)), blocReforme: r1(med(E.reforme)), repli3s: r1(moy(E.repli3)), meute15: r1(moy(E.meute15)), contrePressing: E.contrePress,
      sequences: E.seq, passesParSequence: r1(E.seqPasses / Math.max(1, E.seq)), passesParSequenceMediane: med(E.seqL), passesParSequenceP90: (() => { const v = [...E.seqL].sort((x, y) => x - y); return v.length ? v[Math.floor(0.9 * (v.length - 1))] : null; })(), passesParSequenceMax: E.seqL.length ? Math.max(...E.seqL) : null, sequences10Passes: E.seq10, directSpeed: r1(moy(E.seqVit)),
      decisions: E.decisions, optionLibreIgnoree: pc(E.optionIgnoree, E.decisions), tempsLibreReceveur: r1(E.choixTtp / Math.max(1, E.decisions)),
    }; };
  return {
    ballonEnJeu: pc(T.enJeu, T.total), sorties: T.E[0].sorties, equipes: [eq(0), eq(1)],
    cibles: {
      marquage: 'B12 : 5,16 ± 0,6 m ; LAT 6,4 > MIL 5,6 > DC 5,5 > ATT 5,1', marquageInstalle: 'B12 (la phase n’est pas nommée par le livre) — défense installée : l’adversaire depuis ≥ 8 s dans ma moitié', densiteBallon: 'B10 T7 : 4,9 médian · 6,3 bloc bas · 4,2 bloc haut', interligne: 'B10 T2 : 10-15 m · bloc bas 5-8',
      distanceSoutien: 'B06 #20 : 6-18 m', ecartPointeLigne: 'B09 : le 9 sur la ligne (0-3 m), pinCount 1,5-2,4', distanceIntervention: 'B01/B12 : 10-15 m bloc médian · ≈ 6 m bloc bas', recSousPression: 'M07/B07 : dos sous forte pression 35-55 %',
      recOuvert: 'B07 T7 : 20-35 %', recDos: 'B07 T7 : 15-30 %', conservationSousPression: 'R02 #11 : 66,8 % (sans pression 76,5)', coursesServies: 'B09 T1 : 15-40 %',
      aeriensGagnes: 'R04 : 38-50 duels aériens par match', secondBallonVainqueur: 'B15 D7 : 45 % au milieu', tirsDans10s: 'B11 X3 : 62 % des tirs à ≤ 10 s du regain',
      restDefense: 'B11 X19 : 3,7 joueurs derrière le ballon', blocReforme: 'B11 X15 : 8-12 s', repli3s: 'recul du centre de gravité en 3 s après la perte (m)', meute15: 'B11 X13 : 3-5 à < 10 m à t0 + 1,5 s pour qui contre-presse', contrePressing: 'B11 X13 : 20-30 par équipe',
      passesParSequence: 'R01 C13 : 3,5 (3,5-5,1)', sequences: 'R01 : 105 ± 25 par équipe', sequences10Passes: 'R01 : 7 ± 3', directSpeed: 'R01 C19 : 1,7 ± 0,3 m/s (1,4 possession · 2,1 direct)',
      ballonEnJeu: 'R01 C30 : 54-58 %', sorties: 'R06 : touches 35-44, corners 10, sorties de but 16 par match',
    },
  };
}
