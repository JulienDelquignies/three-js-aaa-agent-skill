# Le contrat de sceau — la mécanique pratique (écrit au 262, pour reprendre après un clear)

Le mantra : les attributs sont des FACTEURS (identité à 50), les rôles des AXES (0,5) et des INTERDITS, les tactiques
des axes ; le moteur possède les LOIS ; une clé cfg absente ou null rend l'hier au bit. Un moteur comme Unity / Unreal,
ultra adapté football, réutilisable sur d'autres projets. Chaque « ok continue » = le lot suivant de `PLAN_DOCTRINE.md`
(carte du book : `docs/Book_vers_Moteur/`), scellé selon ce contrat.

## L'ordre d'un lot

1. **Lire** la fiche du book (`docs/Book_vers_Moteur/<fiche>.md` §4 « les lots que la fiche appelle ») et le chapitre
   (`/home/user/book/`, lecture seule, jamais poussé).
2. **Sonde AVANT** : `skills/threejs-aaa/scripts/book/sonde-<lot>.mjs` (2 × 90 min ou 2 × 45 min, graines 3,7 ;
   importe le moteur depuis `skills/threejs-aaa/assets/starter/src/engine/`). Les sondes se relancent après TOUT
   changement moteur (node charge au démarrage).
3. **La loi** : un module `examples/showcase/src/engine/<nom>.js` (lois pures exportées, en-tête qui cite le book et la
   mesure), une clé `cfg.<nom>` dans `match-config.js` (documentée en commentaire, `null` = hier), le crochet dans le
   consommateur (`movement.js`, `match-sim.js`, `rondo-sim.js`, `strike-sim.js`…). Plafond 1249 lignes par module
   (match-sim, rondo-sim, match-config, referee : toute ligne ajoutée se FOND dans une existante).
   Trois copies synchronisées par `cp` : `examples/showcase/src/engine` → `skills/threejs-aaa/assets/starter/src/engine`
   ET `examples/soldier-volley/src/engine` (vérifier par `cmp`).
4. **Le jumeau au bit** : `node $S/fingerprint-ov.mjs '{"<clé>":null}'` doit égaler le défaut de HEAD relu par
   `git stash -q -u && node $S/fingerprint-ov.mjs 'null' | tail -2; git stash pop -q` — le défaut CHANGE à chaque sceau,
   toujours le relire. Ne jamais stasher pendant qu'un processus node démarre.
