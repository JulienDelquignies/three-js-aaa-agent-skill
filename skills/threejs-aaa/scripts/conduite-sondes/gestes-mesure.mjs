// LES GESTES ET LE CONTACT MESURÉS DANS LE RENDU — les os des deux joueurs, image par image (sans rendu : sc.update + matrixWorld).
// (1) LES CORPS : chaque joueur est un jeu de capsules (bassin, ventre, poitrine, tête, bras, avant-bras, mains, cuisses, jambes, pieds)
//     AJUSTÉES sur son maillage (axe principal des sommets de chaque groupe d'os, dans le repère de l'os ; rayon p90 à l'axe). La
//     pénétration d'une image = max(rA + rB − distance des segments) sur les paires ; on la rapporte avec la distance de la sim (centres)
//     et l'écart rendu ↔ sim (le bassin rendu contre p).
// (2) LES GESTES : autour de chaque événement 'skill' dans la foulée (fenêtre −0,6 / +1,4 s), dans le repère de la course au départ
//     (avant f, droite r) : le bassin qui se décale (m), le tronc qui s'incline (roulis, °) et tourne (lacet des épaules et du bassin
//     contre la course, °), le pied qui passe AU-DESSUS du ballon (hauteur de la pointe quand elle croise la verticale du ballon), le
//     balayage latéral du pied autour du ballon, le virage du ballon et du corps, le freinage.
// Usage : node gestes-mesure.mjs <url> [secondes=120] [graines=1,2,3] [sortie.json]   (SAB=… : window.__sabotage ; CFG='{json}' : config du duel)
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const [URL, SECS = '120', GR = '1,2,3', OUT] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const R = { rayons: null, pen: [], gestes: [] };
for (const seed of GR.split(',').map(Number)) {
const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}`, { waitUntil: 'load', timeout: 240000 });
await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length === 2, null, { timeout: 240000 });
if (process.env.SAB) await pg.evaluate((s) => { window.__sabotage = s; }, process.env.SAB);
if (process.env.CFG) await pg.evaluate((c) => { const m = (o, x) => { for (const [k, v] of Object.entries(x)) if (v && typeof v === 'object' && o[k] && typeof o[k] === 'object') m(o[k], v); else o[k] = v; }; m(window.__scene._mcfg, JSON.parse(c)); }, process.env.CFG);   // CFG='{"corps":{"sim":false}}' : une clé de la config du duel changée (A/B)
const r = await pg.evaluate((SECS) => {
  const sc = window.__scene, st = sc.state, dt = 1 / 60, V = sc.players[0].model.position.constructor;
  // LES CAPSULES DU CORPS, AJUSTÉES SUR LE MAILLAGE : par groupe d'os, les sommets skinnés dominés par ses os, ramenés dans le repère de l'os
  // porteur (première image) ; axe = direction principale (ACP), extrémités = p2 / p98 des projections, rayon = p90 de la distance à l'axe.
  // (Un rayon unique autour du segment os → os gonflait le pied — la semelle 12 cm sous la cheville — et l'avant-bras — la main au-delà.)
  const GR = [['bassin', 'Hips', ['Hips']], ['ventre', 'Spine1', ['Spine', 'Spine1']], ['poitrine', 'Spine2', ['Spine2', 'LeftShoulder', 'RightShoulder']], ['tete', 'Head', ['Neck', 'Head']]];
  for (const s of ['Left', 'Right']) GR.push([`bras${s[0]}`, `${s}Arm`, [`${s}Arm`]], [`avbras${s[0]}`, `${s}ForeArm`, [`${s}ForeArm`]], [`main${s[0]}`, `${s}Hand`, [`${s}Hand`]],
    [`cuisse${s[0]}`, `${s}UpLeg`, [`${s}UpLeg`]], [`jambe${s[0]}`, `${s}Leg`, [`${s}Leg`]], [`pied${s[0]}`, `${s}Foot`, [`${s}Foot`, `${s}ToeBase`]]);
  const W = (o) => [o.matrixWorld.elements[12], o.matrixWorld.elements[13], o.matrixWorld.elements[14]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const segDist = (p0, p1, q0, q1) => {   // distance entre deux segments (Ericson, Real-Time Collision Detection § 5.1.9)
    const d1 = sub(p1, p0), d2 = sub(q1, q0), r = sub(p0, q0), a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r); let s, t;
    if (a < 1e-9 && e < 1e-9) return Math.sqrt(dot(r, r));
    if (a < 1e-9) { s = 0; t = Math.min(1, Math.max(0, f / e)); } else { const c = dot(d1, r); if (e < 1e-9) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else {
      const bb = dot(d1, d2), den = a * e - bb * bb; s = den > 1e-9 ? Math.min(1, Math.max(0, (bb * f - c * e) / den)) : 0; t = (bb * s + f) / e;
      if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (bb - c) / a)); } } }
    const cp = [p0[0] + d1[0] * s - q0[0] - d2[0] * t, p0[1] + d1[1] * s - q0[1] - d2[1] * t, p0[2] + d1[2] * s - q0[2] - d2[2] * t]; return Math.sqrt(dot(cp, cp));
  };
  sc.update(dt);
  const J = sc.players.map((pl) => {
    pl.model.updateMatrixWorld(true);
    const bone = {}; pl.model.traverse((o) => { if (o.isBone && !bone[o.name]) bone[o.name] = o; });
    const owner = {}; for (const [n, , os] of GR) for (const o of os) owner[o] = n;
    const pts = Object.fromEntries(GR.map(([n]) => [n, []])), v = new V(), M = pl.model.matrixWorld.clone();
    const inv = Object.fromEntries(GR.map(([n, b]) => [n, M.clone().copy(bone[b].matrixWorld).invert()]));
    pl.model.traverse((m) => { if (!m.isSkinnedMesh) return; const g = m.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, N = g.attributes.position.count;
      for (let i = 0; i < N; i += 2) { let k = 0; for (let c = 1; c < 4; c++) if (sw.getComponent(i, c) > sw.getComponent(i, k)) k = c;
        const sg = owner[m.skeleton.bones[si.getComponent(i, k)]?.name]; if (!sg) continue;
        m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld).applyMatrix4(inv[sg]); pts[sg].push([v.x, v.y, v.z]); } });
    const dirLoc = (o, a, c) => { const A = W(bone[a]), C = W(bone[c]), e = o.matrixWorld.clone().invert().elements, d = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const x = [e[0] * d[0] + e[4] * d[1] + e[8] * d[2], e[1] * d[0] + e[5] * d[1] + e[9] * d[2], e[2] * d[0] + e[6] * d[1] + e[10] * d[2]], l = Math.hypot(...x) || 1; return x.map((u) => u / l); };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], nrm = (a) => { const l = Math.hypot(...a) || 1; return a.map((u) => u / l); };
    const pq = (xs, f) => { const t = [...xs].sort((x, y) => x - y); return t[Math.floor(f * (t.length - 1))]; };
    const caps = [];
    for (const [n, b] of GR) { const P = pts[n], c = [0, 1, 2].map((k) => P.reduce((s, p) => s + p[k], 0) / P.length), E = bone[b].matrixWorld.elements, ech = Math.hypot(E[0], E[1], E[2]);
      if (['bassin', 'ventre', 'poitrine'].includes(n)) {
        // LE TORSE : plus large que profond — trois capsules VERTICALES côte à côte (rayon = demi-profondeur p90, décalées sur la demi-largeur p90)
        const up = dirLoc(bone[b], 'Hips', 'Neck'), lat0 = n === 'poitrine' ? dirLoc(bone[b], 'LeftArm', 'RightArm') : dirLoc(bone[b], 'LeftUpLeg', 'RightUpLeg');
        const dp = nrm(cross(up, lat0)), la = cross(dp, up), co = (p, a) => dot(sub(p, c), a);
        const v = P.map((p) => co(p, up)), l = P.map((p) => co(p, la)), d = P.map((p) => co(p, dp)), lc = (pq(l, 0.05) + pq(l, 0.95)) / 2, dc = (pq(d, 0.05) + pq(d, 0.95)) / 2;
        const r = pq(d.map((u) => Math.abs(u - dc)), 0.9), w = pq(l.map((u) => Math.abs(u - lc)), 0.9), v0 = pq(v, 0.02) + r, v1 = pq(v, 0.98) - r, off = Math.max(0, w - r);
        for (const o of off > 0 ? [-off, 0, off] : [0]) { const base = c.map((u, k) => u + la[k] * (lc + o) + dp[k] * dc);
          caps.push({ n, b, a: base.map((u, k) => u + up[k] * Math.min(v0, v1)), z: base.map((u, k) => u + up[k] * Math.max(v0, v1)), r: r * ech, L: w * 2 * ech }); }
        continue;
      }
      const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (const p of P) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += (p[i] - c[i]) * (p[j] - c[j]);
      let e = [1, 1, 1]; for (let it = 0; it < 60; it++) { const x = [0, 1, 2].map((i) => C[i][0] * e[0] + C[i][1] * e[1] + C[i][2] * e[2]), l = Math.hypot(...x) || 1; e = x.map((u) => u / l); }
      const tt = P.map((p) => dot(sub(p, c), e)), t0 = pq(tt, 0.02), t1 = pq(tt, 0.98);
      const r = pq(P.map((p) => { const d = sub(p, c), t = dot(d, e); return Math.hypot(d[0] - e[0] * t, d[1] - e[1] * t, d[2] - e[2] * t); }), 0.9);
      caps.push({ n, b, a: c.map((u, k) => u + e[k] * t0), z: c.map((u, k) => u + e[k] * t1), r: r * ech, L: (t1 - t0) * ech });
    }
    return { pl, bone, caps, rayon: Object.fromEntries(caps.map((k) => [k.n, [+k.r.toFixed(3), +k.L.toFixed(2)]])) };
  });
  const loc = (o, p) => { const e = o.matrixWorld.elements; return [e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12], e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13], e[2] * p[0] + e[6] * p[1] + e[10] * p[2] + e[14]]; };
  const segs = (j) => J[j].caps.map((k) => [k.n, loc(J[j].bone[k.b], k.a), loc(J[j].bone[k.b], k.z), k.r]);
  const out = { rayons: J.map((x) => x.rayon), pen: [], gestes: [] }; let ne = 0; const hist = [];
  for (let i = 0; i < SECS * 60; i++) {
    sc.update(dt); for (const x of J) x.pl.model.updateMatrixWorld(true);
    const t = +st.t.toFixed(3), A = segs(0), B = segs(1); let pire = { p: -9 };
    for (const a of A) for (const c of B) { const p = a[3] + c[3] - segDist(a[1], a[2], c[1], c[2]); if (p > pire.p) pire = { p, a: a[0], b: c[0] }; }
    const sp = J.map((x) => x.pl.sim), H = J.map((x) => W(x.bone.Hips));
    const f = { t, pen: +pire.p.toFixed(3), paire: `${pire.a}/${pire.b}`, dSim: +Math.hypot(sp[0].p[0] - sp[1].p[0], sp[0].p[2] - sp[1].p[2]).toFixed(3),
      ecart: H.map((h, j) => +Math.hypot(h[0] - sp[j].p[0], h[2] - sp[j].p[2]).toFixed(3)), restart: !!st.restart,
      os: J.map((x) => Object.fromEntries(['Hips', 'Neck', 'Head', 'LeftArm', 'RightArm', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'].map((k) => [k, W(x.bone[k]).map((u) => +u.toFixed(3))]))),
      ball: st.ball.p.map((u) => +u.toFixed(3)), v: sp.map((s) => [+s.v[0].toFixed(2), +s.v[1].toFixed(2)]), ph: J.map((x) => ['Left', 'Right'].map((k) => x.pl.ctrl?._gaitFeet?.[k]?.phase ?? null)), act: sp.map((s) => s.act?.payload?.skill ?? s.act?.payload?.kind ?? (s.act ? 'act' : null)) };
    const act = sp.map((q) => q.act ? (q.act.payload?.foulee ? 'geste-foulee' : q.act.kind ?? q.act.payload?.skill ?? q.act.payload?.kind ?? 'act') : null);
    const rel = (() => { const [a, c] = sp, dx = c.p[0] - a.p[0], dz = c.p[2] - a.p[2], d = Math.hypot(dx, dz) || 1; return Math.round(Math.acos(Math.max(-1, Math.min(1, (Math.cos(a.yaw) * dx + Math.sin(a.yaw) * dz) / d))) * 180 / Math.PI); })();
    out.pen.push([t, f.pen, f.paire, f.dSim, f.ecart[0], f.ecart[1], f.restart ? 1 : 0, act[0], act[1], +Math.hypot(...sp[0].v).toFixed(1), +Math.hypot(...sp[1].v).toFixed(1), rel, st.possession?.carrier ?? -1, J.map((x) => ['Left', 'Right'].map((k) => ({ swing: 'v', stance: 'a', peel: 'd' })[x.pl.ctrl?._gaitFeet?.[k]?.phase] ?? '?').join('')).join('|')]);
    hist.push(f); if (hist.length > 150) hist.shift();
    while (ne < st.events.length) { const e = st.events[ne++]; if (e.type === 'skill' && e.foulee && !/-vendu/.test(e.kind)) out.gestes.push({ t: e.t, kind: e.kind, by: e.by, touches: [], frames: hist.filter((h) => h.t >= e.t - 0.6).slice() });
      if (e.type === 'touche' && e.pas === 'geste') for (const g of out.gestes) if (!g.fini && g.by === e.by) g.touches.push(e.t); }
    for (const g of out.gestes) if (!g.fini) { const last = g.frames[g.frames.length - 1]; if (last.t < t) g.frames.push(f); if (t >= g.t + 1.4) g.fini = true; }
  }
  return out;
}, +SECS);
R.rayons ??= r.rayons; R.pen.push(...r.pen); for (const g of r.gestes) R.gestes.push({ ...g, seed }); await pg.close(); console.log(`graine ${seed} : ${r.gestes.length} gestes`);
}
await b.close();

// ---- l'analyse (hors page) ----
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const jeu = R.pen.filter((x) => !x[6]), pen = jeu.map((x) => x[1]);
console.log('capsules mesurées [rayon, longueur] (m) :', JSON.stringify(R.rayons[0]), '| n° 2 :', JSON.stringify(R.rayons[1]));
console.log(`CONTACT (${jeu.length} images de jeu) : pénétration > 2 cm ${(100 * pen.filter((p) => p > 0.02).length / pen.length).toFixed(1)} %, > 5 cm ${(100 * pen.filter((p) => p > 0.05).length / pen.length).toFixed(1)} %, > 10 cm ${(100 * pen.filter((p) => p > 0.1).length / pen.length).toFixed(1)} %, max ${Math.max(...pen).toFixed(2)} m`);
const paires = {}; for (const x of jeu) if (x[1] > 0.05) paires[x[2]] = (paires[x[2]] ?? 0) + 1;
console.log('  paires qui s\'enfoncent (> 5 cm) :', Object.entries(paires).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(', '));
const pr = jeu.filter((x) => x[1] > 0.05);
if (pr.length) console.log(`  à ces images : distance sim p50 ${q(pr.map((x) => x[3]), 0.5).toFixed(2)} m (min ${Math.min(...pr.map((x) => x[3])).toFixed(2)}), écart bassin rendu ↔ sim p50 ${q(pr.flatMap((x) => [x[4], x[5]]), 0.5).toFixed(2)} p90 ${q(pr.flatMap((x) => [x[4], x[5]]), 0.9).toFixed(2)} m`);
{ const ctx = {}; for (const x of pr) { const k = `${x[7] ?? '·'} | ${x[8] ?? '·'}`; (ctx[k] ??= []).push(x); }
  console.log('  contextes (acts j0 | j1) des images > 5 cm :', Object.entries(ctx).sort((a, b) => b[1].length - a[1].length).slice(0, 8).map(([k, L]) => `${k} ${L.length}`).join(' ; '));
  const jb = pr.filter((x) => !x[7] && !x[8] && /pied|jambe|cuisse/.test(x[2])); if (jb.length) { const ph = {}; for (const x of jb) { const [pa, pb] = x[2].split('/'), cA = pa.slice(-1) === 'L' ? 0 : 1, cB = pb.slice(-1) === 'L' ? 0 : 1, f = x[13] ?? '??|??';
    const k = `${f.split('|')[0][cA]}/${f.split('|')[1][cB]}`; ph[k] = (ph[k] ?? 0) + 1; }
    console.log(`  jambes sans act (${jb.length}) — phases des deux jambes en cause (v = vol, a = appui, d = décollage) :`, Object.entries(ph).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')); }
  const sans = pr.filter((x) => !x[7] && !x[8]); if (sans.length) console.log(`  sans act (${sans.length}) : v p50 ${q(sans.flatMap((x) => [x[9], x[10]]), 0.5)} m/s, relèvement de j1 vu de j0 p50 ${q(sans.map((x) => x[11]), 0.5)}° [${q(sans.map((x) => x[11]), 0.1)}–${q(sans.map((x) => x[11]), 0.9)}], paires : ${Object.entries(sans.reduce((m, x) => (m[x[2]] = (m[x[2]] ?? 0) + 1, m), {})).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}`).join(', ')}`); }
