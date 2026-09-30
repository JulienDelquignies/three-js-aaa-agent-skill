// stats.js — LES STATISTIQUES COMPLÈTES DU MATCH (30/09 : « on devrait ajouter des stats complètes du foot : heatmap, xG, pressing, tirs
// détaillés, gardiens, joueurs jusqu'au schéma de passe, par mi-temps, défense, duels, discipline, notes, passes détaillées — ça nous aidera
// à comprendre, en plus d'être top pour analyser les matchs »).
//
// LECTURE SEULE : le module lit st.events et l'état (positions, ballon, possession) après chaque matchStep — il n'écrit RIEN dans le monde
// (l'empreinte du match est inchangée au bit, prouvé par verify-stats). Il sert trois clients : les bancs (le rapport CLI, scripts/stats-
// match.mjs), la page du match (le panneau de stats et la vue 2D), et les contrats.
//
// Deux couches :
//   1. le JOURNAL DE FAITS — chaque événement utile du moteur, normalisé : { k (le genre), t, per (la mi-temps), team, by, x, z (la
//      position DANS LE SENS DE L'ÉQUIPE : elle attaque toujours vers +x), … } ; les issues qui ne sont pas dans l'événement se RÉSOLVENT
//      ici : la passe (réussie si le prochain contrôle du ballon est d'un coéquipier), le tir (but, arrêté, contré, cadré, hors cadre, frôle
//      le montant — le moteur n'a pas de physique des poteaux : « frôle » = passé à < 25 cm d'un montant ou de la barre) ;
//   2. les ÉCHANTILLONS — la possession (image par image), les distances et vitesses, les heatmaps (grille 21 × 14 de 5 m, toutes les
//      10 images, hors arrêts de jeu).
// Puis statsReport(S, { per }) agrège : match entier (per null) ou une mi-temps (1 ou 2).

const hyp = Math.hypot;
/** L'xG DE RÉFÉRENCE (indépendant du moteur) : une logistique distance + angle d'ouverture du but, ajustée sur les repères publics du
 *  tir au pied en jeu (6 m axe ≈ 0,36-0,45 ; point de penalty ≈ 0,17-0,24 ; 16,5 m ≈ 0,08 ; 25 m ≈ 0,03 ; angle fermé ≈ 0,05-0,10) ;
 *  la tête × ~0,45 (logit − 0,8), la volée × ~0,8, le coup franc direct 0,06, le penalty 0,76. Le moteur a son propre xG (celui qui
 *  guide le tireur, `xgMoteur`) : le comparer à cette référence dit si le moteur voit juste. dx : distance à la ligne de but, z : décalage. */
export function xgRef(dx, z, partie = 'pied', genre = null) {
  if (genre === 'penalty') return 0.76;
  if (genre === 'coup-franc-direct') return 0.06;
  dx = Math.max(0.3, dx); const th = Math.abs(Math.atan2(z + 3.66, dx) - Math.atan2(z - 3.66, dx));
  const L = -0.967 + 0.988 * th - 0.112 * hyp(dx, z) + (partie === 'tete' ? -0.8 : partie === 'volee' ? -0.25 : 0);
  return 1 / (1 + Math.exp(-L));
}
const GX = 21, GZ = 14;   // la grille des heatmaps (5 m × ~4,9 m sur 105 × 68)

/** Le tableau de stats vierge d'un match. st : l'état du match (makeMatch). */
export function makeStats(st, { sample = 10 } = {}) {
  return {
    e0: 0, frame: 0, sample,
    faits: [],
    pass: null, tir: null,                                   // la passe et le tir en cours de résolution
    poss: [[0, 0], [0, 0], [0, 0]],                          // [per][team] images de possession (per 0 inutilisé)
    lastLoss: [-99, -99],                                    // l'heure de la dernière perte de chaque équipe (le contre-pressing)
    J: st.players.map((p) => ({
      id: p.id, team: p.team, keeper: !!p.keeper, post: p.post ?? null, name: p.name ?? null,
      dist: [0, 0, 0], sprints: [0, 0, 0], vMax: 0, tJeu: [0, 0, 0], _sprint: false,
      heat: [null, new Float32Array(GX * GZ), new Float32Array(GX * GZ)],
    })),
    ballPrev: null,
  };
}

