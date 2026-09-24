import * as THREE from 'three/webgpu';
import { buildGoal } from './goal.js';

// LA CAGE DU DUEL — un city stade : gazon synthétique, bandes d'un mètre, grillage losangé jusqu'à 4 m, poteaux,
// deux petits buts à filets (goal.js), mâts d'éclairage, bitume et immeubles autour. Tout est procédural (canvas),
// zéro asset. La géométrie suit la cage de la sim (engine/duel-1v1.js, CAGE) : les bandes sont posées 0,15 m
// AU-DELÀ de la ligne, là où la grille de la sim fait rebondir le ballon (centre du ballon sur la ligne, sa peau à
// 0,11 m) — le rebond se voit contre la bande, pas dans le vide.

const canvasTex = (w, h, draw, { repeat = [1, 1], srgb = true } = {}) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

/** Le sol de jeu : bandes de tonte + lignes blanches, à l'échelle de la cage (1 px ≈ 2,3 cm). */
function turfTexture(L, W, cage) {
  const M = 1, PX = 44;                                           // 1 m de marge, 44 px par mètre
  const w = Math.round((L + 2 * M) * PX), h = Math.round((W + 2 * M) * PX);
  return canvasTex(w, h, (g) => {
    for (let i = 0; i * 2 < L + 2 * M; i++) { g.fillStyle = i % 2 ? '#2f7d38' : '#358a3e'; g.fillRect(i * 2 * PX, 0, 2 * PX, h); }
    // le grain du synthétique : un bruit fin (déterministe)
    let s = 7; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let k = 0; k < w * h / 18; k++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)'; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
    const X = (x) => (x + L / 2 + M) * PX, Z = (z) => (z + W / 2 + M) * PX;
    g.strokeStyle = 'rgba(245,247,250,0.92)'; g.lineWidth = 0.08 * PX;
    g.strokeRect(X(-L / 2), Z(-W / 2), L * PX, W * PX);
    g.beginPath(); g.moveTo(X(0), Z(-W / 2)); g.lineTo(X(0), Z(W / 2)); g.stroke();
    g.beginPath(); g.arc(X(0), Z(0), cage.circle * PX, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(245,247,250,0.92)'; g.beginPath(); g.arc(X(0), Z(0), 0.12 * PX, 0, Math.PI * 2); g.fill();
    for (const sg of [-1, 1]) {
      const bx = sg > 0 ? L / 2 - cage.box.depth : -L / 2;
      g.strokeRect(X(bx), Z(-cage.box.width / 2), cage.box.depth * PX, cage.box.width * PX);
    }
  });
}

/** Le grillage : un losange de fil par tuile (10 cm), fond transparent — de loin les mipmaps en font un voile. */
const fenceTexture = (len, height) => canvasTex(64, 64, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w / 2, 0); g.lineTo(w, h / 2); g.lineTo(w / 2, h); g.closePath(); g.stroke();
}, { repeat: [len / 0.1, height / 0.1], srgb: false });

/** Une façade : un mur et sa grille de fenêtres (quelques-unes allumées au couchant). */
const facadeTexture = (seed, base) => canvasTex(256, 512, (g, w, h) => {
  let s = seed; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let y = 16; y < h - 24; y += 40) for (let x = 14; x < w - 20; x += 36) {
    const lit = rnd() < 0.12;
    g.fillStyle = lit ? '#f2c77a' : rnd() < 0.5 ? '#2b3440' : '#3a4656'; g.fillRect(x, y, 22, 26);
  }
}, { repeat: [1, 1] });

/** L'albédo d'une texture : sa luminance LINÉAIRE moyenne (sRGB décodé, un pixel sur 16) — l'exposition du duel s'en déduit. */
const albedo = (canvas) => {
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data, lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  let s = 0, n = 0;
  for (let i = 0; i < d.length; i += 64) { s += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); n++; }
  return s / n;
};

