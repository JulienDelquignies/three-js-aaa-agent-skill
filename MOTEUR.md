# Le moteur de football Three.js — guide d'architecture et de greffe

Ce dépôt est un **moteur de football pour Three.js/WebGPU** : simulation prouvée en node (sans
navigateur), habillage 3D qui la copie, et une pyramide de vérification qui rend chaque loi
mesurable et chaque régression bruyante. Il est fait pour être **repris par un autre projet** —
ce guide dit quoi prendre, comment c'est architecturé, et où se greffe un moteur de match 11c11.

Démos vivantes : https://showcase-pi-mocha.vercel.app (rondo = `rondo.html`, match réduit =
`match.html`, **11 contre 11 plein format = `match11.html`**).

## Ce qu'il y a dans la boîte

- **La sim** (`src/engine/`, ~80 modules sans dépendance three pour le cœur) : ballon physique
  (traînée, Magnus, rebond), balistique inverse des passes, duels (tacle debout/glissé), gestes
  à trois temps (armé/contact/accompagnement), gestes techniques (râteau, feinte de passe, semelle,
  passement de jambes — simple/double, sorties fixer/contre-pied/temporiser —, crochet — court,
  standard, chaloupé —, feinte de frappe ; l'engagement et la vente lisent la note dribbling), tir,
  gardien (plongeon, sortie dans les pieds, un-contre-un, prise à deux mains), remises selon la
  règle, personas (identité de mouvement par joueur), latence de
  perception, terrain-donnée (réduit ET Loi 1).
- **L'habillage** : couche de geste absolue (pose = rest ⊗ spec), Motion Warping de contact
  générique — QUATRE consommateurs d'une même capacité : le pied de frappe (planaire, calibré en
  ligne), le gant du plongeon (planWarp3, IK deux os, time-warp du clip vers l'heure du ballon),
  la racine (le bassin complète la détente, borné) et le pied de conduite (chaque événement
  'touche' de la sim tend le pied vers le ballon — le contact invisible était lu « il ne touche
  jamais le ballon ») —, verrou de pieds IK, regard
  (saccades/poursuite), inclinaison dans l'accélération,
  cadence de jambes asservie à la vitesse sol, stade paramétrique (tribunes, pelouse peinte,
  cages — tout suit `{pitch, goal}`).
- **La preuve** : 44 bancs node (`skills/threejs-aaa/scripts/verify-*.mjs`), deux audits
  composés en navigateur headless (`audit-membres.mjs` — les membres pendant les gestes,
  `audit-gants.mjs` — le gant sur le ballon à l'instant de l'arrêt), des sabotages nommés
  partout.

## La copie à consommer

Le produit importable est `skills/threejs-aaa/assets/starter/` (mêmes fichiers que
`examples/showcase/src/engine/`, synchronisés au md5 près — c'est une CLAUSE, `verify-sync.mjs`).
Prendre le dossier `src/engine/` entier ; les modules cœur n'importent ni three ni le DOM, les
modules visuels (`gesture-layer`, `foot-lock`, `strike-warp`, `gaze`…) importent `three/webgpu`.

## L'architecture en une loi

**Il n'y a QU'UN game-loop** : `rondo-sim.js#rondoStep(st, dt, cfg)`. Tout jeu de football est
une **configuration** de ce loop, jamais un fork. La preuve par l'exemple est `match-sim.js`
(~450 lignes) : le match réduit — deux buts, gardiens, tirs, remises, score — n'est QUE des
hooks passés dans `cfg` :

| hook `cfg.*` | signature | ce qu'il décide |
|---|---|---|
| `assignJobs(st, cfg)` | remplace l'attribution de rôles | qui presse, qui couvre, qui se démarque, où — c'est ICI qu'une **formation** vivra |
| `tryShot(st, c, cfg)` | avant l'intention de passe | tenter un tir (retourne true si un geste est engagé) |
| `onOut(st, cfg)` | le ballon a quitté l'aire | quelle remise (but/touche/corner/sortie — `pitch.outRule`) |
| `onDive(st, gk, cfg)` | chaque image d'un plongeon | le toucher du gant (prise/claquette), true quand résolu |
| `canTake(st, id)` | un joueur veut ramasser | l'ayant droit et l'heure d'une remise (et son POSÉ — remise portée) |
| `ballFetch(st, dt)` | le pas du ballon LIBRE | la remise portée : le preneur ramasse, porte au pied, pose (true = « j'ai fait avancer le ballon ») |
| `tryCross(st, c, cfg)` | avant l'intention de passe | le CENTRE de l'aile (lofted vers la surface, cible = coureur de boîte) |
| `tryClear(st, c, cfg)` | avant l'intention de passe | le dégagement de l'étau (botté lointain, cooldown d'équipe) |
| `passBias(st, c, o)` | terme du score de passe | le SENS du jeu (progression vers un but) |
| `leadTime(d, rec)` | la mène d'une passe | ballon dans la course d'un coureur |
| `appelBonus` | nombre | récompense du coureur en rupture |

Clés de `cfg` posées par le match (chacune neutre absente — le rondo ne les porte pas) :
`restartCarried` (la remise se PORTE, jamais snappée — sabotage nommé), `chaseLoose` (le ballon
libre est chassé par les deux camps — sabotage nommé), `apron` (tablier des corps : enjamber la
ligne pour chercher un ballon sorti ; 0 = les murs du rondo), `settleMin` (le ballon récupéré se
dompte avant de repartir), `speeds.walk` (le pas de remise — une remise est une respiration),
`carryLawLoose` (la bascule carry→libre lit la LOI DE TOUCHE — jamais sur une touche légale),
`shotVariety` (le répertoire du tir : l'espèce voyage dans `choice.shotKind`, exécutée par
strikeNow — vitesse ET hauteur), `keeperClaim` (la sortie dans les pieds : un ballon au sol à
portée de gants se ramasse, même « porté » — le label de conduite n'est pas un bouclier),
`carrySurge` (le porteur COURT sur sa touche poussée : au-delà du rayon collé, la pointe se
libère — le trottinement à 4 m/s derrière un ballon à 3 m était le « ballon loin des joueurs »),
`carryTight` (la CONDUITE SERRÉE par défaut : la touche pleine est l'acte nommé d'un burst —
posé sur le porteur en touchF, consommé par dribble.js),
`meetBall`/`meetZone`/`meetStep` (le receveur ATTAQUE son ballon d'un pas sur l'AXE de la
livraison dans les derniers mètres — pas un correcteur balistique : l'erreur latérale échappe),
`meetWalk` (LE RECEVEUR VIVANT, st.full : sur une passe dans les pieds ≥ 7 m il VIENT AU-DEVANT
sur l'axe NOMINAL à allure de marche, plafond 1,1 m — mesuré avant : p25 de vitesse 0,00 m/s,
14 % des vols FIGÉS > 60 % du temps, la statue au point de chute ; après : 0-1 % et la prise
dans le pas. Geste de CONSTRUCTION : à < `hold` m du but il tient son point de fixation — sans
la porte l'attaque redescendait, tirs 27 → 16 ; sabotage nommé « pose figée »),
`execSigma` (le déchet technique du joueur MOYEN, ≈ 2,5° — les notes le raffinent, l'urgence
l'aggrave ; sans lui le monde non noté exécutait parfaitement),
`carryViaBall` (le porteur PASSE PAR SON BALLON : au-delà de la portée de contrôle, la cible de
locomotion est le ballon réel, pas la poussée projetée — le corps ne court jamais en laissant
son ballon derrière),
`gkRelease` (LA RÈGLE DES SIX SECONDES à l'échelle : le gardien porteur se porte sur son spot
de distribution — jamais vers l'avant — et passé le délai la distribution est FORCÉE, meilleure
rampe sinon punt ; sans elle le gardien-porteur dribblait 87 m — sabotage nommé),
`lossReact` (LE DÉPOSSÉDÉ SE RETOURNE : pendant la fenêtre après sa perte, l'ex-porteur chasse
son ballon au lieu de repartir en coureur de slot dos au jeu — le contre-press du métier ;
sabotage nommé « course aveugle »),
`prepTouch`/`prepTouchF`/`prepDamp` (LA TOUCHE DE PRÉPARATION : quand le couloir de tir est
ouvert et le ballon de course hors de portée d'armement, la touche suivante SERRE et AMORTIT —
le canal vitesse `touchDamp` de dribble.js cale le ballon sous l'allure du corps, la pointe
s'arme plus tôt, la cible traverse le point de touche ; sans elle, le tir se refusait
'technique' en boucle jusqu'à l'empalement sur le gardien — sabotage nommé),
`pokeReach` (LE PIQUE : un ballon de conduite LIBRE est libre aussi pour l'adversaire — le pied
qui le bat au point le dévie, événement nommé, 50/50 réel ; sabotage « défenseur-spectateur »).

Chaque hook est un no-op absent — le rondo d'origine est inchangé au bit près quand `cfg` ne les
porte pas (mesuré : verrou de balance identique).

## Les invariants à respecter (la charte, `skills/threejs-aaa/reference/50`)

1. **Une autorité par corps et par phase.** Position/lacet d'un joueur : la sim. Pendant un
   geste : l'horloge du geste (`ownsBody`). Le visuel COPIE, il ne ré-invente pas.
2. **Le ballon ne se téléporte pas.** `ball-body.js` refuse l'écriture de position ; on passe
   par `impulse/strike/carry/escort/restart(cause)` — et toute remise a une cause nommée.
3. **Un refus se nomme** (`deny(st, cause)`) : quand le jeu s'étrangle, on lit le registre
   `st.deny`, pas des hypothèses.
4. **Les événements portent leur géométrie** (`st.events`) : chaque passe/tir/duel/geste inscrit
   les nombres sur lesquels il s'est décidé — les contrats jugent ces nombres, jamais une
   re-mesure d'après coup.
5. **Le hasard de partie est seedé** (`st.rnd`) : même graine, même match. Les identités
   (persona) sont des fonctions pures de (id, graine). Ne jamais consommer `st.rnd` dans du code
   optionnel sans y penser : chaque tirage re-distribue la partie.
6. **Toute loi nouvelle arrive avec sa mesure avant/après et sa clause** (un banc `verify-*.mjs`
   ou une clause dans un contrat existant), plus un sabotage qui prouve que la clause mord.

## Le 11c11 (le chemin balisé — ET PROUVÉ : `match11.html`)

Depuis le lot 9, le plein format est une CONFIGURATION livrée : `makeMatch({ full: true })` —
terrain Loi 1 (105 × 68), 10 + gardien par équipe, formation 4-3-3 (`formation.js` : postes en
fractions du terrain, bloc qui COULISSE avec le ballon et respire avec la possession). Les
couloirs dynamiques du réduit sont réservés au soutien rapproché (4 corps près de l'ancre) et au
marquage (4 marqueurs + press + cover) ; tout le reste tient SON poste — c'est ce qui fait qu'un
22-corps reste un bloc lisible, pas un essaim (sabotage nommé : sans les postes, la dispersion
du bloc s'effondre de 15,2 à 9,4 m). Mesuré : sim 22 joueurs 0,38-0,44 ms/step ; scène complète
(couches de gestes + IK + warps × 22) 3,65 ms/image CPU ; fps 22 corps = 75 % du fps 12 corps en
rasterisation CPU pure — l'architecture scale, le rendu n'a AUCUNE tuyauterie de plus que le
réduit (même scène, même entrée à un paramètre près). Banc : `verify-match11.mjs` (17 clauses).
Dette nommée : l'ÉQUILIBRE de jeu du plein format (tempo, portée de tir — `shotRange: 20` posé
en override —, conversion : les bandes fines du réduit restent à calibrer pour le 105 m).

Depuis le lot 10, le plein format vit sous **la Loi 11** (`offside.js` — pure, `checkOffside`) :
UNE ligne (l'avant-dernier adversaire, tenue par le ballon, jamais dans sa moitié), UN instant
(le DÉPART du ballon — `strikeNow`), et quatre consommateurs gardés par `cfg.offside && st.full`
(le réduit reste futsal, le rondo au bit près) : le CERVEAU n'y sert personne (`choosePass`
écarte, `beginPass` refuse — refus nommé `hors-jeu`), la PHOTO se prend à la frappe
(`st.pass.off` — dégagements et tirs compris : le renvoi qui trouve un attaquant resté aux six
mètres est LE hors-jeu classique), le premier toucher SIFFLE (`receive` → `st._whistle` →
coup franc adverse administré par le match, même cérémonie portée qu'une sortie), et les
POINTES SE CALENT sur la ligne (postes 7-9 bornés à ligne − 0,8, relus chaque image). L'appel
timé en jaillit : pointe À PORTÉE DE PASSE et devant le ballon, porteur posé, couloir profond
ouvert → dart de 7 m vers la ligne (jamais au-delà), servi par `appelBonus` + `appelRange`
(l'appel ÉTIRE l'enveloppe de passe : un ballon dans la course est plus long qu'une passe de
circulation — sans lui, mesuré : 11 appels, 1 servi, la décoration). Mesuré : 2-5 appels/180 s,
~27 % servis, pointes en position illicite ≤ 0,4 % du temps de possession (pire graine).

Depuis le lot 11, la défense du plein format **presse SUR SIGNAL** (`pressTriggers`) : deux
déclencheurs de l'école du pressing, lisibles dans l'état sans oracle — la PRISE DOS AU BUT
(porteur qui reçoit tourné vers son but, dans son camp) et la PASSE EN RETRAIT de la relance
basse (origine à 4 m dans leur camp, ballon qui recule de 3 m). La fenêtre est bornée (4,5 s,
cooldown 6 s — le patron du contre-press `lossReact` à l'échelle de l'équipe) : second presseur
sur le pivot (la couverture est LE pari perdu du pressing — assumé), marquages au demi-pas
(1,4 → 0,95 m, cadence 0,35 s), bloc posté qui monte de 3,5 m. L'OMBRE DE COUVERTURE
(`coverShadow`) fait arriver le presseur PAR le couloir du soutien le plus profond — son corps
vit dans la ligne de passe pendant l'approche (`laneClearance` mesure des corps réels : l'ombre
est du positionnement, pas une règle de plus) ; à portée de duel elle cède au tacle. Mesuré :
6-11 fenêtres/180 s (~2-4/min), la LIGNE de hors-jeu adverse descend de 9 à 18 m pendant les
fenêtres (23-27 m sous press contre 35-41 au calme — le bloc qui monte fait exister la Loi 11),
régains en fenêtre 1-5 ; la compression moyenne des 10 corps, elle, ne bouge pas (diluée —
mesuré et assumé : l'instrument du pressing est la ligne). Le pressing a aussi EXPOSÉ un trou
latent du moteur : une passe trop molle mourait au sol avant son receveur et la phase `flight`
n'avait plus de sortie (gel de 145 s, graine 3) — deux lois le ferment, `deadFlight` (un vol
mort est un ballon LIBRE ; la photo de la Loi 11 survit au vol mort) et `releaseTtl` (la garde
anti-auto-interception a une horloge : une protection pensée pour l'instant du départ ne
verrouille pas l'éternité). Le gel est ressuscité en sabotage nommé au banc. Sabotages : « press
sourd », « press en ligne droite », « gel ».

### Les quatre moments du jeu (`phases.js` — lot 14, le socle tactique)

`momentDuJeu(st, team)` → attaque-placée / transition-off / défense-placée / transition-def /
arrêt — pur, dérivé de la possession et de l'horloge du regain (cfg.moments, événements
'moment' mesurables). Les transitions sont les 5 s où le bloc adverse est déformé : le moteur
y branche le CONTRE-PRESS d'équipe (perte jeune et haute → fenêtre de pressing, le
Gegenpressing) et la verticalité du regain (appels profonds au cooldown relâché). Mesuré :
48-54 % du jeu ouvert en transitions (réel ~40-50). C'est le « quand » que la tactique
(`tactics.js`, à venir) et les rôles consommeront — un projet aval peut déjà lire le moment
pour ses caméras, son commentaire, son HUD. Banc : `verify-moments.mjs` (8 clauses, sabotage
« jeu sans moments »).

### Le catalogue de formations (`formation.js` — lot 17)

Trois systèmes livrés — 4-3-3, 4-4-2, 3-5-2 — et surtout la GÉNÉRALISATION : les lignes sont
une donnée (`LIGNES`), `premierOffensif(name)` remplace le « postes ≥ 7 » câblé (le calage
Loi 11 et les appels s'adressent aux pointes de N'IMPORTE quelle formation), `checkFormation`
juge tout le catalogue (lignes ordonnées par groupes, largeur à l'échelle — calibrée contre le
réel : un trois arrière est étroit PAR CHOIX, les pistons donnent la largeur). La formation vit
dans la tactique : `makeMatch({ tactics: [{ formation: '442' }, { formation: '352' }] })` —
deux systèmes, un seul moteur ; inconnue → repli 433 prouvé octet pour octet (sabotage
« formation fantôme »). Ajouter un système = ajouter DEUX tableaux (postes + lignes).

### La tactique d'équipe est un CONTRAT (`tactics.js` — lot 15)

Cinq axes [0..1] génèrent l'espace des styles — `hauteurBloc`, `largeur`, `pressing`,
`style` (possession↔direct), `transition` (conservation↔contre) — chacun branché sur des lois
prouvées (formation, fenêtres du lot 11, arbitre de menace par équipe, relaxation du lot 14).
`makeMatch({ tactics: ['gegenpressing', 'blocBas'] })`, presets dans `TACTIQUES`, objets
partiels acceptés, `checkTactics` au banc. LE DÉFAUT (0,5 partout) EST L'IDENTITÉ : le milieu
de chaque paire est l'ancienne constante mesurée, exact au bit (`axe(0,5)` rend le milieu sans
ulp). Mesuré : la hauteur déplace la ligne de +8,3 m, la largeur le trio de +4,2 m, l'école de
la chasse presse 5,8 s toutes les 7,8 s (contre 3,2/13,2 au bloc doux), et le style fait
basculer les choix serrés de l'arbitre (possession → passe, direct → tir sur le même monde).
Banc : `verify-tactics.mjs` (8 clauses, sabotage « tactique placebo »). Dettes nommées :
instruments de flux pressing/style/transition, catalogue 4-4-2/3-5-2 (couche rôles).

### Les rôles par poste (`roles.js` — lot 16b)

Le poste dit OÙ, le rôle dit QUOI, l'attribut dit COMMENT ça réussit — trois couches composées.
`makeMatch({ roles: [{ 8: 'neufDeSurface', 5: 'meneur' }, {…}] })` — catalogue (polyvalent,
neufDeSurface, ailierDePercussion, meneur, piston) ou objets partiels ; chaque rôle = biais à
identité par défaut : profondeur de poste ±2,5 m (le calage Loi 11 garde le dernier mot),
largeur personnelle ×0,9…1,1, cadence d'appels 14…6 s, poids d'arbitre ±15 % composés avec le
style d'équipe (un 9 direct dans une équipe possession reste un 9 — nuancé, pas écrasé : dans
une équipe directe, le rôle ne renverse pas le style, c'est mesuré et c'est le contrat).
Banc : `verify-roles.mjs` (6 clauses — mécanismes sur fixtures au chiffre près, sabotage
« rôles placebo »). Dettes nommées : rôles de pressing, formations 4-4-2/3-5-2, presets
tactiques portant leurs rôles.
Banc : `verify-identification.mjs` (lot 249 — le test d'identification « sans les noms » : 25 rôles du document à leur poste,
11 configurations × 6 graines, la signature du rôle contre le polyvalent du même poste graine par graine ; 18 signatures
exprimées gelées, le reste informatif = le backlog 250-254 ; les chiffres du document imprimés).
Banc : `verify-scan.mjs` (lot 250 — l'horloge de scan : déterministe par acteur, aucun bit de jeu, cadence de Jordet en vol,
la note scanning comme temps, jamais de saccade à la frappe ni à la prise ; le corps ouvert après le regard mesuré placebo).

Banc : `verify-book.mjs` (330 — LE BOOK COMME TABLE DU RÉEL : 25 sondes dans `scripts/book/`, une par chapitre du dépôt
`JulienDelquignies/book`, 2 × 90 min chacune ; informatif — il imprime, ne rougit jamais ; les cibles, les statuts et les lots
vivent dans `docs/Book_vers_Moteur/`, une fiche par chapitre, README pour la carte et les douze constats).

### L'échelle de finition (lot 258, `cfg.finition` — `strike-sim.finitionSigma`)

Le tir dévie **en angle** à la frappe, pas en mètres sur le point visé : σψ = 1,4° × finF (finishing, identité
à 50 : 2,24 à 0, 0,45 à 100) × pied faible (1 + 0,29 weakF) × pression (1 + 1,35 × composureF/1,075 × P, P = 1
au corps → 0 à 5 m) × fatigue (1 + 0,2 (1 − stam)) × (v / 22)^1,2 × distance (1 + 0,012 (d − 12)⁺) ; σθ = 2 σψ
(on manque au-dessus deux fois plus qu'à côté) ; la vitesse est log-normale (σ 0,08) et **sous-dosée** sous
pression et fatigue ; le point visé des frappes de but tire sa **hauteur** (bas 0,35 m / mi 1,0 / lucarne 1,95 à
62 / 30 / 8 %). La loi est pure et exportée (`finitionSigma(F, x)` → { sigPsi, sigTheta, sigV, muV }) : le banc
la lit telle quelle (bloc 258 : identité, monotonie, facteurs, sabotage sigma0 0) et la fixture (18 m, presseur
de côté, 48 frappes) mesure l'écart-type au plan (0,78 m ≥ 0,35 ; sabotage 0,002). `finition: null` = le 145
d'hier au bit. Mesuré à graines égales : cadrés 60 → 48 % (réel 33 + 27 contrés) ; la conversion ne bouge pas —
le contré manquant (258b) et le gardien contre les frappes hautes (Bible 02) sont les deux autres facteurs.
Fiches : `docs/Book_vers_Moteur/M10-modele-tir.md`, `R03-tirs-buts.md`.

### Le corps qui contre (lot 258b, `cfg.contre` — `duel.contreEngage` / `contreTir`, job `contre`)

Le 176 posait un rayon fixe de 0,38 m sur un corps immobile : 3-7 % des tirs contrés (réel 27). Le 258b fait du
contre une **décision à l'armé** : quand le geste du porteur porte un tir (`act.payload.choice.shot`, phase
anticipation), chaque défenseur de champ devant lui (≤ 8 m, ≤ 2 m de la ligne ballon → point visé) s'engage avec
P = σ(3 + 1,5 dans la surface + 0,8 dernier défenseur + 4 (aggrF − 1)) ; engagé, il prend le job `contre` (il court
vers le point de la ligne à 1-2,5 m du ballon, burst `_pace`), et son rayon d'obstruction grandit : R = 0,28 +
λ × 2,2 × (t − 0,18)⁺ ≤ 1,2 (λ 1,0 jambe tendue à ≤ 0,6 m de la ligne, 1,6 jeté). Le tireur **tire dans le
trafic** (`need` = 0,2 m au lieu de shotClear 0,45). Le contact tire son issue au flux seedé (Modèle 10 §5.2) :
renvoi 66 % (e_c 0,55, retourné ±40°), amorti 8 % (0,30 v), sortie 18 %, déviation 8 % (0,85 v ±12°, le tir
reste au tireur) — l'événement `contre` porte `issue` et `engage`. Mesuré 8 × 45 min : contrés 24 % (par graine
6-30), la limite étant géométrique (47 % des tirs ont un corps à < 3 m devant). `contre: null` = le 176 au bit.
Banc : bloc 258b (fixture 12 m, défenseur 1,5 m devant à 0,6 m de la ligne, 48 frappes : 98 % contrés, sabotage
0 %) ; le boulet du 176 épinglé `contre: null`. Fiches : `M10-modele-tir.md`, `R03-tirs-buts.md`, `R04-defense-duels.md`.

### Le carton juge la nature (lot 257, `cfg.carton` — `referee.adjugeFaute`)

Le 25 cartonnait à la récidive (2 fautes → jaune, l'imprudence double) : 9 jaunes et 2 rouges par match (réel 4 et
0,1-0,36). Le 257 fait voyager la **nature** avec la faute (`st._faute.kind / vSur / dir / arrache`, posés aux
sites de `duel.js` et `rondo-sim.js`) et l'arbitre la note : S = base[espèce] + 0,03 v(victime) + 0,3 (aggrF − 1)
− 0,15 si arrachée + 0,5 si la transition était prometteuse (victime lancée vers le but, ≤ 3 corps dans le couloir
de 8 m devant elle) ; le DOGSO (aucun couvrant dans la bande de 18 m, cos > 0,6, < 30 m) vaut rouge direct, sauf
dans sa surface sur un tacle (jaune + penalty). P(jaune) = σ((S − 0,8 − 0,25 si déjà averti) / 0,15) au flux seedé ;
l'ardoise cumule S et vaut jaune à 2,0 ; l'averti se retient (× 0,55 sur l'accrochage et le glissé imprudent). Les
événements `carton` portent `nature`, `kind`, `prometteur`, `dogso`, `direct` / `second`, `repetee`. `carton: null`
= la récidive du 25 au bit. Banc : bloc 257 (fixtures sur `adjugeFaute`, P(jaune) ordonnée par nature, DOGSO,
réticence, sabotage) ; verify-cartons et verify-expulsion épinglés `carton: null` (ils mesurent la récidive).
Les alias du 256 (`pass.from`, `turnover.to`) sont retirés : `by` et `equipe` seuls. Fiches : `M12-regles-arbitrage.md`,
`R10-arbitrage-lois.md`, `R04-defense-duels.md`.

### L'orteil et la course qui traverse (lot 259, `cfg.horsJeu` — `offside.pointCorps` / `horsJeuTente`)

Hier 0,75 hors-jeu par match (réel 3,1-4,5) : la course de l'appel s'arrêtait à 0,15 m de la ligne (la ligne collante)
et la photo lisait le centre du corps. Le 259 : la photo de la Loi 11 (`strike-sim`, au départ du ballon) lit **la
partie du corps la plus avancée** — une capsule, tronc 0,2 m + pied avant 0,3 × min(1, v/8) × |sin(2π 2,2 t)| pour
celui qui court vers le but, l'attaquant vers le but adverse et le défenseur vers le sien (sa ligne recule) ; le cerveau
du passeur juge toujours le centre, l'écart est le hors-jeu d'un orteil. La course de l'appel **traverse** la ligne
(4 m au-delà) : le passeur sert tant que le coureur est en jeu, la frappe le juge. **L'appel de l'épaule** : la pointe
posée sur l'épaule (240d) prend 2,5 m de recul en plus de sa marge de rôle et part quand le porteur est prêt (≤ 5 m de la ligne, ≤ 28 m du
porteur, 12 m d'espace, cadence 12 s ÷ otbF), hors créneau et hors couloir. **La tentative** (Loi 11 (b)) : le
photographié qui arrive à ≤ 1,2 m du ballon en vol est sifflé sans son pied. `horsJeu: null` = la ligne collante et la
photo au centre d'hier au bit. Banc : bloc 259 (loi pure de la capsule, photo à 17,9 / 18 prise sous la clé et pas
sans, la tentative). Fiches : `M12-regles-arbitrage.md`, `R10-arbitrage-lois.md`, `09-avant-centre.md`.

### La pausa (lot 253, `cfg.pausa` — `pausa.js` : `pausaStep`, `ttpDe`, `engages`)

La temporisation était un tempo et une barre calme ; le 253 en fait une **décision** (Bible 07 §7 : « une
désynchronisation volontaire »). À l'adoption de l'intention (rondo-sim), `pausaStep` juge : le porteur au calme
(temps avant la pression ≥ seuil — 1,5 s au tempo posé, 2,0 au vif, × la tenue du rôle, ÷ composureF), dans la zone
[55 ; 88] % du terrain, ≥ 2 adversaires lancés vers le ballon, une course partenaire en cours qui n'est pas encore
l'option → il **tient** (aucune intention, la conduite figée dans match-sim : cible = soi, touche serrée). Il lâche
quand la course devient l'option (« servie »), quand la pression arrive (ttp < 0,7), quand la course meurt, ou à
2,5 s (« expirée »). L'événement `pausa` porte `duree`, `issue`, `gain` (score de l'option sortie / entrée ; ≥ 1,15 =
`valeur: true`, la pausa qui a produit — le reste est de l'hésitation, comptée telle quelle). `pausa: null` = l'adoption
d'hier au bit. Banc : bloc 253 (fixture : il tient, lâche sur la course servie avec gain, rompt sur la pression ;
sabotage). Fiches : `07-meneur-entre-les-lignes.md`, `05-milieu-defensif.md`, `14-micro-comportements.md`.

### La ligne haute et son piège (lot 255, `cfg.piege`, preset `ligneHaute` — `piege.js`)

L'axe tactique `piege` n'était qu'un décalage de +3 m sur la ligne postée. Le 255 en fait une **décision de ligne**
(Bible 03 T3b : la synchronie provoque le hors-jeu, pas la hauteur) : quand le porteur adverse arme une passe entre 14
et 45 m du but défendu, tirage 0,8 × axe(piege) par armé, la ligne arrière (les corps de champ à ≤ 4 m de
l'avant-dernier) reçoit **le même** `until` (0,8 s) et un pas de 3 × axe(piege) m — `piegeApply`, branché juste avant
le mouvement par le crochet `cfg.avantMouvement` du match, monte la cible de chacun depuis sa position courante ; la
photo de la Loi 11 (259) fait le reste. Le preset `ligneHaute` (hauteurBloc 0,9, piege 1, pressing 0,8, compacité 0,7,
stopper / récupérateur / 9 de surface) est le Barça de Flick. Mesuré 4 × 90 min : à hauteur égale piege 0 → 1,75
hors-jeu provoqués, piege 1 → 5,25 ; le preset 4,5 provoqués, 12 tirs concédés à 17,6 m, et le prix : 9 ballons reçus
derrière la ligne par match (équilibre 3,25). `piege: null` = la ligne d'hier au bit. Banc : bloc 255 (le preset, la
ligne qui se marque et monte, sabotage null, piege 0 à même hauteur). La sonde des presets : `scripts/book/sonde-255.mjs`
(deux faces par tactique). Fiches : `03-defenseurs-centraux.md`, `10-bloc-collectif.md`, `M14-consignes-et-formations.md`.

### La familiarité, le mécanisme relationnel (lot 254, `cfg.familiarite` — `familiarite.js`)

Une consigne neuve n'est pas un automatisme (Modèle 14 §7). Le consommateur injecte la familiarité de chaque joueur
avec le collectif (`squads[team][i].familiarite` ∈ [0 ; 1], défaut 1) ; η par équipe en est la moyenne, choquée à 0,7
par un changement de posture du coach et rétablie sur deux branches (le réalignement à 90 s, l'automatisme à 25 min —
0,35 → 0,64 à 2 min, 0,80 à 10 min). Trois canaux, ceux que le Référentiel 13 autorise (aucun ne touche la réussite
d'une action) : **Φ de la paire** (√(fi fj) × √η) pèse l'un-deux et le troisième homme (P × Φ^0,7) ; **la synchronie de
la ligne** au piège (255) est σ_sync = 0,12 + 0,40 (1 − η) s, chaque corps partant avec son retard ; le temps de
réaction et l'ancre restent des dettes nommées. Les lois sont pures et exportées (`etaApres`, `sigmaSync`,
`affiniteMotif`), l'état vit dans `st.fam[team]`, l'événement `familiarite` marque les chocs et l'événement `piege`
porte `sigma` et `desync`. Mesuré 4 × 90 min à familiarité 0,4 : motifs divisés par deux, désynchronisation 0,32 s.
`familiarite: null` = la ligne parfaitement synchrone et les motifs pleins d'hier au bit. Banc : bloc 254 (lois pures,
l'état et le choc, la ligne désynchronisée, sabotage). Fiches : `M14-consignes-et-formations.md`, `10-bloc-collectif.md`.

### Le profil locomoteur et le budget de course (lot 260, `cfg.locomoteur` — `locomoteur.js`)

L'accélération était constante (7,5 m/s² : la pointe à 4 m). Le 260 pose le profil du book (Modèle 02) : a = ε (V −
v)/τ avec V₀ = 8,8 × topF et τ = 1,17 ÷ accelF (F₀ borné [5 ; 10,2]), **l'intention d'effort** ε par métier (marche
0,45, bloc 0,55, pressing / chasse / porteur 0,85, rupture 1,0 — la poignée du volume d'accélérations), le freinage
saturé (−6 m/s² au-delà de 3 m/s d'écart, le roulé en dessous), et **le réservoir W′** (`p.wp` : vidange au-dessus de
5,5 m/s sur D′ 250 m ÷ stamF, récupération en 280 s) qui dégrade τ puis le freinage avant la pointe (λτ 0,22 > λD 0,18
> λV 0,07) et refuse la pointe sous 0,2 (`p._paceRefus`). Les lois sont pures et exportées (`profilDe`, `epsilonDe`,
`fatigueDe`, `pasLoco`, `budgetStep`, `pointePermise`). Mesuré 2 × 90 min : 16,65 → 13,9 km par joueur (réel 10,5), haute intensité 4 039 → 1 530 m (686), sprint 711 → 170 m (166), 13,7 → 1,45 accélérations par minute (0,9), ratio décélérations / accélérations 2,6 (> 1,15) ; les tirs inchangés. Le soutien de l'équipe en possession dans la moitié adverse court à ε 0,75 ; la petite demande (< 1,5 m/s) marche à 4 m/s² (sans quoi le gardien ne rejoignait jamais son ballon à 0,8 m). `locomoteur: null` =
l'accélération constante et les pointes gratuites d'hier au bit. Banc : bloc 260 (lois pures, la fixture du démarrage,
sabotage). La sonde : `scripts/book/sonde-260.mjs`. Fiches : `M02-locomotion.md`, `R05-physique.md`, `09-avant-centre.md`,
`16-contexte-de-match.md`.

### L'intention d'effort au cerveau (lot 261, `cfg.effort` — `effort.js`)

Le 260 a donné au corps un profil qui freine le volume ; le volume restant était COMMANDÉ par les métiers (46 % de la
distance dans la bande course 12-19,8 km/h, réel 30 %). Le 261 fait porter à l'INTENTION sa vitesse voulue et son ε
(`intentionDe`, appelée par movement.js avant l'économie de course ; l'ε est lu par `epsilonDe` depuis `p._effort`) :
**les trois régimes du suiveur** (support / mark / cover — le SAUT du slot ≥ 5 m déclenche le coulissement actif 4,2 m/s
pendant 2,5 s × workF, le marqueur × axe marquage ; sinon l'entretien suit le slot à sa vitesse, plancher 1,4 avec le
ballon et 1,8 sans lui ; au-delà de 12 m, en transition défensive à moins de 20 m du ballon, dans la fenêtre de pressing
des miens ou à moins de 10 m du ballon, la course entière), **le rayon d'atteignabilité du presseur** (`horizonDe` : une
cible à plus de 2,5 s × axe pressing × rôle press × workF se ferme au régime actif), **l'appel pertinent** (à 22 m du
ballon), **le repli qui n'est un sprint qu'en transition** (passé 5 s, la récupération à 5,0). Quand l'intention parle,
l'allure d'hier (57) se tait ; quand elle rend null, l'allure garde la main. Le score ne branche rien : le coach déplace
les axes (Bible 16). Mesuré 2 × 90 min : 14,24 → 13,37 km par joueur (réel 10,5), HI 1 621 → 873 m (686), HI 10,0 → 5,6 % de la distance (< 7), 1,46 → 1,17 accélérations / min ; le prix : 4 sprints c. 10 (les ruptures de 0,9 s ne montent pas à 7 m/s). Clé absente : la table des métiers d'hier au bit. Banc : bloc 261 (lois pures, la
fixture du suiveur tenue par `avantMouvement`, sabotage). Sondes : `scripts/book/sonde-261.mjs` (l'histogramme des zones,
par métier et par moment), `sonde-261b.mjs` (les ruptures par sorte). Fiches : `M02-locomotion.md`, `R05-physique.md`,
`10-bloc-collectif.md`, `16-contexte-de-match.md`.

### La couche de croyance (lot 262, `cfg.croyance` — `croyance.js`)

Le moteur était l'architecture A du Modèle 04 : chaque décision lisait `st.players`. Le 262 donne à chaque corps `p.vue`,
une croyance datée par entité (21 corps + le ballon), nourrie par `croyanceStep` en tête de `matchStep` : **le champ
visuel à deux canaux** (`qualiteDe` — détail ±30° / k 0,15, mouvement 75° / 0,10 conditionné à la vitesse en travers,
coupure 100°, portée 45 m × visionF, la tête ±80° vers le ballon ou la saccade du scan 250), **les niveaux** (identité /
équipe / présence / rien aux seuils du book), **l'observation** bruitée en distance à 10 Hz (`sigmaObs` 0,15 + 0,02 r
(2 − q), le flux de perception seedé par corps) et **la correction de Kalman scalaire** (`observer`), **la prédiction
paresseuse** (`predit` : v̂ amortie T_v 1,2 s ; σ² = σ_obs² + 0,9² τ² + ¼ (1,2 ÷ anticipF)² τ⁴, écrêtée 12 m) et **le repli
sur l'ancre** du slot après 2,5 s. `croyanceDe(p, ent, st, cfg)` est l'API de lecture : `{ p, v, sigma, age, niveau }`, l'état
vrai sans la clé. Consommateurs : le passeur vise sa croyance du receveur (strike-sim), le marqueur suit la sienne de son
homme (match-sim) ; **le regard de passe** (décider de servir X, c'est le regarder : une saccade de 0,2 s à l'adoption,
dans la portée de la tête). Mesuré 2 × 45 min : sans le regard, l'erreur du passeur 0,36 / 0,81 / 2,83 / 5,65 m par âge
croissant et le σ cru la prédit ; avec, 0,25 m (le bruit d'observation) et le fantôme ne vit qu'à la fixture ; 65,9 →
62,9 % de passes conservées (la bande de bruit). Clé absente :
l'omniscience d'hier au bit. Banc : bloc 262 (la table du book au centième, la croissance, le repli, la fixture du passeur
qui tourne le dos, sabotage). Sonde : `scripts/book/sonde-262.mjs`. Fiches : `M04-perception-cognition.md`,
`14-micro-comportements.md`, `10-bloc-collectif.md`.

**Le journal (`st.events`) vu d'un consommateur (256).** `shot` est le SEUL événement de frappe ; `tête` et `volée`
sont le GESTE et accompagnent le `shot` (qui porte `geste`) quand ils vont au but ; `tacle-pique` est un tacle, `piqué`
une passe en profondeur. L'auteur d'un événement est `by` (`pass.from` reste un lot en alias). `pass.to` est un joueur ;
`sansCible: true` marque le ballon expédié sans destinataire (dégagement, urgence) — pas une passe manquée.
`turnover.equipe` est l'équipe qui perd (`to` en alias un lot). `press` et `contre-press` portent le lieu `p: [x, z]`.
`remplacement { sortant, entrant }` : `p.id` est un maillot, pas une personne. Le rendu peint `p.number` et le `look`
champ par champ ; `applyKit` se rappelle sur un modèle déjà posé.

### Le pas de décision séparé du pas physique (lot 263, `cfg.cadence` — `cadence.js`)

Le Modèle 01 demande deux horloges (décision 0,10 s, physique 0,02 s) et juge par le test 3 : « un décalage de moyenne
> 5 % entre deux pas prouve des constantes en ticks ». Le moteur vivait un seul pas à 60 Hz. Le 263 donne au cerveau son
horloge : `pasDecision(st, dt, C)` accumule le temps physique et rend vrai toutes les `dec` s (le premier pas décide, la
phase se conserve) ; `rondoStep` n'appelle `assignJobs` (les postes, le marquage, le pressing, le gardien, l'administration)
et **le choix du porteur** (choosePass, les niches du 1c1) que sur un tick, tandis que le corps, le ballon (`stepBall` :
n = ⌈|v| dt / (r/2)⌉ sous-pas, plus fin que le K = 5 du book), les gestes, la perception (la croyance à son dtObs), le contact
et l'arbitre — avec son administration, les remises et **le gardien** (sa décision est une réaction de corps ; au tick il
coûtait 2 buts par match) — vivent à chaque pas physique. **La porte d'exécution** : sous la clé, le bloc du porteur s'ouvre au tick sans
le ballon au pied pour choisir (l'intention s'adopte) ; le tir, le centre, le dégagement, `beginPass`, la semelle et le
choix pressé attendent la porte (reachNow ou la gâchette près du but / du centre) au pas physique — décider → préparer →
s'engager. `hzDecision(cfg)` (60 sans la clé, 1 / dec avec) dit en secondes les constantes du cerveau écrites en images :
l'EMA de la poussée (τ 0,35 s), la vitesse de tour du retournement, le vol mort (0,3 s). Mesuré 8 × 45 min (le test 3, pas
physique 1/60) : dec 0,05 → 0,10, D_KS(possession d'équipe) 0,034 (non réfuté à n ≈ 1 340), passes −4,0 %, tirs +5,0 %,
conservées +1,7 pt ; face à hier : 1 085 → 997 passes, 63,3 → 65,2 % conservées, 34 → 37 tirs (le prix : la surface 69 → 54 %
au flux du 232), plongeons 19 → 15,5, CPU p50 430 → 192 µs par pas (182 → 121 s par match). Clé absente : chaque image décide, hier au bit. Banc : bloc 263
(les ticks par pas, la phase, hzDecision, le vol mort, 600 appels du cerveau par minute à 1/60 comme à 1/30, sabotage).
Sonde : `scripts/book/sonde-263.mjs` (+ `ks-263.mjs`). Fiche : `M01-boucle-simulation.md`.

### Les flux RNG nommés (lot 264, `cfg.flux` — `rng.js`)

Le hasard du jeu vivait sur deux flux séquentiels partagés (`st.rnd`, `st.rnd2`). Le 264 pose le tirage à coordonnées du
Modèle 01 §3.1 : `draw(graine, flux, tick, entité, k)` (finaliseur murmur3 sur entiers 32 bits) et `tirage(st, nom, entité,
hier)` qui rend une fonction pure sous `st._flux` (posé par `matchStep` : la graine, le tick physique, le compteur k par
(flux, entité) remis à zéro chaque pas) et `hier` sans la clé. Huit flux : passe, tir, duel, geste, arbitre, intention, cpa
(la perception a ses LCG par corps). Cinquante-quatre sites convertis dans treize modules, chacun gardant son expression
d'hier au bit sans la clé. Mesuré : un `st.rnd()` ajouté à chaque image laisse 2 × 300 s de match bit-identiques sous la
clé et les déplace sans elle. Clé absente : le flux séquentiel d'hier au bit. Banc : bloc 264 (les lois pures, la
corrélation des entités voisines, la fixture de neutralité, sabotage). Sonde : `scripts/book/sonde-264.mjs`. Fiche :
`M01-boucle-simulation.md`.