5. **Sonde APRÈS**, calibrage contre le book (une valeur du book vaut mieux qu'un réglage), les prix nommés.
6. **Clause au banc** : un bloc `if (__bloc()) { … ok(…) }` ajouté à la fin de
   `skills/threejs-aaa/scripts/verify-match11.mjs` (avant le `console.log` final) : lois pures contre les chiffres du
   book, une fixture (le cerveau tenu par `cfg.avantMouvement` si besoin), un sabotage `<clé>: null`.
   Isolement : `BANC_SHARDS=<N> BANC_SHARD=<index> node verify-match11.mjs`, N = nombre de `if (__bloc())` dans le
   fichier (161 au 262, 162 au 263), index = rang du bloc parmi ces guards à partir de 0 — `$S/blocidx.sh '<motif de la ligne ok>'`
   le calcule (compte des guards strictement avant la ligne, moins 1). Le nouveau bloc = N − 1.
7. **Banc complet** : `$S/final<lot>.sh` (copie de `final262.sh` par `sed`) = 8 shards (4 + 4) puis 25 annexes
   (`verify-attributes` en fond ; match rondo gestes menace frappes sync ; roles identification scan loi3 kit part-tint
   tactics slide foulee attente remises contact porte cartons loi12 expulsion football-rules tete) ; le tally se fait
   APRÈS `final<lot>.done`. Si le moteur change pendant le banc, tuer par PID (`ps -o pid=,cmd= -C node | grep verify`,
   `pgrep -f 'final262[.]sh'` — jamais `pkill -f <motif>` avec le motif dans sa propre ligne) et relancer TOUT.
8. **Rouges** : pour chaque rouge, preuve à HEAD~ dans un worktree (`git worktree add -q $S/wt-<lot> HEAD` avant le
   commit ; `cd $S/wt-<lot>/skills/threejs-aaa/scripts && BANC_SHARDS=<N de HEAD> BANC_SHARD=<i> node verify-match11.mjs`).
   Vert à HEAD et rouge ici, et la clause mesure autre chose que la loi → épingle
   `<clé>: null /* <clé> null DATÉ <lot> : vert à HEAD~ (worktree <sha>), <ce qui a bougé> — la clause mesure <X>, pas <la loi> */`
   posée PAR CONTENU dans les `matchCfg({ … })` du bloc (les lignes glissent ; `matchCfg()` → `matchCfg({ épingle })`,
   `matchCfg(over ?? {})` → `matchCfg({ épingle, ...(over ?? {}) })`), puis réexécution isolée. Rouge à HEAD aussi →
   hérité, nommé dans NOTES (246d ; loi12 « le mur se tient » + sabotage ; « contres arrivés à l'entrée »). Un vrai prix
   (la loi casse un comportement nommé) se règle sous la clé, pas par épingle (260 : la touche ; 262 : le regard de passe).
   Annexes : même règle (verify-attributes 157, verify-remises, verify-tactics, verify-roles, verify-scan ont des épingles).
9. **Identification** : `verify-identification.mjs` ligne `EXPRIMES_249` — la règle du 252 : re-déclarer la liste
   « gelable » imprimée par l'annexe, `// REGELÉ DATÉ <lot>`, perdues / gagnées en commentaire et dans NOTES.
10. **Bloc 1 seul** (le budget CPU, ≤ 1,6 ms/step) une fois le CPU libre (4 fils).
11. **Docs** : `NOTES.md` entrée `- <n>: …` (sonde avant, la loi, essayé et jeté, mesuré après, prix, jumeau, banc,
    BANC COMPLET avec le tally, les épingles, le regel, les isolés, les rouges hérités) ; `PLAN_DOCTRINE.md` paragraphe
    `**<lot> — … : SCELLÉ (<n>).**` après le précédent ; `MOTEUR.md` section `### … (lot <lot>, cfg.<clé> — <module>)` ;
    les fiches du book touchées (§4) ; la sonde copiée dans `scripts/book/`.
12. **Commit** (`git -c user.name=Claude -c user.email=noreply@anthropic.com commit -q -F -`, message
    `<lot> — TITRE : … ; NOTES <n>` + trailers Co-Authored-By / Claude-Session ; jamais d'identifiant de modèle dans le
    code ou les commits), **push** `git push -u origin claude/ai-agent-threejs-aaa-tool-dyrrb0` (retry ×4), **build**
    `cd examples/showcase && npx vercel build --prod --token $T`, **deploy** `NODE_USE_ENV_PROXY=1 npx vercel deploy
    --prebuilt --prod --token $T` (retry ×8, sleep 45 ; jamais `--archive=tgz`), **cmp** du chunk
    `https://showcase-pi-mocha.vercel.app/assets/Rondo-*.js` avec `.vercel/output/static/assets/`, puis la ligne
    `Sceau : commit <sha>, poussé ; déploiement showcase-pi-mocha au premier essai (cmp du chunk Rondo servi = construit).`
    dans NOTES + commit + push.

## Les chemins

- `$S` = le scratchpad de session (`/tmp/claude-0/…/scratchpad`) : `fingerprint-ov.mjs`, `blocidx.sh`, `final<lot>.sh`,
  `wt-<lot>` (worktrees), le jeton Vercel dans `$S/.vercel_token` (chmod 600, jamais commité, sorties filtrées). Après
  un clear, recréer `blocidx.sh` (ci-dessus) et `final<lot>.sh` (le contenu est décrit au point 7) ; `fingerprint-ov.mjs`
  a une copie dans `skills/threejs-aaa/scripts/book/` si elle manque — sinon : deux matchs (graines 3, 7) de 600 s avec
  `matchCfg({ shotRange: 20, ...over })`, hash des positions et événements.
- Empreintes défaut : 262 (HEAD 8835e33) = `405d2e80b6d82e19 / 7ddbeaefea413442` (= 261 : la croyance a un jumeau exact) — Défaut du 277 (HEAD 59404a4 = 278 : `ellipse: null`) : `1dd69b0ccdc50f84 / 4c01c6cef91ccde2`. Défaut du 278 (HEAD 842c118 = 279 : `repertoire: null, arretControle: null`) : `1dd69b0ccdc50f84 / b8b500c9aecf89ce`. Défaut du 279 (HEAD 303b2e4 = 280 : `ligneAccrochee: null`) : `f8ee44540564aec8 / 58d96787b184f5c3`. PIÈGE : une clé nouvelle peut PORTER LE NOM d'une clé existante (`accroche`, lot 97) — vérifier `grep -n '<clé>:' match-config.js` avant de la poser. FUSION DU 16/09 (e798b47) : le défaut fusionné `9bc88b5885678386 / f8a6caf87aaa33ee` ; + mes sept clés nulles (blocPercu, enveloppe, visee, ellipse, repertoire, arretControle, ligneAccrochee) = leur HEAD 5f8870f `bb530de469f21cbc / d5ba9ca701a880fa` ; + LEUR_1609 (leurs dix-neuf clés d'hier) = mon HEAD 29c0f95 `3bc007bc74a4355f / 6c592ab9df792a83`. LEÇON : le jumeau d'une fusion se prouve avec TOUTES les clés que l'autre branche n'a pas (ici 275-280, pas seulement les lots depuis la dernière fusion : la fusion du 15/09 était à sens unique). Défaut fusionné 0f5e292 (= 281 : `remisePostes: null, rendezVous: null`) : `9bc88b5885678386 / f8a6caf87aaa33ee`. Défaut du 281 (HEAD d3dbe73 = 282 : `prefiltreTir: null`) : `afff3ab4b4fbbdac / 7f45f8db1717cd98` (le défaut 282 rend la même empreinte à 90 s : la loi y est inerte). Fusion du 17/09 (b26488b) : leur HEAD 7c62a5d = `326ae7bb803ff4f9 / fffdfa37645b241d` = le défaut fusionné (ma loi inerte à 90 s) = fusionné + `prefiltreTir: null` ; fusionné + `orientationPasse, verticalite, decalage, toucheOrientee: null` + `ramasseurs` sans `rattrape` = mon HEAD 038034f au bit. Défaut du 283 (`xt: null` = bd3322e) : `326ae7bb803ff4f9 / fffdfa37645b241d` (le défaut 283 rend la même empreinte à 90 s : la loi y est inerte, le champ xT est plat au milieu). Défaut du 284 (`toucheRapide, toucheAuPied: null` = 695d340) : `326ae7bb803ff4f9 / fffdfa37645b241d` (inerte à 90 s : la cérémonie dure 37 s). Défaut du 285 (`attenteVivante: null` = 3d79d38) : `326ae7bb803ff4f9 / fffdfa37645b241d` ; le défaut 285 = `326ae7bb803ff4f9 / f5c289f166f54abc` (fb5442ad… était l'empreinte d'avant les deux corrections du 285 — le rayon du règlement et la borne du terrain ; corrigé au 286). Défaut du 286 (`toucheEngage: null` par défaut, loi réfutée) = le défaut 285. Défaut du 287 (`layoff: null` = 4535d0f) : `326ae7bb803ff4f9 / f5c289f166f54abc` ; le défaut 287 (`layoff` allumé) = `55081b20a3f6e83c / 43a9e9475b5c9ea4`. Défaut du 288 (`ouverture: null` = d90101b) = le défaut 287 ; le défaut 288 (`ouverture` allumé) = `550a2635874e3899 / 44509e5809a04c0c`. Défaut du 289 (`presseLue: null` = 7bd70e0) = le défaut 288 ; le défaut 289 (`presseLue` allumé) = `53e08475e3d8175c / ebfd994770a4b0c6`. Défaut du 290 (`conduiteSerree: null` par défaut, loi réfutée) = le défaut 289 ; clé allumée (douce) = `915b56f6901a134f / 1224cdc7b72df870`. Défaut du 291 (`tacleDebout` allumé) = `53e08475e3d8175c / ebfd994770a4b0c6` = le défaut 289 (inerte à 90 s : aucune pique avant 90 s). Défaut du 296 (`porteePasse` allumé) = `89a5b29538350a36 / 5570f87efd8aa096`. Défaut du 297 (uneToucheVive.base 0,35, passe.tClean 0,25 ; les valeurs d'hier = le 296 au bit) = `89a5b29538350a36 / e32e5016283143df`. Groupe 296-297 : banc complet À JOUER. Défaut du 292 (`toucheCorps: null` par défaut, loi réfutée) = le défaut 291 ; clé allumée = `dd9c57690e616df8 / 0407380028af82f8`.
  RE-BASÉES au 263 par la copie `scripts/book/fingerprint-ov.mjs` : le défaut de fe85ce1 (= 262) relu = `8c7719e7be1fd95c /
  d6e16464895402f4` (le jumeau du 263 : `cadence: null`) ; 263 (cadence dec 0,1, le nouveau défaut) = `e84a43c302ac93af / 5c36757dc8e7aa1e`. Défaut du 266 (= 267 : `selection: null`) : `877b1eda4f261e8f / 0936f0c76bfd0186`. Défaut du 267 (= 268 : `noyau: null`) : `fbab3fba2405194e / b1d6598a98b4a9f6`. Défaut du 268 (= 269 : `nature: null`) : `fbb13bba24097e30 / b1d3558a98b26d53`. Défaut du 269 (= 270 : `temps: null`) : `4071982537b5a01b / e2d2b37e3f49cea0`. Défaut du 270 (= 271 : `ballonFou: null`) : `4071982537b5a01b / 3ab2de16234fbc03`. Défaut du 271 (= 272 : `xg: null`) : `eca6a43f52c99a9a / 9e20c0fef269019a`. Défaut du 272 (= 273 : `ligne: null`) : `eca6a43f52c99a9a / 9e20c0fef269019a` (identique : la porte xG ne bouge pas 90 s de graines 3 et 7). Défaut du 273 (= 274 : `interligne: null`) : `24bf332026c99502 / 099069883dfa200d`. Défaut du 274 (= 275 : `blocPercu: null`) : `2cd66a81cf90545f / 5f4d7b0a110dd04d`. Défaut du 275 (= 276 : `enveloppe: null`) : `197e623b5bf4c255 / 62f928c9f83c7570`. FUSION du 15/09 (272-276 × A12, commit 662a444) : le défaut fusionné `1dd69b0ccdc50f84 / 144d0962b66de674` ; les cinq clés des deux branches à null (`blocPercu, enveloppe, pausaPied, recevoirSurPlace, pasDeRecul`) = le défaut du 274 (la base de fusion) AU BIT ; les trois clés A12 à null ≠ le défaut du 276 sur la graine 3 (`19815e3b5bf6f160` c. `197e623b5bf4c255`, la 7 identique) — l'autre branche porte un écart hors clé (A12a-f, le regard et les postures), nommé, non corrigé ici. Défaut fusionné (= 277 : `visee: null`) : `1dd69b0ccdc50f84 / 144d0962b66de674`. Défaut du 297 (= 300 : `priseRelative: null`) : `89a5b29538350a36 / e32e5016283143df`. Défaut du 300 (= 301 : `lance` sans `couloir`) : `f5d3b9d135d8f05e / e32e5016283143df`. Défaut du 301 (= 302 : `toucheAxe: null`, `viragesLisses` sans `demiTour`) : `a62a061b2eea593d / e32e5016283143df`. Défaut du 302 (= 303 : `sePoser: null, remiseDevant: null`) : `c5426de23f277dca / 32443be6040d8a60`. Défaut du 303 (= 305 : `prise: 0.8, allongeTouche: null`) : `e25ac1675dd99ff5 / 3e514d624bf84261`. Défaut du 305 (= 307 : `locomoteur` sans `freinEffort`) : `e134e2cd5d15074d / 2a6d7112c666a69f`. Défaut du 307 (= 309 : `aligneRecev: null`) : `21fe2f73ed4cc237 / 7e2e23c088e2ea7b`. Défaut du 309 (= 309b : `aligneRecev` sans `aval`) : `ae8ef26162fc79b3 / 51f90a3b3a733825`. Défaut du 309b (= 310 : `locomoteur` sans `plein`, `toucheOrientee` sans `tournant`/`vMin`) : `eaae295a53a81cc7 / 0ea8864793c802bd`. Défaut du 310 (= 312 : `elanConduite: null`, `toucheOrientee` sans `elanV`) : `c7cf9f1a1d889660 / 3281907dcf676612`. Défaut du 312 (= 313 : `porteePasse` sans `retrait` — et le défaut du 313 lui-même : aucune passe longue en retrait sur les deux graines d'empreinte) : `6d4fc2f7ebdfc58a / a24dedd044894530`. Défaut du 313 (= 314 : `porteeGeste: null`, `retrait` sans `tous`) : `6d4fc2f7ebdfc58a / a24dedd044894530`. Défaut du 314 (= 315 : `orientationPasse` sans `talonP`) : `24e502b9937e1c3c / 05cd9ad8298b5db5`. Défaut du 315 (= 316 : `ligneAccrochee.marge` 2 / 6 / 12) : `a56d133b9d63f5ed / 1680a7a87b4777b4`. Défaut du 316 (= 318 : `repliPasse: null` ; le 317 `suiviAppel` absent du défaut, codé non activé) : `ac6925246208ec72 / 4a6c512be7223801`. Défaut du 318 (= 325 : `rythmeTouche`, `porteRespire`, `repriseControle` à null et `toucheOrientee` lead 1,0 / 0,6-1,6 ; les 319-322 codées, absentes du défaut) : `ad7b435b57e4d310 / 5e8d154938cd04df`. Défaut du 325 (= 326 : `corpsArret: null`) : `5264d2178bc441de / 4740687a57d673cf`. Défaut du 326 : `24761a93a3d14855 / ee44fce334bf7f6a`.

