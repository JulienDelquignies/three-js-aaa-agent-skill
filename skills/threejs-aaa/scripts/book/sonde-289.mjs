// sonde 289 — LE GRAND LIVRE DES PASSES (Modèle 09 § 5.1 le tableau cible de la complétion, § 7.1 la répartition des pertes et § 7.2
// sa règle d'attribution, test 4 le sous-dosage ; Référentiel 02 le tableau de calibration : volume, réussite, direction, séquences).
// Chaque passe (hors dégagements et touches à la main) est suivie jusqu'à sa PREMIÈRE touche : un coéquipier (complétée), un adversaire
// (perdue — classée), une sortie, un hors-jeu. La classification suit l'ordre du book § 7.2 :
// (1) BLOQUÉE — l'adversaire touche en vol ≤ 0,4 s après la frappe ou à ≤ 5 m du départ (Anzer & Bauer : 3,12 % de toutes les passes) ;
// (2) HORS D'ATTEINTE — la trajectoire contrefactuelle (predictPath : le ballon que personne ne touche) ne passe jamais à ≤ R m du
//     receveur (sa position réelle, suivie 3 s) — courte / longue / large selon l'erreur radiale au plus près (test 4 : 60-70 % courtes) ;
// (3) INTERCEPTÉE — la trajectoire allait au receveur mais un adversaire la prend : À DESTINATION (à ≤ 3 m du receveur) ou EN ROUTE ;
// (4) NON PRISE — le ballon est passé à portée, personne ne l'a touché, l'adversaire le ramasse ou il sort (le défaut propre au moteur) ;
// (5) CONTRÔLE RATÉ — le receveur touche MAL (manqué, lourd, contesté) puis l'adversaire prend avant qu'il ne joue.
// Et toutes les AUTRES pertes (duel du porteur, ballon libre hors passe, sortie non forcée, hors-jeu, faute) pour la répartition § 7.1 ;
// les SÉQUENCES Opta (Référentiel 02 § 7 : du gain à la perte, au tir ou à l'arrêt) : passes, durée, progression, vitesse directe.
// DUR est la durée d'une PÉRIODE : le match fait 2 × DUR (les sondes 287-288 étiquetaient « 4 × 45 min » des matchs de 90 min).
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
import { predictPath } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/ball-predict.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700), R = +(process.argv[5] ?? 1.5);
const hyp = Math.hypot, pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—'), YD = 0.9144;
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.min(a.length - 1, Math.floor(x * a.length))] : NaN; };
const moy = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const mk = () => ({ n: 0, ok: 0 }), add = (g, ok) => { g.n++; if (ok) g.ok++; };
const O = { matchs: 0, passes: 0, ouvert: 0, cpa: mk(), res: {}, dist: [mk(), mk(), mk(), mk()], long32: mk(), sol: mk(), aer: mk(), hautSol: mk(), hautAer: mk(), dir: [mk(), mk(), mk()], bin: [mk(), mk()], zone: [mk(), mk(), mk()], surface: mk(), style: {}, cls: {},
  pertes: {}, radial: { courte: 0, longue: 0, large: 0 }, radialP: { courte: 0, longue: 0, large: 0 }, len: [], v0: { court: [], moyen: [], long: [] }, errOk: [], errKo: [], parEquipe: [], ratees: [], longs: [], nonResolues: 0, tirs: 0,
  seq: { n: 0, passes: [], duree: [], prog: [], dix: 0 } };
