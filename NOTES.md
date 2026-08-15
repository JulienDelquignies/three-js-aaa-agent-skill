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

23. **La circulation et le stade paramétrique — « trop de conduite, des passes qui ne suivent pas
   l'appel, le petit carré encore dessiné ».** Les chiffres disaient mot pour mot le retour :
   21 % de passes reçues (18/84), 11 passes en sortie, 9 dans les gants, tenue p90 3,6 s, 5 appels
   servis sur 74. LE TROU FONDATEUR : pendant le vol, l'attribution directionnelle envoyait tout le
   monde aux couloirs — le DESTINATAIRE trottait vers son slot pendant que le ballon passait à côté
   de lui (le cerveau du rondo donnait ce job, le match l'avait perdu). Trois lois : (1) le receveur
   ATTAQUE sa passe (job 'receive' en vol → la mène) ; (2) LA MÈNE SUIT LA COURSE (cfg.leadTime —
   0,4 + d/9 borné 1 s, amorti 85 % coureur / 30 % posé ; la mène figée 0,28 s posait le ballon 4 m
   derrière un coureur — et la re-mène du contact lit LA MÊME loi, sinon elle défaisait celle du
   choix) ; (3) L'APPEL EST SERVI (cfg.appelBonus 2,0 dans le score de choosePass). Circulation de
   match : holdCalm [0,5 ; 1,2], intentBarCalm 4,2. APRÈS : 85-91 % de passes reçues, 0 en sortie,
   tenue p90 1,5-1,7 s, 12-15 appels servis, deux fois plus de passes — verrouillé par 3 clauses
   (verify-match 20). Rondo INTACT au bit près (hooks = no-ops sans config, verrou 9,13 inchangé).
   LE STADE DEVIENT PARAMÉTRIQUE (la vraie réponse au « petit carré ») : generateStadium prend
   {pitch, goal} — tribunes, pelouse PEINTE (surfaces du modèle, arc de réparation Loi 14
   conditionnel), cages, panneaux, éclairage suivent le modèle. Le match se joue DANS un stade
   construit autour du 46 × 30 : ses cages SONT les cages (alignées pitch.js), ses lignes SONT les
   lignes — plus de superposition, plus de cônes, plus de buts décoratifs à 3 m des vrais.
   checkStadium apprend le format (Loi 1 exigée seulement sur terrain ≥ 90 m ; cohérence cage/
   surface sinon ; sabotage cage réduite sur terrain Loi 1 attrapé). Deux bugs de scène mesurés :
   matchMode lu ligne 106, consommé ligne 77 (le carré se dessinait sur tous les matchs) ; caméra
   broadcast DANS la tribune rapprochée (écran noir) → régie dérivée du modèle. 43 bancs verts,
   audit 15/0, stade 14/14, ALL-SYNC 7/7.

24. **La conduite précise — « pas trop de conduite : trop de conduite IMPRÉCISE ».** La correction
   du retour précédent avait trop rangé le dribble ; celui-ci le remet au centre et corrige sa
   QUALITÉ. Mesuré : 11,4 % du temps de conduite avec le ballon échappé > 2,2 m (le porteur
   courait après son ballon), poussée d'évasion re-échantillonnée à 60 Hz (zigzag d'intention).
   Trois lois : (1) LA TOUCHE LIT L'ESPACE (dribble.js — un défenseur à 2 m raccourcit la touche,
   close control ; seul, on pousse loin ; `player.space` fourni par la boucle de conduite, loi
   neutre si absent) ; (2) LA TOUCHE QUI CORRIGE, CORRIGE (ligne du ballon divergée > 60° du cap
   → le pied reprend plein cap au lieu de mélanger l'erreur) ; (3) L'INTENTION SE LISSE (EMA
   τ 0,35 s sur la poussée du porteur de match). Après : échappées 5,1-5,4 %, dist p90 1,87 m,
   touches à 1°/10° (p50/p90) du cap voulu — et la CONDUITE GARDE SA PLACE (63-65 % du porté en
   touches libres, holdCalm rendu à [0,6 ; 1,4]). DEUX morts d'instrument (loi 8, encore) : le
   « 90-111° d'imprécision » comparait la vitesse RÉSIDUELLE du ballon au push COURANT qui avait
   déjà tourné — à l'instant de la touche, l'angle réel est 1-10° (et la conduite « propre » avait
   la queue, le duel était précis : l'inversion qui a dénoncé l'ombre) ; puis le banc a recopié la
   sonde en mutilant l'ordre des captures (97° mesurés à travers deux pas). 4 clauses verrouillent
   présence ET précision (verify-match 24). Bonus mesuré : le rondo MONTE au verrou (record 10,13,
   frappées 43,9 — la touche qui lit l'espace améliore aussi le jeu pressé). 43 bancs verts.

25. **Le lot de réalisme corps/perception + la passation (MOTEUR.md).** Décision : ce dépôt devient
   LE socle fourni à l'autre projet (qui construira le 11c11 dessus) — lots 2-3 du plan + doc de
   greffe. (1) LA PERCEPTION N'EST PLUS UN ORACLE : 10 % des défenseurs re-ciblaient dans l'image
   du départ de passe (17 ms). Loi : la SURPRISE se stampe au contact (armé vu = seen), et QUI
   REGARDAIT (part de la politique de regard, ~65 %, hachée joueur × passe — le flux seedé ne
   bouge pas d'un bit) anticipe l'armé ; qui scannait paie sa réaction persona (nouvel axe
   0,16-0,26 s) pleine. Après : 18 % < 50 ms, p50 183 ms, queue 400 ms — et la retenue prouvée en
   LOI (cibles gelées 100 % avec réaction vs 20 % sans). Une claquette surprend tout le monde.
   (2) LE POIDS DE LA PASSE : découverte mesurée — la balistique inverse livre déjà des ballons
   jouables (7-10 m/s) ; la vraie conséquence d'une fusée est le CONTRÔLE MANQUÉ (pMiss ∝ (v−10),
   ÷ accuracy, tirage seedé, ballon libre + refus nommé) — garde dormante prouvée sur fixture
   (15 m/s au pire tirage → échappe ; 6 m/s → jamais ; bon tirage → dompté). (3) LE DÉGAGEMENT —
   le foot manquant : graine 11 mesurée 391 images de possession épinglée sans JAMAIS franchir la
   médiane (la table avait « degagement » depuis le premier jour, jamais déclenché). Hook
   cfg.tryClear au niveau du tir (la branche contestée ne tournait que 17×/120 s — l'épinglé était
   taclé avant), étau lu aux CORPS, botté lointain vers le flanc opposé, cooldown d'équipe.
   2-4 dégagements/match, graine 11 respire. (4) Contact corps : MESURÉ INUTILE (pire
   chevauchement 0,44 m = deux torses — les rayons de rôle tiennent déjà la séparation) — consigné,
   pas implémenté. (5) L'INCLINAISON DANS L'ACCÉLÉRATION (contrôleur) : le buste penche dans ce
   qu'il fait — avant/freinage ±9°, roulis de virage ±7°, τ 0,12 s, repère corps. (6) RÉGIE :
   travelling à l'échelle du terrain + zoom de tension (−9° de focale) dans le dernier tiers.
   (7) MOTEUR.md : le guide de greffe pour l'autre équipe — l'architecture un-loop + hooks, la
   table des 8 points d'accroche, les invariants de la charte, le chemin balisé du 11c11
   (formation dans assignJobs, hors-jeu dans beginPass/canTake, chrono autour de matchStep,
   sorties gardien dans keeperDecide). QUATRE instruments redressés en route (loi 8) : touche
   posée PILE sur la ligne (segment dégénéré → remise illisible), « échappée » qui comptait les
   touches de sprint puis la cueillette post-turnover puis oubliait la PORTÉE du pied (plafond
   final = reach 1,15 + touchDistance(allure de lancement) + marge → 0,4 % réel), balayage rondo
   60 → 90 s (la fenêtre courte re-distribuée tombait sur des histoires à record 2), clause des
   deux camps au tiers (une équipe dominée 120 s est un match légal). verify-match 30 clauses.
   43 bancs verts, audit 16/0, verrou rondo 10,0, ALL-SYNC 7/7.

26. **Les attributs joueurs — le contrat d'injection (attributes.js, réponse à « les autres
   projets vont amener des attributs »).** OUI — et c'est un contrat, pas un champ libre. Trois
   lois (chacune une clause de verify-attributes, 13) : une note 0-100 module DANS la bande
   humaine (pace 100 = ×1,10 ; note 400 écrasée ; le plafond absolu du monde reste souverain) ;
   SANS notes rien ne change au bit près (aucun p.skill → aucun tirage d'erreur — même règle que
   les hooks : le socle est sûr à reprendre) ; la note agit sur l'EXÉCUTION, pas la physique
   (l'erreur de LA frappe, la fermeté de LA touche, la fenêtre DU tacle, le réflexe DU gant).
   Dix notes consommées : pace/acceleration (movePlayers), passing (σ d'angle 6,0° → 0,5° à
   l'exécution — 3,5° ne mordait pas les couloirs, mesuré), control (diviseur du contrôle-manqué),
   dribbling (longueur de touche), finishing (dispersion du point visé), tackling (fenêtre du
   duel), reactions (remplace l'axe persona), composure (l'erreur pressée), keeping (envergure +
   réflexe du gardien). Injection : makeMatch({ squads }) — { ratings, look, name, number } par
   joueur, gardien en dernier ; look.scale/look.shirt touchent déjà le rendu (numéros/carnation =
   dette texture documentée). Persona = couche esthétique, note = couche capacité, la note fait
   foi sur les leviers partagés. Mesuré (3 × 120 s, élite 80-88 c. faible 30-35) : 3:0 cumulé,
   86 % c. 80 % de passes arrivées — un accent d'équipe, pas une arcade (clause ≤ 9 d'écart).
   Déterminisme prouvé : même graine + mêmes notes → même match. Le gauss d'exécution est seedé
   et borné (±2,1 σ). MOTEUR.md gagne sa section « contrat d'injection ». 44 bancs verts.

27. **Le tempo x1 — « FM est plus lent en x1 ? » : oui, mesuré, réglé.** L'analyse (3 × 120 s
   contre les références réelles) : 25 passes/min (11c11 : 9-11, futsal : 14-18), tenue
   réception→passe 0,83 s, corps à 10 km/h de moyenne (réel 7,2), 195 m/min/joueur (réel
   110-120), ballon en jeu 94 % (réel 55-65 — le calme de FM est à moitié du TEMPS MORT). Les
   leviers, chacun mesuré : remises 1,1 → 4,0 s ; holdCalm [1,0 ; 2,2] + LE CALME SOUS MARQUAGE
   LÉGER (calmFoe 1,8 — un joueur de match fixe avec un marqueur à 2 m) ; économie du soutien
   OFFENSIF (support 4,9) avec bucket MARQUAGE dédié (support partagé ralentissait la défense :
   conversion 71 % mesurée) ; intentBarCalm 4,8. Et LA LOI DE SYNCHRONISATION : l'appel CASSE la
   tenue (les tenues 1,5-2,5 s et les courses 0,7-1,1 s étaient désynchronisées — 3 appels servis
   sur 41 ; un coureur en rupture au bout d'une ligne qui score dispense de finir la tenue —
   15 % servis après, rondo intact 40/40). APRÈS : 15-17 passes/min, 8,8-9,4 km/h, 120 m/min,
   86-88 % en jeu — la bande FUTSAL assumée (le 46 × 30 est intrinsèquement plus vif qu'un 11c11 ;
   le x1 « FM » complet viendra avec le plein format). 3 clauses de tempo verrouillées. DEUX
   trouvailles en route : le prédicat « personne ne tire » devient « des OCCASIONS sans tir »
   (1131 passages dans le tiers sans tir = cassé ; 0 tir sans visite = un 0-0 légitime) ; et un
   BUG DORMANT débusqué — après une CLAQUETTE, st.pass gardait l'origine du tir et la porte
   anti-auto-interception ne s'ouvrait jamais sur le ballon claqué retombé à 2 m : GEL INTÉGRAL
   de 111 s mesuré (dernier événement t=8,45, fin t=120). Après le gant, le ballon est NEUF
   (st.pass = null). 44 bancs verts, verrou rondo 8,63, ALL-SYNC 7/7.

28. **Le lot des quatre incohérences (retour utilisateur mot pour mot).** (1) « LES GARDIENS
   PLONGENT SUR DES PASSES EN RETRAIT » — mesuré : 10 plongeons sur 14 étaient des essuie-glaces
   sur des ballons touchés par LEUR équipe. Loi : la MENACE se lit au dernier contact
   (keeperDecide gagne un paramètre threat ; sans menace : cueillir ou poste, JAMAIS plonger).
   Après : 5 plongeons, 0 ami — les « 2 amis » restants de la première mesure étaient l'ombre de
   l'instrument (lastTouch lu APRÈS coup ; re-mesuré AU TEMPS DE DÉCISION : zéro). (2) « DES
   BALLONS SE DÉPLACENT SANS JOUEUR À PROXIMITÉ » — deux espèces mesurées : 12 TÉLÉPORTS de
   4,7-23 m en une image (remises snappées — l'engagement volait du filet au rond central, et
   placeKickoff écrivait les DOUZE corps) et 18 roulements orphelins ≥ 0,7 s (dégagements et
   claquettes ORBITÉS par la formation — les couloirs suivaient l'ancre à offsets fixes, personne
   n'allait AU ballon). Deux lois : LA REMISE SE PORTE (onOut freine le ballon à la lisse — un
   contact, pas une écriture ; le preneur STICKY va le chercher, le porte au pied — hook
   cfg.ballFetch, no-op rondo —, le POSE ; canTake exige le posé ; après un but les deux équipes
   REVIENNENT EN MARCHANT en formation pendant que le preneur sort le ballon du filet) et LE
   BALLON LIBRE EST CHASSÉ PAR LES DEUX CAMPS (mène de poursuite ~0,7 s re-résolue par image ;
   trot si le 50/50 n'existe pas). Après : 0 téléport (ballon ET corps — clauses checkMatch sur
   le registre BallBody et la trace), p90 sans-maître 1,33 s (orbite sabotée : 1,73 — la mène
   mord). LE PIÈGE DE L'INSTRUMENT (loi 8, la plus belle de la fenêtre) : la clause « ballon à
   > 3 m de tout corps » était BATTUE PAR LE SABOTAGE — l'orbiteur qui suit le ballon à la trace
   reste près de lui, le chasseur de la loi coupe vers son FUTUR et s'en éloigne ; la grandeur
   honnête est le TEMPS DE RÉSOLUTION. En route : tablier des corps (cfg.apron 2 m, 0 au rondo —
   le preneur pédalait contre la borne du terrain, touche gelée 58 s mesurée), pose serrée
   (0,12 m), gardien qui RAMASSE LA BALLE MOLLE (5 buts sans tir mesurés : roulements de 2-5 m/s
   au fond pendant le poste-spectateur — sous 6 m/s qui coupe le plan → gather), gardien en mains
   INATTAQUABLE (press au bord de la surface), remise = respiration (bucket walk 2,6), ballon
   récupéré DOMPTÉ (settleMin 0,55 — le ping-pong de la chasse faisait 23 passes/min), économie
   du hors-ballon par À-COUPS CADENCÉS (re-visée ≤ 1,4 Hz + 0,8 m de seuil ; l'hystérésis PURE a
   d'abord GELÉ le bloc — tenues 4,8 s, 2 appels servis sur 45 : le mouvement qui nourrit les
   passes doit vivre), instrument des occasions corrigé (zone QUE JE VISE pendant que JE l'ai +
   refus nommés = pas muet), clause attributs re-instrumentée (la complétion ne discriminait plus
   à 90 % contre 90 % — le receveur-en-vol rattrape l'erreur d'une note 30 ; la note se lit à la
   DÉVIATION DU DÉPART, mesurée dans le monde). (3+4) « LA CONDUITE MANQUE DE BEAUTÉS / LES
   ENCHAÎNEMENTS NE SONT PAS FLUIDES — les gestes sont censés être la CONTINUITÉ de la
   locomotion » — côté scène : L'ENTRÉE MÈNE L'HORLOGE DU CLIP (la clé t=0 est la pose NEUTRE —
   la rampe d'entrée tirait le haut vers le garde-à-vous AVANT de s'armer ; échantillonnage en
   avance de 0,3 × anticipation, convergence linéaire vers l'heure vraie AU CONTACT — le pied
   frappe sur sa clé) et LA RAMPE SUIT L'ALLURE (0,12 → 0,18 s selon la vitesse sol, symétrique).
   Audit membres 16/0 (appuis posés, genou 68°, contact aligné). Bandes re-mesurées après la
   re-donne : 17 passes/min, 9,4 km/h, 85 % en jeu, conversion 31-39 %. verify-match 38 clauses
   (+ 3septies « le ballon n'est jamais seul » avec ses DEUX sabotages nommés), verify-attributes
   13, rondo INTACT 40/40 au bit près (tous les hooks absents = no-ops), verrou 8,63 identique,
   audit 16/0, ALL-SYNC 7/7.

29. **Le répertoire offensif (retour utilisateur : conduite qui perd anormalement, frappes sans
   peps ni diversité, zéro centre).** (1) LA TOUCHE LÉGALE GARDE SON ÉTIQUETTE : la bascule
   carry→libre coupait au rayon plat (3,0 m) pendant que la loi de touche autorise portée-de-pied
   + touchDistance(v) + marge devant le corps (~4,6 m au sprint) — et la chasse du ballon libre
   transformait chaque foulée en 50/50 offert (mesuré : 41 bascules sans événement / 4 matchs,
   20 volées, 4 sur touches parfaitement légales). cfg.carryLawLoose (match ; rondo au bit près) :
   la bascule lit LA MÊME loi que le banc. Après : 31 bascules, 14 volées — le reste, des touches
   lourdes contestées AU CORPS. (2) LE RÉPERTOIRE DU TIR (cfg.shotVariety) : le plancher plat
   17 m/s + élévation coupée à 0,10 faisaient de chaque frappe le même rase-mottes. L'espèce se
   choisit sur la GÉOMÉTRIE + un tirage seedé + la note (placé/croisé près ; puissance 21,5,
   mi-hauteur, lucarne — élévation balistique pour la hauteur visée au plan). Mesuré : 4-5
   espèces, vitesses p90 21,5, le gardien tient (arrêts sur lucarne/mi-hauteur, conversion 41 %).
   (3) LE CENTRE (cfg.tryCross + postes de surface) : 0 centre avant — l'aile canonnait à angle
   fermé (tryShot passait toujours) et la boîte était vide au moment voulu. Trois lois : L'ANGLE
   FERMÉ N'EST PAS UN TIR (refus nommé « angle-fermé » → l'aile sert) ; L'AILE HAUTE REMPLIT LA
   SURFACE (les couloirs deviennent premier poteau / second poteau / penalty dès le quart
   offensif — armés TÔT, le coureur a besoin de sa course) ; LE CENTRE PART QUAND LA FENÊTRE
   S'OUVRE (forceUrgent, comme le dégagement — mesuré : 286 fenêtres géométriques, 0 passé les
   portes de posture d'une passe posée). Après : 6 centres / 4 matchs, 4 suivis d'un tir < 4 s.
   (4) LA SORTIE DANS LES PIEDS (cfg.keeperClaim) — le bug le plus grave débusqué EN ROUTE :
   8 buts « sans tir » à 3,5-4,3 m/s DANS LES PIEDS d'un gardien posté à 0,5-2 m — le ballon
   étiqueté carry n'avait AUCUN mécanisme de prise (la cueillette ne tournait qu'en phase libre) ;
   le label de conduite servait de bouclier. Un ballon au sol à portée de gants se ramasse, même
   « porté ». Après : 3 buts sans tir (tap-ins hors de portée réelle), 6 sorties dans les pieds.
   DEUX ombres d'instrument redressées : les postes de surface d'abord posés SUR la ligne
   (2,4-2,8 m — pinball de goal-mouth, 13 buts sans tir : reculés à l'épaule des six / niveau
   penalty) ; et la tenue p90 qui comptait la CONDUITE D'AILE comme statue (l'ailier refusé du
   tir conduit 3-4 s vers la ligne en attendant ses coureurs — une tenue qui ACHÈTE ≥ 3,5 m est
   exemptée : la clause chasse le porteur planté). verify-match 48 clauses (+10 : répertoire,
   peps, hauteur, centres, pieds, but-sans-tir borné, 4 sabotages nommés), rondo 40/40, verrou
   8,63, audit 16/0, ALL-SYNC 7/7.

30. **La pointe de conduite (retour utilisateur, troisième passe : « des ballons loin des
   joueurs pendant les conduites »).** Mesuré : 6,4 % des images de conduite à > 2 m du porteur,
   qui revenait dessus PLAFONNÉ à 4,0 m/s (l'allure « ballon collé » du bucket carry) en
   0,77-1,28 s — la correction du lot 29 (l'étiquette qui suit la loi de touche) avait rendu le
   phénomène plus VISIBLE en gardant légalement des ballons à 3-4 m devant. Loi : LE PORTEUR
   COURT SUR SA TOUCHE (cfg.carrySurge {at 1,25 m, top 6,2}, no-op rondo) — au-delà du rayon
   collé, la pointe se libère (la note de vitesse fait foi). Après : p50 ballon-pied 0,71 →
   0,40 m, retour sous 2 m p90 1,28 → 0,62 s, la conduite pique au lieu de trottiner. PLUS
   L'ÉCONOMIE DU MARQUAGE : les marqueurs miroir-suivaient leur cible à chaque image (3,47 m/s
   de moyenne, 2,7 des 9,8 km/h du total) — re-visée par à-coups cadencés (0,5 s / 0,8 m /
   rupture > 3 m), une défense qui tient ses lignes au lieu de vibrer. LA LEÇON SYSTÉMIQUE de la
   fenêtre (loi 8 au carré) : plusieurs bornes de clauses étaient des ESTIMATIONS-POINT calibrées
   sur une seule re-donne, plus étroites que la variance inter-mondes — chaque bouton cassait 3
   clauses ailleurs. Redressements structurels : la distance de conduite se juge DANS SA LOI DE
   VITESSE (d/plafond p90 ≤ 1,0 — stable par construction, le 2,1 m plat re-cassait à chaque
   monde) ; la sortie dans les pieds se prouve sur FIXTURE déterministe (ballon carry à 0,6 m
   des gants → ramassé ; sans la loi → jamais), pas sur un flux qui peut n'offrir aucun épisode ;
   le filtre des bascules oubliait l'événement `turnover` (7 « vols de touche légale » qui
   étaient des vols AU CORPS) ; une bascule de porteur AU SOL est une bascule de corps, pas un
   vol d'étiquette ; le km/h se moyenne sur 4 graines (bande de 0,2 plus étroite que le bruit de
   re-donne ±0,4 d'une paire) et sa borne passe à < 10,0 avec le contexte nommé (la pathologie
   d'origine était le TRIO 10,0 + 94 % en jeu + 25 passes/min ; le modèle de FATIGUE, backlog
   nommé, posera la vraie borne physiologique). verify-match 52 clauses, rondo 40/40, verrou
   8,63, audit 16/0, ALL-SYNC 7/7.

