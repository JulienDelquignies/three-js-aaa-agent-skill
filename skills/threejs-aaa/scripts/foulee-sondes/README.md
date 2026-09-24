# Sondes de la foulée calibrée (chantier « ils collent au sol », 2026-09-24)

Les instruments qui ont servi à caler `motion-gait.js` sur des coureurs mesurés, et à vérifier le résultat EN JEU. Ce ne sont
pas des bancs (les contrats sont dans `verify-foulee.mjs` et `verify-gait.mjs`) : on les relance quand on touche à la foulée.

## La référence : Fukuchi, Fukuchi & Duarte 2017 (RBDS)

PeerJ 5:e3298, figshare 4543435 — 28 coureurs amateurs sur tapis à 2,5 / 3,5 / 4,5 m/s. Télécharger `RBDSxxxprocessed.txt`,
`RBDSxxxrunT25|35|45markers.txt`, `…forces.txt` et `RBDSxxxstatic.txt` dans un dossier de travail, y lancer les scripts Python.
Conventions : `processed.txt` = angles (composante Z = sagittal, hanche relative au BASSIN, Visual3D) ; marqueurs à 150 Hz, X avant,
Y haut, mm ; forces à 300 Hz (colonne Time = indice d'échantillon).

- `moyennes.py` → `rbds-moyennes.json` : courbes moyennes (hanche, genou, cheville) sur 101 points, 0 = pose.
- `appui.py` : contacts par la force verticale (> 50 N) — facteur d'appui 0,338 / 0,299 / 0,275 ; géométrie de la pose et du
  décollage (talon, MT1) ; hauteur du bassin contre la station debout.
- `bassin.py` : antéversion du bassin (ASIS/PSIS) en course moins debout : +4,2 / +6,2 / +7,2°.
- `cadence.py` : fréquence de foulée (altitude du talon) : 1,286 / 1,358 / 1,433 Hz.
- `pied-vitesse.py` : vitesse du talon à la pose ≈ 0,43·v (POSE_VSOL), levée de l'orteil.
- `vol-aligne.py` → `vol-aligne.json` : le VOL réaligné coureur par coureur (la moyenne brute creusait le genou en début de vol) —
  la source de `engine/foulee-rbds.js`.

## Le générateur contre les coureurs

- `compare.mjs` : genou, cuisse globale, cheville, appui du générateur contre la référence (`ENG=` pour un autre arbre).
- `ajusteur.mjs` → `ajuste.json` : descente coordonnée des régimes jog / run sur les courbes, sous contrats, deux rigs.
- `sprint.mjs` → `sprint.json` : le régime sprint (pas de coureurs mesurés au-delà de 4,5 m/s : sous contrat et vraisemblable).
- `genou-frein.mjs` : pic du genou en vol, ligne droite contre frein / virage, face au pic des coureurs ; `genou-decomp.mjs` : quel
  recalage du vol (décollage, pose, Hermite) fait l'excès (c'est lui qui a désigné le recalage cartésien du décollage, 24/09).
- `gaitlaw.mjs`, `dropprobe.mjs`, `knee2.mjs`, `hipdiag.mjs`, `griffe-speeds.mjs`, `contrat-rb.mjs` : sondes ponctuelles (loi de
  cadence, affaissement du bassin, vitesse du genou, cuisse, vitesses du pied, contrat sur un Rocketbox — checkClip y lit des Euler
  en axes Mixamo, sans valeur sur un Biped).

## En jeu (page duel servie en local : `npx vite build` puis `python3 -m http.server` dans `examples/showcase/dist`)

URL type : `http://127.0.0.1:PORT/duel.html?duel=1&webgl&capture&seed=3`.