const perDe = (st) => Math.min(2, Math.max(1, st._chrono?.periode ?? 1));   // les prolongations comptent avec la 2e mi-temps
/** (x, z) dans le sens de l'équipe : elle attaque toujours vers +x. */
function sens(st, team, x, z) { const s = Math.sign(st.pitch.attackGoal(team).x || 1); return [x * s, z * s]; }
function posDe(st, id) { const p = st.players[id]; return p ? sens(st, p.team, p.p[0], p.p[2]) : [0, 0]; }

/** Une image : lit les nouveaux événements et échantillonne. À appeler APRÈS matchStep(st, dt, cfg). */
export function statsStep(S, st, dt = 1 / 60) {
  const per = perDe(st), hx = st.pitch.hx, hz = st.pitch.hz;
  S.frame++;
  const jeu = !st.restart;
  // — la possession (image par image, hors arrêts de jeu)
  if (jeu && st.possession?.team != null && st.possession.team >= 0) S.poss[per][st.possession.team]++;
  // — les distances, sprints, vitesse max ; les heatmaps
  for (const p of st.players) {
    const J = S.J[p.id]; if (!J || p.expulse || p._sub) continue;
    const v = hyp(p.v[0], p.v[1]);
    J.dist[per] += v * dt; J.tJeu[per] += dt; J.vMax = Math.max(J.vMax, v);
    if (!J._sprint && v > 7) { J._sprint = true; J.sprints[per]++; } else if (J._sprint && v < 5.5) J._sprint = false;
    if (jeu && S.frame % S.sample === 0) {
      const [x, z] = sens(st, p.team, p.p[0], p.p[2]);
      const ix = Math.max(0, Math.min(GX - 1, Math.floor((x + hx) / (2 * hx) * GX))), iz = Math.max(0, Math.min(GZ - 1, Math.floor((z + hz) / (2 * hz) * GZ)));
      J.heat[per][iz * GX + ix]++;
    }
  }
  // — le tir en vol : le passage de la ligne de but (cadré / hors cadre / frôle)
  if (S.tir && !S.tir.ligne) {
    const b = st.ball.p, g = st.pitch.attackGoal(S.tir.team);
    if (S.ballPrev && Math.sign(b[0] - g.x) !== Math.sign(S.ballPrev[0] - g.x) || Math.abs(b[0]) >= hx) {
      if (Math.abs(b[0]) >= hx - 0.05 && Math.sign(b[0]) === Math.sign(g.x)) {
        const gh = st.pitch.goalHalf, gH = st.pitch.goalH, dz = Math.abs(b[2]) - gh, dy = b[1] - gH;
        S.tir.ligne = { z: +b[2].toFixed(2), y: +b[1].toFixed(2), cadre: dz <= 0 && dy <= 0, frole: (dz > 0 && dz < 0.25 && b[1] < gH + 0.25) || (dy > 0 && dy < 0.25 && dz < 0.25) };
      }
    }
  }
  S.ballPrev = [st.ball.p[0], st.ball.p[1], st.ball.p[2]];
  // — les événements
  for (; S.e0 < st.events.length; S.e0++) lire(S, st, st.events[S.e0], per);
  // — les résolutions au temps
  if (S.pass && st.t - S.pass.t > 8) finirPasse(S, false, 'temps');
  if (S.tir && st.t - S.tir.t > 5) finirTir(S, st, null);
}

function fait(S, o) { S.faits.push(o); return o; }

function finirPasse(S, ok, cause, st = null, rec = null) {
  const P = S.pass; if (!P) return; S.pass = null;
  P.ok = ok; P.cause = cause;
  if (ok && rec != null && st) { P.to = rec; const [x, z] = posDe(st, rec); P.x1 = +x.toFixed(1); P.z1 = +z.toFixed(1); P.len = +hyp(x - P.x, z - P.z).toFixed(1); }
  if (P.len == null) P.len = P.len0 ?? null;
  P.court = P.len != null ? (P.len < 15 ? 'courte' : P.len < 30 ? 'moyenne' : 'longue') : null;
  if (P.x1 != null) P.dir = P.x1 - P.x > 5 ? 'avant' : P.x1 - P.x < -5 ? 'arriere' : 'laterale';
}

