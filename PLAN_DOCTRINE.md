# Plan doctrinal — des livres au moteur (lots 232 →)

> Établi le 4 septembre 2026 sur le monde 231 (= 229 au bit : `173fb72c4182e7db / 7622b2d88c514b04`),
> d'après `Doctrine_Tactique.md` (7 projets de jeu, 5 phases de préceptes, 6 débats) et
> `Brief_Tactique_Moteur.md` (les grandeurs réelles et les 5 chantiers du projet aval).
> Le mantra reste la loi : **le moteur possède les LOIS ; les attributs entrent par des FACTEURS
> (identité à la note 50), les rôles par des AXES (identité 0,5), les tactiques par des axes [0..1] ;
> toute clé cfg absente = l'hier au bit.** Rien ici n'est un chiffre inventé : chaque cible vient d'un
> auteur cité par la doctrine ou d'une grandeur du brief ; chaque « nous » vient d'une sonde nommée.

---

## 1. L'état des lieux chiffré (nous c. le réel)

Sondes du 4 septembre, 6 × 300 s sauf mention (bande = 20 × 300 s, graines 1-20).

| Grandeur | Réel (doctrine / brief) | Nous | Sonde | Verdict |
|---|---|---|---|---|
| Tirs cumulés / 90 min | 22-30 | **63** | film-tirs | ×2,3 — dette majeure |
| Buts / 90 min | 2,7 | **10** (bande 11 / 100 min) | ab-97 | ×3,7 — dette majeure |
| Conversion (tirs par but) | 1 / 9-11 | 1 / 6 | ab-97 | trop facile |
| Tirs dans la surface | 60-68 % | 57 % | film-tirs | proche |
| Tirs assistés (< 3 s) | ~75 % | 81 % | film-tirs | bon |
| Tirs sous pression < 2 m | — (le tir libre convertit ×2) | 48 % | film-tirs | référence |
| Pertes de possession / 90 | 200-280 | **396** (291 au 227, 360 avant) | film-pertes | la meute du 229 fabrique des pertes ; cause « contrôle/réception » 88 % |
| Passes cumulées / 90 | 800-1000 | 783, réussite 76 % | film-passes2 | réussite réelle 80-86 % |
| Passes longues réussies | ~50 % | 37 % | film-passes2 | dette |
| Touches / 90 | ~40 | **6** | audit-tactique | dette majeure (la ligne de touche « meilleur défenseur » n'existe pas) |
| Corners / 90 | 9-10 | 5 | ab-97 | dette |
| Fautes / 90 | 22-28 | 17-22 | ab-97 | bon |
| Regain < 5 s après une perte | 18-26 % (pertes hautes, gegenpress) | 27 % (toutes pertes) | film-contrepress | bon |
| Chasseurs à +1 s après la perte | 3-5 (Zeidler : 6-7 actifs) | 2,4 | film-contrepress | bon (229) |
| Longueur du bloc défensif | 25-32 m (bas 15-22) | 27 / 28 / 32 (bas / médian / haut) | film-bloc | bon (bas un peu long) |
| Entre-lignes déf → mil | 10-15 médian, ~6 bas (Gourcuff) | 11,2 médian, 8,2 bas | film-bloc | bon |
| Hauteur de la ligne arrière | bas 18-26, médian 34-44, haut 48-56 | 12 / 31 / 55 | film-bloc | bas et médian trop profonds |
| Largeur du bloc défensif | 36-44 m | 38-40 | film-bloc | bon |
| Distance porteur → 1er adversaire | tiers déf 4-8, milieu 3-6, off 1-3 | **2,8 / 2,8 / 2,3** | audit-tactique | on presse partout (Moulin : « on ne presse pas à 80 m de son but ») |
| Marquage dans la surface | 1-2 m | 2,6 m | audit-tactique | dette |
| Corps derrière le ballon (attaque placée) | 4-5 (Dall'Oglio 4, Gourcuff 5) | **6,5** | film-chaise | sur-satisfait : l'attaque manque de projection |
| Corps du milieu devant le ballon | ~2 (les deux 8) | 0,7 | film-projection | dette (le 231 l'a résolue au prix du jeu par le centre) |
| Tempo (tenue du porteur) | court 0,9-1,4 s, lent 1,8-2,6 s | 2,3-2,9 s | notes 268 | plutôt lent |

**Lecture.** La défense placée est dans les clous des livres (bloc, entre-lignes, largeur) ; le
contre-pressing est là (229). Les dettes sont dans les **décisions** (tirer, perdre, sortir en touche)
et dans le **projet offensif** (projection, combinaisons). C'est aussi la leçon des lots 230-231 :
toute loi de STRUCTURE offensive se heurte aux systèmes de COURSE et de PASSE tant que ceux-ci ne sont
pas doctrinaux. D'où l'ordre du plan : **décisions d'abord, doctrine défensive ensuite, doctrine
offensive enfin, débats en axes tout du long.**

---

## 2. Cartographie précepte par précepte (fait / partiel / absent)

| Précepte (doctrine) | État | Où / preuve |
|---|---|---|
| 2.1 Premier sprint à la perte, 2.2 règle des 5 s | **fait** | 229 `contrepress.js` (meute 3, dur 5,5 × pressing × work, recul-frein) |
| 2.3 Rest defense 4-5 | **sur-fait** | 6,5 derrière ; 230 `compensation.js` nommée, éteinte |
| 3.1 Ballon couvert / découvert | **absent** | aucune lecture de la pression sur le porteur par la ligne (grep : rien) ; la ligne suit x du ballon seul (`formation.js` bloc.ligne) |
| 3.2 Cadrage-couverture 1+3, l'oblique | **partiel** | 228 `refermerLigne` referme en LARGEUR (dz) ; pas de recul oblique en profondeur |
| 3.3 Coulisser en bloc | **fait** | bloc.lateral (47), pince côté faible (96) |
| 1.3 Pressing : « on ne presse pas à 80 m » | **partiel** | 222 `garde` (loin 6 / milieu 3 m) — mesuré 2,8 m partout : la garde ne tient pas hors fenêtre |
| Pressing sur le temps de vol | **fait** | pressLead (204) |
| 4.1 Interception active | **fait** | intercepteurVol, course-urgente (143/207) |
| 4.2 Trois zones d'entrée de surface en contre | **absent** | boxCrash (123) ne vit que sur les centres |
| 1.1 Conducción (le central appât) | **absent** | dribM (219) module le volume de dribble ; aucune conduite-leurre du central |
| 1.2 Salida volpiana (le 6 entre les centraux) | **partiel** | 223 `sortieBalle` : centraux aux coins, pivot à 22 m devant (pas ENTRE) |
| 1.3 Troisième homme | **partiel** | strike-sim `troisieme {min 6, max 16, p 0,5, dur 1,1}` ; premiere-intention relais (218c/d) ; mesuré : jamais compté |
| 1.4 Demi-espaces, cinq couloirs (≤ 2 par couloir, ≤ 3 par ligne) | **absent** | rôles largeurR, craie (177) ; aucune règle d'occupation |
| 1.5 Appui-remise dos au but | **partiel** | 'dos-au-but' est un DÉCLENCHEUR de pressing (t1) ; la remise en une touche vit dans premiere-intention (mene 0,5) sans loi « dos au but → remise, jamais se retourner » |
| 5.1 Corner : zone des six mètres | **fait** | cpa.js mixte zone/homme (226), tête au premier poteau |
| Faute tactique (débat 1) | **fait, sans axe** | duel.js (×1,8 sur attaque prometteuse) — pas d'axe d'équipe (Zeidler l'interdit) |
| Référentiel ballon / homme (débat 2) | **fait** | axe `marquage` (96) |
| Piège du hors-jeu (débat 3) | **fait** | axe (149 « le piège ») |
| Relance courte / longue (débat 4) | **fait** | 223b relance sous pression, tac.cpa.sortieBut |
| Ailiers axe / touche (débat 5) | **fait** | rôle largeurR (ailierInterieur 0,15 / piston 0,95), craie |
| Sélectivité du tir (brief 2.10, zone de vérité 25-30 m) | **partiel** | shotRange 20, arbitre de menace ; aucune notion de qualité attendue |
| Erreur de passe multi-attributs (brief ch. 5) | **partiel** | passes × technique/composure existent (lots 151+) ; la RÉCEPTION sous pression est la cause de 88 % des pertes |
| Mentalité (brief ch. 4) | **fait** | coach (score, orage), axe style/transition |

---

## 3. Les invariants de méthode (rappel, non négociables)

La mécanique pratique du sceau (jumeau par git stash, index des blocs, épingles par contenu, banc complet, preuves en
worktree, regel, build / deploy / cmp) est écrite dans `docs/Contrat_de_sceau.md` — à relire après tout clear.

1. Sonde AVANT chiffrée (fichier nommé dans le scratchpad) → loi native + clé cfg → sonde APRÈS.
2. Jumeau d'empreinte : `fingerprint-ov.mjs '{"clé":false}'` = empreinte du monde précédent.
3. Bande A/B 20 × 300 s ; bande de santé 3-12 buts / 40-90 tirs — **à re-fonder vers le réel par
   paliers** (voir lot 232 : cible 30-45 tirs, 3-7 buts par 100 min à l'issue de la campagne I).
4. **Garde-fou anti-Goodhart (nouveau, tiré des lots 230-231)** : chaque lot rejoue `dbg-courses`
   (bursts par espèce, passes, profondes) et `film-pertes` ; une loi qui fait perdre plus de 15 %
   d'appels profonds, de débordements ou de passes, ou qui monte les pertes, est retravaillée ou
   livrée éteinte — jamais scellée en l'état.
5. Clause au banc (primitive + flux), épingles `clé:false` sur les contrastes d'hier déplacés, notes
   NOTES.md, commit/push, capture playmode avant deploy, chunk vérifié à l'alias.

---

## 4. Les lots, dans l'ordre

### Campagne I — Les décisions et les bandes de réalisme (le jeu compte trop)

**Lot 232 — La zone de vérité et la sélectivité du tir.**
- Doctrine : Guy Lacombe, la zone de vérité à 25-30 m ; brief 2.10 : 22-30 tirs par match, 60-68 % dans
  la surface, 1 but pour 9-11 tirs, « le tir sans pression convertit ×2 ».
- Nous : 63 tirs / 90, 10 buts / 90, 48 % des tirs sous pression < 2 m.
- Loi : l'arbitre de menace reçoit une **qualité attendue** du tir (`cfg.qualiteTir` : distance,
  angle, pression < 2 m, corps entre le tireur et le but, pied) et un **seuil** modulé par
  l'axe `style` (direct tire de loin) × le rôle (`arbitre.tir`) × le facteur `composureF` (le
  sang-froid attend la meilleure occasion) × le contexte de score (coach). Sous le seuil : conserver
  (passe, conduite vers la zone de vérité). Identité : clé absente = hier.
- Cible : tirs 63 → 35-45 / 90 ; part dans la surface ≥ 62 % ; buts 10 → 5-7 / 90 (la conversion
  suit la qualité : les tirs restants sont meilleurs, la bande de santé se re-fonde).
- Clause : primitive (qualité d'un tir posé : 10 m axe libre > 25 m angle fermé sous pression) +
  flux 3 graines (tirs / 90 et part dans la surface, avec et sans la clé).
- Taille : M. Fichiers : `menace.js` / `shooting.js`, `match-config.js`.

**Lot 233 — Le budget des pertes : la réception sous pression et la meute qui ne fabrique plus de pertes gratuites.**
- Doctrine : brief ch. 5 (l'erreur multi-attributs, 77 % de « badpass » → 50-55 %) ; réel 200-280
  pertes / 90.
- Nous : 396 / 90 (291 au 227) ; cause « contrôle/réception » 88 %. Le 229 a doublé les pertes de
  réception : la meute arrive sur le receveur — c'est son métier — mais le receveur perd le ballon
  sans duel, par un contrôle raté sous pression uniforme.
- Loi : (a) l'erreur de RÉCEPTION devient multi-attributs (`cfg.reception.erreur` : composure atténue
  0-40 % sous pression, technique réduit la dérive, anticipation lit l'arrivée du presseur — 227) ;
  (b) le duel de la meute est un DUEL (accroche, tacle, corps) et non une perte par contact : la
  perte sous meute passe par `duel.js`, comptée « duel » et non « contrôle » ; (c) `contrePress.dur`
  reste, mais un chasseur arrivé ne « touche » le ballon qu'à travers la loi du duel.
- Cible : pertes 396 → 250-300 / 90 ; part « contrôle/réception » 88 → ≤ 55 % ; part « duel/tacle/
  interception » 12 → 30-35 % ; réussite des passes 76 → 80 %.
- Clause : ventilation des causes (3 graines) + primitive de réception (note 50 c. 80 sous 2 m).
- Taille : M-L. Fichiers : `rondo.js` (réception), `duel.js`, `contrepress.js`, `attributes.js`.

**Lot 234 — La ligne de touche est le meilleur défenseur.**
- Doctrine : Guardiola (cible le latéral, la touche défend) ; réel ~40 touches / 90.
- Nous : 6 / 90. Le jeu n'atteint jamais le bord : les larges vivent à la craie (177) mais les duels
  de couloir ne sortent pas, les dégagements ne prennent pas la touche, le pressing côté ballon ne
  pousse pas vers la ligne.
- Loi : (a) le presseur côté ballon oriente le porteur vers la touche (angle de cadrage `cfg.cadrage.
  versTouche` × axe pressing) ; (b) le dégagement pressé choisit la touche (`clearance.touche`, ×
  (2 − composureF)) ; (c) la conduite le long de la ligne perd le ballon en touche au contact (duel
  de couloir → sortie), pas au sol.
- Cible : touches 6 → 25-35 / 90 ; corners 5 → 8-10 / 90 (la déviation défensive existe : 176).
- Clause : flux touches / 30 min avec et sans ; primitive du cadrage (angle vers la touche).
- Taille : M. Fichiers : `match-sim.js` (jockey), `duel.js`, `referee.js`.

**Lot 235 — Le tempo est un axe (brief 2.9).**
- Doctrine : tenue courte 0,9-1,4 s (jeu court) ; lente 1,8-2,6 s ; passes courtes 65-75 % en jeu
  court, longues 40-50 % en jeu direct.
- Nous : 2,3-2,9 s, sans axe de tempo.
- Loi : l'axe `tempo` [0..1] (identité 0,5 = aujourd'hui) module la tenue minimale, la cadence des
  une-touche (218) et la longueur préférée des passes ; le rôle `arbitre.passe` et `decisionF` nuancent.
- Cible : à 0 → tenue p50 ≤ 1,4 s, courtes ≥ 65 % ; à 1 → longues ≥ 40 %.
- Taille : S-M. Fichiers : `tactics.js`, `premiere-intention.js`, `menace.js`.

### Campagne II — La doctrine défensive (Gourcuff, Lacombe, Moulin, Sacchi)

**Lot 236 — Ballon couvert / ballon découvert (précepte 3.1, brief chantier 3).**
- Doctrine : « c'est le ballon qui déclenche la montée, si le porteur est cadré ou pas » (Lacombe) ;
  « si le porteur est libre, l'ensemble du bloc doit reculer » (Moulin). Brief : couvert = presseur ≤
  2 m ou dos au jeu → la ligne monte d'un pas (+2 à +4 m) ; découvert = presseur > 3,5 m et face au
  jeu → recul-frein (−3 à −6 m, 3,5-5 m/s), délai d'amorce ≤ 200 ms.
- Nous : absent — la ligne suit x du ballon (bloc.ligne 27 m) ; hauteur bas 12 m / médian 31 m
  (réel 18-26 / 34-44) : trop profonde parce qu'elle ne sait pas monter quand le porteur est cadré.
- Loi : `cfg.couvert { pres 2, libre 3.5, monte 3, recule 5, tau 0.2 }` : `presseurArrive` (227)
  et le cadrage jockey donnent l'état du porteur ; la ligne arrière (spots postés, `formation.js`
  bloc) reçoit un delta de profondeur signé (le patron 228 : un delta appliqué par le consommateur
  nommé, jamais un buffer muté), × axe `hauteurBloc` (0 : recule plus qu'il ne monte) × la moyenne
  d'`anticipF` de la ligne (le bloc qui lit, 161) ; le piège (149) garde le dernier mot sur la montée.
- Cible : hauteur de ligne bas 12 → 18-24 m, médian 31 → 34-40 ; ballons par-dessus non contestés
  −60 % (sonde à écrire : passes profondes reçues sans défenseur à < 3 m) ; hors-jeu provoqués 2-4 /
  match.
- Clause : primitive (porteur cadré → +3 ; libre face au jeu → −5 ; clé absente → 0) + flux hauteur
  de ligne par bloc.
- Taille : M. Fichiers : nouveau `couvert.js`, `match-sim.js` (posted spot), `formation.js`.

**Lot 237 — L'oblique 1+3 en profondeur (précepte 3.2).**
- Doctrine : « une ligne de quatre ne monte jamais de front » ; le sortant cadre, les trois reculent
  en diagonale (Sacchi, Gourcuff).
- Nous : 228 referme en largeur seulement.
- Loi : `refermerLigne` expose aussi un `dx` (recul oblique : le voisin −1,5 m, le second −0,75 m ×
  posF × axe marquage), consommé par les postés ; le « V » pointé vers le ballon.
- Cible : le chevron mesuré (angle de la ligne au moment de la sortie ≥ 8°) ; trou de ligne p90
  19,2 → ≤ 17 m.
- Taille : S. Fichier : `marquage.js`.
- **SCELLÉ (NOTES 288)** : recul du voisin 2,50 → 2,65 m, du second 2,22 → 2,51 (réf. le troisième — le
  médian absorbait le recul) ; trou p90 21,0 → 20,4 (la cible ≤ 17 reste ouverte : moitié des instants le
  poste marque un homme et ne lit pas le delta). Identité de l'axe marquage rétablie à monde constant (part
  0,45 × axe(1,4 ; 0,6)). Effet de bord : centres 20-29 → 7-13 par 30 min (réel 10-13). Dettes : 232b sans
  effet à 48 graines ; le marqueur à homme devrait lire le delta (238).

**Lot 238 — On ne presse pas à 80 m de son but : la garde tenue par tiers.**
- Doctrine : Moulin ; brief 2.3 : rayon d'intervention 1,2-1,8 m au contact, 4-6 s de harcèlement
  avant relais ; audit : distance porteur → 1er adversaire 4-8 m dans le tiers défensif adverse.
- Nous : 2,8 m partout (222 `garde` ne tient qu'en dehors des fenêtres, et le contre-press 229 y
  ajoute la meute). Marquage surface 2,6 m (réel 1-2).
- Loi : la garde devient une **distance de cadrage par tiers et par état du ballon** (couvert /
  découvert du 236) : loin du but, le presseur cadre à `garde.loin` sans mordre tant que le ballon
  n'est pas découvert ; dans la surface, le marquage colle (`marquageSurface.colle 1,5 × (2 − markF)`).
  Le relais du presseur après `garde.relais 5 s × workF`.
- Cible : 2,8 / 2,8 / 2,3 → 4-6 / 3-5 / 1,5-3 ; marquage surface 2,6 → 1,5-2 m.
- Taille : S-M. Fichiers : `match-sim.js` (jockey), `marquage.js`.
- **SCELLÉ (NOTES 289)** : la garde 222 n'atteignait pas les corps (l'ombre de couverture posait 1,15 m avant
  le jockey) → `garde.js` gardeDist lue par l'ombre et le jockey ; tiers loin 2,6 → 3,3 m, proche 2,5 → 2,3 ;
  marquage de surface 2,4 → 2,1 m par la tenue d'affectation (`marquageTenue` gain 0,8 — à 0,6 la bande sortait, 53 tirs/90 : le garde-fou anti-Goodhart a tranché). Le relais du
  presseur n'est pas livré (il change déjà toutes les 1 s). Dette : les nouvelles paires viennent du peloton.

### Campagne III — La doctrine offensive (Guardiola, Xavi, Dall'Oglio, Elsner)

**Lot 239 — La salida volpiana et la conducción (préceptes 1.1, 1.2).**
- Doctrine : le 6 s'intercale ENTRE les centraux écartés (+1 dès la première passe) ; le central
  porte le ballon en appât pour faire sortir un adversaire.
- Nous : 223 `sortieBalle` (pivot à 22 m devant) ; aucune conduite-leurre.
- Loi : (a) `sortieBalle` : sous pressing à deux pointes (`relance.pression` 223b), le pivot descend
  entre les centraux (`relance.salida true`, hauteur box.depth + prof) ; (b) la conducción :
  `dribM` (219) reçoit un terme « supériorité » — un central libre face à une seule pointe conduit
  jusqu'au cadrage (cap `conduc.max 12 m` × axe style × `visionF`), puis passe à celui que la sortie
  a libéré (l'arbitre de menace lit la sortie adverse).
- Cible : sorties de but courtes réussies ≥ 88 % (brief), zéro perte plein axe à < 20 m ; conduites
  de central de 6-12 m suivies d'une passe qui gagne une ligne : sonde à écrire.
- Taille : M. Fichiers : `cpa.js`, `skills-sim.js`, `menace.js`.
- **SCELLÉ (NOTES 290)** : `salida.js` (salidaStep + conduccion) et la greffe dans `sortieBalle` ; pivot 9,5 → 0,5 m
  devant les centraux sous pression (entre eux), conduite d'un central libre 5,5 → 8,2 m p50 (réel 6-12). La sortie
  de but est trop rare pour porter la loi (3 par 30 min, dette des sorties) : la salida vit sur la relance basse.

**Lot 240a-d — Les quatre retours (avant le 240) — SCELLÉ (NOTES 291).** Passe vers un receveur serré (passeMarque,
faible : 15,1 → 13,3 %), retournement du porteur (457 → 169 °/s p50, passes dans le dos ÷ 2 ; le porteur qui se
retourne ne pousse pas — porté au pied le temps du tour ; le coup d'envoi et la talonnade dispensés), ballon libre au
temps d'arrivée (éteinte : placebo mesuré), pointe sur l'épaule (5,9 → 3,3-4,5 m de la ligne). Prix : pertes
333 → 411/90, à rendre par la remise du 240.

**Lot 240 — Le troisième homme et l'appui-remise (préceptes 1.3, 1.5 ; brief chantier 2) — SCELLÉ (NOTES 292).** Appui-remise forcée dos au but sous presseur (× sang-froid), la course du troisième homme vit le cycle (vieC 0,6) : servis 28 → 60 / 60 min, réussis 19 → 48, pertes × 1,03.
- Doctrine : A → B (une touche, dos au but, « si tu n'as pas vu, tu remets ») → C lancé qui part
  200-400 ms AVANT que B reçoive ; cycle 1,4-2,2 s ; 8-15 combinaisons réussies par match.
- Nous : `troisieme` existe (strike-sim) mais n'est jamais mesuré ; la remise vit sans la loi
  « dos au but sous pression → interdiction de se retourner ».
- Loi : (a) `cfg.appuiRemise` : receveur dos au but (cos yaw) et presseur ≤ 2 m → remise en une
  touche vers le soutien de face (premiere-intention), jamais de pivot ; × `composureF` (le sang-froid
  peut se retourner si le presseur arrive lentement — 227) ; (b) le troisième homme compté : événement
  `combinaison {kind:'troisieme'|'un-deux', dur}` quand A→B→C aboutit à C lancé ; C part sur la
  LECTURE (218c relaisLecture) 0,2-0,4 s avant la réception de B × `anticipF`.
- Cible : combinaisons réussies 0 (jamais comptées) → 8-15 / match ; pertes « dos au but dans le
  rond central » (Dall'Oglio) → sonde, −50 %.
- Garde-fou : appels profonds et débordements ± 15 % (leçon 231).
- Taille : M-L. Fichiers : `premiere-intention.js`, `strike-sim.js`, `movement.js`.

**Lot 241 — Les cinq couloirs et l'offre de passe (précepte 1.4 ; brief chantiers 1 et 2.8) — SCELLÉ (NOTES 293).** Le registre des couloirs (max 2, hystérésis, demi-espace vide qui attire, l'intérieur tient son demi-espace) : un couloir à ≥ 3 corps 50,5 → 30,6 %, réussite non dégradée. L'offre de passe et les lignes : mécanismes posés, flux nuls, éteints (placebo). Dette : la profondeur des intérieurs pour les 80 % de demi-espaces.
- Doctrine : jamais plus de deux joueurs dans le même couloir vertical, pas plus de trois sur la
  même ligne horizontale (Guardiola) ; un relais dans chaque demi-espace ≥ 80 % du temps de
  possession ; l'offre de passe : un coéquipier sort du cône d'ombre du défenseur de 1,5-3,5 m.
- Nous : aucune règle d'occupation (sonde à écrire : occupation des cinq couloirs de 13,6 m en
  attaque placée) ; les soutiens sont des slots géométriques (lot 83), pas des lignes de passe.
- Loi : (a) une **contrainte d'occupation** posée sur les spots ON (`cfg.couloirs { max 2, ligne 3 }`)
  résolue à l'assignation slot → joueur avec hystérésis (la v4 promise au lot 84 — jamais en
  post-traitement par frame, trois échecs mesurés) ; (b) l'offre de passe : chaque soutien élu vérifie
  l'ombre du défenseur le plus proche et se décale de 1,5-3,5 m × `offBallF` (nouvel attribut
  « déplacement sans ballon », note 50 = identité) vers la ligne nette, sous le calage Loi 11.
- Cible : deux demi-espaces occupés ≥ 80 % ; passes en une touche réussies 72 → 78 % ; réussite
  globale 76 → 80 %.
- **C'est ici, et seulement ici, que les lois 230-231 se rallument** : quand les soutiens offrent
  des lignes et que les coureurs sont doctrinaux, l'entre-lignes (231) et la chaise (230) cessent de
  recycler le jeu — on les remesure alors, allumées, contre le garde-fou.
- Taille : L. Fichiers : `match-sim.js` (slots), nouveau `couloirs.js`, `attributes.js`.

**Lot 242 — Les trois zones d'entrée de surface en contre (précepte 4.2) — SCELLÉ (NOTES 300).** Élection des trois zones en contre, cibles fixes à l'entrée, sprint : contres arrivés 8 → 17 / 60 min, aucune zone 62 → 29 %, deux zones ou plus 12,5 → 65 %. Dette : les trois zones à 18 % (cible 60), l'annexe lointaine.
- Doctrine : Elsner — zone centrale + deux zones annexes occupées à chaque contre ; l'excentré en
  position intermédiaire, jamais deuxième latéral.
- Nous : boxCrash (123) sur les centres seulement ; en contre les pointes courent où l'appel les
  mène.
- Loi : en moment `transition` (regain < moments.win) et ballon lancé vers l'avant, les trois
  pointes se répartissent sur les trois zones (`cfg.contreZones`), × axe `transition` (à 0 : rien) ;
  le rôle `appel` choisit qui prend l'annexe.
- Cible : contres avec les trois zones occupées à l'arrivée ≥ 60 % ; buts de contre en un-contre-un
  gardien (sonde).
- Taille : S-M. Fichier : `phases.js`.

**Lot 244a — Les postes nommés + le catalogue exhaustif — SCELLÉ (NOTES 302).** La grille GK / D / WB /
DM / M / AM / ST × G · CG · C · CD · D devient une donnée (`POSTES_FORMATION`, `lignesFines`,
`checkPostes`), 31 formations (seize de plus), rôles par défaut dérivés de la grille ; aucune loi ne la
lit encore — empreintes du 242 au bit.
- Constat : un poste était un indice ; trois strates seulement (le dix comptait parmi les pointes, la
  sentinelle parmi les milieux) ; le dédoublement code « posts 0/3 » en dur.

**Lot 244c — Le catalogue des rôles du projet aval — SCELLÉ (NOTES 303).** 34 rôles sur les onze axes,
en donnée (`roles.js`, identifiants aval) ; `rolesGrille` pose le rôle par défaut de chaque poste nommé
(mezzalas d'un trio, sentinelle, meneur reculé, piston…) ; préréglages 4321/532 corrigés ; aucun rôle par
défaut, empreintes au bit. Trouvé : le contrat du 127 était lu à vide depuis le 127.

**Lot 244b — Les lois au nom du poste — SCELLÉ (NOTES 304).** `cfg.postesNommes` allumée : pointes =
strate ST + AM larges (le dix reste entre les lignes), pivot de salida = DM(C) sinon M(C) (hier l'intérieur
gauche, le piston gauche en 3-5-2), dédoublement = WB ou D large (hier les indices 0/3 : un central
débordait en 3-5-2). Flux neutre à 8 graines ; jumeau false = 242 au bit.

**Lot 244e — La donnée s'aligne sur la loi — SCELLÉ (NOTES 305).** Retour aval : arbitre du catalogue
re-échelonné linéairement dans [0,7 ; 1,3] (zéro couple fondu, zéro ordre inversé), bande de checkRoles
rendue, checkRoles borne le résolu, axe dribble reporté par la résolution (rappel 219). Table livrée en
`docs/Retour_Reference_244e_Table_Roles.md`.

**Lot 244d — Le poste naturel côté joueur — SCELLÉ (NOTES 306).** `squads[i].postes` (noms de la grille)
→ `familiarite` (1 / 0,8 / 0,75 / 0,5 / 0,3 / 0,15) → `profilAuPoste` : la lecture du jeu × 0,7-0,75 et la
réaction × 1,3 à familiarité 0, la technique intacte. Mesuré : à contre-emploi, tirs concédés 4 → 13,
passes 323 → 269 (8 × 300 s) ; le malus léger était un placebo, rejeté. Absent : au bit.

**Rouge hérité — la gradation 152/158 (annexe attributes).** Bissecté : vert au 235, rouge dès le 237
(`referme`). Tranché : referme épinglée à false rend 0 / 46 / 373 / 504 ; allumée, 82 / 47 / 77 / 94 — la loi
écrase la domination des notes (504 → 94). **Lot 245 — La vraie sortie — SCELLÉ (NOTES 307).** L'oblique du 237 tirait sur « le plus proche du ballon »,
à 40 m du but, sans sortie ; corrigée : sortant devant la ligne (2 m) et ballon dans la zone du but (40 m).
Gradation rendue (11/49/249/470 à 12 graines), l'oblique tire 6-8 % des images au lieu de 40.

**Lot 247 — L'appui-remise dans le monde A9 (première passe, NOTES 314 : le temps mort n'est pas une perte).** Avec A9, l'appui-remise coûte
573 pertes c. 508 sans (+ 13 %, 24 × 300 s) et 36 % de services perdus ; hier + 1,5 %. Le monde du 240 est
épinglé `remisesMain:null` en attendant. Hypothèse : le ballon reçu de la touche, dos au but, presseur
derrière, déclenche le 240 sur une situation que A9 crée en nombre ; mesurer les appuis-remises nés d'une
touche c. du jeu courant, et dater la loi (dispense après touche, ou dosage) sur preuve.

**Lot 246 — Les leviers de lecture, première passe — SCELLÉ (NOTES 315).** La matrice (chaque note à 90
puis 10, 12 × 300 s) : concentration morte, reactions muette, teamwork faible ; anticipation et positioning
INVERSÉES et corrigées (avantContact.lecture, referme.note 0, placement { bruit, zoneMorte:false }) ;
positioning 90 = la référence, 10 = −4,3 pts et 12 tirs concédés.

**Lot 246b — Le bloc qui lit monte plus tôt, pas plus — SCELLÉ (NOTES 316).** couvert.lecture : l'amplitude de
la montée ne lit plus l'anticipation, tau la divise ; anticipation 90 → 7/3 tirs, 10 → 5/12 (hier inversé).
Le laps d'attention (déplacement) rejeté à 24 graines.

**Lot 246c — Le laps d'attention par la réaction — SCELLÉ (NOTES 317).** cfg.attention { tenue 3, taux 2 } :
le distrait garde la cible du début de la tranche ; concentration 10 → 16/23 tirs c. 23/17 sans note (24
graines), possession égale ; taux 1 ne mordait pas.

**Lot 246d — La matrice close — SCELLÉ (NOTES 318).** Reactions vit aux ballons flottants (72 / 49 / 36 %),
la concentration tient en possession à 48 graines (− 2,7), teamwork reste faible sans second lecteur. Plus
aucune note inversée ni morte.

**Lot 246 (ancien libellé)** Révélé par le 244d au monde 245 : décision, placement,
anticipation, appel, cohésion, marquage, concentration, réaction ne bougent presque rien dans les lois.
Chaque note de lecture doit avoir UN levier mesuré (gradation appariée 30/50/70/90 sur sa propre
signature), comme la technique en a dans la 152/158 ; le 244d retrouvera alors sa mesure.

### Campagne V — Les rôles individuels (Recherche_Tactique_Individuelle.md → moteur)

Proposée par l'agent animations le 7/09 (lots 248-255 pour le moteur, A12 pour l'animation), reprise ici
avec les amendements de l'agent moteur. Le mantra reste la loi : lois au moteur, rôles en données, clé
absente = hier au bit, sonde avant, clause au banc, banc COMPLET avant tout sceau.

**Ce qui est accepté tel quel.** L'architecture poste / rôle / signature = grille 244a / catalogue 244c /
attributs + persona. Les 25 rôles du document contre les 34 du catalogue (lot 248 : cinq identifiants
nouveaux, les vecteurs existants sont une API aval, on ne les modifie pas). `compatibiliteOnze` (table pure,
avertit sans bloquer). Le repli par rôle (251 : l'équipe dit COMBIEN, le rôle dit QUI). La passation du
marqueur (252, le 6 = `pivotDe`). La pausa comme décision (253). Le preset ligne haute et sa clause à deux
faces, le prix visible (255). Les mécanismes relationnels en dernier (254). Le scan comme horloge de sim
lue par le rendu (250), interface `p.scan` gelée avant A12a.

**Amendements (agent moteur).**
1. *L'INTERDIT n'est pas un multiplicateur.* Le contrat 244e borne l'arbitre à [0,7 ; 1,3] : « centre 0,6 »,
   « tir 0,77 » et « refus → arbitre 0 » le violent. L'interdit est une DONNÉE binaire du rôle
   (`interdits: ['deborde', 'tete', …]`) et du joueur (`squads[i].refus`), lue par la loi concernée avant
   d'agir — comme `deborde` lit déjà le rôle — hors de la bande d'arbitre. Le catalogue garde ses nuances.
2. *Un banc ne naît pas rouge.* Le test d'identification (249) assertera les rôles que le moteur exprime ;
   les autres sont INFORMATIFS (imprimés, non jugés) jusqu'à leur lot, sinon le tally du driver ne dit plus
   rien. La liste informative EST le backlog 250-254.
3. *Une note de lecture est un temps, pas une amplitude* (leçon 246 : anticipation et placement inversés
   par des amplitudes × note). Au 250, `scanF` joue sur QUAND le corps s'ouvre et QUEL pied ; le contrôle
   manqué × (2 − scanF) se mesure avant d'être livré, et se retire s'il n'est qu'une amplitude.
4. *Deux écarts mesurés aujourd'hui passent devant le scan.* (a) Touches : 9 par 90 min (sonde 8 × 300 s,
   réel 40-50) — le ballon ne sort pas assez ; ce n'est pas une clause du 249, c'est un lot (249b, « le
   ballon qui sort ») : pourquoi il reste dedans (passes trop sûres, pas de jeu à la craie, dégagements
   absents), puis loi et clause. (b) Repli : médiane 2 devant le ballon, mais ≥ 6 devant sur 16 % des
   images quand l'adversaire est dans notre moitié — la « hérésie » du §4.1 existe une image sur six ; le
   251 la vise (8-9 sous la ligne ≥ 90 % des images [CONVENTION]).
5. *Volumétrie.* Trois graines × 300 s en ordinal par graine est fragile (leçons 93, 140, 244b…) ; six
   graines minimum, et le jugement ordinal PAR graine plutôt qu'en moyenne, comme proposé.
6. *Ordre.* 248 (données, au bit) → 251 (repli, mesuré faux) → 249b (touches) → 249 (identification,
   informatif d'abord) → 250 (scan) → 252 → 253 → 255 → 254.

**Lot 256 — SCELLÉ (NOTES 329).** Le journal vu d'un consommateur : dix points de vocabulaire du retour aval, au bit
(docs/Retour_Reference_Journal_Fond.md). Alias d'un lot : pass.from, turnover.to — à retirer au 257.

**Retour aval de fond (7/09) — ordre amendé** : 258 L'ÉCHELLE DE FINITION (shotSigma sur l'ordre de grandeur de la
cage, le 145 gardé ; cibles ~25 tirs, ~33 % cadrées, ~11 % conversion, ~2,7 buts ; banc complet, épingles datées ;
re-mesurer B (les notes défensives) et C derrière, et les sept leviers de gardien) → 257 LE CARTON JUGE LA NATURE
(prometteur / tacle par derrière / arrache → jaune ; le tally à 4-5 ; d'abord : la faute d'anti-jeu n'existe presque
pas, prometteur vrai 1 fois en 3 matchs) → 259 L'ÉPAULE DU DERNIER DÉFENSEUR (quand part l'appel, d'où ; 0 hors-jeu
en 270 min, la profondeur reçue 18 m derrière la ligne — l'appel muet du 249) → 253 → 255 → 254. A13 (animation) :
un second canal pour le flux d'animation (burst/touche/control/windup = 58 % du journal).

**Lot 252 — SCELLÉ (NOTES 328).** La passation du marqueur (cfg.passation) : la bande du central tactique et rôle,
la remise au pivot libre, à portée, entre les lignes ; le pivot marque 21/22 ; le flux du 9 décroché reste au bloc.

**Lot 250 — SCELLÉ (NOTES 327).** L'horloge de scan (scan.js, cfg.scan, p.scan pour A12a) : déterministe, aucun bit
de jeu, cadence de Jordet, scanning comme temps ; le corps ouvert après le regard mesuré placebo (corps null).

**Lot 249 — SCELLÉ (NOTES 326).** Le test d'identification « sans les noms » (verify-identification.mjs) : 18 signatures
exprimées gelées, 43 muettes nommées = le backlog (l'appel muet partout, à instruire avant le 253).

**Lot 249b — SCELLÉ (NOTES 325).** La craie est une chaise tenue (cfg.craie.tenue) : l'ancre gardée, sa chaise, son
couloir, la craie visée ; sorties hors fautes 28 → 40 / 90 (réel ~70 — dette nommée : le service de la craie).

**Lot 251 — SCELLÉ (NOTES 324).** Axe de rôle repli (l'équipe dit combien, le rôle dit qui), l'interdit 'repli' ne
rentre jamais ; le flux à 25-52 m : 65 % des images à 8-9 sous la ligne, la traîne est la transition — dette nommée.

**Lot 248 — SCELLÉ (NOTES 323).** 25 rôles appariés, cinq vecteurs nouveaux dans la bande, interdits binaires
(role.interdits ∪ squads[i].refus, lus par le dédoublement), compatibiliteOnze (neuf règles, avertit), six personas.

**A12 — les signes visibles du rôle (agent animation, aucune loi de sim, empreinte au bit)** : A12a le scan
du receveur en vol (lit `p.scan`), A12b la réception de trois-quarts et le pied arrière (lit `pick.foot`),
A12c la pausa (lit le kind/événement du 253), A12d le recul-frein, A12e la marche des rôles marchants,
A12f les petits gestes signés (bras du tireur : `payload.mains = 'signal'`, une ligne dans cpa.js sous clé),
et une planche « sans les noms » par rôle du 249. Interfaces GELÉES dans `docs/Interface_Campagne_V.md`
(p.scan, cfg.scan, scanning, pausa, passation, signal, interdits/refus). Synchronisation : 248 d'abord
(identifiants = API partagée) ; l'horloge de scan est dans la SIM, jamais dans gaze.js ; le moteur ne touche
pas gaze.js. Journal : le tronc est à 322, la branche numérote à partir de 323.

**Chiffres du document promus en clauses (249, tolérances [CONVENTION])** : 8-9 sous la ligne du ballon en
bloc bas ; 2-3 actifs autour du lanceur, 7 immobiles ; 40-50 touches par match ; 4-6 dans la surface sur
corner, latéraux + sentinelle en rest defense ; passes courtes du gardien > 90 %, rétention des longs
30-40 % ; scans du receveur 0,4-0,6/s en vol ; buts sur CPA 25-33 % (mesuré, pas forcé).

### La carte du book (docs/Book_vers_Moteur, 330) — ce qu'elle impose à l'ordre

Les 48 fiches sont écrites et mesurées (2 × 90 min par chapitre). Elles ne changent pas l'ordre déjà amendé
(258 → 257 → 259 → 253 → 255 → 254) : elles le confirment et le prolongent. Après le 259, les lots
transversaux que la carte appelle le plus souvent, dans l'ordre de leur rendement :

1. **Le profil locomoteur et le budget de course** (Modèle 02, Référentiel 05, Bibles 07-09, 16) : V₀/τ par
   attributs, intention d'effort, freinage, fatigue sur l'accélération — 165 km / équipe → 108, 8,5 → 0,9
   accélérations / min. C'est le constat n° 1 des trois volumes.
2. **La couche de croyance** (Modèle 04, puis 05, 07, 08 ; Bibles 10, 13, 14) : `view` par joueur, les
   décisions lisent la croyance — l'intervalle, la fenêtre de renversement, le décalage entre lignes, le
   dribble qui trompe, le coach qui se trompe. Le scan 250 en est la source.
3. **Le pas de décision séparé du pas physique et les flux RNG nommés** (Modèle 01) : condition du banc du
   réel (≥ 200 matchs) et de la saison (chantier A) — 130 s / match → 2 s.
4. **Le duel comme vecteur** (Modèle 11, Bible 15) et **la passe qui se manque à la bonne distance**
   (Modèles 07, 09 ; le centre 58 → 20 %).
5. **Le ballon qui sort et le temps du match** (Modèles 12, 13 ; Bible 14 ; Référentiels 01, 06, 10).
6. **Le bloc qui perçoit et la ligne qui est une ligne** (Bibles 03, 10) — découlent de 1 et 2.

Chaque fiche porte ses lots en §4 ; la règle reste : une loi à clé, jumeau au bit, clause au banc — et la
table du réel (verify-book, informatif) promue en clause fiche par fiche quand la loi qui la fait tenir est
scellée (décision 4 du Plan_Route).

**258 — L'ÉCHELLE DE FINITION : SCELLÉ (331).** La dispersion du tir est un σ d'angle anisotrope, les
attributs en facteurs (finF identité à 50, composure, weakFoot, stamina), la vitesse sous-dosée, la hauteur
visée tirée. Mesuré à graines égales : cadrés 60 → 48 % (réel 45 des non contrés), conversion inchangée.
Ce qu'il révèle et nomme : **258b — le corps qui contre** (tirs contrés 3 % c. 27, Modèle 10 lot 2 : le
défenseur dans le couloir de tir, `contreTir` 176 qui ne mord qu'à 2 %) et **le gardien contre les frappes
hautes** (arrêts 56 % des cadrés c. 69 — Bible 02 lot 5, diveReach / diveTime). L'ordre devient : 258b → 257
→ 259, puis les transversaux.

**258b — LE CORPS QUI CONTRE : SCELLÉ (332).** À l'armé du tir le défenseur devant s'engage (P ≈ 0,95, l'attribut
aux marges), court sur la ligne de tir et tend la jambe : son rayon d'obstruction grandit avec le temps depuis
l'armé (0,28 + 2,2 (t − 0,18)⁺ ≤ 1,2) ; le tireur tire dans le trafic (couloir 0,2 m) ; les issues du contact
(renvoi / amorti / sortie / déviation) sont tirées au flux. Mesuré : contrés 4-7 → 24 % (réel 27). Ce qu'il
nomme : la limite est géométrique (47 % des tirs ont un corps devant) — le reste du 27 est dans le tireur qui
tire à travers un corps SUR la ligne (le couloir à 0) et dans le bloc bas qui se ferme (253). L'ordre : 257 →
259 → 253 → 255 → 254, puis les transversaux.

**257 — LE CARTON JUGE LA NATURE : SCELLÉ (333).** La faute porte un score de nature (espèce, vitesse de la victime,
agressivité, arraché, transition prometteuse, DOGSO) ; P(jaune) en sigmoïde au flux, l'ardoise des fautes répétées,
le rouge direct du DOGSO (jaune + penalty dans sa surface sur un tacle), la retenue de l'averti et la réticence de
l'arbitre. Mesuré 8 × 90 min : 9,25 → 4,0 jaunes, 2,25 → 0,12 rouge, 2,8 → 5,0 fautes par jaune. Alias du 256 retirés. Ce qu'il
nomme : le rouge à la borne basse (le DOGSO rare parce que le battu accroche loin du but ; le second jaune tué par
la retenue) — le tacle glissé rare (41 par équipe, Bible 15 §5.1) reste le lot du duel au sol. L'ordre : 259 → 253
→ 255 → 254, puis les transversaux.

**259 — L'ORTEIL ET LA COURSE QUI TRAVERSE : SCELLÉ (334).** La photo de la Loi 11 lit une capsule (tronc + pied
avant, phase de foulée analytique), la course de l'appel traverse la ligne au lieu de s'y coller, la pointe posée sur
l'épaule prend un recul d'élan et part sur le porteur prêt, le photographié qui tente de jouer est sifflé. Mesuré :
0,75 → 3,75 hors-jeu par match, le coureur servi de l'épaule à +2,5 m de la ligne au départ. Ce qu'il nomme : les
appels profonds « d'ailleurs » partent de 9 m (le budget de course, transversal), et le coureur servi n'est pas
encore reçu derrière la ligne (la passe se joue tôt). L'ordre : 253 → 255 → 254, puis les transversaux.

**253 — LA PAUSA : SCELLÉ (335).** La temporisation devient une décision : le porteur au calme (ttp ≥ seuil au
tempo, au rôle et au sang-froid), dans le tiers adverse, avec deux adversaires lancés et une course partenaire
qui n'est pas encore l'option, tient — ni passe ni conduite — jusqu'à ce qu'elle le devienne, que la pression
arrive ou que 2,5 s passent ; l'événement porte l'issue et le gain (la pausa qui produit de la valeur c. l'hésitation).
Mesuré : 6,75 événements pausa par match, les pausas de ≥ 1,5 s 0,5 → 2,25 (réel 3-6, la marge basse). Ce qu'il nomme : la pausa sans ballon (HOLD_OFF_BALL, Götze) et les régimes de tempo par zone
(chapitre 05) restent à faire. L'ordre : 255 → 254, puis les transversaux.

**255 — LA LIGNE HAUTE ET SON PIÈGE : SCELLÉ (336).** Le preset `ligneHaute` (un point nommé de l'espace des axes) et
l'axe `piege` devenu une décision de ligne : à l'armé du passeur adverse, la ligne arrière monte ensemble (le même
until pour tous : la synchronie) et la photo de la Loi 11 prend les corps restés sur l'épaule. Le T3b du book tenu : à
hauteur égale, piege 0 → 1,75 hors-jeu provoqués, piege 1 → 5,25. La clause à deux faces : la sonde des presets
imprime pour chaque tactique le gain (hors-jeu provoqués, ligne, tirs concédés et leur distance) et le prix (ballons
reçus derrière la ligne, buts encaissés). Ce qu'il nomme : la ligne du preset un peu haute (36 m c. 31,6-34,6), la
désynchronisation par la familiarité (254). L'ordre : 254, puis les transversaux.

**254 — LA FAMILIARITÉ, LE MÉCANISME RELATIONNEL : SCELLÉ (337). LA CAMPAGNE V EST FINIE.** η par équipe (injectée par
joueur, choquée par le coach, rétablie sur deux branches), Φ de la paire sur l'un-deux et le troisième homme, la
synchronie de la ligne au piège comme familiarité. Mesuré : à familiarité 0,4 les motifs sont divisés par deux et la
ligne part désynchronisée de 0,32 s (le book : 0,36) ; aucune réussite d'action ne bouge. Ce qu'il nomme : les canaux
« temps de réaction » et « ancre », la ligne brisée à mesurer à 12 graines. Les lots suivants sont les transversaux
(le profil locomoteur et le budget de course, la couche de croyance, le pas de décision séparé du pas physique) et les
dettes nommées de la carte du book.

**260 — LE PROFIL LOCOMOTEUR ET LE BUDGET DE COURSE : SCELLÉ (338).** Le transversal n° 1 : le profil mono-exponentiel
V₀/τ par attributs (garde-fou F₀), l'intention d'effort par métier, le freinage saturé, le réservoir W′ qui refuse la
pointe et fatigue l'accélération avant la vitesse. Mesuré : 16,65 → 13,9 km par joueur (réel 10,5), haute intensité 4 039 → 1 530 m (686), sprint 711 → 170 m (166), 13,7 → 1,45 accélérations par minute (0,9), le freinage plus fort que l'accélération (ratio 2,6), les tirs inchangés. Ce qu'il nomme : le volume restant est dans
l'intention au cerveau (les métiers qui commandent la vitesse), le prochain lot du transversal ; puis la couche de
croyance et le pas de décision séparé du pas physique.

**261 — L'INTENTION D'EFFORT AU CERVEAU : SCELLÉ (339).** Le transversal n° 2 : la situation commande la vitesse voulue
et l'ε de chaque corps (effort.js) — les trois régimes du suiveur déclenchés par le SAUT du slot (entretien / coulissement
actif / récupération), le rayon d'atteignabilité du presseur, l'appel pertinent à portée de passe, le repli qui n'est un
sprint qu'en transition ; quand l'intention parle, l'économie de course d'hier se tait. Les axes pressing / marquage /
transition, le rôle press et le workRate composent sur l'identité ; le score ne branche rien (le coach déplace les axes).
Mesuré : 14,24 → 13,37 km par joueur (réel 10,5), HI 1 621 → 873 m (686), la part de la distance à haute intensité 10,0 → 5,6 % (< 7 : la clause de l'histogramme tenue), 1,46 → 1,17 accélérations / min, la HI du repli 901 → 395 m, l'appel 107 → 56 par joueur ; le prix : 4 sprints c. 10 au réel (les ruptures trop courtes). Ce qu'il nomme : les slots qui sautent 54-60 fois par minute (le coulissement par ligne à gain k, fiche 10
lot 2 — le corps vit à 6-11 m d'un idéal qui frémit), les ruptures trop courtes pour être des sprints (0,9 s ; t₉₀ = 2,7 s —
le budget de déclenchement de la Bible 16 : moins de ruptures, plus longues), la marche à 9 % de la distance c. 30 % au
réel dont l'essentiel est le TEMPS MORT du match réel (30 min de ballon sorti où l'on marche — transversal n° 5).

**262 — LA COUCHE DE CROYANCE : SCELLÉ (340).** Le transversal n° 3 : chaque corps tient une croyance datée par entité
(croyance.js) — le champ visuel à deux canaux du Modèle 04 (détail / mouvement, l'immobile dans le dos invisible), les
niveaux d'information, l'observation bruitée en distance à 10 Hz sur un flux de perception propre, la correction de
Kalman scalaire, la prédiction paresseuse en τ⁴, le repli sur l'ancre du slot. Deux consommateurs : le passeur vise sa
croyance du receveur (et décider de le servir, c'est le regarder : le regard de passe), le marqueur suit la sienne de son
homme. Mesuré : sans le regard, le test 1 du book tenu en flux (l'erreur du passeur 0,36 → 0,81 → 2,83 → 5,65 m par âge
croissant, le σ cru la prédit) mais la mène de course (167) cassée par la décision omnisciente ; avec le regard, l'erreur
est le bruit d'observation (0,25 m) et le fantôme ne vit qu'à la fixture — pour 3 points de passes conservées (la bande
de bruit). Ce qu'il nomme : les décisions qui lisent encore st.players (le test d'import — c'est LÀ que la note de vision
se lira dans la passe), l'attention et
l'effet tunnel, la tromperie comme inférence, la communication comme observation, l'invariance par permutation (Modèle
04 lots 4-6) — puis le pas de décision séparé du pas physique et les flux RNG nommés (Modèle 01).

**263 — LE PAS DE DÉCISION SÉPARÉ DU PAS PHYSIQUE : SCELLÉ (341).** Le transversal n° 4 : deux horloges (cadence.js) — le
cerveau (les postes, le choix du porteur, les niches du 1c1) ne parle qu'aux ticks de décision (0,1 s) ; le corps, le ballon
(sous-pas ≤ ½ rayon), les gestes, la perception et l'arbitre vivent au pas physique ; l'intention s'adopte au tick, elle
s'exécute à la porte du ballon au pied ; le gardien, les remises et l'administration de l'arbitre restent au pas physique
(le gardien au tick coûtait 2 buts par match) ; les constantes en images (l'EMA de la poussée, le tour, le vol mort) se
disent en secondes. Mesuré (le test 3 du book, 8 × 45 min) : dec 0,05 → 0,10, D_KS(possession) 0,034 (non réfuté à
n ≈ 1 340), passes −4,0 %, tirs +5,0 %, conservées +1,7 pt ; face à hier : 1 085 → 997 passes (le réel), 63 → 65 % conservées,
34 → 37 tirs, plongeons 19 → 15,5, CPU p50 430 → 192 µs. Ce qu'il nomme : la sensibilité au pas PHYSIQUE (980 → 1 150
passes de 1/60 à 1/30 : le contact par image → le contact balayé), le budget (test 9 : 192 µs c. 52 — la grille spatiale,
zéro allocation), les tirs de loin sous la cadence (la surface 69 → 54 % au flux du 232) ; puis les flux RNG nommés (Modèle 01 lot 2), le double tampon et l'invariance d'ordre
(test 1), le temps de jeu (test 10).

**264 — LES FLUX RNG NOMMÉS : SCELLÉ (342).** Le hasard du jeu est une fonction pure de coordonnées (graine, sous-système,
tick, entité, index — rng.js `draw` / `tirage`, huit flux nommés) : un tirage ajouté dans un module ne déplace plus les
autres. Mesuré : sous la clé, un st.rnd() ajouté à chaque image laisse 2 × 300 s de match bit-identiques ; sans elle il
les déplace ; le monde sous la clé est un autre tirage de la même distribution. Ce qu'il nomme : PractRand sur le mélange,
le double tampon et l'invariance d'ordre (test 1), le rejeu multi-plateforme (test 2) ; puis le duel comme vecteur et la
passe qui se manque à la bonne distance (Modèles 11, 07, 09), le ballon qui sort et le temps du match.

**265 — LA PASSE QUI SE MANQUE À LA BONNE DISTANCE : SCELLÉ (343).** La réception à quatre issues du Modèle 09 (la fuite du
premier contact d_touch, la pression au ballon par temps d'arrivée avec le corps qui protège, le manqué de Weibull, le
contesté en 50/40, la touche propre protégée pendant son budget) et l'erreur de geste par classe et distance (la base 1,4°
du book, la note en facteur, la pression, la distance). Une leçon de métrique : le gradient « inversé » de la fiche était
l'artefact d'une métrique ; avec la complétion événementielle, 79 → 80 % (réel 80-83), courtes 87, 5-15 yd 80 → 84 (réel
88-92), 15-30 yd 74-75 (82-87), 30+ 64 → 56 (55-65). Ce qu'il nomme : l'interception probabiliste en vol (Modèle 07 §4 —
le déficit de la tranche moyenne), le receveur qui vient au-devant (le sous-dosage attend), le ballon fou en cône ; puis le
duel comme vecteur (Modèle 11), le ballon qui sort et le temps du match.

**266 — L'INTERCEPTION NON OMNISCIENTE : SCELLÉ (344).** Le défenseur lit le départ de la passe avec une latence (0,25 s ×
la note d'anticipation), vise ensuite le ballon tel qu'il le CROIT (la croyance du 262 — dos au ballon, il court vers un
souvenir), et le passeur refuse ses lignes sur les défenseurs tels qu'il les croit. Mesuré : réussite 80 % (=), courtes
87 → 91 (réel 88-92), longues 56 → 61 (55-65), bloquées 4 → 3 % (réel 3,1) ; l'ablation montre que la tranche 15-30 yd
(71-75 c. 82-87) tient à la SÉLECTION du passeur, pas à l'omniscience. Ce qu'il nomme : la sélection calibrée (Modèle 09
lot 2 — P_succ prédit, l'appétit du risque), la logistique σ / λ comme lecture du passeur ; puis le duel comme vecteur
(Modèle 11), le ballon qui sort et le temps du match.

### Campagne IV — Les débats comme axes (tout du long, à faible coût)

- **Faute tactique (débat 1)** → axe d'équipe `faute` [0..1] (0 : Zeidler, jamais ; 1 : la faute
  intelligente loin de son but) branché sur duel.js (×1,8 existant devient axe(faute, 0, 3,6)) ;
  identité 0,5 = aujourd'hui. Lot S, avec le 233.
- **Hors-jeu (débat 3)** : l'axe existe (149) ; le 236 le fait dialoguer avec « couvert ».
- **Relance (débat 4)** : existe (223b, sortieBut) ; le 239 y ajoute la salida.
- **Ailiers (débat 5)** : existe (largeurR, craie) ; le 241 mesure l'occupation.
- **Causerie (débat 6)** : hors moteur de match (couche carrière : moral / motivation), noté.

---

## 5. Ce que le plan ne fait pas, et pourquoi

- Pas de nouvelle formation avant le 241 (levé au 244a : 31 formations, la grille des postes en donnée ;
  la dette de la couche rôles devient le 244b, les lois au nom du poste).
- Pas de fatigue sur la compacité (brief 5.3) avant que les bandes de réalisme (I) soient re-fondées.
- Le harnais (classe « ordre des blocs » : 96, 174, 189) reste une dette nommée ; elle ne bloque
  aucun sceau (les blocs passent isolés) mais coûte du temps de banc à chaque lot.

## 6. Calendrier de sceau

Chaque lot suit le contrat (§3). Ordre strict : 232 → 233 → 234 → 235 (bande re-fondée à l'issue :
30-45 tirs, 3-7 buts, 250-300 pertes par 100 min) → 236 → 237 → 238 → 239 → 240 → 241 (remesure de
230/231 allumées) → 242. Les axes de la campagne IV s'ajoutent au lot qui touche leur fichier.
