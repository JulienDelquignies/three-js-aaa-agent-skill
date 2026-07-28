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
