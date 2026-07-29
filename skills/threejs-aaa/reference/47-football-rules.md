# The catalogue of things that cannot happen in football

> *"le ballon doit être devant le joueur, il peut pas être de dos pour faire une passe — tu peux te
> mettre des contrôles sur toutes les actions du foot impossible ? c'est comme ça qu'on fera un
> moteur non ?"*

Yes. This is how. And the first run of the catalogue proved the point better than any argument
could: **eighteen rules, six of them violated, on a game whose own contract was green at 25/25.**

## Generate the rules, do not remember them

A list of bugs you happen to recall finds the bugs you already knew about. `reference/19` gives the
alternative and this catalogue applies it to football: build a grid of **relationship × phase** and
ask of every cell "what would be impossible here?"

| | carry | strike | flight | receive / tackle | out |
|---|---|---|---|---|---|
| **ball ↔ the man on it** | in reach; he is the closest to it | in front of him, in reach, at foot height, struck at a human speed | — | within controlling distance | — |
| **ball ↔ the world** | on the ground | — | no teleport, no free energy, never under the pitch | — | inside the box |
| **player ↔ player** | nobody inside anybody | — | — | — | everyone inside the area |
| **event ↔ event** | one carrier | a striker, a target, a foot, no second touch in the same stride | — | possession changes only by a named cause | — |

Every cell of that grid became a rule. Two of them — *ball in front of the striker*, *nobody inside
anybody* — nobody had thought to write, and both were being violated on almost every play.

## What the first run found

Eighteen rules against 90 s of the shipped game:

| rule | violations | |
|---|---|---|
| `ball-ahead-at-strike` | **64.9 %** | passes struck with the ball **behind** the player, bearing up to 180° |
| `players-not-overlapping` | **28 %** | two bodies inside 45 cm — visibly passing through each other |
| `ball-in-reach-at-strike` | 16.7 % | struck at up to 2.78 m from the foot |
| `carrier-owns-the-ball` | 14.8 % | an opponent nearer the ball than the man "carrying" it |
| `carry-reach` | 5.3 % | ball more than 3 m from its carrier |
| `not-inside-a-body` | 0.8 % | ball inside a leg |

The other twelve were green. That distribution is the whole argument for a catalogue: the rules
nobody would have written are exactly the ones that were failing.

## The fixes, and what each cost

Four of the six had one cause — **the carrier did not run onto his own ball**. He was sent to an
escape point computed around *himself*, so he walked away and left the ball behind; his facing
follows his velocity, so the ball ended up behind him at the moment he struck it.

- **Sample the escape direction around the BALL, and stand behind it.** `evadeSpot` answers "where
  should this ball go"; the carrier's own target is that direction taken *backwards* from the ball by
  a boot's length, so the ball stays between him and where he is going. That is what dribbling is.
  Sending him to the escape point itself makes him run **past** the ball.
- **A pass is only played off a ball the foot can reach.** Without the fix above this gate strangles
  the game (record 6, turnovers 239): the two changes only work together.
- **Separation.** Nothing at all had stopped two players occupying the same point. One relaxation
  pass, each pushed half the overlap.
- **The press attacks the ball, not the man.** Once the carrier shields from behind, a presser aimed
  at his body walks into his back.

Result: `ball-ahead-at-strike` **64.9 % → 3.5 %**, overlap **28 % → 0.1 %**, reach violations to
zero, and the game got *better* rather than worse — record 32 → 37 passes.

The model was chosen by measurement, not by argument. Five carry models, scored on total catalogue
violations across three seeds:

| model | record | violations |
|---|---|---|
| escape sampled around the player (as shipped) | 6 | 702 |
| around the ball | 9 | 401 |
| around the ball + 0.4 m standoff | 13 | 332 |
| + 0.7 m standoff | 26 | 222 |
| **+ 0.4 m standoff, 1.2 m step** | **37** | **83** |

## One sabotage per rule, or it is not a contract

