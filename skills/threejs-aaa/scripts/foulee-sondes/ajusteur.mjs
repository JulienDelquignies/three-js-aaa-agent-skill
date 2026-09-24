// L'AJUSTEUR DE LA FOULÉE : les paramètres des régimes jog (2,5 m/s) et run (4,5 m/s) calés sur les courbes moyennes des coureurs de
// Fukuchi 2017 (genou, cuisse globale, cheville), sous les contrats du générateur (checkGaitGen : appui immobile, portée, dégagement,
// genou ≤ 140°, cuisse [−30, 80]°, symétrie, pas = v·T/2 ; checkClip à 60 Hz sur shanon). Deux rigs à la fois : shanon (jambe 0,76 m)
// et foot-18 (Rocketbox, 0,80 m). Descente coordonnée bornée ; sortie : les valeurs et le rapport, validés à 3,5 m/s (interpolé).
import { readFileSync, writeFileSync } from 'node:fs';
const S = decodeURI(new URL('../../../../', import.meta.url).pathname) + '';
const E = S + 'examples/showcase/src/engine/';
const THREE = await import(S + 'examples/showcase/node_modules/three/build/three.webgpu.js');
const MG = await import(E + 'motion-gait.js');
const { SHANON_PROFILE } = await import(E + 'motion-profile-shanon.js');
const { adaptBip01 } = await import(E + 'rig-bip01.js');
const { rigBones } = await import(E + 'squad.js');
const { motionProfileOf } = await import(E + 'motion-cast.js');
const { checkClip, resolveTracks } = await import(E + 'animkit.js');
process.env.ENG = E; const { compare } = await import('./compare.mjs');
const rb = (file) => {
  const b = readFileSync(S + 'examples/showcase/public/rocketbox/' + file), len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len).toString());
  const joints = new Set(j.skins[0].joints);
  const objs = j.nodes.map((n, i) => { const o = joints.has(i) ? new THREE.Bone() : new THREE.Object3D(); o.name = THREE.PropertyBinding.sanitizeNodeName(n.name || ''); if (n.translation) o.position.fromArray(n.translation); if (n.rotation) o.quaternion.fromArray(n.rotation); if (n.scale) o.scale.fromArray(n.scale); return o; });
  j.nodes.forEach((n, i) => (n.children || []).forEach((c) => objs[i].add(objs[c])));
  const root = new THREE.Group(); for (const i of j.scenes[0].nodes) root.add(objs[i]);
  adaptBip01(root, { faces: '+Z' }); const t = new THREE.Group(); root.rotation.y = Math.PI; t.add(root); t.updateMatrixWorld(true);
  return motionProfileOf({ bones: rigBones(t), scale: 1, spec: {} });
};
const RIGS = [['shanon', SHANON_PROFILE], ['foot-18', rb('foot-18.glb')]];
const BOUNDS = { bias: [-0.05, 0.45], pitchHS: [-10, 25], pitchTO: [10, 75], peel: [0.15, 0.85], swingH: [0.06, 0.5], swingPeak: [0.18, 0.7], swingK: [0.7, 2.6], drop: [0, 0.08], bobA: [0.005, 0.06], pTilt: [0, 15], lean: [0, 15] };
const KEYS = Object.keys(BOUNDS).filter((k) => !/^swing/.test(k) && k !== 'pTilt' && k !== 'lean');   // pTilt MESURÉ, lean hors des courbes   // (vol articulaire : les paramètres du vol ne jouent plus en course)
const G = MG.GAIT_REGIMES;
function cost(regime, v, detail = false) {
  let c = 0; const rep = [];
  for (const [name, P] of RIGS) {
    const r = compare(P, v, { griffe: 1 });
    const chk = MG.checkGaitGen(P, { vF: v, vR: 0, opts: { griffe: 1 } }), chk0 = MG.checkGaitGen(P, { vF: v, vR: 0 });   // avec ET sans griffé (les autres scènes)
    chk.issues = chk.issues.concat(chk0.issues.map((x) => 'sans griffé : ' + x));
    let clip = { ok: true, issues: [] };
    if (name === 'shanon') clip = checkClip(resolveTracks(MG.gaitCycleSpec(P, { vF: v, vR: 0, opts: { griffe: 1 } })));
    const pen = 25 * chk.issues.length + 25 * (clip.ok ? 0 : clip.issues.length);
    const g = r.geo, geo = 150 * (Math.abs(g.mt1_pose_L[0] - g.mt1_pose_L[1]) + Math.abs(g.mt1_decol_L[0] - g.mt1_decol_L[1]) + Math.abs(g.bassin_V_L[0][0] - g.bassin_V_L[1][0]) + Math.abs(g.bassin_V_L[0][1] - g.bassin_V_L[1][1]))
      + 150 * r.bassin_abs_L[0].reduce((a, x, i) => a + Math.abs(x - r.bassin_abs_L[1][i]), 0);
    c += r.genou_rms + r.cuisse_rms + 0.5 * r.cheville_forme_rms + geo + pen;
    if (detail) rep.push({ rig: name, ...r, contrats: chk.issues.concat(clip.issues).slice(0, 3) });
  }
  return detail ? { c, rep } : c;
}
// jog se juge à 2,5 m/s et run à 4,5, les deux aussi à 3,5 (l'interpolation entre eux) — moitié de poids
const costR = (regime, v) => cost(regime, v) + 0.5 * cost(regime, 3.5);
function fit(regime, v, passes = 4) {
  const R = G[regime];
  let best = costR(regime, v);
  const step = Object.fromEntries(KEYS.map((k) => [k, (BOUNDS[k][1] - BOUNDS[k][0]) / 6]));
  for (let pass = 0; pass < passes; pass++) {
    for (const k of KEYS) {
      for (const dir of [1, -1]) {
        let improved = true;
        while (improved) {
          improved = false;
          const old = R[k], nv = Math.min(BOUNDS[k][1], Math.max(BOUNDS[k][0], old + dir * step[k]));
          if (nv === old) break;
          R[k] = nv; const c = costR(regime, v);
          if (c < best - 1e-6) { best = c; improved = true; } else R[k] = old;
        }
      }
    }
    for (const k of KEYS) step[k] /= 2.5;
    console.log(`  ${regime} passe ${pass + 1} : coût ${best.toFixed(2)}`);
  }
  return best;
}
// DÉPART : le calage précédent (ajuste.json) s'il existe
try { if (process.env.NEUF) throw 0; const prev = JSON.parse(readFileSync('ajuste.json', 'utf8')); for (const r of ['jog', 'run']) Object.assign(G[r], prev[r]); console.log('DEPART', JSON.stringify(prev.jog), JSON.stringify(prev.run)); } catch {}
const snap = (regime) => Object.fromEntries(KEYS.map((k) => [k, +G[regime][k].toFixed(3)]));
console.log('AVANT', JSON.stringify({ jog: cost('jog', 2.5), run: cost('run', 4.5) }));
for (const [regime, v] of [['jog', 2.5], ['run', 4.5], ['jog', 2.5], ['run', 4.5], ['jog', 2.5], ['run', 4.5]]) fit(regime, v, 3);
const out = { jog: snap('jog'), run: snap('run'), rapport: { 2.5: cost('jog', 2.5, true), 3.5: cost('jog', 3.5, true), 4.5: cost('run', 4.5, true) } };
writeFileSync('ajuste.json', JSON.stringify(out, null, 1));
console.log('jog', JSON.stringify(out.jog)); console.log('run', JSON.stringify(out.run));
for (const [v, r] of Object.entries(out.rapport)) for (const x of r.rep) console.log(`${v} m/s ${x.rig.padEnd(8)} genou ${x.genou_rms} cuisse ${x.cuisse_rms} cheville ${x.cheville_forme_rms} | géo ${JSON.stringify(x.geo)} bassin ${JSON.stringify(x.bassin_abs_L)} | genou ${JSON.stringify(x.genou)} cuisse ${JSON.stringify(x.cuisse)} | contrats ${x.contrats.length ? x.contrats.join(' ; ').slice(0, 140) : 'ok'}`);
