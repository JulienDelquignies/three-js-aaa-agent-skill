// LA MARCHE DU GÉNÉRATEUR CONTRE LES MARCHEURS MESURÉS (marche-wbds.json : WBDS, 24 jeunes adultes, marche-mesure.py) — en longueurs de
// jambe L : cadence, appui, genou (pose, max d'appui, décollage, max du vol) et cuisse (vol), pied à la pose / au décollage, hanche (pose,
// mi-appui, décollage, max, min), cheville par rapport à la hanche à la pose et au décollage, avance propre de la cheville.
import { readFileSync } from 'node:fs';
const E = process.env.ENG || new URL('../../../../examples/showcase/src/engine/', import.meta.url).href;
const W = JSON.parse(readFileSync(new URL('./marche-wbds.json', import.meta.url)));
const MG = await import(E + 'motion-gait.js'); const { SHANON_PROFILE } = await import(E + 'motion-profile-shanon.js');
export function marcheGen(P, v, opts = { griffe: 1 }) {
  const pr = MG.gaitPortrait(P, { vF: v, vR: 0, opts, n: 200 }), F = pr.frames, Lg = P.lengths.thigh + P.lengths.shank;
  const to = F.findIndex((f) => f.L.phase === 'swing'), mi = Math.round(to / 2), hip0 = P.bones.LeftUpLeg.bindP[1];
  const hh = F.map((f) => (f.L.hip[1] - hip0) / Lg), K = F.map((f) => f.L.kneeAngle), fwd = (i) => -(F[i].L.ankle[2] - F[i].L.hip[2]) / Lg;
  return { f: +(1 / pr.T).toFixed(3), s: +F[0].meta.s.toFixed(3), genou: [K[0], Math.max(...K.slice(0, to)), K[to - 1], Math.max(...K.slice(to))].map((x) => +x.toFixed(0)),
    cuisseVol: [Math.min(...F.slice(to).map((f) => f.L.hipFlex)), Math.max(...F.slice(to).map((f) => f.L.hipFlex))].map((x) => +x.toFixed(0)),
    pied: [F[0].feet.Left.pitch, F[to - 1].feet.Left.pitch].map((x) => +x.toFixed(0)), hanche: [hh[0], hh[mi], hh[to - 1], Math.max(...hh), Math.min(...hh)].map((x) => +x.toFixed(3)),
    pose: +fwd(0).toFixed(3), decol: +fwd(to - 1).toFixed(3), avance: +((F[to - 1].feet.Left.own ? -F[to - 1].feet.Left.own[2] : 0) / Lg).toFixed(3) };
}
export function marcheMes(k) {
  const r = W[k], to = Math.round(100 * r.duty), gc = r.genouCycle, hc = r.hancheCycle;
  return { f: r.f, s: r.duty, genou: [gc[0], Math.max(...gc.slice(0, to)), gc[to], Math.max(...r.volGenou)].map((x) => +x.toFixed(0)), cuisseVol: [Math.min(...r.volCuisse), Math.max(...r.volCuisse)].map((x) => +x.toFixed(0)),
    pied: [r.piedAppui[0], r.piedAppui[20]].map((x) => +x.toFixed(0)), hanche: [hc[0], hc[Math.round(to / 2)], hc[to], Math.max(...hc), Math.min(...hc)].map((x) => +x.toFixed(3)), pose: r.pose[0], decol: r.decol[0], avance: r.avance };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const k of Object.keys(W)) { const g = marcheGen(SHANON_PROFILE, W[k].v), m = marcheMes(k); console.log(`${W[k].v} m/s`); for (const x of Object.keys(m)) console.log(`  ${x.padEnd(10)} gén ${JSON.stringify(g[x]).padEnd(40)} mes ${JSON.stringify(m[x])}`); }
}
