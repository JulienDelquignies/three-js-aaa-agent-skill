// À RECULONS, LE GÉNÉRATEUR CONTRE LES MESURES (en longueurs de jambe L) — la marche arrière contre les marcheurs de Scherpereel 2023
// (recul-scherpereel.json, recul-mesure.py), la course arrière contre ses ancres publiées (recul-vers-moteur.py) : Bates 1986 à 2,7 m/s (genou
// 40° à la pose tenu jusqu'à mi-appui, 2° au décollage), Arata 1999 à 5,1 m/s (hanche → orteil 26 % de la jambe derrière à la pose, 46 % devant
// au décollage ; genou en vol ~85°), Cavagna 2012 (rebond du centre de masse 8,0 / 7,2 / 6,0 cm à 2 / 3 / 4 m/s, jambe ~0,9 m).
// Usage : node compare-recul.mjs   (ENG= pour un autre arbre ; `reculGen` / `reculMes` / `ANCRES` pour les bancs)
import { readFileSync } from 'node:fs';
const E = process.env.ENG || new URL('../../../../examples/showcase/src/engine/', import.meta.url).href;
const W = JSON.parse(readFileSync(new URL('./recul-scherpereel.json', import.meta.url)));
const MG = await import(E + 'motion-gait.js'); const { SHANON_PROFILE } = await import(E + 'motion-profile-shanon.js');
export function reculGen(P, v, opts = { griffe: 1 }) {
  const pr = MG.gaitPortrait(P, { vF: -v, vR: 0, opts, n: 240 }), F = pr.frames, Lg = P.lengths.thigh + P.lengths.shank;
  const to = F.findIndex((f) => f.L.phase === 'swing'), mi = Math.round(to / 2), hip0 = P.bones.LeftUpLeg.bindP[1];
  const hh = F.map((f) => (f.L.hip[1] - hip0) / Lg), K = F.map((f) => f.L.kneeAngle), fwd = (i, k = 'ankle') => -(F[i].L[k][2] - F[i].L.hip[2]) / Lg;
  const bassin = hh.map((x, i) => (x + hh[(i + F.length / 2) % F.length]) / 2);   // la moyenne des deux hanches ≈ le bassin
  return { f: +(1 / pr.T).toFixed(3), s: +F[0].meta.s.toFixed(3), genou: [K[0], Math.max(...K.slice(0, to)), K[mi], K[to - 1], Math.max(...K.slice(to))].map((x) => +x.toFixed(0)),
    cuisseVol: [Math.min(...F.slice(to).map((f) => f.L.hipFlex)), Math.max(...F.slice(to).map((f) => f.L.hipFlex))].map((x) => +x.toFixed(0)),
    pied: [F[0].feet.Left.pitch, F[mi].feet.Left.pitch, F[to - 1].feet.Left.pitch].map((x) => +x.toFixed(0)), hanche: [hh[0], hh[mi], hh[to - 1], Math.max(...hh), Math.min(...hh)].map((x) => +x.toFixed(3)),
    rebond: +(Math.max(...bassin) - Math.min(...bassin)).toFixed(3),
    pose: +fwd(0).toFixed(3), decol: +fwd(to - 1).toFixed(3), orteilPose: +fwd(0, 'toe').toFixed(3), orteilDecol: +fwd(to - 1, 'toe').toFixed(3) };
}
export function reculMes(k) {
  const r = W[k], to = Math.round(100 * r.duty), gc = r.genouCycle, hc = r.hancheCycle, bassin = hc.map((x, i) => (x + hc[(i + 50) % 100]) / 2);
  return { f: r.f, s: r.duty, genou: [gc[0], Math.max(...gc.slice(0, to)), gc[Math.round(to / 2)], gc[to], Math.max(...r.volGenou)].map((x) => +x.toFixed(0)), cuisseVol: [Math.min(...r.volCuisse), Math.max(...r.volCuisse)].map((x) => +x.toFixed(0)),
    pied: [r.piedAppui[0], r.piedAppui[10], r.piedAppui[20]].map((x) => +x.toFixed(0)), hanche: [hc[0], hc[Math.round(to / 2)], hc[to], Math.max(...hc), Math.min(...hc)].map((x) => +x.toFixed(3)),
    rebond: +(Math.max(...bassin) - Math.min(...bassin)).toFixed(3), pose: r.pose[0], decol: r.decol[0] };
}
/** Les ancres de la course arrière (recul-vers-moteur.py) : genou [pose, mi-appui, décollage], orteil / hanche (L), rebond (L), genou en vol. */
export const ANCRES = {
  2.7: { genou: [40, 38, 2], orteilPose: -0.24, orteilDecol: 0.45, source: 'Bates 1986 (figures) ; orteil : géométrie de ses angles, recoupée par Arata' },
  5.1: { orteilPose: -0.26, orteilDecol: 0.46, genouVol: 85, source: 'Arata 1999' },
  2: { rebond: 0.080 / 0.9 }, 3: { rebond: 0.072 / 0.9 }, 4: { rebond: 0.060 / 0.9 }, cavagna: 'Cavagna 2012, centre de masse, jambe ~0,9 m',
};
if (import.meta.url === `file://${process.argv[1]}`) {
  const P = SHANON_PROFILE;
  for (const k of Object.keys(W).filter((k) => k.startsWith('recul'))) { const g = reculGen(P, W[k].v), m = reculMes(k); console.log(`marche arrière ${W[k].v} m/s (genou [pose, max appui, mi-appui, décol, max vol])`); for (const x of Object.keys(m)) console.log(`  ${x.padEnd(11)} gén ${JSON.stringify(g[x]).padEnd(44)} mes ${JSON.stringify(m[x])}`); }
  for (const v of [2, 2.7, 3, 4, 5.1]) { const g = reculGen(P, v), a = ANCRES[v] || {}; console.log(`course arrière ${v} m/s : f ${g.f} s ${g.s} | genou ${JSON.stringify(g.genou)}${a.genou ? ' ancre ' + JSON.stringify(a.genou) : ''} | orteil pose ${g.orteilPose}${a.orteilPose != null ? ' (' + a.orteilPose + ')' : ''} décol ${g.orteilDecol}${a.orteilDecol != null ? ' (' + a.orteilDecol + ')' : ''} | cheville ${g.pose} / ${g.decol} | pied ${JSON.stringify(g.pied)} | rebond ${g.rebond}${a.rebond ? ' (' + a.rebond.toFixed(3) + ')' : ''} | hanche ${JSON.stringify(g.hanche)} | cuisse vol ${JSON.stringify(g.cuisseVol)}`); }
}
