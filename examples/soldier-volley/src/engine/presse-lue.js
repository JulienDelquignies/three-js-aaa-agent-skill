// presse-lue.js — LA PRESSION SE LIT AU TEMPS D'ARRIVÉE (289, cfg.presseLue && st.full — les retours du 17/09 et la demande « ultra
// réaliste sur les passes » : le grand livre des passes, sonde-289, 4 × 90 min, contre le tableau du book — Modèle 09 § 5.1 et § 7,
// Référentiel 02). La complétion globale est juste (83 % pour 82,5), mais le jeu PERD le ballon deux fois trop (235-260 pertes par
// équipe et par match pour 110-140), la moitié hors passe, et les séquences n'ont que 1,3 passe (3,5-5,1 au réel) : la passe n'a pas le
// temps de naître. sonde-289b/c : ~46 TACLES PIQUÉS réussis par équipe et par match (le réel ne connaît que 20-25 dépossessions de
// toutes sortes), le porteur tenait le ballon depuis 2,2 s p50, un adversaire à ≤ 3 m depuis 1,3 s, 82-87 % sans passe adoptée.
// sonde-289d : dans la seconde d'avant, le défenseur est à 1,6-1,95 m p50, une bonne passe existe (score médian 13, la barre est à 3,2
// ou 4,8) — mais le moteur croit le porteur AU CALME la moitié du temps (le calme était « personne à moins de 1,8 m » : il sert alors sa
// tenue calme de 1 à 2,5 s sous une barre de 4,8), et la moitié du temps il attend de se RETOURNER avec le ballon pour jouer en arrière
// (le retournement du 240b, jusqu'à 1,2 s) ; la passe d'urgence du ballon disputé est ensuite refusée (le ballon à 1,1 m du pied :
// « ancre », « technique ») et le défenseur pique. Le moteur possédait pourtant sa loi de pression : pressionDe (reception.js, 265),
// P = 1 − TTP / pressT, le temps d'arrivée du presseur le plus prompt (etaCourse, sa vitesse comprise), qui règle déjà la réception et
// l'erreur de passe. LA LOI : le porteur lit la même pression pour DÉCIDER — pressé si P ≥ seuil — et trois portes la suivent : (1) le
// CALME (rondo-sim : la tenue calme et la barre haute) n'est plus « personne à 1,8 m » mais « personne n'arrive » ; (2) le RETOURNEMENT
// n'attend pas sous pression (le porteur pressé joue sa passe arrière par le geste prompt, pas par un demi-tour ballon au pied) ; (3) le
// LIBRE de l'orientation de passe (strike-sim, 395 : le libre se tourne sur place) est le non-pressé, pas « personne à 2,2 m ».
// Attributs : anticipation (anticipF, [0,85 ; 1,15]) allonge l'horizon de lecture (pressT × anticipF : il voit venir plus tôt) ;
// composure (composureF, [1,30 ; 0,85], 1,075 à 50) relève le seuil (× 1,075 / composureF : le calme garde la tête plus longtemps).
// Tactique : le tempo (axe [0 ; 1], 0,5 l'identité) — le posé tolère plus (× pose), le vif relâche plus tôt (× vif). Rôles : rien.
// Clé absente : le calme à 1,8 m, le retournement et le libre d'hier au bit.
import { pressionDe } from './reception.js';
import { axe } from './tactics.js';

/** Le seuil de pression du porteur : base × sang-froid × tempo. Pure (1 exact à 50, tempo 0,5). */
export function seuilPresseDe(K, { composureF = 1.075, tempo = 0.5 } = {}) {
  return (K.seuil ?? 0.55) * (1.075 / composureF) * axe(tempo, K.pose ?? 1.15, K.vif ?? 0.85);
}

/** La pression lue par le porteur c : { P, ttp, seuil, presse }. Aucun tirage ; l'horizon × anticipF. */
export function presseLueDe(st, c, K, cfg, tempo = 0.5) {
  const { P, ttp } = pressionDe(st, c, { pressT: (K.pressT ?? 1.5) * (c.skill?.anticipF ?? 1) }, cfg);
  const seuil = seuilPresseDe(K, { composureF: c.skill?.composureF ?? 1.075, tempo });
  return { P, ttp, seuil, presse: P >= seuil };
}
