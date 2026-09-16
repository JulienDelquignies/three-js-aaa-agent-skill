# 52 — Les gestes techniques : râteau, feinte de passe, arrêt semelle

La demande fondatrice : « des râteaux pour se retourner, des feintes de passes, le ballon sous la
semelle — tout ce qui fait le foot ». Trois gestes qui manipulent le ballon **sans le libérer** :
un nouvel intent dans la table (`carry`), la même machine de gestes que les frappes, et un banc
dédié (`verify-gestes.mjs`, 26 clauses).

## Les lois (chacune est une clause quelque part)

1. **Le vocabulaire vit dans la table.** `technique.js` gagne trois lignes d'intent `carry`
   (`rateau`, `feinte-passe`, `arret-semelle`) : préconditions géométriques, pied, surface, clip.
   Le « contact » d'un geste carry est l'instant où la manœuvre s'exécute (la semelle agrippe, la
   feinte se vend, la plante se pose) — le ballon reste au porteur du début à la fin.
2. **Un geste technique est SITUÉ, et ses refus se nomment.** Le râteau exige un presseur FRONTAL
   (≤ 1,45 m, relèvement ≤ 60°) qui ARRIVE lancé (fermeture ≥ 1,5 m/s) et une sortie arrière
   LIBRE (1,35 m — 2,0 m ne se trouvait jamais dans un carré de rondo : 0 râteau, le refus
   `rateau-sans-issue` mangeait tout). La feinte exige une intention formée, un défenseur dans le
   cône de la fausse direction ([1,2 ; 2,6] m, ± 55°) et PERSONNE en duel vivant sur le ballon
   (se figer 0,4 s avec un homme à portée de vol = offrir le tacle — mesuré : +10 pts de temps
   « collé »). La semelle exige le champ libre (≥ 2,4 m) et la tenue délibérée en cours.
3. **La même machine que les frappes — et la fenêtre de duel reste ouverte du début à la fin.**
   startGesture/stepGesture, armé volable, abort nommé. Sans l'extension de fenêtre, la semelle
   (0,85 s) était un sanctuaire : un défenseur à 2,4 m couvre l'écart en 0,4 s et devait regarder.
   Et la semelle **se décolle quand on vient la presser** (abort nommé `pressé-sous-semelle` à
   2,0 m) — tenue quoi qu'il arrive, elle gonflait le temps collé à 58 %.
4. **Le couple corps-ballon reste soudé, et le corps appartient au geste** (`ownsBody`).
   L'accompagnement du râteau écrit lacet + ballon dans `skillFollowStep` : le ballon RACLE tout
   droit le long de l'ancien regard (0,32 m devant → 0,45 m derrière = devant le nouveau regard),
   le lacet balaie en ease vers `exitYaw`. movePlayers et la branche busy se taisent — une
   autorité. Mesuré au banc : retournement 179°, ballon ≤ 0,9 m (pire mesuré 0,61 m). Piège
   documenté : les cibles de `ball.carry` sont **2D [x, z]** — un [x, y, z] à trois termes envoie
   le ballon vers la ligne z = 0,11 à la vMax du servo (3,99 m de « raclage » mesurés).
5. **La morsure est une loi, pas un récit.** Au contact de la feinte, les défenseurs lancés dans
   le cône prennent `_bite` (0,55 s) : pointe, accélération et virage × 0,35 — l'appui est parti
   du mauvais côté, et le modèle d'inertie (« with no momentum to beat, a feint cannot pay »)
   fait le reste. Prouvé comme la loi du paceBias : un coureur, deux états, rapport des vitesses
   de régime = biteSlow ± 3 pts. La rétraction du clip est COURTE (0,14 s) : à 0,26 s, la morsure
   expirait AVANT que la vraie passe parte — l'avantage s'évaporait pile au moment de servir.
6. **La feinte VIT de sa ressemblance.** L'armé de `feintePasse` est celui de `passe` (clause :
   backswing jambe à ≤ 12°, mesuré 2°) et au « contact » le geste SE RETIENT (cuisse 6° vs 46° —
   l'anti-overshoot est la signature mécanique du geste retenu). Le regard vend la feinte
   gratuitement : `payload.outYaw` = la fausse cible, la politique de regard porteur fait le reste.
7. **La fréquence est une identité sous cooldowns.** `persona.flair` (0,15–1,0) module QUI tente ;
   cooldowns 9/8/9 s + re-tirage espacé (pas de tirage à 60 Hz). Mesuré : ~2,5 râteaux, ~7
   feintes, ~0,8 semelle par partie de 90 s — visible sans cirque (1,45 m → 1,8 m de rayon
   presseur = 12,5 râteaux/partie, le cirque mesuré).
8. **Le seuil suit le monde qu'il juge.** L'arrivée du jeu de rétention a déplacé le temps
   « collé » de 38 ± 10 % à 44 ± 10 % (10 graines × 90 s) — tenir SOUS pression est le sens même
   de ces gestes. `harriedMax` 0,55 → 0,62, sabotage inchangé (~100 %) : la clause garde ses
   dents. Même mouvement pour la bande tempo 2-5 s (plafond 45 → 55 %) et le verrou de balance
   (les ACTIONS comptent : frappées + gestes ≥ 42, plancher frappées ≥ 34).

## Le visuel

Rien de nouveau à câbler : l'événement windup porte `move` + `foot` (+ `skill` pour que l'audit
membre ne prenne pas un râteau pour une frappe), `_playTech` joue le clip (miroir par pied), le
lacet du retournement est COPIÉ de la sim (loi 12), le warp est gardé (`kind !== 'pass'`), la
jambe du geste est masquée du verrou de pieds via `payload.pick.foot`. Le clip `arretSemelle` est
le seul du répertoire dont le sens est l'immobilité — et la tête s'y LÈVE (le ballon est garé,
les yeux sont libres).

