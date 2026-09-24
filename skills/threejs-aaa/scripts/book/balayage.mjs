// balayage.mjs — LA SENSIBILITÉ (23/09 : sept lois locales n'ont pas bougé les passes par séquence) : chaque ligne « nom|json » d'un
// fichier de configurations est jouée par une sonde (sonde-298 par défaut) sur les graines données, 4 processus en parallèle, un
// journal par (nom, graine). usage : node balayage.mjs cfgs.txt dossier [durée par période] [graines] [sonde]
import { readFileSync, writeFileSync } from 'node:fs'; import { spawn } from 'node:child_process';
const [,, cfgFile, outDir, dur = '1350', seedsArg = '3,7', probe = 'sonde-298.mjs'] = process.argv;
const jobs = []; for (const l of readFileSync(cfgFile, 'utf8').split('\n').filter((x) => x.trim() && !x.startsWith('#'))) { const [nm, js] = l.split('|'); for (const s of seedsArg.split(',')) jobs.push({ nm, js, s }); }
let i = 0; const run = () => new Promise((res) => { const next = () => { if (i >= jobs.length) return res(); const j = jobs[i++];
  const p = spawn('node', [probe, j.s, j.js, dur], { cwd: '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/scripts/book' }); let out = '';
  p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d)); p.on('close', () => { writeFileSync(`${outDir}/${j.nm}-${j.s}.log`, out); next(); }); }; next(); });
await Promise.all([run(), run(), run(), run()]);
