# 53 — Le terrain, le gardien, le match réduit

Le pas « agrandir le terrain » : du carré d'entraînement au MATCH — deux buts, des gardiens, des
tirs, des remises en règle, un score. Trois modules (`pitch.js`, `keeper.js`, `match-sim.js`) et
une décision d'architecture qui est tout le chapitre.

## L'architecture : le match est une CONFIGURATION, pas un fork

Il n'y a QU'UN game-loop (rondo-sim, 40 clauses). `match-sim` le configure par cinq points
d'accroche posés là où le rondo disait « carré abstrait » :

| hook | ce qu'il remplace | ce que le match y met |
|---|---|---|
| `cfg.assignJobs` | l'attribution anti-essaim du rondo | la même grammaire, DIRECTIONNELLE (porteur vers le but, couloirs orientés, défense goal-side, gardiens) |
| `cfg.tryShot` | — (le rondo n'a pas de but) | le tir : portée, couloir, coin choisi CONTRE le gardien réel |
| `cfg.onOut` | la remise unique du carré | `pitch.outRule` : but / touche / corner / sortie de but |
| `cfg.onDive` | — | le toucher du plongeon, par image |
| `cfg.canTake` | premier arrivé prend | l'ayant droit et l'heure d'une remise |
| `cfg.passBias` | conservation pure | la PROGRESSION (0,22/m vers le but, plafond ±3, la sécurité reste reine) |

Duels, gestes techniques, personas, tempo, balistique : le MÊME code — mesuré, 49 gestes
techniques en 4 matchs. Le rondo sans ces hooks est inchangé (40/40).

## Les lois (chacune une clause)

1. **Le terrain est une donnée** (`pitch.js`) : RÉDUIT (46 × 30, buts 5 × 2) et PLEIN FORMAT
   (105 × 68, Loi 1) déjà défini. La sortie se juge au point de franchissement INTERPOLÉ et à la
   PREMIÈRE ligne croisée (un tir sorti en coin est une sortie de but, pas une touche) ; en
   format réduit la touche se joue au pied — une loi du FORMAT (futsal), écrite, pas honteuse.
2. **Le gardien a deux lois** (`keeper.js`) : la POSITION (sur la ligne ballon-centre, profondeur
   qui coupe l'angle : 0,45 m à 24 m, 1,97 m à 12 m, re-recul sous 7 m) et l'ARRÊT (le vol lu en
   balistique ; réflexe 0,12 s — pas d'oracle ; petit périmètre → prise ; envergure 2,1 m →
   plongeon ; au-delà → BATTU, un état honnête). Le plongeon est un skill de la machine de gestes
   (clip existant + contact 0,55) : armé, détente `ownsBody`, prix (au sol 0,75 s).
3. **Le toucher du plongeon est CONTINU** : testé à la frame de contact du clip, il ratait tout
   vol plus prompt — 2 arrêts sur 15 détentes. Le gant rencontre le ballon à l'image où il PASSE
   (16/19 après). Prise ≤ 1,1 m, claquette ≤ 1,7 m, sinon `plongeon-battu` au registre.
4. **Un tir est un geste d'opportunité et de puissance.** La tenue calme ne s'y applique pas
   (27 refus 'timing', 0 tir mesuré avant) ; la course ne le refuse pas (le défenseur qui coupe
   EST le duel du tir) ; solvePass rend une vitesse d'arrivée — le tir prend un plancher
   (17 m/s) ; à bout portant on tire dans le trafic (couloir 0,25 m contre 0,45 au-delà de 9 m).
5. **Le gardien porteur est un distributeur.** Sa loi de position l'a fait marcher vers sa ligne
   EN PORTANT le ballon — CSC mesuré (graine 3, t=73,95). Ballon en mains : il s'écarte et le
   cerveau de passe distribue. Et il REVIENT en pressant le pas (bucket de vitesse `keeper`,
   6,4 m/s — mesuré à z=−4, hors cadre, sur 4 des 5 buts sans plongeon).
6. **Une équipe PROGRESSE.** Sans le terme de progression, le match était un rondo dans sa
   moitié : possession dominante (191 c. 140) entièrement à x = −15, toutes les pertes entre −9
   et −23, zéro sortie de camp en 120 s.

## Les chiffres (4 graines × 120 s)

33 tirs, 8 buts (conversion 24 % — bande réelle du format réduit), 16 arrêts sur 19 détentes,
remises en plusieurs espèces, 4/4 contrats complets. Scores : 2-1, 3-0*, 0-1, 1-2 (*graine 7).

## La scène

`match.html` — la MÊME scène Rondo en mode `?match` (une scène, deux configurations) : buts de
`goal.js` aux lignes, gardien en maillot jaune, cadrage terrain, HUD au score, `check()` bascule
sur checkMatch.

## Dettes nommées

- Corner encore rare (0 sur les graines de banc — la clause demande ≥ 2 ESPÈCES de remise) ;
  drapeaux de corner et cônes d'entraînement encore aux coins (cosmétique).
- Pas de hors-jeu (loi du format 5+1) ; il viendra avec le 11c11 et `FULL`.
- Le gardien ne sort jamais (depthMax 2,6) : pas de libéro, pas de un-contre-un sorti.
- Remise de touche au pied sans cérémonie (placement + rayon + ayant droit seulement).
- Pas encore de mi-temps/fixtures (game-state) ni de formations nommées (le 11c11 les exigera).
