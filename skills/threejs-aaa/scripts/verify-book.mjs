// verify-book — LE BOOK COMME TABLE DU RÉEL (docs/Book_vers_Moteur). Banc INFORMATIF : il imprime les mesures des
// sondes chapitre par chapitre et ne fait jamais rougir le sceau — la clause contractuelle viendra fiche par fiche
// (décision 4 du Plan_Route). Usage : node verify-book.mjs [nom] [graines] — sans nom, la liste ; `all` enchaîne tout
// (compter ~10 min par sonde de 2 × 90 min). Les sondes vivent dans ./book/ et importent le starter (../../assets).
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url)), dir = join(here, 'book');
const FICHES = {
  'sonde-ch01': 'Bible 01 cadre général', 'sonde-ch02': 'Bible 02 gardien', 'sonde-ch03': 'Bible 03 centraux', 'sonde-ch04': 'Bible 04 latéraux',
  'sonde-ch05': 'Bible 05 milieu défensif', 'sonde-ch06': 'Bible 06 relayeurs', 'sonde-ch07': 'Bible 07 meneur', 'sonde-ch08': 'Bible 08 ailiers',
  'sonde-ch09': 'Bible 09 avant-centre', 'sonde-ch10': 'Bible 10 bloc collectif', 'sonde-ch10b': 'Bible 10 bloc (reprise T5/T12/T17/T18)',
  'sonde-ch11': 'Bible 11 transitions', 'sonde-ch12': 'Bible 12 marquage', 'sonde-ch13': 'Bible 13 chorégraphie', 'sonde-ch14': 'Bible 14 micro-comportements',
  'sonde-ch15': 'Bible 15 duels', 'sonde-ch16': 'Bible 16 contexte', 'sonde-mc01': 'Modèle 01 boucle (4 × 600 s, deux pas)', 'sonde-mc02': 'Modèle 02 locomotion',
  'sonde-mc03': 'Modèle 03 ballon (sans match)', 'sonde-mc03b': 'Modèle 03 crise de traînée', 'sonde-mc0506': 'Modèle 05-06 espace et valeur (3 tactiques)',
  'sonde-mc0710': 'Modèle 07-10 passe et tir', 'sonde-mc1113': 'Modèle 11-13 duels, arbitrage, CPA', 'sonde-ref': 'Référentiel 01 portrait macro',
};
const args = process.argv.slice(2), name = args[0], seeds = args[1] ?? '3,7';
const files = readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort();
if (!name) { console.log('verify-book — sondes du book (informatif) :'); for (const f of files) console.log(`  ${f.replace('.mjs', '').padEnd(14)} ${FICHES[f.replace('.mjs', '')] ?? ''}`); console.log('node verify-book.mjs <nom|all> [graines=3,7]'); process.exit(0); }
const run = files.filter((f) => name === 'all' || f.replace('.mjs', '') === name);
if (!run.length) { console.error(`sonde inconnue : ${name}`); process.exit(2); }
let ok = 0; for (const f of run) { console.log(`\n=== ${f.replace('.mjs', '')} — ${FICHES[f.replace('.mjs', '')] ?? ''}`); const r = spawnSync(process.execPath, [join(dir, f), seeds], { stdio: 'inherit' }); if (r.status === 0) ok++; else console.log(`  (sonde sortie ${r.status})`); }
console.log(`\n${ok}/${run.length} sondes rendues — banc informatif : rien à faire rougir ici, les cibles vivent dans docs/Book_vers_Moteur.`);
process.exit(0);
