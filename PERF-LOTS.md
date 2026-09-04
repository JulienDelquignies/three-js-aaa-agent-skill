# Le 11 contre 11 optimal sur toutes les machines — exécution du brief (branche `perf/11c11-lots`)

Le diagnostic du brief est tranché et n'a pas été re-dérivé : le tier se choisissait sur la largeur CSS de la fenêtre
(Rondo.js:75), seule auto-détection du dépôt. Chaque lot ci-dessous livre son code, son garde cassé une fois, et deux
nombres avant/après **sur le seul instrument disponible ici**.

## L'instrument, et ce qu'il vaut

Cette session n'a pas la Surface Go ni aucun GPU : Chromium headless sous SwiftShader (GPU logiciel, repli WebGL2).
Sans les drapeaux `--disable-gpu-vsync --disable-frame-rate-limit` ce navigateur swappe à 1 image/s (mesuré : un
simple clear WebGL2 à 1 016 ms, une page vide à 16,7) — l'instrument était démenti, il a été corrigé avant tout chiffre.
Avec eux, l'intervalle rAF mesure le travail de rendu logiciel. Fenêtre de mesure : **704 × 120 px, DPR 1** (largeur
≥ 700 : la fenêtre « large » qui prenait le tier haut), 3 s jetées, 16-24 s lues, p50 / p95 / p99 — jamais de moyenne.

**Ce que ces nombres valent** : un GPU logiciel n'a pas le profil d'une UHD 615 (la part fixe y domine tout, les nappes
de projecteur n'y coûtent rien). Ils prouvent les contrats binaires (SSR retirée, shader refusé, journal, marche) et
donnent le sens des lots à part fixe (2, 4, post) ; ils ne remplacent pas les 1 200 / 550 ms de la campagne. **Les deux
nombres de chaque lot sur la vraie machine restent à prendre** avec `examples/showcase/perf/mesure.mjs` (README à côté).

Canal CPU (logique de jeu, hors du cadran de stats-gl) : **3,7-4,3 ms p50** ici sur toutes les configurations, cohérent
avec les 3,8-4,6 ms de la campagne ; le LOD d'animation n'a pas été touché.

## Étape 0 — la question qui tranche tout

**Non répondue ici, par honnêteté d'instrument.** Le tier bas est-il jouable sur la Surface Go ? Seules les trois URL
du brief sur la machine elle-même le disent. Ce que ce dépôt livre pour y répondre vite : la sonde `?probe=1` inchangée,
l'instrument `perf/mesure.mjs`, et le journal de la boucle (`window.__scene._ladder.log`) qui écrit ce que la machine
tient. Si le tier bas n'y est pas jouable, le plan change (l'escalier a alors ses crans de résolution sous low).

## Lot 2 ⭐ — SSR retirée sur le repli WebGL2, et le contrôle rougit

`render-pipeline.js` : `rendererPath(renderer)` lit le backend (WebGPU ou WebGL2), jamais supposé ; `tierFor()` retire
SSR du graphe sur WebGL2 (motif consigné dans `pipeline.ssrRetire`) ; `renderer.debug.onShaderError` consigne tout
programme refusé dans `renderer.userData.shaderErrors` ; `checkRenderPipeline` **rougit** sur un shader consigné et sur
une SSR construite sur le repli. Rondo joue le contrôle à la 3e image (les shaders compilent à la première) et l'écrit
dans `_reports.pipeline` + console.

Reproduit ici avant : `Shader Error 0 - VALIDATE_STATUS false … ERROR: 0:248: 'max' : no matching overloaded function`,
passes `[bloom, gtao, ssr, traa, sharpen, dither]`. Après : passes `[bloom, gtao, traa, sharpen, dither]`, 0 shader
refusé, contrôle ok.

| | avant | après |
|---|---|---|
| image p50 / p95 (ms) | 1 197 / 1 922 | 1 104 / 1 247 |

Garde cassé une fois : `?ssr=force` laisse SSR dans le graphe → contrôle **ROUGE** avec l'erreur exacte (mesuré).
Prix visuel : zéro (on cesse de payer un néant). WebGPU garde SSR inchangée.

## Lot 4 — le compteur caché ne tourne plus

`Engine.boot({ stats })` : sans `?fps`, aucun Stats n'est créé — ni begin/end/update, ni requête de temps GPU, ni
panneau. `runner.js` passe le drapeau. Avant / après (même scène) : **p50 1 104 → 1 054 ms** (−4,5 % ; −3,5 % mesuré
sur la campagne). CPU logique inchangé (4,9 → 4,0 ms p50, bruit).

## Lot 1 ⭐ — le tier d'après la machine

