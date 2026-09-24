// L'APPUI DU GÉNÉRATEUR CONTRE LES MESURES (appui-rbds.json : RBDS 2,5-4,5 ; appui-dorn.json : le sprinter 5,19-9,47) — en longueurs de jambe
// L (cuisse + jambe du rig ; hanche → cheville debout chez les coureurs) : hanche à la pose / mi-appui / décollage et au sommet du vol, cheville
// (hauteur − debout) à la pose et au décollage, pied (°) à la pose et au décollage, cheville par rapport à la hanche (avant) à la pose et au
// décollage, genou (pose, max d'appui, décollage), avance propre de la cheville. Usage : node compare-appui.mjs [rig=shanon]
import { readFileSync } from 'node:fs';
const E = process.env.ENG || '/home/delkit/DelkIT/skill-1v1/examples/showcase/src/engine/';
const R = JSON.parse(readFileSync(new URL('./appui-rbds.json', import.meta.url))), Dn = JSON.parse(readFileSync(new URL('./appui-dorn.json', import.meta.url)));
const MG = await import(E + 'motion-gait.js'); const { SHANON_PROFILE } = await import(E + 'motion-profile-shanon.js');
export function appuiGen(P, v, opts = { griffe: 1 }) {
  const pr = MG.gaitPortrait(P, { vF: v, vR: 0, opts, n: 200 }), F = pr.frames, s = F[0].meta.s, Lg = P.lengths.thigh + P.lengths.shank;
  const to = F.findIndex((f) => f.L.phase === 'swing'), mi = Math.round(to / 2), hip0 = P.bones.LeftUpLeg.bindP[1], a0 = P.bones.LeftFoot.bindP[1];
  const hh = (i) => (F[i].L.hip[1] - hip0) / Lg, ah = (i) => (F[i].L.ankle[1] - a0) / Lg, fwd = (i) => -(F[i].L.ankle[2] - F[i].L.hip[2]) / Lg;
  let km = 0; for (let i = 0; i < to; i++) km = Math.max(km, F[i].L.kneeAngle);
  const own = (F[to - 1].feet.Left.own ? -F[to - 1].feet.Left.own[2] : 0) / Lg;
  let hmax = -9; for (let i = to; i < F.length / 2 + 0; i++) hmax = Math.max(hmax, hh(i));
  return { s: +s.toFixed(3), hanche: [hh(0), hh(mi), hh(to - 1), hmax].map((x) => +x.toFixed(3)), cheville: [ah(0), ah(to - 1)].map((x) => +x.toFixed(3)), pied: [F[0].feet.Left.pitch, F[to - 1].feet.Left.pitch].map((x) => +x.toFixed(0)),
    chevilleHanche: [fwd(0), fwd(to - 1)].map((x) => +x.toFixed(3)), genou: [F[0].L.kneeAngle, km, F[to - 1].L.kneeAngle].map((x) => +x.toFixed(0)), avance: +own.toFixed(3) };
}
export function appuiMes(v) {
  const k = { 2.5: '2.5', 3.5: '3.5', 4.5: '4.5', 5.19: '5.19', 6.97: '6.97', 9.47: '9.47' }[v], d = R[k] ?? Dn[k];
  return { s: +d.duty.toFixed(3), hanche: [d.hanche_appui[0], d.hanche_appui[10], d.hanche_appui[20], Math.max(...d.hanche_cycle.slice(Math.round(100 * d.duty), 50))].map((x) => +x.toFixed(3)),
    cheville: [d.cheville_appui[0], d.cheville_appui[20]].map((x) => +x.toFixed(3)), pied: [d.pied_appui[0], d.pied_appui[20]].map((x) => +x.toFixed(0)),
    chevilleHanche: [d.chevilleHanche[0][0], d.chevilleHanche[1][0]].map((x) => +x.toFixed(3)), avance: d.avance_appui ? +d.avance_appui[20].toFixed(3) : null };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const v of [2.5, 3.5, 4.5, 5.19, 6.97, 9.47]) { const g = appuiGen(SHANON_PROFILE, v), m = appuiMes(v);
    console.log(`${v} m/s`); for (const k of Object.keys(m)) console.log(`  ${k.padEnd(15)} gén ${JSON.stringify(g[k]).padEnd(34)} mes ${JSON.stringify(m[k])}`); console.log(`  genou           gén ${JSON.stringify(g.genou)}`); }
}
