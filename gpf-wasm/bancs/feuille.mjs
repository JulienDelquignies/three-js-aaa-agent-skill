// feuille.mjs (banc) — LA FEUILLE DE MATCH, GARDÉE. Un match de notre cerveau dans leurs corps, la feuille (../feuille.mjs) branchée comme
// dans la page (après chaque avance : l'état, le journal, la mi-temps, le cerveau). Trois gardes :
//   1. ses comptes retrouvent le JOURNAL BRUT, compté ici sans elle : les buts (et le score du moteur), les tirs, les passes, les fautes,
//      les cartons (le second jaune fait un rouge), les hors-jeu, les corners ;
//   2. elle est en LECTURE SEULE : deux parties sur deux modules WebAssembly, l'une avec la feuille, l'autre sans — la même empreinte ;
//   3. son coût par avance (la page l'appelle à chaque pas).
// Puis le rapport de la skill (stats.js statsReport) : par équipe, et les mieux notés.
//   node bancs/feuille.mjs [minutes=20] [graine=7]
import { chargerLeCorps, EV, GESTE } from '../corps.mjs';
import { creerCerveau } from '../cerveau.mjs';
import { creerFeuille, nomsDesJoueurs } from '../feuille.mjs';
const MIN = +(process.argv[2] ?? 20), GRAINE = +(process.argv[3] ?? 7), FIN = MIN * 60000;
const PASSES = new Set([GESTE.PASSE_COURTE, GESTE.PASSE_LONGUE, GESTE.PASSE_HAUTE]);

async function jouer(avecFeuille) {
  const corps = await chargerLeCorps();
  corps.lancer({ graine: GRAINE, intentions: true });
  const cerveau = creerCerveau({ graine: GRAINE });
  const e0 = corps.etat();
  const feuille = avecFeuille ? creerFeuille({ etat: e0, noms: nomsDesJoueurs(GRAINE, e0) }) : null;
  const brut = { buts: [0, 0], tirs: [0, 0], passes: [0, 0], fautes: [0, 0], jaunes: [0, 0], rouges: [0, 0], horsJeu: [0, 0], corners: [0, 0] };
  const jaunes = new Map();
  let per = 1, ms = 0, n = 0, pas = 0;
  for (let tick = 0; ; tick++) {
    const e = corps.etat();
    if (per === 1 && e.t >= FIN / 2) { corps.miTemps(); per = 2; }
    if (e.t >= FIN) break;
    if (e.enJeu && !e.cpa) { const d = cerveau.decider(e); for (const i of d) corps.intention(i.id, i); corps.fautes(d.fautes); }
    corps.avancer(10); pas += 10;
    const j = corps.journal();
    cerveau.observer(j);
    for (const ev of j) {
      const q = ev.equipe;
      if (ev.type === EV.BUT) brut.buts[q]++;
      else if (ev.type === EV.TOUCHE && ev.b === GESTE.TIR) brut.tirs[q]++;
      else if (ev.type === EV.TOUCHE && PASSES.has(ev.b)) brut.passes[q]++;
      else if (ev.type === EV.FAUTE) {
        brut.fautes[q]++;
        if (ev.a === 2) { brut.jaunes[q]++; const k = (jaunes.get(ev.joueur) ?? 0) + 1; jaunes.set(ev.joueur, k); if (k === 2) brut.rouges[q]++; }
        if (ev.a === 3) brut.rouges[q]++;
      } else if (ev.type === EV.HORS_JEU) brut.horsJeu[q]++;
      else if (ev.type === EV.CPA && ev.a === 4) brut.corners[q]++;
    }
    if (feuille) { const a = performance.now(); feuille.observer(corps.etat(), j, { per, dt: 0.1, cerveau }); ms += performance.now() - a; n++; }
  }
  const fin = corps.etat();
  const empreinte = fin.joueurs.reduce((h, j) => ((h * 31 + Math.round(j.x * 1000)) * 31 + Math.round(j.y * 1000)) | 0, 0);
  return { feuille, brut, score: fin.score, empreinte, msParAvance: n ? ms / n : 0, simule: pas / 100 };
}

