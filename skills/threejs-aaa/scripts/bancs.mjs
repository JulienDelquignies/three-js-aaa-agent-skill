// LE RUNNER DES BANCS (lot 174 — retour utilisateur : « le banc est super long ») : les
// 85 blocs de verify-match11 se shardent en N processus (BANC_SHARDS/BANC_SHARD, round-robin)
// et les 7 bancs rapides s'y joignent — une file de concurrence à la taille des cœurs.
// Mur d'horloge ≈ total ÷ cœurs. `node bancs.mjs` remplace la tournée séquentielle.
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';

const SH = +(process.env.BANC_SHARDS ?? Math.max(2, Math.min(6, cpus().length)));
const jobs = [];
for (let i = 0; i < SH; i++) jobs.push({ name: `match11 ${i + 1}/${SH}`, args: ['verify-match11.mjs'], env: { BANC_SHARDS: String(SH), BANC_SHARD: String(i) } });
for (const b of ['verify-match.mjs', 'verify-rondo.mjs', 'verify-gestes.mjs', 'verify-menace.mjs', 'verify-frappes.mjs', 'verify-sync.mjs', 'verify-attributes.mjs'])
  jobs.push({ name: b.replace('verify-', '').replace('.mjs', ''), args: [b] });

const run = (j) => new Promise((res) => {
  const p = spawn('node', j.args, { env: { ...process.env, ...(j.env ?? {}) }, cwd: import.meta.dirname });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('close', (code) => res({ ...j, code, out }));
});

const t0 = Date.now();
const conc = +(process.env.BANC_CONC ?? cpus().length);
const queue = [...jobs];
const results = [];
await Promise.all(Array.from({ length: conc }, async () => { while (queue.length) results.push(await run(queue.shift())); }));

let pass = 0, fail = 0;
const fails = [];
for (const r of results) {
  const m = [...r.out.matchAll(/(\d+) ✓ \/ (\d+) ✗/g)].pop();
  if (m) { pass += +m[1]; fail += +m[2]; }
  for (const line of r.out.split('\n')) if (line.startsWith('✗')) fails.push(`[${r.name}] ${line}`);
  if (!m || r.code !== 0) fails.push(`[${r.name}] sortie illisible ou code ${r.code}`);
}
for (const f of fails) console.log(f);
console.log(`\nTOTAL ${pass} ✓ / ${fail} ✗ — ${((Date.now() - t0) / 1000).toFixed(0)} s (${SH} shards, ${conc} fils)`);
process.exit(fail || fails.length ? 1 : 0);
