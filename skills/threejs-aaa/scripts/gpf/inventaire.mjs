// L'INVENTAIRE DES ANIMATIONS GPF, MESURÉ PAR CINÉMATIQUE DIRECTE : durée, image de touche, pied qui touche et distance
// cheville → ballon (la preuve que la FK et les axes sont justes : un pied de 25 cm touche un ballon de 11 cm de rayon à
// 10-20 cm de la cheville), vitesse d'entrée / de sortie de la racine, virage du bassin, bassin au plus bas, ballon au contact
// dans le repère du corps. Usage : node inventaire.mjs <dossier animations GPF> [motif=trap|ballcontrol|sliding]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseGpfAnim, sampleGpf, fkGpf, touchFoot, GPF_FPS, gpfQuat } from '../../../../examples/showcase/src/engine/gpf-anim.js';
import { applyQuat } from '../../../../examples/showcase/src/engine/vecmath.js';
const [DIR, MOTIF = '^(trap|ballcontrol|sliding|interfere)/'] = process.argv.slice(2);
const files = []; const walk = (d) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.anim')) files.push(p); } }; walk(DIR);
const cap = (q) => { const r = applyQuat([1, 0, 0], gpfQuat(q)); return Math.atan2(-r[2], r[0]) * 180 / Math.PI; };
const rows = [];
for (const f of files.sort()) {
  const rel = relative(DIR, f); if (!new RegExp(MOTIF).test(rel)) continue;
  const A = parseGpfAnim(readFileSync(f, 'utf8')), n = A.frames - 1;
  const p = (fr) => sampleGpf(A, fr).p, v = (a, b) => Math.hypot(p(b)[0] - p(a)[0], p(b)[1] - p(a)[1]) / ((b - a) / GPF_FPS);
  const vin = v(0, Math.min(6, n)), vout = v(Math.max(0, n - 6), n);
  const W0 = fkGpf(sampleGpf(A, 0)), WN = fkGpf(sampleGpf(A, n));
  let turn = cap(WN.body.q) - cap(W0.body.q); turn = ((turn + 540) % 360) - 180;
  let zmin = 0; for (let fr = 0; fr <= n; fr++) zmin = Math.min(zmin, sampleGpf(A, fr).p[2]);
  const tf = touchFoot(A); let ballBody = null;
  if (A.touch) { const S = sampleGpf(A, A.touch.f), W = fkGpf(S), b = A.touch.ball, d = [b[0] - W.body.p[0], b[1] - W.body.p[1]], c = cap(W.body.q) * Math.PI / 180;
    // repère GPF : avant −y, gauche +x ; le cap c tourne le corps autour de +Z (ry(c) côté personnage)
    const fwdG = [Math.sin(c), -Math.cos(c)], leftG = [Math.cos(c), Math.sin(c)];
    ballBody = { avant: +(d[0] * fwdG[0] + d[1] * fwdG[1]).toFixed(2), gauche: +(d[0] * leftG[0] + d[1] * leftG[1]).toFixed(2) }; }
  rows.push({ anim: rel, dur: +(n / GPF_FPS).toFixed(2), touche: A.touch ? +(A.touch.f / GPF_FPS).toFixed(2) : null, pied: tf?.foot ?? '-', cheville_ballon: tf ? +tf.dist.toFixed(2) : null, autre: tf ? +tf.other.toFixed(2) : null,
    vin: +vin.toFixed(1), vout: +vout.toFixed(1), virage: Math.round(turn), zmin: +zmin.toFixed(2), ballon: ballBody, ib: A.meta.incomingballdirection ?? A.meta.balldirection ?? '' });
}
for (const r of rows) console.log(JSON.stringify(r));
