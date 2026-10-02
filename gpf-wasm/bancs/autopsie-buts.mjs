// autopsie-buts.mjs — CHAQUE BUT ET CE QUI L'A PRÉCÉDÉ : les touches des 6 dernières secondes (joueur, rôle, équipe, geste,
// genre de touche, position), le ballon, le mode de jeu au moment du but. Pour les buts qui ne viennent d'aucun tir.
//   node bancs/autopsie-buts.mjs [minutes=45] [graine=3] [mode=cerveau|ia]
import { chargerLeCorps, EV, GESTE } from '../corps.mjs';
import { creerCerveau } from '../cerveau.mjs';
const MIN = +(process.argv[2] ?? 45), GRAINE = +(process.argv[3] ?? 3), MODE = process.argv[4] ?? 'cerveau';
const corps = await chargerLeCorps();
corps.lancer({ graine: GRAINE, intentions: true });
const cerveau = MODE === 'cerveau' ? creerCerveau({ graine: GRAINE }) : null;
const NOM = Object.fromEntries(Object.entries(GESTE).map(([k, v]) => [v, k]));
const ROLE = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'LM', 'RM', 'AM', 'CF'];
const touches = [], cpas = [];
let dernierToucheur = null, intentions = new Map();
for (let pas = 0; pas < MIN * 6000; pas++) {
  if (pas % 10 === 0) {
    const e = corps.etat();
    if (cerveau && e.enJeu && !e.cpa) for (const i of cerveau.decider(e)) { corps.intention(i.id, i); intentions.set(i.id, i); }
  }
  corps.avancer(1);
  const ap = corps.etat();
  const evs = corps.journal(); cerveau?.observer(evs);
  for (const ev of evs) {
    if (ev.type === EV.TOUCHE) {
      dernierToucheur = ev.equipe;
      const j = ap.joueurs.find(k => k.id === ev.joueur);
      touches.push({ t: ev.t, equipe: ev.equipe, joueur: ev.joueur, role: ROLE[j?.role] ?? j?.role, geste: NOM[ev.b] ?? ev.b, genre: ev.a, x: j?.x, y: j?.y, intention: intentions.get(ev.joueur)?.genre });
    } else if (ev.type === EV.CPA) cpas.push({ t: ev.t, equipe: ev.equipe, mode: ev.a });
    else if (ev.type === EV.BUT) {
      const avant = touches.filter(k => k.t > ev.t - 6000);
      const cpa = cpas.filter(k => k.t > ev.t - 15000).at(-1);
      console.log(`BUT ${ap.score.join('-')} à ${(ev.t / 60000).toFixed(1)} min — équipe ${ev.equipe}, buteur ${ev.joueur}${ev.a ? ' (CONTRE SON CAMP)' : ''} · ballon (${ap.ballon.map(v => v.toFixed(1)).join(', ')}) · mode ${ap.mode}${cpa ? ` · dernier coup de pied arrêté : mode ${cpa.mode} pour l'équipe ${cpa.equipe}, ${((ev.t - cpa.t) / 1000).toFixed(1)} s avant` : ''}`);
      for (const k of avant) console.log(`    ${((k.t - ev.t) / 1000).toFixed(2)} s  éq ${k.equipe} #${k.joueur} ${k.role} ${k.geste} (touche ${k.genre}) en (${k.x?.toFixed(1)}, ${k.y?.toFixed(1)}) intention ${k.intention ?? '—'}`);
    }
  }
}
