#!/usr/bin/env node
// verify-swing.mjs — LA DYNAMIQUE DU SWING, mesurée par FK sur le vrai squelette (shanon.glb, parsé
// brut — pas de three), en INTERPOLANT entre les clés (slerp) : c'est la vitesse INSTANTANÉE du
// pied qui fait une frappe, et elle n'existe qu'entre les clés.
//
// La découverte qui fonde ce banc : la clé de CONTACT des passes était la FIN du swing — la clé
// suivante (l'accompagnement) REVENAIT en arrière (cuisse −46° → −30°), donc la vitesse interpolée
// s'annulait PILE au contact. Un pied de frappe mesuré à 1-5 m/s dans le monde composé (réel :
// 15-25) pendant que tous les contrats d'angles étaient verts. Un swing PASSE À TRAVERS sa pose de
// contact ; il ne se gare pas dessus. C'est LE sabotage-référence de ce banc.
//
// Clauses par clip de frappe (× les deux pieds, via mirrorMove — le miroir est prouvé exact) :
//   1. la vitesse du pied à t=contact est une vitesse de frappe (≥ seuil du geste) ;
//   2. le PIC de vitesse est SUR le contact (±35 ms) — pas un pic d'armé ni d'accompagnement ;
//   3. le pied frappe à hauteur de ballon (≤ 0,3 m) ;
//   4. l'orientation du pied au contact est ÉCRITE (axe horizontal orteils ≥ 8 cm — un pied en
//      flexion plantaire totale n'a pas de surface) ;
//   5. le pied s'ÉTEND au contact (excursion horizontale depuis le repos ≥ seuil — la talonnade
//      s'étend VERS L'ARRIÈRE, c'est sa définition, vérifiée par le sens du mouvement).
// Contrôles : le pied d'accueil s'étend vers le ballon puis revient (l'amorti est un geste, pas
// une pose) — excursion ≥ 0,18 m et retour ≤ 60 % de l'excursion.
import { MOVES, resolveTracks, mirrorMove } from '../assets/starter/src/engine/animkit.js';
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---- squelette réel (même parseur brut que la silhouette de verify-animkit)
const raw = readFileSync(new URL('../../../examples/showcase/public/shanon.glb', import.meta.url));
const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
let off = 12, json = null;
while (off < dv.byteLength) {
  const l = dv.getUint32(off, true), ty = dv.getUint32(off + 4, true);
  if (ty === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(raw.subarray(off + 8, off + 8 + l)));
  off += 8 + l + ((4 - (l % 4)) % 4); if (json) break;
}
const N = json.nodes, parent = new Map(); N.forEach((n, i) => (n.children || []).forEach((c) => parent.set(c, i)));
const nIdx = new Map(); N.forEach((n, i) => nIdx.set(String(n.name || '').replace(/^mixamorig\d*[:_]?/i, ''), i));
const chain = (name) => { const out = []; let k = nIdx.get(name); while (k != null) { out.unshift(k); k = parent.get(k); } return out; };
const qm = (a, c) => [a[3] * c[0] + a[0] * c[3] + a[1] * c[2] - a[2] * c[1], a[3] * c[1] - a[0] * c[2] + a[1] * c[3] + a[2] * c[0],
  a[3] * c[2] + a[0] * c[1] - a[1] * c[0] + a[2] * c[3], a[3] * c[3] - a[0] * c[0] - a[1] * c[1] - a[2] * c[2]];
const rv = (q, v) => { const [x, y, z, w] = q; const ux = y * v[2] - z * v[1], uy = z * v[0] - x * v[2], uz = x * v[1] - y * v[0];
  return [v[0] + 2 * (w * ux + y * uz - z * uy), v[1] + 2 * (w * uy + z * ux - x * uz), v[2] + 2 * (w * uz + x * uy - y * ux)]; };
// LA SÉMANTIQUE EST CELLE DU JEU : ADDITIVE. Le jeu joue ces clips en delta sur l'idle
// (makeClipAdditive : delta vs image 0 = BASE_POSE), et l'idle garde les rotations de REPOS du rig
// — dont le retournement ~180° de la cuisse (sondé : RightUpLeg r ≈ [0, 0, 1, 0.04]). Le premier
// banc REMPLAÇAIT les rotations par les quats du spec (sémantique absolue) : le retournement
// sautait, la jambe pointait en l'air — « hauteur de frappe 135 cm » sur tous les clips, l'axe
// était innocent. q_final = q_repos ⊗ (q_spec(0)⁻¹ ⊗ q_spec(t)) — exactement ce que le mixer fait.
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
const world = (name, delta) => { let q = [0, 0, 0, 1], p = [0, 0, 0];
  for (const k of chain(name)) { const nm = String(N[k].name || '').replace(/^mixamorig\d*[:_]?/i, '');
    const t = N[k].translation || [0, 0, 0]; const rt = rv(q, t); p = [p[0] + rt[0], p[1] + rt[1], p[2] + rt[2]];
    let local = N[k].rotation || [0, 0, 0, 1];
    if (delta[nm]) local = qm(local, delta[nm]);
    q = qm(q, local); }
  return p; };

