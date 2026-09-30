# Règles bloquantes ou irréalistes — registre (lot 359, 28/09)

Retour utilisateur après un match regardé en entier : « les contrôles, les prises de balle, les dribbles, les conduites de balle,
c'est pas bon tout ça. Je vois même des joueurs courir dans une direction avec le corps orienté vers une autre. Des contrôles où le
joueur contrôle puis part d'un côté mais le ballon est resté à l'endroit du contrôle. Encore des passes dans des angles pas
possibles. Les buts viennent du gardien qui fait des dégagements dans la tête des attaquants, et ça fait but alors que l'attaquant
ne touche même pas le ballon. »

Quatre enquêtes (sondes dans la sim, 4 × 900 s à 8 × 2 700 s par thème, plus des images du match) ont cherché la CAUSE de chaque
symptôme dans le code. Ce registre nomme chaque règle fautive, dit si elle est corrigée, par quelle clé, et ce qui reste.
Toute correction est une loi derrière une clé de `match-config.js` ; la clé à `null` rend le jeu d'hier au bit près.

## 1. Le corps court d'un côté, regarde de l'autre — CORRIGÉ (`corpsSobre`, `allureCorps`)

| Règle fautive | Où | État |
|---|---|---|
| Le corps ENTIER se tourne vers un ballon jusqu'à 35 m (93 % des corps de travers) | `regard-jeu.js` | La tête regarde loin, le corps seulement près : la part s'éteint entre 12 et 25 m |
| Course arrière permise jusqu'à 3,2 m/s — exactement la vitesse du trot de repli (épisodes de 6 à 13 s) | `regard-jeu.js`, `allure-corps.js` | Course arrière ≤ 2 m/s, jamais pour l'équipe qui a le ballon |
| Aucun cap corps/course sous 2,8 m/s | `allure-corps.js` | Table dès 1,5 m/s (120° → 32° à 6 m/s) |
| Le travers peut durer indéfiniment | — | Après 1,2 s de travers, le cap se referme à 30° |
| Deux rotations par image pour les non-porteurs (jusqu'à 1 080 °/s) | `movement.js` | Un seul budget de rotation par image pour tous |
| Le pas chassé s'élargit sans fin avec la vitesse latérale (bassin −76 cm) | `motion-gait.js` (rendu) | Au-delà de 2,6 m/s de côté, la cadence monte (`?chasse-large` : hier) |

Mesuré : corps à plus de 60° de sa course à 2-3 m/s, 31,7 % → 5,6 % ; 3-4 m/s, 17,3 % → 0,2 % ; épisodes de plus de 2 s, 425 → 4.

## 2. Le ballon reste à l'endroit du contrôle — CORRIGÉ (`priseSuivie`)

| Règle fautive | Où | État |
|---|---|---|
| Sous 0,85 m du ballon, la cible du porteur ignore le ballon (`p + poussée × 3`) | `match-sim.js` | Ballon hors du cône de sa poussée : il le contourne (ballon + 0,3 m) |
| L'« assise » du contrôle fige le ballon puis le lâche MORT (< 0,2 m/s dans 46 % des cas) | `conduite-libre.js`, `rondo-sim.js` | Le ballon mort au pied se rejoue aussitôt |
| Foulée minimale : 0,55 m courus avant toute touche (un dribbleur neuf part de 0) | `dribble.js` | Levée pour un ballon mort au pied |
| La fuite du ballon se lit en relatif : s'éloigner d'un ballon arrêté le fait « fuir » | `dribble.js` | Un ballon mort se lit à sa propre vitesse |
| La touche orientée est reprise par le ramassage l'image d'après (55 %) | `rondo-sim.js` | Pas de reprise de sa propre touche orientée pendant 0,6 s |

Mesuré (2 × 900 s) : départs sans le ballon 19 et 13 → 1 et 1 ; ballon lâché mort 61 et 90 → 12 et 16 ; ballon derrière le
porteur en conduite 25-29 % → 14 %.

Traités au lot 360 : la touche orientée choisit parmi 72 directions (5°) avec une vraie avance (≥ 0,6 m, ≥ 2 m/s) —
`priseSuivie.orientee` ; au pas le ballon respire — `rythmeTouche.lent` (0,9 s à l'arrêt → 0,25 s à 4 m/s) : touches droites au
trot p50 0,30 → 0,78 s. Mesuré au passage : les touches rapides au pas restantes sont des touches de VIRAGE (conduite
intérieur/extérieur à 20-140°) — le contrôle serré en tournant, réaliste.

Reste (dettes nommées) : l'interception et la récupération tuent 80 % de la vitesse du ballon sans geste (`rondo.js`) ;
l'amorti-poursuite et le quart de touche n'ont pas de direction.

## 3. Les passes dans des angles impossibles — CORRIGÉ en grande partie (`passeFaisable`)

| Règle fautive | Où | État |
|---|---|---|
| Aucun terme du choix de passe ne lit le regard ni la course | `rondo.js` (score) | Coût d'angle au-delà de 45° du regard, et au-delà de 90° de la course lancée, tempéré par la technique |
| Le pressé frappe le geste « qui tourne le plus » même s'il ne couvre pas l'écart (passes à 100-135°) | `strike-sim.js` | Au-delà de la couverture + 35° : pas de passe, le cerveau choisit autre chose |
| La une-touche ne regarde que l'angle du ballon entrant (37 / 72 dans le dos, médiane 162°) | `premiere-intention.js` | La sortie à plus de 110° du regard n'est pas candidate |
| Les passes en l'air font pivoter le corps sans limite (685-1 234 °/s) | `rondo-sim.js` | Pivot borné à 6 rad/s |
| Les fenêtres de surface couvrent presque 360° (intérieur [-65, 165], déviation [-80, 180]) | `technique.js` | Dette : le contrat les accepte encore ; la porte réelle vit désormais au choix |

Mesuré (4 × 900 s) : frappes physiquement impossibles 9 % → 3 %.

Traités au lot 360 : la PORTE AU CONTACT (`passeFaisable.contact`) — le choix supposait que le corps tournerait pendant l'armé, il
tournait moins (les passes pressées en « déviation » partaient à 104-123°) ; au contact, au-delà de 100° du regard, la passe part
en TOUCHE DE FORTUNE (≤ 7 m/s, bruitée) ; la dispersion paie l'angle (`passeFaisable.sigmaAngle` : ×1,2 à 45°, ×1,8 à 90°).
Passes à plus de 100° du corps 2,7 % → 1,5 % (4 × 900 s), les fermes (> 8 m/s) 3 → 1.

Reste : la re-visée au contact qui peut décaler la passe de 30° après l'engagement du corps.

## 4. Les buts « de la tête » sans toucher le ballon — CORRIGÉ (`reprisePhysique`, `relanceObstacle`, `buteur`)

| Règle fautive | Où | État |
|---|---|---|
| Tête et volée réflexes sans temps de réaction : quiconque à 1 m prend le ballon | `tete.js` | Ballon frappé il y a < 0,3 s qui arrive à > 12 m/s sur le joueur : contact SUBI (rebond à 30 % de sa vitesse, direction de hasard), pas un tir |
| La tête/volée au but remplace la vitesse du ballon par une frappe cadrée neuve, quel que soit le ballon entrant | `tete.js` | Reste pour les ballons lisibles ; les ballons subis ne sont plus des tirs |
| La volée au but part dans le dos du joueur (155-177° du regard, à 26 m/s) | `tete.js` | Volée au but à moins de 100° du corps, tête à moins de 120° |
| Le gardien relance sans regarder les adversaires devant lui (la marge de couloir n'était qu'écrite) | `keeper.js` | Aucun adversaire à moins de 1,2 m des 8 premiers mètres : sinon une autre cible, l'autre flanc, l'axe |
| Le but ne nomme pas son buteur ; la célébration prend le tireur des 6 s ou le plus proche | `referee.js` | Le but nomme le dernier toucher (Loi 17), contre son camp compris |

Mesuré (8 × 30 min) : reprises instantanées au but 4 (dont 4 buts) → 0.

Traités au lot 360 : le gardien sort de l'accompagnement de sa relance quand le ballon revient vers son but (`gkReprise`,
`gardien-reprend.js`) ; une tête par corps en 0,5 s (`reprisePhysique.teteCd`) ; le contre d'un ballon frappé il y a moins de
0,3 s ne s'étend qu'à 0,6 m — le corps, pas la jambe tendue (`reprisePhysique.rayonReflexe`).

Reste (dettes nommées) : le plafond de tête sautée (jusqu'à 3,14 m) est généreux ; la main du gardien à 9 m peut être interceptée.

## 5. Autres règles irréalistes relevées en route (non traitées dans ce lot)

- La séparation sociale pousse les corps jusqu'à 2,4 m/s sans toucher `p.v` : le rendu la lit comme un pas de côté.
- Le cap de l'arbitre claque sur sa vitesse (`referee.js`).
- `retournement.max 0.5` autorise explicitement « frapper à moitié tourné » pour réduire les pertes.
- `tirImmediat` (`elan.js`) saute la porte de la stance.
- La talonnade n'est bornée que par sa probabilité, pas par la distance ni la vitesse (hors `porteeGeste`).
- La une-touche plafonne à 12 m/s à tout angle quand le dosage est coupé.
- Peu de porteurs LANCÉS en transition (chantier #39, l'intelligence).

## 6. Signaux du banc lus au lot 360

- La une-touche est passée de 67 à 43-45 par équipe et par match au 359 : la cible réelle est 15-25 — c'était un EXCÈS qui
  se résorbe, pas une perte.
- Les centres ont doublé (7 → 15 par match) : ils restent sous le réel ; le mouvement va dans le bon sens.