const LIB = { COMPLETE: 'complétée (le receveur)', COMPLETE_AUTRE: 'complétée (un autre coéquipier)', BLOQUEE: 'BLOQUÉE (≤ 0,4 s / 5 m)', HORS_ATTEINTE: "HORS D'ATTEINTE", INTER_DEST: 'INTERCEPTÉE à destination', INTER_ROUTE: 'INTERCEPTÉE en route', NON_PRISE: 'NON PRISE (passée à portée)', SORTIE: 'SORTIE (hors atteinte, dehors)', SORTIE_NON_PRISE: 'SORTIE non prise (à portée)', HORS_JEU: 'HORS-JEU', FAUTE: 'faute', RENVOI_ADV: 'déviée dehors par un adversaire', INCONNU: 'non résolue' };
const PASSE_PERTE = ['BLOQUEE', 'HORS_ATTEINTE', 'SORTIE', 'INTER_DEST', 'INTER_ROUTE', 'NON_PRISE', 'SORTIE_NON_PRISE'];
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); O.matchs++;
  let seen = 0, rec = null, watch = null, restart0 = st.restart, lastPris = null, seq = null; const parEq = [0, 0], rat = [0, 0], lg = [0, 0], suivis = [];
  const sg = (team) => Math.sign(st.pitch.attackGoal(team).x || 1);
  const perte = (cause) => { O.pertes[cause] = (O.pertes[cause] ?? 0) + 1; };
  const seqFin = () => { if (!seq) return; O.seq.n++; O.seq.passes.push(seq.passes); O.seq.duree.push(st.t - seq.t0); O.seq.prog.push(st.ball.p[0] * sg(seq.team) - seq.x0); if (seq.passes >= 10) O.seq.dix++; seq = null; };
  const seqDebut = (team) => { seqFin(); seq = { team, t0: st.t, x0: st.ball.p[0] * sg(team), passes: 0 }; };
  // la fermeture : l'issue est posée maintenant, la classe finale attend la trajectoire contrefactuelle (3 s de course du receveur)
  const ferme = (r, res, perteCtx = null) => { if (r.res) return; r.res = res; r.perte = perteCtx; r.dRecv = (() => { const m = st.players[r.to]; return m ? hyp(st.ball.p[0] - m.p[0], st.ball.p[2] - m.p[2]) : 99; })(); r.dt = st.t - r.t0; r.dOri = hyp(st.ball.p[0] - r.ori[0], st.ball.p[2] - r.ori[1]); if (r === rec) rec = null; if (r.cfDone) finalise(r); };
  const perdue = (r, ctx) => ferme(r, 'PERDUE', ctx);
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    const possT = st.possession.team;
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (let k = suivis.length - 1; k >= 0; k--) { const r = suivis[k], m = st.players[r.to]; if (m) r.traj.push([st.t - r.t0, m.p[0], m.p[2]]);
      if (!r.res && st.ball.p[1] > r.hMax) r.hMax = st.ball.p[1];
      if (st.t - r.t0 >= 3) { suivis.splice(k, 1); bilan(r); } }
    for (; seen < st.events.length; seen++) { const e = st.events[seen], p = e.by != null ? st.players[e.by] : null;
      if (e.type === 'shot') { O.tirs++; if (rec && p && p.team === rec.team) ferme(rec, e.by === rec.to ? 'COMPLETE' : 'COMPLETE_AUTRE'); watch = null; seqFin(); continue; }
      if (e.type === 'hors-jeu') { if (rec) ferme(rec, 'HORS_JEU'); perte('HORS-JEU'); watch = null; seqFin(); continue; }
      if (e.type === 'faute') { if (rec) ferme(rec, 'FAUTE'); if (p && p.team === possT) perte('FAUTE offensive'); watch = null; continue; }
      if (e.type === 'restart-pris') { lastPris = { by: e.by, t: st.t }; if (p) seqDebut(p.team); continue; }
      if ((e.type === 'control' || e.type === 'receive' || e.type === 'loose-kept' || e.type === 'tête' || (e.type === 'duel' && e.kind === 'aérien' && e.won)) && p) {
        if (rec && p.team === rec.team) ferme(rec, e.by === rec.to ? 'COMPLETE' : 'COMPLETE_AUTRE');
        else if (rec && p.team !== rec.team && e.type !== 'control' && e.type !== 'receive') { perte('(passe) ' + rec.id); perdue(rec, 'vol'); }
        if (e.type === 'control') watch = e.miss || e.issue === 'manque' || e.issue === 'conteste-perdu' || e.issue === 'lourde' ? { team: p.team, t: st.t, fen: e.miss || e.issue === 'manque' ? 3 : 1.5 } : null;
        if (!seq || seq.team !== p.team) seqDebut(p.team);
        continue; }
      if (e.type === 'turnover') { const perdant = 1 - e.equipe;
        if (rec && rec.team === perdant) { perte('(passe) ' + rec.id); perdue(rec, e.why === 'interception' ? 'vol' : 'libre'); }
        else if (watch && watch.team === perdant && st.t - watch.t <= watch.fen) perte('CONTRÔLE RATÉ');
        else perte(e.why === 'tackle' ? 'DUEL du porteur (tacle)' : e.why === 'récupération' ? 'BALLON LIBRE hors passe (conduite, rebond, dégagement)' : 'interception hors passe (tir, dégagement)');
        watch = null; seqDebut(e.equipe); continue; }
      if (e.type === 'pass') {
        if (rec && p && p.team === rec.team) ferme(rec, e.by === rec.to ? 'COMPLETE' : 'COMPLETE_AUTRE');
        else if (rec && p && p.team !== rec.team) { perte('(passe) ' + rec.id); perdue(rec, 'vol'); }
        watch = null;
        if (e.clear || e.mains || e.to == null || e.to < 0 || !p) continue;
        const m = st.players[e.to]; if (!m || m.team !== p.team) continue;
        const s = sg(p.team), lead = st.pass?.lead ?? [m.p[0], 0, m.p[2]], ori = [st.pass?.origin?.[0] ?? st.ball.p[0], st.pass?.origin?.[1] ?? st.ball.p[2]];
        const dx = lead[0] - ori[0], dz = lead[2] - ori[1], L = hyp(dx, dz), ang = Math.atan2(dz * s, dx * s) * 180 / Math.PI;
        rec = { id: O.passes + suivis.length + seed * 1e5 + i, team: p.team, by: e.by, to: e.to, t0: st.t, ori, lead, L, ang, style: e.style, cls: e.cls ?? '?', v0: e.speed ?? hyp(st.ball.v[0], st.ball.v[2]),
          path: predictPath(st.ball, { dt: 1 / 30, maxT: 3 }), traj: [[0, m.p[0], m.p[2]]], hMax: st.ball.p[1], res: null, cfDone: false,
          ouvert: !(lastPris && lastPris.by === e.by && st.t - lastPris.t < 1.5), zone: (ori[0] * s + st.pitch.hx) / (2 * st.pitch.hx), surface: st.pitch.inBox ? st.pitch.inBox(lead[0], lead[2], -s) : false };
        parEq[p.team]++; if (L >= 32) lg[p.team]++; suivis.push(rec); if (seq && seq.team === p.team) seq.passes++; else { seqDebut(p.team); seq.passes++; } continue; }
    }
    if (st.restart && st.restart !== restart0 && ['touche', 'corner', 'sortie-de-but', 'coup-franc', 'penalty', 'engagement'].includes(st.restart.type)) {
      const pour = st.restart.team;
      if (st.restart.type !== 'engagement') {
        if (rec) { if (st.restart.type === 'coup-franc' || st.restart.type === 'penalty') ferme(rec, 'FAUTE'); else if (pour !== rec.team) { perte('(passe) ' + rec.id); perdue(rec, 'dehors'); } else ferme(rec, 'RENVOI_ADV'); }
        else if (pour !== possT && possT >= 0 && ['touche', 'corner', 'sortie-de-but'].includes(st.restart.type)) perte('SORTIE non forcée (porteur, tir contré, dégagement)');
      }
      watch = null; seqFin();
    }
    restart0 = st.restart;
    if (rec && st.t - rec.t0 > 6) ferme(rec, 'INCONNU');
  }
  seqFin(); O.parEquipe.push(...parEq); O.longs.push(...lg);
  function bilan(r) {   // la trajectoire contrefactuelle contre la course réelle du receveur : l'erreur d'atteinte, courte / longue / large
    let best = { d: 99, k: -1, j: -1 };
    for (let k = 0; k < r.path.length; k++) { const b = r.path[k]; if (b.p[1] > 2.0) continue; let j = 0; while (j < r.traj.length - 1 && r.traj[j][0] < b.t) j++; const m = r.traj[j]; const d = hyp(b.p[0] - m[1], b.p[2] - m[2]); if (d < best.d) best = { d, k, j }; }
    r.cf = { min: best.d };
    if (best.k >= 0) { const b = r.path[best.k].p, m = r.traj[best.j], ux = m[1] - r.ori[0], uz = m[2] - r.ori[1], ul = hyp(ux, uz) || 1;
      const radial = ((b[0] - r.ori[0]) * ux + (b[2] - r.ori[1]) * uz) / ul - ul, lat = Math.abs(((b[0] - r.ori[0]) * -uz + (b[2] - r.ori[1]) * ux) / ul);
      r.cf.sens = Math.abs(radial) >= lat ? (radial < 0 ? 'courte' : 'longue') : 'large'; }
    r.cfDone = true; if (r.res) finalise(r);
  }
  function finalise(r) {
    if (r.done) return; r.done = true;
    if (r.res === 'PERDUE') {   // la règle d'attribution § 7.2, dans son ordre
      const c = r.perte === 'vol' && (r.dt <= 0.4 || r.dOri <= 5) ? 'BLOQUEE' : r.cf.min > R ? (r.perte === 'dehors' ? 'SORTIE' : 'HORS_ATTEINTE') : r.perte === 'vol' ? (r.dRecv <= 3 ? 'INTER_DEST' : 'INTER_ROUTE') : r.perte === 'dehors' ? 'SORTIE_NON_PRISE' : 'NON_PRISE';
      r.res = c; O.pertes['(passe) ' + r.id]--; delete O.pertes['(passe) ' + r.id]; perte(c); rat[r.team]++;
    } else if (!['COMPLETE', 'COMPLETE_AUTRE', 'INCONNU'].includes(r.res)) rat[r.team]++;
    if (r.res === 'INCONNU') { O.nonResolues++; return; }
    O.passes++; const ok = r.res === 'COMPLETE' || r.res === 'COMPLETE_AUTRE'; if (r.ouvert) O.ouvert++; else add(O.cpa, ok);
    O.res[r.res] = (O.res[r.res] ?? 0) + 1;
    const ydL = r.L / YD; if (ydL >= 5) add(O.dist[ydL < 15 ? 0 : ydL < 30 ? 1 : 2], ok); else add(O.dist[3], ok); if (r.L >= 32) add(O.long32, ok);
    add(r.style === 'ground' || r.style === 'une-touche' ? O.sol : O.aer, ok); add(r.hMax <= 1.5 ? O.hautSol : O.hautAer, ok);
    add(O.dir[Math.abs(r.ang) <= 45 ? 0 : Math.abs(r.ang) >= 135 ? 2 : 1], ok); add(O.bin[Math.abs(r.ang) > 90 ? 1 : 0], ok);
    add(O.zone[r.zone < 1 / 3 ? 0 : r.zone < 2 / 3 ? 1 : 2], ok); if (r.surface) add(O.surface, ok);
    add(O.style[r.style] ??= mk(), ok); add(O.cls[r.cls] ??= mk(), ok);
    O.len.push(r.L); O.v0[r.L < 15 ? 'court' : r.L < 30 ? 'moyen' : 'long'].push(r.v0); (ok ? O.errOk : O.errKo).push(r.cf.min);
    if (!ok && PASSE_PERTE.includes(r.res) && r.res !== 'BLOQUEE' && r.cf.sens) { O.radial[r.cf.sens]++; if (r.res === 'HORS_ATTEINTE' || r.res === 'SORTIE') O.radialP[r.cf.sens]++; }
  }
  // les passes encore suivies à la fin du match : bilan immédiat
  for (const r of suivis) bilan(r);
  O.ratees.push(...rat);
}
const n = O.matchs, P = O.passes, T = (g) => `${pc(g.ok, g.n)} % (${g.n})`;
const pertes = Object.fromEntries(Object.entries(O.pertes).filter(([k]) => !k.startsWith('(passe)'))), tot = Object.values(pertes).reduce((a, b) => a + b, 0);
const pertePasse = PASSE_PERTE.reduce((a, k) => a + (pertes[k] ?? 0), 0), cplt = (O.res.COMPLETE ?? 0) + (O.res.COMPLETE_AUTRE ?? 0);
console.log(`${n} matchs de 2 × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ${P} passes classées, ${O.nonResolues} non résolues, R = ${R} m`);
console.log(`  VOLUME : ${(moy(O.parEquipe)).toFixed(0)} passes tentées par équipe et par match (cible 420-475 ; p25-p75 ${q(O.parEquipe, 0.25)}-${q(O.parEquipe, 0.75)}) ; ratées ${moy(O.ratees).toFixed(0)} par équipe (cible ~80) ; ballons longs ≥ 32 m ${moy(O.longs).toFixed(0)} par équipe (45-50)`);
console.log(`  COMPLÉTION globale ${pc(cplt, P)} % (cible 82,5 ± 1,5) — dont au receveur visé ${pc(O.res.COMPLETE ?? 0, P)} % ; jeu ouvert ${O.ouvert}, coups de pied arrêtés ${T(O.cpa)}`);
console.log(`  par distance : 5-15 yd ${T(O.dist[0])} (cible 88-92) ; 15-30 yd ${T(O.dist[1])} (82-87) ; 30+ yd ${T(O.dist[2])} (55-65) ; < 5 yd ${T(O.dist[3])} ; ≥ 32 m ${T(O.long32)} (47 ± 5)`);
console.log(`  par hauteur : style sol ${T(O.sol)} / aérien ${T(O.aer)} ; apex ≤ 1,5 m ${T(O.hautSol)} (cible 90-95) / > 1,5 m ${T(O.hautAer)} (< sol)`);
console.log(`  par direction : avant ±45° ${T(O.dir[0])}, latérale ${T(O.dir[1])}, arrière ±45° ${T(O.dir[2])} (travail : avant 35-42, latéral 22-28, arrière 30-42) ; part vers l'arrière (binaire) ${pc(O.bin[1].n, O.bin[0].n + O.bin[1].n)} % (36,5 ; 24-42), réussite arrière ${T(O.bin[1])} / avant ${T(O.bin[0])}`);
console.log(`  par tiers de départ : défensif ${T(O.zone[0])} (90-95), médian ${T(O.zone[1])} (82-88), offensif ${T(O.zone[2])} (65-75) ; vers la surface ${T(O.surface)} (45-60)`);
console.log(`  issues : ${Object.entries(O.res).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${LIB[k] ?? k} ${pc(v, P)} %`).join(' ; ')} ; BLOQUÉES ${pc(O.res.BLOQUEE ?? 0, P)} % de toutes les passes (3,12)`);
console.log(`  PERTES ${(tot / n / 2).toFixed(0)} par équipe et par match (cible 110-140) — imputables à la passe ${pc(pertePasse, tot)} % (46-57) : ${Object.entries(pertes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${LIB[k] ?? k} ${pc(v, tot)} %`).join(' ; ')}`);
console.log(`  cibles § 7.1 : bloquée 10-12 ; hors d'atteinte 20-25 ; interceptée à destination 16-20 ; contrôle raté 9-13 ; conduite/dribble 14-18 ; tacle hors dribble 8-12 ; sortie non forcée 6-9 ; hors-jeu/faute 4-6`);
const rt = O.radial.courte + O.radial.longue + O.radial.large, rp = O.radialP.courte + O.radialP.longue + O.radialP.large;
console.log(`  SOUS-DOSAGE (test 4, ratées non bloquées, ${rt}) : courtes ${pc(O.radial.courte, rt)} %, longues ${pc(O.radial.longue, rt)} %, larges ${pc(O.radial.large, rt)} % (60-70 % courtes) ; hors d'atteinte seules (${rp}) : courtes ${pc(O.radialP.courte, rp)} %, longues ${pc(O.radialP.longue, rp)} %, larges ${pc(O.radialP.large, rp)} %`);
console.log(`  SÉQUENCES (${(O.seq.n / n / 2).toFixed(0)} par équipe et par match) : passes par séquence ${moy(O.seq.passes).toFixed(2)} (3,5-5,1), durée ${moy(O.seq.duree).toFixed(1)} s (9,5-10,4), progression ${moy(O.seq.prog).toFixed(1)} m (12,1-12,6), vitesse directe ${(moy(O.seq.prog) / moy(O.seq.duree)).toFixed(2)} m/s (1,4-2,1), séquences de 10+ passes ${(O.seq.dix / n / 2).toFixed(1)} par équipe et par match (possession ~17-24, directe ~5)`);
console.log(`  longueur p25/p50/p75 ${q(O.len, 0.25).toFixed(1)}/${q(O.len, 0.5).toFixed(1)}/${q(O.len, 0.75).toFixed(1)} m, moyenne ${moy(O.len).toFixed(1)} (20-22) ; vitesse au départ p50 court ${q(O.v0.court, 0.5).toFixed(1)} / moyen ${q(O.v0.moyen, 0.5).toFixed(1)} / long ${q(O.v0.long, 0.5).toFixed(1)} m/s ; erreur d'atteinte p50 complétées ${q(O.errOk, 0.5).toFixed(2)} m, ratées ${q(O.errKo, 0.5).toFixed(2)} m`);
console.log(`  par style : ${Object.entries(O.style).sort((a, b) => b[1].n - a[1].n).map(([k, g]) => `${k} ${T(g)}`).join(' ; ')}`);
console.log(`  par classe : ${Object.entries(O.cls).sort((a, b) => b[1].n - a[1].n).slice(0, 10).map(([k, g]) => `${k} ${T(g)}`).join(' ; ')}`);