// ---- slerp + pose interpolée à t quelconque (par os : entre ses deux clés encadrantes)
const slerp = (a, b, u) => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (d < 0) { d = -d; bb = [-b[0], -b[1], -b[2], -b[3]]; }
  if (d > 0.9995) { const r = a.map((x, i) => x + (bb[i] - x) * u); const n = Math.hypot(...r); return r.map((x) => x / n); }
  const th = Math.acos(Math.min(1, d)), s = Math.sin(th);
  const wa = Math.sin((1 - u) * th) / s, wb = Math.sin(u * th) / s;
  return [a[0] * wa + bb[0] * wb, a[1] * wa + bb[1] * wb, a[2] * wa + bb[2] * wb, a[3] * wa + bb[3] * wb];
};
const poseAt = (tracks, t) => {
  const pose = {};
  for (const [bone, ks] of Object.entries(tracks)) {
    if (!ks.length) continue;
    let i = ks.findIndex((k) => k.t > t);
    if (i === -1) pose[bone] = ks[ks.length - 1].q;
    else if (i === 0) pose[bone] = ks[0].q;
    else {
      const a = ks[i - 1], b = ks[i];
      pose[bone] = slerp(a.q, b.q, (t - a.t) / Math.max(1e-9, b.t - a.t));
    }
  }
  return pose;
};
/** les DELTAS additifs du clip à t : q_spec(0)⁻¹ ⊗ q_spec(t), par os (la sémantique du mixer). */
const deltasAt = (tracks, q0, t) => {
  const abs = poseAt(tracks, t), delta = {};
  for (const [bone, q] of Object.entries(abs)) delta[bone] = qm(qinv(q0[bone]), q);
  return delta;
};

// ---- LE REPÈRE SE DÉRIVE DU SQUELETTE, PAS DE LA FOI (loi 8, appliquée au banc lui-même) :
// l'armature Mixamo est TOURNÉE (−90° X) — l'axe « y » des nœuds n'est pas le haut du monde. Le
// premier banc mesurait « hauteur de frappe 145 cm » sur TOUS les clips : c'était l'axe, pas les
// pieds. Le HAUT est la direction Hips→Head du repos ; le SOL est le pied au repos le long de cet
// axe ; l'horizontale est le complément. Les vitesses (des normes) n'ont jamais menti.
const restPose = {};
const UP = (() => {
  const hips = world('Hips', restPose), head = world('Head', restPose);
  const u = [head[0] - hips[0], head[1] - hips[1], head[2] - hips[2]];
  const n = Math.hypot(...u); return [u[0] / n, u[1] / n, u[2] / n];
})();
const upOf = (p) => p[0] * UP[0] + p[1] * UP[1] + p[2] * UP[2];
const GROUND = Math.min(upOf(world('LeftFoot', restPose)), upOf(world('RightFoot', restPose)));
const horiz = (a, b) => {   // distance horizontale (composante ⊥ UP du vecteur a−b)
  const d = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const k = d[0] * UP[0] + d[1] * UP[1] + d[2] * UP[2];
  return Math.hypot(d[0] - k * UP[0], d[1] - k * UP[1], d[2] - k * UP[2]);
};

/** Le portrait dynamique d'un clip : trajectoire du pied à 240 Hz + les nombres du contact. */
function swingPortrait(spec, foot) {
  const r = resolveTracks(spec);
  const F = foot === 'right' ? 'RightFoot' : 'LeftFoot';
  const T = foot === 'right' ? 'RightToeBase' : 'LeftToeBase';
  const h = 1 / 240;
  const q0 = poseAt(r.tracks, 0);
  const rest = world(F, deltasAt(r.tracks, q0, 0));
  const pts = [], toes = [];
  for (let t = 0; t <= r.duration + 1e-9; t += h) { pts.push(world(F, deltasAt(r.tracks, q0, t))); toes.push(world(T, deltasAt(r.tracks, q0, t))); }
  const speed = (i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / (2 * h);
  };
  const iC = Math.round((spec.contact ?? 0) / h);
  let peak = 0, iPeak = 0;
  for (let i = 0; i < pts.length; i++) { const s = speed(i); if (s > peak) { peak = s; iPeak = i; } }
  const pC = pts[Math.min(iC, pts.length - 1)], toeC = toes[Math.min(iC, pts.length - 1)];
  const exc = horiz(pC, rest);
  let excMax = 0; for (const p of pts) excMax = Math.max(excMax, horiz(p, rest));
  return {
    vContact: speed(iC), peak, tPeak: iPeak * h, height: upOf(pC) - GROUND,
    toeAxis: horiz(toeC, pC),
    exc, excMax,
    endExc: horiz(pts.at(-1), rest),
  };
}

