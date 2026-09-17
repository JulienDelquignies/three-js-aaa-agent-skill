// verify-enchainement.mjs — L'ENCHAÎNEMENT CONTRÔLE POITRINE → REPRISE DE VOLÉE / RETOURNÉE ACROBATIQUE (cfg.enchainement ; note 386 ;
// retour « un enchaînement contrôle poitrine reprise de volée c'est possible ? ou contrôle poitrine et retournée ? »). Hier la poitrine
// (182a) tuait le vol devant le corps et son cooldown de 0,8 s fermait toute reprise ; la prise à portée (< 1,9 m) ramassait le ballon
// tombé. Ici, dans la surface : FACE au but la poitrine POSE le ballon devant à hauteur de reprise (delai s) et la volée l'enchaîne ;
// DOS au but et libre, elle le REMONTE au-dessus de la tête et la retournée s'arme au pas d'après. Le ballon remonté reste du CIEL (la
// tête ne le vole pas, la prise basse attend) jusqu'à sa reprise ; et sous clé le tireur ne se re-prend pas sa volée. null : hier au bit.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { predictPath, crossesHeight } from '../assets/starter/src/engine/ball-predict.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const hyp = Math.hypot;
const E = matchCfg({}).enchainement;
const PINS = { ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, repli: false, bouclier: null, sortieAerienne: null };

// LA FIXTURE (celle de la tête armée, B3) : tout le monde parqué ; un centre TENDU (sommet apex m — sous la fenêtre de tête : le vol
// croise la poitrine à h m en redescendant) ; l'attaquant posé au point de croisement, face au but ou dos au but (dos = regarde son camp).
const centre = (over, { dos = false, h = 1.3, apex = 1.35, secs = 3 } = {}) => {
  const st = makeMatch({ full: true, seed: 3 }); const cfg = matchCfg({ ...PINS, ...over });
  for (let i = 0; i < 120; i++) matchStep(st, 1 / 60, cfg);
  st.ball.release('arrêt-de-jeu');
  for (const q of st.players) { q.p[0] = -30 - (q.id % 10) * 2; q.p[2] = -25; q.v[0] = 0; q.v[1] = 0; q.act = null; }
  st.ball.impulse([-st.ball.v[0], -st.ball.v[1], -st.ball.v[2]]);
  const g = st.pitch.attackGoal(0), sg = Math.sign(g.x || 1);
  const theta = 0.35, v = Math.sqrt(2 * 9.81 * apex) / Math.sin(theta), Rv = v * v * Math.sin(2 * theta) / 9.81;
  const to = [g.x - sg * 9, 0, 1], dir = Math.atan2(1 - 20, (g.x - sg * 9) - (g.x - sg * 28));
  const from = [to[0] - Math.cos(dir) * (Rv - 2), 0.11, to[2] - Math.sin(dir) * (Rv - 2)];
  st.ball.restart([from[0], from[1], from[2]], { cause: 'engagement' }); st.ball.strike({ speed: v, dirYaw: dir, elevation: theta, spinAxis: [0, 1, 0], spinRev: 0 }); st.restart = null;
  const X = crossesHeight(predictPath(st.ball, { maxT: 4 }), h).find((c) => !c.rising); if (!X) throw new Error('le vol ne croise pas ' + h);
  const A = st.players.find((q) => q.team === 0 && !q.keeper && q.post === 9) ?? st.players.find((q) => q.team === 0 && !q.keeper);
  const yawOf = () => dos ? Math.atan2(0, -sg) : Math.atan2(0 - A.p[2], g.x - A.p[0]);
  A.p[0] = X.p[0]; A.p[2] = X.p[2]; A.v = [0, 0]; A.job = 'receive'; A.target = [X.p[0], 0, X.p[2]]; A.intent = null; A.yaw = yawOf(); A.yawWant = A.yaw;
  st.phase = 'flight'; st.possession = { team: 0, carrier: -1 }; st.lastTouch = 0;
  st.pass = { from: A.id === 0 ? 1 : 0, to: A.id, lead: [X.p[0], 0, X.p[2]], style: 'lofted', t: st.t, flight: X.t, origin: [from[0], from[2]], cross: true };
  const n0 = st.events.length, t0 = st.t; let hMax = 0, hReprise = null, dReprise = null;
  for (let i = 0; i < 60 * secs; i++) {
    if (!A.act) { A.p[0] = X.p[0]; A.p[2] = X.p[2]; A.v = [0, 0]; A.yaw = yawOf(); }
    matchStep(st, 1 / 60, cfg); hMax = Math.max(hMax, st.ball.p[1]);
    if (hReprise == null) { const r = st.events.slice(n0).find((e) => e.type === 'volée' || e.type === 'retournée'); if (r) { hReprise = +st.ball.p[1].toFixed(2); dReprise = +hyp(st.ball.p[0] - A.p[0], st.ball.p[2] - A.p[2]).toFixed(2); } }
  }
  const ev = st.events.slice(n0);
  const f = (type, extra = () => true) => ev.find((e) => e.type === type && extra(e));
  return { A, t0, ev, hMax: +hMax.toFixed(2), hReprise, dReprise, poitrine: f('control', (e) => e.tech === 'poitrine'), volee: f('volée'), windup: f('windup', (e) => e.move === 'retournee'), retournee: f('retournée'), shot: f('shot'), prise: ev.find((e) => e.type === 'control' && e.tech !== 'poitrine'), tete: f('tête'), inBox: st.pitch.inBox(X.p[0], X.p[2], sg) };
};
const rel = (r, e) => (e ? (e.t - r.t0).toFixed(2) + ' s' : '—');