### La passe qui se manque à la bonne distance (lot 265, `cfg.passe` — `reception.js`)

**La réception à quatre issues** (`issueDe`, appelée par rondo-sim à la capture) : la fuite du premier contact `toucheDe`
(d0 0,85 × (v_rel/10)^0,8 × (1 + 0,5 P) × 1,55 en l'air ÷ controlF), la pression `pressionDe` (le temps d'arrivée du presseur
au BALLON, + 0,5 s s'il est derrière le corps), le manqué de Weibull `pFailDe` (2,6 % nominal), le contesté (TTP < `budgetDe` :
0,4 s propre, 0,55-0,8 lourde) en 50/50 × chargeF, la touche propre PROTÉGÉE (`p._protege`, lue par le porté). **L'erreur de
geste** (`sigmaPasse`, strike-sim) : 1,4° × la note (passSigma ÷ 3,25°) × la classe (`classeDe`) × (1 + 1,2 composureF P) ×
(1 + 0,012 (d − 12)⁺), le dosage log-normal σ_v 0,06 (le sous-dosage du book disponible, éteint : dette). Mesuré 2 × 45 min
(complétion = première touche d'un coéquipier) : 79 → 80 % (réel 80-83), 87 / 84 / 75 / 56 par tranche. Clé absente : la
réception et le σ d'hier au bit. Banc : bloc 265 (les tables du book, la fixture du presseur dans le dos / devant, sabotage).
Sonde : `scripts/book/sonde-265.mjs`. Fiches : `M09-modele-passe.md`, `M07-pression-lignes-de-passe.md`.

### L'interception non omnisciente (lot 266, `cfg.interception` — `interception.js`)

Le défenseur d'hier visait le ballon vrai à chaque tick. Le 266 pose la latence de lecture `tauLecture` (0,25 s × (2 −
anticipF) : pendant ce temps sa cible relative au ballon est celle du ballon au départ), puis le ballon CRU (`ecartCru` :
la croyance du 262, `croyanceDe(q, st.ball)` — l'écart cru − vrai se retranche aux cibles press / intercept / cover par
`interceptionApply`, appelé avant `movePlayers` pendant un vol), et le passeur projette les défenseurs là où il les croit
dans sa course de refus (strike-sim, `interception.passeur`). Mesuré 2 × 45 min : réussite 80 % (=), courtes 87 → 91,
longues 56 → 61, bloquées 4 → 3 % ; la tranche 15-30 yd reste à 71-75 dans toutes les ablations (la sélection du passeur,
lot suivant). Clé absente : l'omniscience d'hier au bit. Banc : bloc 266 (la latence, l'écart au départ, la fixture face /
dos, le marqueur intact, sabotage). Sonde : `scripts/book/sonde-266.mjs`. Fiches : `M07-pression-lignes-de-passe.md`,
`M04-perception-cognition.md`.

