// verify-retournee.mjs — LA RETOURNÉE ARMÉE (lot C1, cfg.retournee — Animations_A_Faire § 2 ; tete.js retourneeArmerStep/retourneeContact).
// Le clip authored `retournee` (1,35 s, contact 0,52) n'avait aucun déclencheur. Le vol est déterministe : un ballon libre prédit au
// contact du clip entre hMin et hMax m à reach d'un attaquant DOS AU BUT, dans la surface, sans adversaire à libre m, arme l'acte
// (ownsBody, windup skill 'retournee') ; le contact de l'acte frappe au but depuis le ballon réel (événements 'retournée' + 'shot'
// espèce 'retournée') — ou se nomme manqué. Face au but, ou un adversaire à portée, ou le ballon trop bas : pas de ciseau. null : hier.
// Tolérances [CONVENTION] : contact = windup + 0,52 ± 1 tick ; le ballon repart vers le but (v·x du bon signe) sous 0,25 rad d'élévation.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { predictPath, crossesHeight } from '../assets/starter/src/engine/ball-predict.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const hyp = Math.hypot;

// LA FIXTURE : le monde vidé, un centre lobé depuis l'aile vers la surface ; l'attaquant est posé au point où le vol REDESCEND à h m,
// épinglé là chaque image jusqu'à son acte, le regard tourné vers SON but (dos) ou vers le but adverse (face) ; foe : un adversaire à 1 m.
const centre = (over, { h = 1.8, regard = 'dos', foe = false, apex = 5.8 } = {}) => {
  const st = makeMatch({ full: true, seed: 3 }); const cfg = matchCfg({ repli: false, ...over });
  for (let i = 0; i < 120; i++) matchStep(st, 1 / 60, cfg);
  st.ball.release('arrêt-de-jeu');
  for (const q of st.players) { q.p[0] = -30 - (q.id % 10) * 2; q.p[2] = -25; q.v[0] = 0; q.v[1] = 0; q.act = null; }
  st.ball.impulse([-st.ball.v[0], -st.ball.v[1], -st.ball.v[2]]);
  const g = st.pitch.attackGoal(0), sg = Math.sign(g.x || 1);
  const theta = 0.6, v = Math.sqrt(2 * 9.81 * apex) / Math.sin(theta), Rv = v * v * Math.sin(2 * theta) / 9.81;
  const to = [g.x - sg * 9, 0, 2], dir = Math.atan2(2 - 22, (g.x - sg * 9) - (g.x - sg * 30));
  const from = [to[0] - Math.cos(dir) * (Rv - 4), 0.11, to[2] - Math.sin(dir) * (Rv - 4)];
  st.ball.restart([from[0], from[1], from[2]], { cause: 'engagement' });
  st.ball.strike({ speed: v, dirYaw: dir, elevation: theta, spinAxis: [0, 1, 0], spinRev: 0 });
  st.restart = null;
  const X = crossesHeight(predictPath(st.ball, { maxT: 4 }), h).find((c) => !c.rising);
  if (!X) throw new Error('le vol ne redescend pas à ' + h);
  const A = st.players.find((q) => q.team === 0 && !q.keeper && q.post === 9) ?? st.players.find((q) => q.team === 0 && !q.keeper);
  const yawA = regard === 'dos' ? Math.atan2(0 - X.p[2], -sg * 60 - X.p[0]) : Math.atan2(0 - X.p[2], g.x - X.p[0]);
  A.p[0] = X.p[0]; A.p[2] = X.p[2]; A.v = [0, 0]; A.yaw = yawA; A.job = 'receive'; A.target = [X.p[0], 0, X.p[2]]; A.intent = null;
  const F = st.players.find((q) => q.team === 1 && !q.keeper); if (foe) { F.p[0] = X.p[0] - sg * 1.0; F.p[2] = X.p[2]; F.v = [0, 0]; }
  st.phase = 'flight'; st.possession = { team: 0, carrier: -1 };
  st.pass = { from: A.id === 0 ? 1 : 0, to: A.id, lead: [X.p[0], 0, X.p[2]], style: 'lofted', t: st.t, flight: X.t, origin: [from[0], from[2]], cross: true };
  const n0 = st.events.length, t0 = st.t; let windup = null, contact = null, vApres = null;
  for (let i = 0; i < 60 * 4 && !contact; i++) {
    if (!A.act) { A.p[0] = X.p[0]; A.p[2] = X.p[2]; A.v = [0, 0]; A.yaw = yawA; A.yawWant = null; }   // posé et tourné : le métier receive le ferait courir et regarder le ballon
    if (foe && !F.act) { F.p[0] = X.p[0] - sg * 1.0; F.p[2] = X.p[2]; F.v = [0, 0]; }
    matchStep(st, 1 / 60, cfg);
    for (const e of st.events.slice(n0)) { if (!windup && e.type === 'windup' && e.move === 'retournee' && e.by === A.id) windup = e; if (!contact && (e.type === 'retournée' || e.type === 'retournée-manquée') && e.by === A.id) { contact = e; vApres = [...st.ball.v]; } }
    if (st.t - t0 > X.t + 1.5) break;
  }
  const E = st.events.slice(n0);
  return { A, X, t0, g, sg, windup, contact, vApres, shot: E.find((e) => e.type === 'shot' && e.by === A.id) ?? null, autres: E.filter((e) => ['volée', 'tête', 'windup'].includes(e.type) && e.by === A.id && e.move !== 'retournee').map((e) => e.type + (e.move ? '/' + e.move : '')).join(','),
    types: E.map((e) => `${e.t}:${e.type}${e.by != null ? '@' + e.by : ''}${e.move ? '/' + e.move : ''}${e.kind ? '/' + e.kind : ''}`).join(' ') };
};
const tick = 1 / 60 + 1e-6, cfg = matchCfg({}), R = cfg.retournee;