- `locomotion.mjs <url> [s]` : vol, appui, genou et cheville en vol, bassin, par allure.
- `glisse-accel.mjs <url> [s]` : glissement du pied PENDANT LA PHASE D'APPUI du générateur, par lacet et par accélération.
- `trace-glisse.mjs <url> [s]` : les appuis qui glissent > 8 cm, image par image (cible du verrou, portée réelle, geste, touche),
  et le compte des replantations d'ancre. C'est lui qui a trouvé les trois causes du 24/09 (racine de la sim, touche sur le pied
  d'appui, pose sous geste) et le pivot sans pas.
- `pieds.mjs <url>` : contacts par la HAUTEUR (pied à < 2,5 cm de son sol) — inclut l'approche de la pose, où le talon avance
  encore à ~0,43·v par construction : ce n'est pas le glissement d'appui (voir `glisse-accel.mjs`).

## Le sprint : Dorn, Schache & Pandy 2012 (SimTK « runningspeeds », licence MIT — LICENCE-dorn2012.txt)

Un sprinter (JA1) sur piste instrumentée (8 plateformes, 12 m), 3,56 / 5,20 / 7,00 / 9,49 m/s, marqueurs à 250 Hz, poses et décollages
du laboratoire. Télécharger RunningDataModels.zip (simtk.org/projects/runningspeeds, « I agree »), dézipper, lancer les scripts dans le
dossier (python avec le paquet `c3d`). À 3,5 m/s ses courbes tombent sur celles de RBDS : les deux sources se prolongent.

- `sprint-dorn.py` → `dorn-sprint.json` : centres articulaires (hanche Harrington, genou et cheville reconstruits de l'essai statique par
  corps rigide), cuisse globale, genou, bassin, tronc, géométrie de la pose et du décollage, cycle par cycle.
- `dorn-vol.py` → `DORN_VOL` (engine/foulee-rbds.js) : le vol à 5,19 / 6,97 / 9,47 m/s — genou 147° au sprint (79 sprinteurs à 9,9 m/s :
  148,4 ± 5,6°, Miyashiro, Nagahara et al. 2019).
- `cheville-dorn.py` → `CHEVILLE_VOL` : la cheville en vol (pied − jambe) — le pied articulaire du générateur.
- `pied-dorn.json` : l'angle du pied sur le cycle (le générateur le suivait à plat en vol : pied à 52 rad/s, sprinter 27-30).
- `compare-sprint.mjs` : le générateur contre le sprinter (cycle, appui, bassin, cheville à la pose / mi-appui / décollage).
- `sprint-mesure.mjs` → `sprint-mesure.json` : le régime sprint calé dessus, sous contrat (+ contrats à 6 et 8 m/s).
- `garde-orteil.py` (RBDS, marqueurs) : la garde du MT1 en vol — le plancher du contrat « le vol rase la pelouse » (quart bas des coureurs).

## L'appui mesuré (2026-09-24)

- `appui-mesure.py` (RBDS, marqueurs + force) → `appui-rbds.json` et `appui-dorn.py` (le sprinter, contacts aux plateformes, même définition)
  → `appui-dorn.json` : par vitesse, l'inclinaison du pied, la hanche (pose / mi-appui / décollage, et sur le cycle), la cheville, le métatarse,
  l'avance propre de la cheville, le talon debout. `appui-vers-moteur.py` → `APPUI_REF` (engine/foulee-rbds.js).
- `compare-appui.mjs` : l'appui du générateur contre ces mesures (en longueurs de jambe) — c'est lui qui a calé `bias`.
- `glisse-accel.mjs` mesure désormais le glissement du POINT D'APPUI (la cheville moins l'avance propre du pied : le talon qui roule, le pivot).

## La marche : Fukuchi, Fukuchi & Duarte 2018 (WBDS, figshare 5722711, CC BY 4.0)

PeerJ 6:e4640 — le labo de RBDS : 24 jeunes adultes sur tapis, 8 vitesses (0,4 → 2,2 m/s), marqueurs à 150 Hz (mêmes conventions).
Télécharger `WBDSxxwalkT01…T08mkr.txt` et `WBDSxxstatic.txt` dans un dossier de travail. Évènements cinématiques de Zeni 2008 (la pose =
talon le plus en avant du bassin, le décollage = MT1 le plus en arrière) : pas de plateformes de force sous un tapis de marche.

- `marche-mesure.py` → `marche-wbds.json` : par classe de vitesse (0,59 / 0,90 / 1,21 / 1,51 / 1,78 m/s), cadence, appui, vol réaligné
  (cuisse globale, genou, cheville), appui (pied, cheville, MT1, hanche sur le cycle), pose / décollage, avance propre, garde du MT1 en vol.
- `marche-vers-moteur.py marche-wbds.json <engine>/foulee-rbds.js` → `MARCHE_VOL` et les nœuds de marche d'`APPUI_REF`. À lancer APRÈS
  `appui-vers-moteur.py` (qui réécrit `APPUI_REF` avec les seules vitesses de course).
- `compare-marche.mjs` : la marche du générateur contre les marcheurs (en longueurs de jambe). Écart restant : le genou à la pose (20-30°
  contre 1-3°) — la jambe du rig contre la géométrie des données ; la cadence du rig est ~14 % plus haute (legK, voulu).