### La sélection calibrée du passeur (lot 267, `cfg.selection` — `selection.js`)

Le barème de `choosePass` jugeait la passe en mètres sans nommer sa probabilité. Le 267 pose (1) **la classe nommée**
(`classeNommee` : les douze du book — SHORT/MID/LONG_GROUND, CHANNEL, THROUGH, CHIP_THROUGH, SWITCH, CROSS, CUTBACK,
LAY_OFF, ONE_TWO_RETURN, BACK_SAFE — par les drapeaux du choix, la distance et le sens), (2) **P_succ prédit** (`pSuccDe`
: P_rel (la sortie de balle sous la pression du porteur) × S (`survieDe` — la survie de Spearman à la plus courte
approche : par défenseur la logistique σ 0,45 s du temps d'arrivée et le taux de prise λ 4,3 sur une fenêtre 0,25 s,
`survie: 'max'` = le seul défenseur affecté) × PPCF_r (la compétition terminale au point de chute, avantage 0,3 s au
receveur servi) × P_ctrl (le 265)), (3) **le calage log-odds par classe** (`calage[cls] = [α, β]`, ajusté DATÉ 267 sur
1 469 passes du monde d'hier — β 0,26-0,47 : la factorisation crue est omnisciente, test 2 du book), (4) **le terme au
barème** poids × ρ × (logit P̂ − logit p0), ρ = axe(mentalité, 1,5 → 0,5) × decF : LA SÉLECTION RÉORDONNE, ELLE NE RETIENT
PAS (le niveau lu par la barre d'adoption reste le meilleur barème nu d'hier), (5) **le journal** : l'événement pass porte
`cls`, `pSucc`, `pBrut`. Mesuré 4 × 45 min : réussite 80 → 81 % (réel 80-83), 89 / 84 / 73 / 59 → 88 / 83 / 77 / 60 par tranche (la tranche 15-30 yd que le 266 nommait), bloquées 4 %, tirs 16,3 → 17,3 ; fiabilité ECE 0,020 (< 0,025), log-loss 0,414 (constante 0,545 battue, Logistic Net 0,384 pas atteint) ; la consigne : mentalité 0 joue ses longues à 66 %, mentalité 1 à 53 % (plus de renversements et de profondeur). Clé absente : le barème d'hier au bit. Banc : bloc 267 (les
douze classes, la survie, la monotonie, le calage identité / daté, ρ × 3, choosePass sous la clé, sabotage). Sonde :
`scripts/book/sonde-267.mjs` (les classes, la fiabilité ECE / log-loss en 10 bacs, la part arrière). Fiches :
`M09-modele-passe.md`, `M07-pression-lignes-de-passe.md`.

### Le noyau commun de duel (lot 268, `cfg.noyau` — `noyau.js`)

Hier le take-on se résolvait par la géométrie et des tirages épars : tout geste « vendu » mordait le défenseur, le petit
pont tirait à la note, la dépossession venait par la physique — ni faute obtenue, ni sortie en touche, ni gradient
spatial. Le 268 juge le take-on UNE fois, au contact du geste de dribble (passement, crochet, double contact, petit pont,
roulette) contre un homme (`noyauAuContact`) : un **multinomial log-linéaire à huit issues** (franchi / franchi + faute
obtenue / franchi + sortie / neutre + touche / neutre / dépossédé / dépossédé + faute / dépossédé + sortie — `ISSUES`),
un score de franchissement s sur les **features du book** (`featuresDe` : la marge μ* du **disque d'atteinte** de
Fujimura-Sugihara — `disqueDe`, α re-ajusté pour que R(1 s) soit la course du profil du moteur, `margeDe` sur l'éventail
de 9 points à 2-5 m ; la vitesse relative, le désalignement du buste du défenseur, la distance à la touche, la pression
secondaire, la distance au but, les défenseurs dans le cône de 3 m, a_A − a_D bornés à ± 0,7), des intercepts b_o
**recuits DATÉ 268** sur 148 take-ons du moteur (`cfg.noyau.b` — les parts marginales tombent sur celles du book), le
tirage Gumbel-max sur le flux 'duel' (`tirerIssue`). Les conséquences (`appliquerNoyau`, appelé par le pas de jeu) :
franchi = la morsure d'hier ; franchi + faute = la faute posée (l'avantage la joue) ; les sorties poussent le ballon en
touche à moins de 8 m de la ligne (sinon remappées, nommées) ; neutre = le statu quo ; dépossédé = le transfert physique
(`receive`). Le journal : l'événement duel kind 'take-on' (issue, μ*, bande x, couloir). Mesuré 8 × 45 min : take-ons jugés 19 / match (réel 25) — franchi 54 % (book 59,4), dépossédé 28 (27,1), faute obtenue 14 (9-14), en touche 5 (12-19 : les take-ons du moteur vivent loin de la ligne, remappés, dette) ; le gradient 62 / 58 / 63 / 34 / 38 / 17 % par bande (book 0,68 → 0,41 : la pente y est, ≥ 0,20) ; l'ancienne métrique (gardé à 1,5 s) 23 → 27 %, faute 2 → 12, perdu 74 → 61 ; fautes 10 → 12,2 / match (réel 21,4).
Clé absente : la géométrie d'hier au bit. Banc : bloc 268 (les intercepts du book, le disque à 1 s, μ* loin / sous le
nez, la monotonie en μ, le gradient, la sortie contre la ligne, Σ p = 1, Gumbel forcé, le contact, les conséquences,
sabotage). Sonde : `scripts/book/sonde-268.mjs`. Fiches : `M11-duels-stochastiques.md`.

### La nature des gestes (lot 269, `cfg.nature` — `nature.js`)

