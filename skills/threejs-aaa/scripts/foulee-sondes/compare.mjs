// LE GÉNÉRATEUR CONTRE LES COUREURS — Fukuchi 2017 (RBDS, moyennes de 62-78 jambes) à 2,5 / 3,5 / 4,5 m/s : appui, genou
// (sans ambiguïté de repère), cuisse GLOBALE (hanche Visual3D − inclinaison du bassin mesurée sur les marqueurs), cheville (forme :
// moyenne retirée — le zéro du pied diffère). Cycle sur 101 points, 0 = pose (les deux conventions).
import { readFileSync } from 'node:fs';
const E = process.env.ENG || '/home/delkit/DelkIT/skill-1v1/examples/showcase/src/engine/';
const R = JSON.parse(readFileSync(new URL('./rbds-moyennes.json', import.meta.url)));
const { gaitPortrait } = await import(E + 'motion-gait.js');
const { SHANON_PROFILE } = await import(E + 'motion-profile-shanon.js');
const D2R = Math.PI / 180, sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], nrm = (a) => Math.hypot(...a);
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (nrm(a) * nrm(b))))) / D2R;
export function measure(P, v, opts = {}) {
  const pr = gaitPortrait(P, { vF: v, vR: 0, n: 100, opts }), F = pr.frames;
  // cheville au repos : angle jambe/pied du bind
  const b = P.bones, a0 = ang(sub(b.LeftLeg.bindP, b.LeftFoot.bindP), sub(b.LeftToeBase.bindP, b.LeftFoot.bindP));
  const rows = F.map((f) => ({ knee: f.L.kneeAngle, thigh: f.L.hipFlex, ankle: a0 - ang(sub(f.L.knee, f.L.ankle), sub(f.L.toe, f.L.ankle)), stance: f.L.phase !== 'swing', toeAhead: -(f.L.toe[2] - f.pelvis[2]), pelvisY: f.pelvis[1] }));
  rows.push(rows[0]);                                                    // 101 points, 100 % = 0 %
  return { T: pr.T, rows, s: F[0].meta.s };
}
const rms = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0) / a.length);
const demean = (a) => { const m = a.reduce((s, x) => s + x, 0) / a.length; return a.map((x) => x - m); };
export function compare(P, v, opts = {}) {
  const key = { 2.5: '25', 3.5: '35', 4.5: '45' }[v], r = R[key], tilt = R._bassin[key];
  const g = measure(P, v, opts), K = g.rows.map((x) => x.knee), T = g.rows.map((x) => x.thigh), A = g.rows.map((x) => x.ankle);
  const rK = r.courbes.genou, rT = r.courbes.hanche.map((x) => x - tilt), rA = r.courbes.cheville;
  const toG = g.rows.findIndex((x) => !x.stance), toR = Math.round(100 * r.appui_force), Lg = P.lengths.thigh + P.lengths.shank;
  const midG = Math.round(toG / 2), py = g.rows.map((x) => x.pelvisY);
  const pk = (arr, i0, i1, f) => f(...arr.slice(i0, i1));
  return {
    v, appui: [+g.s.toFixed(3), r.appui_force],
    bassin_abs_L: [[0, midG, toG].map((i) => +((py[i] - P.bones.Hips.bindP[1]) / Lg).toFixed(4)).concat(+((Math.max(...py.slice(toG)) - P.bones.Hips.bindP[1]) / Lg).toFixed(4)), r.bassin_abs_L],
    geo: { mt1_pose_L: [+(g.rows[0].toeAhead / Lg).toFixed(3), r.mt1_pose_L], mt1_decol_L: [+(-g.rows[toG].toeAhead / Lg).toFixed(3), r.mt1_decol_L], bassin_V_L: [[+((py[0] - py[midG]) / Lg).toFixed(4), +((py[toG] - py[midG]) / Lg).toFixed(4)], r.bassin_V_L] },
    genou_rms: +rms(K, rK).toFixed(1), cuisse_rms: +rms(T, rT).toFixed(1), cheville_forme_rms: +rms(demean(A), demean(rA)).toFixed(1),
    genou: { pose: [+K[0].toFixed(0), +rK[0].toFixed(0)], appuiMax: [+pk(K, 0, toG, Math.max).toFixed(0), +pk(rK, 0, toR, Math.max).toFixed(0)], decollage: [+K[toG].toFixed(0), +rK[toR].toFixed(0)], volMax: [+pk(K, toG, 101, Math.max).toFixed(0), +pk(rK, toR, 101, Math.max).toFixed(0)] },
    cuisse: { pose: [+T[0].toFixed(0), +rT[0].toFixed(0)], min: [+Math.min(...T).toFixed(0), +Math.min(...rT).toFixed(0)], max: [+Math.max(...T).toFixed(0), +Math.max(...rT).toFixed(0)], decollage: [+T[toG].toFixed(0), +rT[toR].toFixed(0)] },
    cheville_amplitude: [+(Math.max(...A) - Math.min(...A)).toFixed(0), +(Math.max(...rA) - Math.min(...rA)).toFixed(0)],
  };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('[générateur, coureurs] — rms en degrés sur le cycle');
  for (const g of [1, 0]) for (const v of [2.5, 3.5, 4.5]) console.log(`griffé ${g}`, JSON.stringify(compare(SHANON_PROFILE, v, g ? { griffe: 1 } : {})));
}
