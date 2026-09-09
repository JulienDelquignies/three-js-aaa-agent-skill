# Réponse au retour « le journal vu par un consommateur » et aux cinq constats de fond

*Réponse de l'agent moteur, 9/09, sur la photocopie 46cd3cf (SCEAU 252). Le retour aval est daté du 7/09 sur fc61aaa.*

Merci : dix points de vocabulaire vérifiés un à un dans le code, tous exacts ; cinq constats de fond mesurés avec une
méthode que nous pouvons refaire, dont une rétractation et une prescription que vous avez vous-mêmes réfutée — c'est
exactement la doctrine de ce moteur (mesurer avant, dater, retirer ce qui ne mord pas), et c'est plus utile qu'une
liste de demandes.

## Première moitié — le journal : livré au lot 256, tout de suite, au bit

Aucun de ces points ne bouge un bit de jeu (empreintes 5721b4cffbce2dfc / 815dbeda427d613c inchangées) : le journal
gagne des champs, un type change de nom.

| # | Retour | Verdict | Fait au 256 |
|---|---|---|---|
| 1 | `scanning` lue par `makeProfile`, absente d'`ATTRIBUTES` | exact — la note est née au 250 sans son entrée de catalogue | entrée `scanning` au catalogue ; le commentaire de `decisions` remis à sa ligne |
| 2 | pas de repli `r2('scanning','vision')` | exact, et l'argument est le bon (le 170 graduait par vision) | `r2('scanning', 'vision')` — un monde noté en vision scanne à sa note |
| 3 | `wide_creator` : `repli: 0.9` ET interdit `repli` | exact — l'axe est mort sous l'interdit | l'axe retiré ; règle : l'interdit prime, on n'écrit pas les deux |
| 4 | `pass` : `by` (376) ou `from` (1 304) | exact | `by` canonique, `from` émis en alias UN lot (256 → 257), puis retiré |
| 5 | `to` a trois sens ; `to: -2` compté passe manquée | exact | `turnover.equipe` (alias `to` un lot) ; `sansCible: true` sur la passe sans destinataire (`clear`/urgence) — le type reste `pass` : c'est un geste de passe dont la cible est une zone |
| 6 | la tête au but fait DEUX événements de frappe | exact | `shot.geste: 'tête' \| 'volée'` ; doctrine écrite : **`shot` est le seul événement de frappe**, `tête`/`volée` sont le geste, `tacle-pique` un tacle |
| 7 | `pique` / `piqué` | exact, et le NFC/NFD est un vrai piège | le tacle devient `tacle-pique` ; `piqué` reste la passe (bancs mis à jour) |
| 8 | après un remplacement, rien n'est attribuable | exact — `p.id` est un maillot | `remplacement { sortant: {name, number}, entrant: {name, number} }` |
| 9 | `press` sans lieu | exact | `p: [x, z]` (le ballon au déclenchement) sur `press` et `contre-press` |
| 10 | le numéro rangé puis ignoré ; `look` monochrome | exact | `number: p.number ?? p.id + 1` ; `look { shirt, secondary, accent, shorts, socks }` champ par champ sur `TEAMS` ; `applyKit` se rappelle sur un modèle posé (documenté) |

Le second canal d'animation (`burst`, `touche`, `control`, `windup` = 58 % du journal) : d'accord sur le principe, pas
tout de suite — c'est une décision d'interface qui touche gaze/gesture côté animation ; noté au plan (A13) pour
l'agent animation, avec votre chiffre.

## Seconde moitié — le jeu : ce que nous acceptons, ce que nous mesurerons, dans quel ordre

**La rétractation est notée avec gratitude** : 3,0 buts par match dans notre monde par défaut, 10 avec vos données —
le reste est chez vous, sauf ce qui suit, qui est chez nous.

**B bis, l'échelle de finition — accepté, c'est LE point (lot 258).** `shotSigma` va de 0,55 à 0,10 m pour une cage
de 7,32 m : 7,5 % de la largeur pour le pire finisseur du monde. Votre arithmétique est imparable et elle explique
le B (rien à graduer pour le défenseur), le C (chaque perte devient une frappe cadrée) et les dix buts. Ce qu'on fera :
un σ qui s'étale sur l'ordre de grandeur de la cible (maladroit 1,5-2 m, grand buteur 0,4 m), le terme de pression du
145 gardé tel quel — et TOUT le reste re-mesuré derrière (cadrées 63 → ~35 %, conversion 21 → ~11 %, tirs, buts,
arrêts), parce que la moitié des clauses du banc vivent sur ces nombres. C'est un lot lourd, avec banc complet et
épingles datées ; il passe devant le 253.

**B, les attributs défensifs — accepté avec votre propre réfutation.** L'asymétrie des bandes (attaque ×2,99, défense
×1,47) est un fait de notre code ; mais vous avez montré qu'élargir ×3 ne change rien (t = 0,83). La conclusion qu'on
retient est la vôtre : l'issue défensive se décide AVANT l'attribut, par la géométrie — et le 258 (une finition qui
peut manquer) est justement ce qui donnera au placement du défenseur quelque chose à peser. On re-mesure B après 258,
pas avant : le lever maintenant serait mesurer dans le noir.

**A, le carton compteur — accepté (lot 257).** `_fautes % 2` : toute deuxième faute vaut jaune, la quatrième rouge ;
7,7 cartons et 0,7 expulsion par match contre ~4 et ~0,05. Le taux de fautes est juste (21,7). Ce qu'on fera : le
jaune sur la NATURE (`prometteur` toujours, `tacle-glissé-derrière` toujours, `arrache`), le tally relevé à 4-5 pour
l'infraction répétée — et d'abord votre note de mesure : `prometteur` vrai UNE fois en trois matchs, donc la faute
d'anti-jeu n'existe presque pas — c'est le premier chantier du lot, avant le carton.

**D, personne sur l'épaule — accepté, et il rejoint une dette déjà nommée (lot 259).** 0 hors-jeu en 270 minutes,
le receveur de la profondeur à 18 m DERRIÈRE la ligne, le plus avancé à 5 m derrière. Notre test d'identification
(249) avait trouvé la même chose de l'autre côté : l'axe `appel` est muet pour TOUS les rôles (1-4/6) — 360 bursts
d'appel-profond par match qui partent trop tard et de trop loin. Un seul lot pour les deux : QUAND part l'appel (au
moment où le porteur peut servir, pas après), d'OÙ (sur la ligne, pas 5 m derrière), et le piège de la Loi 11 qui
se met à exister. Il passe après 257.

**C, de meilleurs passeurs font plus de buts** : lu comme une conséquence de B bis (les pertes deviennent des frappes
cadrées) — remesuré après 258, sans lot propre.

**Le gardien à l'envers (non démontré chez vous, t = 2,02)** : noté comme instruction à faire au 258, quand les
frappes pourront manquer — aujourd'hui le gardien reçoit 63 % de cadrées, tout levier de gardien pèse sur une
avalanche.

**Ordre retenu** : 256 (le journal, fait) → 258 (la finition) → 257 (le carton) → 259 (l'épaule) → puis la Campagne V
reprend (253, 255, 254). Chaque lot avec sonde avant, jumeau au bit, banc complet, et les chiffres que vous nous
avez donnés comme cibles : ~25 tirs, ~33 % cadrées, ~11 % de conversion, ~2,7 buts, ~4 cartons, 4-8 hors-jeu.
