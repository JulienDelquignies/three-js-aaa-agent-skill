# Bible 12 — Le système de marquage et la passation, contre le moteur

*Fiche du 9/09, moteur 8411879 (SCEAU 256). Mesures : 2 matchs de 90 min (graines 3, 7), 4-3-3 contre 4-3-3.*

## 1. Ce que le chapitre demande

- **Trois écoles** (individuel strict, zone intégrale, zone mixte) comme **poids** sur quatre référentiels
  (ballon, adversaire, partenaire, but), pas comme trois codes ; `markRefWeight`, `markPersistence` exposés.
- **Prendre / faire prendre / parler / lâcher** comme machine à états par claim (`OWNED`, `HANDING_OFF`, `ORPHAN`,
  `RELEASED`), quatre critères de bascule (frontière de zone +2 m ≥ 0,4 s, distance d'intervention dépassée 15 / 10 /
  5-8 m, relayeur qualifié face au jeu, veto ballon < 12 m), score > 0,55 pendant 2 ticks (l'anti-clignotement).
- **La parole** : message `HANDOFF`, portée 15 m, latence 0,30-0,60 s, boîte à 1 message — la source réaliste des
  « deux qui se regardent ».
- **La géométrie** : point d'ancrage entre ballon, adversaire et but ; l'ombre de couverture ; le **marquage
  élastique** (`markDistance` : 0,5 m à 6 m du ballon → 12 m à 30 m, × école, × danger, plancher dos au but 1-2 m,
  + avance de vitesse × 0,25 s).
- **La passation** comme enchère (`bid`), verrou, consensus ; coût de réassignation et hystérésis ; la passation
  d'urgence.
- **Le joueur entre les lignes** : hiérarchie des preneurs et **cascade** quand personne ne le prend (la ligne
  recule de 1,5-3 m).
- **Courses croisées** (`crossSwitchPolicy` FOLLOW / SWITCH), les rotations (Monaco 2017), la table des erreurs par
  école ; **décrochage** : le central accompagne 4-6 m puis s'arrête et parle, veto absolu si un attaquant part
  dans son dos.
- **Le coup de pied arrêté** : 2,0-4,2 % de buts par corner, 7-11 % des buts, trois dispositifs, la contrainte
  visuelle, le gardien arbitre du protocole (`GK_CLAIM`), le second ballon comme réallocation en masse, jamais de
  passage individuel → zone sur un même CPA.
- **Presser ou garder son homme** : la règle d'arbitrage, différente par école.

## 2. Où en est le code

**Existant.** L'affectation vit dans l'**unité** (`st._bAssign`, marquage.js `affecterMarquage`) : le danger
d'abord, le marqueur libre le plus proche × (2 − markF), un homme par marqueur (`pris`) — l'invariant T17 tient par
construction. **La tenue** (238 `marquageTenue` : le marqueur garde son homme sauf rival à moins de 0,8 × son coût,
hors peloton), le **marquage ballside** (96, l'axe `marquage` trim le côté faible), la **zone loin du but** (222
`garde.zoneLoin` : pas de marquage à l'homme hors de mon tiers), le **serrage** (`off` 0,95-1,4 m × rôle × marqueSerre
× markF ; zone rouge 192 au contact < 26 m), la **passation du marqueur au pivot** (252 : le central suit 8 m, remet
au pivot libre ≤ 10 m, reprend à 2,5 m), la **ligne qui se referme** (228), la **remise** entre les lignes, le
marquage de surface sur centre (133), l'affectation homme par homme dans la surface (225), les ancres craie (249b),
le placement comme note (246). Les CPA : corners rentrant / sortant / tendu avec cible (referee.js), `preneurCPA`.

**Partiel.** Le marquage est **élastique par une constante** (`off`), pas par la distance au ballon ni le danger ;
l'école n'existe que par l'axe `marquage` (zone ↔ homme) sur le trim ballside et le serrage ; la passation n'existe
que pour le pivot (252) — pas de `HANDOFF` général ni de relayeur ; la tenue est une hystérésis de coût, pas un état
avec latence de parole.

**Absent.** La machine à états par claim (`ORPHAN`, `HANDING_OFF`), la parole (portée, latence, boîte), l'enchère
et le consensus, la cascade de l'entre-lignes (recul de la ligne), le détecteur de croisement, `crossSwitchPolicy`,
la matrice de décrochage par zone et son veto « quelqu'un part dans mon dos », le protocole de CPA (dispositifs,
`GK_CLAIM`, hystérésis individuel → zone), le second ballon comme réallocation.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| T1 distance au plus proche adversaire | 5,16 m ± 0,6 | mesurable, **réfuté** | moyenne **9,5 m**, p50 7,5 |
| T2 par poste | LAT 6,4 > MIL 5,6 > DC 5,5 > MDC 5,2 > ATT 5,1 | mesurable, **réfuté** | DC **14,8**, LAT **12,1**, MIL 7,1, MDC 7,0, ATT 6,7 — l'ordre est inversé : les défenseurs sont les plus loin de tout adversaire |
| T3 dérive 60 → 90 min | 5,37 → 5,73 → 6,04 progressive | mesurable, **réfuté** | 9,6 / 9,6 / 9,2 / 9,5 — plate |
| T4 doubles prises | 2-6 / match (zone mixte) | mesurable, **0** | par construction (défense télépathique au sens du chapitre) |
| T5 orphelins | 3-8 / match avec menace > 0,5 | mesurable (sans filtre) | **15** / match / équipe sans marqueur > 0,8 s |
| T6 latence de passation | 0,45 s | **absent** (pas de canal) — 0 s |
| T7 taux de commutation | 0,8-2,5 / min ; > 6 clignotement | mesurable, **réfuté** | **29,4 / min / équipe** malgré la tenue 238 — le clignotement nommé par le chapitre ; distance marqueur-homme p50 7,2 m |
| T8 persistance ↔ écartement | +3 à +6 m | à mesurer en balayant l'axe `marquage` |
| T9 cascade de l'entre-lignes | −1,5 à −3 m | absent |
| T10 buts par corner | 2,0-4,2 % | mesurable, **volume insuffisant** | **0 / 7** corners (3,5 corners par match — réel 9-11) ; part des buts 0 % (12 buts) |
| T13 anticipation du point de chute | ≤ 48 % top-3 | à instrumenter |
| T17 invariant un marqueur / un homme | 100 % | **tenu** (structure d'unité) |
| T18 distance d'intervention | 10-15 m médian | mesurable, **réfuté** | **3,2 m** p50 (ch. 01 T12) |
| T19 individuel → zone sur CPA | 0 | absent (pas de protocole de CPA) |
| T22 sortie précédée d'un HANDOFF | > 70 % | absent |

## 4. Les lots que la fiche appelle

1. **La distance d'intervention** (T1, T2, T18, ch. 01, 03, 10) : le marqueur vit à 3 m, la ligne à 15 m de tout
   adversaire — le marquage élastique `markDistance` (ballon, école, danger, dos au but) remplace la constante `off`.
2. **La passation comme état et comme parole** (T4-T7, T22 ; ch. 10 §11.3) : claims `OWNED / HANDING_OFF / ORPHAN`,
   score de lâcher > 0,55 sur 2 ticks, message `HANDOFF` à 15 m et 0,3-0,6 s, boîte à 1 message. Le 252 (pivot) en
   est le premier cas ; il se généralise.
3. **Le clignotement** (T7) : 29 commutations par minute — l'hystérésis de coût (238) ne suffit pas ; il faut
   l'état et la latence.
4. **L'entre-lignes et le décrochage** (T9, §5, §7) : la hiérarchie des preneurs, la cascade (la ligne recule quand
   personne ne prend), le central qui accompagne 4-6 m puis s'arrête, le veto du dos.
5. **Les corners comme protocole** (T10, T12, T19, T21) : 3,5 corners par match (réel 9-11) et 0 but — le volume de
   corners d'abord (le centre repoussé, le tir contré), puis les dispositifs et le gardien arbitre.
