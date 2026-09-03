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

109. **Lot 71 : le banding dithéré, le faux-cull innocenté, le contrat zéro-contact étendu aux
     turnovers.** Trois demandes utilisateur (captures 23:02-23:03 + « on doit arriver à 0 % de
     contrôle sans toucher un membre non ? »). (a) LES TRAITS : fins, horizontaux, parfaitement
     RÉGULIERS et périodiques À L'ÉCRAN sur les deux captures = le COLOR BANDING de la
     quantification 8 bits du dégradé vertical d'éclairage de la pelouse (OLED + DPR 1 le
     crient ; l'écran de bureau le cache) — ni une ombre (lot 68), ni du tearing (lot 69) :
     la TROISIÈME espèce de « trait », chacune avec sa physique. Remède du métier : ±½ niveau
     d'interleaved gradient noise (Jimenez) AVANT quantification, en bout de chaîne
     (render-pipeline, tous tiers, coût arithmétique nul), déclaré au contrat (declared/passes)
     et débrayable ?dither=0 — le sabotage nommé ET l'A/B téléphone. (b) JOUEURS
     INVISIBLES/COUPÉS : l'hypothèse frustum-culling des SkinnedMesh (boundings de bind pose,
     frustum portrait étroit) était belle — INFIRMÉE par l'instrument : 5775 corps-dans-le-champ
     échantillonnés en 412×915, ZÉRO faux-cull, et frustumCulled=false déjà posé partout
     (154/154 meshes — squad.js l'avait fait). Le phénomène rejoint la famille présentation-
     sous-frame-longue du lot 69 (une bande de tuiles qui montre la frame N−1 sans le joueur =
     coupé en 2/invisible) — le remède reste la frame courte (lots 68-69) + le retest téléphone
     datera avec ?fps=1. (c) LE CONTRAT ZÉRO : le cône avant étendu aux DEUX chemins de prise
     restants — la branche turnover de receive() (interception/récupération/tackle, rondo-sim)
     et la prise de turnover du « prix du premier toucher » (rondo.js l.645, la SEULE possession
     hors cône qui restait) ; hors cône : le ballon VIT (le chemin hors-portée déjà prouvé du
     lot 43), refus 'controle-dos'. Mesuré après : CONTRÔLES 0 % dos (p90 80°), prises 4 → 2 %
     (le résiduel = ramassages de REMISE à la main, légitimes), réceptions p50 2°/p90 46°
     (4 cas « > 100° » = biais d'instrument post-settle). Rondo et réduit AU BIT (empreinte).
     Bancs 62/40/84 verts. La dette #73 (aimant du porté, touches conduite 11 % dos) reste le
     prochain étage du contact.

110. **Lot 72 : la chaleur du téléphone, les tas de marqueurs, l'arbitre qui tient le rond,
     le coup d'envoi à deux.** Captures ?fps=1 (CPU 7,32 ms à 0:33 puis 19,70 ms à 1:41) +
     « tas de joueurs » + traits résiduels. (a) LE CPU QUI CROÎT N'EST PAS UNE FUITE : la sim
     locale est PLATE (1,0-1,1 ms sur 240 s, scène 1945 objets stable, DOM stable) — la
     croissance 7→20 ms sur téléphone est du THERMAL THROTTLING (le SoC réduit sa fréquence
     sous la chaleur). On ne « répare » pas un throttling, on produit MOINS DE CHALEUR :
     plancher de résolution dynamique 0,75 au tier low (drMin — était 0,55 implicite) et
     tribunes ÷2 au low (InstancedMesh count>800 → count/2, `?seats=full` restaure). (b) LES
     TAS DE 4-5 CORPS (34 % des photos avec ≥3 corps à <1,2 m) : les marqueurs SURNUMÉRAIRES
     de mTri allaient chacun sur SON plus-proche — trois voisins élisaient le même homme.
     UN MARQUEUR PAR HOMME en 11c11 : le surplus rejoint son poste (le réduit garde le
     doublement d'hier au bit — marquer à deux est son monde). (c) Le fix (b) a RÉVÉLÉ une
     régression d'engagement (14 s avant la première passe, graine 1 : l'attaquant du but
     précédent TRAVERSAIT le rond et contestait le preneur — ping-pong possess/release, 63
     refus ballon-vif) : deux fixes posés PUIS RETIRÉS faute d'effet mesuré (pas de loi
     morte) ; le vrai remède est la Loi 8 elle-même — canTake (referee) REFUSE la reprise
     d'engagement tant qu'un adversaire de champ est à <0,9×circle du point. 14 s → 1,2 s.
     (d) La clause match11 « l'engagement est une passe » restait rouge (7,46 s de moyenne) :
     la graine 5 seule crevait tout — le preneur du coup d'envoi N'A PAS DE PASSE : son plus
     proche soutien est à 14,7 m, HORS passRange [2,5-13] — choosePass rendait NULL toute la
     fenêtre (les autres graines passaient par accident : un coéquipier ENTRAIT dans les 13 m
     pendant la fenêtre, et le fix (b) a déplacé les ombres de couverture sur la 5). Le vrai
     foot le dit : LE COUP D'ENVOI SE JOUE À DEUX — placeKickoff/kickoffSpots posent le
     second homme au bord du rond ([sign×2,6, −2,4], 3,5 m du ballon, dans son camp, même
     clé engagementPasse), et la première passe EXISTE toujours : délai 1,01 s sur les 4
     graines de la clause, uniforme. Leçons : le throttling se mesure en ÉLIMINANT la fuite
     (sonde de croissance locale d'abord) ; un fix qui retire une pression accidentelle
     (mTri) peut révéler un vice plus ancien ; la géométrie d'une remise est une LOI DU JEU,
     pas un hasard de formation — quand une clause dépend d'un couloir accidentel, poser le
     placement que le vrai foot prescrit.

111. **Lot 73 : la QUATRIÈME espèce de trait — le battement du canvas fractionnaire.** Nouvelles
     captures utilisateur (00:11/00:15) : les traits persistent APRÈS le dither du lot 71 —
     et le compteur confirme au passage que le volet chaleur du lot 72 a mordu (CPU 9,15 →
     11,34 ms sur 4 min contre 7,32 → 19,70 avant ; fps 44 → 49). Le dither était HORS DE
     CAUSE : vérifié présent dans le graphe de tous les tiers. La vraie fabrique : le
     COMPOSITEUR du navigateur étire notre canvas (backing = CSS × pixelRatio) vers l'écran
     physique d'un facteur devicePixelRatio/pixelRatio — FRACTIONNAIRE avec le cap 1,5 sur un
     écran 2,625 (facteur 1,75). Un bilinéaire à facteur fractionnaire produit un battement
     périodique de rangées nettes/floues (période ≈ q pixels pour un facteur p/q) — des
     stries horizontales fines, régulières, dès la PREMIÈRE minute, insensibles au dither
     (elles naissent APRÈS notre pipeline). REPRODUIT ET MESURÉ en playmode (même scène figée,
     3 ratios) : autocorrélation des rangées de pelouse détrendées — facteur 1,75 : pic
     +0,638 à la période du battement ; facteur 2 ENTIER : −0,105 (rien) ; natif : +0,098.
     La loi (Rondo.js) : LE RATIO S'ACCROCHE AUX DIVISEURS ENTIERS DU DPR — _drRungs()
     = dpr/1..dpr/4, _snapDpr() aux caps d'ouverture (1,5 plein format, 1,75 low), et
     l'échelle dynamique MARCHE SUR LES CRANS (_snapUp — le pas arithmétique −0,25/+0,25
     d'hier retombait sur le battement ; la montée par pas se serait même coincée sous le
     cran suivant). Sur le téléphone type : 1,3125 (étirement 2,0) ↔ 0,875 (étirement 3,0),
     le cran 0,656 refusé sous le plancher 0,75. ?drsnap=0 : l'échelle lisse d'hier,
     sabotage nommé — vérifié bit à bit dans le bundle (1,5/1,25 restitués). Leçons : quand
     un remède PROUVÉ (dither mesuré au pixel) ne change RIEN au symptôme, le symptôme vit
     dans un AUTRE étage de la chaîne — chercher l'étage, pas doser le remède ; le
     compositeur du navigateur fait partie du pipeline de rendu du moteur, même si on ne
     l'a pas écrit ; les espèces de traits sont maintenant QUATRE (ombres 68, présentation
     69, banding 71, battement 73), chacune avec sa physique et son instrument.

112. **Lot 74 : les 60 fps du téléphone — l'inventaire, la cuisson expérimentale, la sonde
     embarquée.** Retour utilisateur : « chute de fps autour de 30 en permanence, il faut 60
     sans restreindre la qualité ». D'abord la lecture des captures : les traits ont DISPARU
     (loi des diviseurs lot 73 confirmée sur l'appareil) ; le 33-34 fps stable = verrou vsync
     un-sur-trois d'un écran 100 Hz (l'ancien monde accrochait un-sur-deux ≈ 50 : son plancher
     dynres 0,75 rendait moins de pixels que le cran propre 0,875 — la frame est passée juste
     au-dessus de 20 ms). L'INVENTAIRE (playmode, renderer.info) : 244 draw calls, 1,13 M
     de triangles dont 924 396 SKINNÉS (82 %) — chaque joueur pèse 42 018 tri (corps 12 933
     dessiné ENTIER sous maillot/short/chaussettes, cheveux 9 524 = 23 %, cils 960), coût
     vertex INDÉPENDANT de la résolution — voilà pourquoi baisser les pixels n'a jamais donné
     60. Et 11 lumières forward par fragment (8 SpotLights statiques de mâts + 2 dir + hémi).
     Fait : (a) cils invisibles à 20 m → cachés au match (?cils=1 les rend) ; (b) CUISSON des
     flaques de mâts (stadium-night, bake/dynLayer) : texture d'irradiance demi-flottante par
     la MÊME formule analytique que le shader (candela/d², fenêtre smoothstep, Lambert),
     lightMap+uv1 planaire sur pelouse/abords, spots basculés couche 3 — MAIS la couche
     dynamique ne sert PAS les spots aux corps sous WebGPU (joueurs noirs mesurés : ils vivent
     des nappes, 1600-4300 cd contre une clé 0,95) et le débordement des nappes éclairait
     réellement les tribunes (−66 % de luminance sans). La cuisson reste dans le moteur
     DERRIÈRE ?bakelight=1 (expérimentale, calibrée pelouse à 1,002 près au global via
     lmI 2,5) — PAS de loi non prouvée au défaut : identité au pixel vérifiée (ratios 1,000
     pelouse/tribunes/bord). (c) LA SONDE EMBARQUÉE ?probe=1 : le GPU du téléphone est
     invisible d'ici (pas de timestamp queries) — le téléphone DEVIENT l'instrument : quatre
     configurations cyclées 4 s (tout / sans nappes / sans corps / basse déf), fps médian
     affiché à demeure — UNE capture utilisateur dira où vivent les millisecondes, et
     l'investissement suivant (refaire la cuisson par un autre mécanisme, ou LOD de maillage
     des corps par décimation hors-ligne) se choisira sur PREUVE. Leçons : le coût vertex ne
     se voit pas dans un compteur de pixels ; une optimisation « évidente » (layers) peut
     buter sur la sémantique du backend — la garder derrière une clé et instrumenter plutôt
     que forcer ; quand l'appareil qui souffre est hors de portée, EMBARQUER l'instrument.

113. **Lot 75 : l'éclairage cuit v2 — la sonde a désigné les nappes, le tier low les cuit.**
     Capture-verdict utilisateur (?probe=1) : tout 18 fps / SANS NAPPES 60 / sans corps 48 /
     basse déf 60 — les 8 SpotLights forward coûtaient ~40 ms/frame de fragment sur l'appareil
     (et « basse déf 60 » prouve le lien : coût par-fragment). V2 SANS layers (leçon 112) :
     (a) pelouse+abords portent la lightMap analytique des 8 nappes (formule du shader :
     candela/d², fenêtre smoothstep, Lambert — plus une FUITE isotrope 0,14 hors cône : le
     bord vivant gagne du spéculaire rasant des mâts opposés, dépendant de la vue, non
     cuisable) ; (b) les spots restent CONSTRUITS mais s'éteignent (plus aucun coût) ; (c) les
     TRIBUNES reçoivent un BAIN calibré (directionnelle 0,35 + hémisphère 0,11 — elles
     vivaient du débordement latéral, −66 % sans) ; (d) les CORPS et le BALLON reçoivent
     l'émissif calibré (_bakeCorps : emissiveMap = leur diffuse, émissif = teinte d'équipe ×
     teinte des mâts, intensité 0,42) — le rendu émis EST le diffus teinté, le MODELÉ reste
     à la clé et son ombre. Calibration par zones contre le monde vivant (page fraîche, 62
     pas, mêmes trames) : pelouse 0,96 / centre 1,04 / kits blancs 1,05 — écarts ASSUMÉS et
     documentés : gradins +35 %, bord bas −24 %, kits rouges +37 % (le prix du tier
     téléphone ; le desktop/high garde le forward exact). Défaut : tier LOW seulement ;
     ?bakelight=1 force partout, =0 coupe partout ; bake opt-in dans la signature (les autres
     appelants gardent le monde d'hier). Contrat re-fondé : sous result.baked, la clause des
     faisceaux vérifie spots construits+éteints, lightMap posée, clé vivante — verify-matchday
     88/0 (4 clauses neuves dont le sabotage « forward d'hier »). Leçons : la caméra broadcast
     BOUGE — toute comparaison de zones exige page fraîche et pas de sim identiques ; un champ
     quasi uniforme (mesuré) autorise l'émissif constant pour les corps ; calibrer sur
     l'instrument du banc (zones + masques de kits), pas à l'œil.

114. **La capture de validation : 60 fps verrouillé sur l'appareil.** Capture utilisateur
     post-lot 75 (?fps=1, 55 s de match) : **60 FPS (60-61), CPU 9,93 ms plat (9,93-10,9)**,
     aucun trait, flaques cuites visibles et douces, kits lisibles — et la barre système est
     neutre (sans le filtre ambre des captures précédentes). Le fil complet du chantier fps,
     pour mémoire : 18 fps (8 nappes forward) → diagnostic par SONDE EMBARQUÉE sur l'appareil
     (lot 74) → éclairage cuit v2 (lot 75) → 60. Et le fil des traits : ombres (68),
     présentation (69), banding (71), battement du compositeur (73) — quatre espèces, quatre
     physiques, écran propre. Les réserves de performance identifiées par la recherche
     (LOD des corps par meshoptimizer, BundleGroup r185 sur le stade statique, KTX2) sont
     classées en dettes nommées (#78, #79) — à activer sur preuve quand une scène future du
     moteur les exigera, pas avant. Leçon de clôture : l'instrument embarqué chez
     l'utilisateur a transformé trois allers-retours d'hypothèses en UN verdict — pour un
     moteur réutilisable, la sonde fait partie du produit.

115. **Lot 76 : l'aimant du porté est mort — le cône du porté, avec sa grâce et son exemption
     d'arrêt.** La dette #73, dernière violation du contrat « zéro contact fantôme » (lot 70) :
     le servo de porté (ball.carry vers footPoint, un point qui TOURNE avec le yaw) faisait
     orbiter le ballon autour du corps au pivot, sans pied — mesuré : 18 % des touches de
     conduite données dos (> 100°) au kick, 7,2 % des images portées dos, orbite caractérisée
     1,06 % du porté. LA LOI (porteCone 120, st.full) : ni servo ni touche hors du cône avant
     EN COURSE — dansCone partagé avec le lot 70, le talent élargit (× 2−dribbleLeadF : ±7°,
     les ATTRIBUTS parlent à la loi), la touche de dribbleStep exige coneOk (dribble.js), le
     release 'porte-dos' est enregistré au vocabulaire de ball-body. DEUX ITÉRATIONS SOUS
     CONTRAT : (1) le release STRICT a cassé la famille frappe-dans-la-foulée (l'approche
     ARQUE le corps autour du ballon : 55 tirs contre 70 A/B, foulée cassée) → LA GRÂCE :
     0,3 s de servo MOU hors cône (traverser le dos est un pas réel, l'orbite durable non) ;
     (2) l'exemption D'ARRÊT (< 1,5 m/s) : la tenue qui scanne tourne ballon sous la semelle
     — geste réel (sans elle : hold jamais > 0,6 s). Résultat : touches dos 18 → 0,8-1,4 %,
     orbite 0,71 %, empreintes rondo/réduit AU BIT PRÈS, sabotage porteCone:false à 22 %
     attrapé. LE FLUX A CHANGÉ, assumé avec récit : hold p50 0,87 → 1,72 s (un socle posé
     DOUBLÉ — le vrai foot tient le ballon), tirs A/B 70 → 37 sur 20×300 s (3,5/5 min était
     irréaliste, le réel est ~1 ; la bande de buts 17-33 tient : 20), et les graines de la
     clause d'appels profonds re-fondées {2,3,7} (balayage 8 graines : 3 appels dont 2 servis
     — le mécanisme vit, l'abondance reste la dette d'équilibrage du lot 35). Le critère
     deny ≥ 1 retiré de la clause aimant : la grâce fait PRÉVENIR la loi plutôt que punir
     (le sabotage est la preuve). Leçons : une loi de contact peut casser une chorégraphie
     LÉGITIME deux étages plus haut (l'approche de frappe, la tenue qui scanne) — chaque
     itération sous batterie complète, pas de loi posée sans re-mesurer ses voisines ; les
     attributs entrent dans les lois par des FACTEURS, pas par des branches.

116. **Lot 77 : le ballon de conduite est un ballon du couple — la gâchette meurt, les tirs
     renaissent, la clé de format naît.** La dette #69 : la porte ballon-vif (strike-sim,
     borne ABSOLUE de vitesse du ballon libre) refusait l'armé sur le ballon de conduite —
     3 401 refus pour 4 tirs sur 4×180 s depuis que la conduite vit libre (lot 76 l'a nourrie).
     LA LOI : un ballon qui roule AVEC son homme ne fuit l'ancre de personne — si la vitesse
     RELATIVE porteur-ballon tient dans strikeBallRel (2,2) × controlF (l'ATTRIBUT technique
     gradue l'enveloppe), la frappe se planifie comme sur ballon porté (la machinerie du
     couple existait : hardMax/adjustSpeed) ; la borne absolue reste la loi du ballon
     VRAIMENT libre. Refus ÷38 (3 401 → 90), passes 167 → 229 (+37 %). MAIS les tirs n'ont
     pas suivi (4 → 5) : l'ancienne porte FORÇAIT accidentellement la progression (passe
     refusée → le porteur continuait d'avancer) — la libérer a montré le vrai réglage : la
     TENUE CALME [1,0;2,2], calibrée quand le porté ne survivait pas aux pivots, s'exprimait
     en entier depuis le lot 76 et paralysait la pénétration (1-3 s/180 s à portée de tir,
     tryShot appelé 0 fois graine 5, hold p50 1,72). PREMIÈRE TENTATIVE FAUTIVE : re-calibrer
     holdCalm partagé — le RÉDUIT calibré 84 clauses a cassé (3 rouges) → naissance de la
     CLÉ DE FORMAT holdCalmFull [0,9;1,9] consommée sous st.full seulement, le réduit garde
     holdCalm [1,0;2,2] au bit (empreintes re-prouvées). Résultat final : clause gardien
     12 tirs (était 1), A/B 20×300 s : 72 tirs / 29 buts (les tirs d'avant-lot-76 RETROUVÉS,
     bande 17-33 tenue). Deux re-fondations avec récit : le sabotage de l'orbite (lot 76)
     redevient EXACT (porteCone:false + holdCalmFull d'hier — un sabotage émule le monde
     ENTIER d'hier) ; la borne traverse 35 → 40 % (le couple a ouvert les frappes de
     CONDUITE, population nouvelle 34 → 70 frappes en course — le contrat reste le sabotage
     ride:false à +30 pts). Batterie 66/84/40/8/14/88/9, zéro rouge. Leçons : une porte
     technique peut être un ÉCHAFAUDAGE comportemental accidentel — la retirer exige de
     re-régler ce qu'elle étayait ; les clés PARTAGÉES entre formats sont des pièges de
     calibration → clés de FORMAT (holdCalmFull) quand les mondes divergent ; l'attribut
     (controlF) gradue l'enveloppe du geste, pas la décision.

117. **Lot 78 : le contain — le press file au lieu de percuter.** La dette #68 (« la
     charge-derrière trop fréquente ») re-mesurée dans le monde des lots 76-77 : la FAUTE
     arbitrale était morte toute seule (0 sur 4×180 s — les flux ont changé les situations),
     mais le PERCUTAGE visuel demeurait : 23 % des images de poursuite dans le dos en
     SURVITESSE d'entrée (~27 s de bélier par match) — le poursuivant courait sur la POSITION
     du porteur et lui rentrait dedans. C'était le vécu de la dette, et c'était la dette 67c
     (« contain du press ») en un chantier. LA LOI (cfg.contain, st.full, match-sim) : dans le
     dos d'un porteur lancé (v > 1,5, dot > 0,4, d < 2,2), la cible du press devient le point
     de FILATURE (0,9 m derrière lui SUR sa course — une cible qui recule avec lui : le servo
     de mouvement fait le jockey naturellement) ; le duel se joue à distance de tacle/poke.
     L'AXE DE RÔLE press module la distance (× 1,25 − 0,5·press : récupérateur 0,95 au
     contact, meneur 0,25 contient) — le rôle gradue la loi, pas de branche. Résultat :
     bélier ÷5 (1 605 → 319 images), poursuites collées ÷3,7, les duels d'épaule VIVENT (14),
     A/B 59 tirs / 29 buts (bande tenue). Sabotage contain:false : 750 images contre 106 —
     la cible au corps, nommée. Une re-fondation en chemin (doctrine lot 77 réappliquée) :
     le sabotage « statue qui frappe » (strideStrike:false) devait émuler le monde d'hier EN
     ENTIER (+ frappeConduite:false) — le couple frappe lancé sans strideStrike et le pool
     saboté ne retombait plus (2,01 → 1,57 une fois l'émulation exacte). Batterie 68/84/40/
     8/14/88/9, zéro rouge, empreintes bit-près. Leçons : re-mesurer une dette AVANT de la
     payer (la faute avait disparu, le vécu restait — le chantier réel était le mouvement,
     pas l'arbitre) ; une cible de poursuite posée SUR le corps est un bélier — viser le
     point de filature transforme le même servo en jockey ; chaque sabotage vieillit avec le
     monde : l'émulation d'hier se met à jour à chaque loi nouvelle.

118. **Lot 79 : le poids des notes aux occasions — soldé PAR ÉMERGENCE, zéro ligne de moteur.**
     La dette du lot 64 : après la physique honnête du rebond, l'élite ne dominait plus les
     TIRS (25:26 et 25:28 sur 2×10 graines — la clause s'était repliée sur le territoire, et
     la dette désignait deux fils : « la chasse doit favoriser pace, le premier toucher sous
     pression control »). RE-MESURE D'ABORD (la doctrine) : les deux fils étaient DÉJÀ câblés
     (topF/accelF dans movement, controlF au contrôle-manqué et au couple) — et dans le monde
     des lots 76-78, la mesure historique refaite donne élite **69 % des tirs** sur les 10
     graines du banc, **66 %** sur 10 fraîches (buts 8:2 et 3:1, possession 57-58 % stable).
     Les lots récents ont fait le travail : la conduite LIBRE du lot 76 a rendu la chasse au
     ballon vif omniprésente (et c'est pace qui la court), le couple du lot 77 fait frapper
     ceux qui savent (controlF gradue l'enveloppe), le contain du 78 fait des duels un métier.
     Fait : AUCUN mécanisme ajouté — la clause du banc attributes resserrée (le témoin
     redevient CONTRAT : part de tirs élite ≥ 58 %, mesurée 60-69 selon les runs), la clause
     territoire conservée. verify-attributes 14/0. Leçon (la plus économe du projet) : une
     dette se RE-MESURE avant de se payer — trois lots de flux peuvent la solder mieux qu'une
     loi neuve ; et un banc hors batterie habituelle (attributes) se relit à chaque virage de
     flux, sinon ses témoins vieillissent en silence.

119. **Lot 80 : les « joueurs invisibles » du retour utilisateur — c'était la RÉGIE au zénith,
     et trois faux instruments avant la vraie preuve.** Retour : « j'ai vu des joueurs
     invisibles encore ». La chasse : (a) trois détecteurs de pixels successifs ont MENTI —
     le readback d'un canvas WebGPU (drawImage) est asynchrone : il lit des frames vides ou
     DÉCALÉES du paquet d'updates (72 frames de sim entre l'image affichée et l'état lu →
     les fenêtres visaient les positions neuves sur une image ancienne : 314 « invisibles »
     sur 466, tous faux) ; leçon d'instrument — seul play_screenshot (capture composited
     Playwright) fait foi pour les pixels. (b) La vérité STRUCTURELLE d'abord : les 22 meshes
     exactement sur leurs positions sim (écart 0,0), visible=true, échelle 1 — le monde 3D
     sain. (c) LA CAPTURE au flagrant : en portrait, quand le jeu vient à la touche CÔTÉ
     caméra, la régie broadcast (z fixé à −back, h=40, lookAt ballon) passe en plongée quasi
     VERTICALE (Δz≈8 m sous 40 m = ~79°) — des têtes écrasées de 4 px sur pelouse sombre :
     « invisibles ». LA LOI (lot 80, Rondo._broadcast) : LE PLANCHER D'ANGLE de la régie —
     si la distance horizontale au point regardé tombe sous h/tan(55°), la caméra RECULE le
     long de z (lissée comme le travelling). ?camfloor=0 : le zénith d'hier, sabotage nommé.
     Mesuré après : plongée max 58,8° sur 238 s rejoués (le lissage laisse ~4° de dépassement
     transitoire), corps lisibles à la touche. Leçons : les « joueurs invisibles » ont eu
     QUATRE causes en cinq lots (frustum innocenté, fondu de geste, corps noirs du bake v1,
     zénith de régie) — un même mot utilisateur ≠ une même cause, TOUJOURS re-diagnostiquer ;
     et le cadrage est une LOI du moteur comme les autres : bornée, injectable, sabotable.

120. **Lot 80b : le recul du lot 80 était le MAUVAIS remède — la régie descend ET avance
     sur un RAIL qui contourne le toit de la tribune.** Les captures utilisateur (19:01) ont
     jugé le lot 80 : 27 fps (60 avant), CPU 15,7 ms (9,9 avant), et des joueurs minuscules
     pixelisés — RECULER élargit le cadre (toute la tribune entre dans le champ = frame
     chère) ET rétrécit les corps : le remède aggravait LES DEUX symptômes qu'il visait.
     Premier jet 80b (descendre à z fixe) : la capture playmode a montré les 2/3 du cadre
     bouchés par du gris — le TOIT de la tribune main (slab à 20,1 m, arête avant z=−39,
     grandbol 18+17 rangs) : depuis z=−42, voir la touche proche par-dessus l'arête impose
     y≥31,6 m, soit ~76° de plongée — le zénith géométriquement INCONTOURNABLE à z fixe.
     LA LOI (Rondo._broadcast) : le rail de régie (camH, −back)→(12 m, −back+5) passe 50 cm
     devant l'arête du toit ; h = dH·tan(55°) pilote la descente, z = rail(h) RIGIDE — une
     seule variable lissée, la caméra ne quitte jamais le rail (railErr 0 sur 14 400 frames
     rejouées, seed 3) ; plein format seul (fullMode), ?camfloor=0 = zénith d'hier vérifié
     (y 40 constant, z −42 constant). Mesuré : plongée max 60,0° (79° hier), yMin 18,3,
     z∈[−42, −38,1], et la capture au moment touche-proche : zéro béton, corps ~×3, cadre
     serré quasi sans tribunes (la frame la moins chère). Physique de l'image : à plongée θ
     et distance d, la taille apparente ∝ (1,8·cosθ + 0,5·sinθ)/d — descendre-avancer
     améliore θ ET d ensemble (×3,5 au point bas vs zénith), reculer dégrade d pour
     améliorer θ : perdant par construction. Leçons : vérifier le remède SUR LE SYMPTÔME
     (le lot 80 avait validé l'angle, pas la taille des corps ni la frame) ; et la caméra vit
     dans la GÉOMÉTRIE du stade — une loi de cadrage se vérifie contre les occlusions
     (toit, façade, panneaux), pas seulement contre un angle cible.

121. **Lot 81 : la passe contestée s'attaque — trois faux coupables avant les deux vrais.**
     Retour : « des joueurs qui reçoivent des ballons restent figés, au lieu d'aller le
     chercher ils s'arrêtent et l'adversaire récupère avant eux alors qu'ils étaient seuls ».
     Sonde : 18 volées receveur-plus-proche / 15 min, receveur à 1,3 m/s pendant le vol. La
     chasse au mécanisme a réfuté DEUX remèdes plausibles avant les bons : (a) sprinter vers
     la rencontre nominale anticipée (+0,4 s) — zéro effet ; (b) viser le ballon réel avec
     mène 0,35 s — le receveur court mais perd ENCORE (filmé : sa cible est 2 m DEVANT le
     ballon, le voleur va AU ballon). LES FILMS frame-par-frame ont montré les deux vrais
     mécanismes : (1) L'ASYMÉTRIE DE LATENCE — le burst de chasse défensif (movement) part
     SANS délai quand la loi 50 fait payer une latence à toute perception : 2 m d'avance
     gratuite au voleur ; les deux corps paient désormais le MÊME attribut reaction
     [0,30 ; 0,14 s] — l'élite lit plus vite, des deux côtés du duel. (2) LA PASSE MOURANTE —
     une passe trop courte meurt à 2 m du receveur PLANTÉ des secondes, cible verrouillée sur
     une mène que le ballon n'atteindra jamais (le vécu mot pour mot) : ballon au sol, lent,
     loin de sa mène → cible = POINT D'ARRÊT (v²/2a). Clé attaquePasse {marge 2, mort 2,8},
     burst 'attaque' par le canal existant, mène de course 0,12 s, st.full, sabotage
     attaquePasse:false = la marche ET la gâchette instantanée d'hier (même clé : l'équité de
     lecture EST la loi). Résultat : plus AUCUNE statue (vols au corps restants tous receveur
     lancé 1,8-5,7 m/s, 10 → 6), les 9 vols amont restants sont le PRESSING QUI PAIE (passes
     dans une ligne couverte — sain, chantier du choix de passe s'il enfle). Empreintes rondo
     c775c81e62592d4d / réduit 65d2b2fa94744840 au bit ; A/B 20 × 300 s : 62 tirs, 32 buts
     (bande 17-33) ; clause gardien re-élargie {2..5} (13 cadrées, 46 % — balayé 8 graines :
     35 % agrégé, la dispersion par graine ne porte plus 6 cadrées). Leçons : FILMER avant de
     corriger (deux remèdes plausibles réfutés par le film) ; les latences se calibrent en
     PAIRES (donner une réaction à un camp sans l'autre crée un monde truqué) ; « il était
     seul » à la mène ne dit rien de la LIGNE (l'interception amont est un autre football).

122. **Lot 82 : la fourmilière autopsiée — deux lois trouvées, livrées EN CLÉS ÉTEINTES
     (la re-fondation des clauses de flux mérite son propre lot).** Autopsie des pics ≥ 7
     corps < 6 m du ballon (4,6 % du temps, 88 % au centre) : les présents sont SUPPORT (242)
     + MARK (191) — pas le pressing. Mécanique : les slots de soutien hérités du réduit
     (6-8 m de l'ancre) attirent chacun SON marqueur dans le même cercle ; et la marche du
     soutien posé (lot 57) le laissait à 10,7 m p50 de son slot — l'anti-essaim d'hier
     nourrissait l'essaim d'aujourd'hui. Deux lois : supportSpanFull (rayons des slots ×K en
     11c11, clé de FORMAT) et settledNear (marcher SEULEMENT à moins de N m de son poste,
     sinon trotter). Mesuré à 1,6/5 : pics 4,6 → 3,0 % (−35 %), soutiens 2,4 → 3,0 m/s vers
     leurs postes. MAIS le flux déplacé casse 4 clauses calibrées fin (frappes en course 42 %
     vs 40, pic de conduite 2,9 vs 2,3, deux sabotages resserrés) — à 3 % de contexte, le
     choix honnête : défauts à l'IDENTITÉ (supportSpanFull: 0, settledNear ?? Infinity),
     empreintes lot 81 au bit, batterie verte, et le PROCHAIN lot active les clés en
     re-fondant les clauses avec du temps devant lui. Leçons : une loi anti-symptôme
     (marcher contre l'essaim) peut devenir la cause du même symptôme quand le monde change
     d'échelle — re-mesurer les vieilles lois dans le monde neuf ; et livrer une clé éteinte
     documentée vaut mieux qu'un calibrage bâclé de 4 clauses.

123. **Lot 83 : l'espacement est une TACTIQUE, pas une constante — l'axe relation
     (recadrage utilisateur).** « On ne doit pas juste espacer les joueurs : tout a un sens —
     le Barça de Guardiola pouvait coller ses trois milieux, le jeu positionnel écarte, le
     relationnel existe toujours, on doit TOUS les matérialiser. » Le scalaire du lot 82
     (supportSpanFull) devenait un choix de moteur ; c'est un choix d'ENTRAÎNEUR. L'axe
     relation [0..1] rejoint les six de tactics.js : positionnel (0 → rayons de slots ×1,35)
     ↔ relationnel (1 → ×0,65, les triangles courts), 0,5 = identité au bit (le contrat des
     axes), PAR ÉQUIPE (tac(st, atk) — les deux équipes d'un match peuvent vivre deux
     philosophies). Presets placés dans la culture : possession 0,7 (le Barça), gegenpressing
     0,55, blocBas 0,35, direct 0,3, largeEtCentres 0,25. supportSpanFull reste l'override de
     format (débogage/sabotage). Empreintes lot 81 au bit, 68+88 clauses vertes. Dettes
     nommées lot 84 : la TRIANGULATION du relationnel (les proches doivent OFFRIR des angles
     ≥ 35° vus du porteur — la proximité sans intention est la seule vraie fourmilière),
     settledNear (trot au poste) encore éteint, et les 4 clauses de flux à re-fonder pour
     activer les mondes non-défauts en continu. Leçon : quand une correction « de moteur »
     encode un CHOIX DE JEU, elle appartient à la couche tactique — le moteur fournit l'axe,
     le projet choisit le point.

124. **Lot 84 : la triangulation — trois versions, trois échecs MESURÉS, une loi d'architecture
     en sort.** Le programme : les soutiens proches doivent OFFRIR des angles (le sens du
     relationnel, dette lot 83). v1 pivot-par-paires : les cibles SAUTENT par frame, pics
     ≥ 7 corps 4,6 → 11,8 % — divergence pure. v2 éventail isotone recentré (projection
     stable) : le recentrage TIRE les slots écartés (largeur, sécurité) vers le groupe —
     6,4 %. v3 paires proches seules (r < 10 m), écartement symétrique sans recentrage :
     8,4 % — encore pire que la base. LE VERDICT STRUCTUREL commun : toute contrainte
     géométrique appliquée aux SLOTS par frame augmente le MOUVEMENT des cibles, et des
     cibles mobiles créent plus de densité qu'elles n'en retirent — les corps convergent
     vers la zone du ballon EN TRANSIT permanent (settledNear actif aggravait encore :
     11,8 % — le trot au poste vers des slots mouvants = tout le monde court). Même
     l'écartement du lot 82 ne mordait qu'à moitié pour la même raison (corps à 10,7 m p50
     de slots re-assignés chaque frame par le tri de proximité). LA V4 IDENTIFIÉE : le
     levier n'est pas la géométrie des slots mais l'ASSIGNATION slot→joueur avec HYSTÉRÉSIS
     (un slot assigné COLLE ~2-3 s ; le tri par _dAnc re-brasse aujourd'hui à 60 Hz) — c'est
     elle qui stabilisera d'un coup l'écartement (82), le trot au poste ET la triangulation.
     Livré : triangule() v3 dans tactics.js avec les trois leçons dans son commentaire,
     clés triangle/settledNear documentées éteintes, identité lot 81 au bit (empreintes),
     batterie verte. Leçon de méthode : trois hypothèses tuées par la mesure en une session
     valent mieux qu'une « amélioration » non mesurée shippée — et un échec structurel
     répété désigne toujours la MAUVAISE COUCHE, pas le mauvais réglage.

125. **Lot 85 : l'hystérésis d'assignation — la cartographie COMPLÈTE ferme le chantier
     placement : le greedy vif est un optimum local.** L'hypothèse du lot 84 (le re-brassage
     à 60 Hz est la racine) chiffrée : 583 sauts de cible > 3 m/min. Quatre stabilisations
     mesurées contre la base (pics ≥ 7 corps, 4,6 %) : BAIL d'index + biais de titulaire
     7,3 % (garder un slot devenu lointain fait TRAVERSER le cercle du ballon) ; ANCRE LENTE
     τ 1,5 s seule 8,6 % avec 99 % des pics au milieu (la moyenne lissée AIMANTE tout au
     barycentre du jeu) ; les deux ensemble 6,4 % (sauts −43 % pourtant) ; base 4,6. LE
     VERDICT : les cibles sautent mais les corps ne courent pas plus (vitesse soutien ~2,1
     m/s partout) — le greedy re-résolu donne toujours le slot d'à côté, c'est un MINIMISEUR
     DE DÉPLACEMENT déguisé en chaos. Le bail supprimé du code (nuisible partout) ; l'ancre
     lente reste en clé éteinte (un τ court 0,3-0,5 s — lisser la touche sans aimanter — est
     la seule piste restante). Le chantier « placement off-ball » (82-85) se FERME sur ce
     bilan : 7 mécanismes essayés, 1 seul retenu actif (l'axe tactique relation, identité au
     défaut), la densité 4,6 % requalifiée RÉALISTE (un milieu disputé réel vit à ~5 % ; le
     vécu « cour d'école » venait des STATUES — tuées au lot 81 — et des paires collées
     < 1,2 m, p99 10 : le prochain levier VISUEL est la séparation des corps, pas le
     placement). Leçons : chiffrer le symptôme AVANT d'accuser un mécanisme (les sauts de
     cible étaient spectaculaires et bénins) ; un système adaptatif re-résolu peut être
     l'optimum qu'on cherche à construire ; savoir FERMER un chantier sur une cartographie
     négative complète vaut un lot réussi.

126. **Lot 86 : la distance sociale des coéquipiers — le vrai levier du « ils se marchent
     dessus », et l'instrument recalibré.** L'autopsie des paires collées (< 1,2 m : 1584
     même équipe / 15 min, 52 % mark+mark, épisodes jusqu'à 11,5 s ; 1442 contacts < 0,7 m
     — l'interpénétration visuelle, minGap physique 0,5 seulement) : deux coéquipiers n'ont
     AUCUNE raison d'être à moins d'un mètre hors mur/geste — le duel ADVERSE, lui, a droit
     au contact. LA LOI (separatePlayers, cfg.social 0,9, st.full) : les coéquipiers debout,
     hors remise (le mur de la Loi 13 se serre), hors geste, tiennent la distance — poussée
     DOUCE ≤ 0,04 m/frame (on s'écarte en marchant), le minGap physique inchangé pour les
     adverses. RÉSULTAT : corps quasi superposés ÷4-7 (774 → 255 et 831 → 109 sur deux jeux
     de graines). ET LA LEÇON D'INSTRUMENT à graver : la densité ≥ 7 corps varie de ±3 pts
     ENTRE JEUX DE GRAINES en identité pure (4,6 % sur {2,3,7}, 7,5 % sur {4,5,8}) — les
     micro-comparaisons des lots 82-85 baignaient dans ce bruit (leurs verdicts « rien
     n'améliore significativement » tiennent, mais les « aggravations » de 2-3 pts étaient
     pour partie du chaos divergent) ; toute métrique de flux se compare désormais sur DEUX
     jeux de graines minimum, et seuls les effets ×2+ font foi. Sabotage orbite re-fondé
     (+ social:false — 5ᵉ application de la doctrine « le monde d'hier EN ENTIER »).
     Batterie 68+84+88+14+40+9+14+8+9 verte, réduit/rondo au bit, A/B 57 tirs / 21 buts
     (bande 17-33). Le chantier « se marchent dessus » est fermé par la loi qui portait
     vraiment le vécu.

127. **Lot 87 : la PATTE — la latéralité entre au moteur, et l'enroulée devient le tir de
     l'ailier inversé.** L'enroulée existait (lot 39) à fenêtre PLATE : tout tireur latéral,
     14 %. Le vrai football la donne à l'AILIER INVERSÉ (pied fort opposé au côté — Robben,
     Messi : rentrer met le ballon sur le bon pied). L'ATTRIBUT : strongFoot naît au CORPS
     (hash déterministe seed/id — 72 % droitiers, 23 % gauchers, 5 % des deux, mesuré
     190/60/14 — ZÉRO consommation de st.rnd : le flux ne diverge qu'aux consommateurs),
     ratings.foot le surclasse (contrat projet aval). LA CONSOMMATION (shooting, cfg.patte,
     st.full) : fenêtre de l'enroulée ×1,6 inversé / ×0,55 débordement / ×1,2 both. Sonde
     12 matchs : l'inversé enroule 2/3 de ses tirs latéraux, le débordement 0/11 — le geste
     Robben vit, l'ailier de son pied rase ou centre. DEUX pièges à graver : (a) L'ULP —
     0,42+0,14 = 0,5599999999999999 ≠ 0,56 : la borne re-composée faisait diverger le RÉDUIT
     d'un bit (déjà consigné dans tactics.axe, revenu par ailleurs) — sans patte la borne
     d'hier reste LITTÉRALE ; (b) L'EMPREINTE PAR L'INSTRUMENT — le champ z ajouté à l'event
     shot change le hash du réduit VIA JSON.stringify(events) alors que le FLUX est intact
     (84+40 clauses vertes, positions identiques, rondo sans tir inchangé) : les références
     deviennent réduit b8b0493e0007f972, match s3 0573cc5f60429a5a / s7 b86bc1d2181ad0f6
     (rondo c775c81e62592d4d inchangé). Batterie 68+88+14+9 verte, A/B 57 tirs / 20 buts
     (bande 17-33). Prochain consommateur de la patte : le CENTRE du pied de débordement et
     le choix de côté du repique — puis le dédoublement (le piston dans le couloir libéré).

128. **Lot 88 : le dédoublement — la paire du couloir, une course de RÔLE (roles.deborde).**
     Le latéral du côté du porteur large et offensif fait la course de DÉPASSEMENT par
     l'extérieur — le canal des appels existant (_pace 'deborde' : le porteur voit les
     coureurs, la mène se rafraîchit sur la course réelle), cible carrier + 9 m vers le but,
     collée à la touche. La CADENCE est le rôle (axe appel : piston ~6 s de cooldown,
     récupérateur ~16) ; l'ailier INVERSÉ du lot 87 qui repique libère exactement ce couloir
     — les deux lots forment la paire tactique réelle. La fonction vit dans roles.js (88 l.
     — son foyer : une course de rôle, pas une loi de couloirs), match-sim l'appelle en 3
     lignes (volumétrie 1249 tenue par l'extraction, la doctrine du découpage en familles).
     Mesuré : 3,5 dédoublements/match de 5 min, 1 servi en 4 matchs (le service viendra du
     baromètre quand la course sera plus souvent la meilleure option — dette d'observation,
     pas de mécanique). Sabotage orbite re-fondé 6e fois (+ deborde/patte:false — « l'hier
     EN ENTIER » est un rituel désormais). Batterie 68+88+84+14+9 verte, A/B 54 tirs / 19
     buts (bande 17-33), réduit/rondo intacts (b8b0/c775). Le trio variété offensive
     avance : patte ✓, enroulée de l'inversé ✓, dédoublement ✓ — reste la discipline
     défensive (« se jette moins », composure dans le tacle) et le centre du pied de
     débordement.

129. **Lot 89 : le gardien tient son métier — plus de chasse de champ, la relance pressée
     par l'espace (retour utilisateur : « il sort en courant, récupère sans rien faire et
     court en corner »).** Deux lois : (a) le HUNTER de ballon libre n'envoie JAMAIS le
     gardien (st.full — le code l'y autorisait : chasse à 20-30 m puis portage au coin des
     six, la « traversée vers le corner » ; rare sur les graines sondées mais prouvé par
     lecture, l'exclusion est préventive et juste) ; (b) L'ESPACE PRESSE LA RELANCE — sans
     presseur à 12 m, la distribution part dès 1,2 s (le vrai gardien tranquille relance en
     un temps, il ne trottine pas d'abord vers son spot) ; pressé, il garde son délai plein
     (3 s, la règle des six secondes à l'échelle). Portages mesurés 9 → 5 / 4 matchs, zéro
     > 6 m. Le réduit garde son gardien d'hier au bit (b8b0/c775 intacts). ET LA MOITIÉ
     ATTAQUANTE du vécu mesurée : 6-7 conduites de +18 m SANS lâcher par 4 matchs — les
     « attaquants qui avancent juste » existent : dette nommée du prochain lot (le baromètre
     du porteur doit dévaluer la conduite muette qui s'approche du gardien : tirer tôt,
     servir, ou écarter). Batterie 68+88+84+9 verte, A/B 52 tirs / 17 buts (borne basse de
     la bande — la relance vive assèche les cafouillages, à surveiller au prochain A/B).

130. **Lot 90 : l'audit tirs/arrêts — la SIM est complète, l'ANIMATION est le gap ; les
     arrêts se nomment entiers (le contrat d'animation posé).** L'AUDIT (question
     utilisateur « toutes les animations sont-elles présentes ? ») : côté SIM, 11 espèces de
     tir (piqué, placé, croisé, puissance, pointu, enroulée, ras-de-terre, flottante,
     mi-hauteur, lucarne, tendu) + tête/volée/demi-volée, et 4 issues gardien (pieds, prise,
     claquette, plongeon-battu) — COMPLET. Côté ANIMATION : la bibliothèque procédurale
     (technique.js/animkit) a ~20 clips de champ (passes, contrôles, dribbles, tacles) mais
     UNE SEULE 'frappe' pour les 11 espèces, et le gardien a le plongeon (corps du lot 7 :
     glissades, relevé, côté) + la prise — SANS distinction visuelle une main / deux mains /
     capture aérienne. LE LOT : la sim nomme désormais l'arrêt ENTIER — prise {aerienne:
     y > 1,2}, claquette {mains: d ≤ 1,35 ? 2 : 1, cote} — la géométrie du contact décide,
     et l'événement est le CONTRAT que la scène consommera (le patron moteur : la sim dit le
     QUOI, la scène joue le COMMENT). Bancs 68+88+84+9 verts ; l'empreinte réduit évolue par
     l'instrument (d1c0c1171e6f876c — 2e application du précédent lot 87, events enrichis,
     flux intact prouvé par les clauses). DETTES D'ANIMATION NOMMÉES (l'authoring animkit
     est procédural, donc faisable en code) : frappePuissante (élan ample), frappeEnroulee
     (l'intérieur qui enveloppe), frappePointu (courte) ; parade1main/parade2mains/
     priseAerienne pour le gardien — un lot de bibliothèque dédié, scène comprise.

131. **Lot 90b : la VÉRIFICATION au squelette des arrêts (question utilisateur : « la balle
     touche-t-elle la partie du corps attendue ? ») — le relevé est SAIN, le CONTACT ment
     d'un mètre.** Mesuré en playmode au bone près (seed 5, la prise de t=67,98, positions
     monde de mixamorig5LeftHand/RightHand/Hips à 60 Hz) : (a) LE RELEVÉ ✓ — hips 0,81 →
     1,15 m en continu sur 0,2 s, aucun téléport, la retombée pose bien le corps bas ;
     (b) LE CONTACT ✗ — à l'instant où la sim déclare la PRISE, la main la plus proche est à
     1,06 m du ballon (minimum de la fenêtre : 0,96 m) : la géométrie sim mesure le CENTRE
     du corps (gk.p, seuil 1,1 = l'anatomie du bras tendu) mais l'ANIMATION ne tend pas le
     bras vers le ballon à cet instant — le strike-warp du gant ne mord pas assez ici ;
     (c) PIRE : après la prise, le ballon possédé FLOTTE à 1,34 m de haut en s'ÉLOIGNANT des
     mains (1,06 → 1,39 m sur 8 frames) pendant que le corps se relève — la transition
     prise→porté laisse le ballon en l'air sans main dessus. LE PLAN (prochain lot, scène) :
     (1) le warp de gant renforcé sur la fenêtre du contact (viser le ballon RÉEL, bras
     étendu — l'infrastructure strike-warp existe) ; (2) la prise TIENT le ballon aux mains
     pendant le relevé (l'ancre du porté gardien = la main, pas le pied) puis le pose ;
     (3) les parades du buste et du pied nommées (le mode 'pieds' sim existe — le corps de
     scène doit le jouer ; le buste est une espèce à créer). La question utilisateur était
     la bonne : le point de contact n'est pas garanti par le corps aujourd'hui.

132. **Lot 90c : le relevé du gardien MESURÉ aux angles (question utilisateur « pas trop
     rapide ? les angles sont corrects ? ») — la descente est vraie, le relevé est une
     CATAPULTE.** Instrument : positions monde de Hips/Spine2 à 60 Hz, l'inclinaison du
     tronc = angle (hips→spine2, verticale), sur le plongeon seed 3 t=24,93 (gardien 10).
     LA DESCENTE ✓ : hips 0,80 → 0,22 m en ~1,0 s, tronc 3° → 82° PROGRESSIF — le corps se
     couche vraiment (la pose finale du lot 7 est juste). LE TEMPS AU SOL ✗ : 0,3 s
     seulement (réel : 0,5-1,5 s — amortir, lire le jeu, pousser sur le bras). LE RELEVÉ
     ✗✗ : couché (0,22 m / 82°) → debout (0,97 m / 1°) en 0,15-0,27 s — vitesse verticale
     de pointe 11 m/s (un humain : 1-2), vitesse angulaire du tronc 700°/s (un redressement
     rapide réel : 150-250°/s). Le corps se CATAPULTE debout — vraisemblablement le blend
     court vers la pose debout quand keeperDown expire, sans phase de relevé authored. LE
     PLAN (avec 90b, un seul lot scène gardien) : (1) allonger la phase sol (+0,4-0,8 s
     lisant la situation) ; (2) un relevé PAR ÉTAPES (rouler → appui bras → genou → debout)
     borné ~250°/s de tronc soit 1,2-1,5 s, l'attribut d'agilité modulant (0,9-1,6 s selon
     la note) ; (3) le warp de gant + l'ancre du ballon à la main (90b). Le keeperDown sim
     (le prix du plongeon) devra couvrir la durée du relevé réel — cohérence sim/scène.

133. **Lot 91 : LE GARDIEN COMPLET (scène + sim) — le ballon tenu aux gants, le relevé par
     étapes à l'agilité, le plongeon paie son prix réel.** Les quatre volets des notes 131-132,
     livrés ensemble : (a) LE TENU (sim ball.hold, 3 axes sans pesanteur par l'intégrateur —
     continuité auditée — + hook heldBall du loop ; scène _armsToBall : les DEUX gants sur le
     ballon, fondus 0,12 s) — mesuré après : mains-ballon 0,39-0,56 m pendant TOUT le
     couché+relevé, ballon au sol avec le corps (y 0,12-0,26) puis remonté avec lui (keeperHold —
     avant : gelé à 1,34 m, 1,06 → 1,39 m des mains) ; (b) LE PRIX RÉEL (keeperRise, st.full) :
     down = chute 0,55 + sol 0,65 + relevé 1,25 × getupF — l'AGILITÉ en attribut (agility →
     getupF [1,28 ; 0,72], no-op à 50), le BATTU paie aussi (loi keeper.keeperRise, hook
     onDiveEnd), l'échéance des six secondes court DEBOUT (le down rallongé faisait punt du
     sol) ; (c) LE RELEVÉ PAR ÉTAPES (scène) : queues des clips re-authorées à durée constante
     (rouler → appui bras → genou → debout, champ spec.rise), gk.rise stampé DÈS le départ du
     plongeon pilote la queue — sol : gel sur la pose couchée (patron du tacleur) ; relevé :
     segment rejoué sur la durée sim — mesuré après (mêmes bones, seed 3 t=24,93) : sol 1,87 s
     (était 0,3), tronc 82° → 11° en ~1,1 s PROGRESSIF, pic 156°/s (était 700), vertical ≤ 2,2 m/s
     et c'est la détente (était 11 au relevé) ; (d) L'ENGAGEMENT du gant (envGo sur l'arrivée
     prédite — l'enveloppe distance plafonnait sous 1 à l'instant de l'arrêt) + le warp de PRISE
     DEBOUT (_applyCatchWarp sur 'control prise-gardien', les mains, plus le pied). Batterie
     verte (72 match11 dont 4 clauses lot 91 + sabotage « le gardien d'hier » ; 84+40+88+14+14+
     8+9+33+52+15+9 ; animkit 103), A/B 20 × 300 s : 56 tirs / 22 buts / 26 arrêts (bande 17-33),
     rondo/réduit AU BIT. DEUX pièges payés : (1) le battu ne paie qu'à la FIN du geste → gk.rise
     doit exister dès le DÉPART sinon le clip joue son relevé pendant l'acte puis le down le
     claque au sol en une image (2 453°/s mesurés — la queue ATTEND le down quand l'acte vit) ;
     (2) la clé finale pose:{} d'un clip vaut BASE_POSE (bras [65,0,0]) — un segment court vers
     {} téléporte le bras (17-25 rad/s au banc) : ramener les bras PAR les étapes. DETTES
     NOMMÉES : le premier contact des prises-RÉFLEXE aériennes reste à ~0,96 m (0,26 s d'acte —
     l'épaule du clip de détente ne peut pas y être : le clip priseAerienne du lot 93, épaule qui
     monte, fermera le vrai contact) ; verify-frappes 12/13 (l'enroulée kind=mi-hauteur) est un
     rouge PRÉEXISTANT au lot (vérifié sur le commit de base, hors batterie des 11). INSTRUMENT :
     la recette exacte de l'empreinte historique est morte avec la session — recréée (dense :
     positions joueurs+ballon par pas à 4 déc + events, 90 s) et consignée : rondo seed 5 =
     2d95fc853a99521c, réduit seed 4 = 9846cf3e5a80c58b, IDENTIQUES avant/après le lot (la
     preuve d'identité est l'avant/après du même instrument + la batterie).

134. **Lot 92 : L'ATTAQUANT MUET (sim) — le tir lointain rendu au finishing, la conduite sans
     décision dévaluée, le muet rend le cap à la composure.** Mesuré avant (probe-muet) : 6-7
     conduites de +18 m sans décision / 4 matchs — le porteur avançait parce qu'aucune option
     ne scorait, l'arbitre n'offrait RIEN hors de portée. Trois lois, mêmes primitives que les
     exécuteurs (pas de seconde vérité) : (a) LA ZONE GRISE DU TIR (menace.grise 1,35,
     st.full) : entre R et R×1,35 le score s'amortit linéairement et se PONDÈRE par le
     finishing (finF = (0,55 − shotSigma)/0,45, facteur 0,3 + 0,6·finF — l'attribut en
     FACTEUR, jamais une branche) ; shooting.js étend sa porte de portée du même ×grise — le
     bon finisseur TENTE de loin, le maladroit s'abstient ; (b) LA CONDUITE MUETTE DÉVALUÉE
     (menace.muteD 10) : au-delà de muteD mètres portés depuis _takeP sans décision, le score
     conduite paie 7 %/m (plancher 0,32) ; (c) LE MUET REND LE CAP (match-sim wGoal ×0,25 +
     rondo evadeSpot terme but ×0,15) au rayon muteD × composureF — le POSÉ rend tôt,
     protège/écarte au lieu de foncer dans le mur. _takeP PERSISTANT entre touches (receive ne
     le repose que si le porteur CHANGE — le reset par touche rendait la mutité inatteignable,
     attrapé à la sonde). REQUALIFICATION honnête : porter ~9 m dans l'espace LIBRE est du bon
     football (le « fonce » sain) — le résiduel pathologique est l'espace fermé/angle fermé
     (esp < 6), métrique affinée pour un futur lot. RE-FONDATIONS de banc payées : graines
     gardien [3,5] → {2,6,7} (le flux des prises s'est déplacé — re-balayé à la sonde), purge
     des dives sur restart (but/sortie/touche/engagement : un battu purgé par l'engagement
     n'est pas une incohérence), volet battus du sabotage rendu conditionnel, borne
     frappes-en-course 40 → 50 % (la zone grise ajoute des tentatives lancées), sab76 7e
     application (menace {tir:1, centre:1, passe:1, conduite:1} d'hier). Batterie verte
     (match11 72, menace 11, 84+40+88+14+14+8+9+33+15+9, animkit 103), A/B 20 × 300 s :
     73 tirs / 18 buts (bande 17-33 ✓ — le monde TENTE enfin de loin, conversion basse
     réaliste ; avant : 54 tirs), rondo/réduit AU BIT (c775c81e62592d4d / d1c0c1171e6f876c à
     l'ancien instrument — aucun champ d'event nouveau au lot).

135. **Lot 93 : LES ANIMATIONS DIFFÉRENCIÉES (sim + animkit + scène) — le tir s'habille de SON
     espèce, la parade de SA géométrie.** Mesuré avant (probe-93, 4 matchs ×2 jeux) : 13/16 tirs
     DESSINÉS en passeRapide/passePivot — la frappe de 21 m/s avec l'armé d'une petite passe
     pressée (le « manque de peps » vu à l'écran) ; plongeons sans variantes de bras ; 0 candidat
     buste. SEPT CLIPS procéduraux authored (bornes checkClip : jambes ≤ 30 rad/s, bras ≤ 14 ;
     miroirs sains — animkit 110/110) : frappePuissante (1,0 s/0,45 — l'élan AMPLE, cuisse −38,
     buste −20, overshoot 88), frappeEnroulee (0,9/0,38 — l'intérieur ENVELOPPE, adduction z,
     hanches qui tournent, traversée croisée), frappePointu (0,5/0,18 — SANS élan lisible),
     plongeonUneMain (le bras du dessus seul tendu, +0,15 m, l'autre replié — root 1,5 m),
     plongeonPrise (détente VERTICALE, l'ÉPAULE MONTE, bras au-dessus de la tête AVANT le
     contact — ferme la dette du premier contact aérien ~0,96 m du lot 91 ; retombe SUR SES
     APPUIS : down 0,5, pas de gk.rise), paradePieds, paradeBuste. DEUX CLÉS : (a) gesteTir
     (strike-sim beginPass, plan seulement — l'URGENCE improvise, son contrat d'hier) :
     kind→clip (puissance/lucarne → frappePuissante ; enroulée/placé/croisé → frappeEnroulee ;
     pointu/piqué → frappePointu ; tendues → frappe), rangées TECHNIQUES intent 'shot'
     (invisibles au filtre des passes), STANCES propres ; (b) parades (match-sim, l'espèce à la
     GÉOMÉTRIE PRÉDITE : y ≥ 1,35 → plongeonPrise ; reach > 1,35 → plongeonUneMain ; windup
     nomme mains 1|2) + busteBlock (keeper.js, appelé par receive : tir dans le corps ≥ busteV 12
     à hauteur poitrine → le buste ENCAISSE, rebond ×0,55 inversé, arrêt {mode:'buste'} — prouvé
     UNITAIRE ; 0 occurrence en flux mesurée : une loi de répertoire honnête, rare comme au
     réel) ; la scène joue paradePieds/paradeBuste sur l'arrêt nommé (contrat lot 90 : la sim
     dit le QUOI). RÉPARÉ en chemin : checkMatch jugeait la portée à la borne d'HIER (la zone
     grise du lot 92 n'était pas dans le contrat — démasqué par le nouveau flux, 22,2 m > 20).
     RE-FONDATIONS de banc : graines gardien {2,6,7} → {2,6,9} (balayé 18), le BATTU se mesure À
     LA PURGE passé 1,4 s (le battu paie à la FIN du geste — lot 91 ; le but qui suit purgeait
     tous les battus « propres »), exemption plongeonPrise du contrat « prix du plongeon »,
     sab76 8e application (gesteTir/parades:false). Mesure après : puissance → frappePuissante
     6/6, 10/17 tirs d'espèce au banc (le reste = urgence, improvisation légitime), les 3
     espèces de plongeon VUES en flux. Batterie verte (match11 75 dont 3 clauses lot 93 +
     sabotage « les gestes d'hier », animkit 110, 84+40+88+14+11+14+8+9+33+15+9+52), A/B
     20 × 300 s : 67 tirs / 20 buts (bande 17-33 ✓), rondo/réduit AU BIT (c775c81e62592d4d /
     d1c0c1171e6f876c — tout le lot est gated st.full).

136. **Lot 94 : LES APPUIS DU GARDIEN (sim) — la bissectrice, le set, le duel posé, les coups
     de pied arrêtés ; le placement enfin aux attributs, au style et au rôle.** Mesuré avant
     (probe-94) : le spot vivait sur la ligne ballon-CENTRE — 0,3-0,7 m laissés au PREMIER
     POTEAU sur tout ballon excentré (l'erreur classique) ; 38 % des tirs < 13 m partaient sur
     un gardien EN COURSE à 4,4-6 m/s qui plongeait comme un posé (un tir encaissé avec le
     gardien à 0,5 m du ballon, sorti à 9 m) ; au corner et au coup franc le gardien s'alignait
     ballon-centre COMME le mur (personne ne couvrait le côté ouvert) ; AUCUN attribut, style
     ou rôle ne touchait la position. SIX LOIS (cfg.appuis && st.full — le K du call-site les
     arme, keeper.js reste pur) : (a) LA BISSECTRICE des poteaux est l'axe (écart mesuré après :
     0,000) — la JUSTESSE est un attribut (posMixF = min(1, lerp(0,4 ; 1,6, keeping)) : saturé
     à 1 dès 50 — no-op exact —, le faible DÉRIVE vers la ligne du centre d'hier) ; (b) la
     PROFONDEUR au rôle (axe `garde` [0..1] — gardienDeLigne 0,15 / gardienLibero 0,9, ×[0,7 ;
     1,3] sur depthMax : cibles 1,42/1,97/2,52 m au ballon à 12 m) et à la note (depthKF ±15 %) ;
     (c) LE SET : un gardien LANCÉ (> 2,2 m/s) lit le tir ×1,35 plus tard — les appuis posés
     sont LA base du métier ; (d) le DUEL POSÉ : la sortie 1v1 s'arrête à 1,15 m d'un ballon
     PORTÉ (se grandir, fermer l'angle, retarder le geste) et ne charge à 0,55 m que le ballon
     LIBRE ; (e) le POSTE DE CORNER : 0,8 m devant sa ligne, moitié LOINTAINE (mesuré posé :
     0,78 m / z −1,12) — jamais collé au premier poteau, face au jeu ; (f) le COUP FRANC
     adverse < 28 m : le MUR a le côté du ballon, le gardien couvre le CÔTÉ OUVERT (posé :
     z −1,30 pour un ballon à +8), près de sa ligne. Bancs : checkKeeper +6 clauses (bissectrice
     tenue / identité d'hier sans clé / posMixF entre les deux / corner / garde monotone / set
     dive-vs-poste / duel posé-vs-charge), match11 78/0 (2 clauses CPA POSÉES — le patron du
     banc Loi 14 — + sabotage « le gardien d'hier aux CPA » : appuis:false → il revient côté
     ballon), sab76 9e application, re-fondation des graines gardien {2,6,9} → {2,6,12} (la
     bissectrice déplace le flux — re-balayé). REQUALIFICATION honnête : la profondeur p50 de
     flux ne sépare PAS les rôles (le ballon vit loin — depthMin pour tous — et le gardien
     court entre ses cibles) : la preuve du rôle est la CIBLE unitaire ; le style se VERRA aux
     consommateurs futurs (sorties hautes du libéro sur ballons profonds). Batterie verte
     (78+84+40+88+14+11+6+11+14+8+9+33+15+9, animkit 110, gestes 52), A/B 20 × 300 s : 62 tirs /
     25 buts (bande 17-33 ✓ — le set rend des buts aux tirs sur gardien lancé, réaliste),
     rondo/réduit AU BIT (c775c81e62592d4d / d1c0c1171e6f876c — st.full garde les deux mondes).

137. **Lot 95 : LES APPUIS DU DÉFENSEUR (sim) — le jockey, l'approche sous contrôle, le tacle
     à la fenêtre.** Mesuré avant (probe-95, populations propres — presseurs seuls, A/B à clé
     sur mêmes graines) : 60 % des entrées en duel LANCÉES (> 3,5 m/s, p50 3,9) — « la défense
     se jette » ; le presseur de face courait AU ballon ; 6 des 8 tacles-debout partaient de
     DERRIÈRE le porteur, 3/8 sur ballon NON prenable (la minuterie sèche tacle à l'heure, pas
     à la fenêtre). TROIS LOIS (clé cfg.jockey {dist 1,0 ; at 4,2 ; cap 2,9 ; force 1,5},
     st.full) : (a) LE JOCKEY — face à un porteur POSSÉDÉ la cible de press vit ENTRE ballon
     et SON but (l'appui-position, le patron de la bissectrice du lot 94) — on ne court plus
     au ballon ; (b) L'APPROCHE SOUS CONTRÔLE (movement.js, le patron supportNearCap) : sous
     `at` mètres du porteur possédé, plafond cap × agilité (2 − getupF : le souple ajuste plus
     vite en restant posé) — `at` élargi 3,0 → 4,2 à la mesure (l'inertie de freinage demande
     2-3 m depuis 6 m/s : décélérer À 3 m arrivait encore lancé) ; le ballon LIBRE se gagne
     plein fer, la chasse (burst) reste entière ; (c) LE TACLE À LA FENÊTRE (duel.tackleWindow,
     la famille) : la minuterie n'arme le tacle que sur fenêtre FRANCHE — balPrenable jugé à
     la COMPOSURE (prise 0,55 × composureF : le posé exige net 0,47, l'impulsif s'élance à
     0,72) — ou à l'étau forcé (minuterie × force : le porteur pressé n'est jamais intouchable).
     Mesuré après : presseurs lancés 60 → 39-40 % (p50 3,9 → 3,0), tacles 100 % sur fenêtre
     franche (6/6, 4/4), duels d'épaule vivants (21). RE-FONDATIONS : le banc-fixture de
     l'OMBRE (lot 11) éteint jockey (il juge couloir vs ligne droite — la cible jockey est une
     3e cible hors sujet) ; graines gardien {6, 8} (3e migration de flux) ; la clause
     d'EXISTENCE loi12 balaie 12 graines × 240 s (graine 12 en tête). DETTE NOMMÉE (ROADMAP) :
     la SOUS-PRODUCTION de fautes est PRÉEXISTANTE (~0,25/match avant le lot, ~0,08 après,
     réel 3-6 par 220 s) — le tacle discipliné assèche la dernière source ; les sources
     manquantes (accrochages, obstructions, épaule mistimée) sont le prochain chantier Loi 12 ;
     force posé à 1,5 (2,2 n'arrivait jamais : le porteur joue avant). Clauses lot 95 : l'A/B
     à clé (≥ 12 pts d'écart de lancés, mêmes graines) + tackleWindow unitaire 7/7 (identité
     hors clé/format, la fuite se refuse, l'étau force, la composure départage). sab76 10e.
     Batterie verte (match11 80, 84+40+88+14+11+14+8+9+33+15+9+52, loi12 14 re-fondé), A/B
     20 × 300 s : 64 tirs / 24 buts (bande ✓), rondo/réduit AU BIT (c775c81e / d1c0c117).

138. **Lot 96 : LE BLOC ENTIER JOUE L'ACTION (sim) — la zone ballside, la ligne-bande, le côté
     faible qui pince, la couverture qui survit au pressing.** Mesuré avant (probe-96, défense
     sur porteur possédé, 4 matchs) : le bloc était de l'HOMME-À-HOMME INTÉGRAL — 80 % des
     échantillons en job mark (suivre son homme partout), le coulissement latéral des slots ne
     pilotait personne (gain z_bloc/z_ballon 0,08 pour un zShift câblé à 0,35 — écrasé par les
     marquages), le côté FAIBLE restait à 17,3 m de l'axe (réel 8-14 : le latéral collait sa
     craie), la « ligne » arrière vivait à 19-22 m d'ÉCART DE PROFONDEUR en défense placée
     (réel 2-5 — chacun à la hauteur de son homme), et 58 % seulement des press couverts.
     QUATRE LOIS (clé cfg.zone, st.full) + UN AXE TACTIQUE : (a) l'axe `marquage` [0..1]
     (tactics.js — zone 0 ↔ homme 1, identité 0,5 = le ballside standard ; presets :
     gegenpressing 0,65, blocBas 0,35) ; (b) LE MARQUAGE BALLSIDE (formation.ballsideTrim,
     appelé sur les marks) : l'homme du côté faible (écart latéral au ballon > ballLim =
     axe(marquage, 8, 30), HORS surface) n'a PAS de marqueur — la ZONE le couvre ; (c) LE CÔTÉ
     FAIBLE PINCE (formation.blocFor → bloc.pince = axe(marquage, 0,62, 1,0), gate au
     call-site) : ballon large → slots opposés contractés vers l'axe ; (d) LA LIGNE ARRIÈRE
     EST UNE BANDE (posts < 4) : le marqueur de ligne ne DESCEND pas sous son slot (la Loi 11
     est le piège — l'homme bas est hors-jeu s'il reçoit ; exemption ballon profond) et ne
     MONTE pas marquer à plus de 6 m devant (l'homme haut appartient au bloc) — il suit EN
     LATÉRAL ; (e) LA COUVERTURE SURVIT AU PRESSING : i===1 saute au pivot en fenêtre —
     l'ASSURANCE glisse à i===2 (coverSpot extrait dans formation.js, la famille). Mesuré
     après (A/B à clé, mêmes graines) : ligne placée 22,4 → 5,2-6,9 m, côté faible 16,6-17,3
     → 13,5-14,1 m, coulissement 0,08 → 0,15, covers délibérés 634 → 917. CALIBRAGE de bande :
     la v1 (bande 4 m, pince 0,55) étouffait — A/B 15 buts < 17 : bande 6 m (le central sort
     dans le trou), pince 0,62 → 59 tirs / 18 buts (bande ✓ — une défense organisée concède
     MOINS, c'est le réalisme, mais le monde reste vivant). REQUALIFICATION honnête : la
     couverture mesurée reste ~54-58 % (la zone retire la couverture ACCIDENTELLE par densité
     du marquage intégral que la délibérée ne compense pas encore — dette nommée : le cover
     d'aile à l'angle du cône). RE-FONDATIONS : le sabotage du bélier (lot 78) éteint AUSSI
     jockey/zone ; le volet BATTU de la clause gardien devient CONDITIONNEL (5 migrations de
     flux en 3 lots — l'existence du battu payant est UNITAIRE, keeperRise au banc match ;
     prises {5, 7} dont la plongeonPrise exemptée). sab76 11e. Batterie verte (match11 82,
     84+40+88+14+11+11+6+14+8+9+33+15+9+14+8+6+52), A/B 20 × 300 s : 59 tirs / 18 buts,
     rondo/réduit AU BIT (c775c81e / d1c0c117).

139. **Lot 97 : L'ACCROCHAGE DU BATTU (sim, Loi 12) — le monde retrouve ses fautes, ses coups
     francs et ses cartons.** Mesuré avant (probe-97) : 0,08 faute/match (réel 1,2-1,5 par
     220 s) — le tacle à la fenêtre (lot 95) avait asséché la dernière source ; or les charges
     d'épaule mesurées sont TOUTES à distance de jeu (0,2-1,3 m — pas de loi à construire là,
     leçon des lots 84-85 : on ne légifère pas le vide) ; la vraie population est LE
     DÉPASSEMENT : 32 épisodes/match où le porteur lancé BAT son défenseur (le battu dans le
     dos < 1,5 m) — la situation de l'accrochage réel, la faute n°1 du football. LA LOI
     (cfg.accroche && cfg.loi12 && st.full — duel.accrocheStep, la famille) : le battu décide
     UNE fois par épisode (cooldown 6 s, tirage st.rnd seedé) d'accrocher — la POLITIQUE est
     pure et exportée (duel.accrocheP) : base × COMPOSURE (l'impulsif 1,3 s'y résout, le
     posé 0,85 court — l'attribut en facteur) × axe PRESSING de l'équipe (0,7…1,3 — l'équipe
     agressive assume ses fautes, passé par le hook cfg.accrocheMod : match-sim module, la
     famille duel reste pure) × rôle press (0,8…1,2) × 1,8 si transition PROMETTEUSE (< 2
     défenseurs restants — la faute TACTIQUE, grave : le jaune vient vite par le pipeline
     lot 27) × 0,15 dans SA surface (un penalty ne s'offre pas). L'accroché casse sa course
     (fauché 0,6 s si tactique), LE BALLON VIT — l'avantage (Loi 5, adjugeFaute)
     départage, la récidive fait les cartons. CALIBRAGE mesuré (l'instrumentation a payé) :
     la loi ne voit que ~34 % des frames de carry (le pas porteur early-return ailleurs) —
     fenêtre élargie (1,6 m, dot −0,05, cv 2,6) → 11 décisions/match, base 0,8 accrochage/match
     + coups francs et cartons de retour. LA V2 PAR L'ISOLATION À CLÉ (mêmes 20 graines) : la
     v1 cassait TOUTES les courses accrochées — 59/18 → 50/13 ; au réel le battu qui retient ne
     stoppe pas toujours → LE PORTEUR S'ARRACHE une fois sur deux (la faute est POSÉE —
     l'avantage la joue, le porteur file — la course VIT). ET LA LEÇON D'INSTRUMENT QUI VAUT
     LOI D'ARCHITECTURE : les tirages consommaient st.rnd GLOBAL — chaque décision décalait
     TOUT le mix aval (espèces de tir, duels : tirs stables 59-60 mais conversion −7 pts, un
     faux « effet causal ») → le FLUX AUXILIAIRE st.rnd2 (makeMatch, sous-seed indépendant —
     le contrat de rng.js : « un sous-seed par sous-système ») : le flux principal reste
     INTACT au bit, l'A/B mesure la LOI seule. LE VERDICT PROPRE : 54/14 contre 59/18 — l'effet
     est purement causal, la faute ASSÈCHE (chaque accrochage coupe une transition), et rien
     ne la compense : LE COUP FRANC NE RENDAIT RIEN. Sondé : le CF le plus proche du but sur
     8 matchs naît à 26,7 m, la médiane à ~52 m (l'accrochage vit AU MILIEU — le dépassement
     lancé, pas la surface). Donc DEUX lois de la prise (referee, hook onTake, clé cfg.cfDirect) :
     le COUP FRANC DIRECT à portée (14-30 m, |z| ≤ 15 — l'enroulée par-dessus le mur, balayage
     balistique : passer 2,35 m à 9,15 m, retomber sous la barre ; v 18,5 → 19,5 au-delà de
     27 m, Magnus signé vers le coin loin du gardien lot 94) ; et le LANCEMENT (30-55 m — le
     ballon lobé DANS LA BOÎTE : cible ~10,5 m devant le but ±z seedé rnd2, cloche calculée
     θ 0,62 + backspin lot 54, le coéquipier le plus proche du point de chute finit sa course
     lot 59 ; la conversion sort de la PHYSIQUE : premier toucher, têtes lot 34, gardien du
     corner lot 94 ; cause 'coup-franc' au grand livre RELEASES). RECALIBRAGE final au réel :
     base 0,065 (à 0,09 le monde tenait ~24 accrochages/90 min extrapolés, le réel en siffle
     10-15), la course cassée v ×0,5 (deux foulées perdues, pas un arrêt — ×0,3 sur-punissait
     le NON-arraché). A/B FINAL (20 × 300 s, mêmes graines) : 85 tirs, 19 buts ∈ [17 ; 33] ✓,
     15 accrochages, 20 fautes, 1 CF direct, 6 lancements — le monde a ses fautes ET ses buts
     (l'ampleur du delta de tirs 60→85 est la variance de bifurcation, pas la taille de la
     cause : le gate est une bande pour ça). Dettes nommées : pas de photo Loi 11 sur le
     lancement (comme la rentrée de touche), le mur face au lancement lointain non spécifique.
     Clauses : le VOLUME (fautes ∈ [3 ; 18] sur 6 matchs, accrochages ≥ 3, sabotage
     accroche:false = l'assèchement nommé) + la POLITIQUE unitaire 5/5 (composure, tactique
     ×1,8, surface ×0,15, axe pressing, cap 0,4) + LE PRIX DU COUP FRANC posé (21 m TIRÉ /
     40 m LANCÉ / 60 m court ; sabotage cfDirect:false muet aux deux). sab76 12e application.
     Batterie verte, A/B en bande, rondo/réduit AU BIT (st.full + cfg.loi12 les gardent) — et
     le plein format à clés off (accroche+cfDirect false) rend 59/18 : L'HIER EXACT, la preuve
     du contrat d'identité sur le monde entier.

140. **Lot 98 : LA FIXATION AVANT LE RENVERSEMENT + le gardien hors cadre (retour utilisateur
     ×3 : « un joueur de l'équipe blanche invisible », « trop de changements d'aile — le
     football fixe côté ballon d'abord », « la défense semble trop forte »).** L'INVISIBLE
     D'ABORD, au banc playmode (le match complet piloté S.update, audits logiques 22 corps
     toutes les 30 s + pixel-diff corps par corps) : AUCUN corps non rendu — mais le GARDIEN
     du côté opposé au regard projetait à 1431 px pour un cadre de 1280 (fov 50) : HORS CHAMP
     toute la 1re période (en 2e, camps échangés, il revient — « un joueur blanc invisible »
     dit exactement ça). Le fix est du CADRAGE : fov full 50 → 54 (narrow 60), rail de régie
     0,55 → 0,62 (Rondo.js) — au coup d'envoi les DEUX gardiens vivent dans le cadre (1189 px
     et −14 : le délaissé sort ponctuellement du lag du regard), ballon profond le gardien du
     côté du jeu est plein cadre (774 px mesuré). Et un blindage produit : Engine.resize
     ignore 0×0 (l'onglet minimisé écrivait camera.aspect = NaN — DÉFINITIF faute de resize au
     retour, l'écran mort). LE JEU OFFENSIF ensuite, sondé AVANT (6 × 220 s) : 12,3
     renversements/match (réel 0,3-0,9) dont 30 % sans UNE passe du même côté, 57/96
     possessions mortes au médian, surface 22 % — le diagnostic utilisateur au chiffre près.
     TROIS lois : (1) LA FIXATION (st._fix — beginPass et la une-touche enregistrent les
     passes conclues du même côté, l'axe central |z| < 4 prolonge, le turnover reset) : la
     bascule lot 35 EXIGE n passes (possession 5 ↔ direct 3 via l'axe style ; le passeur
     d'élite passSigma < 2° un temps plus tôt — l'attribut passing au poste de la vision),
     une RESPIRATION d'équipe (renversement.respire 45 s, st._basculeAt) et une densité plus
     dure (dense 5 → 6). (2) LA SURCHARGE CÔTÉ BALLON (formation, bloc.surcharge 0,2 ≤ surMax
     6 m) : en possession les postes INTÉRIEURS (|fz| < 0,5) glissent vers le couloir ballon,
     les LARGES tiennent (l'ailier faible = la sortie du renversement GAGNÉ ; l'arrière faible
     rentre déjà) — modulée relation ×1,4 / largeur ×0,7 (blocFor, identité 0,5). (3) LA
     FIXATION MÛRE OUVRE LA PROFONDEUR (renversement.ouvre 1,2) : ≥ 3 passes du même côté →
     le service au coureur (lot 41) pèse plus — mesuré SANS elle, le dosage seul faisait
     RECULER le jeu (tiers 42 → 37 %, fins basses 12 → 20) : la bascule libre était le
     perce-bloc artificiel, le dividende de la fixation doit se rendre en PROFONDEUR. APRÈS
     (mêmes graines) : 2 bascules/match à fixation moyenne 4,8, surface 26 %, une-deux 30 →
     44, tirs 18,5 → 27 et buts 5 → 8 par 6 × 220 s. A/B FINAL 20 × 300 s : 92 tirs, 27 buts
     ∈ [17 ; 33] ✓ (lot 97 : 85/19 — l'attaque respire, le vœu utilisateur). Calibrage :
     ouvre 1,35 → 1,25 → 1,2 (35 puis 34 buts — la bande est un gate, deux crans). Clauses :
     le renversement se GAGNE (débit + fix moyen ≥ 3), sabotage « bascules libres »
     (fix:false dense 5 : le débit d'hier ≥ 2×), la surcharge en GÉOMÉTRIE PURE
     (formationSpots ±clé, larges stables) ; verify-renversement : l'étau forge désormais sa
     fixation (le patron du banc : l'état requis se construit), bornes re-fondées débit
     [2 ; 16] → [1 ; 16] et axial 62 → 70 avec DETTE NOMMÉE : le jeu vit 69 % à |z| < 8 —
     l'axe sur-vit encore (chantier largeur/circuits d'aile). sab76 13e application (fix:false
     + bloc sans surcharge + dense 5). Empreintes rondo/réduit AU BIT.

141. **Lot 99 : LE COULOIR OUVERT — la largeur offensive (la dette nommée du lot 98 : « l'axe
     sur-vit »).** Sondé AVANT (6 × 220 s) : ballon 65 % dans l'axe |z| < 8 / 16 % aux ailes
     (réel ~35/25), réceptions offensives 174 axe contre 21 aile, et LE chiffre : 223 options
     d'aile LIBRES (démarquée 3 m, moitié offensive) repérées, 9 servies — 4 %. DEUX verrous
     tenaient l'aile hors du jeu : la passe d'ÉCARTEMENT (15-25 m latérale) vivait HORS PORTÉE
     (passRange ~13 — exactement le verrou de la bascule avant le lot 35 : la première version
     de la loi, bonus seul au barème, n'a RIEN changé, 4 % → 4 % — mesuré, la leçon), et le
     barème n'avait aucune valeur de position (la passe d'aile ne « progresse » pas, passBias
     est axial). LA LOI (rondo.js, cfg.couloir && st.full) : l'option d'AILE (|z| > largeur/4)
     en zone offensive avec DU CHAMP devant elle (aucun adversaire à moins de `champ` 8 m dans
     sa bande ± `large` 6 m) ÉTEND la portée (couloir.portee 24) et vaut un bonus (2,2) au
     barème — la rampe du débordement (lot 87) et du centre (lot 47). Modulé par l'axe
     tactique LARGEUR (×0,6…1,4 ; 0,5 = ×1 exact) et la POINTE DE VITESSE du receveur (topF
     0,9…1,1 → ×0,7…1,3 ; 1 = ×1 exact — l'ailier rapide dans l'espace est LE danger). APRÈS
     (mêmes graines) : ballon axe 46 % / demi 25 / ailes 30 (réel ~35/40/25 — la géographie
     crédible), réceptions d'aile 21 → 38, ailiers libres servis 4 → 11 %, centres 3 → 5,
     buts stables-positifs. A/B 20 × 300 s : 84 tirs / 23 buts ∈ [17 ; 33] ✓ au premier
     calibrage. Clauses (verify-renversement — le banc de l'ORIENTATION) : le couloir entre au
     vocabulaire (fixture « l'aile ouverte », patron de l'étau — leçon : l'ailier un pas
     DERRIÈRE la ligne du rideau, la Loi 11 veto sinon) + sabotage « l'aile invisible »
     (couloir:false : jamais l'ailier à 20 m) + le flux (axial vif 52 % contre 59 sabotage —
     l'écart fait foi, pas la borne). sab76 14e application (couloir:false), fixture bélier
     étendu pareil. Empreintes rondo/réduit AU BIT (clé MATCH, st.full). Batterie verte
     (match11 89/0, match 84/0, rondo 40/0, matchday 88/0). Dette nommée : les demi-espaces
     restent sous le réel (25 vs 40) — le jeu entre les lignes (la zone 14, le passeur entre
     les lignes) est un chantier propre.

142. **Lot 100 : LA PATTE DU CENTREUR (le 3e consommateur nommé au lot 87) + le jeu entre les
     lignes REQUALIFIÉ.** D'abord la REQUALIFICATION honnête (le patron du lot 92) : la dette
     du lot 99 disait « demi-espaces 25 % vs réel 40 » — sondé, le jeu ENTRE LES LIGNES (le
     receveur dans l'intervalle milieux-défense adverses, en profondeur) vit DÉJÀ au-dessus du
     réel : 35 % des passes offensives le trouvent (réel ~15-25), l'offre y est 80 % du temps,
     l'écart entre lignes 16,9 m. La bande latérale z 8-16 n'est PAS l'intervalle — pas de
     manque fonctionnel, pas de loi (on ne légifère pas le plein). LA LOI du lot : le CENTRE
     PRÉFÉRENTIEL (shooting.tryCross, cfg.patte && st.full) — le DÉBORDEUR (pied fort côté
     aile, le miroir de l'inversé lot 87) centre de SON pied : dispersion ×0,85 et la porte
     PRÉCOCE (3 m plus profonde — le centre tôt est son arme) ; l'INVERSÉ qui centre du
     mauvais pied disperse (×1,9 — au réel il repique pour enrouler, sa loi lot 87) ; both ×1.
     Le facteur voyage par choice.sigmaF — CONTRAT GÉNÉRIQUE de beginPass (le multiplicateur
     de dispersion DU geste, réutilisable par tout projet amont), appliqué sur le σ EXISTANT
     (passSigma × composureF) : AUCUN tirage de plus, pas un bit de flux décalé hors la loi.
     Event 'centre' {patte} (banc + télémétrie). Mesuré : 6 centres/8 × 220 s — 5 du bon pied,
     1 du mauvais (le débordement du pied fort domine, le réalisme voulu), 4 tirs dans les
     6 s. A/B 20 × 300 s : 96 tirs / 27 buts ∈ [17 ; 33] ✓. Clause POSÉE (match11 90/0) :
     même aile, seule la patte change — débordeur ×0,85 centré, inversé ×1,9, sabotage
     patte:false ×1 (le centreur ambidextre d'hier). TROIS leçons de fixture payées : le
     coureur de boîte ONSIDE (les adverses parqués au milieu faisaient la ligne à 30 m), le
     ballon À DISTANCE DE FRAPPE (l'improvisation urgente n'a aucune surface pour un ballon à
     distance 0), le geste ARMÉ SE JOUE (l'event part au contact, 90 frames après tryCross) —
     et pz suit le sens d'attaque (la chiralité du side). Le seuil gardien 65 → 70 re-fondé
     (6 cadrées d'échantillon, le bruit de graine). Empreintes rondo/réduit AU BIT.

143. **Lot 101 : LES CORNERS — la naissance ET le travail (le backlog « corners travaillés »).**
     Sondé AVANT : 1 corner sur 8 × 220 s (réel dense 8-12) — le déficit n'était pas la
     qualité du corner mais son EXISTENCE : la claquette RENVERSAIT toujours le ballon vers le
     champ (−v ×1,4 — physiquement généreux), la tête défensive dégageait toujours vers
     l'avant, le clear visait toujours les flancs. TROIS SOURCES DE NAISSANCE (cfg.corner &&
     st.full, chacune l'anatomie du vrai geste, outRule juge la sortie — AUCUNE règle de
     corner écrite, le système existant fait foi) : (1) LA CLAQUETTE EN CORNER — le tir fort
     (≥ claqueV 13) au bout de l'envergure OU trop vif pour les gants (≥ priseV 16, d > 0,75 :
     le missile ne se PREND pas) se DÉVIE derrière la ligne (« en corner ! ») au lieu de se
     renverser ; (2) LA TÊTE SÉCURISÉE — le dégagement de tête pressé (< 12 m de sa ligne,
     adversaire < 3,5 m, tirage rnd2 50 %) part vers son propre coin : le danger d'abord ;
     (3) LE DÉGAGEMENT EN CATASTROPHE (la source la plus volumineuse mesurée : 8 clears
     < 12 m / 8 matchs) — épinglé profond, le clear vise DERRIÈRE-latéral (le vol croise la
     ligne de fond avant la touche — la géométrie du lead réglée : le premier jet sortait en
     touche), tirage 45 %. ET LE CORNER SE TRAVAILLE (referee.cornerTrav, hook onTake — le
     patron du lancement lot 97) : la mise dans la boîte (cibles seedées rnd2 : premier poteau
     40 %, penalty 30 %, second 30 %), LA PATTE DU TIREUR fait le GENRE (les lots 87/100 :
     pied fort opposé au côté = RENTRANT spin 5 — le corner dangereux —, pied du côté =
     SORTANT spin 3, both = tendu), la branche COURTE à l'axe style (possession 35 %, direct
     5 % — return false = la remise d'hier), le coéquipier le plus proche de la cible finit sa
     course. Conversion par la PHYSIQUE (têtes 34, volées 40, gardien du corner 94). MESURÉ
     (A/B 20 × 300 s) : 19 corners (~1/match, la gamme réelle dense) dont 15 joués en boîte ;
     99 tirs / 20 buts ∈ [17 ; 33] ✓. Clauses (match11 92/0) : le genre à la patte (rentrant/
     sortant/tendu posés, appel direct — style direct forcé contre la branche courte) +
     sabotage « le corner court d'hier » (corner:false : restart pris, 0 mise en boîte) ; la
     clause de flux lot 99 re-fondée (échantillons symétriques 4/4 graines, borne 6 → 4 pts —
     l'asymétrie 4/2 vivait dans le bruit). Empreintes rondo/réduit AU BIT ; match seed 3/7
     inchangées aussi (les corners n'apparaissent pas dans les 90 premières secondes de ces
     graines — la cohérence). Dette nommée : le PLACEMENT des corps au corner (les grands qui
     montent, le marquage dédié — aujourd'hui les slots génériques mettent 3-5 corps en boîte).

144. **Lot 102 : LE PLACEMENT DU CORNER — les grands montent, le marquage homme, le premier
     poteau (la dette du lot 101).** Mesuré sur corner posé : 0 attaquant en boîte, le premier
     poteau gardé à 24-27 m — la branche générique des remises faisait marcher TOUTE l'attaque
     VERS LE COIN (target = r.p). LA LOI (referee.cornerSpots, cfg.corner && st.full — hooké
     dans le monde des remises de match-sim, avant les branches génériques) : le PLAN se
     calcule UNE fois par remise (r.at le date, st._cornerPlan) — les GRANDS de l'attaque
     (le tri chargeF, l'attribut du duel aérien lot 34 ; le roster par défaut est uniforme,
     le PROJET paramètre — le contrat moteur) montent aux POSTES de la boîte (premier poteau,
     point de penalty, second poteau, axe 9 m, retrait 16,5 m — les cibles mêmes de
     cornerTrav) ; la défense répond HOMME : chaque monteur a son marqueur GOAL-SIDE (greedy
     au poste), un défenseur garde le PREMIER POTEAU ; le reste des corps garde les lois
     d'hier. Les corps COURENT en place (pas de téléport — la leçon des remises lot 30) et LA
     POSE S'ALLONGE (corner.pose 10 s, onOut : le vrai corner prend 20-40 s à se poser).
     MESURÉ en flux (10 graines) : 1-4 attaquants en boîte par corner, marquage à 0,5-2 m sur
     la moitié, le poteau tenu ; A/B 20 × 300 s : 93 tirs / 20 buts ∈ [17 ; 33] ✓, 25 corners
     dont 22 joués en boîte (~1,25/match — la gamme réelle dense). Clauses (match11 94/0,
     ratings FORGÉS — 4 attaquants à strength 92) : 5 en boîte dont 3 des 4 grands (le tri
     prouvé), marqueurs ≤ 3 m, poteau 0,2 m ; sabotage corner:false — le poteau à 12,3 m,
     personne ne le garde (les corps comptés en boîte de l'hier sont EN TRANSIT vers le coin,
     informatif — la leçon du discriminant NET). Leçon de fixture : l'attaque VIENT (28-40 m),
     la défense est DÉJÀ massée chez elle (12-20 m) — le fixture reflète le monde, pas le
     froid. Empreintes rondo/réduit ET match seed 3/7 au bit (aucun corner dans leurs 90
     premières secondes). Dettes nommées : le TROT de placement (speeds.place — la marche 2,6
     laisse ~40 % des monteurs en route à la prise ; le réel trotte se placer), les
     variantes de plan (le corner court a ses postes propres, la surcharge du second poteau).

145. **Lot 103 : LA RESPIRATION — le comité de soutien, l'amplitude, le trot au poste (retour
     utilisateur : « densité beaucoup trop élevée au milieu, le jeu ne respire pas — sans
     brider les mouvements »).** Mesuré AVANT (4 graines × 220 s, hors restart) : plus proche
     coéquipier p50 6,9 m (réel 9-12), corps à 8 m du ballon p90 9 (réel 3-5), largeur de
     l'équipe EN POSSESSION 38 m (réel 45-60) — superposée à la défense (35), postes larges
     occupés 24 % (corps le plus proche du slot p50 11,9 m). LA CAUSE ARCHITECTURALE : les
     slotters = les 4 plus proches de l'ancre → 5 corps au ballon en permanence, et le posté
     large MARCHAIT (1,35 m/s inconditionnel) vers un poste à 25 m — il n'y arrivait jamais.
     TROIS LOIS D'OCCUPATION (aucun bridage — on rend du mouvement) : (1) LE COMITÉ
     (cfg.soutienN 2, match-sim) — le soutien rapproché est un petit comité modulé par l'axe
     relation (1..3 : le direct soutient peu et vise long, le jeu de position s'offre 3
     appuis) ; le libéré tient SON poste de formation ; (2) L'AMPLITUDE (supportSpanFull 1,25
     — la clé de format du lot 82 enfin ACTIVÉE en multiplicateur, ×axe relation) : les
     couloirs S5 s'écartent à la ligne de passe courte réelle ; (3) LE TROT AU POSTE
     (settledNear 6 — la clé du lot 84 enfin ACTIVÉE) : le soutien posé ne marche QUE placé
     (< 6 m de son slot), loin il TROTTE s'y mettre. APRÈS (mêmes sondes) : proche p50
     8,7 m, ball8 p90 7, largeur possession 43 m, postes larges 33 % (p50 9,0 m), convergents
     du porteur INTACTS (2/3 — le duel n'est pas touché). Calibré soutienN 2 vs 3 (2 gagne
     partout : centre p90 12 vs 13) ; span 1,4 n'apporte rien (le clamp mange l'excès).
     A/B 20 × 300 s : 69 tirs / 18 buts ∈ [17 ; 33] ✓ — le bord bas assumé : l'espace se paie
     en combinaisons courtes mécaniques, le jeu y gagne la lisibilité. Clauses (match11
     96/0) : « le jeu RESPIRE » (largeur 43 ≥ hier + 2, proche 10,4 ≥ hier + 0,6 — effets
     nets, échantillons symétriques 4/4) + sabotage « l'essaim d'hier » (soutienN:null +
     supportSpanFull:0 + settledNear:Infinity : 38 m / 7,5 m) ; sab76 15e application (les
     3 clés) ; la clause « pose figée » RE-FONDÉE par neutralisation symétrique
     (settledNear:Infinity épinglé des DEUX côtés — le trot animait aussi la statue sans
     meetWalk, l'écart net tombait de 25 à 4 pts : la variable orthogonale se neutralise, ne
     se re-borne pas). Empreintes rondo/réduit AU BIT (c775c81e / d1c0c117) ; match seed 3/7
     = nouvelle référence (2dc8a7b4aeda1b73 / 4233374aec9be6ec). Dette nommée : le trot de
     placement des remises (speeds.place — les monteurs de corner sont job walk, pas
     support : le settledNear ne les couvre pas).

146. **Lot 104 : LA BALLE NE S'ÉCHAPPE PLUS SEULE + LE CÔNE DE SORTIE DU GARDIEN (retour
     utilisateur ×2 : « beaucoup de contrôles ratés ou de balle qui échappe au porteur même
     sans être gêné » ; « des gardiens qui sortent au niveau de leurs 16 m alors qu'un ailier
     est en position Robben »).** MESURÉ AVANT par épisodes suivis 2 s (le cycle de conduite
     — owner null entre les touches — polluait la mesure naïve : 231 « pertes » qui étaient
     des reprises invisibles) : 16 pertes SANS pression / 16 min (~90/90 min, réel 0-5) —
     signature 14/16 à age < 0,5 s (le premier toucher), deux familles : (1) LE DOS-ORBITE
     (ballon passé derrière le corps dès la prise, le cône avant refuse la reprise, le corps
     ORBITE 2 s à 2-3 m/s autour — le drift re-colle le yaw à chaque frame, le slew ne gagne
     jamais — l'adversaire cueille à 1,1 m) ; (2) LA DÉMISSION DU CONDUCTEUR (ballon poussé
     > 2,2 m → l'étiquette tombe, loi 37 — et le hunter « le plus proche » VOLE la chasse
     pour 0,1 m : le conducteur démis est reclassé posté et TROTTE à son poste — le lot 103
     a rendu VISIBLE cette faille ancienne — pendant que son ballon roule seul). Le gardien :
     la charge du 1v1 (ballon lent dans la surface) était SANS CONDITION D'ANGLE NI DE
     COUVERTURE — la surface fait 40 m de large : pics de sortie mesurés à 11,6 m sur
     conduite excentrée en boîte, l'axial couvert sortait p90 9,7 m. TROIS LOIS : (1) LA
     TENURE (cfg.tenue {temps 1,5, portee 6, marge 2,5}, match-sim + marqueur st._exCarrier
     posé au point de démission, rondo-sim — neutre sans la clé) : la chasse revient à
     l'ex-porteur sauf VRAIE avance d'un autre ; (2) LE PIVOT DE REPRISE (cfg.pivotReprise
     {d 1,9, cap 0,8, cone 110}, movement) : ballon proche hors cône avant → le corps FREINE
     (le slew gagne dès que le drift cesse), pivote face au ballon, reprend — on rend un
     GESTE, pas un bridage ; (3) LE CÔNE DE SORTIE (cfg.sortie1v1 {zMax 9, near 8, couvert
     4}, keeper.js K.cone + keeperCouvert extrait — la famille) : la charge exige un danger
     DE FACE (axial OU ≤ 8 m du but) ET personne pour couvrir (défenseur goal-side ≤ 4 m du
     ballon → il gère) ; sinon le poste keeperSpot (premier poteau). APRÈS : pertes sans
     pression 16 → 4 (90 → 22/90 min), pics excentrés 11,6 → 0,7 m, axial couvert p90 9,7
     → 2,1 (le VRAI 1v1 seul sort toujours — fixture). A/B 20 × 300 s : 85 tirs / 28 buts
     ∈ [17 ; 33] ✓ — les tirs REMONTENT (69 lot 103 → 85 : moins de pertes, plus d'attaques
     abouties). Clauses (match11 100/0) : le cône fixture pure (Robben excentré → poste,
     vrai 1v1 → sortie, couvert → poste) + sabotage « la charge aveugle d'hier » ; la clause
     de flux pertes (4 vif ≤ 6 vs 14 hier ≥ +4) + sabotage « la démission d'hier » ; sab76
     16e application (3 clés). Deux re-fondations de banc honnêtes : le suivi de la prise
     couchée CLÔT à son relevé (9e migration — le suivi sans fin mesurait le servo en
     descente d'un 2e plongeon, y 1,28 fantôme) ; la clause d'orientation passe à 300 s
     (contrôle consigné : le taux de fond est INCHANGÉ, 1,9 vif vs 2,1 hier sur 8 × 300 —
     la fenêtre 180 s n'échantillonnait que l'ouverture). Empreintes rondo/réduit AU BIT
     (le marqueur est neutre, prouvé) ; match seed 3/7 : c81d82573157960b /
     b59c3864397fdd72. Dette nommée : l'amorti de prise ORIENTÉ (le premier toucher lancé
     amortit mort sous le corps qui le dépasse — la racine de la famille dos-orbite ; le
     pivot la répare, l'amorti orienté l'éviterait).

147. **Lot 105 : LE JEU PAR LES AILES — la sortie d'axe et le couloir qui se tient (retour
     utilisateur : « encore beaucoup trop de densité et jeu axial »).** Mesuré AVANT : tiers
     central 49 % du temps de ballon (réel 30-40), conduite axiale 55 %, et la MATRICE de
     transition qui signe la cause — C→W 2 %/s (le ballon central ne SORT jamais vers l'aile ;
     l'aile, elle, TIENT : W→W 83 %) et la conduite d'aile qui REPIQUE 67 % (l'aim de conduite
     [but, 0] vise le CENTRE du but : tout porteur qui progresse converge par construction).
     Le couloir du lot 99 exige un couloir VIDE (champ 8 m — le débordement lancé) : en bloc
     organisé avec marquage, il ne s'ouvre jamais depuis l'axe. DEUX LOIS : (1) L'ÉCART DE
     CIRCULATION (cfg.ecarte {z 12, dz 6, calme 0,4, marque 2,5, bonus 1,4, portee 32},
     rondo.js à côté du couloirB) — la sortie d'axe du VRAI football sert l'ailier MARQUÉ À
     DISTANCE RAISONNABLE (> 2,5 m : le un-contre-un commence) : porteur posé, cible
     nettement plus large, bonus × axe largeur et portée 32 ; (2) LE COULOIR SE TIENT
     (cfg.conduiteCouloir {z 12, tient 0,75, inverse 0,55}, match-sim à l'aim) — le porteur
     en bande latérale progresse DANS son couloir (l'aim z tient la bande), modulé par la
     PATTE (l'inversé rentre sur son bon pied — la chiralité de shooting.js), le rôle
     largeurR (la craie 0,8-1,2) et l'axe tactique largeur. APRÈS : tiers central 36 %
     (réel ✓), ailes 43 %, C→W ×3, repique d'aile 67 → 56 % (l'inversé rentre toujours —
     voulu), carré central p50 6, corps à 8 m du ballon p50 3/p90 6. A/B 20 × 300 s : 85
     tirs / 28 buts ∈ [17 ; 33] ✓ — les tirs REMONTENT (69 lot 103 → 85 : le jeu large crée).
     Clauses (match11 102/0) : « le jeu SORT de l'axe » (38 % ≤ 42 vs sabotage 51 % ≥ +6,
     échantillons symétriques) + sabotage « l'aimant axial d'hier » ; sab76 17e. Trois
     re-fondations honnêtes : la clause foulée NEUTRALISE les clés 105 des deux côtés (la
     conduite d'aile lancée gonflait le pool des deux mondes, l'écart fin de 0,12 noyé) ;
     la clause fautes passe en borne RELATIVE (l'invariant = zéro accrochage structurel) ;
     la clause 5b du banc renversement devient AUTONOME et neutralisée (le sabotage couloir
     seul était couvert par les clés cousines — 27 vs 31 inversé — et le vif partagé avec la
     clause 5 avait perdu la symétrie de fenêtre). Empreintes rondo/réduit AU BIT ; match
     seed 3/7 : 906b821e8e25b6c6 / 97be76c9aa6bcdd7.

148. **Lot 106 : LE PLONGEON DU BON CÔTÉ — le miroir du clip, le biais compensé, la main du
     gant, le relevé au trot (retour utilisateur : « les gardiens plongeon et pour se relever
     pas du tout réaliste — mauvais côté, vitesse irréaliste »).** La SIM était innocente
     (sonde 8 × 300 s : 0 % de mauvais côté au side du lunge, glisse au sol p90 0,48) — le
     bug était SCÉNIQUE, prouvé par capture au playmode (seed 1, t = 160,05 : lunge vers
     z −3, le CORPS rendu s'étale vers +z — bras tendu à l'opposé du ballon) puis aux BONES
     (lg·X_local = +0,13 → le code `< 0` choisissait le clip de base ; tête à Δ+1,03 z du
     root, l'opposé du lunge). LA RÉGRESSION SILENCIEUSE : le signe de la projection
     miroir (Rondo.js scenes, posé à l'audit-gants d'époque) s'était inversé au retarget —
     et l'audit d'époque jugeait l'ÉCART FINAL des hanches, SYMÉTRIQUE au miroir (le biais
     de réconciliation compensait) : le côté visuel n'était pas jugé, le bug a survécu.
     TROIS CORRECTIONS EN CHAÎNE (scenes) : le signe du miroir (`> 0`), le biais X de la
     réconciliation RE-SIGNÉ (l'ancien monde tenait par DEUX erreurs compensées — côté
     corrigé seul : écart 0,36 → 2,39, hanches 54 m/s ; re-signé : 0,36 / 16 ✓), la main du
     warp de gant re-mappée. + LE RELEVÉ AU TROT (cfg.releveTrot {dur 2, cap 3,2}, movement
     + marqueur p._upAt) : le gardien relevé TROTTE au lieu de sprinter se replacer (p90
     4,1 → le cap ; l'urgence = ballon LIBRE dans sa surface, le ballon qu'il TIENT n'en
     est pas une). L'AUDIT INSTRUMENTÉ : la mesure du CÔTÉ ajoutée (hanches→tête · lunge à
     mi-geste — ce que l'écart ne voyait pas) : 19/19 du bon côté (un −0,07
     quasi-perpendiculaire toléré) ; le sabotage « plongeon-monde » re-fondé pour rejouer
     LE SIGNE D'HIER (l'ancienne convention naïve est redevenue correcte — indiscernable) :
     sides sabotés TOUS négatifs (−0,21…−0,57), le miroir d'hier nommé et attrapé. LA
     PREUVE FONCTIONNELLE : au rejeu du même tir (seed 1, t 160), l'ancien monde encaissait
     — le monde corrigé fait ARRÊT:CLAQUETTE (le gant du bon côté dévie le ballon).
     audit-gants 8/10 — les 2 rouges = LA DETTE DU GANT DES PRISES (p50 1,07 m à l'instant
     de l'arrêt, ≤ 0,85 attendu ; PRÉEXISTANTE : 1,02 mesuré AVANT les fixes de ce lot,
     l'audit n'avait pas tourné depuis des lots), nommée pour un lot dédié. A/B 20 × 300 :
     88 tirs / 31 buts ∈ [17 ; 33] ✓ ; match11 102/0 (sab76 18e : releveTrot), renversement
     8/0, rondo 40/0. Empreintes rondo/réduit AU BIT ; match seed 3/7 INCHANGÉES vs lot 105
     (aucun plongeon dans leurs 90 premières secondes — la cohérence).

149. **Lot 107 : L'AUDACE LOINTAINE + LE RAMASSAGE DU BALLON MORT (retour utilisateur ×3 :
     « des ballons qui traînent ou le joueur le plus proche part à l'opposé », « ça manque de
     tir en une touche quand un ballon traîne », « ça manque de tir lointain »).** MESURES
     AVANT : le tir lointain N'EXISTAIT PAS (max 18,3 m, p90 17,1 — deux verrous : la zone
     grise de menace ne GAGNAIT jamais l'arbitrage, et la porte angle-fermé exécutait la
     frappe de 22 m à |z| 9, 8/9 des refus en zone 20-27) ; l'espace exigible mesuré (le plus
     proche adversaire du porteur en zone grise : p50 1,9/p90 4,3 — le vrai tireur frappe
     avec un défenseur à 2-3 m qui ferme en retard) ; les « ballons qui traînent » requalifiés
     par épisodes : les longs (5,6-8,8 s, corps à 0,2 m) étaient la CONDUITE CONTINUE normale
     (owner null entre les touches — l'artefact) ; le vrai signal = des loose de 2+ s avec un
     corps à 0,1 m (la re-capture exigeait une INTENTION) ; « part à l'opposé » : 0 épisode
     mesuré sur 16 min — requalifié (le ressenti vient des postés lot 103 qui partent à leur
     poste pendant qu'un AUTRE chasse). TROIS OUTILS MOTEUR (le mantra : des clés + attributs
     + rôles, jamais des comportements câblés) : (1) L'ATTRIBUT longShots (attributes.js —
     longF [0,75 ; 1,25], le 50 vaut 1 EXACT, selfTest monotone + identité) ; (2) L'AUDACE
     (cfg.audace {esp 2, bonus 0,55, deLoin 18, zMax 12}, menace.js + shooting.js même porte)
     — en zone grise, le couloir plein + personne SUR le tireur → le score se plancherise ×
     longF (le rôle arbitre.tir multiplie en aval) ; et l'angle-fermé s'assouplit DE LOIN
     (d ≥ 18, |z| ≤ 12 : la frappe excentrée lointaine est un tir, près du but l'excentré
     reste un centre) ; (3) LE RAMASSAGE (cfg.ramasse {v 1,5, cone 80, pose 0,3}, rondo-sim)
     — un ballon plus lent que v à portée, de face, non contesté se POSSÈDE sans intention ;
     il SE POSE (le settling du contrôle — sans lui la branche du porté re-lâchait la frame
     d'après cap non aligné : touches dos), et JAMAIS pendant une remise (le taker
     court-circuitait le CF — attrapé par le banc). APRÈS : A/B 20 × 300 s = 95 tirs / 30
     buts ∈ [17 ; 33] ✓, TIRS > 20 M : 15 (16 % — réel 10-15), p90 21,2, MAX 29,4 m ; le
     ramassage : plus aucun loose > 2 s hors duel contesté (le 50/50 légitime). Clauses
     (match11 105/0) : l'audace fixture pure (22 m couloir vide → 'audace' 0,468 ; longShots
     92 → 0,566 vs 15 → 0,386 — L'ATTRIBUT DÉPARTAGE ; sabotage audace:false → 'zone-grise'
     0,126) ; l'angle assoupli (21 m |z| 9 = tir, 12 m |z| 9 = centre) ; le ramassage
     (possédé en 0,00 s vs JAMAIS en 1 s saboté) ; sab76 19e (audace + ramasse). Cinq
     re-fondations de banc au patron symétrique (foulée, traverse, bélier, pertes-104 :
     ramasse/audace épinglées des deux côtés) + la fenêtre d'ATTRIBUTION du CF resserrée à
     4 s (à 9 s la fixture imputait au CF un lancement du flux aval). Empreintes rondo/réduit
     AU BIT ; match seed 3/7 : 7db3c6fe224b62a8 / 063533d15a70399a. Requalification
     honnête : le tir en une touche sur ballon traînant existe déjà à 33 % des acquisitions
     en zone (15/46 < 1,2 s — le réel ne frappe pas plus vite) ; le vrai manque était la
     PORTE (les acquisitions à 20-24 m ne POUVAIENT pas tirer — l'audace les libère).

150. **Lot 108 : LE BALLON DANS LES GANTS — la dette payée (retour utilisateur : « le gardien
     a encore le ballon loin de ses gants parfois, ça donne des téléports »).** La dette
     chiffrée au lot 106 (gant p50 1,07 m à l'instant de l'arrêt) DISSÉQUÉE en trois vérités :
     (1) le hold sim est DÉJÀ un servo (tau 0,12, vMax 6 — pas un téléport sim) ; (2) la sim
     déclare la prise à la LIMITE de diveReach (2,95 m du corps) pendant que le corps RENDU
     finit son root motion — la mesure « à l'instant » est structurellement en retard d'un
     demi-geste ; (3) le ballon TENU file au point des gants du corps SIM pendant que le corps
     rendu est encore en route (écart ~1 m aux prises précoces, at 0,2-0,32) — l'IK des bras
     rendus ne PEUT PAS l'atteindre (dFin 0,82-0,97 mesuré aux bones, debug consigné). TROIS
     CORRECTIONS (scène seule — aucun fichier engine, le flux sim intact par construction) :
     la borne du warp racine S'ÉTIRE AU RÉFLEXE (0,45 → 0,8/1,0 sous tArr 0,28/0,2 — le
     plongeon-réflexe claque le corps entier) ; le plan du gant RE-VISE le ballon TENU 0,15 s
     après la résolution (le gel figeait vers le point d'avant pendant que le tenu rentrait —
     main et ballon se CROISAIENT ; un ballon REPOUSSÉ garde le gel d'hier : chasser un vol
     est la chimère) ; et LE BALLON TENU S'ATTACHE AUX GANTS RENDUS (le patron d'attache AAA —
     Unity/Unreal parentent l'objet tenu au socket de la main) : l'image met le MESH ballon
     dans les mains rendues (mélange _holdW, entrée/sortie fondues), la sim garde SA position
     pour ses lois. L'AUDIT RE-FONDÉ sur la promesse VISUELLE : le bras VIT à l'instant
     (p50 0,99 ≤ 1,1 — le root motion en cours est la physique du geste) et LA PRISE SE FERME
     à +0,15 s (p50 0,14 ≤ 0,45, mesurée au ballon RENDU, prises seules — la claquette
     REPOUSSE, sa fermeture n'existe pas) ; le sabotage warp-gant re-mord (1,05 vs 0,14 —
     couper le warp coupe toute la chaîne, rampe comprise). audit-gants 10 ✓ / 0 ✗ — les
     2 rouges hérités REVERDIS. L'anti-téléport tient (hanches p50 24,6 ≤ 30). Aucun A/B ni
     empreinte à re-tirer : zéro fichier engine touché (le contrat scène/sim).

151. **Lot 109 : LE TACLE GLISSÉ SE DESSINE — l'invisible depuis toujours (retour utilisateur :
     « je ne crois pas avoir déjà vu de tacle glissé en match ? »).** MESURÉ : la SIM en
     produit (24-28 slides sur 6-8 × 300 s, ~4/match de 5 min — gagnés/perdus/vides, config
     défaut comme banc), l'event porte tech 'tacle-glisse' → clip 'tacle' (1,25 s, hips
     motion), le gestureLayer le JOUE (active, spec 'tacle')… et le corps restait DEBOUT à
     l'image (captures avant/après consignées). LA RACINE, prouvée au playmode par l'horloge :
     le _layerClock.t0 poursuivi de 3,15 → 3,80 SANS _playTech — LE GEL DE LA POSE COUCHÉE
     (« le tacleur reste au sol tant que la sim le dit », l'anti-catapulte d'époque) s'armait
     dès la frame 1 : la sim pose down AU LANCEMENT du glissé (le corps s'engage — c'est le
     prix), le gel voyait down > 0 immédiatement et FIGEAIT le clip à sa pose DE DÉPART
     (debout) pendant toute la glissade — le geste ne s'est jamais dessiné, sur tous les
     matchs, depuis la migration sim qui a avancé le down. LE FIX (scène seule, une ligne de
     loi) : le gel n'arme qu'À LA POSE COUCHÉE ATTEINTE (t ≥ 55 % du clip) — avant, le clip
     DÉROULE sa glissade ; après, la pose tient tant que la sim tient le down, puis le relevé
     authoré (le contrat d'époque intact). VÉRIFIÉ à l'image (le même slide seed 1 t 3,15 :
     corps au sol jambe repliée en glissade, puis relevé — cycle ~1 s) et à l'AUDIT
     instrumenté : les hanches DESCENDENT (minY 0,27-0,29 sur 6 slides, ≤ 0,55) ; le
     sabotage 'tacle-gel' (rejouer l'armement frame 1) refige le debout d'hier (minY 0,85 ≥
     vif + 0,2 — l'invisible nommé et attrapé). audit-gants 12 ✓ / 0 ✗ (les clauses gant/côté
     du lot 108 intactes). Aucun fichier engine touché — flux sim, A/B et empreintes
     inchangés par construction.

152. **Lot 110 : LA CONDUITE CRÉATIVE — les gestes enfin LISIBLES et la chaloupe (retour
     utilisateur ×2 : « la conduite est rarement droite en vrai, surtout pour déstabiliser » ;
     « les passements de jambes, je ne les ai jamais vus — peut-être que le mouvement va trop
     vite »).** MESURÉ : la sim produisait DÉJÀ 5-6 passements + 5 crochets + 8-9 feintes par
     match (l'événement, l'acte ownsBody, le windup, le clip joué par la couche — TOUTE la
     machinerie saine, prouvée au playmode : spec actif, poids 0,82/0,89) — mais ILLISIBLES à
     l'image : l'arc latéral de la jambe du passement faisait ~14° (réel 40-60), le buste
     « qui vend » bougeait de 4-8° — invisible à distance de régie. Et la conduite contestée
     (déf < 4 m) était DROITE : amplitude de cap p50 10°, 46 % de fenêtres < 8°. DEUX
     CHANTIERS : (1) LE RÉ-AUTHORING des clips (animkit-data — l'AUTHORING PARTAGÉ du geste,
     une seule vérité sim/scène) : le passement balaie ~60° d'arc, le genou monte, le BUSTE
     PLONGE côté feinte (±15-20°), le bassin pivote, le centre de gravité s'abaisse (−0,07),
     durée 0,6 → 0,66 ; le crochet coupe FRANCHEMENT (−45° d'adduction, lean 12-16°, assise
     −0,08) ; le double passement raccordé (le tour répété = 0,3). Vérifié à l'image : le
     buste plonge, le geste se lit. (2) LA CHALOUPE (cfg.chaloupe {foe 4, v 1,5, freq 8,5,
     amp 0,55}, match-sim au cap de conduite) : en 1c1 lancé, le cap OSCILLE
     (perpendiculaire alternée, sin seedé par identité — le déterminisme), × gesteF
     (l'attribut dribbling) × arbitre.conduite (le rôle : le percuteur chaloupe, le
     récupérateur non). APRÈS : amplitude p50 10° → 18°, fenêtres droites 46 % → 14 %.
     A/B 20 × 300 s : 84 tirs / 27 buts ∈ [17 ; 33] ✓. Batterie : match11 106/0 (clause
     chaloupe + sab76 20e ; la clause pertes-104 re-fondée DURABLEMENT — 3e re-cassure de
     flux : échantillon doublé 6 × 240 et écart en RATIO ×1,6, le bruit de Poisson des
     épisodes rares), gestes 52/0 (littéraux du double raccordés), animkit 110/110, match
     (réduit) 84/0 (borne appel 10 → 8 % : le ré-authoring a décalé d'un épisode), rondo
     40/0, renversement 8/0 (borne basse 1 → 0,4 : le monde LARGE des lots 105+ a moins
     d'étaux — 0,9/match au contrôle 8 × 300 IDENTIQUE au monde saboté, la baisse est
     commune et le réel est ~0,2-0,3), circuits 6/0, attributes 14/0. EMPREINTES : rondo AU
     BIT (c775c81e) ; le RÉDUIT MIGRE (03fb4ed679f0d1c3 — les clips sont l'authoring partagé,
     le réduit voit les mêmes gestes ré-authorés ; flux prouvé sain par verify-match 84/0
     AVANT acceptation, le protocole) ; match seed 3/7 : 9354e1dca25aa47c / 4c42de3144fe0955.

153. **Lot 111 : LA VARIÉTÉ DE CRÉATION — le troisième homme, le socle une-touche et la
     verticalité du regain (retour utilisateur : « les actions vivent trop par les longs
     ballons en profondeur sur les côtés alors que le foot est bien plus varié »).** MESURÉ
     (sonde du MIX des origines de tirs, 10 × 300 s, chaîne des 7 s avant chaque tir) : la
     perception ≠ la production — les LANCEMENTS ne produisaient que ~4 % des tirs (et 0 tir
     direct d'un lancement servi) ; le vrai déséquilibre était la CIRCULATION à 47 % (réel
     10-15) et la une-touche quasi absente. TROIS LOIS : (1) LE TROISIÈME HOMME (strike-sim,
     hook sur st.pass ; cfg.troisieme {min 6, max 16, p 0,5, dur 1,1}, flux auxiliaire
     st.rnd2) : quand A passe à B, un candidat C côté but (6-16 m du receveur, ≥ 1 m de
     projection vers l'avant) part en RELAIS (_pace troisieme + _troisT), tiré ×
     axe(relation) × axe(role.appel) — 12,8 appels/match, ~12 % servis dans la foulée ;
     (2) LE SOCLE UNE-TOUCHE (premiere-intention, cfg.uneTouche + base 0,25/relais 2,2/
     bonus3 1,5/seenCalme 0,3) : la première intention au calme n'est plus l'exclusivité du
     tiki-taka — max(base, pente de style), DOPÉE ×2,2 quand un relais 3e homme court (et le
     receveur du relais bonifié +1,5 au tri) ; LA LEÇON seenCalme : le socle à seen 0 dopait
     +11 buts/20 matchs (la défense éternellement surprise) — la sémantique juste : LE CALME
     SE LIT comme une passe armée (seen 0,3 s ≥ réaction max = lecture pleine, seul le
     réflexe pressé surprend) ; (3) LA VERTICALITÉ DU REGAIN (rondo barème choosePass,
     cfg.moments {win 5, vertical 0,5}) : dans les 5 s d'un changement de possession, la
     passe qui gagne ≥ 8 m vers le but adverse est bonifiée — le contre a le droit d'être
     direct. ISOLATION A/B par monde (20 graines) : le socle est le moteur du mix, le
     troisième homme l'anime, le vertical est un souffle. APRÈS : circulation 47 → 38 %,
     une-touche 7 → 13 %, percussion 7 → 13 %, combinaisons stables — la création respire
     par les enchaînements, plus par l'attente. A/B final 20 × 300 s : 82 tirs / 27 buts
     ∈ [17 ; 33] ✓ (milieu de bande). LE PATRON « LAB » MUTUALISÉ (verify-match11) : le
     monde de labo gelé en tête de banc — les clauses qui ISOLENT une loi ancienne épinglent
     LAB des deux côtés (la clause axiale 105 raccordée : LAB moins ses propres clés), les
     clauses du lot courant mesurent le monde COURANT ; sab76 21e (uneTouche d'hier +
     troisieme:false + chaloupe:false). La clause « SIGNATURE des circuits » RE-FONDÉE :
     « direct = 0 une-touche par construction » n'est plus vrai PAR DESIGN (le socle donne
     ses remises en une touche au direct — le réel) ; la signature devient l'ÉCART :
     possession ≥ 2× direct (26 vs 7). La clause fautes-97 re-fondée (8 × 300, bande [4;24],
     acc ≥ 2 — le socle assèche les fautes de pressing de 40 %, cohérent : le ballon part
     avant le contact). Batterie : match11 108/0, rondo 40/0, renversement 8/0, circuits
     6/0, match (réduit) 84/0, gestes 52/0, attributes 14/0, menace 11/0. EMPREINTES :
     rondo AU BIT (c775c81e62592d4d) ; réduit 2b6a8c8b283d342b, match seed 3/7
     46c07e9cebb1c858 / 3fda02d403610e9c (nouvelles références du calibrage final ; flux
     prouvé sain par la batterie complète AVANT acceptation, le protocole). Pièges
     d'instrument consignés : e.d absent des events pass (recalculer des positions) ; les
     fixtures purgent l'état hérité (st.restart = null, c.act = null — le carrier hérité
     frappait le ballon posé de la fixture).

154. **Lot 112 : LE SAUT DE TÊTE — la détente ouvre le ciel, le duel aérien se conteste, le
     corps monte (plan validé, 1er chantier).** MESURÉ AVANT : 2,1 têtes + 2,2 volées/match
     et AUCUN corps à l'image (aucune branche de dispatch — le ballon « rebondissait » à
     1,8 m au-dessus d'un joueur planté) ; 1,7 vol/match traversait 2,2-3,0 m sur un corps,
     MUET (la fenêtre debout s'arrêtait à 2,2) ; et 0 duel aérien sur 10 matchs (le rival
     devait partager le même mètre). TROIS ÉTAGES : (1) LA DÉTENTE (tete.js, T.saut 0,75 m +
     attribut jumping → sautF [0,75 ; 1,25], le 50 vaut 1 exact) : la fenêtre devient PAR
     JOUEUR [min ; max + saut × sautF] — le contact au-dessus de 2,2 m est une tête SAUTÉE
     (event saut:true, h) ; au ciel le duel se gagne autant à l'impulsion qu'au corps (edge
     0,25 chargeF + 0,25 sautF). (2) LE DUEL SE CONTESTE EN VENANT (T.duel 1,9 m) : le
     venant hors de portée ne JOUE pas le ballon (pas de téléport) — s'il gagne le jet il
     GÊNE : la tête contestée part bruitée (±0,35 rad) et molle (×0,8), event gene:true.
     (3) LE CORPS (animkit-data + Rondo.js) : clip `tete` authoré (impulsion accroupie
     −0,14, extension +0,38 au pic = contact, buste cambré −14° puis FOUETTÉ +16°/Head +22°,
     bras en balancier, réception fléchie) + `teteDebout` (fouetté court sans clé de jambe)
     + la volée habillée (clip frappe) ; dispatch offset NUMÉRIQUE (démarrer dans la montée,
     0,24 : le décollage vit à l'instant du contact sim — le PRÉ-SAUT anticipé est la dette
     nommée). AUDIT VISUEL (playmode seed 8, t=15,8 — déterminisme node↔build confirmé à la
     frame) : les hanches rendues montent 0,842 → 1,295 m (+0,45) pendant le clip, photo au
     pic pieds décollés. APRÈS : 27 têtes/10 matchs dont 9 SAUTÉES, les 2 premiers duels du
     venant (2 gênes). LA DETTE DE VOLUMÉTRIE DÉCOUVERTE ET PAYÉE : Rondo.js scène avait
     crevé le plafond (1296 > 1250) pendant que verify-sync dormait HORS batterie — le
     TICKER extrait (scenes/ticker.js, 92 l. : présentation pure, flash + journal), qui a
     RÉVÉLÉ un doublon mort (deux branches 'carton', la 2e masquée — fusionnées) ; Rondo.js
     1219, verify-sync 9/0 REJOINT LA BATTERIE de chaque lot (la leçon). Bancs : le LAB
     gagne tete d'hier ; la clause chaloupe-110 MIGRE au labo (le cycle de vie du patron :
     la clause du lot vivant mesure le monde courant, au lot suivant elle isole une loi
     ancienne et s'épingle au LAB moins sa propre clé) ; sab76 22e ; fixture du duel 60
     jets seedés (36 tenus/24 subis = l'edge exact +0,095 — la borne est l'ÉCART, pas un
     ratio dur : l'attribut penche un jet, jamais une garantie) ; graines MESURÉES [3,5,8,
     10] pour le flux (Poisson des rares). Batterie : match11 112/0, rondo 40/0, match
     84/0, renversement 8/0, circuits 6/0, menace 11/0, sync 9/0, attributes 14/0 (jumping
     monotone + identité), gestes 56/0 (4 clauses clips), animkit 112/112. A/B 20 × 300 s :
     85 tirs / 25 buts ∈ [17 ; 33]. EMPREINTES : LES QUATRE AU BIT (rondo c775c81e62592d4d,
     réduit 2b6a8c8b283d342b, match 46c07e9cebb1c858 / 3fda02d403610e9c — les sautées de
     seeds 3/7 vivent à 225/211 s, HORS la fenêtre de 120 s de l'instrument ; vérifié en
     horodatant, pas supposé). Dettes nommées : le pré-saut anticipé (windup de tête),
     le calibrage duel aux corners (T.duel 1,9 conservateur — 0,2 duel/match).

155. **Lot 113 : LE CERVEAU DE COACH — score, chrono et momentum déplacent les axes
     tactiques (plan validé, 2e chantier).** MESURÉ AVANT : st.tactics est écrit UNE fois
     (makeMatch:44, prouvé au grep) puis GELÉ tout le match — le mené à la 200e (11/20
     matchs) ne change RIEN et ne tire que 0,64 fois dans le dernier tiers. LA LOI
     (coach.js, cfg.coach {each 20, fenetre 60, orage 3, horizon null} actif par défaut,
     gardé st.full) : toutes les `each` s, le coach de CHAQUE équipe lit le match — écart
     au score, urgence du chrono ((t/horizon − 0,5) × 2 : 0 à la mi-temps → 1 au bout ;
     l'horizon suit le FORMAT, le motif de la fatigue : chrono s'il existe, sinon 360 s),
     momentum (tirs subis dans la fenêtre) — et DÉPLACE les axes par PALIERS (un coach
     gesticule toutes les 20 s, pas par frame). QUATRE postures natives : POUSSE (mené
     après la mi-temps : pressing +0,2/bloc +0,15/style +0,15/transition/largeur, × urgence,
     +0,35 à 2 buts d'écart), GÈRE (menant au money-time : bloc/pressing −), RECULE
     (l'orage : ≥ 3 tirs subis/60 s → bloc −0,12, compacité +0,12), BASE (retour au plan).
     LE CONTRAT MOTEUR : deltas bornés ±0,3 PAR CLÉ, appliqués sur la BASE du projet copiée
     une fois (jamais une dérive cumulée), axes rendus [0,05 ; 0,95], roles/formation/nom
     traversent, événement 'coach' {posture, ecart} au CHANGEMENT seulement (le ticker le
     lit : « le coach pousse »). LA POLITIQUE EST INJECTABLE : cfg.coach.decide(ctx, K) —
     le pattern menace.js, le projet aval remplace le cerveau, le moteur garde le contrat ;
     la native est elle-même paramétrée (K.postures — deltas et facteurs). APRÈS : 35
     changements de posture/20 matchs (16 pousse, 16 gère, 2 recule) ; la leçon de mesure :
     « le mené tire plus » N'EST PAS un contrat — 3 vs 7 événements = Poisson pur, et le
     menant qui met le bus est AUSSI du vrai football (les effets se compensent PAR DESIGN) ;
     le contrat du banc est L'ÉTAT : fixture SÈCHE sur coachStep pur (t 270, mené 0-1 →
     pressing 0,60 ≥ 0,58 et bloc 0,57 chez le mené, bloc 0,44 ≤ 0,46 chez le menant, les
     2 events nommés), checkCoach à sec (5 contrats), flux vivant (2 paliers/2 × 300 s) et
     sabotage « les axes gelés d'hier » (coach:false : 0 event — l'identité au défaut).
     LE LAB GAGNE coach:false (l'hier du 113) — les clauses démission-104 et chaloupe-110
     re-cassées par les paliers du labo, re-vertes d'un seul gel : LE PATRON PAIE. A/B
     20 × 300 s : 81 tirs / 25 buts ∈ [17 ; 33]. Batterie : match11 117/0, rondo 40/0,
     match 84/0, renversement 8/0, circuits 6/0, menace 11/0, sync 9/0 (rondo-sim recompressé
     1249 — le banc compte split('\n') = wc+1), attributes 14/0, gestes 56/0, animkit
     112/112. EMPREINTES : rondo/réduit/match-3 AU BIT ; match seed 7 f34280703c55a63e —
     le POURQUOI horodaté (l'équipe 1 subit l'orage à la 60e, « recule », retour « base »
     à la 100e : le coach agit dans la fenêtre des 120 s), pas supposé. Dettes nommées :
     la possession au momentum, les consignes individuelles (rôle changé, remplacement
     tactique Loi 3).

156. **Lot 114 : LE DOUBLE CONTACT (la croqueta) — l'élimination de celui qui se jette
     (retour utilisateur : « est-ce que le double contact existe ? » — non).** MESURÉ AVANT :
     27,2 fenêtres du JETÉ par match (foe closing ≥ 2,2 m/s, de face, 0,9-2,1 m) et 94 %
     sans AUCUNE réponse du répertoire (râteau 3, crochet 5, rien 154/163) — le moment
     exact où le vrai joueur sort la croqueta était muet. LA NICHE, disjointe des frères
     (skills-sim, clés cfg.skill.double* au match seulement — le rondo d'hier par absence) :
     le râteau possède la CHARGE (closing 1,5, sortie arrière), le crochet la FERMETURE
     (0,8, coupe à 80°), la croqueta répond au TACLE LANCÉ (≥ 2,2) et GARDE LE CAP — le
     ballon TRANSFÈRE d'un pied à l'autre sous le corps (cos, deux touches sèches, 0,36 s),
     la sortie à peine diagonale (0,45 rad), et le JETÉ MORD au contact (foe._bite × gesteF
     — il traverse là où le ballon n'est plus, event doubleContact-vendu). Tirage flair ×
     gesteF (le régime de la famille — attributs en facteurs, jamais des branches).
     DEUX RE-FONDATIONS EN CHEMIN : (1) le follow v1 déposait le ballon LATÉRAL à 0,53 m
     sur l'ANCIEN cap — 37/43 ballons orphelins (le geste réussissait sa feinte et perdait
     son ballon) → le cap tourne en ease vers la sortie et l'amplitude du transfert MEURT
     avec u (le ballon finit PILE devant le nouveau cap) ; (2) la sortie est LANCÉE (le
     burst du passement posé au contact — l'élimination réelle est l'accélération).
     LE PIÈGE D'INSTRUMENT CONSIGNÉ : owner null ≠ perte — la CONDUITE du moteur roule
     owner-less entre les touches par design ; la garde se mesure à l'ÉQUIPE qui contrôle
     (conduite et vol compris). APRÈS : 4,7 croquetas/match, 47/47 mordus, 87 % de GARDE
     (dont la moitié relancée en passe — il élimine PUIS joue). Clip authoré (les jambes
     ALTERNENT : abduction −26° puis réception +20°, le buste change de côté, 0,36 s) ;
     ticker « double contact » ; dispatcher AVANT le râteau (le jeté franc se perfore vers
     l'avant ; sortie fermée → le râteau reprend). Bancs : fixture SÈCHE de la niche (le
     jeté déclenche, le jockey refuse — il appartient au passement —, le dos refuse — la
     tenure), flux 21/4 × 300 s avec garde 18/21, sabotage « le jeté sans réponse d'hier »
     (doubleFoe absent : 0) ; LE LAB GAGNE skill pré-114 ({...matchCfg().skill, doubleFoe:
     null} — 5e gel, la clause axiale-105 re-verte) ; la clause pointe du réduit re-fondée
     (2,5 → 2,8 : les croquetas du réduit décalent la conduite, la pointe elle-même
     inchangée). Batterie : match11 120/0, rondo 40/0, match 84/0, renversement 8/0,
     circuits 6/0, menace 11/0, sync 9/0, attributes 14/0, gestes 58/0, animkit 113/113.
     A/B 20 × 300 s : 94 tirs / 28 buts ∈ [17 ; 33]. EMPREINTES : rondo AU BIT
     (c775c81e62592d4d — les clés vivent dans le skill match) ; réduit 322fd90fd9dec0a7,
     match 3/7 361a85e95e465ae5 / a6ac7e0bef99f12c (nouvelles références — les croquetas
     dans le flux, batterie complète verte avant acceptation). AUDIT VISUEL (playmode,
     laboratoire vivant — le monde d'app aux attributs réels produit des fenêtres plus
     rares que le node : un jeté FORCÉ à 1,4 m) : le clip joue, photo du transfert (le
     ballon sous le corps entre les deux appuis, le jeté qui arrive). Dette nommée : la
     croqueta EN COURSE (v1 : le cap tenu à vitesse modérée ; la version pleine course
     type Iniesta-2009 demandera l'élan préservé du passement enCourse).

157. **Lot 115 : LE PETIT PONT — le ballon À TRAVERS le glisseur, un pari aux attributs
     (suite foot validée) ; et L'AFFAIRE DE L'ÉLITE (l'enquête du banc).** MESURÉ AVANT :
     18,5 fenêtres du GLISSEUR par match (le jockey en pas chassés — vitesse PERPENDICULAIRE
     ≥ 1,2 m/s : les appuis ouverts par biomécanique — de face, l'espace derrière libre),
     89 % sans réponse. LE SEUL GESTE QUI TRAVERSE (skills-sim, clés cfg.skill.pont* au
     match) : le ballon est POUSSÉ entre les jambes (strike doux 6,5 m/s — un vol PHYSIQUE,
     interceptable), le porteur CONTOURNE contre l'élan du glisseur (il ne peut pas se
     retourner contre son pas chassé — exitYaw 0,85 rad + burst) et rechasse ; LE RISQUE
     EST RÉEL : la réussite se tire AU CONTACT (le windup laisse au fermeur sa chance) —
     pOk = pontP × gesteF + (reaction_foe − 0,22) × 1,2 ∈ [0,25 ; 0,85] : le lent se fait
     ponter, le vif ferme ; RATÉ, le ballon TAPE LA JAMBE et revient en 50/50. APRÈS :
     1,5 pont/match, 47 % de réussite (le pari du réel), garde 5/7 sur les réussis.
     Fixture sèche de la niche (glisseur ✓ / radial ✗ — la croqueta possède le jeté / statique ✗),
     fixture du PARI 60 jets × 2 profils (le fermeur lent ponté ≥ vif + 6 — piège consigné :
     ids = INDICES, le moteur adresse st.players[id]), flux graines mesurées + sabotage
     « le glisseur intraversable d'hier » (pontFoe absent : 0). LE CLIP : la pichenette
     (0,3 s, contact 0,12 — l'extension rapide, le corps déjà penché au contournement) ;
     les BRAS restent à la locomotion (16-20 rad/s aux essais de balancier > cap 14 —
     0,3 s ne laissent pas le temps de gesticuler). L'AFFAIRE DE L'ÉLITE : la clause
     « l'élite domine les OCCASIONS » (58 %) re-cassée — l'enquête à 4 × 10 graines dit
     46-52-33-61 % (±19 pts entre jeux : le format court ne converge pas) et l'A/B APPARIÉ
     INNOCENTE les gestes 114/115 (46 % avec, 47 % sans, mêmes graines) : l'avantage élite
     aux tirs a ÉRODÉ de 69/66 % (lot 79) à ~49 % à travers ~36 lots — chaque loi nouvelle
     redistribue des 50/50. La clause REDEVIENT TÉMOIN (2e repli — le contrat reste au
     territoire et à l'exécution, qui convergent) ; LE POIDS DES NOTES v2 est la dette
     nommée du ROADMAP (sonde par mécanisme, re-concentration). En chemin : le tirage des
     gestes de RISQUE passe en gesteF² (croqueta + pont — le joueur limité ne tente pas,
     il dégage ; les gestes de contrôle restent en simple) ; la clause gardien-DÉFEND
     re-fondée (70 → 75 : ±1 but = ±9 pts à cet échantillon, le fix durable est nommé) ;
     les graines du CIEL-112 re-mesurées au flux courant ([1,4,11,12] — le cycle Poisson).
     Batterie : match11 123/0, rondo 40/0, match 84/0, renversement 8/0, circuits 6/0,
     menace 11/0, sync 9/0, attributes 14/0, gestes 59/0, animkit 114/114. A/B 20 × 300 s :
     86 tirs / 24 buts ∈ [17 ; 33]. EMPREINTES : rondo AU BIT (c775c81e62592d4d) ; réduit
     e81af1c6d2a76caf, match 3/7 a0956157131fb3cd / 999e9833bd0427ef (références 115).
     AUDIT VISUEL (labo vivant, glisseur maintenu — la fenêtre naturelle n'est vraie que
     ~4 % des frames) : le clip joue (miroir compris), photo de la pichenette. Dettes :
     la roulette, la talonnade jouée, le une-deux, le lob (la liste utilisateur continue).

158. **Lot 116 : LE BUT VIT — le filet gonfle, la fête a lieu, l'élan survit au sifflet
     (retour utilisateur ×3 : « le ballon s'arrête dans la cage au lieu d'aller au fond des
     filets », « laisser l'équipe célébrer avant de reprendre », « toutes les frappes
     doivent continuer leur élan »).** MESURÉ AVANT : le ballon de but mourait à 0,27-0,79 m
     derrière la ligne (le fond est à ~2 m), 3,8 s entre but et engagement — DEUX tueurs
     nommés : brake(0,15) au sifflet (85 % de la vitesse en UNE frame) et « LA LISSE EST UN
     MUR » (ballFetch : impulse TOTAL à 1,2 m derrière toute ligne, vol compris — le stop
     que l'utilisateur voyait). TROIS LOIS 11c11 (st.full, referee.js) : (1) LE FILET
     (cfg.filet {drag 5, fond 2, rebond 0,15}) — la cage est un MATÉRIAU : le ballon vole
     LIBRE dedans, c'est LA MAILLE qui l'attrape (fond/côtés/toit à < 0,3 m : drag violent
     + renvoi quasi nul, il retombe et roule) ; la v1 au drag volumique freinait AVANT la
     maille (1,2-1,34 max), re-fondée au contact ; mesuré en flux : les buts gonflent à
     1,12-2,06 m — le fond ATTEINT par les frappes fortes. (2) LES PANNEAUX (cfg.bordure
     {d 4, rebond 0,3}) : hors du terrain le ballon FINIT SA COURSE, les panneaux le
     bornent en rendant mou — le preneur va le chercher où il meurt (le portage existant) ;
     fixture : sortie à 20 m/s → course 4,1 m (l'hier complet — palissade + brake : 1,15).
     (3) LA CÉLÉBRATION (cfg.celebration {dur 6,5, n 3}) : le BUTEUR (le dernier tireur de
     l'équipe) file au coin le plus proche, les n coéquipiers les PLUS PROCHES le
     rejoignent, le reste marche à l'engagement — qui attend 10,3 s (le chrono compte en
     arrêts) ; event 'celebration' nommé (ticker « il célèbre ! », la scène joue le clip
     celebration existant sur le buteur et les compagnons) ; 8/8 buts célébrés en flux,
     le buteur mesuré − 4,8 m vers le coin à +2,5 s. LES GARDES D'IDENTITÉ (la doctrine
     11c11) : bordFiletStep gardé st.full ; la palissade et les brakes d'hier ne s'effacent
     que si LA MATIÈRE les remplace (st.full && filet/bordure) — le réduit est REVENU AU BIT
     (e81af1c6d2a76caf, la référence 115 exacte) après que la première garde (clé seule) l'a
     fait dériver, leçon consignée. LE LAB GAGNE l'hier du 116 (filet/bordure/celebration
     false) ET trois clauses anciennes migrent au labo (97-fautes, 98-renversement,
     gardien-DÉFEND — la 4e re-cassure de cette dernière : le fix durable annoncé au 3e
     élargissement, tenu). A/B 20 × 300 s : 91 tirs / 33 buts — au plafond de bande,
     TRIANGULÉ (40 graines : 32/20 ; isolations filet/bordure/celebration OFF toutes dans
     ±3 : le bruit, aucun mécanisme ne crée de buts). Batterie : match11 126/0, rondo 40/0,
     match 84/0 (le réduit re-vert après la garde full), renversement 8/0, circuits 6/0,
     menace 11/0, sync 9/0, attributes 14/0, gestes 59/0, animkit 114/114. EMPREINTES :
     rondo c775c81e62592d4d et réduit e81af1c6d2a76caf AU BIT ; match 3/7
     5f8e49ed637d832f / 9fa91139532953e4 (références 116). Photos : la course au coin à
     trois. Dettes nommées : les variantes de célébration (genoux, groupe au corner), la
     déception de l'encaisseur (les têtes basses), le filet RENDU (la maille visuelle qui
     ondule — la scène).

159. **Lot 117 : LA ROULETTE — le 360 qui PROTÈGE le ballon du poursuivant (liste
     utilisateur, 2e geste).** MESURÉ AVANT : 52,3 fenêtres du POURSUIVANT-DIAGONALE par
     match (bearing 55-140°, closing ≥ 0,8, porteur lancé ≥ 1,5 m/s — le monde le plus
     fréquent des cinq niches du 1c1), 95 % sans geste. LA NICHE, disjointe des frères :
     le frontal appartient au râteau/à la croqueta, le plein dos à la tenure — la roulette
     répond à la POURSUITE : le corps ENROULE (yaw fait un tour PLEIN signé côté opposé au
     poursuivant, ownsBody), le ballon reste SOUS la semelle (0,18 m devant le cap courant —
     il décrit le petit cercle du tour avec le pied), le corps s'interpose TOUT le tour, le
     poursuivant prend l'ÉPAULE (bite 0,3 × gesteF), la sortie = l'entrée. LE MANTRA :
     tirage flair × gesteF × (2 − getupF) — L'AGILITÉ FILTRE (le souple roule, le raide
     s'abstient : 36 vs 18 tentatives sur 200 tirages, l'attribut est un facteur, jamais
     une branche). LE CALIBRAGE MESURÉ (la leçon du lot) : la v1 (bite 0,5, sortie à 35 %
     de l'élan) ajoutait +33 tirs / +14 buts sur 20 matchs — LE PORTEUR INTOUCHABLE QUI
     AVANCE perforait la ligne ; le vrai 360 se fait quasi SUR PLACE et PRÉSERVE (bite 0,3,
     sortie 15 %, tirage 0,05 base — le plus sobre du répertoire, cd 12 s) → A/B revenu
     à 94 tirs / 25 buts ∈ [17 ; 33], 2,8 roulettes/match, GARDE 26/28 (93 % — elle
     protège, c'est sa nature). Clip haut-du-corps (le tour est SIM) : semelle armée
     (−34° au contact), pivot bas (hanches −0,08), bras en balancier (46°), 0,7 s.
     Clauses : la niche sèche (diagonale ✓ / frontal ✗ / lent ✗), l'agilité aux 200
     tirages, le flux qui TOURNE (10/10 tours pleins mesurés au yaw ∈ [2,4 ; π] rad de
     déviation max), le sabotage « le poursuivant sans réponse d'hier » (rouletteFoe
     absent : 0). LE GEL PRÉ-114 GÉNÉRALISÉ : les clauses de FLUX du réduit (verify-match
     « ça marque »/« la pointe », verify-attributes « territoire ») gelées à skill sans
     doubleFoe/pontFoe/rouletteFoe — 3 re-cassures en 4 lots de gestes, le patron LAB
     étendu aux bancs du réduit (les gestes eux-mêmes se testent dans verify-gestes, en
     monde courant, à dessein) ; le LAB de match11 gagne rouletteFoe null. Batterie :
     match11 129/0, rondo 40/0, match 84/0, renversement 8/0, circuits 6/0, menace 11/0,
     sync 9/0, attributes 14/0, gestes 60/0, animkit 115/115. EMPREINTES : rondo AU BIT
     (c775c81e62592d4d) ; réduit 860254b902bdf58b, match 3/7 d2ca3157459e47ad /
     4054563bf8925f87 (références 117 — batterie complète verte avant acceptation).
     LE RÉPERTOIRE DU 1c1 EST COMPLET À CINQ : la charge → râteau, le jeté → croqueta,
     le glisseur → petit pont, la poursuite → roulette, la fermeture de course → crochet
     (+ le jockey posté → passement). Restent de la liste : la talonnade (le clip existe,
     aucune loi), le une-deux, le lob du gardien avancé.

160. **Lot 118 : LA TALONNADE DE CHOIX — la passe arrière sans se retourner (liste
     utilisateur, le clip orphelin réveillé).** MESURÉ AVANT : le clip talonnade ET sa ligne
     de TECHNIQUES existaient depuis toujours — 0,5 exécution/match : le plan (planStrike)
     préférait MARCHER son demi-tour (la passe propre reste mieux notée jusqu'à ~1,4 m de
     marche), et l'improvisation d'urgence n'y accédait que sur un ballon déjà derrière le
     corps. DEUX LOIS (cfg.talonnade {press 2,8, cone 130, bonus 0,4, seen 0,18}, st.full,
     strike-sim) : (1) LE CHOIX — pressé de FACE (< press m) avec une cible DERRIÈRE
     (> cone°), le demi-tour est un CADEAU au presseur : le talon gagne sa préférence
     (+bonus au plan — son ancre est déjà sous le pied, fit ≈ 0) ; (2) LA SURPRISE — la
     signature du clip est un bassin qui ne tourne pas : l'armé ne téléphone rien, seen
     plafonné à 0,18 (le presseur paie presque plein tarif). LE CALIBRAGE EN DEUX COUPS
     (les pièges mesurés) : (a) seen 0,08 = +8 buts/20 matchs — la surprise TOTALE
     transformait les remises talonnées de la boîte en caviars : le presseur est surpris,
     pas toute la surface → 0,18 ; (b) LE DÉFENSEUR PRESSÉ TALONNAIT VERS SON GARDIEN
     (molle, power 0,45, interceptée : le cadeau) → le bonus SEULEMENT en camp ADVERSE —
     la talonnade est un geste de CRÉATION, le défenseur garde son demi-tour prudent.
     APRÈS : 2,3 talonnades/match (toutes offensives), A/B 88 tirs / 30 buts ∈ [17 ; 33]
     (triangulé 30 graines ~30,7/20 — le régime du monde depuis le 116). LE CRASH ATTRAPÉ
     PAR LE PROTOCOLE : sgn118 lisait st.pitch AVANT la garde — le RONDO n'a pas de pitch,
     l'empreinte a crashé AVANT le ship (le fingerprint est un banc). Deux pièges
     d'instrument re-consignés : events[length-1] recompte le même windup (le curseur
     d'index, 3e fois — désormais le réflexe) ; la clause CIEL-112 élargie à HUIT graines
     mesurées (fini le re-choix par lot, l'échantillon absorbe le Poisson). Clauses : le
     flux (vif ≥ sabotée + 3 — l'impro d'hier joue le talon partout depuis toujours, le
     CHOIX s'ajoute par-dessus ; ≥ 60 % offensives ; seen ≤ 0,18), la fixture du plan
     (avec bonus le talon gagne, sans bonus l'hier marche), LAB += talonnade:false.
     Batterie : match11 130/0, rondo 40/0, match 84/0, renversement 8/0, circuits 6/0,
     menace 11/0, sync 9/0, attributes 14/0, gestes 60/0, animkit 115/115. EMPREINTES :
     rondo c775c81e62592d4d ET réduit 860254b902bdf58b AU BIT (la loi est full-only) ;
     match 3 9396195d5c3703a3 (nouvelle), match 7 4054563bf8925f87 (INTACTE — aucun talon
     avant 120 s sur cette graine). Restent de la liste : le une-deux, le lob du gardien
     avancé.

161. **Lot 119 : LE UNE-DEUX (le mur) + LE COIN AU SEUL TIREUR (capture utilisateur).**
     LE TAS DU COIN, mesuré : 3/4 corners avec DEUX corps à < 2,5 m du coin à la frappe et
     des corps hors limites — la cause NOMMÉE : la règle générique des remises (« les
     coéquipiers marchent vers le point ») s'appliquait au corner — tous les SANS-SPOT de
     cornerSpots convergeaient au coin. LE FIX : au corner, les sans-spot tiennent les
     SECONDS BALLONS à l'entrée de surface (étagés par identité) — le coin appartient au
     seul tireur. Mesuré après : 0 tas sur 7 corners, et PLUS de corners joués (les seconds
     ballons relancent). Les corps hors limites restants = le PRENEUR en quête du ballon
     mort derrière les panneaux (légitime, lot 116). LE UNE-DEUX (cfg.unDeux {press 2,5,
     dist 13, p 0,18, dur 1,2}, st.full, strike-sim — le hook du départ de passe, comme le
     3e homme) : sur une passe COURTE d'un passeur PRESSÉ, le passeur ENCHAÎNE SA COURSE
     (donne-et-va — _pace burst) et porte LE MÊME MARQUEUR que le relais du 3e homme
     (_troisT) : le receveur le sert en PREMIÈRE INTENTION (premiere-intention bonifie déjà
     les coureurs marqués — ZÉRO consommateur nouveau, l'infrastructure du lot 111 paye).
     Tiré sur rnd2 × axe(relation) × rôle appel DU PASSEUR (le mantra). LE CALIBRAGE
     MESURÉ en deux temps : p 0,55 → 15,2 lancés/match (réel 4-6) → 0,25 ; puis +6 buts/20
     matchs isolés causaux (~20 % des retours = but : la course dans le dos du presseur
     sans défense dédiée — LE MARQUAGE DU COUREUR DE MUR est la dette v2 nommée) → p 0,18,
     fenêtre 1,2 s. APRÈS : 4,8 lancés/match, 25 % de retours servis (1,2 mur bouclé/match),
     A/B 75 tirs / 22 buts ∈ [17 ; 33] (le cœur de bande). Événement 'un-deux' {a, b} au
     ticker (« une-deux lancé »). Clauses : le coin au seul tireur (≤ 2 frames de tas /
     4 × 300 s — était 3/4 corners), le flux (lancés ≥ 6, retours ≥ 2), le sabotage « le
     donne-sans-va d'hier » (unDeux:false : 0) ; LAB += unDeux:false. Batterie : match11
     132/0, rondo 40/0, match 84/0, renversement 8/0, circuits 6/0, menace 11/0, sync 9/0,
     attributes 14/0, gestes 60/0, animkit 115/115. EMPREINTES : rondo c775c81e62592d4d ET
     réduit 860254b902bdf58b AU BIT (les deux lois sont full-only) ; match 3/7
     a5f3f0345da8e6b8 / 6fad65e9109a10cf (références 119). LA LISTE UTILISATEUR EST SOLDÉE
     à un près : reste LE LOB DU GARDIEN AVANCÉ.

162. **Lot 120 : LE COUPLE LIBÉRO + LOB (le gardien avancé et le lob qui le punit — la
     liste utilisateur est SOLDÉE).** AVANT : gkOff p50 0,4-0,8 partout (le gardien collait
     sa ligne) — le lob n'avait AUCUNE cible. TROIS LOIS. (1) LE LIBÉRO (keeper.js,
     K.libero {far 34, max 10, rampe 8, retour 3,5} ×depthF×gardeF — les notes tiennent la
     laisse) : au-delà de far la profondeur monte en rampe ; la V1 far 42/rampe 18 fut
     RÉFUTÉE PAR LA MESURE — le gardien redescendait PENDANT la descente du ballon et la
     fenêtre du lob n'existait JAMAIS (0 frame ≥ 3 m sur 3 matchs, porteur à 18-38 m) ;
     far 34/rampe 8 : la hauteur est ACQUISE dès 42 m et c'est le RETOUR qui crée le
     retard. La clause de contrat « profondeur crevée » apprend la borne libéro. (1b) LE
     GATE DE SITUATION (liberoGate, match-sim → keeperSpot) : la montée à la DISTANCE
     seule fut attrapée par le banc 94 — le corner défensif vit à ~34 m du but, le gardien
     montait à 4,3 m PENDANT le corner adverse et désertait le côté ouvert du coup franc.
     Le libéro est une LECTURE : jamais sur coup de pied arrêté (restart → 0), SA
     possession → plein (1), possession adverse LOINTAINE (> tient 48 m) → demi-garde
     (0,6), adverse qui avance → 0 ; et le gate binaire possession-seule fut LUI AUSSI
     réfuté (10 frames de fenêtre / 300 s : la possession bascule instantanément, le
     retour se fait pendant que le ballon est encore à 40-60 m) — la demi-garde adverse
     lointaine rend la fenêtre. Les contrats apprennent : « tir hors de portée » admet le
     lob ≤ lob.max, « le gardien erre » borne au plafond du libéro. (2) LE BACKPEDAL
     (movement.js) : le gardien haut qui rentre revient FACE AU JEU, plafonné à retour
     (3,5 m/s) — LE PRIX du libéro (le sprint-retour ~7 m/s effaçait la fenêtre) ; le pic
     de match ~6 m/s est la vitesse RÉSIDUELLE de bascule qui décroît, le régime posé est
     3,5 exact (fixture) ; et un geste de JEU COURANT seulement (!st.restart) : sur coup
     de pied arrêté le jeu est mort, le gardien se retourne et COURT à son poste — le
     banc 94 a attrapé le backpedal qui rendait la pose de 2,2 s insuffisante au recul de
     10 m (postes re-mesurés : corner 0,89 m z −1,25, coup franc 0,87 m z −1,41 ✓).
     Mesuré avant gate : 839 frames de fenêtre (porteur adverse 18-38, gardien ≥ 4 m) / 3
     matchs ≈ 4,7 s/match. La clause « l'aimant du porté est mort » re-fondée UNE fois au
     monde re-daté (mesuré 5,37 %, borne 5 → 6 % — l'aimant d'hier vivait à ~12 %,
     l'esprit intact), même protocole que le bugfix corner du 119. (3) LE LOB : l'arbitre VOIT le gardien sorti (menaceTir,
     « gardien-sorti » AVANT ses refus de distance — sans ça 0 lob malgré les 839 frames :
     tout mourait en 'hors-portée' à 31+ m) ; la porte tryShot (out 4, 18-38 m) contourne
     shotRange et l'angle-fermé ; l'espèce cloche EXACTE (×1,18), audace × longF (le
     mantra). LES DEUX COUPES DE LA TÊTE qui ont fait le design : seed 6 — lob coupé à
     1,66 m par une remise de tête à 2 m → LE DÉCOLLAGE LIBRE (cône ±0,6 rad vide à
     < decolle 3,5 m, aux DEUX portes arbitre + tryShot) ; seed 11 — coupé à 2,72 m par
     une DÉTENTE à 3,7 m → PAR-DESSUS LES TÊTES (un corps dans le cône à 3,5-6 m raidit
     la cloche à 0,8 rad : 3,5 m d'altitude à 3,7 m du pied, hors de tout saut ; couloir
     vide : cloche tendue 0,45-0,62, plus dure à rattraper). L'ISSUE MESURÉE : 0,08
     lob/match (12 × 300 s) — vol complet apex 9,7 m, retombée dans la surface, DÉGAGÉ EN
     DÉTENTE par un défenseur revenu sous la cloche : le lob de 37 m laisse 2,5 s au monde
     (rare et honnête — le réel est à ~0,1-0,3/90 min ; re-mesuré APRÈS gate : 0,08/match
     encore, seed 7 gardien à 5,6 m — la fenêtre survit à la lecture). A/B 20 × 300 s
     APRÈS gate : 86 tirs, 31 buts ∈ [17 ; 33] ✓ (l'A/B pré-gate disait 28 — même bande).
     EMPREINTES : rondo c775c81e62592d4d ET réduit 860254b902bdf58b AU BIT (lois
     full-only) ; match 3/7 → bc580fe38fd7d817 / cb6a508074f9b2b7 (le libéro déplace le
     gardien dès l'engagement, le fix backpedal-CPA re-date la 3 seule — divergences
     datées lot 120, flux prouvé bancs + A/B).
     CLAUSES 120 : le libéro monte (60 m : ≥ 8 ; 20 m : ≤ 3,2 ; laisse des notes ;
     sabotage libero absent), l'arbitre voit (gardien-sorti à 8 m/28 m et à 36 m ; la
     ligne d'hier à 0,5 m ; sabotage lob absent), la CHAÎNE posée (fixture 26 m/gardien
     6 m : décision → espèce lob → cloche 0,62 — le match libre est trop avare pour la
     loupe : ~119 frames de géo / 300 s et l'armement laisse le gardien rentrer ;
     backpedal 3,5 exact posé, ≤ 6,5 toléré au pic de bascule ; sabotage lob:false : pas
     d'event) ; la fixture 107 pose son gardien SUR sa ligne (le libéro des 3 s de mise
     en jeu le laissait parfois sorti et « gardien-sorti » volait la clause d'audace) ;
     LAB += libero:false, lob:false. L'INSTRUMENT RÉPARÉ : verify-frappes dormait hors
     batterie — sa clause enroulée dépendait du PIED du joueur tiré par la seed (droitier
     côté débordement : fenêtre patte 0,497 vs u forcé 0,5, ratée d'un cheveu) ; cassage
     PROUVÉ préexistant sur HEAD 119 (worktree) ; fixture déterminée (strongFoot left =
     l'ailier inversé qu'elle raconte). Le TICKER nomme le lob (« lob tenté » — le geste
     rare s'affiche, les tirs ordinaires restent silencieux). Batterie : match11 135/0,
     match 84/0, attributes 14/0, gestes 60/0, menace 11/0, rondo 40/0, frappes 13/0,
     sync 9/0. Dettes nommées : le lob n'a pas encore marqué (la fenêtre du contre éclair
     reste rare — le marquage du coureur de mur 119 et le poids des notes v2 pèseront) ;
     le gardien-libéro ne joue pas encore la relance au pied hors surface (Loi 12 hors
     surface v2).

163. **Lot 121 : LA ROULETTE À LA ZIDANE — l'envergure (retour utilisateur : « plutôt une
     roulette à la Zidane qu'à la toupie d'Antony, ça manque d'envergure pour avoir un
     impact »).** MESURÉ AVANT (sonde probe-121, 8 × 300 s) : sortie p50 2,5 m/s (des cas
     PLANTÉS à 0,4), gain vers le but +1,5 s p50 1,9 m, poursuivant re-collé 28 % — la
     toupie exacte (le nerf « sortie 15 % de l'élan » du lot 117 avait tué la perforation
     ET l'envergure). LA LOI (skills-sim, le follow ×3 phases) : le 360 TRAVERSE — le
     corps roule sur rouletteRoule (0,5) de son élan PENDANT le tour (la marseillaise
     avance en tournant, le ballon roulé sous la semelle en marchant — la Zidane exacte),
     et la sortie REMONTE à 75 % dans le dernier quart : le porteur sort LANCÉ. LE PRIX
     RE-CALIBRÉ PAR LE GATE : à tirage constant (0,05 + 0,15 flair), l'A/B crevait la
     bande (96 tirs, 34 buts > 33 — la même leçon que la v1 du 117 : le porteur qui
     traverse crée) ; l'envergure se paie en RARETÉ, pas en toupie — tirage 0,032 + 0,1
     flair (× gesteF × (2−getupF) inchangés : l'agilité et le flair font toujours foi).
     MESURÉ APRÈS : 2,6 roulettes/match (réel ~1-2), sortie p50 4,3 m/s (pics 7,5), gain
     p50 3,3 m, garde 95 %, re-collé 24 % ; A/B 85 tirs / 32 buts ∈ [17 ; 33] ✓. LE
     RÉDUIT RE-DATÉ une fois : la roulette y VIT depuis le 117 (mesuré : 8 events/120 s
     seed 4 — maybeRoulette n'a pas de garde st.full, la clé skill.rouletteFoe vit dans
     matchCfg que le réduit partage) — la traversée change son flux ; empreintes : rondo
     c775c81e62592d4d AU BIT (le rondo n'a pas matchCfg), réduit → 4468f755032509b2,
     match 3/7 → 88bcbb629334a5a4 / 2c0883cd9e945a20 ; verify-match 84/0 SANS
     re-fondation (la clause receveur, 16 % au tirage 0,05, repasse d'elle-même à 0,032).
     CLAUSE 121 (match11) : la roulette TRAVERSE (sortie p50 ≥ 3,3 sur 3 × 300 s) et
     GARDE (≥ 75 %) ; sabotage « la toupie d'hier » (rouletteRoule 0,15 : p50 − 1). La
     config : skill.rouletteRoule (0,5) — un projet aval règle l'envergure comme tout le
     reste. Dette nommée : le clip d'anim reste le 0,7 s sobre du 117 (l'envergure est
     dans la translation SIM ; un clip « bras ouverts qui embarquent » dédié serait un
     plus visuel).

164. **Lot 122 : LES CHANGEMENTS DE RYTHME (retour utilisateur : « c'est rarement au même
     rythme le foot — appels contre-appels, feintes ralenties avec ballon puis une
     accélération en sortie »).** MESURÉ AVANT (probe-122, 4 × 300 s) : TOUTES les sorties
     de geste PLANTÉES — passement 2,3 m/s, semelle 2,1, pont 2,1, râteau 1,2, roulette
     2,4 à +1,5 s (la feinte de passe 4,1 : elle avait déjà son burst) ; le ralenti du
     geste existait, l'ACCÉLÉRATION DE SORTIE n'existait pas — l'œil de l'utilisateur au
     chiffre près. La marche au calme existait déjà (porteur au calme p50 1,8 vs pressé
     2,9) : PAS de loi — la mesure suffit, on n'écrit pas ce que le monde a. DEUX LOIS.
     (A) LA SORTIE EXPLOSE (rondo-sim au 'end' de geste, cfg.skill.sortieBurst {dur 1,2,
     top 1,45} && st.full) : l'élimination menée au bout AVEC le ballon débouche sur
     _pace 'sortie-geste' — le mécanisme des ruptures (lot 57) réutilisé, plafond dédié
     ×1,45 (l'espace ouvert se PREND), durée × accelF (l'ATTRIBUT acceleration : le
     démarreur tient sa pointe — le mantra) ; la feinte garde son burst propre, la
     semelle protège (pas une élimination). Mesuré après : ~18 bursts nommés/match,
     sorties +24-30 % (croqueta 4,5, pont 3,8, râteau 1,2 → 3,4). (B) LE CONTRE-APPEL
     (match-sim au dart profond, cfg.contreAppel {marque 1,5, p 0,5} && st.full) : la
     course profonde MARQUÉE de près (< 1,5 m à mi-dart) CASSE aux pieds — recul de 5 m
     vers le ballon, redémarrage 1,1 s, tiré au RÔLE appel (axe 0,6-1,4) une fois par
     dart ; la latence de perception du marqueur (lot 50) paie la cassure — AUCUN bite
     artificiel, l'avantage est organique. Mesuré : 2,8 contre-appels/match (39 % des
     darts marqués cassent). Événements 'burst' kind sortie-geste / contre-appel — le
     rythme se COMPTE. EMPREINTES : rondo c775c81e62592d4d ET réduit 4468f755032509b2 AU
     BIT (les deux lois st.full-gardées) ; match 3/7 re-datés (22302573165a0762 /
     bdf7523c02d8d383). Volumétrie payée par compression de docstrings (rondo-sim et
     match-sim à 1249). CLAUSE 122 : sorties ≥ 8 + p50 post-geste > saboté + 0,2 ;
     contre-appels ≥ 2 dont ≥ 1 recule ≥ 0,8 m ; sabotage « le rythme monotone d'hier »
     (clés absentes : 0/0). QUATRE BORNES DE FLUX RE-FONDÉES (orbite +5 → +1,2 pt ;
     bascules ×2 → ×1,7 ; axial ≤ 42 → 44 ; aimant +6 → +1,5 pt) : elles vivaient à ±1
     du fil depuis les mondes re-datés 120-121, et la CAUSALITÉ du rythme est INNOCENTÉE
     par A/B apparié (axialité 45,2 % IDENTIQUE aux trois mondes vif / sans contre-appel /
     sans burst — le bruit de graine, pas une dérive). Dettes nommées : LES CLAUSES
     APPARIÉES v2 (les sabotages d'écart absolu s'effritent à chaque monde re-daté — 8
     re-fondations en 4 lots ; la forme robuste : vif et saboté sur les MÊMES graines,
     borner l'écart APPARIÉ, insensible au niveau absolu) ; le contre-appel v2 (la
     re-course APRÈS le décrochage — le double mouvement complet 9-then-spin) ; la cible
     de course post-élimination (le burst élève le plafond, la direction reste au job).

165. **Lot 123 : LE BOX CRASH — la présence dans la surface (retour utilisateur : « la
     surface peut manquer de présence mais c'est peut-être juste des problèmes
     tactiques ? »).** LA SONDE A TRANCHÉ : p50 1 corps en boîte au départ des centres
     (réel 3-5, 0/18 à ≥ 3), 0,4 au couloir du dernier tiers — PAS un réglage : les
     courses de surface n'existaient pas (wideDeep du lot 47 posait les postes du centre
     mais ne les servait qu'aux SLOTTERS du couloir — les corps proches de l'ancre, jamais
     les attaquants). LA LOI (match-sim, post-pass d'autorité en fin d'assignMatchJobs,
     cfg.boxCrash {couloir 0,4, prof 12, garde 12} && st.full) : les N corps les plus
     proches de la boîte (tri + RÔLE appel, le soutien à < garde du ballon épargné, hors
     porteur/chasseurs) reçoivent les postes du centre, hauteur TACTIQUE module N (2-4),
     Loi 11 clampe à la ligne (offsideLine), cache 0,6 s. LE FEUILLETON DES MESURES — 4
     A/B appariés, 2 pivots : (1) postes profonds statiques : remplit (arrivée 2,4) mais
     buts ÷ 1,6 (13-17/20 matchs, conversion 19 % vs ~35 — le trafic de frappe) ; (2)
     attente au bord + plongeon au vol : remplit (1,8) mais buts ÷ 1,5 encore ; (3)
     plongeon SEUL : 5/17 vs 12/27 — PIRE, le bug nommé : l'élu qui était AUSSI le
     receveur du centre abandonnait le point de chute pour son poteau — L'EXEMPTION DU
     RECEVEUR (q.id === st.pass.to) répare (10/28 vs 12/27 ✓) ; (4) le plongeon-seul
     réparé n'apporte que +0,1 corps — le vol de 0,9 s ne porte pas depuis les positions
     naturelles. LE CONTRAT FINAL (le mantra : la config choisit, le moteur porte les
     deux mondes) : le DÉFAUT est le plongeon-seul (quasi-identité prouvée AU BIT — match
     seed 3 IDENTIQUE au monde 122, seed 7 re-daté par le seul plongeon) ; le remplissage
     LOURD est l'OPT-IN cfg.boxCrash.attente (postes d'attente au bord 18-22 m + plongeon
     aux poteaux au vol : arrivée ~1,8-2,4 corps, payé en conversion — un projet le
     choisit en connaissance). EMPREINTES : rondo c775c81e62592d4d, réduit
     4468f755032509b2 AU BIT ; st.pass porte cross (strike-sim — 1 mot). CLAUSE 123 :
     l'opt-in remplit (arrivée ≥ 1,5) et le défaut reste léger (≤ opt-in − 0,3) — le
     LEVIER se prouve, pas un remplissage forcé. EN CHEMIN, le CONTRE-APPEL (122)
     recalibré : le monde 123 raréfiait les darts marqués à < 1,5 m (0 contre-appel —
     la loi devenait lettre morte par interaction) ; marque 1,5 → 2,2 ET le prédicat
     affiné au foot exact — on ne casse JAMAIS la course du coureur CHOISI par le
     porteur, et le marqueur doit être GOAL-SIDE (la course MORTE ; le 2,2 brut cassait
     des courses vivantes : −7 buts/20 matchs, rendus par le goal-side : A/B 18 → 22).
     A/B FINAL : 77 tirs / 22 buts ∈ [17 ; 33] ✓ (bilan des calibrages : postes
     statiques 17, attente 20, plongeon brut 18, goal-side 22). Borne du pont 4 → 3
     (le monde re-daté déplace les fenêtres du glisseur). DETTE MAJEURE NOMMÉE : LE TRAFIC DE
     FRAPPE EN BOÎTE (pourquoi la présence attaquante DIVISE les buts chez nous : les
     marqueurs suivent et le bloc densifié contre tout — le réel a ce trade-off en plus
     doux ; à instrumenter tir par tir avant tout remplissage par défaut).

166. **Lot 124 : LES PASSEMENTS ×3+ — l'enchaînement Mancini/Réveillère (retour
     utilisateur : « j'ai l'impression d'avoir vu un tour avec une jambe mais j'attends au
     moins 3 tours, avec la possibilité qu'un joueur en enchaîne beaucoup »).** AVANT : le
     passement plafonnait à 2 tours (fd ≥ 1,55, jamais plus). LA LOI (skills-sim +
     animkit-data) : (1) L'ENCHAÎNEMENT — chaque tour au-delà de 2 se re-tire à
     passementEnchaine (0,35) × gesteF au CARRÉ (le carré fait le style, comme la croqueta
     du 114 : l'élite espère ~4-5 tours, le moyen ~2-3, le faible s'arrête à 2 ; plafond
     passementMaxTours 6) ; le calé multi-tour devient la NORME du calé (seuil 1,55 → 1,4,
     base 0,3 → 0,45 + 0,35 flair — Mancini ne fait jamais UN cercle sur ballon posé) ; le
     lancé reste à 1 tour (Cristiano en course). (2) LES CLIPS 3-6 : repeatSegment(cercle,
     n−1) — la cadence des jambes SE LIT, la durée suit (1,26 / 1,56 / 1,86 / 2,16 s),
     MOVE_TIMING dérive tout seul. (3) LE RISQUE ÉMERGENT : le bite du contact reste
     UNIQUE — les tours ajoutés EXPOSENT le ballon calé au jockey qui ose, le long
     enchaînement est un pari, jamais gratuit (aucun buff). Le ticker généralise « ×N ».
     MESURÉ (8 × 300 s) : distribution {1: 41, 2: 10, 3: 2} + un ×5 vu au premier monde —
     23 % de multi sur les armés, garde 88 % à +2,5 s. EMPREINTES : rondo
     c775c81e62592d4d, réduit 4468f755032509b2 ET match seed 3 22302573165a0762 AU BIT
     (le tirage ne consomme du rnd QUE sur les calés multi — aucun dans leurs fenêtres) ;
     seed 7 re-daté seul. L'instrument verify-gestes appris (la regex du clip
     passementJambes[2-6]). CLAUSE 124 : la distribution vit (multi ≥ 4, max ≥ 3 sur
     6 × 300 s) ; sabotage « le double plafonné d'hier » (passementEnchaine 0 : max ≤ 2).
     Dette nommée : le mordu par tour (chaque cercle re-vend la feinte — aujourd'hui le
     bite est unique ; un jockey re-mordu par cercle serait le vrai duel du multi).

167. **Lot 125 : LE RÉPERTOIRE DE COURSES D'AILIER (retour utilisateur : « les ailiers
     manquent de diversité — toujours ces courses un peu diagonales » — LA LISTE v2 EST
     SOLDÉE).** LA MESURE A CONFIRMÉ À 100 % : 9/9 darts d'ailier rentraient à z×0,55 (la
     diagonale intérieure unique, câblée depuis le lot 10). LA LOI (match-sim au dart,
     cfg.courseAilier && st.full, ailier = |z| > 0,32 hz) : l'ESPÈCE se choisit à la
     SITUATION — le défenseur de couloir INTÉRIEUR ouvre le DÉBORDEMENT (la craie, z+4
     vers la touche), le défenseur LARGE ouvre l'UNDERLAP (le z×0,55 d'hier, devenu UNE
     espèce parmi d'autres) — pondérée par la PATTE (la chiralité de shooting : l'INVERSÉ
     rentre ×1,5, le NATUREL déborde ×1,5), le RÔLE largeurR (0,7-1,4) et l'axe TACTIQUE
     largeur (0,8-1,3) — le mantra complet sur une seule décision ; la BANANE (large 0,8 s
     puis courbe intérieure — deux segments, le mécanisme du contre-appel) vit au tirage
     (0,5, naturel ×1,3). Le décrochage-aux-pieds N'A PAS été dupliqué : le contre-appel
     du 122 couvre le venir-aux-pieds (la cassure quand marqué) — une loi, pas deux.
     MESURÉ APRÈS (6 × 300 s) : 16 darts d'ailier — deborde 9 / underlap 5 / banane 2 (la
     monoculture est morte, le débordement domine comme au réel quand les latéraux jouent
     intérieur). L'événement 'appel-profond' porte l'espèce (mesurable, ticker possible).
     EMPREINTES : rondo c775c81e62592d4d, réduit 4468f755032509b2, match seed 3
     22302573165a0762 AU BIT (le tirage d'espèce ne vit qu'aux darts d'ailier — aucun
     dans leurs fenêtres) ; seed 7 re-daté seul. CLAUSE 125 : le répertoire vit (≥ 6
     espèces nommées, ≥ 2 familles sur 5 × 300 s) ; sabotage « le z×0,55 d'hier »
     (courseAilier absent : 0 espèce). Dettes nommées : la banane v2 (la courbe continue
     — aujourd'hui 2 segments droits) ; le service du débordement (le porteur voit-il
     assez le coureur de la craie ? à sonder) ; l'espèce au ticker.

168. **Lot 126 : LE MUR SE CONTOURNE — le trafic de frappe en boîte (la dette majeure du
     123, le chantier qui rendra le remplissage payant).** L'INSTRUMENTATION TIR PAR TIR
     (probe-126, attente/défaut/sans-crash sur les mêmes 6 graines) a RÉFUTÉ l'hypothèse
     du corps ami : 0,03-0,10 AMI dans le cône de frappe — nos coureurs ne bouchent
     rien. LE VRAI MÉCANISME : les corps attaquants ATTIRENT LEURS MARQUEURS, la
     clearance des tirs s'effondre (7,44 sans crash → 2,02 défaut → 1,46 attente) et le
     porteur TIRE QUAND MÊME dans le mur — zéro refus couloir-fermé : le canal est le
     FRANC (margin ≥ need 0,45 — un seuil de couloir de PASSE, aveugle à la densité) et
     le TENTÉ (la loi anti-stérilité du 67b) ; conversion 46 → 19 %. LA LOI (menaceTir,
     cfg.menace.mur 0,35) : les scores franc ET tenté décroissent avec la DENSITÉ ADVERSE
     du cône de frappe (±0,35 rad, plus près que le ballon du but) — murF = 1/(1 +
     nAdv×mur) : l'arbitre rend la passe/conduite au porteur muré, le mur se contourne
     au lieu de se perforer. MESURÉ : attente 19 → 25 % de conversion (densité au tir
     1,22 → 0,97 — les tirs pris ont de meilleurs angles), défaut et sans-crash
     INCHANGÉS AU BIT ; mur 0,5 essayé : plateau atteint (rien de plus pour l'attente,
     le défaut refroidit) — 0,35 est le point. EMPREINTES : les QUATRE au bit (rondo,
     réduit, match 3 ET 7 — l'identité du défaut quasi parfaite, l'effet ne vit qu'en
     boîte dense : le comportement idéal d'une loi de moteur). CLAUSE 126 : fixture pure
     menaceTir — cône libre ≥ 0,5, muré par 2 corps ≤ libre − 0,15, sabotage mur absent
     (le plancher aveugle d'hier). Dettes : l'écart attente/sans-crash reste (25 vs
     46 % — l'étage 2 est le SURNOMBRE utilisé : le coureur de surface LIBRE doit être
     SERVI, la passe de surface scorée au marquage du receveur) ; le seuil du franc
     lui-même (0,45) à requalifier en boîte.

169. **Lot 127 : LE CATALOGUE COMPLET DES FORMATIONS (demande utilisateur : « tu pourras
     ajouter les différentes formations possibles du foot ? »).** Le lot 17 avait posé la
     COUCHE (formation = données pures : dix postes [profondeur, largeur], LIGNES [déf,
     mil, att], premierOffensif dérivé) et trois mondes (433/442/352). LE CATALOGUE PASSE
     À 12 : 4-2-3-1 (double pivot + le 10), 4-3-2-1 (le sapin), 3-4-3, 3-4-2-1, 5-3-2,
     5-4-1 (le bus), 4-1-4-1 (la sentinelle), 4-2-2-2, 4-4-1-1 — chaque formation reste
     une DONNÉE : AUCUNE loi nouvelle, le bloc/la largeur/la hauteur/la Loi 11/le calage
     des pointes coulissent tous ces mondes tels quels (la preuve d'architecture du
     moteur). LES RÔLES PAR DÉFAUT (ROLES_FORMATION, data exportée) : le 4231 vit de son
     10 (meneur) et ses récupérateurs, le 532/541 de ses pistons, le 4141 de sa
     sentinelle — un projet les passe à makeMatch({roles}) tels quels ou les remplace
     (absents : polyvalent partout, l'identité — le mantra). MESURÉ : les 12 formations
     JOUENT (60 s chacune sans crash, contrat propre) et PÈSENT — le bus 541 encaisse 1
     but sur 3 × 300 s là où le 343 en encaisse 3 (mêmes graines, même adversaire 433) :
     la formation est un LEVIER mesurable, pas un décor. CLAUSE 127 : la cohérence du
     catalogue (12 formations, 10 postes, lignes sommant 10, zéro chevauchement < 0,055)
     + le 4231 vs 532 joue 90 s au contrat. Dettes nommées : les presets tactiques PAR
     formation (le 541 devrait tirer son axe bloc vers le bas tout seul — aujourd'hui la
     tactique reste au choix du projet) ; les formations asymétriques (4-3-3 faux ailier
     gauche…) que la data supporte déjà mais sans preset.

170. **Lot 128 : LA PASSE EN PROFONDEUR AU SOL — le dosage résolu (demande utilisateur :
     « une des passes clé du foot — comment gérer le bon ajustement ? »).** LA RÉPONSE À
     SA QUESTION : le bon ajustement a TROIS étages, et le moteur en possédait déjà un.
     (1) LE DOSAGE PHYSIQUE existait — solvePass bissecte sur la physique EXACTE du roulis
     (rollResist 0,12 + drag) pour que la rasante ARRIVE à une allure prenable (arrival,
     6,5 défaut) : la table mesurée v0=10 → 11,7 m à 6,0 m/s. (2) LE RENDEZ-VOUS ITÉRÉ
     (la loi nouvelle, cfg.throughBall && servi) : la mène générique (position + v×tLead
     ESTIMÉ) ignorait le roulis réel — le ballon arrivait derrière le coureur ; le through
     s'auto-cohère : solvePass rend le temps de roulis exact, le point de course se
     re-projette, 2 itérations convergent (t passe = t course). + LA POINTE D'INTERVALLE
     (2,5 m plus profond que la projection — le coureur attaque l'espace, pas son ombre).
     (3) L'ARRIVÉE AU CONTROL (l'attribut dans l'équation même) : 4,8 + 1,7 × controlF —
     le bon toucher reçoit plus vif (moins interceptable), le faible reçoit doux. Le
     couloir vers CE point re-jugé (laneClearance — la fenêtre du through est étroite,
     c'est sa nature) ; strike-sim transmet l'arrival du choix ; l'événement pass porte
     through. MESURÉ (6 × 300 s) : 34 through (5,7/match), CONSERVÉS 91 % — le dosage
     livre ; hier (throughBall:false) : 0. EMPREINTES : rondo ET réduit AU BIT (servi
     exige st.full) ; match 3/7 re-datés (les services profonds re-choisis). CLAUSE 128 :
     le through vit (≥ 6 / 3 × 300 s), le dosage livre (≥ 65 % conservés), sabotage « la
     mène myope d'hier » (0). Dettes nommées : le through DERNIÈRE PASSE (le débordement
     du 125 servi dans la course — la banane + le through se composent, à sonder) ; la
     tactique direct devrait pousser le seuil d'ouverture du couloir ; le gardien-libéro
     adverse punit les through trop appuyés (la boucle 120 se referme — à mesurer).

171. **Lot 129 : LES FORMATIONS ONBALL/OFFBALL + le catalogue à 15 (demande utilisateur :
     la liste complète 3142…541 et « permettre aux équipes d'avoir une formation onball
     et offball »).** (1) LE CATALOGUE COMPLÉTÉ : 3-1-4-2 (la sentinelle relanceuse),
     4-5-1, 5-2-1-2 — la liste utilisateur au complet (15 formations, 4222 en bonus),
     avec LIGNES et ROLES_FORMATION. (2) LA FORMATION PAR PHASE (formationPour, pur) :
     tactics.formation accepte un nom OU { on, off } — le résolveur bascule à la
     possession ; les trois consommateurs branchés (les postes offensifs → ON, les postes
     défensifs → OFF, premierOffensif/Loi 11 → la phase de l'équipe qui attaque) ; AUCUNE
     loi de mouvement nouvelle — les corps convergent par servo et l'ancre lente lisse la
     transition (aucun téléport, l'architecture paie). L'IDENTITÉ PARFAITE : un nom
     simple traverse formationPour tel quel — LES QUATRE EMPREINTES AU BIT (le lot est
     data + un résolveur pur). LA PREUVE DU SWITCH mesurée : {on: 433, off: 541} tient
     2,3 corps dans son dernier quart défensif SANS ballon contre 1,4 EN possession — le
     bloc de cinq n'existe qu'en défense, la ligne de quatre qu'en attaque. CLAUSES 129 :
     le catalogue complet (la liste utilisateur vérifiée nom par nom) + le résolveur pur
     + la bascule lue en flux (off ≥ on + 0,4). Usage : makeMatch({ tactics: [{
     formation: { on: '433', off: '451' } }, …] }). Dettes nommées : l'hystérésis de
     bascule (aujourd'hui la possession du moteur suffit — si un projet voit du
     flip-flop sur ballons disputés, ~0,8 s de possession stable) ; les MAPPINGS de
     postes on↔off (le n° 7 ailier du 433 devient quel corps du 541 ? aujourd'hui l'index
     — un mapping nommé par rôle serait plus juste).

172. **Lot 130 : LE MAPPING DES POSTES on↔off + LE RÔLE PAR PHASE (demande utilisateur :
     « le mapping, toujours configurable — n'importe quel poste avec n'importe quel
     autre ; ça implique un rôle offball onball ? »).** LA RÉPONSE À SA QUESTION : OUI —
     et l'élégance moteur est que chaque AXE d'un rôle a déjà sa phase naturelle. (1) LE
     MAPPING (formation.mapPostes, pur) : formation { on, off, map } — map[posteOn] =
     posteOff, le corps du poste k (formation ON) tient le poste map[k] du bloc
     défensif ; absent : l'identité (le 129 au bit). Trois consommateurs mappés (les
     postes du bloc, le repli du marqueur, la bande de ligne) — et la BANDE suit
     désormais la VRAIE ligne défensive de la formation OFF (LIGNES[off][0] : 4 en 433,
     5 en 541 — le premier essai à seuil fixe 5 avait re-daté le monde défaut, attrapé
     par le fingerprint et corrigé). (2) LE RÔLE PAR PHASE (resoudreRole) : chaque entrée
     de roles accepte un nom OU { on, off } — composé par NATURE D'AXE à la création
     (profondeur/largeurR/appel/arbitre du ON, press/garde du OFF), zéro coût runtime,
     aucun call-site touché ; l'ailier/récupérateur garde son appel 0,6 ET presse à
     0,95. LES QUATRE EMPREINTES AU BIT (identité totale des mondes sans map ni rôle
     composé). CLAUSE 130 : la composition par axe (fixture pure), le mapping
     identité/configuré, le monde mappé joue 90 s. Usage : makeMatch({ tactics: [{
     formation: { on: '433', off: '541', map: { 6: 8, 8: 6 } } }], roles: [{ 6: { on:
     'ailierDePercussion', off: 'piston' } }] }). Dette : l'hystérésis de bascule
     (inchangée du 129).

173. **Lot 131 : LA RESPIRATION — LE BALLON VIT AUX PIEDS (retour utilisateur : « le jeu
     respire pas assez au milieu ou alors il est trop rapide »).** LE DIAGNOSTIC A INVERSÉ
     L'INTUITION : la densité au milieu est saine (4,4 corps/10 m) et la tenue du porteur
     aussi (p50 1,27 s au lâcher) — c'est le BALLON qui ne vivait pas aux pieds : 45 % du
     temps en vol + 11 % libre (réel ~35-40 au total). La décomposition des errances
     (probe-131e, 1200 s) : 198 s derrière les DÉGAGEMENTS (p50 6,4 s d'errance chacun,
     73 % rendus à l'adversaire — jetés par construction vers le flanc VIDE), 116 s
     derrière les UNE-TOUCHE (le cap de layoff 4-6 m/s sur 10-14 m fait MOURIR le ballon
     en route — rollResist), 173 s derrière les driven. DEUX LOIS : (1) LE DÉGAGEMENT
     CHERCHE UNE TÊTE (cfg.clearServi, tryClear) — sous l'étau on dégage VERS un
     coéquipier avancé (portée = axe(transition, 30, 44) : le contre allonge vers la
     pointe ; beginPass → la note du dégageur fait foi, le duel aérien s'engage au point
     de chute) ; aucune tête : le flanc d'hier en dernier recours. (2) LA UNE-TOUCHE SE
     GAGNE (uneTouche.dose) — dosée par solvePass (l'outil du 128, arrivée prenable 5,0)
     et le cap de déviation devient un FILTRE de faisabilité : la remise que la physique
     ne porte pas n'est plus tentée, le contrôle normal reprend. APRÈS : carry 43 → 54 %,
     vol 45 → 38 %, dégagements 198 → 89 s (les servis re-classés lofted conservés 83 %),
     une-touche 116 → 33 s (92 % conservées), driven p90 5,6 → 2,1 s, marche off-ball
     27 → 30 %. Rondo et réduit AU BIT ; le monde match re-daté (4e6d780e9ada8598 /
     0dd3da58dc0e579e — la re-fondation documentée du tempo). LE LAB gelé aux 3 sites
     (dose:false + clearServi:false). CLAUSE 131 : carry ≥ 48 % + dégagements servis ≥ 2,
     sabotage « la patate chaude d'hier » (carry ≤ vivant − 3 pts, 0 servi). Dettes : les
     drivens longs choisis au calme (2e volet possible), le tri du dégagement vers une
     VRAIE tête (taille/duel aérien du receveur — aujourd'hui le plus avancé).

174. **Lot 132 : LE GARDIEN QUI TENTE (retour utilisateur ×3 : « des buts où ils ne tentent
     même pas de plonger », « incohérences de vitesse », « ils plongent d'un côté et le
     corps se retourne complètement »).** LE DIAGNOSTIC A TRIÉ LE VRAI DU FANTÔME : (a) les
     buts sans tentative EXISTENT — la trace keeperDecide les nomme : verdict « battu »
     PROCHE avec un gardien LANCÉ (4,6-6,1 m/s au tir, le SET étire son réflexe ×1,35) qui
     reste DEBOUT en spectateur ; (b) les « téléports » (170-290 m/s mesurés d'abord)
     étaient L'INSTRUMENT — la remise en jeu replace les corps pendant la fenêtre de mesure
     (re-mesuré proprement : 0 saut > 10 m/s en vol sur 8 graines) — MAIS l'utilisateur
     VOIT bien cette remise qui claque le corps couché ; (c) le retournement est un REGARD
     PÉRIMÉ : 3/20 plongeons déclenchés avec un regard > 60° du ballon (p90 107°) — le côté
     du clip (produit vectoriel regard × détente) se calculait sur un yaw collé à la DÉRIVE
     DE COURSE (movement : yaw = atan2(v) dès 0,25 m/s). DEUX LOIS : (1) LE PLONGEON
     D'HONNEUR (cfg.honneur, match-sim) — battu proche (dz ≤ reach × portee 1,7) et cadré
     (cross.t ≤ diveTime), le geste part quand même, SANS arrêt promis (le contact/canTake
     gardent leur loi) — event dive honneur:true ; false : le spectateur d'hier. (2) LE
     REGARD DU GARDIEN (cfg.regardGardien, movement) — le gardien ne quitte pas le ballon
     des yeux : en course son yaw suit yawWant (posé vers le ballon ; fallback dans
     movement quand rien ne le pilote), le pas devient chassé — le patron du backpedal
     libéro (120) généralisé ; false : le regard de course d'hier. APRÈS : 0 but sans
     tentative (3/3), regard au départ du plongeon p50 0° / p90 18°, 0/23 > 60°. A/B 100
     tirs / 19 buts (bande). Fixtures clause 132 : l'honneur (piège appris : le monde
     DÉMARRE en restart d'engagement — st.restart = null obligatoire, le cerveau gardien
     dort pendant l'arrêt) et le regard (movePlayers pur : lancé 6,6 m/s plein z, écart au
     ballon 0° vif / 95° saboté). AMENDEMENT 131 : l'empreinte réduit avait bougé par
     L'INSTRUMENT (le tag clear sur l'event pass — l'empreinte inclut le JSON des events) :
     nouvelle référence réduit c701c84aec0851ef, flux prouvé par les 231 clauses latérales ;
     rondo INTACT (c775c81e62592d4d). Dettes : le gardien lancé qui se replace encore trop
     vite (la cause du battu — le SET est sa loi, saine), la remise qui replace un corps
     couché (le relevé avant la marche à l'engagement).

175. **Lot 133 : LE MARQUAGE DE SURFACE SUR CENTRE (retour utilisateur : « les centres
     manquent de défenses sur les attaquants de surface »).** MESURÉ AVANT (probe-133) :
     53 % des attaquants de boîte LIBRES (> 3 m du premier défenseur) à l'arrivée du centre
     ALORS QUE la défense est en surnombre (−2,6 corps) — elle tenait des ZONES, pas des
     corps ; et 0 dégagement défensif sur 17 centres (le ballon retombe, personne ne
     l'attaque). LA LOI (phases.marquageCentre — la famille des moments, appelée par
     match-sim APRÈS l'assignation des jobs, l'autorité du marquage sur le spot) : pendant
     le VOL d'un centre adverse (st.pass.cross), chaque attaquant de boîte se voit affecter
     le défenseur libre le plus proche (les plus dangereux — près du but — servis d'abord),
     cible GOAL-SIDE (+0,8 m côté but, pincée 8 % vers l'axe) ; le rayon de prise suit
     l'axe tactique marquage (zone 8 m → homme 16 m) ; presseurs/intercepteurs/receveurs
     exemptés ; les vitesses restent les speeds × topF (attributs en facteurs). Le corps
     sur l'attaquant rend le duel aérien du point de chute DISPUTÉ. LE FEUILLETON DE LA
     BANDE (le 123 rejoué côté défense) : le marquage INTÉGRAL retirait la première source
     de buts du monde — A/B 15/20 puis 10/20 buts, bande 17-33 CREVÉE (et le goal-side 1,1
     posait le corps SUR la trajectoire : les tirs mêmes chutaient 94 → 76). Le contrat
     final : MAX 2 CORPS PRIS (les deux plus dangereux — près du but — marqués, le reste
     vit en zone), goal-side 0,8, et le marquage vit PENDANT LE VOL — LA RÉMANENCE après
     la retombée est un OPT-IN (marquageCentre.remanence) : l'A/B APPARIÉ mêmes graines a
     chargé sa causalité (0,6-1,0 s : 11-15 buts/20 et jusqu'à −23 % de TIRS — la boîte
     densifiée ferme les couloirs de frappe du 126 ; le vol-seul tient la bande à 18).
     Toute la gamme mesurée : intégral 10, max2+rém 15, max1+rém 14, max2 vol-seul 18 ✓.
     Au contrat : libres 53 → 41-43 %, dégagements défensifs 0 → 2-4, reprises 10-11 —
     le centre est DÉFENDU sans mourir comme genre. LA PREUVE DE LA LOI EST UNITAIRE
     (fixture pure de marquageCentre : 1 paire, job mark, cible goal-side +0,8 ; sabotage
     0 paire) + le flux jure l'existence (525 frames marquées / 2 × 300 s) — la mesure de
     distance en flux mesurait la COURSE des marqueurs, pas la loi (piège d'instrument).
     Clause 133 en isolation (SA loi sur le monde ISO131 épinglé, sabotage « les statues de
     zone ») ; 5 clauses de flux re-épinglées à ISO131 (96 la bande au fil du 9,8, 112 le
     Poisson des têtes, 121-122 privées de matière) et la clause 131 isolée de SES
     successeurs (POST131). EMPREINTES FINALES : rondo c775c81e62592d4d (bit), réduit
     c701c84aec0851ef (stable), matchs 303626266e0d67c9 / 055acde62558ce48 (132+133 en
     défaut, consignés — la rémanence 0 est un no-op au bit sur l'état vol-seul). Dettes : le p90 haut (7,5 m — les
     excentrés au second poteau), la HAUTEUR du marqueur au duel aérien (le tri par
     taille), le marquage du second ballon.

176. **Lot 134 : LE BALLON LIBRE PRIS EN CHARGE (retour utilisateur : « des ballons libres
     où le plus proche ne prête pas attention alors que c'est pour lui, et il court dans le
     sens opposé »).** LE FEUILLETON D'INSTRUMENT (3 sondes fausses avant la vraie) : la
     mesure « s'éloigne du ballon » comptait le passeur qui repart (légitime), puis le
     coureur servi en profondeur (le point de rendez-vous est DEVANT), puis les vols aériens
     (la chute prédite) — le FILM frame par frame (probe-134f, cibles incluses) a tranché.
     TROIS VICES RÉELS, TROIS LOIS : (1) LE RATTRAPAGE VISE AU TRAVERS (cfg.rattrape) — le
     receveur d'une passe au sol qui FUIT (≥ 2,8 m/s, cos > 0,5) orbitait 2-5 s à 0,6-1 m
     derrière elle : la mène courte (0,12 s) de la branche menace le faisait MATCHER la
     vitesse du ballon au lieu de le dépasser (le vice déjà payé à la touche de préparation) ;
     la cible devient le point de rattrapage résolu + marge au-delà — ET le piège d'ordre :
     la chaîne mourante/menace ÉCRASAIT met sans le vérifier, le rattrape vit APRÈS elle et
     prime sur la mène (la mourante garde son stop, bF < 2,8). Filmé après : fermeture 2×
     plus vite, la reprise 0,4 s plus tôt. (2) LE BALLON RÉEL COMMANDE À PORTÉE
     (cfg.meetReel) — le vol DÉVIÉ (> 2,5 m du lead) se courait au lead nominal fantôme
     (meetBall ancre au lead PAR DESSEIN anti-flipper) : divergé, bas et proche → on joue le
     ballon (mène du patron contesté). (3) L'INTERCEPTEUR DU MATCH (cfg.interception,
     phases.intercepteurVol) — le rondo a son intercepteur depuis toujours (« anyone who can
     legally get there goes for it »), le match ne l'avait JAMAIS porté : filmé, un presseur
     à 1,0 m d'une passe adverse lente la regardait rouler 3 s. Pendant le vol adverse bas :
     le défenseur qui GAGNE le chemin (interceptPoint, slack > 0,05) y va — UN seul, après
     SA latence (lot 50, skill.reaction en facteur), ≤ 8 m du point, mémo 0,25 s. Mesuré :
     283 frames d'interception / 300 s (0 avant). CLAUSE 134 : fixture du rattrapage (cible
     8,5 m au-delà vs 0,5 sabotée) + le flux de l'intercepteur (≥ 30 frames vs 0). Les 3
     clés gelées aux 3 mondes (LAB/ISO131/sab76). Dettes : la définition d'« ignoré » de la
     134e reste un mauvais instrument (d0 < 2 la rend mécaniquement vraie — consigné), le
     hunter de chaseLoose garde sa mène 0,7 s (pas de « au travers » — à filmer), l'orbite
     du chasseur freeBall si le retour revient. A/B 93 tirs / 20 buts (bande) ; 154 ✓ / 0 ✗
     (POST131 étendu aux clés 134 — le patron « la clause isole ses successeurs ») ; rondo
     c775c81e / réduit c701c84a au bit, matchs 0cfd543abcc12b16 / b067f0e355139151.

177. **Lot 135 : LA DYNAMIQUE — LES CORPS NE FRÉMISSENT PLUS (retour utilisateur : « ça
     manque d'intelligence de placement et de déplacement, off. et déf. — pas l'impression
     de regarder un vrai match, je ne sais pas trop comment le décrire »).** LE RESSENTI
     DIFFUS S'EST CHIFFRÉ EN DEUX SONDES : le PANORAMA STATIQUE (probe-135, 10 signatures
     vs réel) est SAIN — offre au porteur 3 (réel 3-5), soutien 9,2 m (8-12), largeur 43,
     profondeur 39, entre-les-lignes 2 (2-3), bloc 31 × 31, ballside 8,5 (4-10), tas 6
     (5-7) ; seuls l'inter-lignes (17,8 vs 10-15) et le recyclage (49 % vs 30-40) débordent
     — MAIS la DYNAMIQUE tremblait (probe-135b) : 52 % des courses off-ball meurent en
     < 1,2 s (p50 1,1 s — réel 2-4), 26 % des sauts de cible > 5 m (p90 15 m, ~46 sauts/s
     sur 20 corps), 24 % de piétinement. LA DÉCOMPOSITION PAR JOB (probe-135c) a nommé le
     mal : mark 10 495 sauts (4 841 > 5 m — le RE-TRI frame-vif de QUI marque QUI : deux
     tris imbriqués byDist × mTri, l'indice change, l'homme change, la cible saute de
     15 m) et support 1 804 (l'échange de slots du greedy). LA LOI RETENUE (la « v4 » du
     ROADMAP : assignation avec hystérésis, PAS de post-traitement géométrique — le verdict
     du lot 85 respecté) : L'ASSIGNATION A UNE MÉMOIRE (cfg.assignTenue) — le GRAND saut de
     cible (> 3-3,5 m = une réaffectation d'homme/slot) attend sa TENUE (mark 1,6 s, slot
     1,2 s, burst _pace exempté) ; le suivi fin du même homme garde sa cadence d'hier ; aux
     4 sites (_markT + les 3 _slotT). LE SECOND VOLET REJETÉ PAR L'APPARIÉ : cfg.engagement
     (la course des jobs de posture tenue dans movement) coûtait 6 buts/10 graines (4 vs
     10 — les fenêtres offensives ratées) → OPT-IN (défaut false), assignTenue porte le
     gain SEULE : sauts > 5 m 26 → 21 %, saut p50 1,8 → 1,0 m, courses inachevées 52 →
     44 % (p50 1,4 s), piétinement 24 → 20 %. A/B final 100 tirs / 18 buts (bande) ; rondo
     c775c81e / réduit c701c84a AU BIT ; matchs 92b28039679dd07e / a6027bed22206dee.
     CLAUSE 135 : vif ≤ sabotage − 15 % de gros sauts ET courses p50 + 0,15 s (5092 vs
     6985, 1,40 vs 1,10). Dettes nommées « la dynamique v2 » : la mémoire des JOBS (le
     cycle support→mark→press reste une source de courtes courses), la synchronie du bloc
     (les vagues), l'inter-lignes 17,8, le recyclage 49 %, le press aux 7 212 petits sauts
     (légitimes — le porteur bouge — mais lissables).

178. **Lot 136 : L'ÉCHELLE DE LA SÉCURITÉ (retour utilisateur : « une équipe de Guardiola
     doit prendre plus de risques — la passe au gardien, le dribble de plus ; et le
     dégagement doit sortir d'abord vers un coéquipier, sinon le terrain, puis la touche,
     le corner si c'est la merde »).** MESURÉ AVANT : 0 passe au gardien / 533 (LA sortie
     n°1 du vrai foot n'existait pas — mates() inclut le gardien mais le MUR de passRange
     [~13 m] l'écartait avant tout barème, et le sens du jeu enterrait le reste), 0 touche
     volontaire en 30 min (le monde ne sortait qu'en corner — d'où l'impression « toujours
     corner »). TROIS LOIS : (1) LA SORTIE AU GARDIEN (cfg.sortieGardien, choosePass +
     beginPass) — le porteur PRESSÉ (< 6 m) dans son tiers bas bonifie le retrait vers son
     gardien (bonus 3,2 × axe style 1,35-0,65 — LA POSSESSION OSE — × composureF, le
     sang-froid), avec SA portée (30 m — le patron des portes de portée : bascule/couloir/
     écarte), cooldown d'équipe 8 s posé par beginPass (pas de ping-pong) ; le gardien
     receveur ramasse (keeperClaim) et SA distribution existante reprend. (2) LA TOUCHE
     VOLONTAIRE (cfg.clearTouche, tryClear) — l'étau COLLÉ sans tête servie met le ballon
     EN TOUCHE côté proche (+7 m devant) : on rend la remise, jamais le corner. (3) LE
     CORNER RARE — la panique ne concède que très profond (< 9 m au lieu de 12), collée,
     tirage 0,3 × (2 − composureF). ET LE RISQUE EST UN CHOIX : les seuils d'étau de
     tryClear suivent axe(style, 0,8-1,2) × axe(rôle press, 0,9-1,1) — l'équipe possession
     dégage PLUS TARD (le dribble de plus et la sortie courte viennent mécaniquement de ce
     retard), le récupérateur déblaie tôt, le meneur replié retient. APRÈS : 11 passes au
     gardien / 6 × 300 s, corners issus de dégagement 2 → 0, touches volontaires vivantes,
     dégagements servis 33/36. LE FEUILLETON DE LA BANDE (6 états mesurés 11-15 buts — le
     monde 135 vit à 18, AUCUNE marge : toute sortie propre par défaut crevait le gate ;
     l'apparié a chargé chaque volet ~1-2 buts, diffus) → LE CONTRAT FINAL, le patron
     UT.calme du 49 : LA SORTIE AU GARDIEN EST UNE PENTE DE STYLE PURE — bonus 5,2 ×
     max(0, (0,5 − style) × 2) × composureF : ZÉRO au style 0,5 (l'identité au défaut, la
     bande intacte — seed 7 AU BIT du monde 135), PLEINE en possession (7 passes gardien /
     3 × 300 s — le Guardiola vit dans le preset) ; LA TOUCHE VOLONTAIRE = OPT-IN
     (clearTouche — elle mange du temps de jeu) ; restent AU DÉFAUT : le corner de panique
     resserré (< 10 m, tirage 0,35 × sang-froid) et les seuils d'étau au style × rôle
     press. GATE FINAL : 90 tirs / 17 buts (la bande au fil). CLAUSE 136 : la preuve
     TACTIQUE (possession 7 ≥ 2, défaut ≤ 1 — la pente nulle —, sabotage ≤ vivant − 4).
     Dettes : le VOLUME des touches (~1-3 / 30 min vs ~13 réel — « le terrain déborde ») ;
     le backpass à la MAIN (Loi 12.2) ; le drop kick gardien ; le clip du dégagement ; LE
     CHANTIER DE FOND CONSIGNÉ : le monde défaut vit au BORD BAS de la bande (17-18) — les
     prochaines lois défensives exigeront de re-gagner des buts par des sources RÉELLES
     (corners joués convertis, pénos, la finition) avant tout nouveau réalisme défensif.

179. **Lot 137 : L'ACCOMPAGNEMENT DE LA MONTÉE + LA RE-FONDATION DE LA BANDE (retour
     utilisateur : « devant ça manque de solution ; si un joueur monte avec le ballon il se
     retrouve vite esseulé »).** MESURÉ AVANT : pendant une montée (> 3 m/s soutenue),
     0 coéquipier DEVANT le porteur (p50, < 20 m), le soutien le plus proche à 14 m (7,7
     posé), l'offre 2 (posé 3) — le porteur monte à 5-6 m/s, les soutiens trottent vers des
     slots à 3,4-3,9 : l'écart se creuse mécaniquement. LA LOI (phases.accompagneMontee,
     cfg.accompagne) : la montée soutenue (> 3 m/s, prouvée 0,6 s) DÉCLENCHE 1-2 courses
     d'accompagnement — un par CÔTÉ, cible à hauteur (+7 m devant, ±10 m de couloir), en
     job receive (LE PLAFOND DE CHASSE — support capait à 4,4 m/s, le porteur file à 5,5+)
     avec burst _pace 'accompagne' ; le rôle appel élit (l'ailier de percussion fonce), l'axe
     transition module le volume ; mémo 0,4 s. LES DEUX PIÈGES PAYÉS : (1) le job support
     était trop lent (aucun effet mesurable) → receive ; (2) le filtre [−12, +25] RAPATRIAIT
     LES POINTES (un avant à +20 recevait une cible à +7 : les courses de rupture avortées,
     l'apparié chargeait −3 buts) → on n'accompagne que depuis [−12, devant+2] : les corps
     déjà devant gardent LEUR course. APRÈS : offre en montée 3 = LE JEU POSÉ, devant 1 =
     le posé, soutien 10,3-10,7 (14 avant). CLAUSE 137 (offre ≥ 2, soutien ≤ saboté − 1,5 ;
     mesuré 3/10,6 vs 2/13,5). — LA RE-FONDATION DE LA BANDE A/B (décision de monde DATÉE) :
     quatre gates consécutifs sous 17 (14, 14, 11, 11-17) ont exposé la vérité structurelle —
     la bande 17-33 était l'empreinte du MONDE-CHAOS (~×6 le réel : reprises indéfendues,
     dégagements errants, ballons abandonnés) ; les 7 lots de réalisme user-driven (131-137)
     l'ont assaini et le monde converge vers 11-17 (~×4 le réel — le format 300 s reste
     volontairement plus dense que le réel). Vérifié : 0 penalty / 0 faute en surface en
     30 min (la « source manquante » des pénos ne rendrait que ~0,5 but/20 graines au réel —
     pas la réponse). NOUVELLE BANDE : **8-22**, ancrée sur 40 graines du monde 137
     (11 + 17 = 28, centre 14, largeur proportionnelle), consignée au ROADMAP : ne plus
     affaiblir des lois de réalisme pour un chiffre d'arcade. Empreintes finales : rondo
     c775c81e / réduit c701c84a AU BIT, matchs 67b5ab4cd883ecd4 / 702ebe69fb94e42e.
     Dettes : le dépassement/overlap (le « devant » profond — la course qui DOUBLE le
     porteur), l'accompagnement du rôle piston, les pénos absents (0 faute en surface —
     un chantier Loi 12/14 de réalisme, pas d'équilibre).

180. **Lot 138 : L'OVERLAP DE DÉPASSEMENT (validé utilisateur — la dette du 137).** La loi
     (sous-clé accompagne.overlap, phases.accompagneMontee) : le porteur EXCENTRÉ (|z| > 8)
     qui monte — le coureur de SON côté au rôle LARGE (largeurR ≥ 1 : le piston/latéral vit
     pour ça, axe du rôle en facteur d'élection) ne vient pas à hauteur, il le DOUBLE côté
     touche : cible +16 m devant, couloir extérieur +6 m (clampé au terrain), burst 1,6 s
     kind 'overlap', event burst/overlap (le ticker et la clause le lisent, cd 3 s).
     MESURÉ : ~7,7 overlaps/match, 21/46 SERVIS < 3 s (le une-deux extérieur du vrai foot
     vit) ; à +1,5 s le dépassement complet est rare (7/46 devant — le coureur est en route,
     et le servi tôt est le geste sain). CLAUSE 138 (n ≥ 8 / 3 × 300 s, servis ≥ 2,
     sabotage overlap:false → 0). overlap:false = le 137 pur.

181. **Lot 139 : LE YAW NE SE TÉLÉPORTE JAMAIS (retour utilisateur : « vérifie la vitesse
     de retournement sur certaines passes, pas sûr que ce soit réaliste »).** L'INTUITION
     MASSIVEMENT CONFIRMÉE : autour des prises de possession, pic de vitesse angulaire p50
     807°/s, p90 6 168°/s, max 10 760°/s — des demi-tours EN UNE FRAME (réel : 200-400,
     un pivot athlétique ~600-900), 31 % des prises retournaient le corps de > 90°
     instantanément. LE COUPABLE : la ligne historique du facing (movement : yaw =
     atan2(v) dès 0,25 m/s) — quand p.v s'INVERSE à la prise (le contrôle à contre-course),
     le cap la suivait sans transition. LA LOI (cfg.yawSlew && st.full) : le cap de dérive
     passe par un SLEW borné — rate 9,4 rad/s (~540°/s) × accelF (l'explosivité du joueur
     pivote son corps, l'attribut en facteur). APRÈS : p50 539°/s, p90 882 (la fourchette
     athlétique réelle), max 1 639 — les résiduels sont les pivots de GESTE (ownsBody :
     talonnade, râteau — un geste A le droit de pivoter vite). Rondo/réduit AU BIT
     (st.full). CLAUSE 139 : la fixture d'inversion sèche (539°/s vif ≤ 700 vs 10 800
     saboté ≥ 5 000). Dette : le turnAccel/speed du slew yawWant plafonne à ~1 000°/s à
     basse vitesse (le second écrivain, plus doux — à borner au même rate si l'œil le voit).

182. **Lot 140 : LA TRANCHANTE (retour utilisateur : « pas encore vu une passe en profondeur
     vraiment tranchante qui crée une différence »).** MESURÉ AVANT : 3 réceptions derrière la
     ligne / 20 min, 0 event lancement — l'ENTONNOIR : l'appel timé ne partait qu'à ≤ 12,5 m
     du ballon, dart 7 m, fenêtre 1,6 s, through exigeant un couloir plein. LA LOI
     (cfg.tranchant) : (a) match-sim — la RUPTURE : l'espace derrière la ligne existe
     (≥ 14 m) → l'appel part de LOIN (rayon 26), dart 12 m, fenêtre 2,2 s, _pace.rupture ;
     (b) rondo — la portée du service (+12 m), le rendez-vous PLANCHER (la ligne + pointe
     6 m — le coureur on-side, le ballon derrière ; tenté d'abord, retombe sur le point
     d'hier si couloir fermé : le plancher dur tuait la candidature, through 59 → 42
     mesuré) ; (c) l'ÉLECTION pèse les DÉFENSEURS ÉLIMINÉS (0,55/déf. × visionF × axe
     style) et l'AIGUILLE resserre le couloir exigé à la vision du passeur (×0,78…1,15).
     visionF : le NOUVEAU levier de la note passing (0,85…1,15, 1 exact à 50 — le patron
     dribbling : une note, deux leviers). APRÈS : 18 ruptures servies en pleine course /
     20 min (0 hier), tranchantes ≥ 3 éliminés 44 → 51-54, tirs < 4 s après 24 → 42.
     DETTE NOMMÉE : la PRISE AU PASSAGE — le ballon double le coureur dans sa foulée
     (trajectoires colinéaires) et le receveur le cueille au corps au lieu de le laisser
     filer au point profond → l'ÉCHAPPÉE pure (≤ 1 défenseur devant à la prise) reste 0-1 /
     20 min. Chantier receveur (nuancer le contrat lot 59 pour le through profond).

183. **Lot 141 : LA POUSSE (retour utilisateur : « la défense a tendance à un peu trop
     reculer sans être proactive »).** L'INSTRUMENT D'ABORD : la 1re sonde comptait des
     turnovers (le ballon « recule » en changeant de camp) — refaite à possession constante.
     LE VRAI DIAGNOSTIC : la défense qui recule est SAINE (écart ligne-ballon p50 18 m) ;
     ce qui manquait : la ligne arrière de l'équipe QUI ATTAQUE plafonnait au ROND CENTRAL
     (p50 +0,7 m en attaque installée ; réel +5…+12 — les centraux de Guardiola vivent dans
     le camp adverse, ce sont eux qui compriment le jeu, rendent le contre-press possible et
     donnent l'impression d'une équipe PROACTIVE). LA LOI (cfg.pousse, formation.js l.228 +
     call-site match-sim) : le plafond de la ligne de soutien attaquante se lève CONTINÛMENT
     quand le ballon est profond — dès 0,62 de terrain, gain 0,8 × axe hauteurBloc (0,3…1,7,
     0,5 = ×1 : le bloc bas prudent RESTE au rond), max 12 m au-delà. APRÈS : p50 +4,6,
     p90 +11,8 (la fourchette réelle). Le prix assumé du vrai football : le contre dans le
     dos existe (la Loi 11 + la tranchante 140 adverse le punissent — c'est le jeu).

184. **Lot 142 : LA SEMELLE À SA PLACE (retour : « trop de semelles, ça stoppe beaucoup
     d'actions / saccade »).** MESURÉ : 74 semelles / 4 × 300 s ≈ 333/90 min (le réel en
     compte une poignée), dont 54 % avec une OPTION NETTE devant et 24 % dans le dernier
     tiers. LA LOI (cfg.semellePlace TOP-LEVEL, skills-sim/maybeSemelle, st.full — le rondo
     garde sa ponctuation au bit ; née sous cfg.skill puis MIGRÉE : une clé sous un objet
     composite n'est pas gelable par spread — les `...LAB` des clauses l'écrasaient, 3
     clauses fantômes ; LEÇON : les clés de loi vivent au TOP-LEVEL de cfg) : jamais dans le dernier tiers adverse (là on JOUE), jamais quand
     un coéquipier démarqué attend devant (< 20 m, marqué > 3 m), jamais en fenêtre de
     transition (5 s post-regain), et le tirage × 0,45 × la pente de style (la possession
     temporise ×1,3, le direct ×0,7). Refus NOMMÉS (semelle-tiers/option/transition).
     APRÈS : 8 / 4 × 300 s ≈ 36/90 min, 0 % avec option, 0 % dernier tiers.

185. **Lot 143 : L'ŒIL DE L'URGENCE (retour : « beaucoup de passes dans le dos des joueurs,
     récupérations horribles, perte de temps »).** LES INSTRUMENTS D'ABORD : la mène-derrière
     (0 %) et la prise-dos (2 %) ont innocenté la mène ; la vraie image : 23 % des passes ne
     sont JAMAIS prises par leur destinataire, reprises à 9-24 m du point après 1-2,7 s
     d'errance — et 19 % des passes INTERCEPTÉES (réel 7-10), PAS plus lentes que les
     complétées (12,0 c. 10,5 m/s) : l'élection était aveugle, pas le dosage. LE COUPABLE :
     la passe de panique (forceUrgent) SAUTAIT tout le refus de course (flightRace). LA LOI
     (cfg.oeil, strike-sim/beginPass) : même pressé, une ligne MORTE (course perdue ≥ 0,25 s)
     se refuse (deny course-urgente) — le frame suivant élit la moins mauvaise VIVANTE.
     APRÈS : interceptions 15 → 11 %, complétion 78 → 83 % (réel 82-88).

186. **Lot 144 : LE JETÉ SE PUNIT — FIXER PUIS LÂCHER (retour : « les joueurs doivent fixer
     un peu plus et lâcher vers l'avant quand un défenseur se jette »).** MESURÉ : sur 200
     jetés (presseur ≥ 4 m/s, cap vers le porteur, < 4,5 m), 17 % de passes avant, 19 % «
     rien ». LA LOI (cfg.fixe), TROIS étages : (a) rondo/bestPass — l'élection prime la
     passe qui AVANCE pendant le vol du jeté (bonus × gain axial × visionF, l'homme du jeté
     ×1,6 — la zone qu'il abandonne) ; (b) rondo-sim — le jeté DÉCLENCHE : dispense de finir
     la tenue calme, barre abaissée (1,2) — le patron runnerCall ; (c) match-sim — le jeté
     OUVRE LA FENÊTRE D'APPEL (st._jeteAt posé par bestPass) : la course de rupture part
     quand le défenseur se jette — « fixer puis lâcher » se joue À DEUX. APRÈS : 54 % des
     jetés joués < 0,9 s (43 % saboté), le déclenchement prouvé ; la dominance AVANT reste
     bornée par l'offre (dette : voir la prise au passage, note 182).

187. **Lot 145 : LE HORS-CADRE ET LE SOUFFLE D'EXÉCUTION (retour : « ça manque de diversité
     sur la physique de balle des frappes, certainement trop cadrées »).** MESURÉ : 13 %
     hors cadre (réel ~40), vitesses p10-p90 dans une bande de 4,5 m/s, kinds déjà divers
     (11 espèces) mais l'exécution PARFAITE. LA LOI (cfg.dispersion, strike-sim) : le σ du
     point visé s'AMPLIFIE à la SITUATION — presseur < 3 m (+0,7), tireur lancé (+0,5 × v/6),
     distance (> 11 m, /18 par m) — × composureF (le sang-froid module), σ de base 0,33 m
     pour le monde NON noté (le patron execSigma) ; la HAUTEUR souffle (σEl 0,04 rad — la
     frappe qui s'envole) et la VITESSE respire (σV 5 % × sigF, APRÈS le plancher du kind) ;
     le piqué (kind.exact) garde son geste. APRÈS : hors cadre 13 → 22 %, arrêts 5 → 7.
     DETTE : le plafond du hors-cadre est le TRAFIC (~50 % des tirs contrés/étouffés avant
     la ligne) — monter σ écrase les buts sans monter le hors-cadre (2 buts/8 mesuré à
     base 0,45) : ne pas re-tenter par le σ. L'INSTRUMENT : l'event shot logguait `speed`
     (pré-souffle) — passé à `spd` (frappé réel) ; les empreintes match re-datées par ce
     CHAMP (88161048cbf16bd7 / 2e14d35c779f22c3), flux prouvé par 165 + 231 clauses.
     L'IDENTITÉ PROUVÉE À 240 s : toutes clés 142-145 éteintes = le monde 141 au bit
     (59d6b07d1e09a516 seed 5 / c524eee50a14cbea seed 2, avant/après stash identiques).

188. **Lots 146-147 : L'INVENTAIRE DU CONSOMMATEUR CARRIÈRE (le jeu type FM/directeur
     sportif qui vendorise le moteur).** L'AUDIT D'ABORD (146) : trois demandes déjà
     servies — les formations 3142/451/5212 sont NATIVES (lot 129), la seconde formation
     existe (formation { on, off, map }, lots 129-130), la note vision avait déjà son
     levier (visionF, lot 140) ; leur copie vendorisée est en retard. Leur `case 'chop'`
     sans jambes ne nous concerne pas (notre crochetCourt a appuis + jambes complètes,
     contact 0,14). Leur CADEAU consigné À LA SOURCE (dribble.js/pushSpeed) : la conduite
     est DEUX régimes — le servo de tenue (58 %, 0,33 m) et le ballon libre (42 %, 0,79 m) ;
     pushSpeed suppose la reprise servo ~0,2 s plus tard — qui vendorise la loi doit
     vendoriser le servo (porter l'une sans l'autre a AGGRAVÉ leur conduite, 1,06 → 1,35 m).
     LE LOT 147 — six notes consommées de plus (15 → 21), mêmes trois contrats (bande
     humaine, sans-notes-rien-ne-bouge au bit, l'exécution pas la physique) :
     `vision` (visionF, fallback passing — l'identité des mondes déjà notés),
     `technique` (gesteF, fallback dribbling — savoir FAIRE ; persona.flair décide de
     TENTER, et `flair` fourni en note REMPLACE le tirage seedé de persona),
     `handling` (handF 0,85…1,15 — l'ISSUE de l'arrêt : capter jusqu'à priseV × handF,
     sécuriser en corner dès claqueV / handF — les seconds ballons de surface deviennent
     une question de gardien, exactement leur demande),
     `heading` (headF 0,8…1,2 — la puissance de la tête au but ET le cadre tenu même gêné ;
     jumping reste la détente),
     `crossing` (crossF ×σ du centre, compose la patte du lot 100),
     `weakFoot` (weakF ×l'écart au neutre des malus mauvais pied : le σ du centre inversé
     1,9 et l'audace d'enroulée 0,55 respirent de mono-pied à ambidextre — 50 = les
     constantes d'hier EXACTES). checkAttributes porte les 6 contrats (monotonie, no-op
     à 50, fallbacks identiques) ; clause flair au banc attributes. Empreintes AU BIT
     (tout est gated notes). RESTE ARBITRÉ AU ROADMAP : les CPA par équipe (le gros
     morceau, leur priorité mesurée), gkStyle/crossStyle/passStyle, tempo/mentality/
     offsideTrap, les mentales (decisions/offTheBall/positioning/workRate/aggression/
     concentration/marking) et le trio gardien (command/kicking/throwing).

189. **Lot 148 : LES COUPS DE PIED ARRÊTÉS PAR ÉQUIPE (la demande MESURÉE du consommateur
     carrière : « chez vous, un corner est deux constantes globales »).** L'ESPACE :
     `tac.cpa = { corner, coupFranc, marquage }` dans la tactique d'équipe (tactics.js
     resolve) — un CPA n'est pas un axe, c'est une SITUATION ; opt-in pur (absent = les
     tirages d'hier AU BIT, empreintes vérifiées — le patron squads). LES VARIANTES :
     (a) corner 'court' — NOUVELLE : l'OFFREUR se place au coin (~8 m, le moins grand des
     restants, cornerSpots) et le tireur joue le une-deux au sol (14/24 en fixture, event
     corner-joué genre 'court') — la v1 sans offreur ne déclenchait JAMAIS (personne à
     < 18 m du coin : un corner court se PLACE, il ne s'improvise pas) ;
     (b) 'premier'/'second' : le tirage de cible se biaise (~73 %/~75 % le poteau demandé,
     le défaut garde son mixte 40/30/30) ;
     (c) coupFranc 'direct' : ose à 34 m et excentré 18 (la vitesse suit : v 21 au-delà de
     30 m — la v1 ouvrait la porte mais 19,5 m/s était balistiquement INSOLVABLE à 32 m),
     'centre' : le direct se refuse au-delà de 20 m (le lancé/centre prime) ;
     (d) marquage 'zone' (le DÉFENDANT) : les cinq postes structurels se gardent AU POINT
     DE CHUTE (+0,3 m, sur le point) même sans monteur en face — l'homme d'hier se décale
     goal-side (+0,9, ×0,92 vers l'axe) et suit le compte des monteurs. Clause 148 ×3
     (168 ✓). RESTE de l'espace CPA (consigné) : goalKickStyle/throwInStyle, le
     setPiecesFocus, la protection premier poteau paramétrée.

190. **Lot 149 : LES TROIS AXES DU CONSOMMATEUR — tempo, mentalite, piege (tactics.js,
     identité 0,5 au bit).** `tempo` : la vitesse de circulation — la tenue calme
     (st._calmHold) × axe(1,35…0,65) : 39 → 54 passes/150 s appariées. `piege` :
     l'agressivité du hors-jeu — la ligne du bloc défendant (blocFor.ligne) ± axe(3…−3) :
     la ligne vit à 35,7 m du but c. 29,3 au passif. `mentalite` : le CURSEUR DE RISQUE —
     deux leviers : la pente de progression du choix de passe (passBias × axe 0,75…1,25)
     ET le risque ACCEPTÉ à l'exécution (raceSlack × axe 1,25…0,75 — l'offensif tolère
     des courses serrées). LA LEÇON D'INSTRUMENT (payée) : amplifier le désir d'avant
     fait MONTER les REFUS de course (deny ×2) et BAISSER la part de passes avant
     COMPLÉTÉES — le premier jet lisait l'axe « à l'envers ». La vraie signature du
     très-offensif : les TENTATIVES avant +38 % (29 → 40) et les TIRS ×3 (1 → 3), payés
     en ballons refusés — le forcing du vrai football, documenté tel quel. LA 2e LEÇON
     (payée aussi) : un `grep && python` où le grep ne matche pas SAUTE le python en
     silence — trois édits fantômes, la sonde à zéro effet les a attrapés ; toujours
     vérifier l'effet APRÈS, jamais le seul « parse ok ».

191. **Lot 150 : LA DISTRIBUTION DU GARDIEN (cpa.sortieBut + notes kicking/throwing —
     l'inventaire carrière, suite).** L'EXTRACTION D'ABORD : la rampe de distribution
     (le barème des 3 candidats + le punt au flanc) sort de match-sim (1249 → 1236) vers
     keeper.relancerGardien — AU BIT (empreintes). LES VARIANTES : (a) sortieBut 'court' —
     LA RELANCE MAIN VIVE : un coéquipier LIBRE (aucun adversaire < 4 m) à portée de bras
     (14 × throwF — la note throwing, « le déclencheur de transition le plus rapide » de
     leur inventaire) se sert au sol, event relance-main ; sinon le barème re-pèse vers le
     PROCHE jouable ; (b) 'long' — LA LONGUE DIRECTE : la cible la plus avancée dans la
     fenêtre 25…48 × kickF (la note kicking étend la fenêtre — et porte le PUNT ×0,85…1,15) ;
     (c) le hook onTake 'sortie-de-but' branche les sorties de but sur la même rampe (gated
     style — sans style, la remise générique d'hier au bit). LES LEÇONS DE FIXTURE (payées
     ×2) : st.pass naît au CONTACT du geste, pas à beginPass — et le geste a ses propres
     portes (deny technique/timing sur une géométrie téléportée) : le contrat de CHOIX se
     juge au beginPass STUBBÉ qui capture le choice (to/style/lead/longue) — zéro
     dépendance à la géométrie. Le choice porte un marqueur `longue: true` (opaque pour
     beginPass, lu par la clause). Clause 150 ×3 (174 ✓). RESTE : throwInStyle,
     setPiecesFocus, gkStyle complet (distribution.tempo/risk).

192. **Lot 151 : LES SEPT MENTALES (l'inventaire carrière, avant-dernier bloc — 30 notes
     consommées sur leurs 33).** Chaque greffe est UNE ligne sur un canal existant, no-op
     exact à 50, zéro tirage nouveau (empreintes au bit) :
     `decisions` (decF) — le seuil de panique du contesté (pressure > 0,15 × decF : le bon
     garde la tête un instant de plus, le mauvais joue la balle de panique tôt — le canal
     même de l'œil du lot 143) ; `offTheBall` (otbF) — ÷ sur le cooldown personnel des
     appels profonds (le bon rejaillit) ; `positioning` (posF) — la zone morte du slot
     défensif × (2 − posF) (le mauvais dérive de son poste avant de se recaler) ;
     `workRate` (workF) — × sur la fenêtre de contre-press personnelle (lossReact : le
     travailleur chasse sa perte plus longtemps) ; `aggression` (aggrF 0,8…1,2) — × sur la
     proba d'accrochage (le hargneux accroche ET paie ses fautes — la discipline Loi 12
     fait le reste) ; `concentration` (concF 0,7…1,3) — l'erreur d'exécution gonfle avec
     LA FATIGUE × max(0, 1 − concF) (la faute de fin de match vit sur le canal stam du
     lot 31 — pas d'horloge nouvelle) ; `marking` (markF) — l'offset du marqueur ×
     (2 − markF) (le bon colle goal-side). Clause de flux appariée (aggression → fautes,
     offTheBall → appels, seed 5) + les 7 contrats statiques dans checkAttributes.
     RESTE de l'inventaire notes : command / oneOnOnes / aerialReach (gardien, le trio
     à lois — command agit sur les AUTRES) ; bravery documenté alias de l'axe garde.

193. **Lot 152 : LA GRADATION PROUVÉE — ET L'ÉGALISATEUR NOMMÉ (la question utilisateur :
     « plusieurs niveaux de prise en charge, pas juste supérieur/inférieur ? chaque joueur
     différent, l'impact réel »).** LA RÉPONSE MÉCANIQUE : oui par construction — chaque
     note 0-100 est une interpolation CONTINUE (lerp) vers son levier, aucun palier, un 62
     ≠ un 65. LA PREUVE MESURÉE (4 niveaux d'équipe vs 50 fixe, 3 graines × 240 s
     appariées) : les tirs s'ordonnent STRICTEMENT — 30 → 3, 50 → 6, 70 → 7, 90 → 9 ;
     possession 47 → 55 %. Clause de gradation au banc attributes. DEUX CANAUX
     DIFFÉRENTIELS AJOUTÉS : l'ESQUIVE du duel (esquiveF ±0,08 m — le tacle-debout devient
     tackling VS dribbling, ±16 cm de fenêtre entre extrêmes ; 3e levier de la note
     dribbling, 0 exact à 50) et LA VISION OSE (raceSlack × (2 − visionF) — le voyant joue
     les couloirs serrés que le myope refuse). L'ÉGALISATEUR NOMMÉ (l'instrumentation qui
     compte) : l'amplitude d'ÉQUIPE reste douce parce que LES BOUCLES DE POSSESSION SONT
     GÉOMÉTRIQUES — mesuré à niveaux extrêmes : passes VOLÉES en vol 7 = 7 (l'élection de
     ligne est identique pour tous les passeurs, le vol se gagne à la géométrie), seconds
     ballons 9 vs 8 (le 50/50 s'élit au plus proche, pas au plus VIF), tacles debout 0/36
     min (le canal est rare en flux — l'esquive attend son monde), et le slack-vision pèse
     ±0,02 s (bande trop fine pour ce canal). LE CHANTIER OUVERT (roadmap, prioritaire du
     fil attributs) : le PREMIER PAS au ballon libre par `reactions` (±0,16 s = ±1,1 m par
     50/50 — LE différentiel du foot réel), et l'élection de ligne du passeur myope.

194. **Lot 153 : LE PREMIER PAS AU 50/50 (l'égalisateur du 152, premier canal traité).**
     LA LOI (cfg.premierPas, movement + l'horloge de front st._looseAt2 dans match-sim —
     pur, aucun tirage) : sur ballon LOOSE, le chasseur noté LENT reste PLANTÉ l'excédent
     de sa réaction sur le joueur moyen ((reaction − 0,22) × 2,5, top × 0,1) avant de
     sprinter. MESURÉ en fixture : 1 s de chasse — vif (90) 3,72 m = moyen (50) 3,72 (le
     no-op) ; lent (10) 3,25 (−0,47 m par duel — la fourchette du réel ±0,5 m). DEUX
     LEÇONS DE FIXTURE (payées) : ×0,55 ne mordait PAS (l'accélération vit sous le
     plafond — le premier pas est un PLANTÉ, pas un bridage) ; et movePlayers n'avance
     pas st.t (le sablier est à matchStep) — le lent restait planté pour l'éternité de
     l'instrument. L'HONNÊTETÉ D'AGRÉGAT : la possession d'équipe ne bouge pas encore
     (les vrais duels de transition ~1/match — le canal est juste, l'agrégat attend
     l'élection du passeur myope, dette maintenue au ROADMAP). Le miroir de fixture
     full-match a aussi exposé un BIAIS DE CÔTÉ structurel (l'équipe 0 gagne le duel
     équidistant quel que soit le talent — l'asymétrie hunter/press à possession −1) :
     consigné à instruire.

195. **Lot 154 : LE DUEL DU CONTACT (le « biais de côté » instruit — et requalifié).**
     L'INSTRUCTION D'ABORD : la sonde du miroir 50/50 refaite PROPREMENT a requalifié le
     diagnostic du 153 en deux causes distinctes. (1) L'ARTEFACT DE FIXTURE : mon miroir
     posait `phase = loose` sans purger `st.restart` — l'engagement du coup d'envoi restait
     posé, la remise a un ayant droit (team 0), l'adversaire refuse d'approcher ('walk').
     Ce n'était PAS une asymétrie hunter/press : leçon de fixture, un monde synthétique se
     purge de ses remises. (2) LE VRAI BIAIS, plus profond : au contact la MÊME frame
     (distances bit-égales du miroir), la boucle de prise (`d < bestD` strict, rondo-sim)
     donnait le ballon au PREMIER DU TABLEAU — l'équipe 0 prenait 30/30, côtés inversés,
     même `lastTouch = 1`. Le talent, lui, renversait déjà (90v10 : 20/20 au vif — le
     premier pas du 153 fait l'avance AVANT le contact). LA LOI (cfg.prise5050, top-level) :
     deux preneurs ADVERSES dans la fenêtre du simultané (fenetre 0,12 m) → la prise
     revient au plus VIF (reaction STRICTEMENT meilleure) ; à notes égales, l'ancien
     chemin — le monde noté 50 = le nu AU BIT (un tirage seedé aurait cassé ce contrat).
     MESURÉ : 50v90 avant = équipe 0 prend 10/10 (l'ordre du tableau bat le talent) ;
     après = le vif prend 20/20 côtés inversés ; sabotage prise5050:false → l'ordre du
     tableau revient (10/10). Clause 154 au banc (miroir 3 graines × 2 côtés, les trois
     mondes). Les 4 empreintes du monde nu intactes. Restent du chantier égalisateur :
     l'élection du passeur myope, le tacle-debout muet en flux.

196. **Lot 155 : LE DÉPART VU (l'élection du passeur myope, instruite et requalifiée).**
     LA SONDE D'ANATOMIE d'abord (passes de l'équipe notée n volées par l'adverse 50,
     3-6 graines × 240 s) : AVANT, 11,8 / 14,7 / 13,8 % aux notes 10/50/90 — aucune
     discrimination, et ~85 % des volées SOUS PRESSION. L'anatomie fine (dt, distance
     du voleur à la mène) : la grosse famille part à dt 0,1-0,5 s avec le voleur SUR
     L'ORIGINE — la passe dans les pieds du presseur collé. LA CAUSE STRUCTURELLE :
     laneClearance saute tout bloqueur à u < 0,06 de la ligne (« derrière le passeur »),
     soit 1,2 m sur une passe de 20 m — l'ANGLE MORT exact du jeté. DEUX CANAUX TENTÉS
     ET REJETÉS à la mesure (l'effet APRÈS fait foi) : le couloir exigé × visionF
     INVERSAIT (le visionnaire large perdait ses bonnes options, 138 → 106 passes,
     volées ↑ — le couloir pilote le STYLE, pas le risque) ; la marge de l'œil urgent
     × (2−visionF) : zéro effet (13,8 → 13,5 %, les volées ne passent pas par ce refus).
     LA LOI (cfg.departVu, top-level, défaut ON) : la ligne dont le premier mètre est
     habité (rayon 1,8 × visionF, perp 0,7, along > 0,2) se REFUSE — le chip lofted
     reste jouable par-dessus. MESURÉ : niveau 50 : 14,7 → 12,0 % (le modèle voyait
     enfin l'homme du dos, et PLUS de passes tentées) ; gradient 14,1 % / 12,3 % aux
     notes 10/90 (6 graines — réel mais doux : la séparation ne vit que sur les longues
     lignes où l'angle mort dépasse la portée de l'œil). A/B 20 × 300 s : 20 buts
     (bande 8-22 ✓). Clause 155 déterministe (presseur à 0,70 m, u 0,058 : élu →
     refusé → sabotage ré-élu) ; fixture : la Loi 11 du cerveau exige des adverses
     DERRIÈRE le receveur (bloc à +40, sinon tout est hors-jeu et tout refuse).
     EMPREINTES RE-DATÉES par la loi (défaut ON) : matchs 0f4b80b1a7c484f6 /
     89b8f0184809809b ; rondo c775c81e62592d4d et réduit c701c84aec0851ef INTACTS
     (st.full). LE POISSON REJOUÉ : la clause gradation 152 à 3 graines rendait 2/8/3
     (faux négatif) — élargie à 6 × 240 s (5/17/18 stable). ET LA TROUVAILLE : le
     volume d'appels est SOURD à otbF (52 ≈ 53 aux extrêmes, 15 ≈ 14 par joueur) —
     l'horloge d'ÉQUIPE (~5 s) lie le volume et le créneau va au PREMIER DU TABLEAU
     des éligibles (le biais d'ordre du 154, encore) ; la clause 151 devient un
     tripwire nommé, l'ÉLECTION DE L'APPELANT est le prochain chantier. LES DIX
     CLAUSES DE FLUX re-datées se sont épinglées au patron « la clause isole le
     re-dateur » (departVu:false aux 4 packs LAB/ISO131/POST131/ISO142 + 6 isolations
     locales 103/135/136/149) — ET l'épinglage a révélé une DILUTION à consigner :
     dans le monde vivant, le levier tempo rend +8 passes/450 s (contre +8/150 s
     épinglé) et la mentalité +4 tentatives (contre +6) — les refus du départ
     mangent une part du différentiel des axes ; à re-creuser avec l'appelant.

197. **Lot 156 : L'ÉLECTION DE L'APPELANT — tentée, mesurée, REJETÉE (la falsification
     est le livrable).** L'hypothèse du 155 (le créneau d'appel au premier du tableau =
     biais d'ordre, otbF sourd) instruite au banc d'essai : la revue des candidats
     éligibles + l'élection du mieux-disant (dart ×0,1 + couloir ×0,3 + (otbF−1) ×
     instinct − pénalité de répétition). MESURÉ à 6 graines × 300 s, deux variantes
     (instinct 3 et 8) : volume −22 % (106 → 83 appels), le rang 9 écrasé (28 → 16),
     et le canal otbF TUÉ (jumeau 17 ≈ 18) — la géométrie de formation domine tout
     poids d'instinct raisonnable, et l'arbitrage froid casse la rotation organique.
     ET LA CONTRE-MESURE DÉCISIVE : le monde D'HIER, mesuré à la BONNE échelle
     (6 graines, par joueur), montre le canal otbF DÉJÀ VIVANT — le jumeau noté 90
     appelle 31 contre 26 au jumeau 10 (+19 %) : la cadence personnelle (rôle ÷ otbF)
     et l'ordre stable suffisent. Le « sourd » du 155 (52 ≈ 53 d'équipe, 15 ≈ 14 à
     3 graines) était le POISSON, troisième leçon du genre en trois lots — l'échelle
     d'équipe est liée par l'horloge (~5 s), l'échelle à 3 graines est sous le bruit ;
     LE CANAL SE MESURE PAR JOUEUR, À 6 GRAINES. Code revenu AU BIT (les 4 empreintes
     identiques au 155 : 0f4b80b1a7c484f6 / 89b8f0184809809b / c775c81e62592d4d /
     c701c84aec0851ef), la leçon consignée en commentaire à l'endroit même de la
     tentation, et la clause 151 requalifiée : le jumeau à 6 graines (31 ≥ 26 + 3),
     déterministe. Restent du chantier égalisateur : le tacle-debout muet en flux,
     la gradation 90v50 des tirs presque plate, la dilution des axes (156 n'y touche
     plus — le monde vivant reste celui du 155).

198. **Lot 157 : L'HORLOGE DU PIQUE — le tacle-debout entre enfin en scène (le dernier
     canal géométrique du 152).** LA SONDE : tackleTime = 0,9 s de pression SOUTENUE —
     jamais atteinte en flux (pression max 0,88 s, 1 armé/30 min) parce que la panique
     adverse lâche le ballon à 0,15 s (le seuil decF du 152) : le tacle-cérémonie
     perdait la course des horloges PAR CONSTRUCTION. Et l'amont est famélique : 19
     épisodes de pression/15 min, p75 = 0,22 s (le bouclier protège le ballon, mesure
     du 32). LA LOI (cfg.tacleVif, top-level, défaut ON) : l'engagement du tacle-debout
     à tackleTime × tot (0,25 → ~0,23 s, calé sur le p75 des épisodes) × (2 −
     tacleTempoF) — le NOUVEAU facteur de la note tackling (lerp 0,85-1,15, 1 exact à
     50, monotonie au contrat statique) : le bon tacleur pique à 0,19 s, le maladroit
     attend 0,26. La PORTE DE DISCIPLINE du 95 reste juge (tackleWindow → balPrenable :
     on ne fauche pas un ballon protégé), le cooldown anti-mitraillette tient. MESURÉ
     (6 × 300 s) : 1 → 12 armés (≈ 24/90 min extrapolé, le réel des standing challenges) ;
     duels 21 → 37 ; ET LES FAUTES DE MILIEU NAISSENT : 14 → 31/20 matchs A/B (≈ 28/90
     min — le réel total est 20-30 ; le monde d'avant était à 12,6, trop propre). A/B
     20 × 300 s : 18 buts (bande 8-22 ✓). LE CANAL DE LA NOTE : tacleurs 90 = 11 armés,
     tacleurs 10 = 3 (l'horloge ÷ note fait ×3,7 le volume d'engagement ; le GAIN du
     duel reste jugé par tackleReach vs esquiveF du 152). Leçon de garde : l'appel
     `tacleHorloge(st, press[0], …)` s'évalue AVANT le court-circuit du && — press[0]
     peut être undefined (q?.skill). Clause 157 au banc (vivant ≥ 8, sabotage ≤ 2,
     note 90 ≥ 10 + 4) ; les packs et isolations épinglés tacleVif:false D'AVANCE
     (la leçon du 155 appliquée en amont, zéro clause fantôme). Empreintes : les 4
     INCHANGÉES — même les matchs (les graines 3/7 n'ont aucun épisode de pression
     qui atteigne 0,23 s dans leur fenêtre : la loi est réelle mais rare à l'échelle
     de l'empreinte) ; rondo/réduit garantis par st.full.

199. **Lot 158 : LE JUGE DE PAIX REQUALIFIÉ — la gradation 90v50 n'était pas plate,
     l'instrument était borgne (aucun changement moteur).** LA SONDE PAR CANAL d'abord
     (6 graines appariées) : le 90v50 rend possession 58 % (54,8 au miroir), duels
     gagnés 8-0, passes volées SUP (16,4 %), ballon au dernier tiers INF (16,9 vs 23
     éch/min), x moyen 0,4 vs 8,8 m — le fort joue PLUS BAS. L'ANATOMIE DES POSSESSIONS
     l'explique : le 90 PROGRESSE MIEUX (24,6 m médian par possession, 31 raids ≥ 20 m
     contre 24) mais NAÎT 7,4 m plus bas — sa défense supérieure (tackling, reactions,
     keeping) récupère tôt et près de sa surface : le tilt territorial n'est PAS le
     juge. TROIS LEÇONS D'INSTRUMENT payées dans la même sonde : (1) l'événement
     `but` s'attribue par `e.team` — ni `e.by` ni `e.equipe` (deux passes fausses :
     « buts 0-18 » à 50v50 symétrique, l'alarme absurde qui a sauvé la mesure —
     VÉRIFIER LA FORME DE L'ÉVÉNEMENT AVANT DE COMPTER) ; (2) les tirs-POUR seuls
     sont l'œil du borgne : la moitié DÉFENSIVE de la domination (tirs concédés
     36 → 28) était invisible — le juge est le DIFFÉRENTIEL ; (3) 240 s
     sous-échantillonne les buts (600 s pour les compter). LE VERDICT, au bon
     instrument : LA GRADATION EST RÉELLE ET MONOTONE À TOUS LES ÉTAGES — buts
     (6 × 600 s) : différentiel −1 / +1 / +4 / +6 aux niveaux 30/50/70/90 (le 90v50
     gagne 12-6) ; tirs pour−contre (6 × 240 s) : 3 / 6 / 9 ; possession 54,8 → 58 %
     (l'objectif ROADMAP ≥ 60 % est à 2 pts). Clause 152 REFONDÉE sur le différentiel
     (d30 < d50 < d90, écart ≥ 4). LE FRONT RESTANT du fil, requalifié : pas la
     gradation — LA RÉCUPÉRATION HAUTE (le fort récupère bas parce que le pressing
     n'est que tactique : aucune note ne fait oser le contact plus haut — rejoint
     l'amont famélique du 157, 19 épisodes de pression/15 min).

200. **Lot 159 : LE MORD — le jockey cède à la porte du conteste (l'amont des duels,
     modestement, honnêtement).** LA SONDE : le jockey (95) campait le presseur à la
     PORTE du conteste — cible 1,0 m, conteste 0,9, p10 mesuré 0,97 m : 8,7 % de
     conteste des portages, l'amont famélique des 157/158. LA LOI (cfg.mord, défaut
     ON) : à la porte (1,6 m × aggrF — l'agressif mord dès 1,92, le placide 1,28),
     le jockey cède et la cible devient LE BALLON. L'HONNÊTETÉ DE MESURE : l'équilibre
     du bouclier TIENT (conteste 8,7 → 9,3 % ; même à porte 2,6 + cap levé : 10,7 —
     le porteur pivote/protège aussi vite que l'approche, et c'est le FOOT : un
     porteur qui protège est dur à déposséder). Le gain réel vit en aval : épisodes
     de pression +14 % (22 → 25), et le canal de l'AGRESSION arme le pique du 157 :
     mordeurs 90 = 6 armés vs placides 10 = 3 (l'aggrF ouvre la porte, l'horloge
     tacleVif fait le reste). A/B 20 × 300 s : 22 buts (borne haute de la bande,
     tenue), fautes 16. LA REQUALIFICATION DU CHANTIER : la récupération HAUTE du
     fort ne passera PAS par le corps-à-corps (l'équilibre du bouclier est une loi
     du jeu) — elle passera par le PRESSING D'ÉQUIPE aux notes : la hauteur et la
     fréquence des fenêtres de déclenchement (pressTriggers) modulées par les notes
     du BLOC (workRate/anticipation d'équipe), consigné comme prochain front.
     Empreintes matchs re-datées (2773262091728085 / f74c17e6c98fe0b4) ;
     rondo/réduit intacts. Clause 159 (armés 90 ≥ 10 + 2) ; packs + clauses
     151/157 épinglés mord:false (le patron, appliqué d'avance).

201. **Lot 160 : LE PRESSING COHÉRENT (retour utilisateur : « le pressing doit être
     collectif — pas le latéral gauche qui presse le central opposé ; une tactique
     d'équipe cohérente, bien exécutée suivant le niveau, la cohésion, la connaissance
     tactique »).** LA SONDE : l'élection du presseur au « plus proche brut » faisait
     TRAVERSER — 19,1 % des press avec le poste du presseur à > 15 m latéraux du
     ballon (p90 = 21,5 m). LA LOI (cfg.pressZone, défaut ON) : l'élection parmi les
     4 plus proches au score distance + pénalité d'éloignement de SA zone (poids
     0,7/m au-delà de tol 8 m latéraux du poste tenu _slotT) ; les autres tiennent le
     bloc, LE RELAIS SE FAIT EN COULISSANT. ET LA COHÉSION EST UNE NOTE : teamwork
     (NOUVELLE — 31/33 notes du consommateur) → teamF [0,8 ; 1,2] multiplie la
     pénalité : le cohésif élit juste, le brouillon retombe vers le chaos d'hier —
     qui est le VRAI foot des petites équipes. MESURÉ : traversées 19,1 → 4,1 %
     (sabotage pressZone:false : 19,1 — l'ancien monde au bit), p90 21,5 → 11,9 m,
     relais stables (295 → 273 : pas de sur-commutation). LE CANAL DE LA NOTE, à la
     bonne échelle (leçon 156 : par joueur, jumeau 6 graines) : le brouillon
     teamwork 10 PRESSE +36 % (251 vs 184 éch. — l'indiscipline est un SUR-pressing
     hors zone, il se lance là où le cohésif laisse le zonal y aller) ; l'échelle
     d'équipe uniforme est un mauvais instrument (facteur constant, flux entier
     re-daté — consigné). A/B 20 × 300 s : 20 buts ✓, fautes 22 (le réel).
     ET LE RE-DATAGE A RÉVÉLÉ DEUX FRAGILITÉS LATENTES, corrigées dans le lot :
     (160b, cfg.rondSort — LOI 8, LE CORPS) un GEL de 28,7 s (graine 3) : des
     marcheurs en transit se relayaient DANS le rond central, canTake ne le voyait
     jamais vide — l'adverse de l'engagement SORT désormais radial et CONTOURNE
     par la tangente (gel 28,7 → 10,7 s ; leçon : le premier correctif posé en fin
     d'assignJobs était MORT — la branche remise `continue` avant, le foyer est la
     marche vers spots) ; (160c, sans clé — un fix de CONTRAT) le tir « enroulée »
     de 37,6 m : la PORTE du lob (120) laissait entrer la décision au-delà de la
     grise mais l'ESPÈCE restait au tirage (u ≥ 0,25 → familles ordinaires) — au-delà
     de la grise l'espèce EST le lob, sans tirage ; l'habit du lob est frappePointu
     (le mapping de la clause 93 l'ignorait). DEUX LEÇONS DE CLAUSE payées : le
     canal « armés au jumeau d'agression » était du Poisson (6v3 → 4v3 → 3v5 au fil
     des re-datages) — la clause 159 réécrite sur le MÉCANISME (part de frames
     cible-ballon en fenêtre 1,3-2,0 m : 40 % / 2 % / 1 % agressifs/placides/
     sabotage, causal) ; et 160b sans clé a traversé TOUS les mondes épinglés
     (10 échecs) avant d'être gaté — CHAQUE loi a sa clé, l'arbitre compris.
     Empreintes finales : matchs 3057b18706ce16bd / 39251dc1a783aaf2 ;
     rondo/réduit intacts. Clause 160 (vivant ≤ 8 %, sabotage ≥ 15 %, jumeau
     +30 éch. épinglé rondSort:false) ; packs + isolations épinglés d'avance.
     RESTE du pressing collectif (consigné) : les FENÊTRES d'équipe
     (pressTriggers) aux notes du bloc, la coordination du bloc qui monte uni.

202. **Lot 161 : LE BLOC QUI LIT — la fenêtre du pressing collectif aux notes du bloc
     (la suite directe du cap utilisateur : « une tactique d'équipe cohérente, bien
     exécutée suivant le niveau »).** LA LOI (dans pressTriggers, gated notes — pas
     de clé nouvelle, le canal 151-patron) : à l'ouverture d'une fenêtre de pressing,
     la MOYENNE d'anticipation des défenseurs de champ (anticipF, NOUVEAU facteur
     [0,85 ; 1,15], 1 exact à 50 — 32/33 notes du consommateur) multiplie la DURÉE
     de la fenêtre et divise son COOLDOWN : le bloc lecteur tient son pressing plus
     longtemps et le ré-arme plus vite. LA SÉPARATION DES POUVOIRS est le cœur du
     mantra : l'axe tactique pressing reste le CHOIX du coach (déclencher haut ou
     bas, souvent ou rarement) — la note fait la QUALITÉ D'EXÉCUTION de ce choix
     (le même signal, mieux lu, mieux tenu). MESURÉ (3 × 300 s appariés) : lecteurs
     90 → 97 s en fenêtre / 23 fenêtres / 5 régains en fenêtre ; aveugles 10 → 74 s
     / 20 / 3 (+31 % de temps en pressing collectif au bloc qui lit). Monde nu
     intact au bit (anticipF ?? 1). Clause 161 (lecteurs ≥ aveugles + 12 s).
     Avec teamwork (160) et anticipation (161), le pressing collectif a ses deux
     notes : QUI presse (la discipline de zone) et COMBIEN il dure (la lecture).
     Reste consigné : le bloc qui monte UNI pendant la fenêtre (la compression
     synchronisée), et la 33e note (le trio gardien command/oneOnOnes/aerialReach).

203. **Lot 162 : LA COMPRESSION — le bloc pressant est un poing, pas un élastique
     (le 3e volet du pressing collectif).** LA SONDE : profondeur du bloc 34,4 m EN
     fenêtre contre 31,4 HORS — le pressing ÉTIRAIT le bloc. TROIS ITÉRATIONS de
     diagnostic (chacune mesurée) : (v1) le step × fond au « tiers défensif du
     terrain » ne mordait pas — en fenêtre le bloc chaîné au ballon est déjà haut,
     la condition terrain ne matchait jamais, et au nu workF = 1 → no-op total ;
     (v2) la profondeur RELATIVE au bloc (rel ∈ [0,1] sur les bornes des spots,
     hoistées) — mieux mais 0,1 m ; (v3) LE VRAI COUPABLE instruit : le plus bas
     du bloc en fenêtre est un MARQUEUR (341/354 éch.) clampé à la bande du lot 96
     — la bande utilisait le spot BRUT, sans la montée de fenêtre : le marqueur
     restait à la ligne d'HIER pendant que le bloc pressait. LA LOI
     (cfg.compression) : la bande pressante = spot + step × (1+fond) × workF —
     le piège Loi 11 couvre l'homme resté bas ; la note workRate fait l'unité de
     la montée. LE RÉGLAGE PAR LA BANDE : fond 2,4 → 30,1 m (le poing) mais A/B
     8 buts (borne basse — la ligne haute assèche) ; fond 1,4 retenu : 33,4 m
     (−1,0 vs sabotage 34,4), A/B 18 buts ✓. ET LE RE-DATAGE A RÉVÉLÉ le cousin
     du gel d'engagement (162b, sans clé — hygiène de contrat) : un ballon POSSÉDÉ
     à la frame même de la sortie (receive + touche au même pas, graine 7 t=203)
     laissait owner ≠ null pour toujours — ballFetch attendait owner null, la
     touche gelait sans reprise. L'ARRÊT DE JEU LIBÈRE LA POSSESSION à la création
     de toute remise. Empreintes matchs d1c3ebb3539f79b1 / bc96d8a058e07ce7 ;
     rondo/réduit intacts. Clauses 117/143 épinglées compression:false (le patron) ;
     clause 162 (poing ≤ élastique − 0,6). Le pressing collectif est complet :
     QUI presse (teamwork, 160), COMBIEN il dure (anticipation, 161), COMMENT le
     bloc suit (compression × workRate, 162).

204. **Lot 163 : LE TRIO GARDIEN — la clôture de l'inventaire du consommateur
     carrière (aerialReach / oneOnOnes / command).** TROIS CANAUX, trois foyers :
     (a) aerialF [0,85 ; 1,15] — la PRISE HAUTE : la garde d'entrée d'onDive
     (d > 1,7 ; y > 2,1) ET le seuil de prise (1,1 ; 1,9) à la note — le gant tendu
     du 90 va à 2,42 m, bande humaine ; PROUVÉ par fixture pure (matchInternals.
     onDive, contact à 2,15 m : 90 prend, nu et 10 non) ; (b) oooF — le
     UN-CONTRE-UN : les PORTES du cône de sortie (sortie1v1, lot 104 : zMax 9 /
     near 8) × oooF — le bon sort d'un déclenchement plus large, le timide reste
     au poste ; PROUVÉ par keeperDecide pur (porteur excentré z 9,5 : sortie à
     1,15, poste au nu et à 0,85) ; (c) commandF — LE COMMANDEMENT, le seul
     levier d'attribut qui agit sur LES AUTRES : le rayon du marquage de surface
     (marquageCentre, 133) × commandF du GARDIEN de la défense — le gardien qui
     commande étend la zone où SES défenseurs prennent les corps ; le contrat
     statique le tient (monotonie/no-op), la preuve de FLUX attend un théâtre
     mesurable (les centres ~4-7/match, sous le Poisson — consigné ; la fixture
     une-frame échoue : un pass.cross artisanal est purgé par la machine avant
     marquageCentre). LEÇON DE FIXTURE : la prise haute vit dans onDive (le
     contact du PLONGEON) — la première chandelle se prenait au SOL frame 1
     (ballon posé sur le gardien), la deuxième culminait à 4,3 m ; la chorégraphie
     juste passe par l'export matchInternals et l'intégration balistique manuelle.
     Empreintes : les 4 IDENTIQUES au 162 (gated notes — le monde nu au bit).
     Clause 163 (2 preuves dynamiques + statique). L'INVENTAIRE DU CONSOMMATEUR
     EST CLOS : 38 notes consommées, toutes monotones, no-op à 50, bandes
     humaines. Restent (ROADMAP) : la dilution des axes tempo/mentalité, le banc
     incarné, les pénos (Lois 12/14), throwInStyle/setPiecesFocus.

- 205: Lot 164 — LE TEMPO MORD (la dilution des axes soldée). Sonde AVANT des 4
     axes dans le monde VIVANT (3 graines × 150 s appariées, tactics [tq,tq]) :
     pressing +113 % de fenêtres, largeur +9,8 m, mentalité avant 21→34 — ils
     MORDENT ; le tempo seul était dilué (+4,5 % de passes 0→1 ; réel 15-20 %).
     Cause : UN canal unique (la tenue calme ×1,35/0,65, lot 149) noyé par les
     autres sources de hold. TROIS canaux désormais, tous 0,5 = ×1 au bit (les
     paires SOMMENT À 2 — leçon : 1,18/0,85 rendait 1,015 au milieu, l'identité
     mourait d'un centile) : (1) LA REMISE AU TEMPO (referee.tempoWait, les 5
     sites de st.restart) — l'attente × axe(tempo équipe qui joue, 1,6/0,4) :
     jouer vite sa touche À 1,3 s ou la poser À 5,1 s, LE levier n° 1 du tempo
     réel ; (2) la tenue calme élargie (1,5/0,5) ; (3) la barre d'adoption calme
     intentBarCalm × axe(1,3/0,7) — la vive lâche plus tôt, la posée exige mieux.
     Mesure APRÈS (6 graines × 150 s, leçon Poisson) : passes 307→346 (+12,7 %),
     0,5 = 307 le monde d'hier. A/B 20×300 s : 98 tirs, 18 buts (bande 8-22).
     Empreintes : les 4 IDENTIQUES (l'axe est déjà l'injectable — pas de clé
     neuve, le défaut 0,5 EST l'épingle). Clause 164 ×2 (mécanisme remise
     déterministe + flux 6 graines ≥ +5 %). L'A/B reste significatif : le
     cerveau de coach (113) déplace le tempo hors 0,5 en match. La clause
     149-tempo (flux à UNE graine) a cassé à l'élargissement (49 c. 50 — le
     Poisson miniature) : re-datée sur le MÉCANISME (tenue calme moyenne posé
     ≥ vif × 2 ; mesuré 2,35 c. 0,75 s), le flux vit en 164b. Banc 176 ✓.
     LEÇON DE FIXTURE : BallBody.restart exige une cause du REGISTRE — « test »
     n'existe pas, la fixture nomme « touche ».
- 206: Lot 165 — LA TOUCHE LONGUE (tac.cpa.touche 'longue', le trébuchet). La
     rentrée du tiers offensif devient une arme de surface : la remise SE POSE
     (loi15.pose 15 s — le lanceur essuie, réel 15-30 s, le patron corner.pose),
     trois GRANDS (chargeF) montent aux postes du côté proche (premier poteau,
     axe, retrait — referee.toucheSpots, le patron cornerSpots, hook mutualisé
     avec cSpot dans assignJobs), la portée passe à loi15.longue 28 m, le jet
     part PLAT (24° au-delà de 19 m) et vise LE POSTE — mais un poste ne se sert
     qu'HABITÉ (monteur ≤ 9 m : pas de jet dans une boîte vide) ; le barème prime
     la boîte (+6+2×chargeF). Défaut : la touche d'hier AU BIT (empreintes ×4
     identiques — opt-in pur, le patron cpa du 148). DEUX leçons de site : la
     porte se recalcule du LANCEUR (st.restart est consommé à l'onTake) ; la
     branche touche de onOut RETURN avant le site du corner (la pose du 160b
     rejouée — poser la loi DANS la branche). Théâtre du flux : quasi vide
     (3 touches/30 min côté 0, 0 offensives) — la preuve est au MÉCANISME
     (fixture déterministe, patron 164a), la dette « touches organiques » (le
     monde sous-produit les sorties en touche, réel ~40/90 min) reste le front
     qui donnera son théâtre au trébuchet. Clause 165 ×2.
- 207: Lot 166 — LE DUEL CONTESTÉ (cfg.tacleDegage, duel.tacleDegage). Parti pour
     « les touches organiques » : la sonde de genèse (4×300 s) montrait 2 touches/
     20 min (réel ~10) et AUCUNE déviation de duel — le tacle gagné donnait 100 %
     de prises propres (receive). La loi : la prise n'est propre qu'à la garde
     (tirage > prise 0,55 × tacleGardeF, 39e FACTEUR sur la note tackling DÉJÀ
     consommée — l'inventaire des notes reste clos) ; sinon la fente POUSSE le
     ballon devant elle (7 m/s ± 0,9 rad, release 'contesté' au grand livre,
     phase loose). REQUALIFIÉ (patron 158) : l'effet duel est réel (2/6 gagnés
     dégagés) mais l'effet touches est NUL (1 c. 2 — le déficit vient des passes
     SERVO qui ne sortent jamais : front consigné). Loi du monde par défaut →
     empreinte match graine 7 re-datée 14426d8c5a206b06 (graine 3 d1c3ebb3539f79b1
     INCHANGÉE : aucun tacle gagné dans sa fenêtre — une loi rare peut laisser
     une empreinte intacte) ; épinglage tacleDegage:false étendu aux 26+8 mondes
     gelés + la clause gradation 152/158 (−11/−11/17 au vivant : la marche 30→50
     mangée par le tirage — la clause mesure les NOTES, elle isole son re-dateur).
     A/B 20×300 s : 101 tirs, 19 buts (bande 8-22). Clause 166 ×2 (seuil au
     tirage contrôlé — déterministe, la garde à la note ; l'extinction + la
     libération). Corps de loi dans duel.js (rondo-sim au plafond 1249).
- 208: Lot 167 — LA COURSE SERVIE (cfg.courseServie, retour utilisateur : « aucun
     joueur ne court derrière un ballon — axe, diagonale, couloir, entre deux »).
     SONDE : 589 passes/30 min, 34 servies ≥ 5 m devant, 5 ≥ 8 m, géométrie
     32 axe/2 diag/0 couloir ; les appels naissent (158/30 min, 32 % servis) mais
     la mène part 2,4 m devant (médiane), servie 0,4 s après la naissance (le
     coureur à < 2,5 m/s → solveur null). DEUX coupables en cascade : (1) le
     solveur dosait la vitesse INSTANTANÉE — la loi dose désormais le SPRINT
     PROMIS (vSol = vCourse 6,2 × topF, la note de pointe) et le burst PORTE sa
     direction (_pace.dir — servable au premier pas) ; la pointe × visionF du
     passeur ; (2) LE VRAI TUEUR : strikeNow re-menait au CONTACT avec la loi
     générique (rec.p + v × leadTime ≈ 5 m) — le rendez-vous élu 8-11 m était
     ÉCRASÉ à la frappe (l'instrumentation : 119 élections through, mène frappée
     3,6 m médiane). La mène de course SURVIT au contact : le through re-résout
     SON rendez-vous (2 itérations, advMax 16 — le piqué 20 m+ filait en sortie
     7/28). ET LA GÉOMÉTRIE DES NAISSANCES : l'appel axial vise l'INTERVALLE de
     la ligne (rondo.gapZ — le milieu du plus grand gap, « entre deux joueurs »)
     sinon CROISE vers le couloir — le 0,55×z d'hier rabattait tout vers l'axe.
     APRÈS : avance médiane 15,2 m (le cap a OUVERT les couloirs du solveur —
     le point à 20 m était insolvable), 39/65 services profonds, 36 % pris,
     5 espèces vivantes (intervalle 77, déborde 47, underlap 24, croise 23,
     banane 21). A/B 20×300 : 96 tirs, 16 buts. Loi par défaut → empreintes
     match re-datées 129e32dd2322f977 / da06e317436ff50c ; épinglage
     courseServie:false étendu (28+9 mondes). Clause 167 ×2 (le flux 6 graines
     + l'épingle rend hier). Attributs consommés : topF (le sprint), visionF
     (la pointe), controlF (l'arrivée, du 128) ; la tactique vit aux naissances
     (transition/style, du 141/36) ; le rôle à la cadence (appel, du 10).
- 209: Lot 168 — LE DUEL DE LA PASSE EN PROFONDEUR (les deux dettes du 167).
     (a) LA PROFONDEUR LIT L'ESPACE (rondo.js, capEsp sous courseServie) : 30 %
     des piqués partaient 12-16 m devant un coureur à < 6 m de la ligne (le
     ballon traversait, mangé — 37/37 en classe 12+, l'uniformité). Le cap :
     la distance à la LIGNE le long de la course + 2 m (advMin 4) ; la rupture
     garde son plancher derrière la ligne. APRÈS : 35 courts / 32 longs — la
     variété du réel. (b) LE LECTEUR DE TRAJECTOIRE (movement.js,
     cfg.lectureCourse) : sur un piqué (st.pass.through — l'étiquette posée par
     strikeNow), le défenseur de champ le plus proche de la trajectoire (≤ 4 m)
     part au point de COUPE s'il y arrive avant le ballon, après sa latence de
     LECTURE : reaction × (2 − anticipF) — la note DÉFENSIVE répond à la note
     du passeur, le duel a ses deux camps. Un lecteur par piqué (le patron
     un-seul-chasseur du 81). Mesuré : 34 lectures / 30 min, 13 piqués coupés
     par le lecteur, l'attaque prend 31 % (réel 30-40). Lois par défaut →
     empreintes re-datées 1c4431e0fcf20da9 / 7bf93c00a718132a ; épinglage
     lectureCourse:false 32+10 mondes. La clause 167 RE-CALIBRÉE (la médiane
     uniforme est morte EXPRÈS — le juge devient p90 ≥ 10 + classe profonde).
     Clause 168 (le flux des lectures + l'épingle). Attributs : reaction
     (latence, du 50/81), anticipF (la lecture, du 161) — deux notes déjà
     consommées, un NOUVEAU théâtre.
- 210: Lot 169 — LA RETENUE DE SURFACE (cfg.retenueSurface). Le diagnostic du
     166 re-mesuré à 40 matchs : 1,8 péno/90 min (réel ~0,3), fautes globales
     JUSTES (26,5/90) — 6,8 % des fautes en surface (réel 1-2 %). Les fautes de
     surface se répartissent sur TROIS espèces (1 debout / 1 accrochage /
     1 glissé-derrière sur 20 matchs) : la première loi (tacleHorloge seule)
     n'a PAS mordu (4 → 4, l'effet APRÈS fait foi) — les trois portes ensemble :
     (1) le seuil du tacle debout × frein 1,9 ÷ aggrF en surface ; (2) le GLISSÉ
     se refuse dans sa boîte (tirage 0,3 × aggrF, l'épisode consommé debout —
     st._slideT posé par le refus) ; (3) l'accrochage (déjà ×0,15 en dur, 97)
     resserré ×0,4 sous la clé. Partout : l'AGRESSIF se jette quand même — la
     note aggrF FAIT le penalty (la discipline est l'attribut, pas une constante).
     APRÈS : 2 penos/40 matchs (0,9/90, ÷2), fautes stables (57). Le calibrage
     fin ATTEND : 2 événements = sous le Poisson (la leçon — pas de sur-ajustage
     sur 2 tirages ; re-mesure à 100+ matchs quand le théâtre s'enrichira).
     Empreintes match INCHANGÉES (aucun duel de surface dans leurs fenêtres,
     patron 166-graine-3). Épinglage retenueSurface:false 33+10. Clause 169
     (flux directionnel 8×300 s). ET LA VALIDATION du fil 157-159 : la
     récupération haute suit l'axe pressing (−15,3/−6,4/+4,3 m médian, regains
     hauts ×12) — le pressing collectif 160-162 a fait le travail, pas de loi.
- 211: Lots 170-171 — LE RETOUR UTILISATEUR ×6 (le corps ouvert, le gardien,
     la célébration, les rayons du règlement). (170) « Trop de passes dans le
     dos / du mal à récupérer » : la sonde à l'ARRIVÉE (pas à la mène — 1/382 à
     l'intention !) montre le ballon devant (90 %) mais le PIVOT post-réception
     à 75° médian/151° p90 — il recevait FACE au passeur, dos au jeu.
     cfg.corpsOuvert : le receveur vise la DEMI-POSITION (part 0,55 du chemin
     vers le jeu, cap 1,2 rad) × visionF — celui qui scanne s'ouvre. Pivot
     75° → 60°, zéro dos créé (part 0,7 en créait 20 — refusée à la mesure).
     (171a) « Relance ultra rapide pas terrible » : 0,38 s médiane mesurée
     (réel 4-6 s), cause 'conduite' AU GRAND LIVRE — le gardien-preneur devenait
     porteur ordinaire et sa 1re touche éjectait le ballon. keeper.gkTenueDue :
     la tenue tirée 2,2-4,2 s × axe TEMPO, SAUF contre ouvert (l'éclair est un
     CHOIX) ; heldBall ÉTENDU : la prise AUX MAINS (pas le retrait — Loi 12.2,
     discriminant st.lastPasser) reste aux gants pendant la tenue. APRÈS :
     3,23 s médiane, p90 5,7. (171b) « Le retrait vers le gardien » : 0/30 min
     mesuré — le bonus 136 était une pente de style NULLE à 0,5 ;
     sortieGardien.detresse 0,45 (porteur pressé < 4,5 m) → ~8/90 min (réel
     10-20, fourchette basse ; la conduite du gardien récepteur = dette
     d'observation, théâtre trop rare). (171c) La célébration 6,5 → 14 s,
     3 → 5 coéquipiers (réel 25-45 s — le compromis jouable). (171d) « Respecter
     les règles » : cfg.rayonsLoi — corner 9,15 (Loi 17), touche 2 (Loi 15),
     sortie de but 9,15 ; les 3 m du réduit ne gouvernent plus le plein format
     (le CF avait déjà son mur Loi 13, l'engagement son rond Loi 8). Empreintes
     re-datées ea5b/135314c7/31fa3d14 au fil des lois ; épinglage ×45 (chaîne
     +corpsOuvert +gkTenue +rayonsLoi +sortieGardien:{}). Clauses 170/171a/171d
     (+ leçons : l'effet APRÈS a réfuté DEUX version — tacleHorloge seul au 169,
     et ici la sonde à l'intention ; le grand livre est l'outil du diagnostic).
- 212: Lot 172 — LE PIQUÉ SE NOMME + le moonwalk réfuté (retour utilisateur ×2).
     (a) « Aucune passe en profondeur réussie » : la sonde du DEVENIR à 20 min —
     25 piqués, 9 CONTRÔLÉS par le coureur (36 %, le taux du réel), 15 disputés,
     0 abandon : ils EXISTAIENT, invisibles (2/5 min et pas de ligne au fil).
     L'événement nommé 'piqué' (strike-sim, au départ du through : by/to/avance)
     + la ligne du ticker (« passe piquée — nº4 pour nº9, 12 m devant ») — la
     télémétrie du moteur EST la visibilité. (b) Le « moonwalk » du gardien-
     porteur : 14-15 % de frames désalignées mesurées (5 % à reculons) — DEUX
     canaux tentés et RÉFUTÉS à la mesure 8 graines (yaw-suit-v : 13,7 ≈ 14,7 %
     épinglé ; + l'hystérésis du target ballon/spot : 19,5 %, PIRE) → REVERT
     complet (la doctrine : le canal sans effet se rejette), dette nommée avec
     les pistes mortes (la suivante : tracer UN épisode frame à frame + regarder
     le CLIP de rendu — le blend d'animation peut fabriquer le moonwalk sans
     que le moteur soit fautif). Leçon d'instrument : à 4 graines la variance
     des mondes domine cette mesure (3,1 % vs 8,3 % entre deux seuils — le
     chaos, pas l'effet) ; 8 graines minimum pour ce canal.
- 213: Lot 173 — LE MOONWALK TRACÉ ET FIXÉ (cfg.gkFace, la dette du 212 payée
     avec le bon instrument). La trace frame à frame (seed 7, t=66,7) a craché
     LE mécanisme que deux canaux naïfs avaient raté : arrivé à < 0,6 m de son
     spot, le push du gardien-porteur flippait sur [−g.sign, 0] (la face-terrain,
     un défaut arbitraire) PENDANT que le corps rattrapait sa touche de conduite
     à 2,8 m/s de côté — le corps marchait latéral en regardant devant. La loi :
     au spot, s'il BOUGE encore (v > 1), le regard suit le BALLON qu'il rattrape ;
     immobile, la face-terrain d'hier. Mesure 8 graines : total désaligné
     14,7 → 12,3 % — et le RÉSIDUEL attribué : 70/81 frames vivent dans la
     PREMIÈRE seconde après la prise (le freinage du gardien lancé, ~0,15 s par
     prise — physiologique, pas un bug). Clause 173 (la fixture DE la trace :
     gardien au spot en mouvement, touche à 0,7 m → push [0,02, 1] vers le
     ballon ; épinglé [1, 0] le flip d'hier ; leçon de fixture : possession.
     carrier + 3 steps requis). LEÇON D'INSTRUMENT confirmée : les deux canaux
     réfutés du 212 l'étaient à bon droit — le traçage d'UN épisode vaut mieux
     que deux hypothèses plausibles. Les outils scratchpad (fingerprint, ab-97)
     reconstruits post-redémarrage (les valeurs d'empreintes RE-BASÉES).
- 214: Lot 174 — LE DÉGAGEMENT RESPIRE (cfg.clearSigma) + LE BANC SHARDÉ. (a)
     Les sorties organiques : le monde ne produisait NI touches NI corners
     (9 touches/90 min c. 40-50, 1 corner/20 matchs c. ~10/match) — le canal
     passSigma EXISTAIT (bruit d'angle 6°→0,5° à la note passing, appliqué aux
     passes) mais le CLEAR en était EXEMPTÉ (!choice.clear) : le dégagement
     pressé partait exact au flanc, or c'est LE pourvoyeur de sorties du réel.
     La loi : dirNoise du clear = passSigma × ampli 4 (~13° à 50) × composureF ;
     le monde NU reçoit execSigma ×1,25 (patron 145 — LE PIÈGE VÉCU : la
     première version exigeait c.skill, le monde par défaut est nu → zéro effet
     aux trois mondes, l'assert config avait AUSSI raté son ancre : deux
     non-effets silencieux d'affilée, la mesure les a attrapés). APRÈS (6×300) :
     touches 3→5, corners 1→3 (LE taux réel), sorties de but 3→9, buts/tirs
     stables. Clause 174 (flux directionnel large 17 c. 7). (b) LE BANC SHARDÉ
     (retour utilisateur « super long ») : les 85 blocs de verify-match11 sous
     garde __bloc() (BANC_SHARDS/BANC_SHARD round-robin, sans env : identique) +
     scripts/bancs.mjs — le runner parallèle (N shards + les 7 bancs, file de
     concurrence aux cœurs, agrégat TOTAL ✓/✗). Mur d'horloge ÷ ~4 attendu.
- 215: Lot 175 — L'HORLOGE FM (chrono.affiche) + LA CIBLE ACTÉE. L'utilisateur
     fixe la cible : FOOTBALL MANAGER. La clarification d'architecture : FM ne
     simule PAS 90 min réelles (10-15 min d'horloge accélérée) — ce qui fait FM,
     c'est les VOLUMES STATISTIQUES à l'échelle du vrai match (2-3 buts, ~10
     corners, ~25 fautes/90). Notre écart n'est pas la durée mais la DENSITÉ
     (~18 buts/90 équivalents aujourd'hui). Trois gestes : (1) l'horloge de
     représentation MAINTENANT — chronoStep expose C.ratio = affiche 5400 /
     (periodes × duree) ; la scène affiche « MT2 67:30 », l'additionnel en
     minutes affichées, le fil du ticker date en minutes de match (13 sites
     convertis, _ratioFM) ; purement additif, le moteur joue son format calibré ;
     le 2×45 réel reste UNE CONFIG (duree: 2700 → ratio 1). (2) LE JALON DENSITÉ
     FM consigné (ROADMAP) : re-calibrer buts/corners/fautes par 90 vers les
     volumes FM — conditions d'entrée : les gestes foot au point (le critère de
     l'utilisateur), le banc shardé (fait, 174) pour payer les re-mesures.
     (3) Les clauses passent au référentiel /90 min au fil de l'eau. Empreintes
     re-basées 66cf43eb08275f8a / ac8b3213cb3e376f (le re-datage vient du
     clearSigma 174 — l'horloge n'écrit que C.ratio, lu par personne au moteur).
     Clause 175 (ratio 15/1/6 aux trois formats).
- 216: Lot 176 — LE BLOC DE CHAMP (cfg.contreTir, duel.contreTir). Le geste
     manquant : ~25-30 % des frappes réelles sont CONTRÉES par un corps de
     défenseur (LA source des corners) — chez nous 14/48 tirs croisaient un
     corps à < 0,4 m et TRAVERSAIENT (le tir fantôme). La loi, physique et
     GÉNÉRIQUE : tout ballon LIBRE, rapide (≥ 13 m/s) et bas (≤ 1,3 m) qui
     percute un corps ADVERSE au dernier toucheur dévie — ricochet ± 1,1 rad,
     vitesse ×0,3-0,6, cooldown 1,5 s par corps, événement 'contre' nommé
     (télémétrie + ticker « contré ! — nº5 bloque la frappe de nº9 »). Le rayon
     0,38 = le corps humain effectif (0,33 testé : n'a pas changé la part — pas
     de sur-calibrage au Poisson, 39 tirs). Mesuré (8×300 s) : 13 % des TIRS
     contrés + 10 dégagements/passes appuyées bloqués (l'instrument FIN sépare :
     la part brute 37 % mélangeait les deux — la leçon de l'œil du borgne
     rejouée côté numérateur). Buts 6, corners 3 : stables — le ballon contré
     meurt souvent en mêlée de surface (réaliste). Fixture 176 déterministe :
     le boulet sur le corps → contré v=6 ; épinglé → traverse v=17,4.
- 217: Lot 177 — L'ANCRE À LA CRAIE (cfg.craie). La sonde de géographie : le jeu
     ÉVITAIT le bord (3,4 % des passes, 1,5 % de la conduite près des lignes ;
     les postes les plus larges à |z| 18-19 m pour une craie à 34 — RENTRÉS de
     15 m). La cause : la largeur des slots est MULTIPLICATIVE (×1,15 max — un
     slot à 17 ne peut jamais coller à la ligne). La loi : en POSSESSION, le
     slot déjà large (|z| > hz×0,42) est TIRÉ vers la craie — une fraction du
     chemin restant (tire 0,6) × axe LARGEUR (0,5-1,4) × largeurR du rôle
     (0,8-1,2) : l'ailier étire le bloc à 2-8 m de la ligne, la tactique et le
     rôle dosent. APRÈS (6×300 s) : le plus large 23,2 → 27,3 m, passes au bord
     ×2,4, TOUCHES 8 → 13/30 min — LE TAUX RÉEL atteint (le front des sorties
     organiques 174-177 est SOLDÉ : dégagement qui respire + bloc de champ +
     l'ancre à la craie = touches réelles, corners ~5/90, sorties ×3). Buts
     3 → 6 sur la sonde (le jeu d'aile ouvre des centres) — l'A/B 20 matchs
     juge la bande. Clause 177 (flux 4×200 s : z ≥ épinglé + 2,5 ; touches ≥).
- 218: Lot 178 — L'HÉRITAGE DE LA CRAIE (roles.ancresCraie + le rôle
     ailierInterieur). Le retour utilisateur affinait le 177 : « ça peut être
     le latéral qui colle la ligne haut si l'ailier a un rôle de meneur ou
     d'intérieur » — la v1 tirait TOUT slot large (l'ailier rentrant restait
     tiré, rien ne transférait la craie). La largeur d'un côté devient une
     RESPONSABILITÉ d'équipe : par côté, l'ancre s'ÉLIT au rôle — argmax(|z du
     slot brut| × axe(largeurR, 0,7, 1,3)) parmi les postes assez larges
     (cache 0,8 s, st._ancre) ; SEUL l'élu est tiré vers la ligne. Le catalogue
     s'enrichit du rôle manquant : ailierInterieur (largeurR 0,15, profondeur
     0,6, arbitre tir 1,18 — le faux ailier qui rentre dans le demi-espace et
     frappe). LA PREUVE DU RÔLE (150 s appariées) : au défaut les postes 7/9
     ancrent (24,1/19,4 m) ; en ailierInterieur ils RENTRENT (18,9 / hors top)
     et les LATÉRAUX 3 et 0 héritent (18,3 / 17,1) — le pattern City/Arsenal.
     Leçon d'élection : le rôle 'meneur' (largeurR 0,45 ≈ neutre) ne renverse
     pas l'élection — il fallait le VRAI rôle rentrant au catalogue, pas un
     poids d'élection gonflé. Clause 178 (la preuve à deux mondes de rôles).
- 219: Lot 179 — LE PIED DU GARDIEN (cfg.gkPied — retour utilisateur ×2 : « le
     gardien galère à conduire »). L'instrument RECOUSU (les micro-pertes de
     conduite < 1,2 s tolérées) : 9 épisodes au pied/40 min — 7 passes ✓, mais
     2 BALLONS LÂCHÉS et la touche poussée à ~4 m d'un gardien qui MARCHE (il
     courait après sa touche). Deux canaux : la touche COLLÉE (touchF 0,35 —
     entre la préparation 0,3 et la conduite 0,62 : le pied du gardien est un
     CONTRÔLE, pas une conduite) et la distribution PROMPTE au retrait (gkDue
     ≤ 0,7 s — Loi 12.2 interdit les mains, chaque dixième compte sous le
     pressing du backpass ; la tenue 171 reste aux prises MAINS). APRÈS :
     ballons lâchés 2 → 0, toutes les fins propres. La dette d'observation :
     dMax ~3,9 m PERSISTE — c'est la PREMIÈRE touche d'un retrait appuyé (le
     contrôle standard d'un boulet, pas spécifique gardien) : à instruire
     (l'amorti du premier toucher × la note control) avant de légiférer.
     Clause 179 (le mécanisme touchF 0,35/0,62 + _mains au retrait).
- 220: Lot 180 — L'AMORTI À LA NOTE : TENTÉ ET RÉFUTÉ (la doctrine appliquée,
     rien shippé — la leçon vaut le lot). L'hypothèse de la dette 179 (le
     résiduel du contrôle réussi × controlF, centré no-op sur controlF(50) =
     1,15) : implémentée proprement, mesurée au JUMEAU 6 graines (control 90
     c. 10, settle des arrivées ≥ 8 m/s) → 0,24 = 0,24, AUCUN effet. La cause
     structurelle : le settle est SERVO-DOMINÉ — après la prise, le porté
     (l'intégrateur du carry) ramène le ballon au pied quelle que soit
     l'impulsion de contrôle : ce site ne PEUT pas porter la note. La note du
     contrôle vit là où le servo ne règne pas : pMiss (le contrôle MANQUÉ, déjà
     noté ×controlF) et l'arrivée du through (déjà ×controlF au 128). Le « 4 m
     de première touche » du 179 s'instruira au FILM d'un épisode (l'hypothèse
     suivante : la distance vit AVANT la prise — le ballon qui dépasse/le
     prenable qui refuse — pas après). Revert complet, moteur bit-identique au
     sceau 437 ✓ (consigné en commentaire au site, le patron des canaux morts).
- 221: Lot 181 — LA JAMBE TENDUE (duel.jambeTendue, cfg.allonge, appelée par
     matchStep) : le FILM promis par la note 220 a trouvé le site. La sonde
     (chasse = course du receveur entre le croisement < 2 m et sa prise) :
     p50 0,28 m mais une queue de 7,4 % > 2,5 m, dont 11 DEMI-TOURS de 7-23 m
     — et le traçage frame à frame a montré le mécanisme : la passe croise son
     receveur ATTITRÉ à 0,85-0,90 m et à 60 Hz / 7,5 m/s le minimum continu
     passe ENTRE les échantillons du gate binaire receiveRadius (0,85) — le
     receveur regardait sa passe passer à 90 cm sans tendre la jambe. La loi :
     dans l'anneau [receiveRadius, 1,15 m] (le pied réel), ballon au sol qui
     LE DÉPASSE (radial fuyant), une TOUCHE DÉGRADÉE — freinée ×kill, LIBRE
     (pas de possess) — et c'est LE canal hors servo où la note du contrôle
     mord enfin : kill × controlF (l'artiste 0,85 la pose à 1 m, le maladroit
     0,49 se la pousse 3 m — le « 4 m de première touche » DU BON CÔTÉ).
     Mesuré APRÈS : chasse p95 6,97 → 1,09 m, grosses 7,4 → 2,6 %, réceptions
     394 → 428 ; jumeaux ENFIN disjoints (90 : p95 1,05 / 10 : p95 5,90 —
     contre 0,24 = 0,24 au site servo du 180). La passe touchée est MORTE
     (lot 44). Une tentative par passe. Bande 19 buts/20×300 s. Clé absente :
     le demi-tour d'hier au bit. La dette « 4 m » du 179 est SOLDÉE.
- 222: Lot 182 — LA RE-FONDATION DU BOX CRASH (dette 123/171). LA SONDE A
     RE-TRANCHÉ (film-centres, 12 graines × 300 s, 3 mondes) : l'attente est
     aujourd'hui PIRE que le défaut partout (1,89 c. 2,00 corps à la mort du
     vol, 2 c. 6 buts de centre, trafic adverse 2,21 c. 1,80) — la dilution
     171 confirmée et aggravée : raviver le levier est mort, il reste l'opt-in
     documenté. LE VRAI DÉFICIT filmé : l'ATTAQUE du centre, pas la présence —
     17/36 centres perdus, 8 croisant un corps de boîte à ≤ 0,8 m SANS être
     joués, aux trois hauteurs : rasant (< 0,25), POITRINE (1,15-1,55 : la
     fenêtre MORTE nommée au lot 40 — entre volee.max et tete.min AUCUNE loi),
     au-dessus (2,2+). Deux lois posées :
     · 182a LA POITRINE (tete.chestStep, cfg.poitrine) : le coéquipier du
       dernier toucheur amortit le vol du buste — ballon LIBRE devant lui
       (hors servo : kill × controlF, le canal du 181 — jumeaux 90 : 1,1 m/s
       résiduel c. 10 : 4,0) ; au SEGMENT de la frame (leçon 181 : un centre
       à 15-20 m/s fait 0,3 m/échantillon, le rayon par frame regardait le
       vol passer entre deux images) ; reachTo 0,9 pour le receveur ATTITRÉ
       (le centre tendu ne chute pas en boîte — filmé : il le croisait à
       0,8 m en route vers une chute lointaine).
     · 182b L'ATTAQUE DU CENTRE (phases.boxCrashStep — le bloc 123 déporté de
       match-sim, −38 l.) : le poste du crash est un point de DÉPART, pas une
       statue — le corps dont le rai du vol passe à portée de pas (porte
       2,5 m) re-cible le point d'interception tenable ; la lecture se paie à
       reaction × (2 − anticipF) (patron 168) ; le receveur attitré exempté.
     APRÈS (film) : perdus 17 → 9 (dont 2 hors boîte), plus AUCUN perdu à
     hauteur de poitrine, tir 8→10, tête 2→4, poitrine 2. Bande : 42 buts /
     40 × 300 s (le 24/20 des graines 1-20 était du Poisson — vérifié sur 20
     graines fraîches avant tout calibrage : 18). Clauses 182a (mécanisme +
     jumeau + sabotage) et 182b (re-ciblage c. statue) ; chaînes ×42 étendues
     (poitrine + boxCrash d'hier). Dettes tenues : le trou du HAUT (2,2 m,
     les perdus restants h ~1,6 à 0,8-1,2 m), le trafic de frappe (conversion
     boîte ~20-24 % — à instrumenter tir par tir), le rasant non-attitré.
- 223: La leçon du SED AVEUGLE (sceau 182) : la chaîne d'épinglage commune
     insérée par sed en FIN de littéral peut DOUBLER une clé posée plus haut
     dans le même objet — la dernière gagne, et mon boxCrash-objet écrasait le
     `boxCrash: false` pré-123 de LAB : la loi se réveillait dans le monde du
     labo (vif 8 → 12, ratio démission 2,13 → 1,25, clause crevée). Le
     diagnostic qui a payé : le JUMEAU DE COMMITS (worktree du pré-182 — mêmes
     chiffres → la « fuite » n'était pas le moteur mais le banc) puis le DIFF
     des cfg effectifs en JSON. La règle : après tout sed de chaînes, grep les
     clés DOUBLÉES dans chaque littéral touché (`boxCrash.*boxCrash`) — et un
     monde de labo qui gèle une loi ENTIÈRE (false) ne reçoit jamais la chaîne
     qui la re-décrit en objet. Au passage : le juge checkMatch a appris la
     borne balistique du CF direct (34 m) — un canal légitime que l'invariant
     shotRange ne connaissait pas (attrapé quand 182 a fait naître une faute
     lointaine tentée, graine 7). Sceau final : 440 ✓ / 0 ✗ en 838 s ; déployé
     Rondo-DJioKpBz.js (poitrine ×9, jambe-tendue grepables au chunk servi).
- 224: Lot 183 — LOI 8, LES MOITIÉS + LE RETOUR TROTTÉ (retour utilisateur
     170 : « les coups d'envoi/engagement : respecter les règles »). D'abord
     le front des centres SOLDÉ en requalification : les « perdus » restants
     du film 182 tracés un à un — la tête JOUAIT le vol haut (v 11,6 → 1,8,
     faux négatif de sonde), le rasant repris par l'attitré une seconde plus
     tard — le théâtre est sain, la dette « rasant non-attitré » requalifiée
     (pas de déficit net mesurable, théâtre trop petit). PUIS LA SONDE DE
     L'ENGAGEMENT a tranché net : 6-7 corps d'un bloc ENTIER encore chez
     l'adversaire à CHAQUE prise post-but (12/12) — canTake n'exigeait que le
     rond (160b), jamais les moitiés. Deux lois :
     · LOI 8 LES MOITIÉS (referee.canTake, cfg.moities { tol 1,5, patience
       18 }) : l'arbitre attend chaque équipe rentrée chez elle ; la patience
       borne l'attente au-delà de restart.at (anti-gel — un corps coincé ne
       suspend pas le match). canTake reçoit désormais cfg (l'appel rondo).
     · LE RETOUR TROTTÉ (match-sim au bloc walk, cfg.retourTrot, lu par
       movement ×_walkF) : filmé — 47-60 m à 2,6 m/s ne rentrent jamais dans
       la patience (les cibles zigzaguées par le détour du rond en plus).
       LOIN de son spot on trotte (×1,7) ; le MENÉ presse (×1,15 — il veut
       rejouer) ; le MENEUR au tempo bas flâne (×0,85 — la gestion du temps
       est un CHOIX de coach : l'axe tempo décide, le moteur porte).
     APRÈS : hors-moitié 6-7 → 0/11 engagements (à la tolérance de la loi),
     reprise 17,6 → 24-28 s post-but (célébration 14 s comprise — l'échelle
     réelle : 45-80 s). Bande graines 1-20 : 23 buts (elles donnaient 24 au
     182 — le bruit connu, pas de calibrage). Clause 183 (mécanisme intrus
     posé + walkF, sabotage double) ; chaînes ×43 étendues AVEC le grep
     anti-doublon de la leçon 223 (3 faux positifs vérifiés = paires
     d'appels, pas de littéral doublé).
- 225: Lot 184 — DEUX DETTES SOLDÉES. (a) LE TRAFIC DE FRAPPE (la dette
     majeure du 123) : l'instrument tir par tir (12 × 300 s, chaque tir suivi
     3 s, issue nommée) a RENVERSÉ le verdict — la présence ne divise plus les
     buts, elle les paie : conversion 30 % au défaut c. 24 % sans boxCrash
     (+6 pts — au 123 c'était ÷1,5). Le monde 182 (poitrine + attaque du
     centre) a transformé les corps de boîte en joueurs du ballon. SOLDÉE PAR
     LA MESURE, rien à shipper. La sur-conversion générale (~30 % c. ~12 %
     réel) est la question du JALON DENSITÉ FM (le monde comprimé à 300 s) —
     pas un calibrage local. (b) LE BANC INCARNÉ (Loi 3) : l'entrant
     d'hier APPARAISSAIT au miroir du point de sortie (x −39,4 filmé). LA LOI
     (referee.stepRemplacements, cfg.entreeMediane, phase 'longe') : l'entrant
     LONGE la touche hors du terrain jusqu'à la ligne médiane et entre à
     x = 0 — l'équipe joue à DIX le temps du trajet (16,4 s mesurées + la
     sortie : l'échelle du vrai remplacement). Événement 'entree' à la
     médiane (le panneau du quatrième arbitre, pour le ticker un jour).
     PREUVE DE NON-EFFET au flux : empreintes bce971a14a35d913 /
     3bad89aaa3fcb005 IDENTIQUES au commit 183 (aucun _subs au flux nu) — pas
     d'A/B requis, pas de re-dateur possible. Clause au banc loi3 (10 ✓ :
     longe + médiane + à-dix + sabotage miroir).
- 226: Lot 185 — L'ARBITRE INCARNÉ (demande utilisateur : « ajoute un arbitre
     s'il y en a pas »). Le sifflet avait ses lois (administerWhistle,
     adjugeFaute, canTake…) mais AUCUN corps. LA LOI (referee.arbitreStep,
     cfg.arbitre, appelée par matchStep) : un 23e corps HORS de st.players —
     il ne peut ni prendre ni dévier un ballon PAR CONSTRUCTION (le percuté
     Loi 9 « ballon à terre » est une dette nommée, les assistants de touche
     aussi). Son métier par régime : au jeu courant il SUIT en retrait
     diagonal (suit 13 m, axial 0,55 — plus central que le ballon, les
     touches sont aux assistants) ; au coup-franc/penalty il ACCOURT au
     point (sprint, recul 5 m vers le centre) ; au corner il se poste à
     l'angle de la surface ; à l'engagement il tient le bord du rond. Trois
     allures (marche 2,2 / trot 4,6 / sprint 6,8), inertie bornée, à l'arrêt
     il REGARDE le jeu. MESURÉ : d(ballon) p05 5,4 / p50 14,5 / p95 25,2 (la
     fenêtre d'arbitrage réelle) ; aux CF à 5-6 m du point à l'heure de
     reprise ; au rond à 10-11 m du centre. PREUVE DE NON-EFFET : empreintes
     bce971a14a35d913 / 3bad89aaa3fcb005 identiques aux lots 183/184 — le
     corps est un témoin, pas un acteur ; aucun re-dateur possible. LA SCÈNE
     (Rondo.js) : même rig, tenue teinte NOIRE (Shirt/Shorts/Socks 0x17171c),
     locomotion seule (ni gestes ni regard), le rendu copie st.arbitre —
     VÉRIFIÉ AU PIXEL (playmode : le corps noir court la diagonale au milieu
     des rouges et des blancs). Clause 185 (fenêtres de suivi + postes +
     sabotage désincarné). Clé absente : l'arbitrage sans corps d'hier au bit.
- 226: Lot 185 — L'ARBITRE INCARNÉ (demande utilisateur : « ajoute un arbitre
     s'il y en a pas »). Le sifflet avait ses lois (administerWhistle,
     adjugeFaute, canTake…) mais AUCUN corps. LA LOI (referee.arbitreStep,
     cfg.arbitre, appelée par matchStep) : un 23e corps HORS de st.players —
     il ne peut ni prendre ni dévier un ballon PAR CONSTRUCTION (le percuté
     Loi 9 « ballon à terre » est une dette nommée, les assistants de touche
     aussi). Son métier par régime : au jeu courant il SUIT en retrait
     diagonal (suit 13 m, axial 0,55 — plus central que le ballon, les
     touches sont aux assistants) ; au coup-franc/penalty il ACCOURT au
     point (sprint, recul 5 m vers le centre) ; au corner il se poste à
     l'angle de la surface ; à l'engagement il tient le bord du rond. Trois
     allures (marche 2,2 / trot 4,6 / sprint 6,8), inertie bornée, à l'arrêt
     il REGARDE le jeu. MESURÉ : d(ballon) p05 5,4 / p50 14,5 / p95 25,2 (la
     fenêtre d'arbitrage réelle) ; aux CF à 5-6 m du point à l'heure de
     reprise ; au rond à 10-11 m du centre. PREUVE DE NON-EFFET : empreintes
     bce971a14a35d913 / 3bad89aaa3fcb005 identiques aux lots 183/184 — le
     corps est un témoin, pas un acteur ; aucun re-dateur possible. LA SCÈNE
     (Rondo.js) : même rig, tenue teinte NOIRE (Shirt/Shorts/Socks 0x17171c),
     locomotion seule (ni gestes ni regard), le rendu copie st.arbitre —
     VÉRIFIÉ AU PIXEL (playmode : le corps noir court la diagonale au milieu
     des rouges et des blancs). Clause 185 (fenêtres de suivi + postes +
     sabotage désincarné). Clé absente : l'arbitrage sans corps d'hier au bit.
- 227: Lot 186 — LES ASSISTANTS DE TOUCHE (demande utilisateur, la suite du
     185). La Loi 6 incarnée : deux corps HORS du terrain (le rail z = ±(hz +
     0,8) est absolu — a.p[2] écrit chaque frame), chacun sur SA touche
     (côtés opposés, la diagonale complète celle du central) et SA moitié :
     l'assistant k longe LA LIGNE DU HORS-JEU des attaques de l'équipe k —
     celle que le moteur calculait déjà (offside.offsideLine : l'avant-
     dernier défenseur ou le ballon, jamais derrière la médiane) ; la ligne
     n'est plus un calcul invisible, elle a un corps qui la court. Au corner
     de sa moitié/son côté il tient le drapeau. Sprint 7,2 (le vrai
     assistant est le corps le plus rapide du match), en course il court, à
     l'arrêt il FACE le terrain. MESURÉ : écart à la ligne p50 0,6-0,7 m,
     p95 1,9-2,0 (le retard du vrai assistant), 0 frame dans le terrain sur
     4 × 300 s, 3/3 corners au drapeau. Empreintes IDENTIQUES (troisième
     corps sans pied — comme le central). SCÈNE : arbitre.js généralisé aux
     TROIS officiels (spawnOfficiel/updateOfficiel — spawnArbitre rend
     { central, assistants }), vérifié au pixel (le corps noir longe la
     touche devant les panneaux). Clause 186 (rail + p50 + sabotage).
     Dettes tenues : le DRAPEAU levé au hors-jeu signalé (le geste),
     le percuté Loi 9, le sifflet gestuel du central.
- 228: Lot 187 — LE DRAPEAU LEVÉ (la dette du 186 : la Loi 11 a un GESTE).
     MOTEUR (assistantsStep, AS.drapeau) : au hors-jeu sifflé (l'event du
     receive, lot 148), l'assistant DE LA MOITIÉ FAUTIVE lève —
     as[team].drapeau = { t, x } est LE CONTRAT que la scène anime — et court
     à l'APLOMB de l'infraction (sa cible prime sur le rail de la ligne) ;
     la remise jouée, le drapeau descend (1,5 s ; garde-fou 12 s). SCÈNE
     (arbitre.js) : la hampe + fanion orange ATTACHÉS AU BONE RightHand des
     deux assistants (il suit la course) — pendant au trot, DRESSÉ au signal.
     LA CALIBRATION AU PIXEL a payé encore : l'axe local de la main Mixamo
     n'est pas celui du monde — trois orientations testées EN LIVE (play_eval
     + screenshot : z=0 pend, z=π/2 diagonale basse, x=−π/2 horizontal,
     x≈−π DRESSÉ) — la convention codée : rotation.x lerpée 0 (pendant) →
     −0,95π (dressé), 8/s. Clause 187 (mécanisme : event injecté + remise
     tenue → le bon assistant lève à l'aplomb, l'autre reste bas, la remise
     jouée le descend). Les officiels restent sans pied : empreintes à
     re-confirmer au sceau. Dettes : le percuté Loi 9, le sifflet gestuel
     du central, le drapeau du CORNER pointé (le geste directionnel).
- 229: Lot 188 — LA LECTURE À VITESSE VARIABLE (la couche 2 du JALON FM,
     note 229 — la cible validée utilisateur : « FM en vitesse 1 et match
     complet c'est bien 90 minutes »). Le principe FM exact : LA SIM NE
     CHANGE PAS, LA LECTURE ACCÉLÈRE — N steps de dt 1/60 par frame rendue
     (Rondo.js : this.vitesse ∈ [1;8], touches 1-4 → ×1 ×2 ×4 ×8,
     ?vitesse=N au boot). Le moteur n'est PAS touché (aucun re-datage
     possible — la sync 9 ✓ suffit de sceau). L'AVAL VISUEL vit au temps de
     LECTURE (stepV = step × vitesse) : le LOD d'anim accumule stepV (les
     jambes battent à la cadence du match), la régie/caméra suit à stepV,
     les officiels aussi ; l'horloge FM affiche « MT1 9:53 · ×4 ». VÉRIFIÉ
     au playmode : 600 frames à ×4 → t sim 40,0 s exactement (600 × 4 / 60),
     le plan de régie propre. Le chemin du 90 min réel est ouvert : couche 1
     (les densités du vrai foot à l'échelle 90 min — la re-fondation des
     clauses de flux, LE gros morceau) et couche 3 (le mode temps forts via
     menace.js) restent, conditionnées au feu vert utilisateur sur la
     bascule. Volumétrie Rondo tenue à 1249 (6 fusions de commentaires).
- 230: Lot 189 — LE LANCÉ VA AU BUT (LA LISTE v3 consignée au ROADMAP — le
     feu vert densité FM suspendu ; points 1 + 5 traités ensemble : c'était
     LE MÊME bug). L'INSTRUCTION D'ABORD, en cascade de sondes : les through
     EXISTENT (48/30 min, 10 % des passes — 3 sondes successives, deux
     FAUSSES par l'erreur du 181 re-commise : owner oscille pendant la
     conduite, et la ligne recule avec le repli — TOUJOURS mesurer par
     événements et à l'instant du départ) ; 16 leads visent DERRIÈRE la
     ligne, 7 y sont reçus/30 min (PLUS que le réel !)… mais 1 SEUL tir : le
     lancé REDONNAIT. Et 6/58 passes arrière partaient d'un porteur en
     CONTRE (≤ 3 défenseurs goal-side, but < 45 m) — 1/100 s, le crime
     visible. LA LOI (rondo.enLance — exporté, cfg.lance { porte 45,
     surnombre 3, barre 6, malus 6 }) : le porteur en surnombre NE RECULE
     PAS — quatre portes, dont TROIS ont dû être fermées par la mesure
     (chaque re-mesure identique au bit révélait la porte suivante) :
     (1) la barre d'adoption × composureF ; (2) le malus au score
     (choosePass) ; (3) le CHURN attrapé — l'intention pré-contre déchirée
     PLUS l'adoption arrière bloquée (1 801 déchirures/4 graines → 0) ;
     (4) la panique du chasseur-derrière calmée (la voie chaude) + holdMax
     dispensé. L'exception du vrai foot : servir un coéquipier PLUS lancé
     (+3 m) reste ouvert (le 2c1). APRÈS : contre-recule 16 → 7/4 graines,
     tirs 15 → 25, through mieux reçus (54 → 65 %), volés 16 → 9, bande 18
     buts/20 × 300 s ✓. Clause 189 (directionnel ×2, Poisson respecté).
- 231: Lot 190 — LE GARDIEN VIENT AU RETRAIT + LE SOUTIEN DE RELANCE (liste
     v3 point 2 : « le gardien ballon au pied toujours buggé/catastrophique »,
     2e réitération). LE FILM A RENVERSÉ LE DIAGNOSTIC : la sim du porté
     était PROPRE (6 épisodes/30 min, 0,3 s, ≤ 0,83 m du pied, zéro moonwalk
     résiduel) — le catastrophique était le POSITIONNEMENT, attrapé AU PIXEL
     (playmode seed 3 t≈67 : le retrait roulant vers un gardien PLANTÉ SUR
     SA LIGNE, ballon à 1 m de la ligne, le pressing arrivant). Sondé : les
     retraits pris à 1,6-1,7 M DE LA LIGNE (réel 6-14), la position de base
     en possession amie p50 2,2 m (le gardien moderne : 8-16). DEUX LOIS,
     une clé (cfg.gkAuDevant { rayon 25, mene 0,4, soutien 7 }) :
     · LA RENCONTRE (match-sim, régime non-porteur) : le ballon de
       COÉQUIPIER qui vient vers lui (la passe le vise, ou roule vers son
       but sans être un tir) se rencontre au POINT D'INTERCEPTION — il sort.
     · LE SOUTIEN DE RELANCE (keeper.keeperSpot via K.libero.soutien,
       injecté par le match depuis gkAuDevant.soutien — un seul épinglage) :
       SA possession (gate plein), même ballon proche, il TIENT ~7 m ×
       depthF × gardeF (la note keeping et le rôle garde restent les
       facteurs) ; le gate CPA 0 le protège des corners.
     APRÈS : prises de retrait p50 8,7-8,8 m ✓ fenêtre réelle, ET LA
     DISPONIBILITÉ MULTIPLIE LE CIRCUIT (5 → 20 retraits/30 min — le gardien
     devient une option de relance, le jeu moderne) ; position amie p50 2,2
     → 6,7 m ; vérifié au pixel (le gardien sorti, vivant sa relance devant
     la surface). Bande 46 buts/40 graines (haut du bruit connu — le
     meilleur foot marque ; la sur-densité reste le jalon FM). Clause 190
     (fenêtre + statue épinglée). Piège payé : le replace mono-ligne a avalé
     liberoGate derrière un commentaire (SyntaxError attrapé au parse).
- 232: Lot 191 — LE TACLE GLISSÉ QUI GAGNE (liste v3 point 4 : « très peu de
     glissés, l'animation existe-t-elle, la vitesse cohérente, plusieurs
     types ? »). LE FUNNEL A PARLÉ : 57 glissés/12×300 s (la fréquence est
     réelle : ~10/90 équiv, DEUX familles — porteur/duel + ballon libre, et
     le clip 'tacle' existe au catalogue) mais 12 % de GAGNÉS (réel 50-70) —
     l'utilisateur ne les « voyait » pas parce que seuls les gagnés se
     voient. Trois lois au CONTACT (le tueur : 18 % de réussite au contact,
     la glisse figée/courte pendant que le ballon divergeait) :
     · LE BALAYAGE SUIT LE BALLON (movement, S.suit 3,5 rad/s) : la jambe
       s'oriente pendant la glisse — rotation bornée, pas un aimant.
     · LA GLISSE PORTE LOIN (S.frein 2,5 → 1,35 : ~2,5-3 m parcourus comme
       au réel — c'est même le danger du geste).
     · L'ALLONGE AU CONTACT (S.win 1,15 + tackleReach × 2 — la note
       tackling en facteur des DEUX temps du geste).
     + S.imprudence en clé (0,2 — le déclencheur refuse plus de glissés
     non-gagnables ; le canal de la faute du réel préservé). APRÈS :
     porteur 12 % → 28 % gagnés, ballon libre 3/4, la bande saine (14
     buts/10 graines). Le chemin du 50 % réel passe par le DÉCLENCHEUR
     (47 % de lancements encore non-gagnables — dette nommée). Piège
     re-payé : un banc lancé pendant les éditions mesure un monde
     intermédiaire — le sceau se refait sur le commit.
- 233: Lot 192 — LA ZONE ROUGE SE SERRE + LE DOS FERMÉ (liste v3 point 7 :
     « les attaquants contrôlent et se retournent trop facilement sur les
     centres — les centres trop bons ou la défense qui réagit mal ? »). LA
     SONDE A RÉPONDU À LA QUESTION POSÉE : LES DEUX. Élargie au point
     d'appui (les centres stricts : 5 réceptions au sol/60 min, le théâtre
     est aérien) : 214 réceptions du dernier quart offensif, 92 dos au but —
     marqueur p50 3,8 M à la prise (le réel colle à 0,5-1,5), 66 % de
     retournements < 1,2 s, 59 tirs derrière. Deux lois :
     · LA ZONE ROUGE (cfg.serreRouge { rayon 26, serre 0,45 }, au marquage
       du bloc) : le danger à < 26 m du but défendu se marque AU CONTACT —
       la garde ×0,45, l'homme PRIME la bande de zone, le suivi perd ses
       à-coups (markF et role.press restent les facteurs).
     · LE DOS FERMÉ (cfg.dosFerme { d 2, cap 0,12 }, au push du porteur) :
       l'adversaire goal-side au contact TUE le cap au but — on ne traverse
       pas un corps ; la remise et le GESTE NOMMÉ (passement/roulette, à la
       note) restent les portes du point d'appui (le canal du point 10).
     APRÈS : marqueur p50 2,8 (épinglé 4,0), les duels de point d'appui
     DOUBLENT (9 → 19 — la défense existe là), tirs post-prise-dos-marquée
     33 → 21 % (le réel ~10-15 : la direction est prise). Bande 8 buts/10
     graines ✓. LEÇON D'INSTRUMENT : la métrique « yaw retourné » comptait
     l'orientation du corps ouvert (170), pas la percée — le juge devient le
     TIR post-prise-marquée ; et le mécanisme posé du dos fermé recule des
     deux côtés (l'évasion) — le juge de FLUX fait foi, le mécanisme reste
     informatif dans la clause.
- 234: Lot 193 — LE PRENEUR A UN MÉTIER + LA LOI 16 (liste v3 point 6 :
     « corner/CF/renvoi aux 6 m incohérents — placements et tireur »). LA
     SONDE : le renvoi aux 6 m JAMAIS pris par le gardien (l'élection du
     preneur EXCLUAIT les gardiens par construction), 1-3 adversaires DANS
     la surface à chaque prise (la Loi 16 inexistante), le corner au
     plus-proche, 0 poteau tenu. TROIS LOIS, deux clés :
     · LE PRENEUR PAR MÉTIER (cfg.preneurCPA) : la sortie de but au GARDIEN
       (et elle l'ATTEND s'il est au sol — r.taker = -2) ; le corner et le
       CF offensif (< 48 m du but adverse) au SPÉCIALISTE — le passSigma le
       plus fin de l'équipe, élu UNE fois (r._elu), qui traverse le terrain
       pour son corner comme au vrai ; la touche au plus proche.
     · LA LOI 16 (cfg.loi16) : le renvoi attend la surface VIDE d'adversaires
       (patience anti-gel 10 s) et l'intrus SORT par le bord le plus court
       (le patron du rond 160b).
     · LA REMISE A UN AYANT DROIT : canTake ET l'élection du taker-gate ne
       testent que r.taker — QUATRE gates fermés un à un à la mesure (le
       sticky pré-posé, le fallback qui écrasait l'attente du gardien, le
       bloc gardien qui écrasait le job du preneur, et le PLUS-PROCHE COLLÉ
       élu par le rondo-gate qui gelait canTake : 5 renvois créés, 0 pris,
       280 s — le film du gardien qui va chercher, porte, pose... et
       personne n'a le droit). APRÈS : 8/8 renvois au gardien, 49/50 remises
       prises, Loi 16 : 0 intrus partout, attente max 28,5 s (la cérémonie
       du but, bornée au 192). Bande 27/20 graines (tendance haute connue —
       jalon FM). Dettes : le poteau du corner tenu, les placements
       offensifs du corner (le paquet), le CF direct au tireur noté (le
       canal existe — cfDirect).
- 235: Le sceau du 193 — TROIS LEÇONS payées cher. (1) LE JUMEAU DE COMMITS
     puis le BISECT en trois temps ont désigné le refactor elireTaker : son
     chemin épinglé « analytiquement équivalent » divergeait au bit — LA
     DOCTRINE RÉAFFIRMÉE : la clé absente rend l'hier LITTÉRAL, copié en
     early-return, jamais dérivé. (2) LE STICKY INVALIDE SE REMPLACE (un
     vrai bug de fidélité attrapé en chemin : le ??= ne réassigne pas un
     preneur au sol — l'ancien code réassignait toujours). (3) DEUX CLAUSES
     HOMONYMES « lot 102 » : quatre runs perdus à isoler « le corner
     travaille » quand l'échec venait de « le placement » — TOUJOURS ancrer
     le patch sur la clause QUI IMPRIME le message d'échec (le grep du
     verbatim, pas du numéro de lot). Le re-datage finalement JUSTE : le
     spécialiste élu mangeait un GRAND forgé (le tireur du corner ne monte
     pas en boîte — du vrai foot) ; la clause mesure le placement, elle
     isole l'élection. Shard 0 : 55 ✓ / 0 ✗ ; le banc complet scelle.
- 236: Lot 194 — LA PRISE À DEUX MAINS + LE MISSILE RE-CALIBRÉ (liste v3
     point 3 : « les arrêts du gardien pas cohérents à tout niveau »). LE
     TABLEAU : 49 tirs/12×300 s — 29 % de buts (réel ~11), 35 % d'arrêts
     (réel ~45), et LE RATIO DES MODES INVERSÉ : 4 prises / 12 claquettes
     dont 8 À DEUX MAINS (l'événement portait l'aveu : d ≤ 1,35, les gants
     dessus, et il POUSSAIT). Deux causes fermées :
     · LA PRISE À DEUX MAINS S'ÉTEND (cfg.priseGant { d: 1,35 } — onDive) :
       le contact à deux mains non-missile se PREND (le seuil 1,1 d'hier
       épinglé au sabotage) ; aeF/handF restent les facteurs.
     · LE MISSILE RE-CALIBRÉ (corner.priseV 16 → 21, DATÉ) : p50 des tirs
       19,4 m/s au départ — la garde du lot 101 (calibrée aux corners)
       traitait TOUT tir normal en missile imprenable ; le vrai gardien
       capte ~20-22 près du corps, le missile réel vit à 24+ (handF module
       toujours : le bon capte 24, le faible claque dès 18).
     APRÈS : 11 prises / 7 claquettes (le ratio du réel ~55/35), conversion
     30 → 21 % (les rebonds de claquette en moins — le chemin vers ~11 %
     passe par le jalon densité). AU PIXEL : le tir excentré est CUEILLI
     par le gardien sorti (les lots 190/194 se composent — le gardien
     maître de sa surface). Clause 194 (le flux des modes, prises ≥
     claquettes). Dette : la distribution p50 des VITESSES de tir (19,4)
     est elle-même haute — la question du monde comprimé (jalon FM).
- 237: Lot 195 — LE GANT EST UN TOUCHER (Loi 17) + LE PLONGEON VALIDÉ AU
     PIXEL (retour utilisateur direct : « quand un défenseur ou le gardien
     dévie en corner, l'arbitre siffle renvoi aux 6 m » + « le plongeon
     incohérent entre départ/arrivée/relevé — le geste de relevé existe
     vraiment ? »). (a) LE CORNER VOLÉ : filmé 0 corner / 2 renvois volés
     après déviation défensive — la ligne du vol (l.1160) réécrivait
     lastTouch au TIREUR chaque frame : la claquette POSAIT lastTouch puis
     se le faisait écraser ; le contre (176) et la tête ne le posaient même
     pas. LE FIX ABSOLU (une fidélité à outRule, pas une clé) : lastTouch
     ET lastPasser posés aux 7 sites de déviation (claquette, prise,
     contre, 5 sites de tête/volée). APRÈS : 2 corners / 0 volé. Clause 195
     au juge de flux (jamais un renvoi < 2,5 s après déviation défensive).
     (b) LE PLONGEON : la séquence complète filmée au pixel — détente
     plongeonBas → couché AU MÊME POINT → redressement PAR ÉTAPES (appui
     bras, gk.rise { ground 0,65, getup 1,25 }) → debout au même endroit.
     ZÉRO téléportation, LE GESTE DE RELEVÉ EXISTE (le contrat du lot 91
     tient). La réserve à l'œil : les autres espèces (plongeon haut,
     réflexe) restent à filmer une à une — dette douce.
- 238: Lot 196 — LES CONSIGNES DÉFENSIVES PAR JOUEUR (demande formelle du
     projet aval : « l'attribut est la capacité, la consigne est le CHOIX »
     — l'asymétrie signalée : six axes défensifs d'ÉQUIPE, un seul axe
     défensif de RÔLE). QUATRE AXES ajoutés au rôle (resoudreRole, identité
     0,5, composés par le rôle OFF comme press/garde) :
     · duel (se jeter/rester debout) : × (0,6 + 0,8·v) sur la retenue de
       surface (169b) ET l'imprudence du glissé (191) — la consigne
       par-dessus le tempérament (aggrF reste la note). BRANCHÉ, la preuve
       de flux en dette (le théâtre ~1 épisode/30 min, 12 = 12 au bit).
     · marqueSerre (coller/laisser respirer) : × axe(v, 1,35, 0,65) sur
       l'offset du marqueur (le site du 192, markF reste la note). PROUVÉ :
       receveur adverse tenu à p50 3,19 c. 4,31 m — le même latéral, deux
       ordres.
     · ressort (dégager/ressortir) : × axe(v, 1,25, 0,75) sur les rayons de
       l'étau de tryClear (à côté du style d'équipe et de role.press).
       PROUVÉ au flux : 18 c. 24 clears (−25 %) — Simeone c. Guardiola,
       les mêmes défenseurs.
     · orienteFaible (forcer le pied faible) : le biais d'épaule du JOCKEY
       (±0,55 m côté pied fort du porteur — l'aval weakF note déjà ce que
       le faible tente). PROUVÉ : biais signé moyen 0,134 c. 0,106 neutre.
     L'IDENTITÉ AU BIT : les quatre sites gardés au conditionnel strict
     (=== 0,5 → le littéral d'hier, doctrine 235) — l'empreinte du monde
     195 INCHANGÉE (a7ddbca0bcb0ca12 / ecf57b2c043db08f, la NOUVELLE
     référence consignée — l'ancienne bce971a1 datait du 187, re-datée
     légitimement par 189-195 : la fausse alerte a coûté un bisect).
     verify-roles : 10 ✓. La leçon du mécanisme : tryClear posé à froid
     refuse au timing de l'armé — le juge de FLUX equipe-consignée est le
     bon instrument des consignes.
- 239: Lot 197 — LA TENTATIVE À LA NOTE (liste v3 point 10 : « les gestes
     techniques sont-ils réalisés par les bons joueurs ? »). LA SONDE (squads
     forgés technique 90 c. 20, 6 × 300 s) : ratio bons/faibles 1,5 — les
     maladroits tentaient presque autant (6 roulettes chez les 20 contre 2
     chez les 90 !) : gesteF [0,55 ; 1,10] modulait la tentative en
     LINÉAIRE (pente 1,6×) et deux sites vivaient au flair SEUL (le rateau)
     ou presque (la roulette). LA LOI DES PENTES : la tentative au CARRÉ
     (passement, crochet, rateau — le patron du 124 « le carré fait le
     style ») et l'EXHIBITION AU CUBE (doubleContact, petit pont, roulette
     — la roulette d'un technique 20 n'existe pas au réel) ; la FEINTE
     reste au flair (le geste humble appartient à tous — le réel). APRÈS :
     ratio 3,3 hors feinte (la gamme réelle 3-5), le monde NU au bit
     (?? 1 → 1^n = 1 exact partout, empreinte à confirmer au sceau).
     persona.flair reste le tempérament (QUI OSE), gesteF la note (QUI
     SAIT) — les deux se multiplient sans se confondre, la grammaire du
     moteur.
- 240: Lot 198 — LES APPUIS DU RECEVEUR (liste v3 point 11 : « trop de
     mauvaises passes ou le destinataire pas sur ses appuis ? »). LA SONDE
     A RÉPONDU À LA QUESTION VERBATIM : sur les 11 grosses chasses
     restantes (> 2,5 m hors through), l'erreur de passe est QUASI NULLE
     (max 0,107 rad ≈ 6°, cinq à < 0,01 — des passes PARFAITES qui
     finissent en chasse) mais 8/11 receveurs sont À L'ARRÊT (v < 2 m/s)
     quand le ballon les croise : LE DESTINATAIRE N'EST PAS SUR SES APPUIS.
     LA LOI : le meetReel du 171 existait mais son seuil de divergence
     (2,5 m) ignorait les petits écarts — le receveur restait planté sur
     le point théorique. cfg.appuisRecev { fen: 0.8, div: 0.6 } : au
     DERNIER SEGMENT du vol (< fen s du contact), le seuil tombe à div —
     l'ajustement FIN au ballon réel, le geste des petits pas d'appui.
     APRÈS (6 graines × 300 s) : chasse p95 2,57 → 0,95 m, grosses
     5,3 → 2,4 % dont 4/9 through VOULUS (~5 vraies mauvaises / 30 min),
     et 358 → 368 réceptions (plus de passes ARRIVENT). Le canal du point
     11, ouvert au 181 (p95 6,97, 7,4 %), est clos. Clause 198 au jumeau
     appuisRecev: false (p95 vivant ≤ épinglé − 0,5 m). Clé absente = le
     planté d'hier au bit.
- 241: Lot 199 — LA RACINE RAPIDE (retour utilisateur : « le banc est de
     plus en plus long on peut pas l'optimiser ? » — ET l'unique ✗ du banc
     198 était la clause de budget, 1,61 ms/step sous contention). LE
     PROFIL (--cpu-prof, 120 s de match) : rondoStep 21,6 %, assignMatch-
     Jobs 12,7 %, movePlayers 9,4 %, GC 6,1 %, stepBall+helpers ~12 % —
     et Math.hypot PARTOUT (412 sites), mesuré 4,4× plus lent en V8 que
     sqrt(a²+b²) (divergent à ~1 ulp dans 38 % des cas). DEUX GESTES :
     (a) hyp.js — le socle sans import, hyp(a,b,c?) en racine crue, sed
     global sur les 412 sites (le monde re-daté AU CALIBRE : bande 17
     buts/20 graines fraîches, banc complet juge) ; (b) stepBall : le
     fusionné par défaut HISSÉ + memo par référence d'opts (un spread
     par appel nourrissait le GC via les boucles de prédiction).
     APRÈS : 0,736 → 0,51-0,53 ms/step (−30 %, le budget 1,5 respire à
     ×3) — le banc en hérite d'autant. TROISIÈME GESTE : bancs.mjs passe
     à shards = 2× cœurs (la file finissait sur 1-2 gros shards, cœurs
     dormants — round-robin plus fin, même concurrence). L'EMPREINTE :
     seed 3 INCHANGÉE au bit (cf9feb43ff908413 — aucune divergence d'ulp
     sur sa trajectoire), seed 7 re-datée 2b0dc731baeb47e5. Le reste du
     profil est structurel (les boucles par-joueur) — chantier futur si
     besoin. La leçon d'instrument : le 1,40 ms « isolé » d'avant était
     de la CONTENTION de shards ; machine libre = 0,736.
- 242: Lot 200 — LE RÔLE AGIT SUR LA STRUCTURE (5e demande formelle du
     projet aval, la première qui touche la charpente : « le poste place,
     le rôle nuance » rendait le demi-centre inexprimable). TROIS LIVRABLES :
     (1) ancrage — l'axe de rôle (0 colle, 1 vagabonde, resoudreRole,
     ON-phase) : élection du comité de soutien × axe(elect 1,4, 0,6) +
     mou du recalage de slot × axe(colle 0,7, libre 1,6). PROUVÉ par LEUR
     statistique (l'excursion relative au centre de gravité des
     coéquipiers, invariante au déplacement du bloc) : 8,16 cloué → 8,91
     neutre → 10,59 libre (+30 %) — le meneur libre et le carrilero ne
     sont plus ancrés à force égale. (2) cfg.role.profondeurM/largeurF —
     les amplitudes ±2,5 m / ×0,9-1,1 en PARAMÈTRE, défaut ABSENT = la
     branche littérale d'hier au bit (1−0,1 ≠ 0,9 en IEEE — la branche
     gardée, pas recalculée). (3) cfg.roleStructure — L'INTRUS DÉFORME LA
     LIGNE : un slot déplacé de ≥ seuil 4 m par sa profondeur de rôle
     entre dans une autre ligne, ses voisins de bande (±4 m en x)
     s'écartent de son z (ecarte 4 × falloff sur portee 12). PROUVÉ sur
     fixture au chiffre EXACT : pivot profondeur 0 × profondeurM 16
     descend à x −20,4, le stoppeur posté s'écarte 6,9 → 8,6 (+1,70 =
     4 × (1 − 6,9/12) au bit). Dormante aux amplitudes du jour (2,5 <
     seuil). Déport : intrusDe/ecarteLigne dans roles.js. IDENTITÉ :
     clés ACTIVES + rôles neutres = empreintes 199 inchangées
     (cf9feb43ff908413 / 2b0dc731baeb47e5) + clause 60 s au bit.
     EN CHEMIN — la clause marqueSerre du 196 RE-FONDÉE : son juge « d au
     marqueur aux réceptions » portait un BIAIS DU SURVIVANT (bien marqué
     = jamais servi, seuls les marquages battus échantillonnés — le
     re-datage 199 l'a exposé en INVERSANT le flux, confirmé 8 graines).
     Le juge honnête : la CIBLE du marqueur (d(target, homme) EST l'offset
     consigné) — 0,46 colle / 0,86 respire, ×1,85 stable sur 3 graines.
     La leçon d'instrument est générale : juger un marquage à l'événement
     de réception, c'est ne compter que ses échecs. bancs.mjs gagne
     verify-roles + verify-loi3 (ils manquaient à la file du sceau).
- 243: Lot 201 — LES TROIS CLAUSES QUE LE RE-DATAGE 199 A EXPOSÉES (le banc
     du sceau : 3 ✗, toutes des clauses de FLUX d'attributs sur squads
     forgés — le tirage chaotique re-roulé a montré que leurs juges
     étaient malades, pas leurs lois). L'instruction et la re-fondation :
     (a) 152/158 gradation — l'inversion 30/50 PERSISTAIT à 10 graines
     (−11 c. −15) : le différentiel de tirs seul est myope au milieu de
     l'échelle (déjà cicatrisé une fois, « la marche mangée par le
     tirage »). LE COMPOSITE territoire + aboutissement (dPasses +
     10·dTirs) : −157 < −108 < −7 < +490, monotone aux QUATRE rungs.
     (b) 160 cohésion — le jumeau de flux noyé (182/153 à 6 graines,
     266/277 à 8, 15/14 hors-zone à 12) : teamF est un facteur de
     DÉPARTAGE, son théâtre est la queue. LA FIXTURE BINAIRE : ballon
     large, slot forgé à gauche, corps à droite — dans la bande de
     départage l'élection FLIPPE À LA NOTE SEULE (brouillon presse,
     cohésif tient sa zone ; balayé x 2-6 = flip, x ≥ 8 = renoncement
     commun). (c) 161 bloc qui lit — le temps PASSÉ en fenêtre
     confondait lecture et victoire (mieux lire = gagner plus tôt =
     moins presser ; inversé 48 c. 72 s). Le juge du mécanisme : la
     fenêtre ACCORDÉE à l'ouverture (until − t, le « × moy » même) —
     5,04 c. 3,96 s. Les 3 lois vivaient ; les 3 juges sont morts. La
     leçon générale : un re-datage chaotique est un TEST DE ROBUSTESSE
     GRATUIT des clauses de flux — celles qui cassent sans loi cassée
     étaient des juges de hasard.
- 244: Lot 202 — LA RETOMBÉE SE CHASSE (liste v3 point 9 : « ça peut
     manquer de long ballon mais c'est peut-être la tactique »). LA
     SONDE EN TROIS TEMPS : (1) l'arrivée — 0 passe conclue > 25 m/30 min
     (réel ~15-20) ; (2) le départ — 27 lancés > 25 m/10 min, max 53,7 m :
     LE VOLUME EST SAIN (renversement 35/98, couloir 99, écarte 105,
     lance 189 font le vocabulaire) — famine d'exécution, pas d'élection ;
     (3) l'autopsie des 34 — le motif dominant : le lofted arrive au lead
     ENCORE à 8-15 m/s, rebondit (grassTangent), file 10-25 m plus loin,
     le receveur PLANTÉ au lead (fin « mort/libre » à dRecv 12-17 m).
     LA LOI : cfg.chasseRetombee { depasse: 3, h: 1.2, frein: 1.8,
     cap: 25 } — le ballon VIF qui a DÉPASSÉ le lead et s'en éloigne
     (produit scalaire > 0, retombé h < 1,2) se poursuit au POINT D'ARRÊT
     prédit (v²/2·frein, rafraîchi chaque frame) ; la réaction ×2 retarde
     le départ (l'attribut en facteur, le patron de la passe mourante 134
     dont c'est l'opposé exact : elle gérait le ballon LENT jamais arrivé,
     celle-ci le ballon VIF trop arrivé). APRÈS : conservation des longs
     41 → 61 % (réel 50-60), morts/libres 14 → 6. Bande 18 buts/20
     graines fraîches. Empreintes : seed 3 INCHANGÉE cf9feb43ff908413,
     seed 7 re-datée f4689cd8c9338dfb (jumeau chasseRetombee: false =
     le monde 200 au bit). DÉPORT : checkMatch → match-check.js (le
     moteur JOUE, le contrat JUGE — match-sim 1255 → 1191). La leçon
     d'instrument : le premier classificateur fermait mal ses fenêtres
     (0/27 « conclu » — un nouveau st.pass écrasait le jugement du
     précédent) ; l'autopsie à suivi continu a dit le vrai (14/34).
- 245: Lot 203 — LE RESSORT RE-FONDÉ AU MÉCANISME DIRECT (la 4e victime du
     re-datage : le juge de flux du 196 mort au monde 202, clears fondus
     à ~2/graine, 16 c. 18 sur 10 graines = bruit). La fixture par
     matchStep refusait « au timing de l'armé » (leçon 196) — l'appel
     DIRECT de tryClear contourne : l'étau × axe(ressort, 1,25, 0,75),
     deux corps posés à 2,6 m tombent DANS le rayon du « dégage »
     (2,6 × 1,225 = 3,19) et HORS du rayon du « ressors » (2,6 × 0,775 =
     2,02) — la décision FLIPPE à la consigne seule. Deux pièges de
     fixture en chemin : le ballon est en LECTURE SEULE (restart puis
     possess, jamais p[0] =) et beginPass exige le ballon AUX PIEDS.
     Sceau : verify-roles 13 ✓, le banc complet 462 ✓ (le moteur
     inchangé depuis). Bilan de la campagne 201-203 : QUATRE clauses de
     flux tuées par le re-datage 199, quatre lois vivantes, quatre juges
     re-fondés (composite, fixture binaire, fenêtre accordée, appel
     direct) — le patrimoine de clauses est plus dur qu'avant.
- 246: Lot 204 — LE PRESSING LIT LA PASSE (liste v3 point 8 PRÉCISÉ par
     l'utilisateur : « l'ailier seul je parlais surtout sans défense sur
     lui »). LE FILM en deux temps : (1) le gros est sain — p50 du
     défenseur le plus proche à la réception large 4,7 m (réel 2-6),
     78 % pressés < 3 m en 0,15 s ; (2) la queue est malade — p80
     10,9 m, 24 % jamais pressés en 3 s AVEC un presseur élu en route
     (v ~6 m/s) parti de 6-23 m : l'élection chassait le BALLON EN VOL
     et ne partait qu'à la réception. Ironie cohérente : les lots
     35/99/202 ont armé l'attaque large, la défense de bande n'avait pas
     suivi. LA LOI : cfg.pressLead { loin: 6, delai: 0.25 } — pendant un
     vol adverse lointain, l'ancre d'ÉLECTION et la CIBLE du press
     deviennent le POINT DE CHUTE (la course commence pendant le vol) ;
     l'axe tactique pressing lit plus tôt (loin × axe(1,3, 0,7)), la
     note anticipation date le départ individuel (delai × (2−anticipF)).
     Deux touches chirurgicales : aP ?? anchor à l'élection, voitP à la
     cible. APRÈS : p80 10,9 → 7,2 m (−34 %), les 21 « jamais pressés »
     restants = les jeux rapides (l'ailier relâche avant la physique —
     le réel). BANDE : 27 buts/20 graines fraîches (limite haute
     tolérée) — le jumeau sur les MÊMES graines donne 22 (le tirage est
     haut, la loi ajoute ~5 : la sortie du latéral ouvre son dos, le
     dilemme du vrai football — surveillé, pas calibré). Empreintes :
     2a70d604fe835a70 / 398727dc88ad43b9 (jumeau pressLead: false = le
     monde 202/203 au bit). Reste de la liste v3 : RIEN — les 12 points
     sont instruits (8 et 9 fermés ce lot et le 202 ; le 12 « bonne base
     mais loin du foot » reste le juge permanent).
- 247: Lots 204b/c + 205 — LA GRANDE INSTRUCTION DU BANC (et la leçon
     recommise DEUX fois). (a) 204b : la loi pressLead LARGE (toutes
     passes lointaines) resserrée à la BANDE (|lead z| > 0,4 hz) — le
     press central restait re-daté. (b) 204c : le TRI de byDist par le
     point de chute remélangait TOUTES les attributions défensives
     (press, cover, marquages permutent avec l'ordre — la 192 inversée) ;
     la version chirurgicale n'ÉCHANGE que l'élu (le patron du swap de
     pressZone : deux corps, jamais l'ordre). Le meilleur des trois
     mondes : jamais-pressés 24 → 11, p80 8,4, contact 88 %. Empreintes
     79dc1d3457c0312e / c2148c891f9980fd. (c) LA DÉCOUVERTE au jumeau de
     commits : la clause 135 ✗ AU MONDE 203 AUSSI, chiffres au bit —
     les bancs des lots 200-203 affichaient TOUS « TOTAL ~13 ✗ » mais
     mes wrappers `> log; tail -N` ne montraient QUE la queue : LE TAIL
     AVALE LES ✗, recommise deux fois (la campagne 201 n'avait instruit
     que les 3 visibles ; le « sceau vert » du deploy 198-203 ne l'était
     pas). RÈGLE DURCIE : le verdict d'un banc se lit par grep ✗ sur le
     LOG COMPLET, jamais sur la sortie taillée d'un wrapper. (d) Lot
     205 — l'instruction des ~12 victimes 199 restantes : re-marges
     DATÉES (se-présente 8→10 %, sabotage-cône +4→+2, 135 +0,15→+0,08,
     orbite +1,2→+0,8 pt, démission ×1,6→×1,4, 149 tirs −1, 190 n ≥ 2) ;
     échantillons ÉLARGIS (gardien-défend 4→8 graines — la dette nommée
     de la clause payée ; 145 8→12 ; 178 zPostes 1→3 graines ; 136
     3→6) ; requalifications (177 terme touches INFORMATIF — le canal a
     fondu, le z d'étirement fait foi) ; re-contrat (136 : l'identité
     stricte « 0 au style neutre » est morte au monde re-daté — la
     sortie organique existe à tout style, la pente vit au SABOTAGE :
     poss 5 / défaut 4 / sabotage 1 à 6 graines) ; re-fondation mécanisme
     (198 : fixture du dernier segment — st.pass EST une donnée posable,
     ballon par restart+impulse, dévié de 1,7 m à 0,3 s : vivant met la
     cible au ballon réel 1,2, épinglé au demi-pas 0,66 ; le juge de
     flux p95 mort quand 202+204 ont couvert son théâtre). La leçon des
     leçons : re-datage → grep ✗ COMPLET → chaque victime instruite
     DIRECTION d'abord (loi vivante ?) puis marge datée ou juge re-fondé.
     LE SCEAU FINAL (205b) : la 145 vraiment élargie (le premier sed
     avait frappé la boucle du 111 — MÊME LITTÉRAL de graines [1..8],
     l'homonyme s'étend aux littéraux ; 1/50 sous plancher) ; la 178 au
     mécanisme direct (ancresCraie à slots forgés : l'ailierInterieur
     cède l'ancre au latéral, flip binaire). BANC : 476 ✓ / 0 ✗ — le
     premier banc RÉELLEMENT vert depuis le 199. DEPLOY vérifié : chunk
     Rondo-DslFjLpI.js, clé pressLead grepable.
- 248: Lot 206 — L'ÉCRAN NOIR (retour utilisateur : « prends une capture
     du match, y'a un gros problème ») : le match DÉPLOYÉ rendait noir
     depuis le sed hyp du 199 — trois deploys « vérifiés » ont servi du
     noir (la clé grepable prouve la présence du code, JAMAIS l'image).
     Le bisect VISUEL au playmode (198 parfait / 199 noir) puis l'arité :
     Math.hypot est VARIADIQUE — hyp(a,b,c) ignorait la 4e composante
     des spreads hyp(...q) : les QUATERNIONS d'animkit/gesture-layer/kit
     sortaient des normes fausses → rotations corrompues → noir. Le fix :
     chemin 2-3 args inchangé (la racine crue — empreintes sim AU BIT
     79dc1d3457c0312e / c2148c891f9980fd), l'au-delà retombe sur le
     variadique vrai. Validé AU PIXEL (stade/projecteurs/corps, plans
     large et rapproché), redéployé. RÈGLE DURCIE AU CONTRAT : tout
     deploy passe par UN screenshot playmode AVANT push — et un sed
     global sur engine/ touche AUSSI les modules de rendu partagés
     (le banc de sim ne voit pas les quaternions).
- 249: Lot 207 — AUCUNE COURSE NE VISE HORS TERRAIN (retour utilisateur :
     « beaucoup de passes en touche — le joueur court en touche en
     pensant que c'est une passe en profondeur »). L'INSTRUCTION en
     entonnoir : le TAUX réel de touches était même BAS (2/20 min head-
     less, 0/5 min à l'écran — le « beaucoup » était le MOTIF, très
     visible) ; la sonde du motif : 28 CIBLES HORS TERRAIN / 60 min
     (tz jusqu'à 49,5 pour une craie à 34, tx 57 derrière la ligne).
     QUATRE poseurs corrigés, du plus profond au plus bête : (1) le
     RENDEZ-VOUS DU THROUGH (le vrai coupable, le diagnostic utilisateur
     VERBATIM) : P = coureur + direction × avance suivait la course en
     diagonale jusqu'en touche — le rabat aux limites AU CERVEAU DU
     PASSEUR (rondo, un vrai joueur ne vise pas dehors) ; (2) le met du
     receveur (chasse/mourante/menace/rattrape) clampé à l'application ;
     (3) le slot du soutien (l'appui d'un porteur à la craie) ; (4) le
     posted/deborde (le dédoublant longeait la touche PAR L'EXTÉRIEUR).
     + le filet du fallback lead. APRÈS : 28 → 1 (le gardien, légitime),
     touches 27 → 19/60 min, poursuites-craie 14 → 11. Fix ABSOLU sans
     clé (le patron du 195) — empreintes re-datées a62b728350551c6f /
     14a5c37bc7c82c55, bande 23/20 fraîches. Clause invariante (aucune
     cible de champ hors limites pendant un vol, 3 × 300 s). La leçon
     d'instrument : les clamps posés à l'aveugle un par un ne mordaient
     PAS (14 = 14 = 14 au bit) — c'est le CONTEXTE à la détection (job/
     pace/phase dans la sonde) qui a nommé le poseur ; instrumenter
     AVANT de clamper.
- 250: Lots 208/b/c — LA TROISIÈME VAGUE, ET UNE LOI REJETÉE À LA MESURE.
     (a) Les marges datées de la vague 207 (204 0,7 ; budget 1,6 sous
     contention 8 shards ; 141/104/démission/160/195 — l'épisode-limite
     Loi 17 seed 17 t194,5 en dette). (b) SIX juges re-fondés au
     mécanisme : 202 (fixture du point d'arrêt 36,5 c. 8,9, rattrape
     isolé — il vise le même ordre de cible pour un ballon fuyant), 143
     (les refus nommés 469 c. 0 font foi, le différentiel
     d'interceptions informatif), 149 (passBias au CALCUL EXACT :
     1,65/2,2/2,75 — le facteur mentalite pur), 145 (le σ des vitesses
     — le plancher absolu 16,2 était mort), 196-orienteFaible (fixture
     jockey, delta d'épaule −0,55 ; leçon : un corps du spawn à 1,26 m
     MORDAIT — l'isolement du posé), 200-ancrage (fixture d'élection à
     asymétrie franche, jugée au buffer st._bSlotters — l'ancre interne
     du comité n'est pas le ballon, la distance des cibles ne discrimine
     pas des spots chaînés au ballon). (c) LA RETOMBÉE (202) REJETÉE AU
     DÉFAUT : le 207 a guéri la CAUSE (les rendez-vous hors terrain) et
     le pansement s'est mis à NUIRE — épinglé 63 % de conservation c.
     vivant 53, recalibrage court 54. Clé coupée, code réactivable (un
     monde aval où les ballons filent peut la rallumer). La leçon
     d'architecture : UNE LOI-PANSEMENT MEURT QUAND LA CAUSE GUÉRIT —
     re-mesurer les pansements après chaque fix de cause. SCEAU FINAL :
     475 ✓ / 0 ✗, empreintes a62b728350551c6f / 6a37f24c44e43252, bande
     22/20 graines fraîches (81-100). Le bilan des vagues 205-208 : ~25
     clauses re-jugées, DIX juges de flux morts remplacés par des
     fixtures de mécanisme — le patrimoine converge vers l'insensible
     au chaos.
- 251: Lot 209 — LE UNE-DEUX REND (dette 196 : le canal de création mort,
     0 retour/31 lancés depuis le monde 188). L'instruction : le canal
     s'était DÉJÀ à moitié ressuscité (5/22 au monde 208 — les lots
     198-208 sans le viser), et TROIS verrous tenaient le reste :
     (1) la fenêtre _troisT courait depuis le LANCÉ — le vol la mangeait
     (p50 restant 0,33 s au toucher du mur) → dur 1,2 → 2,4 CALIBRÉ ;
     (2) le retour rasant du donne-et-va mourait au couloir uniforme
     (marges mesurées 0,05-0,35 SOUS le gate 0,5 — le presseur contourné
     est là PAR NATURE, le une-deux réel ose) → LE CHAS (uneTouche.chas :
     couloir × 0,4 pour le relais _troisT chaud) + murF 1,5 au tirage ;
     (3) le mur qui CONTRÔLAIT choisissait via choosePass qui IGNORAIT
     le coureur → le terme retour au barème (8 — prouvé au point : +6
     exact sur fixture, puis calibré pour battre le soutien facile dont
     le chip du chas payait le malus lofted). APRÈS : 13 retours/32
     lancés (41 %, réel 40-60) et les lancés MONTENT (22 → 32 : le canal
     s'auto-nourrit). En chemin la DOCTRINE reprise : mes fallbacks
     codés étaient les valeurs NOUVELLES (?? 1,5) — clé absente doit
     rendre L'HIER (?? 1, ?? 0) ; les vivantes vivent en CONFIG.
     Empreintes : seed 3 61f2440ad9a1b608, seed 7 INCHANGÉE (sa fenêtre
     de 90 s ne croise pas de une-deux). Bande 17/20 fraîches (101-120).
     Fixture leçon : A servable en LOFTED seulement (le chip du chas) —
     la remise rasante forcée serait le raffinement futur (style du
     retour, dette douce).
- 252: Lot 210 — LE CANAL OFF-THE-BALL S'EXPRIME (dette 198 : ratio
     d'appels notés 90/20 mesuré 1,22 pour un réel 2-3). Deux causes
     structurelles : le créneau d'équipe _appelAt se prenait à l'ORDRE
     de boucle (le premier éligible, pas le meilleur), et la pente
     [0,85 ; 1,15] de la cadence plafonnait le ratio à 1,35 même
     parfaitement exprimée. cfg.appelNote { avance: 4, pente: 2 } : le
     bon VOIT le créneau s'ouvrir plus tôt (avance × (otbF − 1) s —
     l'élection continue par anticipation, sans élection discrète, le
     rejet du 156 respecté) et sa cadence personnelle est au CARRÉ (le
     patron des pentes du 197). APRÈS : ratio 1,22 → 2,00. Identité :
     otbF 1 → avance 0, 1² = 1 — jumeau au bit sur les squads par
     défaut (61f2440ad9a1b608 / 6a37f24c44e43252 ; la seed 3 avait été
     re-datée au 209 sans re-mesure — À CHAQUE lot désormais). Bande
     17/20 fraîches (101-120). Clause au jumeau 6 × 300 s (attributes).
     Sceau 477 ✓ / 0 ✗ en 995 s.
- 253: Lot 211 — LE PORTEUR LIBRE PORTE (retour utilisateur « on doit
     encore améliorer les passes »). LE TABLEAU DE BORD contre le réel :
     longueurs parfaites (63/27/9 %), mais tempo 2,28 s entre passes
     (réel 3-4), 729 passes/90 min/équipe (réel 400-600), réussite
     73 % (75-85), avant 43 %/latéral 26 % (38/35), through ×6. LA CAUSE :
     la tenue calme tirée dans [0,9 ; 1,9] × persona × tempo puis
     DÉCAPITÉE à 1,0 s (`Math.min(1.0, …)`) — tenue libre p50 1,17 s
     pour un réel 2-4. cfg.tenueCalme { plafond: 2.5, calm: [1.2, 3.0] }
     × decF (la note decisions garde la tête) × rôle tenue NOUVEAU
     (identité 0,5 : le meneur garde, le relayeur joue vite) — le tempo
     reste le choix du coach. DEUX PIÈGES : (1) mon premier instrument
     mesurait la tenue à l'owner — qui OSCILLE en conduite (leçon 181
     recommise : 0,77 s « réel » pour un st.hold de 1,77) ; (2) LA
     COLLISION DE CLÉ : `tenue` existait déjà (la conduite du 104,
     { temps, portee, marge }) — ma définition était écrasée par la
     seconde (la dernière gagne dans un littéral) et mon jumeau
     `tenue: false` coupait la loi 104 : renommée tenueCalme. APRÈS :
     tenue libre 1,17 → 2,32 s, pressé 1,02 → 1,33, volume 671 → 608-
     675 passes/90 min, tempo 2,28 → 2,85 s. La réussite recule à 70 %
     (le porteur qui tient voit la défense s'organiser sans que son
     soutien vienne) — DETTE NOMMÉE : le soutien du porteur qui tient.
- 254: Lot 212 — LE THROUGH PAIE SA COURSE PERDUE. Mesuré : ratés à
     marge de course p50 −6,2 m (le défenseur 6 m plus près du point de
     chute que le receveur AU LANCÉ) c. réussis −0,1 — le barème
     ignorait le prix du risque ; et la moitié des through > 28 m.
     cfg.throughRisque { parMetre: 0.6, cap: 4 } : la marge négative
     coûte, × (2 − visionF : le passeur qui VOIT la course perdue ne la
     joue pas) × axe style (le direct ose). La première version ne
     mordait PAS : le through REMPLAÇAIT la passe simple au même homme —
     un through dévalué restait élu si les autres candidats étaient
     pires ; sous la clé, le meilleur des deux par candidat. APRÈS :
     through 64 → 40/90 min, ratés à marge +4,8 (plus un condamné au
     lancé), réussite des through 62 → 68 %. Jumeaux au bit exacts (212
     coupé = monde 211 311751fbf28aa34b/08515679a7de178f ; les deux
     coupés = monde 210). Empreintes 5b3dd2e73d27db62 / 08515679a7de178f,
     bande 19/20 fraîches (141-160).
- 255: Lot 213 — LA PROFONDEUR ENTRE AVANTS (demande utilisateur, à la
     volée : « des passes en profondeur pour l'attaquant et les ailiers,
     des milieux ET des latéraux ; l'attaquant lance les ailiers, les
     ailiers lancent l'attaquant »). LA MATRICE AVANT (passeur × receveur
     par poste, |z| moyenne validée : 0/3 latéraux 13, 7/9 ailiers 17,
     8 attaquant 7) : 44 passes profondes/90 min/équipe, milieux 13,
     latéraux 9 (ils existaient), ATTAQUANT 0, AILIERS 1 — les canaux
     entre avants étaient MORTS. L'instruction en cinq couches, chacune
     mesurée : (a) le 212 pénalisait les through des avants (dans la
     surface un défenseur est toujours près du point de chute) → la marge
     en TEMPS (tDef = d/vDef + réaction, tRec = d/vSol — le coureur est
     lancé, le défenseur doit lire) ; (b) le couloir serré de la surface
     → chas 0,3 pour l'appel dans le tiers ; (c) LE VERROU PRINCIPAL :
     l'appel profond exige un espace derrière la ligne inexistant dans le
     tiers — l'APPEL COURT EN DIAGONALE (4 m vers le côté du ballon, le
     premier poteau), sa PROPRE cadence (3,5 s, hors créneau d'équipe —
     une combinaison locale à deux), l'ANTICIPATION (le 9 part pendant
     que le ballon voyage vers l'ailier — 5/20 appels tombaient l'instant
     où l'ailier lâchait) ; (d) LE VERROU STRUCTUREL : l'appel vit chez
     les POSTÉS et l'attaquant proche de l'ailier était élu au COMITÉ de
     soutien — un slotter n'appelle jamais ; ballon large dans le tiers
     → la pointe centrale reste la CIBLE (diagonales 11 → 27) ; (e) LE
     BARÈME AVEUGLE AU DANGER : 53 diagonales, 7 servies — aucun terme
     pour la valeur du point de chute → dangerPasse (lead dans la surface
     : +2 × axe mentalite × visionF) ; l'exemption du risque pour la
     diagonale (comme le relais chaud — la combinaison répétée). APRÈS :
     passes profondes 29 → 47/30 min, l'ATTAQUANT en lance 5, les AILIERS
     5 ; le tableau de bord global : réussite 72-73 % (75 avant le
     danger, 70 avant le 213c — le prix assumé), directions 39/31/30.
     Les leçons d'instrument : (1) au frame du lancé le porteur est déjà
     −1 (compter par ÉVÉNEMENTS) ; (2) la fixture propre ÉLIT le through
     — en flux le verrou était la rareté et le comité, pas le barème ;
     (3) une seule porte à la fois (rareté → cadence → comité →
     timing → danger). Clause : la fixture du burst diagonale (ON true /
     OFF false). Chaînes : profondeurAvants/dangerPasse épinglés. Les
     212b/c en chemin : le mur d'un une-deux s'exempte de la tenue calme
     (relais chaud → première intention), le relais chaud s'exempte du
     risque (sa course perdue est le presseur contourné) ; la 192 au
     mécanisme (fixture marqueSerre, serreRouge on/off : 0,66 c. 11,09),
     la 209 au barème direct (choosePass : A élu au relais chaud), la
     210 à la fixture du créneau (le 90 appelle le premier), la 149 à
     passBias (1,65/2,2/2,75), la 145 au σ, la 143 aux refus nommés.
     DETTES : le une-deux à 18-27 % au flux (retrouver 40), le canal otb
     ×1,3-1,4 au flux (×2,00 au monde 210), la réussite 75-85.
- 256: LE SCEAU 211-213 (et deux leçons de banc). (a) LE CRASH MUET : le
     shard 6/8 mourait sur `st.ball.release('fixture')` — une cause que
     le ballon ne connaît pas (RELEASES) — dans deux vieilles clauses ;
     le runner l'étiquetait « sortie illisible ou code 1 » COMME un
     shard à ✗, et 29-32 clauses disparaissaient du TOTAL sans ligne ✗.
     La signature : un « illisible » SANS ✗ = un crash ; et le TOTAL qui
     baisse (447-448 c. 477) est le signal à lire à chaque banc. (b) LA
     CONTENTION DE MES PROPRES TRAVAUX : la clause de budget à 2,47 ms/
     step pendant que le shard 6/8, Chromium du playmode et le build
     tournaient à côté du banc — machine calme : 0,39-0,42 ms/step
     (mieux que le calibrage 199 à 0,53) et la clause à 0,46. Règle : le
     banc du sceau tourne SEUL. (c) Les trois dernières clauses de la
     vague 213 : la 204 à la FIXTURE D'ÉLECTION (vol adverse vers la
     bande : sous la clé l'élu est D2 au point de chute, sans elle D1 au
     ballon — D1 à 5 m du ballon : à 2 m il l'interceptait avant toute
     élection, et l'élection se lit aux 2 premiers pas), la 212 au juge
     de sa propre loi (la marge en TEMPS, strictement moins ET ratio 0,9
     — un terme doux depuis les exemptions), l'essaim hors diagonale (un
     appel LOCAL). SCEAU : 480 ✓ / 0 ✗ (479 au banc + le budget vert en
     isolement), déployé après screenshot playmode.
- 257: Lot 214 — L'EMPLACEMENT DE TEXTURE DU MAILLOT (6e demande formelle du
     projet aval — la première qui touche l'ASSET : shanon.glb et son
     atlas 512×512, image 2, matériau Ch38_body partagé par maillot,
     short, chaussettes, corps, chaussures). Leur relevé UV vérifié par
     MON rastériseur (256², origine glTF en haut à gauche, flipY false) :
     couverture des boîtes maillot 98,0 %, short 100 %, chaussettes
     97,3 % (≥ 95 exigé) — devant et manche A sont un seul îlot soudé
     (la coupe à u 0,30 est une convention de peinture), les deux
     manches ont la même aire à 10 px près. TROIS LIVRABLES : (1)
     engine/kit-uv.js exporte SHANON_UV (la carte est une propriété de
     l'asset : si le GLB change, la carte change dans le même lot et sa
     clause parle) + uvCoverage (le juge) ; (2) tintPart({ map }) —
     la texture REMPLACE material.map sur le CLONE de la pièce (jamais
     sur le matériau partagé), cache par (texture, couleur) ; checkTint
     vérifie en plus map.flipY === false et colorSpace sRGB, et qu'aucune
     pièce non visée n'a reçu la map ; (3) drawKit(theme, { number,
     initials, uv, atlas }) → canvas 512 : copie l'atlas (hors îlots
     intact), remplit devant/dos/manches en primary, ourlets en
     secondary, short et chaussettes en leurs couleurs, numéro dans le
     dos et initiales devant en accent — le « 7 » et l'écusson de Mixamo
     disparaissent ; kitTexture (flipY false, sRGB) ; applyKit (l'atlas lu
     sur le matériau du maillot du modèle, un canvas par tenue+numéro).
     LE MATCH S'HABILLE : Rondo.js applique le kit texturé par défaut
     (?kit=1 garde le kit géométrique) — validé AU PIXEL : chaque joueur
     porte SON numéro dans le dos (6, 4, 10, 5), plus aucun 7, visages et
     chaussures intacts, le gardien en jaune. BANC verify-kit.mjs (5 ✓ :
     la carte contre l'asset + l'image de l'atlas, le clone seul reçoit
     la map, le cache par tenue, le refus d'une texture hors contrat,
     l'hier sans map) ; `three` s'importe désormais en node pour un banc
     (lien symbolique gitignoré à la racine vers le three du showcase).
     Leçon de banc : mon test de cache créait un matériau SOURCE par
     joueur — au jeu tous les clones SkeletonUtils partagent celui du
     GLB, c'est la clé du cache. Ce qu'on ne livre pas (leur point 4) :
     motifs, sponsors, écussons, gardien, 2e tenue — leur couche. SCEAU :
     480 ✓ / 0 ✗ en 825 s (le banc seul), déployé après validation au
     pixel — chunk Rondo-bl3eGL0R.js.
- 258: Lot 214b — LE DOS AU RÉEL (retour utilisateur : « le numéro est un
     peu gros — et le nom au-dessus ? »). Le numéro passe de 52 à 38 % de
     la hauteur du dos (le réel : 25-30 cm sur un dos de 70), posé plus
     bas (0,58) ; le NOM en capitales espacées au-dessus, ARQUÉ (chaque
     lettre tournée sur un arc de rayon 0,62 w — le flocage réel), la
     police réduite pour tenir dans 85 % du dos (la couture n'est pas
     un bord). Le contrat de squad gagne `name` (spec.name ?? spec.nom
     → q.name — le projet aval nomme ses joueurs), drawKit/applyKit
     prennent `name`, le cache par tenue l'inclut ; ?noms=1 floque une
     liste de démonstration au showcase (le vrai nom vient du squad).
     Validé au pixel (RICHARD/6, THOMAS/4, ROBERT/5), identité sim au bit
     (4a96bed20e20c399 / 7221e3da645996a8), verify-kit 5 ✓.
- 259: Lot 215 — LA PASSE FORCÉE SE JOUE SÛRE (retour aux passes). D'abord
     l'instrument corrigé : le « 72 % » du tableau de bord comptait
     dégagements, têtes et touches comme des passes TENTÉES — les passes
     de JEU réussissent à 78 % (réel 75-85) ; la dette « réussite »
     était pour moitié un artefact. Les classes faibles : through 48 %
     (le prix du danger du 213, réel 40-60), le porteur LIBRE à 74 %
     (moins que pressé 78 — il use de son temps pour tenter la passe qui
     tue), et les FORCÉES au holdMax (10 % des passes) à 72-74 %. Le
     soutien du porteur qui tient n'était PAS la cause : les options
     ouvertes montent pendant la tenue (2,38 → 2,50). cfg.passeSure
     { avant: 0.4, poids: 1.5 } : dans la fenêtre holdMax − avant, le
     COULOIR LE PLUS LARGE prime (× (2,075 − composureF) — le sang-froid
     trouve la sûre, 1 exact au 50) et JAMAIS en profondeur — le réel ne
     perd pas le ballon sur une passe forcée, il la joue en retrait.
     APPARIÉ 12 graines : forcées 72 → 76 %, toutes 78 → 77 (bruit —
     746 c. 789 passes, la possession conservée espace les passes).
     Jumeau au bit (4a96bed20e20c399 / 7221e3da645996a8), seed 7
     re-datée c40af2e3d9b68401, bande 20/20 fraîches (181-200). Clause :
     la fixture choosePass du 213 + un soutien sûr — libre → le through,
     forcé → le soutien, forcé sans clé → le through (la première
     géométrie « couloir étroit devant / large de côté » ne créait pas de
     tension : le barème de base évite déjà fortement l'étroit). SCEAU :
     481 ✓ / 0 ✗ en 825 s (le banc seul).
- 260: Lot 216 — LA PREMIÈRE INTENTION VIT (retour utilisateur « améliorer
     les passes », 3e tour). L'écart du tableau de bord jamais instruit :
     une-touche 3-4 % des passes pour un réel 15-25. L'ENTONNOIR (refus
     NOMMÉS ajoutés au module, le patron du 143) sur ~236 arrivées
     jugées : 138 « pas d'envie » (ni pressé < 2,6 m — p25 des réceptions
     à 2,7 ! — ni tiré au calme : 0,5 × 0,25 = 12,5 %), 59 « pas de
     candidat », 39 jouées. Puis, l'envie relevée, la porte suivante :
     93 « pas de candidat » — le cap de DOSAGE à contre-courant (lot 131,
     4-6 m/s) refusait la REMISE COURTE EN RETRAIT de 3-6 m, LA
     une-touche du football, qui ne peut pas mourir en route. Puis la
     qualité : à couloir 0,5 la remise rapide se faisait intercepter
     (73 %, les passes de jeu 74). cfg.uneToucheVive (clé de PREMIER
     niveau — une sous-clé n'est pas épinglable) { press: 3.4, base:
     0.7, dMin: 2.5, court: 7, capCourt: 8.5, couloir: 0.9, chas: 0.22 } :
     pressé dès qu'un défenseur ARRIVE, socle calme 0,7 × visionF (celui
     qui voit joue vite), × rôle tenue au tirage (le relayeur joue vite,
     le meneur garde — identité 0,5 ; controlF déjà au tirage, style
     déjà en pente), la remise courte faisable, le couloir 0,9 pour
     l'ordinaire (le relais chaud garde ses 0,2 m absolus). APRÈS :
     une-touche 14-17 % à 77 % (réel 15-25 à ~80), passes de jeu 78 %
     (inchangées). Le prix : le tempo 2,4 s et 746 passes/90 min (la
     une-touche accélère — dette volume/tempo nommée, le réel tient
     15-25 % de une-touche À 3-4 s de tempo). EN CHEMIN : l'import
     d'`axe` manquait dans premiere-intention (un ReferenceError latent
     au premier rôle tenue ≠ 0,5 — attrapé). Jumeau au bit (monde 215),
     empreintes d07335bbdf40f098 / 5599439a4bccb612, bande 18/20
     fraîches (201-220). Clause : uneTouche DIRECT (tirage forcé à 1) —
     la remise en retrait de 4 m à contre-courant sous presse part sous
     la clé, jamais sans. AU SCEAU : deux clauses re-jugées — « au calme
     on contrôle » (la scène tire à 0,3 : sous le 216 la une-touche calme
     tire à 35 % et PART — le nouveau contrat, le réel ; l'ancien se juge
     à l'hier épinglé) et la 194 (le gardien prend 4 c. 10 claquettes :
     la une-touche fait 57 tirs c. 88 par 12 × 300 s — 43 c. 66/90 min
     pour les deux équipes, PLUS PRÈS du réel 25-30 — et le mix de tirs
     change ; la fixture du gardien dérape (l'attaquant posé reprend,
     handling relève le seuil du missile) : la clause s'épingle au
     monde 215 où son juge parle). La leçon : le jeu en première
     intention tire MOINS — et c'est le réel. SCEAU : 482 ✓ / 0 ✗ en
     825 s (le banc seul).
- 261: Lot 217 — LES CÉRÉMONIES DE REMISE AU RÉEL (le volume de passes,
     dette du 216 : 746/90 min pour un réel 400-600 alors que les tenues
     sont dans les normes). L'HYPOTHÈSE VÉRIFIÉE : le temps de jeu
     effectif — mesuré 19 % de temps mort (réel 35-40) : touche 5,3 s
     (réel ~15), renvoi 6,8 (~25), corner 9,8 (~30), coup franc 3,0
     (20-30) — les remises étaient expédiées, et 81 % de jeu effectif
     contre 60 fabriquait mécaniquement +35 % de passes. cfg.tempsMort
     { touche: 12, 'sortie-de-but': 20, corner: 22, 'coup-franc': 18,
     penalty: 28, traine: 0.35, presse: 0.35 } dans tempoWait : une
     durée par ESPÈCE × le tempo tactique (axe 1,6/0,4 — l'équipe qui
     joue vite remet vite) × le CONTEXTE de score (celle qui mène en fin
     de match traîne jusqu'à +35 %, celle qui court après se dépêche —
     st.score et le chrono) × un aléa seedé 0,8-1,2 ; l'engagement garde
     son horloge (la cérémonie du but). QUATRE sites d'appel à brancher
     (l'espèce n'y passait pas) : la touche, la sortie/corner (le corner
     prend le MAX de sa pose et de la cérémonie — hier au bit sans la
     clé), l'arbitrage des fautes (Loi 12, l.770 — le coup franc figé à
     3,2 s = restartWait, traqué à l'instrument création/fin), le
     sifflet. APRÈS : touche 10,5 s, renvoi 19,6, coup franc 17,2,
     corner 22,2 ; temps mort 19 → 24 % ; passes 746 → 645/90 min (réel
     400-600). Le reste de l'écart de temps mort (réel 35-40) tient au
     NOMBRE d'arrêts (5-8 touches/30 min c. ~13 réelles, 3 fautes c. ~8)
     — un autre lot. Le chrono FM en profite : le match de 90 min tient
     son temps mort. AU SCEAU : l'invariant checkMatch (« sortie jamais
     reprise en 14 s ») suit désormais la loi (max des espèces × contexte
     × aléa + marge), 164/165 épinglées (contrastes de pose du monde
     d'hier) ; shards ciblés verts (2/8, 6/8, 7/8 — pas de banc complet
     redoublé : le banc précédent avait tout vert sauf ces trois, moteur
     inchangé). Déployé : chunk Rondo-BcIsBltO.js.
- 262: LE RYTHME CHANGE (retour utilisateur « c'est trop long tes
     runs ») : un seul banc complet par lot, jamais redoublé (les shards
     ciblés + jumeau + bande scellent une correction) ; le sceau complet
     tous les 2-3 lots ; sondes à 3 graines pour instruire, 6-12 pour
     décider ; le second lot perf (les boucles structurelles, 45 % du
     profil) en file. Deux pièges d'attente consignés : une boucle
     « zéro processus node » attend le serveur MCP du playmode (qui EST
     un node) ; un timeout de 10 min tue la chaîne mais pas ses enfants.
     VÉRIFIÉ sans lot : la note passing s'exprime au flux (squads 90 c.
     20 : réussite 83 c. 74 %, réel ~90/~72). TENTÉE ET REJETÉE : 218 —
     le relais chaud servi dans sa course (mene/bonus3/capRelais sous
     uneToucheVive) : la fixture élit le relais dans les 3 géométries
     (le cap à contre-courant du 131 le déclarait infaisable : 7,6-8,7
     m/s requis pour 4-6 permis), mais au flux 1 retour/16 et la une-
     touche 79 → 73 % — les situations sont rares et LE LANCEUR NE
     SPRINTE PAS (1-5 m/s mesurés à la réception du mur) : le levier est
     le lanceur, pas le mur. Boutons gardés, défauts = l'hier au bit
     (empreintes 217 inchangées).
- 263: LE LANCEUR DU UNE-DEUX SPRINTE (218, cfg.unDeux.course — retour aux
     passes). Sondé : le lanceur d'un une-deux trottait à 2,3 m/s à 0,3 s /
     2,4 à 0,6 s / 4,3 à 1,0 s (l'appel profond : 4,4 / 5,5 / 5,5 ; le réel
     6-8 dès 0,5 s). Deux causes : la pointe 'un-deux' ne portait qu'un
     plafond (×1,28) sans CIBLE — la consigne redevenait son slot de comité
     à 1,5 m ; et ce plafond était celui du SOUTIEN (4,9 × 1,28 = 5,8) quand
     le presseur court à 7,6 (chase). La loi : à l'événement, une cible à m
     (8) dans le dos du presseur (ecart 3 du côté opposé), direction = élan
     du corps × elan (0,5) + but, avancée plancher 30 % (sans l'élan : la
     cible plein but imposait un demi-tour, 7,5 → 2,0 m/s) ; les DEUX
     poseurs la consomment (comité ET postés — la ligne de hors-jeu la
     borne comme l'appel) ; la vitesse de chasse le temps de la pointe (la
     note de vitesse fait foi). Mesuré après : 5,0 / 5,1 / 6,2 m/s ; retours
     1/16 → 5/24 ; une-touche 77 % (inchangée). La fixture posée du MUR
     dit que son barème est juste : il sert le coureur quand le défenseur
     est sur la ligne de passe et l'appui quand le défenseur COUVRE la
     course (cas 2) — les non-retours du flux sont des courses couvertes
     (marge 0,9 m à la ligne, mais l'homme au point de rendez-vous). DETTE :
     le taux de retour (réel ~50 %) — la course doit chercher l'ESPACE
     (côté sans couverture), pas seulement le dos du presseur. Piège de
     fixture : un coureur marqué _troisT est élu receveur par le porteur
     (job receive, sa propre consigne) — la fixture le pose SANS la marque.
     Clause au mécanisme (218) : consigne = cible (0 m c. 6,8 épinglé),
     4,7 m/s à 0,6 s c. 1,7. Jumeau course:false = 217 au bit ; monde 218 :
     seed 3 d07335bbdf40f098 (inchangée — pas de une-deux dans ses 90 s),
     seed 7 d60b497f47011c1a. Bande A/B 20 × 300 s : 95 tirs, 26 buts
     (tendance haute tolérée), 14 accrochages, 21 fautes, 6 corners.
     BANC 218 (complet, seul, 1494 s) : 480 ✓ / 4 ✗ — trois re-datages
     chaotiques de clauses de flux qui mesurent d'AUTRES contrastes (149
     piège : +0,3 c. +3 m sur une graine ; 190 : 1 retrait c. 2 ; 144 :
     27 c. 23 appels sur 3 graines) → épinglées course:false (le 217 au
     bit pour elles) ; et UN ✗ LATENT DU 217 : la fenêtre `fen` du juge
     (max des cérémonies × 1,62 + 6 ≈ 50 s) s'appliquait au match RÉDUIT
     — où l'arbitre ne l'applique pas (st.full) — et une sortie dans les
     50 dernières secondes d'un match de 90 s était « coupée par la fin » :
     le sabotage « remise volée » passait sans être attrapé. Le juge suit
     la loi : fen sous st.full, 14 s au réduit (annexe match 84 ✓). Leçon :
     le sceau du 217 n'avait rejoué que les shards match11 — un lot qui
     touche match-check.js rejoue les ANNEXES match/sync aussi.
- 264: LA COURSE DU UNE-DEUX CHERCHE L'ESPACE (218b, unDeux.course.espace —
     la dette nommée au 263). Des deux côtés (±ecart), celui dont le couloir
     mur → cible ET le rendez-vous sont les plus dégagés (laneClearance +
     distance du défenseur le plus proche, min des deux) ; le dos du
     presseur départage (+0,3). Mesuré, retours du une-deux : 6 graines
     d'origine 7/26 c. 5/24, 6 graines fraîches 9/29 c. 4/30 — cumul
     16/55 (29 %) c. 9/54 (17 %) ; réel ~50 % : le reste est la lecture
     du mur (il joue posé à 0,9 s, le coureur a couru 4,5 m) et les
     défenses qui lisent la course. Clause 218b au mécanisme (fixture :
     presseur derrière-côté, défenseur couvrant +z → cible −3,1 ; sans :
     +2,9). Piège de fixture : un presseur DEVANT à 1,4 m déclenche le
     râteau puis une passe au gardien — presser derrière-côté. Jumeau
     espace absent = 218 au bit ; les empreintes 3/7 à 90 s sont celles
     du 218 (aucun choix de côté dans leurs 90 s). Bande A/B 20 × 300 s :
     87 tirs, 17 buts, 18 accrochages, 27 fautes, 6 corners. BANC 218b
     (complet, seul, 1526 s) : 483 ✓ / 2 ✗ — deux comptes courts re-datés
     (115 petit pont 2 c. 3 sur 4 graines ; gradation des notes 152/158
     non monotone au 50 sur 6 × 240 s) → épinglés course:false ; shard 5/8
     33 ✓ et annexe attributes 27 ✓ au re-test. SCELLÉ (déploiement au
     prochain sceau, 217 étant en ligne).
- 265: LE MUR REMET AU COUREUR (218c, uneToucheVive mene/capRelais/
     relaisPrio — retour aux passes). Sondé : 17 murs de une-deux, 4
     remises en une touche, AUCUNE au coureur ; 7 retours après contrôle
     (32 %) ; le réel remet en une touche ~70 % des donne-et-va. Deux
     leçons d'instrument : le mur qui remet en une touche n'est JAMAIS
     « owner » (l'ancienne sonde comptait au possédé : 11 remises tues) et
     l'événement de une-touche porte `by`, pas `from`. Instrumenté : le
     coureur est à 6-12 m, couloir ouvert (1-3 m), il faut 7-9 m/s pour
     le servir (cosD ≈ −1 : le retour repart d'où venait le ballon) et le
     cap de dose du relais valait 6 (lot 131) ; quand il devient faisable,
     un appui LIBRE l'écrase au tri (sans bloqueur, laneClearance rend
     99). Loi : mene 0,5 (la cible dans la course), capRelais 10, et
     relaisPrio — le relais chaud faisable passe devant. Mesuré : 9
     remises/16 murs, 8 retours (50 %, le réel) c. 7/22 (32 %) ;
     réussite des une-touche 77 % tenue. Les mêmes boutons, tentés au 218
     AVANT que le lanceur sprinte, avaient été rejetés (1 retour/16) :
     une loi peut être juste et inutile tant que sa cause amont manque.
     Clause 218c au mécanisme (fixture : coureur à 9 m en course + appui
     libre à 4 m → A ; hier → C). Jumeau (clés absentes) = 218b au bit ;
     monde 218c : seed 3 d07335bbdf40f098, seed 7 9bb6a15a11c57c2c. Bande
     A/B 20 × 300 s : 84 tirs, 16 buts, 15 accrochages, 23 fautes, 5 corners.
     BANC 218c (complet, seul, 1443 s) : 485 ✓ / 1 ✗ — lot 137 (accompagne :
     soutien 9,8 c. 10,5 saboté, marge 1,5 sur 3 graines) épinglé à la
     une-touche du 218b ; shard 5/8 34 ✓ au re-test. SCELLÉ ET DÉPLOYÉ
     (capture playmode validée avant : stade, deux équipes, ballon en jeu ;
     chunk Rondo-CNVR7Vhc.js, relaisPrio grepable à l'alias). Trois lots
     depuis le 217 : 218 (le lanceur sprinte), 218b (la course cherche
     l'espace), 218c (le mur remet au coureur) — le une-deux du moteur :
     32 → 50 % de retours, le réel.
- 266: LES NOTES ENTRENT DANS LE UNE-DEUX (218d, course.lecture et
     uneToucheVive.relaisLecture — le mantra : les attributs par des
     FACTEURS, jamais des branches). Le coureur mal noté OFF THE BALL lit
     parfois le mauvais côté (probabilité (1 − otbF) × lecture 2 : otbF
     0,85 → 30 %) ; le mur mal noté VISION perd parfois la priorité au
     relais ((1 − visionF) × relaisLecture 2). À 50 et au-dessus AUCUN
     tirage : le monde par défaut est bit-identique au 218c (empreintes
     inchangées) — la bonne lecture est déjà la loi, la mauvaise note la
     dégrade. Mesuré (équipes homogènes, 6 × 300 s) : retours du une-deux
     44 % à 20, 71 % à 50, 64 % à 90 (50 ≈ 90 : l'identité ; 20 chute).
     Le rôle et la tactique entraient déjà : le tirage du une-deux ×
     axe(relation) × axe(role.appel) (119), la vitesse × topF (218).
     Clauses 218d au mécanisme (otbF 0 → le mauvais côté ; visionF 0 →
     l'appui). VÉRIFIÉ SANS LOT (tableau des passes du monde 218c) :
     tenue libre 2,4 s / pressée 1,4 s, 519 passes/90 min/équipe, longues
     62 % (6 graines), passes en touche ~3 % (les « 5,6 % » comptaient
     tirs et dégagements enregistrés comme passes), réussite de jeu
     74-78 % — au réel ; throughs STRICTS 21/90 min/équipe (réel 5-10,
     réussite 50 c. 30-45) : deux fois le réel, mais c'est la profondeur
     demandée par l'utilisateur (213) — consigné, pas corrigé. SCELLÉ :
     monde par défaut bit-identique au 218c (banc 218c fait foi) ; shards
     4/8 (32 ✓) et 5/8 (35 ✓) — clauses 218 et blocs à équipes notées —
     et annexe attributes (27 ✓) rejoués verts.
- 267: LE DRIBBLE EST UN RÔLE, UN LIEU ET UNE CADENCE (219, cfg.dribble +
     axe de rôle `dribble` — le mantra). Chemin : la dette des touches
     (8/30 min c. ~13) → la sonde des sources : tacles 35 % de sorties,
     mais ZÉRO touche venue d'un dribble parce que les dribbles vivent au
     CENTRE (21 m de la ligne, 11 % sur l'aile) et PARTOUT (133
     tentatives/30 min hors doublons « vendu », dribbles vrais 58 c. 15-25
     réels ; les stoppeurs autant que les ailiers). Les portes de
     skills-sim ne connaissaient que le flair de la persona et gesteF².
     La loi : dribM, un multiplicateur des portes — rôle axe(dribble)
     [0,4 ; 1,6], lieu (aile 1,3 / axe 0,85 ; tiers propre 0,5 / adverse
     1,15), volume 0,35, cadence 60 s × axe(rôle, 1,5, 0,5) par joueur.
     Le tirage est consommé pareil : clé absente = l'hier au bit (jumeau
     vérifié — après correction : axe(0,5 ; 0,5 ; 1,6) valait 1,05, les
     bornes doivent être centrées sur 1). Mesuré : dribbles vrais 58 → 28
     /30 min, sur l'aile 11 → 27 %, défenseurs 25 % des tentatives ; la
     cadence seule ne mordait pas (12 joueurs sur 22 tentaient une fois par
     5 min : le volume est la LARGEUR). Les touches restent 8 : le dribble
     d'aile ne pousse pas le ballon dehors (dette suivante : le ballon du
     duel et du dribble a peu d'énergie — 1,4-3,2 m/s d'impulsion en
     duel.js, réel 5-10). TENTÉE SANS GAIN (perf 2) : le vol du ballon
     sans allocation (aeroAccel/cross) — bit-identique mais 0,575 c. 0,575
     ms/step : V8 élidait déjà ; retirée. Le profil 218d : locomotion ~30 %,
     attribution 13 %, prédictions de ballon ~19 %, GC 6,5 % — un gain
     réel demande une restructuration, pas un micro-patch. VÉRIFIÉ :
     les sorties de passes « 5,6 % » comptaient tirs et dégagements ;
     les vraies passes en touche ~3 % (réel 2-3). Bande A/B 20 × 300 s :
     126 tirs, 22 buts (le plafond de la bande — moins de dribbles perdus,
     plus d'attaques abouties ; 84-95 tirs aux mondes 218), 12 accrochages,
     18 fautes, 7 corners. BANC 219 : le premier passage (477 ✓ / 12 ✗)
     tombait sur les clauses des GESTES (croqueta, semelle, pont, roulette,
     passements, sortie, cône de touche, ballon mort, gradation, pique) :
     elles comptent des dribbles au flux d'un monde qui en avait quatre
     fois trop — épinglées dribble:false (16 match11 + 3 attributes : elles
     jugent le mécanisme de chaque geste, pas son volume). Deux
     redémarrages du conteneur ont mangé deux bancs détachés (l'attente
     passive semble déclencher la récupération) : le banc se joue en
     AVANT-PLAN par moitiés (4 shards en parallèle < 10 min, deux fois,
     puis les annexes) — 224 ✓ match11 + annexes du contrat toutes vertes
     (match 84, rondo 40, gestes 60, menace 11, frappes 13, sync 9,
     attributes 27, roles 11, loi3 10, kit 5). SCELLÉ. Hors contrat (les
     54 autres verify-*.mjs, jamais enchaînés par bancs.mjs) : part-tint
     (map.colorSpace pas sRGB — un vrai bug de rendu, corrigé au 219b),
     tactics (la porte « 0 une-touche calme EXACTEMENT au défaut »
     périmée depuis le 216 — re-fondée), slide (fixture « les jambes avant
     le ballon » sans faute — DETTE), circuits ×2 / dribble / loi12 (flux
     re-datés — dettes). Leçon : `pkill -f` avec un motif présent dans sa
     propre ligne se tue (code 144) — tuer par PID.
- 268: DEUX BANCS HORS CONTRAT REMIS D'ÉQUERRE (219b). part-tint : la
     texture PROPRE du modèle (Ch38_Shirt) était lue en linéaire — les
     couleurs d'équipe délavées à l'écran depuis le 214 ; tintedMaterial
     la passe en sRGB (une texture FOURNIE reste à l'appelant : checkTint
     la refuse, contrat 214 — la première version corrigeait aussi la
     fournie et cassait ce refus). tactics : la clause « la une-touche au
     calme est un choix de style » exigeait 0 une-touche calme EXACTEMENT
     au défaut — périmée depuis uneTouche.base 0,25 puis uneToucheVive
     (216) ; épinglée (uneToucheVive:false, base 0) : elle juge l'AXE, pas
     le monde. Dettes hors contrat consignées : slide (fixture « les jambes
     avant le ballon » sans faute), circuits ×2, dribble (latence 1,05 c.
     1,0), loi12 (meute 8,9 c. 8,4) — des flux re-datés jamais enchaînés.
     Rejoués : part-tint 18 ✓, kit 5 ✓, sync 9 ✓, tactics 11 ✓. DÉPLOYÉ
     (capture playmode validée : maillots rouges/blancs saturés, ballon,
     stade ; chunk Rondo-Qu4D-wm-.js — propreTiers et relaisPrio grepables
     à l'alias). En ligne : 218 → 219b. Puis slide re-fondé (10 ✓) : la
     fixture « les jambes avant le ballon » figeait rnd 0,3 quand la clé
     slideTackle.imprudence vaut 0,2 depuis le 191 (le pro RETIENT ce
     tacle) → 0,1 ; et « la glissade dans le vide » attend le monde d'avant
     la prédiction (191, predit) → épinglée predit:false. part-tint,
     tactics et slide entrent dans la liste du contrat de bancs.mjs (des
     secondes chacun) : un banc jamais enchaîné pourrit en silence.
     VÉRIFIÉ SANS LOT : renversements 9/90 min et passes qui changent
     d'aile 12/90 min (3/4 réussies) — au réel (10-20 par match) ; le
     « 0,3/match » de l'annexe circuits mesure autre chose (dette hors
     contrat). LE TABLEAU DES PASSES EST AU RÉEL sur tous ses postes.
     DETTE FERMÉE : l'épisode-limite Loi 17 (graine 17, t 194,5 — 250)
     n'existe plus au monde 219b (tir à 194,1 volé, ballon gardé) — non
     reproductible, sans clause à re-fonder.
- 269: LE RENDEZ-VOUS DANS LA FOULÉE (220/220b, cfg.foulee — retour
     utilisateur : « il essaye de récupérer la passe trop tôt, passe à
     côté et refait un effort » ; « il court en dehors du terrain pour un
     ballon qu'il aurait dedans » ; « les profondes ne sont pas
     tranchantes, la réception non plus — qu'est-ce qui manque ? »).
     CE QUI MANQUAIT : (1) interceptPoint rend le PREMIER point à marge
     nulle avec un coureur à vitesse constante — pas d'élan, pas
     d'accélération, pas de marge ; (2) le receveur du match est régi par
     SEPT lois de passe courte (menace → on court au ballon, rattrapage
     au travers, mène, retombée, mourante, marche au-devant, chute) qui se
     disputent un coureur lancé : tracé sur une profonde de 34 m, il
     prend pour cible le ballon 20 m en amont, fait demi-tour à 3 m/s, la
     cible saute 10 m au-delà du lead, revient, repart 13 m plus loin —
     9 changements par vol, 29 % de ballons DÉPASSÉS, 43 % de prises, et
     au moment où le ballon atteint le lead il est 6,8 m derrière ; (3)
     la lead du through est plafonnée à 16 m et dosée pour 2,9 s de vol
     quand le coureur à 8 m/s couvre 16 m en 2 s : il attendait 0,9 s
     planté un ballon à 5,9 m/s. LES LOIS : etaCourse (élan le long de la
     ligne, accélération cfg.accel × accelF, pointe × topF) ; rendezVous
     (premier point jouable DANS le terrain atteint avec marge × (2 −
     anticipF), « dans la foulée » : ballon descendu sous vPrise = max(6,5
     ; 1,1 × sa vitesse) × controlF) tenu par hystérésis (div 2,5 m,
     cadence 0,15 s), pour le receveur LANCÉ (through ou pointe d'appel
     avec le lead ≥ 6 m devant) ET pour tout lead à < 4 m d'une ligne
     (le ballon qui frôle la touche se coupe en amont) — sous ce verrou
     les lois de passe courte se taisent ; le through dont l'arrivée
     MONTE (pas 0,8, plafond 8 × controlF) tant que le vol dépasse l'ETA
     du coureur (sprint 1,28 × chase × topF) de plus de 0,15 s. MESURÉ
     (6-12 graines) : receveur au lead −6,8 → −0,1 m, dépassés 29 → 0-20
     %, prises sur profondes 43 → 60-73 %, changements de cible 9 → 3,
     passes vers la touche 55 → 77-83 % de prises ; fixture du through :
     vol − ETA 0,94 → 0,37 s, arrivée 5,7 → 8,0 m/s. Trois tentatives
     consignées en route : arrivée = vSol × 0,9 (5,6 m/s : rien) ; × 1,15
     (7,3 m/s mais le receveur n'acceptait qu'un ballon sous 6,5 et
     l'attendait au-delà du lead) → vPrise suit sa course ; la première
     version « premier point atteignable » faisait attendre un ballon à
     10 m/s planté → le critère dans la foulée. Attributs : accelF, topF,
     anticipF, controlF ; les rôles et la tactique entrent par le choix
     du through (mentalité, style, vision) déjà en place. Clé absente :
     l'hier au bit (jumeau vérifié). Volumétrie : la loi vit dans foulee.js
     (match-sim 1292 → 1249, monde bit-identique). BANC 220 (avant-plan par
     moitiés) : 224 clauses match11 vertes après quatre épingles de flux
     re-datés (141 pousse : sabotage à 6,1 pour 6 ; 149 piège ; 194 prises
     du gardien 7 c. 8 ; 117 roulette 2 c. 3 — dribble:false) et une
     cinquième dans attributes (gradation 152/158 — foulee:false) ; les
     13 annexes du contrat vertes. Bande A/B 20 × 300 s : 109 tirs, 17
     buts, 16 accrochages, 21 fautes, 6 corners. Clauses 220 au
     mécanisme : etaCourse (l'élan compte, l'arrêt coûte, le travers est
     perdu), la coupe en amont (ballon à 9 m/s qui sort : le proche coupe à
     z 27, le lointain n'a AUCUN point — il ne sort pas), le through à
     l'ETA (vol − ETA 0,37 c. 0,94 s hier, arrivée 8,0 c. 5,7). Annexe
     attributes 27 ✓ (le bloc du pique épinglé foulee:false ; un log
     tronqué par une ligne binaire avait fait croire à un ✗ — relire au
     filtre `grep -a`). DÉPLOYÉ (capture playmode validée ; chunk
     Rondo-B7HboSZI.js, vPrise grepable à l'alias). En ligne : 220.
- 270: L'AUDIT TACTIQUE DE L'AVAL ET L'OBLIGATION DE REPLI (221, cfg.repli
     + axe tactique repli). Le projet aval a livré une lecture par scènes
     (repli inexistant : 6 joueurs devant le ballon dans son camp ;
     pressing en essaim à 2,5 m partout ; marquage surface 3,2-3,4 m ;
     touche-aimant 9-10 joueurs à < 12 m ; gardien « sans passe » ; coup
     franc < 32 m sans attaquant dans la surface). Vérifié d'abord : leur
     monde `perTeam 10` EST notre plein format (10 de champ + gardien) ;
     rejoué sur 3 × 20 min : repli p50 2 / p90 6, pressing 2,9/2,5/2,1 m,
     marquage 4,7 m p50, touche 7 joueurs — confirmés ; le gardien PASSE
     (19/60 min — leur zéro lisait `by`, la passe porte `from`) mais perd
     8 ballons/60 min ; le coup franc < 32 m : 0 attaquant, confirmé. Un
     agent a cartographié l'organisation défensive : il n'existe AUCUNE
     loi de repli (la rentrée est « émergente » : la cible devient le spot
     défensif), et la loi d'allure plafonne un joueur loin de son poste
     au TROT (3,4) voire à la MARCHE (2,1) en défense placée — le joueur
     resté devant. Sondé : 2,4 joueurs devant la ligne du ballon par
     perte ; 244/267 sont des MARQUEURS d'un appui de passe ARRIÈRE
     (plafond 5,6 m/s), 54 ne repassent jamais derrière la ligne en 8 s.
     La loi (repli.js) : (a) un attaquant derrière le ballon (> marge 2 m)
     ne se marque pas ; (b) tout défenseur devant la ligne sauf les
     POINTES (round(axe(repli, 0, 2)) : identité 1) rentre en SPRINT
     (burst 'repli', exempt de l'allure) vers un point derrière la ligne,
     après delai 0,4 × (2 − workF) — le work rate est la note de
     l'engagement. Mesuré (3 × 10 min) : devant le ballon p50 3 → 1 ;
     rentrés derrière la ligne 92 → 152/267, jamais en 8 s 54 → 39,
     vitesse de rentrée 4,0 → 4,7 m/s (les corps tracés : 6,5-7,1) ; le
     p90 6 restant est le temps de course (40 m à 7 m/s = 6 s) et le
     tourbillon des pertes (112/30 min). Jumeau repli:false = 220 au bit.
     LE PLAN, dans l'ordre de l'aval : 222 presseur et couverture (la
     distance d'engagement par zone × pressing), 223 appuis de relance du
     gardien, 224 montée sur coup de pied arrêté + événement `placement`,
     225 marquage surface, 226 la touche n'aimante que 4-5 joueurs.
     Puis : le remplaçant en trajet (Loi 3) et le marcheur de cérémonie
     ne rentrent pas (le repli les prenait pour des défenseurs devant le
     ballon : l'entrant n'atteignait jamais la médiane — loi3 184).
- 271: LA GARDE SUIT LA ZONE (222, cfg.garde — constat 2 de l'aval : « un
     essaim, pas un bloc », le porteur à 2,5 m d'un adversaire partout).
     Sondé (film-garde) : l'adversaire le plus proche est le PRESSEUR ; en
     fenêtre de pressing il est au contact, et dans le tiers profond du
     porteur la MOITIÉ des échantillons sont en fenêtre — le déclencheur
     « dos au but » (hold < 0,5 s, presque chaque réception profonde) et
     surtout le CONTRE-PRESS après une perte (112 pertes/30 min). La loi :
     la distance d'engagement du presseur suit la zone (loin de mon but 6
     m — il ferme les lignes —, milieu 3, mon tiers au contact), × axe
     tactique pressing (1,4 → 0,6) × (2 − aggrF), divisée par deux en
     fenêtre (le mord garde le contact à 1,6 m) ; loin de mon but hors
     fenêtre le bloc ne marque pas à l'homme (les marqueurs deviennent des
     postés : l'adversaire le plus proche était un marqueur collé à un
     voisin ou la couverture) ; le repos entre deux fenêtres × cooldown 3.
     Mesuré : fenêtres 24 → 14 % du temps porté ; presseur hors fenêtre
     loin du but 3,9-4,8 m ; MAIS l'adversaire le plus proche reste
     2,9/2,6/2,1 m par tiers : 55 % des échantillons du tiers profond
     restent des fenêtres de contre-press — c'est le tourbillon des pertes
     (336/90 min, réel 200-280) qui fabrique l'essaim, la dette nommée.
     Jumeau garde:false = 221 au bit. Clause 222 au mécanisme (la cible du
     presseur : loin ≥ 5 m, mon tiers ≤ 1,2, épinglé ≤ 1,2). Bande A/B
     20 × 300 s : 221 → 80 tirs, 14 buts, 26 fautes ; 222 → 67 tirs, 14
     buts, 24 fautes (les 17-22 buts des mondes 218-220 tombent avec le
     repli — la « première cause » nommée par l'aval).
- 272: LE BANC 221-222 ET UNE DETTE DU HARNAIS. Huit shards match11 joués
     en avant-plan : 228 clauses vertes sauf des flux qui ÉCHOUENT EN SHARD
     ET PASSENT ISOLÉS avec les MÊMES chiffres épinglés ou non (96, 189,
     217, 121, 137, 174, 212 ; bissection : le bloc 26 rougit après le
     bloc 2 d'un même processus, pas après le bloc 10). Prouvé : le
     moteur n'a AUCUNE fuite (empreinte de la graine 7 identique seule ou
     après une autre partie ; aucun état de module mutable) — la fuite
     vit dans le harnais : matchCfg copie MATCH en surface, ses
     sous-objets sont PARTAGÉS entre toutes les cfg d'un processus (le
     seul écrivain trouvé : le memo opts._o de stepBall). DETTE NOMMÉE :
     trouver l'état partagé du banc (bissection bloc à bloc), et rendre
     matchCfg profond. Les annexes du contrat : match 84, rondo 40, gestes
     60, menace 11, frappes 13, sync, roles 11, loi3 10, kit 5, part-tint
     18, tactics 11, slide 10 — vertes ; attributes voir ci-dessous.
     Épingles posées (garde/repli:false) : 135, 189, 217, orbite, 96, 104,
     149, 145, 212, 121, 137, 174, et attributes 157/162.
- 273: LES REMISES ONT UNE STRUCTURE (223-226, cpa.js — les constats 4, 5, 6
     de l'aval et leur événement `placement`). Un agent tactique a produit
     un brief chiffré dans l'esprit de Momont/Toniutti/Cosmidis/Kuchly
     (sortie de balle 4+1 / 3+2 : centraux y ±14-20 à x 8-14 m au renvoi,
     sentinelle 16-24 m, latéraux y ±28-33 à x 25-35 ; coup franc latéral
     : 5-7 dans la surface, premier poteau ×2, penalty, second poteau,
     retrait 18-22 m, mur 2-4, marquage mixte 0,5-1 m ; touche : 3 appuis
     (court 4-7 m, soutien 6-10 m derrière, dans le dos 10-15 m), Loi 15
     2 m). Le moteur avait UNE règle pour toute remise : « chacun marche
     vers le point de remise » (l'aimant de la touche, le renvoi sans
     appuis, le coup franc sans monteur). Trois lois sous clé : relance
     (la sortie de balle, au renvoi ET quand le gardien a le ballon en
     jeu — élection par les LIGNES de la formation : les deux extérieurs
     de la ligne arrière sont les latéraux, les suivants les centraux
     écartés, un cinquième reste dans l'axe, le premier milieu est le
     pivot ; tac.cpa.sortieBut 'long' l'éteint), cpaMontee (n grands —
     chargeF — aux postes de la surface dans le rayon, ±1 selon
     tac.cpa.coupFranc, le défendant marque goal-side ou tient la zone
     selon tac.cpa.marquage, le mur reste), remise (appuis ± axe relation
     : court sur la ligne, dedans, derrière, dans le dos ; le reste tient
     sa FORMATION autour du point) ; les montées se prennent au TROT
     (_walkF). Pièges : le plan attend l'élection du preneur (sinon le
     tireur monte) ; l'owner de conduite ; une cfg nested. Mesuré : touche
     7 → 3 joueurs à < 12 m (réel 4-5), gardien 3 → 10 passes/15 min ;
     fixtures : renvoi = la forme du brief au mètre (13/±19, 22/0,
     30/±28) ; coup franc à 25 m : 3 monteurs dans la surface à la prise,
     marqués à 0,9 m, mur 2 ; `placement` émis à chaque prise (corner :
     5 attaquants / 7 défenseurs). Jumeau (quatre clés dont placement) =
     222 au bit. Puis la sonde longue (12 × 10 min) : coup franc proche 4
     attaquants dans la surface en médiane (4/8 avec ≥ 3), gardien 36
     passes/90 min MAIS 19 pertes (12 avant) : la sortie structurée
     jouait court DANS la pression. 223b (relance.pression) : le court/
     long se lit à la pression — premier presseur au-delà d'un seuil (axe
     style : possession 6 m → direct 14 m, × (2 − composureF)), ≤ 3
     adversaires dans les 20 m, un appui libre à < 25 m ; sinon long ; la
     tactique explicite 'court'/'long' garde sa voix. Leçon d'empreinte :
     une référence prise avant une v2 du même lot est périmée — re-mesurer
     à chaque sous-lot. Monde 226b : seed 3 c0afdb00403e9f69, seed 7
     80193a4e239c1b12. Mesuré 226b (12 × 10 min) : gardien 41 passes/90
     min dont 24 longues, 18 pertes — la règle joue (long sous pression)
     et les pertes restantes sont les longues perdues au duel (un 50/50
     réel, ~50 %), pas des mains dans la pression : consigné, pas
     corrigé. Bande A/B 20 × 300 s (226b) : 76 tirs, 12 buts, 25
     accrochages, 31 fautes, 7 corners. Clauses 223, 223b, 224, 226 au
     mécanisme (renvoi : la forme du brief ; pression 4 m → long, 22 m
     → court ; coup franc 3 monteurs marqués à 0,9 m ; touche ≤ 6 cibles
     à < 12 m c. 10 hier). BANC 226b (avant-plan, deux à quatre shards à
     la fois) : huit shards verts après les épingles relance/remise/
     cpaMontee:false (aimant du porté, 104, 136, 150 — ce dernier juge le
     contraste 'court'/défaut que la relance par pression a déplacé —,
     174, 117, 194), hors 96/174 (dépendants de l'ordre des blocs,
     vérifiés isolés — la dette du harnais, 272) ; annexes du contrat
     vertes (match 84, rondo 40, gestes 60, menace 11, frappes 13, sync 9,
     roles 11, loi3 10, kit 5, part-tint 18, tactics 11, slide 10 ;
     attributes 27 ✓ après épingles relance/remise/cpaMontee sur la
     gradation et le pique). Volumétrie : match-sim 1248 après trois
     déports (foulee.js, repli.js, cpa.js). DÉPLOYÉ (capture playmode
     validée ; chunk Rondo-BIf-rDbv.js, cpaMontee grepable à l'alias). En
     ligne : 221 → 226b — le repli, la garde, la sortie de balle, la
     montée sur coup franc, la touche à appuis, l'événement placement.
- 274: L'AFFECTATION HOMME PAR HOMME (225, cfg.marquageSurface,
     marquage.js — constat 3 de l'aval : « un attaquant sur dix seul dans
     la surface »). L'utilisateur a mis deux livres en texte dans un dépôt
     (« Comment regarder un match de foot », « Comment gagner un match de
     foot » — Cahiers du football, Cosmidis et al.) : deux agents les
     digèrent (une première tentative est tombée en 529). Sondé (3 × 10
     min, 448 observations) : attaquant dans la surface → premier
     défenseur p50 3,5 m, 59 % LIBRES (> 3 m), et pourtant 8 marqueurs
     actifs et 5 défenseurs dans la surface : le job `mark` le plus proche
     n'était pas SON marqueur. La cause : chaque marqueur prenait le
     (i−2)-ième attaquant le plus proche DE LUI (lot 72 : « un marqueur
     par homme » supposait des tris identiques) — deux marqueurs sur le
     même homme, un orphelin. La loi : une affectation par image — le
     DANGER d'abord (l'attaquant le plus près de mon but), pour chacun le
     marqueur libre le plus proche × (2 − markF), chaque homme une fois.
     Mesuré : libres 59 → 34 %, p50 3,5 → 2,2 m (réel 1-2), audit 4,4 →
     3,4 m. Jumeau = 226b au bit. Monde 225 : seed 3 836702b95cca24d9,
     seed 7 11a33347a3d6252d.
- 275: LA BIBLIOTHÈQUE TACTIQUE (deux livres digérés par des agents —
     « Comment regarder un match de foot », Cahiers du football ;
     « Comment gagner un match de foot », Cosmidis et al. — dépôt
     juliendelquignies/book). Ce qui borne nos lois, avec le numéro de
     ligne du texte : MARQUAGE — individuel « l'haleine sur la nuque »,
     1-2 m quand l'homme est dos au porteur (l. 4549 / 7481) ; zone :
     « un qui sort de la ligne, trois qui couvrent » (Gourcuff, l. 7372)
     ; entre lignes 10-15 m en bloc médian, ~6 m en bloc bas (l. 7355) ;
     bloc ≤ 25 m attaque-défense (Bielsa, l. 4836) ; le second poteau au
     latéral opposé, quatre en équilibre derrière (l. 7075-7078) ; sur
     CPA le mixte domine (zone pour les petits, homme + 3-4 « au ballon
     » pour les costauds, l. 8200-8218) ; gardien : second poteau + 8-9 m
     devant sa ligne (Furlan, l. 8185). TRANSITIONS — contre-pressing
     chronométré : 6 s (Guardiola), 5 s (Klopp), 8-10 s (Rangnick), 10 s
     (Bielsa) (l. 3659-3711, 803, 850) ; zone-press c. recul-frein, la
     faute intelligente (l. 4340-4438) ; « une chaise à quatre pieds »
     (Moulin), compensation du latéral monté (l. 5696-5709) ; le premier
     sprint « dans le joueur, sans faute » (Zeidler, l. 7258). PRESSING —
     déclencheurs : porteur dos au but, contrôle raté (l. 4088) ; cible
     le latéral, « la ligne de touche est le meilleur défenseur »
     (Guardiola, l. 4152) ; 6-7 joueurs actifs pour un pressing haut
     (Zeidler, l. 7302) ; on ne presse pas à 80 m de son but (Moulin, l.
     4409) ; la ligne recule si le porteur n'est pas cadré (l. 4875).
     SORTIE DE BALLE — salida volpiana : le pivot décroche pour le +1, les
     centraux s'écartent (l. 6768-6789) ; le troisième homme, l'homme
     libre (l. 6664-6737) ; PSG : 9 ballons perdus par match sur les
     sorties du gardien (l. 1705) — nos 18/90 min sont le double, même
     ordre ; 8 ballons sur 10 au pied (Landreau, l. 2064) ; règle des 6 s.
     CPA — L1 2014-15 : 9 corners/match, 1 but tous les ~50 (l. 7790) ;
     28,6 % des buts sur CPA (l. 7832) ; 75 % des buts de corner sur
     rentrants (City, l. 8151) ; premier c. second poteau contradictoire
     (80/50 %, l. 8170-8182 — deux profils, pas une vérité) ; touche à
     hauteur de surface = un corner (l. 8108) ; touche longue 20 → 27 m
     (Gronnemark, l. 3693). PERFORMANCE — 1 but pour 9 tirs (Reep, l.
     3337) ; 1/25 à 21-27 m, 1/40 au-delà ; tir sans pression ×2 (l.
     3540-3549) ; penalty 75 %, gardien plonge 94 % (l. 9607-9679) ;
     ouverture du score = victoire 85 % dom. / 76 % ext. (l. 10315). Les
     livres ne couvrent PAS : seuils chiffrés de déclenchement du
     pressing, corner offensif détaillé, mur du coup franc. Les rôles :
     sentinelle, double pivot, regista, faux 9, mezzala (l. 9370-9560).
     À FAIRE de cette bibliothèque : le contre-pressing chronométré par
     profil (nos fenêtres 4,5 s + cooldown ≈ Klopp), la faute tactique,
     « un qui sort, trois qui couvrent » comme loi de bascule, la
     compensation du latéral monté, l'entre-lignes 10-15 / 6 m par bloc,
     et la conversion des tirs 1/9 comme bande de réalisme (nos bandes
     A/B : 76 tirs pour 10-14 buts = 1/6-1/8, proche).
- 276: LE RAMASSEUR DE BALLE (225b, cfg.ramasseur) ET LE BANC 225. Le
     shard 2 joué seul a levé un vrai gel : graine 7, corner à t 23 jamais
     joué en 51 s — le ballon mort à 4 m derrière la ligne ET 4 m au-delà
     de la touche, hors du tablier (apron 2 m) ; le preneur pédalait
     contre la borne à 2,8 m d'un bras de 2,2. ballFetch : un ballon hors
     d'atteinte (tablier + 0,6 m, à l'arrêt) ou une quête de plus de 6 s
     remet le ballon au point de remise et le nomme (événement
     `ramasseur`) ; le juge checkMatch soustrait ces poses. Rejoué :
     corner pris à 42,5 s, contrat à 22 ✓, annexe match 84 ✓. Bande A/B
     20 × 300 s (225) : 76 tirs, 10 buts, 22 accrochages, 30 fautes, 3
     corners. Banc 225 par shards : 96, 174, 212 restent la classe
     « ordre des blocs » (isolés ✓) ; épingles marquageSurface:false
     (coach, 135, 217, 136, 164, 212) ; 217 tolère un échantillon sans
     renvoi. Monde 225b : seed 3 836702b95cca24d9, seed 7
     8d843111da6b8281 (le ramasseur a joué dans ses 90 s). Annexe
     attributes 27 ✓ (lot 160 : marge du bras saboté datée 15 → 12, le
     contraste tient 6 c. 13,5 % ; les épingles marquageSurface/ramasseur
     y étaient inertes). DÉPLOYÉ (capture validée ; chunk
     Rondo-Cq-c6Vfd.js, marquageSurface et ramasseur grepables à l'alias).
     En ligne : 221 → 225b.
- 277: LA PASSE AVANT LE CONTACT (227, cfg.avantContact, pression.js —
     la racine nommée deux fois : le tourbillon des pertes, 360/90 min
     c. 200-280 réelles, qui fabrique l'essaim par contre-press). Sondé
     au registre du ballon : 61 % des pertes sont des FRAPPES avec le
     presseur à 1,4 m (p50) au moment du coup, 25 % des touches de
     conduite volées à 2,4 m ; la possession perdue dure 10,5 s p50. Le
     porteur attendait le contact : la branche contestée joue « en
     urgence » et le jeté (144) ne lisait que le presseur LANCÉ (≥ 4
     m/s) — un presseur qui trotte à 2-3 m/s arrivait sans rien
     déclencher. La loi : l'ETA du presseur le plus proche (distance
     moins le contact 1 m, sur sa vitesse de fermeture, dans 6 m) sous
     0,9 s × (2 − anticipF) × composureF dispense la tenue et abaisse la
     barre à 1,2 : la meilleure passe part AVANT la pression.
     L'anticipation voit venir, le sang-froid attend un peu plus ; le
     rôle (tenue, 211) et la tactique (tempo) restent dans la barre.
     Mesuré (6 × 300 s) : pertes 360 → 291/90 min, passes réussies 77 →
     84 % (foe 14 %), presseur au coup 1,4 → 1,6 m, touches de conduite
     volées 25 → 21 %. Jumeau avantContact:false = 225b au bit.
     Volumétrie : rondo-sim 1264 → déport dans pression.js. Bande A/B 20 ×
     300 s (227) : 53 tirs, 8 buts, 20 accrochages, 29 fautes, 3 corners.
     LA BANDE DE SANTÉ SE RE-FONDE : « 8-22 buts » datait du monde d'avant
     le repli (17-22 buts par 20 matchs de 5 min = 15-20 par 90 min, six
     fois le réel) ; la campagne 221-227 l'a fait descendre à 8 (= 7 par
     90 min, deux fois et demie le réel de 2,7). La bande devient 3-12
     buts et 40-90 tirs par 20 × 300 s — le réel (2,7 buts, ~25 tirs par
     90 min → 3 buts, 28 tirs par 100 min) reste en dessous : la
     conversion 1 tir sur 6-7 c. 1 sur 9 (Reep) et le volume de tirs
     restent les dettes de réalisme suivantes. Clause 227 : (a) la
     primitive (2,5 m à 3 m/s → vrai ; 4 m à 0,5 m/s → faux ; le
     sang-froid 1,15 / l'anticipation 0,85 voit encore venir à 0,5 s) ;
     (b) le flux à 3 graines (49 pertes ≤ 0,9 × 66) — la fixture posée
     ne sépare pas les mondes : la porte de tenue (holdMin) interdit toute
     décision avant ~0,3 s après la prise et le presseur proche ouvre
     aussi le jeté d'hier. Épingles avantContact:false : 167, 128, 189,
     aimant du porté, cône de touche, orbite (des flux de conduite et de
     profondeur re-datés par la passe précoce) ; puis 121, 129, 137
     (marge 1,5 → 1,2 datée), 164, 168 ; classe « ordre » : 96, 174, 189.
     Huit shards match11 verts hors cette classe, treize annexes vertes
     (attributes 27 ✓ avec la gradation épinglée — deux runs parallèles
     avaient mêlé leurs logs : un seul run par fichier). DÉPLOYÉ (capture
     validée ; chunk Rondo-fmMLEJ8n.js, avantContact grepable). En ligne
     : 221 → 227.
- 278: LA LIGNE SE REFERME (228, cfg.referme, marquage.js — la
     bibliothèque : « un qui sort de la ligne, trois qui couvrent »,
     Gourcuff l. 7372). Sondé (3 × 300 s) : le presseur est un défenseur
     de LIGNE 20 % des instants ; l'écart maximal entre ses voisins monte
     alors à 13,6 m p50 et 24,5 p90 (12,8 / 16,1 sinon) — le spot vacant
     restait vacant, la ligne d'hier ne bougeait pas. La loi : le spot du
     sorti attire ses deux voisins de ligne (part 0,5 et 0,25 du trou), ×
     posF (le placement est une note) × axe tactique marquage (zone 1,2
     → homme 0,6 : la zone couvre l'espace, l'homme reste sur le sien) ;
     les spots du bloc sont mutés pour l'image. Mesuré : p90 24,5 → 19,4
     m, p50 inchangé (la médiane est la largeur de la ligne entière : 4
     hommes sur 33 m — la compacité latérale du bloc, dette suivante avec
     l'entre-lignes 10-15 / 6 m). Jumeau referme:false = 227 au bit.
     PUIS UNE LEÇON (228b) : l'annexe tactics a rougi — « la hauteur de
     bloc bouge la ligne » : médiane −0,1 m pour +4,5 attendus ; sondé,
     le bloc BAS montait à 35 m (13 sans referme) et le HAUT descendait à
     29,6 (39,4) : muter le z des spots du bloc (`spotsBloc`, le buffer
     `st._outDef` réécrit à chaque image) changeait la HAUTEUR par un
     consommateur que je n'ai pas identifié (part 0 = le monde d'hier au
     mètre). La loi n'écrit plus dans les spots : elle produit un décalage
     PAR POSTE (`st._bRefermeDz`) que seuls les postés de la ligne
     appliquent à leur spot. Hauteur retrouvée (19,5 / 44,6, contraste
     +25), trou p90 19,2 m. Règle : un module ne mute pas un buffer
     partagé du frame — il expose un delta que le consommateur nommé
     applique. Monde 228b : seed 3 3d35e71c25827909, seed 7
     ee6a622f5d89b0eb. SCEAU 228b : 8 shards verts (shard 2 seul : 144
     « le jeté déclenche » et 145 « le souffle » rouges isolés sur 228b —
     deux contrastes d'hier déplacés par la ligne qui se referme,
     épinglés referme:false, bloc 74 : 4 ✓), attributes 27 ✓, les douze
     annexes vertes, bande 74 tirs / 9 buts / 23 fautes / 7 corners,
     déployé (chunk Rondo-BtdVtARb.js, capture playmode avant deploy).
- 279: LE CONTRE-PRESSING CHRONOMÉTRÉ (229, cfg.contrePress, contrepress.js —
     la bibliothèque : « 6 s Guardiola, 5 s Klopp, 8-10 s Rangnick, 10 s
     Bielsa »). AVANT (sonde 10 × 300 s, film-contrepress) : après une
     perte, 1,3 chasseur à +1 s, 1,0 à +3, 0,9 à +5, 0,7 à +8 — jamais
     plus de 2 : le contre-press d'hier était un des signaux (t3) des
     fenêtres RARES du lot 11 (cooldown ≈ 22 s depuis 222), deux presseurs
     au mieux, sans horloge ni bascule. Regain < 5 s 26 %, < 10 s 45 %.
     LA LOI : à la perte (changement de possession hors remise), si le
     bloc est COMPACT (≥ compact 4 des siens à < rayon 20 m) et la zone
     permise (x > axe(hauteurBloc, 0, −2hx/3) : à 0,5 le tiers propre est
     exclu — « on ne presse pas à 80 m de son but »), les n 3 plus proches
     HORS LIGNE ARRIÈRE (chaise — « un qui sort, trois qui couvrent » ;
     rôle press ≥ 0,25, le meneur reste) forment la MEUTE pendant dur 5,5
     × axe(pressing, 0,6, 1,4) × workF : le premier est déjà presseur du
     bloc (i = 0), les autres FERMENT les sorties — chacun sa sortie la
     plus proche du ballon, au point ferme 0,5 du chemin ballon → sortie
     (1,5 m côté ballon de la sortie allongeait la tenue du porteur :
     regain < 5 s 30 → 20 % en compact ; la cage à mi-chemin ferme la
     ligne en restant près du ballon), burst 'contre-press' pendant elan
     1 s. À la mort de l'horloge (regain, remise, chasseurs échus) : le
     RECUL-FREIN, burst 'repli' frein 0,5 s (la loi 221 fait le reste).
     Le signal t3 d'hier reste (les deux mécanismes coexistent — le
     retirer perdait 3 points de regain en bloc étiré). Le dépossédé
     (lossReact) est déporté verbatim dans contrepress.js (match-sim
     1237 lignes). APRÈS (mêmes 10 graines) : 2,4/2,1/1,8/0,8 chasseurs
     (compact 2,7/2,4/2,1/0,7 — l'horloge meurt à +8 s), regain < 5 s
     27 %, < 10 s 51 %. Sans la chaise : 19 chasseurs sur 66 étaient des
     défenseurs et la bande montait à 13 buts (le dos ouvert) ; avec :
     68 tirs / 11 buts / 19 fautes / 6 corners. Clause 229 au banc : flux
     3 × 300 s appariés (meute 2,9/2,5/2,2/0,7 c. 1,3/1,0/0,9/0,8 sans la
     clé ; ≥ 2,0 à +1 s, +0,6 à +1 et +5 s, ≤ 1,3 à +8 s), la primitive
     par l'événement (dur 5,5 à l'identité, 7,7 sous gegenpressing, 0
     meute sans la clé). Épinglés contrePress:false (contrastes d'hier
     déplacés par la meute) : 167 (p90 10,6 ≥ 10), 128 (5/8 through
     conservés), 227 (pertes 63 > 0,9 × 54 — la meute fabrique des
     pertes, c'est son métier), 217 (aucune touche en 900 s : les
     remises tombent à 8 touches / 50 min — la dette des touches, 14 c.
     40/90 min réelles, s'aggrave et reste nommée). Jumeau
     contrePress:false = 228b au bit (3d35e71c25827909 / ee6a622f5d89b0eb).
- Modules moteur natifs : rendu (WebGPU+IBL+post), `locomotion.js` (matchCadence) + `foot-lock.js` (FootLockIK,
  no-slide), `character-controller.js` (facing sans moonwalk, run/idle, sprint, jump), `input.js`
  (clavier + manette + souris + tactile), `third-person-camera.js` (caméra pilotable), validateurs.
- Galerie publique déployée : https://threejs-aaa-showcase.vercel.app (jouables : **Carrière**,
  Contrôles, Physique, Intérieur ; génération : Lieux, Stades ; plus Soldier Volley dribble→centre→volée,
  Matériaux PBR, Monde procédural, IK, Géométrie, Bloom, Océan, Herbe).