function finirTir(S, st, issue) {
  const T = S.tir; if (!T) return; S.tir = null;
  T.issue = issue ?? (T.ligne ? (T.ligne.cadre ? 'cadre' : T.ligne.frole ? 'frole' : 'hors-cadre') : 'autre');
  T.cadre = T.issue === 'but' || T.issue === 'arrete' || (T.issue === 'cadre');
}

/** Le tir pris par un adversaire avant la ligne sans événement d'arrêt ou de contre (le gardien qui capte, le défenseur qui coupe) :
 *  l'arrêt du gardien, le contre du joueur de champ (hier : issue « autre », ~15 % des tirs). */
function tirCoupe(S, st, P) { if (S.tir && !S.tir.ligne && P && P.team !== S.tir.team) finirTir(S, st, P.keeper ? 'arrete' : 'contre'); }

function lire(S, st, e, per) {
  const by = e.by != null && e.by >= 0 && st.players[e.by] ? e.by : null, P = by != null ? st.players[by] : null, team = P?.team ?? e.team ?? e.equipe ?? null;
  const [x, z] = by != null ? posDe(st, by) : [null, null];
  const base = { t: e.t, per, team, by, x: x != null ? +x.toFixed(1) : null, z: z != null ? +z.toFixed(1) : null };
  switch (e.type) {
    case 'pass': {
      if (P?.keeper || e.mains) fait(S, { ...base, k: 'relance', mains: !!e.mains, style: e.style, long: e.style === 'lofted' });
      if (S.pass) finirPasse(S, false, 'coupee');
      if (e.clear || e.to == null || e.to < 0) { fait(S, { ...base, k: 'degagement', style: e.style }); break; }
      const [rx, rz] = posDe(st, e.to);   // la longueur VISÉE (au départ, vers le receveur) : une passe ratée a aussi une longueur
      S.pass = fait(S, { ...base, k: 'passe', to0: e.to, len0: x != null ? +hyp(rx - x, rz - z).toFixed(1) : null, style: e.style, cls: e.cls ?? null, air: e.style === 'lofted' || e.style === 'chip', une: e.style === 'une-touche', urgent: !!e.urgent, through: !!e.through, pSucc: e.pSucc ?? null, dist: e.d ?? null, pied: e.foot ?? null, tech: e.tech ?? e.move ?? null });
      break;
    }
    case 'centre': { if (S.pass && S.pass.by === by) { S.pass.centre = true; S.pass.air = !e.bas; } else fait(S, { ...base, k: 'centre', bas: !!e.bas }); break; }
    case 'receive': case 'control': case 'loose-kept': {
      tirCoupe(S, st, P);
      if (S.pass && P) { if (P.team === S.pass.team) finirPasse(S, true, e.type, st, by); else finirPasse(S, false, 'intercepte', st); }
      if (e.type === 'control') fait(S, { ...base, k: 'controle', tech: e.tech ?? null, rate: !!e.miss && e.issue !== 'conteste-perdu', conteste: e.issue === 'conteste-perdu', issue: e.issue ?? null, interception: !!e.interception });   // la réception contestée perdue est une DÉPOSSESSION, pas un contrôle raté
      break;
    }
    case 'turnover': {
      tirCoupe(S, st, P);
      if (S.pass) finirPasse(S, S.pass.team === e.equipe, 'perte', st, S.pass.team === e.equipe ? by : null);
      const perdant = 1 - e.equipe; S.lastLoss[perdant] = e.t;
      fait(S, { ...base, team: e.equipe, k: 'recuperation', why: e.why, contrePress: e.t - S.lastLoss[e.equipe] < 5 });
      break;
    }
    case 'volée': case 'tête': { if (e.mode === 'dégagement') fait(S, { ...base, k: 'degagement', geste: e.type }); break; }   // au but, le moteur émet AUSSI un 'shot' (compté là)
    case 'shot': {
      if (S.tir) finirTir(S, st, null);
      const g = st.pitch.attackGoal(team), pp = st.players[by].p, dG = hyp(g.x - pp[0], pp[2]);
      const surface = st.pitch.inBox(pp[0], pp[2], Math.sign(g.x || 1)), six = Math.abs(g.x - pp[0]) <= 5.5 && Math.abs(pp[2]) <= 9.16;
      const partie = e.kind === 'tête' || e.geste === 'tête' ? 'tete' : /vol/.test(e.kind ?? '') || e.geste === 'volée' ? 'volee' : 'pied';
      S.tir = fait(S, { ...base, k: 'tir', genre: e.kind ?? e.type, partie, pied: e.foot ?? null, dist: +dG.toFixed(1), surface, six, xg: +xgRef(Math.abs(g.x - pp[0]), pp[2], partie, e.kind === 'coup-franc-direct' || e.kind === 'penalty' ? e.kind : null).toFixed(3), xgMoteur: e.xg ?? null, cf: e.kind === 'coup-franc-direct', vitesse: e.speed ?? null });
      break;
    }
    case 'but': {
      const T = S.tir && S.tir.team === e.team ? S.tir : null; if (T) finirTir(S, st, 'but');
      fait(S, { ...base, team: e.team, k: 'but', by: e.by ?? T?.by ?? null, csc: !!e.csc, tir: T ? S.faits.indexOf(T) : null, passeur: T ? passeurDe(S, T) : null });
      if (T) T.but = true;
      break;
    }
    case 'arrêt': { if (S.tir && S.tir.team !== team) finirTir(S, st, 'arrete'); fait(S, { ...base, k: 'arret', mode: e.mode, aerien: !!e.aerienne }); break; }
    case 'contre': { if (S.tir && S.tir.team !== team) finirTir(S, st, 'contre'); fait(S, { ...base, k: 'contre', issue: e.issue ?? null }); break; }
    case 'sortie': { if (S.tir && (e.out === 'sortie-de-but' || e.out === 'corner')) finirTir(S, st, null); if (S.pass) finirPasse(S, false, 'sortie'); fait(S, { t: e.t, per, team: e.team ?? null, k: 'sortie', out: e.out }); break; }
    case 'duel': {
      if (e.kind === 'take-on') { const d = e.contre; fait(S, { ...base, k: 'dribble', contre: d, ok: /^FRANCHI/.test(e.issue ?? ''), perdu: /^DEPOSSEDE/.test(e.issue ?? ''), issue: e.issue, geste: e.geste ?? null }); }
      else if (e.kind === 'aérien') fait(S, { ...base, k: 'aerien', contre: e.contre, gagne: e.won !== false });
      else if (e.kind === 'épaule') fait(S, { ...base, k: 'epaule', contre: e.sur, gagne: !!e.won });
      else fait(S, { ...base, k: 'tacle', gagne: !!e.won, glisse: false });
      break;
    }
    case 'slide': fait(S, { ...base, k: 'tacle', gagne: !!e.won, glisse: true }); break;
    case 'tacle-pique': fait(S, { ...base, k: 'tacle', gagne: true, pique: true }); break;
    case 'faute': fait(S, { ...base, k: 'faute', sur: e.sur ?? null, genre: e.kind ?? null }); break;
    case 'carton': fait(S, { ...base, k: 'carton', couleur: e.couleur }); break;
    case 'hors-jeu': fait(S, { ...base, k: 'hors-jeu' }); break;
    case 'press': fait(S, { t: e.t, per, team: e.team ?? null, k: 'pression', genre: e.kind ?? null }); break;
    case 'contre-press': fait(S, { t: e.t, per, team: e.team ?? null, k: 'contre-press', n: e.n ?? null }); break;
    case 'clearance': fait(S, { ...base, k: 'degagement', geste: 'pied' }); break;
    case 'sortie-aerienne': fait(S, { ...base, k: 'sortie-gk' }); break;
    case 'skill': if (e.kind && !/-(tente|vendu)$/.test(e.kind)) fait(S, { ...base, k: 'geste', genre: e.kind, reussi: e.reussi ?? null }); break;
    case 'touche': fait(S, { ...base, k: 'touche', tech: e.tech ?? null }); break;
  }
}

