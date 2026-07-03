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
2. **`furniture-kit.js` + `furnish.js`** — mobilier procédural par archétype de pièce (lit/canapé/casiers/
   bancs/muscu…), placement par règles (contre-mur, orienté-vers, clearance) auto-validé par verify-scene.
3. **`interactables.js`** — portes qui s'ouvrent, s'asseoir (sitPose), ramasser/porter (heldInHand),
   interrupteurs ; prompts de proximité « E — … ».
4. **Collision caméra** (3ᵉ personne qui ne traverse pas les murs) + **éclairage intérieur** (luminaires
   par pièce, budget de lights).
5. **Démo jouable** : même perso, mêmes contrôles, club T1→T4 et hôtel→villa (physique branchée sur les
   colliders du builder).

## État actuel (rappel)

- Skill `threejs-aaa` : refs 01–22, scripts de vérif (interaction / scene / temporal / locomotion), starter runnable.
- Modules moteur natifs : rendu (WebGPU+IBL+post), `locomotion.js` (matchCadence) + `foot-lock.js` (FootLockIK,
  no-slide), `character-controller.js` (facing sans moonwalk, run/idle, sprint, jump), `input.js`
  (clavier + manette + souris + tactile), `third-person-camera.js` (caméra pilotable), validateurs.
- Galerie publique déployée : https://threejs-aaa-showcase.vercel.app (Contrôles jouable, Soldier Volley
  dribble→centre→volée, Matériaux PBR, Monde procédural, IK, Géométrie, Bloom, Océan, Herbe).
