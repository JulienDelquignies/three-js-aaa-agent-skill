// LA PRISE DE BALLE DU DUEL, ET CE QU'ELLE DEVIENT (sans navigateur, moteur STARTER) — « soigner la prise de balle orientée : ne plus laisser
// partir le ballon dans le dos ». Chaque fois qu'un joueur de champ DEVIENT porteur : l'espèce de la prise (le dernier événement qui la fait :
// contrôle d'une passe, récupération d'un ballon libre, tacle gagné…), le défenseur côté but ou non, et dans les 1,5 s qui suivent : le ballon
// qui PART DANS LE DOS (du côté opposé au défenseur, ∠ > 110°, à > 0,8 m du porteur), le porteur qui lui tourne le dos (la fuite de
// face-fuite.mjs), le ballon au pied devant lui (≤ 0,55 m, dans son regard ± 60°) et quand, la perte. Usage : node prise-balle.mjs [graines=8] [s=120]
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
const [NG = '8', SECS = '120', ...KV] = process.argv.slice(2);
const over = Object.fromEntries(KV.map((s) => { const i = s.indexOf('='); return [s.slice(0, i), JSON.parse(s.slice(i + 1))]; }));
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const ang = (ax, az, bx, bz) => { const la = Math.hypot(ax, az), lb = Math.hypot(bx, bz); return la < 1e-6 || lb < 1e-6 ? null : Math.acos(Math.max(-1, Math.min(1, (ax * bx + az * bz) / (la * lb)))) * 180 / Math.PI; };
const G = [];
for (let seed = 1; seed <= Number(NG); seed++) {
  const st = makeDuel({ seed }), cfg = duelCfg(over); let ne = 0, prevCar = -1, lastEv = null; const open = [];
  for (let i = 0; i < Number(SECS) * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    while (ne < st.events.length) { const e = st.events[ne++];
      if (e.type === 'control') lastEv = { t: e.t, k: 'controle:' + (e.tech ?? '?') + (e.pousse ? ':poussé' : '') };
      else if (e.type === 'loose-kept') lastEv = { t: e.t, k: 'ballon-libre' };
      else if (e.type === 'duel' && e.won) lastEv = { t: e.t, k: 'tacle-gagné' };
      else if (e.type === 'receive') lastEv = { t: e.t, k: 'reçu' };
      else if (e.type === 'turnover' && !lastEv) lastEv = { t: e.t, k: 'turnover' }; }
    const carId = st.possession?.carrier ?? -1, c = st.players[carId];
    if (carId !== prevCar && c && !c.keeper && !st.restart) {
      const qd = st.players.find((p) => p.team !== c.team && !p.keeper), g = st.pitch.attackGoal(c.team), gx = g.x - c.p[0], gz = -c.p[2], gl = Math.hypot(gx, gz);
      const dx = qd.p[0] - c.p[0], dz = qd.p[2] - c.p[2], d = Math.hypot(dx, dz), coteBut = d <= 7 && (dx * gx + dz * gz) / (d * gl) > Math.cos(50 * Math.PI / 180);
      open.push({ t: st.t, by: c.id, k: lastEv && st.t - lastEv.t < 0.4 ? lastEv.k : 'autre', coteBut, d0: d, dos: false, fuite: false, pied: null, perdu: false, dMax: 0, fuiteT: 0,
        bAng0: ang(st.ball.p[0] - c.p[0], st.ball.p[2] - c.p[2], dx, dz), bRegard0: ang(st.ball.p[0] - c.p[0], st.ball.p[2] - c.p[2], Math.cos(c.yaw), Math.sin(c.yaw)), dB0: Math.hypot(st.ball.p[0] - c.p[0], st.ball.p[2] - c.p[2]), v0: c.speed, vAng0: c.speed > 0.5 ? ang(c.v[0], c.v[1], dx, dz) : null, ferme0: -(qd.v[0] * dx + qd.v[1] * dz) / d, vB0: Math.hypot(st.ball.v[0], st.ball.v[2]), vBang0: ang(st.ball.v[0], st.ball.v[2], dx, dz), yaw0: ang(Math.cos(c.yaw), Math.sin(c.yaw), dx, dz) });
    }
    prevCar = carId;
    for (let k = open.length - 1; k >= 0; k--) { const o = open[k], p = st.players[o.by], qd = st.players.find((x) => x.team !== p.team && !x.keeper);
      if (st.t - o.t > 1.5 || st.possession?.carrier !== o.by) { if (st.possession?.carrier !== o.by && st.t - o.t <= 1.5 && st.players[st.possession?.carrier ?? -1]?.team !== p.team) o.perdu = true; G.push(o); open.splice(k, 1); continue; }
      const bx = st.ball.p[0] - p.p[0], bz = st.ball.p[2] - p.p[2], db = Math.hypot(bx, bz), dx = qd.p[0] - p.p[0], dz = qd.p[2] - p.p[2]; o.dMax = Math.max(o.dMax, db);
      const ba = ang(bx, bz, dx, dz); if (ba != null && ba > 110 && db > 0.8) o.dos = true;
      const ca = p.speed > 0.5 ? ang(p.v[0], p.v[1], dx, dz) : null; if (ca != null && ca > 110 && o.coteBut) { o.fuiteT += 1 / 60; if (o.fuiteT > 0.4) o.fuite = true; }
      if (o.pied == null && db <= 0.55 && ang(bx, bz, Math.cos(p.yaw), Math.sin(p.yaw)) <= 60) o.pied = st.t - o.t; }
  }
}
const pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(0) + ' %';
const lignes = (X, nom) => { const n = X.length; if (!n) return;
  console.log(`${nom} : ${n} prises — ballon parti dans le DOS ${pc(X.filter((o) => o.dos).length, n)} ; FUITE (dos au défenseur côté but ≥ 0,4 s) ${pc(X.filter((o) => o.fuite).length, X.filter((o) => o.coteBut).length)} des prises défenseur côté but ; ballon au pied devant lui ${pc(X.filter((o) => o.pied != null).length, n)} (en ${q(X.filter((o) => o.pied != null).map((o) => o.pied), 0.5).toFixed(2)} s) ; perdu < 1,5 s ${pc(X.filter((o) => o.perdu).length, n)} ; ballon au plus loin ${q(X.map((o) => o.dMax), 0.5).toFixed(2)} m [p90 ${q(X.map((o) => o.dMax), 0.9).toFixed(2)}]`); };
