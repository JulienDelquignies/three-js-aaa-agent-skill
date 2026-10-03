// garde-corps.mjs — LA GARDE DU CORPS SEUL : le mode intentions ACTIVÉ mais sans intention posée = le même match au bit (l'empreinte de
// determinisme.mjs, 2 000 pas, graine 7, l'ancien chrono 0,027). Attendu : h = 1616609301. Les animations ajoutées au paquet (gestes/,
// gestes/course/) ne doivent rien y changer : le corps ne les joue que sur demande (specialvar1) ; un correctif C++ armé par l'intention
// seule non plus (patch.py).
//   node bancs/garde-corps.mjs
import GpfModule from '../out/gpf.mjs';
const OUT = new URL('../out/', import.meta.url).pathname;
const M = await GpfModule({ print: () => {}, printErr: () => {}, locateFile: (p) => OUT + p });
M._gf_init(1, 0.027); M._gf_reset(7, 1.0, 1.0, 1e9); M._gf_intents(1); M._gf_step(2000);
const HEAD = M._gf_frame_head(), PER = M._gf_frame_per();
const F = new Float32Array(M.HEAPF32.buffer, M._gf_frame(), HEAD + 22 * PER).slice();
let h = 0; for (let k = 0; k < 22; k++) { const o = HEAD + k * PER; h = (h * 31 + Math.round(F[o + 2] * 1000)) | 0; h = (h * 31 + Math.round(F[o + 3] * 1000)) | 0; }
const ev = M._gf_events(), n = M._gf_events_n(); const E = new Float32Array(M.HEAPF32.buffer, ev, n * 8).slice();
const types = {}; for (let i = 0; i < n; i++) types[E[i * 8]] = (types[E[i * 8]] ?? 0) + 1;
console.log('intentions actives, aucune posée', JSON.stringify({ t: F[0], ball: [F[6], F[7], F[8]].map((v) => v.toFixed(4)), h }), 'événements', n, JSON.stringify(types), h === 1616609301 ? '→ LA GARDE TIENT' : '→ LA GARDE EST ROMPUE (attendu 1616609301)');
