# La feuille de match du corps (`feuille.mjs`)

Lot L5 du cadrage (le panneau de statistiques de /match11), source du lot L4 (les données qui sortent). Créée le 3 octobre 2026.

## 1. Ce qu'elle fait

La feuille traduit le **journal** de Gameplay Football (`contrat.mjs`, `corps.md` § 10.6) en **faits** au schéma de la skill (`stats.js` : `{ k, t, per, team, by, x, z, … }`). Elle rend ensuite le **rapport de la skill tel quel** (`statsReport`) :

- par équipe, pour le match ou pour une mi-temps ;
- par joueur, avec la note `noteDe` ;
- les tirs, les buts, la courbe d'xG.

C'est l'exigence EX-39 : un seul schéma d'événements. La page, les bancs et, demain, la carrière lisent la même feuille.

Elle est en **lecture seule** : elle lit l'état et le journal qu'on lui passe, et n'appelle jamais le module WebAssembly.

```js
import { creerFeuille, nomsDesJoueurs } from './feuille.mjs';   // ou depuis le paquet : out/cerveau.mjs
const e0 = corps.etat();
const feuille = creerFeuille({ etat: e0, noms: nomsDesJoueurs(graine, e0), poste: (id) => cerveau.profil(id)?.poste });
// après CHAQUE avance du corps (le même journal que reçoit le cerveau) :
feuille.observer(corps.etat(), journal, { per: 1, dt: 0.1, cerveau });
feuille.rapport();            // le match ; rapport({ per: 1 }) la première mi-temps
feuille.chronologie();        // les buts et les cartons, avec la minute
feuille.nom(id);              // « M. Diallo »
```

## 2. Ce que le journal ne dit pas, et comment la feuille le décide

| Fait | Source | Décision |
|---|---|---|
| Tir | TOUCHE de geste 8 | Il se résout au premier des quatre : le but (BUT, même équipe), la touche du gardien adverse (**arrêté**), d'un autre adversaire (**contré**), le passage de la ligne de but (interpolé entre deux lectures : **cadré**, **hors cadre**, **frôle** à moins de 25 cm d'un montant ou de la barre). Sinon, 5 s plus tard : « autre ». |
| Partie du corps | TOUCHE, `a` | `a = 1` (touche voulue sans le pied) : la tête ; sinon le pied. |
| Penalty, coup franc direct | CPA puis la première touche du tireur | Le tir qui suit un CPA de mode 6 (ou 3) par son tireur. xG de référence 0,76 (0,06). |
| xG | `stats.js xgRef` | La référence indépendante des deux moteurs (distance et angle d'ouverture). |
| Passe | TOUCHE de geste 4, 5 ou 6 | Le compte des bancs. L'événement PASSE (au contact) y ajoute le destinataire et la vitesse. Elle se juge à la touche suivante d'un **autre** joueur : coéquipier, réussie ; adversaire, interceptée. Elle échoue sur un arrêt de jeu, un hors-jeu, une faute, ou 8 s sans touche. |
| Une-touche | TOUCHE | La passe est la première touche du joueur (la touche précédente est d'un autre), hors remise en jeu. |
| Récupération | état (possession déclarée) + TOUCHE | La possession déclarée par le corps passe à l'autre équipe **et y reste 0,4 s**. La cause est la touche qui a gagné le ballon : interception (passe coupée ou geste « intervention »), tacle, gardien, ballon libre. Sans la stabilisation, les ballons disputés comptaient trois fois trop (mesuré le 3 octobre : 106 récupérations en 12 minutes, 36 avec). |
| Tacle | TOUCHE de geste 13 | Un tacle qui touche le ballon est gagné ; les tacles manqués ne sont pas dans le journal. |
| Faute, cartons | FAUTE | Chaque événement est une faute (le carton seul, après l'avantage, aussi : comme les bancs). Gravité 2 : jaune ; le second jaune ajoute un rouge. Gravité 3 : rouge. |
| Corner, sortie de but, touche | CPA de mode 4, 2, 5 | L'équipe qui reprend. |
| Dribble | le cerveau (`gesteDernier`, `faceDerniere`) | Un geste en course est réussi s'il n'a pas fini sur une touche adverse ; un face-à-face, selon son issue. Sans cerveau (`?ia`), pas de dribbles. |
| Distance, sprints, vitesse max | état | Les déplacements entre deux lectures (un replacement à plus de 12 m/s est ignoré) ; un sprint passe 7 m/s et finit sous 5,5. |
| Minutes jouées | horloge du match | Le temps des arrêts de jeu compte : c'est la durée sur le terrain. |
| Possession | état | Le temps **simulé**, ballon en jeu, par équipe déclarée. |
| Heatmap, forme de l'équipe | état | Par lecture, ballon en jeu ; grille 21 × 14 sur 110 × 72 m. |

Le sens du jeu : l'équipe 0 attaque +x, l'équipe 1 −x, sans changement de côté à la mi-temps (`corps.md` § 7.8). Les positions des faits sont dans le sens de l'équipe ; z = −y, le latéral de la scène.

Les noms sont fictifs (EX-46) : une initiale et un patronyme courant, tirés par la graine.

## 3. La garde (`bancs/feuille.mjs`)

```sh
node bancs/feuille.mjs [minutes=20] [graine=7]
```

1. Ses comptes retrouvent le journal brut, compté sans elle : les buts (et le score du moteur), les tirs, les passes, les fautes, les cartons, les hors-jeu, les corners.
2. Elle est en lecture seule : deux parties sur deux modules WebAssembly, l'une avec la feuille, l'autre sans, donnent la même empreinte.
3. Son coût : 0,04 ms par avance de 10 pas.

Mesuré le 3 octobre (12 minutes, graine 7) : « FEUILLE GARDÉE », tous les comptes identiques, la même empreinte (353890317).

## 4. Ce qu'elle a fait voir

**Les corps courent trop.** Les joueurs de champ courent 3,9 m/s de moyenne en temps simulé, contre environ 2 m/s dans le réel (≈ 10-11 km en 95 minutes). Trois mesures indépendantes concordent : les positions à 10 ms, à 100 ms, et le champ « vitesse » du corps. Ils ne marchent presque jamais : 13 % du temps sous 1 m/s, 64 % au-dessus de 3 m/s. Le panneau affiche donc des distances d'environ 15 km par 90 minutes.

C'est une mesure du moteur, pas de la feuille. Elle n'est pas corrigée ici : pas de réglage avant le moteur définitif.

## 5. Ce qui manque

- Les duels aériens, les centres, les dégagements fins, les contrôles ratés : le journal ne les nomme pas (à déduire du geste et de la hauteur du ballon, plus tard).
- Les tacles manqués et les fautes subies sans coup de sifflet.
- Les remplacements : le corps n'en fait pas encore (L6).
- La note du gardien lit l'xG cadré face à lui : elle n'a de sens qu'avec des tirs cadrés en nombre.