lignes(G, 'TOUTES');
const esp = {}; for (const o of G) (esp[o.k] ??= []).push(o);
for (const [k, X] of Object.entries(esp).sort((a, b) => b[1].length - a[1].length)) lignes(X, '  ' + k);
const Gc = G.filter((o) => o.coteBut); lignes(Gc, 'défenseur côté but à la prise');
console.log(`  à la prise (défenseur côté but) : ballon ∠défenseur ${q(Gc.map((o) => o.bAng0 ?? 0), 0.5).toFixed(0)}° [${q(Gc.map((o) => o.bAng0 ?? 0), 0.1).toFixed(0)}–${q(Gc.map((o) => o.bAng0 ?? 0), 0.9).toFixed(0)}], vitesse ${q(Gc.map((o) => o.vB0), 0.5).toFixed(1)} m/s vers ∠${q(Gc.map((o) => o.vBang0 ?? 0), 0.5).toFixed(0)}°, regard du porteur ∠${q(Gc.map((o) => o.yaw0 ?? 0), 0.5).toFixed(0)}°`);
{ const X = G.filter((o) => o.coteBut && o.d0 >= 1.5), bin = (f, nom, cats) => { const out = cats.map(([lab, t]) => { const Y = X.filter((o) => t(f(o))); return `${lab} ${Y.length ? pc(Y.filter((o) => o.fuite).length, Y.length) : '—'} (${Y.length})`; }); console.log(`  fuite selon ${nom} : ${out.join(', ')}`); };
  console.log('DÉFENSEUR CÔTÉ BUT À ≥ 1,5 m (' + X.length + ' prises) :');
  bin((o) => o.bRegard0 ?? 0, "le ballon dans le regard du porteur", [['devant (≤ 60°)', (a) => a <= 60], ['de côté', (a) => a > 60 && a <= 110], ['DERRIÈRE (> 110°)', (a) => a > 110]]);
  bin((o) => o.vAng0 ?? 0, "la course du porteur vers le défenseur", [['vers lui', (a) => a <= 60], ['de côté', (a) => a > 60 && a <= 110], ['à l\'opposé', (a) => a > 110]]);
  bin((o) => o.v0, "l'allure du porteur", [['< 1,5', (v) => v < 1.5], ['1,5-3', (v) => v >= 1.5 && v < 3], ['≥ 3', (v) => v >= 3]]);
  bin((o) => o.ferme0, "la fermeture du défenseur", [['< 1', (v) => v < 1], ['1-3', (v) => v >= 1 && v < 3], ['≥ 3', (v) => v >= 3]]); }
{ const P = (X) => `${X.length} prises : ballon dans le dos ${pc(X.filter((o) => o.dos).length, X.length)}, perdu < 1,5 s ${pc(X.filter((o) => o.perdu).length, X.length)}`;
  console.log(`PAR DISTANCE DU DÉFENSEUR À LA PRISE — au contact (< 1,5 m) : ${P(G.filter((o) => o.d0 < 1.5))} ; 1,5-4 m : ${P(G.filter((o) => o.d0 >= 1.5 && o.d0 < 4))} ; ≥ 4 m : ${P(G.filter((o) => o.d0 >= 4))}`); }
