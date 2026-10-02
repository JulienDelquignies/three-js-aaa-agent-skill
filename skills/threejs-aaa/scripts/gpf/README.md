# Gestes de Gameplay Football portés sur le duel

Trois animations de [Gameplay Football](https://github.com/vi3itor/GameplayFootball) (Apache-2.0, fork de
BazkieBumpercar/GameplayFootball, base de google-research/football) portées sur le rig du duel, puis comparées aux
gestes générés du moteur **dans la même partie** : même graine, même joueur, même instant. Seul le corps dessiné
change.

```
?gpf=1                              les trois gestes portés remplacent les générés du même nom
?gpf=controleInterieur,tacle        seulement ceux-là
```

## Le port (`engine/gpf-anim.js`, données `engine/gpf-data.js`)

| geste du duel | animation GPF | pourquoi celle-là (situation mesurée, `receptions.mjs`) |
|---|---|---|
| `controleInterieur` | `trap/idle/000_IB000` | l'amorti de l'intérieur ; contact à 0,20 s comme le généré |
| `controleOriente` | `trap/idle/135_IB000_accel_left_shallowangle` | intérieur droit, virage à gauche, sortie à 2,3 m/s (= le receveur médian du duel ; virage médian 105°) |
| `tacle` | `sliding/walk/000` + `movement_special/idle/special/000_stand_up_from_back` | lancé à 5,2 m/s (tacleur du duel : 5,7), couché sur le dos, relevé |

Le format `.anim` est lu comme `utils/animation.cpp` :
- 14 nœuds, des clés éparses à 100 images/s ;
- slerp entre les clés ;
- monde = parent ⊗ local ;
- le ballon au contact.