console.log('— (a) face au but : poitrine → volée —');
{
  const r = centre({});
  ok(`LA POITRINE POSE (enchainement.volee) : le contrôle poitrine à ${rel(r, r.poitrine)} nommé [${r.poitrine?.enchaine ?? '—'}] dans la surface (${r.inBox}), le ballon posé devant (sommet ${r.hMax} m)`, !!r.poitrine && r.poitrine.enchaine === 'volee' && r.inBox);
  ok(`…et LA VOLÉE L'ENCHAÎNE : volée [${r.volee?.enchaine ?? '—'}] à ${rel(r, r.volee)} (${r.volee && r.poitrine ? (r.volee.t - r.poitrine.t).toFixed(2) : '—'} s après la poitrine ≈ delai ${E.volee.delai}), ballon à ${r.hReprise ?? '—'} m (attendu ~${E.volee.hauteur}) et ${r.dReprise ?? '—'} m du corps, le tir '${r.shot?.kind ?? '—'}'`,
    !!r.volee && r.volee.enchaine === 'poitrine' && !!r.poitrine && Math.abs(r.volee.t - r.poitrine.t - E.volee.delai) <= 0.1 && r.hReprise != null && Math.abs(r.hReprise - E.volee.hauteur) < 0.25 && r.shot?.kind === 'volée');
  ok(`…sans que le tireur se re-prenne sa volée (prise après le tir : ${r.prise ? r.prise.tech + ' à ' + rel(r, r.prise) : 'aucune'}) ni que la tête la vole (${r.tete ? 'tête !' : 'aucune tête'})`, !r.prise && !r.tete);
}
console.log('— (b) dos au but : poitrine → retournée —');
{
  const r = centre({}, { dos: true });
  ok(`LA POITRINE REMONTE (enchainement.retournee) : contrôle poitrine [${r.poitrine?.enchaine ?? '—'}] à ${rel(r, r.poitrine)}, le ballon au-dessus de la tête (sommet ${r.hMax} m ≥ 1,6)`, r.poitrine?.enchaine === 'retournee' && r.hMax >= 1.6);
  ok(`…LA RETOURNÉE S'ARME au pas d'après (windup retournee [${r.windup?.enchaine ?? '—'}] à ${rel(r, r.windup)}, ${r.windup && r.poitrine ? ((r.windup.t - r.poitrine.t) * 60).toFixed(0) : '—'} images après) et FRAPPE (retournée [${r.retournee?.enchaine ?? '—'}] à ${rel(r, r.retournee)}, ballon à ${r.hReprise ?? '—'} m, tir '${r.shot?.kind ?? '—'}')`,
    !!r.windup && r.windup.enchaine === 'poitrine' && r.windup.t - r.poitrine.t <= 0.12 && !!r.retournee && r.shot?.kind === 'retournée' && r.hReprise >= 1.5);
  ok(`…la tête ne vole pas le ballon remonté (${r.tete ? 'tête !' : 'aucune tête'}), aucune prise avant la reprise (${r.prise && r.retournee && r.prise.t < r.retournee.t ? r.prise.tech : 'aucune'})`, !r.tete && !(r.prise && r.retournee && r.prise.t < r.retournee.t));
}
console.log('— (c) hier au bit, et la volée ordinaire —');
{
  const f = centre({ enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null }), d = centre({ enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null }, { dos: true });
  ok(`enchainement:null — face : la poitrine sans nom (${f.poitrine ? '[' + (f.poitrine.enchaine ?? 'rien') + ']' : '—'}), pas de volée (${f.volee ? 'volée !' : 'aucune'}), le ballon mort ramassé (${f.prise?.tech ?? '—'} à ${rel(f, f.prise)}) ; dos : pas de retournée (${d.windup ? 'armée !' : 'aucune'}), ramassé (${d.prise?.tech ?? '—'})`,
    !!f.poitrine && !f.poitrine.enchaine && !f.volee && !!f.prise && !d.windup && !d.retournee);
  const v = centre({}, { h: 0.8, apex: 0.9 }), vn = centre({ enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null }, { h: 0.8, apex: 0.9 });
  ok(`LA VOLÉE ORDINAIRE (le vol arrive à 0,8 m, sans poitrine) : sous clé le tireur ne se re-prend pas le ballon (prise après ${rel(v, v.volee)} : ${v.prise ? v.prise.tech : 'aucune'}) — hier il se le reprenait ${vn.prise ? (vn.prise.t - vn.volee.t).toFixed(2) + ' s après (' + vn.prise.tech + ')' : 'non'} : une dette du tronc, ici sous clé`,
    !!v.volee && !v.prise && !!vn.volee);
}
console.log(`enchainement : ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
