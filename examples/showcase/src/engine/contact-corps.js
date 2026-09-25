// contact-corps — LES CORPS RENDUS NE SE TRAVERSENT PAS (2026-09-25, cfg.corps — le duel l'allume ; la scène l'appelle une fois tous les
// joueurs posés, verrous et warps compris). Mesuré avant dans le rendu (conduite-sondes/gestes-mesure.mjs, 8 graines × 120 s, capsules
// ajustées sur le maillage) : une partie d'un corps DANS l'autre de plus de 5 cm sur 4,5 % des images de jeu — surtout TÊTE CONTRE TÊTE,
// l'avant-bras ou la main dans le ventre de l'autre, en pleine course (sans geste ni tacle). La sim sépare les corps (pas.pasCorps) avec le
// générateur, mais le rendu les penche en plus (l'accélération, le frein, le virage, les gestes) : la tête rendue est à 0,10 m (p50, 0,24
// au p90) de celle du générateur. La résolution se fait donc ICI, sur les corps rendus, comme un jeu le fait (une couche de contact après
// l'animation) :
//   • LE BUSTE S'ÉCARTE : une tête ou une poitrine dans l'autre corps penche le tronc (os Spine) à l'opposé du contact, moitié chacun ;
//   • LE BRAS SE POSE : un bras, un avant-bras ou une main dans l'autre corps (cuisses comprises) tourne à l'épaule jusqu'à sa surface — la main reste SUR
//     l'adversaire (le contact réel du duel), elle n'y entre pas ;
//   • LA JAMBE EN VOL CONTOURNE : elle tourne à la hanche, le pied passe à côté de celui de l'autre (les deux tiers des jambes enfoncées
//     avaient une jambe en vol ; les appuis restent à la sim, pasCorps).
// Le contact s'impose à l'image (la pénétration monte de 2-3 cm par image : la réponse est continue), il se relâche en 0,2 s.
// Après (même instrument, 16 graines × 120 s) : > 5 cm sur 1,0 % des images de jeu (> 10 cm : 2,3 → 0,3 %) ; restent des pieds et des cuisses.
// Les capsules : par groupe d'os, les sommets skinnés dominés par ses os, dans le repère de l'os porteur — axe principal, rayon p90 ; le
// TORSE (plus large que profond : ANSUR II, 0,488 × 0,232 m) en trois capsules verticales côte à côte.
import * as THREE from 'three/webgpu';

const GROUPES = [['bassin', 'Hips', ['Hips']], ['ventre', 'Spine1', ['Spine', 'Spine1']], ['poitrine', 'Spine2', ['Spine2', 'LeftShoulder', 'RightShoulder']], ['tete', 'Head', ['Neck', 'Head']]];
for (const s of ['Left', 'Right']) GROUPES.push([`bras${s[0]}`, `${s}Arm`, [`${s}Arm`]], [`avbras${s[0]}`, `${s}ForeArm`, [`${s}ForeArm`]], [`main${s[0]}`, `${s}Hand`, [`${s}Hand`]],
  [`cuisse${s[0]}`, `${s}UpLeg`, [`${s}UpLeg`]], [`jambe${s[0]}`, `${s}Leg`, [`${s}Leg`]], [`pied${s[0]}`, `${s}Foot`, [`${s}Foot`, `${s}ToeBase`]]);
const TORSE = new Set(['bassin', 'ventre', 'poitrine']), HAUT = new Set(['poitrine', 'ventre', 'tete']);
const BRAS = { L: ['brasL', 'avbrasL', 'mainL'], R: ['brasR', 'avbrasR', 'mainR'] }, JAMBES = /^(cuisse|jambe|pied)/;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], nrm = (a) => { const l = Math.hypot(...a) || 1; return a.map((u) => u / l); };
const pq = (xs, f) => { const t = [...xs].sort((x, y) => x - y); return t[Math.floor(f * (t.length - 1))]; };
const loc = (o, p) => { const e = o.matrixWorld.elements; return [e[0] * p[0] + e[4] * p[1] + e[8] * p[2] + e[12], e[1] * p[0] + e[5] * p[1] + e[9] * p[2] + e[13], e[2] * p[0] + e[6] * p[1] + e[10] * p[2] + e[14]]; };
const W = (o) => [o.matrixWorld.elements[12], o.matrixWorld.elements[13], o.matrixWorld.elements[14]];