- Ce que ces mesures ont changé : la portée du bassin à 4° en marche (12° l'accroupissait), `bias` 0,10 (balayé), le plancher de l'orteil
  en vol (`plancherOrteil` : médiane MT1 0,7 cm, quart bas 0,3-0,4), le poids wRun étendu à la marche, et le contrat — à la pose, les
  marcheurs ont la cheville à ~1,0-1,5·v (événements de Zeni) : le « talon qui se pose immobile » n'est pas une loi de la marche.
- En jeu : `glisse-accel.mjs` compte aussi l'orteil pendant le DÉROULÉ. C'est lui qui a trouvé que l'avance propre du pied (le talon qui
  roule, le pivot sur les métatarses) suivait l'axe du CORPS qui tourne au-dessus du pied planté (orteil p90 6-8 cm dans les virages
  lents) : elle suit maintenant l'axe du pied planté (motion-gait `axeDe`, character-controller `_anchorStance`) — p90 2-3 cm.

## À reculons (2026-09-24)

**La marche arrière est MESURÉE** : Scherpereel, Molinaro, Inan, Shepherd & Young 2023 (Scientific Data 10:924 — SMARTech, Georgia Tech,
DOI 10.35090/gatech/70296, CC BY 4.0) : 12 adultes sur tapis instrumenté à DEUX BANDES (une force par pied), `walk_backward` à 0,6 / 0,8 /
1,0 m/s et `normal_walk` 0,6 / 1,2 m/s (la référence avant des mêmes sujets), marqueurs à 200 Hz. L'archive fait 28 Go (marqueurs) et 13 Go
(données traitées) : `zipdistant.py <url> '<regex>' <dossier>` en extrait les seuls fichiers voulus par requêtes Range (8 fils ; UN_STATIQUE=1 :
un essai statique par sujet) — URL des archives dans le README de SMARTech.
- `recul-mesure.py` → `recul-scherpereel.json` : contacts à la force (> 50 N), fenêtres de vitesse des données traitées (20 s), cadence, appui,
  vol (cuisse, genou, cheville), pied (talon → MT1), talon et MT1 en appui, bassin (Harrington), pose / décollage, vitesse sol à la pose,
  garde du MT1 et du TALON en vol (à reculons c'est le talon qui mène : quart bas 1,4-2,7 mm).
- Ce qu'on y lit : le pied se pose sur la POINTE (MT1 d'abord dans 100 % des cycles, −22 à −31°), le talon descend en 20 % de l'appui, le pied
  quitte le sol TALON EN DERNIER (+13 à +19°) ; genou 31-39° à la pose, 4° au décollage ; le vol plie le genou TARD (44-50° vers 70 %) ; cadence
  ×1,19-1,25 la marche avant des mêmes sujets ; appui 0,63 → 0,61. C'est la marche avant renversée dans le temps (Winter 1989, Thorstensson 1986).

**La course arrière est ASSEMBLÉE** (aucun jeu de données public au-delà de 1 m/s) — `recul-vers-moteur.py` en donne chaque source :
cadence (×1,22-1,37 la course avant) et appui de Brennan et al. 2026 (Eur J Sport Sci, 16 athlètes, lus sur leurs figures) ; forme des
courbes d'un acteur (100STYLE, Mason 2022, Zenodo 8127870, CC BY 4.0, combinaison inertielle, ~1 m/s : `recul-100style.py` →
`recul-100style.json` — sa marche arrière tombe sur Scherpereel à quelques degrés) ; genou 40° à la pose tenu jusqu'à mi-appui, pied posé sur la
pointe, talon qui descend (Bates, Morrison & Hamill 1986) ; amplitude à 5,1 m/s (Arata 1999 : genou 83°, hanche 42°) ; rebond du centre de masse
(Cavagna, Legramandi & La Torre 2012 : 8,0 / 7,2 / 6,0 cm à 2 / 3 / 4 m/s) avec le creux TARD dans l'appui (atterrissage doux, décollage dur —
la dissymétrie de la course avant renversée). Les hauteurs de bassin qu'on déduirait des angles de Bates (un sujet, une figure) sont
incompatibles avec un vol balistique de 83 ms : le rebond suit la physique, le genou à la pose suit Bates.
- `recul-vers-moteur.py recul-scherpereel.json recul-100style.json <engine>/foulee-rbds.js` → `RECUL_REF` (BASSIN_BR : le haut du rebond, calé).
- `compare-recul.mjs` : le générateur contre la marche mesurée et les ancres de la course (c'est lui qui a calé bias et BASSIN_BR).
- Écarts restants : le genou au décollage de la marche arrière (15-20° contre 4° — le résidu de normalisation de la jambe, celui de la pose en
  avant) ; au décollage de la course arrière 16-25° (Bates : 2° sur un sujet, 100STYLE : 19°).
- Trouvé en route : le recollement du cycle dans le contrat de glissement avait le signe inversé (latent : en avant aucun pied n'était « à
  plat » sur la couture) ; sous griffé, l'avance du pivot suivait la COURSE et non l'axe du pied (à reculons l'appui glissait à 0,5-0,9 m/s).
