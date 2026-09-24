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