/** Les capsules d'un modèle skinné, ajustées une fois (dans le repère de leurs os : elles suivent la pose). */
export function capsulesDe(model) {
  model.updateMatrixWorld(true);
  const bone = {}; model.traverse((o) => { if (o.isBone && !bone[o.name]) bone[o.name] = o; });
  if (!GROUPES.every(([, b]) => bone[b])) return null;
  const owner = {}; for (const [n, , os] of GROUPES) for (const o of os) owner[o] = n;
  const pts = Object.fromEntries(GROUPES.map(([n]) => [n, []])), v = new THREE.Vector3();
  const inv = Object.fromEntries(GROUPES.map(([n, b]) => [n, bone[b].matrixWorld.clone().invert()]));
  model.traverse((m) => { if (!m.isSkinnedMesh) return; const g = m.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    for (let i = 0; i < g.attributes.position.count; i += 2) { let k = 0; for (let c = 1; c < 4; c++) if (sw.getComponent(i, c) > sw.getComponent(i, k)) k = c;
      const sg = owner[m.skeleton.bones[si.getComponent(i, k)]?.name]; if (!sg) continue;
      m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld).applyMatrix4(inv[sg]); pts[sg].push([v.x, v.y, v.z]); } });
  const dirLoc = (o, a, c) => { const A = W(bone[a]), C = W(bone[c]), e = o.matrixWorld.clone().invert().elements, d = sub(C, A);
    return nrm([e[0] * d[0] + e[4] * d[1] + e[8] * d[2], e[1] * d[0] + e[5] * d[1] + e[9] * d[2], e[2] * d[0] + e[6] * d[1] + e[10] * d[2]]); };
  const caps = [];
  for (const [n, b] of GROUPES) { const P = pts[n]; if (P.length < 8) continue;
    const c = [0, 1, 2].map((k) => P.reduce((s, p) => s + p[k], 0) / P.length), E = bone[b].matrixWorld.elements, ech = Math.hypot(E[0], E[1], E[2]);
    if (TORSE.has(n)) {
      const up = dirLoc(bone[b], 'Hips', 'Neck'), lat0 = n === 'poitrine' ? dirLoc(bone[b], 'LeftArm', 'RightArm') : dirLoc(bone[b], 'LeftUpLeg', 'RightUpLeg');
      const dp = nrm(cross(up, lat0)), la = cross(dp, up), co = (p, a) => dot(sub(p, c), a);
      const vv = P.map((p) => co(p, up)), l = P.map((p) => co(p, la)), d = P.map((p) => co(p, dp)), lc = (pq(l, 0.05) + pq(l, 0.95)) / 2, dc = (pq(d, 0.05) + pq(d, 0.95)) / 2;
      const r = pq(d.map((u) => Math.abs(u - dc)), 0.9), w = pq(l.map((u) => Math.abs(u - lc)), 0.9), v0 = pq(vv, 0.02) + r, v1 = pq(vv, 0.98) - r, off = Math.max(0, w - r);
      for (const o of off > 0 ? [-off, 0, off] : [0]) { const base = c.map((u, k) => u + la[k] * (lc + o) + dp[k] * dc);
        caps.push({ n, b: bone[b], a: base.map((u, k) => u + up[k] * Math.min(v0, v1)), z: base.map((u, k) => u + up[k] * Math.max(v0, v1)), r: r * ech }); }
      continue;
    }
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (const p of P) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += (p[i] - c[i]) * (p[j] - c[j]);
    let e = [1, 1, 1]; for (let it = 0; it < 60; it++) e = nrm([0, 1, 2].map((i) => C[i][0] * e[0] + C[i][1] * e[1] + C[i][2] * e[2]));
    const tt = P.map((p) => dot(sub(p, c), e)), t0 = pq(tt, 0.02), t1 = pq(tt, 0.98);
    const r = pq(P.map((p) => { const d = sub(p, c), t = dot(d, e); return Math.hypot(d[0] - e[0] * t, d[1] - e[1] * t, d[2] - e[2] * t); }), 0.9);
    caps.push({ n, b: bone[b], a: c.map((u, k) => u + e[k] * t0), z: c.map((u, k) => u + e[k] * t1), r: r * ech });
  }
  return { bone, caps };
}