Une preuve à HEAD~ ne vaut que si son journal se ferme par la ligne de bilan « n ✓ / m ✗ » avec autant de clauses que le banc
(moins celles du bloc nouveau) : un conteneur redémarré au milieu d'une clause longue laisse un journal tronqué qui a l'air vert
(leçon du 288 — six épingles posées sur des preuves tronquées, rejouées avant le sceau). Certaines annexes préfixent leur bilan de leur nom
(« verticalite : 6 ✓ / 0 ✗ ») : l'expression de contrôle est `^([^:]+ : )?[0-9]+ ✓ / [0-9]+ ✗$` (leçon du 289 ; au 290, les préfixes accentués ou à espace — « sortie aérienne : » — l'ont élargie).

## La cadence des bancs (23/09 — « les bancs sont beaucoup trop longs »)

Le banc complet (verify-match11 en 8 shards + ~45 annexes) coûte ~6 h de CPU sur 4 cœurs. Il ne se joue plus à chaque lot mais
PAR GROUPE de 3-4 lots : ses rouges se prouvent à la base du groupe (worktree) et s'épinglent en une fois, lot par lot (la clé du
lot qui les a rougis). Chaque lot joue le BANC RAPIDE (`skills/threejs-aaa/scripts/banc-rapide.sh '<clés nulles>' <blocs>`) : le
jumeau à 90 s, le budget (bloc 1), les blocs du lot, les sentinelles (`banc-sentinelles.txt`) et la synchronisation des copies —
quelques minutes. Le déploiement suit le banc complet du groupe. Outils : `BANC_BLOCS=i,j,k` joue ces blocs seuls, `BANC_TEMPS=f`
écrit la durée de chaque bloc (le profil qui choisit les sentinelles et désigne les blocs à alléger).

