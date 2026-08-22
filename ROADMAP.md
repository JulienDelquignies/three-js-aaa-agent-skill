# ROADMAP — reprise de session (rédigée fin de session lots 72-90c)

## Les contraintes permanentes (à garder en tête à CHAQUE lot)
- **On construit un moteur de jeu type Unity/Unreal ultra adapté football, réutilisable sur
  différents projets.** Le moteur possède les LOIS ; la tactique, les rôles et les attributs les
  PARAMÈTRENT. Toute correction qui encode un choix de jeu appartient à la couche tactique.
- **Toujours les attributs des joueurs, les tactiques, les rôles** : les attributs entrent dans
  les lois par des FACTEURS (jamais des branches) ; les rôles donnent les cadences ; la tactique
  donne les axes ([0..1], identité à 0,5 — contrat dur de tactics.js).

## Le contrat de méthode (non négociable, prouvé sur ~90 lots)
- Mesurer AVANT (sonde chiffrée) → loi native + clé injectable + **sabotage NOMMÉ** → mesurer
  APRÈS → batterie → A/B → note NOTES.md → commit/push → deploy → vérifier le chunk servi.
- Le sabotage émule le monde d'hier **EN ENTIER** (6 applications : à chaque loi nouvelle,
  l'ajouter aux configs de sabotage des clauses concernées — surtout « l'orbite d'hier » de
  verify-match11).
- **Identité au défaut** : une clé absente/défaut = le monde d'hier au bit près. Clé de FORMAT
  quand les mondes réduit/11c11 divergent (patron holdCalmFull).
- **Empreintes bit-près** (scratchpad fingerprint.mjs à recréer ; recette CONSIGNÉE lot 91 —
  l'ancienne est morte avec sa session : sha256 tronqué 16, par pas de 1/60 sur 90 s, positions
  joueurs (x,z) + ballon (x,y,z) à 4 décimales jointes par virgule, puis JSON des events ;
  rondo = makeRondo({seed:5}) via rondoStep, réduit = makeMatch({perTeam:5, seed:4}) via
  matchStep) : rondo seed 5 = `2d95fc853a99521c`, réduit seed 4 = `9846cf3e5a80c58b`
  (identiques avant/après lot 91). Si l'empreinte bouge : prouver flux-intact par les bancs
  84+40 AVANT d'accepter une nouvelle référence, et la consigner.
- **Volumétrie** : tout module ≤ 1249 lignes wc (le banc compte split('\n') = wc+1, plafond
  1250). Compenser chaque ajout par compression de commentaires ou EXTRACTION vers le fichier
  de sa famille (patron : deborde → roles.js).
- **A/B de ship** : 20 graines × 300 s (scratchpad ab-62a.mjs à recréer : makeMatch full,
  matchCfg({shotRange: 20}), compter tirs/buts) — bande de buts totaux **17-33** = gate.
- Batterie : verify-match11 (68), verify-match (84), verify-rondo (40), verify-matchday (88),
  verify-attributes (14 — à relire à chaque virage de flux), verify-chrono (14), verify-loi14
  (8), verify-loi3 (9), verify-ball (33), verify-gamestate (15), verify-sync (9).
