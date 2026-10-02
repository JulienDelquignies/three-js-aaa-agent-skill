// Déterminisme : graine 7, 2000 pas après reset — l'empreinte des positions des 22 joueurs et le ballon. Le même calcul dans un
// navigateur doit donner les mêmes nombres (le libm est compilé dans le module : pas de Math.* du moteur JavaScript).
// Usage : node determinisme.mjs
const OUT = process.env.OUT || 'out';   // OUT=out-js : la variante aux exceptions émulées en JavaScript (EH=js ./build.sh)
const { default: GpfModule } = await import(`./${OUT}/gpf.mjs`);
const M = await GpfModule({ print: () => {}, printErr: () => {}, locateFile: (p) => new URL(`./${OUT}/` + p, import.meta.url).pathname });
M._gf_init(1, 0.027); M._gf_reset(7, 1.0, 1.0, 1e9); M._gf_step(2000);
const HEAD = M._gf_frame_head(), PER = M._gf_frame_per();
const F = new Float32Array(M.HEAPF32.buffer, M._gf_frame(), HEAD + 22 * PER).slice();
let h = 0; for (let k = 0; k < 22; k++) { const o = HEAD + k * PER; h = (h * 31 + Math.round(F[o + 2] * 1000)) | 0; h = (h * 31 + Math.round(F[o + 3] * 1000)) | 0; }
console.log('node', JSON.stringify({ t: F[0], ball: [F[6], F[7], F[8]].map((v) => v.toFixed(4)), h }));
