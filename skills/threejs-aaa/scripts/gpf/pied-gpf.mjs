// LE PIED DE GAMEPLAY FOOTBALL DANS SA PROPRE CINÉMATIQUE : les sommets de foot.ase (le pied rigide du joueur GPF, repère de la
// cheville) portés par la FK GPF, image par image — le point le plus bas contre le sol (z = 0 du nœud player ; la pose droite pose
// la semelle à −2,4 cm : cheville 0,09 m, semelle 0,114 sous elle). Sert à départager : un pied du port sous la pelouse vient-il
// de l'animation d'origine ou du port ? Usage : node pied-gpf.mjs <foot.ase> <clé gpf-data | chemin .anim> [clé2 à enchaîner]
import { readFileSync } from 'node:fs';
import { parseGpfAnim, sampleGpf, fkGpf, concatGpf, GPF_FPS } from '../../../../examples/showcase/src/engine/gpf-anim.js';
import { GPF_ANIMS } from '../../../../examples/showcase/src/engine/gpf-data.js';
import { applyQuat } from '../../../../examples/showcase/src/engine/vecmath.js';
const [ASE, K1, K2] = process.argv.slice(2);
const V = [...readFileSync(ASE, 'utf8').matchAll(/\*MESH_VERTEX\s+\d+\s+([-\d.e]+)\s+([-\d.e]+)\s+([-\d.e]+)/g)].map((m) => [+m[1], +m[2], +m[3]]);
const load = (k) => parseGpfAnim(GPF_ANIMS[k] ?? readFileSync(k, 'utf8'));
const A = K2 ? concatGpf(load(K1), load(K2)) : load(K1);
const S0 = fkGpf(sampleGpf({ ...A, tracks: {}, player: [] }, 0));   // la pose droite
const low = (W) => { let m = Infinity, who = ''; for (const s of ['left', 'right']) { const a = W[`${s}_ankle`]; for (const v of V) { const z = a.p[2] + applyQuat(v, a.q)[2]; if (z < m) { m = z; who = s; } } } return [m, who]; };
console.log(`pose droite : semelle à ${(low(S0)[0] * 100).toFixed(1)} cm`);
let worst = [Infinity, '', 0]; const trace = [];
for (let f = 0; f < A.frames; f++) { const [z, who] = low(fkGpf(sampleGpf(A, f))); if (z < worst[0]) worst = [z, who, f]; if (f % 10 === 0) trace.push(`${(f / GPF_FPS).toFixed(2)}:${(z * 100).toFixed(1)}`); }
console.log(`le plus bas : ${(worst[0] * 100).toFixed(1)} cm (pied ${worst[1]}, ${(worst[2] / GPF_FPS).toFixed(2)} s) · trace (s:cm) ${trace.join(' ')}`);
