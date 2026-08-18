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
- **Empreintes bit-près** (scratchpad fingerprint.mjs à recréer — il hash positions ET events) :
  rondo seed 5 = `c775c81e62592d4d`, réduit seed 4 = `d1c0c1171e6f876c` (dernière évolution :
  events enrichis lot 90 — le FLUX réduit est celui du lot 62-hérité, seuls les champs d'events
  ont bougé aux lots 87/90). Si l'empreinte bouge : prouver flux-intact par les bancs 84+40
  AVANT d'accepter une nouvelle référence, et la consigner.
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
- NOTES.md : journal complet (notes 1-132) — insérer avant le marqueur
  « - Skill `threejs-aaa` : refs 01–22 ». Prochaine note : 133.

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
  arrêts nommés entiers (90).
- Clés ÉTEINTES documentées (activation = re-fonder les clauses de flux) : supportSpanFull (0),
  settledNear (Infinity), triangle (false — 3 échecs mesurés consignés dans tactics.js,
  la v4 = assignation avec hystérésis PAS en post-traitement géométrique), slotAnchor (false).
  L'axe tactics `relation` est ACTIF (identité 0,5 par défaut, presets placés).
- Le greedy vif d'assignation des slots est un optimum local prouvé (lot 85) — ne pas retenter
  de stabilisation géométrique par frame.

## LE PLAN (validé utilisateur) — dans l'ordre
1. **LE GARDIEN COMPLET (lot 91, scène)** — tout est mesuré (notes 131-132) :
   (a) warp de gant : le bras vise le ballon RÉEL au contact (écart mesuré 1,06 m à la prise,
   min 0,96 — l'infra strike-warp existe, elle sert les pieds) ; (b) le ballon TENU À LA MAIN
   pendant le relevé (mesuré : il flotte à 1,34 m en s'éloignant des mains 1,06→1,39 m) ;
   (c) le relevé PAR ÉTAPES : sol 0,5-1 s (mesuré 0,3), rouler→appui bras→genou→debout borné
   ~250°/s de tronc (mesuré 700°/s, 11 m/s vertical — catapulte), l'AGILITÉ en facteur
   (0,9-1,6 s selon la note) ; (d) keeperDown sim couvre la durée réelle — un gardien lent à
   se relever = fenêtre de rebond offensif. Vérif : les mêmes mesures bones avant/après
   (Hips/Spine2/mains, inclinaison tronc vs verticale, plongeon seed 3 t=24,93 gardien 10 ;
   prise seed 5 t=67,98 gardien 21).
2. **L'ATTAQUANT MUET (lot 92, sim)** — mesuré : 6-7 conduites de +18 m sans décision / 4
   matchs. Le baromètre du porteur dévalue la conduite muette à l'approche de la surface :
   tirer tôt (finishing), servir (vision — les dédoublements sont des options), écarter — par
   attributs ET rôle (le 9 tente, le meneur sert). Sonde de départ : probe-gk89.mjs
   (conduites > 18 m) à recréer.
3. **LES ANIMATIONS DIFFÉRENCIÉES (lot 93, scène/animkit)** — les contrats d'events sont posés
   (lot 90 : arrêt {mode, mains, cote, aerienne}, shot {kind, z}) : frappePuissante (élan
   ample), frappeEnroulée (l'intérieur enveloppe), frappePointu ; parade1main/parade2mains/
   priseAérienne/paradeBuste (à créer aussi côté sim : blocage poitrine)/paradePieds (mode sim
   existant). La bibliothèque est procédurale (authored en code, vérifiable par checkMove
   et screenshot). La partie du corps touchée = TOUJOURS la géométrie, jamais l'aléatoire.
4. **LA DISCIPLINE DÉFENSIVE (lot 94, sim)** — « la défense se jette en permanence » : la
   décision de tacle par la COMPOSURE (le discipliné jockey, l'impulsif plonge), le rôle
   module. Mesurer d'abord : tacles tentés là où le contain suffisait.
5. **Fond de roulement** : le centre préférentiel du pied de débordement (3e consommateur de
   la patte) ; re-fonder les 4 clauses de flux pour activer l'écartement en continu ;
   réserves perf sur preuve (LOD corps 42k→12k tri, BundleGroup r185, KTX2).

## Backlog long terme (inchangé)
Corners travaillés, coups francs directs, gardien relanceur avancé, formations 442/352
complètes (la couche LIGNES existe), le troisième homme / rotations relationnelles,
triangulation v4 (assignation, hystérésis), expulsion physique complète, saut du jeu de tête.
