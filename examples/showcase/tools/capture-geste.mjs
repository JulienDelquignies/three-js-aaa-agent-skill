// capture-geste.mjs — LES GESTES EN COURSE FILMÉS sur la page /match11 : l'avance rapide jusqu'au prochain geste PARTI (sauterGeste), le plan
// serré tout de suite, puis image par image (?capture : la page n'avance que quand on le lui demande), 30 images/s, au ralenti `ralenti`.
// La page servie localement : SORTIE=… npx vite build --config vite.gpf-match.config.mjs, puis python3 -m http.server dans le dossier parent.
// Les images → ffmpeg -framerate 30 -i f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 23 -movflags +faststart sortie.mp4
//   node capture-geste.mjs <url> <dossier> [secondes=3] [ralenti=1] [rangs=1 : combien de gestes, filmés l'un après l'autre] [recul=0.3 : s
//   filmées avant la demande] [debut=0 : le numéro de la première image]
// Chaque geste : on avance jusqu'à sa demande (cerveau.geste), on recule de `recul` s… (la page ne recule pas : on filme dès la demande,
// la caméra s'est déjà rapprochée), puis `secondes` s filmées au ralenti `ralenti`.
import { chromium } from '../node_modules/playwright/index.mjs';
const [URL, DOSSIER, SEC = '3', RALENTI = '1', RANGS = '1', DEBUT = '0', QUE = ''] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
pg.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 300)));
await pg.goto(URL, { waitUntil: 'load', timeout: 240000 });
await pg.waitForFunction(() => window.__gpf?.players?.length === 22 && window.__seekFrame, null, { timeout: 240000 });
let image = Number(DEBUT);
for (let r = 0; r < Number(RANGS); r++) {
  // l'avance rapide jusqu'au prochain geste DEMANDÉ et PARTI (QUE : une liste de gestes acceptés, sinon tous)
  const g0 = await pg.evaluate(async (QUE) => {
    const g = window.__gpf, ok = QUE ? QUE.split(',') : null; let i = 0;
    while (g.cerveau.geste && i++ < 200000) g.update(1 / 30);   // le geste filmé avant est fini
    for (;;) {
      g.sauterGeste();
      while (!g.cerveau.geste && i++ < 200000) g.update(1 / 30);
      let G = g.cerveau.geste; if (!G) return null;
      // …et PARTI (le corps l'a lancé) : on attend son départ au pas de 10 ms ; une demande qui tombe, on passe à la suivante
      while (G && !G.parti && i++ < 200000) { g.update(0.01); G = g.cerveau.geste; }
      if (G && (!ok || ok.includes(G.nom))) {
        g.zf = 1; g._faceVu = null;   // le plan serré tout de suite (le travelling depuis la caméra du jeu mangeait le geste au ralenti)
        return { ...G, prof: { poste: g.cerveau.profil(G.porteur)?.poste, archetype: g.cerveau.profil(G.porteur)?.archetype, nature: g.cerveau.profil(G.porteur)?.nature }, t: new Float32Array(g.M.HEAPF32.buffer, g.M._gf_frame(), 1)[0] };
      }
      while (g.cerveau.geste && i++ < 200000) g.update(1 / 30);
    }
  }, QUE);
  console.log('geste', JSON.stringify(g0));
  if (!g0) break;
  const N = Math.round(Number(SEC) * 30);
  for (let f = 0; f < N; f++) {
    const info = await pg.evaluate(async (dt) => { const g = window.__gpf; g.update(dt); await window.__seekFrame(); return { hud: document.getElementById('gpfHud')?.textContent, ge: g.cerveau.geste, der: g.cerveau.gesteDernier }; }, 1 / 30 / Number(RALENTI));
    await pg.screenshot({ path: `${DOSSIER}/f${String(image++).padStart(4, '0')}.png` });
    if (f % 15 === 0) console.log(f, JSON.stringify(info.ge), JSON.stringify(info.der), info.hud?.slice(0, 120));
  }
}
await b.close();
console.log('images', image);
