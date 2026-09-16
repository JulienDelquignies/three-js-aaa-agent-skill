// verify-tete-armee.mjs — LA TÊTE ARMÉE (lot B3, cfg.tete.armee — doc Branchements § 2). Le vol est déterministe : la tête s'arme le temps de
// contact du clip AVANT le ballon prédit (tete 0,42 s sautée, teteDebout 0,22 s debout — windup skill 'tete') et se résout AU CONTACT
// DE L'ACTE (teteContact) ; hier la tête se décidait à l'image du contact — l'armé et l'impulsion étaient perdus, la scène jouait la
// seconde moitié du geste (0 windup 'tete' en 12 matchs). Le corps court sous son armé (payload.mobile). null : l'hier au bit.
// Tolérances [CONVENTION] : écart windup→contact = anticipation ± 1 tick ; contact à ± 0,1 s de l'arrivée prédite.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { predictPath, crossesHeight } from '../assets/starter/src/engine/ball-predict.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const hyp = Math.hypot;

// LA FIXTURE : le monde vidé (tous parqués loin), un centre lobé depuis l'aile vers l'entrée de la surface ; l'attaquant est posé au
// point où le vol REDESCEND à h m (1,9 : la tête debout ; 2,6 : la tête sautée) — ou y court depuis derrière à `course` m/s.
const centre = (over, { h = 1.9, course = 0, back = 0, apex = 5.8 } = {}) => {
  const st = makeMatch({ full: true, seed: 3 }); const cfg = matchCfg({ repli: false, retournee: null /* retournee null DATÉ 16/09 (C1, note 376) : l'attaquant posé dos au but volait la fixture en ciseau */, ...over });
  for (let i = 0; i < 120; i++) matchStep(st, 1 / 60, cfg);
  st.ball.release('arrêt-de-jeu');
  for (const q of st.players) { q.p[0] = -30 - (q.id % 10) * 2; q.p[2] = -25; q.v[0] = 0; q.v[1] = 0; q.act = null; }
  st.ball.impulse([-st.ball.v[0], -st.ball.v[1], -st.ball.v[2]]);
  const g = st.pitch.attackGoal(0), sg = Math.sign(g.x || 1);
  // le vol : depuis l'aile vers l'entrée de la surface, à 0,6 rad ; la vitesse fixe le SOMMET (apex m — 5,8 : le centre lobé qui redescend
  // raide ; 2,1 : la cloche courte qui ne dépasse pas la tête debout, pour une tête sans saut)
  const theta = 0.6, v = Math.sqrt(2 * 9.81 * apex) / Math.sin(theta), Rv = v * v * Math.sin(2 * theta) / 9.81;
  const to = [g.x - sg * 8, 0, 2], dir = Math.atan2(2 - 22, (g.x - sg * 8) - (g.x - sg * 30));
  const from = [to[0] - Math.cos(dir) * (Rv - 4), 0.11, to[2] - Math.sin(dir) * (Rv - 4)];   // il retombe 4 m au-delà de l'entrée
  st.ball.restart([from[0], from[1], from[2]], { cause: 'engagement' });
  st.ball.strike({ speed: v, dirYaw: dir, elevation: theta, spinAxis: [0, 1, 0], spinRev: 0 });
  st.restart = null;
  const X = crossesHeight(predictPath(st.ball, { maxT: 4 }), h).find((c) => !c.rising);
  if (!X) throw new Error('le vol ne redescend pas à ' + h);
  const A = st.players.find((q) => q.team === 0 && !q.keeper && q.post === 9) ?? st.players.find((q) => q.team === 0 && !q.keeper);
  A.p[0] = X.p[0] - sg * back; A.p[2] = X.p[2]; A.v = [course * sg, 0]; A.job = 'receive'; A.target = [X.p[0], 0, X.p[2]]; A.intent = null;
  st.phase = 'flight'; st.possession = { team: 0, carrier: -1 };
  st.pass = { from: A.id === 0 ? 1 : 0, to: A.id, lead: [X.p[0], 0, X.p[2]], style: 'lofted', t: st.t, flight: X.t, origin: [from[0], from[2]], cross: true };
  const n0 = st.events.length, t0 = st.t; let tete = null, windup = null, pW = null;
  for (let i = 0; i < 60 * 4 && !tete; i++) {
    if (course === 0 && !A.act) { A.p[0] = X.p[0]; A.p[2] = X.p[2]; A.v = [0, 0]; }   // l'attaquant POSÉ y reste (le métier receive l'emmènerait au point de chute, 4 m plus loin) — épinglé chaque image jusqu'à son armé
    matchStep(st, 1 / 60, cfg);
    for (const e of st.events.slice(n0)) { if (!windup && e.type === 'windup' && e.skill === 'tete' && e.by === A.id) { windup = e; pW = [A.p[0], A.p[2]]; } if (e.type === 'tête' && e.by === A.id) tete = e; }
  }
  const manquee = st.events.slice(n0).find((e) => e.type === 'tête-manquée');
  return { A, X, t0, tete, windup, manquee, deplace: pW ? +hyp(A.p[0] - pW[0], A.p[2] - pW[1]).toFixed(2) : null, tArr: +(t0 + X.t).toFixed(2), types: st.events.slice(n0).map((e) => e.type + (e.by != null ? '@' + e.by : '')).join(',') };
};
const tick = 1 / 60 + 1e-6;

