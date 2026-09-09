# Bible 02 — Le gardien de but, contre keeper.js

*Fiche du 9/09, moteur 767de25 (SCEAU 256). Mesures : 2 matchs de 90 min (graines 3, 7), monde par défaut.*

## 1. Ce que le chapitre demande

Une **machine à états** (`IDLE_FAR, SWEEP_READY, SWEEP_ACTIVE, SET_SHOT, CROSS_DECIDE, ONE_V_ONE, POSSESSION,
SET_PIECE_DEF`) avec un engagement `T_commit` 0,4 s ; le **placement** sur la bissectrice à une distance de la ligne
`D_MAX_OUT · (1 − e^{−D/10}) · cos^{1,5} φ`, plafonnée par le **lob** ; le **couplage à la ligne défensive**
(`X_backline − gap`, gap ≈ 20 m, coefficient 0,57, point de non-retour, coût réglementaire de la sortie) ; l'**arrêt**
comme portée fonction du temps disponible (< 0,31 m sous 0,25 s, le BLOCK avant le DIVE), la **set position** sur
85-90 % des tirs, le tir dévié ; les **sorties sur centre** (64-71 %, capter/boxer/dévier), le **1v1** (42-50 % d'arrêt,
la règle des 3 m, le timing) ; l'**arbre de distribution** (six mètres courts 50-80 %, précision par distance
90-95 / 45-60 %, rétention des longs 30-40 %, la règle des 8 s de 2025/26) ; le +1 en construction ; les CPA
défensifs ; onze paramètres de signature (Neuer / Courtois / Martínez).

## 2. Où en est le code

**Existant.** Le placement sur la bissectrice et la profondeur (lot 94 : `KEEPER.depthMin` 0,45, `depthMax` 2,6,
`depthGain`, `posMixF` la note ; le libéro `cfg.libero` : `far` 34, `max` 10 m, rampe, retour — lots 94/238), la
garde par tiers (238 `gardeTiers`), le plongeon à portée réelle (lot 39 : `diveReach` 2,95 m, `diveTime` 0,9,
`reflex` 0,12, `floatRead`), le relevé qui coûte (91 : chute, sol 0,65, relevé 1,25), la sortie au 1v1 (104
`sortie1v1` cône, `oooF` 163, `keeperClaim`), la prise haute et la claquette (147 `handF`, 163 `aerialF`, 101
`corner.claqueV/priseV`), la distribution (150 `kickF/throwF`, A9 `remisesMain/remisesPied` volée et roulé, 136
`sortieGardien`, 179 `gkPied`, 190 `gkAuDevant`, `relance`), la tenue (171 `gkTenue` 2,2-4,2 s, `gkRelease` 3 s), le
gardien qui note (`keeping, handling, oneOnOnes, command, aerialReach, kicking, throwing`), le rôle (`garde` : de
ligne 0,15 / libéro 0,9 — exprimé 6/6 au 249).

**Partiel.** Le couplage à la ligne : par le libéro (rampe 8 m au-delà de `far`) — pas de `gap` explicite ; le plafond
de lob et le point de non-retour n'existent pas ; la sortie hors surface ne coûte rien ; le geste sur centre est
capter/claquer sans « dévier » ni taux par pression ; le 1v1 sort au cône sans règle des 3 m ni timing lu sur le
porteur.

**Absent.** La **set position** (aucune notion d'appuis figés ni de qualité d'appui) ; la portée comme fonction du
temps disponible (2,95 m pour tout tir) ; le tir dévié comme cas du gardien ; le coût de la sortie ratée ; les profils
de gardien (les onze paramètres) au-delà de l'axe `garde` ; le penalty du gardien (le plongeon, le centre).

