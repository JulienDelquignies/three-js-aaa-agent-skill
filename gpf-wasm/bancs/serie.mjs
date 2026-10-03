// serie.mjs — LES SÉRIES DE MATCHS, LA RÈGLE DE MESURE DU LOT L2 : trier court, valider complet.
//   node bancs/serie.mjs [--court | --complet] [--graines 3,7,11,13,17,19,23,29] [--minutes M]
//                        [--variantes '{"base":{}, "essai":{"rayonCharge":4}}'] [--ia] [--dossier D]
// · COURT (défaut) : 8 graines × 20 min d'horloge (≈ 4 min de calcul sur 8 cœurs) — pour TRANCHER entre variantes ;
// · COMPLET : 8 graines × 90 min (≈ 15-18 min) — pour VALIDER ce que la série courte a retenu.
// Chaque variante est un jeu d'options du cerveau (creerCerveau({ options }), via CERVEAU_OPTIONS) ; --ia ajoute leur IA.
// Les matchs tournent en parallèle (un par cœur). LE CACHE : un match déjà joué avec le même code (cerveau, contrat, corps,
// module WebAssembly, banc), les mêmes options, la même graine et la même durée n'est pas rejoué — le moteur est déterministe.
// Les chiffres sont ramenés à 90 minutes ; le bruit d'un match de football est grand (les buts ± 1,7) : une différence de
// buts n'est lisible qu'au-delà de ≈ 1 but par match en série courte — la série complète tranche le reste.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url)), RACINE = join(ICI, '..');
const arg = (nom, defaut) => { const i = process.argv.indexOf('--' + nom); return i < 0 ? defaut : process.argv[i + 1]; };
const COMPLET = process.argv.includes('--complet');
const MIN = +(arg('minutes', COMPLET ? 90 : 20));
const GRAINES = arg('graines', '3,7,11,13,17,19,23,29').split(',').map(Number);
const VARIANTES = JSON.parse(arg('variantes', '{"base":{}}'));
if (process.argv.includes('--ia')) VARIANTES.ia = '__ia';
const DOSSIER = arg('dossier', join(tmpdir(), 'gpf-series'));
mkdirSync(DOSSIER, { recursive: true });

// l'empreinte du code : tout ce qui change un match
const empreinte = createHash('sha1');
for (const f of ['cerveau.mjs', 'face.mjs', 'contrat.mjs', 'corps.mjs', 'out/gpf.wasm', 'bancs/match-cerveau.mjs']) empreinte.update(readFileSync(join(RACINE, f)));
const CODE = empreinte.digest('hex').slice(0, 10);

const travaux = [];
for (const [nom, opts] of Object.entries(VARIANTES)) for (const g of GRAINES) {
  const ia = opts === '__ia';
  const cle = createHash('sha1').update(JSON.stringify({ CODE, opts, g, MIN })).digest('hex').slice(0, 12);
  travaux.push({ nom, g, ia, opts, fichier: join(DOSSIER, `${nom}-${g}-${MIN}min-${cle}.txt`) });
}
const aFaire = travaux.filter(t => !existsSync(t.fichier) || !readFileSync(t.fichier, 'utf8').includes('tenue avant la passe'));
const t0 = Date.now();
console.log(`SÉRIE ${COMPLET ? 'COMPLÈTE' : 'COURTE'} — ${Object.keys(VARIANTES).length} variante(s) × ${GRAINES.length} graines × ${MIN} min · code ${CODE} · ${travaux.length - aFaire.length} match(s) en cache, ${aFaire.length} à jouer sur ${cpus().length} cœurs`);
await new Promise((fin) => {
  let enCours = 0, i = 0;
  const lance = () => {
    if (i >= aFaire.length && enCours === 0) return fin();
    while (enCours < cpus().length && i < aFaire.length) {
      const t = aFaire[i++]; enCours++;
      const env = { ...process.env, CERVEAU_OPTIONS: t.ia ? '{}' : JSON.stringify(t.opts) };
      const p = spawn(process.execPath, [join(ICI, 'match-cerveau.mjs'), String(MIN), String(t.g), t.ia ? 'ia' : 'cerveau'], { env, cwd: RACINE });
      let out = ''; p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (out += d));
      p.on('close', () => { writeFileSync(t.fichier, out); enCours--; lance(); });
    }
  };
  lance();
});