Tout le monde dribblait (le meilleur / le médian 2-4, réel ≥ 5) parce que le moteur modulait le taux de réussite et non la
fréquence de tentative ; le tacle glissé était l'action ordinaire (18-23 / match, réel 6,7) avec 2-6 % de fautes (réel
24). Le 269 pose (1) **le spécialiste** (`specialisteF`, lu par `dribM`) : la tentative de geste de dribble × exp(k ·
(flair centré + a_A)) ÷ sinh(k)/k — l'espérance à 1 sur le flair uniforme (le volume se redistribue, il ne gonfle pas),
le joueur à flair 1 tente e^k = 5 × le médian ; (2) **le glissé de dernier recours** (`glissePermis`, dans
`slideTackleStep`) : on ne se couche que BATTU (le ballon n'est plus prenable debout — `balPrenable` faux) et au taux
imposé du book (p × aggrF × consigne duel ; le refus consomme l'espacement d'équipe) ; (3) **la faute du glissé**
(`fauteGlisse`, aux deux temps du vide) : le glissé manqué à portée du corps est une faute avec pFaute, sa nature
'tacle-glissé' (l'arbitre juge nature et carton). Mesuré 8 × 45 min : gestes de dribble 35-39 / match (réel ≈ 40 ; take-ons 19-21, réel 25 — avant 28-45 / 17-22), le meilleur / le médian 7-11 (≥ 5 ; avant 4-10), glissés 18-26 → 4,6 / match (réel 6,7), P(faute | glissé) 2-6 → 19 % (réel 24), fautes 12-14 / match (réel 21,4), jaunes 2-4 (3,1). Clé absente : les gestes et le
glissé d'hier au bit. Banc : bloc 269 (le médian à k / sinh k, e^k au flair 1, le refus sur ballon prenable, le taux,
la faute à portée sous le tirage, le monde, sabotage). Sonde : `scripts/book/sonde-269.mjs`. Fiches :
`M11-duels-stochastiques.md`, `14-micro-comportements.md`, `15-duels-seconds-ballons.md`.

### Le temps du match (lot 270, `cfg.temps` — `temps.js`)

Les cérémonies vivaient à 12 / 20 / 22 / 18 s (touche 11,7 mesurée, six mètres 21, corner 24 ; réel 17,7 / 30,3 / 36,9), le
temps additionnel était une fraction plate des arrêts plafonnée à 12 %, et le gardien n'avait pas de limite. Le 270 pose
(1) **les cérémonies dans la bande** (`bandeDe`, lu par `tempoWait`) : la bande Opta PL 2025-26 de chaque espèce (touche
12,7-21,7, six mètres 26,2-36,7, corner 30-50, coup franc 25,8-41,6) interpolée par le nouvel axe d'équipe `gestionTemps`
(0,5 = le milieu, l'identité ; 0 le rapide, 1 le lent), le tempo, le contexte et l'aléa du 217 restent ; (2) **le temps
additionnel qui lit le match** (`addDe`, dans `chronoStep`) : part × les arrêts de la période + serre s à la dernière
période si |écart| ≤ 1 (Maia et al.), borné [min ; maxPart × période] — l'effet Garicano reste nul ; (3) **les huit
secondes** (`huitSecondes`, au site de relance du gardien) : le gardien relâche à 6 s au plus, passé 8 s le corner est
sifflé pour l'adversaire du côté du ballon. Mesuré 4 × 45 min : les reprises 16,6-16,9 → 27-29,4 s (réel 26-32) — touche 11,7 → 17,3-18,0 (réel 17,7), six mètres 20-22 → 33,3 (30,3), corner 21-23 → 35-37,5 (36,9), coup franc 18 → 32-33 (26-42) ; le temps additionnel 108-259 → 260-333 s par période (réel ≈ 300), + 60 s par la loi quand l'écart ≤ 1 ; le ballon en jeu 75-77 → 68-69 % (réel 54-58 : le reste est le nombre d'arrêts, 61-73 c. 85-105, le 271) ; la durée totale 94 → 96 min (réel 100,6) ; le gardien tient p50 0,5 s, max 7,5, jamais huit. Clé absente : l'horloge d'hier au bit.
Banc : bloc 270 (la bande aux trois axes, l'espèce sans bande, le temps additionnel aux cinq cas, les huit secondes 7 c.
9 s, la touche rapide c. lente sur le même état, 600 s de reprises plus longues, sabotage). Sonde :
`scripts/book/sonde-270.mjs`. Fiches : `14-micro-comportements.md`, `16-contexte-de-match.md`, `M12-regles-arbitrage.md`,
`M01-boucle-simulation.md`.

### Les trois retours du 16/09 (lot 281, `cfg.remisePostes` + `cfg.rendezVous` — `rendezvous.js`)

Trois retours utilisateur sur le showcase fusionné, instruits par une sonde à trois volets (`scripts/book/sonde-281.mjs`).
**1. « Chaque coup franc, l'équipe qui tire vient à 10 autour du ballon. »** Mesuré : 8,5-10 corps de l'équipe qui remet à
moins de 6 m du ballon juste avant un coup franc (100 % des coups francs, dans les deux parents de la fusion) — sans spot de
plan (montée sur coup franc, appuis de touche), la cible de repli était LE BALLON. `cfg.remisePostes` : l'équipe qui remet
tient ses postes de formation ancrés au ballon, deux appuis en soutien (recul 5 m, côté 6 m), le preneur a son métier.
Mesuré après : 1,0-1,2 corps. **2. « Trop de mauvaises passes : dans le dos du receveur, des demi-tours. »** Mesuré : 37 % des
passes reçues faisaient faire un demi-tour (> 120°) au receveur AVANT la réception — 74 sur 91 à un receveur en course, 69 sur
91 à un ballon parti dans son dos : la mène d'hier (0,85 × min(0,4 + d/9, 1) s de la vitesse du receveur) ne rejoignait pas le
coureur au bout du vol, le ballon arrivait où il était. `rendezvous.js` (Modèle 09 §3.1-3.3) : le receveur en course (≥ 1,5
m/s) reçoit au RENDEZ-VOUS, la position prédite sous son plan de course à la date où le ballon y arrive — le point fixe T =
vol(r + v T) sur la balistique réelle du solveur (six itérations), la vitesse du coureur bornée vCourse × topF, la passe trop
forte ou trop longue repliée, puis le biais de sécurité dans le sens de la course (kb × ℓ × σψ du passeur, ≤ 2,5 m : trente
centimètres trop long ne coûtent rien). Le through garde la loi du 167, le tir et le centre leur cible, le receveur lent la mène
d'hier ; l'événement 'pass' porte rdv / biais. Mesuré 2 × 15 min : demi-tour avant la réception 36,7 → 20,1 % des reçues,
demi-tour total 65 → 50 %, pertes 134 → 122 / match, 68 % des passes au rendez-vous (le ballon « reçu dans le dos d'un receveur
en course » monte 11 → 17 % : c'est la course servie par-derrière, sans demi-tour). **3. « Les conduites ne sont pas fluides,
le ballon s'éloigne. »** Mesuré : pendant le port, ballon-porteur p50 0,30 m, p90 0,62 ; les poussées de conduite que le porteur
reprend lui-même : max p50 0,33 m, p90 0,99, p99 1,49, reprise en 0,08 s p50 — la conduite simulée est serrée. Les ballons
qui s'éloignent (10 % des poussées à plus de 2,5 m, p99 25 m) sont TOUS des ballons perdus : un adversaire les touche (6-9 m/s au
maximum de l'écart, événements 'touche' d'un autre corps) — des duels, pas des conduites. Ce qui reste à voir est le côté
VISUEL du port (le pied du clip et le ballon : foot-lock, gait, les touches du 11c11) — la branche animations, nommé, pas
mesurable ici. Clés absentes : hier au bit.

### La porte du tir dans la surface (lot 282, `cfg.prefiltreTir` — `prefiltre.js`)

Le Modèle 10 §1.4 : « la porte n'est pas évaluée à chaque tick ; elle l'est à 10 Hz, et seulement si un pré-filtre O(1) passe :
ballon contrôlé, distance au but < 35 m, angle visible > 4°, corps orienté à moins de 110° de la cible ». Mesuré avant
(`scripts/book/sonde-282.mjs`, 4 × 90 min) : 4,2 % des tirs contrôlés en surface partaient DOS AU BUT (corps > 110°, p90 60°),
0,63 tir par touche en surface pour 0,32 réel.

- **`prefiltreDe(K, { d, X, C, yaw, cap, pivotF, hold, holdMin })`** (pure) rend `{ ouvert, raison, corps, angle, tol }` : la première
  raison fermée dans l'ordre contrôle → distance → angle → corps ; l'angle visible est celui de Sumpter (`angleVisible` de `xg.js`),
  le corps l'écart entre le yaw et le cap au centre du but. **`entreesPrefiltre(c, goal)`** les lit sur un porteur.
- **Attributs en facteur** : `pivotF = lerp(0,85 ; 1,15, technique | agilité)` multiplie la tolérance du corps (93,5° pour le raide,
  126,5° pour le souple, 110° exacts à 50). **Rôles et tactiques** gardent leurs leviers dans Θ_i (272) — le pré-filtre est géométrique.
- **Où** : `menaceTir` rend le candidat tir à 0 (`pourquoi: 'pré-filtre-<raison>'`, compté dans `st.deny` hors distance) — l'arbitre
  rend la passe et la conduite ; `tryShot` refuse `deny('pré-filtre-<raison>')` — le porteur muré se retourne au lieu de frapper.
  La tête, la volée, la retournée (`tete.js`) n'y passent pas ; le lob garde sa porte.
- **Config** `prefiltreTir: { dMax: 35, angleMin: 4, corps: 110, controle: 0 }` ; clé absente : la porte d'hier au bit.
- **Mesuré après** : dos au but 4,2 → 0 %, p90 du corps 60 → 22°, 85 fermetures de corps par match ; touches en surface 50 → 63,
  tirs 42 → 45,5, 0,63 → 0,55 tir par touche. Ce que la sonde nomme : la porte du 272 est facile parce que la CONTINUATION est
  petite (EV_cont p50 0,024 : les passes offertes depuis la surface mènent hors du danger) — le prochain levier est le point de
  réception à meilleur xG (remise en retrait, crash de surface), pas un seuil.

### La ligne accrochée (lot 280, `cfg.ligneAccrochee` — `ligne.js`)

Le bloc défendant vivait chaîné à 27 m du ballon (lot 42) : la ligne arrière suivait le porteur mètre pour mètre jusqu'à son
propre but (à 6-8 m de sa ligne quand le ballon était à 25 m, 23-25 m derrière le ballon quel que soit l'état du porteur) et
montait au-delà de toute consigne quand le ballon reculait (52 m du but pour un ballon à 60+) — la surface était ouverte :
70-84 touches en surface adverse par match pour 51 (25,5 par équipe, PL 2024-25). Le 280 pose la loi de la Bible 10 §3.4 —
« k_y est une fraction, k_x est une saturation » : `accrocheDe`, x_ligne = min(consigne, x_ballon − marge) — régime LIBRE
(le ballon recule dans son camp : la ligne tient sa consigne, k_x = 0) ou ACCROCHÉ (la ligne suit le porteur mètre pour mètre,
k_x = 1), la marge de profondeur signée par l'état du porteur (`couvert.js`, 236 : couvert → la marge courte, le pas en avant ;
entre-deux ; découvert → le recul-frein). La consigne est l'AXE hauteurBloc (bas 22 → haut 52 m, l'échelle du Brief 18-26 /
34-44 / 48-56) ± l'axe piege ; l'anticipation est un facteur (marge × (2 − anticipF) : le bloc qui lit se tient plus près) ;
`ligneStep` (273) glisse les cibles de l'unité d'un bloc vers x_ligne et publie la référence accrochée que l'interligne (274) lit
— le régime locomoteur du 273 fait le corps (montée 4,8 / recul 3,9). Calage : les marges réalisées sont 2 m sous la cible
(le corps suit à son régime), les bandes du book (−2..+1 / +2..+4 / +6..+12) se posent donc à 2 / 6 / 12 (un balayage
−1/3/8 → 0/4/12 → 2/6/12 → 4/8/14 : 45,8 → 39,5 → 34,8 → 41,8 tirs sur les graines 3-13). Clé absente : la ligne chaînée à
27 m d'hier au bit. Mesuré 8 × 45 min : touches en surface adverse 76 → 59 / match, entrées 49 → 40, tirs 41,7 → 39,4
(dedans 31 → 28, dehors 10-11 tenu), buts 6,25 → 5,6 ; le film : ballon à 20-30 m → ligne à 20,6 m du but (7,7), ballon − ligne
4,2-4,5 m (16-17) ; ballon à 30-40 → 7-9 m (20) ; ballon à 60+ → la ligne à 37,9 m, sa consigne (51,9). Reste : les tirs par
touche en surface (0,5 pour 0,32 — la porte du tir dans la surface : le pré-filtre du Modèle 10 §1.4, le corps orienté à 110°
de la cible, l'angle visible, le contrôle avant la frappe), Θ0 ne coupe que les tirs lointains (0,01 → 0,04 : dehors 10 → 6,
dedans inchangé). Sondes : `scripts/book/sonde-280.mjs` (le volume par ses causes), `sonde-280b.mjs` (le film de la ligne par
bande de ballon et état du porteur). Fiches : `10-bloc-collectif.md`, `M10-modele-tir.md`, `R03-tirs-buts.md`.

### Le répertoire du book (lot 279, `cfg.repertoire` + `cfg.arretControle` — `repertoire.js`)

Les espèces de tir frappaient à 16,5-21,5 m/s nominaux (14-19 après la sous-dose), calées au 258 sur un gardien à seuil dur :
le ballon lent n'avait que 7-9 m/rad de sensibilité verticale (278) et donnait au gardien un budget temps d'un tiers trop long.
Le 279 pose le répertoire du Modèle 10 §3.1 (ch. 3 §4, les seules colonnes sourcées) : `GESTES` — intérieur placé 20 [15-25],
coup de pied 28 [22-33], enroulé 24 [20-28], pointu 16 [13-20], volée et demi-volée 26 [20-31], tête 13 [8-18] — avec les
colonnes de dispersion dont seul l'ordre est contraint (σψ relatif pointu 0,55 ≪ placé 0,7 < instep 1 < volée 1,55 ; σθ/σψ 1,1
→ 2,3) ; `FAMILLE` rattache les espèces propres du moteur (croisé → placé, ras-de-terre / flottante / mi-hauteur → instep,
lucarne → enroulé ; lob, piqué et coup franc direct gardent leur balistique exacte) ; `vitesseGeste` = v̄ × powF × la bride du
bout portant (l'instep à D < 8 m × 0,9 — « à bout portant, cadrer suffit »), bornée à la plage × powF ; `vMaxDe`, la borne
physiologique de l'échelle de finition par ATTRIBUT (ch. 3 §4 : « par attribut, pas par un record ») ; `dispersionGeste` sur
l'ellipse du 278. L'attribut `shotPower` (attributes.js : powF [0,90 ; 1,10], vMaxF → [33 ; 38] m/s, identité 1 à 50). La tête
et la volée (tete.js) frappent aux vitesses du book. L'ARRÊT AU JOURNAL (`cfg.arretControle`, match-sim) : le tir adverse que le
gardien CONTRÔLE dans les 3 s sans arrêt nommé devient un 'arrêt' mode 'controle' — mesuré : 6 arrêts sur 27 n'étaient pas
comptés, le taux d'arrêt se lisait 8 points trop bas. Clés absentes : les vitesses et le journal d'hier au bit. Mesuré 8 × 45
min : instep 23,8-24,4 m/s (28 × la sous-dose du 258), placé 17,2, enroulé 21,2-21,5, volée 26, tête 12,3-12,7, temps de vol
p50 0,69-0,72 s ; arrêts / cadrés 67-71 % (dedans 60-64, dehors 90-94 — les cibles 69 / 60 / 85 tenues SANS recaler
l'enveloppe du 276 : le gardien du book tient aux vitesses du book), au-dessus / à côté 0,83-0,93 → 0,91-1,18, cadrés 44-52 %
(le contrôle du gardien compte cadré — convention à ventiler), buts 5,25 → 6,25 / match (le volume). L'optimum intérieur
(Modèle 10 test 2, fixture à 16 m, 200 frappes par vitesse) : P(but) 2 / 4 / 16 / 10 / 12 % à 15 / 18 / 22 / 26 / 29 m/s —
non monotone ; à 24 m 0 / 2 / 1 / 8 / 2. Reste : le volume des tirs (42 pour 25), la sélection du geste par P_but (§3.2, le
softmax à T 0,35), le coup franc direct au répertoire. Sonde : `scripts/book/sonde-279.mjs` ; fixture `optimum279.mjs`
(scratchpad). Fiches : `M10-modele-tir.md`, `M03-physique-ballon.md`, `R03-tirs-buts.md`.

### L'ellipse de finition (lot 278, `cfg.ellipse` — `ellipse.js`)

Le 258 tirait trois bruits indépendants et centrés (cap, élévation, vitesse) avec le `gauss` du moteur — une somme de trois
uniformes : σ 0,707 et AUCUNE queue au-delà de 2,1 — et résolvait l'élévation dans le vide : mesuré sur le point visé du
277, cadrés 45-46 % (réel 33), 0 tir au-dessus de la barre pour 13 à côté (réel ≈ 1,5 pour 1), le plan du but atteint 0,35 m
sous la hauteur visée, σvert / σhoriz 0,64-0,74 (le book : 1,6-2,5). Le 278 pose l'erreur d'exécution du Modèle 03 §5 :
`normale`, l'inverse de la normale standard (Acklam, pas de Box-Muller — §5.3) à vraies queues, tronquée à |ξ| ≤ 3,5 ;
`ecartDe`, (Δψ, Δθ) une normale bivariée de corrélation ρψθ 0,2, ln v corrélé à Δθ (ρθv −0,35 : la frappe précipitée est
levée ET molle), la queue basse épaisse (× 1,6 sur les ξ < 0), les biais non nuls sous pression (la sous-dose du 258, le pied
qui s'ouvre μψ = 1,5° × P vers l'extérieur du pied qui frappe) ; `vitesseDe`, la log-normale tronquée [10 ; 33 m/s]. La
NOMINALE est INTÉGRÉE (`nominal`, Modèle 10 §3.4 : « le point visé est atteint par construction si la trajectoire nominale
est intégrée ») — predictPath jusqu'au plan du but, sept bissections de θ sur la hauteur visée puis le cap corrigé sur le z
franchi (traînée et effet du geste compris — le z visé voyage avec l'espèce, `zVisee`) ; f_corps = 1 + 0,9 (1 − cos Δφ) sur
le corps de travers (le facteur du book, absent du 258). σ0 2,0° (la borne haute du book) et l'anisotropie 4,5 EN ANGLE DE
DÉPART : la sensibilité verticale du ballon lent (16-19 m/s) n'est que 7-9 m/rad, pas 1,2 D — au plan du but le rapport
mesuré est 1,7-2,4, dans le [1,6 ; 2,5] du test 6. Attributs en facteurs (finF, composureF, weakF via finitionSigma),
pression et corps en axes ; clé absente : les trois gauss d'hier, au bit. Mesuré 8 × 45 min : cadrés 45-46 → 32-37 % (33),
au-dessus / à côté 0 → 0,83-0,93 (plan nominal : 11-16 % au-dessus, 14-17 à côté), σvert / σhoriz 0,7 → 1,7-2,4 (côté haut,
le sol tronque le bas), buts 6,1 → 5,25 / match, arrêts / cadrés 64-67 %, sorties de but 2 → 5-8 / match. Reste : le ratio
au-dessus / à côté sous 1,1 (les points visés du book vivent à 0,4-0,8 m des poteaux et la pression du 258 tient un tir sur
deux à P ≈ 1 : σhoriz 1,3-1,5 m), les vitesses de frappe du book (28 / 20 m/s — le 258 vit à 17-21), les montants (5-8 %
des trajectoires nominales à 0,17 m d'un poteau : le ballon le traverse, Modèle 03 §6.3), le volume. Sonde :
`scripts/book/sonde-278.mjs` (le plan nominal par predictPath, sans obstacle). Fiches : `M03-physique-ballon.md`,
`M10-modele-tir.md`, `R03-tirs-buts.md`.

### Le point visé (lot 277, `cfg.visee` — `visee.js`)

Le tireur visait toujours le coin loin du gardien, à 0,55 m du poteau : à 3,9 m du centre du gardien en médiane, aucune
enveloppe du book ne l'atteignait (276 : 55 % d'arrêts, 47 dedans). Le 277 pose le point visé du Modèle 10 §3.4 (Baron,
Sandholtz, Pleuler & Chan, Miss It Like Messi : un mélange de gaussiennes tronquées sur le plan du but) : `MODES`, les neuf
modes du book avec leurs poids (bas côté ouvert 26 %, mi-hauteur côté ouvert 17, bas côté fermé — le contre-pied — 14, premier
poteau 10, axial bas 9, mi côté fermé 8, vers le cadre 7, lucarne 5, sous la barre 4) ; `poidsDe`, les poids conditionnés
(composure → la lucarne, flair et gardien engagé → le contre-pied, gardien avancé → lucarne et lob, angle fermé → le premier
poteau, bout portant → l'axial bas ; identité exacte au 50) puis l'effondrement sous pression vers « le cadre » (P ≥ 0,7, le
rétrécissement du panier) ; `viseeDe`, le côté ouvert lu du décentrage du gardien sur la bissectrice du cône, le premier poteau
du côté du tireur, la troncature au cadre, un tirage seedé au flux 'tir'. Le point visé remplace le coin de tryShot (les gestes
exacts — lob, piqué — gardent leur cible), sa hauteur voyage avec l'espèce jusqu'à strike-sim (yVisee) et la dispersion du 258
s'ajoute ; l'événement 'shot' porte visee / yVisee. Attributs en facteurs (composure, flair, finition par la dispersion), la
clé absente : le coin d'hier au bit. Mesuré 8 × 45 min : arrêts / cadrés 52-55 → 69-71 % (dedans 39-48 → 65-67, dehors
93-100 → 87-92 — les cibles 69 / 60 / 85 du § 6.3 tenues avec le gardien du 276), buts 8,1 → 6,1 / match. Reste : la pression
du moteur effondre encore un quart des tirs sur « le cadre », les cadrés 45 % (la dispersion à recalibrer), le hors-cadre
au-dessus, le volume. Sonde : `scripts/book/sonde-277.mjs`. Fiches : `M10-modele-tir.md`, `R03-tirs-buts.md`.

### Le gardien à enveloppe continue et PSxG (lot 276, `cfg.enveloppe` — `enveloppe.js`)

Le gardien décidait son plongeon sur un seuil dur d'envergure (diveReach 2,95 m, le gant warpé) et le temps de vol au facteur :
« des gardiens omniscients et des murs à la limite exacte de portée » (Modèle 10 §6.3) — 77 % d'arrêts sur tirs cadrés,
74 % dans la surface (réel 69 / 60). Le 276 pose le budget temps qui SE CALCULE : `tempsDeVol` (e^{k_D D} − 1)/(k_D v_0),
`tDispDe` (t_f − τ_r (1 − 0,5 anticipation) − occlusion), l'enveloppe `porteeDe` qui PART DE VITESSE NULLE (R_0 + min(v_d [t −
τ_a (1 − e^{−t/τ_a})], R_max × keeping) : 0,025 m à 0,05 s, 1,44 m en 0,512 s, 1,68 en 0,571 — Monteiro 2022), l'ellipse non
centrée `rhoDe` (b = 0,8 a, centre 0,95 m), le régime réflexe (t_disp < 0,25 s : on bloque, R_0 seul), `pSaveDe` la sigmoïde
en R − ρ (+ réflexes, + handling, − vitesse, − dévié) et `decisionEnveloppe` : atteint si ρ ≤ R × marge (ou, sous `tirage`,
UN tirage de Bernoulli sur p_save — le seul aléa non physique de la chaîne, § 6.4). Le plongeon d'honneur part toujours,
mais hors enveloppe le gant ne résout pas ; PSxG = 1 − p_save journalisé sur chaque tir cadré (événement 'enveloppe',
`st.psxg[team]`). Attributs en facteurs : keeping → R_max, anticipation → τ_r, réflexes → β_2, handling → β_3. Calé : R_0 1,5
(le demi-corps et le bras), R_max 1,9 (le haut de la plage), marge 1,25 (le gant) — parce que le tireur du moteur vise le
poteau loin du gardien (ρ 3,9 m p50 : le point visé § 3.4 est la dette). Mesuré 8 × 45 min : arrêts / cadrés 77 → 55 %
(dedans 74 → 47, dehors 96 → 92 — le contraste émerge du budget temps, jamais codé), buts 4,9 → 7,3 / match. Sonde :
`scripts/book/sonde-272.mjs`. Fiches : `M10-modele-tir.md`, `R03-tirs-buts.md`.

### Le bloc qui perçoit (lot 275, `cfg.blocPercu` — `bloc-percu.js`)

Le bloc d'hier lisait l'état vrai du ballon : formationSpots à l'ancre réelle, une fois par image, pour les onze — les onze
partaient au même tick (mesuré : onset des cibles de bloc DEF = MID = ATT à 0,30-0,33 s après une passe latérale ; Bible 10
§4.4 : « le décalage temporel entre les lignes, la variable que les moteurs oublient et qui produit tout le réalisme »). Le
275 dérive la cible de bloc de chaque posté de SA croyance du ballon (croyance.js, 262 — le champ visuel, le dos au ballon, la
prédiction) relue à la latence de déclenchement du book : `latenceDe` = (0,22 + 0,008 × d) × (1 − 0,15 × anticipation
centrée) × (1 + 0,3 × (1 − stamina)) — 0,26 s à 5 m, 0,54 à 40 m ; `anchorPercu` tient l'ancre perçue (p._blocVu) jusqu'à
la relecture ; `decalageDe` décale le slot hoisté de la réponse du bloc à l'écart perçue − vraie : `kxDe` (1 en régime
accroché, 0 au plafond du rond central — la saturation du §3.4) et le gain latéral du bloc, borné. Les trois sites du slot
posté (le bloc, le poste du marqueur libre, la bande du marqueur) le lisent. Attributs en facteurs (anticipation, stamina ;
vision et scanning par la croyance), la clé absente : l'omniscience d'hier au bit. Mesuré 4 × 45 min (sonde-275) : l'ordre
ATT → MID → DEF émerge (onset 0,33 / 0,35 / 0,47 s), le décalage 1er → dernier 1,0-1,2 s (0,6-1,2) ; la fenêtre W du
renversement reste à prouver (3-7 renversements reçus par 2 × 45 min). Reste : le presseur et le couvreur à la croyance, la
parole de ligne. Sondes : `scripts/book/sonde-275.mjs`, `sonde-ch10.mjs`. Fiche : `10-bloc-collectif.md`.