/** Le passeur décisif d'un tir : la dernière passe réussie reçue par le tireur dans les 6 s. */
function passeurDe(S, T) {
  for (let i = S.faits.length - 1; i >= 0; i--) { const f = S.faits[i]; if (T.t - f.t > 6) break; if (f.k === 'passe' && f.ok && f.to === T.by && f.t <= T.t) return f.by; }
  return null;
}

// ————————————————————————————————— le rapport —————————————————————————————————

const n = (a) => a.length, somme = (a, f) => a.reduce((s, x) => s + (f(x) ?? 0), 0), pct = (a, b) => (b ? +(100 * a / b).toFixed(1) : null), r1 = (x) => (x == null ? null : +x.toFixed(1)), r2 = (x) => (x == null ? null : +x.toFixed(2));

/** Le rapport complet (per : null = match entier, 1 ou 2 = une mi-temps). */
export function statsReport(S, st, { per = null } = {}) {
  // la passe encore en vol au rapport (non résolue) se classe sur sa longueur VISÉE
  for (const f of S.faits) if (f.k === 'passe' && f.court == null && f.len0 != null) f.court = f.len0 < 15 ? 'courte' : f.len0 < 30 ? 'moyenne' : 'longue';
  const F = S.faits.filter((f) => per == null || f.per === per);
  const hx = st.pitch.hx, pers = per == null ? [1, 2] : [per];
  // les passes clés : la passe réussie dont le receveur tire dans les 5 s
  const tirs = F.filter((f) => f.k === 'tir');
  for (const T of tirs) { for (let i = F.indexOf(T) - 1; i >= 0; i--) { const f = F[i]; if (T.t - f.t > 5) break; if (f.k === 'passe' && f.ok && f.to === T.by) { f.cle = true; break; } } }
  const buts = F.filter((f) => f.k === 'but');
  const equipe = (team) => {
    const E = (k) => F.filter((f) => f.k === k && f.team === team), A = (k) => F.filter((f) => f.k === k && f.team === 1 - team);
    const pa = E('passe'), ti = E('tir'), ok = pa.filter((p) => p.ok);
    const possT = somme(pers, (p) => S.poss[p][team]), possA = somme(pers, (p) => S.poss[p][1 - team]);
    // le PPDA : passes adverses dans leurs 60 % / nos actions défensives dans cette zone (la hauteur du pressing)
    const pAdv = A('passe').filter((p) => p.x != null && p.x < -hx + 0.6 * 2 * hx).length;
    const actions = F.filter((f) => f.team === team && ((f.k === 'tacle') || (f.k === 'recuperation' && f.why === 'interception') || f.k === 'faute') && f.x != null && f.x > hx - 0.6 * 2 * hx).length;
    const rec = E('recuperation');
    return {
      buts: buts.filter((b) => b.team === team).length,
      xg: r2(somme(ti, (t) => t.xg)), xgMoteur: r2(somme(ti, (t) => t.xgMoteur)),
      possession: pct(possT, possT + possA),
      tirs: n(ti), cadres: ti.filter((t) => t.cadre).length, horsCadre: ti.filter((t) => t.issue === 'hors-cadre' || t.issue === 'frole').length, frole: ti.filter((t) => t.issue === 'frole').length,
      contres: ti.filter((t) => t.issue === 'contre').length, arretes: ti.filter((t) => t.issue === 'arrete').length,
      tirsSurface: ti.filter((t) => t.surface).length, tirsHorsSurface: ti.filter((t) => !t.surface).length, tirsSixMetres: ti.filter((t) => t.six).length,
      tirsPied: ti.filter((t) => t.partie === 'pied').length, tirsTete: ti.filter((t) => t.partie === 'tete').length, tirsVolee: ti.filter((t) => t.partie === 'volee').length,
      distTir: r1(n(ti) ? somme(ti, (t) => t.dist) / n(ti) : null), xgParTir: r2(n(ti) ? somme(ti, (t) => t.xg) / n(ti) : null),
      passes: n(pa), passesReussies: n(ok), reussite: pct(n(ok), n(pa)),
      courtes: pa.filter((p) => p.court === 'courte').length, moyennes: pa.filter((p) => p.court === 'moyenne').length, longues: pa.filter((p) => p.court === 'longue').length,
      auSol: pa.filter((p) => !p.air).length, enHauteur: pa.filter((p) => p.air).length, uneTouche: pa.filter((p) => p.une).length,
      versAvant: pa.filter((p) => p.dir === 'avant').length, laterales: pa.filter((p) => p.dir === 'laterale').length, versArriere: pa.filter((p) => p.dir === 'arriere').length,
      dernierTiers: ok.filter((p) => p.x1 != null && p.x1 > hx / 3).length, passesCles: pa.filter((p) => p.cle).length, centres: pa.filter((p) => p.centre).length + E('centre').length,
      reussiteLongues: pct(pa.filter((p) => p.court === 'longue' && p.ok).length, pa.filter((p) => p.court === 'longue').length),
      dribbles: n(E('dribble')), dribblesReussis: E('dribble').filter((d) => d.ok).length,
      duelsSol: E('tacle').length + E('dribble').length + A('dribble').length + E('epaule').length + A('epaule').length,
      duelsSolGagnes: E('tacle').filter((d) => d.gagne).length + E('dribble').filter((d) => d.ok).length + A('dribble').filter((d) => d.perdu).length + E('epaule').filter((d) => d.gagne).length + A('epaule').filter((d) => !d.gagne).length,
      duelsAeriens: E('aerien').length + A('aerien').length, duelsAeriensGagnes: E('aerien').filter((d) => d.gagne).length + A('aerien').filter((d) => !d.gagne).length,
      tacles: E('tacle').length, taclesGagnes: E('tacle').filter((d) => d.gagne).length, interceptions: rec.filter((r) => r.why === 'interception').length,
      recuperations: n(rec), recupHauteur: r1(n(rec) ? somme(rec, (r) => r.x) / n(rec) : null), recupCampAdverse: rec.filter((r) => r.x != null && r.x > 0).length,
      recupContrePress: rec.filter((r) => r.contrePress).length, pressions: E('pression').length + E('contre-press').length, ppda: pAdv && actions ? r1(pAdv / actions) : null,
      degagements: E('degagement').length, contresDefensifs: E('contre').length,
      fautes: E('faute').length, fautesSubies: A('faute').filter((f) => f.sur != null).length, jaunes: E('carton').filter((c) => c.couleur === 'jaune').length, rouges: E('carton').filter((c) => c.couleur === 'rouge').length,
      controlesRates: E('controle').filter((c) => c.rate).length, depossedesReception: E('controle').filter((c) => c.conteste).length,
      horsJeu: E('hors-jeu').length, corners: F.filter((f) => f.k === 'sortie' && f.out === 'corner' && f.team === team).length,
      arrets: A('tir').filter((t) => t.issue === 'arrete').length, prisesGardien: E('arret').length, sortiesGardien: E('sortie-gk').length,   // l'arrêt = sur un TIR ; la prise = toute intervention (centre, ballon au pied…)
    };
  };
  const joueur = (J) => {
    const mine = (k) => F.filter((f) => f.k === k && f.by === J.id), pa = mine('passe'), ok = pa.filter((p) => p.ok), ti = mine('tir');
    const vers = {}; for (const p of ok) if (p.to != null) vers[p.to] = (vers[p.to] ?? 0) + 1;
    const dr = mine('dribble'), tac = mine('tacle'), aer = F.filter((f) => f.k === 'aerien' && (f.by === J.id || f.contre === J.id));
    const subis = F.filter((f) => f.k === 'dribble' && f.contre === J.id), rec = mine('recuperation');
    const G = buts.filter((b) => b.by === J.id && !b.csc).length, PD = buts.filter((b) => b.passeur === J.id).length;
    const conc = J.keeper ? buts.filter((b) => b.team !== J.team).length : 0, arr = J.keeper ? F.filter((f) => f.k === 'tir' && f.team !== J.team && f.issue === 'arrete').length : 0;
    const xgFace = J.keeper ? r2(somme(F.filter((f) => f.k === 'tir' && f.team !== J.team && f.cadre), (t) => t.xg)) : null;
    const heat = new Float32Array(GX * GZ); for (const p of pers) { const h = J.heat[p]; for (let i = 0; i < h.length; i++) heat[i] += h[i]; }
    const o = {
      id: J.id, team: J.team, keeper: J.keeper, post: J.post, name: J.name,
      minutes: r1(somme(pers, (p) => J.tJeu[p]) / 60), distance: Math.round(somme(pers, (p) => J.dist[p])), sprints: somme(pers, (p) => J.sprints[p]), vMax: r1(J.vMax * 3.6),
      touches: F.filter((f) => f.by === J.id && ['touche', 'controle', 'passe', 'tir', 'dribble', 'degagement'].includes(f.k)).length,
      buts: G, passesDecisives: PD, tirs: n(ti), cadres: ti.filter((t) => t.cadre).length, xg: r2(somme(ti, (t) => t.xg)),
      passes: n(pa), passesReussies: n(ok), reussite: pct(n(ok), n(pa)), passesCles: pa.filter((p) => p.cle).length,
      courtes: pa.filter((p) => p.court === 'courte').length, moyennes: pa.filter((p) => p.court === 'moyenne').length, longues: pa.filter((p) => p.court === 'longue').length,
      enHauteur: pa.filter((p) => p.air).length, versAvant: pa.filter((p) => p.dir === 'avant').length, centres: pa.filter((p) => p.centre).length,
      schema: vers,
      dribbles: n(dr), dribblesReussis: dr.filter((d) => d.ok).length, depossede: dr.filter((d) => d.perdu).length, dribblesSubis: n(subis), dribblesStoppes: subis.filter((d) => d.perdu).length,
      tacles: n(tac), taclesGagnes: tac.filter((d) => d.gagne).length, interceptions: rec.filter((r) => r.why === 'interception').length, recuperations: n(rec),
      aeriens: n(aer), aeriensGagnes: aer.filter((d) => (d.by === J.id) === d.gagne).length,
      degagements: mine('degagement').length, contres: mine('contre').length,
      fautes: mine('faute').length, fautesSubies: F.filter((f) => f.k === 'faute' && f.sur === J.id).length, jaunes: mine('carton').filter((c) => c.couleur === 'jaune').length, rouges: mine('carton').filter((c) => c.couleur === 'rouge').length,
      horsJeu: mine('hors-jeu').length, controlesRates: mine('controle').filter((c) => c.rate).length, depossedeReception: mine('controle').filter((c) => c.conteste).length,
      ...(J.keeper ? { arrets: arr, prises: mine('arret').length, butsEncaisses: conc, xgCadreFace: xgFace, sorties: mine('sortie-gk').length, relances: mine('relance').length, relancesMain: mine('relance').filter((r) => r.mains).length } : {}),
      heat: Array.from(heat), heatGrille: [GX, GZ],
    };
    o.note = noteDe(o);
    return o;
  };
  return {
    per, duree: r1(F.length ? F[F.length - 1].t - (F[0]?.t ?? 0) : 0), score: [buts.filter((b) => b.team === 0).length, buts.filter((b) => b.team === 1).length],
    equipes: [equipe(0), equipe(1)],
    joueurs: S.J.map(joueur),
    tirs: tirs.map((t) => ({ t: t.t, per: t.per, team: t.team, by: t.by, x: t.x, z: t.z, xg: t.xg, xgMoteur: t.xgMoteur, partie: t.partie, genre: t.genre, surface: t.surface, issue: t.issue, but: !!t.but, dist: t.dist })),
    buts: buts.map((b) => ({ t: b.t, per: b.per, team: b.team, by: b.by, passeur: b.passeur, csc: b.csc })),
    xgCourbe: tirs.map((t) => ({ t: t.t, team: t.team, xg: t.xg ?? 0, but: !!t.but })),
  };
}

