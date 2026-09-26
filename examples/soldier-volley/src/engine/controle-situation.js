// controle-situation.js — LE GESTE DE CONTRÔLE SELON LA SITUATION (26/09 : « les positions de réception ne sont jamais les mêmes, idem
// pour les passes — s'il faut multiplier les animations de contrôle en fonction d'une situation que tu maîtrises, il faut le faire »).
// Recensement (1 794 réceptions de joueurs de champ, 2 matchs, sim seule) : 85 % au sol, 5 % sur un rebond, 6 % à la cuisse, 5 % plus
// haut ; 12 % de ballons morts, 9 % appuyés ; 53 % de face, 29 % de côté, 15 % de dos ; 18 % en course ; 26 % avec un adversaire à
// < 3 m ; 33 % demandent un virage > 90°. Hier : un intérieur « de face » pour presque tout.
// Module PUR et générique (aucune scène, aucun rig) : la situation est décrite dans le REPÈRE DU CORPS, la table rend l'espèce
// (motion-control.js) et le pied. Les seuils sont des données (SEUILS, surchargés par l'appelant) — rien n'est câblé à un projet.
//
// La situation :
//   h        hauteur du ballon (m)              vb     vitesse horizontale du ballon AVANT la prise (m/s)
//   arrivee  d'où il vient, ° (0 = de face, 180 = de dos)
//   lat      côté du ballon (m, > 0 = à gauche)  vr     vitesse du receveur (m/s)
//   adv      distance de l'adversaire le plus proche (m) ; advLat : son côté (> 0 = à gauche)
//   virage   virage voulu après la prise, ° signés (> 0 = vers la droite, la convention de la scène) ; null = inconnu

export const SEUILS = { rebond: 0.2, cuisse: 0.5, poitrine: 0.9, colle: 1.5, mort: 2, fort: 9, course: 3, dos: 110, demiTour: 100, oriente: 45, droit: 45, axe: 0.06 };

/** Le geste et le pied. Rend { move, foot, pourquoi } ; foot null = le choix de l'appelant (pied fort / côté du ballon). */
export function choisirControle(s, seuils = {}) {
  const K = { ...SEUILS, ...seuils };
  const cote = Math.abs(s.lat ?? 0) < K.axe ? null : s.lat > 0 ? 'left' : 'right';
  const vire = s.virage == null ? 0 : Math.abs(s.virage), sensVirage = s.virage == null || vire < 1 ? null : s.virage > 0 ? 'left' : 'right';   // virer à droite : l'intérieur du pied GAUCHE emmène le ballon (le miroir du contrôle orienté)
  if (s.h >= K.poitrine) return { move: 'amorti', foot: null, pourquoi: 'poitrine' };
  if (s.h >= K.cuisse) return { move: 'amortiCuisse', foot: cote, pourquoi: 'cuisse' };
  if (s.h >= K.rebond) return { move: 'controleRebond', foot: cote, pourquoi: 'rebond' };
  // au sol : l'adversaire collé passe avant tout — le ballon sur le pied LOIN de lui, l'épaule et le bras vers lui
  if (s.adv != null && s.adv < K.colle) return { move: 'controleProtection', foot: s.advLat == null ? cote : s.advLat > 0 ? 'right' : 'left', pourquoi: 'protection' };
  if (s.vb < K.mort) return { move: 'priseSimple', foot: cote, pourquoi: 'ballon mort' };
  if ((s.arrivee ?? 0) >= K.dos || vire >= K.demiTour) return { move: 'controlePivot', foot: sensVirage ?? cote, pourquoi: (s.arrivee ?? 0) >= K.dos ? 'de dos' : 'demi-tour' };
  if (s.vr >= K.course && vire < K.droit) return { move: 'controleCourse', foot: cote, pourquoi: 'dans la course' };
  if (s.vb >= K.fort) return { move: 'controleAmortiFort', foot: cote, pourquoi: 'ballon appuyé' };
  if (vire >= K.oriente) {   // orienté : l'intérieur quand le virage part à l'opposé du ballon, l'extérieur du pied côté ballon sinon
    if (!cote || cote === sensVirage) return { move: 'controleOriente', foot: sensVirage, pourquoi: 'orienté intérieur' };
    return { move: 'controleExterieur', foot: cote, pourquoi: 'orienté extérieur' };
  }
  return { move: 'controleInterieur', foot: cote, pourquoi: 'intérieur' };
}
