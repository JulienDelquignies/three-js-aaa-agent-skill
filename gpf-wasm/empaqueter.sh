#!/bin/sh
# Empaquette NOTRE CERVEAU (cerveau.mjs + le moteur de match de la skill qu'il importe + contrat.mjs) en un seul module ES,
# sans le module WebAssembly : out/cerveau.mjs, que la page importe à côté de out/gpf.mjs. Garde : le paquet joue le même
# match que les sources, au bit près (bancs/paquet.mjs). Les avertissements « clé en double » viennent des sources de la skill
# (des réglages redéfinis dans un même objet : la dernière valeur gagne, en JavaScript comme dans le paquet).
set -e
cd "$(dirname "$0")"
ESB=../examples/showcase/node_modules/.bin/esbuild
$ESB cerveau.mjs --bundle --minify --format=esm --target=es2022 --legal-comments=none --outfile=out/cerveau.mjs --log-level=error
ls -la out/cerveau.mjs
node bancs/paquet.mjs