console.log(`  écart bassin rendu ↔ sim sur tout le jeu : p50 ${q(jeu.flatMap((x) => [x[4], x[5]]), 0.5).toFixed(2)} p90 ${q(jeu.flatMap((x) => [x[4], x[5]]), 0.9).toFixed(2)} m`);

const deg = (x) => x * 180 / Math.PI, ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// LES RÉFÉRENCES MESURÉES (les chiffres ; « ≈ » : lu sur une figure) —
//  passement : Taga et al. 2026 (JJPEHSS 71:63, 15 universitaires confirmés, 60 i/s, contre un défenseur qui suit) — vente 0,65 ± 0,05 s ;
//    bassin ≈ 2,2 m/s à l'approche, ≈ 2,9 pendant la vente, ≈ 4,3 à la sortie ; pointe du pied qui cercle 0,24 ± 0,10 m ; à la sortie le
//    tronc penche ≈ 41° en avant et ≈ 18 ± 4,5° vers le côté où se pose le pied qui a cerclé, genou d'appui ≈ 113° (≈ 67° de flexion),
//    cheville de poussée ≈ 0,35-0,55 m sur le côté du bassin.
//  feinte de corps : Brault et al. 2010 (Hum. Mov. Sci. 29:412, rugby 1c1, 35 feintes réussies) — pied extérieur ≈ 0,6 m sur le côté ;
//    haut du tronc tourné ≈ 25° (pic), tête ≈ 10°, bassin ≈ 5° ; roulis ≈ 15° ; le centre de masse reste à ≈ ±0,10 m ; la vraie
//    réorientation part 0,15-0,22 s après la pose (tableau 2b).
//  crochet : Dos'Santos et al. 2021 (J Sports Sci, 27 hommes, SANS ballon) — 45° / 90° / 180° : approche 5,22 / 4,51 / 4,00 m/s, pose
//    5,06 / 3,43 / 2,68, sortie 5,27 / 3,29 / 2,20 ; appui 0,20 / 0,30 / 0,51 s ; inclinaison latérale du tronc 20,9 / 18,0 / 7,4° ; rotation
//    du bassin 4,6 / 30,7 / 82,1° ; flexion max du genou 55,8 / 64,2 / 67,3°. Avec ballon : plus lent (Chang 2017, pas de chiffres).
const REF = {
  passement: { vente: '0,65', vA: '≈2,2', vV: '≈2,9', vS: '≈4,3', pointe: '0,24', tangage: '≈41', roulisS: '≈18', genou: '≈67', pousse: '≈0,35-0,55' },
  feinteCorps: { piedExt: '≈0,6', epaules: '≈25', bassinL: '≈5', roulisV: '≈15', comLat: '≤≈0,10', reorient: '0,15-0,22' },
  crochet: { note: '45°/90°/180° : sortie 5,3/3,3/2,2 m/s, roulis 21/18/7°, bassin 5/31/82°, genou 56/64/67°' },
};
// Chaque geste en phases : APPROCHE [départ − 0,31 s, départ], VENTE [départ, touche de sortie], SORTIE [touche, touche + 0,3 s] (les durées de
// Taga). Repère de la course à l'approche (avant f, droite r) ; côté de sortie s (+1 droite) ; « vers le côté feint » = −s.
const G = [];
for (const g of R.gestes) {
  const j = g.by, F = g.frames, tT = g.touches.find((t) => t >= g.t); if (tT == null) { (R.interrompus ??= {})[g.kind] = (R.interrompus[g.kind] ?? 0) + 1; continue; }   // sans touche de sortie : le duel l'a tranché (noyau) — pas de sortie à mesurer
  const app = F.filter((x) => x.t < g.t && x.t >= g.t - 0.31); if (app.length < 5) continue;
  const vx = app.reduce((s, x) => s + x.v[j][0], 0), vz = app.reduce((s, x) => s + x.v[j][1], 0), n = Math.hypot(vx, vz) || 1, fw = [vx / n, vz / n], rt = [-fw[1], fw[0]];
  const vente = F.filter((x) => x.t >= g.t && x.t <= tT), sortie = F.filter((x) => x.t >= tT && x.t <= tT + 0.3), apres = F.filter((x) => x.t >= tT && x.t <= tT + 0.8);
  const poussee = F.filter((x) => x.t >= tT - 0.3 && x.t <= tT + 0.05);   // l'APPUI QUI POUSSE vers la sortie précède la touche (le pied qui joue le ballon est en vol pendant qu'il pousse)
  if (!vente.length || sortie.length < 10 || apres.length < 30) continue;
  const vS = apres.slice(-15).reduce((s, x) => [s[0] + x.v[j][0], s[1] + x.v[j][1]], [0, 0]), cote = Math.sign(vS[0] * rt[0] + vS[1] * rt[1]) || 1;
  const O = (x, k) => x.os[j][k], lat = (p, o) => (p[0] - o[0]) * rt[0] + (p[2] - o[2]) * rt[1], av = (p, o) => (p[0] - o[0]) * fw[0] + (p[2] - o[2]) * fw[1];
  const roll = (x) => { const a = O(x, 'Hips'), c = O(x, 'Neck'); return deg(Math.atan2(lat(c, a), c[1] - a[1])); };            // + : penché à droite
  const pitch = (x) => { const a = O(x, 'Hips'), c = O(x, 'Neck'); return deg(Math.atan2(av(c, a), c[1] - a[1])); };           // + : penché en avant
  const yawSeg = (x, L, Rr) => { const a = O(x, L), c = O(x, Rr), dx = c[0] - a[0], dz = c[2] - a[2]; return -deg(ang(Math.atan2(dx * fw[0] + dz * fw[1], dx * rt[0] + dz * rt[1]))); };   // + : tourné à droite
  const genou = (x, S) => { const h = O(x, S + 'UpLeg'), k = O(x, S + 'Leg'), a = O(x, S + 'Foot'), u = [h[0] - k[0], h[1] - k[1], h[2] - k[2]], w = [a[0] - k[0], a[1] - k[1], a[2] - k[2]];
    return 180 - deg(Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (Math.hypot(...u) * Math.hypot(...w)))))); };   // flexion, 0 = tendue
  const appuiDe = (x) => { const ph = x.ph?.[j]; if (ph) { const a = ph.map((u) => u === 'stance' || u === 'peel'); if (a[0] !== a[1]) return a[0] ? 'Left' : 'Right'; } return O(x, 'LeftFoot')[1] <= O(x, 'RightFoot')[1] ? 'Left' : 'Right'; };   // la PHASE du pied (le pied qui joue le ballon rase le sol : « le plus bas » le prenait pour l'appui)
  const vit = (L) => q(L.map((x) => Math.hypot(...x.v[j])), 0.5), ext = (L, f, sg) => Math.max(...L.map((x) => sg * f(x)));
  let pointe = 0; for (const x of vente) for (const k of ['Left', 'Right']) { const p = O(x, k + 'ToeBase'); if (Math.hypot(p[0] - x.ball[0], p[2] - x.ball[2]) < 0.12) pointe = Math.max(pointe, p[1]); }
  const H0 = O(vente[0], 'Hips');
  G.push({ seed: g.seed, t: g.t, kind: g.kind, by: j, cote, vente: +(tT - g.t).toFixed(2),
    vA: +vit(app).toFixed(1), vV: +vit(vente).toFixed(1), vS: +q(sortie.map((x) => Math.hypot(...x.v[j])), 0.9).toFixed(1),
    pointe: +pointe.toFixed(2),
    // la vente : vers le côté feint (−s)
    roulisV: +ext(vente, roll, -cote).toFixed(0), epaules: +ext(vente, (x) => yawSeg(x, 'LeftArm', 'RightArm'), -cote).toFixed(0), bassinL: +ext(vente, (x) => yawSeg(x, 'LeftUpLeg', 'RightUpLeg'), -cote).toFixed(0),
    comLat: +ext(vente, (x) => lat(O(x, 'Hips'), H0), -cote).toFixed(2), piedExt: +ext(vente, (x) => Math.max(lat(O(x, 'LeftFoot'), O(x, 'Hips')) * -cote, lat(O(x, 'RightFoot'), O(x, 'Hips')) * -cote), 1).toFixed(2),
    // la sortie : vers le côté de sortie (+s)
    tangage: +ext(sortie, pitch, 1).toFixed(0), roulisS: +ext(sortie, roll, cote).toFixed(0), tangageP: +ext(poussee, pitch, 1).toFixed(0), roulisP: +ext(poussee, roll, cote).toFixed(0), genou: +Math.max(...poussee.map((x) => genou(x, appuiDe(x)))).toFixed(0),
    pousse: +Math.max(...poussee.map((x) => { const S = appuiDe(x); return -cote * lat(O(x, S + 'Foot'), O(x, 'Hips')); })).toFixed(2),
    bassinS: +ext(apres, (x) => yawSeg(x, 'LeftUpLeg', 'RightUpLeg'), cote).toFixed(0),
    virage: +deg(Math.abs(ang(Math.atan2(vS[1], vS[0]) - Math.atan2(fw[1], fw[0])))).toFixed(0), penMax: +Math.max(...F.map((x) => x.pen)).toFixed(2) });
}
const parK = {}; for (const g of G) (parK[g.kind] ??= []).push(g);
for (const [k, L] of Object.entries(parK)) {
  const m = (f, d = 2) => { const v = L.map(f); return `${q(v, 0.5).toFixed(d)} [${q(v, 0.1).toFixed(d)}–${q(v, 0.9).toFixed(d)}]`; }, r = REF[k] ?? {}, ref = (x) => (r[x] ? ` (réf. ${r[x]})` : '');
  console.log(`\n${k} (${L.length} allés jusqu'à leur touche de sortie, ${R.interrompus?.[k] ?? 0} tranchés avant par le duel) — médiane [p10–p90]${r.note ? ' — réf. ' + r.note : ''}`);
  console.log(`  vitesse du corps : approche ${m((g) => g.vA, 1)}${ref('vA')} → vente ${m((g) => g.vV, 1)}${ref('vV')} → sortie (p90 des 0,3 s) ${m((g) => g.vS, 1)}${ref('vS')} m/s | vente ${m((g) => g.vente)} s${ref('vente')} | virage ${m((g) => g.virage, 0)}°`);
  console.log(`  VENTE (vers le côté feint) : tronc roulis ${m((g) => g.roulisV, 0)}°${ref('roulisV')} | épaules tournées ${m((g) => g.epaules, 0)}°${ref('epaules')} | bassin tourné ${m((g) => g.bassinL, 0)}°${ref('bassinL')} | bassin décalé ${m((g) => g.comLat)} m${ref('comLat')} | pied extérieur ${m((g) => g.piedExt)} m${ref('piedExt')} | pointe au-dessus du ballon ${m((g) => g.pointe)} m${ref('pointe')}`);
  console.log(`  SORTIE : tronc en avant ${m((g) => g.tangage, 0)}°${ref('tangage')} | roulis vers la sortie ${m((g) => g.roulisS, 0)}°${ref('roulisS')} | APPUI QUI POUSSE (0,3 s avant la touche) : tronc en avant ${m((g) => g.tangageP, 0)}°${ref('tangage')}, roulis vers la sortie ${m((g) => g.roulisP, 0)}°, genou ${m((g) => g.genou, 0)}°${ref('genou')}, cheville à ${m((g) => g.pousse)} m du bassin côté feint${ref('pousse')} | bassin tourné vers la sortie ${m((g) => g.bassinS, 0)}° | pénétration max ${m((g) => g.penMax)} m`);
}
if (OUT) writeFileSync(OUT, JSON.stringify({ gestes: G, pen: R.pen, rayons: R.rayons }));
