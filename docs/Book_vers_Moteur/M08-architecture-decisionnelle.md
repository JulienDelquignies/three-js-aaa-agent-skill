# Modèle 08 — L'architecture décisionnelle, contre le moteur

*Fiche du 9/09, moteur 0735d1f (SCEAU 256). Inventaire d'architecture ; les mesures citées viennent des sondes Bible 01, 10, 12 et Modèle 05.*

## 1. Ce que le chapitre demande

- **Trois niveaux** (Killzone 3, Tarascon) : L2 équipe (`TeamIntent` à 1 Hz : phase, plan, consignes, w±), L1
  **six unités fixes** par équipe (ligne, double pivot, gauche, droite, front, bloc-ballon ; `UnitIntent` à 5 Hz
  décalées : ancre, largeur, profondeur, rôles, motif armé) avec **priorité d'écriture** `BALL > BACKLINE > PIVOT >
  {LEFT, RIGHT} > FRONT` sur le canal A (ancre) — les autres n'écrivent que B (poids) et D (horloge) ; L0 joueur
  (10 Hz au ballon, 5 Hz décalés).
- **Le blackboard en trois zones** (`BeliefView` privé, `UnitBoard` 0,2 s, `TeamBoard` 1 s) et la **frontière de la
  triche** : une donnée est partageable si un entraîneur peut la crier, si elle est de faible bande passante, si
  elle reste vraie plus longtemps que sa latence ; le ballon partagé **avec latence** 0,15 s.
- **Consignes** traduites en poids continus, effet de consolidation après changement de système ; **coordination
  sans communication** (revendications spatiales avec latence 0,25 s et seuil) ; **engagement** (verrous : passe
  0,40 s, conduite 0,25, tir 0,30, appel 1,20, pressing 0,70, ligne 0,80 ; hystérésis d'utilité h ≥ 2,9 σ_U) ;
  **motifs** comme plans multi-agents non scriptés ; ordonnancement déterministe (assignation hongroise à ordre
  fixe) ; le gardien à part ; anti-patterns ; débuggabilité (journal des intentions).

## 2. Où en est le code

**Existant.** **L2** : `tactics.js` (axes continus : hauteurBloc, largeur, pressing, style, transition, compacité,
relation, marquage, tempo, mentalité, piège — les presets), `coach.js` (posture selon score × urgence, orage,
toutes les 20 s), les **quatre moments** (phases.js), les fenêtres de pressing (signal d'équipe) — c'est un
`TeamIntent` par axes, à ~1 Hz. **L0** : `assignJobs` (match-sim : press / cover / mark / intercept / receive /
support / zone), `arbitre` (menace.js : tir / centre / passe / conduite pondérés par style et rôle), l'**intention
engagée** (`c.intent` avec TTL, « un geste en cours possède le joueur »), le porteur engagé (`CARRIER_COMMITMENT`),
les hystérésis par loi (tenue de marquage 238, couloirs 2 s, craie 6 s, placement 3 s, appel cooldown), les
**rôles** comme axes et interdits, les cerveaux de tactique par équipe, le gardien à part (keeper.js). Le journal
d'événements comme trace.

**Partiel.** **L1 n'existe pas comme couche** : la ligne défensive (couvert, referme, offside), le double pivot
(252 passation), les couloirs (241), le contre-press (229) sont des **lois de match-sim** qui écrivent
directement sur les cibles des joueurs, sans priorité d'écriture — d'où les conflits mesurés (le pivot pressant
et marqueur, l'ancre et le couloir, 29 commutations par minute) ; le blackboard est **`st` entier** : tout lit tout
(Modèle 04, architecture A) ; l'engagement existe par geste mais sans verrous nommés ni hystérésis d'utilité
commune ; l'assignation est un glouton par distance (pas hongrois, mais à ordre fixe — déterministe).

**Absent.** Les six unités et la règle de priorité des canaux ; `UnitBoard` / `TeamBoard` avec latences ; le test
de légitimité (la position adverse exacte est lue par tous) ; les revendications spatiales ; les motifs comme
plans (le une-deux et le troisième homme existent comme lois ponctuelles) ; l'effet de consolidation ; le
journal des intentions ; les LOD de décision.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré |
|---|---|---|---|
| 1 taux d'oscillation | < 5 % d'intentions < 0,15 s ; appel médian ≥ 0,8 s | à instrumenter (`c.intent`) ; Bible 12 T7 : 29 commutations / min |
| 2 non-omniscience | interceptions de dos / de face ≤ 0,5 | **réfuté par construction** (le défenseur lit tout) |
| 3 doublons et abandons | 4-12 doublons, abandons > 0 | à instrumenter (`prise5050` gère le contact) |
| 4 monotonie des consignes | 5 crans × 200 matchs | partiellement tenu (banc `verify-identification` : 22 clés exprimées) ; hauteurBloc sans effet sur le hors-jeu (Bible 03) |
| 5 consolidation | dégradation après changement | absent |
| 6 non-scripting des motifs | variance ≥ 2 m² | à mesurer sur `un-deux` |
| 7 ablation hiérarchique | | sans objet (pas de L1) |
| 8 ablation d'engagement | | à mesurer (TTL → 0) |
| 9 déterminisme | hash identique | **tenu** (jumeau d'empreinte) |
| 10 permutations de rôles (SoccerCPD) | | à instrumenter |
| 11 LOD de décision | | absent |
| 12 non-contradiction des unités | ≤ 1 écrivain sur A | **réfuté par construction** (les lois écrivent toutes sur `p.target`) |

## 4. Les lots que la fiche appelle

1. **La couche unité** (tests 7, 12 ; Bible 10 lot 6, 12 lot 2) : six unités nommées, un seul écrivain d'ancre par
   joueur, les autres n'écrivent que des poids — c'est le remède aux conflits de lois (ancre × couloir × marquage ×
   passation) qui font le clignotement.
2. **Le blackboard à trois zones** (test 2 ; Modèle 04 lot 1) : `BeliefView` privé, `UnitBoard`, `TeamBoard` — le test
   de légitimité comme règle de revue.
3. **Les verrous nommés et l'hystérésis d'utilité** (tests 1, 8 ; Modèle 06) : passe 0,40, conduite 0,25, tir 0,30,
   appel 1,20, pressing 0,70, ligne 0,80.
4. **Les revendications spatiales** (test 3 ; Bible 15 `LOOSE`) : latence 0,25 s, seuil, doublons et abandons réels.
5. **Le journal des intentions** (débuggabilité ; le journal Opta du retour aval).
6. **La consolidation et les motifs** (tests 5, 6) — après 1.
