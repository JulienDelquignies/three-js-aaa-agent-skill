# Sondes de la foulée (chantier « ils collent au sol », 2026-09-24) — branche de travail, pas encore des bancs

- `locomotion.mjs` — EN JEU (page duel servie en local) : vol, appui, genou en vol, cheville en vol, bassin vs debout, par allure.
- `gaitlaw.mjs` — ce que le générateur prévoit par vitesse (cycle, foulée, cadence, contact) contre Dorn 2012.
- `dropprobe.mjs` — l'affaissement du bassin calculé par le générateur et l'instant du cycle qui l'impose (joe).
- `knee2.mjs` — pics de vitesse du genou à 480 images/cycle (ENG= pour comparer un autre arbre, p. ex. la référence).
- `hipdiag.mjs` — l'instant où la cuisse dépasse −30° (angle GLOBAL de la cuisse, la convention du contrat).
- `griffe-speeds.mjs` — vitesse de la cheville avant la pose, au décollage, rasage de l'orteil.
- `contrat-rb.mjs` — checkGaitGen sur le profil d'un joueur Rocketbox (attention : checkClip lit des Euler en axes Mixamo, sans
  valeur sur un Biped).
- `moyennes.py` + `rbds-moyennes.json` — LA RÉFÉRENCE : Fukuchi, Fukuchi & Duarte 2017 (PeerJ 5:e3298, figshare 4543435), 28-39
  coureurs amateurs sur tapis à 2,5 / 3,5 / 4,5 m/s, angles sagittaux moyens (composante Z : hanche/genou/cheville, hanche
  relative au BASSIN — Visual3D), appui par la force verticale. Appui 0,41 / 0,40 / 0,34 ; hanche au décollage −3 / −7 / −9°,
  max +44 / +53 / +60° ; genou appui max 43-45°, vol max 93 / 107 / 116°.