export function buildCage(cage, { ouvert = -1 } = {}) {   // ouvert : le long côté SANS grillage (−1 : z < 0, le côté de la caméra de régie ; 0 : aucun)
  const group = new THREE.Group(); group.name = 'cage-duel';
  const disposables = [];
  const keep = (...xs) => { disposables.push(...xs); return xs[0]; };
  const L = cage.length, W = cage.width, hx = L / 2, hz = W / 2, off = 0.15, gw = cage.goal.width, gh = cage.goal.height;
  const add = (mesh, { cast = true, receive = true } = {}) => { mesh.castShadow = cast; mesh.receiveShadow = receive; group.add(mesh); return mesh; };

  // ---- le sol : bitume au loin, gazon synthétique dans la cage
  const asph = keep(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#3b3c3f'; g.fillRect(0, 0, w, h);
    let s = 3; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let k = 0; k < 9000; k++) { const v = 40 + rnd() * 50; g.fillStyle = `rgba(${v},${v},${v + 4},0.5)`; g.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
  }, { repeat: [300, 300] }));
  // 1,2 km : son bord se perd dans la brume (horizon), pas en arête sombre sous le ciel
  const asphalt = add(new THREE.Mesh(keep(new THREE.PlaneGeometry(1200, 1200)), keep(new THREE.MeshStandardNodeMaterial({ map: asph, roughness: 0.93, metalness: 0 }))), { cast: false });
  asphalt.rotation.x = -Math.PI / 2; asphalt.position.y = -0.012;
  const turfTex = keep(turfTexture(L, W, cage));
  const turf = add(new THREE.Mesh(keep(new THREE.PlaneGeometry(L + 2, W + 2)), keep(new THREE.MeshStandardNodeMaterial({ map: turfTex, roughness: 0.96, metalness: 0 }))), { cast: false });
  turf.rotation.x = -Math.PI / 2; turf.position.y = 0.002;

  // ---- les bandes (1 m) : bleu city stade, liseré clair ; ouvertes devant chaque but
  const boardM = keep(new THREE.MeshStandardNodeMaterial({ color: 0x1f58a8, roughness: 0.55, metalness: 0.25 }));
  const capM = keep(new THREE.MeshStandardNodeMaterial({ color: 0xd9dde2, roughness: 0.4, metalness: 0.6 }));
  const board = (len, x, z, rotY) => {
    const b = add(new THREE.Mesh(keep(new THREE.BoxGeometry(len, 1.0, 0.06)), boardM)); b.position.set(x, 0.5, z); b.rotation.y = rotY;
    const c = add(new THREE.Mesh(keep(new THREE.BoxGeometry(len, 0.05, 0.1)), capM)); c.position.set(x, 1.02, z); c.rotation.y = rotY;
  };
  for (const sz of [-1, 1]) board(L + 2 * off, 0, sz * (hz + off), 0);                       // les longueurs
  const endLen = (W + 2 * off - gw) / 2;                                                      // les fonds, de part et d'autre du but
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) board(endLen, sx * (hx + off), sz * (gw / 2 + endLen / 2), Math.PI / 2);

  // ---- le grillage (1 → 4 m), au-dessus du but à partir de la barre
  const fenceM = (len, height) => keep(new THREE.MeshStandardNodeMaterial({ color: 0x9aa4ad, roughness: 0.45, metalness: 0.75, alphaMap: keep(fenceTexture(len, height)), transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const fence = (len, y0, y1, x, z, rotY) => { const f = add(new THREE.Mesh(keep(new THREE.PlaneGeometry(len, y1 - y0)), fenceM(len, y1 - y0)), { cast: false, receive: false }); f.position.set(x, (y0 + y1) / 2, z); f.rotation.y = rotY; };
  // (le côté caméra reste ouvert au-dessus de la bande — la régie filme par-dessus, comme au jeu vidéo : sinon la main
  //  courante et les poteaux barrent l'image, mesuré à la première capture)
  for (const sz of [-1, 1]) if (sz !== ouvert) fence(L + 2 * off, 1.05, 4, 0, sz * (hz + off), 0);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) fence(endLen, 1.05, 4, sx * (hx + off), sz * (gw / 2 + endLen / 2), Math.PI / 2);
    fence(gw, gh, 4, sx * (hx + off), 0, Math.PI / 2);
  }

  // ---- poteaux et main courante
  const postM = keep(new THREE.MeshStandardNodeMaterial({ color: 0x6d757d, roughness: 0.38, metalness: 0.85 }));
  const postG = keep(new THREE.CylinderGeometry(0.045, 0.05, 4.15, 10));
  const post = (x, z) => { const p = add(new THREE.Mesh(postG, postM)); p.position.set(x, 4.15 / 2, z); };
  for (let x = -hx - off; x <= hx + off + 1e-6; x += (L + 2 * off) / 10) for (const sz of [-1, 1]) if (sz !== ouvert || Math.abs(Math.abs(x) - (hx + off)) < 1e-6) post(x, sz * (hz + off));
  for (const sx of [-1, 1]) for (const z of [-hz - off + (W + 2 * off) / 4, -gw / 2, gw / 2, hz + off - (W + 2 * off) / 4]) post(sx * (hx + off), z);
  const rail = (len, x, z, rotY) => { const r = add(new THREE.Mesh(keep(new THREE.CylinderGeometry(0.035, 0.035, len, 8)), postM)); r.rotation.z = Math.PI / 2; r.rotation.y = rotY; r.position.set(x, 4.05, z); };
  for (const sz of [-1, 1]) if (sz !== ouvert) rail(L + 2 * off, 0, sz * (hz + off), 0);
  for (const sx of [-1, 1]) rail(W + 2 * off, sx * (hx + off), 0, Math.PI / 2);

  // ---- les buts (3 × 2, filets en fils — goal.js), la cage de la sim est en ±hx
  const goals = [buildGoal(group, { X: hx, W: gw, H: gh, D: 0.9, cell: 0.14 }), buildGoal(group, { X: -hx, W: gw, H: gh, D: -0.9, cell: 0.14 })];
  for (const gl of goals) disposables.push(gl);

  // ---- les mâts d'éclairage (éteints de jour)
  const mastM = keep(new THREE.MeshStandardNodeMaterial({ color: 0x5c6167, roughness: 0.5, metalness: 0.8 }));
  const lampM = keep(new THREE.MeshStandardNodeMaterial({ color: 0x20242a, roughness: 0.3, metalness: 0.4, emissive: 0xfff4dd, emissiveIntensity: 0.05 }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const m = add(new THREE.Mesh(keep(new THREE.CylinderGeometry(0.09, 0.14, 9, 10)), mastM)); m.position.set(sx * (hx + 2.2), 4.5, sz * (hz + 2.2));
    const h = add(new THREE.Mesh(keep(new THREE.BoxGeometry(1.1, 0.28, 0.5)), lampM)); h.position.set(sx * (hx + 1.8), 9, sz * (hz + 1.8)); h.lookAt(0, 0, 0);
  }

  // ---- le quartier : un anneau d'immeubles (déterministe)
  const bases = ['#b9a58c', '#9d8f80', '#c7b9a6', '#8f9aa3', '#a6836a', '#d0c6b8'];
  let s = 11; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rnd() * 0.25, r = 32 + rnd() * 14;
    const bw = 9 + rnd() * 9, bd = 8 + rnd() * 6, bh = 10 + rnd() * 16;
    const tex = keep(facadeTexture(100 + i, bases[i % bases.length])); tex.repeat.set(Math.max(1, Math.round(bw / 6)), Math.max(1, Math.round(bh / 12)));
    const b = add(new THREE.Mesh(keep(new THREE.BoxGeometry(bw, bh, bd)), keep(new THREE.MeshStandardNodeMaterial({ map: tex, roughness: 0.85, metalness: 0.05 }))), { cast: true, receive: true });
    b.position.set(Math.cos(a) * r * 1.25, bh / 2, Math.sin(a) * r); b.rotation.y = -a + Math.PI / 2;
  }

  return { group, goals, turfAlbedo: albedo(turfTex.image), dispose() { for (const d of disposables) d.dispose?.(); } };
}
