// verify-sortie-aerienne.mjs — LA SORTIE AÉRIENNE DU GARDIEN (lot B10 = doc Branchements § 10, cfg.sortieAerienne ; sortie-aerienne.js).
// Le vol est déterministe : sur un ballon libre qui retombe dans sa zone (≤ zone m de sa ligne) entre bas et haut m, atteignable avant
// le ballon et sans attaquant dessus, le gardien y COURT (événement 'sortie-aerienne', une fois par vol) et, si le point est au-dessus
// de la prise debout, ARME plongeonPrise (windup sortie:true) le temps de contact du clip avant le ballon — le contact de la détente
// (onDive) résout la prise aérienne avec la portée du saut. Sous 1,9 m : la course puis la prise debout d'hier ('prise-gardien') —
// mais un vol qui redescend si bas dans la zone finit au but : c'est un tir, le réflexe (keeperDecide) le garde.
// Hier : le gardien tenait sa bissectrice et le centre se jouait à la tête ou au rebond. null : l'hier au bit.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { predictPath, crossesHeight } from '../assets/starter/src/engine/ball-predict.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const hyp = Math.hypot;

// LA FIXTURE : le monde vidé, le gardien de l'équipe 1 posé à 1 m de sa ligne, un lob depuis l'aile qui retombe à `to` m de la ligne
// (theta : la raideur — 1,1 rad retombe presque à la verticale ; apex : le sommet). L'attaquant (att) est posé au point où le vol
// redescend à 2 m et épinglé là. On rejoue jusqu'à la prise (ou 4 s) et on rend les événements du gardien.
const lob = (over, { to = 2.5, apex = 7, theta = 1.1, att = false, gk0 = null } = {}) => {
  const st = makeMatch({ full: true, seed: 3 }); const cfg = matchCfg({ repli: false, ...over });
  for (let i = 0; i < 120; i++) matchStep(st, 1 / 60, cfg);
  st.ball.release('arrêt-de-jeu');
  for (const q of st.players) { q.p[0] = -30 - (q.id % 10) * 2; q.p[2] = -25; q.v[0] = 0; q.v[1] = 0; q.act = null; }
  st.ball.impulse([-st.ball.v[0], -st.ball.v[1], -st.ball.v[2]]);
  const g = st.pitch.attackGoal(0), sg = Math.sign(g.x || 1);
  const gk = st.players.find((q) => q.keeper && q.team === 1); gk.p[0] = g.x - sg * 1.0; gk.p[2] = 0; gk.v = [0, 0]; gk.down = 0; gk.act = null;
  const v = Math.sqrt(2 * 9.81 * apex) / Math.sin(theta), Rv = v * v * Math.sin(2 * theta) / 9.81;
  const T = [g.x - sg * to, 0, 1], dir = Math.atan2(1 - 22, T[0] - (g.x - sg * 30));
  const from = [T[0] - Math.cos(dir) * Rv, 0.11, T[2] - Math.sin(dir) * Rv];
  const tir = () => { st.ball.restart([from[0], from[1], from[2]], { cause: 'engagement' }); st.ball.strike({ speed: v, dirYaw: dir, elevation: theta, spinAxis: [0, 1, 0], spinRev: 0 }); };
  tir();
  const L = crossesHeight(predictPath(st.ball, { maxT: 5 }), 0.12).find((c) => !c.rising);   // la traînée raccourcit le vol : on recale le départ pour retomber À `to`
  if (L) { from[0] += T[0] - L.p[0]; from[2] += T[2] - L.p[2]; st.ball.release('recalage'); tir(); }
  st.restart = null; st.phase = 'flight'; st.possession = { team: 0, carrier: -1 }; st.lastTouch = 0;
  st.pass = { from: 0, to: -2, lead: [T[0], 0, T[2]], style: 'lofted', t: st.t, flight: 2, origin: [from[0], from[2]], cross: true };
  const X = crossesHeight(predictPath(st.ball, { maxT: 4 }), 2.0).find((c) => !c.rising);
  if (gk0 != null && X) gk.p[2] = X.p[2] + gk0;   // le gardien décalé de gk0 m en largeur (sur sa ligne) : la course au point est trop longue
  const A = st.players.find((q) => q.team === 0 && !q.keeper);
  if (att && X) { A.p[0] = X.p[0]; A.p[2] = X.p[2]; A.job = 'receive'; A.target = [X.p[0], 0, X.p[2]]; }
  const n0 = st.events.length, t0 = st.t, own = st.pitch.ownGoal(1); let dMax = 0, dSpot = null, tLand = null;
  for (let i = 0; i < 60 * 4; i++) {
    if (att && !A.act) { A.p[0] = X.p[0]; A.p[2] = X.p[2]; A.v = [0, 0]; }
    matchStep(st, 1 / 60, cfg);
    if (tLand == null && st.ball.p[1] < 0.15 && st.t - t0 > 0.5) tLand = st.t;
    if (tLand == null) dMax = Math.max(dMax, Math.abs(gk.p[0] - own.x));   // jusqu'à la retombée : après, le rebond lent se charge (le un-contre-un d'hier)
    if (gk._sortieAerienne && dSpot == null && !gk.act) dSpot = hyp(gk.target[0] - gk._sortieAerienne.p[0], gk.target[2] - gk._sortieAerienne.p[2]);
    if (st.ball.owner != null && st.t - t0 > 0.5) break;
  }
  const E = st.events.slice(n0), ev = (t, f = () => true) => E.find((e) => e.type === t && e.by === gk.id && f(e)) ?? null, avant = (e) => tLand == null || e.t <= tLand + 1e-6;   // avant la retombée : le rebond haut est un autre vol
  return { gk, A, X, t0, tLand, dMax: +dMax.toFixed(2), dSpot, owner: st.ball.owner, sortie: ev('sortie-aerienne'), windup: ev('windup', (e) => e.move === 'plongeonPrise' && e.sortie), sortieAv: ev('sortie-aerienne', avant), windupAv: ev('windup', (e) => e.move === 'plongeonPrise' && e.sortie && avant(e)), arret: ev('arrêt'), prise: ev('control', (e) => e.tech === 'prise-gardien'),
    types: E.map((e) => `${e.t}:${e.type}${e.by != null ? '@' + e.by : ''}${e.move ? '/' + e.move : ''}${e.mode ? '/' + e.mode : ''}${e.tech ? '/' + e.tech : ''}${e.aerienne ? '/aérienne' : ''}`).join(' ') };
};
const cfg = matchCfg({}), SA = cfg.sortieAerienne;

