// vite.gpf-match.config.mjs — LA PAGE /match11 SEULE (gpf-match.html), construite pour le cockpit : servie depuis public/duel-1v1, à côté du
// duel dont elle partage les personnages (rocketbox/, Soldier.glb) ; le moteur WebAssembly et le cerveau empaqueté vivent dans gpf/ (copiés
// depuis gpf-wasm/out/ de la branche feat/l2-cerveau-corps : gpf.mjs, gpf.wasm, gpf.data, cerveau.mjs).
//   npx vite build --config vite.gpf-match.config.mjs          (SORTIE=<dossier> : où écrire ; défaut : ../../../dist-gpf-match, hors dépôt)
// La recette du cockpit : copier gpf-match.html, les scripts d'assets/ qu'elle cite (gpf-match-*, BloomNode-*, gpf-diag-*) et gpf/ dans
// public/duel-1v1/ ; retirer les anciens scripts gpf-match-*/BloomNode-* qu'elle ne cite plus ; puis ./scripts/deploy.sh.
// (un objet simple : la config se lit aussi depuis un dossier sans vite installé)
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const ROOT = dirname(fileURLToPath(import.meta.url));
export default ({
  root: ROOT,
  base: './',
  build: {
    outDir: process.env.SORTIE ?? join(ROOT, '../../../dist-gpf-match'),
    emptyOutDir: true,
    rollupOptions: { input: { 'gpf-match': join(ROOT, 'gpf-match.html') } },
  },
});