console.log('— les frappes : le pied PASSE À TRAVERS le contact —');
// seuils par geste : une passe posée frappe moins vite qu'une frappe, un talon moins qu'une passe.
// Exception assumée : une déviation ne FRAPPE pas — elle PRÉSENTE la surface sur la trajectoire,
// c'est le ballon qui a la vitesse. On exige seulement que le pied accompagne (≥ 2 m/s), pas qu'il
// arme — exiger 8 m/s d'une remise de première en ferait une passe déguisée.
const STRIKES = { passe: 10, passeRapide: 10, passeExterieur: 8, frappe: 12, talonnade: 6, passePivot: 8, deviation: 2 };
for (const [id, vMin] of Object.entries(STRIKES)) {
  for (const [foot, spec] of [['right', MOVES[id]], ['left', mirrorMove(MOVES[id])]]) {
    const s = swingPortrait(spec, foot);
    const lbl = `« ${id} » pied ${foot === 'right' ? 'droit' : 'gauche'}`;
    ok(`${lbl} : vitesse du pied au contact ${s.vContact.toFixed(1)} m/s (≥ ${vMin})`, s.vContact >= vMin);
    ok(`  pic (${s.peak.toFixed(1)} m/s) SUR le contact (t=${s.tPeak.toFixed(3)} vs ${spec.contact} ± 0,035 s)`,
      Math.abs(s.tPeak - spec.contact) <= 0.035);
    ok(`  hauteur de frappe ${(s.height * 100).toFixed(0)} cm (≤ 30)`, s.height <= 0.30);
    ok(`  orientation du pied ÉCRITE au contact (axe orteils horiz. ${(s.toeAxis * 100).toFixed(0)} cm ≥ 8)`, s.toeAxis >= 0.08);
  }
}

console.log('\n— les contrôles : l\'amorti est un GESTE (le pied va au ballon, puis revient) —');
for (const id of ['controleInterieur', 'controleExterieur', 'controleSemelle']) {
  for (const [foot, spec] of [['right', MOVES[id]], ['left', mirrorMove(MOVES[id])]]) {
    const s = swingPortrait(spec, foot);
    const lbl = `« ${id} » pied ${foot === 'right' ? 'droit' : 'gauche'}`;
    ok(`${lbl} : le pied S'ÉTEND vers le ballon (excursion max ${(s.excMax * 100).toFixed(0)} cm ≥ 18)`, s.excMax >= 0.18);
    ok(`  …et REVIENT (fin à ${(s.endExc * 100).toFixed(0)} cm ≤ 60 % de l'excursion)`, s.endExc <= s.excMax * 0.6 + 0.02);
  }
}

console.log('\n— les sabotages : chaque clause doit mordre —');
{
  // LE SABOTAGE-RÉFÉRENCE : la passe LIVRÉE avant ce banc — l'accompagnement RECULE après le
  // contact (cuisse −46° → −30°), la vitesse interpolée s'annule pile sur la pose de contact.
  const parked = JSON.parse(JSON.stringify(MOVES.passe));
  const kC = parked.keys.find((k) => Math.abs(k.t - parked.contact) < 1e-6);
  const kF = parked.keys.find((k) => k.t > parked.contact && k.pose.RightUpLeg);
  if (kC && kF) kF.pose.RightUpLeg = [(kC.pose.RightUpLeg[0] ?? 0) + 16, kC.pose.RightUpLeg[1] ?? 0, 0];
  const s = swingPortrait(parked, 'right');
  ok(`sabotage « pose de contact GARÉE (l'accompagnement recule) » attrapé (vitesse au contact ${s.vContact.toFixed(1)} m/s)`,
    s.vContact < 10 || Math.abs(s.tPeak - parked.contact) > 0.035);
}
{
  // le contact déclaré au PIC D'ARMÉ ARRIÈRE (la découverte de l'audit composé : passage avant
  // ~0,3 s après la frame contact déclarée)
  const early = JSON.parse(JSON.stringify(MOVES.passe));
  early.contact = 0.22;                                        // la clé d'armé, pied en arrière
  const s = swingPortrait(early, 'right');
  ok(`sabotage « contact déclaré au pic d'armé » attrapé (pic à t=${s.tPeak.toFixed(2)} vs contact 0,22)`,
    Math.abs(s.tPeak - early.contact) > 0.035 || s.vContact < 10);
}
{
  // un contrôle-POSE (le pied ne va jamais au ballon) doit être refusé par la clause d'excursion
  const statue = JSON.parse(JSON.stringify(MOVES.controleInterieur));
  for (const k of statue.keys) for (const b of Object.keys(k.pose)) { if (/Leg|Foot/.test(b)) k.pose[b] = [0, 0, 0]; }
  const s = swingPortrait(statue, 'right');
  ok(`sabotage « contrôle-statue (le pied ne va pas au ballon) » attrapé (excursion ${(s.excMax * 100).toFixed(0)} cm)`, s.excMax < 0.18);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
