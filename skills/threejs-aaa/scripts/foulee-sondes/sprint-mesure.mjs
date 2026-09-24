// LE RÉGIME SPRINT CALÉ SUR LE SPRINTER MESURÉ (Dorn 2012, JA1 — compare-sprint.mjs) : descente coordonnée des paramètres du régime sprint
// (ancré à 9,47 m/s, la vitesse mesurée) sur le cycle complet à 9,47 m/s ET à 6,97 m/s (mélange course/sprint) : genou et cuisse (rms),
// bassin à mi-appui, orteil à la pose et au décollage (en longueurs de jambe) — SOUS CONTRAT (checkGaitGen avec et sans griffé, deux rigs,
// checkClip sur shanon). Sortie : sprint-mesure.json et le rapport.
import { readFileSync, writeFileSync } from 'node:fs';
const S = decodeURI(new URL('../../../../', import.meta.url).pathname) + '', E = process.env.ENG || S + 'examples/showcase/src/engine/';
const THREE = await import(S + 'examples/showcase/node_modules/three/build/three.webgpu.js');
const MG = await import(E + 'motion-gait.js');
const { SHANON_PROFILE } = await import(E + 'motion-profile-shanon.js');
const { adaptBip01 } = await import(E + 'rig-bip01.js'); const { rigBones } = await import(E + 'squad.js'); const { motionProfileOf } = await import(E + 'motion-cast.js');
const { checkClip, resolveTracks } = await import(E + 'animkit.js');
process.env.ENG = E; const { compareSprint } = await import('./compare-sprint.mjs');
const rb = (file) => { const b = readFileSync(S + 'examples/showcase/public/rocketbox/' + file), len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len).toString()); const joints = new Set(j.skins[0].joints);
  const objs = j.nodes.map((n, i) => { const o = joints.has(i) ? new THREE.Bone() : new THREE.Object3D(); o.name = THREE.PropertyBinding.sanitizeNodeName(n.name || ''); if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale); return o; });
  j.nodes.forEach((n, i) => (n.children || []).forEach((c) => objs[i].add(objs[c]))); const root = new THREE.Group(); for (const i of j.scenes[0].nodes) root.add(objs[i]);
  adaptBip01(root, { faces: '+Z' }); const t = new THREE.Group(); root.rotation.y = Math.PI; t.add(root); t.updateMatrixWorld(true); return motionProfileOf({ bones: rigBones(t), scale: 1, spec: {} }); };
const RIGS = [['shanon', SHANON_PROFILE], ['foot-18', rb('foot-18.glb')]];
const G = MG.GAIT_REGIMES.sprint;
const BOUNDS = { bias: [0, 0.6], pitchHS: [-30, 20], pitchTO: [20, 100], peel: [0.2, 1], drop: [0, 0.08], bobA: [0.005, 0.06] };
const KEYS = Object.keys(BOUNDS);
function cost(key, detail = false) {
  let c = 0; const rep = [];
  for (const [name, P] of RIGS) {
    const v = compareSprint(P, key).v;
    const issues = [...MG.checkGaitGen(P, { vF: v, vR: 0, opts: { griffe: 1 } }).issues, ...MG.checkGaitGen(P, { vF: v, vR: 0 }).issues.map((x) => 'sans griffé : ' + x)];
    if (name === 'shanon') for (const o of [{ griffe: 1 }, {}]) { const cl = checkClip(resolveTracks(MG.gaitCycleSpec(P, { vF: v, vR: 0, opts: o }))); if (!cl.ok) issues.push(...cl.issues); }
    const r = compareSprint(P, key);
    const dA = (g) => Math.abs(r[g][0][0] - r[g][1][0]) + Math.abs(r[g][0][1] - r[g][1][1]);
    c += 25 * issues.length + r.genou_rms + r.cuisse_rms + 100 * (dA('chevillePose') + dA('chevilleMi') + dA('chevilleDecol')) + 100 * r.hanche[0].reduce((a, x, i) => a + Math.abs(x - r.hanche[1][i]), 0);
    if (detail) { const { K, T, rK, rT, ...x } = r; rep.push({ rig: name, ...x, contrats: issues.slice(0, 3) }); }
  }
  return detail ? rep : c;
}
// …et les contrats aux allures INTERMÉDIAIRES (6 et 8 m/s : le mélange course/sprint que l'ajustement ne voyait pas), deux rigs, checkClip à 8
function contrats() {
  let n = 0;
  for (const [name, P] of RIGS) for (const v of [6, 8]) {
    n += MG.checkGaitGen(P, { vF: v, vR: 0, opts: { griffe: 1 } }).issues.length + MG.checkGaitGen(P, { vF: v, vR: 0 }).issues.length;
    if (name === 'shanon' && v === 8) for (const o of [{ griffe: 1 }, {}]) { const cl = checkClip(resolveTracks(MG.gaitCycleSpec(P, { vF: v, vR: 0, opts: o }))); if (!cl.ok) n += cl.issues.length; }
  }
  return 25 * n;
}
const costS = () => cost('9.49') + cost('7.00') + contrats();
let best = costS(); console.log('AVANT', best.toFixed(1));
const step = Object.fromEntries(KEYS.map((k) => [k, (BOUNDS[k][1] - BOUNDS[k][0]) / 6]));
for (let pass = 0; pass < 5; pass++) {
  for (const k of KEYS) for (const dir of [1, -1]) { let imp = true; while (imp) { imp = false; const old = G[k], nv = Math.min(BOUNDS[k][1], Math.max(BOUNDS[k][0], old + dir * step[k])); if (nv === old) break; G[k] = nv; const c = costS(); if (c < best - 1e-6) { best = c; imp = true; } else G[k] = old; } }
  for (const k of KEYS) step[k] /= 2.5; console.log(`passe ${pass + 1} : ${best.toFixed(1)}`);
}
const out = Object.fromEntries(KEYS.map((k) => [k, +G[k].toFixed(3)]));
writeFileSync(new URL('./sprint-mesure.json', import.meta.url), JSON.stringify(out)); console.log('sprint', JSON.stringify(out), 'contrats 6/8 m/s :', contrats() / 25);
for (const k of ['7.00', '9.49']) for (const r of cost(k, true)) console.log(k, JSON.stringify(r).slice(0, 520));