### L'interligne dérivé et son point de rupture (lot 274, `cfg.interligne` — `interligne.js`)

Le 273 tenait la ligne arrière et mesurait son coût : l'interligne DEF↔MID 10,9 → 13,8 m, le milieu ne suivait pas — le bloc
d'hier compressait la formation à `long` 30 m, uniformément, sans lire ses joueurs. Le 274 pose l'interligne de Gourcuff
(Bible 10 §3.1-3.3) : `porteeDe`, la portée d'intervention d'un corps = base + gain × (0,5 pace + 0,3 anticipation + 0,2
stamina) lue des facteurs (10,5 m au 50, 15 au puissant, 6 au limité) ; `cibleDe`, la moyenne de la ligne du milieu × le mode
de bloc (l'axe tactique hauteurBloc : bas 0,55, médian 1, haut 1,15 — 0,5 = 1, l'identité), la cible [0,8 × ; 1 ×] bornée
[5 ; 14] / [6 ; 18] ; `interligneStep`, au tick d'équipe (1 Hz) la ligne du milieu tient ses cibles à [réf + lo ; réf + hi]
au-dessus de la référence de l'unité arrière (273 — sans `cfg.ligne`, rien), le presseur et le marqueur au contact intacts ;
`integriteDe`, le point de rupture DÉRIVÉ (§3.2 : le presseur arrive après la médiane de la possession individuelle à 19,4 m)
— WARN à 16, BROKEN à 19 tenu 2 s → blockIntegrity publié, événement 'bloc' kind 'rupture'. Attributs en facteurs, tactique en
axe, clé absente : le bloc d'hier au bit. Mesuré 4 × 90 min : interligne 13,7-13,8 → 10,8-12,6 m (cible 10-15), P95 22 → 20,
> 16 m 35 → 20 % du temps. Sonde : `scripts/book/sonde-ch10.mjs`. Fiche : `10-bloc-collectif.md`. Reste : la loi de
possession Gamma (test 20), les milieux libérés au marquage sous BROKEN, l'interligne MID↔ATT (la distance d'enfermement).

### La ligne est une ligne (lot 273, `cfg.ligne` — `ligne.js`)

La ligne arrière n'était pas une ligne : chaque corps tenait son homme ou son slot, le latéral monté remettait l'attaquant en
jeu, lineDesync p50 7,5 m (réel 0,8-1,8, pic ≤ 3,5 — Bible 03 T8). Le 273 en fait une UNITÉ (Bible 03 §2.3, Bible 10 §10.1
et le tick d'unité 4 Hz du ch. 01) : à 4 Hz `ligneStep` relit la référence x_ligne (le 2ᵉ plus reculé des cibles de l'unité —
la définition FIFA du hors-jeu), et chaque corps de la ligne OFF tient sa cible dans [réf − arriere ; réf + avant − retard_i] —
`retardDe` est le déphasage propre (1,3 × (2 − anticipF) × (2 − posF), 0,9-1,7 m au monde noté, la seule source de
désynchronisation en régime établi), `arriere` l'allongement du couvreur. Le presseur n'est pas de l'unité, le marqueur au
contact garde son homme côté but (retenu vers l'avant seulement). « On retient les avancés » : ligne vécue cassée (desync >
seuil) et ballon non couvert → le plus avancé qui monte freine (0,75 × sa pointe, 0,4 s — lu par movement.js). La hauteur est
un régime locomoteur (Bible 10 §3.4) : le corps à plus de tol m de sa cible rejoint la ligne en course avant (montée 4,8) ou
en recul organisé (3,9, × topF), lu par le régime d'effort (261). Le hors-jeu n'est jamais déclenché, il émerge (259).
Mesuré 4 × 90 min : desync p50 7,2-7,5 → 3,2 m (p90 18 → 17 : les transitions), recul de ligne 2,1 → 3,2 m/s, ligne cassée
606 → 398 épisodes, distance du central 10,2-10,6 km (9-11) ; coût nommé : l'interligne DEF↔MID 10,9 → 13,8 m (le milieu ne
suit pas la ligne tenue — Bible 10 lot 4). Sondes : `scripts/book/sonde-ch03.mjs`, `sonde-ch10.mjs`. Fiches :
`03-defenseurs-centraux.md`, `10-bloc-collectif.md`.

### Le xG en forme close et la porte de décision (lot 272, `cfg.xg` — `xg.js`)

La porte du tir était un seuil de menace (232 : une qualité e-fold contre 0,14 dans la surface / 0,05 hors) ; le book
(Modèle 10 §1-§2) demande une comparaison : on tire si xG_dec > EV_cont + Θ_i. Le 272 pose `xg.js` : `angleVisible` (atan2,
§2.1), `logitGeo` / `xgGeo` (le noyau de Sumpter — 8 451 tirs PL 2017/18 —, clampé à 35 / 20 m, décroissant au-delà : le
noyau diverge à 56 m), `coneDe` (l'occlusion Ω du cône par les capsules adverses fusionnées et pesées 1 − d/D ; la sortie
g et le décentrage η du gardien), `xgDe` → { geo, ref, dec } (ref : géométrie + tête / pied recentrés + Ω + pression — la
télémétrie ; dec : + gardien avancé / décentré + finition ±0,45 — la décision, jamais la référence), `thetaDe` (Θ_i : base
− temps·ln κ_ctx − doctrine·(shotDoctrine − 0,5) + fatigue + pression·P − rôle), `evContDe` (le xG du point de réception de
la meilleure passe × sa réussite attendue), `porteDe` (u = xG_dec / (EV_cont + Θ), lissé 0,5-1,5). L'arbitre note la passe
d'abord et passe sa continuation au tir ; chaque événement 'shot' porte xg / xgDec / omega (le pied, la tête, la volée, le
coup franc direct), `st.xg[team]` cumule. L'axe tactique `shotDoctrine` (0 travailler le ballon, 1 tirer à vue) est le
levier du consommateur — « gate de fréquence, pas le geste ». Attributs en facteurs (finF lu en log-odds, 1 = 50 → δ 0),
rôle en axe (arbitre.tir), tactique en axe. Mesuré 8 × 45 min : ΣxG 5,3 ≈ 5,1 buts AVANT (la physique convertit au
Sumpter ; la sélection est fausse : médiane 0,15 c. 0,06) ; sous la porte xG moyen 0,16 → 0,14, buts / tirs 15,6 → 11 %,
ΣxG 5,3 → 5,0 ; le volume (35 / match, 77 % dedans) ne bouge pas — les entrées dans la surface sont l'affaire du bloc.
Sonde : `scripts/book/sonde-272.mjs`. Fiches : `M10-modele-tir.md`, `R03-tirs-buts.md`.

### Le ballon fou (lot 271, `cfg.ballonFou` — `fou.js`)

Le ballon dévié repartait à 2-3 m/s (le pique 3,4 m/s, le contrôle manqué la vitesse d'arrivée × 0,62 dans son axe, le
glissé 3,2 m/s dans sa course) : il ne sortait jamais — 27-35 sorties par match (réel 60-70), touches 14-21 (réel 33-45),
le moteur « visait au lieu de dévier ». Le 271 pose la sortie stochastique du ballon disputé (Bible 15 §3.4) : après le
pique, le tacle qui dégage, le contrôle manqué et le glissé gagné, `appliquerFou` repose la vitesse du ballon — la norme
log-normale autour de 6,5 m/s (σ 0,35, bornée [2 ; 12]), la direction sur la normale enroulée autour de l'axe du dévieur
avec σ_θ par la qualité du point d'appui (`sigmaFou` : élite 45°, moyenne 75°, médiocre 100° ; `qualiteDe` lit les
facteurs de contrôle et de garde), sur le flux 'duel'. Le cône ± 45° à 45 % et le quart arrière (D8b, D9) en découlent.
Mesuré 4 × 45 min : 8 × 45 min — la vitesse du ballon à l'image du pique 3,3 → 8,0 m/s p50 ; les sorties 34 → 35 / match (touche 19 → 21, corner 6,5 = 6,5, sortie de but 8 → 7) : la loi est tenue au banc (D8b, D9), le monde bouge peu — le ballon dévié est ramassé avant la ligne (loose-kept 800-1 000 / match), et les sorties manquantes viennent d'ailleurs : les tirs qui ne sortent pas (37 tirs / match, 3 sorties de but — Modèle 10), les dégagements en jeu (44 / match, 10 % dehors), le jeu long qui ne se manque pas (5 % de passes ≥ 32 m, réel 8-20 ; conservées 54-69 %, réel 28,6). Clé absente : les déviations d'hier au bit. Banc : bloc 271 (σ aux trois qualités,
6 000 tirages : la vitesse, le cône, l'arrière, l'élite et le médiocre ; la pose sur le ballon ; 600 s de piques plus
vifs ; sabotage). Sonde : `scripts/book/sonde-271.mjs` (les sorties par espèce et par cause). Fiches :
`15-duels-seconds-ballons.md`, `M09-modele-passe.md`.