console.log('— (a) la tête debout s\'arme 0,22 s avant le ballon prédit —');
{
  const r = centre({}, { h: 1.9, apex: 2.1 });
  ok(`LA TÊTE DEBOUT S'ARME : windup skill 'tete' move teteDebout (${r.windup?.move ?? '—'}, anticipation ${r.windup?.anticipation ?? '—'}, hauteur prédite ${r.windup?.h ?? '—'} m)`,
    !!r.windup && r.windup.move === 'teteDebout' && Math.abs(r.windup.anticipation - 0.22) < 0.011 && !r.windup.saut, r.types.slice(0, 200));
  ok(`…et se résout AU CONTACT DE L'ACTE : tête ${r.tete?.mode ?? '—'} armée (arme ${r.tete?.arme ?? '—'}) à ${r.tete && r.windup ? (r.tete.t - r.windup.t).toFixed(2) : '—'} s du windup (= 0,22 ± 1 tick), à ${r.tete ? (r.tete.t - r.tArr).toFixed(2) : '—'} s de l'arrivée prédite à 1,9 m (± 0,15 : la fenêtre de tête a cette largeur, le contact se prend où le ballon passe à 1,9-2,1 m)`,
    !!r.tete && r.tete.arme === true && !!r.windup && Math.abs(r.tete.t - r.windup.t - 0.22) <= tick + 0.01 && Math.abs(r.tete.t - r.tArr) <= 0.15 && !r.manquee);
}
console.log('\n— (b) la tête sautée s\'arme 0,42 s avant : le saut est dans le clip —');
{
  const r = centre({}, { h: 2.45 });
  ok(`LA TÊTE SAUTÉE S'ARME : windup move tete, saut (${r.windup?.move ?? '—'}, anticipation ${r.windup?.anticipation ?? '—'}, saut ${r.windup?.saut ?? '—'}, hauteur ${r.windup?.h ?? '—'} m)`,
    !!r.windup && r.windup.move === 'tete' && Math.abs(r.windup.anticipation - 0.42) < 0.011 && r.windup.saut === true, r.types.slice(0, 200));
  ok(`…tête sautée armée au contact (mode ${r.tete?.mode ?? '—'}, saut ${r.tete?.saut ?? '—'}, ${r.tete && r.windup ? (r.tete.t - r.windup.t).toFixed(2) : '—'} s du windup = 0,42 ± 1 tick)`,
    !!r.tete && r.tete.arme === true && r.tete.saut === true && !!r.windup && Math.abs(r.tete.t - r.windup.t - 0.42) <= tick + 0.01 && !r.manquee);
}
console.log('\n— (c) le corps court sous son armé (payload.mobile : movement ne le plante pas) —');
{
  const r = centre({}, { h: 1.9, course: 3, back: 7 });   // parti 7 m derrière : le métier receive l'emmène au point de chute (4 m au-delà) — il TRAVERSE le point de tête à l'heure
  ok(`L'ATTAQUANT QUI ARRIVE EN COURANT s'arme sans se planter : déplacé de ${r.deplace ?? '—'} m entre le windup et le contact (≥ 0,3 — hier l'armé figeait le corps), tête ${r.tete?.mode ?? '—'} armée`,
    !!r.windup && !!r.tete && r.tete.arme === true && r.deplace != null && r.deplace >= 0.3, r.types.slice(0, 160));
}
console.log('\n— (d) le sabotage : armee:null rend la reprise réactive d\'hier (aucun windup) —');
{
  const T = matchCfg({}).tete;
  const r = centre({ tete: { ...T, armee: null } }, { h: 1.9, apex: 2.1 });
  ok(`sabotage « la tête réactive d'hier » attrapé : aucun windup 'tete' (${r.windup ? 'UN' : 'aucun'}), la tête se prend quand même au contact (${r.tete?.mode ?? '—'}, arme ${r.tete?.arme ?? 'absent'})`,
    !r.windup && !!r.tete && r.tete.arme == null);
}
console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
