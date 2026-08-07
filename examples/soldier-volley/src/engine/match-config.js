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
  menace: { tir: 1, centre: 1, passe: 1, conduite: 1 },
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
  apron: 2.0,             // m — le tablier autour du terrain : un corps peut enjamber la ligne (chercher un ballon sorti)
  carryLawLoose: true,    // la bascule carry→libre lit la LOI DE TOUCHE (jamais sur une touche légale) ; false : le rayon plat (sabotage nommé)
  shotVariety: true,      // le répertoire du tir (placé/croisé/puissance/mi-hauteur/lucarne) ; false : le rase-mottes unique (sabotage nommé)
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
  execSigma: 0.044,       // rad (≈ 2,5°) — le déchet technique du joueur MOYEN (les notes le raffinent, l'urgence l'aggrave ×1,25)
  keeperDown: 1.15,       // s — le prix d'un plongeon (au sol après, gagné ou perdu) : couvre le
                          // couché + relevé RÉEL du clip (~1,05 s après contact à vitesse 1 —
                          // à 0,75 le corps sim repartait pendant que le rendu se relevait encore)
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
