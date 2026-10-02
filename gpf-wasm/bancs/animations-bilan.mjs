// animations-bilan.mjs — LE BILAN DU RELEVÉ DES ANIMATIONS (bancs/animations.mjs) : par fichier d'animation du corps
// (son miroir compris), sur tous les matchs relevés, les quatre étages du choix — candidate au tri grossier, gardée après
// les filtres de direction, jouée par un joueur, jouée par un officiel —, pour notre cerveau et pour leur IA, et pour celles
// que notre cerveau ne joue jamais, l'étage où elles tombent.
//   node bancs/animations-bilan.mjs <dossier des relevés> [sortie.md]
// Les courses générées au chargement (« autogen […] », 443 et leurs miroirs) viennent des 10 modèles du dossier
// movement/templates : elles comptent pour leurs modèles.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ICI = dirname(fileURLToPath(import.meta.url));
const DONNEES = join(ICI, '..', 'build', 'data');
const [DOSSIER, SORTIE] = process.argv.slice(2);

// les métadonnées d'un fichier : ses balises, la touche (image, position du ballon), la classe de vitesse du dossier
const balises = (s) => Object.fromEntries([...s.matchAll(/<([a-z_0-9]+)>\s*([\s\S]*?)\s*<\/\1>/g)].map((m) => [m[1], m[2].trim()]));
function meta(fichier) {
  const s = readFileSync(join(DONNEES, fichier.replace(/^\/?data\//, '')), 'utf8'), b = balises(s);
  const ext = s.match(/^extension,football,(\d+),([-\d.]+),([-\d.]+),([-\d.]+)/m);
  const rel = fichier.replace(/^\/?data\/media\/animations\//, '').replace(/^media\/animations\//, '');
  const parts = rel.split('/');
  let angle = null;
  if (b.balldirection) { const [x, y] = b.balldirection.split(',').map(Number); if (Math.abs(x) + Math.abs(y) > 1e-6) angle = Math.round(Math.acos(Math.max(-1, Math.min(1, -y / Math.hypot(x, y)))) * 180 / Math.PI); }
  return { rel, famille: parts[0], vitesse: parts.find((p) => ['idle', 'walk', 'dribble', 'sprint'].includes(p)) ?? '—',
    type: b.type ?? '—', derniere: b.lastditch === 'true' || parts.includes('lastditch'), special: parts.includes('special'),
    angle, hauteur: ext ? +(+ext[4]).toFixed(2) : null, specialvar1: b.specialvar1 ?? null, garde: b.incoming_retain_state ?? null,
    etat: b.incoming_special_state ?? null, tripType: b.triptype ?? null, tete: /header/.test(rel) };
}

const releves = readdirSync(DOSSIER).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(DOSSIER, f), 'utf8')));
const parFichier = new Map();
const cle = (nom) => nom.startsWith('autogen') ? 'movement/templates (courses générées)' : nom.replace(/_mirror$/, '');
for (const r of releves) for (let i = 0; i < r.noms.length; i++) {
  const k = cle(r.noms[i]);
  const e = parFichier.get(k) ?? { versions: new Set(), cerveau: [0, 0, 0, 0], ia: [0, 0, 0, 0] };
  e.versions.add(r.noms[i]);
  for (let s = 0; s < 4; s++) e[r.mode === 'ia' ? 'ia' : 'cerveau'][s] += r.etages[s][i];
  parFichier.set(k, e);
}
const matchs = { cerveau: releves.filter((r) => r.mode !== 'ia').length, ia: releves.filter((r) => r.mode === 'ia').length };
const minutes = releves.reduce((s, r) => s + r.minutes, 0);

// l'étage où une animation que notre cerveau ne joue pas tombe
function etage(c) {
  if (c[2] > 0 || c[3] > 0) return 'jouée';
  if (c[0] === 0) return 'jamais candidate';
  if (c[1] === 0) return 'écartée par les filtres de direction';
  return 'gardée, jamais choisie';
}
const lignes = [];
for (const [k, e] of parFichier) {
  const m = k.startsWith('movement/templates') ? { rel: k, famille: 'movement', vitesse: '—', type: 'movement' } : meta(k);
  lignes.push({ ...m, versions: e.versions.size, cerveau: e.cerveau, ia: e.ia, etage: etage(e.cerveau), etageIa: etage(e.ia) });
}
lignes.sort((a, b) => a.famille.localeCompare(b.famille) || a.rel.localeCompare(b.rel));

const out = [];
out.push(`# Le relevé des animations du corps — ${matchs.cerveau} matchs avec notre cerveau, ${matchs.ia} avec leur IA (${minutes} min d'horloge en tout)`);
out.push('');
const fam = {};
for (const l of lignes) {
  const f = (fam[l.famille] ??= { n: 0, joueCerveau: 0, joueIa: 0, etages: {} });
  f.n++; if (l.etage === 'jouée') f.joueCerveau++; if (l.etageIa === 'jouée') f.joueIa++;
  if (l.etage !== 'jouée') f.etages[l.etage] = (f.etages[l.etage] ?? 0) + 1;
}
out.push('| Dossier | Fichiers | Joués par notre cerveau | Joués par leur IA | Pas joués par notre cerveau : où ils tombent |');
out.push('|---|---|---|---|---|');
for (const [k, f] of Object.entries(fam)) out.push(`| ${k} | ${f.n} | ${f.joueCerveau} | ${f.joueIa} | ${Object.entries(f.etages).map(([e, n]) => `${e} ${n}`).join(' · ') || '—'} |`);
out.push('');
out.push('| Fichier | Type | Vitesse | Ballon (°, m) | Candidate | Gardée | Jouée (cerveau) | Jouée (leur IA) | Officiels | Notre cerveau |');
out.push('|---|---|---|---|---|---|---|---|---|---|');
for (const l of lignes) {
  const ballon = l.angle != null || l.hauteur != null ? `${l.angle ?? '—'}°, ${l.hauteur ?? '—'}` : '—';
  const marques = [l.derniere ? 'dernier recours' : null, l.special ? 'spéciale' : null, l.garde ? `ballon en main (${l.garde})` : null, l.etat ? `après une chute (${l.etat})` : null, l.specialvar1 ? `specialvar1 ${l.specialvar1}` : null, l.tripType ? `chute ${l.tripType}` : null, l.tete ? 'tête' : null].filter(Boolean).join(', ');
  out.push(`| ${l.rel}${marques ? ` (${marques})` : ''} | ${l.type} | ${l.vitesse} | ${ballon} | ${l.cerveau[0]} | ${l.cerveau[1]} | ${l.cerveau[2]} | ${l.ia[2]} | ${l.cerveau[3] + l.ia[3]} | ${l.etage} |`);
}
const texte = out.join('\n') + '\n';
if (SORTIE) writeFileSync(SORTIE, texte);
console.log(out.slice(0, 4 + Object.keys(fam).length).join('\n'));
const jamais = lignes.filter((l) => l.etage !== 'jouée');
console.log(`\n${lignes.length} fichiers (modèles de course comptés une fois) · notre cerveau en joue ${lignes.length - jamais.length}, leur IA ${lignes.filter((l) => l.etageIa === 'jouée').length} · pas joués par notre cerveau : ${jamais.length}${SORTIE ? ` → ${SORTIE}` : ''}`);
