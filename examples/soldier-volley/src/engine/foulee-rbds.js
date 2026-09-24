// foulee-rbds — LE VOL DES COUREURS MESURÉS, en données : la cuisse (angle GLOBAL, + = devant) et le genou (flexion) sur la phase
// aérienne normalisée (w = 0 au décollage, 1 à la pose), moyennes de Fukuchi, Fukuchi & Duarte 2017 (PeerJ 5:e3298 — RBDS, figshare
// 4543435 : 62-78 jambes de coureurs amateurs sur tapis) à 2,5 / 3,5 / 4,5 m/s. Cuisse globale = hanche Visual3D (relative au bassin)
// − inclinaison antérieure du bassin mesurée sur les marqueurs (13,9 / 15,9 / 16,9°, 14 coureurs). Le vol est découpé COUREUR PAR COUREUR
// à son propre décollage (fin de la force des courbes traitées) avant la moyenne : découpée au décollage moyen, la moyenne mêlait des
// appuis tardifs au début du vol (le genou s'y dépliait de 19 à 16° — un artefact : l'orteil rasait 56 ms au trot, 27 chez les coureurs).
// Régénéré par les sondes de foulée (scripts/foulee-sondes : vol-aligne.py) — ne pas éditer.
export const RBDS_VOL = {
  v: [2.5, 3.5, 4.5],
  cuisse: [[-17.2, -17.2, -15.9, -13.9, -11.8, -9.4, -6.1, -1.6, 4.3, 10.7, 16.8, 22.0, 26.0, 28.6, 29.7, 29.2, 27.4, 24.9, 22.4, 20.4, 19.1], [-22.2, -22.9, -21.9, -20.1, -18.0, -15.6, -12.4, -7.4, -0.2, 8.5, 17.4, 25.0, 30.7, 34.3, 36.1, 36.3, 34.9, 32.0, 28.4, 25.0, 22.3], [-26.4, -27.6, -26.4, -24.4, -22.4, -20.1, -16.9, -11.6, -3.5, 6.9, 17.9, 27.6, 34.6, 39.2, 41.9, 43.1, 42.2, 38.9, 34.1, 29.1, 25.3]],
  genou: [[15.5, 19.7, 27.6, 37.8, 48.9, 60.0, 70.5, 79.7, 87.0, 91.5, 92.6, 90.1, 84.3, 75.7, 64.7, 51.8, 38.1, 25.3, 15.4, 10.4, 10.7], [12.4, 15.7, 24.2, 35.6, 48.5, 61.7, 74.7, 86.7, 96.7, 103.6, 106.3, 104.3, 98.1, 88.5, 76.2, 62.0, 46.5, 31.2, 18.5, 11.6, 11.3], [11.0, 14.0, 23.5, 36.2, 50.2, 64.5, 78.7, 92.1, 103.8, 112.3, 116.0, 114.3, 107.9, 97.8, 85.2, 70.7, 54.6, 37.7, 23.1, 14.4, 13.0]],
};

/** La cuisse et le genou de référence (degrés) à la vitesse v et à la phase de vol w ∈ [0,1] — interpolés entre les vitesses mesurées ;
 *  sous 2,5 m/s la courbe de 2,5. AU-DELÀ DE 4,5 m/s (EXTRAPOLÉ, pas de coureurs mesurés au sprint dans RBDS) : la courbe de 4,5 dont
 *  le genou croît jusqu'à ×1,10 (116 → ~128° de flexion en vol) et la cuisse AVANT jusqu'à ×1,4 (43 → ~60°) à 8,5 m/s — l'ordre de
 *  grandeur du sprint (Mann & Hagy 1980 : genou 125-135°, cuisse haute) ; l'extension arrière reste celle mesurée. */
export function volRef(v, w) {
  const V = RBDS_VOL.v, n = RBDS_VOL.cuisse[0].length - 1;
  const x = Math.max(0, Math.min(1, w)) * n, i0 = Math.min(n - 1, Math.floor(x)), f = x - i0;
  const at = (arr) => arr[i0] + (arr[i0 + 1] - arr[i0]) * f;
  let k = 0; while (k < V.length - 2 && v > V[k + 1]) k++;
  const t = Math.max(0, Math.min(1, (v - V[k]) / (V[k + 1] - V[k])));
  let cuisse = at(RBDS_VOL.cuisse[k]) + (at(RBDS_VOL.cuisse[k + 1]) - at(RBDS_VOL.cuisse[k])) * t;
  let genou = at(RBDS_VOL.genou[k]) + (at(RBDS_VOL.genou[k + 1]) - at(RBDS_VOL.genou[k])) * t;
  if (v > V[V.length - 1]) {
    const e = Math.min(1, (v - V[V.length - 1]) / (8.5 - V[V.length - 1]));
    genou *= 1 + 0.10 * e; if (cuisse > 0) cuisse *= 1 + 0.4 * e;
  }
  return { cuisse, genou };
}