`engine/quality.js` : `lireMachine()` lit ce qui existe (UNMASKED_RENDERER_WEBGL sur WebGL2, `adapter.info` sur WebGPU,
`hardwareConcurrency`, `deviceMemory`, largeur, chemin) ; `marcheDepart()` ne fait que choisir la **marche de départ** :
un GPU intégré ou logiciel qui se nomme, ou ≤ 4 cœurs ET ≤ 4 Go, ou une fenêtre étroite → low ; sinon high, et le
doute va au haut — la mesure des premières secondes tranche. Pas de liste de GPU à maintenir : un faisceau de signaux
faibles. `?q=` l'emporte toujours. Rondo l'écrit en console : « qualité : marche de départ low — GPU faible nommé : … ».

Banc (`verify-quality.mjs`) : UHD 615 derrière 1 200 px → low ; i7 + RTX → high ; téléphone 412 px → low ; signaux
absents → high ; 4 cœurs et 4 Go sans GPU nommé → low ; `?q=high` sur SwiftShader → high. Ici : SwiftShader nommé →
départ low, marche 3, consigné dans le journal.

## Lot 3 ⭐ — la résolution dynamique réparée

`decider()` juge la fenêtre de 2 s au **p95 des intervalles** (descente si p95 > 22,2 ms ≡ 45 ips au centile ; remontée
si p95 < 18,2 deux fenêtres de suite — l'hystérésis du lot 62 gardée) ; `prochaineMarche()` nomme **plancher** et
**plafond** au lieu de se taire ; `cransDpr()` rend l'ensemble des crans propres (dpr/n, lot 73) sous le cap et au-dessus
du plancher — **vide, il est signalé**, plus jamais avalé. La fenêtre gelée (> 4 s) se rejette toujours.

Banc : à-coups 1 sur 12 à 48 ms → moyenne 19,3 ms (52 ips, « ok » hier) mais p95 48 → descend ; vif → tient puis
monte à la 2e fenêtre ; tiède → le compteur retombe ; 3 images → attend ; DPR 1 → ensemble vide nommé.
Ici, journal réel : `{"de":3,"a":3,"bord":"plancher","pourquoi":"descend demandé mais plancher atteint","p50":13.2,
"p95":26.8,"p99":703.2}` — le plancher parle. La remontée n'est pas observable sous SwiftShader (jamais deux fenêtres
rapides sous ses pointes) ; elle est prouvée au banc et attend la vraie machine.

## Lot 5 — l'escalier

`engine/escalier.js` : marches **high → nappes en texture → moitié des sièges → chaîne de post basse (= low) → crans de
résolution**, la moins chère à l'œil d'abord, la résolution en dernier. Chaque marche est **réversible en jeu** :
`stadium-night.setBake(on)` (la carte et le bain préparés une fois, spots éteints/rallumés, corps sous l'émissif
calibré et retour), sièges instanciés (compte plein mémorisé), `pipeline.setTier()`, `setPixelRatio` sur les crans.
`?marche=N` force une marche et coupe la boucle ; chaque changement est journalisé avec p50/p95/p99.

Mesuré ici, une variable à la fois, même scène :

| marche | passes | image p50 / p95 / p99 (ms) |
|---|---|---|
| 0 high | bloom gtao traa sharpen | 1 031 / 1 727 / 1 727 |
| 1 − nappes | idem | 1 061 / 1 121 / 1 121 (les nappes ne sont pas le poste du GPU logiciel — c'est ton −217 ms qui compte) |
| 2 − sièges | idem | 860 / 994 / 994 |
| 3 low | fxaa | 9,5 / 608 / 1 811 (la part fixe de la chaîne de post ≈ 1 s ici ; les pointes p95/p99 sont la révision d'ombre à 2 Hz — les à-coups que l'œil juge) |
| 4 résolution | — | inexistante à DPR 1 : ensemble vide, nommé |

## Ce qui n'a pas été touché

Fichiers gelés intacts (movement, gait, locomotion, animkit-data, ball). LOD d'animation intact. Le basket non ouvert.
Une machine correcte (WebGPU, GPU nommé fort, ou signaux absents) part au tier haut avec sa chaîne d'hier — SSR comprise
sur WebGPU — et ne descend que si son propre p95 le demande.

## Définition du fini — état

- Machine correcte : même image, même chaîne (le seul changement sur WebGL2 : une passe qui ne rendait rien). ✓
- Machine faible : une marche de départ choisie sans intervention, puis l'escalier. ✓ (à confirmer sur la Surface Go)
- La boucle descend et le prouve dans un journal ✓ ; la remontée est prouvée au banc, à observer sur la vraie machine.
- Deux nombres par lot : livrés ici sur GPU logiciel, à reprendre sur la machine cible avec l'instrument.
- Le tier bas est-il jouable sur la Surface Go ? **À répondre là-bas.**
