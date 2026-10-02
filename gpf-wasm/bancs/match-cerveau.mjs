// match-cerveau.mjs — UN MATCH, NOTRE CERVEAU DANS LEURS CORPS : la feuille de match et les critères du cadrage (§6).
//   node bancs/match-cerveau.mjs [minutes=10] [graine=7] [mode=cerveau|ia] [tactiqueA=equilibre] [tactiqueB=equilibre]
// mode « ia » : les mêmes corps, leur propre IA (la référence du lot L0). Les mesures :
//   · la feuille : buts, tirs, passes tentées et réussies, possession, fautes, cartons, hors-jeu ;
//   · « copains avec le ballon » (la définition du 2 octobre) : sur les conduites — le même joueur le plus proche du ballon
//     pendant ≥ 1,5 s, ballon au sol, joueur à ≥ 2 m/s —, la part du temps où le ballon est à plus de 1,5 m, et son décalage
//     latéral médian ;
//   · la téléportation : les sauts de plus de 3 m en 100 ms hors coups de pied arrêtés (un sprint en fait 0,9).
import { chargerLeCorps, EV, GESTE } from '../corps.mjs';
import { creerCerveau } from '../cerveau.mjs';
const MIN = +(process.argv[2] ?? 10), GRAINE = +(process.argv[3] ?? 7), MODE = process.argv[4] ?? 'cerveau';
const TACS = [process.argv[5] ?? 'equilibre', process.argv[6] ?? 'equilibre'];
const corps = await chargerLeCorps();
corps.lancer({ graine: GRAINE, intentions: true });
const cerveau = MODE === 'cerveau' ? creerCerveau({ graine: GRAINE, tactiques: TACS }) : null;

const f = { buts: [0, 0], tirs: [0, 0], passes: [0, 0], reussies: [0, 0], fautes: [0, 0], jaunes: [0, 0], rouges: [0, 0], horsJeu: [0, 0], poss: [0, 0] };
const PASSES = new Set([GESTE.PASSE_COURTE, GESTE.PASSE_LONGUE, GESTE.PASSE_HAUTE]);
let dernier = null, passeEnCours = null;
const conduites = { loin: 0, total: 0, lateral: [], porteLoin: 0, porteTotal: 0 };
let suivi = { id: null, depuis: 0 }, sauts = 0, prev = null, tDecide = 0, nDecide = 0;
const t0 = performance.now();

for (let tick = 0; tick < MIN * 600; tick++) {
  const e = corps.etat();
  if (cerveau && e.enJeu && !e.cpa) {
    const a = performance.now();
    for (const i of cerveau.decider(e, dernier?.equipe ?? null)) corps.intention(i.id, i);
    tDecide += performance.now() - a; nDecide++;
  }
  corps.avancer(10);
  const apres = corps.etat();
  for (const ev of corps.journal()) {
    if (ev.type === EV.BUT) f.buts[ev.equipe]++;
    else if (ev.type === EV.FAUTE) { f.fautes[ev.equipe]++; if (ev.a === 2) f.jaunes[ev.equipe]++; if (ev.a === 3) f.rouges[ev.equipe]++; }
    else if (ev.type === EV.HORS_JEU) f.horsJeu[ev.equipe]++;
    else if (ev.type === EV.TOUCHE) {
      if (ev.b === GESTE.TIR) f.tirs[ev.equipe]++;
      // une passe se juge à la touche suivante d'un AUTRE joueur : un coéquipier = réussie
      if (passeEnCours && ev.joueur !== passeEnCours.joueur) {
        if (ev.equipe === passeEnCours.equipe) f.reussies[passeEnCours.equipe]++;
        passeEnCours = null;
      }
      if (PASSES.has(ev.b)) { f.passes[ev.equipe]++; passeEnCours = ev; }
      dernier = ev;
    }
  }
  if (!apres.enJeu || apres.cpa) { prev = null; suivi = { id: null, depuis: 0 }; continue; }
  if (apres.possession.equipe === 0 || apres.possession.equipe === 1) f.poss[apres.possession.equipe]++;
  // la téléportation
  if (prev) for (const j of apres.joueurs) {
    const p = prev.get(j.id); if (p && Math.hypot(j.x - p[0], j.y - p[1]) > 3) sauts++;
  }
  prev = new Map(apres.joueurs.map(j => [j.id, [j.x, j.y]]));
  // les conduites
  const [bx, by, bz] = apres.ballon;
  let pres = null, pd = Infinity;
  for (const j of apres.joueurs) { const d = Math.hypot(j.x - bx, j.y - by); if (d < pd) { pd = d; pres = j; } }
  if (pres && pres.id !== suivi.id) suivi = { id: pres.id, depuis: apres.t };
  // …et la même mesure restreinte au PORTEUR déclaré par le moteur (le ballon possédé, pas un ballon libre poursuivi)
  const { equipe: pe, joueur: pj } = apres.possession;
  const porteur = pe >= 0 && pj >= 0 ? apres.joueurs.filter(j => j.equipe === pe)[pj] : null;
  if (porteur && porteur === pres && bz < 0.5 && pres.vitesse >= 2 && apres.t - suivi.depuis >= 1500) {
    conduites.porteTotal++; if (pd > 1.5) conduites.porteLoin++;
  }
  if (pres && bz < 0.5 && pres.vitesse >= 2 && apres.t - suivi.depuis >= 1500) {
    conduites.total++;
    if (pd > 1.5) conduites.loin++;
    const dir = [pres.v[0] / pres.vitesse, pres.v[1] / pres.vitesse];
    conduites.lateral.push(Math.abs((bx - pres.x) * -dir[1] + (by - pres.y) * dir[0]));
  }
}

const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const k = 90 / MIN, pc = (a, b) => (b ? (100 * a / b).toFixed(0) : '—');
const tot = f.poss[0] + f.poss[1];
console.log(`MATCH ${MODE === 'cerveau' ? 'NOTRE CERVEAU' : 'LEUR IA'} — ${MIN} min de jeu, graine ${GRAINE}${cerveau ? `, tactiques ${TACS.join(' c. ')}` : ''} (${((performance.now() - t0) / 1000).toFixed(0)} s de calcul${cerveau ? `, cerveau ${(tDecide / Math.max(1, nDecide)).toFixed(2)} ms par décision` : ''})`);
console.log(`  score ${f.buts[0]}-${f.buts[1]} · par 90 min : buts ${((f.buts[0] + f.buts[1]) * k).toFixed(1)} · tirs ${((f.tirs[0] + f.tirs[1]) * k).toFixed(0)}`);
console.log(`  passes ${f.passes[0]} / ${f.passes[1]} (réussite ${pc(f.reussies[0], f.passes[0])} % / ${pc(f.reussies[1], f.passes[1])} %) · par 90 min ${((f.passes[0] + f.passes[1]) * k).toFixed(0)}`);
console.log(`  possession ${pc(f.poss[0], tot)} % / ${pc(f.poss[1], tot)} % · fautes ${f.fautes.join('/')} · jaunes ${f.jaunes.join('/')} · rouges ${f.rouges.join('/')} · hors-jeu ${f.horsJeu.join('/')}`);
console.log(`  copains : ballon à > 1,5 m pendant ${pc(conduites.loin, conduites.total)} % des conduites (${conduites.total} échantillons), décalage latéral médian ${med(conduites.lateral).toFixed(2)} m ; porteur déclaré : ${pc(conduites.porteLoin, conduites.porteTotal)} % (${conduites.porteTotal})`);
console.log(`  téléportations (> 3 m en 100 ms, jeu en cours) : ${sauts}`);
