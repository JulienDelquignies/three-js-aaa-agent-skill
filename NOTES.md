# Cahier de bord — Three.js AAA Agent Skill

Notes de conception, veille et pistes à explorer. (Voir `README.md` pour la vue d'ensemble et
`skills/threejs-aaa/SKILL.md` pour la navigation du skill.)

---

## Veille / références externes

### GameBlocks — https://github.com/xt4d/GameBlocks  *(MIT, à surveiller)*

Projet très proche du nôtre : un **skill pour agents de code** (Claude Code / Codex) fournissant des
**modules JS réutilisables** pour prototyper des jeux 3D web (Three.js). Thèse d'ouverture identique à la
nôtre : *« Natural language is a weak interface for precise 3D behavior »* → fournir des blocs de code
inspectables plutôt que faire dériver la logique spatiale du prompt. Workflow « reuse-first » : l'agent
pioche/adapte des modules et documente ses choix dans `gameblocks_usage.md`.

**Points forts (à s'inspirer)**
- `modules/math/WorldBasis.js` — **source de vérité unique** des axes forward/right/up, du heading et des
  transforms de signaux de contrôle. C'est exactement le bug *moonwalk* qu'on a corrigé à la main
  (`base = atan2(fwd.x, fwd.z)` dans `character-controller.js`), mais centralisé proprement.
- **Largeur de genres** : personnage (sprint/crouch/jump, mouse-look, cardinal / heading-relative /
  world-target), **véhicules** (arcade + physique Rapier + drift), **avion/vol**, **course**
  (checkpoints/laps), snake, **shooter** (armes, projectiles homing, lock-on, IA de combat), vagues.
- **Physique réelle via Rapier** (résolveurs de collision par batch, voitures dynamiques).
- **IA/behavior** (pathfinding grille, steering d'évitement, waypoints, combat director) + **UI** (HUD,
  minimap, radar, notifications) + **caméras** (first-person, pose-follow, look-offset).

**Ce qu'on a et qu'eux n'ont pas** (complémentarité)
- **Rendu AAA** : WebGPU/TSL, PBR/IBL, post-processing/bloom. GameBlocks assume *« focus on stateful world
  layers rather than visual aesthetics »*.
- **Validateurs de correction** (scene / temporal / interaction) avec self-tests, **boucle visual-QA**
  (screenshot → critique), **foot-lock IK / no-slide**, **galerie déployée** et vérifiée en headless.

**Maturité** : très jeune — 1 commit, ~55 ★, pas de tests ni d'exemples visibles à ce jour. Taxonomie de
modules excellente sur le papier mais non éprouvée. Licence **MIT** des deux côtés → emprunt / interop OK.

**À retenir** : forte validation de notre approche ; on est **complémentaires** (eux = blocs gameplay +
physique + IA ; nous = rendu AAA + correction/vérification + qualité de locomotion/contrôles).

---

## Roadmap / pistes à explorer

Issues de la veille GameBlocks :
1. ✅ **`WorldBasis` natif** *(fait)* — `engine/world-basis.js` (`WORLD`) : source de vérité unique des
   transforms direction-gameplay ↔ axes-monde (heading, facing sans moonwalk, control-signal / move
   relatif-caméra, shortest-turn). Le `CharacterController` et les scènes (Contrôles, Soldier Volley) y
   routent. Self-test dep-free : `scripts/verify-worldbasis.mjs` (27/27, dont le cas moonwalk).
2. ✅ **Physique Rapier** *(fait)* — `engine/physics.js` (wrapper Rapier WASM) : sol, boîtes statiques
   (murs/rampe/marches) + dynamiques, ballon dynamique, et **personnage capsule cinématique** (auto-step,
   snap-to-ground, pousse les corps dynamiques) branché sur `CharacterController.collide`. Scène jouable
   **Physique**. Vérifié headless : murs bloquants (x≤17.3), caisses poussées (0.44 m), frappe ~12 m/s.
3. **Positionnement complémentaire / interop** — notre couche *rendu AAA + validation + locomotion* par
   dessus des blocs gameplay façon GameBlocks. Viser deux skills installables ensemble. *(en cours : les
   refs 21–24 citent GameBlocks et reprennent ses patterns — WorldBasis, behaviour/steering — pour rester
   alignés/interopérables ; reste à écrire un guide d'interop explicite.)*

Autres idées déjà évoquées :
4. ✅ **Machine à états d'anim** *(fait)* — `engine/anim-state-machine.js` : blend 1D Idle→Walk→Run par
   vitesse (chaque clip synchronisé à la vitesse au sol via son stride) + états discrets + crossfades.
   Intégrée au `CharacterController` (passer `walkClip`). Soldier a bien Idle/Walk/Run. Math pure testée
   (`verify-anim-fsm.mjs`, 15/15). Reste : couche additive (geste par-dessus la locomotion).
5. **Scattering GPU / herbe** à plus grande échelle, **LOD / streaming** (web-Nanite), caustiques d'eau.
6. ✅ **Particules** *(fait)* — `engine/particles.js` : système poolé instancié additif (1 draw call, sans
   alloc/frame) — poussière de course, étincelles à la frappe, gerbe à l'atterrissage, trails. Branché dans
   la scène **Physique**. Ref 25. Reste : fumée/traînées longues via TSL compute.
7. ✅ **IA adversaire (steering)** *(fait)* — `engine/steering.js` (seek/flee/arrive/pursue/wander),
   adversaire qui intercepte et dégage le ballon dans la scène **Physique**, piloté par le même
   `CharacterController`. Self-test `scripts/verify-steering.mjs` (10/10). Reste : pathfinding sur grille.

---

## Vision du jeu : « DS Life » — un FM incarné en 3D

On est **directeur sportif**. La gestion se fait comme dans FM via une **UI diégétique** — le
**téléphone** et l'**ordinateur** du DS (écrans in-world + overlay) — et toute la 3D sert à **vivre**
l'expérience : on contrôle son DS au quotidien, on se déplace dans les lieux, on rencontre.

Piliers (et leur mapping sur ce qu'on a déjà) :
1. **Incarnation** — contrôler le DS partout : ✅ CharacterController + caméra occlusion + interactions
   + monde multi-sites (`career.js`, contrats).
2. **Gestion FM via UI diégétique** — téléphone/ordinateur : interactable « consulter » → overlay UI
   (DOM/HTML par-dessus le canvas) ; la couche *données de jeu* (effectif, budget, offres) est un state
   séparé que la 3D et l'UI lisent tous les deux. *(à faire)*
3. **Lieux de rencontre & de vie** — là où se joue le métier : **restaurant, bar** (dîner avec un agent,
   fête avec les joueurs, croiser un joueur), **jet privé** (déplacements/recrutement), **concessionnaire**
   (s'acheter une voiture), **lieux de vacances** (villa plage, hôtel)… Chaque venue = un **nouveau type
   dans la grammaire** (même solveur, mêmes contrats) ou un petit générateur dédié façon `stadium.js`
   quand la forme est spéciale (fuselage d'avion). *(à faire)*
4. **Rencontres/événements** — des NPC (joueurs, agents) : on a déjà le même contrôleur pour les NPC +
   le steering ; une rencontre = spawn NPC + interactable (« E — Saluer / Discuter ») + s'asseoir à la
   même table. Les conversations/choix passent par l'UI (pilier 2). *(à faire)*

5. **La ville comme couche dérivée** (`city.js`, à faire) — vue surélevée : réseau de rues seedé +
   parcelles + les sites générés posés dessus ; **niveaux de ville liés au niveau du club** (T1 bourg
   champêtre → T5 métropole). Contrats : graphe routier connexe, chaque site raccordé, chemin entre tout
   couple de sites, routes hors bâtiments. **Source de vérité unique, plusieurs présentations** : vue 3D
   surélevée (on voit son véhicule rouler, l'arrivée masque le chargement du site) ET plan 2D sur le
   téléphone — cliquer l'un ou l'autre déclenche la même action de voyage (jamais deux cartes qui se
   contredisent). Remplacera les pads de téléport de la scène Carrière.
6. **Transport par paliers** — UN système « véhicule qui suit les rues », plusieurs habillages :
   **voiture perso** (celle achetée au concessionnaire), **bus d'équipe** (livrée aux couleurs +
   sponsors via `club-theme` — « E — Monter dans le bus » le jour de match, cinématique jusqu'au stade),
   **gare** (T1 halte → T5 grande gare, déplacements domestiques/scouting), **aéroport/jet** (T4+).
   Grille réaliste : T1-T2 bus · T3 bus+train · T4-T5 train 1re/charter.

① ✅ **Restaurant/bar + rencontre NPC** *(fait)* — type `restaurant` dans la grammaire (t1 bistrot →
t5 gastro ; la salle EST le hub : bar+tabourets, tables de 2 face à face ; **salons privés** dès t3),
archétypes `dining`/`meeting` avec contrat nommé « table de rencontre : 2 places face à face » (+ 2
sabotages). 4e site du monde Carrière (pads dérivés, 8 trajets, checkCareer généralisé à tous les
bâtiments). **Agent PNJ** (même rig/contrôleur, costume sombre) assis au salon privé ; chaise d'en face
= « E — S'installer au rendez-vous » → dialogue placeholder en bulle (4 répliques) → se lever. Vérifié
headless 26/26 dont **face-à-face géométrique (dot 1.00/1.00 à 1,60 m)**. Le check a attrapé un vrai
bug préexistant : **yaw mobilier ≠ yaw personnage** (conventions décalées de π) → tous les `sitAt`
asseyaient dos à la table ; corrigé partout via `ctrl.yawFor` (ref 33) + resynchro capsule au lever.

② ✅ **Ville surélevée + trajet voiture** *(fait)* — `city.js` (dérivé, dep-free) : grille sur les
empreintes réelles des sites, **rues creusées par Dijkstra ré-utilisateur de routes** entre les arrêts
dérivés des entrées (les avenues partagées ÉMERGENT) + avenues seedées, itinéraires re-calculés sur le
réseau seul, **parcelles→immeubles** (densité/hauteur = niveau du club : T1 bourg 30 % → T4 métropole
92 % + downtown près du club), arbres/lampadaires. `checkCity` (arrêts sur rue, route pour CHAQUE
trajet, rues jamais sur un site, immeubles jamais sur une rue, graphe connexe) ; harnais
`verify-city.mjs` 10/10 (densité croissante vérifiée + 5 sabotages). `city-builder.js` : bandes de rue
fusionnées (zéro z-fight), pointillés/passages piétons, **skyline = 1 InstancedMesh** (scale+couleur
par instance) + colliders immeubles. `vehicle.js` : voiture procédurale + `PathDriver` (vitesse easée,
yaw amorti, `finish()` = skip). Carrière : pad → **on regarde sa voiture traverser la ville** (caméra
chase surélevée 31 m, E passe, l'arrivée masque le chargement). Headless 41/41 : voiture SUR les rues
31/31 échantillons, garée à l'arrêt (d=0,00). Piège attrapé : toit de loge sans collider = l'occlusion
caméra l'ignorait (gros plan sur le toit à l'arrivée) → toit solide, règle notée en ref 34.

③ ✅ **Téléphone diégétique + couche de données FM** *(fait)* — `game-state.js` (dep-free, harnais
8/8 : effectif 14 joueurs G/D/M/A dont la qualité suit le niveau, budget par niveau, messages/non-lus,
déterminisme) + `phone.js` (overlay DOM autonome, T / Y manette / bouton 📱, 3 onglets). **Une ville,
deux présentations** : l'onglet Carte dessine LE MÊME objet `city` en 2D (mêmes cellules de rue, mêmes
sites, marqueurs live perso/voiture) et ses boutons déclenchent le MÊME `driveTo` que les pads — avec
**trajets multi-étapes composés** sur le graphe (maison→stade passe par l'arrêt du club, vérifié).
**La 3D écrit dans l'UI** : la fin du rendez-vous d'agent pousse un message (badge non-lu). Téléphone
ouvert = monde en pause (input coupé, physique/anim continuent). Headless 48/48. Ref 35.

③bis ✅ **iPhone à apps + vue ville Top Eleven** *(fait, sur retours utilisateur)* — le téléphone est
devenu un **vrai smartphone** : écran d'accueil (fond, barre d'état, barre home), **grille d'apps** avec
badges (Messages 💬, Effectif 👥, Finances 💶, Plan 🗺️, Transferts 🔁 et Réglages ⚙️ en placeholders),
pages plein écran avec retour ; les apps « action » (`launch()`) déclenchent directement (Plan → vue
ville). La **navigation ville sort du téléphone** : `city-view.js` = panorama fixe de la VRAIE ville 3D
(pose dérivée des bounds), **épingles DOM cliquables projetées** sur les sites (Vector3.project), M/🗺️
pour entrer, cliquer une épingle = fermer + rouler — style Top Eleven, pas de SimCity. Headless 52/52.

⚠️ Retour utilisateur : **pas fan du rendu 3D de la ville** — backlog polish visuel : trottoirs,
variation de façades (fenêtres émissives, toits), boulevards plus larges, places/rond-points, ambiance
(heure dorée / nuit), échelle des immeubles vs sites. À reprendre avant d'aller plus loin sur la ville.

④ ✅ **Concessionnaire** *(fait)* — type `concession` dans la grammaire (showroom VITRÉ via le flag
glass, bureau de vente, atelier, réserve) ; archétype `showroom` : **rangée de podiums côté vitrine,
nez vers la baie** (v1 centrée : le contrat a tué le podium devant la porte → rangée déplacée côté
vitrine = correct ET réaliste). **Catalogue dérivé** (`dealership.js`) : les modèles/prix suivent le
niveau — la **supercar apparaît au niveau 3 (lèche-vitrine, inabordable) et devient abordable au
niveau 4** — contrat `checkCatalog` (prix croissants, ≥1 abordable, sabotages) + `state.cash` (argent
PERSO ≠ budget transferts) et `buyCar` (refus/débit/message). 3D : variantes procédurales paramétriques
(citadine/berline/SUV, table DIMS) + **ferrari.glb du repo three.js** (458 Italia par vicent091036,
crédité — Draco : décodeur copié dans public/draco/) ; `paintCar` recolore l'objet `body` (matériau
cloné par instance), `findWheels` fait tourner ses roues sous le même PathDriver. Les voitures des
podiums tournent et **cyclent leurs teintes** — acheter prend la couleur affichée, zéro UI en plus, et
la voiture achetée devient CELLE qui roule en ville. Headless 59/59 (Ferrari refusée niv 3, SUV acheté
−90 k€ + message + conduit jusqu'au resto). Harnais : 20 programmes floorplan/furnish, dealership 13/13.

Backlog (suite) : ⑤ jet privé + gare fonctionnelles + bus d'équipe (même PathDriver, livrée club)
→ ⑥ vacances → polish visuel ville (retour utilisateur).
Note échelle : les tiers actuels = base compacte ; le passage « dimensions PSG » est un changement de
données (aires, terrains 105×68, T6 élite, stade 45–60k) — voir discussion du 03/07/2026.

## Chantier : jeu « carrière » (club de foot + logement du joueur)

Objectif : un jeu où l'on contrôle un perso Mixamo dans les locaux du club **et** chez lui, avec des
**niveaux d'infrastructure** (club T1→T5 ; chambre d'hôtel→villa avec piscine). Principe retenu : pas de
plans dessinés — une **grammaire + des contrats**. Le lieu est une *donnée* `{type, tier, seed}`,
générée puis validée → « modifiable/personnalisable sans régression ».

1. ✅ **`floorplan.js` + contrat anti-régression** *(fait)* — spec→programme→layout hub-et-bandes
   (adjacences partagées par construction) → **portes/fenêtres/escalier dérivés** (porte = segment centré
   du mur partagé ; escalier aux règles réelles 15–19 cm, atterrit dans les deux hubs) → JSON patchable →
   `checkModel()` (accessibilité BFS, largeurs passables, recouvrements, porte-pas-dans-l'angle…).
   Harnais `verify-floorplan.mjs` : 10 programmes × 30 seeds = 300 modèles verts + déterminisme ; les
   sabotages (porte suprimée, pièces qui se chevauchent, marche à 25 cm, porte dans l'angle) sont attrapés.
   `place-builder.js` : meshes + **mêmes boîtes en colliders Rapier**. Scène galerie **Lieux procéduraux**.
2. ✅ **`furnish.js` + `furniture-kit.js`** *(fait)* — recettes par archétype (chambre/sdb/séjour/cuisine/
   bureau/vestiaire/gym/média/…) sous règles dures : contre-mur + face à la pièce, zéro chevauchement,
   **zones de dégagement des portes/escalier toujours libres**, contraintes d'orientation (chaise→bureau,
   TV→canapé). `checkFurnishing()` re-vérifie indépendamment ; kit 3D compact (~25 meubles) + colliders.
   Harnais `verify-furnish.mjs` : 10 programmes × 20 seeds verts ; sabotages attrapés nommément.
2bis. ✅ **Stades + identité club** *(fait)* — `stadium.js` paramétrique T1 champêtre (1 tribune basse,
   ~850 places) → T5 moderne (4 tribunes 2 niveaux, toit, ~13,5k) ; **loge + terrasse du directeur
   sportif** = points de vue jouables (`model.vantages`, la « vue FM »), contrat `checkStadium` avec
   **sightline terrasse→rond central garantie** (harnais `verify-stadium.mjs`, 5 tiers verts). Sièges
   instanciés aux couleurs du club, blason en loge (`club-theme.js` : makeTheme + drawCrest/drawJersey).
   Clubs : **bureaux vitrés forcés côté terrains** (baies dérivées, contrat « glass face aux terrains »)
   + 1→3 terrains d'entraînement dehors. Maillots encadrés + blason dans les bureaux (furnish `club`).
   **Loge équipée** : bar + tabourets, rangée VIP face à la vitre, frigo, écran, plante, blason — avec
   contrat (VIP face au terrain, rien contre la vitre, bar au fond, zéro chevauchement) et **encoche du
   niveau 2 autour de la loge** (le contrat a attrapé les sièges qui traversaient la pièce, puis la
   plante qui bloquait la vitre — preuve que le garde-fou mord). **Mobilier de match** : cages
   réglementaires 7,32×2,44 avec filets en segments, panneaux sponsors (theme.sponsors, 1→4 côtés),
   pylônes (T1-3) → rampes de toit (T4-5), abris de touche plexi + tunnel, drapeaux de corner, écran
   géant (T3+), marquages complets — tout sous contrat (cages sur la ligne, panneaux ≥2 m et ≤1,1 m…).
   Reste idées AAA : foule instanciée, ambiance sonore, herbe 3D/decals d'usure, portique TV, mode nuit.
2ter. ✅ **Salle de presse** *(fait)* — `salle-presse` dans la grammaire club (T2 14 m² → T5 26 m²),
   archétype `press` : **fond sponsors** contre le mur (`drawPressWall` — pastilles blason + noms
   sponsors en quinconce, le mur TV réel), **pupitre** à 1 m devant (plateau blanc, jupe aux couleurs du
   club, 3 micros), chaises des intervenants entre les deux, **rangées de presse face au pupitre**
   (contrainte `faces`), caméra TV sur trépied au fond si la pièce est assez profonde. Règles NOMMÉES
   dans `checkFurnishing` (fond présent/aligné/DERRIÈRE/≤1,2 m, ≥2 sièges face au pupitre) + 3 sabotages
   au harnais. Les sièges sont des `chair` → asseyables d'office dans Intérieur/Carrière. Piège corrigé :
   écart pupitre↔chaise pile à la tolérance de recouvrement (flottants) → desserré à 0,62 m.
2quater. ✅ **Cafétéria+cuisines, espace kiné, pupitre jouable** *(fait)* — grammaire club T2+ :
   `cafeteria` + `cuisine-cafet` **attenante via** (mur partagé + porte dérivés par construction) et
   `salle-kine` (archétype `physio` : 2 tables de massage en freeSpot — accessibles tout autour —
   rangement, lavabo, tapis, tabouret). Assertions au harnais (kiné équipé, cafétéria+cuisines).
   Scène Carrière : **« E — S'installer au pupitre »** sur les chaises des intervenants → pose assise +
   **caméra plan TV** dérivée (au fond des rangées, cadrant pupitre + fond sponsors), retour caméra
   épaule au lever. Vérifié headless 17/17.
3. ✅ **`interactables.js`** *(fait)* — `InteractableSystem` (proximité + prompts « E — … »),
   **portes** construites depuis le floorplan (panneau pivotant + **collider Rapier cinématique** —
   fermé ça bloque : 0,54 m vs 4,5 m ouvert, vérifié headless), **s'asseoir** (`ctrl.sitAt` : pose
   procédurale, hanches SUR l'assise à 0,50 m — règle sitPose), **ramasser/porter/poser** (`carryFollow`,
   ballon ≤0,13 m de la main — règle heldInHand). Input par instance (keymap/padmap : E / X manette /
   tactile). Scène jouable **Intérieur** (club T2 généré + meublé + thémé, caméra Sims au-dessus des murs).
   Reste : interrupteurs de lumière (avec l'éclairage intérieur, étape 4).
4. ✅ **Collision caméra + éclairage intérieur** *(fait)* — `ThirdPersonCamera.update(…, obstruct)` +
   `Physics.raycast(excludeBody)` : la caméra se plaque devant le mur (snap-in) et ressort en douceur
   (vérifié : 8,5 m → 0,36 m, segment tête→caméra dégagé ; les vitres, sans collider, laissent voir à
   travers — assumé). `interior-lighting.js` : suspension + PointLight par pièce (budget : sans ombres,
   portée limitée) + **interrupteurs dérivés** à côté de chaque porte (interactables), ambiance soir dans
   la scène Intérieur. Vue rasante désormais permise (minPitch 0.18).
5. ✅ **Démo jouable carrière** *(fait)* — `engine/career.js` : le monde ENTIER dérivé du **niveau du
   club** (1..4) : logement (hôtel→villa) + centre d'entraînement (club T1→T4) + stade, **offsets calculés
   depuis les empreintes réelles** (placeBounds/stadiumHalf + marge), **pads de voyage dérivés des
   entrées** (dehors devant la porte / au centre de la loge), spawns dérivés. `checkCareer()` = contrat
   monde (chaque site re-passe son propre contrat + non-chevauchement, graphe de voyage connexe, pads
   praticables) ; harnais `verify-career.mjs` (4 niveaux × seeds + 5 sabotages nommés). Au passage :
   **porte de terrasse de la loge DÉRIVÉE** (`loge.door`, contrat « terrasse atteignable à pied » — avant
   ça le parapet scellait la pièce) + garde-corps en verre avec main courante. Scène jouable **Carrière**
   (`?niveau=1..4`) : même perso, mêmes contrôles maison ↔ club ↔ terrasse de la loge (téléport
   cinématique, `groundY` par site pour s'asseoir en hauteur — place VIP OK). Vérifié headless 13/13 :
   marche aux 3 sites, porte de terrasse franchissable, parapet bloque ailleurs, garde-corps retient.

## État actuel (rappel)

- Skill `threejs-aaa` : refs 01–22, scripts de vérif (interaction / scene / temporal / locomotion), starter runnable.
- Modules moteur natifs : rendu (WebGPU+IBL+post), `locomotion.js` (matchCadence) + `foot-lock.js` (FootLockIK,
  no-slide), `character-controller.js` (facing sans moonwalk, run/idle, sprint, jump), `input.js`
  (clavier + manette + souris + tactile), `third-person-camera.js` (caméra pilotable), validateurs.
- Galerie publique déployée : https://threejs-aaa-showcase.vercel.app (jouables : **Carrière**,
  Contrôles, Physique, Intérieur ; génération : Lieux, Stades ; plus Soldier Volley dribble→centre→volée,
  Matériaux PBR, Monde procédural, IK, Géométrie, Bloom, Océan, Herbe).