const t0 = performance.now();
const [A, B] = [await jouer(true), await jouer(false)];
const R = A.feuille.rapport(), E = R.equipes;
console.log(`FEUILLE — ${MIN} min d'horloge, graine ${GRAINE} (${((performance.now() - t0) / 1000).toFixed(0)} s de calcul ; feuille ${A.msParAvance.toFixed(3)} ms par avance de 10 pas)`);
// 1. les comptes
const cles = ['buts', 'tirs', 'passes', 'fautes', 'jaunes', 'rouges', 'horsJeu', 'corners'];
let ok = true;
for (const k of cles) {
  const f = [E[0][k], E[1][k]], b = A.brut[k];
  const bon = f[0] === b[0] && f[1] === b[1];
  if (!bon) ok = false;
  console.log(`  ${bon ? '✓' : '✗'} ${k.padEnd(8)} feuille ${f.join('-').padEnd(7)} journal ${b.join('-')}`);
}
const scoreOk = A.score[0] === E[0].buts && A.score[1] === E[1].buts;
console.log(`  ${scoreOk ? '✓' : '✗'} score du moteur ${A.score.join('-')} · feuille ${E[0].buts}-${E[1].buts}`);
// 2. la lecture seule
const memeMatch = A.empreinte === B.empreinte;
console.log(`  ${memeMatch ? '✓' : '✗'} lecture seule : empreinte avec la feuille ${A.empreinte}, sans ${B.empreinte}`);
// le rapport
const ligne = (lib, k, f = (v) => v) => console.log(`  ${lib.padEnd(26)} ${String(f(E[0][k])).padStart(7)}  ${String(f(E[1][k])).padStart(7)}`);
console.log('  — le rapport (stats.js) —');
ligne('possession %', 'possession'); ligne('xG', 'xg'); ligne('tirs', 'tirs'); ligne('cadrés', 'cadres'); ligne('contrés', 'contres'); ligne('arrêts', 'arrets');
ligne('passes', 'passes'); ligne('réussite %', 'reussite'); ligne('passes clés', 'passesCles'); ligne('dribbles réussis', 'dribblesReussis'); ligne('dribbles', 'dribbles');
ligne('récupérations', 'recuperations'); ligne('interceptions', 'interceptions'); ligne('fautes', 'fautes'); ligne('corners', 'corners'); ligne('hors-jeu', 'horsJeu');
const top = [...R.joueurs].filter((j) => j.note != null).sort((a, b) => b.note - a.note).slice(0, 3);
console.log(`  les mieux notés : ${top.map((j) => `${j.name} (${j.team === 0 ? 'gauche' : 'droite'}, ${j.post}) ${j.note}`).join(' · ')}`);
const km = R.joueurs.filter((j) => !j.keeper).map((j) => j.distance / 1000);
console.log(`  distance des joueurs de champ : ${(km.reduce((a, b) => a + b, 0) / km.length).toFixed(2)} km en moyenne sur ${MIN} min d'horloge (${(A.simule / 60).toFixed(1)} min simulées : ${(km.reduce((a, b) => a + b, 0) / km.length * 1000 / A.simule).toFixed(2)} m/s de moyenne) · buts : ${A.feuille.chronologie().filter((f) => f.k === 'but').map((f) => `${f.minute}' ${A.feuille.nom(f.by)}${f.csc ? ' (csc)' : ''}${f.passeur != null ? ` (passe ${A.feuille.nom(f.passeur)})` : ''}`).join(', ') || 'aucun'}`);
console.log(ok && scoreOk && memeMatch ? 'FEUILLE GARDÉE' : 'FEUILLE EN DÉFAUT');
if (!(ok && scoreOk && memeMatch)) process.exitCode = 1;
