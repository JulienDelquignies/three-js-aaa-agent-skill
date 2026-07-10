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

Backlog (suite) : packs CC0 véhicules (Kenney/Quaternius) → idées stade AAA (foule instanciée, mode
nuit) → échelle « dimensions PSG » → saison simulée sous contrats statistiques → scène-comme-donnée
→ meshkit : UVs/textures, fusion des pads par pièce (draw calls) → conduite : voiture alignée à la rue
au parking, IA trafic, ghost du record au circuit.
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
