// gpf-magneto.js — LE MAGNÉTOSCOPE DE /match11 (lot L5 : EX-03 les ralentis des buts sous plusieurs angles, EX-04 la pause et le saut au
// prochain temps fort, EX-07 revoir). Le corps ne se rembobine pas (un seul monde dans le module WebAssembly) : la page ENREGISTRE ce qu'elle
// dessine. Toutes les 20 ms de jeu (50 Hz, aux pas pairs) : la pose des 22 (racine + 13 articulations, gf_pose — 4 µs la lecture), le
// ballon, l'horloge, le score, la mi-temps, qui est en jeu, et ce que la caméra suit (le geste en course, le face-à-face) — dans un anneau
// de 30 s (7 Mo). Les buts sont copiés à part (12 s avant, 0,5 s après) : on les revoit quand on veut.
// La lecture interpole deux images (racines et ballon en ligne droite, articulations en nlerp) : le ralenti ×0,25 reste fluide.
// PENDANT UNE LECTURE, LE CORPS EST À L'ARRÊT : le pas est fixe, on ne fait que différer — le match joué est le même au bit.

/** Les champs d'une image (Float32Array) : l'horloge (ms), le pas, le ballon (x, y, z du corps), le score, la mi-temps, le geste en course
 *  (porteur, depuis), le face-à-face (porteur, défenseur, depuis), 22 drapeaux « en jeu », la possession (équipe, rang du joueur dans
 *  son équipe — gf_frame 9 et 10), puis les poses. */
export const IMG = { T: 0, PAS: 1, B: 2, SC: 5, PER: 7, GE: 8, FA: 10, ACT: 13, POSS: 35, POSE: 37 };

export class Magneto {
  /** @param {number} posePer la taille d'une pose (gf_pose_per : 55) ; hz : la cadence ; secondes : la longueur de l'anneau */
  constructor(posePer, { hz = 50, secondes = 30 } = {}) {
    this.posePer = posePer; this.per = IMG.POSE + 22 * posePer; this.hz = hz; this.cap = hz * secondes;
    this.buf = new Float32Array(this.per * this.cap);
    this.total = 0;   // le nombre d'images enregistrées depuis le coup d'envoi (l'index absolu de la prochaine)
  }

  /** Enregistrer l'image du moment. F : gf_frame (en-tête + 22 joueurs), Q : gf_pose, d : { pas, per, ge: [id, depuis], fa: [porteur, defenseur, depuis] }. */
  enregistrer(F, HEAD, PER, Q, d) {
    const o = (this.total % this.cap) * this.per, b = this.buf;
    b[o + IMG.T] = F[0]; b[o + IMG.PAS] = d.pas; b[o + IMG.B] = F[6]; b[o + IMG.B + 1] = F[7]; b[o + IMG.B + 2] = F[8];
    b[o + IMG.SC] = F[4]; b[o + IMG.SC + 1] = F[5]; b[o + IMG.PER] = d.per;
    b[o + IMG.GE] = d.ge?.[0] ?? -1; b[o + IMG.GE + 1] = d.ge?.[1] ?? 0;
    b[o + IMG.FA] = d.fa?.[0] ?? -1; b[o + IMG.FA + 1] = d.fa?.[1] ?? -1; b[o + IMG.FA + 2] = d.fa?.[2] ?? 0;
    for (let k = 0; k < 22; k++) b[o + IMG.ACT + k] = F[HEAD + k * PER + 11];
    b[o + IMG.POSS] = F[9]; b[o + IMG.POSS + 1] = F[10];
    b.set(Q.subarray(0, 22 * this.posePer), o + IMG.POSE);
    this.total++;
  }

  /** La première et la dernière image encore dans l'anneau (index absolus). */
  get debut() { return Math.max(0, this.total - this.cap); }
  get fin() { return this.total - 1; }
  /** L'image absolue i (une vue, valable jusqu'à son écrasement). */
  image(i) { const o = (i % this.cap) * this.per; return this.buf.subarray(o, o + this.per); }
  /** L'index absolu de la dernière image à l'horloge ≤ t (ms) — recherche dichotomique (l'horloge croît : elle saute aux arrêts, sans reculer). */
  indexA(t) {
    let a = this.debut, z = this.fin; if (z < a) return -1;
    if (this.image(a)[IMG.T] > t) return a;
    while (a < z) { const m = (a + z + 1) >> 1; if (this.image(m)[IMG.T] <= t) a = m; else z = m - 1; }
    return a;
  }
  /** Copier les images [i0, i1] en un CLIP (le but qu'on reverra) : { n, img(i), t0 }. */
  extraire(i0, i1) {
    i0 = Math.max(this.debut, i0); i1 = Math.min(this.fin, i1);
    const n = Math.max(0, i1 - i0 + 1), data = new Float32Array(n * this.per);
    for (let i = 0; i < n; i++) data.set(this.image(i0 + i), i * this.per);
    const per = this.per;
    return { n, data, img: (i) => data.subarray(i * per, (i + 1) * per) };
  }
  /** La source « anneau » vue comme un clip (index relatifs à `debut` au moment de l'appel — ne pas enregistrer pendant la lecture). */
  commeClip() {
    const d = this.debut, n = this.total - d;
    return { n, img: (i) => this.image(d + i), base: d };
  }
}

/** L'image entre A et B (u ∈ [0, 1]) dans `out` : horloge, ballon et racines en ligne droite, articulations en nlerp (au plus court), le
 *  reste (score, mi-temps, qui suit la caméra, en jeu) pris à la plus proche. */
export function interpoler(A, B, u, out, posePer) {
  const P = u < 0.5 ? A : B;
  out.set(P.subarray(0, IMG.POSE));
  out[IMG.T] = A[IMG.T] + (B[IMG.T] - A[IMG.T]) * u;
  for (let c = 0; c < 3; c++) out[IMG.B + c] = A[IMG.B + c] + (B[IMG.B + c] - A[IMG.B + c]) * u;
  for (let k = 0; k < 22; k++) {
    const o = IMG.POSE + k * posePer;
    // un joueur replacé d'un coup (coup de pied arrêté) : on prend l'image la plus proche, sans glisser à travers le terrain
    const saut = Math.hypot(B[o] - A[o], B[o + 1] - A[o + 1]) > 1.5;
    if (saut) { out.set(P.subarray(o, o + posePer), o); continue; }
    for (let c = 0; c < 3; c++) out[o + c] = A[o + c] + (B[o + c] - A[o + c]) * u;
    for (let j = 3; j < posePer; j += 4) {
      let bx = B[o + j], by = B[o + j + 1], bz = B[o + j + 2], bw = B[o + j + 3];
      const ax = A[o + j], ay = A[o + j + 1], az = A[o + j + 2], aw = A[o + j + 3];
      if (ax * bx + ay * by + az * bz + aw * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
      const x = ax + (bx - ax) * u, y = ay + (by - ay) * u, z = az + (bz - az) * u, w = aw + (bw - aw) * u, l = Math.hypot(x, y, z, w) || 1;
      out[o + j] = x / l; out[o + j + 1] = y / l; out[o + j + 2] = z / l; out[o + j + 3] = w / l;
    }
  }
  return out;
}
