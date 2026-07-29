import * as THREE from 'three/webgpu';
import { loft, checkMesh } from './meshkit.js';
import { fabricMaterial } from './fabric.js';

// bib — LA CHASUBLE. Le plus petit vêtement qui distingue deux équipes.
//
// Pourquoi ce module existe : le personnage porte un maillot MODÉLISÉ, très supérieur à un maillot
// généré — mais son maillot, sa peau et ses crampons partagent UN atlas et UN matériau. Recolorer le
// maillot par équipe teindrait donc aussi sa peau. Les deux issues étaient : régénérer une tenue
// complète (des tubes loftés, qui se lisent comme des tubes loftés), ou faire ce qu'on fait vraiment
// à l'entraînement — enfiler une chasuble par-dessus. Une seule couleur, sans manches, sans col :
// rien à rater, et c'est exactement ce qu'un rondo porte.
//
// Elle est SKINNÉE sur le même squelette (bind = maintenant, bindMatrix identité, mode 'attached'),
// donc elle suit le buste sans traitement particulier. La géométrie est en espace MONDE au moment du
// bind, ce qui est la convention de kit.js et outfit.js — s'en écarter ici obligerait à un deuxième
// chemin de skinning pour un seul vêtement.

const suffix = (n) => n.replace(/^mixamorig\d*/i, '');
const wpos = (b) => { const v = new THREE.Vector3(); b.getWorldPosition(v); return [v.x, v.y, v.z]; };
const SEG = 20;

/**
 * Un anneau horizontal autour d'un axe vertical, de rayon `r`, à la hauteur `y`.
 * Le −sin sur Z n'est pas décoratif : meshkit skinne les anneaux dans l'ordre donné et suppose la
 * convention de `lathe` (cos, y, −sin), qui monte les triangles vers l'EXTÉRIEUR quand les rangées
 * vont vers +Y. Un +sin retourne la maille entière : le volume signé devient négatif, checkMesh le
 * refuse, et à l'écran on voit l'intérieur du vêtement.
 */
function ring(cx, cz, y, rx, rz) {
  const pts = [];
  for (let i = 0; i < SEG; i++) {
    const a = (i / SEG) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, y, cz - Math.sin(a) * rz]);
  }
  return pts;
}

/**
 * Build a training bib over whatever the character is already wearing.
 * @param model  the rig (already scaled and placed — the geometry is world-space at bind)
 * @param color  the team colour
 */
export function buildBib(model, { color = 0xffb200, roughness = 0.85 } = {}) {
  model.updateMatrixWorld(true);
  const by = new Map();
  model.traverse((o) => { if (o.isBone) { const s = suffix(o.name); if (!by.has(s)) by.set(s, o); } });
  const need = ['Hips', 'Spine1', 'Spine2', 'Neck', 'LeftArm', 'RightArm'];
  for (const n of need) if (!by.has(n)) return { group: null, mesh: null, check: { ok: false, issues: [`os manquant: ${n}`] } };
  const P = Object.fromEntries(need.map((n) => [n, wpos(by.get(n))]));

  const cx = (P.LeftArm[0] + P.RightArm[0]) / 2, cz = P.Hips[2];
  const half = Math.abs(P.LeftArm[0] - P.RightArm[0]) / 2;
  const neckY = P.Neck[1], hipsY = P.Hips[1];
  // Sizes are taken from the RIG, never from constants: a bib cut for one character floats on the next.
  // Wider than the shoulders by a clear margin — a bib is loose, and a tight one reads as body paint.
  const rx = half * 0.92 + 0.055, rz = half * 0.62 + 0.05;
  const top = neckY - 0.055, bottom = hipsY + 0.02;

  const rings = [
    ring(cx, cz, bottom, rx * 1.02, rz * 1.05),          // hem, slightly flared
    ring(cx, cz, bottom + (top - bottom) * 0.35, rx, rz),
    ring(cx, cz, bottom + (top - bottom) * 0.75, rx * 0.99, rz * 0.98),
    ring(cx, cz, top, rx * 0.80, rz * 0.86),             // shoulders, narrowing to the neck
  ];
  const geoData = loft(rings, { caps: true });
  const contract = checkMesh(geoData);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(geoData.positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(geoData.normals, 3));
  geo.setIndex(new THREE.BufferAttribute(geoData.indices, 1));

  // SKINNING BY PROXIMITY to the three torso bones. A bib only ever covers the trunk, so there is no
  // limb to get wrong: weight each vertex to the nearest of Spine1 / Spine2 / Neck and normalise.
  const bones = [];
  model.traverse((o) => { if (o.isBone) bones.push(o); });
  const idxOf = (n) => bones.indexOf(by.get(n));
  const anchors = [['Spine1', idxOf('Spine1')], ['Spine2', idxOf('Spine2')], ['Neck', idxOf('Neck')]];
  const n = geoData.positions.length / 3;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const y = geoData.positions[i * 3 + 1];
    let w = anchors.map(([name, id]) => [id, 1 / (0.06 + Math.abs(y - P[name][1]))]);
    w.sort((a, b) => b[1] - a[1]);
    w = w.slice(0, 3);
    const sum = w.reduce((a, b) => a + b[1], 0) || 1;
    for (let k = 0; k < 3; k++) { si[i * 4 + k] = w[k][0]; sw[i * 4 + k] = w[k][1] / sum; }
  }
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));

  const mesh = new THREE.SkinnedMesh(geo, fabricMaterial({ kind: 'knit', tint: color, roughness }));
  mesh.name = 'chasuble';
  mesh.castShadow = true; mesh.frustumCulled = false;      // world-space bind: the bounding sphere lies
  const skeleton = new THREE.Skeleton(bones);              // bind = NOW, on the pose as it stands
  mesh.bind(skeleton, new THREE.Matrix4());
  mesh.bindMode = 'attached';

  const group = new THREE.Group(); group.name = 'bib';
  group.add(mesh);
  return { group, mesh, contract, measures: { top, bottom, rx, rz, neckY, hipsY }, check: checkBib(mesh, model, { top, bottom, neckY, hipsY }) };
}