## Vérification

- `verify-gestes.mjs` (26) : vocabulaire, ressemblance/retenue de la feinte, situation de chaque
  geste exécuté (géométrie portée par l'événement), couple soudé, morsure-loi, cooldowns, refus
  nommés, sabotages (sans presseur / sans issue → nommé / sortie libre → s'exécute / spam /
  sous conteste).
- `verify-rondo` 40/40 (seuils recalibrés consignés), `verify-animkit` 96/96 (les trois clips +
  miroirs), audit composé 15/0, verrou de balance : record 9,1, 52,8 actions/partie.

## Les passements nourris (`cfg.passements`, note 385 — verify-passements 6/0)

Diagnostic du 16/09 (« tu peux corriger les passements ? ») : le CERCLE du générateur est bon — planche et page (LOD coupé), la
cheville passe à 25-30 cm au-dessus du ballon, le pied qui cercle est masqué du verrou par `pick.foot` —, mais le geste était
AFFAMÉ (1 passement en 15 min de match sur 3 graines) et le ballon était CALÉ LÀ OÙ IL TRAÎNAIT au contact, pas au point que le
clip attend ([0,05 ; −0,40] dans le repère du corps) : le pied d'appui finissait dans le ballon (mesuré en page : 7 cm du centre).
L'entonnoir mesuré sur 300 s (600-1 000 appels de `maybePassement` aux ticks de décision) : le ballon à plus de 0,6 m (256-541 refus —
le porteur conduit ballon devant), aucun jockey à 0,9-2,6 m (176-319), le jockey hors du demi-front de 70° (95-151 — le porteur
reçoit hors du presseur, § 10 : il lui tourne le dos), la charge au-delà de 1,5 m/s (5-31 — les défenseurs du moteur pressent plus
qu'ils ne jockeyent), 5-10 tirages restants à un appétit de dribble de 0,03-0,48 (la cadence et le tiers propre l'éteignent).

- **La loi** (`passements { spot 0,40, lat 0,05, face 100, foe 3,5, fixe 0,45, charge 2,6, ballon 0,75, envie 2, plancher 0,35 }`) :
  le jockey jusqu'à `foe` m ; le porteur POSÉ (< 2,5 m/s) dont le jockey est au demi-front large (70-`face` °) le FIXE — le regard
  tenu (`p._regard`, à terme `p._regardUntil` : la voie du § 7, relâchée seule par `movement`) pendant `fixe` s — et le passement part
  une fois face (mesuré : 0,10 s après le regard, relèvement 62°) ; une charge jusqu'à `charge` m/s se fige quand même (au-delà : le
  râteau) ; le ballon jusqu'à `ballon` m ; le tirage sur `max(plancher, dribM) × (0,32 + 0,42 flair) × gesteF² × envie` ; et LE BALLON
  RAMENÉ AU POINT DU CLIP dès l'entrée (`payload.pin` = spot devant, lat du côté du pied ; `stepGestures` le porte pendant l'armé, vite (tau 0,04) —
  l'escorte le laissait où il traînait —, `skillFollowStep` le cale ensuite) : à 0,6 cm du point au contact (8,1 cm avant).
- **Mesuré** : 3 passements par match de 300 s sur 4 graines (1, 2 et 3 tours, 10 posés sur 12, 4 jockeys qui mordent) contre 1 par
  15 min hier ; graine 3 : 5 (2 posés, 2 morsures) c. 1.
- **`passements: null`** = hier au bit (les portes d'hier, le ballon calé au contact, aucun regard tenu) ; épinglé sur les bancs datés.
- **Dettes** : le ballon à plus de 0,75 m reste refusé (le porteur conduit loin devant : une touche de rappel serait le vrai geste) ;
  les défenseurs chargent plus qu'ils ne jockeyent (la posture jockey est du moteur) ; le passement lancé garde ses lois d'hier.

## Dettes connues

- La semelle des graines très pressées casse toujours (`broke: 'pressé'`) — la tenue complète
  n'existe que sur les graines calmes ; un jour, le porteur devrait CHOISIR un endroit calme.
- ~~Pas encore de roulette, passement de jambes, petit pont~~ — livrés (A4), et les passements nourris le 16/09 (ci-dessus).
- L'audit membre ignore les gestes techniques (filtre `!x.skill`) : leurs clauses composées
  propres (semelle SUR le ballon en monde, pied du râteau au contact) restent à écrire.
