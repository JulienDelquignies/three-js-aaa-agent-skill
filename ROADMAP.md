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
- **A/B de ship** : 20 graines × 300 s (scratchpad ab-97.mjs : makeMatch full,
  matchCfg({shotRange: 20}), compter tirs/buts) — bande de buts totaux **8-22** = gate.
  RE-FONDÉE au lot 137 (décision de monde DATÉE, note 179) : l'ancienne 17-33 était
  calibrée sur le monde-chaos (~×6 le réel — reprises indéfendues, dégagements errants) ;
  7 lots de réalisme user-driven (131-137) l'ont assaini et le monde converge vers 11-17
  (~×4 le réel, format 300 s oblige). Ancrage : 40 graines du monde 137 = 28 buts
  (11 + 17), centre 14, largeur proportionnelle. NE PLUS affaiblir des lois de réalisme
  pour un chiffre d'arcade — la bande suit le monde, datée et consignée.
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
  « - Skill `threejs-aaa` : refs 01–22 ». Prochaine note : 162.

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

12. ~~**LA LISTE UTILISATEUR DES GESTES (114-120)**~~ — **SOLDÉE** (croqueta 114, petit
   pont 115, roulette 117, talonnade 118, une-deux 119, lob du gardien avancé 120 — note
   162 : le couple libéro {far 34, rampe 8, retour backpedal 3,5} + le lob à trois portes
   (arbitre gardien-sorti, décollage libre, par-dessus les têtes), 0,08 lob/match, A/B 28
   buts ∈ bande, rondo/réduit AU BIT, ticker « lob tenté »). Dettes 120 : le lob n'a pas
   encore marqué (fenêtre du contre éclair rare), la relance au pied du libéro hors
   surface (Loi 12 v2).

13. **LA LISTE UTILISATEUR v2 (121-125, en cours)** : ~~121 la roulette Zidane~~ —
   **LIVRÉ** (note 163 : la traversée rouletteRoule 0,5 + sortie 75 %, tirage re-calibré
   0,032 par le gate, sortie p50 2,5 → 4,3 m/s, gain 1,9 → 3,3 m, A/B 32 ∈ bande) ;
   ~~122 les changements de rythme~~ — **LIVRÉ** (note 164 : la sortie de geste explose
   — _pace 'sortie-geste' ×1,45, durée × accelF, +24-30 % mesurés ; le contre-appel
   casse aux pieds × rôle appel, 2,8/match ; la marche au calme existait déjà — mesurée,
   pas de loi) ; ~~123 la présence dans la surface~~ — **LIVRÉ** (note 165 : la sonde a
   tranché — p50 1 corps, pas un réglage ; le box crash à DEUX régimes : défaut
   plongeon-seul quasi-identité AU BIT, remplissage lourd en OPT-IN attente payé en
   conversion ; dette majeure nommée : LE TRAFIC DE FRAPPE EN BOÎTE) ; ~~124 les
   passements ×3+~~ — **LIVRÉ** (note 166 : l'enchaînement à passementEnchaine × gesteF²
   — le carré fait le style, clips 3-6 par repeatSegment, le risque émergent du ballon
   exposé, rondo/réduit/seed 3 au bit) ; ~~125 le répertoire de courses d'ailier~~ —
   **LIVRÉ** (note 167 : l'espèce du dart à la situation × patte × rôle × tactique —
   deborde 9 / underlap 5 / banane 2 vs 9/9 diagonale avant ; le décrochage couvert par
   le contre-appel 122). **LA LISTE v2 EST SOLDÉE.**

14. ~~**LA PASSE EN PROFONDEUR AU SOL (lot 128, demande utilisateur)**~~ — **LIVRÉ**
   (note 170 : le rendez-vous itéré — t passe = t course via solvePass exact —, la pointe
   d'intervalle 2,5 m, l'arrivée dosée au CONTROL du receveur ; 5,7 through/match,
   conservés 91 % ; rondo/réduit au bit). Dettes : le through dernière-passe composé au
   débordement du 125, la tactique direct au seuil du couloir, le libéro adverse qui
   punit les trop-appuyés (la boucle 120).

