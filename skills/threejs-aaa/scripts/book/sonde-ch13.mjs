// sonde ch13 (Bible 13, chorégraphie) — 1/2 longueur et largeur par bande, 3 gardien ↔ partenaire, 4/5 couches convexes, 6 aire, 7 stretch, 13/14 couloirs, 15 distance au partenaire, 17 vibration, 18 immobilité, 22 GC-GC, 23 ligne de hors-jeu.
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
import { momentDuJeu } from '../../assets/starter/src/engine/phases.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number);
const hull = (pts) => { pts = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (pts.length < 3) return pts; const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); const lo = []; for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); } const up = []; for (const p of [...pts].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); } return lo.slice(0, -1).concat(up.slice(0, -1)); };
const area = (h) => { let a = 0; for (let i = 0; i < h.length; i++) { const p = h[i], q = h[(i + 1) % h.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; };
const o = { n: 0, len: {}, wid: {}, gk: {}, ext: {}, int: {}, ratio: [], aireP: [], aireD: [], strP: [], strD: [], c15: 0, c15N: 0, trois: 0, troisN: 0, near: [], vib: 0, vibMin: 0, immob: [], gcX: [], gcZ: [], lineGap: [] };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } }); o.n++;
  const prevP = new Map(), prevVz = new Map(); const still = new Map();
  for (let i = 0; i < 5400 * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    if (i % 3 === 0) { for (const p of st.players) { if (p.keeper) continue; const pv = prevP.get(p.id); if (pv) { const vz = (p.p[2] - pv[1]) * 20; const pz = prevVz.get(p.id); if (pz != null && Math.abs(vz) > 0.3 && Math.abs(pz) > 0.3 && Math.sign(vz) !== Math.sign(pz)) o.vib++; if (Math.abs(vz) > 0.3) prevVz.set(p.id, vz); } prevP.set(p.id, [p.p[0], p.p[2]]); } if (!st.restart) o.vibMin += 1 / 20 / 60; }
    if (st.restart || i % 12) continue; const poss = st.possession.team; if (poss < 0) continue; const def = 1 - poss;
    const c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null; if (!c) continue;
    const champ = (t) => st.players.filter((p) => p.team === t && !p.keeper && p.down <= 0);
    const ogP = st.pitch.ownGoal(poss), sP = ogP.sign; const xb = (st.ball.p[0] - ogP.x) * -sP; const band = 'B' + Math.min(6, Math.max(1, Math.ceil(xb / 17.5)));
    const P = champ(poss), D = champ(def); if (P.length < 8 || D.length < 8) continue;
    const mAtk = momentDuJeu(st, poss, 6), mDef = momentDuJeu(st, def, 6);
    const xsP = P.map((p) => p.p[0]), zsP = P.map((p) => p.p[2]);
    if (mAtk === 'attaque-placée') {
      (o.len[band] ??= []).push(Math.max(...xsP) - Math.min(...xsP)); (o.wid[band] ??= []).push(Math.max(...zsP) - Math.min(...zsP));
      const gk = st.players.find((p) => p.team === poss && p.keeper); if (gk) (o.gk[band] ??= []).push(Math.min(...P.map((p) => Math.hypot(p.p[0] - gk.p[0], p.p[2] - gk.p[2]))));
      const pts = P.map((p) => [p.p[0], p.p[2]]); const H = hull(pts); const hs = new Set(H.map((h) => h.join(','))); const inner = pts.filter((p) => !hs.has(p.join(','))); const H2 = hull(inner);
      (o.ext[H.length] = (o.ext[H.length] ?? 0) + 1); (o.int[H2.length] = (o.int[H2.length] ?? 0) + 1); const aP = area(H); o.aireP.push(aP); if (inner.length >= 3) o.ratio.push(area(H2) / aP);
      const cx = xsP.reduce((a, b) => a + b, 0) / P.length, cz = zsP.reduce((a, b) => a + b, 0) / P.length; o.strP.push(P.reduce((a, p) => a + Math.hypot(p.p[0] - cx, p.p[2] - cz), 0) / P.length);
      // 13/14 couloirs (largeur / 5) — équipe en possession
      const w = st.pitch.hz * 2 / 5; const cnt = [0, 0, 0, 0, 0]; for (const p of P) cnt[Math.min(4, Math.max(0, Math.floor((p.p[2] + st.pitch.hz) / w)))]++; o.c15N++; if (cnt[0] >= 1 && cnt[4] >= 1) o.c15++; o.troisN++; if (cnt.some((k) => k >= 3)) o.trois++;
      // 15 distance au plus proche partenaire
      for (const p of P) { let bd = 99; for (const q of P) if (q !== p) bd = Math.min(bd, Math.hypot(q.p[0] - p.p[0], q.p[2] - p.p[2])); o.near.push(bd); }
      // 18 immobilité active : joueurs à > 30 m du ballon restant à ± 3 m d'un point
      for (const p of P) { const d = Math.hypot(p.p[0] - st.ball.p[0], p.p[2] - st.ball.p[2]); const s = still.get(p.id); if (d > 30) { if (!s) still.set(p.id, { x: p.p[0], z: p.p[2], t0: st.t }); else if (Math.hypot(p.p[0] - s.x, p.p[2] - s.z) > 3) { o.immob.push(st.t - s.t0); still.set(p.id, { x: p.p[0], z: p.p[2], t0: st.t }); } } else if (s) { o.immob.push(st.t - s.t0); still.delete(p.id); } }
    }
    if (mDef === 'défense-placée') { const pts = D.map((p) => [p.p[0], p.p[2]]); o.aireD.push(area(hull(pts))); const cx = D.reduce((a, p) => a + p.p[0], 0) / D.length, cz = D.reduce((a, p) => a + p.p[2], 0) / D.length; o.strD.push(D.reduce((a, p) => a + Math.hypot(p.p[0] - cx, p.p[2] - cz), 0) / D.length);
      // 23 : x du 2e défenseur le plus reculé (ligne des D) vs 2e adversaire le plus reculé toutes lignes (ligne de hors-jeu)
      const ogD = st.pitch.ownGoal(def), sD = ogD.sign; const xs = D.filter((p) => p.post < 4).map((p) => (p.p[0] - ogD.x) * -sD).sort((a, b) => a - b); const all = D.map((p) => (p.p[0] - ogD.x) * -sD).sort((a, b) => a - b); if (xs.length >= 2) o.lineGap.push(xs[1] - all[1]); }
    const gx = (t) => { const T = champ(t); return [T.reduce((a, p) => a + p.p[0], 0) / T.length, T.reduce((a, p) => a + p.p[2], 0) / T.length]; }; const g0 = gx(0), g1 = gx(1); o.gcX.push(Math.abs(g0[0] - g1[0])); o.gcZ.push(Math.abs(g0[1] - g1[1]));
  }
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }; const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const bands = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6']; const row = (m) => bands.map((b) => (m[b] ? mean(m[b]).toFixed(0) : '–')).join(' / ');
const dist = (m) => { const tot = Object.values(m).reduce((a, b) => a + b, 0); return Object.entries(m).sort().map(([k, v]) => `${k}:${(100 * v / tot).toFixed(0)}%`).join(' '); };
console.log(`${o.n} × 90 min`);
console.log(`1   longueur en possession par bande B1→B6 : ${row(o.len)} m (cible 42/39/37/36/39/46, forme en U)`);
console.log(`2   largeur en possession par bande : ${row(o.wid)} m (cible 41/44/45/45/42/41, max en B2-B4)`);
console.log(`3   gardien ↔ partenaire le plus proche par bande : ${row(o.gk)} m (cible 12/16/23/27/31/33, croissante)`);
console.log(`4   ratio des enveloppes (interne / externe) : p50 ${q(o.ratio, 0.5).toFixed(2)} (mode 0,18, plafond 0,50), > 0,5 sur ${(100 * o.ratio.filter((r) => r > 0.5).length / o.ratio.length).toFixed(1)} % ; 5 couches : externe ${dist(o.ext)} (cible 5:24 6:42 7:24), interne ${dist(o.int)} (3:12 4:51 5:32)`);
console.log(`6   aire convexe : possession p50 ${q(o.aireP, 0.5).toFixed(0)} m² (cible 968-1 408), hors possession ${q(o.aireD, 0.5).toFixed(0)} (805-1 158) ; 7 stretch : possession p50 ${q(o.strP, 0.5).toFixed(1)} m (13-16), hors possession ${q(o.strD, 0.5).toFixed(1)} (8-10)`);
console.log(`13  C1 et C5 occupés (possession installée) : ${(100 * o.c15 / o.c15N).toFixed(0)} % (cible > 85) ; 14 ≥ 3 corps dans un couloir : ${(100 * o.trois / o.troisN).toFixed(0)} % (cible < 8)`);
console.log(`15  distance au plus proche partenaire (possession) : p5 ${q(o.near, 0.05).toFixed(1)} m (cible 6-9), p1 ${q(o.near, 0.01).toFixed(1)} (≥ 3), p50 ${q(o.near, 0.5).toFixed(1)}`);
console.log(`17  vibration (changements de signe de la vitesse latérale) : ${(o.vib / 20 / o.vibMin).toFixed(1)} / joueur / min (cible < 12 ; > 25 échec)`);
console.log(`18  immobilité active (à > 30 m du ballon, ± 3 m) : épisode p50 ${q(o.immob, 0.5).toFixed(1)} s, p90 ${q(o.immob, 0.9).toFixed(1)}, ≥ 6 s dans ${(100 * o.immob.filter((t) => t >= 6).length / o.immob.length).toFixed(0)} % des épisodes (cible ≥ 6 s au moins 1 fois par possession installée)`);
console.log(`22  distance entre barycentres : longitudinale p50 ${q(o.gcX, 0.5).toFixed(1)} m (cible 4-12), latérale p50 ${q(o.gcZ, 0.5).toFixed(1)} (0-4), > 20 m sur ${(100 * o.gcX.filter((d) => d > 20).length / o.gcX.length).toFixed(1)} % des images`);
console.log(`23  ligne des D (2e plus reculé) − ligne de hors-jeu (2e plus reculé toutes lignes) : p50 ${q(o.lineGap, 0.5).toFixed(1)} m, p90 ${q(o.lineGap, 0.9).toFixed(1)} (cible 0-4 ; le moteur arbitre sur le second : offside.js)`);
