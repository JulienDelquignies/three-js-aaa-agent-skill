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
| `rendu-ab.mjs` | l'A/B dans le rendu, os par os : pied→ballon, pelouse calibrée, patinage pondéré, à-coups dans le repère du joueur |
| `../conduite-sondes/capture-geste.mjs clip:<nom>:k` | filme la k-ième fois que la couche joue ce clip |

Les captures se font sur un **build figé** (vite build + serveur statique). Le serveur de dev recharge les pages à chaud quand un module change : deux prises ont été perdues ainsi.
