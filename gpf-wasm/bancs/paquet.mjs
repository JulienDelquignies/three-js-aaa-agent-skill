// paquet.mjs — LA GARDE DU PAQUET : out/cerveau.mjs (empaqueté) et cerveau.mjs (les sources) jouent le même match, au bit près.
import { chargerLeCorps } from '../corps.mjs';
import { creerCerveau as source } from '../cerveau.mjs';
import { creerCerveau as paquet } from '../out/cerveau.mjs';
const corps = await chargerLeCorps();
const jouer = (creer) => {
  corps.lancer({ graine: 7, intentions: true });
  const cerveau = creer({ graine: 7 });
  for (let tick = 0; tick < 600; tick++) {
    const e = corps.etat();
    if (e.enJeu && !e.cpa) { const d = cerveau.decider(e); for (const i of d) corps.intention(i.id, i); corps.fautes(d.fautes); }
    corps.avancer(10);
    cerveau.observer(corps.journal());
  }
  return corps.etat().joueurs.reduce((h, j) => ((h * 31 + Math.round(j.x * 1000)) * 31 + Math.round(j.y * 1000)) | 0, 0);
};
const a = jouer(source), b = jouer(paquet);
console.log(`paquet ${a === b ? 'IDENTIQUE' : 'DIFFÉRENT'} aux sources (1 min, graine 7) : ${a} / ${b}`);
if (a !== b) process.exit(1);