**Différence d'architecture à nommer.** keeper.js décide par lois à clé (`keeperDecide`, `keeperSpot`), pas par machine
à états ; l'engagement existe sous d'autres noms (`diveTime`, `gkTenue`, `_pace`). On ne réécrit pas : on mesure les
flaps (test 27) et on ne pose un `commitUntil` que s'il y en a.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| 1 distance moyenne à la ligne | 13,1 m ±1,5 (< 8 : scotché) | **loi existante, cible fausse** | **6,3 m** — le libéro sort mais la base vit à 0,45-2,6 m |
| 2 `X_backline − X_gk` ; corrélation | 20,4 m ±2,5 ; r ≥ 0,5 | mesurable | **30,3 m** (le gardien trop bas ou la ligne trop haute — les deux), **r = 0,69** ✓ le couplage existe |
| 3-3b presets 2018/2022 ; coefficient 0,57 | | absent (pas de preset d'époque) ; coefficient à mesurer |
| 4-5 actions hors surface | 0,4-2,0 / 90 à 14-17 m | mesurable | **0,0** — le libéro se déplace sans jamais toucher hors de sa surface |
| 6 set position 85-90 % | | **absent** |
| 7 save % | 68-72 | mesurable | **40 %** (8 arrêts, 12 buts sur 49 tirs, 41 % cadrées) — le gardien du moteur perd la moitié des cadrées : le 258 (l'échelle de finition) d'abord, puis la portée (9) |
| 8 dedans/dehors 60/85 | | mesurable après 258 |
| 9-9c portée bornée par le temps ; BLOCK majoritaire à < 11 m ; 2,3 % déviés | | **loi existante, cible fausse** : `diveReach` 2,95 m quel que soit `tAvail` ; le contre du champ (176) existe sans effet sur l'arrêt |
| 10-12 sorties sur centre, geste, coût | 64-71 % ; 55/30/15 ; xG 0,55-0,85 | partiel — à mesurer (sonde à écrire sur les centres) |
| 13-14 1v1 | 42-50 % ; 1 / 60 min | mesurable | 3 situations lues (arrêt 33 %) — le détecteur de la sonde est trop large, à refaire sur `sortie1v1` |
| 15 six mètres courts | 50-80 % | mesurable | **40 %** (2/5) — volume trop faible, à 20 matchs |
| 16-17 progression et bilan des six mètres | | absent (Opta) |
| 18-18b réussite des passes du gardien | < 20 m 90-95 ; > 40 m 45-60 ; étalement 46-89 % | mesurable, **cible fausse pour les longs** | courts **20/24 = 83 %**, moyens 9/12, **longs 15/18 = 83 %** — le long du gardien ne se perd pas : la passe servo (retour aval, 256) |
| 19 rétention après dégagement long | 30-40 % | mesurable — à mesurer |
| 20 tenue < 8 s, corner dès l'infraction | | **règle périmée** : `gkRelease` 3 s à l'échelle des six secondes ; mesuré **7,1 s** de tenue max (la tenue + la marche de relance) |
| 21-23b penalty | 93,7 % de plongeons, 15-21 % d'arrêts, posture nulle | mesurable | 1 penalty, **0 plongeon** — le gardien du moteur ne plonge pas sur penalty : à instruire (217) |
| 24 distance 4,8-5,6 km ; marche 68-73 % | | mesurable | **4 947 m** ✓ ; marche **83 %** (trop) |
| 24b sanctions de sortie | | absent |
| 25-26 corners selon marquage / trajectoire | | partiel (101, 225) — à mesurer |
| 27 cohérence des états | 0 aller-retour < 0,4 s | à mesurer sur les décisions de sortie |

## 4. Les lots que la fiche appelle

1. **Le gardien couplé à sa ligne** (tests 1-3b) : `gap` explicite (20 m), la formule d'arc, le plafond de lob, le point
   de non-retour, le prix de la sortie ; les presets 2018/2022 ; les profils Neuer / Ederson / Buffon comme rôles de
   gardien sur les axes existants (`garde`, `ressort`). C'est le premier, tout le reste en dépend.
2. **La portée bornée par le temps et le BLOCK** (9-9c) — après 258, quand une frappe pourra manquer.
3. **La règle des 8 s** (20) — une ligne, tout de suite (la Loi 12 périmée).
4. **Le penalty du gardien** (21-23b) — le plongeon lu sur le tireur, 15-21 % d'arrêts.
5. **Les longs du gardien qui manquent** (18) — c'est le même front que la passe servo (256, chantier A).
6. **La set position** (6) — un temps lié au scan (250), après 258.
