/** LA CUEILLETTE SE JUGE AU TEMPS (lot 298, cfg.cueillette — la demande « augmenter les passes par séquence » ; la leçon des lots
 *  290-297 : la perte se conserve, le générateur commun est le BALLON LIBRE). Sondé (sonde-301, 3 × 90 min, au monde du 296) : 120-147
 *  ballons libres pris par équipe et par match ; l'équipe qui avait l'AVANTAGE (le plus court temps d'atteinte) le prend 68-74 %, le
 *  PERD 16-21 % — 21-28 par équipe — avec 0,4 s d'avance p50 ; son joueur le plus prompt ne courait VERS le ballon que 31-33 % des
 *  fois, à 3,3-4,1 m/s. La cause : l'élu de l'équipe qui avait le ballon (match-sim, le « hunter ») TROTTE (job support, 4,9 m/s)
 *  dès que l'adversaire le plus proche est 2,5 m plus loin que lui (« une cueillette sans course adverse se trotte ») — une DISTANCE,
 *  quand un adversaire lancé à 6,4 m/s reprend 2,5 m à un trotteur en moins d'une seconde.
 *
 *  La loi : l'élu ne trotte que si l'adversaire le plus prompt (etaCourse : élan, accélération × accelF, pointe × topF) arrive au
 *  point du ballon au moins `marge` s APRÈS lui ; sinon il sprinte (job receive). Attributs : accélération et pointe (des deux côtés,
 *  par etaCourse). Tactique, rôles : rien. Clé absente : la cueillette jugée à la distance d'hier, au bit. */
export function cueilletteSprintDe(etaMoi, etaFoe, K) {
  return !(etaFoe > etaMoi + (K.marge ?? 1.0));
}