## Backlog long terme (inchangé)
LE POIDS DES NOTES v2 (lot 115 : la part élite aux tirs a érodé de 69 % → ~49 % sur 36
lots — chaque loi nouvelle redistribue des 50/50 ; sonde PAR MÉCANISME puis re-concentration
de l'avantage : chasse × pace, premier toucher × control, duels × strength/tackling).

LES CLAUSES APPARIÉES v2 (lot 122 : les sabotages d'écart absolu s'effritent à chaque
monde re-daté — 8 re-fondations en 4 lots ; la forme robuste : vif et saboté sur les
MÊMES graines, borner l'écart apparié, insensible au niveau absolu du monde).

~~LE TRAFIC DE FRAPPE EN BOÎTE~~ — **ÉTAGE 1 LIVRÉ** (lot 126, note 168 : le mur se
contourne — menace.mur 0,35, franc et tenté décroissent avec la densité adverse du cône ;
attente 19 → 25 % de conversion, les quatre empreintes au bit). ÉTAGE 2 (le surnombre
UTILISÉ) : le coureur de surface LIBRE doit être servi — la passe de surface scorée au
marquage du receveur ; le seuil du franc (0,45) à requalifier en boîte.

LE MARQUAGE DU COUREUR DE MUR (dette 119 : ~20 % des retours de une-deux = but, la course
dans le dos du presseur n'a pas de défense dédiée).

Gardien relanceur avancé (la relance au pied du libéro, dette 120), ~~formations
complètes~~ — **LIVRÉ** (127 puis 129, notes 169/171 : 15 formations — la liste
utilisateur au complet —, ROLES_FORMATION, et la FORMATION PAR PHASE {on, off} au
résolveur pur, bascule mesurée 2,3 vs 1,4 corps ; dettes : presets tactiques par
formation, asymétriques, hystérésis de bascule, ~~mapping de postes on↔off~~ — **LIVRÉ**
(130, note 172 : map configurable poste-à-poste + le rôle par phase composé par nature
d'axe, les quatre empreintes au bit)),
le troisième homme v2 (v1 livrée note 153 — reste : courses dédiées vers l'intervalle),
triangulation v4 (assignation, hystérésis), expulsion physique complète, le pré-saut de
tête anticipé (v1 réactive livrée note 154).

LA RESPIRATION (131, note 173 — retour utilisateur) : le ballon vivait 56 % du temps HORS
des pieds — dégagements jetés au flanc vide (198 s/1200) et une-touche sous-dosées qui
meurent (116 s). LIVRÉ : clearServi (le dégagement cherche une tête, portée à l'axe
transition) + uneTouche.dose (solvePass + cap de layoff en filtre de faisabilité). Carry
43 → 54 %. LE MONDE MATCH RE-DATÉ : empreintes seed 3/7 = 4e6d780e9ada8598 /
0dd3da58dc0e579e (rondo/réduit inchangées). Dettes : les drivens longs au calme, le tri
du dégagement vers une vraie tête (taille/duel), le porteur qui PORTE (conduite ≥ 5 m :
14 % seulement — la progression par la conduite reste timide).

LE GARDIEN QUI TENTE (132, note 174) : le plongeon d'honneur (battu proche → le geste
part, honneur:true) + le regard du gardien (yaw au ballon en course, pas chassé — le
côté du clip juste). Les « téléports » étaient l'instrument (la remise en jeu) — mais
la remise qui claque un corps couché reste une dette visuelle nommée. AMENDEMENT :
l'empreinte réduit re-datée par l'INSTRUMENT du 131 (tag clear sur l'event pass) —
nouvelle référence c701c84aec0851ef, rondo intact c775c81e62592d4d.

LE MARQUAGE DE SURFACE (133, note 175 — phases.marquageCentre) : au vol du centre,
des corps sur les corps (goal-side, rayon à l'axe marquage 8-16). p50 1,8 m, libres
41 %, les dégagements défensifs existent — MAX 2 pris + rémanence 1,0 s (le marquage
intégral crevait la bande A/B : le feuilleton du 123 rejoué — la RÉMANENCE est l'opt-in).
Empreintes match 132+133 : 303626266e0d67c9 / 055acde62558ce48. Dettes : le second
poteau, le tri par TAILLE du marqueur aérien, le marquage du second ballon, la rémanence
défaut si la bande évolue.

LES CPA PAR ÉQUIPE (148, note 189) : tac.cpa { corner: court/premier/second/mixte,
coupFranc: direct/centre/mixte, marquage: homme/zone } — le corner court a son OFFREUR
placé, le direct ose à 34 m (v 21), la zone garde le point de chute. Opt-in au bit.
Reste : goalKick/throwIn styles, setPiecesFocus, protection premier poteau.

L'INVENTAIRE DU CONSOMMATEUR CARRIÈRE (146-147, note 188) : 6 notes de plus (21
consommées — vision/technique/handling/heading/crossing/weakFoot + flair→persona),
l'audit (formations + seconde formation + vision déjà natives : leur copie en retard),
le contrat des 2 régimes de conduite consigné à pushSpeed. LE PLAN DU RESTE, par ordre
de rendement : (1) LES CPA PAR ÉQUIPE — leur seule demande MESURÉE : cfg.cpa = [t0, t1]
(cornerStyle court/premier/second poteau, freeKick, goalKick, throwIn, le marquage
zonal/homme) — le corner travaillé (101/102) et la touche (29) existent, il manque
l'ESPACE PAR ÉQUIPE et l'élection de variante ; (2) tempo (axe 11e, la barre calme/
cadence de circulation le portent), mentality (compose coach.js), offsideTrapAggression
(le cap du bloc + Loi 11) ; (3) gkStyle (distribution length/channel/tempo/risk sur la
rampe de distribution existante ; sweeperTendency = l'axe garde ✓ déjà), crossStyle
(deliveryPoint/trajectory/targetZone sur tryCross), passStyle (firstTimeBias sur
uneTouche.p, technique weighted/driven sur le style) ; (4) les notes mentales —
decisions (le bruit du barème d'élection), offTheBall (les cadences d'appel),
positioning (le drift du slot), workRate (les cooldowns de course), aggression (la
proba charge/tacle + fautes), concentration (la dérive des erreurs au chrono),
marking (l'offset/la tenue du marqueur) ; (5) le trio gardien command (l'organisation :
la ligne mieux tenue = un levier sur les AUTRES), kicking (la portée/σ de relance),
throwing (la relance main vive), oneOnOnes (le duel du 1c1), aerialReach (la prise
aérienne sur centre) — bravery recouvre l'axe garde, à documenter comme alias.

LE QUATUOR DU RÉALISME (142-145, notes 184-187 — retours utilisateur ×4) : la semelle à
sa place (K.semellePlace — 333 → 36/90 min, jamais l'option qui attend), l'œil de
l'urgence (cfg.oeil — la panique ne joue plus la ligne morte : interceptions 15 → 11 %,
complétion 83 %), le jeté se punit (cfg.fixe — élection avant + déclenchement + la
fenêtre d'appel ouverte : 54 % des jetés joués < 0,9 s), le hors-cadre (cfg.dispersion —
σ situationnel + hauteur + vitesse : 13 → 22 % ; dette : le trafic plafonne, ne pas
re-tenter par le σ).

LA TRANCHANTE + LA POUSSE (140-141, notes 182-183 — retours utilisateur) : la rupture
part de loin et se sert derrière la ligne (cfg.tranchant — 18 servies en course/20 min,
0 hier ; visionF = 2e levier de passing), la ligne arrière attaquante franchit le rond
quand le ballon est profond (cfg.pousse — p50 +0,7 → +4,6, p90 +11,8 ; gain × hauteurBloc).
DETTE : la PRISE AU PASSAGE (le receveur cueille le ballon qui le double — l'échappée pure
reste 0 ; nuancer le contrat lot 59 pour le through profond).

L'OVERLAP + LE RETOURNEMENT (138-139, notes 180-181 — validés/demandés utilisateur) :
l'overlap double le porteur excentré (accompagne.overlap — largeurR élit, ~7,7/match,
21/46 servis < 3 s) ; le yaw ne se téléporte jamais (cfg.yawSlew — p90 des pivots de
prise 6 168 → 882°/s, slew 540°/s × accelF ; dette : le slew yawWant à ~1 000°/s basse
vitesse, le second écrivain).

L'ACCOMPAGNEMENT DE LA MONTÉE (137, note 179 — retour utilisateur « le porteur esseulé ») :
la montée soutenue déclenche 1-2 courses à hauteur (phases.accompagneMontee — job receive
pour le plafond de chasse, un par côté, jamais un corps déjà devant : les pointes gardent
LEUR course ; rôle appel, axe transition). Offre en montée 2 → 3 (= le posé), soutien
14 → 10,3, devant 0 → 1. + LA BANDE A/B RE-FONDÉE 8-22 (voir le contrat de méthode).
Dettes : l'overlap de dépassement (le devant profond), l'accompagnement du piston, les
pénos absents (0 faute en surface — chantier Loi 12/14 de réalisme).

L'ÉCHELLE DE LA SÉCURITÉ (136, note 178 — retour utilisateur Guardiola/corners) : LA
PASSE AU GARDIEN = PENTE DE STYLE PURE (0 au défaut 0,5 — l'identité, seed 7 au bit du
135 ; possession : 7/3×300 s — le patron UT.calme), la TOUCHE VOLONTAIRE = OPT-IN
(clearTouche), au DÉFAUT : corner de panique < 10 m tirage 0,35 × sang-froid + seuils
d'étau au style × rôle press. Gate 90/17 (le fil). DETTES : le volume des touches
(« le terrain déborde »), le backpass Loi 12.2, le drop kick, le clip du dégagement.
⚠ CHANTIER DE FOND : le monde défaut vit au BORD BAS de la bande (17-18) — re-gagner
des buts par des sources RÉELLES (corners convertis, pénos, finition) AVANT toute
nouvelle loi défensive par défaut.

LA DYNAMIQUE (135, note 177 — retour utilisateur « pas l'impression d'un vrai match ») :
le panorama statique est SAIN (10 signatures vs réel — probe-135 à recréer au besoin) ;
le mal était le TREMBLEMENT des cibles (re-tri frame-vif du marquage et des slots).
LIVRÉ : cfg.assignTenue (la « v4 » : le grand saut attend sa tenue, aux 4 sites _markT/
_slotT). cfg.engagement (courses de posture tenues) = OPT-IN — l'apparié l'a chargé (les
fenêtres offensives). Empreintes match 92b28039679dd07e / a6027bed22206dee. DETTES
« dynamique v2 » : la mémoire des JOBS, la synchronie du bloc (les vagues), l'inter-lignes
17,8 (réel 10-15), le recyclage 49 % (réel 30-40), le lissage du press.

LE BALLON LIBRE PRIS EN CHARGE (134, note 176 — retour utilisateur) : le rattrapage vise
AU TRAVERS (cfg.rattrape — l'orbite derrière la passe fuyante), le ballon réel commande à
portée (cfg.meetReel — le vol dévié couru au lead fantôme), et L'INTERCEPTEUR DU MATCH
(cfg.interception, phases.intercepteurVol — le rondo l'avait, le match jamais ; 283
frames/300 s). Piège d'ordre consigné : la chaîne mourante/menace écrase met sans le
vérifier — toute nouvelle branche de cible receveur doit se placer APRÈS elle. Dettes :
le hunter de chaseLoose sans « au travers », l'instrument « ignoré » de la 134e (faux
quand d0 < 2).