### Le cerveau on-ball est un CONTRAT (`menace.js` — lot 12)

Le patron Unity/Unreal au sens strict : **le moteur possède l'EXÉCUTION, le projet peut
remplacer la POLITIQUE.** Avant, le porteur vivait un ordre figé (tir, puis centre, puis passe,
sinon conduite — trois heuristiques qui s'ignoraient) ; depuis le lot 12, les quatre options
sont notées sur UNE échelle de menace (`arbitre(st, c, cfg)` → `{ tir, centre, passe,
conduite, meilleure }`, chaque note portant son `pourquoi`) et l'ordre devient un choix.
PAS DE SECONDE VÉRITÉ : chaque note se calcule avec les MÊMES primitives que son exécuteur
(`laneClearance`, le vrai `choosePass`, les seuils de position de `tryShot`/`tryCross`) — et
les exécuteurs GARDENT leurs portes nommées : l'arbitre propose, la loi dispose.

**L'injection** (la réutilisabilité demandée) — un projet aval remplace la politique entière
sans toucher une ligne du moteur :

```js
const cfg = matchCfg({
  decide: (st, c, cfg) => {
    // votre cerveau (arbre de comportement, ML, script de match…) — le moteur exécute
    return maCoachIA.choisir(st, c) ?? { meilleure: 'conduite' };
  },
});
```

Le contrat de retour : `{ meilleure: 'tir'|'centre'|'passe'|'conduite' }` (les notes sont
optionnelles — l'événement `arbitre` les logge si présentes). Les poids `cfg.menace`
(`{ tir, centre, passe, conduite }`, multiplicateurs) sont le réglage d'équipe léger — une
équipe directe monte `tir`, une joueuse monte `passe` — sans écrire de décideur. Gardé
`cfg.menace && st.full` : le réduit et le rondo vivent l'ancien ordre au bit près. Mémoïsé
0,25 s (un arbitrage est une lecture du monde, pas un tremblement à 60 Hz). Mesuré : les refus
« angle-fermé » passent de 18-171 par match à ZÉRO (l'ailier ne canonne plus dans un mur — il
sert ou il porte), prépare-frappe −30 %, tirs stables, les quatre options gagnent chacune en
flux. Banc : `verify-menace.mjs` (11 clauses — quatre fixtures de gagnant, pureté, sabotage
« cerveau d'un seul geste », contrat d'injection prouvé par contraste : un `decide` aval qui
force la conduite ÉTEINT la machinerie de tir devant le but ouvert).

### Le cycle de match est un produit (`cfg.chrono` + `feuilleDeMatch` — lot 13)

`matchCfg({ chrono: { periodes: 2, duree: 180, pause: 6 } })` : mi-temps sifflée à l'heure,
l'autre équipe engage (Loi 8, alternance), sifflet final → `st.fini` + monde calme, et
`feuilleDeMatch(st)` rend score, buts à la minute, tirs/arrêts/passes/centres/hors-jeu/coups
francs/pressing par équipe et la possession — tout depuis les événements, déterministe octet
pour octet. Clé absente : les mondes sans fin d'aujourd'hui, au bit près. Un projet aval
démarre un match, le joue, le finit, lit le résultat — c'est l'étape 3 du chemin balisé,
LIVRÉE. Les dettes du lot ont été payées au lot 24 : `pitch.echangerCamps()` (une bascule en
closure, tout le moteur suit par `ownGoal`/`attackGoal`) et le TEMPS ADDITIONNEL (les arrêts
s'accumulent, l'arbitre rend ×0,35 plafonné 12 %, annonce `'temps-additionnel'`, HUD « MT2
2:58 +2 »). Banc : `verify-chrono.mjs` (14 clauses, sabotages « match sans fin » et « montre
truquée »). Et la chasse aux buts fantômes du même lot (NOTES 47) a rendu les scores
humains : ≈ 2 buts/match — l'échappée pense (gachetteNear), personne ne fuit dans son
propre filet, le gardien distribue depuis le coin des six mètres.

### La Loi 12 — fautes, avantage, penalty, mur (lot 25)

`matchCfg` porte `loi12: { avantage: 1.8, contact: 0.9, mur: 9.15 }` (défaut ON comme la
Loi 11, gardé `st.full` — le réduit et le rondo vivent sans arbitre de fautes, au bit près).
Trois étages, trois modules, une seule vérité :

- **La détection vit au DUEL** (`rondo-sim.js#standTackleNow`) : la fente qui rate le ballon
  et trouve le corps du porteur (< `contact` m) POSE le fait — `st._faute` {t, par, sur,
  team, p} + événement `'faute'`. Une faute à la fois : l'arbitre aussi.
- **L'adjudication est un module d'arbitrage** (`referee.js#adjugeFaute`, appelé par
  `matchStep`) : l'AVANTAGE d'abord (Loi 5 — fenêtre `avantage` s : l'équipe lésée qui porte
  encore le ballon à la fin de la fenêtre JOUE, événement `'avantage'`, pas de sifflet ; le
  fautif qui récupère siffle AVANT la fin) ; le sifflet ensuite — coup franc au LIEU de la
  faute (clampé au terrain), PENALTY au point (`dims.spot`, 11 m) si la faute vit dans la
  surface du fautif (`pitch.inBox`, camps échangés compris) ; cérémonie complète (ballon
  lâché, monde en loose, preneur du camp lésé, armés annulés).
- **Le MUR est la Loi 13 à la remise** (`match-sim.js`, bloc remise) : coup franc et penalty
  du plein format tiennent 9,15 m (pas le rayon réduit), et à moins de 30 m du but propre les
  DEUX défenseurs les plus proches du but se POSENT sur la ligne ballon→but à 9,15 m, épaule
  contre épaule (±0,35 m) — un coup franc sans mur est un penalty déguisé.

La feuille compte les fautes par fautif (`fautes: paire('faute')`). Le ticker de la scène lit
`'faute'` (rouge brique) et `'avantage'` (vert). Banc : `verify-loi12.mjs` — 13 clauses SUR
FIXTURES (doctrine lot 8 : `st._faute` crafté à la main — avantage gardé/perdu/fenêtre
ouverte, penalty au point vs coup franc un mètre hors surface, mur mesuré 8,9 m avec meute
posée à 2,6 m) + sabotages nommés « arbitre aveugle » (`loi12:false` → fait inerte),
« avantage myope » (`avantage:0` → sifflet immédiat), « penalty déguisé » (sans mur, la
meute reste à 2,8 m). LA DISCIPLINE (lot 27) : chaque adjudication compte la faute à son
HOMME ; la récidive (`loi12.jaune` fautes du même joueur, défaut 2) vaut carton JAUNE, le
second jaune vaut ROUGE — deux événements `'carton'` (les deux gestes de l'arbitre), et le
carton SURVIT à l'avantage. La feuille compte `cartons: { jaunes, rouges }` par équipe, le
ticker les montre dans les couleurs de l'objet. Banc : `verify-cartons.mjs` (6 clauses —
récidive, second-jaune-rouge, survie à l'avantage, feuille, sabotage « arbitre sans poches »
`jaune:0`). L'EXPULSION PHYSIQUE (lot 28) : le rouge SORT le corps. Le levier est natif —
`q.expulse` + un down GÉANT : les ~30 filtres `down <= 0` du moteur (passes, press, preneurs,
mur, appels…) oublient l'expulsé sans être touchés ; movement le laisse MARCHER vers sa
sortie (il n'est pas un corps au sol) ; quatre sites le sautent NOMMÉMENT — la boucle de jobs
(`field`, remises comprises), la Loi 11 (`offsideLine` : un rouge posté hors terrain ne fait
pas la ligne), `placeKickoff`/`kickoffSpots` (les vestiaires ne le ramènent pas), et la scène
(il marche, il n'est pas couché). L'équipe joue à 10 et le monde continue. Banc :
`verify-expulsion.mjs` (8 clauses — le corps sort et reste, à 10, hors du monde, Loi 11,
vestiaires, sabotage « arbitre sans poches »). Dettes nommées : gardien expulsé (pas de
remplaçant aux gants), fautes hors tacle (charge, obstruction, main), DOGSO, et le FLUX mince
du 11c11 (~1 duel tenté / 9 min — enrichir les sources de duels est une dette de qualité
football, pas de loi). La cérémonie stricte du penalty, dette du lot, est payée au lot 26
(Loi 14, ci-dessous).

### La Loi 14 — la cérémonie du penalty (lot 26)

`matchCfg` porte `loi14: true` (défaut ON, gardé `st.full && r.type === 'penalty'`). À la
remise penalty : tous les corps sauf le preneur et le gardien de la ligne se tiennent HORS
surface, HORS de l'arc (rayon `loi12.mur` autour du POINT — pas du ballon porté) et DERRIÈRE
le ballon — un clamp en UNE passe dans le bloc remise (pour un z donné, le x légal est le
plus contraignant de la surface +0,8 et de l'arc +0,35, toujours côté champ du plan du
ballon) qui vaut pour les DEUX camps (la remise générique faisait MARCHER les coéquipiers
vers le point). Le gardien défenseur TIENT SA LIGNE (0,15 m, entre les poteaux — keeperSpot
le posait à 1,81 m devant : sa loi de position ne connaît pas la cérémonie). La frappe est le
cerveau NORMAL du preneur (canal shot standard, +1,7 s après la prise — le plongeon existant
répond ; aucun script de tir). Mesuré avant/après : gardien 1,81 → 0,32 m ; violations de
cérémonie à la prise 3 → 0. Banc : `verify-loi14.mjs` (8 clauses — cérémonie, ligne, le
penalty SE JOUE, sabotage « cérémonie foraine » `loi14:false`, et la Loi 14 ne mange pas le
mur Loi 13 du coup franc). Dettes nommées : l'empiètement APRÈS la prise (les corps
re-rentrent pendant l'élan — un re-sifflet d'empiètement), le preneur identifié avant le
sifflet, la conversion penalty à calibrer (2/2 sur fixtures — qualité, pas loi).

### La Loi 15 — la rentrée de touche à la main (lot 29)

`matchCfg` porte `loi15: { range: 18 }` (défaut ON, gardé `st.full` — le réduit joue sa
touche au pied, loi du futsal, au bit près). Le mécanisme est un NOUVEAU POINT D'EXTENSION
du loop : **`cfg.onTake(st, takerId, type, cfg)`** — la prise d'une remise a un métier, et
un projet aval peut scripter les siennes (clé absente : au bit près). Le match y branche
`referee.js#remiseEnTouche` : à la prise d'une 'touche', le lanceur sert le coéquipier le
plus démarqué à portée de bras (`range` m) et le ballon part EN CLOCHE (~32°, apex mesuré
2,6 m — `release('touche')` au grand livre du ballon, puis strike balistique). Et
l'exemption de la Loi 11 est **STRUCTURELLE** : `st.pass` sans photo `.off`, aucun veto de
cerveau — « il n'y a pas de hors-jeu sur une rentrée de touche » n'est pas un cas spécial
du sifflet, c'est une photo qui n'a jamais été prise. L'événement est `'rentrée'` (le mot
'touche' appartient au TOUCHER de balle — un même mot, deux faits, le registre les sépare).
Banc : `verify-loi15.mjs` (6 clauses — la cloche, la reprise, l'appelé posté hors-jeu servi
SANS sifflet avec `isOffside` vrai au lancer, sabotage « touche au pied » `loi15:false`).
Mesure de flux consignée : 0 sortie latérale en 3 × 180 s (le jeu vit central) — la loi vit
par fixtures. Dettes nommées : le geste des deux mains (clip d'animation), le double-toucher
du lanceur, la touche foireuse (foul throw).

### La Loi 3 — les remplacements (lot 30)

`matchCfg` porte `loi3: { changements: 5 }` (gardé `st.full`). LA LOI EST LE MÉCANISME, LA
POLITIQUE EST AU PROJET : le moteur ne décide jamais QUI sort — un manager, une UI, une IA
de banc appellent **`referee.remplacer(st, cfg, team, outId, inSpec)`** (comme Unity ne
substitue pas à votre place). La file s'exécute À L'ARRÊT DE JEU (on ne change pas pendant
que le ballon roule) : le sortant marche vers la touche par le levier de l'expulsion (down
géant — les cerveaux l'oublient), à la ligne **l'identité change** (`inSpec` au format des
squads : `{ ratings, name, number, look, role }` → `makeProfile`/`resoudreRole` — l'ardoise
disciplinaire PART AVEC L'HOMME : le carton appartient à l'homme, pas au maillot), et le
corps revient prendre ses postes. Limite `changements`, expulsé irremplaçable (l'équipe
reste à 10), feuille `remplacements: [n0, n1]`, événement `'remplacement'` à la minute.
Banc : `verify-loi3.mjs` (9 clauses — la file pendant le jeu, l'exécution à l'arrêt,
l'identité, le retour, l'ardoise vierge — jaune → sub → 2 fautes → JAUNE pas rouge —, la
limite, l'expulsé, sabotage « porte tournante fermée »). Dettes nommées : le banc INCARNÉ
(des corps assis qui s'échauffent — aujourd'hui l'entrant naît à la ligne), les fenêtres
comptées (3 + mi-temps), la fatigue (le déclencheur naturel de la politique — le moteur ne
la modélise pas encore).

### La fatigue — l'endurance, un état du corps à l'échelle du format (lot 31)

`matchCfg` porte `fatigue: { horizon: null, cap: 0.15, pause: 0.25 }` (gardé `st.full`).
`q.stam ∈ [0;1]` est drainé dans movement par l'effort (au carré + un socle, récup légère
sous 1,5 m/s) sur l'**horizon du format** — `periodes × duree` du chrono configuré, 360 s à
défaut : un moteur réutilisable ne code pas « 90 minutes » en dur, l'échelle suit le match
demandé. **Un seul effet v1, une seule autorité** : la pointe plie (plafond de vitesse
× 1 − cap·(1 − stam) — p95 des courses mesuré ×0,92 à essence vide). La note `stamina`
(attributes.js) module le drain ×[1,25 ; 0,75] ; les vestiaires rendent `pause` d'essence ;
l'entrant de la Loi 3 naît frais (et son trot d'entrée se paie, comme tout effort) ;
événement `'fatigue'` au franchissement de 0,35, une fois par homme. **`q.stam` est l'API du
projet** : la politique de banc le lit (`stam < 0,4 → remplacer(...)`) — le moteur ne décide
toujours pas qui sort. Banc : `verify-fatigue.mjs` (8 clauses — frais au coup d'envoi, le
drain corrèle au travail (gardiens ≥ 0,9, champ 0,79), la pointe plie, les vestiaires au
chiffre sur 22 corps, la note module, le pont Loi 3, sabotage « moteur infatigable »).
Dettes nommées : la précision fatiguée (sigma d'exécution), le pressing plié, la récupération
active (marcher rend plus que sprinter ne coûte). Leçon de banc consignée : la fatigue par
défaut DIVERGE le flux (papillon dès la première image) — deux clauses de flux d'anciens lots
re-fondées sur des graines re-mesurées (le mécanisme des axes était intact : +6,1/+6,4/+8,5
sur 3 graines).

### Le duel de corps — la charge d'épaule (lot 32, l'ère qualité)

`matchCfg` porte `charge: { dist: 0.85, time: 0.4, cd: 3.0 }` (gardé `st.full`). Diagnostic
fondateur (probe-contact) : l'adversaire vivait à **1,28 m médian** du porteur mais la
pression ballon ne mordait que **2,4 % du portage** — le bouclier protège le ballon, c'est
son métier — d'où 1 duel / 9 min : un jeu sans contact. La charge est le duel de CORPS,
distinct du tacle (qui joue le ballon) : un défenseur au corps du porteur mûrit une horloge ;
pleine, la charge se joue. **De côté : duel loyal** (nouvel attribut `strength` → chargeF
×[0,85 ; 1,15], l'élan du chargeur pèse, tirage `st.rnd` seedé, base 40 % — gagné : le
ballon JAILLIT en bousculade courte (1,4 m/s — pas une passe à l'adversaire), perdu : le
chargeur rebondit (levier natif `_bite` 0,45 s)). **Derrière : la filature est un métier**
(aucun événement — l'horloge se ré-arme) et seul le **percutage** est une faute (contact
< 0,5 m ET vitesse d'entrée > fuite + 0,8) qui alimente l'arbitre de la Loi 12 (avantage,
coups francs, cartons — le flux disciplinaire naturel du football). Jamais sur le gardien
porteur. Équilibre livré (4 × 180 s) : **6,0 épaules/match** (était 0,3 duel), **0,8
faute/match** (bande réelle), scores humains. Deux géométries payées en mesure : la première
criminalisait l'ombre de poursuite (33 fautes / 9 min, des 0-0 au sifflet), la seconde
survitesse brute en laissait 16 — la vitesse d'ENTRÉE projetée est la bonne serrure. Banc :
`verify-charge.mjs` (8 clauses — fort/faible déterministes à rnd fixé, percutage vs
filature, anti-mitraillette, gardien, flux en bande, sabotage « jeu sans contact »).
Dettes nommées : l'animation du contact (les corps se poussent sans clip d'épaule),
l'obstruction. Le tacle glissé, dette du lot, est payé au lot 33 (ci-dessous).

### Le tacle glissé sur porteur (lot 33) — et la naissance de `duel.js`

`matchCfg` porte `slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4,
trip: 0.7 }` (gardé `st.full`). Le glissé sur ballon LIBRE existait (« un ballon qui
traîne ») ; le glissé SUR PORTEUR est le pari du DERNIER RECOURS : un poursuivant lancé
(≥ `speed`) sur un porteur LANCÉ (≥ `carrySpeed` — une construction lente se défend debout :
sans cette porte, 20,8 glissés/match mesurés, la fête du tacle) se couche pour le ballon.
La TABLE TECHNIQUE juge la géométrie réelle de l'instant, PUIS le JET (accuracy 0,6 ± la
note tackling — sans lui, 83 glissés sur 83 prenaient le ballon : glisser était strictement
optimal ; le RATÉ est ce qui produit fautes et vides). Trois issues : **PRIS** (dégagé fort
dans la course — et le tacleur est AU SOL, gagné ou perdu : ce coût EST la décision) ;
**FAUTE** (les jambes avant le ballon : la victime TOMBE, et par DERRIÈRE c'est GRAVE — la
récidive compte DOUBLE dans `adjugeFaute`, un seul glissé par derrière vaut le jaune) ;
**le VIDE** (le porteur file, refus nommé). Anti-spam : `slideCooldown` partagé + un corps
au sol par ballon et par équipe (6 s). Équilibre livré (6 × 180 s) : 1,8 glissé/match,
0,7 faute-tot/match (bande réelle), 3,0 tirs, 1,2 but. Et la volumétrie a mordu (rondo-sim
1 263 > 1 250) : la famille des duels de corps (charge + glissé sur porteur — aucun appel à
receive, pas de cycle) vit désormais dans **`duel.js`** (150 l.), le candidat nommé du
backlog. Banc : `verify-slide.mjs` (8 clauses — pris/faute-grave-jaune/vide/pari
déterministes par géométrie et jet fixé, dernier recours, flux en bande, sabotage
« personne ne se couche »).

### Le jeu de tête — le ciel du match (lot 34, `tete.js`)

`matchCfg` porte `tete: { min: 1.5, max: 2.2, reach: 1.0, but: 12 }` (gardé `st.full`).
Mesuré avant : le jeu aérien manquait ENTIER — 0 centre entré en surface sur 4 matchs (vols
tendus mangés par le premier rideau), 0,8 s/match de fenêtre de tête avec un corps dessous.
Livré, QUATRE serrures ouvertes dans la chaîne du ciel :

- **Le contact de tête** (`tete.js`) : un vol à hauteur de tête au-dessus d'un corps se
  reprend — au BUT si attaquant en surface (< 12 m — canal shot standard `kind: 'tête'`, le
  plongeon du gardien répond à la physique), en DÉGAGEMENT près de son but (loin, vers
  l'avant et le flanc), en REMISE courte sinon (le coéquipier proche, cloche raccourcie). À
  deux corps dans la fenêtre : le **duel aérien** tranche (note `strength` — le même levier
  que l'épaule —, jet seedé, événement `'duel'` kind aérien). La tête se joue DEBOUT (le
  saut authoré est une dette de scène).
- **La cloche du centre** (strike-sim) : un centre est un ARC par-dessus le premier rideau —
  la balistique de la rentrée (θ 26°, portée → vitesse, temps de vol re-solvé).
- **La gâchette du centre** (rondo-sim) : l'ailier au couloir vit à ~21 m du but —
  `gachetteNear` ne s'ouvrait jamais pour lui, `tryCross` n'était JAMAIS appelé en course
  (la serrure du lot 13, encore).
- **La touche de préparation du centre** (shooting) : `beginPass` refusait 169 centres sur
  170 — le ballon d'aile vit à 1,2-1,4 m en course ; le centreur SERRE sa touche (le patron
  du tir, lot 6a) et le centre arme au pas suivant.

Flux : 0 → 3-5 têtes / 12 min, centres 0,3 → 0,5/match — l'EXISTENCE ; l'abondance des
centres est la dette nommée « approche pilotée » (l'ailier qui porte jusqu'à la ligne et
lève la tête). Banc : `verify-tete.mjs` (7 clauses — fixtures balistiques : de VRAIS arcs
lancés par `strike` redescendent sur des corps posés, aucune écriture de ballon ; reprise
au but, dégagement, remise, duel aérien en appel DIRECT une image, fenêtre de hauteur,
sabotage « jeu au sol », flux). Trois leçons de banc : la mène du vol doit pointer LE CORPS
(lead [0,0,0] faisait fuir le receveur vers le rond central), la fenêtre de course d'une
fixture se mesure (la tête tombe à t+1,05 — courir 0,9 s la ratait), et les corps DÉRIVENT
pendant un vol (le duel à deux se juge en appel direct, pas en mise en scène de flux).

### L'orientation du jeu — le renversement d'aile (lot 35)

`matchCfg` porte `renversement: { dense: 5, rayon: 12, dz: 18, portee: 38, bonus: 1.5 }`
(gardé `st.full`). Diagnostic UTILISATEUR (« la densité du jeu axial — l'intelligence
on-ball ne change pas d'aile ») chiffré sans appel : **76 % du jeu vivait à |z| < 8** (réel
~45), la passe la plus longue du VOCABULAIRE faisait 21,9 m (`passRange [2.5, 13]` + appel),
1 renversement / 4 matchs (réel 3-8/match), 5-6 adversaires compressés à 12 m du ballon. Le
cerveau ne peut pas choisir ce qu'il ne peut pas dire. La bascule entre au vocabulaire de
`choosePass` **sous condition de densité** (bloc ≥ `dense` corps à `rayon` m du ballon) : le
candidat du flanc OPPOSÉ (Δz > 18, flanc à flanc) se juge par SA loi — portée étendue à
38 m, point doux des 10 m neutralisé, le lofted est sa NATURE (pas une pénalité) — pendant
que le reste du barème (pression à l'arrivée, sens du jeu) continue de parler. La diagonale
**vole en cloche par-dessus le bloc** (strike-sim, le patron de la rentrée — le couloir 2D
bouché n'existe pas à 5 m du sol : c'est la raison d'être du geste). Événement
`'renversement' {by, to, dz}`. Mesuré après, transformation nette : **axial 76 → 49 %**
(réel ~45), **ailes 9 → 29 %**, **~5 renversements/match** (bande réelle), portée max 38 m —
et la **densité côté ballon p50 passe de 6 à 2 corps** : le bloc adverse doit couvrir la
largeur, l'étau se desserre — l'effet SYSTÉMIQUE du renversement au vrai football. Banc :
`verify-renversement.mjs` (5 clauses — l'étau choisit l'aile opposée, pas de forçage sans
densité, la cloche vole et arrive, sabotage « jeu axial », flux). Effets systémiques
assumés et re-bordés : moins de duels d'épaule (l'étau choisi diminue), transitions plus
rares (la possession se stabilise), l'axe LARGEUR se prouve désormais en isolation
(`renversement:false` — chaque couche sur son axe), et le service des appels profonds
s'éteint (la bascule, option sûre, le surclasse — dette d'équilibrage NOMMÉE : appelBonus
contre bonus de bascule). Leçon de fixture : LE BALLON est l'origine du cerveau — téléporter
le porteur sans son ballon vise tout le crafting à côté (release → restart → possess, la
séquence légale).

### Les circuits par style — l'axe tactique pilote le vocabulaire de passe (lot 36)

Deux chantiers liés. **(1) L'appel servi retrouvé** : la bascule (lot 35), option sûre, avait
tué le service du coureur profond. Diagnostic en trois étages, chacun mesuré : 79 % des
fenêtres de course HORS PORTÉE (le dart sort de l'enveloppe en 0,6 s) ; quand il est
évaluable, le coureur GAGNE 37 % des choix (la loi du coureur au barème — point doux
neutralisé, comme la bascule) ; et pourtant 0 passe partait — les portes d'ENGAGEMENT
(technique 932 / ballon-vif 865 / ancre 642 refus) mangeaient la fenêtre entière. Le remède
natif du tir (lot 6a) et du centre (lot 34) : la **touche de préparation** quand l'intention
vise un coureur vivant — armée UNE fois par intention, et **l'intention meurt AVEC la
course** (les intentions échouées occupaient le porteur TTL plein : tirs 18 → 10 sur 10
graines mesurés, restaurés à 16 par ces deux gardes ; A/B git-stash contre le monde du
lot 35 — 9 buts = 9 buts). **(2) Le style écrit les circuits** : l'axe `style` [0..1] de la
tactique (0 possession ↔ 1 direct) module le vocabulaire de `choosePass` — densité de
bascule ±1 corps, bonus ±0,5, service ×[0,7 ; 1,3] — à 0,5 EXACTEMENT les valeurs
d'aujourd'hui (axe() au milieu exact, prouvé octet pour octet : équilibre explicite ≡
défaut). **Signature mesurée : possession 20 renversements / direct 7** sur 3 graines — les
styles produisent des circuits mesurablement différents. Banc : `verify-circuits.mjs`
(5 clauses). Et une DOCTRINE DE BANC consolidée après la 5ᵉ série de re-fondations : les
clauses de flux se jugent par BALAYAGE-jusqu'à-trouvé (loi12) ou par AGRÉGAT large, chaque
banc juge SA métrique seule (les buts-respiration vivent à UN endroit — match11/chrono), et
le service de l'appel a UNE vérité (verify-circuits). Dettes : le renversement porté, les
poids de bascule par preset affinés, la portée de service du dart (79 % hors enveloppe).

### La conduite au pied — le ballon près du corps (lot 37)

Retour UTILISATEUR (« le ballon paraît loin du pied — de la magie »), chiffré avant de
toucher : sur 12 min de portage (4 × 180 s), p50 = 0,33 m — la conduite ordinaire est
saine — mais 12 épisodes au-delà de 1,8 m jusqu'à 2,91 m, presque tous en CROISIÈRE. Le
coupable n'est pas la poussée : c'est la **fenêtre de perte en mouvement** (`looseAt =
1.15 + touchDistance(v) + 0.5`) qui tolérait ~3,6 m d'écart à 4 m/s — l'étiquette
« porté » mentait, le corps courait derrière un ballon de fait libre. Remède d'une ligne,
gardé `st.full` : **la fenêtre est PLAFONNÉE à 2,2 m** — au-delà le ballon est LIBRE
(phase loose), et la chasse existante (`carrySurge`, `carryViaBall`, le pique adverse)
reprend ses droits. Mesuré après : pic 2,91 → 2,19 m, p99 1,63 m — et un effet de flux
bienvenu, **16 → 27 tirs sur 10 graines à buts constants** (9 = 9, A/B git-stash) : les
ballons trop poussés se DISPUTENT près de la surface au lieu de mourir en conduites
fantômes. Clause §8b de `verify-match11` (p99 ≤ 1,9, max ≤ 2,3 sur 2 × 120 s) ; sabotage
nommé = retirer le plafond. Le réduit et le rondo gardent la fenêtre d'origine au bit près.

### Le répertoire exhaustif des frappes (lot 39)

Retour UTILISATEUR (« flottante, enroulée, puissante, ras de terre, etc — liste à compléter
pour être exhaustif »). Le ballon savait déjà tout (`ball.js` : Magnus complet, spin en rev/s)
— le répertoire ne l'exploitait pas. DIX ESPÈCES sous `cfg.shotVariety`, choisies sur la
SITUATION (`shooting.js`), exécutées avec leur physique (`strike-sim` : vitesse, hauteur,
spin) : les cinq finisseurs d'hier (placé, croisé, puissance, mi-hauteur, lucarne — bandes
préservées : mesuré, des bandes trop généreuses aux nouveautés coûtaient la moitié des buts),
l'**enroulée** (Magnus signé rev ±8, mène décalée vers le centre que la courbe RAMÈNE au
poteau — calibrée 1,44·(d/16)² au ballon réel ; le gardien projette LINÉAIREMENT via
`shotCross` : la courbe le bat de ~1 m, l'avantage du curler au vrai football), le
**ras-de-terre** (le rasant sous le plongeon), la **flottante** (rapide et SANS axe de
rotation : `keeper.js#floatRead` étire le réflexe ×2,4 — rien à lire, il part tard ; le fil
du spin est gardé par la clé, le monde saboté lit comme hier), le **pointu** (petits espaces,
rotation quasi nulle — lue tard aussi, vrai du bout du pied), le **piqué** (le UN-CONTRE-UN
seulement : gardien sorti ≥ 4,2 m ET à ≤ 8 m du tireur — un piqué sur gardien lointain se
fait rattraper, prise mesurée à 1,65 m ; élévation RÉSOLUE du duel — dégager 2,45 m au
passage du corps, traînée ×1,25 — portée compensée ×1,18, vitesse exacte hors planchers).
Banc : `verify-frappes.mjs` (6 clauses — la courbe contre la lecture linéaire, le piqué du
un-contre-un en but, le rasant, la lecture tardive à trois mondes, sabotage « pied unique »,
le flux ≥ 4 espèces). Flux prouvé 20 × 300 s : 59 tirs / 26 buts (hier 64 / 30 — dans le
bruit), conversions 32-67 % par espèce. Dettes nommées : la volée/demi-volée (frapper un
ballon EN VOL au pied — le canal tête existe, le pied non), la trivela, le
pointu-sans-préparation (les portes d'armement n'ont pas la portée du geste), le wobble
visuel de la flottante (scène).

### La volée et le centre bas — le ciel du bas (lot 40)

Le canal tête (lot 34) laissait un trou MESURÉ : 4,4 s/12 min de fenêtres de vol à hauteur
de PIED sur un corps, zéro geste — et 0,0 s en surface face au but, la chaîne du centre ne
produisant que des cloches. Deux greffes liées, gardées `st.full`. **`voleeStep`**
(`tete.js` — même famille, cooldown partagé, `cfg.volee`) : fenêtre 0,25-1,15 m, deux
métiers SEULEMENT — la REPRISE au but en surface (< 14 m : shot kind `'volée'`, ou
`'demi-volée'` si le ballon REMONTE de son rebond — vy > 0) et le DÉGAGEMENT d'urgence à
moins de 24 m de son but ; hors de ces urgences on ne volleye pas, le contrôle au sol est
le vrai geste (l'asymétrie avec la remise de tête est football-vraie). Fenêtre morte
1,15-1,5 m : la POITRINE, dette nommée. Sabotage « les pieds au sol » (`volee:false`).
**Le CENTRE BAS** (`cfg.centreBas`, tryCross → strike-sim) : au ras de la ligne (9 derniers
mètres), le centre part FORT AU SOL (θ 0,14, apogée ~0,3 m, le rebond en route est sa
nature) vers le point de penalty — SI le couloir existe (`laneClearance` 0,45 : un ballon
à ras se fait couper, contrairement à la cloche qui ignore les corps). Sabotage « que des
cloches ». LA CHAÎNE prouvée au banc (`verify-frappes`, 13 clauses) : centre bas t 0,23 →
un rebond → demi-volée t 1,08 à 11 m → but. Flux 20 × 300 s : 71 tirs / 22 buts — le ciel
du bas ajoute ~12 tirs, les buts restent en bande ; 3 reprises + 17 dégagements de volée
par 50 min (le défensif domine, comme au réel). Dettes : la poitrine, l'abondance du
centre bas (l'approche pilotée), la volée hors surface.

### Le service du coureur profond — la foulée est servie (lot 41)

Dette du lot 36, RE-MESURÉE avant d'être payée (le monde avait bougé : 32 % des appels déjà
servis — l'ère lot 36 était à ~0). Le vrai déficit restant : la LATENCE — burst → passe p50
1,43 s, le ballon partait quand la course FINISSAIT ; le coureur recevait à l'arrêt. Deux
lois composées, chacune sa clé et son sabotage : **`appelUrgent`** (rondo-sim) — le service
d'un coureur vivant s'exécute en RÉGIME URGENT (les portes courtes du contesté et du centre,
armé prompt, et le déchet d'urgence ×1,25 qui va avec : une passe pressée se rate plus) ;
**`appelPret`** (match-sim, la porte `posé` du dart) — on appelle quand le passeur PEUT
donner, le ballon au pied (≤ 1 m) : le coureur lit les APPUIS du passeur avant de partir.
Mesuré (ablation propre) : urgence seule p50 0,63 / p90 1,50 ; composé **p50 0,60 / p90
1,08** — la porte du passeur tient la queue — et service 32 → **48 %**, respiration tenue
(67 tirs / 27 buts sur 20 × 300 s, bande). La vérité du service vit dans
`verify-circuits` (clauses 3b : latences poolées des trois mondes tactiques, sabotage
« service nonchalant » par séparation des moyennes). Leçon de méthode : toujours RE-MESURER
une dette avant de la payer — trois lots avaient déjà bougé le terrain.

### Le bloc compact — les distances entre lignes sont la tactique (lot 42)

Retour UTILISATEUR (« les lignes sont trop espacées, les matchs ne sont pas réalistes »),
confirmé au chiffre : bloc défendant p50 43 m / p90 58 (réel 25-40), 25,5 m entre défense et
milieu (réel 10-15), et ZÉRO asymétrie attaque/défense — `formationSpots` coulissait mais la
ligne vivait à ses postes ABSOLUS (11 m de son but, ballon au rond central). La loi
(formation.js, paramètre `bloc` — pur, testable au banc ; consommé par le bloc posté de
match-sim sous `cfg.bloc`, st.full) : **l'équipe sans ballon est CHAÎNÉE AU BALLON** — sa
ligne défensive tient `ligne` m (27) derrière lui, elle MONTE quand le ballon recule
(plafond au rond central), et le bloc entier tient en `long` m (30) — les lignes s'empilent
depuis la ligne basse, interlignes comprimées d'un même facteur. L'équipe qui ATTAQUE garde
la respiration étirée : **l'asymétrie est le réalisme** (mesuré après : défense 30,3 m /
attaque 42,0). `hauteurBloc` (tactics, ±6 m) et le cran de pressing composent par-dessus ;
la Loi 11 suit toute seule (la ligne réelle FAIT la ligne de hors-jeu — un bloc qui monte
pousse les pointes adverses). Flux prouvé tenu : 70 tirs / 29 buts (20 × 300 s), service
des coureurs intact. Clauses §3b de `verify-match11` (loi pure au rond central, bandes en
match, sabotage « bloc élastique »). Dette nommée : le resserrement LATÉRAL côté ballon
(largeur défensive 36,8 mesurée, réel 40-44 — v2). Leçon d'instrument (deux clauses
re-fondées) : un axe qui gouverne des POSTES se juge en SCÈNE CONTRÔLÉE sur les cibles
posées (`p.target`), pas au flux — trois couches successives (renversement, slots, darts)
avaient noyé la clause largeur.

### Le prix du premier toucher et le bloc par équipe (lot 43)

Deux retours utilisateur. **L'effet aimant des longs ballons** : `turnover` (rondo.js)
possédait instantanément à toute vitesse — un dégagement de 26,5 m/s aspiré au pied sans
geste. `cfg.touchePrix` (st.full) applique au RÉCUPÉRATEUR le contrat du contrôle attaquant :
au-delà de `seuil` m/s, la touche peut FUIR (taux/m/s, plafond, modulé `controlF`) — le
ballon reste LIBRE avec son résiduel, le récupérateur va le chercher. Un bon défenseur
contrôle un long ballon LA PLUPART du temps : c'est un tirage seedé, pas une loterie
visuelle. Effet de flux assumé : conversion 49 → 29 % (les buts de chaos de surface
meurent — on se rapproche du réel). Sabotage « l'aimant ». **Le bloc par équipe** :
`blocFor(bloc, tactique)` (formation.js — pur, UNE vérité moteur/banc) module la base
moteur par LA TACTIQUE DE CHAQUE ÉQUIPE : `compacite` (nouvel axe, ±4 m de longueur) et
`hauteurBloc` (±4 m de distance ligne-ballon) ; presets différenciés (gegenpressing serré
26 m mesuré, blocBas 0,8, possession relâchée) ; 0,5 = l'identité de la base. Leçon
d'instrument majeure (verify-circuits) : le sabotage d'une loi d'URGENCE se juge au NOMBRE
de services, jamais à la latence des survivants — sans urgence, seuls les services
instantanés aboutissent, et le biais du survivant rend le monde saboté « plus rapide »
alors qu'il sert moitié moins.

### La première intention et le rattrapage (lot 44)

Trois retours utilisateur avec captures. **Le contrôle raté tue la passe** : un long ballon
raté laissait `st.pass` vivant — le receveur restait PLANTÉ sur son ancien point de chute
pendant que l'adversaire prenait sa touche fuyante. Désormais (st.full) : passe morte, ballon
LIBRE, et le fautif CHASSE sa touche (le réflexe `lossReact`, réutilisé tel quel — une
autorité). **La passe en une touche** (`cfg.uneTouche`) : sous pression, un ballon jouable
repart en PREMIÈRE INTENTION vers une ligne courte et ouverte — sans être possédé (le patron
de la remise de tête), déchet ×1,6, tirage seedé modulé `controlF`. 6,5 % des passes en flux
(porte pression-seulement — la une-touche au calme est un axe de style, dette nommée ; photo
Loi 11 : même dette que la remise de tête). Sabotage « le monde à deux touches ».
**La cage éclairée** (`stadium-night`) : visée des nappes 0,30 → 0,36 L, cône 0,68, DEUX
LAVAGES DE CAGE (rig 4 → 6 — l'uniformité UEFA, modestes pour que la nuit reste une nuit),
key à 50° (l'ombre de tribune ne couche plus son coin noir sur la surface). Prouvé par
capture avant/après (playmode) : le gardien se lit dans sa cage. Leçon de fixture : un
presseur posé près d'une trajectoire de passe la PREND ou l'INTERCEPTE (receiveRadius, la
course de press) — le marquage de fixture se pose dans le DOS du receveur, sur l'axe.

### La foulée de frappe et l'engagement-passe (lot 45)

Trois retours utilisateur. **`strideStrike`** (st.full) : le stop avant la frappe, chiffré —
tirs frappés à 0,63 m/s p50 (réel 3-6), la glisse d'armé convergeait vers une ancre STATIQUE.
La loi : l'ancre AVANCE d'un incrément décroissant (v0·e^(−t/τ), plafond cumulé) dans la
direction de la course du commit — le ballon porté suit le corps, l'ancre suit le ballon, le
couple ENTIER voyage (un seul écrivain — la leçon de l'oscillateur tient), strikeNow re-résout
au contact. Après : 1,91 m/s p50 au strike. Dette nommée « la préparation dans la foulée »
(le frein amont de la touche de préparation). Sabotage « la statue qui frappe ».
**`engagementPasse`** : le coup d'envoi partait en conduite (la barre calme refusait la passe
courte — son score vit sous 1) ; mémo posé par canTake, fenêtre 2,5 s, barre abaissée + tenue
dispensée — délai prise→passe 1,68 s (2,49 sans). Sabotage « l'engagement porté ».
**Les bords médians** (stadium-night) : visée z 0,25 → 0,31 W — les flancs à la médiane
vivaient entre les quadrants (captures avant/après). Leçon de sonde : l'événement passe porte
`from`, pas `by` — une sonde au mauvais champ rend une clé INERTE qui ne l'est pas.

### L'approche pilotée du centre et le coulissement du bloc (lot 47)

La chaîne du centre existait (ras de ligne → centre bas → volée) mais l'amont manquait :
sur 105 portages d'aile, 4 atteignaient la zone de centre — l'évasion pure RECYCLAIT vers la
médiane. **La conduite a un sens** (`cfg.evadeGoal`, match seulement — le rondo reste sans
but au bit près) : le spot d'évasion gagne un terme de progression vers le but adverse, et
l'AILIER en moitié offensive vise la ligne de fond (`cfg.wingDrive` : cible hx−6, largeur
tenue — l'approche qui ARME le centre) ; le terme foe arbitre naturellement les directions
bouchées. La perce nue convertissait à 73 % (38 buts / 20 × 300 s) : le couloir d'aile
n'était pas défendu. **Le bloc coulisse** (`bloc.lateral` 0,35, borne `slideMax` 8 m,
propagé par `blocFor`) : le bloc défendant entier glisse de lateral × z-ballon côté ballon
(réel 6-10 m). La structure mesurée dit le vrai mécanisme : le couloir n'est jamais NU
(marquage + press y vivent, p50 2 déf) — c'est la garde côté faible qui rentre défendre le
second poteau (24,4 → 17,4 m). Après : 70 tirs / 32 buts (conversion 45,7 %) et la perce
SURVIT (vs errance, 10 × 300 s : zone 9 → 11, ras 5 → 8, centres bas 2 → 4, tirs 27 → 34).
Sabotages nommés « l'errance » (evadeGoal:0) et « l'aile qui recycle » (wingDrive:false) —
fixtures pures, marges figées. Leçon d'instrument répétée en dur : 6 × 180 s classait les
valeurs de lateral dans un ordre aléatoire ; la STRUCTURE (positions 2 Hz) diagnostique,
le flux 10-20 × 300 s juge.

### La foulée porte les deux bouts (lot 48)

Le résiduel du « stop marqué » diagnostiqué et clos. L'autopsie : le corps accélérait
jusqu'à 4,95 m/s au 3ᵉ quart de l'armé puis tombait à ~0 LA FRAME MÊME DU COMMIT — et deux
refontes d'ease (u², mélange linéaire) sont mortes à la mesure avant le vrai coupable :
l'offset commit→ancre d'un porteur lancé est quasi nul (le ballon est à ses pieds),
l'interpolation n'a rien à distribuer et multiplie le mouvement d'ancre (strideStrike) par
ep(t01) ≈ 0 en début d'armé. Falaise structurelle, quel que soit l'ease : 112 stops nets sur
127 frappes en course. **Le fix** (`strideStrike.ride`) : `from` avance du même pas que
l'ancre — la foulée porte les DEUX bouts du segment, le corps continue sa course à v0 plein
dès la frame 1, l'ease ne règle que l'offset (l'ease doux reste la loi de l'ajustement posé).
Après : creux pré-contact p50 0,0 → 1,9 m/s, stops nets 17 %, flux tenu (62 tirs / 24 buts,
20 × 300 s). Sabotage nommé « l'élan retenu » (ride:false). Leçon d'instrument : la frame de
l'ÉVÉNEMENT échantillonne l'instant post-courbe — elle ne peut structurellement pas bouger
avec l'ease ; le stop visible est le CREUX pré-contact des frappes en course, et les frappes
posées (tenue à l'arrêt) sont une autre population.

### La une-touche au calme : le style choisit (lot 49)

La une-touche du lot 44 n'existait que sous pression (le presseur force le réflexe — ouvert
à toutes les équipes). Le tiki-taka la joue par CHOIX : une deuxième porte dans la même
mécanique (`premiere-intention.js`), pilotée par l'axe `tactics.style` — pCalme = calme ×
(1 − 2·style) borné à 0 : possession (0,1) → 40 % de la clé, défaut (0,5) → zéro, aucun
tirage consommé (l'identité au bit près par court-circuit). Déchet ×1,3 au calme contre
×1,6 pressée. Mesuré : possession 19,2 % de passes en une touche dont 62 % au calme (la
bande réelle), défaut 7,8 % dont zéro calme. L'événement pass porte `calme: true`. Au
passage, l'extraction de volumétrie promise : rondo-sim (1250/1250 pile) cède la famille
« première intention » au nouveau module — 1214 lignes, bit-exact prouvé avant la greffe.
Sabotage nommé « le réflexe seul » (calme:0).

### La surprise complète son répertoire (lot 50)

La latence de perception existait déjà (le contrat de strikeNow : le départ du ballon est un
ÉVÉNEMENT — chaque adversaire garde sa cible d'avant pendant max(0, sa réaction − l'armé
qu'il a vu) ; politique de regard 65/35, équipe du passeur exempte, gardien exclu, note
`reactions` → 0,30-0,14 s). Le trou, prouvé au mécanisme : les redirections de PREMIÈRE
INTENTION — une-touche, tête, volée, les départs les moins lisibles du football — ne
posaient pas la fenêtre (0/39 contre 135/135 pour les passes armées) : la défense les lisait
la frame même. Complété au modèle des poses existantes : `seen 0` — pas d'armé à lire, toute
la défense paie sa réaction pleine. Tout départ de ballon ouvre désormais la fenêtre ; une
passe téléphonée s'anticipe, une première intention se subit — la hiérarchie du lisible.
Flux tenu (81 tirs / 29 buts, 20 × 300 s). Leçon d'instrument : mesurer la LOI (fraîcheur de
la fenêtre à l'événement), pas son ombre en flux (« cibles tenues » confondait le gel avec la
stabilité naturelle du bloc posté). Dettes nommées : le crochet/la feinte (le duel lit le
corps — re-mesurer avant), la touche fuyante du turnover.

### Le tacle au contact, la ligne en soutien, le renvoi amorti (lot 51)

Trois retours utilisateur. **« Le ballon libre part dans le sens opposé tout seul »** : le
tacle glissé résolvait sa déviation à l'instant du DÉCLENCHEMENT (tacleur à 1,3-2,6 m du
ballon) pendant que movement.js clouait le corps au sol SUR PLACE — la glisse physique
n'existait pas, la déviation se téléportait. Désormais le glissé est DEUX temps : lancement
(le pari est pris, le corps part au sol et GLISSE réellement — ~1,5 m décélérés), puis
CONTACT re-jugé dans une fenêtre — un ballon qui s'est échappé fait un tacle dans le vide,
ce qui rend le glissé esquivable et honnête (taux de prise sur porteur 11 → 40 %). Et la
une-touche borne sa vitesse sortante à l'angle de déviation (contre-courant → 4 m/s, le
layoff — plus de boulet inversé sans geste). Zéro inversion sans acteur au pied après.
**« Des défenseurs bien trop bas, sans sens tactique »** : la ligne arrière de l'équipe EN
POSSESSION campait à 6 m de son but — `bloc.soutien` (20 m derrière le ballon, plancher
0,12·L) la fait monter (p50 30,9 m, p10 12,7). Le front reste libre : un plafond essayé
exilait les pointes à 31 m du but (tirs effondrés — mesuré puis revert) ; les pointes
dansent sur la ligne (camping transitoire 4-6 %, le prix du bloc haut). Dette nommée :
« l'instrument du contrôle propre » (churn de prise et queue de warp — le front (1) des
contrôles laids reste à payer proprement).

### Le chemin d'origine (toujours valable pour VOTRE greffe)

Le terrain Loi 1 existe déjà : `pitch.js#FULL` (105 × 68, surfaces 16,50, but 7,32 × 2,44) et le
stade paramétrique le construit (`generateStadium({ pitch, goal })` — défaut = plein format).

1. **Formations** : écrire `formation.js` (postes par rôle, bloc qui coulisse avec le ballon,
   largeur/hauteur d'équipe) et le consommer dans VOTRE `assignJobs` — remplacez les 5 couloirs
   de `match-sim.js#assignMatchJobs` par vos postes. Tout le reste (duels, gestes, gardien,
   remises) est déjà branché.
2. **Hors-jeu (Loi 11)** : LIVRÉ (lot 10 — `offside.js`, voir plus haut). Pour VOTRE variante
   (ligne haute, piège du hors-jeu) : tout passe par `offsideLine(st, team)` — le calage des
   pointes et le déclencheur d'appel (`assignMatchJobs`, bloc des postés) sont les deux sites
   à personnaliser ; la porte, la photo et le sifflet n'ont pas de raison de changer.
3. **Chrono, mi-temps, score final** : envelopper `matchStep` (le patron : `playMatch`) — état
   de période, `placeKickoff(st, team)` existe pour l'engagement de seconde période.
4. **Sorties du gardien** : `keeper.js#KEEPER.depthMax` borne la sortie ; le un-contre-un est
   une extension de `keeperDecide` (nouveau mode), le plongeon/la prise sont déjà là.
5. **22 corps à l'écran** : la scène (`Rondo.js`) est count-agnostique, mais mesurez le rendu —
   prévoir LOD/instancing si nécessaire.

## Les attributs joueurs — le contrat d'injection (`attributes.js`)

Les projets amont amènent des joueurs NOTÉS (0-100, type FM) qui changent les mécaniques de
réussite et le rendu. Le contrat tient en trois lois, chacune une clause de `verify-attributes` :

1. **Une note module dans la bande humaine** — chaque mapping est une interpolation bornée
   (pace 100 = ×1,10, pas un surhomme ; le plafond absolu du monde reste souverain, et une note
   de 400 est écrasée à la bande).
2. **Sans notes, rien ne change, au bit près** — un joueur sans `ratings` ne tire aucun aléa ;
   le monde d'aujourd'hui est le monde non noté (même règle que les hooks).
3. **La note agit sur l'EXÉCUTION, pas sur la physique** — la balistique et les lois de
   mouvement sont le monde ; les notes jouent l'erreur de LA frappe, la fermeté de LA touche,
   la fenêtre DU tacle, le réflexe DU gant.

Injection : `makeMatch({ squads: [[{ ratings, look, name, number }, …équipe 0], [...équipe 1]] })`
(le dernier joueur de chaque équipe est le gardien). `look.scale` et `look.shirt` touchent déjà le
rendu ; numéros/carnations par joueur sont une dette documentée (texture atlas partagée).
Vocabulaire consommé aujourd'hui (la table `ATTRIBUTES` liste chaque note → son mécanisme → sa
bande) : pace, acceleration, passing, control, dribbling, finishing, tackling, reactions,
composure, keeping. Les clés inconnues sont ignorées — le projet amont peut en porter plus.
Mesuré (3 × 120 s, élite 80-88 contre faible 30-35) : 3:0 au score cumulé, 86 % contre 80 % de
passes arrivées — un ACCENT d'équipe, pas une arcade.

La persona (`persona.js`) reste la couche ESTHÉTIQUE (silhouette, phase de cycle, tempérament
seedés) ; quand les deux parlent du même levier (vitesse, réaction), la note fait foi.

## Vérifier ce qu'on touche

```bash
# la suite complète (44 bancs, ~3 min)
for f in skills/threejs-aaa/scripts/verify-*.mjs; do node "$f" || echo "ÉCHEC $f"; done
# le monde composé (navigateur headless, build requis)
cd examples/showcase && npm run build && cd ../.. && node skills/threejs-aaa/scripts/audit-membres.mjs
```

`NOTES.md` est le journal de bord (chaque lot : mesures avant/après, morts d'instruments,
compromis) ; `skills/threejs-aaa/reference/` contient les 53 notes de conception — commencez par
50 (la charte), 53 (terrain/gardien/match), 51 (geste et warp).
