# Modèle 16 — Télémétrie et outils, contre le moteur

*Fiche du 9/09, moteur 0735d1f (SCEAU 256). Inventaire du journal, des bancs et du sceau ; c'est le chapitre qui décrit le contrat de ce dépôt lui-même.*

## 1. Ce que le chapitre demande

- **Un bus de télémétrie neutre** (T0-T4 : la simulation ne change pas d'un bit selon le niveau, test 1), deux
  flux (événements en vocabulaire **SPADL** exportable vers `socceraction`, tracking 10 Hz), dérivation
  automatique des métriques avec **définitions concurrentes** nommées (PPDA × 4, field tilt × 3), visualisation
  minimale, **journal de décision** (explicabilité), **boucle de calibration** (paramètres identifiables : σ_max /
  σ_min < 10³ ; généralisation ligue A → B), tests de **non-régression comportementale** (puissance : détecter
  ≥ 20 régressions injectées ; faux positifs < 5 % sur 100 exécutions), **détecteurs d'artefacts** (oscillation,
  gel, boucle de passes), **benchmark** (discriminateur aveugle simulé / réel : AUC ≤ 0,85), rejeu fidèle
  (`finalWorldHash`), coût ≤ 10 % du budget.

## 2. Où en est le code

**Existant.** Le **journal d'événements** (`st.events` : pass, shot, but, duel, slide, faute, carton, tête, contre,
arrêt, sortie, touche, corner-joué, moment, burst, press, passation, remplacement, temps-additionnel…), la
**feuille de match** (`feuilleDeMatch`), la **trace** (`playMatch`, échantillon 6 images), le **jumeau d'empreinte**
(hash positions / score / nombre d'événements : le contrat du sceau, prouvé à chaque lot), les **bancs** (70
`verify-*.mjs`, `verify-match11` à 150 blocs isolables par shard, `bancs.mjs`, la règle « tally après final.done »),
les **contrats** (`checkBallFlight`, `checkBallBody`, `temporal-validate`, `match-check`, `scene-validate`,
`checkCoach`, `checkOffside`), le **docs/Retour_Reference_Journal_Fond** (le journal vu par un consommateur) et
la doctrine du journal (MOTEUR.md), la carte du book (ce dossier).

**Partiel.** Le journal est riche mais **en vocabulaire maison** (pas SPADL ; alias `pass.from` / `turnover.to` à
retirés au 257 — `by` et `equipe` seuls) ; les bancs mesurent des invariants **d'un monde** (jumeau au bit) et des clauses de loi, pas des
distributions contre le réel (la « table du réel en clause ou informative » est une décision ouverte du Plan) ;
la neutralité de la télémétrie est tenue de fait (les sondes lisent `st`) mais non testée ; le tracking existe
comme trace échantillonnée, pas comme flux 10 Hz normalisé ; pas de journal de décision.

**Absent.** L'export SPADL / VAEP (test 2), les définitions concurrentes des métriques (test 4), l'analyse
d'identifiabilité et la boucle de calibration (tests 5, 6), la puissance et le taux de faux positifs de la suite
(tests 7, 8 — les rouges hérités 246d et « contres à l'entrée » en sont le symptôme), les détecteurs d'artefacts
(test 10 : l'oscillation à 29 commutations / min n'est détectée par aucun banc), le discriminateur aveugle (test 9),
l'en-tête de session (`engineHash`, `finalWorldHash`) pour le rejeu (test 11).

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut |
|---|---|---|
| 1 neutralité de la télémétrie | hash identique T0 / T4 | tenu de fait, à tester |
| 2 export SPADL / VAEP | | absent |
| 3 cohérence événements / tracking | écart passes < 12 % | à mesurer (trace 10 Hz c. journal) |
| 4 invariance de définition (PPDA × 4) | | absent (une seule définition, approximative : Bible 01 T21) |
| 5-6 identifiabilité, généralisation | | absents |
| 7 puissance de la suite | ≥ 20 régressions détectées | à faire (l'injection de régressions) |
| 8 faux positifs | < 5 % | à faire (100 exécutions) — les rouges hérités disent que ce n'est pas 0 |
| 9 discriminateur aveugle | AUC ≤ 0,85 | à faire (nécessite du tracking réel) |
| 10 détecteurs d'artefacts | | absents |
| 11 fidélité du rejeu | `finalWorldHash` | tenu (jumeau d'empreinte), sans en-tête de session |
| 12 coût de la verbosité | ≤ 10 % | à mesurer |

## 4. Les lots que la fiche appelle

1. **Le journal en vocabulaire Opta / SPADL** (tests 2, 4 ; le retour aval, le 257) : un export, quatre PPDA
   nommés, l'alias retiré.
2. **La table du réel au banc** (tests 7, 8 ; décision 4 du Plan) : les sondes de ce dossier versées dans
   `verify-book.mjs` comme clauses **informatives** d'abord, puis contractuelles par fiche ; l'injection de
   régressions pour mesurer la puissance ; 100 exécutions pour le taux de faux positifs.
3. **Les détecteurs d'artefacts** (test 10) : oscillation (29 / min), gel, boucle de passes, interpénétration
   (11,5 / min) — au banc, pas à l'œil.
4. **Le journal de décision** (§6 ; Modèle 08 lot 5).
5. **L'en-tête de session et le rejeu** (test 11) : `engineHash`, `finalWorldHash`, la graine, le setup.
