// verify-touche-orientee.mjs — LA TOUCHE ORIENTÉE EN COURSE (cfg.toucheOrientee ; note 399). Retour utilisateur du 17/09 : « le ballon est un
// corps étranger », « des réceptions mauvaises avec des demi-tours ». Mesuré avant (4 × 300 s) : 49 % des images de port SOUDÉES au servo,
// dont 16 % par la fenêtre de contrôle de la réception — le ballon capturé puis porté au point du pied 0,3-0,5 s, le corps qui tourne APRÈS.
// La loi (touche-orientee.js, appelée par receive()) : le receveur LIBRE (personne à libre m), en course (≥ v) ou dos au jeu, ne capture
// pas — sa première touche EMMÈNE le ballon du côté ouvert (le sens du jeu, son élan, jamais dans un corps à moins de champ m dans les
// devant m, jamais vers la craie), à lead m (0,6-1,6 selon l'allure), et il tourne SUR sa touche (yawWant) ; la conduite reprend à la
// touche suivante. Le pressé garde la capture d'hier (la touche propre protégée du 265). null : la capture d'hier au bit.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const hyp = Math.hypot, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), deg = (a) => Math.abs(wrap(a)) * 180 / Math.PI;
const PINS = {};   // les clés du 17/09 vivent avec
const KT = matchCfg({}).toucheOrientee;

console.log('— (a) le match : le porté se soude moins —');
const match = (over, seeds = [3, 7, 11, 15], secs = 300) => {
  const R = { port: 0, soude: 0, settling: 0, pousses: 0, controles: 0, pertes: 0, passes: 0 };
  for (const seed of seeds) {
    const st = makeMatch({ full: true, seed }), cfg = matchCfg({ ...PINS, ...over });
    for (let i = 0; i < 60 * secs; i++) {
      matchStep(st, 1 / 60, cfg);
      if (st.phase === 'carry') { const c = st.players[st.possession.carrier]; if (c) { R.port++; if (st.ball.owner === c.id) { R.soude++; if (!c.act && !c.intent && st._settling && st.t < st._settling.at) R.settling++; } } }
    }
    for (const e of st.events) { if (e.type === 'control' && e.tech && e.tech !== 'prise-gardien' && !e.miss) { R.controles++; if (e.pousse) R.pousses++; } if (e.type === 'pass') R.passes++; }
    R.pertes += st.turnovers ?? 0;
  }
  return R;
};
const A = match({}), N = match({ toucheOrientee: null });
ok(`LE PORTÉ SOUDÉ : ${(100 * A.soude / A.port).toFixed(0)} % des images de port avec la clé (4 × 300 s, graines 3-15 ; la fenêtre de contrôle ${(100 * A.settling / A.port).toFixed(0)} %) contre ${(100 * N.soude / N.port).toFixed(0)} % hier (${(100 * N.settling / N.port).toFixed(0)} %) — au plus 0,85 × hier (mesuré 38 c. 49)`, A.soude / A.port <= 0.85 * N.soude / N.port);
ok(`LES TOUCHES ORIENTÉES : ${A.pousses} des ${A.controles} contrôles au pied portent une poussée (${(100 * A.pousses / Math.max(1, A.controles)).toFixed(0)} %) contre ${N.pousses} hier — au moins un quart, hier aucune`, A.pousses >= A.controles / 4 && N.pousses === 0);
ok(`…sans dégrader le monde : ${A.pertes} pertes pour ${A.passes} passes (${(A.pertes / Math.max(1, A.passes)).toFixed(2)} par passe) contre ${N.pertes} pour ${N.passes} hier (${(N.pertes / Math.max(1, N.passes)).toFixed(2)}) — au plus 1,1 × + 0,02 par passe (mesuré : 62 c. 69 pertes, 7 c. 3 tirs)`, A.pertes / Math.max(1, A.passes) <= N.pertes / Math.max(1, N.passes) * 1.1 + 0.02);

