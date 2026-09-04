# perf — l'instrument avant/après du 11 contre 11

Deux scripts Playwright (dépendance déjà dans le projet) ; un serveur de build sert la page :

```
npx vite build && npx vite preview --port 4173
node perf/mesure.mjs "http://127.0.0.1:4173/match11.html?match&full" 1.5 1200 800 10
node perf/sonde.mjs  "http://127.0.0.1:4173/match11.html?match&full&probe=1" 1.5 1200 800
```

`mesure.mjs <url> [dpr] [largeur] [hauteur] [secondes]` — attend le chargement, jette 3 s, puis lit N secondes : intervalles
d'image (rAF, mur) et le journal moteur `window.__engine.perf` (ms de logique de jeu / ms de rendu, séparés — le
compteur stats-gl ne voit que le rendu). Sortie : p50 / p95 / p99, jamais de moyenne ; le chemin réel (WebGPU ou repli
WebGL2), le tier, la marche de l'escalier, les passes déclarées, les shaders refusés, le verdict de checkRenderPipeline,
et le journal de la boucle d'ajustement (`__scene._ladder.log`).

`sonde.mjs` — la sonde embarquée `?probe=1` (quatre configurations de 4 s), verdict en fps.

Drapeaux du navigateur : `--disable-gpu-vsync --disable-frame-rate-limit` (sans eux, un Chromium headless sous
SwiftShader swappe à 1 image/s et l'instrument est démenti). `HEADFUL=1` ouvre une fenêtre ; `CHROME=/chemin` choisit le
binaire. Sur la machine cible, lancer les trois URL du brief AVEC un vrai GPU : les chiffres d'un GPU logiciel ne se
publient pas (ils servent au relatif et aux contrats binaires : shader refusé, passes, journal).

Paramètres d'URL de la qualité : `?q=low|high|ultra` (force le tier de départ), `?marche=N` (force une marche de
l'escalier et coupe la boucle), `?dynres=0` (coupe la boucle seule), `?ssr=force` (sabotage : laisse SSR sur le repli
WebGL2 pour voir le contrôle rougir), `?fps` (crée et affiche le compteur — sans lui, aucun compteur ne tourne).