Le squelette vient de `player.object` (Z en haut, avant −Y, gauche +X). La pose de repos vient de `straight.anim.util` (tout à l'identité) : jambes et bras à la verticale, pieds à plat (`foot.ase`).

Repère GPF → repère personnage : une rotation propre, où le quaternion `(x, y, z, w)` devient `(−x, z, y, w)`.

Chaque segment du rig prend la rotation monde du segment GPF, composée sur l'écart des poses de repos (bras en T contre bras pendants, tibia GPF penché de 5°). Les rotations d'articulation passent ensuite par `emitSpec`, comme tout geste généré.

Le tronc et la tête sont répartis sur Spine/Spine1/Spine2 et Neck/Head, par puissances du même quaternion (le total reste exact).

**La racine appartient à la sim.** Le cap et le déplacement horizontal de l'animation sont retirés, et seule la hauteur reste.

La hauteur est mise à l'échelle des jambes du rig. La référence est le bassin GPF au-dessus de sa semelle debout, soit 0,984 m : le nœud `body` est à 0,96 m, et la semelle est 2,4 cm sous la racine (mesuré par `pied-gpf.mjs`). Avec 0,96, le corps couché s'enfonçait de 2 cm.

## Les outils

| script | ce qu'il mesure |
|---|---|
| `../verify-gpf.mjs` | **le contrat**, en 34 clauses : lecture ; FK GPF (la cheville touche le ballon) ; fidélité du port sur les deux Biped du duel (la cheville du rig est au ballon à ±5 cm de GPF) ; calage au sol ; registre intact sans `?gpf`. Saboté (axes non convertis), il passe au rouge : cheville à 75–156 cm. |
| `inventaire.mjs` | les ~100 animations trap/ballcontrol/sliding/interfere par FK : durée, touche, pied, cheville→ballon, vitesse d'entrée et de sortie, virage |
| `gestes-joues.mjs` | ce que le duel joue vraiment, par graine |
| `receptions.mjs` | les situations des réceptions du duel (vitesse, arrivée du ballon, virage) |
| `banc-gpf.mjs` | sans navigateur, sur le vrai rig, le généré contre le porté : contrat du moteur, pelouse, appui, vitesse et accélération angulaires, fidélité |
| `pied-gpf.mjs` | le pied GPF (sommets de `foot.ase`) dans sa propre FK : ce que l'original fait déjà sous le sol |
| `meme-partie.mjs` | la preuve que l'A/B est propre : avec et sans `?gpf=1`, positions et événements identiques au bit |
| `occurrences.mjs` | où filmer (le contexte de capture décale la partie) |
| `rendu-ab.mjs` | l'A/B dans le rendu, os par os : pied→ballon, pelouse calibrée, patinage (pied posé ET lent), à-coups dans le repère du joueur, où sautent les os |
| `../conduite-sondes/capture-geste.mjs clip:<nom>:k` | filme la k-ième fois que la couche joue ce clip |

Les captures se font sur un **build figé** (vite build + serveur statique). Le serveur de dev recharge les pages à chaud quand un module change : deux prises ont été perdues ainsi.

## Ce qui a été mesuré (2026-10-02)

### Le port est fidèle (`verify-gpf.mjs`, `banc-gpf.mjs`)

Au contact, la cheville du rig est à 15,6 / 14,9 / 20,9 cm du ballon de l'animation, contre 17,4 / 14,3 / 25,2 cm dans GPF. Ces valeurs sont identiques sur les deux Biped (n°18, n°10).

### Les clips seuls sur le rig, au contrat du moteur (`banc-gpf.mjs`)

Le contrat que le duel impose à ses propres gestes, appliqué au port :

| | généré (duel) | porté (GPF) |
|---|---|---|
| amorti | contrat OK · pelouse −1,3 cm · appui 0,1 cm · accél. p95 9 875 °/s² (max 41 203) | ✗ le pied ne va pas au ballon (9 cm < 20 : GPF laisse venir le ballon) · l'appui glisse 8,7 cm · pelouse 0 · accél. p95 12 297 (max 55 026) |
| contrôle orienté | contrat OK · −1,0 cm · appui 0,1 · p95 12 430 (max 25 333) | ✗ l'appui glisse 25 cm (il fait ses pas de virage) · ne revient pas à la pose de départ (il repart en course) · −1,9 cm · p95 6 478 (max 63 795) |
| tacle | contrat OK · −2,7 cm · p95 11 696 (max 34 182) | ✗ jambe à 71 cm devant au contact (< 80) · relevé pas tout à fait debout (bassin −6 cm) · −3,3 cm · p95 22 622 (max 147 570, pied gauche pendant le relevé) |

L'original GPF passe lui-même sous son sol : jusqu'à 2,8 cm sous sa pose debout (`pied-gpf.mjs`).

Ses clés à la main, interpolées linéairement, donnent des pics d'accélération 1,3 à 4 fois plus hauts que les gestes générés (rampes C¹).

### Dans le rendu du duel, même partie (`rendu-ab.mjs` v3, 4 graines × 180 s, paires même joueur / même instant)

| | n | pelouse (méd. / pire) | patinage | à-coups p95 | B mieux que A |
|---|---|---|---|---|---|
| amorti A / B | 34 | −4,4 / −6,6 · −4,4 / −5,9 cm | 5,0 · 5,8 cm | 31 985 · 33 857 | 17-20 paires sur 34 : nul |
| orienté A / B | 38 | −4,0 / −6,0 · −5,1 / −9,5 cm | 6,5 · 8,0 cm | 28 839 · 33 047 | pelouse 8/38, patinage 17/38 : GPF un peu moins bon |
| tacle A / B | 2 | −8,0 · −12,7 cm | 25,6 · 6,7 cm | 36 960 · 36 068 | trop peu de cas |

Le pied arrive au ballon pareil dans les deux versions (16 et 13 cm) : c'est le warp de touche du duel qui le pose.

Les deux versions montrent des **sauts de pied d'environ 45° en une image**. Ce n'est pas le geste : le banc des clips seuls plafonne à 7-13° par image. C'est le recalage du pied dans la scène (warp de touche, verrou d'appui, fondu de couche), à traiter à part.

### Lecture

À l'œil (`comparaison-gestes-gpf.mp4`), les postures GPF sont plus athlétiques :
- à la réception, buste penché sur le ballon, genoux fléchis, bras bas — le duel garde le buste droit et un bras en balancier ;
- au tacle, une glissade sur le dos, les deux jambes devant — le duel glisse assis sur la hanche, jambe de haie.

À la mesure, portées telles quelles, elles ne font pas mieux dans le jeu. L'amorti fait jeu égal ; l'orienté s'enfonce et patine un peu plus. Leurs courbes sont plus heurtées (clés à la main), et elles ne tiennent pas les contrats du moteur.

GPF choisit en plus parmi ~30 pièges par situation et décale sa racine vers le ballon (« smuggle offsets ») ; le port n'en prend qu'un par geste, et rend la racine à la sim.
