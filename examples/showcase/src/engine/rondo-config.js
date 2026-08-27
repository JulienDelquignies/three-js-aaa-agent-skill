// rondo-config.js — LA CONFIGURATION DU RONDO EST UNE DONNÉE (lot 22 — le patron Unity :
// les réglages ne vivent pas dans les systèmes). Chaque nombre reste une LOI commentée,
// mesurée, sondable — seul le rangement change, au bit près (batterie).

export const RONDO = {
  // A RONDO IS A SMALL BOX. This was 34 x 26 m, which is a five-a-side PITCH, not a rondo — and that
  // single number is why the ball read as far from everyone: at that size the supports stand 6.5–13.5 m
  // out and the ball sits a mean 5.89 m from the players. A real "passe à dix" is played in 12–16 m.
  // Measured over 3 seeds × 60 s: 34x26 → record 12, ball 5.89 m from the players; 22x18 → 13, 4.20 m;
  // 16x14 → 18, 3.44 m; 12x11 → 8, 2.86 m (too tight, the defence just wins it). 16 x 14 it is.
  area: [16, 14],          // m — the grid the game is played in (x, z half-extents ×2)
  supportMin: 4.0,         // m — closer than this and you clog the carrier
  supportMax: 7.5,         // m — further and the lane is too long to defend
  passRange: [2.5, 13],    // m — receivable pass distance
  corridor: 1.25,          // m — a defender inside this of the line blocks the lane
  pressRadius: 9,          // m — inside this the presser commits to the carrier
  tackleRadius: 1.45,      // m
  // LE DUEL PREND LE TEMPS D'UN DUEL. À 0,5 s, le vol sous pression était un métronome : 19,6 vols/min,
  // 54 % des pertes, possession médiane 0,40 s (sonde duels-tacles). Et la minuterie comptait la
  // proximité du CORPS — le « gagnant » était jusqu'à 2,33 m du ballon au flip. Désormais elle ne court
  // que si le défenseur BAT le porteur au ballon (contestRadius + shieldSlack, voir rondo-sim), et son
  // terme n'est plus une bascule d'étiquette : c'est l'ENGAGEMENT d'un tacle-debout (0,28 s d'armé de
  // plus, gagnable par le porteur qui sort le ballon pendant l'armé).
  tackleTime: 0.9,         // s of sustained pressure to COMMIT to the standing tackle (was 0.5)
  standCooldown: 1.5,      // s — un tacle-debout manqué ne se re-tente pas dans la seconde (anti-mitraillette)
  receiveRadius: 0.85,     // m — the receiver takes the ball. Was 1.25, which is BEYOND the reach of
                           // every control in the technique table (widest window 1.0 m): the touch
                           // fired while the ball was still out of reach, so it stopped a metre away.
  controlSettle: 0.34,     // m — where the ball ends up in front of the foot after a touch
  footSide: 0.11,          // m — and how far to the side of centre, on the controlling foot
  releaseClear: 1.8,       // m the ball must travel before ANYONE can take it (else the passer intercepts himself)
  holdMin: 0.4,            // s — minimum on the ball before passing (no hot-potato) — sous pression
  //                          (0,35 → 0,40 : hold p50 mesuré 0,78 s pour une cible ≥ 0,8, le dixième manquant
  //                          vient des passes pressées ; 0,45 balayé : p50 1,13 mais 43 % d'inter-passes en
  //                          2-5 s (cible 20-35) et record moyen 9,3 → 7,1 — trop de duels subis)
  // LA TENUE DÉLIBÉRÉE. holdMin seul faisait un métronome : hold p50 = 0,38 s (= holdMin + armé),
  // 0-1,6 % des inter-passes dans la bande 2-5 s d'un vrai rondo, chaque passe au minimum légal
  // (sonde tempo-espaces). Un porteur NON pressé (adversaire > calmFoe) tient son ballon un temps
  // tiré dans holdCalm — SEEDÉ par st.rnd, jamais Math.random — avant d'adopter une intention ;
  // pressé, l'ancien holdMin reprend : fixer puis donner, pas patate chaude puis patate chaude.
  holdCalm: [0.8, 1.8],    // s — la fourchette de tenue délibérée d'un porteur au calme
  calmFoe: 2.0,            // m — adversaire plus loin que ça = pas d'urgence à jouer
  intentBarCalm: 3.6,      // barre d'adoption d'intention relevée au calme (3,2 pressé) — 3,9 affamait
  //                          l'attaque une fois la pénalité de sortie ajoutée à choosePass (32 frappes/partie)
  settleExtra: 0.25,       // s — pas de beginPass avant la fin de la fenêtre _settling + ce délai
  holdMax: 3.0,            // s — forced to release (no dwelling). 2,4 → 3,0 : avec la tenue délibérée
  //                          (jusqu'à 1,8 s) + l'armé (0,5 s), 2,4 forçait des balles « moins mauvaises »
  //                          au veto levé — la moitié des interceptions ; un vrai rondo tient 2-5 s
  speeds: { press: 6.6, support: 5.4, carry: 4.2, chase: 6.9 },
  sprintMax: 8.0,          // m/s — plafond ABSOLU après paceBias × rupture : une chasse en rupture
                           // composait 6,9 × 1,28 × 1,06 = 9,4 m/s (au-delà du sprint humain en
                           // carré court) — le produit des accents se borne, comme tout actionneur
  // 9,5 m/s² dépassait le max humain (6-8) de 20-60 % et la locomotion vivait en bang-bang : 59 %
  // des images joueur EXACTEMENT à la saturation du cap (sonde allures-inclinaison, p50 = p90 =
  // 11,24 m/s² = √(9,5²+6²)). 7,5 rentre dans la plage humaine ; le low-pass sur la demande
  // (wantTau, movePlayers) sort les soutiens du régime tout-ou-rien.
  accel: 7.5,              // m/s² along the direction of travel (was 9.5 — above human max)
  wantTau: 0.12,           // s — low-pass sur la DEMANDE de vitesse des rôles calmes (support/mark)
  supportNearCap: 1.7,     // m/s — un soutien près de sa station ajuste par petits pas (p50 avant/après : 3,2 → 1,7)
  settledWalkCap: 1.35,    // m/s — un soutien posé (porteur au calme) MARCHE entre deux appels : le contraste EST le rythme
  // LES GESTES TECHNIQUES (râteau / feinte de passe / arrêt semelle). Chaque nombre est une loi de
  // déclenchement ou un prix — jamais un ressenti : le râteau demande un presseur FRONTAL réel et
  // une sortie arrière libre ; la feinte ne se tente qu'au calme relatif (contestée = suicide) et
  // mord les défenseurs lancés dans le cône de la fausse passe ; la semelle exige le champ libre.
  // Les cooldowns tiennent la fréquence au niveau d'un vrai rondo (un geste est un événement,
  // pas un tic), et flair (persona) module QUI tente.
  skill: {
    rateauFoe: 1.45,       // m — le presseur est PRESQUE sur vous (à 1,8 m, 12,5 râteaux/partie — le cirque)
    rateauFront: 60,       // ° — relèvement max du presseur (frontal, pas dans le dos)
    rateauClear: 1.35,     // m — la sortie ARRIÈRE doit être libre à ce rayon (2,0 ne se trouvait
                           // JAMAIS dans un carré de rondo : 0 râteau, 8 refus/partie — la borne
                           // suit la densité du carré, comme spreadFrac suit sa taille)
    rateauCd: 9,           // s — un retournement est une décision, pas une toupie
    feinteFoe: [1.2, 2.6], // m — fenêtre du défenseur à feinter (trop près = un homme SUR vous — on
                           // joue une touche, pas une pantomime ; trop loin = personne à tromper)
    feinteCone: 55,        // ° — demi-cône autour de la FAUSSE direction dans lequel un défenseur peut mordre
    feinteBite: 0.55,      // s — le temps qu'un défenseur mordu reste assis sur sa ligne morte
    biteSlow: 0.35,        // ×accel et ×vitesse du mordu pendant la morsure — il a lancé son appui du mauvais côté
    feinteCd: 8,           // s
    semelleFoe: 2.4,       // m — personne à ce rayon : la semelle est un geste de champ libre
    semelleCd: 9,          // s
    // …ET À SA PLACE (lot 142, MATCH seulement — semellePlace !== false && st.full) : jamais
    // dans le dernier tiers adverse, jamais avec une option nette devant, jamais en fenêtre
    // de transition ; le tirage × semelleTirage (0,45) × la pente de style (possession ×1,3).
    // Mesuré : 333/90 min → 36. Le rondo garde sa ponctuation d'hier au bit (pas de st.full).
  },
  turnAccel: 6.0,          // m/s² PERPENDICULAR to it — the angular rate is turnAccel/speed, so pace
                           // costs agility and a dribbler can turn inside a sprinting defender
  swarmFrac: 0.135,        // the beehive radius as a fraction of the box's short side (see checkRondo)
  spreadFrac: 0.19,        // minimum team spread, likewise as a fraction of the box
  harriedMax: 0.62,        // max share of carry time with a defender inside tackle range (see checkRondo).
                           // Recalibré AVEC sa loi à l'arrivée des gestes techniques : mesuré sur
                           // 10 graines × 90 s, le monde sans gestes vivait à 38 ± 10 % (max 50),
                           // celui avec jeu de rétention (feinte, semelle, râteau — tenir SOUS
                           // pression est leur sens même) à 44 ± 10 % (max 62). Le sabotage
                           // « défenseur garé sur le porteur » mesure toujours ~100 % : la clause
                           // garde ses dents, le seuil suit le monde qu'elle juge.
  // OFF-BALL STATIONS (see supportSpot). stationBias pulls the support ring from the ball (0) toward
  // the middle of the grid (1) so the ring stays inside the box wherever the ball is. Swept over 16
  // seeds × 90 s: 0 → 15.8 % of the box occupied, 0.45 → 20.2 %, 0.6 → 22.2 %. 0.6 spreads the most and
  // plays the worst (completed passes 4.5 → 2.3: the men are too far apart to link). 0.45 beats the old
  // model on every axis at once — occupancy, distance-to-station, record AND completed passes.
  stationBias: 0.45,
  // How much better another spot must be before a man abandons the one he holds. HISTOIRE EN DEUX
  // TEMPS : à l'époque du ring recentré sur le ballon à chaque image, toute marge non nulle mesurait
  // PIRE (à 0,6 de bias, marge 9 → occupation 24,4→22,2) — l'oscillation venait du RING, pas de la
  // décision, et la marge ne faisait que retarder la correction. Le ring est depuis ANCRÉ EN EMA
  // (ringTau) : la sonde tempo-espaces a mesuré la station qui saute > 1,5 m ~2,5 fois/s et des
  // soutiens à p50 3,0-3,5 m/s en course perpétuelle — la marge + la tenure (spotTenure) redeviennent
  // le bon outil une fois la cause racine (le ring mobile) traitée.
  commitMargin: 2.0,
  spotTenure: 1.0,         // s — une station adoptée se tient au moins ce temps avant re-décision
  //                          (0,6 mesuré insuffisant : encore ~0,9 saut/s par soutien. Résultat négatif
  //                          consigné : pousser à tenure 1,4 + marge 2,6 ne rend que 5 % de sauts en moins
  //                          (157 → 149/min) et fait tomber le record moyen 9,3 → 6,2 — le résidu vient des
  //                          re-formations LÉGITIMES (turnover ⇒ stations remises à zéro, éviction mateGap),
  //                          pas de la décision qui flappe. 1,0/2,0 est l'optimum mesuré : 599 → ~150/min.)
  ringTau: 0.5,            // s — EMA de l'ancre du ring de soutien : le ring ne re-tourne pas à chaque touche
  mateGap: 2.0,            // m — candidat de station à moins de ça d'un coéquipier : REJETÉ (deux hommes = une ligne)
  occupyMin: 0.18,        // the possession team must span at least this fraction of the box (checkRondo clause 9)
  minGap: 0.5,             // m — two players closer than this are pushed apart (they were interpenetrating)
  strikeReach: 1.25,       // m — a pass is only played off a ball the foot can reach
  shieldSlack: 0.15,       // m — how far past the shielding body a defender must get to win the ball
  slideRange: [1.4, 3.2],  // m — the window a slide tackle can reach. Plancher 1,0 → 1,4 : en deçà de 1,3 m
  //                          le tacle-debout (table : dist 0,2-1,3) atteint le ballon SUR SES APPUIS — on ne se couche pas pour ça
  // LE TACLE GLISSÉ EST RARE OU IL N'EST RIEN. Mesuré (sonde duels-tacles) : 9,4/min, joués à 69 %
  // par l'équipe EN POSSESSION dont 49 % par le porteur plongeant sur sa propre touche — un rondo
  // d'entraînement au sol en permanence. Le geste redevient défensif (trySlide exclut l'équipe en
  // possession), coûteux (cooldown par joueur) et de dernier recours (marge 0,15 → 0,4 : on ne se
  // jette que si on perd NETTEMENT la course). Recovery 1,2 s constant → 0,9 s ± variance seedée
  // (référence réelle 0,5-1 s, mesuré figé à 1,200).
  slideRecovery: 0.9,      // s on the ground afterwards (±10 % seeded), won or lost: that cost is the decision
  slideMargin: 0.7,        // m — how much closer the opponent must be before going to ground is worth it
  //                          (0,4 prescrit par la sonde laissait encore 3-3,5 glissades/min : on ne se couche
  //                          que si la course est PERDUE d'un vrai pas, pas d'une épaule)
  slideCooldown: 12,       // s — un joueur ne se jette pas deux fois dans la même séquence (8-12 s réel, haut de fourchette : 10 s mesurait encore 2,5-4,5 glissades/min)
  slideMaxBall: 5.0,       // m/s — above this the ball is going too fast to be won by sliding at it
  //                          (6,0 mesurait des plongeons sur des ballons à 5-6 m/s qui traversaient la surface de jeu)
  carryStandoff: 0.4,      // m — how far BEHIND the ball the carrier places himself (0 = off)
  carrySideBias: 0.55,     // fraction of the standoff shifted to the STRIKING side (pre-aligns the stance)
  evadeAroundBall: true,   // sample the escape directions around the BALL rather than the player
  // --- carrying the ball AWAY from pressure (evadeSpot). Weights, not rules: the answer is a
  // compromise, so it is scored. `evadeKeep` is the one that turns a shuffle into a move.
  evadeStep: 1.2,          // m — how far ahead of the ball the escape point is placed
  evadeSamples: 24,        // directions sampled around the carrier
  evadeFoe: 1.0,           // weight on getting away from the CLOSEST defender at the candidate
  evadeMate: 0.35,         // …and on not running into your own supports
  evadeEdge: 0.8,          // …and on not getting pinned against the chalk — 0,45 laissait la conduite
  //                          pousser le ballon dehors : 13-14 sorties par partie DEPUIS la phase carry
  //                          (mesuré après la tenue délibérée : le porteur vit plus longtemps près de la craie)
  evadeKeep: 1.1,          // …and on continuing the way you were already going
  // The LONGEST anticipation any gesture has (animkit `passePivot`, 0.52 s). Only used to know how
  // early to start asking the question — beginPass then carves the anticipation of the gesture it
  // actually picked, which is the only correct number. See the carve-out in rondo-sim.
  windupBudget: 0.55,
  rushedRadius: 3.2,       // m — inside this, speed breaks ties between gestures (see beginPass)
  // --- la COURSE au vol (beginPass) : un couloir n'est pas une géométrie, c'est une course.
  raceSlack: 0.08,         // s — le défenseur qui arrive à ça du receveur gagne la course : passe refusée
  //                          (résultat négatif consigné : 0,18 « pour faire tomber les interceptions » étrangle
  //                          l'attaque au lieu de la protéger — record moyen 8,1 → 5,5 sur 8 graines, glissades EN
  //                          HAUSSE parce que le jeu se remplit de ballons rendus ; 0,08 garde la marge d'un
  //                          passeur réel sans tuer les lignes jouables)
  vetoTtl: 0.6,            // s — un receveur perdu à la course n'est pas re-proposé pendant ce temps
  intentTtl: 0.9,          // s — une intention de passe pilote l'approche AU PLUS ce temps avant de mourir
  strikeBallMax: 1.5,      // m/s — une frappe PLANIFIÉE exige un ballon posé (l'assise d'abord, voir beginPass)
  glideMax: 7.5,           // m/s — l'actionneur du glissement est borné (sous la clause des 8,4 m/s)
  // le CONTESTE du ballon posé — miroir du prédicat de carrier-owns-the-ball (FOOT_LIMITS.playable /
  // ownSlack) : l'adversaire conteste s'il est À PORTÉE DE JEU du ballon ET plus près que le porteur
  // de plus que la tolérance. « Proche » tout court n'est pas un prédicat : le presseur d'un rondo
  // vit à moins d'un mètre du ballon.
  contestRadius: 0.9,      // m — portée de jeu (= playable de la règle)
  contestSlack: 0.35,      // m — l'écart de tolérance (= ownSlack de la règle)
  carryLoose: 3.0,         // m — au-delà, le ballon n'est PLUS porté : phase libre (= carryMax de la règle)
  captureRadius: 0.9,      // m — un ballon au pied, non contesté, se CAPTURE quand l'intention se forme (le porté)
  rushedSlack: 0.5,        // …but only among options within this much of the best-scoring one
  windupCarve: 1,          // how much of it is taken OUT of the hold rather than added after it (0..1)
  // A TURN TAKES TIME. Bounded at turnAccel/speed rad/s like everything else that rotates here, with
  // this floor so a man standing still still turns at a human rate instead of snapping.
  turnRateMin: 4.5,        // rad/s at a standstill (~260°/s: a sharp but human pivot)
  // LE DUO PRESS/COVER NE CHASSE PAS EN FILE. Le cover à 0,42 × la ligne depuis le ballon vivait à
  // 1,5-3 m du ballon = un DEUXIÈME presseur : les 2 défenseurs les plus proches étaient tous deux
  // < 2,5 m du ballon 49-57 % du temps installé, angle de séparation p25 = 15-23° (sonde
  // tempo-espaces, charges à trois colinéaires à l'écran). Le cover coupe la ligne aux 2/3 et sous
  // un angle DISTINCT du presseur vu du ballon.
  coverFrac: 0.68,         // fraction de la ligne ballon→meilleure option où le cover se poste (60-75 % réel)
  coverMinAngle: 60,       // ° — angle minimal presseur/cover vus du ballon ; en deçà, le cover pivote
  // …et un PLANCHER RADIAL : posté à 0,68 × une ligne courte (option à 4 m), le cover retombait à
  // 2,7 m du ballon et l'amorti d'arrivée le faisait osciller SOUS 2,5 m — mesuré après le premier
  // réglage : press+cover encore tous deux < 2,5 m du ballon 54 % du temps installé, à 715 échantillons
  // sur 762 c'était bien LA paire press+cover. Le cover n'approche jamais à moins de ce rayon.
  coverMinDist: 3.0,       // m — distance minimale cover→ballon
};