/** Les points les plus proches de deux segments 3D (Ericson, Real-Time Collision Detection § 5.1.9) : { d, p (sur A), q (sur B) }. */
export function segSeg(p0, p1, q0, q1) {
  const d1 = sub(p1, p0), d2 = sub(q1, q0), r = sub(p0, q0), a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r); let s = 0, t = 0;
  if (a < 1e-9 && e < 1e-9) { s = 0; t = 0; }
  else if (a < 1e-9) t = Math.min(1, Math.max(0, f / e));
  else { const c = dot(d1, r); if (e < 1e-9) s = Math.min(1, Math.max(0, -c / a)); else {
    const bb = dot(d1, d2), den = a * e - bb * bb; s = den > 1e-9 ? Math.min(1, Math.max(0, (bb * f - c * e) / den)) : 0; t = (bb * s + f) / e;
    if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (bb - c) / a)); } } }
  const p = [p0[0] + d1[0] * s, p0[1] + d1[1] * s, p0[2] + d1[2] * s], q = [q0[0] + d2[0] * t, q0[1] + d2[1] * t, q0[2] + d2[2] * t];
  return { d: Math.hypot(...sub(p, q)), p, q };
}

const monde = (C) => C.caps.map((k) => ({ n: k.n, a: loc(k.b, k.a), z: loc(k.b, k.z), r: k.r }));
/** Le contact le plus profond des capsules `mes` (filtre) contre les capsules `ses` (filtre) : { pen, p (sur moi), n (normale sortante de l'autre vers moi) }. */
function plusProfond(A, B, mes, ses) {
  let best = null;
  for (const x of A) { if (!mes(x.n)) continue; for (const y of B) { if (!ses(y.n)) continue;
    // LA TÊTE GARDE SES DISTANCES (+0,10 m) : résolues au contact exact, les têtes finissaient joue contre joue pendant la vente (vu à la capture) ;
    // le duel se touche à l'épaule, au bras, à la hanche — pas à la tête
    const s = segSeg(x.a, x.z, y.a, y.z), pen = x.r + y.r + (x.n === 'tete' || y.n === 'tete' ? 0.1 : 0) - s.d;
    if (pen > 0 && (!best || pen > best.pen)) best = { pen, p: s.p, n: s.d > 1e-6 ? nrm(sub(s.p, s.q)) : null, q: s.q }; } }
  return best;
}
const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _ax = new THREE.Vector3();
/** Tourne l'os `b` d'un angle (rad) autour d'un axe MONDE, en gardant sa hiérarchie (L' = P⁻¹ · Q · P · L). */
export function tourneMonde(b, axe, angle) {
  if (!(Math.abs(angle) > 1e-5)) return;
  b.parent.getWorldQuaternion(_qp); _ax.set(axe[0], axe[1], axe[2]).normalize();
  _q.setFromAxisAngle(_ax, angle); b.quaternion.premultiply(_qp.clone().invert().multiply(_q).multiply(_qp)); b.updateMatrixWorld(true);
}
const lisse = (etat, cible, dt) => { const k = Math.hypot(...cible) >= Math.hypot(...etat) ? 1 : 1 - Math.exp(-dt / 0.2); for (let i = 0; i < etat.length; i++) etat[i] += (cible[i] - etat[i]) * k; };   // le contact s'impose tout de suite, il se relâche en 0,2 s

