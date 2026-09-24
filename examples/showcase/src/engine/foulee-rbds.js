// foulee-rbds — LE VOL DES COUREURS MESURÉS, en données : la cuisse (angle GLOBAL, + = devant) et le genou (flexion) sur la phase
// aérienne normalisée (w = 0 au décollage, 1 à la pose), moyennes de Fukuchi, Fukuchi & Duarte 2017 (PeerJ 5:e3298 — RBDS, figshare
// 4543435 : 62-78 jambes de coureurs amateurs sur tapis) à 2,5 / 3,5 / 4,5 m/s. Cuisse globale = hanche Visual3D (relative au bassin)
// − inclinaison antérieure du bassin mesurée sur les marqueurs (13,9 / 15,9 / 16,9°, 14 coureurs). Le vol est découpé COUREUR PAR COUREUR
// à son propre décollage (fin de la force des courbes traitées) avant la moyenne : découpée au décollage moyen, la moyenne mêlait des
// appuis tardifs au début du vol (le genou s'y dépliait de 19 à 16° — un artefact : l'orteil rasait 56 ms au trot, 27 chez les coureurs).
// Régénéré par les sondes de foulée (scripts/foulee-sondes : vol-aligne.py) — ne pas éditer.
// LE SPRINT (2026-09-24) : Dorn, Schache & Pandy 2012 (J Exp Biol 215:1944 ; SimTK « runningspeeds », licence MIT, © 2012 Stanford
// University) — un sprinter (JA1) sur piste instrumentée à 5,19 / 6,97 / 9,47 m/s, 3-4 cycles par vitesse, marqueurs à 250 Hz, poses et
// décollages du laboratoire ; centres articulaires reconstruits (foulee-sondes : sprint-dorn.py → dorn-vol.py). À 3,5 m/s ses courbes
// tombent sur celles de RBDS (cuisse −23 / +35°, genou 108° c. −22 / +36°, 106°) : les deux sources se prolongent. À 9,47 m/s le genou
// culmine à 146-148° en vol — la moyenne de 79 sprinteurs à 9,9 m/s (Miyashiro, Nagahara et al. 2019, Front Sports Act Living
// 1:37 : 148,4 ± 5,6°).
export const RBDS_VOL = {
  v: [2.5, 3.5, 4.5],
  cuisse: [[-17.2, -17.2, -15.9, -13.9, -11.8, -9.4, -6.1, -1.6, 4.3, 10.7, 16.8, 22.0, 26.0, 28.6, 29.7, 29.2, 27.4, 24.9, 22.4, 20.4, 19.1], [-22.2, -22.9, -21.9, -20.1, -18.0, -15.6, -12.4, -7.4, -0.2, 8.5, 17.4, 25.0, 30.7, 34.3, 36.1, 36.3, 34.9, 32.0, 28.4, 25.0, 22.3], [-26.4, -27.6, -26.4, -24.4, -22.4, -20.1, -16.9, -11.6, -3.5, 6.9, 17.9, 27.6, 34.6, 39.2, 41.9, 43.1, 42.2, 38.9, 34.1, 29.1, 25.3]],
  genou: [[15.5, 19.7, 27.6, 37.8, 48.9, 60.0, 70.5, 79.7, 87.0, 91.5, 92.6, 90.1, 84.3, 75.7, 64.7, 51.8, 38.1, 25.3, 15.4, 10.4, 10.7], [12.4, 15.7, 24.2, 35.6, 48.5, 61.7, 74.7, 86.7, 96.7, 103.6, 106.3, 104.3, 98.1, 88.5, 76.2, 62.0, 46.5, 31.2, 18.5, 11.6, 11.3], [11.0, 14.0, 23.5, 36.2, 50.2, 64.5, 78.7, 92.1, 103.8, 112.3, 116.0, 114.3, 107.9, 97.8, 85.2, 70.7, 54.6, 37.7, 23.1, 14.4, 13.0]],
};



export const DORN_VOL = {
  v: [5.19, 6.97, 9.47],
  cuisse: [[-29.8, -31.4, -29.8, -26.2, -21.4, -15.2, -7.8, 1.3, 12.4, 25.0, 36.3, 43.9, 48.4, 50.2, 49.7, 46.6, 40.0, 32.2, 26.8, 25.0, 25.8], [-33.8, -36.1, -33.6, -30.9, -26.6, -20.9, -13.2, -2.1, 10.9, 26.1, 39.9, 50.3, 57.2, 60.8, 60.9, 56.5, 48.1, 39.6, 34.1, 32.1, 32.1], [-43.4, -45.0, -41.2, -37.8, -33.3, -27.3, -19.8, -10.6, 1.1, 14.5, 28.4, 40.2, 50.0, 57.2, 61.8, 61.2, 55.0, 47.0, 39.9, 34.6, 31.4]],
  genou: [[16.0, 21.9, 34.2, 49.4, 64.9, 80.8, 96.6, 111.2, 121.7, 126.0, 124.3, 116.6, 105.3, 91.4, 75.3, 56.6, 35.1, 15.0, 4.4, 6.8, 18.4], [14.2, 22.8, 40.4, 57.5, 75.9, 95.2, 114.6, 132.9, 144.4, 147.7, 144.0, 132.6, 118.1, 101.0, 81.9, 59.4, 34.0, 13.7, 6.0, 11.5, 24.9], [5.8, 17.9, 40.2, 59.3, 79.1, 98.9, 116.7, 131.8, 142.1, 146.7, 146.2, 137.9, 126.9, 113.3, 98.5, 79.9, 57.5, 36.6, 23.7, 19.9, 24.6]],
};

