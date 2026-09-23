# Modèle 11 — Les duels stochastiques, contre le moteur

*Fiche du 9/09, moteur d9720d4 (SCEAU 256). Mesures : sonde duels / arbitrage / CPA (2 × 90 min) et Bible 15.*

## 1. Ce que le chapitre demande

- **Pourquoi attribut-contre-attribut est faux** ; un **noyau commun** multinomial log-linéaire (issues
  `CLEAN_WIN / PARTIAL / NEUTRAL / LOSS / FOUL`, features de contexte, intercepts calés par recuit sur les agrégats
  Wyscout PL 2017/18 ; les modèles appris comme étalon : Schepers 2025, Brier 0,243).
- **Le dribble** : gradient spatial (P gagné 0,680 dans la bande 20-30 % → 0,414 à 90-100 %), contraste axe /
  couloir 0,076, issues (faute obtenue 9-14 %, touche 12-19 %, franchi net + faute ≤ 0,62) ; **le tacle** ;
  **l'aérien** ; **le second ballon** ; **la course-poursuite** ; **bousculade et équilibre** ; **fautes, cartons,
  arbitrage** ; volume 200-265 contests par match (au sol : aériens : libres = 141,5 : 49,7 : 41,2).

## 2. Où en est le code

**Existant.** `duel.js` : le tacle glissé (fenêtre, glisse freinée, `slideResolve`, faute / vide / gagné), la charge
d'épaule (32), l'accrochage (97 : probabilité par épisode `accrocheP` × rôle × agressivité × retenue en surface),
`tacleDegage`, `contreTir`, `jambeTendue` ; la famille des gestes (skills-sim : râteau, semelle, passement,
crochet, feinte ; le **mordu** × 0,35) ; le 50/50 (153, 154) ; la tête contestée (112) ; la Loi 12 (avantage,
cartons) ; `courseServie` / `rattrapeAtk` (la poursuite) ; les facteurs (dribF, tackleF, aggrF, tacleGardeF).

**Partiel.** Le duel est **résolu par géométrie et tirages épars** (le mordu, l'accrochage, la prise) — ni noyau
commun ni issue neutre ; le dribble est un geste qui **ne trompe pas** (21 % gardés, réel 40-60 ; sans gradient
spatial : 22 / 24 / 18 / 18 % par bande, réel 68 → 41), presque **sans faute obtenue** (0,8 %, réel 9-14) ni sortie
en touche (0 %, réel 12-19) ; le tacle glissé est l'action ordinaire (Bible 15 D20 : 82 par match).

**Absent.** Le noyau log-linéaire et sa calibration par recuit ; les features de contexte (densité, orientation,
vitesse relative) ; les issues à cinq états ; la faute et la touche comme issues du dribble ; l'équilibre et le
stagger ; le volume de contests (Bible 15 D1-D2).

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| 1 volume de duels | 200-265 ; 141,5 : 49,7 : 41,2 | Bible 15 : aériens **10**, au sol **182** (glissés) — le rapport est inversé |
| 2 gradient spatial du dribble | 0,680 → 0,414 | mesurable, **tenu au 268** : 62 / 58 / 63 / 34 / 38 / 17 % par bande (20-30 → 90-100), pente 0,45 ≥ 0,20 (8 × 45 min, 155 take-ons) | avant : **22 / 24 / 18 / 18 %** — plat et bas |
| 3 axe / couloir | 0,03-0,14 | à instrumenter |
| 4 issues du take-on | faute 9-14, touche 12-19, franchi + faute ≤ 0,62 | mesurable, **tenu au 268** : faute obtenue **14 %**, en touche **5 %** (loin de la ligne, remappées — dette), franchi net + faute 54 % ≤ 0,62 ; 19 take-ons / match | avant : gardé **21 %**, faute **0,8 %**, touche **0 %**, perdu **78 %** ; 199 gestes / match (dont ~20 gestes de dribble contre un homme) |
| tacle, aérien, second ballon | | Bible 15 D3, D10, D12, D20-D24 |

## 4. Les lots que la fiche appelle

1. **Le noyau commun de duel** (tests 1-4 ; Bible 15 lot 1) : issues à cinq états, features de contexte,
   intercepts calés sur les agrégats — le dribble gagne 68 % près de son but et 41 % près du but adverse, obtient
   une faute une fois sur dix.
   → **SCELLÉ 268** (`noyau.js`, `cfg.noyau`, NOTES 346) : le multinomial log-linéaire à huit issues au contact du geste
   de dribble, μ* du disque d'atteinte, les features du book, les intercepts recuits sur 148 take-ons du moteur, le
   Gumbel-max sur le flux 'duel', les conséquences (faute posée, touche, dépossession physique). Mesuré : faute obtenue **14 %**, en touche **5 %** (loin de la ligne, remappées — dette), franchi net + faute 54 % ≤ 0,62 ; 19 take-ons / matchb.
   Le tacle et l'aérien par le même noyau, le bruit OU de forme, la course de coupe : nommés.
2. **Le volume et la nature des gestes** (test 4 ; Bible 14 lot 2) : 199 → 40 par match, le tacle glissé rare.
   → **SCELLÉ 269** (`nature.js`, `cfg.nature`, NOTES 347) : le « 199 gestes » comptait toutes les feintes (le moteur d'avant
   le 269 en tentait 28-39, dont 17-20 take-ons) ; le spécialiste (la fréquence de tentative × e^{k·flair}, l'espérance à 1),
   le glissé de dernier recours (battu, au taux imposé) et sa faute au taux du book. Mesuré : T15bis 7-11 (≥ 5), glissés 4,6 / match (6,7), P(faute | glissé) 19 % (24), gestes 35-39 (≈ 40).
3. **La tromperie dans le dribble** (Bible 14 lot 2, Modèle 04 lot 4) : le défenseur qui part du mauvais côté.
4. **Le tacle debout** (§ 4.1-4.2) : le pied balaie ± 55° devant le buste, le ballon touché une fois sur deux, le défenseur battu 49 %.
   → **SCELLÉ 291** (`tacle-debout.js`, `cfg.tacleDebout`, NOTES 414) : sondé (sonde-291) 77,5 % des tentatives de pique réussies, 15-17 %
   hors du cône ; le cône du pied, la réussite à la note × 0,56 esquivée par le dribbleur (~52 % des tentatives), le battu assis 0,22 s.
   Piques réussies 33 → ~17 par équipe, pertes 228 → ~215. Nommés : la récupération propre contre la déviation (issue déjà juste,
   35-40 % récupérées), la faute du tacle debout (§ 4.3, le logit), le ballon libre hors passe (Modèle 09 § 7.1).
