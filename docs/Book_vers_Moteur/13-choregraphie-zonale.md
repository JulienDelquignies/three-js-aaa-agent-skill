# Bible 13 — La chorégraphie des 22, contre le moteur

*Fiche du 9/09, moteur 8411879 (SCEAU 256). Mesures : 2 matchs de 90 min (graines 3, 7), 4-3-3 contre 4-3-3. Bandes B1→B6 de 17,5 m depuis le but de l'équipe en possession.*

## 1. Ce que le chapitre demande

- **Un générateur, pas un atlas** : `p_ref = f(ballon, phase, rôle, consigne, hauteur de bloc)` à six termes (ancre
  de rôle, attraction du ballon, répulsion des partenaires, couloirs, ligne de hors-jeu, consigne), avec des poids
  par rôle en possession et un générateur distinct pour l'équipe qui défend ; deux points présupposés à définir
  (`TeamFrame` daté copié par chacun — la seule source d'erreur autorisée — et la hauteur de bloc).
- **Les invariants mesurés** (§1.3) : longueur par bande en U (42 / 39 / 37 / 36 / 39 / 46), largeur maximale au
  milieu (41 / 44 / 45 / 45 / 42 / 41), gardien ↔ partenaire croissant en possession (12 → 33) et décroissant sans
  ballon (30 → 9), aire convexe 968-1 408 en possession / 805-1 158 sans, stretch bimodal 7-10 / 12-16, GC-GC 4-12 m,
  la **structure en deux couches** (externe 6, interne 4, ratio d'aires mode 0,18, jamais > 0,50).
- **L'ordre causal** : `onsetLatency` = 0,22 + 0,008·d (+0,55 s au-delà de 25 m) → étalement ≈ 1 s entre le premier
  et le dernier partant ; trois transitions chronométrées ; le bilan énergétique d'une passe (200 / 350 / 440 m) ;
  l'ordre canonique côté possession (receveur → soutiens → largeur opposée → ligne).
- **Non-encombrement** : ≤ 2 par couloir vertical, C1 et C5 toujours pourvus, distance minimale 6-9 m au partenaire,
  évitement local.
- **La respiration** : compression en 2-3,5 s (`TAU_COMPRESS` 1,2), expansion en 3-6 s (`TAU_EXPAND` 2,6), période
  8-20 s, les deux blocs en opposition de phase partielle.
- **Les rotations** comme séquences temporisées (déclencheur, rôles, `startOffset`, verrou `lockMs`, abandon), pas
  comme champ.
- **Du champ au comportement lisible** : hystérésis, zone morte, coût, **engagement d'intention** ; le champ propose,
  la machine à états dispose ; l'**immobilité active** (≥ 6 s à > 30 m du ballon).
- Le **test 25** : rendre les agents omniscients doit faire disparaître l'étalement et garder les invariants.

## 2. Où en est le code

**Existant.** La formation comme spots (`formation.js` : `blocFor`, le bloc défensif chaîné au ballon, l'attaque
étirée à `longAtk`, la ligne de soutien, la pousse, le latéral faible qui rentre, la surcharge côté ballon) ; les
**cinq couloirs** (241 `couloirs` : ≤ 2 cibles de la structure d'attaque par couloir, hystérésis 2 s, remplir le
demi-espace, pointes libres) ; les **ancres craie** (249b, hystérésis 6 s) ; le **placement** comme note (246 : bruit,
tenue 3 s, zone morte) ; la **respiration** implicite (bloc 30 → 42 m) ; le **scan** (250) et le corps ouvert ; les
rotations nommées par rôle (wide_creator, false_9, inverted…) ; le comité des soutiens, le troisième homme.

**Partiel.** Le générateur existe comme **empilement de lois** (spot + coulissement + couloirs + ancres + soutien),
sans `TeamFrame` daté : chaque joueur lit l'état vrai ; les couloirs ne valent que pour la structure d'attaque (le
registre des dix, 241, reste borné à 2 par couloir mais mesure 99 % d'images à ≥ 3 corps dans un couloir, toutes
lignes comprises) ; l'hystérésis existe par loi (2 s, 3 s, 6 s) sans zone morte d'ensemble ni engagement d'intention.

**Absent.** `onsetLatency` et l'étalement (les 22 décident au même tick — mesuré ch. 01 T15) ; le gardien couplé au
repère d'équipe (ch. 02) ; la structure en couches comme contrainte ; la respiration asymétrique (`TAU`) ; les
rotations comme séquences verrouillées ; l'immobilité active ; la distance minimale au partenaire (répulsion).

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| 1 longueur par bande | 42/39/37/36/39/46, forme en U | mesurable, **réfuté** | **39 / 39 / 40 / 41 / 39 / 39** — plate : `longAtk` 42 constant, pas de compression au milieu ni d'étirement en B6 |
| 2 largeur par bande | 41/44/45/45/42/41, max en B2-B4 | mesurable, **réfuté** | **52 / 49 / 49 / 52 / 53 / 52** — 8-10 m trop large partout, plate |
| 3 gardien ↔ partenaire | 12/16/23/27/31/33 croissante | mesurable, **partiel** | **10 / 12 / 16 / 29 / 41 / 49** — croissante mais le gardien reste chez lui : 49 m en B6 (réel 33) |
| 4 ratio des enveloppes | mode 0,18, jamais > 0,50 | mesurable, **partiel** | p50 **0,12**, > 0,5 sur 0 % — structure « en anneau » (le défaut de l'atlas) |
| 5 couches | externe 5/6/7 = 24/42/24 ; interne 3/4/5 = 12/51/32 | mesurable, **proche** | externe 5:33 **6:38** 7:18 ; interne 3:37 **4:47** 5:12 — modes justes, interne trop pauvre |
| 6 aire convexe | 968-1 408 possession / 805-1 158 sans | mesurable, **partiel** | **1 335** ✓ / **719** — le bloc sans ballon trop petit |
| 7 stretch bimodal | 13-16 / 8-10, écart ≥ 4 | mesurable, **décalé** | **18,7 / 14,0** — écart 4,7 ✓ mais les deux modes 4-5 m trop hauts |
| 8 étalement des départs | 0,9-1,2 s, ≥ 0,4 | hors définition (ch. 10 T5 : 91 % déjà en mouvement) |
| 10 mouvements préemptifs | 55-80 % | à instrumenter sur `receive` |
| 13 C1 et C5 occupés | > 85 % | mesurable, **réfuté** | **69 %** |
| 14 ≥ 3 corps dans un couloir | < 8 % | mesurable, **réfuté** | **99 %** des images (dix joueurs, toutes lignes — l'atlas du book est à 92 %) |
| 15 distance au partenaire | P5 6-9 m, P1 ≥ 3 | mesurable, **réfuté** | P5 **2,7 m**, P1 **1,0** — agglutination : pas de répulsion |
| 16 densité à 10 m | 4-5 | ch. 10 T7 : **3,0** |
| 17 vibration | < 12 / min, > 25 échec | mesurable, **entre** | **18,7** changements de signe / joueur / min |
| 18 immobilité active | ≥ 6 s au moins 1 fois par possession | mesurable, **réfuté** | épisode p50 **1,6 s** ; ≥ 6 s dans 17 % des épisodes — personne ne reste en place |
| 21 courses non récompensées des ailiers | 60-80 % | ch. 08 : 217 sprints, service 11 % → 89 % — au-delà de la cible par excès |
| 22 GC-GC | 4-12 m longitudinal, 0-4 latéral | mesurable, **partiel** | **13,0 / 2,9 m**, > 20 m sur 7,6 % des images |
| 23 ligne des D vs ligne de hors-jeu | écart 0-4, arbitrer sur le second | **tenu** | écart 0,0 ; offside.js arbitre bien sur le 2ᵉ toutes lignes |
| 24 temps de vol cohérents | 0 % | tenu (balistique de strike-sim, ballon.js) |
| 25 invariant d'omniscience | | sans objet (les agents lisent l'état vrai) |

## 4. Les lots que la fiche appelle

1. **Le repère d'équipe daté** (tests 8, 25 ; ch. 10 lot 1, Modèle 04) : `TeamFrame` copié avec latence, la seule
   source d'erreur — l'étalement des départs en sort.
2. **La longueur et la largeur par bande** (tests 1, 2, 6, 7) : le générateur en possession suit le ballon (U de
   longueur, largeur 41-45 pas 52) — `longAtk` constant et les ancres à 0,92 × hz sont trop larges, trop plates.
3. **La répulsion entre partenaires et la contrainte V pour les dix** (tests 14, 15) : P1 à 1 m, 99 % des images
   avec un couloir à ≥ 3 — le registre 241 doit couvrir les dix (il le fait pour les cibles, pas pour les corps).
4. **L'immobilité active et l'engagement d'intention** (tests 17, 18) : hystérésis d'ensemble, zone morte, le joueur
   loin du ballon qui tient sa place 6 s.
5. **Le gardien dans le repère** (test 3, ch. 02) : 49 m du partenaire le plus proche en B6.
6. **La respiration asymétrique** (§6) : `TAU_COMPRESS` / `TAU_EXPAND`, mesurable par la période du stretch.
