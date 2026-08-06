#!/usr/bin/env node
// verify-sync.mjs — ALL-SYNC : les trois copies du moteur sont UN moteur.
//
// Le choix architectural assumé du dépôt : le moteur vit en trois exemplaires (showcase, le
// starter du skill — qui DOIT être autonome, c'est le produit —, soldier-volley), synchronisés
// par copie. C'est le compromis « chaque exemple est un dépôt-échantillon complet » contre le
// risque de divergence silencieuse. Ce banc transforme la discipline en CLAUSE : un oubli de cp
// n'est plus un bug latent découvert trois sessions plus tard (les bancs importent depuis le
// starter — tester une copie en croyant tester l'autre est déjà arrivé), c'est un rouge immédiat.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const COPIES = [
  join(REPO, 'examples', 'showcase', 'src', 'engine'),
  join(REPO, 'skills', 'threejs-aaa', 'assets', 'starter', 'src', 'engine'),
  join(REPO, 'examples', 'soldier-volley', 'src', 'engine'),
];

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const md5 = (p) => createHash('md5').update(readFileSync(p)).digest('hex');

const ref = COPIES[0];
const files = readdirSync(ref).filter((f) => f.endsWith('.js')).sort();
ok(`la copie de référence (showcase) compte ${files.length} modules (≥ 60)`, files.length >= 60);

for (const copy of COPIES.slice(1)) {
  const label = copy.includes('starter') ? 'starter (le produit du skill)' : 'soldier-volley';
  const missing = files.filter((f) => !existsSync(join(copy, f)));
  const diverged = files.filter((f) => existsSync(join(copy, f)) && md5(join(ref, f)) !== md5(join(copy, f)));
  const extra = readdirSync(copy).filter((f) => f.endsWith('.js') && !files.includes(f));
  ok(`${label} : aucun module manquant`, missing.length === 0, missing.join(', '));
  ok(`${label} : aucun module divergent (md5)`, diverged.length === 0, diverged.join(', '));
  ok(`${label} : aucun module orphelin (présent là-bas, absent de la référence)`, extra.length === 0, extra.join(', '));
}

// ---- LA VOLUMÉTRIE EST UNE DETTE COMME UNE AUTRE (lot 16) : un module au-delà du plafond
// n'est plus maintenable ni réutilisable — il se DÉCOUPE en familles cohésives (match-sim
// 1 575 → 1 160 + referee 285 + shooting 158, au bit près). rondo-sim (1 884) est la dette
// nommée : le cœur prouvé par 40 clauses se découpera avec le même soin, pas à la hache.
{
  // …l'exception rondo-sim (1950) est MORTE au lot 21 : le cœur découpé (1 885 → 1 092 +
  // skills-sim 518 + strike-sim 313, au bit près) vit sous le plafond commun — plus de
  // grand-père, une seule loi pour tous les modules.
  const PLAFOND = 1250;
  const gros = files.map((f) => [f, readFileSync(join(ref, f), 'utf8').split('\n').length])
    .filter(([, n]) => n > PLAFOND);
  ok(`aucun module au-delà du plafond de volumétrie (${PLAFOND} lignes — sans exception depuis le découpage du cœur)`,
    gros.length === 0, gros.map(([f, n]) => `${f}: ${n}`).join(', '));
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