console.log('— (a) le lob dans la surface de but : la sortie se décide, le saut à deux mains prend —');
{
  const r = lob({});
  ok(`LA SORTIE SE DÉCIDE (cfg.sortieAerienne) : 'sortie-aerienne' à ${r.sortie ? (r.sortie.t - r.t0).toFixed(2) : '—'} s du départ, point à ${r.sortie?.h ?? '—'} m (${SA.bas}-${SA.haut}), dans ${r.sortie?.dans ?? '—'} s, à ${r.sortie?.d ?? '—'} m du gardien ; la cible du gardien EST le point (écart ${r.dSpot?.toFixed(2) ?? '—'} m)`,
    !!r.sortie && r.sortie.h >= SA.bas && r.sortie.h <= SA.haut && r.sortie.dans > 1 && r.dSpot != null && r.dSpot < 0.05, r.types.slice(0, 220));
  ok(`…ET SAUTE À DEUX MAINS : windup plongeonPrise sortie:true ${r.windup?.dans ?? '—'} s avant le ballon (= contact 0,5 ± 0,1), prise aérienne ${r.arret ? (r.arret.t - r.windup.t).toFixed(2) : '—'} s après (≤ 0,6), le ballon aux gants du gardien (owner ${r.owner})`,
    !!r.windup && r.windup.sortie === true && Math.abs(r.windup.dans - 0.5) <= 0.1 && !!r.arret && r.arret.mode === 'prise' && r.arret.aerienne === true && r.arret.t - r.windup.t <= 0.6 && r.owner === r.gk.id && !r.prise, r.types.slice(0, 220));
}
console.log('\n— (b) le point trop loin n\'est pas une sortie : le temps de course (accélération du pas puis pointe) décide —');
{
  const r = lob({}, { gk0: 9 });
  ok(`LE POINT TROP LOIN N'EST PAS UNE SORTIE : le même lob, le gardien décalé de 9 m sur sa ligne (2,5 s de course pour 1,97 s de vol) — aucune sortie-aerienne ni plongeonPrise avant la retombée (le gardien reste à ≤ 3 m de sa ligne : ${r.dMax} m)`,
    !r.sortieAv && !r.windupAv && r.dMax <= 3, r.types.slice(0, 200));
}
console.log('\n— (c) le duel laisse le ciel à la tête ; hors zone, le gardien tient son poste —');
{
  const r = lob({}, { att: true });
  ok(`LE DUEL LAISSE LA TÊTE : un attaquant posé au point de chute — aucune sortie-aerienne ni plongeonPrise (le gardien reste à ≤ 3 m de sa ligne : ${r.dMax} m)`,
    !r.sortieAv && !r.windupAv && r.dMax <= 3, r.types.slice(0, 200));
  const h = lob({}, { to: 9, apex: 6, theta: 1.0 });
  ok(`HORS ZONE (retombée à 9 m) : aucune sortie-aerienne ni saut, le gardien reste dans sa profondeur de poste jusqu'à la retombée (${h.dMax} m < zone ${SA.zone})`, !h.sortieAv && !h.windupAv && h.dMax < SA.zone, h.types.slice(0, 200));
}
console.log('\n— (d) la clé absente rend l\'hier ; le sabotage sans saut claque —');
{
  const r = lob({ sortieAerienne: null });
  ok(`LA CLÉ ABSENTE : sortieAerienne:null — aucune sortie-aerienne ni plongeonPrise, le gardien tient sa bissectrice (à ≤ 3 m de sa ligne : ${r.dMax} m) — le lob retombe (${r.tLand ? 'retombé' : 'pas retombé'}) sans lui`,
    !r.sortie && !r.windup && r.dMax <= 3 && !!r.tLand, r.types.slice(0, 200));
  const s = lob({ sortieAerienne: { ...SA, saut: 0 } });
  ok(`sabotage « la détente sans saut » attrapé (saut:0 : le gardien sort et saute, mais le gant n'atteint pas le ballon à ${s.windup?.h ?? '—'} m — claquette (${s.arret?.mode ?? '—'}) au lieu de la prise)`,
    !!s.windup && !!s.arret && s.arret.mode === 'claquette', s.types.slice(0, 200));
}
console.log(`\nsortie aérienne : ✓ ${pass} / ✗ ${fail}`);
process.exit(fail ? 1 : 0);