// LA FIXTURE : le passeur P posé au milieu, le receveur R libre, DOS AU JEU (il regarde son but), une ligne adverse loin devant ; la passe arrive dans ses pieds
const fixture = (over, { presse = null } = {}) => {
  const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg({ ...PINS, tenueCalme: null, holdCalmFull: [0.2, 0.3], ...over });
  for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
  if (st.ball.owner != null) st.ball.release('perte');
  for (const q of st.players) { q.p[0] = -40 - (q.id % 11) * 1.5; q.p[2] = q.team ? 28 : -28; q.v = [0, 0]; q.act = null; q.job = 'walk'; q.target = [q.p[0], 0, q.p[2]]; q.intent = null; q._pace = null; }
  const sg = Math.sign(st.pitch.attackGoal(0).x || 1), yaw0 = sg > 0 ? 0 : Math.PI;
  const mates = st.players.filter((q) => q.team === 0 && !q.keeper), P = mates[0], R = mates[1];
  P.p[0] = -12 * sg; P.p[2] = 0; P.yaw = yaw0; P.v = [0, 0]; P.speed = 0; P.job = 'carry';
  R.p[0] = -3 * sg; R.p[2] = 1.5; R.yaw = yaw0 + Math.PI; R.v = [0, 0]; R.speed = 0; R.job = 'walk'; R.target = [R.p[0], 0, R.p[2]];   // dos au jeu, face au passeur
  const ligne = st.players.filter((q) => q.team === 1 && !q.keeper).slice(0, 4), lP = ligne.map((q, k) => [12 * sg, (k - 1.5) * 7]);
  ligne.forEach((q, k) => { q.p[0] = lP[k][0]; q.p[2] = lP[k][1]; q.yaw = yaw0 + Math.PI; q.v = [0, 0]; });
  let F = null; if (presse != null) { F = st.players.filter((q) => q.team === 1 && !q.keeper)[5]; F.p[0] = R.p[0] + presse * 0.7 * sg; F.p[2] = R.p[2] + presse * 0.7; F.yaw = yaw0 + Math.PI; F.v = [0, 0]; F.job = 'walk'; F.target = [F.p[0], 0, F.p[2]]; }
  st.ball.restart([P.p[0] + 0.35 * sg, 0.11, 0], { cause: 'engagement' }); st.restart = null; st.ball.possess(P.id); st.possession = { team: 0, carrier: P.id }; st.phase = 'carry'; st.hold = 1; st.lastTouch = 0;
  const n0 = st.events.length; let ctrl = null, ownerApres = null, ballV = null, yawApres = null, yawAtCtrl = null, tCtrl = null;
  for (let i = 0; i < 60 * 6; i++) {
    for (const q of st.players) if (q !== P && q !== R && q !== F && !ligne.includes(q)) { q.p[0] = -40 - (q.id % 11) * 1.5; q.p[2] = q.team ? 28 : -28; q.v = [0, 0]; q.act = null; }
    ligne.forEach((q, k) => { q.p[0] = lP[k][0]; q.p[2] = lP[k][1]; q.v = [0, 0]; q.act = null; }); if (F) { F.v = [0, 0]; F.act = null; }
    if (!ctrl) { R.p[0] = -3 * sg; R.p[2] = 1.5; R.v = [0, 0]; R.yaw = yaw0 + Math.PI; R.yawWant = null; }   // il attend, dos au jeu, jusqu'à la prise
    matchStep(st, 1 / 60, cfg);
    if (!ctrl) { ctrl = st.events.slice(n0).find((e) => e.type === 'control' && e.by === R.id); if (ctrl) { ownerApres = st.ball.owner; ballV = [st.ball.v[0], st.ball.v[2]]; yawAtCtrl = R.yaw; tCtrl = st.t; } }
    else if (st.t - tCtrl >= 0.6) { yawApres = R.yaw; break; }
  }
  const versJeu = ballV ? ballV[0] * sg : null;
  return { ctrl, pousse: ctrl?.pousse ?? null, ownerApres, versJeu, tourne: yawApres != null && yawAtCtrl != null ? deg(yawApres - yawAtCtrl) : null, vBall: ballV ? hyp(ballV[0], ballV[1]) : null };
};

console.log('— (b) la fixture : le receveur libre dos au jeu emmène le ballon vers le jeu —');
{
  const r = fixture({});
  ok(`LE RECEVEUR LIBRE, DOS AU JEU : ${r.ctrl ? `contrôle ${r.ctrl.tech}, poussée ${r.pousse ? `dir ${r.pousse.dir} rad, lead ${r.pousse.lead} m, ${r.pousse.v} m/s` : 'absente'}, ballon ${r.ownerApres == null ? 'LIBRE' : 'capturé'} juste après, composante vers le jeu ${r.versJeu?.toFixed(1)} m/s, le corps a tourné ${r.tourne?.toFixed(0)}° en 0,6 s` : 'pas de contrôle'} — une poussée, ballon libre, vers le jeu, le corps qui tourne ≥ 45°`,
    !!r.ctrl && !!r.pousse && r.ownerApres == null && r.versJeu > 0.5 && r.tourne >= 45);
  const n = fixture({ toucheOrientee: null });
  ok(`toucheOrientee:null — le même receveur : ${n.ctrl ? `contrôle ${n.ctrl.tech}, ${n.pousse ? 'poussée' : 'pas de poussée'}, ballon ${n.ownerApres == null ? 'libre' : 'CAPTURÉ'} juste après` : 'pas de contrôle'} (hier : la capture, le porté au point du pied)`,
    !!n.ctrl && !n.pousse && n.ownerApres === n.ctrl.by);
}

console.log('— (c) la fixture pressée : le pressé garde la capture protégée —');
{
  const r = fixture({}, { presse: 2.0 });
  ok(`LE PRESSEUR À 2 m : ${r.ctrl ? `contrôle ${r.ctrl.tech}, ${r.pousse ? 'POUSSÉE' : 'pas de poussée'}, ballon ${r.ownerApres == null ? 'libre' : 'capturé'}` : 'pas de contrôle'} — pas de poussée sous libre ${KT.libre} m, la capture d'hier`,
    !!r.ctrl && !r.pousse && r.ownerApres === r.ctrl.by);
}

console.log(`touche-orientee : ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
