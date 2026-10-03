// essai-l5.mjs — L'ESSAI DU LOT L5 SUR /match11 (le stade, l'habillage, le magnétoscope, les plans) dans un Chromium sans écran : la page tourne
// (pas de ?capture : l'habillage est visible), on la pilote par window.__gpf. Chaque étape → une capture PNG et une ligne de relevé :
// l'horloge, le score, la lecture en cours, le plan, le nombre de programmes de shader (renderer.info.memory.programs — le critère du
// cadrage : < 60) et de pipelines de rendu.
//   node tools/essai-l5.mjs <url de gpf-match.html> <dossier des captures> [étapes=tout]
// La page construite (SORTIE=… npx vite build --config vite.gpf-match.config.mjs) et servie (python3 -m http.server dans SORTIE).
import { chromium } from '../node_modules/playwright/index.mjs';
const [URL, DOSSIER, ETAPES = 'tout'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
// LARGEUR=390 HAUTEUR=844 : l'écran d'un téléphone (l'habillage se replie, la fin d'après-midi par défaut)
const pg = await b.newPage({ viewport: { width: Number(process.env.LARGEUR) || 1280, height: Number(process.env.HAUTEUR) || 720 } });
pg.on('pageerror', (e) => console.log('pageerror', String(e).slice(0, 400)));
pg.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text().slice(0, 300)); });
const t0 = Date.now();
await pg.goto(URL, { waitUntil: 'load', timeout: 300000 });
await pg.waitForFunction(() => window.__gpf?.players?.length === 22 && window.__gpf?.habillage, null, { timeout: 300000 });
// sans transitions : le rendu logiciel ne produit pas d'image entre l'ouverture d'un panneau et la capture (il sortait hors champ)
await pg.addStyleTag({ content: '.gh *, .gh { transition: none !important; }' });
console.log(`chargée en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
const releve = (lib) => pg.evaluate((lib) => {
  const g = window.__gpf, r = g.renderer, a = g.affiche ?? {};
  return { lib, t: Math.round((a.t ?? 0) / 1000), score: a.score, per: a.per, lecture: a.lecture ?? null, plan: g.vue?.plan ?? g.plan, pas: g.pas,
    programmes: r.info?.memory?.programs ?? null, pipelines: r._pipelines?.caches?.size ?? null, api: g.api, stade: g.stade?.nom, places: g.stade?.capacite,
    public: g.stade?.public?.count ?? 0, clips: g.clips.length };
}, lib);
let n = 0;
const photo = async (lib) => { const r = await releve(lib); await pg.screenshot({ path: `${DOSSIER}/${String(n++).padStart(2, '0')}-${lib}.png`, timeout: 240000 }).catch((e) => console.log('capture', String(e).slice(0, 120))); console.log(JSON.stringify(r)); return r; };
// avancer le match de `s` secondes de jeu, par images de 0,1 s (la boucle de la page tourne aussi : on ne fait qu'accélérer)
const avancer = (s) => pg.evaluate((s) => { const g = window.__gpf; for (let i = 0; i < s * 10 && !g.lecture; i++) g.update(0.1); }, s);
const veut = (e) => ETAPES === 'tout' || ETAPES.split(',').includes(e);

await photo('coup-envoi');
if (veut('jeu')) { await avancer(40); await photo('jeu-tele'); }
if (veut('tempsfort')) {
  // le prochain temps fort : l'avance rapide, puis le différé
  const ok = await pg.evaluate(() => { const g = window.__gpf; g.prochainTempsFort(); for (let i = 0; i < 4000 && !g.lecture; i++) g.update(0.05); return !!g.lecture; });
  console.log('temps fort trouvé', ok);
  await pg.evaluate(() => { const g = window.__gpf; for (let i = 0; i < 60; i++) g.update(0.05); });
  await photo('temps-fort-differe');
  await pg.evaluate(() => window.__gpf.passerLecture());
}
if (veut('recul')) { await avancer(20); await pg.evaluate(() => { const g = window.__gpf; g.reculer(10); for (let i = 0; i < 30; i++) g.update(0.05); }); await photo('recul-10s'); await pg.evaluate(() => window.__gpf.passerLecture()); }
if (veut('plans')) {
  for (const p of ['tactique', 'joueur', 'but', 'rapprochee']) { await pg.evaluate((p) => { const g = window.__gpf; g.reglePlan(p); for (let i = 0; i < 25; i++) g.update(0.04); }, p); await photo(`plan-${p}`); }
  await pg.evaluate(() => window.__gpf.reglePlan('auto'));
}
if (veut('but')) {
  // un but : on avance (×8 de jeu par image) jusqu'au ralenti, puis on le regarde
  const r = await pg.evaluate(() => { const g = window.__gpf; g.regle('ralentis', true); const s0 = g._score[0] + g._score[1]; let i = 0;
    g.vitesse = 8;   // 0,8 s de jeu par image de 0,1 s
    for (; i < 20000 && !(g.lecture && g.lecture.segs[0].badge === 'Ralenti'); i++) g.update(0.1);
    g.vitesse = 1; return { trouve: !!g.lecture, i, buts: g._score[0] + g._score[1] - s0 }; });
  console.log('but', JSON.stringify(r));
  if (r.trouve) {
    await pg.evaluate(() => { const g = window.__gpf; for (let i = 0; i < 70; i++) g.update(0.05); });
    await photo('ralenti-derriere-le-but');
    await pg.evaluate(() => { const g = window.__gpf; while (g.lecture && g.lecture.k === 0) g.update(0.05); for (let i = 0; i < 50; i++) g.update(0.05); });
    await photo('ralenti-ras-pelouse');
    await pg.evaluate(() => window.__gpf.passerLecture());
  }
}
if (veut('stats')) {
  await pg.evaluate(() => { const g = window.__gpf; g.habillage.ouvrir('stats'); g.update(0.02); });
  await pg.waitForTimeout(1500);   // la transition du panneau (0,3 s) : sans attendre, la capture le prend hors champ
  await photo('stats-match');
  await pg.evaluate(() => { const g = window.__gpf; g.habillage.onglet = 'joueurs'; g.habillage._rendreStats(true); });
  await photo('stats-joueurs');
  await pg.evaluate(() => { const g = window.__gpf; g.habillage.onglet = 'moments'; g.habillage._rendreStats(true); });
  await photo('stats-moments');
  await pg.evaluate(() => window.__gpf.habillage.fermer());
}
if (veut('maillots')) {
  // les maillots : quatre paires de tenues, de près (plan rapproché) et de dos (plan joueur)
  for (const [a, b2] of [['raye-noir-blanc', 'bleu-ciel'], ['rouge-blanc-raye', 'vert-blanc-cercle'], ['grenat-bleu-moities', 'blanc-a-echarpe-rouge'], ['noir-or', 'blanc-a-bande-rouge']]) {
    await pg.evaluate(([a, b2]) => { const g = window.__gpf; g.regleTenue(0, { ...g.catalogue[a], id: a }); g.regleTenue(1, { ...g.catalogue[b2], id: b2 }); g.reglePlan('rapprochee'); for (let i = 0; i < 30; i++) g.update(0.05); }, [a, b2]);
    await photo(`maillots-${a}-${b2}`);
    await pg.evaluate(() => { const g = window.__gpf; g.reglePlan('joueur'); for (let i = 0; i < 30; i++) g.update(0.05); });
    await photo(`maillots-dos-${a}`);
  }
  await pg.evaluate(() => window.__gpf.reglePlan('auto'));
}
if (veut('dos')) {
  // le flocage de près (l'adresse doit porter &orbit : la caméra est posée à la main) — au coup d'envoi, les joueurs de gauche regardent +x :
  // la caméra 2,6 m derrière eux (−x), à hauteur d'épaule ; ceux de droite, de l'autre côté
  for (const k of [6, 8, 17, 0]) {
    await pg.evaluate((k) => {
      const g = window.__gpf, m = g.players[k].model, sg = g.players[k].team === 0 ? -1 : 1, c = g.camRef, o = g.controls;
      c.fov = 32; c.updateProjectionMatrix(); c.position.set(m.position.x + sg * 2.6, 1.45, m.position.z + 0.4); o.target.set(m.position.x, 1.15, m.position.z); o.update();
    }, k);
    await photo(`dos-${k}`);
  }
}
if (veut('reglages')) {
  await pg.evaluate(() => { const g = window.__gpf; g.habillage.ouvrir('reglages'); g.update(0.02); });
  await pg.evaluate(() => { const c = document.querySelector('.gh-corps'); if (c) c.scrollTop = c.scrollHeight; });
  await photo('reglages-maillots');
  await pg.evaluate(() => window.__gpf.habillage.fermer());
}
if (veut('heures')) {
  for (const h of ['jour', 'soir']) { await pg.evaluate((h) => { const g = window.__gpf; g.regle('heure', h); for (let i = 0; i < 10; i++) g.update(0.05); }, h); await photo(`heure-${h}`); }
  await pg.evaluate(() => window.__gpf.regle('heure', 'nuit'));
}
if (veut('stades')) {
  for (const s of ['arche', 'nervures', '2']) { await pg.evaluate((s) => { const g = window.__gpf; g.regle('stade', s); for (let i = 0; i < 10; i++) g.update(0.05); }, s); await photo(`stade-${s}`); }
}
await b.close();
console.log(`fini en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