/**
 * Contract: it is a bib and not something else. Every clause is a way it can silently come out wrong
 * on a rig it was not measured on.
 */
export function checkBib(mesh, model, m) {
  const issues = [];
  if (!mesh) return { ok: false, issues: ['aucune chasuble construite'] };
  const pos = mesh.geometry.attributes.position;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < lo) lo = y; if (y > hi) hi = y; }
  // a bib stops at the waist and at the shoulders: longer is a shirt, shorter is a crop top
  if (lo < m.hipsY - 0.12) issues.push(`ourlet à ${lo.toFixed(2)} — trop long pour une chasuble (hanches ${m.hipsY.toFixed(2)})`);
  if (hi > m.neckY + 0.06) issues.push(`monte à ${hi.toFixed(2)} — au-dessus du cou (${m.neckY.toFixed(2)})`);
  if (hi < m.neckY - 0.25) issues.push(`s'arrête à ${hi.toFixed(2)} — ne couvre pas la poitrine`);
  const sw = mesh.geometry.attributes.skinWeight;
  for (let i = 0; i < sw.count; i++) {
    const s = sw.getX(i) + sw.getY(i) + sw.getZ(i) + sw.getW(i);
    if (Math.abs(s - 1) > 0.02) { issues.push(`poids non normalisés (v${i}: ${s.toFixed(3)})`); break; }
  }
  let nBones = 0; model.traverse((o) => { if (o.isBone) nBones++; });
  const si = mesh.geometry.attributes.skinIndex;
  for (let i = 0; i < si.count * 4; i++) {
    const v = si.array[i];
    if (v < 0 || v >= nBones) { issues.push(`index d'os invalide (${v})`); break; }
  }
  // ENDROIT/ENVERS. Un vêtement retourné se voit à peine de face — les triangles sont là, la couleur
  // est là — mais on regarde l'intérieur de la maille : l'éclairage s'inverse et le tissu s'assombrit
  // au lieu d'accrocher la lumière. Le volume signé le dit sans ambiguïté : positif = normales
  // sortantes. (C'est la clause qui a attrapé un `+sin` au lieu d'un `−sin` dans un anneau.)
  const idx = mesh.geometry.index;
  if (idx) {
    let vol = 0;
    for (let t = 0; t < idx.count; t += 3) {
      const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
      vol += (pos.getX(a) * (pos.getY(b) * pos.getZ(c) - pos.getZ(b) * pos.getY(c))
            - pos.getY(a) * (pos.getX(b) * pos.getZ(c) - pos.getZ(b) * pos.getX(c))
            + pos.getZ(a) * (pos.getX(b) * pos.getY(c) - pos.getY(b) * pos.getX(c))) / 6;
    }
    if (vol <= 0) issues.push(`maille à l'envers (volume signé ${vol.toFixed(4)} ≤ 0)`);
  }
  return { ok: issues.length === 0, issues };
}
