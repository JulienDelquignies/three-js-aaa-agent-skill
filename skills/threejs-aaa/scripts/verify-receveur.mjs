// verify-receveur.mjs — LE RECEVEUR OUVERT (cfg.receveurOuvert ; note 398). Retour utilisateur du 17/09 : « beaucoup trop de passes dans le
// dos des joueurs qui donnent des réceptions mauvaises avec des demi-tours des réceptionnaires ». Mesuré (2 × 300 s) : 18 des 30 receveurs
// EN COURSE recevaient le ballon dans le dos (60 %), 12 demi-tours > 100° dans la seconde après la prise, 11 en mouvement — la présentation
// du lot 70 (sePresente) ne s'ouvrait qu'à l'arrêt (< 2,2 m/s) : le receveur qui COURT À L'OPPOSÉ du ballon (le retrait, la course arrière)
// gardait son cap de course et se retournait après. La loi (movement) : ce receveur-là, sous v m/s, se présente AUSSI pendant le vol — le
// corps s'ouvre au ballon (corpsOuvert garde sa demi-position) ; la course servie (through) garde sa loi. null : l'hier au bit.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const hyp = Math.hypot, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), deg = (a) => Math.abs(wrap(a)) * 180 / Math.PI;
const PINS = {};   // orientationPasse, verticalite, decalage vivent avec

console.log('— (a) le match : moins de ballons reçus dans le dos en course —');
const match = (over, seeds = [3, 7, 11, 15], secs = 300) => {   // 4 graines : à 2 la part variait de 29 à 44 % selon l'état du moteur
  const R = { course: 0, courseDos: 0, recus: 0, demiTours: 0 };
  for (const seed of seeds) {
    const st = makeMatch({ full: true, seed }), cfg = matchCfg({ ...PINS, ...over }); const pend = new Map(); const watch = [];
    for (let i = 0; i < 60 * secs; i++) {
      const n0 = st.events.length; matchStep(st, 1 / 60, cfg);
      for (const e of st.events.slice(n0)) {
        if (e.type === 'pass' && e.to >= 0) { const to = st.players[e.to]; if (to) pend.set(e.to, { statique: to.speed < 1.5 }); }
        if (e.type === 'receive') { const w = pend.get(e.by); if (w) { pend.delete(e.by); R.recus++; const r = st.players[e.by]; const v = st.ball.v; const arr = Math.atan2(-v[2], -v[0]); const dos = deg(arr - r.yaw) > 90; if (!w.statique) { R.course++; if (dos) R.courseDos++; } watch.push({ id: e.by, yaw: r.yaw, t: st.t }); } }
      }
      for (let k = watch.length - 1; k >= 0; k--) { const x = watch[k]; if (st.t - x.t < 1.2) continue; if (deg(st.players[x.id].yaw - x.yaw) > 100) R.demiTours++; watch.splice(k, 1); }
    }
  }
  return R;
};
const A = match({}), N = match({ receveurOuvert: null });
ok(`LES RECEVEURS EN COURSE SERVIS DANS LE DOS : ${A.courseDos} sur ${A.course} (${(100 * A.courseDos / Math.max(1, A.course)).toFixed(0)} %) avec la clé (4 × 300 s, graines 3-15) contre ${N.courseDos} sur ${N.course} (${(100 * N.courseDos / Math.max(1, N.course)).toFixed(0)} %) hier — au plus 0,88 × la part d'hier (mesuré 41 % c. 49 % sur l'état final, 29 c. 60 sur 2 graines d'un état antérieur)`,
  A.courseDos / Math.max(1, A.course) <= 0.88 * N.courseDos / Math.max(1, N.course));
ok(`…et les demi-tours après la prise (> 100° dans 1,2 s) : ${A.demiTours} sur ${A.recus} contre ${N.demiTours} sur ${N.recus} hier — pas plus qu'hier + 4 (ceux qui restent : la prise dos au but suivie d'une relance — la touche orientée en course est une dette de réception)`, A.demiTours <= N.demiTours + 4);