A rule with no sabotage is an intention: you never learn whether it is green because the game is
right or because it looks at nothing. `verify-football-rules.mjs` therefore breaks each rule
individually and requires **that** rule to fire — 18 rules, 18 named sabotages, plus a check that no
rule can be added without one. And the exception is tested as an exception: a ball struck from
behind is legal **as a backheel** and illegal any other way, which is precisely why the backheel has
a name.

## The rules that are still red are a budget, not a mystery

Three remain: `carrier-owns-the-ball` at 22.7 %, `not-inside-a-body` at 1.3 %, `carry-reach` at
0.3 %. They are asserted against a **debt budget** rather than zero, so they cannot drift worse
without failing the harness. A measured debt with a ceiling is a different thing from an unknown.

## What this actually answers about "engine"

An engine gives you a scene graph, a physics solver, an animation graph and an editor. It does not
give you *"the ball cannot be behind the striker"* — that is domain truth, and you write it yourself
in Unity exactly as here. What the catalogue is, is the part people usually leave in their heads:
the rules of the thing being simulated, written down, executable, and each one proved to bite. That
is the piece that makes a pile of systems into a game engine *for football* — and it is the piece
you cannot buy.


## Second pass: the gesture itself becomes data (`engine/technique.js`)

> *"un ballon qui arrive sur le pied gauche doit être contrôlé pied gauche et passer pied gauche, ou
> sinon extérieur du droit… il faut être exhaustif sur les gestes footballistiques."*

The catalogue could say a strike was illegal. It could not say *which* gesture the situation called
for — so the fix for a bad pass was always a tweak, never a derivation. The vocabulary is now a table.