- **ALL-SYNC avant toute mesure** : cp examples/showcase/src/engine/*.js →
  skills/threejs-aaa/assets/starter/src/engine/ ET examples/soldier-volley/src/engine/
  (les sondes importent depuis starter ; Rondo.js scenes est app-level, PAS syncé).
- Métriques de flux : la densité varie de ±3 pts entre jeux de graines en identité pure —
  comparer sur DEUX jeux de graines minimum, seuls les effets ×2+ font foi.

## Le jouable (contrainte de DESIGN consignée — utilisateur, lot 110)
- Le contrôle humain N'EST PAS obligatoire : l'IA face à IA reste le cœur. Le jouable sera
  pensé comme une COUCHE D'INTENTIONS injectables (peut-être UN joueur, peut-être des menus
  d'action, sans joystick — rien n'est défini). Le moteur doit rester pilotable par
  intentions (le patron cfg.decide de menace.js est la porte) — ne jamais construire une
  dépendance à une manette.

## Process / déploiement
- Le token Vercel n'est JAMAIS committé. **À re-fournir en début de session** (l'ancien vivait
  dans le scratchpad de session, mort avec elle). Le stocker hors repo, filtrer les sorties.
- Deploy DEPUIS examples/showcase (guard `[ -f .vercel/project.json ] || ABORT`) :
  `npx vercel build --prod --token $TOK` puis `npx vercel deploy --prebuilt --prod --yes` —
  le cwd Bash SE RESET entre commandes : enchaîner build+deploy dans UNE commande. « fetch
  failed » : re-tenter. Vérifier après : alias 200 sur
  https://showcase-pi-mocha.vercel.app/match11.html + chunk Rondo-*.js servi identique (cmp)
  + une clé du lot grepable dans le chunk minifié.
- Commits : trailers Co-Authored-By + Claude-Session habituels ; branche
  `claude/ai-agent-threejs-aaa-tool-dyrrb0` ; jamais d'identifiant de modèle dans le code/commits.
- NOTES.md : journal complet (notes 1-139) — insérer avant le marqueur
  « - Skill `threejs-aaa` : refs 01–22 ». Prochaine note : 154.

## Pièges d'instrument (payés cher, ne pas ré-apprendre)
- Le readback pixel d'un canvas WebGPU (drawImage) MENT — seul play_screenshot (composited)
  fait foi. En playmode : S = window.__rondo, S.cam est LA caméra (pas __engine.camera) ;
  play_eval timeout 60 s → avancer par tranches ≤ 30 s sim et instrumenter PENDANT l'avance
  (ring buffer window.__rec) ; les bones : players[].model.traverse, noms mixamorig5*.
- L'ULP : recomposer une constante en flottant (0,42+0,14 ≠ 0,56) fait diverger le réduit d'un
  bit — sans la clé active, garder la borne d'hier LITTÉRALE.
- L'empreinte peut bouger par l'INSTRUMENT (champs d'events ajoutés) sans que le flux bouge :
  les bancs tranchent.
- Enrichir un event = nouvelle référence d'empreinte à consigner.

## L'état livré (fin de session)
- Prod : https://showcase-pi-mocha.vercel.app/match11.html — 60 FPS validé sur l'appareil
  utilisateur, rail de régie (lot 80b), receveurs vivants (81), distance sociale (86),
  patte + enroulée de l'inversé (87), dédoublement (88), gardien-métier + relance vive (89),
  arrêts nommés entiers (90), gardien complet : tenu aux gants + relevé par étapes à l'agilité
  + prix réel du plongeon (91 — note 133 ; dette nommée : premier contact des prises-réflexe
  aériennes ~0,96 m, fermé par le clip priseAerienne du lot 93).
- verify-frappes 12/13 (l'enroulée kind=mi-hauteur) : rouge PRÉEXISTANT hors batterie des 11,
  vérifié identique sur le commit de base au lot 91 — à reprendre un jour de flux calme.
- Clés ÉTEINTES documentées (activation = re-fonder les clauses de flux) : supportSpanFull (0),
  settledNear (Infinity), triangle (false — 3 échecs mesurés consignés dans tactics.js,
  la v4 = assignation avec hystérésis PAS en post-traitement géométrique), slotAnchor (false).
  L'axe tactics `relation` est ACTIF (identité 0,5 par défaut, presets placés).
- Le greedy vif d'assignation des slots est un optimum local prouvé (lot 85) — ne pas retenter
  de stabilisation géométrique par frame.

## LE PLAN (validé utilisateur) — dans l'ordre
1. ~~**LE GARDIEN COMPLET (lot 91)**~~ — **LIVRÉ** (note 133) : tenu aux gants (ball.hold +
   heldBall + _armsToBall), prix réel du plongeon (keeperRise, agilité getupF, battu paie,
   six-secondes debout), relevé par étapes (queues re-authorées + gk.rise pilote), engagement
   du gant (envGo) + warp de prise debout (_applyCatchWarp). Mesuré après aux mêmes bones :
   sol 1,87 s, tronc 156°/s max, mains-ballon ≤ 0,56 m tout le relevé. Reste au lot 93 : le
   premier contact des prises-réflexe aériennes (~0,96 m — clip priseAerienne, épaule qui monte).
2. ~~**L'ATTAQUANT MUET (lot 92, sim)**~~ — **LIVRÉ** (note 134) : zone grise du tir
   (menace.grise 1,35, pondérée finishing, shooting.js même porte), conduite muette dévaluée
   (muteD 10, plancher 0,32), le muet rend le cap (wGoal ×0,25 + evadeSpot ×0,15, rayon
   muteD × composureF), _takeP persistant entre touches. Requalifié : porter dans l'espace
   LIBRE est sain — résiduel = espace fermé (esp < 6), métrique pour un futur lot.
3. ~~**LES ANIMATIONS DIFFÉRENCIÉES (lot 93)**~~ — **LIVRÉ** (note 135) : 7 clips authored
   (frappePuissante/Enroulee/Pointu ; plongeonUneMain, plongeonPrise — ferme la dette du
   premier contact aérien du lot 91 —, paradePieds, paradeBuste), clés gesteTir + parades,
   busteBlock sim (keeper.js, prouvé unitaire, rare en flux), scène joue les arrêts nommés.
   Le kind→clip au PLAN seulement : l'urgence improvise (10/17 tirs d'espèce au banc).
4. ~~**LES APPUIS DU GARDIEN (lot 94, demandé utilisateur)**~~ — **LIVRÉ** (note 136) :
   bissectrice des poteaux (justesse = keeping/posMixF), profondeur au rôle `garde`
   (gardienDeLigne/gardienLibero) + depthKF, le SET (lancé > 2,2 m/s → lit ×1,35 plus tard),
   duel posé à 1,15 m du porté, poste de corner (moitié lointaine), coup franc < 28 m côté
   OUVERT (le mur a le côté du ballon). Clé cfg.appuis, sab76 9e, graines gardien {2,6,12}.
5. ~~**LES APPUIS DU DÉFENSEUR / LA DISCIPLINE (lot 95, demandé utilisateur)**~~ — **LIVRÉ**
   (note 137) : le jockey (cible ENTRE ballon et but), l'approche sous contrôle (cap × agilité
   sous 4,2 m — lancés 60 → 39 %), le tacle à la FENÊTRE (balPrenable × composure, étau force
   1,5). Clé cfg.jockey, sab76 10e. DETTE NOMMÉE : la sous-production de FAUTES est
   préexistante (~0,1/match vs réel 3-6/220 s) — sources manquantes (accrochages, obstruction,
   épaule mistimée) = prochain chantier Loi 12.
6. ~~**LE BLOC ENTIER (lot 96, demandé utilisateur)**~~ — **LIVRÉ** (note 138) : l'axe tactique
   `marquage` (zone ↔ homme), le ballside (l'homme du côté faible n'a pas de marqueur — la zone
   le couvre), la pince du côté faible (slots ×0,62…1), la LIGNE-BANDE (ne descend pas sous son
   slot — la Loi 11 piège —, ne monte pas à + de 6 m), l'assurance i===2 en fenêtre de pressing.
   Ligne placée 22,4 → 5,2 m, côté faible 17,3 → 13,5. Dette nommée : la couverture délibérée
   (~55 %) — le cover d'aile à l'angle du cône. Clé cfg.zone, sab76 11e.
7. ~~**LES FAUTES DU VRAI FOOTBALL (lot 97, chantier Loi 12)**~~ — **LIVRÉ** (note 139) :
   l'ACCROCHAGE DU BATTU (duel.accrocheStep/accrocheP — politique pure testée) : le dépassé
   retient, composure × axe pressing × rôle press × faute tactique ×1,8 (grave → jaune) ×
   surface ×0,15, base 0,065 au réel ; le porteur s'arrache 1×/2 (l'avantage joue), st.rnd2
   (flux auxiliaire — le contrat rng). ET LE COUP FRANC A UN PRIX (referee, clé cfg.cfDirect) :
   DIRECT 14-30 m (l'enroulée par-dessus le mur, balayage balistique), LANCEMENT 30-55 m (le
   lob dans la boîte, la conversion sort de la physique). A/B 85 tirs/19 buts ∈ bande, 20
   fautes/20 matchs. Charges d'épaule : toutes à distance de jeu (pas de loi — on ne légifère
   pas le vide). Clés cfg.accroche + cfg.cfDirect, sab76 12e. Dette : photo Loi 11 du lancement.
8. ~~**LE JEU OFFENSIF : FIXER AVANT DE RENVERSER (lot 98, retour utilisateur ×3)**~~ —
   **LIVRÉ** (note 140) : le GARDIEN HORS CADRE (« un joueur blanc invisible » : projeté à
   1431 px pour 1280 toute une période) → fov full 54 + rail 0,62 + resize 0×0 blindé (aspect
   NaN définitif) ; LA FIXATION (st._fix : la bascule exige n passes du même côté — 5
   possession ↔ 3 direct, passeur d'élite −1 —, respiration 45 s, densité 6) ; LA SURCHARGE
   côté ballon (postes intérieurs vers le couloir ballon, ≤ 6 m, relation/largeur) ; LA
   FIXATION MÛRE OUVRE LA PROFONDEUR (ouvre 1,2 sur le service du coureur — mesuré : sans
   elle le dosage fait reculer le jeu). 12,3 → 2 bascules/match (fix moyen 4,8), surface 22 →
   26 %, A/B 92 tirs/27 buts ∈ bande (l'attaque 19 → 27). Dette nommée : l'axe sur-vit
   (69 % à |z| < 8 — chantier largeur/circuits d'aile). sab76 13e.
9. ~~**LA LARGEUR OFFENSIVE : LE COULOIR OUVERT (lot 99, dette lot 98)**~~ — **LIVRÉ**
   (note 141) : l'option d'aile avec du champ (8 m dans sa bande) étend la portée de passe
   (24 m — le verrou : l'écartement vivait hors passRange, le bonus seul n'a RIEN changé,
   mesuré) et vaut bonus au barème, modulé largeur (×0,6…1,4) et topF du receveur
   (×0,7…1,3). Ballon axe 65 → 46 %, ailes 16 → 30 (réel 35/25), ailiers libres servis
   4 → 11 %, A/B 84 tirs/23 buts ∈ bande. sab76 14e. Dette nommée : les demi-espaces
   sous le réel (25 vs 40) — le jeu entre les lignes (zone 14), chantier propre.
10. ~~**LA PATTE DU CENTREUR (lot 100, 3e consommateur — dette lot 87)**~~ — **LIVRÉ**
   (note 142) : le débordeur centre de SON pied (σ ×0,85, porte précoce +3 m), l'inversé
   disperse (×1,9) ; contrat générique choice.sigmaF de beginPass (le multiplicateur de
   dispersion du geste, aucun tirage de plus), event 'centre' {patte}. 5 bons pieds / 1
   mauvais sur 8 matchs, A/B 96 tirs/27 buts ∈ bande. ET le « jeu entre les lignes »
   REQUALIFIÉ : sondé à 35 % des passes offensives dans l'intervalle (réel 15-25), offre
   80 % — déjà au-dessus du réel, pas de loi (la dette lot 99 confondait la bande z et
   l'intervalle en profondeur).
11. **Fond de roulement** : ~~re-fonder les clauses de flux pour activer l'écartement en
   continu~~ — **LIVRÉ** (lot 103, note 145 : supportSpanFull 1,25 + settledNear 6 activées
   en défaut, soutienN 2, la clause « pose figée » re-fondée par neutralisation symétrique) ;
   réserves perf sur preuve (LOD corps 42k→12k tri, BundleGroup r185, KTX2).

11b. ~~**LES CORNERS : NAISSANCE + TRAVAIL (lot 101, backlog)**~~ — **LIVRÉ** (note 143) :
   3 sources de naissance (claquette-corner ≥ 13 m/s au bout de l'envergure ou missile
   ≥ 16 imprennable ; tête défensive pressée < 12 m sécurise derrière ; clear en
   catastrophe épinglé profond, 45 %) — outRule juge, aucune règle écrite ; et la mise en
   boîte à la prise (cornerTrav : cibles rnd2 premier/penalty/second, GENRE à la patte
   rentrant/sortant/tendu, branche courte au style). A/B : 19 corners/20 matchs (15 en
   boîte), 99 tirs/20 buts ∈ bande, match11 92/0.
11c. ~~**LE PLACEMENT DU CORNER (lot 102, dette 101)**~~ — **LIVRÉ** (note 144) : les
   GRANDS (tri chargeF) aux postes de la boîte, marquage homme goal-side, premier poteau
   gardé, pose 10 s + course en place (cornerSpots). A/B 93 tirs/20 buts ∈ bande, 25
   corners (22 en boîte), match11 94/0. Dettes : le trot de placement (speeds.place),
   les variantes de plan (corner court, surcharge du second poteau).

## Backlog long terme (inchangé)
Gardien relanceur avancé, formations 442/352
complètes (la couche LIGNES existe), le troisième homme v2 (v1 livrée note 153 — reste :
courses dédiées vers l'intervalle), triangulation v4 (assignation, hystérésis), expulsion
physique complète, saut du jeu de tête.