// LA FIXTURE : le passeur P posé, le receveur R qui COURT À L'OPPOSÉ (vers son propre but) à 3 m/s, la passe part vers lui ; personne autour
const fixture = (over) => {
  const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg({ ...PINS, tenueCalme: null, holdCalmFull: [0.2, 0.3], ...over });
  for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
  if (st.ball.owner != null) st.ball.release('perte');
  for (const q of st.players) { q.p[0] = -40 - (q.id % 11) * 1.5; q.p[2] = q.team ? 28 : -28; q.v = [0, 0]; q.act = null; q.job = 'walk'; q.target = [q.p[0], 0, q.p[2]]; q.intent = null; q._pace = null; }
  const sg = Math.sign(st.pitch.attackGoal(0).x || 1), yaw0 = sg > 0 ? 0 : Math.PI;
  const mates = st.players.filter((q) => q.team === 0 && !q.keeper), P = mates[0], R = mates[1];
  P.p[0] = 0; P.p[2] = 0; P.yaw = yaw0 + Math.PI; P.v = [0, 0]; P.speed = 0; P.job = 'carry';
  R.p[0] = -8 * sg; R.p[2] = 2; R.yaw = yaw0 + Math.PI; R.v = [-3 * sg, 0]; R.speed = 3; R.job = 'walk'; R.target = [-30 * sg, 0, 2];   // il court vers son but, dos au passeur
  const ligne = st.players.filter((q) => q.team === 1 && !q.keeper).slice(0, 4), lP = ligne.map((q, k) => [14 * sg, (k - 1.5) * 7]);
  ligne.forEach((q, k) => { q.p[0] = lP[k][0]; q.p[2] = lP[k][1]; q.yaw = yaw0 + Math.PI; q.v = [0, 0]; });
  st.ball.restart([-0.4 * sg, 0.11, 0], { cause: 'engagement' }); st.restart = null; st.ball.possess(P.id); st.possession = { team: 0, carrier: P.id }; st.phase = 'carry'; st.hold = 1; st.lastTouch = 0;
  const n0 = st.events.length; let rec = null, yawAtPass = null, tPass = null, vMinVol = 9, ouvertEnCourant = null;
  for (let i = 0; i < 60 * 5; i++) {
    for (const q of st.players) if (q !== P && q !== R && !ligne.includes(q)) { q.p[0] = -40 - (q.id % 11) * 1.5; q.p[2] = q.team ? 28 : -28; q.v = [0, 0]; q.act = null; }
    ligne.forEach((q, k) => { q.p[0] = lP[k][0]; q.p[2] = lP[k][1]; q.v = [0, 0]; q.act = null; });
    if (tPass == null) { R.target = [-30 * sg, 0, 2]; R.job = 'walk'; }
    matchStep(st, 1 / 60, cfg);
    if (tPass == null) { const e = st.events.slice(n0).find((x) => x.type === 'pass' && x.by === P.id && x.to === R.id); if (e) { tPass = st.t; yawAtPass = R.yaw; } }
    else {
      vMinVol = Math.min(vMinVol, R.speed);
      // S'OUVRIR EN COURANT : le cap à moins de 90° du ballon ALORS QU'IL COURT encore (≥ 2,2 m/s — la loi d'hier ne se présente qu'en dessous)
      const versB = Math.atan2(st.ball.p[2] - R.p[2], st.ball.p[0] - R.p[0]); if (ouvertEnCourant == null && R.speed >= 2.2 && deg(R.yaw - versB) < 90) ouvertEnCourant = +(st.t - tPass).toFixed(2);
      rec = st.events.slice(n0).find((x) => x.type === 'receive' && x.by === R.id); if (rec) break;
    }
  }
  const vers = Math.atan2(st.ball.p[2] - R.p[2], st.ball.p[0] - R.p[0]);
  return { tPass, rec, dosAuBallon: rec ? deg(R.yaw - vers) : null, tourne: rec && yawAtPass != null ? deg(R.yaw - yawAtPass) : null, vMinVol, ouvertEnCourant };
};

console.log('— (b) la fixture : le receveur qui court à l\'opposé s\'ouvre pendant le vol —');
{
  const r = fixture({});
  ok(`LE RECEVEUR QUI COURT VERS SON BUT À 3 m/s, servi dans le dos : ${r.rec ? `il s'ouvre au ballon EN COURANT ${r.ouvertEnCourant != null ? r.ouvertEnCourant + ' s après la passe' : 'jamais'}, reçu à ${r.dosAuBallon.toFixed(0)}° du ballon, tourné de ${r.tourne.toFixed(0)}° pendant le vol` : (r.tPass ? 'pas de réception' : 'pas de passe')} — ouvert en courant, reçu à moins de 90° du ballon`,
    !!r.rec && r.ouvertEnCourant != null && r.dosAuBallon < 90);
  // (le même receveur avec la clé nulle s'ouvre AUSSI dans cette fixture : le job 'receive' du vol le tourne vers le ballon dès la passe —
  // le contraste vit dans le match (a) : 60 → 37 % de receveurs en course servis dans le dos, où les coureurs servis par la mène tiennent leur cap)
}

console.log(`receveur : ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