/** LA NOTE DU JOUEUR (/10, départ 6,0) : la contribution pesée — buts, passes décisives et clés, xG, passes réussies au-delà de 80 %,
 *  dribbles, actions défensives, discipline ; le gardien par ses arrêts et l'écart xG cadré / buts encaissés. Bornée [3 ; 10]. Pure. */
export function noteDe(o) {
  if (!o.minutes || o.minutes < 5) return null;
  let s = 6 + o.buts * 1.0 + o.passesDecisives * 0.6 + o.passesCles * 0.15 + (o.xg ?? 0) * 0.4
    + (o.passes >= 10 ? ((o.reussite ?? 80) - 80) * 0.02 : 0) + o.dribblesReussis * 0.1 - o.depossede * 0.08 - o.controlesRates * 0.08 - (o.depossedeReception ?? 0) * 0.06
    + o.taclesGagnes * 0.12 + o.interceptions * 0.1 + o.dribblesStoppes * 0.1 + o.contres * 0.12 + o.degagements * 0.03 + o.aeriensGagnes * 0.05
    - o.fautes * 0.05 - o.jaunes * 0.3 - o.rouges * 1.5;
  if (o.keeper) s += (o.arrets ?? 0) * 0.25 - (o.butsEncaisses ?? 0) * 0.35 + ((o.xgCadreFace ?? 0) - (o.butsEncaisses ?? 0)) * 0.5;
  return +Math.max(3, Math.min(10, s)).toFixed(1);
}
