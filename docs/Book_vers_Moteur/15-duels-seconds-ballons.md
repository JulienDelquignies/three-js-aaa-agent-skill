# Bible 15 — Duels et seconds ballons, contre le moteur

*Fiche du 9/09, moteur 5b10d6b (SCEAU 256). Mesures : 2 matchs de 90 min (graines 3, 7), 4-3-3 contre 4-3-3.*

## 1. Ce que le chapitre demande

- **Le volume oublié** : 43 duels aériens contestés, 39 duels de ballon libre, 145 duels défensifs au sol (dont 6,7
  glissés), 29 dégagements, 26,3 fautes, 3,9 jaunes, 0,1-0,2 rouge **par match** ; `LOOSE` comme état de premier
  rang (sans destinataire, réallocation simultanée des 22) ; trois barèmes incompatibles (Wyscout / Opta / StatsBomb).
- **Le jeu long** : quatre gestes (`Launch` 43,6 m, dégagement 20,7, six mètres 65,6, ballon haut), réussite 54-57 %,
  possession conservée 28,6 % à 10 s, +35,7 m de gain à 8 s, part des passes longues 8-20 % selon l'école.
- **Le duel aérien** : anatomie, probabilités (DF 55,7 / MD 41,8 / FW 35,9 ; pente de taille 65,8 c. 25,6 % à ± 15
  cm ; **asymétrie posturale** DF 55,8 c. FW 34,4 à taille égale), P(neutre) 10 %, la **sortie** du ballon (12,2 m
  médian, σ angulaire 75°, 25,9 % vers l'arrière).
- **Le second ballon** : gagner le duel ne donne pas le ballon (45,1 % au milieu, 40,6 après un six mètres, 67,1
  sur centre), délai 2,25 s, chaînage 14 % vers un duel au sol, le rôle `TRAIL`, ×3-5 de tir après second ballon
  offensif.
- **Le duel au sol** : glissé rare (6,7), P(faute) 24 c. 14 %, P(carton) 10 c. 1,7 %, fautes par tiers, la faute
  tactique ; **le dribble** : 66,7 c. 52,0 % par tiers, 20,8 % de fautes obtenues, 25,3 % de sorties après raté ;
  **le duel de course** (rattrapage) ; **les redistributions** (six mètres non monotone 75 / 52 / 55-65, touche
  80 / 61, 44 touches par match, 1 but pour 49 touches longues).
- **Le modèle** : le duel produit un **vecteur** (`DuelResolution` : issue à cinq états, vitesse de sortie,
  qualité de touche, indisponibilité du perdant), jamais un vainqueur ; cinq erreurs à ne pas commettre.

## 2. Où en est le code

**Existant.** La **tête** (34 tete.js, 112 le duel contesté « en venant », 147 ; but / dégagement / remise, saut
0,75, `duel` 1,9 m : le rival gêne, la tête part bruitée), la **volée**, la **poitrine** (182a) ; le **50/50**
(153 premier pas, 154 prise au contact, `LOOSE` existe comme phase de ballon) ; le **duel au sol** (duel.js :
tacle glissé avec faute / vide / gagné, charge derrière, épaule, accrochage, `tacle-pique`) ; la **Loi 12** (avantage,
mur, jaune à la récidive 2, rouge) ; la **touche** (rentrée courte / longue 217-219) ; les **corners** typés ; la
**rentrée** longue du gardien ; le dribble et les gestes (skills-sim) ; le **rattrapage** (`courseServie`,
`rattrapeAtk`).

**Partiel.** Le duel aérien existe mais **rare** (10 contestés par match) et **inversé** (l'attaquant gagne 71 %) ;
le second ballon existe (délai 2,05 s ✓) mais l'équipe du frappeur récupère à 63 % (réel 45) ; le tacle glissé est
**l'action ordinaire** (82 par match, 2 % de fautes) ; les cartons pleuvent (8,5 jaunes, 1 rouge par match) ; la
passe longue est rare (2,4 %) et **ne se manque pas** (65 % conservés à 10 s, réel 29) ; les touches sont trois fois
trop rares (14).

**Absent.** `DuelResolution` comme vecteur (issue neutre, indisponibilité du perdant, σ angulaire de sortie) ;
la posture (`ballFacing`, `runUp`) et la pente de taille explicite ; `P(vainqueur récupère)` dépendant de la
structure ; `TRAIL` ; le dégagement comme geste (zone interdite, sortie latérale 79,5 %) ; les fautes par tiers et
la faute tactique comme pari ; la non-monotonie du six mètres ; la touche comme moment contesté.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| D1 duels aériens contestés | 43 ± 20 % (Opta 25-50) | mesurable, **réfuté** | **10** / match (68 têtes jouées) |
| D2 duels de ballon libre au sol | 39 ± 25 % | mesurable, **gonflé** | **182** (épaule + pique + glissés : le glissé fait le nombre) |
| D3 P(aérien gagné) par poste | DF 55,7 / MD 41,8 / FW 35,9 | mesurable, **inversé** | **FW 71 %**, DF 30, MD 36 (38 duels) |
| D4 P(neutre) | 10 % | absent (tirage à deux issues) |
| D5-D6 taille, posture | | absents (la détente existe, pas la posture) |
| D7 distance duel → reprise | 12,2 m | à instrumenter (sonde NaN) |
| D10 le vainqueur récupère | 45,1 % au milieu | mesurable, **réfuté** | **63 %** (toutes zones) |
| D12 délai duel → contrôle | 2,25 / 4,46 s | mesurable, **tenu** | **2,05 / 3,47 s** |
| D14 possession conservée 10 s après un long | 28,6 % | mesurable, **réfuté** | **65 %** (74 passes ≥ 32 m) — le jeu long est une passe qui réussit |
| D15 gain territorial à 8 s | +35,7 m | mesurable | **+19 m** |
| D17 longueurs | Launch 43,6 / six mètres 65,6 | mesurable | première passe du gardien après six mètres **43,6 m** (11) ; rentrée longue 0 (aucune touche longue) |
| D20 tacles glissés | 6,7 / match | mesurable, **au 269** : **4,6** / match (8 × 45 min ; p 0,55 par occasion battue, refus 1 s) | avant : **82,5** (18-23 à la veille du 269) |
| D21 P(faute) glissé / debout | 24,2 / 14,0 % | mesurable, **au 269** : **19 % / 0 %** — le glissé fait faute au taux du book (pFaute 0,4 par vide à portée), le debout n'en fait toujours pas (le tacle debout par le noyau, nommé) | avant : **2 % / 14 %** |
| D23 fautes par tiers | P 8,5 / 18,9 / 22,0 | mesurable (part) | 22 / 63 / 15 % — la faute vit au milieu |
| D24 fautes / jaunes / rouges | 26,3 / 3,9-4,4 / 0,10-0,20 | mesurable, **réfuté** | 23,0 ✓ / **8,5** / **1,00** |
| D28-D29 six mètres, touche | non monotone ; 80 / 61 | à instrumenter |
| D30 touches | 44 ± 20 % | mesurable, **réfuté** | **14** |
| D33 passes ≥ 32 m | 7,9-19,7 % | mesurable, **réfuté** | **2,4 %** |
| D35-D40 | | à calibrer / à instrumenter |

## 4. Les lots que la fiche appelle

1. **Le duel comme vecteur** (D3, D4, D6, D8, D10) : `DuelResolution` — issue neutre, posture (le défenseur face au
   ballon gagne, l'attaquant dos au jeu perd), la sortie stochastique (σ 75°, 26 % en arrière), le vainqueur qui ne
   récupère qu'une fois sur deux.
2. **Le tacle glissé comme dernier recours** (D2, D20, D21, D24 ; ch. 03 « distance d'intervention ») : 82 glissés
   par match, 2 % de fautes, 8,5 jaunes — c'est le même lot que le 257 (carton juge la nature) et l'intervention à
   3 m.
3. **Le jeu long qui se manque et le ballon qui sort** (D14, D15, D17, D30, D33 ; ch. 02 longs du gardien 83 %,
   ch. 09) : la passe longue à 54 %, 28,6 % conservés, 44 touches par match — la « passe qui se manque » des neuf
   premières fiches.
4. **La tête comme volume** (D1) : 10 duels contestés — le jeu long rare (2,4 %) ne nourrit pas le ciel ; lot 3
   d'abord.
5. **Les redistributions comme moments contestés** (D28, D29, D31) : six mètres, touche, le second ballon après.
