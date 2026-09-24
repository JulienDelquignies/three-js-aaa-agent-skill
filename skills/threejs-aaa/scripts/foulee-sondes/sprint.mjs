// Le régime SPRINT (8,5 m/s ; 6,5 = son mélange avec run) : pas de coureurs mesurés à ces vitesses — l'objectif est d'être SOUS
// CONTRAT (avec et sans griffé, deux rigs, checkClip) et vraisemblable : genou à la pose ~15°, appui max ~50°, bassin à mi-appui
// ~−0,12 L, vol collé à la référence prolongée (volRef).
import { readFileSync, writeFileSync } from 'node:fs';
const S = decodeURI(new URL('../../../../', import.meta.url).pathname) + '', E = S + 'examples/showcase/src/engine/';
const THREE = await import(S + 'examples/showcase/node_modules/three/build/three.webgpu.js');
const MG = await import(E + 'motion-gait.js'); const { volRef } = await import(E + 'foulee-rbds.js');
const { SHANON_PROFILE } = await import(E + 'motion-profile-shanon.js');
const { adaptBip01 } = await import(E + 'rig-bip01.js'); const { rigBones } = await import(E + 'squad.js'); const { motionProfileOf } = await import(E + 'motion-cast.js');
const { checkClip, resolveTracks } = await import(E + 'animkit.js');
process.env.ENG = E; const { measure } = await import('./compare.mjs');
const rb = (file) => { const b = readFileSync(S + 'examples/showcase/public/rocketbox/' + file), len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len).toString()); const joints = new Set(j.skins[0].joints);
  const objs = j.nodes.map((n, i) => { const o = joints.has(i) ? new THREE.Bone() : new THREE.Object3D(); o.name = THREE.PropertyBinding.sanitizeNodeName(n.name || ''); if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale); return o; });
  j.nodes.forEach((n, i) => (n.children || []).forEach((c) => objs[i].add(objs[c]))); const root = new THREE.Group(); for (const i of j.scenes[0].nodes) root.add(objs[i]);
  adaptBip01(root, { faces: '+Z' }); const t = new THREE.Group(); root.rotation.y = Math.PI; t.add(root); t.updateMatrixWorld(true); return motionProfileOf({ bones: rigBones(t), scale: 1, spec: {} }); };
const RIGS = [['shanon', SHANON_PROFILE], ['foot-18', rb('foot-18.glb')]];
const G = MG.GAIT_REGIMES.sprint;
try { Object.assign(G, JSON.parse(readFileSync('sprint.json', 'utf8'))); } catch {}
const BOUNDS = { bias: [0, 0.45], pitchHS: [-15, 15], pitchTO: [20, 75], peel: [0.2, 0.8], drop: [0, 0.08], bobA: [0.005, 0.06] };
const KEYS = Object.keys(BOUNDS);
function cost(v, detail = false) {
  let c = 0; const rep = [];
  for (const [name, P] of RIGS) {
    const issues = [...MG.checkGaitGen(P, { vF: v, vR: 0, opts: { griffe: 1 } }).issues, ...MG.checkGaitGen(P, { vF: v, vR: 0 }).issues.map((x) => 'sans griffé : ' + x)];
    if (name === 'shanon') for (const o of [{ griffe: 1 }, {}]) { const cl = checkClip(resolveTracks(MG.gaitCycleSpec(P, { vF: v, vR: 0, opts: o }))); if (!cl.ok) issues.push(...cl.issues, ...cl.issues, ...cl.issues); }
    const g = measure(P, v, { griffe: 1 }), K = g.rows.map((x) => x.knee), T = g.rows.map((x) => x.thigh), to = g.rows.findIndex((x) => !x.stance), Lg = P.lengths.thigh + P.lengths.shank;
    const py = g.rows.map((x) => x.pelvisY), mid = (py[Math.round(to / 2)] - P.bones.Hips.bindP[1]) / Lg;
    let volErr = 0; for (let i = to; i <= 100; i++) { const w = (i - to) / (100 - to), r = volRef(v, w); volErr += (K[i] - r.genou) ** 2 + (T[i] - r.cuisse) ** 2; }
    volErr = Math.sqrt(volErr / (2 * (101 - to)));
    const kmax = Math.max(...K.slice(0, to));
    c += 25 * issues.length + Math.abs(K[0] - 15) * 0.5 + Math.abs(kmax - 50) * 0.5 + 150 * Math.abs(mid + 0.12) + volErr;
    if (detail) rep.push({ rig: name, genouPose: +K[0].toFixed(0), genouAppuiMax: +kmax.toFixed(0), bassinMi_L: +mid.toFixed(3), vol_rms: +volErr.toFixed(1), cuisse: [+Math.min(...T).toFixed(0), +Math.max(...T).toFixed(0)], contrats: issues.slice(0, 3) });
  }
  return detail ? rep : c;
}
const costS = () => cost(8) + cost(8.5) + 0.7 * cost(6.5);
let best = costS(); console.log('AVANT', best.toFixed(1));
const step = Object.fromEntries(KEYS.map((k) => [k, (BOUNDS[k][1] - BOUNDS[k][0]) / 6]));
for (let pass = 0; pass < 5; pass++) {
  for (const k of KEYS) for (const dir of [1, -1]) { let imp = true; while (imp) { imp = false; const old = G[k], nv = Math.min(BOUNDS[k][1], Math.max(BOUNDS[k][0], old + dir * step[k])); if (nv === old) break; G[k] = nv; const c = costS(); if (c < best - 1e-6) { best = c; imp = true; } else G[k] = old; } }
  for (const k of KEYS) step[k] /= 2.5; console.log(`passe ${pass + 1} : ${best.toFixed(1)}`);
}
const out = Object.fromEntries(KEYS.map((k) => [k, +G[k].toFixed(3)]));
writeFileSync('sprint.json', JSON.stringify(out)); console.log('sprint', JSON.stringify(out));
for (const v of [6.5, 8.5]) for (const r of cost(v, true)) console.log(v, JSON.stringify(r).slice(0, 330));