**A technique is a row**: which foot (`near` = the one on the ball's side, `far` = the other), which
**surface** (inside / outside / laces / sole / heel / thigh / chest / head), the geometric windows it
needs (bearing, distance, height), how far the body may open (`turn`), what it does to the ball
(`power`), how reliable it is (`accuracy`), and which animkit move draws it. Thirteen rows: five ways
to pass, five to control, two to win the ball, one to clear.

**The user's sentence falls out of geometry, it is not a special case.** The inside of the LEFT foot
faces the player's RIGHT, so it plays *across* the body; the outside of the left foot faces left, so
it plays *away*. Therefore a ball on the left that must go left cannot be played with the inside of
the left foot — you use an outside. And the inside of the **far** foot is never available at all,
because that means crossing your legs over your own standing foot. `outWindow(surface, foot)` is four
lines and it encodes all of it.

Two measurements shaped the table:

- Without the outgoing-direction windows, **every** pass came out of the inside of the near foot: the
  selector was only ever asked "can the foot reach the ball", never "can this surface send it there".
- With the windows but no `turn` term, **67 of 95** actions had no legal technique at all. You do not
  have to face the receiver to pass to him — you open your hips — and `turn` is how far each technique
  allows that. With it, the distribution becomes what a rondo actually looks like: inside passes,
  pivots, one-touch lay-offs, a backheel, the occasional driven ball.

**The slide tackle**, which did not exist: a ball running loose beyond standing reach could not be
attacked at all — the game waited for someone to walk into it. `tacle-glisse` reaches 1–3.2 m and
costs 1.2 s on the ground whether it wins the ball or not, and that cost is the whole decision. Three
measurements to get it right: letting anyone in range slide gave **182 slides in 90 s** and possession
collapsed (18 passes → 4); restricting it to "you are losing the race" still gave 157, because
everybody dived at every pass in flight; restricting it to a ball that has **strayed** — a touch that
got away, or a genuinely loose ball, which is the situation the request named — gives 14–37, and the
game holds.

And it exposed a rule that was missing entirely: **out of play was only tested while the ball was
loose or in flight.** A ball dribbled over the line simply stayed out. Nobody had noticed because
until the carrier began pushing the ball ahead of himself, carries never reached the line.

Three rules were added and each has its sabotage: `technique-legal` (every action re-checked against
its own row), `no-crossed-legs`, `slide-in-range`. Twenty-one rules at that point, 17 green on a live game, the
rest under measured debt budgets.

## What is still missing, honestly

The table names one animkit clip per technique, and there are five clips for thirteen rows — an
inside pass and a pivot pass currently draw the same movement, played from its contact frame. At this
camera distance that is visible, and authoring a distinct pose-key move per technique is the next
pass. The catalogue will not catch it: it rules on geometry, not on whether the animation is the
right one. That is a job for the eye, and for `frame-stats`-style measurement of the render, not for
these rules.

---

# Troisième passe : les gestes manquants, la chasuble, et la forme du bloc

## Les huit gestes qui manquaient

La section précédente se terminait sur un aveu : treize techniques dans la table, cinq clips dans
`animkit`, donc une passe intérieure et une passe en pivot jouaient le même mouvement. Huit moves ont
été écrits pour combler exactement cet écart — `passeExterieur`, `passePivot`, `deviation`,
`controleInterieur`, `controleExterieur`, `controleSemelle`, `amortiCuisse`, `tacleDebout` — chacun
avec sa **frame de contact** (`clip.userData.contact`), et `playGesture` démarre l'action à cette
frame plutôt qu'au début : c'est ce qui fait que le ballon part au moment où le pied le touche, et
non une demi-seconde après.

Un piège mesuré au passage : `mirrorMove` inverse Z, ce qui **double** l'amplitude d'un bras qui
traverse déjà le corps. Le `passeExterieur` miroité téléportait le `RightArm` à 14 rad/s. La clause
de vitesse angulaire de `verify-animkit` l'a attrapé ; le correctif est une clé intermédiaire à
t=0,12. Une symétrie n'est pas une opération neutre sur une pose qui croise l'axe.

## Deux couleurs de maillot sur un personnage qu'on ne peut pas recolorer

Le personnage partage **un atlas et un matériau** entre maillot, peau et crampons : teinter le
maillot teint le joueur. Les deux issues étaient de régénérer une tenue complète (des tubes loftés,
qui se lisent comme des tubes loftés) ou de faire ce qu'un terrain d'entraînement fait vraiment —
enfiler une **chasuble**. `engine/bib.js` la construit par loft de quatre anneaux dimensionnés sur le
RIG (pas sur des constantes : une chasuble coupée pour un personnage flotte sur le suivant), skinnée
par proximité aux trois os du buste, `bind = maintenant` avec `bindMatrix` identité.

Le contrat en dit une chose qu'aucun coup d'œil ne dit : **le volume signé doit être positif**. Un
`+sin` au lieu d'un `−sin` dans un anneau retourne la maille entière. De face, on voit des triangles
de la bonne couleur au bon endroit — on regarde simplement l'intérieur du vêtement, l'éclairage est
inversé, le tissu s'assombrit au lieu d'accrocher la lumière. C'est exactement le genre de défaut
qu'un rendu ne signale pas et qu'une clause attrape en une ligne. Le sabotage retourne les triangles
et vérifie que la clause crie.

## La fourmilière n'était pas une histoire d'hystérésis

Le bloc en possession n'occupait que **15,8 % du carré**. La clause d'écartement (distance moyenne
par paire) était verte pendant tout ce temps — et elle a raison de l'être : un **anneau** et une
**file indienne** ont exactement le même écartement moyen. Ce qui manquait, c'est l'**aire**. Clause 9
de `checkRondo` : l'enveloppe convexe de l'équipe en possession, rapportée à l'aire du carré. Son
sabotage est une file indienne, précisément parce que c'est la forme que la clause 3 laisse passer.

L'hypothèse de départ était fausse et vaut d'être écrite. Un supporter se tenait en moyenne à 4,46 m
de sa propre cible — aussi loin d'elle que du ballon — donc « il court après une station qui a déjà
bougé, il faut de l'hystérésis ». Balayé sur 16 graines : **toute** valeur non nulle de
`commitMargin` dégrade le résultat. Le vrai coupable était le **centre de l'anneau de soutien** :
échantillonné sur le ballon, la garde de bord rejetait toute la moitié éloignée dès que le ballon
dérivait, et les cinq joueurs étaient poussés du même côté. `stationBias` tire ce centre vers le
milieu du carré :

| `stationBias` | occupation | distance à sa station | record | passes réussies |
|---|---|---|---|---|
| 0 (l'ancien modèle) | 15,8 % | 4,36 m | 15,3 | 3,8 |
| **0,45** | **20,2 %** | **3,95 m** | **17,2** | **4,5** |
| 0,6 | 22,2 % | 3,52 m | 10,5 | 2,3 |

0,6 écarte le plus et joue le plus mal : les hommes sont trop loin pour se relayer. 0,45 bat l'ancien
modèle sur tous les axes à la fois.

## Le porteur regarde son ballon — et les deux conséquences

`p.yaw = atan2(v)` : on fait face à son déplacement. Vrai pour tout le monde **sauf le porteur**, qui
se place `carryStandoff` DERRIÈRE son ballon : sa vitesse pointe vers un point situé derrière le
ballon pendant que le ballon est devant. Son corps finit de travers. Corrigé, avec le même barème que
le modèle d'inertie (`rate = turnAccel / speed`, la vitesse coûte l'agilité).

Deux autres endroits lisaient ce `yaw` en croyant lire autre chose, et les deux ont cassé :

1. `evadeKeep` veut dire **inertie** — « tu cours déjà par là, changer coûte ». Sur le yaw, il a
   fermé une boucle : la poussée fixe l'orientation, l'orientation récompense la même poussée. Le
   porteur est devenu littéralement imprenable — **63 passes et 0 récupération** sur la graine 6.
   Une boucle de rétroaction se lit comme du génie jusqu'au moment où on remarque que la défense a
   cessé d'exister.
2. Le `heading` passé au modèle de dribble veut dire la même chose. Sur le yaw, chaque touche partait
   à pleine puissance droit dans la direction de poussée et le ballon distançait un homme plafonné à
   4,2 m/s.

Les deux lisent désormais la vitesse. Une même variable, deux sens, deux corrections.

## Une phase qui mentait

`carry-reach` s'affolait à 5,6 % des frames de conduite. Diagnostic : le porteur était **au sol**,
`down: 0.83`, ballon à 3,4 m roulant à 3,9 m/s. Un tacle glissé gagné appelait `receive()`, ce qui
faisait du tacleur le porteur alors qu'il lui restait 1,2 s de `slideRecovery` à purger. Ce n'est pas
une dette à budgéter, c'est une **phase fausse** : un ballon dégagé au sol est un ballon **libre**.
Le premier debout le prend, lui compris. Meilleure règle, meilleur football — un tacle gagné est un
50/50, pas un cadeau. `carry-reach` retombe à 1,2 %.

## Le geste passe avant le ballon

`chooseTechnique` était appelé **après** le coup de pied, uniquement pour étiqueter l'événement.
Quand la table ne renvoyait RIEN — aucun pied, aucune surface, aucun geste capable d'atteindre ce
ballon et de l'envoyer là — la passe partait quand même. C'est tout `ball-ahead-at-strike` : la
frappe impossible n'est pas un mauvais choix parmi des choix légaux, c'est un choix illégal qu'on
autorise. La sélection **conditionne** désormais la frappe : pas de technique, pas de passe. Le
porteur garde le ballon et se retourne dessus (il regarde son ballon, la fenêtre s'ouvre en une
foulée), ou il talonne — puisque c'est précisément le geste d'un ballon dans le dos.

Au passage, `situation()` lisait `st.ball.v` **après** que le kick l'ait écrasée : elle décrivait le
ballon qui part, pas le ballon qu'on frappe.

**Vingt-trois règles, 56 assertions vertes, une par sabotage.** Et le catalogue a fait son travail
dans les deux sens ce coup-ci : il a attrapé une régression que *j'avais introduite* en écartant le
bloc (`ball-ahead-at-strike` 5,3 % → 12,9 %), ce qui est exactement ce à quoi sert un catalogue de
règles qu'on ne peut pas satisfaire par hasard.
