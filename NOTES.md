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
1. **`WorldBasis` natif** — extraire la logique facing/axes du `CharacterController` en un module
   « source de vérité » unique (généralise la correction moonwalk, nettoie le controller et les scènes).
2. **Physique Rapier** — vraies collisions runtime dans les scènes jouables (aujourd'hui seul le ballon a
   une physique maison). Résolveur kinematic pour le personnage + colliders de décor.
3. **Positionnement complémentaire / interop** — notre couche *rendu AAA + validation + locomotion* par
   dessus des blocs gameplay façon GameBlocks. Viser deux skills installables ensemble.

Autres idées déjà évoquées :
4. Blend d'animations **Idle → Walk → Run** avec machine à états (au lieu du blend binaire actuel).
5. **Scattering GPU / herbe** à plus grande échelle, **LOD / streaming** (web-Nanite), caustiques d'eau.
6. **Systèmes de particules** (étincelles, impacts, fumée).
7. IA basique (pathfinding, steering) pour un adversaire dans la scène jouable.

---

## État actuel (rappel)

- Skill `threejs-aaa` : refs 01–22, scripts de vérif (interaction / scene / temporal / locomotion), starter runnable.
- Modules moteur natifs : rendu (WebGPU+IBL+post), `locomotion.js` (matchCadence) + `foot-lock.js` (FootLockIK,
  no-slide), `character-controller.js` (facing sans moonwalk, run/idle, sprint, jump), `input.js`
  (clavier + manette + souris + tactile), `third-person-camera.js` (caméra pilotable), validateurs.
- Galerie publique déployée : https://threejs-aaa-showcase.vercel.app (Contrôles jouable, Soldier Volley
  dribble→centre→volée, Matériaux PBR, Monde procédural, IK, Géométrie, Bloom, Océan, Herbe).
