// animations.mjs — LE RELEVÉ DES ANIMATIONS DU CORPS sur un match : pour chaque animation de la collection de Gameplay
// Football, combien de fois elle a été candidate au tri grossier (CrudeSelection), gardée après les filtres de direction,
// jouée par un joueur, jouée par un officiel (le relevé du C++, patch.py étape 10 ; il ne change rien au match).
//   node bancs/animations.mjs [minutes=90] [graine=7] [mode=cerveau|ia] [sortie.json]
// Le match est celui de match-cerveau.mjs : l'horloge du match, la mi-temps, notre cerveau des deux côtés (ou leur IA).
// La sortie : { mode, graine, minutes, noms: [...], etages: [candidate[], gardee[], joueur[], officiel[]] } — un indice
// par animation ; bancs/animations-bilan.mjs les rassemble par fichier.
import { writeFileSync } from 'node:fs';
import { chargerLeCorps } from '../corps.mjs';
import { creerCerveau } from '../cerveau.mjs';
const MIN = +(process.argv[2] ?? 90), GRAINE = +(process.argv[3] ?? 7), MODE = process.argv[4] ?? 'cerveau';
const SORTIE = process.argv[5] ?? `animations-${MODE}-${GRAINE}.json`;
const corps = await chargerLeCorps();
corps.lancer({ graine: GRAINE, intentions: true, ...(process.env.ARRETS === '0' ? { arrets: null } : {}) });
const cerveau = MODE === 'cerveau' ? creerCerveau({ graine: GRAINE }) : null;
const M = corps.M;
M._gf_anim_raz();
const FIN = MIN * 60000, t0 = performance.now();
let miTemps = false;
while (corps.etat().t < FIN) {
  const e = corps.etat();
  if (!miTemps && e.t >= FIN / 2) { corps.miTemps(); miTemps = true; }
  if (cerveau && e.enJeu && !e.cpa) { const d = cerveau.decider(e); for (const i of d) corps.intention(i.id, i); corps.fautes(d.fautes); }
  corps.avancer(10);
  const evs = corps.journal(); cerveau?.observer(evs);
}
const n = M._gf_anims_n();
const nom = (i) => { const p = M._gf_anim_nom(i); let f = p; while (M.HEAPU8[f]) f++; return new TextDecoder().decode(M.HEAPU8.subarray(p, f)); };
const noms = Array.from({ length: n }, (_, i) => nom(i));
const etages = [0, 1, 2, 3].map(k => Array.from(new Int32Array(M.HEAP32.buffer, M._gf_anim_releve(k), n)));
writeFileSync(SORTIE, JSON.stringify({ mode: MODE, graine: GRAINE, minutes: MIN, score: corps.etat().score, noms, etages }));
const joues = etages[2].filter(x => x > 0).length;
console.log(`RELEVÉ ${MODE} graine ${GRAINE}, ${MIN} min (${((performance.now() - t0) / 1000).toFixed(0)} s) : ${n} animations en mémoire, ${joues} jouées par les joueurs, ${etages[3].filter(x => x > 0).length} par les officiels → ${SORTIE}`);