console.log('— (a) le centre à 1,8 m sur un attaquant dos au but : la retournée s\'arme et frappe au but —');
{
  const r = centre({});
  ok(`LA RETOURNÉE S'ARME (cfg.retournee) : windup move retournee skill 'retournee', anticipation ${r.windup?.anticipation ?? '—'} (= 0,52), ballon prédit à ${r.windup?.h ?? '—'} m (${R.hMin}-${R.hMax}), regard à ${r.windup?.dos ?? '—'} rad du but (≥ ${R.dos})`,
    !!r.windup && r.windup.skill === 'retournee' && Math.abs(r.windup.anticipation - 0.52) < 0.011 && r.windup.h >= R.hMin && r.windup.h <= R.hMax && r.windup.dos >= R.dos, r.types.slice(0, 220));
  const versBut = r.vApres ? Math.sign(r.vApres[0]) === r.sg : false, elev = r.vApres ? Math.atan2(r.vApres[1], hyp(r.vApres[0], r.vApres[2])) : 9;
  ok(`…ET FRAPPE AU BUT AU CONTACT DE L'ACTE : 'retournée' à ${r.contact && r.windup ? (r.contact.t - r.windup.t).toFixed(2) : '—'} s du windup (= 0,52 ± 1 tick), ballon à ${r.contact?.h ?? '—'} m, tir espèce '${r.shot?.kind ?? '—'}' à ${r.shot?.speed ?? '—'} m/s vers le but (élévation ${elev.toFixed(2)} rad < 0,25)`,
    !!r.contact && r.contact.type === 'retournée' && !!r.windup && Math.abs(r.contact.t - r.windup.t - 0.52) <= tick + 0.01 && !!r.shot && r.shot.kind === 'retournée' && versBut && elev < 0.25, r.types.slice(0, 220));
}
console.log('\n— (b) face au but, un adversaire à portée, le ballon trop bas : pas de ciseau —');
{
  const f = centre({}, { regard: 'face' });
  ok(`FACE AU BUT : aucune retournée (le ciel se joue à la tête ou à la volée : ${f.autres || 'rien'})`, !f.windup && !f.contact, f.types.slice(0, 160));
  const o = centre({}, { foe: true });
  ok(`UN ADVERSAIRE À 1 M : aucune retournée (le ciseau serait une faute — ${o.autres || 'rien'})`, !o.windup && !o.contact, o.types.slice(0, 160));
  const b = centre({}, { h: 1.0 });
  ok(`LE BALLON À 1 M : aucune retournée, la volée d'hier (${b.autres || 'rien'})`, !b.windup && !b.contact, b.types.slice(0, 160));
}
console.log('\n— (c) la clé absente rend l\'hier —');
{
  const n = centre({ retournee: null, bouclier: null });
  ok(`LA CLÉ ABSENTE : retournee:null — aucun windup 'retournee', le ballon à 1,8 m sur un dos au but retombe ou se joue autrement (${n.autres || 'rien'})`, !n.windup && !n.contact, n.types.slice(0, 160));
}
console.log(`\nretournée : ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