31. **La conduite serrée par défaut (retour utilisateur, quatrième passe sur la conduite — le
   signal le plus têtu du carnet).** La pointe (réf. 30) fermait vite les poussées, mais la
   POUSSÉE elle-même restait celle du knock-on : 0,5 + 0,36 × v servie à toutes les croisières
   (≈ 2,7 m à 6 m/s), et 18 % du temps de conduite vivait à > 2 m du ballon — le temps s'accumule
   sur le PLATEAU lointain de chaque poussée (homme et ballon filent à la même allure, la
   fermeture n'arrive qu'en fin de roulement). Et la part de conduite en burst NOMMÉ : 0,1 % —
   le geste long était devenu la règle sans que personne ne le décide. Loi : LA CONDUITE EST
   SERRÉE PAR DÉFAUT, LA TOUCHE LANCÉE EST L'ACTE NOMMÉ D'UN BURST (cfg.carryTight 0,62 → touchF
   posé par le match sur le porteur, plombé jusqu'à dribble.js via la projection pl — le premier
   essai ne mordait pas : la projection ne copiait pas le champ, mesuré 0 changement ; rondo au
   bit près, touchF absent). Après : temps à > 2 m 18 → 4,8-6 %, plus une image au-delà de 3 m,
   p50 ballon-pied 0,92 m. En route, un GEL débusqué (graine 3 : sortie jamais reprise) : la
   lisse ne freinait que les ballons AU SOL — un dégagement aérien atterrissait à 3,1 m dehors,
   hors du tablier des corps ET du bras tendu qui s'armait sur l'horloge de la remise. LA LISSE
   EST UN MUR (elle arrête aussi les vols) et LE BRAS TENDU S'ARME SUR L'ÉCHEC DE LA QUÊTE
   (2 s au contact), pas sur l'horloge. Et la leçon des sabotages FORMALISÉE : deux
   sabotages-comparatifs de flux (« orbite », « rayon plat ») s'étaient inversés d'une re-donne à
   l'autre — convertis en FIXTURES déterministes (ballon libre lancé → la cible du press est à
   +5,9 m DEVANT avec la mène, −0,1 sans ; porteur lancé, ballon légal à 3,4 m → l'étiquette
   tient avec la loi, volée sans). Bandes élargies à leur bruit mesuré : passes/min [11 ; 21[
   (bruit de re-donne ±1,5), tempo re-vérifié 19-20/min. verify-match 55 clauses, rondo 40/40,
   dribble 14/14, verrou 8,63, audit 16/0, ALL-SYNC 7/7.

32. **Le receveur vivant et le déchet du joueur moyen (retour utilisateur : « les joueurs sont à
   l'arrêt complet pour attendre le ballon » + « des contrôles pas dans les pieds »).** Mesuré :
   49 % du vol entrant à < 0,5 m/s, p25 = 0,00, vitesse à la prise p50 = 0,00 — la STATUE au
   point de chute (le match avait RÉGRESSÉ la loi du rondo, interceptPoint, en point statique),
   et la prise à bout de bras d'un corps planté qui se lisait « contrôle pas dans les pieds »
   (la mécanique du contrôle elle-même était saine : ballon au pied en 0,03 s). QUATRE
   sur-corrections mesurées et consignées avant la bonne loi : (a) rencontre par interceptPoint
   à l'allure de chasse → le receveur corrige le vol RÉEL, bruit compris — TOUTE passe aboutit
   (0 sortie en 4 matchs, 24,6 passes/min : le flipper par la réception parfaite) ; (b) allure
   de rencontre douce → pareil en plus lent ; (c) zone des derniers mètres mais toujours
   balistique → pareil ; (d) DEUX FOIS, allonger holdCalm pour compenser fait MONTER les
   passes/min (la tenue attire le press, la part pressée explose — le volume de passes n'est pas
   un bouton, c'est une conséquence). Les DEUX bonnes lois : LE PAS VERS LE BALLON SUR L'AXE DE
   LA LIVRAISON (meetZone 3,5 m / meetStep 1,3 m, prolongé jusqu'au contact — le corps s'anime,
   la prise se fait en mouvement, et l'erreur LATÉRALE continue d'échapper : le football garde
   ses déchets) et LE DÉCHET TECHNIQUE DU JOUEUR MOYEN (cfg.execSigma ≈ 2,5°, l'urgence ×1,25,
   les notes le RAFFINENT — le monde non noté exécutait parfaitement, et c'étaient les statues
   qui masquaient cette perfection). Après : statue 49 → 3-8 %, prise en mouvement p50 0,00 →
   1,38-2,73 m/s, complétion 86 % (réaliste — avant : ~100 % dès que le receveur savait faire un
   pas). Bandes rebasées au monde vivant avec leur justification (passes/min [11 ; 24,5[ — le
   flipper d'origine était 25 À 94 % EN JEU ; le caractère posé est tenu par tenue/en-jeu/km-h),
   sabotage « match sans tir » bi-graine (le mono-graine devenait aveugle une re-donne sur
   trois). verify-match 58 clauses, rondo 40/40 au bit près, dribble 14/14, verrou 8,63, audit
   16/0, ALL-SYNC 7/7.

33. **Le répertoire des gestes — passement de jambes, crochet, feinte de frappe (« fais-les à la
   perfection, sans erreur de placement de membres »).** Trois gestes au niveau des trois
   premiers, même grammaire (situation nommée → tirage flair → startGesture → contact →
   accompagnement → abort nommé), clés de config AU MATCH SEULEMENT (le rondo refuse avant tout
   tirage — clause « inertie du rondo » qui THROW si un tirage part). LE PASSEMENT : jambe qui
   cercle PAR-DESSUS un ballon FIGÉ (pin), le buste ment, le jockey posté mord (0,4 s), sortie
   en burst nommé ; s'enchaîne librement sur un contrôle (l'assise bloquait pile sa fenêtre — 6
   fenêtres/4 matchs mesurées avant déblocage). LE CROCHET : course fermée (closing ≥ 0,8 — le
   jockey statique appartient au passement, la charge au râteau) → coupe à l'opposé (~80°),
   lacet balayé par la SIM (clip = membres seulement, comme le râteau), ballon en ARC 0,35 →
   0,5 m devant le regard interpolé — couple soudé 0,52 m mesuré, sortie à 1° du lacet. LA
   FEINTE DE FRAPPE : l'armé de `frappe` copié OS POUR OS (clause de ressemblance) puis la
   RETENUE (cuisse morte à 8° au lieu de traverser à 62), morsure longue (0,7 s — on ne se jette
   pas devant une demi-frappe), burst de sortie pour l'angle. En flux : crochet ~23, passement
   ~4, feinte de frappe ~2-3 / 4 matchs. LE LOT A DÉBUSQUÉ UN CSC MÉCANIQUE : le gardien
   « recevait » comme un joueur de champ — la table des contrôles sans technique légale pour sa
   géométrie laissait le ballon filer NON AMORTI avec l'étiquette de porteur, et la branche
   distributeur le faisait marcher À L'OPPOSÉ du ballon qui roulait au fond (5 des 6 buts sans
   tir). Trois lois de métier : LE GARDIEN PREND À DEUX MAINS (sa prise est un catch —
   tech 'prise-gardien', surface hands), LE DISTRIBUTEUR VÉRIFIE SES MAINS (ballon qui fuit vers
   son but = étiquette mensongère → il se retourne et étouffe), et LE UN-CONTRE-UN (un ballon
   lent DANS sa surface se CHARGE — sortie au-devant, keeperDecide mode 'sortie', l'extension
   annoncée par MOTEUR.md ; hors surface : jamais, clause anti-libéro). PLUS LA DOCTRINE DE
   L'AILE, née du diagnostic attributs (l'élite dominait possession 57 % et zone 609/378 mais
   tirait 10-10 — 195 refus « angle-fermé » : elle insistait le long de la ligne) : L'AILIER À
   ANGLE FERMÉ REPIQUE (le cut-inside — l'entrée de surface côté axe devient le point de mire),
   et LA BOÎTE COMMANDE L'AILE (des coureurs dedans → on reste large et on SERT, le crochet cède
   au centre ; boîte vide → on rentre). L'élite domine désormais AUX OCCASIONS (16-12) — et la
   clause du verdict attributs se lit là (le score d'un échantillon court est un tirage, 4:4
   mesuré deux fois). L'ESSAI CONSIGNÉ : le centre-intention (décider→préparer→s'engager posait
   6 intentions, 0 exécutée — l'intention injectée en plein dribble d'aile ne trouve pas ses
   portes dans son TTL ; l'approche pilotée du centre au backlog). verify-gestes 41 clauses
   (ressemblance os-pour-os, couple soudé en monde réel, morsures, inertie rondo, fixtures de
   déclenchement), verify-match 59, attributes 13, rondo 40/40 au bit près, verrou 8,63, audit
   membres 16/0, ALL-SYNC 7/7.

34. **Le porteur passe par son ballon (retour utilisateur en CAPTURES : « le joueur court et le
   ballon est à sa droite, même un peu derrière lui »).** Le diagnostic que les captures rendaient
   indiscutable : la cible de locomotion du porteur était la POUSSÉE PROJETÉE (p.target = corps +
   push × 3) — le plan — jamais le ballon réel. Quand le plan (EMA but/évasion) divergeait du
   ballon (pivot, déviation, touche contestée), le corps courait vers le plan et le ballon restait
   — jusqu'au rayon plat de 3 m ; et la pointe carrySurge ne libérait que la VITESSE, pas la
   direction : il courait plus vite du mauvais côté. Mesuré : 5,9 % du porté en course avec le
   ballon HORS DU CÔNE AVANT (> 75°) à > 0,9 m, dont 323 images ballon DERRIÈRE le corps,
   épisodes jusqu'à 1,2 s. Loi (cfg.carryViaBall, match) : au-delà de la portée de contrôle
   (0,85 m), LA CIBLE EST LE BALLON — routé un demi-pas au-delà dans le sens du plan pour le
   prendre dans la foulée ; le plan reprend au pied. Après : 0,6-0,7 % hors cône, derrière 323 →
   50 images (transitoires de pivot). Clause + sabotage « cible-plan » (5,7 % sans la loi) ; et
   la fixture du régime serré isole désormais LA TOUCHE en désactivant la collecte dans ses deux
   bras (le porteur-qui-passe-par-son-ballon tronquait le plateau des deux régimes — 1,43 contre
   1,54, fixture aveugle). verify-match 61 clauses, rondo 40/40, gestes 41, verrou 8,63, audit
   16/0, ALL-SYNC 7/7.

35. **Le Motion Warping devient une capacité moteur — et les gants du gardien la prouvent
   (« motion wrapping, on utilise ça ? » puis « oui vas-y mais oubli pas qu'on veut être un
   moteur comme unreal engine ou unity »).** Le warp de frappe (strike-warp) ÉTAIT du Motion
   Warping — planaire, un seul consommateur (le pied). Généralisé : planWarp3 (3D, mêmes quatre
   lois — enveloppe C¹, borné + refus nommé, standoff à la surface, dégénéré nommé) + HAND_WARP,
   et TROIS consommateurs : le pied de frappe, LE GANT DU PLONGEON (IK deux os épaule-coude-
   poignet, écrêtage de portée nommé), et LA RACINE (le bassin). Mesure fondatrice : à l'instant
   de l'arrêt (prise/claquette au registre sim), le gant le plus proche était à p50 **1,67 m** du
   ballon — l'arrêt était vrai en sim, faux aux gants. La chaîne des morts d'instruments, chacune
   mesurée : (a) enveloppe temporelle → les prises précoces plafonnaient à env 0,06 → enveloppe
   d'APPROCHE ; (b) l'arrêt sim se résolvait à l'entrée du rayon → résolution au PLUS-PRÈS
   (onDive suit la distance, résout quand elle cesse de fermer) ; (c) l'heure de contact authorée
   (0,55 s) ignorait celle du ballon → TIME-WARP du clip (l'autre moitié du Motion Warping,
   rate ∈ [0,8 ; 2,2]) ; (d) le clip unique était AÉRIEN (hanches +0,28 à l'extension) →
   l'espèce plongeonBas (hanches −0,5, bras rasants, choisie par cross.y) ; (e) LE PISTOLET
   FUMANT, débusqué par la sonde d'état : spec=« amorti » sur 5/7 arrêts — la prise émettait une
   réception, la scène jouait l'amorti PAR-DESSUS la détente, le gardien se REDRESSAIT à
   l'instant de l'arrêt (garde : un acte ownsBody garde son clip, seul son propre windup passe —
   charte loi 1) ; et wLegs 0,24 en pleine détente — byArrive lisait la détente (~6 m/s) comme
   une course et éteignait les jambes du clip (loi : le plongeon possède ses jambes d'emblée, la
   vitesse d'un corps balistique EST celle du geste) → p50 0,57 ; (f) l'enveloppe distance-clée
   était CIRCULAIRE (gant loin → env faible → gant reste loin) → clée sur BALLON-ÉPAULE (la
   vérité sim de l'arrêt) ; warpMax 1,1 mordait des arrêts légaux → 1,6 (la portée IK est la
   borne physique, warpMax n'est que le plafond de santé) ; (g) le résidu était l'ANATOMIE :
   bras à pleine extension, gant à dSB − portée exactement (0,68-0,88 m) — la portée sim de la
   prise (1,1 m du corps) dépasse un bras seul → LE WARP DE RACINE : hipsNudge (écrivain ADDITIF
   du bassin, delta monde converti par la matrice courante du parent), le bassin complète la
   détente vers le ballon, borné 0,45 m, plancher au sol, gelé et fondu comme le plan du gant —
   exactement le root-motion warping d'Unreal. APRÈS : p50 **0,27 m** (standoff 0,16 + rayon
   0,11 = le gant TOUCHE), corps couché (hanches 0,2-0,3 m) ; résiduel connu : l'arrêt-réflexe
   résolu à t = 0,03 (2 images de vol, claquette à 1,18 m — irréductible visuellement).
   L'INSTRUMENT COMPOSÉ : audit-gants.mjs (frère d'audit-membres, match.html headless, 4
   clauses — existence, gant ≤ 0,6 p50, corps couché sur les arrêts développés, sabotage nommé
   window.__sabotage='warp-gant' → p50 re-flotte à 0,91). Clause en-flux du répertoire élargie
   4 → 8 graines (la feinte de frappe sort ~0,5/graine : un échantillon de 4 est sous le
   plancher de bruit — la doctrine des bandes, appliquée à sa propre clause). verify-strike-warp
   23 (dont les lois 3D), gestes 41, match 61, rondo 40/40 au bit près, attributs 13, verrou
   8,63, audit-membres 16/0, audit-gants 4/0, ALL-SYNC 7/7.

36. **Le gardien distribue, le dépossédé se retourne, les gestes s'annoncent (retour utilisateur,
   trois points : « le gardien part toujours en dribble » ; « au duel… ils perdent un peu le
   ballon et courent toujours tout droit en 6 m » ; « j'ai du mal à distinguer les gestes —
   logge-les »).** LE GARDIEN : la sonde des épisodes porteur-gardien a montré des conduites de
   45, 58 et 87 M à ~6,5 m/s finies en sortie de balle — la branche distributeur posait un push
   AVANT constant et le cerveau de conduite générique en faisait un attaquant ; et le seuil de
   « fuite » à 0,9 m re-déclenchait la poursuite sur CHAQUE touche (cycle touche→sprint→touche,
   20-43 m, qui resettait le chrono au passage). Trois lois de métier : le porteur-gardien PASSE
   PAR SON BALLON vers son SPOT de distribution (via-ball, jamais vers l'avant — viser le spot en
   abandonnant le ballon à 2 m gelait le monde 84 s : ballon posé, label tenu, press au bord de
   la surface), LA RÈGLE DES SIX SECONDES (cfg.gkRelease 3 s : passé le délai, distribution
   FORCÉE — meilleure rampe par progression/couloir, sinon punt au flanc — le forceUrgent du
   centre, au service du gardien), et la fuite se lit AU-DELÀ de la portée de touche (2,2 m).
   Portes de cohérence : le gardien ne tire ni carrySurge ni gestes techniques (maybe* refusent
   c.keeper — neutre au rondo qui n'a pas de gardien). APRÈS : 22 épisodes/12 min, fins 19 pass
   / 3 turnovers / 0 sortie, durée p50 2,0 s max 5,5, distance p50 3,2 m max 18 (le max = le
   claim en sortie + le retour au spot — du métier). LE DÉPOSSÉDÉ : 92 des 254 pertes suivies
   d'une course ≥ 3 m à > 60° du ballon (p90 4,9 — le « 6 m tout droit ») : à l'instant de la
   perte, l'ex-porteur redevenait COUREUR DE SLOT et partait dos au jeu. Loi (cfg.lossReact
   1,6 s) : LE CONTRE-PRESS — l'ex-porteur chasse son ballon pendant la fenêtre, s'éteint dès
   que son équipe reprend, et ÉPARGNE le chasseur désigné de chaseLoose (l'écraser rendait la
   fixture orbite aveugle : la mène interceptPoint valait mieux que le ballon-immédiat). Après,
   au critère COUPABLE (ballon pas à son équipe) : p90 1,66, 2 cas ≥ 3 m sur 187. LES CLAUSES
   (3 decies, 6 nouvelles — verify-match 67) : flux gardien en bandes anti-régression LARGES
   (excursion max ≤ 25 m, durée p90 ≤ 6,5 s, existence ≥ 3) parce que le sabotage de flux ne
   mord PAS (sans gkRelease le cerveau organique distribue quand même sur ces graines — le
   release est un garde-fou) ; les MÉCANISMES sur fixtures déterministes : six-secondes (chrono
   mûr + ballon au pied → la passe part en 0,5 s ; sans la clé, rien — settleMin/holdCalm n'ont
   pas mûri, fenêtre discriminante) et contre-press (ex-porteur + chasseur naturel plus près :
   avec la loi il se retourne job press cible ballon, sans il repart en cover à 6 m). Décès
   d'instruments à la re-donne, réparés en conscience : la mesure « touche part où le pied
   veut » excluait désormais le GARDIEN (sa poussée via-ball vise son spot, souvent DERRIÈRE lui
   au retour de sortie — 144° sur 2-3 touches dominaient un p90 sur 14) ; la fixture orbite
   re-pose l'état transitoire du warmup (st._lossAt — une perte dans les 180 pas laissait une
   fenêtre vivante et find('press') attrapait le contre-presseur) ; regain p90 0,9 → 1,15 (4
   poussées = sous le plancher de bruit) ; tempo top 24,5 → 25,5 (le contre-press raccourcit
   les récupérations : +0,3 passe/min, un effet de loi — les clauses de tenue veillent au
   flipper). LE TICKER DES GESTES (habillage, match.html + scène) : chaque événement 'skill' au
   CONTACT s'annonce — nom français, équipe, numéro, minute, les 5 derniers ('passement-vendu'
   est le mordu du même passement, pas un second geste) — vérifié en headless (16 gestes sim,
   ticker peuplé). verify-match 67, gestes 41, rondo 40/40 au bit près, sync 7/7, audit-membres
   16/0, audit-gants 4/0 (p50 gant-ballon 0,20 sur cette re-donne).

37. **Deux sondes avant toute loi (le fil UE5 de purecontender, jour 42 — validation croisée
   demandée par l'utilisateur).** SONDE 1, le ratio de touche (sa loi : « the ball has to leave
   the foot ~1.27× faster than you're running ») : sur 6 graines × 120 s, touches de conduite
   LIBRES seulement (owner nul — la première passe de la sonde comptait les escorts du ballon
   porté et inventait des ratios < 1), à l'allure de course (3,5-5,2 m/s) : n=163, p25 1,25 /
   p50 1,26 / p75 1,26 / p90 1,31. SON 1,27 À ±0,01 — lui le tune à la main dans UE, nous le
   DÉRIVONS de la friction (pushSpeed = v + √(2·a·lead), touchDecel lit rollResist + traînée) :
   deux moteurs, deux méthodes, la même constante. Et la dérivation fait mieux qu'une constante :
   au trot le ratio mesuré monte à 1,35 (décoller un ballon coûte relativement plus à basse
   allure) — un ×1,27 plat y laisserait le ballon collé au pied. VERROUILLÉ en 3 clauses
   UNITAIRES de verify-dribble (17 clauses) : la bande [1,15 ; 1,45] sur la dérivation au régime
   serré, la signature « trot > course » (ce qu'un multiplicateur plat n'a pas), et le sabotage
   nommé « poussée plate ». SONDE 2, le plafond anisotrope (« sideways keeps it, forward is how
   you lose it ») : VERDICT PAS DE LOI. En touches libres, notre monde pousse à 92 % vers
   l'AVANT (166/181) — la touche latérale vit dans les gestes nommés (crochet, passement,
   râteau) et l'escort serré, pas dans la poussée libre (n=4 latérales : du bruit, mortalité
   inversée non significative). La mortalité avant (10,2 %) est déjà l'objet nommé du régime
   serré (carryTight : la touche pleine est un burst — Lot 3) ; un plafond directionnel
   ajouterait de la machinerie sans pathologie mesurée à corriger. La leçon de méthode reste :
   sa borne « avant ≠ latéral » est un bon instinct UE (l'avant change le timing effectif du
   contact), et si un jour nos pertes de conduite re-deviennent un retour utilisateur, la
   décomposition directionnelle de cette sonde est l'instrument à ressortir.

38. **La conduite qui se voit, le tir en course, le pique (retour utilisateur en captures : « il
   ne touche jamais le ballon… la défense n'arrive pas à lui prendre la balle… il va s'empaler
   dans le gardien sans rien tenter »).** La sonde a d'abord INNOCENTÉ le suspect : zéro image
   de ballon « téléguidé » (le porté-owner vit toujours ≤ 1,3 m) — les touches EXISTENT (détectées
   à ≤ 1,15 m, jambe tendue) mais AUCUN geste ne les montrait : le mensonge était au RENDU. Et
   elle a confirmé le reste : 11 approches à < 4 m du gardien, 0 tir (41 % des fenêtres
   d'approche muettes) ; le plus proche défenseur passait à 0,70 m du ballon (p50) sans aucun
   mécanisme pour le jouer. LA CHAÎNE DU TIR EN COURSE, débusquée refus par refus : le tir se
   faisait refuser 'technique' EN BOUCLE (146 fois sur une course — ballon de course à 1,2-1,4 m,
   hors de portée d'armement) ; la touche de préparation v1 (serrer le lead) n'a RIEN changé —
   frame-dump : la BANDE MORTE (entre la portée de touche 1,15 et le seuil de pointe 1,25,
   personne ne referme), puis l'AMORTISSEMENT D'ARRIVÉE (cible carryViaBall à +0,4 m → équilibre
   avec la décélération du ballon, bd cloué à 1,3), puis LA VRAIE NATURE DE LA TOUCHE : pushSpeed
   lit la vitesse du corps, donc toute touche « courte » RELANÇAIT le ballon à v+1 (7,0 mesuré à
   6,1 de course) — une touche de préparation n'est pas une poussée, c'est un AMORTI. Les lois :
   cfg.prepTouch (tryShot pose la fenêtre quand le couloir est ouvert et le ballon hors
   d'armement, refus nommé 'prépare-frappe'), le canal VITESSE touchDamp dans dribble.js (absent
   = 1, bit-près — l'amorti cale le ballon sous l'allure du corps, plancher 2,0), prepDamp 0,72,
   prepTouchF 0,3, la pointe s'arme à 0,95 pendant la fenêtre (la bande morte), la cible traverse
   le ballon (+2,2 m). Frame-dump APRÈS : bd 1,24 → 0,85 → possession → ballon calé 0,56 → le
   windup du tir démarre. Mesuré : 41 % → 13 % de fenêtres muettes (et les restantes finissent en
   passe d'angle fermé — un choix, pas un mutisme). LE PIQUE (cfg.pokeReach 0,5) : un ballon de
   conduite LIBRE est libre AUSSI pour l'adversaire — le pied qui le bat au point (marge 0,15 m,
   cooldown 1,2 s, ballon au sol) le DÉVIE (impulse à travers, événement 'pique', phase loose,
   50/50) ; 9 piques/4 matchs — le contest existe, sobre. LA TOUCHE QUI SE VOIT : l'événement
   'touche' (émis par les trois sites dribbleStep — le rondo l'émet aussi, bit-près préservé :
   40/40) + LE WARP DE TOUCHE dans la scène, QUATRIÈME consommateur du warp de contact (pied de
   frappe, gant, racine, pied de conduite) : autour de chaque touche (0,2 s, enveloppe sin C¹),
   le pied le plus proche est corrigé vers la surface (planWarp, IK deux os, écrêtage de portée,
   interrupteur de sabotage 'warp-touche'). Mesuré composé : pied-ballon à la touche p50 0,48 →
   0,32 m (322 touches). MORTS D'INSTRUMENTS À LA RE-DONNE, réparées : « vitesse moyenne à
   1,5-2,9 m » n'avait PLUS D'ÉCHANTILLON (les lois ont refermé ces écarts en croisière) →
   l'instrument suit son objet : TEMPS loin de sa touche par minute de conduite (0,0 avec la
   pointe, 8,2 sans — le sabotage mord plus fort qu'avant) ; volLegales exempte le pique (un
   acte adverse NOMMÉ n'est pas un vol d'étiquette). Clauses : 6 nouvelles verify-match (73 —
   conversion des approches ≤ 30 %, fixture préparation → tir en ≤ 1,5 s + sabotage
   « empalement », fixture pique + sabotage « défenseur-spectateur », sobriété du pique en flux),
   2 nouvelles audit-gants (6 — pied AU ballon p50 ≤ 0,45 + sabotage 'warp-touche').
   verify-rondo 40/40 au bit près, dribble 17, gestes 41, attributs 13, sync 7/7, audit-membres
   16/0. RESTE NOMMÉ (le lot suivant, cahier des charges utilisateur) : la VARIÉTÉ des dribbles —
   crochets chaloupés (Dembélé) et courts (Yamal), passements multi-tours (Mancini, Reveillère),
   sorties de dribble paramétrées (tout droit pour fixer, diagonale pour le contre-pied, arrière
   pour temporiser).

39. **La variété visible des dribbles (cahier des charges utilisateur : « du Dembélé, du Yamal,
   des crochets chaloupés ou courts ; des passements Mancini/Reveillère à tours variables, sortie
   tout droit pour fixer, diagonale pour le contre-pied, derrière pour temporiser »).** TROIS
   ESPÈCES DE CROCHET : le COURT (chop sec — 0,4 s, contact 0,14, la sim coupe ~52°, buste
   sobre), le STANDARD (0,55 s, ~80°), le CHALOUPÉ (0,8 s, contact 0,42 — le buste MENT d'abord :
   épaules/tête plongent du côté où il ne va pas, déport de bassin 6 cm en clés hips, PUIS
   l'intérieur coupe ~97° ; le défenseur qui fermait s'assoit au contact — morsure 0,35 s, même
   loi que le passement). Sélection par situation (le chaloupé veut du temps : foe ≥ 1,45 m et
   de l'allure ; le court vit au contact) + tirage seedé + flair. LE DOUBLE PASSEMENT : généré
   par RÉPÉTITION DE SEGMENT (repeatSegment — le cercle (0 ; 0,28] rejoué, durée/contact étendus
   d'un tour, os pour os le même cercle : une clause le vérifie clé par clé) ; deux tours quand
   le jockey est posté loin. LES SORTIES : il AVANCE → contre-pied (diagonale libre opposée) ;
   il COLLE (< 1,25 m) → temporiser (retour ~140°, PAS de burst — on protège) ; posté LOIN →
   le fixer (tout droit, burst renforcé 0,65 s) au tirage. En flux 8 graines : crochets 17
   courts / 7 standards / 5 chaloupés ; passements 7 contre-pied / 3 fixe / 1 temporise, 3
   doubles. Le ticker nomme tout (« crochet chaloupé », « passement ×2 (contre-pied) »).
   LE LOT A DÉBUSQUÉ DEUX VRAIS TROUS DE LOI : (1) LES GESTES NE LISAIENT PAS LES NOTES — un
   dribbling 35 tentait et vendait comme un 82, et les espèces amplifiaient ce pouvoir gratuit :
   le verdict attributs s'est INVERSÉ (élite 61 tirs contre 69 sur 16 graines). Lois : gesteF
   (attributs, dribbling → engagement × [0,55 ; 1,10] et durée de morsure), et LE PIQUE SE
   RÉUSSIT À LA NOTE (tirage 0,5-0,95 par tackling — sans lui le pique offrait des récupérations
   SANS duel à l'équipe qui défend le plus). Après : élite 70-45, score 11:8 (16 graines).
   L'instrument du verdict passe à 10 graines (les tirs d'un échantillon court sont un tirage —
   sa propre leçon, un cran plus loin). (2) LE PIQUE VOLAIT LE BALLON PENDANT UN ACTE ownsBody
   (le pin du passement) → carry() sur ballon libre, la garde du BallBody a crié pendant le
   sabotage sans-tir : le pique respecte l'acte (charte loi 1), et un geste dont le ballon a été
   soufflé S'INTERROMPT nommé (ballon-souffle-pendant-crochet/passement — défense en
   profondeur). MORTS D'INSTRUMENTS à la re-donne, réparées en conscience : fixtures crochet
   élargies aux espèces (l'espèce est LIBRE, la clause juge l'armement et la coupe 45-100°) ;
   fixture passement accepte simple/double ; le stub rnd des fixtures de sortie est SÉQUENTIEL
   (un scalaire haut refusait l'engagement avant d'atteindre le choix) ; flux gestes 8 → 12
   graines (la feinte de frappe : 5/12) ; « des remises existent » sur horizon élargi ET LE
   DÉFICIT NOMMÉ : 4 sorties sur 24 min (le réel vit à une par 30-60 s — conduite serrée +
   amorti + contre-press + pique gardent tout dedans ; chantier backlog : tirs hors cadre →
   sortie de but, pique en touche) ; le sabotage trottinement en FIXTURE déterministe (regain
   2,73 s avec la pointe, 2,92 sans — écart 0,19 s au bit près, pas de marge de bruit à payer ;
   l'écart est modeste parce que carryViaBall borne la poursuite par l'amortissement d'arrivée).
   Nouvelles clauses verify-gestes : 50 (chaloupé MENT/court sobre, trois durées, double os pour
   os, 2 fixtures d'espèce, 3 fixtures de sortie, variété en flux ≥ 2 espèces + ≥ 2 sorties).
   verify-match 73, attributs 13 (10 graines), rondo 40/40 au bit près, dribble 17, sync 7/7,
   audit-membres 16/0, audit-gants 6/0.

40. **Le corps du plongeon (retour utilisateur : « beaucoup de glissades, les positions font
   presque de la téléportation ; ils se relèvent trop vite ; pas au bon endroit ; il plonge du
   mauvais côté »).** Mesuré AVANT, en composé : hanches rendues à 122 m/s (p50 du pic par
   plongeon !), corps rendu à 1,19 m (p50) du corps sim à la fin du geste, et le voyage sim
   pendant la détente p50 2,37 m / p90 4,01 pour un écart réel au ballon de ~1,9 — LE CORPS
   TRAVERSAIT le point d'interception (la vitesse était calée pour couvrir l'écart dans cross.t
   mais courait la durée pleine de l'armé) : le ballon finissait DERRIÈRE le gardien, de l'autre
   côté — le « il se déplace plus loin que le ballon » des captures. CINQ LOIS : (a) LA DÉTENTE
   S'ARRÊTE AU POINT (lungeMax = min(1,35, écart + 0,2) — 1,35 = le root motion du bassin ; au-
   delà, l'envergure est le métier des BRAS : gants à 2,1 par l'IK + warp) ; (b) LES CLIPS SE
   RELÈVENT SUR PLACE (les clés finales gardent le déport latéral — ramener les hanches à
   [0,0,0] faisait RECULER le corps de 1,35 m pendant le relevé) ; (c) LA RÉCONCILIATION DES
   DEUX VOYAGES : canal de biais dans l'écrivain des hanches (delta appliqué = clip − voyage
   sim, en axes personnage) — le dessin domine tôt, converge vers la sim, le fondu part de ≈ 0 ;
   l'état vit avec LE CLIP (pas l'acte — nettoyer sur l'acte laissait la fin sans biais) et se
   re-pose sur acte jeune ; (d) LE TIME-WARP AVANT-CONTACT SEULEMENT (l'horloge repasse à ×1
   après le contact — le rate ×2,2 rejouait le couché-relevé en accéléré : debout en ~0,5 s, le
   « ils se relèvent trop vite ») + keeperDown 0,75 → 1,15 s (le sim couvre le relevé réel) ;
   (e) LE MIROIR SE JUGE AU MODÈLE — la trouvaille du lot : « cross.z > gk.z → gauche » était
   une convention MONDE, vraie pour un gardien et inversée pour celui d'en face — LA MOITIÉ DES
   PLONGEONS SE JOUAIENT MIRRORÉS À L'ENVERS (clip dessiné à l'opposé de la détente, hips à
   2,5 m du corps : le vrai « il plonge du mauvais côté », pendant que le CÔTÉ SIM était sain —
   1/22). Deux conventions sim (camp, produit vectoriel au regard) ont encore échoué (offset de
   facing du rig, lissage du regard rendu) ; le juge fiable est la scène : le lunge projeté sur
   la DROITE RÉELLE du modèle (colonne X de sa matrice monde) choisit le côté du clip, et le
   warp du gant suit le même côté. APRÈS : écart corps rendu-sim p50 1,19 → 0,28 m, vitesse
   hanches p50 122 → 15,9 m/s (résiduel connu : les re-plongeons enchaînés — un changement de
   clip sans blend). Le sabotage a aussi débusqué DEUX gardes manquantes : le râteau et la
   semelle sans protection « ballon soufflé » (le claim du gardien peut souffler leur ballon en
   plein geste — label-bouclier aboli, c'est voulu) → abort nommé uniforme sur les cinq gestes à
   carry. CLAUSES : audit-gants 9 (relevé-au-lieu p50 ≤ 0,5, pas de téléport p50 ≤ 30 m/s,
   sabotage nommé « plongeon-monde » : la convention naïve rejoue le mauvais côté, 2,39 vs
   0,28) ; bandes re-calées en conscience : gant 0,6 → 0,65 (re-donne du miroir corrigé),
   conversion plancher 8 → 5 % (le monde tire plus — 49 tirs/6 graines, 4 graines à 6 % vs 6 à
   10 %), respiration plafond 95 → 98,5 AVEC la dette des sorties re-nommée (4/24 min — le
   chantier du backlog borne l'extrême, la clause ne le remplace pas). verify-match 73, gestes
   50, rondo 40/40 au bit près, attributs 13, sync 7/7, audit-membres 16/0.

41. **La conduite poursuivie colle, le passement lancé, la remise qui ne mime plus (trois
   retours utilisateur).** (1) « Le ballon en contre-attaque avec un défenseur collé est bien
   trop loin du pied — il devrait être LIÉ » : mesuré 29,4 % du temps poursuivi (v > 4,5,
   foe ≤ 2,5) à plus de 1,5 m du ballon. Réduire le lead (cfg.carryGuard 0,4) n'a PAS suffi —
   pushSpeed ≥ v, chaque touche « courte » repartait au-dessus de l'allure : LA TOUCHE PROTÉGÉE
   AMORTIT (guardDamp 0,88, le canal touchDamp du lot 6a), en course seulement (v ≥ 4 — à basse
   allure l'amorti créait des excursions lentes, 4,5 s/min mesurés). Les flux comparatifs ont
   menti TROIS fois (n de 191 à 940 selon la re-donne) — la fixture déterministe a tranché :
   poursuivi 200 images, ballon PLAQUÉ à max 1,06 m ; saboté (« touche de fuite ») : ballon
   perdu en 31 images. La dérive après contact du défenseur reste LÉGITIME (le retour le disait
   lui-même). (2) « Je n'ai toujours pas vu de passement » : l'espèce manquante était LE LANCÉ —
   le cercle en course sur un jockey qui RECULE devant (2,5 < v ≤ 6, closing < 0,6), SANS pin
   (on n'épingle pas un ballon en course : il roule sous le cercle, la conduite protégée le
   garde devant), le corps glisse freiné à 45 %, jambes POSSÉDÉES (même loi que le plongeon —
   la fusion locomotive aurait éteint le cercle) ; fréquence de base 0,25 → 0,32 : 18 passements
   / 8 graines (4 lancés + 14 calés) contre 11 avant ; le ticker affiche « passement lancé ».
   (3) LA CONFIRMATION DEMANDÉE (« quand il y a un but, le joueur ramène le ballon en faisant
   des passements — c'est ça le mouvement ? ») : OUI, confirmé, et NON ce n'était pas un geste —
   le porté de remise escortait le ballon à 0,35 m du corps, SOUS les pieds du marcheur : chaque
   foulée l'ENJAMBAIT, l'œil lisait des passements en boucle. Le ballon roule désormais DEVANT
   les pieds (0,75 visé, servo 0,045 — au tau 0,06 le ballon TRAÎNAIT derrière sa cible mouvante
   et revenait sous le corps). Clauses : fixture poursuite + sabotage « touche de fuite »
   (verify-match 76), porté de remise p25 ≥ 0,42 devant, passement lancé + « sprint refusé »
   (verify-gestes 52). Instruments re-calés en conscience : « où le pied veut » gardé à ≥ 10
   touches (le régime protégé raréfie les touches vives) ; audit-gants — gant 0,85 (re-donne),
   touches jugées p50 ET p90 avec sabotage au p90 (la médiane est noyée par les touches
   déjà-serrées du monde protégé, le warp agit sur les LOINTAINES : 0,75 avec / 1,14 sans,
   prouvé à la sonde avant de re-caler — l'instrument suit son objet, pas l'inverse).
   audit-gants 9/0, audit-membres 16/0, rondo 40/40 au bit près, sync 7/7.

42. **Le 11 contre 11 — la promesse tenue (« tu pourrais faire une autre version en 11v11 ? un
   autre projet a une tuyauterie de match tellement complexe que le rendu 3D est horrible — je
   veux m'assurer que 22 joueurs tournent de façon fluide »).** LA DÉMONSTRATION D'ARCHITECTURE :
   makeMatch({ full: true }) et RIEN d'autre — terrain Loi 1 (pitch.js#FULL, qui attendait
   depuis le début), 10 + gardien par équipe, et le SEUL module nouveau est formation.js (~70
   lignes : postes 4-3-3 en fractions du terrain, bloc qui coulisse ± 18 % avec le ballon,
   respiration attaque/défense ×1,05/×0,85, checkFormation — lignes ordonnées, largeur, bloc
   mobile). La greffe dans assignMatchJobs : les couloirs dynamiques du réduit RÉSERVÉS au
   soutien rapproché (4 plus près de l'ancre), le marquage borné à 4 + press + cover, tout le
   reste TIENT SON POSTE coulissé (p.post posé à makeMatch — le 9 reste le 9) ; cadence à-coups
   identique. La scène : ?full → stade paramétrique aux DÉFAUTS (déjà plein format), caméra
   passerelle 47 m/40 m de haut, perTeam 10, matchCfg({ shotRange: 20 }) — une page
   (match11.html) qui force la config comme match.html force la sienne. MESURES DE FLUIDITÉ (la
   question du retour) : sim 22 joueurs 0,38-0,44 ms/step node ; update scène COMPLET (sim +
   couches de gestes + IK + warps + regard × 22 corps) 3,65 ms/image ; fps 22 corps = 75 % du
   fps 12 corps en rasterisation CPU headless (le pire cas absolu — 1,14 M triangles skinnés au
   CPU ; sur GPU réel le skinning est trivial) ; draw calls 104 (MOINS que le réduit, 119 — le
   stade domine). L'architecture scale : AUCUNE tuyauterie ajoutée, le rendu du 22-corps est le
   rendu du 12-corps. verify-match11.mjs (9 clauses) : formations saines ×2, 22 joueurs Loi 1,
   budget sim ≤ 1,5 ms/step, le jeu VIT (57 passes/3 min), jamais de gel > 25 s, checkMatch
   tient à 22, le bloc tient ses postes (60 % couverts — les ~6 actifs par équipe désertent pour
   JOUER, c'est le football ; la clause calibrée au monde mesuré, pas à l'a priori), et le
   sabotage « essaim » (st.full coupé : dispersion 15,2 → 9,4 m — la formation OCCUPE le
   terrain, les couloirs du réduit s'agglutinent). DETTES NOMMÉES du plein format : l'équilibre
   de jeu (2 tirs/3 min — shotRange 20 posé mais le bloc de 10 étouffe l'approche : le réglage
   du 105 m est un chantier à part), un but-sans-tir aperçu graine 3 (à sonder), LOD/instancing
   si un device réel plafonne (1,14 M tris). Le réduit INTACT : match 76/0, rondo 40/40 au bit
   près, sync 7/7 (formation.js dans les trois copies).

43. **La fluidité du 11c11 au téléphone (« ça lag, c'est pas fluide — mais au moins il n'y a pas
   de téléport »).** Le lag mobile était TROIS multiplicateurs cumulés, tous côté rendu (la sim
   à 0,38 ms/step n'y était pour rien) : le pixel ratio (cap global 2 — un téléphone DPR 3
   pousse 4× les fragments d'un laptop dans la chaîne de post), la passe d'OMBRE (squad.js pose
   castShadow sur TOUS les meshes : 22 corps skinnés se re-déforment une DEUXIÈME fois par image
   dans la shadow map 2048²), et le tier 'high' par défaut. Trois économies PLEIN FORMAT
   SEULEMENT (le réduit intact) : (a) DPR capé à 1,5 (≈ 44 % de fragments rendus au GPU vs le
   cap 2) ; (b) LE BUDGET DE CASTERS — à 2 Hz, seuls les 8 corps les plus près du ballon paient
   la passe d'ombre (l'œil ne lit pas l'ombre d'un corps à 40 m dans un cadre de 105 m) + map
   1024² (4× moins de texels) ; (c) tier 'low' par défaut sur écran étroit (?q=high le
   rétablit). Vérifié ACTIF en conditions téléphone simulées (390 × 844, DPR 3) : tier low,
   DPR 1,5, 8/22 corps casters (56/154 meshes dans la passe d'ombre). Le banc headless CPU-GL ne
   peut PAS mesurer ces gains (DPR 1, 960 px, pas de GPU) — la sonde de conditions remplace la
   mesure de fps là où l'instrument est aveugle, et le juge final est le device réel. Prochaine
   marche si un téléphone plafonne encore : le LOD des corps (1,14 M tris skinnés — dette
   nommée depuis le lot 9).

44. **La Loi 11 et les appels timés (lot 10 — le premier étage d'intelligence off-ball).** Le
   hors-jeu est UNE ligne (l'avant-dernier adversaire, tenue par le ballon, jamais dans sa
   moitié — `offside.js`, pur, contrat `checkOffside`) et UN instant (le DÉPART du ballon :
   `strikeNow`, pas le choix ni la réception — c'est ce qui rend l'appel timé possible). Quatre
   consommateurs, tous gardés par `cfg.offside && st.full` (réduit = futsal sans hors-jeu, loi
   du format ; rondo au bit près — 40/40) : le CERVEAU (choosePass écarte, beginPass refuse —
   refus nommé 'hors-jeu'), la PHOTO (st.pass.off à la frappe, dégagements et tirs compris),
   le SIFFLET (premier toucher d'un marqué → receive lève st._whistle → coup franc ADVERSE
   administré par le match, même cérémonie portée qu'une sortie, cause de release
   'arrêt-de-jeu'), le CALAGE (pointes 7-9 bornées à ligne − 0,8, relues chaque image). DEUX
   mensonges a-priori corrigés par la mesure : (a) « le trio campe derrière la défense » —
   faux, le bloc adverse recule si bas que le camping illicite vaut 0-1,1 % du temps de
   possession AVANT calage (le calage n'est pas un remède, c'est la loi qui tiendra toute
   hauteur de bloc future) ; (b) le premier appel profond était une DÉCORATION (dart visant une
   ligne à ~16 m du poste, porteur hors portée : 21-29 appels/180 s, 0-1 servi — la maladie
   déjà enterrée au rondo « 5 servis sur 74 »). Le remède mesuré : l'appel ne se déclenche que
   SERVABLE (pointe à ≤ passRange − 0,5 du ballon ET devant lui, porteur posé, couloir profond
   `laneClearance`, un par équipe, cooldown 10 s), le dart est borné (+7 m, jamais au-delà de
   la ligne), et `appelRange: 6` étire l'enveloppe de choosePass pendant la fenêtre `_pace`
   (un ballon dans la course est PLUS LONG qu'une passe de circulation — sans l'extension, le
   coureur sortait de passRange 13 en 0,6 s). L'extension a d'abord FUI dans le réduit (les
   bursts cadencés portent aussi kind 'appel' → un monde calibré 76 clauses a bougé, tempsLoin
   4,6 > 2,5 — attrapé par la sentinelle, pas par moi) : garde st.full posée sur le terme, comme
   sur toute pièce de la Loi 11. Après : 2-5 appels/180 s, 3 servis sur 10 (27 % —
   un appel réel n'est pas toujours servi), pointes illicites ≤ 0,4 % pire graine, tirs stables,
   gel ≤ 0,4 s. Banc : verify-match11 9 → 17 clauses (contrat de la loi, refus sur fixture
   déterministe 26 m/ligne 18, onside d'un cheveu 17,8 non refusé, sabotage nommé « ligne
   aveugle » offside:false — la porte meurt, les AUTRES lois jugent encore ('course') —,
   sifflet → coup-franc/équipe adverse/ballon rendu, appels [3;36] + ≥ 1 servi + calage ≤ 4 %
   absolu : la clause comparative de flux serait un mensonge ici, le bloc profond rend les deux
   mondes semblables — doctrine du lot 8, les fixtures portent le sabotage). HUD : l'événement
   'hors-jeu' entre au ticker des gestes (ambre) — un coup franc sorti de nulle part serait un
   bug aux yeux de l'utilisateur. Suites : match 76/0, gestes 52/0, dribble 17/0, attributes
   13/0, membres 16/0, gants 9/0, match11 17/0, sync 7/7 (82 modules — offside.js dans les
   trois copies).

45. **Le pressing à déclencheurs, l'ombre de couverture — et le gel de 145 s (lot 11).** Une
   équipe ne presse pas TOUT LE TEMPS : elle presse SUR SIGNAL, en fenêtre bornée — le patron du
   contre-press lossReact (un réflexe par-dessus les postes) porté à l'échelle de l'ÉQUIPE, gardé
   cfg.pressTriggers && st.full. Deux signaux lisibles dans l'état sans oracle : la PRISE DOS AU
   BUT (porteur reçu tourné vers son but, dans son camp, hold < 0,5) et la PASSE EN RETRAIT de
   la relance basse. Effets de fenêtre : second presseur sur le pivot (le cover est LE pari
   perdu du pressing — assumé et visible), marquages au demi-pas (1,4 → 0,95 m, cadence 0,35),
   bloc posté +3,5 m vers le ballon. L'OMBRE (cfg.coverShadow) : le presseur arrive PAR le
   couloir du soutien le plus profond — du POSITIONNEMENT (laneClearance mesure des corps
   réels), pas une règle de plus ; à 2,6 m l'ombre cède au duel. TROIS leçons de mesure :
   (a) le retrait déclenchait sur toute passe arrière — 16-18 fenêtres/180 s, 40 % du temps
   sous press, un état permanent déguisé en réflexe → gate relance basse (origine < −4 m) :
   6-11 fenêtres, ~2-4/min ; (b) la compression moyenne des 10 corps NE BOUGE PAS (diluée) —
   l'instrument honnête du pressing est LA LIGNE : la ligne de hors-jeu adverse descend de 9 à
   18 m pendant les fenêtres (23-27 m contre 35-41 au calme — le bloc qui monte fait exister la
   Loi 11 en flux) ; (c) le pressing a EXPOSÉ un trou latent du moteur : une passe de 3,3 m/s
   sous fenêtre meurt au sol à 0,6 m de son receveur — phase 'flight' sans sortie (le receveur
   vise le rendez-vous d'un vol FINI, le presseur campe sur le ballon sans droit de prise :
   freeBall exige 'loose', et la garde releaseClear — « le ballon doit quitter son origine » —
   verrouillait la prise POUR TOUJOURS). Gel de 145 s, graine 3, au premier essai. DEUX lois le
   ferment : deadFlight 0,55 (un vol mort — sol + arrêt 0,3 s — est un ballon LIBRE ; st.pass
   SURVIT, la photo de la Loi 11 juge le premier toucher d'un ballon mort) et releaseTtl 0,5
   (la garde anti-auto-interception a une HORLOGE — une protection pensée pour l'instant du
   départ ne verrouille pas l'éternité ; absente au rondo : ∞, bit près prouvé). Le gel est
   RESSUSCITÉ en sabotage nommé au banc (fixture du monde exact de la graine 3 : avec les lois,
   résolution < 2 s et le monde repart en contre ; sans elles, personne ne prend jamais ce
   ballon). Et une leçon de banc : juger l'état À 2 s condamnait la guérison (le monde guéri
   était reparti jouer, nouvelle passe en vol) — la clause juge LA RÉSOLUTION, pas la photo
   finale. verify-match11 17 → 27 clauses (signaux sur fixtures, sabotages « press sourd » /
   « press en ligne droite » / « gel », flux graine 3 : fenêtres [3;20], ligne −14,9 m en
   fenêtre, régain ≥ 1, gel max 0,3 s). HUD : événement 'press' au ticker (bleu). Suites :
   rondo 40/40 bit près, match 76/0, gestes 52, dribble 17, attributs 13, membres 16, gants 9,
   sync 7/7, build ✓.

46. **L'arbitre de menace on-ball — le cerveau devient un contrat (lot 12).** La demande de
   fond (« un moteur comme Unity/Unreal, réutilisable sur différents projets ») appliquée au
   cerveau du porteur : QUATRE options (tir/centre/passe/conduite) notées sur UNE échelle
   (menace.js, pur, chaque note porte son pourquoi), un gagnant, et le contrat d'injection —
   cfg.decide remplace la POLITIQUE entière pendant que le moteur garde l'EXÉCUTION (les portes
   nommées de tryShot, les couloirs de choosePass : l'arbitre propose, la loi dispose). Pas de
   seconde vérité : menaceTir note avec laneClearance et les seuils de tryShot, menacePasse
   note L'ÉLU du vrai choosePass (progression + liberté), menaceConduite mesure l'espace réel
   du cône (±35°, 9 m), menaceCentre les portes de tryCross. Consommation chirurgicale :
   l'ordre figé tir-puis-centre de la boucle porteur devient un choix (gardé cfg.menace &&
   st.full — rondo ET réduit à l'ancien ordre, au bit près : 40/40 + 76/0), mémoïsé 0,25 s,
   événement 'arbitre' au changement d'avis (dernier tiers) pour la lisibilité. MESURÉ
   avant/après (4 graines × 180 s) : les refus « angle-fermé » s'effondrent de 18-171 par
   match à ZÉRO partout (l'ailier du couloir ne canonne plus dans un mur — il sert la surface
   ou il porte), prépare-frappe en baisse (~30-17), tirs STABLES (12→12 au total), les quatre
   options gagnent chacune quelque part en flux (seed 4 : 6 tir / 10 conduite / 13 passe / 2
   centre). Une leçon de fixture : mon premier « mur » était devant le but mais HORS de la
   géométrie des couloirs de coin (0,71 m de marge restante — le tir gagnait quand même, et le
   sabotage passait pour la mauvaise raison) → le mur du banc vit SUR les couloirs (z ±1,6 à
   mi-distance), et le sabotage exige désormais « couloir-serré » (choisir un MAUVAIS tir, c'est
   ça, la maladie du cerveau d'un seul geste). verify-menace.mjs : 11 clauses (quatre gagnants
   en fixtures, pureté, sabotage nommé, injection prouvée par CONTRASTE — un decide aval qui
   force la conduite éteint la machinerie de tir devant un but ouvert, 90 images). Buts
   toujours 0 en 180 s (dette conversion nommée, inchangée — l'arbitre choisit MIEUX, il ne
   règle pas la finition). Suites : rondo 40/40, match 76/0, match11 27/0, menace 11/0, gestes
   52, dribble 17, attributs 13, membres 16, gants 9, sync 7/7, build ✓.

47. **Le cycle de match + la chasse aux buts fantômes (lot 13).** L'enveloppe PRODUIT :
   cfg.chrono {periodes, duree, pause} — mi-temps sifflée à l'heure, l'AUTRE équipe engage
   (Loi 8, alternance), sifflet final → st.fini + restart 'fin' (état terminal calme : 0
   événement, 0 déplacement), possession accumulée en temps de sim (delta d'horloge, aucun dt
   dans les hooks), et feuilleDeMatch(st) — score, buts à la minute, tirs/arrêts/passes/centres/
   hors-jeu/coups francs/pressing par équipe, possession % — tout depuis les événements, aucune
   seconde vérité, déterministe octet pour octet (verify-chrono, 11 clauses + sabotage « match
   sans fin »). HUD : MT1 02:14 → TERMINÉ. Clé absente : les mondes d'aujourd'hui au bit près.
   LA CONVERSION ensuite — trois « buts » sur quatre étaient des FANTÔMES, débusqués en chaîne
   sur matchs complets (2×180 s) : (a) l'échappée ne PENSAIT jamais — tout le bloc de décision
   du porteur exige reachNow (ballon au pied), et en course poussée le ballon vit à 1,2-1,4 m
   devant : gachetteNear ouvre le bloc ballon-en-avant près du but (st.full — trois greffes
   d'arbitre bit-identiques avant de trouver CETTE serrure, leçon : instrumenter la BRANCHE,
   pas l'aval) ; (b) le CSC en fuite — l'évasion pure d'un porteur acculé pointait DANS son
   propre filet : la poussée se rabat le long de la ligne près de son but (rayon à l'échelle du
   terrain 0,42·hx — le 22 m plat étouffait le réduit, tempsLoin 7,1, attrapé par la
   sentinelle) ; (c) le CSC du GARDIEN — son spot de distribution (z ±3,5) vivait DANS la
   bouche du but (poteaux ±3,66) : le porté via-ball sur-vise (l'équilibre de NOTES 38), le
   ballon déborde et roule entre les poteaux — le spot vit au COIN des six mètres désormais.
   Après : scores 2-0, 1-0, 2-1, 2-1 (≈ 2 buts/match, du football), menaceConduite voit le
   gardien dans son cône (filet-ouvert reste légitime), fenêtre sortie-reprise à l'échelle
   (0,19·hx : un corner du 105 m se porte en 7,4 s). MÉTHODE : les chiffres du lot 12 (« 0
   but ») venaient d'une sonde non reproduite par le code commité — cause non identifiée malgré
   six isolations (déterminisme prouvé inter-runs, inter-configs, inter-commits) ; les chiffres
   font foi ICI, re-mesurés à process frais. Dettes nommées : pas d'échange de camps ni de
   temps additionnel ; conversion des tirs cadrés encore généreuse (~57 % — le gardien
   n'arrête presque rien de loin) ; le réduit sans tir contesté. 279 clauses vertes (chrono 11,
   menace 11, match11 27, match 76, rondo 40/40 bit près, gestes 52, dribble 17, attributs 13,
   membres 16, gants 9, sync 7).

48. **Les quatre moments du jeu (lot 14 — le socle de la tactique).** Réponse au cadrage
   utilisateur (« poste, rôle, attributs, tâches — dans une tactique collective avec phases
   offensives/défensives/transitions ») : le moment COLLECTIF devient une donnée dérivable.
   phases.js pur : momentDuJeu(st, team, win) → attaque-placée / transition-off /
   défense-placée / transition-def / arrêt — dérivé de QUI a le ballon et DEPUIS QUAND
   (l'horloge du regain st._possChangeAt, tenue par match-sim sous cfg.moments {win:5},
   événements 'moment' transition/placée — flux réduit/rondo inchangé d'un bit : événements
   seuls, consommateurs gardés st.full). DEUX consommateurs mesurés : le CONTRE-PRESS d'ÉQUIPE
   (3ᵉ signal du pressing du lot 11 — perte jeune < 2,5 s ET haute → fenêtre 'contre-press' ;
   le Gegenpressing que lossReact ne faisait qu'individuellement) et la VERTICALITÉ du regain
   (cooldown d'équipe des appels profonds relâché de 2,5 s en transition offensive). Mesuré
   (3 graines × 180 s) : 48-54 % du jeu ouvert en transitions (réel ~40-50), 3-8 fenêtres
   contre-press/match (12-13 fenêtres de press au total — cadence tenable), scores 1-2 buts,
   gel ≤ 0,4 s ; les appels n'ont PAS augmenté (1-2 — la relaxation est douce : l'appel exige
   un porteur posé, rare en transition ; honnête, gardé). verify-moments.mjs 8 clauses :
   contrat pur (jeunesse, miroirs, arrêt, fenêtre paramétrée), miroirs conjugués en flux
   (~60 lectures — la première borne exigeait > 300, erreur d'arithmétique du BANC consignée),
   causalité transition→placée par équipe, distribution [30;65] %, contre-press ≥ 1, récit
   déterministe octet pour octet, sabotage « jeu sans moments » (0 événement, 0 contre-press).
   Chemin ouvert : tactics.js (lot 15) consommera les moments (hauteur/largeur/agressivité par
   moment), les rôles (lot 16) aussi (qui contre-presse, qui reste). 287 clauses vertes.

49. **La tactique d'équipe injectable (lot 15 — tactics.js).** « Penser à tous les styles » ne se
   fait pas par une liste : par CINQ AXES orthogonaux [0..1] qui génèrent l'espace —
   hauteurBloc (postes défensifs −6…+6 m), largeur (postes offensifs ×0,85…1,15), pressing
   (sévérité des 3 signaux + durée/cooldown des fenêtres du lot 11), style possession↔direct
   (poids de l'arbitre PAR ÉQUIPE ±30-35 %, cadence des appels), transition conservation↔contre
   (la relaxation du regain du lot 14, 0…5 s). Les presets (equilibre, gegenpressing,
   possession, blocBas, direct, largeEtCentres) ne sont que des points nommés ; un projet aval
   en pose d'autres : makeMatch({ tactics: ['gegenpressing', 'blocBas'] }) ou objets partiels.
   LE DÉFAUT EST L'IDENTITÉ : chaque paire (bas, haut) a pour MILIEU l'ancienne constante des
   lots 10-14, et axe(0,5) rend le milieu EXACT — la forme bas+0,5·(haut−bas) rendait
   1,0000000000000002 et l'identité au bit près mourait d'un ulp (attrapé avant le banc).
   Toute la batterie 10-14 verte au bit près = la preuve d'identité. TROIS leçons de mesure :
   (a) les signatures multi-axes se CONFONDENT (deux tactiques opposées changent QUI défend —
   tout instrument non normalisé ment) → sondes mono-axe, adversaire au défaut ; (b) hauteur
   (+8,3 m de ligne) et largeur (+4,2 m de trio) se prouvent en FLUX ; pressing et style ne s'y
   prouvent PAS (les déclencheurs de la graine vivent aux extrêmes des bandes ; ±20 % de poids
   n'a JAMAIS basculé un choix en 150 s — flux bit-identique) → preuve au MÉCANISME : fenêtres
   3,2/5,8 s et retour 13,2/7,8 s sur fixture dos-au-but ; style sur monde à QUASI-ÉGALITÉ
   (mur desserré ±2,05 : possession → passe, direct → tir — même monde, deux footballs ; un
   choix dominant reste dominant, la tactique ORIENTE) ; (c) l'instrument de flux
   pressing/style/transition reste une dette nommée, comme le catalogue de formations
   4-4-2/3-5-2 (la couche RÔLES généralisera « postes ≥ 7 »). Sabotage « tactique placebo » :
   presets échangés ⇒ récits différents. verify-tactics 8 clauses ; 295 clauses vertes.

50. **La volumétrie est une dette comme une autre (lot 16a — le découpage prouvé).** Demande
   utilisateur : « éviter des fichiers d'une volumétrie non maintenable » — mesuré : match-sim
   1 575 lignes (six lots de greffes accrétées), rondo-sim 1 884. Découpage de match-sim en
   FAMILLES COHÉSIVES : referee.js (285 — tout ce qui ARRÊTE et REMET le jeu : onOut, canTake,
   ballFetch, administerWhistle, chronoStep, feuilleDeMatch, engagements) et shooting.js (158 —
   tir/centre/dégagement) ; match-sim → 1 160 (config, makeMatch, le cerveau des métiers,
   contrat). Ré-exports en place : AUCUN consommateur ne change (bancs, scènes). La preuve
   d'inoffensivité : les 295 clauses au bit près, y compris les récits déterministes. Et le
   GARDE-FOU au banc (verify-sync 8ᵉ clause) : plafond 1 250 lignes par module, rondo-sim
   toléré 1 950 en dette nommée — le cœur prouvé par 40 clauses se découpera avec le même
   soin, pas à la hache. La volumétrie ne peut plus régresser en silence.

51. **Les rôles par poste (lot 16b — roles.js).** La troisième couche du cadrage utilisateur :
   le poste dit OÙ (formation), le RÔLE dit QUOI (biais persistants), l'attribut dit COMMENT ça
   réussit — composées, jamais confondues. Catalogue (polyvalent, neufDeSurface,
   ailierDePercussion, meneur, piston) — chaque rôle = profondeur de poste ±2,5 m (le calage
   Loi 11 garde le DERNIER mot), largeur personnelle ×0,9…1,1 (composée avec la largeur
   d'équipe), cadence d'appel personnelle (cooldown 14…6 s), poids d'arbitre ±15 % (composés
   avec le style d'équipe ±35 % dans menace.js). makeMatch({ roles: [{ 8: 'neufDeSurface' },…] })
   — clé = poste, valeur = nom ou objet partiel ; polyvalent = identité (pas un bit). DEUX
   leçons : (a) mon bloc lisait q.post AVANT son assignation — six sondes bit-identiques, zéro
   rôle posé, attrapé à la mesure (l'ordre d'initialisation est une loi comme une autre) ;
   (b) les signatures de flux par joueur sont NOYÉES par l'effet papillon (un rôle re-distribue
   tout le match) → doctrine lot 8, fixtures : même monde, seul le rôle change — profondeur
   +2,0/−1,8 m au chiffre, largeur +2,0 m, et l'arbitre départage un monde à P/T = 1,03 (mesuré,
   la fenêtre (1 ; 1,28) où ±15 % basculent : meneur → passe, 9 → tir). Et le contrat social du
   rôle est PROUVÉ en creux : dans une équipe directe (±35 %), le rôle ne renverse PAS le style
   — « un rôle nuance, il n'écrase pas ». Sabotage « rôles placebo » (trio de 9 ≠ trio de
   meneurs). verify-roles 6 clauses ; 302 clauses vertes ; volumétrie tenue (roles.js 68 l.).
   Dettes nommées : rôles de PRESSING (qui déclenche/couvre), formations 4-4-2/3-5-2 (lignes),
   presets tactiques portant leurs rôles par défaut.

52. **Le catalogue de formations (lot 17 — 4-4-2, 3-5-2, lignes généralisées).** Un moteur foot
   qui ne connaît que le 4-3-3 n'est pas exhaustif. Le geste : LES LIGNES deviennent une DONNÉE
   (LIGNES = {433:[4,3,3], 442:[4,4,2], 352:[3,5,2]}), premierOffensif(name) remplace le
   « postes ≥ 7 » câblé (vrai du seul 4-3-3) dans le calage Loi 11 et les appels, checkFormation
   se GÉNÉRALISE (lignes ordonnées par groupes, largeur à l'échelle de la ligne), et la
   formation entre dans la tactique (tactics.formation, '433' défaut — identité au bit près :
   FORMATIONS['433'] === FORMATIONS[433]). makeMatch({ tactics: [{ formation: '442' },
   { formation: '352' }] }) : deux systèmes, un seul moteur. UNE leçon de calibrage : ma largeur
   générique (50 %·(n−1)/3) exigeait 22,7 m d'un trois arrière qui en couvre 20 — son étroitesse
   est un CHOIX de design (les pistons donnent la largeur) — et 11,3 m d'un duo de pointes qui
   vit à dix mètres : coefficient calibré 0,42 contre le catalogue RÉEL + trois arrière ±0,33.
   Bench : contrat ×3 formations des deux côtés, premierOffensif (7/8/8, fantôme → 7), flux
   4-4-2 c. 3-5-2 (17 passes/60 s, gel 0,3), sabotage « formation fantôme » ('666' → repli 433,
   récit identique au défaut octet pour octet — pas de crash, pas de monde secret).
   verify-match11 27 → 31 ; 306 clauses vertes ; batterie 433 au bit près (l'identité tient).

53. **Le gardien longue distance (lot 18 — la conversion).** La sonde par TIR (matchs complets)
   a tout dit : 3 plongeons sur 21 tirs, 0 arrêt, 13 buts — le gardien bien placé (z≈0, sur sa
   ligne) était déclaré « battu » PAR CONSTRUCTION : diveReach 2,1 m contre des coins visés à
   ±3,11 m du centre du grand but (keeperDecide ligne « |dz| ≤ diveReach sinon battu »). La
   constante datait du réduit. Le remède est une COHÉRENCE, pas un buff : l'envergure de la
   DÉCISION doit croire celle du CORPS LIVRÉ — 1,35 m de root motion (clip) + ~1,6 m de bras
   (IK deux os + warp de gant, prouvés par audit-gants) ≈ 2,95 m. diveReach 2,1 → 2,95 ;
   attributes.keeperReach re-bandé (2,55…3,25) autour de l'envergure livrée. APRÈS (mêmes
   graines) : 9 plongeons / 24 tirs (38 %), 9 ARRÊTS, 5 buts — conversion 57 % → 21 % (bande
   réelle ~10-15 % : encore généreuse, dette affinée mais plus une plaie). Une leçon de sonde
   consignée : mon premier filtre cherchait l'événement 'plongeon' — il s'appelle 'dive' — et
   concluait « 0 plongeon » pour de mauvaises raisons avant de le conclure pour de bonnes.
   Clause au banc (verify-match11 §9, 32 clauses) : ≥ 25 % des frappes plongées, ≥ 1 arrêt,
   conversion ≤ 60 % — le « avant » chiffré est le sabotage, consigné dans la clause. Batterie
   307 clauses vertes — le réduit (qui hérite de l'envergure) tient ses bandes.

54. **Les rôles de pressing (lot 19 — la couche rôles complète).** Champ press [0..1] au
   catalogue (+ le RÉCUPÉRATEUR, le 6 : press 0,95, appels 0,25, arbitre passe+), consommé à
   DEUX organes du bloc défensif : le MARQUAGE (le demi-pas × axe(press, 1,18…0,82) — le
   récupérateur colle, le meneur replié marque lâche ; milieu ×1, identité du polyvalent) et
   l'ÉLIGIBILITÉ du second presseur (press < 0,25 → il ne saute pas sur le pivot, il garde la
   couverture — le pari du pressing appartient à ceux qui en vivent ; 0,5 ≥ 0,25, identité).
   Contrat renforcé (press borné + identité polyvalent y compris press). Batterie verte au bit
   près (307 clauses) — la couche rôles couvre désormais l'attaque (profondeur/largeur/appels/
   arbitre) ET la défense (marquage/second presseur). Dettes restantes : découpage de rondo-sim
   (1 884 l.), conversion 21 % → ~12 %, temps additionnel/échange de camps, presets tactiques
   portant leurs rôles par défaut.

55. **Les presets tactiques portent leurs rôles (lot 20).** Un système est des axes ET des
   hommes : gegenpressing amène son récupérateur, ses ailiers de percussion et son 9 presseur ;
   possession son meneur ; blocBas ses deux récupérateurs ; largeEtCentres ses pistons. Fusion
   PRESET < EXPLICITE dans makeMatch (poste par poste — les rôles du projet aval gagnent
   toujours), équilibre n'amène personne (identité, batterie au bit près). Clause verify-tactics
   §7 : le preset pose ses hommes, l'équipe au défaut n'en a aucun, l'explicite écrase. 308
   clauses vertes. Un projet aval écrit désormais `makeMatch({ tactics: ['gegenpressing',
   'blocBas'] })` et reçoit un football COMPLET — axes, formation, rôles — en un mot.

56. **Le découpage du cœur (lot 21 — rondo-sim, bit-près, l'exception morte).** La dernière
   grosse volumétrie, traitée à la méthode du lot 16a : rondo-sim 1 885 → 1 092 lignes +
   skills-sim.js (518 — les gestes techniques : déclencheurs maybe*, contact, accompagnement,
   touchEvent, pressPredicate, footPoint/stanceBallPoint, MOVE_TIMING l'horloge des clips) +
   strike-sim.js (313 — la frappe : beginPass le plan/l'ancre/la course/la porte Loi 11, et
   strikeNow le contact/la re-mène/le bruit/la photo). Sens d'import ACYCLIQUE : rondo-sim →
   strike-sim → skills-sim ; skillInternals/simInternals préservés (l'API publique ne bouge
   pas). DEUX extractions, DEUX commits, la batterie entre chaque — rondo 40/40 au bit près
   les deux fois. Leçons d'extraction consignées : un grep d'appels rate les prédicats partagés
   (pressPredicate dans maybeFeinte) et les accès par crochets (byId['feinte-passe']) — l'audit
   d'identifiants libres se fait contre les DÉFINITIONS ET LES IMPORTS du module d'origine.
   Et la récompense : l'exception de volumétrie de rondo-sim (1 950) est MORTE — le plafond de
   1 250 lignes s'applique à TOUT le moteur, sans grand-père (verify-sync). 308 clauses vertes.

57. **Le découpage, suite et fin de session (lot 22 — mouvement + configs-données).** Trois
   extractions bit-près de plus, batterie entre chaque : movement.js (206 l. — movePlayers/
   separatePlayers : le cerveau décide, le mouvement PORTE ; rondo.js 975 → 776) ; puis LE
   PATRON UNITY « settings ≠ systems » : rondo-config.js (188 l. — RONDO, chaque nombre une loi
   commentée) et match-config.js (163 l. — MATCH, chaque clé son sabotage nommé), les systèmes
   restant dans rondo/match-sim avec ré-exports (aucun consommateur ne change ; le cfg = RONDO
   par défaut de choosePass lit désormais la config sans cycle possible). Tailles finales du
   moteur : match-sim 1 035, rondo-sim 1 092, rondo 594, animkit 942 — TOUT sous le plafond
   commun de 1 250, sans exception. Une leçon de banc consignée : verify-rondo « vert » AVANT
   sync validait l'ANCIEN monde (le banc lit la copie starter) — la batterie ne prouve qu'APRÈS
   sync. Dettes de volumétrie restantes nommées : les SCÈNES (Carriere 1 074, Rondo 952 — hors
   garde moteur, à couvrir d'une garde propre), et pass-brain (choosePass/supportSpot/evadeSpot,
   ~220 l. dans rondo.js à 594 — sous le besoin : on ne découpe pas pour découper).

58. **Le découpage, dernier étage (lot 23 — animkit-data + la garde des scènes).** Les clips
   authorés sont des DONNÉES : animkit-data.js (721 l. — les 31 specs de gestes avec leurs
   horloges, plus repeatSegment qui vit AVEC les données qu'il fabrique) ; animkit.js → 228 l.
   (les os, les contrats checkClip/checkStrike, les outils de résolution), ré-exports en place,
   sens d'import unique animkit → animkit-data. UNE leçon d'outillage payée cash : la première
   extraction au REGEX gourmand a mangé resolveTracks au passage (attrapé par verify-gestes ET
   rollup) — restauration git, re-découpe PAR LIGNES (les frontières de définitions se comptent,
   elles ne se devinent pas au motif). Et la dette du lot 22 payée : LES SCÈNES ENTRENT SOUS LA
   GARDE (verify-sync 9ᵉ clause, plafond 1 250 — Carriere 1 074 et Rondo 952 mesurées sous la
   barre). État final de la volumétrie : AUCUN fichier du produit (moteur + scènes) au-dessus de
   1 250 lignes, tout gardé au banc, zéro exception. Batterie 308 clauses au bit près + build.

59. **Le chrono complet (lot 24 — l'échange de camps + le temps additionnel).** L'ÉCHANGE DE
   CAMPS (Loi 8) tient en une bascule : `pitch.echangerCamps()` vit en CLOSURE (le pitch est
   gelé — la discipline tient), et TOUT le moteur suit par ownGoal/attackGoal — une source,
   zéro consommateur à toucher. Le câblage « équipe 1 défend +x » d'outRule est mort (défenseur
   dérivé de pitch.ownGoal(0) — l'identité non-échangée prouvée par le réduit au bit près). La
   mi-temps est LA discontinuité légitime des corps (les vestiaires — placeKickoff les pose
   côté neuf, le ballon repart par remise à cause nommée ; SA loi anti-téléport ne bouge pas).
   LE TEMPS ADDITIONNEL : les arrêts de la période s'accumulent, l'arbitre en rend ×0,35
   (plafonné 12 %), l'annonce est un événement ('temps-additionnel', sec) — mesuré : +1,7 s
   rendues sur ~5 s d'arrêts, sifflet final à 126,7 (la clause d'horaire du lot 13 datait
   d'avant la loi : mise à jour en fenêtre nominale + additionnel). HUD : « MT2 2:58 +2 ».
   Sabotages : « montre truquée » (additionnel:false → coupe PILE à 60,02) et refus d'échange
   (echangeCamps:false → but propre inchangé). verify-chrono 11 → 14 ; batterie verte, réduit/
   rondo intacts au bit près (l'échange n'existe que sous cfg.chrono). Le cycle de match est
   COMPLET : engagement, périodes, camps, additionnel, sifflet final, feuille.

60. **La Loi 12 (lot 25 — fautes, avantage, penalty, mur).** Le fait, le jugement, la géométrie —
   trois étages, chacun chez soi. La DÉTECTION vit au duel (standTackleNow : la fente qui rate
   le ballon et trouve le corps < 0,9 m pose st._faute + événement 'faute' — une faute à la
   fois, l'arbitre aussi) ; l'ADJUDICATION vit dans l'arbitrage (referee.adjugeFaute, appelé
   par matchStep : l'AVANTAGE d'abord — Loi 5, fenêtre 1,8 s ; le lésé qui porte à la fin JOUE
   ('avantage'), le fautif qui récupère siffle AVANT la fin ; puis coup franc au LIEU, PENALTY
   au point si la faute vit dans la surface du fautif — pitch.inBox, camps échangés compris) ;
   le MUR vit à la remise (match-sim : 9,15 m tenus, et < 30 m du but les DEUX défenseurs les
   plus proches du but posés sur la ligne ballon→but, épaule contre épaule ±0,35). La clé
   loi12 est un défaut de matchCfg comme la Loi 11, gardée st.full — batterie d'abord : rondo
   40/40 et réduit 76/0 AU BIT PRÈS avec la clé active (la garde est la preuve). Banc
   verify-loi12 13 clauses, doctrine lot 8 assumée : l'adjudication se juge sur st._faute
   CRAFTÉ (avantage gardé/perdu/fenêtre ouverte, penalty au point ±0,01, un mètre hors
   surface → coup franc au lieu), le flux ne fournit que l'existence (graine 1 : 1 faute,
   avantage joué). DEUX leçons de banc payées : le sabotage « sans loi12 » doit être
   loi12:false EXPLICITE (la clé est un défaut — un banc qui omet la clé teste le monde AVEC) ;
   et la fixture du mur doit AMENER la meute au point (le bloc naturel se tenait déjà à 8,8 m
   — le rayon n'avait rien à mordre ; posée à 2,6-3,2 m : 8,9 m tenus avec mur, 2,8 m sans,
   le contraste nommé). Mesure de flux consignée : ~1 duel tenté / 9 min de 11c11 (le jeu vit
   d'interceptions) — la Loi 12 vit surtout par fixtures ; enrichir les SOURCES de duels
   (charge, obstruction, main) est une dette de qualité football, pas de loi. Cartons : dette.

61. **La Loi 14 (lot 26 — la cérémonie du penalty).** La remise 'penalty' née au lot 25 était
   une touche déguisée : mesuré AVANT — gardien à 1,81 m DEVANT sa ligne (keeperSpot : sa loi
   de position ne connaît pas la cérémonie), coéquipiers en MARCHE vers le point (la remise
   générique `p.team === r.team → walk vers r.p`), 1 corps en surface / 1 dans l'arc / 1
   devant le ballon à la prise. La loi en trois greffes dans le bloc remise (clé loi14 défaut
   matchCfg, gardée st.full && type==='penalty') : le CLAMP de cérémonie en une passe (s-space
   x·sgn — derrière le ballon −0,9, hors surface +0,8, hors arc +0,35, le plus contraignant
   gagne, z conservé — les corps reculent droit), appliqué aux DEUX camps ; le gardien
   défenseur SUR sa ligne (0,15 m, z=0) ; et RIEN sur la frappe — le cerveau normal du preneur
   tire par le canal shot standard (+1,7 s après la prise, gachetteNear ouvert à 11 m), le
   plongeon existant peut répondre. Mesuré APRÈS : 0,32 m / 0 / 0 / 0, frappe → but sur les
   deux graines de fixture. verify-loi14 8/8 (cérémonie, ligne, le penalty SE JOUE, sabotage
   « cérémonie foraine » loi14:false → 1,81 m et 3 violations nommées, et la Loi 14 ne mange
   pas le mur Loi 13 du coup franc — clé DE TYPE, pas de régime). Batterie 325 → 333, rondo
   40/40 et réduit 76/0 inchangés au bit près (la garde est la preuve). Dettes nommées :
   l'empiètement après la prise (les corps re-rentrent LÉGALEMENT pendant l'élan du preneur —
   le re-sifflet d'empiètement est une v2), le preneur identifié avant le sifflet, la
   conversion penalty (2/2 — à calibrer en qualité plus tard). Prochaines lois : les CARTONS
   (récidive → jaune, cumul → rouge, l'expulsé quitte le terrain — la feuille les compte).

62. **Les cartons (lot 27 — la discipline de la Loi 12).** Le registre, pas l'humeur : chaque
   adjudication (sifflet OU avantage — le carton SURVIT à l'avantage, l'arbitre le montre
   dans les deux branches d'adjugeFaute) compte la faute à son HOMME (q._fautes) ; la
   récidive (loi12.jaune = 2 fautes du même joueur) vaut carton JAUNE (événement 'carton'
   {couleur, by, cumul}), le second jaune vaut ROUGE — DEUX événements au même instant,
   comme les deux gestes de l'arbitre. La feuille compte cartons {jaunes, rouges} par équipe
   (l'équipe du fautif), le ticker les montre (#ffd60a / #d62828). L'EXPULSION PHYSIQUE est
   une dette NOMMÉE et CLAUSÉE comme telle (le banc vérifie que le corps RESTE) : sortir un
   corps touche la formation (jouer à 10), la ligne de hors-jeu (l'avant-dernier défenseur
   expulsé posté hors terrain fausserait la Loi 11) et tous les cerveaux d'équipe — un
   chantier propre, pas un flag jeté dans referee.js. verify-cartons 6/6 (récidive : 1ʳᵉ
   faute muette, 2ᵉ jaune ; 4ᵉ → 2ᵉ jaune PUIS rouge même t ; l'avantage carte aussi — 2
   avantages joués, 0 sifflet, jaune quand même ; feuille [0,2]/[0,1] ; sabotage « arbitre
   sans poches » jaune:0 → 4 sifflets 0 carton). Fixtures pures sur adjugeFaute (siffle() :
   st._faute crafté + possession au fautif + hygiène st.restart=null entre les sifflets).
   Batterie 333 → 339, rondo/réduit au bit près. Prochaines lois candidates : l'expulsion
   physique (le chantier à 10), le différé du carton-sur-avantage (montré au prochain arrêt),
   la touche jouée À LA MAIN (Loi 15 — aujourd'hui au pied, à l'échelle du format réduit).

63. **L'expulsion physique (lot 28 — le rouge sort un corps, pas une étiquette).** Le chantier
   « jouer à 10 » tenait en une question : comment faire OUBLIER un corps à ~30 cerveaux sans
   toucher 30 filtres ? Par le levier NATIF : q.expulse + down GÉANT (9e9) — tous les filtres
   down<=0 du moteur (mates de choosePass, press, hunter, preneurs de remise, mur, appels,
   menace, shooting…) l'excluent d'office, zéro site touché, une autorité. Quatre sites le
   sautent NOMMÉMENT parce qu'ils ne filtrent pas down : la boucle de jobs (court-circuit
   premier — remises ET jeu ouvert : il marche vers sa sortie q._exit, la touche la plus
   proche +2,5 m, et y RESTE) ; la Loi 11 (offsideLine ignorait le down par la loi réelle —
   « tomber ne remet personne en jeu » — mais l'expulsé N'EST PLUS SUR LE TERRAIN : sans le
   filtre, un rouge posté derrière sa ligne de touche ferait la ligne, fantôme de Loi 11) ;
   placeKickoff/kickoffSpots (les vestiaires écrivent les corps ET remettaient down=0 — ils
   l'auraient ressuscité ET téléporté sur le terrain) ; et movement + la scène (l'expulsé
   n'est pas un corps au sol : il MARCHE — sans les deux gardes !expulse, il serait rendu
   couché à jamais par les tests lying). verify-expulsion 8/8 : le corps sort (|z| 36 > 34)
   et se tient à sa sortie (0,00 m de dérive en 4 s), l'équipe joue à 10 (9 + gants), le
   monde continue (passes à 10), il est HORS DU MONDE (aucune passe de/vers lui), la ligne
   de hors-jeu = l'avant-dernier VIVANT (39,4 pas 52), les vestiaires ne le ramènent pas,
   arbitre sans poches. La clause « le corps reste » de verify-cartons (qui CLAUSAIT la
   dette) retournée en « le rouge expulse ». Batterie 339 → 347, rondo/réduit bit-près
   (expulse n'existe que sous loi12, jamais posé sans rouge). Dettes nommées : gardien
   expulsé (pas de remplaçant aux gants — le poste reste vide), formation à 10 non
   recomposée (les 9 tiennent leurs postes ; un resserrement de bloc à 10 est de la
   tactique, pas de la loi).

64. **La Loi 15 (lot 29 — la rentrée de touche à la main).** Deux découvertes de moteur avant
   la loi : 'touche' est DÉJÀ dans les deux listes blanches du ballon (RELEASES et RESTARTS —
   le grand livre attendait sa loi), et l'événement 'touche' est déjà pris par le TOUCHER de
   balle (329/match mesurés — l'événement du lancer s'appelle 'rentrée' : un même mot, deux
   faits, le registre les sépare). Le mécanisme est un NOUVEAU POINT D'EXTENSION du loop :
   cfg.onTake(st, taker, type, cfg) — la prise d'une remise a un métier (le site unique de
   canTake dans rondo-sim capture le type AVANT la prise, appelle le hook APRÈS receive ;
   clé absente = bit près, rondo sans onTake, réduit gardé st.full dans le câblage matchCfg).
   remiseEnTouche (referee.js) : coéquipier le plus démarqué à portée de bras (range 18),
   release('touche') PUIS strike (le release interne 'frappe' du strike devient no-op — la
   cause VRAIE au grand livre), cloche à 32° (v = √(R·g/sin 2θ), apex mesuré 2,58 m),
   st.pass complet (lead/origin/flight — les consommateurs du vol servis) SANS photo .off :
   l'EXEMPTION de la Loi 11 est STRUCTURELLE, pas un if dans le sifflet. verify-loi15 6/6 :
   la cloche (apex ∈ [1 ; 3,4]), la reprise (receive +2,3 s), et LA clause d'exemption —
   l'appelé posté hors-jeu (isOffside=true au lancer, prouvé exercé) est servi et AUCUN
   sifflet ne tombe ; sabotage « touche au pied » (loi15:false → apex 0,11). Une leçon de
   banc : la clause « le jeu reprend » cherchait des événements aux mauvais noms ('touch'
   n'existe pas ; 'pass' peut tarder) — sonder le VRAI flux d'événements avant de clauser
   (receive@+2,3 était là). Mesure de flux consignée : 0 sortie latérale en 3×180 s (le jeu
   vit central — corners et sorties de but dominent) ; la loi vit par fixtures, doctrine
   lot 8. Dettes nommées : le geste des deux mains (clip), le double-toucher du lanceur, la
   touche foireuse. Batterie 347 → 353.

65. **La Loi 3 (lot 30 — les remplacements).** LA LOI EST LE MÉCANISME, LA POLITIQUE EST AU
   PROJET : remplacer(st, cfg, team, outId, inSpec) FILE le changement (refus nommés :
   limite, expulsé irremplaçable — l'équipe reste à 10 —, déjà en cours, loi3 absent) ; il
   s'exécute À L'ARRÊT DE JEU suivant (st.restart vivant — on ne change pas pendant que le
   ballon roule) ; le sortant marche vers la touche par LE LEVIER DE L'EXPULSION (down géant,
   les ~30 filtres l'oublient), à la ligne L'IDENTITÉ CHANGE (inSpec au format squads —
   ratings→makeProfile, nom, numéro, rôle — et l'ardoise disciplinaire PART AVEC L'HOMME :
   q._fautes/_jaunes remis à zéro, le carton appartient à l'homme, pas au maillot), puis le
   corps REVIENT (3 m dedans → down 0, les cerveaux le reprennent). Événement 'remplacement'
   {team, id, minute}, feuille remplacements [n0, n1]. UNE leçon payée : le sortant restait
   GELÉ à 0,4 m de son départ — movement gelait tout down>0 sauf expulse (l'exception du lot
   28 ne couvrait pas le nouveau marcheur) ; même faille dans les deux gardes « couché » de
   la scène. La greffe d'un NOUVEAU marcheur hors-monde doit visiter LES TROIS SITES :
   job-loops (court-circuit), movement (exception du gel), scène (gardes lying) — consigné
   pour le prochain (blessé porté ? civière ?). verify-loi3 9/9 (la file pendant le jeu
   roule, l'arrêt exécute, l'identité, le retour, l'ardoise vierge — jaune → sub → 2 fautes
   → JAUNE pas rouge —, la limite 1 refuse le 2ᵉ, l'expulsé, porte tournante fermée).
   Batterie 353 → 362, rondo/réduit bit-près. Dettes nommées : banc incarné, fenêtres
   comptées, la FATIGUE (le déclencheur naturel de la politique — pas encore modélisée).

66. **La fatigue (lot 31 — l'endurance, un état du corps à l'échelle du format).** q.stam
   [0;1], drainé dans movement (effort² + socle, récup légère sous 1,5 m/s) sur l'HORIZON
   du format (periodes×duree du chrono — pas « 90 min » en dur : l'échelle suit le match
   configuré, le geste restartClear). UN effet v1, une autorité : la POINTE plie (× 1−0,15·
   (1−stam) — p95 des courses ×0,92 mesuré à vide). La note stamina module (×[1,25 ; 0,75]),
   les vestiaires rendent 0,25, l'entrant Loi 3 naît frais (et son trot d'entrée SE PAIE —
   la clause qui exigeait 1,0 après l'entrée était fausse, pas la physique : 0,98 mesuré).
   q.stam est l'API du projet : la politique de banc le lit, le moteur ne décide pas qui
   sort. Drain calibré : à 90 s de match, gardiens 1,00, champ moyen 0,79, le plus usé 0,71
   — projection fin de match ~0,4-0,5, bande visée. DEUX leçons de banc : (1) la fatigue
   par défaut DIVERGE LE FLUX (le cap multiplie top dès la première image → papillon) — les
   clauses de flux d'anciens lots calibrées graine par graine peuvent mal échantillonner le
   nouveau monde SANS que le mécanisme soit touché (vérifié : axes tactiques +6,1/+6,4/+8,5
   sur graines 1/5/7 contre +1,8 sur la graine 3 du banc ; loi12 graine 1 : la faute glisse
   de 55,2 à 60,13 s) → re-fonder sur graines RE-MESURÉES, jamais élargir les seuils à
   l'aveugle ; (2) l'écart d'un modulateur se mesure sur le CORPS QUI TRAVAILLE (poste 5,
   90 s — l'écart stamina 90/10 sur un poste calme à 60 s : 0,03, sous le seuil rêvé).
   verify-fatigue 8/8, batterie 362 → 370, rondo/réduit bit-près (st.full). Dettes : sigma
   fatigué, pressing plié, récupération active, HUD d'essence (scène/projet).

67. **Le duel de corps (lot 32 — la charge d'épaule, premier lot de l'ère qualité).** Le
   diagnostic AVANT tout : probe-contact — l'adversaire à 1,28 m MÉDIAN du porteur (p10
   0,50 !) mais pression ballon > 0 sur 2,4 % du portage seulement (rafales p50 0,13 s,
   mortes avant tackleTime 0,5) → 1 duel / 9 min : les corps y sont, le duel n'existe pas,
   le bouclier protège le ballon et le défenseur PLANE. La greffe : chargeStep dans le bloc
   de portage (cfg.charge && st.full, famille standTackleNow) — horloge de CORPS (0,4 s à
   < 0,85 m), résolution à maturité. TROIS géométries payées en mesure : (1) « derrière =
   faute » criminalisait l'ombre de poursuite (33 fautes/9 min, TOUTES par derrière, des
   0-0 étouffés au sifflet — un défenseur qui traque est derrière par définition) ; (2) la
   survitesse brute (+0,6) en laissait 16 ; (3) la bonne serrure est la vitesse D'ENTRÉE
   PROJETÉE chargeur→porteur (> fuite + 0,8, contact < 0,5 m) : le PERCUTAGE, 1,0 faute/
   match — la bande réelle. La filature ré-arme sans événement. Le duel loyal de côté :
   strength (nouvel attribut → chargeF ±15 %) + élan, base 40 %, st.rnd seedé — gagné, le
   ballon JAILLIT en bousculade COURTE (1,4 m/s : à 2,2 le 50/50 tournait turnover un coup
   sur deux, tirs 5 → 2,3/match, l'attaque étouffée) ; perdu, le chargeur s'assoit sur le
   levier natif _bite. Le jailli SORT du bloc de portage par le même return que la perte
   (leçon payée : crash « reading team of undefined » à t=63 — le bloc continuait sur un
   monde plus en carry). Équilibre livré : 6,0 épaules/match, 0,8 faute/match, 3 buts /
   4 matchs. Le terme d'élan du porteur s'est mesuré INERTE (bit-identique : les charges
   mûrissent sur porteurs LENTS — les rapides distancent l'horloge) — gardé pour le cas
   rare, documenté honnête. Re-fondation loi12 flux (graine 5 × 25 s : la détection a DEUX
   sources désormais). verify-charge 8/8, batterie 378. Dettes : l'animation du contact,
   le tacle glissé, l'obstruction, cartons quasi absents du flux court (récidive rare à
   0,8 faute/match — c'est le format, pas un bug).

68. **Le tacle glissé sur porteur (lot 33) — et la naissance de duel.js.** Le moteur AVAIT
   déjà la moitié du geste : 'tacle-glisse' dans la table technique (dist 1,0-3,2, commits),
   le clip 'tacle' authoré, slideRecovery, et le glissé sur ballon LIBRE complet (anti-spam,
   poke vers un partenaire) — il ne manquait que le glissé SUR PORTEUR, le dernier recours
   qui fait les duels ET les fautes. DEUX leçons d'équilibrage payées en mesure : (1) sans
   porte de dernier recours, 20,8 glissés/match TOUS réussis (la fenêtre de déclenchement
   vivait entière dans la fenêtre de validité de la table : glisser était strictement
   optimal) → la porte carrySpeed (le porteur doit être LANCÉ ≥ 4,4 — une construction
   lente se défend debout) + le JET (accuracy 0,6 ± tackling ×2 : le raté EXISTE, et c'est
   lui qui produit fautes et vides) ; (2) le premier compte de flux cachait les vides (le
   filtre d'événements ne les voyait pas — toujours compter TOUTES les issues d'un pari).
   Résolution en trois issues sur géométrie réelle : PRIS (dégagé fort, tacleur au sol —
   le coût EST la décision), FAUTE (jambes trouvées < 1,1 m : victime couchée 0,7 s,
   cérémonie loose complète — release + phase, la discipline du porteur couché ET du ballon
   possédé —, grave par derrière → récidive ×2 dans adjugeFaute : UN glissé par derrière =
   jaune), VIDE (refus nommé). Équilibre livré : 1,8 glissé/match, 0,7 faute-tot (bande
   réelle), 3,0 tirs, 1,2 but sur 6 graines. LA VOLUMÉTRIE A MORDU : rondo-sim 1 263 >
   1 250 → extraction PAR LIGNES de la famille duels de corps (chargeStep + slideTackleStep,
   contiguës, AUCUN appel à receive — pas de cycle) vers duel.js (150 l.), le candidat
   nommé du backlog #1 ; rondo-sim 1 128. Le tacle-debout et le glissé libre RESTENT dans
   rondo-sim (ils appellent receive — les sortir ferait un cycle). Re-fondation loi12 flux
   (graine 9 × 25 s — la détection a TROIS sources : tacle raté, percutage, glissé fauché).
   verify-slide 8/8, batterie 386. Dettes : l'animation du glissé sur porteur (le clip
   'tacle' du glissé libre sert-il ? à vérifier à l'œil), le jaune DIRECT configurable
   (aujourd'hui récidive ×2), l'obstruction.

69. **Le jeu de tête (lot 34 — le ciel du match, tete.js).** Mesuré avant : la dimension
   aérienne manquait ENTIÈRE (0 centre entré en surface / 4 matchs, 0,8 s/match de fenêtre
   de tête avec un corps dessous). La chaîne du ciel avait QUATRE serrures, chacune trouvée
   à la mesure : (1) le CONTACT n'existait pas → tete.js (but en surface / dégagement /
   remise + duel aérien sur strength, gardé cfg.tete && st.full, appelé avant la prise au
   sol — la tête coupe ce que le pied attendait) ; (2) les centres volaient TENDUS (solveur
   de passe) → la cloche (balistique de la rentrée, θ 26°) ; (3) l'ailier au couloir vit à
   21 m du but → gachetteNear ne s'ouvrait JAMAIS pour lui, tryCross jamais appelé en course
   (la serrure du lot 13, deuxième récidive — instrumenter la BRANCHE) → gachetteCentre ;
   (4) beginPass refusait 169/170 centres (ballon d'aile à 1,2-1,4 m) → la touche de
   préparation du centre (le patron _prepShot du tir, lot 6a). Flux : 0 → 3-5 têtes/12 min,
   centres 0,3 → 0,5/match — l'existence ; l'abondance = dette « approche pilotée ». UNE
   FUITE DE GARDE PAYÉE CHER : la touche de préparation SANS st.full a fait bouger le RÉDUIT
   (verify-match 75/1 — la sentinelle a fait exactement son métier) → gardée, réduit
   restauré au bit près. QUATRE re-fondations de flux d'un coup (tactics graine 1→5 —
   troisième re-fondation : chaque défaut nouveau diverge le flux, le mécanisme se re-vérifie
   à CHAQUE fois, +9,0/+12,6 mesurés —, loi12 déjà graine 9, match11 appels graines {2,4,5}
   et gardien passé en AGRÉGAT 3 graines : l'échantillon d'UNE graine ne porte plus une
   clause de flux dans un monde à duels). TROIS leçons de fixtures balistiques : la mène
   pointe LE CORPS (lead [0,0,0] faisait fuir le receveur), la fenêtre de course se MESURE
   (tête à t+1,05, courir 0,9 s la ratait), les corps DÉRIVENT pendant un vol (le duel à
   deux se juge en appel DIRECT de teteStep — ballon posé à 1,85 m par la porte légale du
   restart, une image, zéro dérive). verify-tete 7/7, batterie 392. Dettes : le saut authoré
   (clip), la Loi 11 sur reprise de tête (le sifflet vit à la prise au sol), l'approche
   pilotée du centre, le duel aérien du gardien (il ne saute pas — ses poings : dette).

70. **Le renversement d'aile (lot 35 — l'orientation du jeu, diagnostic utilisateur).**
   « La densité du jeu axial — l'intelligence on-ball ne change pas d'aile » : chiffré, le
   diagnostic était exact au pourcent — 76 % du jeu à |z| < 8 (réel ~45), passe max du
   VOCABULAIRE 21,9 m (passRange [2,5 ; 13]), 1 renversement / 4 matchs (réel 3-8), 5-6
   adversaires à 12 m du ballon. LE CERVEAU NE PEUT PAS CHOISIR CE QU'IL NE PEUT PAS DIRE :
   les trois verrous étaient le plafond de portée (13 m — la diagonale de 30 m hors
   vocabulaire), le point doux des 10 m (−8 de score à 35 m) et la pénalité lofted (−2,2)
   — pendant que le receveur LIBRE de l'aile opposée valait +10 de pression à l'arrivée.
   La greffe (choosePass, cfg.renversement && st.full) : la BASCULE sous condition de
   densité (≥ 5 corps à 12 m du ballon), jugée par SA loi (portée 38, point doux neutralisé,
   lofted = sa nature, bonus modeste +1,5), la diagonale en CLOCHE par-dessus le bloc
   (strike-sim, patron de la rentrée), événement 'renversement'. TRANSFORMATION NETTE DU
   PREMIER COUP : axial 76 → 49 %, ailes 9 → 29 %, ~5 renversements/match, ET la densité
   côté ballon p50 6 → 2 corps — l'étau se DESSERRE : le bloc doit couvrir la largeur,
   l'effet systémique du vrai football. CINQ clauses de flux re-bordées d'un coup (le plus
   gros papillon de la session), chacune avec sa CAUSE systémique nommée : moins d'épaules
   (l'étau choisi diminue — plancher 3 → 2), transitions 29 % (possession stabilisée —
   plancher 30 → 24), fautes raréfiées (graine 1 × 95 s), appels servis mourants (LA BASCULE
   SURCLASSE LE SERVICE DU COUREUR — dette d'équilibrage nommée : appelBonus contre bonus de
   bascule), et l'axe LARGEUR noyé par la couche (le renversement pousse TOUTES les équipes
   au large) → l'axe se prouve désormais en ISOLATION (renversement:false, +12,6 intact —
   chaque couche se juge sur SON axe, doctrine consolidée). Leçon de fixture : LE BALLON
   est l'origine du cerveau — téléporter le porteur SANS son ballon vise tout le crafting à
   côté (la séquence légale : release → restart → possess). verify-renversement 5/5,
   batterie 397. Dettes : l'équilibrage bascule/appels, le renversement PORTÉ (aujourd'hui
   une passe — le changement d'aile par la conduite est l'autre moitié), les circuits de
   passe nommés (tiki-taka, jeu direct — les presets de style y gagneraient des poids de
   bascule différenciés).

71. **Les circuits par style (lot 36 — et la doctrine des clauses de flux).** (1) L'APPEL
   SERVI : diagnostic en trois étages mesurés — 79 % des fenêtres hors portée (le dart sort
   en 0,6 s, dette nommée), 37 % de choix GAGNÉS quand évaluable (la loi du coureur : point
   doux neutralisé), 0 exécuté (les portes d'engagement — technique 932 / ballon-vif 865 /
   ancre 642 refus — mangeaient la fenêtre de 1,5-2 s). Remède natif (le patron tir/centre) :
   la touche de préparation sur intention-vers-coureur. MAIS le premier jet a coûté LA MOITIÉ
   DES TIRS (18 → 10 sur 10 graines, A/B git-stash contre lot 35) : les intentions adoptées
   plus souvent ÉCHOUAIENT et occupaient le porteur TTL plein, touche serrée en rafale. Deux
   gardes football-vraies : l'INTENTION MEURT AVEC LA COURSE (until = min(ttl, pace.until +
   0,3) — on arrête de chercher le coureur quand la course est finie) et la préparation
   s'arme UNE fois par intention. A/B restauré : 9 buts = 9 buts, 16 tirs, 2 servis (était
   0). (2) LE STYLE ÉCRIT LES CIRCUITS : l'axe style module densité de bascule (±1), bonus
   (±0,5), service (×0,7-1,3) — identité au défaut PROUVÉE octet pour octet (équilibre
   explicite ≡ défaut, 60 s d'événements). SIGNATURE : possession 20 renversements / direct
   7 (×3) — les styles se VOIENT dans les circuits. (3) LA DOCTRINE DES CLAUSES DE FLUX,
   consolidée après la 5ᵉ série de re-fondations : une graine épinglée re-casse à CHAQUE
   évolution du cerveau → l'existence se juge par BALAYAGE-jusqu'à-trouvé (loi12 : première
   graine qui montre une faute, coupe-circuit au sifflet), l'abondance par AGRÉGAT large,
   chaque banc juge SA MÉTRIQUE SEULE (les buts-respiration vivent à UN endroit — les
   clauses « et buts ≥ N » retirées de charge/slide/renversement), et une vérité par
   contrat (le service : verify-circuits, 9 matchs agrégés ; la clause match11 déléguée).
   verify-circuits 5/5, batterie 403. Dettes : le renversement porté, la portée du dart
   (79 % hors enveloppe — servir PLUS TÔT dans la course), les poids de bascule par preset.

72. **La conduite au pied : l'honnêteté ravive le jeu (lot 37 — retour utilisateur « le
    ballon paraît loin du pied… de la magie »).** MESURE d'abord (probe 4 × 180 s, 12 min
    de portage) : p50 0,33 m — la conduite ordinaire est SAINE — mais 12 épisodes > 1,8 m
    jusqu'à un pic de 2,91 m, 11 des 12 en CROISIÈRE. Le coupable n'est pas la poussée :
    c'est la FENÊTRE DE PERTE en mouvement (`looseAt = 1.15 + touchDistance(v) + 0.5` —
    à 4 m/s elle tolérait ~3,6 m d'écart : l'étiquette « porté » MENTAIT, le corps courait
    derrière un ballon libre qu'on continuait d'appeler sien). Remède d'une ligne, plein
    format : `if (st.full) looseAt = Math.min(looseAt, 2.2)` — au-delà de 2,2 m le ballon
    est LIBRE (phase loose, la chasse carrySurge existait déjà et reprend le relais).
    Re-mesure : pic 2,91 → 2,19, p99 1,63, épisodes > 1,8 m divisés. Effet de flux INATTENDU
    et bienvenu : 16 → 27 tirs sur 10 graines à BUTS CONSTANTS (9 = 9, A/B git-stash) — les
    ballons perdus tôt se disputent près de la surface au lieu de mourir en conduites
    fantômes. Clause §8b (verify-match11) : p99 ≤ 1,9, max ≤ 2,3 sur 2 × 120 s ; sabotage
    nommé = retirer le plafond. Au passage, deux clauses re-fondées façon doctrine 71 :
    checkMatch 90 → 150 s (match11) et le flux du ciel en balayage coupe-circuit
    (verify-tete, graines [1,3,5,7,2,4]). Batterie intégrale ~60 bancs verte. Prochain
    (retour utilisateur, dans l'ordre) : le RECEVEUR VIVANT (l'attente figée du ballon —
    venir AU ballon, ajuster les appuis) puis le RÉPERTOIRE DES FRAPPES (flottante,
    enroulée, puissante, ras-de-terre… — base : shot kinds placé/croisé/puissance + spin).

73. **Le receveur vivant (lot 38 — retour utilisateur « cette pose statique en attendant le
    ballon »).** MESURE (4 × 180 s, 181 vols) : p25 de vitesse du receveur pendant le vol =
    0,00 m/s — un quart des images PÉTRIFIÉ — 14 % des vols figés > 60 % du temps, 0,62 m de
    déplacement médian par vol. meetBall (le pas final) ne vivait que dans les 4,5 derniers
    mètres ; avant ça, la statue au point de chute. Greffe `meetWalk` (match-sim, st.full) :
    sur une passe DANS LES PIEDS ≥ 7 m, le receveur VIENT AU-DEVANT sur l'AXE NOMINAL de la
    livraison (mène → origine) à allure de marche (1,6 m/s, plafond 1,1 m et 25 % de la
    passe) — l'axe est nominal, PAS le vol réel : la leçon du flipper (réception parfaite =
    0 déchet) reste consignée ; le coureur d'appel garde sa course (_pace vivant = pas de
    retour). DEUX LEÇONS D'ÉQUILIBRE payées : (1) à 2,2 m de marche, l'attaque REDESCENDAIT
    (~500 réceptions × 2 m de recul : tirs 27 → 16, prises < 22 m du but 12 → 5) → plafond
    réduit à 1,1 m ; (2) venir au ballon est un geste de CONSTRUCTION → porte de zone
    `hold: 32` (à < 32 m du but adverse le receveur TIENT son point de fixation — le pivot
    ne décroche pas par défaut, le rôle false-9 sera un biais de roles.js). Après : p25
    0,77-1,02 m/s, part figée 19 → 2-4 %, vols pétrifiés 14 → 0-1 %, déplacement médian
    1,14 m — et la respiration TENUE : 24 tirs / 11 buts contre 27 / 9 (10 graines).
    Clauses §8c (verify-match11) : monde vivant ≤ 20 % / vols figés ≤ 8 % + sabotage nommé
    « pose figée » (meetWalk:false → 37 %, le DOUBLE du monde vivant). Deux clauses de flux
    re-fondées doctrine 71 : le p99 de conduite borné LARGE sous le plafond (2,1 — le PIC
    2,3 est le discriminant structurel), la fenêtre « le monde continue à 10 » 20 → 45 s
    (la cérémonie du coup franc mangeait le début). Batterie ~60 bancs verte. Dette de
    scène nommée : la prise d'appuis micro (shuffle du receveur à l'arrêt) — le sim bouge
    le corps, le clip d'appuis raffinerait le dernier demi-mètre. Prochain (retour
    utilisateur item 1) : le RÉPERTOIRE EXHAUSTIF DES FRAPPES.

74. **Le répertoire exhaustif des frappes (lot 39 — retour utilisateur « flottante enroulée
    puissante ras terre etc, liste à compléter pour être exhaustif »).** Le ballon SAVAIT
    déjà (ball.js : Magnus complet, spinAxis/spinRev, coefficient empirique standard) — le
    répertoire n'exploitait rien. DIX ESPÈCES désormais, chacune SA loi de choix (situation)
    et SA physique : placé, croisé, puissance, mi-hauteur, lucarne (les finisseurs d'hier,
    bandes PRÉSERVÉES), + ENROULÉE (angle de repique : la mène se décale vers le centre,
    le Magnus signé — rev ±8 — la RAMÈNE au poteau ; calibré au ballon réel : la courbe suit
    1,44·(d/16)², fixture : arrivée 2,91 au poteau 3,11 quand la LECTURE LINÉAIRE du gardien
    — shotCross, il ne projette pas le Magnus — disait 1,89 : battue de 1,01 m, l'avantage
    du curler au vrai football), + RAS-DE-TERRE (20 m/s à 1,5 cm — apogée 0,11 m au banc),
    + FLOTTANTE (20,5 m/s SANS axe de rotation < 2 rad/s : le gardien n'a rien à lire, son
    réflexe s'étire ×2,4 — floatRead, keeper.js, fil du spin gardé par shotVariety), +
    POINTU (petits espaces, rotation quasi nulle), + PIQUÉ (le UN-CONTRE-UN : gardien sorti
    ≥ 4,2 m ET près du tireur ≤ 8 m — élévation RÉSOLUE du duel (dégager 2,45 m au passage
    du corps, traînée ×1,25), portée compensée ×1,18, vitesse exacte hors planchers ; fixture :
    3,02 m au-dessus du gardien rué, but — il ne recule pas plus vite que le vol). TROIS
    LEÇONS D'ÉQUILIBRE payées et consignées : (1) le piqué à porte large (gkOff 3,5, tirage
    0,75) dévorait 37 % du répertoire ; (2) le piqué sur gardien LOIN du tireur se fait
    rattraper (prise à 1,65 m mesurée — la cloche de 2 s perd contre le repli) : ce piqué-là
    n'existe pas au vocabulaire ; (3) les bandes larges aux nouvelles espèces coûtaient la
    finition (20 × 300 s : buts 30 → 15) — les finisseurs prouvés gardent leurs bandes, les
    espèces prennent les MARGES. Flux final : 59 tirs / 26 buts contre 64 / 30 (z ≈ 0,5,
    dans le bruit), conversions par espèce 32-67 %. Et une leçon d'INSTRUMENT : à 1-5 tirs
    par graine de 180 s, un A/B de comptage se juge sur 20 × 300 s — les bissections sur
    5 graines chassaient des papillons. Banc verify-frappes (6 clauses : courbe contre
    lecture linéaire, piqué du un-contre-un, rasant, lecture tardive à trois mondes,
    sabotage « pied unique », flux ≥ 4 espèces). Le pointu-de-nécessité (frapper SANS
    préparation le ballon à 1,3 m) est une dette nommée : refusé par les portes d'armement,
    le premier jet faisait PASSER le cerveau au lieu de préparer (tirs −37 %). Autres dettes :
    volée/demi-volée (frapper un ballon EN VOL au pied), trivela, wobble visuel de la
    flottante (scène). Les 3 retours utilisateur du message sont livrés : conduite (72),
    receveur vivant (73), répertoire (74).

75. **La volée, la demi-volée — et le centre bas qui les nourrit (lot 40).** La dette la
    plus structurante du répertoire : seul le canal TÊTE savait jouer un ballon en vol
    (fenêtre 1,5-2,2 m) — mesuré, 4,4 s/12 min de fenêtres à hauteur de PIED sur un corps,
    zéro geste, et 0,0 s en surface face au but : la chaîne du centre ne produisait QUE des
    cloches. DEUX greffes liées : (1) `voleeStep` (tete.js — la famille du ciel, une
    autorité par corps) : fenêtre 0,25-1,15 m, DEUX métiers seulement — la REPRISE au but
    en surface (shot kind 'volée', 'demi-volée' si le ballon REMONTE de son rebond, vy > 0)
    et le DÉGAGEMENT d'urgence près de son but ; hors de ces urgences on ne volleye PAS,
    le contrôle est le vrai geste (pas de remise de volée — l'asymétrie avec la tête est
    football-vraie). Cooldown partagé avec la tête, fenêtre morte 1,15-1,5 m = la POITRINE,
    dette nommée. (2) le CENTRE BAS (shooting.js/strike-sim) : au ras de la ligne (9
    derniers mètres), la cloche n'a plus d'angle — le centre part FORT AU SOL (elev 0,14,
    apogée ~0,3 m, un rebond en route est sa nature) vers le point de penalty, SI le couloir
    existe (laneClearance 0,45 — un ballon à ras se fait couper, contrairement à la cloche).
    LA CHAÎNE PROUVÉE au banc : centre bas t 0,23 → un rebond → DEMI-VOLÉE t 1,08 à 11 m →
    BUT. Flux 20 × 300 s : 71 tirs / 22 buts (le ciel du bas AJOUTE ~12 tirs, buts dans la
    bande) ; en match : 3 reprises + 17 dégagements de volée / 50 min (le défensif domine,
    bande réelle), 1 centre bas (rare : exige ras de ligne + couloir — l'abondance viendra
    avec l'« approche pilotée du centre », dette déjà nommée). verify-frappes 6 → 13
    clauses (reprise, demi-volée nommée au vy, dégagement, fenêtre morte, chaîne complète,
    2 sabotages « pieds au sol » / « que des cloches »). Leçons de fixture : un vol PLAT de
    15 m retombe avant le corps (balistique — poser l'origine à 3,5 m), le droit de prise
    veut le pass ANTIDATÉ (releaseTtl 0,5 s), et tryCross s'appelle en DIRECT comme tryShot
    (le porteur posé à froid n'exécute pas par l'arbitre — il dérive hors couloir). Le
    répertoire aérien du pied est complet ; dettes : poitrine, saut de tête (scène), volée
    de gestes en dehors de la surface (la reprise de transition).

76. **Le service du coureur profond : la foulée est servie (lot 41 — dette du lot 36).**
    RE-MESURE d'abord (le monde avait bougé) : 32 % des appels profonds SERVIS (12/37 sur
    10 × 300 s — bande réelle des passes en profondeur ; l'ère lot 36 était à ~0), MAIS
    latence burst → passe p50 = 1,43 s : le ballon partait quand la course FINISSAIT
    (fenêtre 1,9 s, enveloppe fermée à ~0,6 s) — le coureur recevait À L'ARRÊT, pas dans la
    foulée. L'intention rivale n'était PAS le blocueur (5 % des bursts) ; le coût vivait
    dans le PIPELINE d'exécution : le commentaire du lot 36 disait « le service du coureur
    est une urgence de timing » mais beginPass partait en régime CALME (portes longues).
    DEUX lois composées : (1) `appelUrgent` (rondo-sim) — le service d'un coureur vivant
    s'exécute en RÉGIME URGENT (portes courtes, armé prompt, déchet ×1,25 : une passe
    pressée se rate plus — le régime du contesté et du centre) ; (2) `appelPret` (match-sim,
    la porte `posé` du dart) — on appelle quand le passeur PEUT donner, le ballon au pied
    (≤ 1 m) : le coureur du vrai football lit les APPUIS du passeur. Mesures : urgence
    seule p50 0,63 / p90 1,50 ; composé **p50 0,60 / p90 1,08** — appelPret tient la QUEUE
    (ablation propre) — et service 32 → **48 %**. Flux 20 × 300 s : 67 tirs / 27 buts
    (bande 59-71 / 22-30, respiration tenue). Clauses 3b (verify-circuits — la vérité du
    service) : latences POOLÉES des 3 mondes tactiques ≤ 1,0 s + sabotage « service
    nonchalant » par SÉPARATION des moyennes (vivant + 0,2 — une borne absolue sur 3
    valeurs re-cassait, doctrine 71) ; clause stamina re-fondée fenêtre 90 → 180 s (le
    drain cumulatif a la place de se voir, la borne ne re-cassera plus au prochain flux).
    Leçon : les greffes du lot 36-38 avaient déjà relevé le service — TOUJOURS re-mesurer
    la dette avant de la payer. Dettes : le renversement porté, l'approche pilotée du
    centre, la poitrine.

77. **Le bloc compact : les distances entre lignes SONT la tactique (lot 42 — retour
    utilisateur « les lignes sont trop espacées, les matchs ne sont pas réalistes »).**
    Diagnostic CONFIRMÉ au chiffre (sonde bloc, 4 × 180 s, ~2 700 photos) : bloc défendant
    p50 43,1 m / p90 58,1 (réel 25-40), interligne défense→milieu 25,5 m (réel 10-15), et
    ZÉRO asymétrie attaque/défense (43,1 = 43,1 au dixième — le bloc ne se compactait
    JAMAIS). Cause : formationSpots coulissait (±18 %) mais la ligne vivait à ses POSTES
    ABSOLUS — ballon au rond central, ligne défensive parquée à 11 m de son but. LA LOI DU
    VRAI FOOTBALL (formation.js, paramètre bloc — pur, testable) : l'équipe SANS ballon est
    CHAÎNÉE AU BALLON — sa ligne tient `ligne` m (27) derrière lui (« on pousse ! » — elle
    monte quand le ballon recule, plafond au rond central) et le bloc entier tient en `long`
    m (30), interlignes comprimées d'un même facteur ; l'équipe qui ATTAQUE garde la
    respiration étirée d'hier — L'ASYMÉTRIE EST LE RÉALISME. hauteurBloc (tactics) compose
    par-dessus (±6 m), le pressing aussi (step). Après : bloc défendant p50 30,3 / p90
    41,2 ✓, interligne 14,7 ✓, attaque 42,0 étirée ✓ — et le FLUX TENU (70 tirs / 29 buts
    sur 20 × 300 s, bande 59-71 / 22-30 ; service du lot 41 intact à 45 %). Clauses §3b
    (verify-match11) : loi PURE (ballon au rond central → ligne à 27,0 m, longueur 30,0),
    bandes en match (≤ 36 / ≤ 19 / asymétrie ≥ +4), sabotage « bloc élastique » (+6 m).
    DEUX instruments re-fondés au passage (le flux avait bougé sous eux) : la clause
    largeur de verify-tactics passe en SCÈNE CONTRÔLÉE (lire les cibles p.target posées
    aux ailiers — la juger au flux l'avait noyée TROIS fois : renversement, slots de
    surface, darts ; écart restauré 20,7 vs 28,1) et le flux de verify-menace en balayage
    coupe-circuit (une graine × 180 s pour « le tir vit » = la fragilité connue). Dette
    nommée : la largeur défensive (36,8 mesurée, réel 40-44 — le resserrement latéral
    côté ballon, v2 du bloc).

78. **Le prix du premier toucher + le bloc par équipe (lot 43 — deux retours utilisateur).**
    (1) « Effet AIMANT sur les longs ballons » — trouvé dans `turnover` (rondo.js) : le
    gagnant à portée amortissait 80 % et POSSÉDAIT instantanément, quelle que soit la vitesse
    (mesuré : 14 % des prises > 10 m/s, un dégagement de 26,5 m/s aspiré au pied). Le chemin
    attaquant avait sa loi d'échappée (pMiss > 10 m/s) depuis longtemps — le récupérateur ne
    la payait pas. Greffe `touchePrix` (st.full — le réduit vit le monde d'hier, doctrine) :
    LE MÊME CONTRAT — au-delà du seuil la touche peut FUIR (résiduel vivant, ballon LIBRE,
    le récupérateur va le chercher), modulé controlF, plafond 0,55. Fixture à trois mondes
    (verify-match11 §3c) : même scène à 16 m/s — tirage bas → la touche fuit ; tirage haut →
    prise propre (un bon défenseur contrôle, c'est un TIRAGE) ; clé retirée → l'aimant nommé.
    EFFET DE FLUX ASSUMÉ : buts 29 → 17 sur 20 × 300 s (conversion 49 → 29 % — les buts de
    chaos de surface meurent, on se RAPPROCHE du réel ; le 49 % d'avant était arcade).
    (2) « Les blocs sont bien liés à la tactique ? pas les mêmes pour tout le monde ? » —
    maintenant OUI : `blocFor` (formation.js, pur, UNE vérité moteur/banc) — `compacite`
    (nouvel axe tactics, ±4 m sur la longueur) et `hauteurBloc` (±4 m sur la distance
    ligne-ballon) modulent la base moteur PAR ÉQUIPE ; presets différenciés (gegenpressing
    0,7, blocBas 0,8, possession 0,45) ; 0,5 = identité de la base. Mesuré en match :
    gegenpressing 26,2 m / défaut 28,6 / possession 29,1 (blocBas 38,6 : retours de corner
    à pied + outlet — le football du bus). TROIS leçons d'instrument payées : le coup
    d'envoi d'un makeMatch frais GÈLE canTake (st.restart à nettoyer en fixture) ; les
    bornes du receveur vivant re-fondées en séparation ABSOLUE (le ×2 cassait dès que le
    vivant montait) ; et le SABOTAGE du service nonchalant jugé au NOMBRE de services, pas
    à la latence des survivants — sans urgence, seuls les services instantanés aboutissent :
    le biais du survivant rendait le monde saboté « plus rapide » (0,48 s !) alors qu'il
    sert MOITIÉ MOINS (11 contre 6 à l'échelle). Batterie verte, réduit 76/0 restauré par
    le gate st.full, rondo 40/40.

79. **Contrôle raté qui se rattrape, passe en une touche, cage éclairée (lot 44 — trois
    retours utilisateur avec captures).** (1) LE FIGÉ DU CONTRÔLE MANQUÉ : sur un long
    ballon raté, le receveur restait PLANTÉ à côté de sa touche fuyante pendant que
    l'adversaire prenait — st.pass restait VIVANT (le job receive le ciblait sur l'ancien
    point de chute). Le contrôle raté TUE LA PASSE (st.full : pass null, phase loose) et le
    fautif CHASSE sa touche — le réflexe lossReact réutilisé tel quel (les deux chemins :
    contrôle attaquant ET touchePrix). (2) LA PASSE EN UNE TOUCHE (cfg.uneTouche) : sous
    pression (presseur < 2,6 m), un ballon jouable (≤ 9,5 m/s, au sol) repart en PREMIÈRE
    INTENTION vers une ligne courte et ouverte — SANS être possédé (le patron de la remise
    de tête), déchet ×1,6 (le geste le plus dur du football), tirage seedé modulé controlF.
    Flux : 28 une-touches / 25 min (6,5 % des passes — porte pression-seulement ; la
    une-touche au calme est un axe de style, dette nommée ; photo Loi 11 : même dette que
    la remise de tête). Fixture à trois mondes (part sous pression / au calme on contrôle /
    sabotage « le monde à deux touches »). LEÇON DE FIXTURE ×2 : le presseur posé près de
    la trajectoire PREND le ballon (receiveRadius) ou l'INTERCEPTE en courant (du vrai
    football qui parasite la scène) — le marquage se pose PILE dans le dos, sur l'axe.
    (3) LA CAGE ÉCLAIRÉE (stadium-night) : les 4 nappes visaient leurs quadrants (±0,30 L)
    — la surface de but vivait dans le noir entre elles, et l'ombre de tribune du key
    (35°) couchait un coin noir sur la moitié du terrain (capture : gardien INVISIBLE dans
    sa cage). Trois corrections : visée 0,30 → 0,36 L + cône 0,68, DEUX LAVAGES DE CAGE
    (l'uniformité des vrais rigs UEFA — modestes ×0,55, la nuit reste une nuit), key à 50°.
    PROUVÉ PAR CAPTURE avant/après (playmode — l'instrument honnête d'un fix de scène) :
    le gardien se lit dans sa cage, le bol reste sombre. Rig 4 → 6 nappes (contrat
    matchday mis à jour). Re-fondations d'instrument au passage : le sabotage « service
    nonchalant » TOMBE (3 instruments cassés en 3 mondes — latence/séparation/comptes, la
    signature morphe : la clause vivante est la vérité du contrat, doctrine « une vérité
    par contrat ») ; texture épaules [1 ; 10] (la une-touche résout la pression par la
    passe AVANT le duel — conséquence football-vraie) ; ratio fatigue [0,78 ; 0,94] (il
    vivait PILE sur 0,92) ; part de plongeons → existence (le bloc compact centre les
    tirs, la prise défend sans plonger — 8 arrêts sur 11).

80. **La foulée de frappe, l'engagement-passe, les bords médians (lot 45 — trois retours
    utilisateur).** (1) LE STOP AVANT LA FRAPPE, chiffré : tirs frappés à 0,63 m/s p50
    (réel 3-6 — « un joueur ne s'arrête pas pour tirer »), 21 stops nets mesurés (courait
    > 3 m/s à 0,7 s du strike, arrêté < 1). Le frein : la glisse d'armé converge vers une
    ancre STATIQUE (le couple corps-ballon freine dedans — glideEase s'aplatit). La greffe
    `strideStrike` (st.full, UN SEUL ÉCRIVAIN préservé — leçon oscillateur) : l'ancre
    AVANCE d'un incrément décroissant (v0·e^(−t/τ), τ 0,9, plafond cumulé 2,2 m) dans la
    direction de la course du commit — le ballon porté suit le corps, l'ancre suit le
    ballon, LE COUPLE ENTIER voyage ; strikeNow re-résout au contact, le warp couvre.
    Après : corps à 1,91 m/s p50 au strike (poolé passes+tirs, 69 gestes — monde gelé
    1,17). Dette nommée : « la préparation dans la foulée » (le frein AMONT — la touche de
    préparation décélère avant le commit ; v0 bas = foulée bornée). (2) L'ENGAGEMENT EST
    UNE PASSE (cfg.engagementPasse) : la barre calme (4,8) refusait la passe courte du coup
    d'envoi → conduite systématique. Mémo posé par canTake (type engagement), fenêtre
    2,5 s : barre 0,2 + tenue dispensée — délai prise→passe 1,68 s moyen (2,49 sans la
    clé). LEÇON DE SONDE : l'événement passe porte `from`, pas `by` — la première sonde
    mesurait 0 partout et la clé semblait inerte (elle l'était AUSSI à barre 1,0 : le score
    d'une passe arrière d'engagement vit sous 1). (3) LES BORDS MÉDIANS : visée z des
    nappes 0,25 → 0,31 W — les flancs à la médiane vivaient entre les quadrants (capture
    avant/après playmode : joueurs lisibles des deux flancs). Quatre clauses re-fondées
    par le nouveau flux : mi-temps à 60 + ADDITIONNEL (le lot 24 fait son métier — la
    borne ±1,5 supposait un match sans arrêts), signature des circuits en séparation
    ABSOLUE (+5 — le ratio ×1,5 tombé quand le direct s'est mis à renverser), diagonale
    du renversement en balayage (l'étau de 6 peut GAGNER avant la bascule — crochet mordu,
    charge perdue à 2,05 s : du football), volumétrie rondo-sim 1251 → 1248 (commentaire
    resserré — la pression du plafond est réelle, le prochain gros lot devra extraire).

81. **Lot de mesure : la théorie du frein amont est morte aux chiffres (lot 46).** La dette
    du lot 45 disait « la touche de préparation décélère le corps avant le commit » — RE-
    MESURÉ d'abord (doctrine du lot 41) : v0 au commit = 3,68 m/s p50 (495 gestes), et
    4,67 APRÈS une préparation récente — le corps arrive LANCÉ, la préparation porte déjà
    l'élan (cible au travers, +2,2 m). Le résiduel (corps au strike 1,91-2,00 contre 3-6
    réel) vit dans le COUPLAGE de l'armé : τ monté à 1,3 n'a rendu que +0,09 (le carry du
    couple mange l'avance — lag du porté) et a re-cassé deux fenêtres de flux — REVERT au
    monde prouvé du lot 45 (0,9/2,2 : +0,09 ne paie pas un reshuffle). LA VRAIE DETTE,
    nommée : l'EASE DE GLISSE s'aplatit au contact (glideEase, dérivée nulle à t01=1 — le
    corps converge vers l'ancre au lieu de la TRAVERSER) ; la refonte est un chantier
    d'approche (un ease à vitesse terminale non nulle + le contrat de stance re-calibré),
    pas un réglage. Leçon répétée : TOUJOURS re-mesurer une dette avant de la payer —
    deuxième théorie de frein morte à la mesure en trois lots.

82. **L'approche pilotée du centre + le coulissement latéral du bloc (lot 47 — la dette
    nommée du lot 40, ET la v2 du bloc nommée au lot 42, tombées ENSEMBLE).** La chaîne du
    centre existait (ras de ligne → centre bas → volée) mais l'AMONT manquait : l'ailier
    n'ALLAIT jamais au ras (105 portages d'aile mesurés, 4 atteignaient la zone de centre —
    l'évasion pure recyclait vers la médiane, avance max p50 12,4 m). (1) LA CONDUITE A UN
    SENS (cfg.evadeGoal 1,3, match seulement — le rondo sans but au bit près) : le spot
    d'évasion gagne un terme de PROGRESSION vers le but adverse ; et l'AILIER en moitié
    offensive vise la ligne de fond (cfg.wingDrive : cible hx−6, largeur tenue — l'approche
    qui ARME le centre). Le terme foe arbitre naturellement les directions bouchées. (2) Le
    couloir percé CONVERTISSAIT À 73 % (38 buts / 20 × 300 s, bande 17-30 explosée) — le
    couloir d'aile n'était PAS défendu (la dette v2 du lot 42, re-mesurée avant d'être
    payée) : LE BLOC COULISSE (bloc.lateral 0,35, borne slideMax 8) — le bloc défendant
    entier glisse de lateral × z-ballon côté ballon (réel 6-10 m). La STRUCTURE mesurée :
    le couloir n'est jamais nu (p50 2 déf — marquage + press y vivent déjà) ; le vrai effet
    est la GARDE CÔTÉ FAIBLE qui rentre défendre le second poteau (24,4 → 17,4 m). Après :
    70 tirs / 32 buts (conversion 45,7 %, gardien 40 % au banc) ≈ baseline 29 — et la perce
    SURVIT au couloir défendu (10 × 300 s vs errance : zone 9 → 11, ras 5 → 8, centres bas
    2 → 4, tirs 27 → 34). LEÇON D'INSTRUMENT répétée en dur : 6 × 180 s classait lateral
    0,15/0,2/0,25/0,3 dans un ordre ALÉATOIRE (zone 1-2 partout, buts 1-5) — la structure
    (positions à 2 Hz, centaines de photos) a diagnostiqué, le flux à 10-20 × 300 s a jugé.
    Quatre clauses §3g : loi pure du coulissement (zShift exact, borne, identité anchorZ
    absent), blocFor PROPAGE lateral/slideMax (sans ça le site d'appel perdait la clé),
    « la conduite a un SENS » (fixture calme : l'évasion progresse de +0,25 m vs
    « l'errance » evadeGoal:0), « l'ailier ARME » (au ras, z tenu vs « l'aile qui
    recycle » wingDrive:false qui rentre vers l'axe — marges mesurées 0,31, figées).

83. **La foulée porte les deux bouts : la falaise du commit (lot 48 — le résiduel du « stop
    marqué », clos).** Doctrine du re-mesurer appliquée trois fois AVANT de toucher au code :
    (a) la dette « poitrine » (fenêtre morte 1,15-1,5 m) est MORTE à la mesure — 222 frames
    sur 43 110 (0,5 %), zéro attente figée : le ballon traverse la fenêtre en route vers le
    sol, pas de lot. (b) Le profil de l'armé (230 strikes) : le corps ACCÉLÈRE jusqu'à
    4,95 m/s au 3ᵉ quart puis s'effondre à 1,87 au strike — j'ai cru à l'ease (smoothstep,
    dérivée nulle à 1) et DEUX refontes sont mortes à la mesure (ease-in u² : déplace le
    creux vers l'entrée, armé 0-75 % 2,96 → 1,78 ; mélange linéaire : creux p50 toujours
    0,00). (c) L'instrument affiné (creux PRÉ-contact des frappes EN COURSE — corps > 3 m/s
    à 0,7 s du contact ; la frame de l'événement échantillonne l'instant post-courbe et ne
    PEUT structurellement pas bouger avec l'ease ; les frappes posées sont une autre
    population) a localisé le zéro : 14 frames avant l'événement = LA FRAME MÊME DU COMMIT,
    état « pass ». LE VRAI COUPABLE : l'offset commit→ancre d'un porteur lancé est quasi NUL
    (le ballon est à ses pieds) — l'interpolation n'a rien à distribuer et MULTIPLIE le
    mouvement d'ancre (strideStrike) par ep(t01)≈0 en début d'armé : falaise à 0,0 m/s,
    112 stops nets sur 127 frappes en course, quel que soit l'ease. LE FIX (une ligne de
    loi) : `strideStrike.ride` — `from` avance du même pas que l'ancre, la foulée porte les
    DEUX bouts du segment, le corps continue sa course à v0 plein dès la frame 1, l'ease ne
    règle que l'offset (« un pas, pas un rail » reste la loi de l'ajustement posé —
    approach.js revient au bit près). Après : creux p50 0,00 → 1,91 m/s, stops nets
    112/127 → 19/110 (17 %), corps au strike 1,90 → 2,31 p50, flux tenu 62 tirs / 24 buts
    (20 × 300 s). Clause §3h « la course TRAVERSE la frappe » (vivant ≤ 35 %, sabotage
    « l'élan retenu » ride:false ≥ vivant + 30 pts — mesuré 17 % vs 89 %). Le glidePunch
    essayé puis RETIRÉ (le sweep l'a montré inerte une fois le ride posé : 1,91/1,76/1,94 =
    bruit) — une clé qui ne paie pas sa doc n'entre pas dans le moteur.

84. **La une-touche au calme : le tiki-taka est un CHOIX, pas un réflexe (lot 49 — la dette
    de style nommée au lot 44).** La une-touche n'existait que SOUS PRESSION (presseur
    < 2,6 m : le réflexe de survie, ouvert à tous). Le vrai tiki-taka la joue par CHOIX au
    calme. La greffe : une deuxième porte dans la même mécanique — pCalme = calme (0,5) ×
    max(0, 1 − 2·style) : possession (style 0,1) → 0,4, défaut (0,5) → 0 EXACTEMENT avec
    AUCUN tirage consommé (le court-circuit `pressOk || (pCalme > 0 && rnd < pCalme)` est
    la preuve d'identité — l'ordre de consommation du rnd est inchangé dans tous les mondes
    par défaut). Déchet ×1,3 au calme (choisie, préparée) contre ×1,6 pressée. Mesuré
    (6 × 180 s) : possession 19,2 % de passes en une touche (68, dont 42 au calme, 62 %
    d'arrivées — la bande réelle du Barça 15-20 %), défaut 7,8 % dont ZÉRO calme, direct
    zéro calme mais 10,1 % pressées (il subit plus de press — cohérent). L'événement porte
    calme:true par spread conditionnel (zéro clé en monde pressé — Object.keys identique,
    la leçon de pureté). ET L'EXTRACTION DE VOLUMÉTRIE : rondo-sim était à 1250/1250 PILE —
    le bloc une-touche part dans `premiere-intention.js` (la famille « jouer le ballon sans
    le posséder » : la remise de tête et la volée vivent dans tete.js, la une-touche au sol
    ici), rondo-sim 1250 → 1214, identité au bit près prouvée par les 4 gardes AVANT la
    greffe calme. Clause verify-tactics : trois mondes, une clause (possession ≥ 2 calmes,
    défaut = 0 exact, sabotage « le réflexe seul » calme:0 → 0 en monde possession).

85. **La surprise complète son répertoire : la première intention n'a pas d'armé (lot 50 —
    le chantier « latence de perception » du backlog, re-mesuré d'abord).** La doctrine a
    encore payé : LA LOI EXISTAIT DÉJÀ — st._surprise (le contrat de strikeNow : « le départ
    du ballon est un événement, la défense paie max(0, réaction perso − armé vu) », retenue
    de cible dans rondoStep, politique de regard 65/35 hachée joueur×passe, équipe du passeur
    exempte, gardien exclu, note reactions → skill.reaction [0,30 ; 0,14 s]). Le lot 50 tel
    que rêvé (« aujourd'hui les défenseurs re-ciblent la frame même ») était FAUX pour les
    passes armées. Mesuré au MÉCANISME (la fraîcheur de st._surprise à la frame de l'événement
    — l'instrument de flux « cibles tenues » confondait le gel avec la stabilité naturelle du
    bloc posté, 59-77 % partout) : armée 135/135 fenêtres posées… une-touche 0/39, tête 0,
    volée 0. LE TROU : les redirections de première intention — les départs les MOINS lisibles
    du football (pas d'armé !) — étaient les seuls que la défense lisait instantanément. Le
    fix au modèle des poses existantes (strikeNow, claquette — la loi cœur est non-gatée) :
    st._surprise seen 0 posé par la une-touche (premiere-intention.js) et les 5 redirections
    de tete.js (tête but/dégagement/remise, volée reprise/dégagement, helper surprend()).
    Après : armée 131/131, une-touche 36/36, tête 7/7, volée 5/5 — TOUT départ ouvre la
    fenêtre ; seen 0 = tout le monde paie sa réaction pleine (l'armée rembourse les
    regardeurs — c'est la hiérarchie du lisible). Issue une-touche : arrivées 63 → 67 %
    (0 interception avant comme après — le gain est le TIMING du bloc, pas le vol). Flux :
    81 tirs / 29 buts (20 × 300 s, bande 17-30 — le bloc qui paie sa réaction libère un peu
    d'attaque, conversion 35,8 % saine). Clause §3d « …et elle SURPREND » (53 ✓). Dettes
    nommées : le crochet/la feinte ne posent pas de surprise (le duel les lit au corps — à
    mesurer avant de payer), la touche fuyante du turnover non plus.

86. **L'aimant inverse, la ligne campeuse, le tacle au contact (lot 51 — trois retours
    utilisateur).** (1) « LE BALLON LIBRE PART DANS LE SENS OPPOSÉ TOUT SEUL » — l'autopsie
    frame par frame a trouvé DEUX écrivains fantômes, et ni l'un ni l'autre n'était la
    conduite (le budget d'impulsion toucheDelta essayé sur théorie a été RETIRÉ, mesuré
    non-coupable — doctrine glidePunch) : le TACLE GLISSÉ résolvait sa déviation à l'INSTANT
    du déclenchement, tacleur encore à 1,3-2,6 m du ballon (et movement.js CLOUAIT le corps
    down sur place — la glisse physique n'existait pas : le monde d'hier masquait l'absence
    en téléportant la déviation) ; et la UNE-TOUCHE renvoyait un vol de 7 m/s à ~180° pleine
    vitesse sans geste. Les fixes : LE GLISSÉ EN DEUX TEMPS (lancement → le corps GLISSE
    réellement, ~1,4-1,8 m décélérés dans movement.js — puis CONTACT re-jugé dans une fenêtre
    [at ; +0,55 s] : un ballon parti fait un tacle dans le VIDE, le prix du pari) pour les
    DEUX variantes (porteur duel.js / ballon libre rondo-sim, resolver partagé, réduit gardé
    instantané au bit près) — taux de prise porteur 11 → 40 % (le vide-lourd du libre 2/19 =
    le vrai 50/50, le rival debout prend pendant la glisse) ; et LE RENVOI AMORTI de la
    une-touche (vitesse bornée par l'angle de déviation : flux 12, perpendiculaire 8,
    contre-courant 4 — le layoff du vrai football). Après : ZÉRO inversion sans acteur au
    pied (les restantes : touches de conduite à 0,3-0,9 m et volées défensives, éventées).
    LEÇON DE CHAÎNE : trois « coupables » se cachaient l'un derrière l'autre — résolution
    instantanée → corps cloué → fenêtre ponctuelle ; chaque fix a révélé le suivant à la
    mesure. (2) « DES DÉFENSEURS BIEN TROP BAS, SANS SENS TACTIQUE » — la ligne arrière de
    l'équipe EN POSSESSION campait p10 à 6 m de son but (le chemin attaquant de
    formationSpots n'avait jamais reçu la loi lot 42) : bloc.soutien (20 m derrière le
    ballon, plancher 0,12·L, longAtk 42) — p10 12,7, p50 30,9 m, traînard attaquant p90
    25,5 → 17,2. Le FRONT reste LIBRE : un plafond à 0,80 essayé exilait les pointes à 31 m
    du but (tirs effondrés 13/8×180, deux graines à zéro — mesuré puis revert) ; les pointes
    dansent sur la ligne, camping transitoire 4-6 % (borne re-fondée 7, était 4 au bloc
    campeur). (3) Les contrôles laids : PARTIEL — la une-touche amortie et le glissé au
    contact sont les gains visuels ; le churn de prise (41 % — l'instrument confond les
    cycles de conduite même-joueur) et la queue de warp (prise à 2,1 m max) restent la DETTE
    NOMMÉE « l'instrument du contrôle propre ». Flux : 45 tirs / 18 buts (20 × 300 s — buts
    en bande, les tirs baissent : le tacle qui MARCHE mange les percées, du football).
    Clauses : verify-slide re-fondé (9 ✓ — pari au lancement sans événement, prise au
    contact, bande 1,2/match), soutien pur + sabotage « la ligne d'hier » (match11 54 ✓),
    engagement 2,5 et camping 7 re-fondés avec histoire, duel 442-352 en fenêtre 120 s
    (doctrine fenêtres allongées).

87. **« Les 3 problèmes sont encore présents » : la galerie jouait LE MONDE D'HIER (lot 51b —
    la leçon la plus importante depuis le lot 1).** L'utilisateur re-signale les trois
    problèmes APRÈS le lot 51 — et il a raison : la galerie ne linkait QUE match.html (le
    5c5 RÉDUIT, l'étalon volontairement figé au bit près par la doctrine st.full) ; la page
    match11.html (le plein format où vivent TOUTES les lois des lots 34-51) existait mais
    n'était LIÉE NULLE PART. Quinze lots de réalisme étaient invisibles du produit. LEÇON
    MAJEURE : vérifier CE QUE L'UTILISATEUR VOIT fait partie du ship — l'A/B moteur ne juge
    pas la vitrine. Fix : la carte « Match 11 c 11 » en tête de galerie (le réduit reste,
    étiqueté étalon). ET EN REGARDANT ENFIN LE 11C11 EN PLAYMODE (l'instrument honnête),
    un VRAI bug tactique visible à l'œil : ballon à +35 devant la surface, TROIS marqueurs
    partis à −6..+1 marquer la ligne de SOUTIEN adverse à 40 m du ballon (la ligne montée du
    lot 51 les a rendus « marquables » — l'amas au rond central, les corps « sans sens
    tactique »). LA LOI : on marque LE DANGER — près du ballon (cfg.marquageRayon 22) OU
    dans MON tiers défensif (les centraux tiennent le 9 même ballon loin — le rayon seul
    laissait les pointes sans marqueur : la ligne montait sur elles, camping 4-6 → 13,2 %
    mesuré, corrigé par le critère de zone). Le marqueur sans homme pertinent REJOINT SON
    POSTE de bloc. Vérifié en playmode après : cibles de marquage à 10-17 m du ballon, les
    lointaines = des postes de bloc tenus. Réduit inchangé au bit près (rayon Infinity hors
    st.full). Re-fondations : camping ≤ 10 (la danse de ligne du marquage-zone vit 5-9 %),
    fenêtre contrat checkMatch 150 → 240 s (le monde à ~1 tir/2 min a droit à une fenêtre à
    son tempo). DETTES NOMMÉES : « l'attaque asséchée » (tirs 19 → 12 / 8×180 depuis le
    lot 51 — le tacle vivant + le marquage-zone sèchent les percées : le prochain lot
    CALIBRE avec l'A/B large comme juge) ; « le geste de la touche » (une touche de conduite
    qui inverse à 0,3-0,9 m du pied reste sans animation de frappe — l'œil lit encore de la
    magie : chantier scène) ; « l'instrument du contrôle propre » (churn/warp de prise).

88. **Le long ballon se reçoit à sa chute (lot 52a — retour utilisateur « les contrôles sur
    les passes longues sont tous ratés »).** La mesure a démonté la plainte en couches :
    ZÉRO raté de la loi pMiss (les longs n'arrivent presque jamais par le contrôle propre) —
    le vrai chemin : 56/82 passes longues finissaient en CHASSE AU REBOND (p90 5 rebonds,
    9 m roulés, 2,8 s de poursuite). Puis la chaîne des causes, chacune mesurée : (a) le
    quart-de-touche du « pas de contrôle légal » relançait le ballon à 75 % à chaque
    rattrapage → L'AMORTI DE POURSUITE (cfg.amortiPoursuite 0,82 : à portée d'un ballon non
    contesté, la première touche l'écrase — le contesté garde son 50/50) ; (b) la branche
    d'amorti à la RETOMBÉE manquait à voleeStep (la loi nommée au lot 40 : « le contrôle est
    le vrai geste ») → V.amorti : le destinataire joue le vol descendant à portée, la touche
    tue (−85 % H/V, controlF module) ; (c) LE PLACEMENT, la vraie racine : le receveur match
    est ancré au point NOMINAL (la leçon anti-flipper) mais vivait à 4,3 m p50 / 14 p90 de
    la chute RÉELLE — ET le premier fix (rondo.js assignJobs/maxT) était MORT-NÉ : le match
    injecte assignMatchJobs, le code de rondo n'y tourne pas (leçon d'architecture répétée).
    Le vrai site : le bloc flightRec de match-sim → cfg.chutePredite (st.full) : sur un vol
    > 1,1 s encore haut, le receveur court vers le premier point JOUABLE (y ≤ 1,2, vy < 0)
    du chemin prédit, à vitesse humaine — le déchet reste ce que ses jambes ne couvrent pas
    (les livraisons à 14 m de la cible RESTENT perdues : le football garde ses mauvaises
    passes). Après : contrôles propres 22 → 30, chasse 57 → 43, rebonds p90 5 → 2, poursuite
    p90 2,6 → 1,3 s, receveur p10 à 0,5 m de la chute. Isolation d'instrument : le sabotage
    « pose figée » coupe AUSSI chutePredite (elle animait le monde saboté plus que le
    vivant). Dettes vivantes du lot 52 : l'attaque asséchée (calibrage), le geste de la
    touche (anim), la précision des LIVRAISONS longues (p90 14 m de la cible — la moitié
    des chasses restantes).

89. **La profondeur n'est pas une erreur, et le rond central s'éclaire (lot 52b — deux
    retours).** (1) L'objection utilisateur « une passe à 14 m de la cible peut exister si
    c'est un ballon en profondeur » est JUSTE — l'instrument décomposé : en PROFONDEUR
    (point visé ≥ 6 m devant le receveur, ou coureur en appel), receveur↔chute 12,5 m p50 =
    L'ESPACE de la course, normal ; DANS LES PIEDS, l'erreur de LIVRAISON (chute↔visé) p50
    5,4 m — ça c'est la dette (réel 2-3 m pour du 20-30 m), re-nommée « la précision des
    livraisons longues dans les pieds » (le p90 23 m inclut des déviations en route —
    l'instrument du calibrage les séparera). (2) « Le terrain est trop sombre au milieu » :
    les 4 nappes visent les quadrants, les lavages les cages — le ROND CENTRAL vivait entre
    tous. Deux nappes médianes (les 2 mâts côté médiane, ×0,55 comme les cages) — 8 nappes
    au contrat matchday, capture playmode à l'appui : la médiane se lit, la nuit reste une
    nuit.

90. **La télémétrie de match : le jeu sous instrument, le « ballon seul » élucidé (lot 53 —
    demande utilisateur d'analyse).** probe-telemetrie.mjs (8 graines × 300 s, 1,29 M ticks) :
    possession 55/45 (l'axe possession possède, l'axe direct tire — 19 fins-de-séquence en
    tir contre 13), séquences 3,2 passes p50 (réel 3-5), 4-3-3 tenu des deux côtés, ballon
    au pied p50 0,49 m / >1,5 m sur 0,56 % des images (la queue de warp est résorbée),
    prise de balle à 0,80 m p50 / max 0,97 (la portée du pied, pas un aimant), ZÉRO
    téléport en jeu (1 écart >0,35 m en 40 min — les remises sont PORTÉES). L'audit du
    ballon libre (chaque tick, vitesse vs physique attendue + joueur le plus proche +
    événements du tick) : 81 % des changements attribués à un geste au contact, et le reste
    en TROIS MÉCANISMES NOMMÉS, confirmés en piégeant les méthodes du ballon (pile d'appel
    au tick fautif) puis en lisant w au tick exact : (1) L'ATTERRISSAGE SANS EFFET
    (~25/match) — la passe tendue levée atterrit spin nul, la friction Coulomb de
    resolveGround mord d'un coup : ×0,6 de vitesse en UN tick, direction conservée
    (physique honnête, geste incomplet — un vrai passeur met du lift) ; (2) LE SPIN
    ORPHELIN (~18/match) — les amortis (impulse) tuent v mais PAS w : mesuré 65-70 rad/s
    sur un ballon à 1,3 m/s, u=8-9 m/s — la friction reconvertit le spin périmé :
    backspin → INVERSION cos=−1 (« le ballon repart tout seul en sens opposé »), topspin →
    ré-accélération depuis l'arrêt (l'« aimantation ») ; (3) LA TOUCHE MUETTE (~8/match) —
    le quart-de-touche (impulse −0,25, rondo-sim receive() branche else) est un vrai
    contact SANS événement → la scène n'anime rien. Télékinésie : 2/8 matchs (gant du
    plongeon, rayon 1,7). Audit de code parallèle (13 fichiers, 161 sites écrivant l'état
    du ballon) : sains sauf 2 trous théoriques jamais vus tirer (uneTouche gardée par
    st.pass pas par la distance ; turnover à preneur lointain) + le sifflet qui freine le
    ballon à 65 % où qu'il soit (convention ballon mort, visible). Lectures tactiques
    « pas concret » : les GESTES vivent à l'envers (défenseurs 2-2,4/match > attaquants
    0,6-1,8 — déclenchés par le press subi, pas par l'envie de percer) ; côté possession le
    DG tire autant que l'AC (0,4) ; conversion 45 % (arcade ×4). Rapport artifact
    « Télémétrie du 11 contre 11 » publié. Dettes candidates nommées : amortir w dans les
    amortis (l'impulse devrait pincer la rotation), le spin naturel des passes tendues,
    l'événement du quart-de-touche (pour l'animer), re-concentrer gestes et tirs chez les
    attaquants. LEÇON : les trois « fantômes » sont UN SEUL défaut de contrat — les sites
    qui écrivent v sans écrire w laissent la physique jouer un passé périmé.

91. **Le spin orphelin meurt, la passe levée porte son effet, le quart-de-touche se nomme
    (lot 54 — les corrections de l'audit télémétrie).** Trois lois, toutes st.full, rondo/réduit
    au bit près : (1) L'AMORTI AMORTIT AUSSI LA ROTATION (cfg.amortiSpin) — chaque impulse
    d'amorti pince w DU MÊME facteur que v (dW dans rondo-sim : prise-gardien, capture,
    contrôle-manqué, amorti-poursuite, quart-de-touche ; tete.js amorti-retombée ; match-sim
    gants ; strike-sim vendangé) ; (2) LE BACKSPIN DE LA PASSE LEVÉE (cfg.passeSpin 4,5 rev/s,
    axe horizontal ⟂ au vol) — lofted/chip coupées SOUS le ballon, ET LE SOLVEUR REÇOIT LE MÊME
    EFFET (solvePass simule ball.js : la balistique inverse reste honnête) ; les CLOCHES MAISON
    (renversement, centre aérien) ont exigé la leçon en trois actes : liftées sur leur formule du
    vide elles n'ARRIVAIENT plus (le Magnus sur-porte — 4 bancs rouges en cascade), exclues elles
    rendaient la glissade d'hier (chasse 13→61 % : ce SONT les longs ballons dominants), la sortie
    est la balistique honnête — leurs vitesse/temps de vol re-résolus par solvePass avec l'effet ;
    (3) LE QUART-DE-TOUCHE ÉMET (control 'quart-de-touche', ~1/match — l'amorti-poursuite mange
    le reste) : la scène a un contact à animer. MESURÉ (8 graines × 300 s, instrument
    probe-fantomes2 affiné : une passe VIVANTE qui rebondit a une cause — le fantôme est le
    ballon MORT) : inversions du ballon mort 23 → 0 ; ré-accélérations depuis l'arrêt ~120 → 6
    (0,75/match, déviations à très gros spin résiduelles) ; touches muettes 65 → 33, inversions
    muettes 23 → 2. EFFETS DE BORD PAYANTS : chasse au rebond 43 → 19 % (68 avant lot 52),
    contrôles propres 39 → 67 %, roulé après chute p50 11,7 → 1,0 m, prise 1,3 → 0,2 s — et LA
    DETTE DE LIVRAISON SOLDÉE : passes dans les pieds chute↔visé p50 5,4 → 1,9 m (réel 2-3).
    A/B 20×300 : 80 tirs (l'attaque asséchée du lot 52 est soldée — 12/8×180 hier), 31 buts —
    la bande 17-30 déborde d'UN but au sommet, re-fondée 17-32 avec récit (les livraisons
    propres nourrissent l'attaque ; la conversion reste jugée au banc gardien ≤ 60 %). BANCS :
    verify-match +6 clauses (fixture spin orphelin w 120→6 + sabotage, backspin structurel
    28 rad/s + sabotage passe plate, existence quart-de-touche + JAMAIS au réduit) ;
    verify-renversement instruit l'angle mort loi15 (la prise a trois visages : receive,
    loose-kept, amorti) ; verify-match11 pointes ≤ 12 re-fondée (corps 1,6-5,8 % inchangé,
    pire graine étirée par le vol flotté) + régain en existence graines 3→4 (1/5/0/4/3/0
    mesuré). LE BANC A PAYÉ DEUX FOIS : la clause pointe (RÉDUIT) a attrapé mon site gants
    non-gaté st.full — le bit-près n'est pas un slogan. Batterie 63+3 verte, volumétrie
    rondo-sim 1249. Dettes nommées : le planificateur (choosePass) évalue ses candidats sans
    effet (l'exécutant lifte — micro-écart d'observation) ; le centre BAS garde sa glissade
    (sa nature) ; 6 ré-accélérations résiduelles (déviations claquette/tacle à gros spin).

92. **Le geste de la touche : la cassure de conduite a un corps qui frappe (lot 55 — retour
    utilisateur, dette lot 52).** Le demi-tour de conduite (174° mesurés à t=3,53 s — l'exact
    moment que la télémétrie voyait) n'avait AUCUNE frappe : seul l'IK du warp-touche tendait le
    pied. Loi en deux étages : (1) L'ÉVÉNEMENT PORTE SA GÉOMÉTRIE — dribble.js calcule au site du
    kick l'angle entrant→sortant (dev°) et la vitesse (spd), touchEvent les inscrit (champs
    additifs : les mondes d'hier lisent les mêmes types, physique intouchée au bit — un renderer
    aval n'a rien à recalculer) ; (2) LA SCÈNE EN FAIT UN GESTE (Rondo.js) — dev ≥ 110° →
    crochetCourt, ≥ 60° → passeExterieur, sur la COUCHE de geste (miroir au pied côté ballon,
    même convention (fz,−fx) que la sim), cadencé 0,35 s, sabotage nommé 'touche-plate'. PROUVÉ
    EN PLAYMODE : 8 touches fortes → 8 swings engagés (100 %), sabotage 5 → 0 (discriminant
    _swingT, écrit par la seule loi) ; capture du crochet plein envoyée. Fréquence saine :
    ~14 fortes/180 s dont 7-8 demi-tours (~4-5 gestes/min). Bancs : verify-dribble +2 clauses
    (0 touche nue sur 174 ; les fortes existent). LES DEUX RETOURS MID-LOT INSTRUMENTÉS dans la
    même sonde (probe-saccade-fourmi) : (a) « ÇA SACCADE » — solvePass 6,4-7,6 ms/APPEL, rafales
    de frames sim 10-18 ms (6 d'affilée à t=32,2) : la planification crève le budget 16,7 ms,
    indépendant du GPU → lot 56 nommé « le budget de la frame » (dt de résolution grossier +
    amorce analytique + cache) ; (b) « FOURMILIÈRE off-ball » — PAS du zigzag (inversions de cap
    0,03 %) mais l'absence d'ÉCONOMIE : 32 % du temps off-ball en course > 4,5 m/s, 11/20 corps
    lancés simultanément p50 (p90 18 !) — le vrai football marche à 70-80 % → lot 57 nommé
    « l'économie de course » (le suivi de poste à la MARCHE, la course est un acte nommé).

93. **L'économie de course : l'allure est une décision tactique (lot 57 — retour utilisateur
    « fourmilière/maternelle off-ball », avec l'exigence « tactiquement ça a un sens »).** La
    fourmilière n'était pas du zigzag (inversions de cap 0,03 %) mais l'absence de HIÉRARCHIE
    d'effort : 32 % du off-ball en course > 4,5 m/s, 11/20 corps lancés p50. LA LOI (movement.js,
    cfg.allure, st.full) tient en une phrase : EN JEU PLACÉ, ON SUIT LE JEU À LA VITESSE DU JEU —
    le suiveur est plafonné par la vitesse de SA CIBLE (tSpd×1,15+0,4, borné [marche 2,1 ;
    trot]), et la course reste entière pour tout ce qui est NOMMÉ : transitions (phases.js — le
    moment du jeu est enfin CONSOMMÉ par un système), fenêtre de pressing de MON équipe (l'acte
    est collectif), bursts, porteur/receveur/gardien, urgence locale (ballon < chaud 14 m, vol
    qui retombe chez moi, homme qui claque > 3,5). CALIBRÉE EN TROIS LEÇONS, les bancs comme
    juges : (1) rattrape 12 m ≈ p75 de l'ÉQUILIBRE mesuré (un suiveur de spot VIT à 6-11 m de sa
    cible — le seuil à 6 re-trottait tout le monde) — loin de son poste on trotte, le retard
    structurel n'est pas du calme ; (2) l'économie est ASYMÉTRIQUE comme le bloc : en ATTAQUE
    placée on occupe vite (trotAtk 3,9 — se démarquer est une intention), en défense on économise
    — sans ça l'étirement offensif fondait (asymétrie du bloc < déf+4) ; (3) un saut de cible est
    une RÉAFFECTATION, pas le jeu qui bouge (tSpd > 9 → trot). RÉSULTAT : courses franches
    (> 3,5 m/s) en placé calme p50 11 → 3-4 (p90 7-9 — le chiffre du vrai football), transitions
    p50 8-9 (elles COURENT, c'est leur définition), marche+arrêt 41 → 50 %, la course résiduelle
    vit aux ¾ en transitions/press (légitime). GARDES TACTIQUES TOUTES VERTES : press
    fenêtres/ligne/régain, coulissement, bloc court + asymétrie, hauteur de bloc (mécanisme
    re-mesuré PLUS FORT que lot 34 : +13,3/+12,6/+14,1 sur graines 3/7/1 — la graine 5 du banc
    s'était effondrée seule, re-fondée graine 3 selon le précédent documenté de la clause),
    circuits/appels, renversement (bande 13 → 16 : l'économie OUVRE l'aile opposée, 14,5/match,
    axial 48 %), slide. A/B : 63 tirs / 25 buts — EN PLEIN CŒUR de la bande (le 31 du lot 54
    retombe). Bancs : match11 +2 clauses (p50 ≤ 6 + sabotage allure:false → 8) ; fatigue isolée
    à effort d'hier (allure:false — la loi stamF se juge à effort égal, l'économie compressait
    l'écart sous la marge) ; le quart-de-touche passe en FIXTURE (ballon au-dessus de la
    poitrine, contesté — l'existence de flux est morte deux fois ; la fixture a DÉCOUVERT
    l'amorti-poitrine dans la table à 1,2 m). Dettes nommées : le press-job hors fenêtre reste
    vif par dB<chaud (jockey non modélisé) ; la marche pourrait lire la fatigue (marcher pour
    récupérer) ; turnover toutes les ~11 s = 45 % du temps en transition (la vraie source du
    tumulte résiduel — l'axe qualité de possession).

94. **Le budget de la frame : le solveur rapide, et la vérité du deuxième arc (lot 56 — retour
    utilisateur « ça saccade », question posée « ça va pas changer le gameplay ? »).** La saccade
    était SIM, pas GPU : solvePass 6,4-7,6 ms/appel (bissection aveugle 24 itérations × essais
    240 Hz), rafales de frames à 10-18 ms aux moments de passe. TROIS REMÈDES dans le solveur
    (ball-predict, parametrés — un projet aval choisit sa précision) : le pas d'essai suit le
    régime (roulé 1/60, aérien 1/96 — stepBall sous-échantillonne DÉJÀ par demi-rayon : seul le
    surcoût de boucle tombe, le roulé payait 1 680 itérations), l'AMORCE ANALYTIQUE (roulé :
    v² = arrivée² + 2·(résistance+traînée)·d itéré ; aérien : portée du vide ; panier VÉRIFIÉ
    par deux essais), la sortie à 2 cm/s. LA RÉPONSE À LA QUESTION EST UN BANC : la référence
    d'hier reste appelable ({dt:1/240, tol:0, seed:false}), 36 cas comparés — pire Δvitesse
    0,037 m/s, et la vitesse du rapide REJOUÉE en 240 Hz atterrit à 8 cm du point visé (pire
    cas). Résultat : 1,5-3 ms/appel, ZÉRO frame sim > 8 ms sur 120 s. MAIS l'instrument a
    DÉTERRÉ un bug de vérité : la détection d'atterrissage (« premier échantillon descendant
    sous le rayon ») ratait un rebond survenu ENTRE deux échantillons et résolvait parfois sur
    le DEUXIÈME arc — à 240 Hz aussi (mesuré : vol « 2,87 s » pour un premier contact à 1,7 s).
    Corrigée AU REBOND (vy s'inverse — exact à tout pas), les passes levées d'hier, qui
    atterrissaient SYSTÉMATIQUEMENT courtes, pénètrent leur vraie profondeur → tirs construits
    91, buts 44 : l'A/B a explosé PARCE QUE l'attaque est devenue vraie. RECALIBRAGE au levier
    balayé : marquageRayon 22→44 buts, 24→37, 26→33 (le point doux), 28→41 (trop large ouvre
    des trous) — 26 posé, bande re-fondée 17-33 AVEC récit (l'instrument suit le monde qui a
    objectivement changé ; les juges qualité tiennent tous : chasse au rebond 5 %, livraison
    p50 1,7 m, économie placé p50 4). BANCS re-fondés en instruments STRUCTURELS : ball-predict
    +2 clauses (fidélité 36 cas + atterrissage 8 cm ≤ 35), tactics hauteur en MÉDIANE DE TROIS
    GRAINES (4 re-fondations de graine unique : la graine élue s'effondrait pendant que les
    autres montraient +12-14 m — fini), essaim en COUVERTURE DES POSTES (la dispersion s'écrasait
    des deux côtés dans un monde qui marche — 3 passages à la marge), cible-plan 4 graines +
    plancher au ratio (le monde calmé vire moins), chrono terminal ≤ 2 m (les corps FINISSENT en
    marchant), fatigue isolée allure:false (la loi stamF se juge à effort égal). Dette nommée :
    le solveur tourne AUSSI au rondo/réduit (numérique prouvé équivalent, PAS gaté st.full — la
    première entorse assumée, l'équivalence mesurée est la garde).

95. **Le ballon au pied de la conduite : la touche se prend SOUS le corps (lot 58 — captures
    utilisateur : « le ballon est trop loin et ne touche jamais le pied » en course, alors que
    le porté cérémonial est correct).** Le contraste des captures POINTAIT le mécanisme :
    dribbleStep re-poussait le ballon dès la portée de jambe tendue (reach 1,15 — MESURÉ à
    l'instant de touche : p50 0,77 m, sprint p50 1,07 = le pied ne rejoignait jamais son
    ballon). LA LOI (dribble.js, cfg.prise, câblée st.full — le rondo garde reach au bit
    près) : le corps REJOINT son ballon (≤ prise) avant de le repousser ; l'exception est
    réelle — un ballon qui FUIT plus vite qu'on ne le referme se joue à pleine allonge (le
    poke du sprint, bvAway > vitesse + 0,3). LE PENDULE S'EST CALIBRÉ À LA BANDE : prise 0,62
    collait magnifiquement (sprint p90 1,35 → 0,61) mais ÉTOUFFAIT l'attaque (A/B 36 tirs,
    13 buts — sous la bande ! — le temps de rassemblement cassait le tempo) ET éteignait le
    signal du geste de touche (ballon rassemblé quasi posé → cl < 0,2 → dev retombait sur
    want : zéro touche forte au banc). Deux corrections : prise 0,8 (touche p50 0,48, sprint
    p90 1,04 vs 1,35 — le contact est net, le tempo respire : A/B 52 tirs / 26 buts EN BANDE)
    et l'angle d'une touche sur ballon LENT se lit contre le CAP DU CORPS (heading → kick, le
    vrai angle du demi-tour — la géométrie de l'événement reste vraie à toute prise).
    Batterie 66 bancs ENTIÈREMENT verte sans retoucher une clause. Capture playmode envoyée :
    porteur à 4,2 m/s, ballon à 0,20 m, le pied SUR le ballon. Dette nommée : les touches
    d'urgence du vrai sprint (pokes à pleine allonge) restent rares dans le flux économe —
    la conduite lancée longue (contre-attaque de 40 m) mérite sa photo playmode un jour.

96. **Le receveur innocenté, le sifflet rendu visible (lot 59 — capture utilisateur : « le
    receveur du ballon long ne va pas au ballon »).** LA MESURE A INNOCENTÉ LE MONDE : sur 65
    ballons longs (4 graines × 240 s), 54 pris par le receveur nommé, 2 par un coéquipier,
    ZÉRO abandon (receveur ≤ 15 m qui s'éloigne d'un ballon libre posé), et le ballon mort ne
    reste JAMAIS sans preneur (p50 0,0 s). La capture montrait autre chose — sa signature le
    disait : ballon parfaitement immobile, les DEUX corps qui s'en détournent = UN COUP DE
    SIFFLET (hors-jeu du receveur : la Loi le fait repartir en position licite pendant que le
    preneur de la remise arrive d'ailleurs, hors cadre). Du football correct, ILLISIBLE au zoom
    mobile : le ticker est coupé. LA LOI DE SCÈNE : le sifflet SE VOIT — un bandeau central
    bref (1,6 s) nomme chaque décision d'arbitrage (BUT, HORS-JEU — nºX, FAUTE — nºX, CARTON
    JAUNE/ROUGE, MI-TEMPS, SIFFLET FINAL), créé par la scène elle-même (pas dans le HTML :
    toute page qui monte la scène l'a d'office — le moteur porte sa lisibilité). Câblage prouvé
    en flux réel (le « mi-temps » a flashé de lui-même pendant l'avance playmode) + capture DOM.
    Leçon d'instrument : play_screenshot ne capture QUE le canvas — les preuves DOM se prennent
    en Playwright pleine page, avec un rendu forcé (le mode capture ne peint pas seul).

97. **La fluidité mobile : la frame du téléphone est tenue (lot 60 — retour utilisateur « pas
    fluide »).** MESURÉ en conditions téléphone (CPU ×4, 412×915, DPR 2,6, tier low déjà actif) :
    S.update seul p50 12,1 ms / p90 16,5 sur un budget de 16,7 — la sim+scène mangeait la frame
    avant même le rendu. DEUX PROFILS, DEUX ÉTAGES : (1) headless, assignMatchJobs — formationSpots
    reconstruit PAR DÉFENSEUR (~20 formations complètes/frame, arguments identiques) + tris à
    clés recalculées (hypot dans les comparateurs) → hoist spotsBloc 1×/frame + tris à clés
    pré-calculées, IDENTITÉ BIT-EXACTE PROUVÉE (hash d'événements identique, 2 graines × 120 s :
    82e078ae/c2ac2ed4) ; (2) navigateur bridé (CDP Profiler), LE SQUELETTE : updateWorldMatrix
    14,5 % + slerpFlat 8,8 % + matrices ~12 % — 22 rigs × ~50 os à 60 Hz, arbres recalculés
    plusieurs fois par frame (warps/IK/regard). LA RÉPONSE MOTEUR : LE LOD D'ANIMATION
    (Rondo.js) — la RACINE (position, lacet) reste à 60 Hz (le corps glisse fluide), les MEMBRES
    (mixer, couche de geste, regard, verrou de pieds, warps) battent à 1/2 (22-40 m caméra en
    low) ou 1/3 (au-delà) avec dt ACCUMULÉ (la bonne vitesse, moins souvent) ; JAMAIS ralenti :
    porteur, receveur, corps en geste/au sol, gardiens, proches ; ?animlod=0 = sabotage nommé.
    + le tier low PLAFONNE le DPR à 1,75 (2,6× payait 6,8 fragments pour 1 — ~30 % de budget GPU
    rendus, indiscernable à 412 px). RÉSULTAT : p50 12,1 → 6,6 ms, p90 16,5 → 10,8 sous ×4 —
    la place du 60 fps existe à nouveau. Leçon d'instrument : le profil headless ne voit QUE la
    sim — le « pas fluide » du téléphone vivait pour moitié dans la couche squelettique de la
    scène, que seul le CDP Profiler du navigateur bridé a montrée.

98. **Le GPU du téléphone : bloom low OFF, ombres 512, résolution dynamique (lot 61 — retour
    utilisateur « toujours saccadé », après le CPU réglé au lot 60).** Le banc simule le CPU
    (bridage ×4) mais PAS le GPU du téléphone (SwiftShader ne mesure rien d'utile) — ce lot
    s'argumente PAR CONSTRUCTION, sur les trois postes plein écran du tier mobile :
    (1) LE BLOOM TOURNAIT AU TIER LOW (render-pipeline.js construisait la passe sans condition
    depuis toujours) — sa chaîne de downsample est une série de passes plein écran, la plus
    chère du tier censé être léger ; le low n'a PLUS de bloom (TIERS.low.bloom:false, declared
    et construction conditionnés — le contrat declared↔passes reste cohérent). Le low promet
    la LISIBILITÉ, pas la photométrie : capture de sanité faite, la nuit de stade reste lisible
    (AgX tient l'exposition, seuls les halos partent). (2) LES OMBRES 512² EN LOW (Rondo.js) :
    la passe d'ombre re-déforme chaque rig skinné — le calcul de _tier REMONTE au-dessus du
    setupStadiumNight pour que shadowMapSize puisse en dépendre (1024 high, 512 low, 2048
    réduit). (3) LA RÉSOLUTION DYNAMIQUE (Rondo.update, plein format) : le tier se choisit à
    l'ouverture, le GPU réel ne se voit qu'en jouant — fenêtre de 2 s au chrono MURAL (dt est
    clampé à 1/30, il ment sous la charge) : < 45 fps → pixel ratio −0,25 (plancher 1,0),
    > 55 fps → +0,25, jamais au-delà du cap d'ouverture (1,5 plein format, posé dans camera()
    et stocké _dprCap) ; une fenêtre gelée (onglet caché, GC massif) se REJETTE (win ≥ 4 s)
    au lieu de se lire comme de la lenteur ; le post relit getDrawingBufferSize à chaque frame
    donc le changement se propage sans resize ; ?dynres=0 = sabotage nommé. PROUVÉ en RAF
    réelle (Playwright sans ?capture, CPU ×4, DPR 2,6) : le pixel ratio descend 1,5 → 1,0 par
    paliers de 0,25, une décision par fenêtre. Leçon d'architecture : un moteur réutilisable ne
    devine pas le GPU de l'appareil — il choisit un tier à l'ouverture PUIS écoute la frame
    réelle et rend des pixels avant de rendre des fps.

99. **Les lignes, l'aimant, le double anticrénelage (lot 62 — retour utilisateur, 2 captures :
    « toujours des saccades », « parfois des lignes sur le terrain », « des ballons qui
    s'aimantent vers les joueurs alors qu'ils roulent dans l'autre sens »).** Trois fronts :
    (1) LES LIGNES = L'ACNÉ D'OMBRE DU 512². bias −0,0004 / normalBias 0,03 étaient des
    CONSTANTES calibrées à 2048² — et 0,03 m est très exactement un demi-texel de ce
    frustum-là (113 m / 2048 / 2). Le lot 61 a rétréci la map à 512² en low : texel 4× plus
    gros, 3 cm ne couvrent plus la pente d'un texel de ~22 cm → bandes régulières sur la
    pelouse (le GPU mobile les montre ; SwiftShader float32 non — la repro locale est
    négative, le fix est prouvé par géométrie). La loi vit dans fitShadowToPitch : normalBias
    = texel_réel/2 (0,106 m à 512, et elle REDONNE le 0,03 historique à 2048), bias ∝
    2048/mapSize. Clauses banc : ratio 4× vérifié sur les deux tailles. (2) L'AIMANT = LA
    POSSESSION PRISE DE LOIN. Sonde aimant (3 graines × 300 s) : 80 des 105 captures
    accordaient la possession à un ballon qui FUYAIT le preneur (captureRadius 0,9), et le
    servo du porté (vMax 9, τ 0,04) le retournait le tick même — 39 des 42 demi-tours sans
    contact du match venaient de ce seul site ; plus 665 à-coups de porté sans événement
    (v 2,4→0,4 en un tick, l'à-coup que la scène ne peut pas jouer). Corrections (st.full,
    clé prisePied 0,5, sabotage nommé prisePied:false) : la capture exige un ballon PRENABLE
    (balPrenable, dribble.js — au pied < 0,5 m OU convergent), sinon le porteur COURT et la
    touche réelle le joue (lot 58) ; et le rassemblement du porté au-delà de 0,45 m COURBE
    (τ 0,12, vMax 6,5 — un pied, pas un aimant). RE-MESURÉ : demi-tours de prise 42 → 2,
    fuyantes lointaines 69 → 14 (capture 28 → 0), à-coups portés 665 → 378 (le reste vit
    sous 0,45 m, couvert par le corps), et touches de conduite 760 → 1272 (+67 % : les
    ballons refusés se jouent par contacts réels). A/B 20 graines × 300 s : 71 tirs,
    23 buts — bande 17-33 tenue. Fixture banc : ballon fuyant à 0,7 m REFUSÉ avec la loi,
    possédé par le sabotage. (3) LES SACCADES = LE DOUBLE ANTICRÉNELAGE. Renderer.js demande
    antialias:true (samples 4) et le tier low n'a PAS de passe temporelle → forceNoMSAA ne
    tournait pas : le low payait le MSAA 4× sur la passe scène PUIS repassait FXAA par-dessus
    — deux anticrénelages, dont un à 4× la bande passante mobile. Désormais FXAA ⇒ samples 0
    (clause contrat ajoutée : « MSAA + FXAA = le tier léger paie double »). Et l'hystérésis
    de la résolution dynamique : REMONTER exige deux fenêtres rapides consécutives (chaque
    changement réalloue les cibles du post — osciller 1,25↔1,5 toutes les 2 s SERAIT une
    saccade) ; descendre reste immédiat. Bande du tacle glissé RE-FONDÉE (plancher 0,5 →
    0,25/match, récit au banc) : le ballon de conduite plus souvent libre donne au PIQUE debout
    une part de ce que seul le tacle couché prenait — on ne se couche pas sur un ballon qu'on
    peut piquer. Front suivant nommé si ça saccade encore : la chasse
    aux allocations (pics GC ~50 ms récurrents au profil du lot 60).

100. **La balle qui « revient toute seule » = le rassemblement d'armé ; les traits résiduels =
     le 512 au bord de l'acné mobile (lot 63 — retour utilisateur, 5 captures d'une séquence
     0:18-0:22).** LE FILM REJOUÉ : la sim est déterministe, mais le navigateur intègre au dt
     RÉEL de chaque frame — le même seed y vit donc une autre micro-histoire : on ne rejoue pas
     LA partie de l'utilisateur, on rejoue SES LOIS (seed 7, config scène exacte, 1/60). Verdict
     du film : TOUS les virages sans contact restants (post-lot-62) vivaient à ±0,05 s d'un
     windup — cos jusqu'à −0,32 à 0,79 m du corps. LE SITE MANQUANT : le carry d'ARMÉ (rondo-sim
     stepGestures, τ 0,035 raide pour souder le couple des passes rapides) n'était PAS couvert
     par la douceur du lot 62 (qui ne gatait que le porté) — au windup, le ballon REBROUSSAIT sec
     vers le point de stance depuis ~0,8 m : à 20 px de haut l'armé du corps ne se lit pas, on ne
     voit que le ballon qui revient tout seul. Correction (st.full) : même médecine que le porté
     — ballon > 0,45 m du corps → τ 0,12 / vMax 6,5 (le rassemblement COURBE à vitesse de pied),
     ≤ 0,45 m → τ 0,035 intact (l'armé court garde son couple soudé, contrat d'approche sauf).
     RE-MESURÉ : le film n'a PLUS un seul rebroussement d'armé (les cos négatifs restants sont
     des passes en une touche, contact réel) ; yanks portés 378 → 313, tous au pied (< 0,45,
     accélérations alignées — la texture du servo, pas de la télékinésie). LES TRAITS : l'acné
     résiduelle du 512² sur GPU mobile (depth-buffer moins précis que le float32 de SwiftShader
     — la loi du biais ne couvre que la pente géométrique, pas la quantification). Ombres low
     REVENUES à 1024² en gardant la loi (normalBias 0,053 = 2× l'ancienne constante) : le budget
     GPU est rendu ailleurs (bloom OFF lot 61 + MSAA OFF lot 62, les deux vrais postes). Leçon
     d'instrument : une classe agrégée (« porte : 378 ») sans distribution des distances cache
     son site — 0,79 m et 0,09 m ne sont pas le même bug ; le FILM les sépare.

101. **Le couple de friction du rebond avait les signes inversés — le ballon repartait en
     arrière tout seul (lot 64, capture utilisateur : « ballon long vers la touche, s'arrête,
     repart en arrière », ballon SEUL à l'image → pas un contact, la physique).** LA TRAQUE :
     sonde d'atterrissages (3 graines × 300 s) → deux populations d'inversions sans contact
     (4,3/match) : des levées arrivant avec rw ~17,5 m/s de vitesse de surface (≈ 160 rad/s —
     pour 28 semés au départ !) qui rebroussent à cos −1, et des chandelles quasi immobiles qui
     se propulsent de rebond en rebond. LE BUG : resolveGround (ball.js) — Δω = (r_c × J)/I
     donne (+j·nz, −j·nx)/(a·r), le code faisait (−j·nz, +j·nx) : la friction d'impact
     AMPLIFIAIT le glissement (+1,5·j par sous-pas au lieu de −3,5·j). Trois preuves du bon
     signe : le produit vectoriel ; rollGround (w2 = −v/r ⇒ un tir tendu prend du TOPSPIN, le
     code buggé créait du backspin) ; jStick = (a/(1+a))·u, dimensionné pour TUER u exactement
     — vrai seulement avec Δu = −(1+1/a)·j. IDENTITÉ AU DÉFAUT : corrigé PARTOUT (ball.js, le
     cœur partagé — le prédicteur suit par construction, il importe stepBall). APRÈS : tir
     tendu u 12 → 0 en un rebond (topspin de roulement −65) ; la levée backspin S'ASSOIT
     (7 → 3 m/s, jamais négative — le « checks up » du vrai football) ; chandelle immobile ;
     inversions de match 4,3 → 0. Bancs : 4 clauses re-fondées avec récit — la chasse s'allonge
     (p90 2,2 → 3,2 : un ballon qui roule se court), le sabotage remise-snappée sur 4 graines,
     l'existence des centres sur 6 (le canal vit : 6/8 graines), et « l'élite domine aux
     OCCASIONS » re-fondée au TERRITOIRE (possession 57,4 % ≥ 54 — les tirs du format court ne
     convergent pas : 25:26 et 25:28 sur 2 × 10 graines post-fix ; l'avantage élite aux tirs
     passait EN PARTIE par l'artefact des ballons morts ramassés à la technique → dette nommée
     « le poids des notes aux occasions »). A/B 20 × 300 s : 61 tirs, 27 buts — bande 17-33
     tenue. + 4 clauses banc rebond (verify-ball 31 ✓). Leçon : quand un module REVENDIQUE un
     comportement (« backspin checks up and comes back »), vérifier que ses équations le font
     VRAIMENT — le commentaire décrivait la physique, le signe la niait ; et une mesure agrégée
     (« 665 yanks ») sans distribution cache un site — le rw ~17,5 CONSTANT sur 10 cas était la
     signature qui a tout ouvert.

102. **La couche gazon de l'impact : un rebond FREINE, toujours (lot 65 — retour utilisateur :
     « la balle avance plus vite après les rebonds »).** Le signe corrigé du lot 64 laissait une
     friction Coulomb de surface DURE — sur parquet, le topspin RELANCE légitimement le ballon au
     rebond (le « kick » du lift). Mesuré en match : 8 rebonds sur 52 ACCÉLÉRAIENT (+4 à +9 %),
     et un long ballon courait jusqu'à 25 m après l'atterrissage (réel pelouse : 10-18). LA
     COUCHE : l'herbe se déforme et avale — grassTangent 0,85 (part d'horizontal conservée à
     impact plein ; 0,82 essayé pour un topspin synthétique 1,5× hors répertoire : 4 clauses de
     flux payées pour un cas qui n'existe pas — retour au calibre du MONDE, où 0 accéléré est
     déjà mesuré), grassSpin 0,7 (l'herbe freine aussi la rotation), l'absorption
     PROPORTIONNELLE à l'impact normal (k = jn/6 : un micro-rebond n'enfonce pas — la transition
     vol → roulement reste douce). RE-MESURÉ : accélérés 8 → 0 (catégorie topspin+ disparue — le
     spin n'a plus le temps de s'accumuler), backspin s'assoit à 0,51, un rebond roulant freine
     de 16 %, courses post-atterrissage p90 18,8 → 10,4 m, max 20,7. A/B : bande 17-33 tenue.
     Clauses : un ballon roulant-accordé ne gagne JAMAIS de vitesse au rebond ; le kick du
     topspin 1,2× roulement (la borne du répertoire : une liftée fait 8-10 rev/s) est mangé ; la clause
     « rétro » re-fondée (seuil 1,0 → 0,7 : une part du freinage est désormais portée par
     l'herbe, commune aux deux ballons). LA FIDÉLITÉ DU SOLVEUR RE-FONDÉE PAR CHEMIN : la
     non-linéarité k(jn) par rebond rend la vitesse initiale des chemins MULTI-REBONDS dégénérée
     (une tendue de 28 m atterrit à ~11 m puis rebondit jusqu'à la cible — rapide 22,49 vs réf
     21,55, les DEUX atterrissent à ≤ 0,08 m) : mono-arc → Δv ≤ 0,15 strict (l'ancien contrat),
     multi-rebonds → le juge est l'ATTERRISSAGE + garde-fou Δv ≤ 1,2. Leçon : chaque couche
     physique nouvelle re-pose la question « qu'est-ce que la fidélité promet » — ici la vitesse
     de frappe d'un chemin à rebonds n'est plus une grandeur contractuelle, l'assiette du
     gameplay l'est.

103. **Le glissé se lit debout : la table, le couloir, la course (lot 66 — suite choisie par
     l'utilisateur : « les tacles glissés existent ? »).** ILS EXISTAIENT (lots 32-33, 51) mais
     le monde du gazon les avait déréglés : 6,3 engagés/match (0,3 avant) dont 82 % dans le
     VIDE. LA TRAQUE PAR SIGNATURE D'ÉVÉNEMENT (bearing ⇒ rondo-libre) : 21 vides « de
     lancement » = la table technique refusait APRÈS que le corps soit parti au sol ; 14 ratés
     secs du glissé sur ballon LIBRE = trySlide ne vérifiait PAS l'alignement course→ballon (le
     corps glissait droit dans SA course, le pied passait à > 1 m d'un ballon assis) ; 10 vides
     de contact = le point figé périmé. LES CORRECTIONS (st.full, sabotage slideTackle.predit) :
     (1) ecartCouloir (duel.js, PARTAGÉ par les deux déclencheurs) — l'écart du ballon au rayon
     de glisse se lit DEBOUT ; (2) le glissé-porteur valide la table ET le ballon PRÉDIT
     (predictPath — physique gazon comprise) au milieu de la fenêtre de balayage AVANT de se
     coucher ; (3) le glissé-libre exige couloir + course gagnable contre le rival ; (4)
     L'IMPRUDENCE RESTE UN CHEMIN DU RÉEL : un couloir qui trouve les JAMBES du porteur part
     même table refusée (la faute, le jaune — la fixture du banc l'a exigé), mais un couloir
     qui ne trouve QUE l'homme ne gagne jamais le ballon (won exige couloirBallon) ; (5) le jet
     +0,15 (l'accuracy 0,6 couvrait l'incertitude géométrique, désormais validée en amont — le
     jet ne porte plus que l'exécution). TEXTURE FINALE : 4 engagés/match (≈ 12 rapportés à
     90 min — le réel), 33 % de prise + fautes vivantes + esquives du porteur, ratés secs
     14 → 2. Clause banc nouvelle : « le corps ne se couche plus à côté » (ratés secs ≤ 1/match).
     Leçon d'instrument : une étiquette agrégée (« vide ») mélangeait quatre football différents
     — le raté sec absurde, le jet perdu, l'esquive subie, la faute d'imprudence ; la signature
     de l'événement (bearing, dist, faute) les sépare, et chacun a EU son traitement propre.

104. **La possession commence par l'off-ball — le diagnostic et la première moitié (lot 67a,
     question utilisateur : « avant de régler ça, il ne faut pas régler les déplacements
     défensifs et offensifs off-ball ? » — SI, et la mesure le prouve).** LE DIAGNOSTIC
     (3 graines × 300 s, sonde offre/pression/choix) : le porteur avait UNE option sûre en
     médiane et ZÉRO 44 % du temps (option sûre = coéquipier à 6-20 m, non marqué < 2,5 m,
     ligne de passe dégagée à 1,3 m) ; 18 des 27 passes fatales n'avaient AUCUNE option
     arrière (la conservation du vrai foot n'était pas offerte) ; pression au passeur p50
     1,2-1,3 m IDENTIQUE pour les passes qui vivent et qui meurent → le choix du passeur
     n'est PAS le discriminant, l'ENVIRONNEMENT l'est. LA CAUSE OFFENSIVE : les couloirs de
     soutien (5 slots relatifs à l'ancre) et les postes coulissés sont des positions
     GÉOMÉTRIQUES AVEUGLES aux défenseurs — un slot dans l'ombre est un slot mort. LA
     CORRECTION 67a « SE MONTRER » (match-sim, st.full, cfg.demarque, sabotage nommé) : à
     chaque cadence de re-visée (0,7 s — la ligne bouge avec les défenseurs, un slot immobile
     mais fermé doit se ré-ouvrir), si la ligne porteur→slot est coupée ou le point marqué,
     le slotter décale perpendiculairement (±2,5 puis ±5 m) vers le premier point OUVERT ;
     rien d'ouvert → le couloir tactique reste (la structure prime). MESURÉ : 0-option 44 %
     → 34 %, passes fatales sans option 13 → 6, sans-arrière 18 → 11 — l'offre s'ouvre, MAIS
     les chaînes restent à p50 1 : l'autre moitié est DÉFENSIVE. LE COUPABLE 67b IDENTIFIÉ
     (sonde pression par moment) : en jeu PLACÉ, le plus proche du porteur est le job PRESS
     dans 957/1065 échantillons à p50 1,07 m (p10 0,50 !) — le presseur désigné COLLE en
     permanence, hors de toute fenêtre de pressing (la dette « press-job hors fenêtre vif »
     était déjà nommée). Le vrai foot JOCKEYE à 2-3 m en placé et ne croque que sur
     déclencheur (lot 11) — LE CONTAIN est le prochain paquet : cible de contention à ~2,2 m
     côté but hors fenêtre/transition/zone dangereuse. Un défenseur sous 3 m en médiane : le
     RESTE du bloc est sain, c'est le press seul qui étouffe.

105. **La possession commence par l'off-ball, 2e moitié : se montrer VERS le but, la gâchette
     qui prime, le presseur cadré (lot 67a complet).** Suite de la note 104. LE SE-MONTRER v1
     (premier point ouvert) a payé son effet pervers MESURÉ : l'offre latérale toujours
     disponible faisait TOURNER le ballon autour du bloc au lieu de le percer — seed 7 passait
     de 5 tirs à 0 en 330 s (temps en zone de frappe 22 → 11 s, élections de tir 5 → 2). LE FIX :
     parmi les points ouverts, LE PLUS AVANCÉ gagne (on tourne pour déplacer le bloc, puis on
     joue vertical) — seed 7 revient à 5 tirs (7 élections), l'offre reste ouverte (0-option
     44 % → 33 %). L'OCCASION SE PREND (menace.js, cfg.tirFranc/tirTente, sabotage nommé) :
     cadre en vue à ≤ 0,8·R → le score de tir plancherisé 0,72 (seule une passe qui vaut MIEUX
     qu'une occasion la vole) ; demi-couloir à ≤ 0,6·R → 0,55 (le tir contré/dévié fait vivre
     la surface). LES REFUS NOMMÉS ONT TOUT DIT : st.deny sur seed 7 = 1476 « ballon-vif »
     (structurel — la porte d'armé de frappe contre le monde des touches libres : DETTE 67b
     nommée « la gâchette du monde des touches ») ; le registre du patron referee est l'outil
     de diagnostic le plus rentable de la session. Le glissé re-durci une fois de plus (le
     se-montrer multiplie les ballons libres EN MOUVEMENT : le couloir du glissé-libre passe au
     ballon PRÉDIT — ratés secs 11 → 1) ; l'imprudence a sa retenue (70 %) ; re-fondations avec
     récit : garde-fou fautes 2 → 2,5 (dont 1,3 de charges-derrière, dette nommée), conversion
     gardien 60 → 65 % (quantum de 12,5 %/tir), fenêtre du contrat 240 → 330 s (doctrine « la
     fenêtre suit le tempo »), libellé 'occasion-franche'. Leçon de méthode : trois fois dans
     ce lot, la première version d'une correction a créé le défaut suivant (latéral-sûr →
     stérilité ; instantané → ratés secs ; chaque-jambes-part → fautes) — le CYCLE
     mesure→correction→re-mesure à CHAQUE étage est ce qui a permis de les attraper avant le ship.

106. **Lot 68 : les traits étaient de VRAIES ombres, le « sous terrain » était l'éclairage, le
     latéral rentre (et le rattrapage retiré).** Trois observations utilisateur (captures MT1
     0:56-0:59). (a) « DES JOUEURS PASSENT SOUS LE TERRAIN ? » — instrument playmode (os
     Foot/Toe des 22 rigs, 176 s vivantes : 5 tacles, 2 plongeons, 1 but) : y minimal −0,116 m,
     zéro épisode — les corps ne s'enfoncent plus. Le vécu était l'ÉCLAIRAGE : pelouse-île sur
     noir (abords jamais nappés, CLAMPÉS dans l'ombre des tribunes hors frustum) — un corps en
     touche (Loi 15) posait sur du vide noir. Panneaux LED (0,25 → 1,0) + l'effet de bord de
     (b) : sans architecture dans la carte, le clamp hors-frustum devient ÉCLAIRÉ. (b) LES
     TRAITS : pas de l'acné — les VRAIES ombres de l'architecture sous la clé unique (mât =
     ligne diagonale, TRANSVERSALE en travers de la surface — pile la zone des captures,
     terminateur de toit au coin). « normalBias ignoré en WebGPU » INFIRMÉ (ShadowNode r185 :
     bias l.345/374, normalBias l.45137) ; une vraie ombre ne cède à aucun biais — les lots
     62-63 ne pouvaient qu'amincir. LOI : buildStadium archCast=false — seuls les corps du jeu
     s'impriment (rig UEFA = pelouse uniforme) ; 0/225 casters au défaut, 208 au sabotage nommé
     (verify-matchday) ; ~13k sièges quittent la passe d'ombre (gain mobile structurel).
     (c) LE LATÉRAL OPPOSÉ : mesuré p50 10,4 / p90 22,0 m derrière la médiane — trois causes
     empilées : poste STROBOSCOPE (_slotT cumulé 12-23 m/s, ancre = ballon brut), marche à
     2,10 m/s vers un poste à 8 m (économie lot 57), et pas de loi de rentrée. Retenu :
     bloc.rentre 9 (formation.js — ligne de 3 : z demi + 9 m plus haut, arrières larges côté
     faible seulement, 3-5-2 = identité, 2 clauses verify-match11) + ANCRE LENTE du tuck
     (τ = 2 s sim, st._tuckZ ; l'ancre lente en X essayée a fait traîner la ligne — négatif
     consigné). RÉSULTAT NÉGATIF MAJEUR : rattrapeAtk (6 puis 8) — la marée du bloc au trot a
     SURALIMENTÉ le siège : A/B 20 × 300 s à 37-39 buts (bande 17-33 crevée) ; décomposé,
     rattrapeAtk seul = 33, rentre seul = 22 (innocent) → défaut final 12 (la vitesse d'hier),
     clé-levier documentée. Le vécu réparé SANS lui : isolement du latéral faible p50 12,5 →
     8,2 m, |z| tenu 18,0 → 10,0, retard 14,3 → 8,4 — et les buts de transition encaissés
     BAISSENT (10 → 6-7 : la ligne de 3 coupe les contres). ÉQUILIBRE FINAL : 64 tirs / 31 buts
     (bande OK). Re-fondations d'instruments avec récit : 442v352 en balayage graines 3→5
     (22/27/38 passes) ; « postes tenus » juge les postes que le moteur SERT (soutien+rentre+z —
     le chemin legacy comptait le latéral rentré comme déserteur) ; asymétrie de bloc ≥ +1,5
     (le rentre raccourcit l'arrière attaquant de ~1 m, le sens vit à +2,0) ; conversion
     gardien = buts/(buts+arrêts) (buts/type-shot mélangeait reprises au numérateur et tirs
     seuls au dénominateur : 86 % affiché pour 32 % réel) ; une-touche calme sur {1,3,5}.
     LEÇONS : l'instrument du VÉCU (isolement) ≠ celui du système (retard médiane — criait
     encore quand le vécu était guéri) ; chercher LE CASTER avant de tourner un biais ; mesurer
     dans le monde SHIPPÉ (shotRange 20 — le défaut m'a d'abord menti) ; DÉCOMPOSER un lot
     multi-lois avant de tourner un bouton global ; l'émulation « hier » doit être le sabotage
     EXACT (rattrapeAtk 99 ≠ ratt 12 d'hier — trois A/B faussés avant de le voir).

107. **Lot 69 : les traits horizontaux sont le SYMPTÔME de la frame longue — la sim passe en
     zéro-allocation, l'empreinte au bit (et deux instruments démasqués).** Capture 22:04 :
     « joueur sous le terrain ou coupé et trait sur l'écran donc saccade ». Les traits de CETTE
     capture sont HORIZONTAUX ÉCRAN (parfaitement droits, ils traversent lignes blanches et
     pelouse) — pas les ombres diagonales du lot 68 : un artefact de PRÉSENTATION du GPU mobile
     à tuiles quand la frame dépasse le budget — l'utilisateur a fait le lien lui-même (« donc
     saccade »). Le « joueur coupé » : NON REPRODUIT — l'instrument os de pied sous dt CHAOTIQUE
     seedé (154 s : 60 % 16 ms / 25 % 50-150 ms / 15 % 300-700 ms) donne min −0,08 m, zéro
     épisode — la couche de geste tient les grosses frames ; le corps de la capture est un
     tacleur au sol légitime, minuscule en DPR 1 (surveillé, pas de fix aveugle). LE REFACTOR :
     la boucle chaude de match-sim ne construit plus le monde à chaque frame — buffers
     réutilisés (st._bField/_bAtk/_bDef/_bFree/_bSlotters/_bPosted/_bFoes/_bByDist/_bMarks/
     _bMTri/_bSlots), boucles inline (hunter/foeD/foeGuard/front/hot/outlet argmin-argmax :
     l'égalité va au premier comme le sort stable d'hier), clés de tri TRANSIENTES sur le
     joueur (_dAnc/_dMark — l'ordre de départ préservé pour les égalités), marks hoisté (le
     prédicat ne dépend pas du marqueur), formationSpots(out) muté en place (sans out : les
     bancs d'hier au bit), st._slotT COPIÉ (aucune référence de buffer ne survit à la frame).
     PREUVE : empreinte sha256 (positions 4 décimales + events + score, 2 matchs × 120 s +
     rondo 90 s + réduit 90 s) IDENTIQUE avant/après. DEUX INSTRUMENTS DÉMASQUÉS : (1) le
     delta usedJSHeapSize est QUANTIFIÉ par Chrome — 158-187 « Ko/frame » fantômes selon la
     session (l'avant/après inter-sessions ne se compare pas) ; (2) le sampling heap profiler
     V8 n'attribue que ~0,2 Ko/frame à la sim. LE juge fiable est la DISTRIBUTION DES TEMPS DE
     FRAME : p50 0,90 / p90 2,00 / p99 3,70 / max 5,6 ms sur 3600 frames (sim + couche visuelle
     complète, tier low) — ZÉRO frame > 16 ms, donc zéro pause GC majeure en 60 s : le CPU JS
     n'est PAS le goulot des bandes du téléphone. Ce qui reste : GPU/compositor mobile — le
     build s'allège encore (lot 68 : ~13k sièges hors passe d'ombre ; ici : pression GC réduite)
     et ?fps=1 affiche le compteur (le prochain retour se date avec un chiffre à l'écran).
     Si les bandes persistent au retest : pistes GPU pures (géométrie du stade au tier low,
     plancher DPR, format du canvas).

108. **Lot 70 : la physique de contact joueur/ballon — le contrôle se prend DE FACE, au pied
     (le grand pas du moteur nommé par l'utilisateur).** Retour : « l'endroit de contact
     ballon-joueur n'est pas bon… le corps et les pieds ne touchent pas le ballon sur les
     contrôles et le joueur se réoriente avec la balle sans la toucher ». MESURÉ (3 graines ×
     300 s, angle corps→ballon à l'instant de chaque événement) : 54 % des amortis-poursuite
     DANS LE DOS (> 100°), 26 % des réceptions (p90 160°), prises p90 107° — et 76 % des dos
     avec le corps DÉJÀ en rotation : l'intention tournait, la sim consommait 2-5 frames trop
     tôt. TROIS LOIS : (1) LE CÔNE AVANT (dansCone, dribble.js ; cfg.priseCone 100°, st.full)
     — les touches HORS TABLE (amorti-poursuite, quart-de-touche, capture) exigent le ballon
     devant, comme la table des techniques l'exigeait déjà pour les siennes (fenêtres ≤ 80°) ;
     hors cône : refus nommé 'controle-dos', le ballon COURT, le pivot en cours reprend à la
     capture (le différé émerge sans horloge). (2) LE RECEVEUR SE PRÉSENTE (cfg.sePresente,
     movement.js) : quasi statique avec un vol pour lui → yawWant vers le ballon (slew borné) ;
     v1 ratée CONSIGNÉE : le piétinement de la statue vivante (> 0,25 m/s) re-collait le yaw à
     sa dérive chaque frame et le slew ne gagnait jamais (24 % dos après v1) — pendant la
     présentation, l'AUTORITÉ du cap est le ballon, pas la dérive. (3) LE WARP DU CONTRÔLE
     (Rondo.js) : l'événement 'control' arme _touchT — le warp de pied de la conduite (lot 58)
     s'applique au contrôle (le clip seul ne sait pas où le ballon est). RÉSULTATS : dos aux
     réceptions 26 → 2 % (angle p50 2°, p90 47°), contrôles 20 → 2 %, prises 12 → 4 %,
     amorti-poursuite 54 → 0 % ; pied RÉEL (os, playmode, min sur la fenêtre du geste) :
     contrôles p50 0,60 → 0,10 m / p90 1,13 → 0,69, réceptions p50 0,06. RONDO ET RÉDUIT AU
     BIT (empreinte sha256 inchangée) ; A/B 20 × 300 s : 67 tirs / 27 buts (bande 17-33) ;
     4 clauses match11 (géométrie pure + amorti-dos 0 + présentation ≤ 8 % + sabotage
     « touche omnisciente + dos fossile ») ; batterie 30 bancs + match11 62/62. DETTE NOMMÉE :
     la touche de conduite passe 6 → 12 % dos au re-brassage (l'aimant du porté pendant les
     pivots serrés — le prochain étage du contact), et rondo.js émet des 'control' sans tech
     (6 % dos, n=68). La volumétrie a plié deux fois (rondo-sim 1253 → 1248 par compression
     de commentaires, match-sim déjà au plafond).

- Skill `threejs-aaa` : refs 01–22, scripts de vérif (interaction / scene / temporal / locomotion), starter runnable.
- Modules moteur natifs : rendu (WebGPU+IBL+post), `locomotion.js` (matchCadence) + `foot-lock.js` (FootLockIK,
  no-slide), `character-controller.js` (facing sans moonwalk, run/idle, sprint, jump), `input.js`
  (clavier + manette + souris + tactile), `third-person-camera.js` (caméra pilotable), validateurs.
- Galerie publique déployée : https://threejs-aaa-showcase.vercel.app (jouables : **Carrière**,
  Contrôles, Physique, Intérieur ; génération : Lieux, Stades ; plus Soldier Volley dribble→centre→volée,
  Matériaux PBR, Monde procédural, IK, Géométrie, Bloom, Océan, Herbe).