// ── LE TABLEAU : moyennes par match, ramenées à 90 min ─────────────────────────────────────────────────────────────────
const num = (re, s, k = 1) => { const m = s.match(re); return m ? +m[k] : NaN; };
const lignes = [];
for (const nom of Object.keys(VARIANTES)) {
  const M = travaux.filter(t => t.nom === nom).map(t => readFileSync(t.fichier, 'utf8')).filter(s => s.includes('tenue avant la passe'));
  const a = { n: M.length, buts: 0, nuls: 0, tirs: 0, xg: 0, butsTir: 0, jaunes: 0, fautes: 0, csc: 0, penalties: 0, eff: 0, passes: 0, reuss: 0, une: 0, surPasse: 0, butsJeu: 0, tele: 0, talon: 0, passesT: 0, tirsUne: 0, tirsT: 0, tetes: 0, butsTete: 0, faces: 0 };
  for (const s of M) {
    const sc = s.match(/score (\d+)-(\d+)/); a.buts += +sc[1] + +sc[2]; if (sc[1] === sc[2]) a.nuls++;
    a.csc += num(/dont (\d+) contre son camp/, s) || 0;
    a.tirs += num(/tirs : (\d+), xG/, s) || 0; a.xg += num(/xG de référence ([\d.]+)/, s) || 0; a.butsTir += num(/buts sur tir (\d+)/, s) || 0;
    const ja = s.match(/jaunes (\d+)\/(\d+)/); a.jaunes += +ja[1] + +ja[2];
    const fa = s.match(/fautes (\d+)\/(\d+)/); a.fautes += +fa[1] + +fa[2];
    const rem = JSON.parse(s.match(/remises (\{.*\})/)?.[1] ?? '{}'); a.penalties += rem.penalty ?? 0;
    a.eff += num(/temps de jeu effectif (\d+) %/, s);
    const pa = s.match(/passes (\d+) \/ (\d+) \(réussite (\d+|—) % \/ (\d+|—) %\)/);
    if (pa) { a.passes += +pa[1] + +pa[2]; a.reuss += (+pa[1] * (+pa[3] || 0) + +pa[2] * (+pa[4] || 0)) / 100; }
    a.une += num(/une touche : passes \d+\/\d+ \((\d+) %/, s) || 0;
    const bj = s.match(/buts : (\{[^}]*\})/); const nb = bj ? Object.values(JSON.parse(bj[1])).reduce((x, y) => x + y, 0) : 0;
    const sp = s.match(/sur passe (\d+|—) %/); if (sp && sp[1] !== '—') a.surPasse += Math.round(+sp[1] * nb / 100); a.butsJeu += nb;
    a.tele += num(/téléportations[^:]*: (\d+)/, s) || 0;
    const ta = s.match(/talonnades : (\d+)\/(\d+)/); if (ta) { a.talon += +ta[1]; a.passesT += +ta[2]; }
    const tu = s.match(/· tirs (\d+)\/(\d+) · têtes (\d+)/); if (tu) { a.tirsUne += +tu[1]; a.tirsT += +tu[2]; a.tetes += +tu[3]; }
    if (bj) a.butsTete += JSON.parse(bj[1])['tête'] ?? 0;
    a.faces += num(/face-à-face : (\d+) ·/, s) || 0;
  }
  const k = 90 / MIN, m = (x) => ((x / Math.max(1, a.n)) * k).toFixed(1);
  lignes.push({ nom, a, k, m });
}
const pc = (x, y) => (y ? (100 * x / y).toFixed(0) + ' %' : '—');
console.log(`\n${'variante'.padEnd(12)} matchs  buts   csc  b/xG  tirs  fautes jaunes pén.  passes  réussite  1-touche  sur-passe  talon.  tirs 1T  têtes  b.tête  eff.   nuls  télép.  f-à-f`);
for (const { nom, a, m } of lignes) {
  console.log(`${nom.padEnd(12)} ${String(a.n).padStart(5)}  ${m(a.buts).padStart(4)}  ${m(a.csc).padStart(4)}  ${(a.butsTir / Math.max(1e-9, a.xg)).toFixed(2).padStart(4)}  ${m(a.tirs).padStart(4)}  ${m(a.fautes).padStart(5)}  ${m(a.jaunes).padStart(5)}  ${m(a.penalties).padStart(4)}  ${m(a.passes).padStart(6)}  ${pc(a.reuss, a.passes).padStart(8)}  ${(a.une / Math.max(1, a.n)).toFixed(0).padStart(6)} %  ${pc(a.surPasse, a.butsJeu).padStart(9)}  ${pc(a.talon, a.passesT).padStart(6)}  ${pc(a.tirsUne, a.tirsT).padStart(7)}  ${m(a.tetes).padStart(5)}  ${pc(a.butsTete, a.butsJeu).padStart(6)}  ${(a.eff / Math.max(1, a.n)).toFixed(0).padStart(3)} %  ${String(a.nuls).padStart(2)}/${a.n}  ${String(a.tele).padStart(5)}  ${m(a.faces).padStart(5)}`);
}
console.log(`réel visé : buts 2,75 · b/xG ≈ 1 · tirs 26 ± 7 · fautes 21,5 · jaunes 3,9 · pén. ≈ 0,3 · passes ≈ 1 000 (≈ 17 par minute effective) à 80-85 % · une touche 15-25 % · sur passe ≈ 75 % · talonnades < 1 % · tirs en une touche ≈ 30 % (ordre de grandeur) · buts de la tête ≈ 15-20 % · effectif ≈ 64 % · nuls ≈ 25 % · ${Math.round((Date.now() - t0) / 1000)} s`);
