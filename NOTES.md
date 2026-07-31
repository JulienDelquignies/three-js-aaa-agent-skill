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

④bis ✅ **Voitures procédurales v2** *(fait, sur retour utilisateur « loin de la Ferrari »)* — le
kit voiture est passé des boîtes à la **carrosserie par profil 2D extrudé avec bevel** (museau, capot,
ceinture, malle — listes de points par gamme) + **bulle vitrée posée SUR la ligne de caisse** (le
contraste coque peinte / vitrage est ce qui fait « vraie voiture » ; v1 avec un seul profil jusqu'au
toit avalait le vitrage — attrapé en QA visuelle). Peinture clearcoat physique (modérée : un clearcoat
miroir crame en blanc au soleil + bloom — 3 itérations de QA), pneus toriques + jantes à rayons,
calandre, optiques émissives douces, rétros, plaques. Le glint de pare-brise face au soleil est
physique et assumé. Backlog : packs CC0 (Kenney Car Kit / Quaternius) si on veut des modèles réalistes
supplémentaires sans coût de licence.

⑤ ✅ **Transport par paliers** *(fait)* — types `gare` et `aeroport` dans la grammaire (hall +
guichets/comptoirs `ticketing` + attente `waiting`, **extérieur dérivé** : quai avec ligne de sécurité
et rails / tarmac) ; `checkCareer` IMPOSE l'échelle dans les deux sens (gare obligatoire dès le niveau
3, interdite avant ; aéroport au 4) — sabotage prouvé. **Bus d'équipe** `buildBus({theme})` : profil
extrudé à l'échelle car, **livrée club** (peinture primaire, bandeau sponsors sur les deux flancs,
blason) ; jour de match « E — Monter dans le bus » → MÊME PathDriver jusqu'au stade, la voiture RESTE
garée (flag `_skipCarPark`), retour en bus depuis la loge puis regarage au club. Train régional + jet
d'affaires en habillage quai/tarmac. **Voyages de scouting** (gare 🚆 national / aéroport ✈️ étranger,
meilleurs prospects) → `state.scoutTrip` déterministe → shortlist + message du Chef du scouting →
**l'app Transferts affiche la shortlist** (le placeholder est devenu une vraie app). Piège attrapé :
`Object.assign(mesh, {position})` jette (accesseur read-only d'Object3D) — la scène entière ne
chargeait plus, diagnostiqué headless (ref 37). Harnais 600 modèles + carrière 11/11 + gamestate 10/10 ;
headless ~72 checks verts (aller-retour bus, voiture immobile, scouting, app).

⑤bis ✅ **Intérieurs des véhicules** *(fait, sur retour utilisateur « l'important c'est l'intérieur »)*
— `cabin.js` : la cabine comme DONNÉE dérivée (bus 2+2 + conducteur ; wagon 2+2 + paires face-à-face à
tablettes ; **jet = salon volant**, fauteuils club face-à-face — la future salle de recrutement en vol)
avec contrat `checkCabin` (sièges dans la coque, allée intégralement dégagée, baie de porte libre,
face-à-face du salon). **Leçon de contrat** : l'allée à 0,52 m passait le harnais mais coinçait la
capsule en jeu (Ø 0,60 + 2×offset 0,02) → le contrat encode désormais le VRAI gabarit 0,64 m.
`cabin-builder` : sol/panneaux vitrés/LED/sièges thémés + colliders locaux. Deux montages : cabine DANS
le groupe bus (elle roule avec ; la coque FrontSide est invisible de l'intérieur → ville visible par le
bandeau vitré) → **jour de match vécu de l'intérieur avec 3 coéquipiers assis en maillot** (clones
SkeletonUtils, jambes repliées après chaque update mixer) ; cabine POSÉE au pose du véhicule garé avec
`addStaticBox(pos, half, rot)` (yaw quelconque — le jet est à 0,5 rad) → **train et jet praticables** :
monter à bord (groundY = plancher), marcher l'allée, s'asseoir, scouting depuis la tablette, descendre.
Jet redimensionné pour contenir le salon (fuselage r 1,5 ; la bande déco passait À TRAVERS la cabine →
sous le plancher). Harnais cabine 14/14 (6 sabotages) ; headless complet vert.

⑥ ✅ **Lieux de vacances** *(fait)* — la **station balnéaire** comme donnée dérivée (`beach.js`) :
villa = grammaire `home` UN TIER au-dessus du niveau (on part en vacances mieux qu'on ne vit), sable
enveloppant qui descend vers la MER au sud, palmiers seedés (hors villa, hors transats), **transats
face à la mer** (contrat géométrique `cos(yaw) ≥ 0,9`) + parasols. `checkBeach` = la porte : mer
strictement après le sable, villa hors des vagues, transats sur le sable/hors de l'eau, spawn
praticable, pad de retour à ≤ 6 m — 6 sabotages nommés (« la mer inonde la plage », « transat dos à la
mer »…) dans verify-beach 18/18. `beach-builder` : sable/bande humide/écume, mer VISUELLE bien plus
large que le rect de données (l'horizon lit « pleine mer »), palmiers procéduraux (tronc segmenté
penché déterministe, palmes retombantes, cocos), transats à dossier ARTICULÉ au bout du bac (piège de
signe `rotation.x` : dans le mauvais sens le dossier plane au-dessus de l'assise comme une table).
Leçon rendu : un grand plan très clair (sable quasi blanc) sous soleil+bloom = voile laiteux sur toute
l'image → grands plans mi-teinte (0xbfa26b), parasols terracotta plutôt que blancs. **Boucle forme** :
`state.forme` 100 au départ, scouting −12 (train) / −18 (jet) borné à 0, `state.vacation()` restaure
100 + message de l'assistante, l'app Finances affiche la forme (vert/ambre/rouge). Carrière : station
construite dès que la gare existe (niveau ≥ 3) à `city.bounds[2]+100` — aucune rue n'y va, on n'y
accède QUE par train/jet : table 0 du salon = scouting, **table 1 = « Partir en vacances 🏖️ »** (deux
actions sur la même table se disputeraient le prompt) ; arrivée sur le sable devant la villa (site
`vacances`, HUD manuel), transats allongeables (yawFor), pad « Rentrer de vacances » → retour au site
de départ. Villa meublée, portes, sièges assis. Harnais beach 18/18 + gamestate 14/14 ; headless ~95
checks verts (départ depuis le wagon, forme 88→100, transat face mer fz=1.00, retour gare, app
Finances). Réf 38.

⑦ ✅ **Polish visuel ville** *(fait, sur le retour « pas fan de la vue ville »)* — diagnostic sur
cliché : boîtes nues sans fenêtres ni toits, aucune séparation trottoir/rue, du vert vide partout =
maquette en carton. Trois fixes NATIFS : **(1) trottoirs dérivés** dans city.js (toute cellule libre
qui touche une rue OU un site devient pavage trottoir/parvis — les immeubles posent sur des parcelles
pavées, les sites gagnent une esplanade, les cours restent vertes) avec contrat étendu (pavage jamais
sur rue/site, chaque immeuble SUR une cellule pavée) + 2 sabotages (« trottoir coulé au milieu de la
rue », « immeuble sans trottoir ») — verify-city 12/12. **(2) façades instanciées à VRAIES fenêtres**
dans city-builder : instances bucketées par nombre d'étages (round(h/3), cap 12) pour que la texture
canvas ait le bon nombre de rangées (une texture unique s'étire — une tour de 22 m portait 4 fenêtres
géantes) ; par bucket : albedo déterministe (mur blanc teinté par instanceColor, vitres sombres, ~30 %
allumées chaudes) + emissiveMap assortie + **material ARRAY sur la box** (flancs = façade, dessus =
toit sombre — ordre des groups +x,−x,+y,−y,+z,−z) ; ~12 buckets = ~12 draw calls pour toute la
skyline. **(3) leçons vue aérienne** : les grands plans quasi blancs (toit métallique clair des
tribunes) crament au soleil+bloom en plongée → mi-teinte ; et le fog exponentiel qui pose l'échelle au
sol délave le panorama → la vue ville amincit fog.density ×0,35 à l'entrée et le restaure à la sortie.
Attrapé au passage : la mer VISUELLE de la station (élargie symétriquement) inondait le quartier du
stade → extension côté large uniquement. Harnais 12/12 + stade 8/8 ; headless 73 checks verts. Réf 34
enrichie.

⑧ ✅ **Éditeur agent : play-mode MCP + gizmos de debug** *(fait — discussion « un Unity web pour
three.js ? » : pas de fork, pas d'éditeur GUI — l'éditeur d'un agent c'est une session vivante
requêtable + la scene view rendue dans ses captures ; et l'utilisateur voulait son œil/sa main →
le même debug marche sur l'URL déployée)*. **(1) `scripts/playmode-mcp.mjs`** : serveur MCP stdio
zéro-dépendance (JSON-RPC 2.0 à la main, ~60 lignes de protocole) qui garde UNE session Chromium
persistante — outils `play_open` (dist + params, défaut niveau=3&debug=1), `play_state`,
`play_screenshot` (N frames de sim + caméra libre {pos,look}), `play_eval` (JS async avec S/E liés —
l'échappatoire universelle : téléporter, agir, lire un contrat), `play_perf`, `play_close`.
Enregistré dans `.mcp.json` du repo (chargé aux prochaines sessions) ; playwright ajouté en devDep du
showcase (chromium préinstallé dans l'env). Testé en VRAI JSON-RPC sur stdio : 10/10 (travelTo 3 ms,
capture ~2-8 s — l'itération QA passe de la minute à la seconde). **(2) `engine/debug-gizmos.js`**
(natif, `?debug=1` sur n'importe quelle URL y compris le site déployé) : colliders en wireframe
(statiques ambre, cinématiques cyan suivis par frame — les portes), anneaux verts des interactables,
routes de ville en bleu, panneau DOM live (site, pos, draw calls/tris, 4 interactables les plus
proches avec distances). Un InstancedMesh par famille + depthTest:false ; registre `phys.boxes`
ajouté dans physics.js (le monde Rapier n'est pas assez introspectable). Les bugs « données ≠ visuel »
(allée du bus coincée, dossier de transat inversé) se voyaient chacun au prix d'un script de sonde —
maintenant en un coup d'œil. Headless complet PASS ; réf 39 ; l'ordre compte : l'éditeur AVANT les
gros chantiers de contenu (galeries de seeds, équilibrage statistique de saison, caméra de match).

⑨ ✅ **Meshkit — « un Blender three.js » pour modèles IA au-delà des boîtes** *(fait, question
utilisateur)* — les opérateurs de Blender comme FONCTIONS PURES sur données (`engine/meshkit.js`,
zéro dépendance → testé node) : `lathe` (révolution — vases, coupes, socles), `sweep` (section 2D le
long d'une courbe 3D avec repères en transport parallèle/Rodrigues — tuyaux, anses), `loft` (coques),
`sphere`+`displace` (champ seedé le long des normales — rochers), `transform/mirrorX/merge`
(assemblage ; mirrorX inverse le winding sinon miroir retourné). Normales lisses pondérées par l'aire
= le look organique. **Contrat `checkMesh`** : coordonnées finies, indices valides, pas de triangles
dégénérés, budget tris, et pour les solides topologie FERMÉE (chaque arête partagée par exactement
2 triangles) + VOLUME SIGNÉ POSITIF (théorème de la divergence — attrape les maillages retournés) ;
surfaces ouvertes assumées via closed:false. Harnais verify-meshkit 17/17 (bibliothèque vase/
bouteille/coupe/tuyau-S/coque/rocher/trophée + 5 sabotages nommés). `meshkit-builder.js` = seul
fichier qui touche three. **En jeu** : trophée doré de la loge (coupe lathe + anses sweep miroir,
socle) posé à un emplacement DÉRIVÉ (x le plus dégagé du mur du fond → pile sous le blason — « une
coordonnée est une supposition, une dérivation est une décision »), vase terracotta sur la table du
rendez-vous, rochers sur la plage (colliders). **Dogfooding éditeur agent** : toute l'itération
(chope dorée → vraie coupe ; coin occupé par le bar puis le frigo → dérivation) faite au playmode MCP
en secondes — v1 du trophée jugée et corrigée sur captures live sans un seul script jetable. Réf 40.

⑨bis ✅ **Meshkit v2** *(fait, « tu peux encore améliorer l'outil ? »)* — **(1) `extrudePoly`**
(polygone quelconque, CONCAVE inclus — ear clipping ; chanfrein par offset mitre ; caps partageant
les sommets des anneaux → manifold) avec orientation AUTO-CORRECTIVE : le sens 2D du contour vs la
convention des anneaux peut retourner le solide → l'op vérifie son propre volume signé et inverse le
winding si négatif (« le signe du volume est la vérité, pas la convention ») ; harnais : volume du L
EXACT (0,72×0,5=0,36). **(2) `roundedRect`** (contour à coins arrondis — dalles, coussins).
**(3) `smooth`** = SUBDIVISION DE LOOP (manifold fermé requis — garanti par le contrat) : cage
grossière → organique ; ×4 tris/passe, volume décroissant positif ; petites cages fondent (densifier
pour du raide). **(4) `noise(seed)`** value-fBm 3D seedé. **(5) `runSpec`** : le .blend en JSON —
pipeline déclaratif parts/ops. **(6) `meshkit-export.mjs`** : spec → **.glb standard** (writer
glTF 2.0 binaire écrit à la main, zéro dép, refuse d'exporter un maillage qui casse checkMesh) —
les modèles meshkit chargent dans Blender/Unity/PlayCanvas/tout three.js ; démos --demo
vase|trophy|rock ; harnais valide magic/chunks/accessors du binaire. **(7) Modélisation LIVE** :
`window.__meshkit` exposé dans Carrière → depuis le playmode MCP, un play_eval compose cage→smooth→
checkMesh→buildParts→scene.add et le screenshot suivant juge — sculpter-regarder-ajuster en secondes
(démo : méridienne cage L 44 tris → Loop ×2 → forme douce sur le terrain d'entraînement ; 2 premiers
essais spawnés DANS la chambre puis DANS un mur → position dérivée du terrain, encore la leçon
« dérivation > coordonnée »). Harnais meshkit 27/27. Réf 40 enrichie.

⑩ ✅ **Meshkit partout** *(fait, « ok meshkit partout »)* — le mobilier-boîtes remplacé pièce par
pièce dans `furniture-kit.js` via deux helpers cachés par dimension (N chaises partagent UNE
géométrie) : `pad()` = cage roundedRect → Loop ×1 (matelas, couette, oreillers, coussins d'assise et
de dossier + accoudoirs du canapé, galette de chaise, assise/dossier de fauteuil de bureau, plateau de
table de massage) et `turned()` = lathe (pot de plante, lavabo pied+vasque en UN profil, assise de
tabouret) ; feuillage des plantes = 3 blobs sphère-déplacée (bruit seedé) ; **arbres de la ville** :
la couronne instanciée passe du cône au blob meshkit partagé (skyline organique, zéro draw call en
plus). Les boîtes restent pour ce qui EST boxy (cadres, étagères, casiers). Contrats et colliders
INTACTS (empreintes inchangées — verify-furnish 40/40 sans retouche) : l'upgrade est purement
visuelle, jugée sur captures live au playmode (coussin de chaise au resto, plante organique, arbres).
Perf notée : ~125 draws sur la vue resto (au-dessus du budget indicatif 100 — chaque coussin est un
mesh de plus ; piste : fusionner les pads par pièce ou instancier par kind si ça devient un vrai
problème). Réf 28 enrichie (« Soft parts come from meshkit »). Headless complet PASS.

⑪ ✅ **Conduite libre + circuit + GT meshkit** *(fait — « se déplacer en voiture… une virée sur un
circuit »)* — **(1) `drive.js`** : contrôleur arcade MODÈLE BICYCLETTE sans dépendance (physique
injectée via collide comme le character controller) — vitesse de pointe/freinage/traînée, braquage
adouci par la vitesse, marche arrière juste par le signe de v ; capsule cinématique r 0,95 → immeubles
et barrières RÉELS, drapeau `blocked` purge la vitesse au contact ; harnais 9/9 (cercle de braquage,
mur, déterminisme). En jeu : « E — Prendre le volant 🚗 » sur SA voiture, ZQSD + Maj frein, caméra de
chasse basse, E descend à la portière (premier test live : 3 m et l'immeuble d'en face — la collision
marche). **(2) `circuit.js`** : boucle Catmull-Rom fermée sur points de contrôle à VARIATION RADIALE
BASSE FRÉQUENCE (le jitter indépendant replie le tracé sur lui-même — attrapé par le contrat) ;
génération AUTO-CORRECTIVE déterministe (re-seeds dérivés jusqu'à contrat vert) ; `checkCircuit` :
rayon de courbure ≥ 9 m partout, pas d'auto-intersection/pincement (voisinage CIRCULAIRE —
min(j−i, n−(j−i)), la version linéaire accusait la couture), paddock hors piste, grille sur la piste ;
4 sabotages (piège : un pic radial fait un rebroussement à circumradius GÉANT — plier ⟂ à la tangente
pour tester le rayon). `makeLapTimer` = franchissement de ligne en espace piste (along/lateral),
testé node au rythme réaliste. Builder : ruban asphalte triangulé (DoubleSide ! — enroulé face au sol
il était invisible du dessus), vibreurs et barrières instanciés (colliders yaw), portique damier.
**(3) `buildGT`** (meshkit) : carrosserie + vitrage LOFTÉS en sections superellipse (queue→nez pour
le winding) + Loop ×1 — hanches sur les roues arrière, nez bas, fastback ; contrat voiture habituel
(matériau 'body', roues tournantes) ; catalogue `gt` 240 k€ dès le niveau 2, le showroom affiche
désormais le HAUT de gamme (offset catalogue − podiums). **(4) Journée circuit** : au concessionnaire
→ téléport voiture+DS sur la grille, chrono live au HUD (temps + record + km/h), record →
`state.recordLap` + message « Chrono circuit » ; pad retour → site de départ. Site `circuit` à
bounds[2]+130 / bounds[1]−170 (loin de la ville ET de la plage). Harnais drive 9/9, circuit 24/24,
gamestate 15/15 ; headless complet PASS (section 18 : volant, GT achetée, grille, 48 km/h, retour) ;
QA visuelle playmode (GT rouge en courbe, aérien du tracé). Réf 41.

⑪bis ✅ **Boutons tactiles déclaratifs** *(fait, retour utilisateur « sur mobile il manque le bouton
d'action »)* — les boutons tactiles étaient codés en dur TIR/CTR (démos foot) : Carrière n'avait AUCUN
bouton E sur téléphone alors que tout passe par lui. `Input` accepte désormais
`touch: [{label, action, size?}]` déclaré par la scène (défaut rétro-compatible TIR/CTR) ; Carrière
déclare E (76 px) + FREIN, Intérieur déclare E. Piège attrapé au passage : en conduite, le frein
lisait `down('sprint')` qui inclut l'AUTO-sprint du stick poussé à fond → sur tactile, accélérer
aurait freiné — nouveau `downStrict()` (appui explicite seulement). Test émulé tactile (hasTouch) :
boutons présents, tap sur E → edge 'interact' déclenché ; headless PASS. Réf 22 enrichie.

⑫ ✅ **Animkit — les moves du rig Mixamo comme données** *(fait, « un outil similaire pour les moves
du rig / créer des animations foot »)* — le meshkit du mouvement : un move = POSES nommées (degrés
par os, ordre XYZ, absolues — tout-zéro = T-pose, BASE_POSE bras baissés mergée sous chaque clé) sur
une timeline → `resolveTracks` (quaternions inline, zéro dép, testé node) → `animkit-builder` compile
en AnimationClip contre le VRAI rig (résolution des noms d'os par suffixe — les exports GLB
renomment). **Contrat `checkClip`** : os Mixamo connus (une typo d'os = silence sinon), clés triées,
quaternions normalisés, vitesse angulaire bornée (membre « téléporté » > 14 rad/s = le tell des anims
générées cassées), couture de boucle continue, genoux/hanches dans leurs plages ; 5 sabotages nommés.
**Leçon d'axes durement gagnée en live** (2 itérations playmode + une sonde des rotations réelles) :
les bras de CE rig ne sont PAS en miroir (idle : z ≈ +60 des DEUX côtés) ; bras z : 0 = T-pose,
+60 = baissé, **−70 = levé**, +160 = croisé devant la poitrine (la 1re célébration s'auto-enlaçait,
la 2e ne levait qu'un bras). **Lecture ADDITIVE obligatoire** : deux actions normales sur les mêmes
os se moyennent 50/50 (célébration à mi-hauteur au 1er screenshot) → `makeClipAdditive` (deltas vs
frame 0 = BASE) + AdditiveAnimationBlendMode, fade in/out auto — le geste roule PAR-DESSUS la
locomotion et retombe sur l'idle (headless : Δ 2,27 rad au pic, Δ 0,02 après). **Bibliothèque** :
frappe (armé-fouetté-accompagné + contre-bras), passe intérieur, célébration bras au ciel, salut
(boucle), poignée de main, applaudissements. **En jeu** : la ligne 🤝 du rendez-vous d'agent joue la
poignée sur le joueur ET le PNJ (même clip, deux mixers), un record au circuit joue la célébration à
la descente de voiture. Harnais animkit 16/16 ; headless PASS (geste réel + retour idle). Réf 42.

⑫bis ✅ **Animkit root motion — talonnade, amorti, plongeon, retournée** *(fait, « tu peux tout
faire en AAA ?? »)* — clés `hips: [droite, haut, avant]` en MÈTRES personnage + rotation du bassin →
plongeon de gardien et retournée acrobatique possibles. Contrats racine : dy ∈ [−0,85, 1,1] (bassin
debout ≈ 0,95 m, allongé ≈ 0,2 — ni sol traversé ni saut-fusée), vitesse linéaire ≤ 6,5 m/s, boucle
ramène le bassin ; 3 sabotages. **Le piège d'axes, un cran plus profond que les bras** : l'armature
Mixamo est TOURNÉE (−90° X) et en centimètres — sondé live, la base monde du parent du bassin avait
scaleY = 0 (le Y local pointe à l'HORIZONTALE) ; le premier plongeon « jouait » avec le bassin figé à
0,98 m (les rotations le faisaient PARAÎTRE en l'air) — c'est la sonde NUMÉRIQUE (hips.worldY dans le
temps), pas le screenshot, qui l'a attrapé. Fix : delta transformé espace-personnage → monde (base du
root, forward −Z) → local du parent du bassin (base parent INVERSE — absorbe rotation ET cm).
Résultat mesuré : plongeon 0,96 → envol 1,06 → SOL 0,30 → relevé 0,97 ; retournée : corps renversé en
l'air, jambe fouettée au-dessus de la tête (captures). Harnais animkit 23/23 ; headless PASS
(10 moves compilés). Réf 42 § root motion.

⑬ ✅ **Ordinateur portable + rendez-vous en vol** *(fait — « un ordinateur dans la main comme son
téléphone » + « agir dans le bus/train/avion »)* — **(1) `laptop-prop.js`** : portable meshkit (deux
dalles arrondies Loop sur CHARNIÈRE animée, écran émissif qui s'allume en fin d'ouverture) parenté à
l'os LeftHand du rig — plié dans la main en marchant ; contre-échelle 1/getWorldScale (rig en cm),
pose locale réglée en live au playmode. **(2) `laptop.js`** : DS OS — fenêtre façon macOS (barre,
feux tricolores, dock, contenu large) qui rend LES MÊMES objets-apps que le téléphone (une couche de
données, deux écrans diégétiques — jamais en désaccord) + app Emails exclusive. O / 💻 : prop visible
→ charnière (~0,4 s) → DS OS ; monde en pause comme le téléphone. **(3) Rendez-vous EN VOL** (niveau
4) : la 2e paire club du jet est RÉSERVÉE (exclue des sièges génériques — deux interactables sur le
même siège se disputent le prompt), agent en costume sombre (_seatedExtra à teinte custom sans lerp
maillot) ; « E — Rendez-vous en vol ✈️ » = la grammaire de rencontre du restaurant en altitude :
s'asseoir face à lui, 4 répliques, accord → message + poignée de main sur LES DEUX rigs. Ordre de
câblage : les cabines montent AVANT le rig → la cabine stocke ses réfs, le NPC se crée après.
Rappel utilisateur : le bus matchday cinématique existait déjà (⑤bis, vécu de l'intérieur avec
coéquipiers) ; backlog : trajets train/jet cinématiques (le véhicule qui roule/vole vraiment).
Headless PASS (section 20 : prop en main, charnière, DS OS ouvert, monde en pause, replié) ; QA live
(DS OS, portable en main, rdv en vol avec plage par les hublots). Réfs 35 & 37 enrichies.

⑬bis ✅ **Panneau d'aide fermable** *(fait, retour utilisateur mobile : le texte d'aide avalait tout
l'écran)* — les 4 pages avec bloc `.help` (carrière, contrôles, intérieur, physique) : ✕ pour replier
en petit bouton ❓ (empilé sous les boutons HUD quand ils existent, sinon bas-droite), REPLIÉ PAR
DÉFAUT sur tactile/petit écran, max-width/height + scroll quand ouvert. Vérifié en émulation mobile :
fermé par défaut, commandes tactiles dégagées, toggle dans les deux sens.

⑬ter ✅ **Tenue de l'ordinateur** *(fait, retour utilisateur : « il met pas l'ordi comme il faut »)*
— ouvert, l'ordi pendouillait bras ballant à hauteur de cuisse. Deux mécanismes : **(1)** geste
animkit « consulter » en BOUCLE tant que DS OS est ouvert (avant-bras gauche relevé ~95° porteur,
main droite au clavier, tête baissée, micro-balancement) — stopGesture() au repli ; **(2)** le prop
ne SUIT plus l'orientation de la main quand il est ouvert : `levelInHand()` recalcule chaque frame
une orientation MONDE (base à plat, écran vers le visage) via local = handWorldQ⁻¹ × yaw(forward) —
deviner la rotation locale d'un os de main est sans espoir (2 essais ratés : ordi de chant, puis
vertical), la contrainte monde calculée est la bonne approche ; setCarried() restaure la pose de
portage au repli. Assis, pas de geste (l'ordi sur les genoux). Harnais animkit 24/24 ; headless PASS
(11 moves).

⑭ ✅ **Stades signature** *(fait — « le repo football-stadium peut être mieux ? Camp Nou / Wembley /
Parc des Princes ? »)* — verdict repo : NON (proof-of-concept 1 commit « où est mon siège », sans
licence → inutilisable ; notre générateur paramétrique + contrat est plusieurs crans au-dessus).
**Presets landmark** dans generateStadium({landmark}) : 'grandbol' (bol asymétrique géant, 4 VIRAGES
pleins — surfaces gradins en quart d'arc + sièges instanciés face au centre, capacité créditée →
18 669 places), 'arche' (tube meshkit balayé en parabole ENJAMBANT tout le bol au-dessus du toit —
contrat : l'apex dégage le toit, la portée couvre le terrain), 'nervures' (~36 nervures béton — UN
profil sweep meshkit instancié par yaw — sur l'ellipse englobante, penchées sur l'enceinte — contrat :
assez de nervures pour lire la signature, aucune sur la pelouse). Signatures DÉRIVÉES de l'empreinte
réelle (jamais de coordonnées en dur). Harnais stade 14/14 (3 presets + déterminisme + capacité +
2 sabotages « arche écrasée », « nervure sur la pelouse ») ; galerie Stades passée à 5 enceintes
(rapport : T1 855 · T5 13 536 · Grand Bol 18 669 · Arche 13 092 · Nervures 6 546). Réf 29 enrichie.

⑮ ✅ **Workflow de sculpture par étapes** *(fait — « vinhhien112/Object-Sculptor : est-ce qu'on est à
ce niveau ? »)* — évaluation : repo SÉRIEUX (1,1k ⭐, MIT, image → three.js procédural avec passes
blockout→form→lookdev et acceptation par vision IA). Notre vocabulaire d'opérateurs est identique
(meshkit : lathe/sweep/loft/extrusion) et nos GARDES sont plus fortes (contrat manifold + volume EN
PLUS du jugement visuel) — mais eux avaient formalisé la DISCIPLINE des passes. Adoptée (réf 43) et
prouvée en sculptant une CHAUSSURE DE FOOT en live au playmode : blockout v1 rejeté à la porte
(silhouette aileron de requin → proportions corrigées AVANT tout détail), passes forme+lookdev — les
11 crampons nés retournés attrapés d'un coup par checkMesh (profil de lathe descendant), la rangée de
crampons débordant de la semelle attrapée par la porte lookdev (l'œil attrape ce que le contrat ne
voit pas, et réciproquement). Résultat : 19 pièces, 0 échec de contrat ; figé en spec `--demo
crampon` de meshkit-export (GLB 20 ko standard). Reste d'eux à prendre (backlog) : la reconstruction
PILOTÉE PAR IMAGE de référence (épingler une photo et comparer côte à côte à chaque porte — la
mécanique existe déjà chez nous, il manque l'habitude).

⑯ ✅ **Shanon devient le joueur + manteau long** *(fait — « fais-lui des vêtements longs par-dessus
sa tenue, et remplace Soldier par lui »)* — le GLB uploadé (rig Mixamo `mixamorig5`, quantifié
glTF-Transform) remplace le Soldier comme directeur sportif ; le Soldier reste à bord comme DONNEUR
de clips (idle/walk/run + TPose) et rig des NPC/extras. Trois briques natives : **`rig-retarget.js`**
(transport bind-à-bind par delta MONDE racine-relatif — la copie naïve des quats locaux froisse le
perso en boule, prouvé ; tracks position jetées sauf hanches (les proportions source fuient), track
hanches convertie en unités destination ; contrat `checkRetarget` + invariants harnais identité ET
cross-rig < 0,01°) ; **`dequantizeSkinned`** (les attributs normalisés int16/uint16 explosent le
skinning GPU — poids ×65535, voiles à l'écran ; dénormalisés en float32, skinIndex reste ENTIER) ;
**`outfit.js`** (manteau long meshkit skinné : loft monde au bind, carrure à hauteur d'épaule,
manches jusqu'aux poignets, jupe à poids ADAPTATIFS hanches→jambes — le genou perçait l'ourlet en
pleine foulée ; Skeleton neuf aux inverses du jour + bindMode attached DANS le wrapper → la
conduite cache le manteau avec le joueur ; contrat `checkOutfit` : ourlet SOUS le genou, littéral).
Piège d'orientation : Shanon regarde +Z, le Soldier −Z → wrapper avec l'intérieur tourné de π, tout
le pipeline (forwardLocal −Z, root motion animkit) reste cohérent. Gestes : compilés ABSOLUS sur le
donneur (`toClip {additive:false}`), retargetés, PUIS makeClipAdditive (un clip additif ne se
transporte pas). Harnais verify-retarget 13/13, verify-outfit 14/14, suite headless sections 1–21
PASS (nouvelle garde anti-explosion : tout vertex skinné CPU ≤ 2 m des hanches en course). Réf 44.
Leçon playmode : ajouter/retirer des SkinnedMesh en live corrompt le skinning du renderer pour les
AUTRES modèles (fausses « explosions ») — page vierge = vérité ; caméra libre : frames:0 obligatoire.

⑯bis ✅ **Garde-robe : jean + sweat** *(fait — « un jean avec un sweat c'est pas possible ? »)* —
`buildJeansSweat` dans outfit.js : sweat ample à ourlet aux hanches + capuche BAISSÉE dans le dos
(sphère meshkit posée derrière la nuque, direction dos DÉRIVÉE du rig : forward = axe-des-épaules ×
up) + jean droit (empiècement bassin + un tube par jambe jusqu'aux chevilles). Contrats à la lettre
du vêtement : « un sweat s'arrête aux hanches » (sabotage sweat-robe), « un jean atteint la
cheville » (sabotage jean-coupé-au-genou) — `checkCasual` sur `skinIssues` partagé avec le manteau.
Sélection par URL `?tenue=casual|manteau` (casual défaut) : les tenues sont des DONNÉES. Leçons de
couture : un vêtement de couche DOIT être plus large que ce qu'il couvre (le short blanc perçait le
premier empiècement — vu au screenshot) ; laisser dépasser les sous-couches aux coutures (poignets
blancs du maillot sous les manches du sweat = vraie superposition). verify-outfit 28/28, headless
1–21 PASS (section 21 passée en casual).

⑯ter ✅ **Sur-mesure anti-Michelin** *(fait — « c'est le bonhomme Michelin là, tu peux faire
mieux »)* — les rayons devinés gonflaient le perso. Désormais chaque anneau de vêtement est AJUSTÉ
AU CORPS MESURÉ : `bodyCloud` échantillonne les vertex skinnés du perso au bind (`skeleton.update()`
forcé — aucun rendu n'a encore eu lieu), `fitRing` prend par SECTEUR ANGULAIRE l'extension radiale
max du corps dans une tranche autour de la station + une aisance de 1-3 cm (secteurs vides empruntés
aux voisins ; rig sans peau → repli analytique, les harnais à os nus passent toujours). Preuve
harnais : corps-cylindre r=0,09 → rayon poitrine du sweat 0,126 (avant : ~0,28, le ballon). Leçons
en réf 44 : l'aisance doit dépasser l'ÉCART DE DÉFORMATION (corps = poids d'auteur, vêtement =
poids de proximité) ; au pli extrême (hanche en pleine foulée) aucune aisance raisonnable ne suffit
— la solution est dans les POIDS (ourlet/empiècement prennent une part de la cuisse la plus proche
et balaient avec la jambe) ; exclure la peau étrangère d'une tranche (bras hors des anneaux du
torse, l'AUTRE jambe hors du jean) ; anneaux ajustés et analytiques partagent la base/phase de
ring() pour se mélanger dans un même loft. verify-outfit 30/30, headless 1–21 PASS.

⑯quater ✅ **Tissus procéduraux** *(fait — « les textures c'est abusé c'est nul »)* — les aplats de
couleur faisaient plastique. `engine/fabric.js` : matériaux TISSU calculés dans le shader (TSL),
zéro fichier texture — motif dérivé de `attribute('position')` (espace de bind, pré-skinning : le
motif est COLLÉ au tissu, il ne nage pas à travers pendant l'animation). Genres : denim (délavage +
soupçon de sergé), tricot chiné, laine. Deux règles gagnées à la sonde : (1) moduler la teinte en
MULTIPLICATIF (`color(tint).mul(1+bruit)`) — le mélange entre bornes éclaircies/assombries se fait
en espace linéaire où +0.07 sur un canal sombre le DOUBLE (jean bleu → poudre ; prouvé par un rendu
A/B deux sphères) ; (2) fréquences BASSES — le procédural n'a pas de mips, les hautes fréquences
rendent en moiré cotte de mailles (premier gros plan). Bonus : matités du perso lui-même (les maps
metal/rough issues de la conversion « Glossiness » de Mixamo rendent brillant plastique → retirées,
roughness 0.88, normal map conservée). verify-outfit 31/31, headless 1–21 PASS.

⑯quinquies ✅ **Upgrade AAA de la tenue** *(fait — « c'est pas du AAA ça »)* — les tubes lisses
bruités restaient des tubes. La tenue casual passe de 7 à 11 pièces : bord-côte taille + poignets
(anneau serré sous un plus large), capuche ROULÉE (tube balayé sur un arc court rentré derrière la
nuque — une sphère aplatie faisait sac à dos, un arc trop large faisait des pics sur les épaules),
cordons, poche kangourou + 2 poches arrière (slabs extrudePoly `orient()`és sur la surface du
corps), pli au genou. SEG 14→24 (silhouette lisse). `denimSeamMaterial` : coutures denim par
math d'angle `cos(θ−θ₀)` (creux d'ombre + arête felled, MULTIPLICATIF seulement). Leçons chèrement
payées : (1) `x.smoothstep(a,b)` en TSL = `smoothstep(x,a,b)` (x devient edge0) → jambe entièrement
DORÉE ; math `clamp` explicite à la place ; (2) un `mix()` de surpiqûre vers un fil clair est
fragile (la moindre fuite de masque inonde le vêtement) → coutures en ombres/arêtes multiplicatives
uniquement ; (3) déboguer un shader = sortir le masque en gris (`vec3(mask)`) sur UNE pièce et le
lire au play-mode — le dégradé a tranché ce qu'aucun raisonnement statique n'avait résolu ; (4)
chevauchement d'emmanchure PETIT (un cap de manche profond gonfle en épaulette), ourlets en ellipses
propres depuis la moyenne ajustée (un ourlet ajusté par secteur sort en dents de scie).
verify-outfit 47/47, headless 1–21 PASS.

⑯septies ✅ **Revue critique des défauts** *(fait — « tu vois encore des défauts ? »)* — revue
honnête sous plusieurs angles : (1) la « bosse d'épaule » = le MAILLOT de foot de Shanon
(`Ch38_Shirt`) qui transperçait à l'emmanchure — identifié par RAYCAST du pixel du défaut, pas
deviné ; la tenue remplace le kit → masquer Shirt/Shorts/Socks ; du coup la manche peut chevaucher
profond et fermer le trou d'emmanchure (l'ancien « cap ball » était aussi le maillot) ; (2) ourlet
en dents de scie = ceinture jean qui montait au nombril → abaissée à la hanche + sweat qui drape
par-dessus ; (3) col béant → col rond ajusté qui épouse la nuque ; (4) poche kangourou enfoncée →
frontD dégage la surface avant du sweat ; (5) capuche pastille → poche de capuchon effilée (scaleFn
fond les bouts dans les épaules). Leçon : quand une couche montre bosse/trou, RAYCAST d'abord pour
vérifier que ce n'est pas la sous-couche.

⑯sexies-bis ✅ **Réalisme tissu : relief + patine** *(fait — « améliore encore pour ressembler à de
vrais vêtements »)* — `bumpMap(height, force)` : normal map procédurale (plis fractals + armure :
sergé denim, mailles tricot) → la lumière accroche plis et fils ; le MÊME champ de hauteur signé
ombre la couleur en multiplicatif (reliefs délavés, creux sombres) → jean « usé/délavé ». Écarté :
la surpiqûre contrastée en SHADER inonde la jambe en doré (le masque `line()` fin en multiplicatif
rend LARGE en `mix`, et se compose entre coutures) → surpiqûre à faire en GÉOMÉTRIE. Bisection par
`?flag` URL, un terme shader à la fois. verify-outfit 47/47, headless 1–21 PASS.

⑰ ✅ **Football qui sonne juste : ballon + dribble** *(fait — « physique de balle mauvaise, dribbles
mauvais, comment atteindre du AAA ? »)* — diagnostic d'abord : il n'y avait PAS de physique de
balle. Dans SoldierVolley la trajectoire est une parabole écrite à la main (`arc()`) et le dribble
c'est `ballon = joueur + direction × 0.85` (ballon SOUDÉ au joueur) ; côté moteur `physics.js`
crée une sphère Rapier nue (ni traînée, ni Magnus, ni spin). Deux modules natifs dep-free :
**`engine/ball.js`** — masse/rayon FIFA, traînée (≈9,5 m/s² à 30 m/s, comparable à la gravité),
CRISE DE TRAÎNÉE (Cd 0,47→0,17 vers 13 m/s), **effet MAGNUS** (Cl = 1/(2+v/ωr) — sans lui rien ne
courbe jamais), décroissance du spin, rebond avec COUPLAGE spin↔vitesse (le rétro freine Δvₓ=−5,0
m/s et revient, le lifté file), roulement, sous-pas anti-tunneling ; contrat `checkBallFlight`
(énergie qui ne croît jamais, pas de téléport, pas sous la pelouse). **`engine/dribble.js`** — le
dribble est une suite de TOUCHES : le pied pousse, le ballon est LIBRE entre deux touches, le
joueur le rattrape ; `dribbleSteer` (un dribbleur court APRÈS son ballon), `pushSpeed` dérivée de
la décélération réelle, touches raccourcies + anticipées en virage ; contrat `checkDribble` écrit
contre les DÉFAUTS (distance constante = « ballon COLLÉ », ballon qui fuit, qui traîne, pied qui
mitraille). Erreurs payées : (1) traînée de l'air OUBLIÉE au roulement → une passe à 15 m/s roulait
153 m (39 m avec) ; (2) déclencheur de touche sur la distance parcourue → en virage le ballon
s'échappait à 26 m, faute de pouvoir être retouché → déclencher sur la PORTÉE DU PIED ; (3)
anticipation du virage 13× trop faible (une fraction de foulée au lieu de la vraie durée entre
touches) → ballon à l'extérieur de chaque courbe ; (4) un test qui mesurait la fin du vol
confondait Magnus et rebond — isoler le contact. verify-ball 27/27, verify-dribble 14/14. Réf 45
(avec la suite : modèle de frappe, limites d'accélération/rayon de braquage, gardien, IA 11v11
anti-« essaim », et l'ordre des chantiers graphiques).

⑱ 💬 **Trois questions de fond** *(répondues en conversation, matière des réfs 45–46)* — (a) « qu'est-ce
qui fait de Unity/Godot un moteur ? » : pas le rendu, mais la BOUCLE (scene graph + sérialisation de
scène-comme-donnée, ECS/composants, physique, anim graph, audio, input, asset pipeline, build,
éditeur). Three.js couvre le rendu et rien d'autre — ce skill construit le reste par modules natifs
+ contrats. (b) « niveau moteur graphique en WebGPU » : la marche suivante est la chaîne de passes
(GTAO/SSGI/SSR/TRAA/TAAU + tonemap AgX), pas des shaders isolés — d'où `render-pipeline.js`. (c)
« ballon sous la semelle, dribbles chaloupés, jongles pied-genou-tête, amorti poitrine + volée » :
tout ça est le MÊME objet — un modèle de contact (point de contact, impulsion, spin transmis) plus
des cibles d'animation résolues par IK sur la position PRÉDITE du ballon, jamais l'inverse.

⑲ ✅ **Passe à dix 5 v 5 dans le Grand Bol de nuit** *(fait — « ta plus belle scène, les bons pieds, les
déplacements sans ballon pour conserver ET pour récupérer »)* — l'architecture qui fait tenir le
truc : **le jeu se décide en headless, la scène ne fait que l'habiller**. `rondo-sim` joue le match
sans renderer (contrat 20/20 : forme d'équipe, pas d'essaim, passes enchaînées, bon pied, couloirs
dégagés) et `scenes/Rondo.js` prend ses positions comme vérité unique, en pilotant les
`CharacterController` *pour qu'ils la suivent* (`setMoveWorld` → état de locomotion, cadence,
foot-lock — puis snap sur la position prouvée). Laisser les contrôleurs intégrer leur propre
mouvement, c'est faire tourner deux simulations qui divergent : l'IA testée n'est plus celle livrée.
Cinq modules natifs : **`ball-predict.js`** (prédiction + BALISTIQUE INVERSE — deux régimes : au sol
on bissecte sur la VITESSE D'ARRIVÉE, en l'air sur la DISTANCE D'ATTERRISSAGE ; `laneClearance`,
`interceptPoint`), **`rondo.js`** (des MÉTIERS, pas des pulsions : carry/support/press/cover/mark/
intercept — personne ne court au ballon), **`rondo-sim.js`**, **`stadium-night.js`** (une seule
directionnelle porteuse d'ombre — frustum ajusté au TERRAIN, 108 m, pas au bol — + 4 bancs sans
ombre ; godrays n'accepte que Directional/Point), **`render-pipeline.js`** (tiers low/high/ultra).
`mirrorMove(spec)` donne le jumeau gaucher exact de chaque frappe (noms d'os échangés, Y et Z niés —
X est l'axe de flexion, commun aux deux côtés) : le porteur frappe du pied le plus proche.
Erreurs payées : (1) toute l'équipe agglutinée sur 0,6 m — `supportSpot` tenait des OBJETS joueur là
où il fallait des positions, chaque distance valait `NaN`, et comme `NaN > NaN` est faux le « meilleur
candidat » n'était jamais mis à jour : tous gardaient le PREMIER. Aucune erreur, aucun warning. Fix :
un `.map(p => p.p)` + un `throw` sur score non fini ; (2) le passeur interceptait sa PROPRE passe
0,02 s après la frappe (le ballon est encore à ses pieds) → 235 pertes pour 1 passe ; (3) un
coéquipier qui reprend le ballon était compté comme une perte ; (4) secteurs distribués par numéro de
maillot → tout le monde traversait le milieu, c'est-à-dire là où est le ballon → distribuer par ANGLE
COURANT ; (5) l'essaim mesuré en PIC de défenseurs ne distingue pas un essaim d'une convergence
normale à la réception → le mesurer en TEMPS (essaim saboté : 100 % ; ce jeu : 5,9 %). Leçon générale :
quand une métrique échoue, se demander d'abord si c'est la MÉTRIQUE qui est fausse — deux des cinq
« échecs » étaient le harnais qui mesurait mal, et régler les poids contre eux aurait dégradé le jeu.
Mesuré aussi : ancrer la défense sur le receveur pendant le vol (plus réaliste !) fait TOMBER la
possession de 7 passes à 4 → reverté, la mesure laissée en commentaire. verify-ball-predict 22/22,
(6) le « match en nocturne » se rendait EN PLEIN JOUR alors que tous les contrats étaient verts : le
boot du moteur (`Lighting.js`) ajoute un soleil ANALYTIQUE (DirectionalLight 0xfff2e0 à 2,4) dans la
scène, et échanger `background`/`environment` ne fait rien à une lumière analytique ; surtout, le
contrat de nuit ne parcourait que SON PROPRE groupe, donc la lumière qui écrasait tout le rig était
hors de son champ de vision. Un module qui prétend posséder l'éclairage doit posséder celui de la
SCÈNE : éteindre tout ce qu'il n'a pas ajouté (et le rendre au `dispose`), et surtout ASSERTER SUR LA
SCÈNE, pas sur le groupe. Un contrat vert sur un périmètre trop étroit est pire que pas de contrat :
il achète de la fausse confiance. Et le correctif ne suffisait toujours pas : jour éteint, la CLÉ de
nuit était elle-même à 2,0 face à un soleil de jour à 2,4 → luminance moyenne mesurée 0,433, quand
une image de match en nocturne se tient vers 0,15. **La nuit n'est pas la couleur du ciel, c'est le
RAPPORT entre la clé et le reste** (stade éclairé ≈ 1 500 lux, plein jour ≈ 100 000). Le contrat
assère désormais le budget lui-même (clé ≤ 1,4, `environmentIntensity` ≤ 0,3, ambiance ≤ 35 % de la
clé, et éclairement des mâts `I/d²` au point visé ≥ la clé) : « ça fait jour » cesse d'être une
affaire de goût pour devenir un nombre sur lequel un harnais peut échouer. Balayage mesuré sur UNE
image, seul l'éclairage changeant (`scripts/frame-stats.mjs`, lecteur PNG dep-free) : livré 0,433 →
jour éteint 0,306 → budget de nuit 0,269 (contraste 0,375, noir 4,7 %) → mâts dominants 0,295
(contraste 0,424, noir 5,6 %). Ce qui CORRIGE l'hypothèse derrière la métrique : la luminance moyenne
seule est le mauvais critère. Déplacer la lumière de la clé vers les mâts FAIT MONTER la moyenne (la
pelouse occupe l'image et s'éclaircit) alors que l'image devient plus nocturne sur tous les autres
axes — noirs plus noirs, plus de contraste. Une nuit sous projecteurs, c'est une pelouse claire dans
un bol sombre : ça vit dans la FORME de l'histogramme, pas dans sa moyenne. On juge sur p05 et
contraste, la moyenne ne sert qu'à attraper l'échec grossier (un après-midi à 0,43). Et l'équilibre
n'était pas le dernier mot : aucune de ces lignes ne rend le BOL sombre, elles ne font que déplacer la
lumière entre la clé et les mâts. Une DirectionalLight n'a AUCUNE atténuation : une clé assez forte
pour tailler une ombre nette sur la pelouse éclaire la tribune du fond au même éclairement, et un bol
aussi clair que la pelouse est une image de jour quelle que soit la couleur du ciel. Les vrais
projecteurs visent LE TERRAIN, le reste vit de débordement. Masquer la clé sur son propre CALQUE et
n'y inscrire que la surface de jeu et ce qui s'y tient, c'est cette vérité physique exprimée dans le
seul mécanisme que three nous donne — et `light.layers` EST honoré sur le chemin WebGPU (mesuré, pas
supposé) : 0,269 → 0,183 de moyenne, p05 0,021 → 0,000, noir 4,7 % → 13 %. L'alternative (baisser
l'albédo du bol ×0,35) atteint une moyenne voisine mais aplatit l'ombrage propre des tribunes
(contraste 0,261 contre 0,321) : les sièges grisent ensemble au lieu de décrocher avec la lumière.
Le masque est celui qui est VRAI, c'est donc lui qui part. Son mode de panne est une PELOUSE NOIRE
(masquer et oublier d'inscrire l'herbe), d'où un contrat qui vérifie l'aller ET le retour, et un repli
« pas de masquage » quand aucune surface nommée n'existe. Image livrée, mesurée : moyenne 0,168–0,191,
p05 0,000, contraste 0,312–0,335, 10–20 % de noir — une pelouse claire dans un bol sombre, c'est-à-dire
enfin ce que les mots promettaient trois commits plus tôt. verify-ball-predict 22/22,
verify-rondo 20/20, verify-matchday 72/72 (maillot sur le rig + rig de nuit sur le vrai stade + contrat
de la chaîne post), animkit 30/30. Réf 46. Au passage : `stadium-night.js` n'a plus AUCUNE dépendance
au DOM (ciel en `DataTexture`, IBL sautée sans renderer) — c'est ce qui permet de vérifier le contrat
sur les VRAIES lumières plutôt que sur une réplique écrite à la main, qui ne prouve que la réplique.

⑳ ✅ **Les vrais persos Mixamo sur le terrain** *(fait — « et avec les persos mixamo ? »)* — la scène
codait `Soldier.glb` en dur. **`engine/squad.js`** : un ROSTER de GLB Mixamo rendus interchangeables.
Quatre choses sur lesquelles deux exports réels ne sont JAMAIS d'accord, et dont aucune ne casse
bruyamment : **orientation** (bind en +Z ou −Z selon le FBX source → le modèle roule dans un wrapper
yawé pour que « devant » soit toujours −Z, plutôt que de spécialiser le contrôleur : root motion,
gestes et facing s'accordent alors gratuitement), **échelle** (mètres / centimètres / « unités
Mixamo » → normalisée à une taille cible, sinon une équipe dépasse l'autre d'une tête et `stride`,
qui est des mètres par cycle, ne veut plus rien dire), **clips** (la plupart des GLB de personnage
n'en ont aucun → un rig est DONNEUR et sa locomotion est retargetée sur les autres), **attributs**
(`KHR_mesh_quantization` → dequantize une fois, sur le template). L'ORDRE est tout le module :
retarget en pose de bind → mesurer la SOURCE une seule fois → puis cloner/échelonner/placer.
Contrat `checkSquad` : os requis, échelle, groundY, clips de locomotion, retarget — et surtout
l'ORIENTATION MESURÉE sur les épaules (`across × up`) plutôt que crue sur le drapeau `faces`, parce
que ce drapeau est la lecture humaine d'un fichier, donc le champ le plus susceptible d'être faux.
Découvertes payées : (1) `GLTFLoader` fait passer chaque nom de nœud par
`PropertyBinding.sanitizeNodeName`, qui supprime `[ ] . : /` — un os écrit « mixamorig5:Hips » dans
le glTF s'appelle « mixamorig5Hips » une fois chargé, donc un rig de test qui reprend l'orthographe
du fichier teste une convention que le moteur ne voit jamais ; (2) « bind = maintenant » encore :
construire le `Skeleton` avant `updateMatrixWorld` donne des boneInverses identité et décale la
géométrie skinnée de la position du premier os (0,93 m — un personnage qui flotte au-dessus de son
repère) ; (3) les gestes se compilent PAR RIG : les pistes visent les os par NOM et deux exports ne
partagent pas leur préfixe, donc un clip compilé sur Shanon ne se lie à rien sur le Soldier — le
joueur ne frappe simplement pas, en silence ; (4) Shanon porte déjà un maillot, mais maillot, peau et
crampons partagent UN atlas et UN matériau : recolorer le maillot par équipe teinterait sa peau. On
masque son strip (`/Shirt|Shorts|Socks/`) et `buildKit` habille le corps nu — deux équipes, deux
tenues. (5) l'idée « un corps par équipe » (Shanon vs Soldier, pour distinguer les camps avant même les
couleurs) a été construite PUIS REGARDÉE, et elle est mauvaise : le Soldier est un personnage BLINDÉ,
et `kit.js` ajuste ses anneaux au nuage de points du corps qu'on lui donne — épaulières et sac à dos
transforment le maillot en sac. Un maillot généré ne se lit comme un maillot que sur un corps de forme
humaine. Shanon joue donc les DEUX équipes, le Soldier reste donneur de clips (là son armure ne coûte
rien). `?rig=mix` remet les deux corps, `?rig=soldier` le casting d'origine.
verify-squad 22/22. Réf 44 (section « squad »).

㉑ ⚠️ **« La balle part pas vraiment du pied »** *(corrigé côté animation ; la version simulation a été
CONSTRUITE, MESURÉE, puis JETÉE)* — diagnostic : `playPass` lançait le ballon la frame même de la
décision et la scène ne déclenchait le geste qu'ensuite. Le ballon était donc parti AVANT que la jambe
ne bouge. Aucun polish d'animation ne rattrape un ballon parti trop tôt.
Tentative 1 — une vraie frappe dans la SIM (phase `strike`, armé de 0,38 s = la frame de contact de
`MOVES.passe`, ballon frappé depuis le point de contact). Construite entièrement, avec contrat
(« chaque passe précédée d'un armé », « écart ballon-pied au contact ») et sabotages. Puis mesurée :
**record 6 → 2 passes, pertes 25 → 103**. Chemins essayés et chiffrés : joueur planté pendant l'armé
(6→2), frappe en course sans garde (écart au pied 4,29 m — en plein dribble le ballon est à des mètres
devant), garde au contact (44 armés abandonnés sur 52), garde à l'ouverture (8 passes en 60 s).
Trois bugs trouvés en route, tous par la mesure : (a) **90° d'écart de convention** — `rondo.js` pose
`yaw = atan2(vz, vx)`, donc « devant » y est `[cos, sin]`, alors que le reste du projet utilise
`atan2(x, z)` ; mon point de contact était perpendiculaire au pied ; (b) `st.strike` jamais effacé au
changement de main → dribble suspendu pour le reste du match ; (c) **le porteur ne suit pas son
ballon** : `dribbleSteer` calcule la direction de poursuite et le résultat est JETÉ, le porteur court
vers son espace pendant que le ballon part ailleurs. Invisible tant que les passes s'enchaînent (les
conduites durent une touche) ; sur de longues conduites le ballon finit à 8,75 m de médiane du joueur
censé le conduire. Décision : **ne pas livrer un jeu moins bon pour gagner un détail d'animation** —
revert complet de la sim (revenue à 20/20, porteur à 0,86 m de son ballon).
Ce qui EST livré : `contact` déclaré sur les cinq moves de contact (`frappe` 0,42, `passe` 0,38,
`talonnade` 0,36, `amorti` 0,3, `retournee` 0,52), transporté dans `clip.userData` et par `mirrorMove`,
+ `playGesture(..., { from })` qui démarre un clip À SA FRAME DE CONTACT. L'événement « passe » dit que
le ballon vient de partir : démarrer le clip à 0 mettait la jambe en armé alors que le ballon roulait
déjà. On perd l'armé, on gagne ce qui compte — le pied EST sur le ballon à la frame où il part.
Contrat animkit : contact dans le clip, POSÉ SUR UNE CLÉ (pas dans une interpolation), clé non vide,
conservé au miroir. verify-animkit 51/51. Reste ouvert : la frappe avec armé demande un modèle de
conduite où le porteur suit son ballon (bug (c)) — c'est le vrai préalable, pas l'animation.

㉒ ✅ **Tenues générées retirées : les joueurs portent le maillot de Shanon** *(fait — « enlever les
tenues, juste mettre des Shanon ? »)* — le strip modélisé du personnage est un VRAI maillot (col,
manches longues, écusson, numéro 7 dans le dos, short à bandes, chaussettes côtelées, crampons) ; le
kit généré est un empilement de tubes loftés et se lit comme tel. `?kit=1` remet le kit généré (et
remasque le sien, les deux se battraient). CONSÉQUENCE ASSUMÉE ET DITE : son maillot, sa peau et ses
crampons partagent UN atlas et UN matériau, donc les dix joueurs sont identiques — plus moyen de
distinguer les deux équipes. Le correctif juste, si on le veut, n'est pas de régénérer un kit mais une
CHASUBLE : c'est ce qu'on porte à l'entraînement, et c'est une pièce de géométrie minimale par-dessus
le maillot existant, pas un maillot de plus.

㉓ ✅ **« Le ballon est loin des joueurs »** *(corrigé — et le diagnostic a démenti l'hypothèse évidente)*
— d'abord mesurer : dans la SIM, le ballon est à 1,07 m du joueur le plus proche en médiane, jamais
au-delà de 4,7 m ; et la scène rendue colle à la simulation à **12 cm près** (position modèle =
position sim au centième, centroïde du corps skinné à 4–12 cm). Donc ni la simulation ni l'habillage.
Le vrai coupable : **le carré faisait 34 × 26 m**, c'est-à-dire un terrain de foot à 5, pas un rondo
(un vrai « passe à dix » se joue dans 12–16 m). À cette taille les soutiens se tiennent à 6,5–13,5 m et
le ballon est à **5,89 m de moyenne des joueurs**. Pourquoi ça n'avait jamais été resserré : **le
contrat l'interdisait**. Deux de ses clauses étaient en mètres ABSOLUS, calibrées sur ce carré-là —
rayon d'essaim 3,5 m, écartement minimal 5 m. Rétrécis le carré et les deux hurlent, alors que quatre
défenseurs à moins de 3,5 m du ballon dans un carré de 14 m, c'est la DÉFINITION d'un rondo.
Exprimés en fractions du petit côté (0,135 et 0,19), les mêmes règles gardent leur sens à toute
échelle — et le carré redevient un paramètre libre. Mesuré, 3 graines × 60 s : 34×26 → record 12,
ballon à 5,89 m ; 22×18 → 13, 4,20 m ; **16×14 → 18, 3,44 m** ; 12×11 → 8, 2,86 m (trop serré, la
défense récupère tout). Livré en 16 × 14, caméra recadrée sur la boîte (8,5 m de haut, 19 m de recul,
30° — l'ancienne était à 38 m pour un carré deux fois plus grand, où un ballon de 22 cm fait cinq
pixels). TROISIÈME fois dans cette scène que c'est la MÉTRIQUE, pas le système, qui est fausse : un
seuil en unités absolues encode en silence l'échelle à laquelle il a été réglé, et à partir de là il ne
mesure plus la propriété, il mesure l'écart à ce réglage.
Au passage, un défaut de contrat plus grave : le même jeu passait 20/20 en node et **échouait son
propre contrat à l'écran**. La scène écrivait `since: 99` en dur dans sa trace — le champ « secondes
depuis la dernière perte de balle » dont les clauses de forme se servent pour ignorer le jeu non
installé — donc chaque frame comptait comme possession installée, y compris les secondes d'engagement
où les équipes sont encore groupées sur leur cercle de départ. Un contrat ne vaut que la trace qu'on
lui donne, et une scène qui fabrique un champ pour arranger la forme de l'appel n'est pas vérifiée du
tout. Contrat live désormais vert. verify-rondo 20/20 (record 7–23 selon la graine). Réf 46.

㉔ ✅ **Conduite d'esquive — et l'INERTIE qui la rend possible** *(fait — « un peu de conduite de balle
d'esquive pour faire moins fourmilière ? »)* — d'abord nommer le défaut par la mesure : ce n'était pas
le NOMBRE de défenseurs (moyenne 1,28 dans le rayon d'essaim, ≥3 seulement 13 % du temps) mais le fait
que le porteur était **collé à un défenseur la moitié du temps** (séparation moyenne 1,67 m, sous
1,5 m 50 % du temps) et qu'il tournait à **4,3°/s**, c'est-à-dire en ligne droite. `evadeSpot` : un
point de fuite NOTÉ (s'éloigner de TOUS les défenseurs, pas du plus proche ; ne pas se faire coincer
contre la craie ; ne pas percuter ses propres soutiens ; continuer un peu dans sa direction — ce
dernier terme est toute la différence entre une esquive et un dandinement). Résultat seul : **rien**
(1,67 → 1,64 m). Parce que l'accélération était ISOTROPE — 9,5 m/s² dans n'importe quelle direction,
donc un défenseur lancé à 6,6 m/s faisait demi-tour aussi sec qu'un joueur à l'arrêt. Aucune inertie à
battre ⇒ aucune feinte ne peut payer. Correctif : séparer l'accélération demandée en composante LE
LONG de la vitesse (relance/freinage) et PERPENDICULAIRE (virage), et plafonner la seconde à part —
le taux angulaire tombe alors tout seul à `turnAccel / vitesse` : 52°/s à 6,6 m/s, 115°/s à 3 m/s.
**Le porteur, plus lent, tourne à l'intérieur du presseur plus rapide** — le vrai avantage d'un
dribbleur, désormais dans le modèle et plus dans le commentaire. Mesuré, 3 graines × 60 s : record
10 → 32, pertes 67 → 47, défenseurs dans le rayon 1,08 → 0,69, séparation 1,64 → 2,07 m. Plus
d'inertie n'est PAS mieux (4,5 → record 15 : le porteur non plus ne peut plus tourner) ; il y a un
optimum, trouvé en mesurant. **La clause qui manquait** : toutes ces variantes passaient le contrat, y
compris celle qui fait fourmilière — les clauses d'essaim comptent COMBIEN de défenseurs sont près du
ballon, et un porteur harcelé par UN seul homme ne les déclenche jamais. Nouvelle clause : part du
temps de conduite avec un défenseur dans le rayon de tacle (50 % avant, 31 % après, 100 % au sabotage).
Le sabotage « un seul défenseur collé » déclenche la nouvelle clause pendant qu'AUCUNE clause d'essaim
ne voit quoi que ce soit — c'est exactement le trou qu'elle bouche. verify-rondo 25/25. Réf 46.

㉕ ✅ **Le CATALOGUE des actions impossibles au foot** *(fait — « le ballon doit être devant le joueur…
tu peux te mettre des contrôles sur toutes les actions du foot impossible ? c'est comme ça qu'on fera
un moteur non ? il faut être exhaustif »)* — oui, c'est comme ça. **`engine/football-rules.js`** : 18
règles GÉNÉRÉES depuis une grille relation × phase (réf 19), pas listées de mémoire — ballon↔porteur,
ballon↔monde, joueur↔joueur, événement↔événement, croisés avec conduite / frappe / vol / réception /
sortie. Chaque règle est une DONNÉE (id, portée, ce qu'elle interdit, POURQUOI, prédicat) : imprimable
et relisible par quelqu'un qui connaît le foot mais pas le code, sabotable individuellement, et
extensible sans toucher au moteur d'exécution. Premier passage sur le jeu livré, dont le contrat
propre était vert 25/25 : **six règles violées**. `ball-ahead-at-strike` **64,9 %** (relèvement
jusqu'à 180° : le ballon frappé dans le DOS), `players-not-overlapping` **28 %** (deux corps qui se
traversent), `ball-in-reach-at-strike` 16,7 % (frappé jusqu'à 2,78 m du pied), `carrier-owns-the-ball`
14,8 %, `carry-reach` 5,3 %, `not-inside-a-body` 0,8 %. Les douze autres vertes. C'est tout
l'argument du catalogue : les règles que personne n'aurait pensé à écrire sont exactement celles qui
sautaient. Quatre défauts sur six avaient UNE cause — le porteur ne courait pas sur son ballon.
Correctifs : échapper en échantillonnant autour du BALLON puis se placer 0,4 m DERRIÈRE lui (le ballon
reste entre lui et sa destination — c'est la définition de conduire) ; ne frapper qu'un ballon à
portée de pied (les deux ne marchent qu'ENSEMBLE : la garde seule étrangle le jeu, record 6/239
pertes) ; séparation des joueurs ; et le pressing attaque LE BALLON, pas le corps. Résultat :
ball-ahead 64,9 → 3,5 %, chevauchement 28 → 0,1 %, portée à zéro, et le jeu s'améliore (record 32 →
37). Modèle choisi par mesure sur cinq variantes, notées en violations cumulées : 702 / 401 / 332 /
222 / **83**. Harnais `verify-football-rules.mjs` : **un sabotage nommé par règle** + une assertion
qui interdit d'ajouter une règle sans sabotage, + la talonnade testée comme LA seule exception au
cône avant. 44/44. Les trois règles encore rouges sont un BUDGET DE DETTE borné, pas une inconnue.
Réf 47. Note honnête : le tacle qui exigerait de battre le bouclier (défenseur plus près du ballon que
le porteur) est la bonne idée football, essayée et rendue — elle rend le tacle si rare que le porteur
conduit jusqu'à sortir le ballon (record 0). Le bouclier demande un modèle de tacle fait pour lui.

㉖ ✅ **Le GESTE devient une donnée + le tacle glissé** *(fait — « un ballon qui arrive sur le pied
gauche doit être contrôlé pied gauche et passer pied gauche, ou sinon extérieur du droit… exhaustif
sur les gestes footballistiques »)* — le catalogue savait dire qu'une frappe était illégale ; il ne
savait pas dire QUEL geste la situation appelait, donc corriger une passe restait un réglage, jamais
une dérivation. **`engine/technique.js`** : 13 techniques en table (5 passes, 5 contrôles, 2
récupérations, 1 dégagement), chacune = pied (`near` = celui du côté du ballon / `far`), SURFACE
(intérieur, extérieur, cou-de-pied, semelle, talon, cuisse, poitrine, tête), fenêtres géométriques
(relèvement, distance, hauteur), ouverture du corps tolérée (`turn`), effet sur le ballon (`power`),
fiabilité, et le move animkit qui la dessine. **Ta phrase se dérive de la géométrie au lieu d'être un
cas particulier** : l'intérieur du pied GAUCHE regarde vers la DROITE du joueur, donc il joue EN
TRAVERS ; l'extérieur du gauche regarde à gauche, donc il joue VERS L'EXTÉRIEUR. Un ballon à gauche
qui doit partir à gauche ne peut donc PAS être joué de l'intérieur du gauche — et l'intérieur du pied
OPPOSÉ n'est jamais disponible, parce que ça veut dire croiser les jambes par-dessus l'appui.
`outWindow(surface, pied)` fait quatre lignes et encode tout ça. Deux mesures ont façonné la table :
(1) sans fenêtre de sortie, TOUTES les passes sortaient de l'intérieur du pied proche — le sélecteur
ne demandait que « le pied atteint-il le ballon », jamais « cette surface peut-elle l'envoyer là » ;
(2) avec les fenêtres mais sans `turn`, **67 actions sur 95** n'avaient aucune technique légale : on
n'a pas besoin de faire face au receveur, on OUVRE LES HANCHES. Avec, la distribution devient celle
d'un vrai rondo (intérieur, pivot, remise de première, talonnade, cou-de-pied).
**Le tacle glissé**, qui n'existait pas : un ballon qui traîne hors de portée debout ne pouvait pas
être attaqué du tout, le jeu attendait que quelqu'un marche dessus. `tacle-glisse` atteint 1–3,2 m et
coûte 1,2 s au sol qu'il réussisse ou non — ce coût EST la décision. Trois mesures pour le régler :
tout le monde à portée qui se couche → **182 tacles en 90 s**, possession de 18 à 4 passes ; restreint
à « tu perds la course » → encore 157, ils plongeaient sur chaque passe en vol ; restreint à un ballon
qui a DÉVIÉ (touche ratée ou ballon libre, exactement la situation que tu décrivais) → 14–37, et le
jeu tient. Move `tacle` écrit dans animkit (le seul du répertoire où le bassin quitte la verticale —
sans mouvement de hanche, un « tacle glissé » est un joueur debout qui tend la jambe). Au passage, un
trou entier : **la sortie de but n'était testée qu'en vol**, donc un ballon conduit par-dessus la
ligne restait dehors — invisible tant que le porteur ne poussait pas son ballon devant lui.
3 règles de plus au catalogue (`technique-legal`, `no-crossed-legs`, `slide-in-range`), chacune avec
son sabotage : 21 règles, 50/50 au harnais, 17 vertes en jeu réel, le reste sous budget de dette.
verify-rondo 25/25, verify-animkit 52/52, contrat live vert. Réf 47.
Reste ouvert et dit : 5 clips animkit pour 13 techniques — une passe intérieur et une passe pivot
dessinent le même mouvement. À cette distance de caméra ça se voit ; écrire un move par technique est
la passe suivante, et le catalogue ne l'attrapera pas (il juge la géométrie, pas le choix du clip).

Backlog (suite) : packs CC0 véhicules (Kenney/Quaternius) → idées stade AAA (foule instanciée, mode
nuit) → échelle « dimensions PSG » → saison simulée sous contrats statistiques → scène-comme-donnée
→ meshkit : UVs/textures, fusion des pads par pièce (draw calls) → conduite : voiture alignée à la rue
au parking, IA trafic, ghost du record au circuit → tenues : surpiqûres en GÉOMÉTRIE (fil relief),
capuche relevable, tenue match vs ville, manteau/tenues NPC, sélecteur en jeu (appli « Dressing »),
manteau repris en sur-mesure fitRing + pièces (col, revers), normal map procédurale du tricot.
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

6. ✅ **Rondo 5v5 — troisième passe : deux couleurs, ballon au pied, forme du bloc** *(fait)*
   - **Chasuble** (`engine/bib.js` + `verify-bib.mjs`, 16/16) : le perso partage UN atlas entre maillot,
     peau et crampons, donc on ne peut pas le recolorer par équipe. Une chasuble loftée sur 4 anneaux
     dimensionnés sur le RIG, skinnée sur le buste (`bind = maintenant`, bindMatrix identité). Clause
     décisive : **volume signé positif** — un `+sin` au lieu d'un `−sin` retourne toute la maille et ça
     ne se voit presque pas de face. Sabotage dédié.
   - **Le ballon s'arrêtait loin du pied** : `receiveRadius` 1,25 → 0,85 m (1,25 était au-delà de la
     fenêtre la plus large de la table des techniques : la touche partait alors que le ballon était
     encore hors de portée). Un contrôle **amène** désormais le ballon au pied, et la touche est
     **directionnelle**, à l'opposé du pressing, le corps tournant avec. Mesuré : le ballon se pose à
     **0,36 m** (moyenne = p95 = max — c'est déterministe). Deux règles neuves : `control-at-foot`,
     `control-in-reach`.
   - **8 animations manquantes** (`animkit`) : passeExterieur, passePivot, deviation, controleInterieur,
     controleExterieur, controleSemelle, amortiCuisse, tacleDebout — chacune avec sa frame de contact.
     Piège : `mirrorMove` double l'amplitude d'un bras qui croise l'axe (RightArm à 14 rad/s sur le
     passeExterieur miroité) → clé intermédiaire. verify-animkit 60/60.
   - **La fourmilière** : le bloc en possession n'occupait que **15,8 %** du carré, avec la clause
     d'écartement verte — un anneau et une file indienne ont le même écartement moyen. Clause 9 de
     `checkRondo` = **aire de l'enveloppe convexe**, sabotage « file indienne ». Cause réelle : le centre
     de l'anneau de soutien, échantillonné sur le ballon (la garde de bord rejetait la moitié éloignée).
     `stationBias 0.45` → **20,2 %**, et bat l'ancien modèle sur tous les axes. **L'hystérésis, elle,
     était une fausse piste** : toute valeur non nulle de `commitMargin` dégrade — gardé à 0 et documenté.
   - **Le porteur regarde son ballon** (il se place derrière lui, donc sa vitesse ne dit pas son corps).
     Deux consommateurs de `yaw` lisaient « inertie » : `evadeKeep` (boucle de rétroaction → porteur
     imprenable, 63 passes / 0 récupération) et le `heading` du dribble (le ballon distançait le joueur).
     Les deux lisent maintenant la vitesse.
   - **Une phase qui mentait** : un tacle glissé gagné faisait du tacleur le porteur alors qu'il restait
     1,2 s au sol → `carry-reach` 5,6 %. Un ballon dégagé au sol est **libre**. Retombé à 1,2 %.
   - **Le geste conditionne la frappe** : `chooseTechnique` était appelé APRÈS le kick, pour étiqueter.
     Quand la table ne renvoyait rien, la passe partait quand même — c'est tout `ball-ahead-at-strike`.
     Désormais : pas de technique, pas de passe. (Et `situation()` lisait `st.ball.v` après le kick.)
   - **23 règles, 56 assertions vertes.** Le catalogue a attrapé une régression que j'avais moi-même
     introduite en écartant le bloc (5,3 % → 12,9 %). Suite complète verte, ALL-SYNC. Voir `reference/47`.

7. ✅ **Rondo 5v5 — le geste a un début et une fin** *(fait)* — `engine/gesture.js` + `verify-gesture.mjs`
   (28/28) + `reference/48`. Retour utilisateur : « la façon du joueur de se retourner, c'est réaliste ?
   et ensuite sa passe ? ça se voit même pas le mouvement / les mouvements ne s'arrêtent pas quand le
   ballon part ». Trois reproches, une cause **architecturale** : la simulation frappait le ballon PUIS
   demandait une pose, donc le clip démarrait à sa frame de contact et tout l'armé était supprimé — on
   regardait la seconde moitié d'un geste. Et le retournement était un `p.yaw = atan2(...)` : 180° en
   zéro seconde, aucun intervalle à animer.
   - **Inversion** : `anticipation → contact → accompagnement`. L'acteur s'ENGAGE, le ballon part au
     contact du clip, le geste va à son terme ou est interrompu **avec une cause nommée**. Timings lus
     dans `animkit`, jamais ré-écrits.
   - **Le retournement est une vraie rotation bornée** (`yawWant` + `turnRateMin`), plus jamais un snap.
   - Quatre corrections mesurées pour que ce soit jouable (référence 8 graines × 60 s : record 11,1 /
     22,0 récup) : armé **taillé dans** le temps déjà disponible et non ajouté ; anticipation **du geste
     choisi** (0,38 s pour `passe`, 0,52 pour `passePivot` — un forfait se trompait du simple au double) ;
     tacle pendant l'armé = **contre** (il faut atteindre le ballon) ; ballon qui **voyage avec lui**.
     Résultat 8,4 / 27,9 — l'écart restant est le prix assumé d'un geste engagé de 0,4 s.
   - **Deux fausses pistes gardées** : « sous pression joue le plus rapide » → 19 passes sur 32 en une
     touche et 9 talonnades à 175° (la vitesse départage désormais des gestes déjà bons) ; verrouiller
     le regard sans verrouiller les appuis → il contournait son propre ballon.
   - **Bug de règle révélé** : `ball-ahead-at-strike` exemptait la talonnade via `e.style`, champ qui
     porte `ground`/`lofted` — exemption morte depuis le premier jour, **chaque talonnade comptait comme
     illégale**, et le test du harnais était écrit avec `style: 'talonnade'` donc passait. Le geste, c'est
     `tech`. 41 % → 7,2 %.
   - Suite complète verte (56/56 règles, 26/26 rondo, 28/28 gestes), ALL-SYNC.
   - **Reste** : l'amplitude des poses `animkit` — les moves sont lisibles mais discrets. Travail
     d'auteur sur les clés, que le catalogue n'attrapera pas (il juge la géométrie, pas la beauté).

8. ✅ **Animation — l'horloge de foulée et le corps accordé** *(fait)* — `engine/gait.js` +
   `verify-gait.mjs` (23/23) + `reference/49`. Recherche 5 axes + 3 réfuteurs (qui ont RELU les papiers
   et corrigé Dorn 2012 et Pontzer 2009 cités de travers). Cause n°1 mesurée : chaque clip avançait à
   SA cadence (`v/strideᵢ`) — dérive 1,044 cycle/s à 3,7 m/s, pieds en opposition 10× en 10 s, et le
   mélange moyennait un pied planté avec un pied en vol. Désormais : UN φ, clips esclaves, idle libre
   (asservi = statue), offsets mesurés sur le rig (φ=0 = contact gauche), cadence de la table de Dorn
   (f·S=v), vitesse VRAIE lue sur le delta de position (le rondo écrase la position après ctrl.update —
   dist mentait). Couche corps pure (φ,v) : bassin/colonne en contre-rotation ψ=149°→94° (Pontzer,
   contrôle), bras antiphase, coudes, tête stabilisée ≤6°, rebond ×2/cycle. La veille : BASE_POSE
   asymétrique corrigée (mains +0,41/−0,47 → 0,000) et mirrorMove PROUVÉ exact (la « correction »
   proposée se trompait de 1,37 — c'est devenu le sabotage). Résultats négatifs écrits : motion
   matching (500–900 clips requis), text-to-motion ; 100STYLE CC-BY noté pour la course arrière.
   Reste (ordre validé) : approach (parité du pied), warp/gesture-warp, pose-warp, foot-plant,
   inertialize (x(h)/x(0)=0,597, pas 0,5), lean.

9. ✅ **Animation — les gestes réécrits contre la biomécanique** *(fait)* — animkit refondu +
   `checkStrike` + verify-animkit 79/79. Mesures : 9 os sur 22 jamais animés, bassin à 0° sur toutes
   les frappes, séquence proximo-distale NULLE (cuisse et tibia sur la même clé), et le contrat
   lui-même interdisait une frappe réaliste (plafond 14 rad/s contre 19,8–28 mesurés au genou d'élite
   → plafond par chaîne : jambes 30, reste 14). Chaque frappe : bassin tôt puis figé (≤2° appui→contact),
   buste −14° puis rotation 22°, tête sur le ballon (quiet eye), bras OPPOSÉ en équilibre (piège du
   bras homolatéral soudé en sabotage), jambe d'appui 26°→14°, genou à 15 rad/s. Trois régimes
   (frappe/pivot/pichenette), talonnade = exception littérale (bassin carré, tête HAUTE : la tromperie
   est le geste, clauses propres). Piège de format : os absent d'une clé = pose de base, pas
   interpolation (19 rad/s attrapés au premier essai). Vérifié à l'écran : bras d'équilibre, tête
   baissée, poids sur l'appui.

10. ✅ **Animation — la leçon de la silhouette** *(fait)* — l'utilisateur a vu sur capture un bras
   tendu à la verticale pour une passe de 8 m pendant que TOUS les contrats étaient verts. Trois causes :
   axes authorés à l'aveugle (sur ce rig le coude en −x MONTE la main de 0,15 m ; la flexion visuelle
   du coude est Z), clause-ombre (checkStrike mesurait des degrés, jamais où finit la main), et TROIS
   sources de bras empilées (course + geste additif + gaitLayer). Corrigé : balayage FK des axes avant
   d'écrire des angles, clause de SILHOUETTE (FK du vrai GLB : aucune main au-dessus du cou, sabotage =
   la version livrée, +22 cm) qui a attrapé DEUX gestes de plus (amortiCuisse +14 cm, tacleDebout
   +7 cm), et `gestureHold` (pendant un geste, le haut du corps appartient au geste). verify-animkit
   92/92. Règle ajoutée à la discipline : une clause d'animation qui ne regarde pas le résultat monde
   composé mesure une ombre.

11. ✅ **Animation on-ball — le régime de composition** *(fait)* — « on-ball aucun membre n'est
   cohérent » : exact, et la cause était le RÉGIME, pas les poses. Trois compositions vues à l'écran :
   (a) delta additif sur jambes de course = jambe de marche + delta de frappe, la chimère ; (b) clip
   ABSOLU plein-corps + locomotion à zéro = personnage plié en deux (les quats absolus d'animkit
   supposent un repos T-pose que le rig RETARGETÉ n'a pas — la règle « un clip ne se transporte pas de
   bind en bind » vaut dans les deux sens) ; (c) retenue : delta additif sur IDLE FORCÉ (vitesse
   d'anim lissée vers 0 pendant le geste, ~80 ms) — l'idle est un clip retargeté donc juste pour ce
   rig, quasi immobile, la somme est la pose authorée transportée par delta, et des jambes plantées
   sont la vérité biomécanique d'une frappe. + `toClip cover` (22 os) documenté pour les rigs
   nativement animkit, + footLock coupé pendant le geste. Vérifié sur séquence : armé, contact,
   accompagnement — chaque membre appartient à la même action.

12. **L'approche, et la fournée qui a écrit la charte (fournée « attaque »).** approach.js : STANCES
   par clip (appui à 27-37 cm du ballon → corps à ~0,55 m), anchorFor/stanceOf (aller-retour exact ;
   bug de signe du côté attrapé à la mesure — écart uniforme de 76°), glide (smoothstep borné), et
   planStrike : la technique se choisit par ATTEIGNABILITÉ des stances, plus jamais sur la géométrie
   transitoire (l'oscillateur : contourner son ballon ⇒ « ballon derrière » ⇒ talonnade ⇒ l'ancre
   saute — pertes 67 → 192). La fournée a cassé le jeu quatre fois et chaque effondrement a produit
   une LOI (reference/50) : refus nommés qui pilotent (st.deny + anchorHint — sans cap : p50 1,07 m
   de l'ancre jusqu'au tacle) ; intention qui colle (décider→préparer→s'engager) ; l'assise
   (escort→0) contre le tapis roulant (l'ancre soudée au ballon fuyait à la vitesse de la marche) ;
   UNE autorité par corps/phase (double intégration glide+movePlayers = oscillateur 15,7 m/s contre
   le mur ; touche d'évasion sur une livraison arrivée = control-at-foot 33 %) ; projections du monde
   en DERNIER (séparation défaite par le glissement) ; courses-pas-photos (flightRace sur le vrai vol
   — passes interceptées à 2,59 m de marge médiane, jusqu'à 7 m ; liberté du receveur PROJETÉE à
   l'arrivée — la possession médiane mourait 0,76 s après la réception) ; un instant un contrat
   (exemption une-touche bornée ≤ 40 %, strike-stance juge le contact) ; budgets statistiques (p95
   binomial, chantier nommé). Résultat : stance p90 = 2 mm / 0,4° (avant : 1,00 m), record 8,8
   (référence 8,4), +48 % de passes, 4 harnais verts (approach 21, rules 60, rondo 27, gesture 28).
   L'audit composé (audit.mjs) : corps 0,58 m ✓ appui 0,30 m ✓ — le défaut restant est dans le CLIP
   (passage avant du pied ~0,3 s après la frame contact déclarée, à 0,97 m du point de frappe) :
   chantier suivant = re-calage du swing + warp du pied. Résultats négatifs consignés : A/B de
   parties entières (chaotique), duel en poursuite (la borne ne mord jamais), défense d'oracles
   (1 passe/partie), « ballon posé » comme condition de l'assise qui le pose.

13. **La passe d'audit refaite (« tout est encore incorrect ») — et le patin à glace.** L'utilisateur
   avait raison : l'instrument durci (audit 60 Hz, approche incluse, métriques par membre) a montré
   que seul le CORPS était juste (Hips↔sim ≤ 0,08 m). Le reste : appui en translation au sol 100 %
   des images de l'armé (pic 7,5 m/s), corps déplacé à 5,2 m/s sur jambes d'idle forcé (le régime
   anti-chimère de l'entrée 11 avait créé le patinage), appui EN L'AIR au contact (0,19-0,22 m),
   mains composées au-dessus du cou 41 % (le contrat silhouette juge le clip seul — composé sur
   l'idle il ment), pied de frappe à 1 m/s au contact. Trois lois moteur : (1) vitesse d'anim =
   vitesse SOL MESURÉE, jamais un zéro forcé — le plant émerge de la mesure ; (2) geste SCINDÉ
   haut/jambes (toClip {only}) — le haut s'arme pendant les pas, les jambes fondues par
   max(1 − v/2,5, (t/antic)^1,5) car le dernier pas EST le plant ; (3) le glissement ne couvre que
   les derniers décimètres (hardMax 0,6 ; 0,5 mesuré trop serré : la rampe d'amorti coûtait +0,17
   de taux de perte — la marche TRAVERSE le point de plant, cible +0,35 m). Deux artefacts
   d'instrument attrapés en route (tampon mélangeant deux porteurs au changement de possession :
   « Hips à 1,22 m », « pied à 117 m/s » ; métrique de patinage comptant les pas normaux —
   remplacée par la GLISSADE stance-aware : corps > 0,8 m/s sans qu'aucun pied ne décolle).
   Résultat : audit-membres.mjs OFFICIEL 13✓/0✗ (glissade 0 fenêtre, appui posé 0,09-0,11 m,
   genou 69-75°), possession à parité (record 7,5-8,8 / taux 0,59), suite node verte. Reste aux
   CLIPS (chantier #18, chiffres imprimés en INFO à chaque exécution) : vitesse du pied au contact,
   mains du passe composé, appui exact de l'exterieur.

14. **La surface du pied, verifiee — et le vrai visage des « talonnades ».** Question utilisateur :
   « le ballon tape-t-il la bonne surface ? beaucoup de talonnades ». Mesure : ce n'etaient pas des
   talonnades (6 %) mais **79,5 % de passes de l'EXTERIEUR du pied** — l'inverse du football — parce
   que le departage « presse » de planStrike (marge 0,25 INCLUSIVE de la pref 0,75) faisait du flick
   exterieur (arme 0,24 s) le standard sous pression, et un rondo est presse en permanence. Marge
   0,2 seule : 89 % d'interieur mais record 8,4 → 5,8 (l'arme 0,38 s se fait tacler). Le geste
   MANQUANT etait la **passe interieure rapide** (animkit `passeRapide` : arme de poussee 0,22 s,
   backswing REDUIT — un arme court est un arme plus PETIT, vitesses ≤ 13 rad/s — contact identique
   a `passe`) : distribution finale 79 % rapide + 14 % posee = 93 % interieur, 5 % talonnade, 0,5 %
   exterieur. La VERIFICATION DE SURFACE vit dans audit-membres : au contact, l'axe du pied
   (Foot→ToeBase) contre la DIRECTION DE DEPART du ballon classe la face (≤ 40° laces, ≥ 140°
   talon, sinon interieur/exterieur — le cote MEDIAL defini sans convention : c'est le cote de
   l'autre pied). Trois lecons d'instrument en route (loi 8 sur l'auditeur lui-meme) : l'arret d'un
   pas se FINIT en double appui (plantHold : le gel de la marche a phase arbitraire mettait l'appui
   a 0,20 m au contact), le plant a sa propre constante de temps (0,025 s — la fenetre d'un arme
   court est plus courte que le lissage de croisiere), et un pied en FLEXION PLANTAIRE n'a pas
   d'orientation horizontale mesurable (7 cm de projection → angle errant de 88° a 178° : la clause
   ne s'arme qu'a ≥ 10 cm — en deca, strike-stance juge cote sim et l'INFO garde les chiffres pour
   le re-calage des clips, dont le critere d'acceptation inclut desormais « pied oriente au
   contact »). Budget control-at-foot 6 → 9 (p99 : processus multi-graines 3,4 %, mene 0,65
   re-balayee optimale ; une queue d'UNE graine ne rougit pas le harnais, une derive si).

15. **LE PORTÉ — la possession devient un régime du moteur (loi 11).** Idée utilisateur validée et
   construite : « la physique de balle et le joueur en possession ne doivent faire qu'un ; c'est aux
   tacles et duels que ça évolue ». ball-body : possess(owner)/carry(point,dt)/release(cause) —
   servo de position PAR l'intégrateur (tau 0,04, vMax 9 : continu, borné, l'audit par sous-pas ne
   voit AUCUNE brèche), sorties à cause nommée (RELEASES : frappe/touche/conduite/contesté/perte/
   sortie/arrêt-de-jeu, registre lu par le contrat). Câblage : CAPTURE au contrôle (amorti +
   possess — solveGroundLeg et toute la machinerie de livraison meurent), porté au point du pied
   pendant l'intention, au POINT DE STANCE pendant l'armé (couple soudé par construction), release
   vers la conduite (touches réelles, ballon libre interceptable) et vers le duel (contesté).
   Résultats : **control-at-foot 3-9 % → 0,0 %** (6 graines — la dette de quatre correctifs meurt
   par construction), record 8,8 (meilleure mesure du dépôt), un épisode d'audit au pied à
   15,4 m/s au contact. Deux pièges mesurés en route : (1) l'ancre d'un ballon porté MARCHE avec le
   porteur — la borne des ballons libres devenait un mur (6 495 refus, couple traîné hors du
   carré) : porté, la stance se rejoint en ARRANGEANT LE COUPLE, la borne change de nature avec le
   régime ; (2) la mesure d'assise doit suivre la possession — un ballon frappé avant la fin de la
   fenêtre du contrôle est un une-touche jugé par strike-stance, pas un contrôle mort à 1,29 m
   (l'ancienne mesure l'a compté tel quel : 36 % de fausses violations). verify-ball-body : 37 → 52
   clauses (cycle possess/release, convergence continue, plafond qui mord, frappe/remise libèrent,
   sabotage cause-inventée-au-registre).

16. **Le swing s'authore contre une loi : le contact se TRAVERSE.** Banc `verify-swing.mjs` — FK
   node pur sur shanon.glb brut, slerp 240 Hz, et le piège d'instrument (loi 8, encore) : il
   REMPLAÇAIT les rotations des nœuds par les quats de la spec, alors que le jeu joue des DELTAS
   ADDITIFS (`q_rest ⊗ q_spec(0)⁻¹ ⊗ q_spec(t)`) — la cuisse au repos porte ~180° de Z, le banc
   mesurait des frappes à 1,40 m de haut. Corrigé, il a condamné les clips livrés : la clé de
   contact était un EXTREMUM (le pied s'y gare puis recule — vitesse au contact ≈ 0 par différence
   centrée, la « caresse » que l'utilisateur voyait). La loi d'authoring qui en sort, appliquée aux
   7 frappes × 2 pieds : segment d'approche rapide (400–1 000 °/s de cuisse), clé de contact POSÉE
   sur l'instant déclaré (les deux contrats se rejoignent), clé d'OVERSHOOT qui continue au même
   rythme (~25–40° de plus), récupération plus lente que la frappe (le pic reste SUR le contact).
   Sur ce gabarit : passe 10,9 m/s, passeRapide 10,8, frappe 12,7, talonnade 6,4 (clé insérée SUR
   la trajectoire interpolée : les vitesses ne bougent pas, le contact devient une pose écrite),
   passeExterieur 0,9 → 8,4, passePivot 0,3 → 8,5 (la jambe ATTEND que le bassin tourne, puis
   balaie 46° en 80 ms). Exception assumée : la déviation ne frappe pas, elle PRÉSENTE la surface
   (seuil 2 m/s — exiger 8 d'une remise en ferait une passe déguisée). Cheville : +x = dorsiflexion
   sur ce rig (mesuré, −18° empirait l'axe des orteils). Contrôles : excursion 33–40 cm, retour
   ≤ 1 cm, les deux pieds. Composé (audit-membres 13/0) : surface déclarée inside / réalisée inside
   à 133° côté médial, pied à 13,0 m/s au contact — le clip traverse jusqu'au monde rendu. Une
   clause d'approche re-jugée par le monde composé : « pressé prend la plus prompte » se mesure sur
   les ancres ATTEIGNABLES (le min global comptait la talonnade re-timée à 0,19 s dont l'ancre est
   derrière le ballon — une option qui n'existe pas). Reste ouvert : le warp composé du pied
   (min pied→frappe 0,19–0,56 m selon l'épisode — le clip est calé, l'alignement monde pas encore).

17. **La rencontre du pied et du ballon — et le bug le plus profond du dépôt (loi 12).** Parti pour
   fermer « pied ≤ 0,35 m du ballon au contact composé », le warp de frappe (strike-warp.js —
   enveloppe C¹ à pente NULLE au contact : position corrigée, vitesse du banc intacte ; borné à
   refus nommés ; standoff ; gel au tir) a servi de révélateur : son registre de refus plein
   (`warp-hors-borne` permanent) a déroulé QUATRE bugs empilés. (1) Le probe statique du point de
   contact mesurait une ombre (loi 8, encore) → calibration EN LIGNE sur le jeu composé (le mixer
   ré-écrit la pose chaque image : le pied lu avant IK est déjà non-warpé). (2) Le LACET visuel
   restait à 110° du yaw sim au contact d'un pivot (facing dérivé d'une vitesse nulle) → position
   ET lacet snappés à la sim. (3) Les deltas ADDITIFS étaient conjugués sur l'idle retargeté —
   20°/32°/43° d'écart au rest par os — le plan du balayage pivotait d'autant → LA COUCHE DE GESTE
   (gesture-layer.js) : pose absolue `rest ⊗ q_spec(0)⁻¹ ⊗ q_spec(t)` par membre, après le mixer ;
   clause reine : quatre bases très différentes ⇒ même pose au contact, 0,0000°. (4) Le repère
   propre a mis à nu le vrai fond : TOUTES les frappes balayaient VERS L'ARRIÈRE (passe : −0,46 m
   d'avant au contact ; la talonnade, seul geste censé aller derrière : 0,00) — la sonde
   articulaire (FK nue, une rotation à la fois) dit flexion de hanche = +x et genou = −x sur ce
   rig, l'inverse de la croyance des specs pour LES DEUX. Aucune clause en amplitude ne pouvait le
   voir ; l'utilisateur l'a vu : « beaucoup de talonnade » — littéral. Flip mécanique des 170 clés,
   bornes de charnière re-signées, clauses de DIRECTION au banc (v_avant ≥ 60 % de v_contact ;
   talonnade ≤ −60 %). Puis la table des STANCES, écrite à la main, divergeait de 0,10–0,45 m des
   clips → DÉRIVÉE par FK (S = pied_contact + standoff·direction) + clause de concordance.
   Résultat composé (audit-membres 16/0) : frappe à **17,0 m/s** au contact (fourchette réelle
   15–25, première fois), pied→frappe 0,19–0,30 m, surface laces/laces concordante à 29°.
   final8 : 8,1 = parité exacte. Nouveaux harnais : verify-gesture-layer (10, sabotage = le bug
   reconstitué à 43°), verify-strike-warp (23, mini-monde composé), verify-swing 71 → 90 (12
   clauses de direction + 7 de concordance). Restent au registre : bras > cou 32-36 % sur deux
   épisodes (la couche a changé la composition des bras — prochain lot), premier geste par
   clip × pied non calibré (mesure seule, par construction).

18. **Le sweep de réalisme et sa première moitié — bras vrais, regard, tacle couché, warp écrêté.**
   Onze sondes parallèles ont mesuré le jeu composé contre le vrai football (bras, regard, allures,
   ballon, première touche, tempo, duels, frappes, appuis, un juge « téléspectateur » sur captures,
   le moteur de match) ; synthèse en 6 chantiers pré-résolus + backlog ordonné de 13. Livré ici :
   (1) **LES BRAS VRAIS** — double bug de fond : l'AXE d'abaissement était faux (tout le répertoire
   écrivait Z = balancement horizontal ; sondé au rig : c'est X qui abaisse — bras en croix sur
   94-100 % des images de geste, « des épouvantails à chaque passe ») ET la couche annulait la
   BASE_POSE des bras (conjugaison q_spec(0)⁻¹, no-op jambes, fatale bras). Sémantique absolue
   VRAIE (rest ⊗ q_spec(t), banc aligné), BASE_POSE re-axée [65,0,0], tables de bras RÉSOLUES au
   rig (passe/passeRapide/frappe/controleInterieur/tacle), bras rendus à la locomotion ailleurs
   (resolveTracks n'impose plus les os non authorés), rampe d'entrée wUp 0,12 s (le pop mesuré :
   +54° en 50 ms, 122×/2 min), la réception ne joue plus un clip de passe. Composé avant → après :
   élévation d'armé −14° → −61°, horizontal 94 % → 5 %, mains>cou 12,5 % → 0-3,7 %, direction
   avant 1-9 % → 46-64 %. Clause de SILHOUETTE au banc (TENUE du coude/azimut couplée à
   l'élévation — un bras qui pend presque droit est naturel, tendu-levé est l'épouvantail).
   (2) **LE REGARD** (gaze.js, neuf) — il n'existait pas : médiane tête→ballon 49-65° partout,
   0,7 % des réceptions regardées. Politique par rôle pure (receveur→ballon tout le vol+amorti ;
   porteur→alternance cible/ballon, cible d'abord en armé ; presseur→ballon ; hors-ballon→scans
   déterministes LCG) + mécanisme à état MONDE : le réflexe vestibulo-oculaire absorbe les pivots
   du corps (clause dédiée — les têtes claquaient à 1 148°/s avec le lacet sim), saccade 600°/s /
   poursuite 200°/s, clamps ±70°/[−55,+25], split cou 40/tête 60. Composé : réception 69° → 15,3°
   (74 % sous 30°). verify-gaze : 12 clauses. (3) **LE TACLE COUCHÉ** — la couche porte le root
   motion des specs (écrivain de bassin scène, conversion de toClip) et l'horloge gèle sur la pose
   au sol tant que p.down > 0 : le tacleur ne « glissait » plus debout. (4) **LE WARP ÉCRÊTÉ** —
   le refus binaire de portée annulait la correction pile au contact (62 % des passes touchées) :
   projection sur la sphère atteignable, reliquat au registre ('warp-écrêté-portée'). Frappes
   composées p90 0,33 m ≤ 0,35 ✓, audit 16/0, suite entière verte (36 bancs). En cours (agent
   isolé) : duels honnêtes (tuer le flip de possession sans geste physique — 54 % des pertes) et
   tempo/soutiens calmes, sous verrous de balance.

19. **Sweep, seconde moitié — duels honnêtes et tempo de rondo (la sim).** Le flip de possession
   sans geste physique (54 % des pertes, « gagnant » jusqu'à 2,33 m du ballon, ballon gelé à 0 m/s
   en 1 image — le nexus mesuré par QUATRE sondes indépendantes) est mort : tout vol est désormais
   un GESTE tacle-debout (prédicat de portée sur le BALLON, contestRadius + shieldSlack enfin
   consommé, transfert par contact, refus nommés 'tacle-manqué'/'tacle-orphelin', clip tacleDebout
   enfin déclenché) ; turnover() amortit à 20 % + possess + événement 'control' nommé — plus de
   télékinésie (39 → 0). Tacles glissés 9,4/min (69 % par l'équipe EN POSSESSION !) → 1,9/min, 0 % ;
   cooldowns joueur 12 s + équipe 4 s (les cascades de 3 plongeons en 0,3 s étaient mesurées) ;
   gardes down partout (0 porté avec porteur au sol). Tempo : hold p50 0,38 → 1,04 s, inter-passes
   0,9 → 1,67 s avec 34 % dans 2-5 s (était 0-1,6 %), soutiens 3,0-3,5 → 1,70 m/s (ring EMA τ 0,5 +
   hystérésis + pénalité coéquipier < 2 m), angle press/cover 15-23° → 40-58°. Balance : record
   9,25 (référence 8,1 — MIEUX en jouant plus calme), 47,6 passes/partie. Un deadlock découvert et
   corrigé en route (presseur arrêté à 0,88 m d'un ballon mort, partie gelée 115 s). verify-rondo
   27 → 40 clauses (+5 sabotages dont flip-sans-geste et spam de glissades, rejoués et attrapés) ;
   checkRondo gagne les clauses 10-13 (VOL SANS GESTE, TÉLÉKINÉSIE, GLISSADE DE POSSESSION, PORTEUR
   AU SOL). Compromis consignés en code avec leurs négatifs : cadence de pertes 6,3 s (cible 8-15 —
   trois remèdes essayés ont tué le record : raceSlack 0,18 → 5,5, presseur collant → 6,8),
   both&lt;2,5 m ~52 %, médiane passes/possession 0-1 (moyenne 1,4-1,9, les 50/50 de scramble
   comptent). L'audit membre gagne le double plancher genou (posé ≥ 40°, en mouvement ≥ 25° —
   l'anti-chimère rend l'amplitude partielle LÉGALE sur un une-touche pressé). Le lot entier
   (18 + 19) mesuré ensemble : audit 16/0, 36 bancs verts, preuves-image dans le scratchpad.

20. **La persona et les ruptures de rythme — dix joueurs, dix silhouettes, un jeu qui respire.**
   Retour utilisateur : « il manque des changements de rythme et il faudrait instaurer différents
   mouvements par joueur pour qu'ils ne se ressemblent pas tous ». (1) **persona.js** (neuf) :
   l'identité de mouvement en fonction PURE de (id, graine) — taille ±4 %, déphasage du cycle de
   jambes (dix joueurs posaient le pied gauche à la même milliseconde), amplitude du balancier
   0,85-1,2, posture propre du buste (1-3°), paceBias ±6 %, burstiness 0,7-1,4, calm 0,85-1,25.
   UNE source, DEUX consommateurs : la sim (paceBias/burstiness/calm) et le visuel (taille,
   gaitPhase, balancier, posture) lisent la même persona. (2) **Les ruptures** (rondo.js) : des
   APPELS (soutien posé qui claque 0,7-1,1 s, cadence par burstiness, 12/min mesuré) et des
   CHASSES sur touche de passe (0,98 par passe tentée — première version : 155 en 120 s, TROIS
   défenseurs par passe, la frénésie que la refonte tempo venait d'éteindre → seul le PLUS PROCHE
   jaillit) ; entre les ruptures un soutien posé MARCHE (settledWalkCap 1,35 — le contraste EST le
   rythme : 36 % de marche, 18 % de pointes) ; le produit des accents se borne (sprintMax 8,0 —
   une chasse en rupture composait 6,9 × 1,28 × 1,06 = 9,4 m/s). (3) verify-persona (19 clauses) :
   le paceBias prouvé comme une LOI (un coureur, deux personas, rapport des vitesses de régime
   1,128 = théorie ±2 % — l'A/B de parties complètes re-mourait ici : bruit 0,49 m/s > accent
   0,36) + sabotages (rng non seedé, tirage effondré, borne crevée). (4) Deux morts d'instrument
   en route (loi 8, encore) : l'audit capturait le windup du TACLEUR avec les images du PORTEUR
   (épisode chimère où « l'appui posé » jugeait le pied lancé d'un tacle → filtre porteur+pied) ;
   et la clause « un pied tenu ne bouge pas » lisait 25-40 mm à w=1 sur L'IMAGE MÊME de l'écrêtage
   de sphère → le verrou RELÂCHE À 92 % de la portée (le talon pèle avant l'extension complète),
   plus une seule image traînée. Le seuil « appui posé » suit désormais le gabarit (×persona.scale),
   comme spreadFrac suit le carré. Balance : record 8,63 (verrou ≥ 6,5), 41,9 passes/partie.
   Audit 16/0, 43 bancs verts, ALL-SYNC 7/7.

21. **Les gestes techniques — râteau, feinte de passe, arrêt semelle (« tout ce qui fait le foot »).**
   Nouvel intent `carry` dans la table (le ballon est manipulé, jamais libéré), trois clips
   authorés (le râteau n'authore PAS le lacet — la sim tourne, le visuel copie, loi 12 ; la feinte
   est l'armé EXACT de `passe` qui SE RETIENT au contact — backswing à 2°, cuisse 6° vs 46°,
   l'anti-overshoot comme signature ; la semelle lève la TÊTE pendant la tenue), même machine de
   gestes que les frappes avec fenêtre de duel ouverte du début à la fin (un râteau mal timé se
   fait tacler) et abort nommé (`pressé-sous-semelle` : la semelle se décolle quand on vient la
   presser). Corps possédé par le geste (`ownsBody` : skillFollowStep écrit lacet+ballon,
   movePlayers se tait), couple soudé mesuré (retournements 179°, ballon ≤ 0,61 m). La feinte
   MORD : cône ±55° sur la fausse direction, `_bite` 0,55 s → actionneurs × 0,35, prouvé en loi
   (rapport des vitesses = biteSlow ± 3 pts) ; rétraction raccourcie 0,26 → 0,14 s (mesuré :
   la morsure expirait AVANT la vraie passe). Fréquence = identité (persona.flair 0,15-1,0) sous
   cooldowns : ~2,5 râteaux, ~7 feintes, ~0,8 semelle / 90 s (chemin de réglage consigné :
   0 → cirque 12,5 → juste). QUATRE morts d'instrument/monde en route : cibles de carry 2D
   (le [x,y,z] envoyait le ballon vers z=0,11 à vMax — 3,99 m de « raclage »), rateauClear 2,0
   introuvable en carré de rondo (0 râteau), la feinte qui gèle près d'un homme (+10 pts de
   collé → interdite sous pressPredicate), et les seuils recalibrés AVEC leurs lois quand le
   monde de rétention est arrivé (harriedMax 0,55 → 0,62 sur distributions 10 graines avant/après,
   sabotage toujours ~100 % ; bande tempo ≤ 55 ; verrou en ACTIONS frappées+gestes ≥ 42, plancher
   frappées 34). verify-gestes.mjs (26 clauses, 5 sabotages dont « même situation, sortie libre →
   s'exécute »), audit filtre `!x.skill`, sonde composée : les trois clips jouent en scène
   (miroir compris), captures dans le scratchpad. Balance : record 9,1 | 52,8 actions | pertes
   14,1 (meilleur qu'avant le lot). Référence 52.

22. **Le terrain, le gardien, le match réduit — « agrandir le terrain » (réf. 53).** Du carré au
   MATCH : pitch.js (terrain-donnée, RÉDUIT 46 × 30 + PLEIN FORMAT Loi 1 déjà défini ; la sortie
   jugée au franchissement INTERPOLÉ, première ligne croisée — un tir sorti en coin est une
   sortie de but ; touche au pied = loi du FORMAT futsal, écrite), keeper.js (position sur la
   ligne ballon-but qui coupe l'angle 0,45 → 1,97 m, re-recul sous 7 m ; plongeon sans oracle,
   réflexe 0,12 s, envergure 2,1 m, BATTU nommé), match-sim.js — et l'architecture EST le
   chapitre : UN SEUL game-loop (rondo-sim, 40 clauses), le match est une CONFIGURATION par six
   hooks (assignJobs directionnel, tryShot, onOut, onDive, canTake, passBias). Duels, gestes,
   personas : le même code — 49 gestes techniques comptés en 4 matchs. La chasse mesurée : tir
   étouffé par la tenue calme (27 refus timing, 0 tir) → porte d'opportunité ; beginPass
   inatteignable (rondoInternals au lieu de simInternals — toujours faux en silence) ; toucher du
   plongeon à frame fixe (2 arrêts/15) → CONTINU (16/19) ; CSC du gardien porteur marchant sa
   loi de position ballon en mains → distributeur + bucket vitesse keeper 6,4 (z=−4 mesuré sur
   4 des 5 buts sans plongeon) ; match sans progression = rondo dans sa moitié (possession 191
   c. 140 toute à x=−15) → passBias 0,22/m plafonné. Chiffres (4 × 120 s) : 33 tirs, 8 buts
   (conversion 24 %), 16 arrêts/19 détentes, 4/4 contrats. verify-match (17 clauses, sabotages :
   match sans tir, score trafiqué, remise volée). Scène : match.html = la MÊME scène Rondo en
   ?match (buts goal.js, gardien jaune, HUD score, check() → checkMatch). Rondo intact (40/40),
   43 bancs verts, audit 15/0, ALL-SYNC 7/7. Dettes nommées en réf. 53 (corner rare, pas de
   hors-jeu ni de sortie du gardien, cérémonies, mi-temps/formations → 11c11).

## État actuel (rappel)

- Skill `threejs-aaa` : refs 01–22, scripts de vérif (interaction / scene / temporal / locomotion), starter runnable.
- Modules moteur natifs : rendu (WebGPU+IBL+post), `locomotion.js` (matchCadence) + `foot-lock.js` (FootLockIK,
  no-slide), `character-controller.js` (facing sans moonwalk, run/idle, sprint, jump), `input.js`
  (clavier + manette + souris + tactile), `third-person-camera.js` (caméra pilotable), validateurs.
- Galerie publique déployée : https://threejs-aaa-showcase.vercel.app (jouables : **Carrière**,
  Contrôles, Physique, Intérieur ; génération : Lieux, Stades ; plus Soldier Volley dribble→centre→volée,
  Matériaux PBR, Monde procédural, IK, Géométrie, Bloom, Océan, Herbe).