/** Une image : `joueurs` = [{ model, sim }] posés ; les corps adverses à moins de `portee` m se séparent au rendu. */
export function contactCorps(joueurs, dt, K = {}) {
  const portee = K.portee ?? 1.8, marge = K.marge ?? 0.01;
  for (const pl of joueurs) { if (pl._corps === undefined) pl._corps = capsulesDe(pl.model); pl._contact ??= { buste: [0, 0, 0], bras: { L: [0, 0, 0], R: [0, 0, 0] } }; pl.model.updateMatrixWorld(true); }
  const paires = [];
  for (let i = 0; i < joueurs.length; i++) for (let j = i + 1; j < joueurs.length; j++) {
    const a = joueurs[i], b = joueurs[j]; if (!a._corps || !b._corps || a.sim.team === b.sim.team) continue;
    const ha = W(a._corps.bone.Hips), hb = W(b._corps.bone.Hips); if (Math.hypot(ha[0] - hb[0], ha[2] - hb[2]) > portee) continue;
    paires.push([a, b]);
  }
  // 1) LE BUSTE : tête / poitrine / ventre de l'un dans le haut du corps de l'autre → chacun penche d'une demi-pénétration à l'opposé ;
  // 2) LES BRAS : un bras dans l'autre corps (tibias et pieds exceptés) tourne à l'épaule jusqu'à sa surface. Itéré (la main sortie, l'avant-bras
  //    peut rester dedans) sur la pose fraîche de l'image ; la correction tenue ne sert qu'au relâchement (τ 0,2 s).
  const tot = new Map(joueurs.map((pl) => [pl, { buste: [0, 0, 0], bras: { L: [0, 0, 0], R: [0, 0, 0] } }]));
  const add = (v, d) => { for (let i = 0; i < 3; i++) v[i] += d[i]; };
  for (let it = 0; it < 2; it++) {
    let rien = true;
    for (const [a, b] of paires) {
      const A = monde(a._corps), B = monde(b._corps), f = (n) => HAUT.has(n) || n === 'bassin' || n.startsWith('bras');
      for (const [pl, x] of [[a, plusProfond(A, B, (n) => HAUT.has(n), f)], [b, plusProfond(B, A, (n) => HAUT.has(n), f)]]) { if (!x || !x.n) continue;
        // l'écart du buste est BORNÉ (K.busteMax, 15°) : un joueur au contact s'écarte de 10-20°, il ne se plie pas — non borné, deux corps
        // enfoncés de 0,3 m pliaient le porteur de ~70° sur le côté (vu à la capture du crochet) ; le reste de la pénétration est accepté
        // …et le tronc déjà penché (l'accélération, le geste) ne l'est pas davantage au-delà de K.penteMax (40°) : les deux s'additionnaient
        const hh = W(pl._corps.bone.Hips), nk = W(pl._corps.bone.Neck), pente = Math.atan2(Math.hypot(nk[0] - hh[0], nk[2] - hh[2]), nk[1] - hh[1]);
        const T = tot.get(pl), deja = Math.hypot(...T.buste), reste = Math.min((K.busteMax ?? 15) * Math.PI / 180 - deja, (K.penteMax ?? 40) * Math.PI / 180 - pente); if (reste <= 1e-3) continue;
        const nh = nrm([x.n[0], 0, x.n[2]]), sp = W(pl._corps.bone.Spine), h = Math.max(0.2, x.p[1] - sp[1]), th = Math.min(reste, Math.atan((x.pen / 2 + marge) / h)), ax = cross([0, 1, 0], nh);
        tourneMonde(pl._corps.bone.Spine, ax, th); add(T.buste, ax.map((u) => u * th)); rien = false; }
    }
    if (rien) break;
  }
  for (let it = 0; it < 3; it++) {
    let rien = true;
    for (const [a, b] of paires) for (const [pl, o] of [[a, b], [b, a]]) for (const cote of ['L', 'R']) {
      const M = monde(pl._corps), S = monde(o._corps), x = plusProfond(M, S, (n) => BRAS[cote].includes(n), (n) => !JAMBES.test(n) || n.startsWith('cuisse')); if (!x || !x.n) continue;
      const ep = W(pl._corps.bone[cote === 'L' ? 'LeftArm' : 'RightArm']), r = sub(x.p, ep), lr = Math.hypot(...r), c = cross(r, x.n); if (lr < 0.05 || Math.hypot(...c) < 1e-6) continue;
      const ax = nrm(c), th = Math.atan((x.pen + marge) / lr);
      tourneMonde(pl._corps.bone[cote === 'L' ? 'LeftArm' : 'RightArm'], ax, th); add(tot.get(pl).bras[cote], ax.map((u) => u * th)); rien = false;
    }
    if (rien) break;
  }
  for (const pl of joueurs) { if (!pl._corps) continue; const C = pl._contact, T = tot.get(pl);
    const relache = (etat, t, os) => { if (Math.hypot(...t) > 1e-6) { for (let i = 0; i < 3; i++) etat[i] = t[i]; return; } lisse(etat, [0, 0, 0], dt); tourneMonde(os, etat, Math.hypot(...etat)); };
    relache(C.buste, T.buste, pl._corps.bone.Spine);
    for (const cote of ['L', 'R']) relache(C.bras[cote], T.bras[cote], pl._corps.bone[cote === 'L' ? 'LeftArm' : 'RightArm']);
  }
  // 3) LES JAMBES EN VOL : une cuisse, une jambe ou une chaussure EN VOL dans une jambe de l'autre tourne à la hanche (le pied passe à côté).
  //    Appliqué à l'image SUIVANTE par le contrôleur, AVANT le verrou d'appui (jambesContact) : le pied se pose là où il a été dévié. En
  //    appui la déviation est TENUE (le pied planté ne glisse pas) ; elle se relâche au vol suivant.
  const vise = new Map();
  for (const [a, b] of paires) {
    const A = monde(a._corps), B = monde(b._corps);
    for (const [pl, M, S] of [[a, A, B], [b, B, A]]) for (const cote of ['L', 'R']) {
      if (pl.ctrl?._gaitFeet?.[cote === 'L' ? 'Left' : 'Right']?.phase !== 'swing') continue;
      const x = plusProfond(M, S, (n) => JAMBES.test(n) && n.endsWith(cote), (n) => JAMBES.test(n)); if (!x || !x.n) continue;
      const hanche = W(pl._corps.bone[cote === 'L' ? 'LeftUpLeg' : 'RightUpLeg']), r = sub(x.p, hanche), lr = Math.hypot(...r); if (lr < 0.1) continue;
      // la pose mesurée PORTE déjà la déviation (appliquée par le contrôleur) : la cible est la déviation actuelle PLUS ce qui manque
      const ax = nrm(cross(r, x.n)), th = Math.atan((x.pen + marge) / lr), k = `${cote}`, m = vise.get(pl) ?? {}, J0 = pl.ctrl._contactJambes?.[cote] ?? [0, 0, 0];
      if (!m[k] || th > m[k].th) m[k] = { th, v: J0.map((u, i) => u + ax[i] * th) }; vise.set(pl, m);
    }
  }
  for (const pl of joueurs) { if (!pl.ctrl) continue; const J = pl.ctrl._contactJambes ??= { L: [0, 0, 0], R: [0, 0, 0] };
    for (const cote of ['L', 'R']) if (pl.ctrl._gaitFeet?.[cote === 'L' ? 'Left' : 'Right']?.phase === 'swing') { const c = vise.get(pl)?.[cote]; if (c) J[cote] = c.v; else lisse(J[cote], [0, 0, 0], dt); } }
}
/** (le contrôleur, après sa pose et avant le verrou d'appui de la scène) la déviation des jambes décidée à l'image précédente. */
export function jambesContact(ctrl) {
  const J = ctrl._contactJambes; if (!J) return;
  for (const [cote, os] of [['L', 'LeftUpLeg'], ['R', 'RightUpLeg']]) { const b = ctrl._gaitBones?.get(os), a = Math.hypot(...J[cote]); if (b && a > 1e-4) tourneMonde(b, J[cote], a); }
}
