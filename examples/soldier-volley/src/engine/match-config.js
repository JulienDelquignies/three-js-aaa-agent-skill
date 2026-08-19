// match-config.js — LA CONFIGURATION DU MATCH EST UNE DONNÉE (lot 22) : le rondo plus les
// lois du but, chaque clé une loi commentée avec son sabotage nommé. Les systèmes vivent dans
// match-sim/referee/shooting ; les réglages vivent ici — au bit près (batterie).
import { RONDO } from './rondo-config.js';
import { REDUIT } from './pitch.js';

export const MATCH = {
  ...RONDO,
  area: [REDUIT.length, REDUIT.width],
  // LE TIR. Portée et dégagement : on ne tire pas de sa moitié (v1), pas à travers un mur, et le
  // coin visé est choisi CONTRE la position réelle du gardien. La vitesse est un plancher de tir
  // (un tir est un geste de puissance — solvePass rend la vitesse d'ARRIVÉE, trop douce pour cadrer).
  shotRange: 15,          // m — distance au centre du but en deçà de laquelle le tir se considère
  shotClear: 0.45,        // m — couloir minimal vers le point visé (laneClearance, gardien exclu ;
                          // 0,75 n'existait JAMAIS devant une défense postée côté but — 0 tir mesuré)
  shotSpeed: 17,          // m/s — plancher de vitesse du tir
  shotHold: 0.25,         // s — pas de tir à la première image de possession
  // LE TEMPO x1 — mesuré contre le réel (3 × 120 s) : 25 passes/min (11c11 : 9-11, futsal :
  // 14-18), tenue réception→passe 0,83 s, corps à 10 km/h de moyenne (réel 7,2), 195 m/min/joueur
  // (réel 110-120), ballon en jeu 94 % (réel 55-65). « FM est plus lent en x1 » : oui — moitié
  // TEMPS MORT (une touche réelle prend 15-25 s), moitié TENUE. Les remises respirent, le ballon
  // se garde, le hors-ballon marche — les cibles : 15-18 passes/min, en-jeu ~80 %, corps ≤ 8,5 km/h.
  restartWait: 3.2,       // s — une remise se POSE (était 1,1 : le jeu ne respirait jamais ; 4,0 quand
                          // la pose était invisible — le porté du preneur EST devenu la pose, le
                          // temps plein faisait double emploi : en-jeu mesuré 68 %, bande ≥ 70)
  restartClear: 3.0,      // m — les adversaires tiennent ce rayon à la remise (futsal Loi 15 : 5 m ; réduit ici à l'échelle)
  restartCarried: true,   // la remise se PORTE (le preneur va chercher le ballon — ballFetch) ; false : l'ancien snap (sabotage nommé)
  offside: true,          // LA LOI 11 (11c11 seulement — st.full la garde : le réduit vit la loi du
                          // futsal, sans hors-jeu). Quatre consommateurs (offside.js) : le cerveau
                          // n'y sert personne (refus nommé 'hors-jeu'), la photo se prend au DÉPART
                          // du ballon (strikeNow — l'appel timé vit dans l'armé), le premier toucher
                          // siffle (coup franc adverse), et les pointes se CALENT sur la ligne, d'où
                          // l'appel jaillit (servi par appelBonus). false : la ligne aveugle
                          // (sabotage nommé — les pointes campent derrière la défense, injouables).
  pressTriggers: { win: 4.5, step: 3.5 },
                          // LE PRESSING À DÉCLENCHEURS (11c11 seulement — st.full le garde) : une
                          // équipe ne presse pas TOUT LE TEMPS, elle presse SUR SIGNAL, en fenêtre
                          // bornée (win s) — le patron du contre-press lossReact, à l'échelle de
                          // l'ÉQUIPE. Signaux : la prise DOS AU BUT et la PASSE EN RETRAIT. Effets :
                          // second presseur sur le pivot (la couverture est le PARI perdu du
                          // pressing), marquages au demi-pas, bloc posté qui monte de `step` m.
                          // false : le press sourd (sabotage nommé — aucun signal, aucune fenêtre).
  coverShadow: true,      // L'OMBRE DE COUVERTURE (11c11) : le presseur arrive PAR LE COULOIR du
                          // soutien le plus dangereux (le corps dans la ligne de passe pendant
                          // l'approche — l'option profonde meurt sans un geste) ; à portée de duel
                          // l'ombre cède au tacle. false : le press en ligne droite (sabotage nommé).
  moments: { win: 5 },    // LES QUATRE MOMENTS DU JEU (phases.js — le socle de la tactique) :
                          // l'horloge du regain est tenue ici (st._possChangeAt), le moment se
                          // DÉRIVE (momentDuJeu), les événements 'moment' le rendent mesurable.
                          // Deux consommateurs (11c11 seulement, st.full) : le CONTRE-PRESS
                          // d'équipe (perte haute < 2,5 s → fenêtre de pressing — Gegenpressing,
                          // 3ᵉ signal) et la VERTICALITÉ du regain (cooldown d'appel profond
                          // relâché pendant la transition offensive — les 5 s où le bloc adverse
                          // est déformé). false : le jeu sans moments (sabotage nommé).
  loi12: { avantage: 1.8, contact: 0.9, mur: 9.15, jaune: 2 },
                          // LA LOI 12 (11c11 seulement — st.full la garde ; le réduit vit sans
                          // arbitre de fautes, dette nommée) : la fente qui rate le ballon et
                          // trouve le corps (contact m) est une FAUTE — l'AVANTAGE d'abord
                          // (fenêtre s : on ne siffle pas une équipe qui a gardé le ballon),
                          // penalty dans la surface du fautif, coup franc sinon, MUR Loi 13
                          // (m). false : l'arbitre aveugle (sabotage nommé). Et la DISCIPLINE :
                          // la récidive (jaune fautes du même homme) vaut carton JAUNE, le
                          // second jaune vaut ROUGE — le carton SURVIT à l'avantage. jaune:0 :
                          // l'arbitre sans poches (sabotage nommé). L'expulsion physique du
                          // rouge (formation à 10, hors-jeu, cerveaux) : dette nommée.
  renversement: { dense: 6, rayon: 12, dz: 18, portee: 38, bonus: 1.5, respire: 45, ouvre: 1.2 },
                          // ouvre (lot 98) : la fixation MÛRE (≥ 3 passes du même côté)
                          // multiplie le poids du service au coureur profond (lot 41) — le
                          // bloc attiré libère la rupture : le dividende premier de la
                          // fixation, avant l'aile opposée. 1 : rien (sabotage nommé).
                          // LE RENVERSEMENT (11c11, st.full — lot 35, diagnostic utilisateur
                          // « densité du jeu axial ») : quand le bloc COMPRIME le côté ballon
                          // (dense corps à rayon m), l'aile OPPOSÉE (Δz > dz, flanc à flanc)
                          // entre au vocabulaire du cerveau de passe — portée étendue (portee
                          // m au lieu de 13), point doux neutralisé, le lofted est sa NATURE,
                          // et la diagonale vole EN CLOCHE par-dessus le bloc (strike-sim).
                          // Mesuré avant : 76 % du jeu à |z| < 8, passe max 21,9 m, 1
                          // renversement / 4 matchs (réel 3-8/match). Événement
                          // 'renversement' {by, to, dz, fix}. false : le jeu axial d'hier
                          // (sabotage nommé).
                          // …ET LA FIXATION D'ABORD (lot 98, retour utilisateur « fixer côté
                          // ballon avant de changer ») : la bascule EXIGE n passes conclues
                          // du même côté (st._fix — possession 5, direct 3 via l'axe style ;
                          // le passeur d'élite, passSigma < 2°, un temps plus tôt) et une
                          // RESPIRATION d'équipe entre deux diagonales (respire s). Mesuré
                          // avant : 12,3 renversements / 220 s (réel 0,3-0,9), 30 % sans une
                          // passe de fixation. fix:false : les bascules libres d'hier.
  tete: { min: 1.5, max: 2.2, reach: 1.0, but: 12 },
                          // LE JEU DE TÊTE (11c11, st.full — lot 34) : un vol à hauteur de
                          // tête (min-max m — la tête DEBOUT, le saut est une dette de
                          // scène) au-dessus d'un corps (reach m) se REPREND : au BUT si
                          // attaquant en surface à < but m (canal shot standard — le
                          // plongeon répond), en DÉGAGEMENT près de son but, en REMISE
                          // courte sinon. À deux corps : DUEL AÉRIEN (strength, seedé).
                          // …et la CLOCHE DU CENTRE vit sous la même clé (strike-sim) :
                          // un centre est un arc par-dessus le premier rideau (0 centre
                          // entré en surface avant — mangés en route, vols tendus).
                          // false : le jeu au sol d'hier (sabotage nommé).
  evadeGoal: 1.3,         // LA CONDUITE A UN SENS (11c11 — lot 47) : terme de PROGRESSION au
                          // barème d'évasion du porteur (vers le but adverse ; l'échelle des
                          // autres termes vit à 0,8-1,1). Clé absente (rondo) : pas un but,
                          // pas un bit. 0 : l'errance d'hier (sabotage nommé).
  wingDrive: true,        // …ET L'AILIER PERCE (lot 47 — l'approche pilotée du centre) : en
                          // couloir offensif, la progression vise la LIGNE DE FOND (hx−6),
                          // pas l'axe — mesuré avant : 105 portages d'aile, 4 en zone de
                          // centre, avance max p50 12,4 m (l'évasion recyclait vers la
                          // médiane). false : l'aile qui recycle (sabotage nommé).
  strideStrike: { tau: 0.9, max: 2.2, ride: true },
                          // LA FOULÉE DE FRAPPE (11c11, st.full — lot 45, retour utilisateur « un
                          // joueur ne s'arrête pas pour tirer ») : l'élan du commit se porte DANS
                          // l'armé — le couple corps-ballon avance (v0·e^(−t/τ), plafond cumulé
                          // max m) au lieu de freiner dans l'ancre. Mesuré avant : tirs frappés à
                          // 0,63 m/s p50 (réel 3-6, dans la foulée). ET LA FOULÉE PORTE LES DEUX
                          // BOUTS (ride, lot 48) : l'offset commit→ancre d'un porteur lancé est
                          // quasi nul — l'interpolation multipliait le mouvement d'ancre par
                          // ep(t01)≈0 en début d'armé (falaise mesurée : 0,0 m/s la frame même
                          // du commit, 112 stops nets / 127 frappes en course, quel que soit
                          // l'ease — deux refontes d'ease mortes à la mesure). `from` avance du
                          // même pas : le corps continue sa course dès la frame 1 (creux p50
                          // 0,0 → 1,9 m/s, stops nets 112 → 19). false : le gel d'hier (« la
                          // statue qui frappe ») ; ride:false : l'élan retenu (la falaise du
                          // commit, sabotage nommé).
  engagementPasse: true,  // L'ENGAGEMENT EST UNE PASSE (11c11, st.full — lot 45) : fenêtre de 2,5 s
                          // après le coup d'envoi où le preneur DONNE (barre abaissée, tenue
                          // dispensée — la barre calme refusait la passe courte, il partait en
                          // conduite). false : l'engagement porté d'hier (sabotage nommé).
  uneTouche: { press: 2.6, vmax: 9.5, portee: 14, couloir: 0.5, p: 0.65, calme: 0.5 },
                          // LA PASSE EN UNE TOUCHE (11c11, st.full — lot 44, retour utilisateur ;
                          // premiere-intention.js) : sous pression (presseur < press m), un ballon
                          // jouable (≤ vmax m/s, au sol) repart en PREMIÈRE INTENTION vers une
                          // ligne courte et ouverte (≤ portee m, couloir libre) — sans être
                          // possédé. Déchet ×1,6 (le geste le plus dur du football), tirage seedé
                          // (p), controlF module. ET AU CALME PAR STYLE (lot 49) : le tiki-taka
                          // la joue par CHOIX — porte sans presseur, pCalme = calme × (1−2·style)
                          // borné à 0 (possession 0,1 → 0,4 ; défaut 0,5 → 0, aucun tirage
                          // consommé : l'identité), déchet ×1,3 (choisie, préparée). L'événement
                          // porte calme:true. ET ELLE SURPREND (lot 50) : pas d'armé → la fenêtre
                          // aveugle se pose avec seen 0 (le contrat de strikeNow, complété — même
                          // loi pour les redirections de la tête et de la volée). Dette nommée :
                          // la photo Loi 11 (comme la remise de tête). false : le monde à deux
                          // touches d'hier (sabotage nommé) ; calme:0 : le réflexe seul (sabotage
                          // nommé).
  chutePredite: true,     // UN VOL LONG SE REÇOIT À SA CHUTE (11c11 — lot 52, retour utilisateur
                          // « les contrôles sur les passes longues sont tous ratés ») : le
                          // receveur d'un vol > 1,1 s court vers le premier point JOUABLE
                          // (y ≤ 1,2 m, descendant) du chemin prédit, à vitesse humaine — ancré
                          // au point nominal il vivait à 4,3 m p50 de la chute (le vol le
                          // survolait, 68 % des longs en chasse au rebond). false : l'ancre
                          // nominale d'hier (sabotage nommé).
  amortiPoursuite: 0.82,  // L'AMORTI DE POURSUITE (11c11, st.full — lot 52, retour utilisateur
                          // « les contrôles sur les passes longues sont tous ratés ») : 56/82
                          // passes longues finissaient en chasse au rebond (p90 : 5 rebonds,
                          // 9 m, 2,8 s) — le « pas de contrôle légal » relançait le ballon à
                          // 75 % à chaque rattrapage (le flipper). À portée d'un ballon NON
                          // CONTESTÉ, la première touche l'ÉCRASE (−82 % H, −60 % V, événement
                          // control 'amorti-poursuite') ; contesté : le 50/50 d'hier. Et la
                          // prédiction de vol couvre le vol ENTIER (maxT suit pass.flight —
                          // le receveur vise la CHUTE, pas un chemin tronqué à 2,2 s).
                          // false : le flipper d'hier (sabotage nommé).
  prise: 0.8,             // LA TOUCHE SE PREND AU PIED (11c11, st.full — lot 58, captures
                          // utilisateur : « le ballon est trop loin et ne touche jamais le
                          // pied » en conduite de course, alors que le porté cérémonial est
                          // correct). Mesuré : la touche partait dès la portée de jambe tendue
                          // (reach 1,15 — sprint p50 1,07 m du corps). Le corps REJOINT son
                          // ballon (≤ prise) avant de le repousser ; la touche d'urgence à
                          // pleine allonge reste quand le ballon fuit plus vite qu'on ne
                          // referme (le poke du sprint). false : la jambe tendue d'hier
                          // (sabotage nommé). Le rondo/réduit gardent reach, au bit près.
  prisePied: 0.5,         // LA POSSESSION NE SE PREND PAS DE LOIN (11c11, st.full — lot 62,
                          // capture utilisateur : « le ballon change de sens sans être touché »).
                          // Mesuré (3 graines × 300 s) : 80 des 105 captures accordaient la
                          // possession à un ballon qui FUYAIT (jusqu'à 0,9 m — captureRadius), et
                          // le servo du porté le retournait le tick même : 39 des 42 demi-tours
                          // sans contact du match venaient de ce seul site. Désormais la capture
                          // exige un ballon PRENABLE (balPrenable, dribble.js) : au pied
                          // (< prisePied) ou convergent (pas fuyant > 0,5 m/s) ; sinon le porteur
                          // COURT et la touche réelle le joue (lot 58). Et le rassemblement du
                          // porté au-delà de 0,45 m COURBE (τ 0,12, vMax 6,5 — un pied, pas un
                          // aimant : 665 à-coups sans événement en 900 s avant, v 2,4→0,4 en un
                          // tick). false : l'aimant d'hier (sabotage nommé). Rondo/réduit : au
                          // bit près (gates st.full).
  allure: true,           // L'ÉCONOMIE DE COURSE (11c11, st.full — lot 57, retour utilisateur
                          // « fourmilière/maternelle off-ball ») : EN JEU PLACÉ, ON SUIT LE JEU À
                          // LA VITESSE DU JEU — le suiveur (marqueur, poste, couverture) est
                          // plafonné par la vitesse de sa CIBLE ; la course reste entière pour
                          // tout ce qui est NOMMÉ : transitions (5 s, phases.js), fenêtre de
                          // pressing de mon équipe, bursts, porteur/receveur/gardien, urgence
                          // locale (ballon < chaud 14 m, vol qui retombe chez moi, homme qui
                          // claque > manRun 3,5). Cible posée + ballon > calme (24 m) → MARCHE.
                          // Réglages : { marche: 2,1, trot: 3,4, chaud: 14, calme: 24,
                          // manRun: 3,5, fenetre: 5 }. Mesuré avant : 32 % du off-ball en course,
                          // 11/20 corps lancés p50 (p90 18) — la cour de récréation. false : la
                          // fourmilière d'hier (sabotage nommé).
                          // …rattrapeAtk (lot 68) : LEVIER de rattrapage en attaque placée,
                          // NEUTRE au défaut (12, symétrique défense). Essayé en loi (6 puis 8)
                          // contre le latéral-flâneur : la marée du bloc au trot suralimentait
                          // le siège (décomposé 20 graines : rattrapeAtk seul 33 buts, bande
                          // 17-33 crevée à 37-39 avec rentre ; rentre seul 22 — l'innocent).
                          // La guérison du transit est l'ancre lente du tuck (poste stable) —
                          // résultat négatif consigné ; la clé reste pour un style aval.
  amortiSpin: true,       // L'AMORTI AMORTIT AUSSI LA ROTATION (11c11, st.full — lot 54, audit
                          // télémétrie) : les impulsions d'amorti tuaient v en laissant w ORPHELIN
                          // — mesuré au tick : 65-70 rad/s sur un ballon à 1,3 m/s, et la friction
                          // au sol reconvertissait ce spin périmé en vitesse (backspin → inversion
                          // cos = −1 « le ballon repart tout seul » ; topspin → ré-accélération
                          // depuis l'arrêt, personne à moins de 2,4 m — 18 fantômes/match). Chaque
                          // amorti pince w DU MÊME facteur que v (prise-gardien, capture, contrôle
                          // manqué, amorti-poursuite, quart-de-touche, amorti-retombée, gants,
                          // vendangé). false : le spin orphelin d'hier (sabotage nommé).
  passeSpin: 4.5,         // LE BACKSPIN DE LA PASSE LEVÉE (11c11, st.full — lot 54) : lofted/chip
                          // partaient SANS rotation — l'atterrissage glissait plein fer dans la
                          // friction Coulomb (×0,6 de vitesse en UN tick, ~25/match, « le ballon
                          // freine tout seul »), puis le roulement fabriquait le spin que l'amorti
                          // laissait orphelin. Coupée SOUS le ballon (rev/s, axe horizontal ⟂ au
                          // vol) : l'effet rétro PORTE le vol et ASSIED la retombée. solvePass
                          // reçoit le même effet — la balistique inverse reste honnête.
                          // false : la passe plate d'hier (sabotage nommé).
  marquageRayon: 26,      // …22 → 26 (lot 56) : le solveur VRAI a rendu au jeu profond sa vraie
                          // profondeur (les passes levées d'hier atterrissaient courtes — bug du
                          // deuxième arc) et les tirs construits ont explosé la bande (44 buts).
                          // Le point DOUX du levier, balayé à l'A/B 20×300 : 22→44, 24→37,
                          // 26→33, 28→41 (trop large ouvre des trous ailleurs) — le marquage
                          // s'engage plus tôt sur le receveur profond, la bande re-fondée 17-33.
                          // ON MARQUE DANS LA ZONE DE DANGER (11c11, st.full — lot 51b, vu en
                          // playmode) : un attaquant à plus de rayon m du ballon n'est pas
                          // marqué HOMME — il est couvert par le BLOC (le marqueur sans homme
                          // pertinent rejoint son poste). Mesuré avant : trois marqueurs partis
                          // à 40 m du ballon marquer la ligne de soutien adverse pendant que
                          // leur surface se faisait attaquer en 2c2 — l'amas au rond central.
                          // Infinity : le marquage-aimant d'hier (sabotage nommé).
  touchePrix: { seuil: 10, taux: 0.07, max: 0.55 },
                          // LE PRIX DU PREMIER TOUCHER (lot 43, retour utilisateur « effet
                          // aimant sur les longs ballons ») : la prise de TURNOVER paie le même
                          // contrat que le contrôle attaquant — au-delà de seuil m/s, la touche
                          // peut FUIR (taux/m/s, plafond max, modulé controlF) : le ballon reste
                          // LIBRE avec son résiduel, le récupérateur va le chercher. Mesuré
                          // avant : 14 % des prises > 10 m/s, un dégagement de 26,5 m/s possédé
                          // instantanément. false : l'aimant d'hier (sabotage nommé).
  bloc: { long: 30, ligne: 27, lateral: 0.35, slideMax: 8, soutien: 20, longAtk: 42, rentre: 9, surcharge: 0.2, surMax: 6 },
                          // surcharge (lot 98) : EN POSSESSION les postes intérieurs (|fz| <
                          // 0,5) glissent vers le couloir ballon (anchorZ × surcharge, ≤
                          // surMax m) — le surnombre qui FIXE ; les larges tiennent (l'ailier
                          // faible = la sortie du renversement gagné). Modulée par relation
                          // (×1,4 triangles) et largeur (×0,7 amplitude) via blocFor. Mesuré
                          // avant : 57/96 possessions mortes au médian, offre courte p50 2.
                          // Absente : les postes symétriques d'hier (sabotage nommé).
                          // rentre (lot 68) : en possession, le latéral CÔTÉ FAIBLE referme la
                          // ligne de 3 — il rentre (z demi) et monte de ~9 m vers le milieu
                          // (mesuré avant : p50 10,4 / p90 22,0 m derrière la médiane d'équipe,
                          // « des dizaines de mètres derrière les autres » — retour utilisateur).
                          // Absent : le latéral abandonné d'hier (sabotage nommé, formation.js).
                          // LE BLOC COMPACT (11c11, st.full — lot 42, retour utilisateur « les
                          // lignes sont trop espacées ») : l'équipe SANS ballon est chaînée au
                          // ballon — sa ligne défensive tient `ligne` m derrière lui (elle MONTE
                          // quand le ballon recule, plafond au rond central) et le bloc entier
                          // tient en `long` m (interlignes comprimées d'un même facteur — réel :
                          // bloc 25-40 m, interlignes 10-15). Mesuré avant : 43 m p50 / 58 p90,
                          // 25,5 m entre défense et milieu, zéro asymétrie attaque/défense.
                          // L'attaque garde sa respiration étirée : l'asymétrie EST le réalisme.
                          // hauteurBloc (tactics) compose par-dessus (±6 m). ET LE BLOC COULISSE
                          // (lot 47, la v2 nommée au lot 42) : ballon à l'aile → le bloc entier
                          // glisse de lateral × z-ballon (borné slideMax m — réel 6-10) : le
                          // couloir se referme. Mesuré avant : couloir indéfendu, la perce du
                          // wingDrive convertissait à 73 %. ET LA LIGNE ARRIÈRE ATTAQUANTE MONTE
                          // (lot 51, soutien — « des défenseurs bien trop bas, sans sens
                          // tactique ») : l'équipe EN POSSESSION tient sa ligne arrière à
                          // ~soutien m derrière le ballon (réel 15-25, plancher 0,12·L — mesuré
                          // avant : campée p10 à 6 m de son but), bloc offensif étiré à longAtk m
                          // (réel 35-50). false : le bloc élastique d'hier (sabotage nommé) ;
                          // soutien absent : la ligne campeuse d'hier.
  volee: { min: 0.25, max: 1.15, reach: 1.1, but: 14 },
                          // LA VOLÉE (11c11, st.full — lot 40) : le pied joue le ballon EN VOL
                          // sous la fenêtre de tête (min-max m, portée reach) — REPRISE au but
                          // en surface (< but m : shot kind 'volée', 'demi-volée' si le ballon
                          // remonte de son rebond) et DÉGAGEMENT d'urgence près de son but.
                          // Hors de ces deux urgences on ne volleye PAS : le contrôle est le
                          // vrai geste. Fenêtre morte 1,15-1,5 m : la poitrine, dette nommée.
                          // false : les pieds au sol d'hier (sabotage nommé).
  centreBas: true,        // LE CENTRE BAS (11c11, st.full — lot 40) : au ras de la ligne (les 9
                          // derniers mètres), le centre part FORT AU SOL vers le point de
                          // penalty si le couloir existe (laneClearance 0,45 — un ballon à ras
                          // se fait couper, contrairement à la cloche) ; c'est LUI qui sert la
                          // reprise de volée. false : que des cloches (sabotage nommé).
  charge: { dist: 0.85, time: 0.4, cd: 3.0 },
  slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 },
                          // LE TACLE GLISSÉ SUR PORTEUR (11c11, st.full — lot 33) : le pari
                          // du dernier recours. Un poursuivant lancé (speed m/s) au ballon
                          // dans la fenêtre (at m) se couche ; la table technique juge la
                          // géométrie réelle — ballon PRIS (dégagé fort, tacleur au sol :
                          // le coût EST la décision), JAMBES trouvées (< body m : FAUTE, la
                          // victime tombe trip s ; par DERRIÈRE c'est GRAVE — récidive ×2,
                          // le jaune vient vite, penalty naturel en surface), ou le VIDE.
                          // Anti-spam : slideCooldown partagé + un corps au sol par ballon
                          // et par équipe. false : personne ne se couche (sabotage nommé).
                          // LA CHARGE D'ÉPAULE (11c11, st.full — lot 32) : le duel de CORPS.
                          // Un défenseur au corps du porteur (dist m) accumule une horloge
                          // (time s) ; pleine, la charge se joue — par DERRIÈRE un porteur
                          // lancé c'est une FAUTE (Loi 12, flux naturel des coups francs),
                          // de côté un duel LOYAL (note strength ±, élan, seedé ; gagné :
                          // le ballon JAILLIT en 50/50 ; perdu : le chargeur rebondit).
                          // cd : anti-mitraillette par chargeur. Jamais sur le gardien
                          // porteur. false : le jeu sans contact d'hier (sabotage nommé).
  fatigue: { horizon: null, cap: 0.15, pause: 0.25 },
                          // LA FATIGUE (11c11, st.full — lot 31) : q.stam ∈ [0;1], drainé
                          // par l'effort (au carré + socle, récup légère à l'arrêt) sur
                          // l'HORIZON du format (null → periodes×duree du chrono, sinon
                          // 360 s : l'échelle suit le match configuré, pas « 90 min » en
                          // dur). UN effet v1 : la pointe plie (× 1−cap·(1−stam)) ; la
                          // note stamina module le drain ; la pause rend `pause` d'essence
                          // (vestiaires) ; l'entrant de la Loi 3 naît frais. q.stam est
                          // l'API du projet (politique de banc). Événement 'fatigue' au
                          // franchissement de 0,35. false : le moteur infatigable (sabotage
                          // nommé). Dette : la précision fatiguée (sigma), le pressing plié.
  loi3: { changements: 5 },
                          // LA LOI 3 (11c11, st.full) : les REMPLACEMENTS. La LOI est le
                          // mécanisme (limite de changements, exécution à l'ARRÊT DE JEU,
                          // l'identité qui change à la ligne, l'ardoise disciplinaire qui
                          // part avec l'homme) ; la POLITIQUE (qui sort, quand) est au
                          // PROJET : referee.remplacer(st, cfg, team, outId, inSpec) — un
                          // manager, une UI, une IA de banc. false : la porte tournante
                          // fermée (sabotage nommé — remplacer() refuse tout). Dettes :
                          // le banc incarné, les fenêtres comptées (3 + mi-temps).
  loi15: { range: 18 },   // LA LOI 15 (11c11, st.full) : la rentrée de TOUCHE se lance À LA
                          // MAIN — à la prise (hook onTake), le lanceur sert un coéquipier à
                          // portée de bras (range m) et le ballon part EN CLOCHE (~32°,
                          // release('touche') au grand livre). L'exemption de la Loi 11 est
                          // STRUCTURELLE : pas de photo de hors-jeu sur une touche (st.pass
                          // sans .off — le sifflet n'a rien à lire). false : la touche au
                          // pied d'hier (sabotage nommé). Dettes : le geste des deux mains
                          // (clip), le double-toucher du lanceur, la touche foireuse.
  loi14: true,            // LA LOI 14 (11c11, st.full) : la CÉRÉMONIE du penalty — tous les
                          // corps sauf le preneur et le gardien de la ligne HORS surface, HORS
                          // de l'arc (rayon loi12.mur autour du point), DERRIÈRE le ballon ;
                          // le gardien défenseur SUR sa ligne jusqu'à la frappe. La frappe
                          // elle-même est le cerveau normal du preneur (canal shot standard —
                          // le plongeon existant répond). false : la cérémonie foraine
                          // (sabotage nommé — coéquipiers agglutinés au point, gardien avancé).
                          // Dettes : l'empiètement APRÈS la prise (re-sifflet), l'ordre strict
                          // preneur-identifié-avant-le-sifflet.
  chrono: null,           // LE CYCLE DE MATCH (l'enveloppe PRODUIT — un projet aval démarre un
                          // match, le joue, le FINIT, lit la feuille) : { periodes: 2, duree: s
                          // par période, pause: s de mi-temps }. Fin de période → sifflet,
                          // l'AUTRE équipe engage (Loi 8, alternance) ; dernière période →
                          // 'fin-de-match', st.fini, monde calme (restart 'fin', personne ne
                          // joue un ballon mort). null (défaut) : les mondes d'aujourd'hui, sans
                          // fin, au bit près — le chrono est une CONFIGURATION, pas une loi.
                          // V1 : pas d'échange de camps ni de temps additionnel (dettes nommées).
  menace: { tir: 1, centre: 1, passe: 1, conduite: 1, grise: 1.35, muteD: 10 },
                          // …grise (lot 92) : la portée de tir × ce facteur = la ZONE GRISE où
                          // le tir existe dégressif, pondéré FINISHING (l'attribut, pas un mur —
                          // 8 conduites muettes / 4 matchs dont une jusqu'aux pieds du gardien).
                          // muteD (lot 92) : au-delà de ce rayon conduit depuis la prise, la
                          // conduite se DÉVALUE (plancher 0,32×) — la circulation redevient le
                          // choix. grise:false / muteD:false : le mur et la conduite gratuite.
                          // L'ARBITRE DE MENACE (11c11 seulement — st.full le garde) : les quatre
                          // options du porteur (tir/centre/passe/conduite) notées sur UNE échelle
                          // (menace.js), l'ordre figé devient un choix, chaque note porte son
                          // pourquoi. Les poids sont des multiplicateurs (le réglage d'équipe de
                          // demain : une équipe joueuse monte passe, une directe monte tir). LE
                          // CONTRAT EST INJECTABLE : cfg.decide = (st, c, cfg) => ({ meilleure,
                          // … }) remplace la politique entière — le moteur garde l'exécution.
                          // false : l'ordre figé d'hier (sabotage nommé « cerveau d'un geste »
                          // via poids : { tir: 1, centre: 0, passe: 0, conduite: 0 }).
  releaseTtl: 0.5,        // s — la garde anti-auto-interception (releaseClear : le ballon doit
                          // QUITTER son origine avant tout droit de prise) a une HORLOGE : passé
                          // ce délai le ballon est à prendre où qu'il soit — une passe morte à
                          // 0,4 m de son origine verrouillait la prise pour toujours (gel 145 s,
                          // graine 3 ; la moitié du remède avec deadFlight). Absent (rondo) : ∞.
  deadFlight: 0.55,       // m/s — UN VOL MORT EST UN BALLON LIBRE (11c11) : une passe trop molle
                          // meurt au sol avant son receveur, et la phase 'flight' n'a plus d'objet
                          // (le receveur vise le rendez-vous d'un vol FINI, le défenseur campe sur
                          // le ballon sans droit de prise — gel de 145 s mesuré, graine 3, fenêtre
                          // de press). Sol + arrêt ≥ 0,3 s → phase 'loose', la chasse reprend ses
                          // droits. Jamais mesuré au réduit (sa sentinelle gel ≤ 25 s monte la
                          // garde) : la loi est gardée st.full. false : le gel (sabotage nommé).
  chaseLoose: true,       // le ballon libre est CHASSÉ par les deux camps ; false : la formation l'orbite (sabotage nommé)
  priseCone: 100,         // LE CÔNE AVANT DU CONTACT (lot 70, st.full — retour utilisateur « le
                          // corps et les pieds ne touchent pas le ballon sur les contrôles ») :
                          // une touche de pied hors table (amorti-poursuite, quart-de-touche,
                          // capture) n'existe que ballon DEVANT (relèvement ≤ 100°) — mesuré
                          // avant : 54 % des amortis-poursuite dans le dos, prises p90 107°.
                          // Hors cône : le ballon COURT (refus nommé 'controle-dos'), le pivot
                          // en cours reprend à la capture. false : la touche omnisciente d'hier.
  holdCalmFull: [0.9, 1.9],
                          // s — LA TENUE DU PLEIN FORMAT (lot 77, st.full — une clé de FORMAT :
                          // le réduit 84 clauses garde holdCalm au bit). Depuis que le porté
                          // SURVIT aux pivots (lot 76), la tenue [1,0;2,2] s'exprimait en entier
                          // (hold p50 0,87 → 1,72) et l'attaque ne pénétrait plus (1-3 s/180 s à
                          // portée de tir, clause gardien 1 tir). La cible VÉCUE d'origine, pas
                          // le nombre.
  deborde: true,          // LE DÉDOUBLEMENT (lot 88, st.full — la paire du couloir) : porteur
                          // large et offensif → son latéral (posts 0/3) dépasse par l'extérieur
                          // (course _pace 'deborde', cadence du RÔLE — piston souvent). false :
                          // le latéral qui reste chez lui (sabotage nommé).
  patte: true,            // LA PATTE (lot 87, st.full — shooting) : la latéralité module la
                          // fenêtre de l'enroulée (inversé ×1,6, débordement ×0,55, both ×1,2).
                          // L'attribut naît au corps (hash seed/id 72/23/5, ratings.foot le
                          // surclasse). false : le tireur sans patte (sabotage nommé).
  social: 0.9,            // LA DISTANCE SOCIALE DES COÉQUIPIERS (lot 86, st.full — movement) :
                          // deux coéquipiers debout, hors remise/geste, tiennent ce rayon (m,
                          // poussée douce). Mesuré avant : 1584 paires < 1,2 m / 15 min, 52 %
                          // mark+mark, épisodes 11,5 s. Le duel adverse garde son contact.
                          // false : les grappes d'hier (sabotage nommé).
  slotAnchor: false,
                          // L'ANCRE LENTE DES SOUTIENS (lot 85, st.full). ÉTEINTE — la
                          // cartographie complète (pics ≥ 7 corps, base 4,6 %) : bail seul
                          // 7,3, ancre+bail 6,4, ancre seule 8,6 (99 % au milieu : la
                          // moyenne lissée AIMANTE au barycentre). Le re-brassage greedy vif
                          // est un OPTIMUM LOCAL : les cibles sautent (583/min) mais les
                          // corps ne courent pas plus (greedy = slot d'à côté). { tau: 1.5 }
                          // pour l'activer.
  triangle: false,        // LA TRIANGULATION (lot 84, st.full — tactics.triangule) : vus du
                          // porteur, deux soutiens à < min° se masquent. ÉTEINTE : les deux
                          // formes mesurées NUISENT (pivot-par-paires 11,8 % de pics ≥ 7 corps,
                          // éventail isotone 6,4 % — le recentrage tire les slots ÉCARTÉS vers
                          // le groupe ; base 4,6 %). La v3 devra contraindre les PROCHES sans
                          // toucher la largeur/sécurité. { min: 35 } pour l'activer.
  settledNear: Infinity,  // LE TROT AU POSTE (lot 84, st.full — movement) : le soutien posé ne
                          // marche QUE placé (< m de son slot) ; loin, il trotte s'y mettre.
                          // Mesuré sans : 10,7 m p50 du slot, l'essaim permanent près du
                          // ballon. Infinity : la marche inconditionnelle d'hier.
  supportSpanFull: 0,   // L'ÉCHELLE DU SOUTIEN (lot 82, st.full — clé de FORMAT : le réduit au
                          // bit — 0 = identité, HORS-DÉFAUT tant que les clauses de flux ne sont pas re-fondées ; 1,5-1,6 mesuré : pics ≥ 7 corps −35 %). Slots du réduit
                          // (6-8 m) en 11c11 mettaient 4 soutiens + leurs 4 marqueurs dans le
                          // cercle du ballon (88 % des pics ≥ 7 corps au centre). ×1,5 : la
                          // ligne de passe courte réelle (10-14 m) — l'espace pour recevoir.
  attaquePasse: { marge: 2 }, // LA PASSE CONTESTÉE S'ATTAQUE (lot 81, st.full — « il reste figé
                          // et l'adversaire récupère avant lui ») : 18 volées receveur-plus-
                          // proche / 15 min mesurées, receveur à 1,3 m/s. Un adversaire à la
                          // mène plus tôt que lui (à la marge, m) : le receveur SPRINTE à la
                          // rencontre (burst 'attaque') après son temps de RÉACTION (attribut).
                          // false : la marche d'hier.
  contain: { dist: 0.9 }, // LE CONTAIN (lot 78, st.full — dette 67c « le press percute ») : le
                          // poursuivant dans le DOS d'un porteur lancé se cale au point de
                          // FILATURE (dist m derrière lui sur sa course) au lieu de viser le
                          // corps — mesuré avant : 23 % des images de poursuite dos en
                          // SURVITESSE d'entrée (~27 s de bélier par match), le percutage que
                          // l'œil lit « charge dans le dos ». L'axe de RÔLE press module
                          // (récupérateur au contact, meneur à distance). false : le bélier.
  frappeConduite: true,   // LE BALLON DE CONDUITE EST UN BALLON DU COUPLE (lot 77, st.full —
                          // la gâchette : 3 401 refus ballon-vif pour 4 tirs sur 4×180 s). Un
                          // ballon qui roule AVEC son homme ne fuit l'ancre de personne : la
                          // frappe se planifie comme sur ballon porté quand la vitesse RELATIVE
                          // tient dans strikeBallRel × controlF (l'attribut technique gradue
                          // l'enveloppe). false : la disette d'hier (sabotage nommé).
  strikeBallRel: 2.2,     // m/s — l'enveloppe RELATIVE du couple (la borne ABSOLUE strikeBallMax
                          // 1,5 reste la loi du ballon vraiment libre, hors couple)
  porteCone: 120,         // LE CÔNE DU PORTÉ (lot 76, st.full — l'AIMANT : le servo de porté
                          // faisait orbiter le ballon au pivot sans pied, 7,2 % des images
                          // portées dos, 18 % des touches de conduite au kick). Ni carry ni
                          // touche hors du cône (plus large que priseCone : semelle/extérieur
                          // vivent à ±120°) ; le talent l'élargit (× 2−dribbleLeadF : ±7°).
                          // Hors cône : release 'porte-dos', le corps CONTOURNE. false : hier.
  sePresente: true,       // LE RECEVEUR SE PRÉSENTE (lot 70, st.full) : quasi statique (< 2,2
                          // m/s) avec un vol pour lui → yawWant vers le ballon (slew borné de
                          // movePlayers — le corps s'ouvre AVANT l'arrivée). Mesuré avant :
                          // 23 % des vols dans le dos à 4 m de l'arrivée, 51/80 sur des
                          // immobiles au cap fossile. false : le dos fossile (sabotage nommé).
  apron: 2.0,             // m — le tablier autour du terrain : un corps peut enjamber la ligne (chercher un ballon sorti)
  carryLawLoose: true,    // la bascule carry→libre lit la LOI DE TOUCHE (jamais sur une touche légale) ; false : le rayon plat (sabotage nommé)
  shotVariety: true,      // le RÉPERTOIRE DU TIR (lot 39 — retour utilisateur « liste à compléter pour
                          // être exhaustif ») : placé, croisé, puissance, mi-hauteur, lucarne, ENROULÉE
                          // (Magnus signé — la courbe bat la lecture linéaire du gardien), RAS-DE-TERRE,
                          // FLOTTANTE (sans axe de rotation → lue tard, keeper.js floatRead), POINTU
                          // (petits espaces), PIQUÉ (le un-contre-un : gardien sorti PRÈS du tireur —
                          // élévation résolue du duel, portée compensée de la traînée). L'espèce se
                          // choisit sur la SITUATION dans shooting.js, s'exécute dans strike-sim (vitesse,
                          // hauteur, spin). Dettes nommées : volée/demi-volée, trivela (extérieur du pied),
                          // pointu-sans-préparation. false : le rase-mottes unique d'hier (sabotage nommé)
  keeperClaim: true,      // la sortie dans les pieds : un ballon au sol à portée de gants se ramasse, même « porté » ; false : le label-bouclier (sabotage nommé)
  carrySurge: { at: 1.25, top: 6.2 },  // le porteur COURT sur sa touche poussée (> 1,25 m → pointe libérée) ; null : le trottinement (sabotage nommé)
  carryTight: 0.62,       // la CONDUITE SERRÉE par défaut (la touche pleine est l'acte nommé d'un burst) ; 1 : le knock-on permanent (sabotage nommé)
  carryGuard: 0.4,        // la CONDUITE PROTÉGÉE : défenseur à ≤ 2,2 m → le ballon COLLE au pied,
                          // burst ou pas (le ballon lié tant que le défenseur n'intervient pas) ;
                          // null : la touche de fuite (sabotage nommé)
  guardDamp: 0.88,        // …et la touche protégée AMORTIT (le ballon roule SOUS l'allure — sans
                          // ça le lead court partait quand même au-dessus de la vitesse du corps)
  meetBall: true,         // le receveur ATTAQUE son ballon (rencontre au plus tôt) ; false : la statue au point de chute (sabotage nommé)
  // LES GESTES DU MATCH (passement, crochet, feinte de frappe) : leurs clés n'existent QU'ICI —
  // les maybe* refusent AVANT tout tirage quand elles manquent, le rondo est inchangé au bit près
  skill: {
    ...RONDO.skill,
    passementFoe: [0.9, 2.6],  // m — le jockey posté en face (pas une charge : le râteau possède la charge)
    passementBite: 0.4,     // s — le mensonge du buste : le jockey lance son appui du mauvais côté
    passementCd: 8,         // s
    crochetFoe: [1.0, 2.3], // m — le défenseur qui ferme la course en avant-latéral
    crochetTurn: 1.4,       // rad (~80°) — la coupe à travers la course
    crochetClear: 1.2,      // m — la sortie du crochet doit être libre
    crochetCd: 7,           // s
    frappeFeinteFoe: [1.0, 2.8],  // m — le contreur à asseoir
    frappeFeinteCone: 40,   // ° — demi-cône vers le but dans lequel le contreur mord
    frappeFeinteBite: 0.7,  // s — on ne se jette pas devant une demi-frappe (plus long qu'une feinte de passe)
    frappeFeinteCd: 9,      // s
  },
  carryViaBall: true,     // le porteur PASSE PAR SON BALLON (cible = ballon au-delà de la portée) ; false : la cible-plan (sabotage nommé)
  meetZone: 3.5,          // m — la rencontre vit dans les DERNIERS mètres du vol (avant : tenir sa position)
  meetStep: 1.3,          // m — UN PAS ET DEMI vers le ballon, sur l'axe de la livraison (pas un correcteur balistique)
  meetWalk: { min: 7, max: 1.1, pace: 1.6, hold: 32 },  // LE RECEVEUR VIVANT (st.full) : sur une passe dans
                          // les pieds ≥ min m, il vient AU-DEVANT du ballon sur l'AXE NOMINAL à allure de
                          // marche (pace m/s, plafond max m et 25 % de la passe). Geste de CONSTRUCTION :
                          // à moins de hold m du but adverse il TIENT son point de fixation (sans la porte,
                          // prises < 22 m : 12 → 5 et tirs 27 → 16 — l'attaque redescendait) ; false : la
                          // statue au point de chute pendant tout le début du vol (sabotage nommé « pose figée »)
  execSigma: 0.044,       // rad (≈ 2,5°) — le déchet technique du joueur MOYEN (les notes le raffinent, l'urgence l'aggrave ×1,25)
  keeperDown: 1.15,       // s — le PLANCHER du prix d'un plongeon (au sol après, gagné ou perdu)
  keeperRise: true,       // LE RELEVÉ RÉEL (st.full, lot 91) : down = chute + sol + relevé par
                          // étapes (keeper.keeperRise — l'AGILITÉ en facteur, ~2,45 s au joueur
                          // moyen), le battu paie AUSSI sa chute, gk.rise = le contrat que la
                          // scène anime ; false : le prix d'hier (1,15 s à l'arrêt, RIEN au battu
                          // — le corps se catapultait debout à 700°/s, sabotage nommé)
  keeperHold: true,       // LE BALLON PRIS RESTE AUX GANTS (st.full, lot 91) : tenu au corps
                          // pendant couché + relevé (ball.hold — intouchable, Loi 12), posé aux
                          // pieds une fois debout ; false : le ballon GELÉ en l'air d'hier
  gesteTir: true,         // LE GESTE DU TIR (st.full, lot 93) : l'espèce s'habille de SON clip —
                          // puissance/lucarne → frappePuissante (élan ample), enroulée/placé/
                          // croisé → frappeEnroulee (l'intérieur enveloppe), pointu/piqué →
                          // frappePointu (sans élan lisible), le reste garde le cou-de-pied.
                          // false : l'armé de passe d'hier (13/16 tirs en passeRapide, mesuré).
  parades: true,          // LES ESPÈCES DE PARADE (st.full, lot 93) : détente haute (≥ 1,35 m)
                          // → plongeonPrise (épaule qui monte, retombe debout), loin (> 1,35 m)
                          // → plongeonUneMain (le bout de gants, windup mains:1), et le tir dans
                          // le corps à hauteur de poitrine ≥ busteV → BLOCAGE du buste (arrêt
                          // {mode:'buste'}, keeper.busteBlock). false : le plongeon d'hier.
  busteV: 12,             // m/s — le seuil du blocage : sous lui, la prise en mains d'hier
  cfDirect: true,         // LE COUP FRANC A UN PRIX (st.full, lot 97 — referee.coupFrancDirect
                          // + coupFrancLance) : pris à 14-30 m (|z| ≤ 15) il s'ENROULE par-dessus
                          // le mur (élévation au balayage balistique, Magnus signé vers le poteau
                          // loin du gardien) ; à 30-55 m il se LANCE dans la boîte (le lob au point
                          // de chute, la conversion sort de la physique) — LA SANCTION de la faute
                          // (sans elle : des fautes qui ne coûtaient rien, A/B 18 → 14 buts).
                          // false : la remise en passe d'hier aux deux distances.
  accroche: true,         // L'ACCROCHAGE DU BATTU (st.full, lot 97 — duel.accrocheStep, requiert
                          // loi12) : LA source de fautes du vrai football — le défenseur DÉPASSÉ
                          // (dans le dos du porteur lancé) qui retient. Une décision par épisode
                          // (tirage seedé, cooldown 6 s), la COMPOSURE en facteur (l'impulsif s'y
                          // résout, le posé court), l'axe pressing et le rôle press assument,
                          // la transition PROMETTEUSE fait la faute TACTIQUE (grave — jaune vite),
                          // ~×0,15 dans sa surface. L'accroché casse sa course, le ballon VIT
                          // (l'avantage départage). false : le monde sans fautes d'hier (0,08/match
                          // mesuré — réel 1,2-1,5 par 220 s).
  zone: true,             // LE BLOC EST BALLSIDE (st.full, lot 96 — l'axe tactics.marquage) :
                          // l'homme du côté FAIBLE n'a pas de marqueur (ballLim 8…30 m selon
                          // l'axe), la ZONE le couvre — slots du côté faible PINCÉS vers l'axe
                          // (formation.blocFor ×0,55…1,0) ; et la COUVERTURE survit au pressing
                          // (i===2 assure derrière le pivot-jump — mesuré avant : 58 % couvert,
                          // coulissement 0,08, ligne arrière à 13,5 m d'écart, côté faible à
                          // 17,3 m : l'homme-à-homme intégral). false : le marquage d'hier.
  jockey: { dist: 1.0, at: 4.2, cap: 2.9, force: 1.5 },
                          // LES APPUIS DU DÉFENSEUR (st.full, lot 95) : face à un porteur POSSÉDÉ,
                          // la cible de press vit ENTRE ballon et but (dist — l'appui-position, on
                          // ne court plus AU ballon) ; sous `at` mètres l'approche est SOUS CONTRÔLE
                          // (plafond cap × agilité — mesuré avant : 70 % des entrées en duel lancées
                          // > 3,5 m/s) ; et le TACLE attend sa FENÊTRE (duel.tackleWindow : ballon
                          // prenable jugé à la COMPOSURE — le posé exige net, l'impulsif s'élance ;
                          // l'étau mord quand même à minuterie × force). false : la minuterie sèche
                          // et la course au ballon d'hier, au bit près.
  appuis: true,           // LES APPUIS DU GARDIEN (st.full, lot 94) : position sur la BISSECTRICE
                          // des poteaux (mesuré avant : la ligne du centre laissait 0,3-0,7 m au
                          // premier poteau) à la justesse de keeping (posMixF), profondeur au rôle
                          // garde (×[0,7 ; 1,3]) et à la note (depthKF ±15 %) ; le SET — un gardien
                          // lancé (> 2,2 m/s) lit le tir ×1,35 plus tard (38 % des tirs proches
                          // partaient sur un gardien en course) ; le 1v1 POSÉ à 1,15 m du ballon
                          // porté (plus de charge dans le pied) ; poste de CORNER (0,8 m devant sa
                          // ligne, moitié lointaine) ; coup franc < 28 m : le gardien couvre le
                          // CÔTÉ OUVERT (le mur a le côté du ballon). false : le gardien d'hier.
                          // (mesuré : 1,34 m de haut, 8 images en s'éloignant des mains)
  pokeReach: 0.5,         // m — LE PIQUE : un ballon de conduite libre à portée de pied adverse
                          // se dévie (poke tackle) ; null : le défenseur-spectateur (sabotage nommé)
  prepTouch: true,        // LA TOUCHE DE PRÉPARATION avant la frappe (serre la touche quand le
                          // couloir de tir est ouvert) ; false : l'empalement (sabotage nommé)
  prepTouchF: 0.3,        // le régime de la touche de préparation (plus serré que carryTight)
  prepDamp: 0.72,         // l'AMORTI de la touche de préparation (le ballon roule sous l'allure
                          // du corps et se cale — sans lui, chaque touche relançait à v+1)
  gkRelease: 3.0,         // s — LA RÈGLE DES SIX SECONDES à l'échelle : passé ce délai, la
                          // distribution du gardien est FORCÉE (meilleure rampe, sinon punt) ;
                          // null : le gardien-attaquant (sabotage nommé — 87 m de dribble mesurés)
  lossReact: 1.6,         // s — LE DÉPOSSÉDÉ SE RETOURNE (contre-press) : l'ex-porteur chasse son
                          // ballon au lieu de repartir en coureur de slot ; null : la course
                          // aveugle (sabotage nommé — 92/254 pertes suivies d'un dos-au-ballon)
  // LA CIRCULATION D'UN MATCH N'EST PAS LA TENUE D'UN RONDO. Mesuré avant : 53 % des images en
  // conduite, tenue p90 3,6 s, 84 passes pour 18 reçues (21 %) — « trop de conduite, des passes
  // qui ne suivent pas l'appel » (retour utilisateur, mot pour mot ce que les chiffres disaient).
  settleMin: 0.55,        // s — le ballon récupéré se DOMPTE avant de repartir, même pressé (le
                          // ping-pong des récupérations-éclair de la chasse : 23 passes/min)
  holdCalm: [1.0, 2.2],   // s — on FIXE vraiment avant de donner (0,83 s de tenue mesurée : le
                          // flipper). NOTE mesurée deux fois : l'ALLONGER fait MONTER les passes/min
                          // — la tenue attire le press, la part pressée explose (cycles éclair)
                          // flipper, pas FM) — la conduite et le dribble y gagnent leur place
  intentBarCalm: 4.8,     // la barre d'adoption au calme — assez haute pour qu'on VOIE la tenue
  appelBonus: 2.6,        // le coureur en rupture est SERVI — relevé avec intentBarCalm (4,8) :
                          // au tempo posé, la course doit encore battre la barre d'adoption
  appelUrgent: true,      // LE SERVICE DU COUREUR S'EXÉCUTE EN URGENCE (lot 41) : portes courtes,
                          // armé prompt, déchet d'urgence ×1,25 — latence burst → passe p50
                          // 1,43 → 0,60 s (la foulée est servie), service 32 → 48 %.
                          // false : le service nonchalant (sabotage nommé)
  appelPret: 1.0,         // m — L'APPEL SE TIME SUR LE PASSEUR (lot 41) : le dart ne part que si
                          // le porteur a le ballon AU PIED (≤ appelPret m) — au vrai football le
                          // coureur lit les appuis du passeur. Mesuré avant : latence burst → passe
                          // p50 1,43 s (le cycle de préparation mangeait la course, le ballon
                          // partait quand le dart finissait) ; false : l'appel aveugle (sabotage nommé)
  appelRange: 6,          // m — l'appel ÉTIRE l'enveloppe de passe (choosePass) : un ballon dans
                          // la course est plus long qu'une passe de circulation. Mesuré sans lui :
                          // le dart de l'appel profond sortait de passRange (13 m) en ~0,6 s — 11
                          // appels, 1 servi (la décoration). Clé absente (rondo) : pas un bit.
  // la mène suit la course : temps d'arrivée estimé (0,4 + d/9, borné 1 s), amorti à 85 % — un
  // ballon DANS la course, pas sur les talons
  leadTime: (d, rec) => Math.min(0.4 + d / 9, 1.0) * ((rec && Math.hypot(rec.v?.[0] ?? 0, rec.v?.[1] ?? 0) > 1.6) ? 0.85 : 0.3),
  speeds: { ...RONDO.speeds, support: 4.9, mark: 5.6, keeper: 6.4, walk: 2.6, chase: 6.4 },  // le soutien OFFENSIF économise ;
                          // walk = le pas de remise ; chase 6,4 : un press de MATCH se soutient
                          // walk = le pas de remise ; chase 6,4 : un press de MATCH se soutient
                          // sur la mi-temps (le 6,9 du duel de rondo poussait les corps à 9,7 km/h)
                          // (10 km/h mesurés, réel 7,2) — mais le MARQUAGE garde son pas : support
                          // 4,9 partagé ralentissait la défense, conversion 71 % mesurée (réel ≤ 35)
  // …et LE CALME SE GAGNE SOUS MARQUAGE LÉGER : holdCalm ne s'appliquait qu'à foeBody > calmFoe
  // du rondo — sur 46 × 30 il y a presque toujours un corps à cette distance, la tenue restait
  // 0,93 s (mesuré). Un joueur de match FIXE avec un marqueur à 2 m ; seul le vrai pressing rushe.
  calmFoe: 1.8,
};
