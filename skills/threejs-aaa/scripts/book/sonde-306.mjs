// sonde 306 — LA QUALITÉ VISUELLE DES PASSES ET DES CONTRÔLES (25/09, retour Vercel). usage : node sonde-306.mjs [graines] [json des réglages] [durée par période, 1350]
// LA QUALITÉ VISUELLE DES PASSES ET DES CONTRÔLES (retour du 25/09 : « la balle part à 2 m devant ; la passe arrive derrière le joueur,
// demi-tour et 5 m de course »). Par passe réussie : (1) où le ballon arrive par rapport au receveur — derrière (relèvement > 100°
// de son regard/sa course au départ), la course du receveur entre la frappe et la réception, le demi-tour (sa vitesse s'inverse) ;
// (2) le premier contrôle : la distance ballon–pied 0,3 s et 0,6 s après la prise, et la part > 1,5 m.
const { makeMatch, matchStep, matchCfg } = await import('/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js');
const seeds = (process.argv[2] ?? '3').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 1350);
const h = Math.hypot, R = [], C = []; const q = (a, f) => { const s = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); return s[Math.floor(f * (s.length - 1))]; };
const ang = (a) => Math.abs(((a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * 180 / Math.PI;
for (const seed of seeds) { const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); let seen = 0, P = null; const obs = [];
  for (let i = 0; i < DUR * 60 * 2.4; i++) { matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    if (P) { const r = st.players[P.to]; P.run += h(r.v[0], r.v[1]) / 60; if (h(r.v[0], r.v[1]) > 1 && (r.v[0] * P.v0[0] + r.v[1] * P.v0[1]) < -0.3 * h(r.v[0], r.v[1]) * Math.max(0.5, h(P.v0[0], P.v0[1]))) P.volteFace = true; }
    for (const o of obs) { const r = st.players[o.id], d = h(st.ball.p[0] - r.p[0], st.ball.p[2] - r.p[2]); const dt = st.t - o.t; if (o.d3 == null && dt >= 0.3) o.d3 = d; if (o.d6 == null && dt >= 0.6) { o.d6 = d; o.max = Math.max(o.max, d); } if (dt < 0.6) o.max = Math.max(o.max, d); }
    for (let k = obs.length - 1; k >= 0; k--) if (st.t - obs[k].t > 0.65) { C.push(obs[k]); obs.splice(k, 1); }
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (e.type === 'pass' && !e.clear && !e.mains && e.to >= 0 && st.pass && !st.restart) { const r = st.players[e.to]; const L = st.pass.lead; P = { to: e.to, t: st.t, p0: [r.p[0], r.p[2]], v0: [r.v[0], r.v[1]], yaw0: r.yaw, run: 0, style: e.style ?? '-', lead: [L[0], L[2]], rdv: e.rdv != null, esp: !!e.esp, leadAng: h(r.v[0], r.v[1]) > 1 ? ang(Math.atan2(L[2] - r.p[2], L[0] - r.p[0]) - Math.atan2(r.v[1], r.v[0])) : null, leadD: h(L[0] - r.p[0], L[2] - r.p[2]), job0: r.job }; continue; }
      if (P && (e.type === 'control' || e.type === 'receive') && e.by === P.to) { const r = st.players[P.to], b = st.ball.p;
        const face = ang(Math.atan2(b[2] - r.p[2], b[0] - r.p[0]) - r.yaw);
        const vr = h(P.v0[0], P.v0[1]); const course = vr > 1 ? ang(Math.atan2(b[2] - P.p0[1], b[0] - P.p0[0]) - Math.atan2(P.v0[1], P.v0[0])) : null;
        R.push({ lead: P.lead, leadAng: P.leadAng, leadD: P.leadD, rdv: P.rdv, esp: P.esp, job0: P.job0, miss: h(b[0] - P.lead[0], b[2] - P.lead[1]), run: P.run, face, course, volte: !!P.volteFace, dep: h(r.p[0] - P.p0[0], r.p[2] - P.p0[1]), style: P.style }); P = null;
        if (e.type === 'control' && !e.miss) obs.push({ id: e.by, t: st.t, max: 0 }); continue; }
      if (P && (e.type === 'turnover' || st.restart)) P = null; } } }
const pc = (f) => (100 * R.filter(f).length / R.length).toFixed(1);
console.log(`passes reçues ${R.length} : receveur qui fait DEMI-TOUR pendant le vol ${pc(r => r.volte)} % ; ballon DERRIÈRE sa course au départ (> 100°) ${pc(r => r.course != null && r.course > 100)} % ; ballon hors de son regard à la prise (> 90°) ${pc(r => r.face > 90)} %`);
console.log(`  course du receveur pendant le vol p50/p75/p90 ${q(R.map(r => r.run), .5)?.toFixed(1)}/${q(R.map(r => r.run), .75)?.toFixed(1)}/${q(R.map(r => r.run), .9)?.toFixed(1)} m ; > 5 m : ${pc(r => r.run > 5)} %`);
console.log(`contrôles ${C.length} : ballon–joueur à 0,3 s p50/p75/p90 ${q(C.map(c => c.d3), .5)?.toFixed(2)}/${q(C.map(c => c.d3), .75)?.toFixed(2)}/${q(C.map(c => c.d3), .9)?.toFixed(2)} ; à 0,6 s ${q(C.map(c => c.d6), .5)?.toFixed(2)}/${q(C.map(c => c.d6), .75)?.toFixed(2)}/${q(C.map(c => c.d6), .9)?.toFixed(2)} ; max > 1,5 m : ${(100 * C.filter(c => c.max > 1.5).length / C.length).toFixed(1)} % ; > 2 m : ${(100 * C.filter(c => c.max > 2).length / C.length).toFixed(1)} %`);
const V = R.filter(r => r.volte), N2 = R.filter(r => !r.volte);
for (const [n, A] of [['DEMI-TOUR', V], ['sans', N2]]) { const J = {}; for (const a of A) J[a.job0] = (J[a.job0] ?? 0) + 1; const S2 = {}; for (const a of A) S2[a.style] = (S2[a.style] ?? 0) + 1;
  console.log(`${n} (${A.length}) : point visé à ${q(A.map(a => a.leadD), .5)?.toFixed(1)} m du receveur, à ${q(A.map(a => a.leadAng), .5)?.toFixed(0)}° de sa course (derrière > 100° : ${A.filter(a => a.leadAng > 100).length}) ; prise à ${q(A.map(a => a.miss), .5)?.toFixed(1)} m du point visé ; rendez-vous ${A.filter(a => a.rdv).length} ; job au départ ${JSON.stringify(J)} ; ${JSON.stringify(S2)}`); }
const grp = (f) => { const A = R.filter(f); return `${A.length} passes, demi-tour ${(100 * A.filter(a => a.volte).length / Math.max(1, A.length)).toFixed(0)} %, point visé à ${q(A.map(a => a.leadD), .5)?.toFixed(1)} m, course > 5 m ${(100 * A.filter(a => a.run > 5).length / Math.max(1, A.length)).toFixed(0)} %`; };
console.log('avec rendez-vous :', grp(r => r.rdv)); console.log('une-touche :', grp(r => r.style === 'une-touche')); console.log('levées :', grp(r => r.style === 'lofted')); console.log('autres sans rendez-vous :', grp(r => !r.rdv && r.style !== 'une-touche' && r.style !== 'lofted'));
