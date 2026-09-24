// LE GÉNÉRATEUR CONTRE LE SPRINTER MESURÉ — Dorn 2012 (SimTK runningspeeds, MIT ; sujet JA1, dorn-sprint.json par sprint-dorn.py) à
// 5,19 / 6,97 / 9,47 m/s : cycle complet (0 = pose), genou et cuisse globale (rms), appui, bassin à mi-appui, géométrie de la pose et du
// décollage — longueurs rapportées à la jambe (hanche-cheville : 0,925 m chez JA1, cuisse + jambe du rig).
import { readFileSync } from 'node:fs';
const E = process.env.ENG || decodeURI(new URL('../../../../', import.meta.url).pathname) + 'examples/showcase/src/engine/';
const D = JSON.parse(readFileSync(new URL('./dorn-sprint.json', import.meta.url)));
process.env.ENG = E; const { measure } = await import('./compare.mjs');
const { SHANON_PROFILE } = await import(E + 'motion-profile-shanon.js');
const mean = (cs, k) => cs[0][k].map((_, i) => cs.reduce((a, c) => a + c[k][i], 0) / cs.length);
const avg = (cs, k) => cs.reduce((a, c) => a + c[k], 0) / cs.length;
const rms = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0) / a.length);
// la géométrie de l'appui : cheville par rapport à la hanche [avant, dessous] et hanche par rapport à la station debout, en longueurs de jambe
const { gaitPortrait } = await import(E + 'motion-gait.js');
function geoSprint(P, v, opts, c, Ld) {
  const pr = gaitPortrait(P, { vF: v, vR: 0, opts, n: 100 }), F = pr.frames, Lg = P.lengths.thigh + P.lengths.shank, to = F.findIndex((x) => x.L.phase === 'swing'), mi = Math.round(to / 2);
  const hipL = (f) => f.L.hip, ank = (i) => [+(-(F[i].L.ankle[2] - hipL(F[i])[2]) / Lg).toFixed(3), +((hipL(F[i])[1] - F[i].L.ankle[1]) / Lg).toFixed(3)];
  const hip0 = P.bones.LeftUpLeg.bindP[1], hh = (i) => +((hipL(F[i])[1] - hip0) / Lg).toFixed(3);
  const m = (k) => c.reduce((a, x) => a + x[k][0], 0) / c.length, m1 = (k) => c.reduce((a, x) => a + x[k][1], 0) / c.length, mh = (k) => +(c.reduce((a, x) => a + x[k], 0) / c.length / 100 / Ld).toFixed(3);
  return { chevillePose: [ank(0), [+m('chevillePose').toFixed(3), +m1('chevillePose').toFixed(3)]], chevilleMi: [ank(mi), [+m('chevilleMi').toFixed(3), +m1('chevilleMi').toFixed(3)]], chevilleDecol: [ank(to), [+m('chevilleDecol').toFixed(3), +m1('chevilleDecol').toFixed(3)]],
    hanche: [[hh(0), hh(mi), hh(to)], [mh('hanchePose_cm'), mh('hancheMiAppui_cm'), mh('hancheDecol_cm')]] };
}
export const SPRINT_KEYS = ['5.20', '7.00', '9.49'];
export function compareSprint(P, key, opts = { griffe: 1 }) {
  const d = D.vitesses[key], c = d.cycles, v = d.v, Ld = D.jambe_m, Lg = P.lengths.thigh + P.lengths.shank;
  const g = measure(P, v, opts), K = g.rows.map((x) => x.knee), T = g.rows.map((x) => x.thigh), to = g.rows.findIndex((x) => !x.stance);
  const rK = mean(c, 'cycleGenou'), rT = mean(c, 'cycleCuisse'), toR = Math.round(100 * avg(c, 'duty'));
  const py = g.rows.map((x) => x.pelvisY), mid = (py[Math.round(to / 2)] - P.bones.Hips.bindP[1]) / Lg;
  const pk = (a, i0, i1, f) => f(...a.slice(i0, i1));
  return { v, appui: [+g.s.toFixed(3), +avg(c, 'duty').toFixed(3)], genou_rms: +rms(K, rK).toFixed(1), cuisse_rms: +rms(T, rT).toFixed(1),
    genou: { pose: [+K[0].toFixed(0), +rK[0].toFixed(0)], appuiMax: [+pk(K, 0, to, Math.max).toFixed(0), +pk(rK, 0, toR, Math.max).toFixed(0)], decollage: [+K[to].toFixed(0), +rK[toR].toFixed(0)], volMax: [+pk(K, to, 101, Math.max).toFixed(0), +pk(rK, toR, 101, Math.max).toFixed(0)] },
    cuisse: { pose: [+T[0].toFixed(0), +rT[0].toFixed(0)], decollage: [+T[to].toFixed(0), +rT[toR].toFixed(0)], min: [+Math.min(...T).toFixed(0), +Math.min(...rT).toFixed(0)], max: [+Math.max(...T).toFixed(0), +Math.max(...rT).toFixed(0)] },
    bassinMi_L: [+mid.toFixed(3), +(avg(c, 'hancheMiAppui_cm') / 100 / Ld).toFixed(3)],
    orteilPose_L: [+(g.rows[0].toeAhead / Lg).toFixed(3), +(avg(c, 'orteilDevantHanchePose_cm') / 100 / Ld).toFixed(3)],
    orteilDecol_L: [+(-g.rows[to].toeAhead / Lg).toFixed(3), +(-avg(c, 'orteilDerriereHanche_cm') / 100 / Ld).toFixed(3)],
    ...geoSprint(P, v, opts, c, Ld), K, T, rK, rT };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('[générateur, sprinter JA1]');
  for (const k of SPRINT_KEYS) { const { K, T, rK, rT, ...r } = compareSprint(SHANON_PROFILE, k); console.log(JSON.stringify(r)); }
}
