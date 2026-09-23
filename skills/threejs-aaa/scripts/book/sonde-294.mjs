// sonde 294 — LE CONTACT A-T-IL UN DÉCLENCHEUR ? (sonde 293 : la défense est collée AU PORTEUR — PPDA 2,1-2,5, ~2,5 × les contests
// défensifs du réel, la possession individuelle 1,08 s contre 2,14.) Chaque contact ENGAGÉ PAR LA DÉFENSE sur le porteur (la charge
// d'épaule 'duel épaule', la tentative de pique réussie ou manquée, le glissé, la faute du défenseur) est classé par les déclencheurs
// de la Bible 10 § 7 présents à l'image d'avant : T1 le MAUVAIS CONTRÔLE (ballon à > 1,2 m du porteur), T2 DOS AU BUT (le porteur
// regarde son propre camp à ± 60°), T3 la LIGNE (porteur à < 5 m de la touche), T4 PLUS DE RECUL (porteur à < 25 m du but défendu —
// le cadrage n'a plus d'espace derrière lui), T5 la RÉCEPTION FRAÎCHE (< 0,6 s depuis la prise). Aucun : le contact SANS déclencheur,
// celui que le vrai défenseur ne prend pas (il cadre, recul-frein, Bible 05). Et la distance du presseur dans la seconde d'avant (le
// recul-frein est-il tenu ?), la vitesse de fermeture.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—'), q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.min(a.length - 1, Math.floor(x * a.length))] : NaN; };
const qs = (a) => [0.25, 0.5, 0.75].map((x) => q(a, x).toFixed(2)).join('/');
const O = { matchs: 0, n: 0, kinds: {}, trig: { T1: 0, T2: 0, T3: 0, T4: 0, T5: 0 }, aucun: 0, aucunKinds: {}, ferme: [], dist1s: [], gagne: 0, gagneSans: 0 };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); O.matchs++;
  let seen = 0; const pris = {}; let snap = null; const H = [];
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    const c = st.possession.carrier >= 0 && st.phase === 'carry' && !st.restart ? st.players[st.possession.carrier] : null;
    snap = c ? { id: c.id, team: c.team, p: [...c.p], yaw: c.yaw, ball: [...st.ball.p], v: [...c.v] } : null;
    if (c) { let dm = 99; for (const P of st.players) if (P.team !== c.team && !P.keeper && P.down <= 0) dm = Math.min(dm, hyp(P.p[0] - c.p[0], P.p[2] - c.p[2])); H.push({ t: st.t, id: c.id, dm }); }
    while (H.length && st.t - H[0].t > 1) H.shift();
    const cd0 = st.players.map((x) => x._pokeCd ?? -1);
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const contacts = [];
    for (let k = 0; k < st.players.length; k++) { const cd = st.players[k]._pokeCd ?? -1; if (snap && st.players[k].team !== snap.team && cd !== cd0[k] && Math.abs(cd - (st.t + 0.9)) < 0.02) contacts.push({ kind: 'pique manquée', by: k, won: false }); }
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if ((e.type === 'control' || e.type === 'receive' || e.type === 'loose-kept') && e.by != null) pris[e.by] = st.t;
      if (e.type === 'tacle-pique') contacts.push({ kind: 'pique', by: e.by, won: true });
      else if (e.type === 'duel' && e.kind === 'épaule') contacts.push({ kind: 'épaule', by: e.by, won: !!e.won });
      else if (e.type === 'slide') contacts.push({ kind: 'glissé', by: e.by, won: !!e.won });
      else if (e.type === 'faute' && e.by != null && snap && st.players[e.by]?.team !== snap.team) contacts.push({ kind: 'faute', by: e.by, won: false }); }
    if (!snap) continue;
    for (const k of contacts) { const D = st.players[k.by]; if (!D || D.team === snap.team) continue;
      O.n++; O.kinds[k.kind] = (O.kinds[k.kind] ?? 0) + 1; if (k.won) O.gagne++;
      const c = snap, bx = c.ball[0] - c.p[0], bz = c.ball[2] - c.p[2];
      const ownGoal = st.pitch.ownGoal(c.team).x, atkGoal = st.pitch.ownGoal(1 - c.team).x;
      const faceOwn = Math.cos(c.yaw - Math.atan2(0 - c.p[2], ownGoal - c.p[0])) > 0.5;
      const T = { T1: hyp(bx, bz) > 1.2, T2: faceOwn, T3: st.pitch.hz - Math.abs(c.p[2]) < 5, T4: Math.abs(c.p[0] - atkGoal) < 25, T5: pris[c.id] != null && st.t - pris[c.id] < 0.6 };
      let any = false; for (const t in T) if (T[t]) { O.trig[t]++; any = true; }
      if (!any) { O.aucun++; O.aucunKinds[k.kind] = (O.aucunKinds[k.kind] ?? 0) + 1; if (k.won) O.gagneSans++;
        const h = H.filter((x) => x.id === c.id); if (h.length) O.dist1s.push(h[0].dm);
        const dx = c.p[0] - D.p[0], dz = c.p[2] - D.p[2], dd = hyp(dx, dz) || 1; O.ferme.push((D.v[0] * dx + D.v[1] * dz) / dd); } }
  }
}
const n = O.matchs, N = O.n, eq = (x) => (x / n / 2).toFixed(1);
console.log(`${n} matchs de 2 × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ${eq(N)} contacts engagés par la défense par équipe et par match : ${Object.entries(O.kinds).map(([k, v]) => `${k} ${eq(v)}`).join(', ')} ; gagnés ${pc(O.gagne, N)} %`);
console.log(`  déclencheurs présents (non exclusifs) : mauvais contrôle ${pc(O.trig.T1, N)} %, dos au but ${pc(O.trig.T2, N)} %, ligne ${pc(O.trig.T3, N)} %, plus de recul (< 25 m) ${pc(O.trig.T4, N)} %, réception fraîche ${pc(O.trig.T5, N)} %`);
console.log(`  SANS AUCUN déclencheur : ${pc(O.aucun, N)} % (${eq(O.aucun)} par équipe) — ${Object.entries(O.aucunKinds).map(([k, v]) => `${k} ${eq(v)}`).join(', ')} ; gagnés ${eq(O.gagneSans)} par équipe ; défenseur le plus proche 1 s avant p25/p50/p75 ${qs(O.dist1s)} m ; fermeture au contact ${qs(O.ferme)} m/s`);
