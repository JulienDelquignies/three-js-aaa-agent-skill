// Banc Node du module WebAssembly : un match IA contre IA, la vitesse (ms par pas de 10 ms), et des preuves de vie
// (le ballon et les joueurs bougent, le score, la possession), la distribution du coût d'un pas (p50, p95, p99, max).
// Usage : node bench-node.mjs [secondes de jeu=60] [graine=7] [match_duration=0.027 — 4,75 : le chrono à l'heure, 90 vraies minutes]
const OUT = process.env.OUT || 'out';   // OUT=out-js : la variante aux exceptions émulées en JavaScript (EH=js ./build.sh)
const { default: GpfModule } = await import(`./${OUT}/gpf.mjs`);
const SECS = +(process.argv[2] ?? 60), SEED = +(process.argv[3] ?? 7), MD = +(process.argv[4] ?? 0.027);
const t0 = performance.now();
const M = await GpfModule({ print: (s) => process.stdout.write('[gpf] ' + s + '\n'), printErr: (s) => process.stdout.write('[gpf!] ' + s + '\n'), locateFile: (p) => new URL(`./${OUT}/` + p, import.meta.url).pathname });
M._gf_init(1, MD);
const tInit = performance.now();
M._gf_reset(SEED, 1.0, 1.0, 1e9);
const tReset = performance.now();
const HEAD = M._gf_frame_head(), PER = M._gf_frame_per(), POSE = M._gf_pose_per();
const frame = () => new Float32Array(M.HEAPF32.buffer, M._gf_frame(), HEAD + 22 * PER).slice();
let f0 = frame(), steps = SECS * 100, dist = 0, prev = f0, owners = new Set();
const dts = new Float32Array(steps);
const tS = performance.now();
for (let i = 0; i < steps; i++) {
  const a0 = performance.now(); M._gf_step(1); dts[i] = performance.now() - a0;
  if (i % 10 === 9) { const f = frame(); for (let k = 0; k < 22; k++) { const a = HEAD + k * PER; dist += Math.hypot(f[a + 2] - prev[a + 2], f[a + 3] - prev[a + 3]); } if (f[9] >= 0) owners.add(`${f[9]}:${f[10]}`); prev = f; }
}
const tE = performance.now(), f = frame();
const pose = new Float32Array(M.HEAPF32.buffer, M._gf_pose(), 22 * POSE).slice();
console.log(`init ${(tInit - t0).toFixed(0)} ms · reset ${(tReset - tInit).toFixed(0)} ms · ${steps} pas en ${((tE - tS) / 1000).toFixed(1)} s → ${((tE - tS) / steps).toFixed(3)} ms par pas de 10 ms (×${(10 / ((tE - tS) / steps)).toFixed(1)} le temps réel)`);
const srt = dts.slice().sort(), pc = (p) => srt[Math.min(steps - 1, Math.floor(p * steps))].toFixed(3);
console.log(`un pas : p50 ${pc(0.5)} · p95 ${pc(0.95)} · p99 ${pc(0.99)} · max ${srt[steps - 1].toFixed(1)} ms`);
console.log(`chrono ${f[0]} ms · score ${f[4]}-${f[5]} · ballon ${[f[6], f[7], f[8]].map((v) => v.toFixed(2))} · possesseurs vus ${owners.size} · distance cumulée 22 joueurs ${dist.toFixed(0)} m`);
console.log(`pose joueur 0 : racine ${[pose[0], pose[1], pose[2]].map((v) => v.toFixed(2))} · corps ${[...pose.slice(3, 7)].map((v) => v.toFixed(3))} · |q| ${Math.hypot(...pose.slice(3, 7)).toFixed(3)}`);