## L'ordre après le 297 (PLAN_DOCTRINE, la carte du book)

Le 263 (cadence.js), le 264 (rng.js), le 265 (reception.js), le 266 (interception.js), le 267 (selection.js), le 268
(noyau.js), le 269 (nature.js), le 270 (temps.js), le 271 (fou.js), le 272 (xg.js), le 273 (ligne.js), le 274 (interligne.js), le
275 (bloc-percu.js), le 276 (enveloppe.js), le 277 (visee.js), le 278 (ellipse.js), le 279 (repertoire.js) le 280 (ligne.js,
la ligne accrochée) et le 281 (rendezvous.js, les postes de la remise — les trois retours du 16/09) le 282 (prefiltre.js, la porte du tir dans la
surface : le pré-filtre du §1.4 — le volume tient à EV_cont petit) et le 283 (xt.js, la valeur de position au barème de la passe —
la valeur est au barème, l'offre n'y est pas) sont scellés (les fusions du 15/09 et du 16/09 avec la branche
animations) → LES RETOURS DU 17/09 (soir, un match regardé — ils passent AVANT la carte du book) : (1) le temps de jeu — SCELLÉ au 284 pour
la cérémonie sautable, la touche rapide et la touche au pied ; l'attente vivante SCELLÉE au 285 ; reste le
jouer-au-bon-moment des remises (la remise part quand un receveur s'est ouvert) ;
(2) le foot — les contrôles SONDÉS au 286 (le demi-tour après contrôle exécute une passe arrière élue ; la touche qui engage réfutée,
le pivot soudé est un geste à animer) ; la une-touche jugée par son angle SCELLÉE au 287 ; la passe rapide après contrôle RÉFUTÉE comme levier au 288 (des passes
pressées) et la passe qui n'arrive à personne SCELLÉE au 288 (le ballon qui double se prend devant, le receveur en course s'ouvre),
le grand livre des passes et la pression lue au temps d'arrivée SCELLÉS au 289 (la demande « ultra réaliste sur les passes » : le
porteur pressé joue), la conduite serrée sous pression RÉFUTÉE au 290 (la touche se serre, les piqués ne baissent pas : le levier est la pique, Modèle 11), le tacle debout SCELLÉ au 291 (le cône du pied, la réussite du book, le battu ; reste le ballon libre hors passe), la touche qui suit le corps RÉFUTÉE au 292 (les échappées baissent, le total des pertes se conserve : chaque canal corrigé en déplace la perte), la défense collée SONDÉE au 293 (PPDA 2,1-2,5 contre 7,3-17 ; la possession individuelle 1,08 s contre 2,14 ; le marquage collé partout réfuté — la défense est collée AU PORTEUR) ; le contact à déclencheur RÉFUTÉ au 294 et les pertes comptées au sens du book (sonde-295 : ~150-165 en jeu, l'excès ~30 chez le porteur qui conduit) ; la conduite qui contourne RÉFUTÉE au 295 (la perte en conduite est diffuse : six lois locales, une scellée) → LE MÉLANGE DES PASSES (ballons longs 15-18 c. 45-50, passes arrière 45 % c. 36,5, sol 81-85 c. 90-95) ET LE CONTRÔLE ORIENTÉ loin de la pression (les lots suivants), le mélange des passes et le sous-dosage), le jeu un peu lent, les percussions rectilignes qui finissent en passe longue arrière, la
défense qui recule sans se jeter (pas de moment défensif fort, pas d'élimination) ; (3) la caméra — le zoom trop tard quand le
ballon est bas (une caméra rapprochée) ; (4) le produit FM — le match sur 90 vraies minutes, pause / lecture / avance rapide,
les moments clés, le résumé court, le résumé long, le match complet. Chaque point reçoit sa sonde avant sa loi, un lot par point
ou par paire → puis la position sans ballon par la valeur (OBSO, Modèle 06 §6 : le receveur va où le ballon vaudrait — le point de
penalty inoccupé quand le porteur est au ras de la surface) ; la sélection du geste par P_but (§3.2) ; les montants (Modèle 03 §6.3) → k_x à deux régimes et le coulissement par ligne (Bible 10 §3.4, lot 2) → le ballon qui sort ;
dans la croyance : le test d'import (les décisions lisent la croyance), l'attention, la tromperie, la communication.
Dettes nommées : les slots qui sautent (coulissement par ligne à gain k), les ruptures trop courtes (budget de
déclenchement), la marche à 9 % (le temps mort), la possession fantôme du taclé, la pausa sans ballon, l'identification
à ≥ 12 graines.