export const CHEVILLE_VOL = {
  v: [3.53, 5.19, 6.97, 9.47],
  cheville: [[-18.9, -22.6, -18.4, -13.9, -12.8, -13.0, -11.7, -8.8, -7.1, -5.9, -4.0, -2.4, -0.7, -0.5, -0.9, -0.9, -1.7, -3.4, -6.0, -5.7, -4.4], [-23.0, -23.5, -17.7, -15.5, -16.5, -16.7, -14.1, -9.9, -7.6, -5.7, -3.4, -1.4, -0.1, 0.2, -0.1, 0.0, -0.9, -3.6, -6.1, -5.8, -3.5], [-22.1, -19.5, -15.9, -14.7, -15.1, -14.7, -12.4, -9.8, -9.6, -9.7, -4.6, -1.7, 0.8, 0.9, 0.7, 0.1, -2.0, -5.5, -8.0, -6.9, -4.4], [-30.9, -27.2, -23.9, -28.1, -27.3, -24.0, -21.7, -18.7, -17.6, -15.8, -9.6, -5.7, -3.3, -1.7, 1.3, 5.3, 6.6, 5.4, 3.1, -0.6, -2.1]],
};

/** La cuisse et le genou de référence (degrés) à la vitesse v et à la phase de vol w ∈ [0,1] — interpolés entre les vitesses MESURÉES :
 *  RBDS 2,5 / 3,5 / 4,5 m/s puis le sprinter de Dorn 5,19 / 6,97 / 9,47 m/s ; sous 2,5 la courbe de 2,5, au-delà de 9,47 celle de 9,47.
 *  (Jusqu'au 24/09 au soir, au-delà de 4,5 m/s : la courbe de 4,5 extrapolée, genou ×1,10 — 128° à 8,5 m/s pour 146 mesurés.) */
const KNOTS = [...RBDS_VOL.v.map((v, i) => [v, RBDS_VOL.cuisse[i], RBDS_VOL.genou[i]]), ...DORN_VOL.v.map((v, i) => [v, DORN_VOL.cuisse[i], DORN_VOL.genou[i]])];
export function volRef(v, w) {
  const n = KNOTS[0][1].length - 1;
  const x = Math.max(0, Math.min(1, w)) * n, i0 = Math.min(n - 1, Math.floor(x)), f = x - i0;
  const at = (arr) => arr[i0] + (arr[i0 + 1] - arr[i0]) * f;
  let k = 0; while (k < KNOTS.length - 2 && v > KNOTS[k + 1][0]) k++;
  const A = KNOTS[k], B = KNOTS[k + 1], t = Math.max(0, Math.min(1, (v - A[0]) / (B[0] - A[0])));
  return { cuisse: at(A[1]) + (at(B[1]) - at(A[1])) * t, genou: at(A[2]) + (at(B[2]) - at(A[2])) * t };
}

/** La cheville du sprinter en vol (degrés, + = pointe relevée ; 0 = pied à angle droit de la jambe, la station debout) à la vitesse v et à la
 *  phase de vol w — Dorn 2012 (JA1, 3,53 → 9,47 m/s ; cheville-dorn.py), bornée aux vitesses mesurées. La pointe part tendue (−19 à −31°)
 *  et revient à l'équerre vers 60 % du vol : le pied SUIT la jambe qui se replie (au sprint il pointe vers l'arrière, −160° au monde). */
export function chevilleRef(v, w) {
  const V = CHEVILLE_VOL.v, n = CHEVILLE_VOL.cheville[0].length - 1;
  const x = Math.max(0, Math.min(1, w)) * n, i0 = Math.min(n - 1, Math.floor(x)), f = x - i0;
  const at = (arr) => arr[i0] + (arr[i0 + 1] - arr[i0]) * f;
  let k = 0; while (k < V.length - 2 && v > V[k + 1]) k++;
  const t = Math.max(0, Math.min(1, (v - V[k]) / (V[k + 1] - V[k])));
  return at(CHEVILLE_VOL.cheville[k]) + (at(CHEVILLE_VOL.cheville[k + 1]) - at(CHEVILLE_VOL.cheville[k])) * t;
}
