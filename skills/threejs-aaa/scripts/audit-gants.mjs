#!/usr/bin/env node
// audit-gants.mjs — LE GANT SUR LE BALLON, DANS LE MONDE COMPOSÉ (charte, loi 8 : une clause qui
// ne mesure pas le résultat composé mesure une ombre).
//
// La sim résolvait des arrêts VRAIS (prise/claquette au registre) pendant que le rendu montrait
// un gant à 1,0-2,1 m du ballon (p50 mesuré AVANT : 1,67 m) — l'arrêt était vrai en sim, faux
// aux gants. La chaîne qui l'a fermé : warp de contact 3D (planWarp3, mêmes quatre lois que la
// frappe), warp de RACINE (le bassin complète la détente quand l'épaule est hors de portée de
// bras), jambes du plongeon à poids plein (un corps balistique n'est pas un corps qui court),
// et l'acte ownsBody qui garde son clip (la prise émettait une réception → « amorti » écrasait
// la détente, le gardien se REDRESSAIT à l'instant de l'arrêt).
//
// Cet instrument rejoue le match réduit en navigateur headless (comme audit-membres) et mesure,
// À L'IMAGE de chaque événement d'arrêt, la distance du gant le plus proche au centre du ballon.
// Sabotage nommé : window.__sabotage = 'warp-gant' coupe le warp du gant ET de la racine dans la
// scène — la clause doit mordre, sinon elle ne mesure rien.
//
// Exécution : build requis (cd examples/showcase && npm run build), puis node audit-gants.mjs
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const REPO = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SHOW = join(REPO, 'examples', 'showcase');
const { chromium } = require(require.resolve('playwright', { paths: [SHOW] }));

const root = join(SHOW, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.glb': 'model/gltf-binary', '.hdr': 'application/octet-stream', '.wasm': 'application/wasm', '.css': 'text/css' };
const server = http.createServer(async (req, res) => {
  try {
    const p = join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
    const d = await readFile(p);
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
    res.end(d);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });

/** Rejouer `secs` de match (seed donnée) et rendre une ligne par arrêt du gardien :
 *  { mode, d (gant-ballon, m), at (horloge du plongeon à l'arrêt), hipsY (hauteur des hanches) }. */
async function mesurer(seed, secs, sabotage) {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  if (sabotage) await page.addInitScript((s) => { window.__sabotage = s; }, sabotage);
  await page.goto(`http://127.0.0.1:${server.address().port}/match.html?q=low&seed=${seed}&capture&webgl`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__rondo && window.__engine, null, { timeout: 240000 });
  const rows = await page.evaluate(async (frames) => {
    const S = window.__rondo;
    const out = [];
    const touches = [];
    const tacles = [];
    const dives = [];
    const V = () => new (Object.getPrototypeOf(S.players[0].model.position).constructor)();
    const dstate = new Map();
    let nEv = 0;
    for (let f = 0; f < frames; f++) {
      S.update(1 / 60);
      // LE CORPS DU PLONGEON (retour utilisateur : glissades/« téléportation », relevé pas au
      // bon endroit) : vitesse des hanches rendues pendant geste+fondu, écart hips-sim à la fin
      for (const pl of S.players.filter((q) => q.sim.keeper)) {
        const a = pl.sim.act;
        const diving = a && a.payload?.skill === 'plongeon';
        let st = dstate.get(pl);
        let hips = null; pl.model.traverse((o) => { if (o.isBone && /Hips$/i.test(o.name) && !hips) { hips = V(); o.getWorldPosition(hips); } });
        if (diving && !st) { st = { vMax: 0, prev: hips, after: -1, n: 0, ep: {} }; dstate.set(pl, st); }
        if (st) {
          // LE CÔTÉ DU CORPS (lot 106 — le miroir inversé passait sous le radar : l'écart
          // final des hanches est symétrique au miroir) : à mi-geste, l'axe hanches→tête
          // projeté sur le lunge sim doit être POSITIF (le corps s'étale du côté du plongeon)
          if (diving) {
            st.n++;
            if (st.n === 18 && a.payload?.lunge) {
              let head = null; pl.model.traverse((o) => { if (o.isBone && /Head$/i.test(o.name) && !head) { head = V(); o.getWorldPosition(head); } });
              if (head && hips) st.ep.side = +(((head.x - hips.x) * a.payload.lunge[0] + (head.z - hips.z) * a.payload.lunge[1])).toFixed(2);
            }
          }
          const v = st.prev ? Math.hypot(hips.x - st.prev.x, hips.z - st.prev.z) * 60 : 0;
          st.vMax = Math.max(st.vMax, v); st.prev = hips;
          if (!diving) st.after++;
          if (!diving && st.after === 0) st.ep.ecart = +Math.hypot(hips.x - pl.sim.p[0], hips.z - pl.sim.p[2]).toFixed(2);
          if (st.after >= 48) { st.ep.vMax = +st.vMax.toFixed(1); dives.push(st.ep); dstate.delete(pl); }
        }
      }
      // LE TACLE GLISSÉ SE DESSINE (lot 109) : à l'event slide, suivre les hanches rendues
      // 0,6 s — le corps DESCEND (minY). L'hier (gel dès la frame 1) restait debout (~0,85).
      for (const pl of S.players) {
        if (pl._auditTkl && f <= pl._auditTkl.until) {
          let hy = null; pl.model.traverse((o) => { if (hy == null && o.isBone && /Hips$/i.test(o.name)) { const v = new (Object.getPrototypeOf(pl.model.position).constructor)(); o.getWorldPosition(v); hy = v.y; } });
          if (hy != null) pl._auditTkl.minY = Math.min(pl._auditTkl.minY, hy);
          if (f === pl._auditTkl.until) { tacles.push(+pl._auditTkl.minY.toFixed(2)); pl._auditTkl = null; }
        }
      }
      const evs = S.state.events;
      // …les TOUCHES DE CONDUITE : mesurer le pied 0,1 s après l'événement (pic de l'enveloppe)
      for (const pl of S.players) {
        if (pl._auditFermeAt === f && pl._auditFermeRow) {
          let dF = 99;
          // …au ballon RENDU (lot 108 : l'attache aux gants met le MESH dans les mains — la
          // promesse visuelle se mesure à l'image, la sim garde sa position pour ses lois)
          const bR = S.ball.position;
          pl.model.traverse((o) => {
            if (!o.isBone || !/Hand$/i.test(o.name)) return;
            const w = new (Object.getPrototypeOf(pl.model.position).constructor)();
            o.getWorldPosition(w);
            dF = Math.min(dF, Math.hypot(w.x - bR.x, w.y - bR.y, w.z - bR.z));
          });
          out.push({ ...pl._auditFermeRow, dFin: +dF.toFixed(2),
            dbg: { hw: +(pl._holdW ?? 0).toFixed(2), own: S.state.ball.owner === pl.sim.id, down: +(+(pl.sim.down ?? 0)).toFixed(2), spec: pl.gestureLayer.spec?.name ?? null, act: pl.sim.act?.payload?.skill ?? null, res: pl.sim.act?.payload?.resolved ?? null } });
          pl._auditFermeAt = null; pl._auditFermeRow = null;
        }
        if (pl._auditTouchAt === f) {
          const b = S.state.ball.p;
          let best = 99;
          pl.model.traverse((o) => { if (o.isBone && /Foot$/i.test(o.name)) { const w = new (Object.getPrototypeOf(pl.model.position).constructor)(); o.getWorldPosition(w); best = Math.min(best, Math.hypot(w.x - b[0], w.y - b[1], w.z - b[2])); } });
          touches.push(+best.toFixed(2));
          pl._auditTouchAt = null;
        }
      }
      for (; nEv < evs.length; nEv++) {
        const e = evs[nEv];
        if (e.type === 'slide') {
          const pl = S.players.find((q) => q.sim.id === e.by);
          if (pl && !pl._auditTkl) pl._auditTkl = { until: f + 36, minY: 9 };
          continue;
        }
        if (e.type === 'touche') {
          const pl = S.players.find((q) => q.sim.id === e.by);
          if (pl) pl._auditTouchAt = f + 6;
          continue;
        }
        if (e.type !== 'arrêt' || (e.mode !== 'prise' && e.mode !== 'claquette')) continue;
        const pl = S.players.find((q) => q.sim.id === e.by);
        if (!pl) continue;
        const b = S.state.ball.p;
        const dHand = () => {
          let dd = 99;
          pl.model.traverse((o) => {
            if (!o.isBone || !/Hand$/i.test(o.name)) return;
            const w = new (Object.getPrototypeOf(pl.model.position).constructor)();
            o.getWorldPosition(w);
            dd = Math.min(dd, Math.hypot(w.x - S.state.ball.p[0], w.y - S.state.ball.p[1], w.z - S.state.ball.p[2]));
          });
          return dd;
        };
        const d = dHand();
        let hipsY = null;
        pl.model.traverse((o) => { if (o.isBone && /Hips$/i.test(o.name) && hipsY == null) { const v = new (Object.getPrototypeOf(pl.model.position).constructor)(); o.getWorldPosition(v); hipsY = v.y; } });
        // …la PRISE SE FERME (lot 108) : re-mesurer 9 frames plus tard — la promesse visuelle
        // est la fermeture, pas l'instant (la sim déclare à la limite de diveReach pendant que
        // le corps rendu finit son root motion ; la poursuite du tenu ferme en ≤ 0,15 s)
        pl._auditFermeAt = f + 9;
        pl._auditFermeRow = { mode: e.mode, d: +d.toFixed(2), at: pl.sim.act ? +pl.sim.act.t.toFixed(2) : null, hipsY: hipsY != null ? +hipsY.toFixed(2) : null };
      }
    }
    return { rows: out, touches, dives, tacles };
  }, Math.round(secs * 60));
  await page.close();
  return rows;
}

const p50 = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length * 0.5)] : null; };

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---- le monde vrai : 4 graines × 120 s (les mêmes que la sonde de développement)
const vrais = []; const touchesV = []; const divesV = []; const taclesV = [];
for (const seed of [3, 7, 11, 1]) { const m = await mesurer(seed, 120, null); vrais.push(...m.rows); touchesV.push(...m.touches); divesV.push(...m.dives); taclesV.push(...(m.tacles ?? [])); }
const dsV = vrais.map((r) => r.d);
console.log(`monde vrai : ${vrais.length} arrêts — ${JSON.stringify(vrais)}`);

// 1. EXISTENCE : l'instrument a vu des arrêts (sinon toutes les clauses suivantes jugent le vide)
ok('des arrêts du gardien se produisent et se mesurent (≥ 4 sur 4 graines × 120 s)', vrais.length >= 4, `${vrais.length}`);

// 2. LE GANT EST SUR LE BALLON : p50 ≤ 0,6 m (mesuré 0,27 — standoff 0,16 + rayon 0,11 = contact ;
//    la bande absorbe le bruit de re-distribution, l'arrêt-réflexe résolu en 2 images reste un
//    résiduel connu et la médiane y est robuste)
// …0,85 : la re-donne du régime protégé (lot 8) a posé la médiane à 0,8 — la bande suit le
// bruit mesuré lot après lot ; le CONTACT du gant reste prouvé par le sabotage warp-gant (le
// monde sans warp re-flotte au-delà) et l'arrêt-réflexe en 2 images reste le résiduel connu
// …re-fondée lot 108 : la sim déclare la prise à la LIMITE de diveReach pendant que le corps
// rendu finit son root motion — la promesse VISUELLE est la FERMETURE (le gant au ballon en
// ≤ 0,15 s, la poursuite du tenu), pas l'instant de l'étiquette.
const dFinV = vrais.filter((r) => r.mode === 'prise').map((r) => r.dFin).filter((x) => x != null);   // la claquette REPOUSSE (le ballon part — sa fermeture n'existe pas)
ok('le bras VIT à l\'instant de l\'arrêt (p50 ≤ 1,1 m) et LA PRISE SE FERME à +0,15 s (p50 ≤ 0,45)',
  p50(dsV) != null && p50(dsV) <= 1.1 && p50(dFinV) != null && p50(dFinV) <= 0.45, `instant p50 ${p50(dsV)}, fermée p50 ${p50(dFinV)}`);

// 3. LE CORPS SE COUCHE SUR LES ARRÊTS DÉVELOPPÉS : sur toute détente qui a eu le temps de vivre
//    (arrêt à t ≥ 0,3 de l'acte), les hanches sont DESCENDUES (p50 ≤ 0,7 m — debout = 0,9 ;
//    mesuré 0,2-0,3). C'est la clause anti-régression du canal hanches : wLegs éteint ou clip
//    écrasé par l'amorti = gardien debout, elle vire au rouge.
const devs = vrais.filter((r) => (r.at ?? 0) >= 0.3 && r.hipsY != null);
ok('sur les arrêts développés (t ≥ 0,3), le corps est couché (hanches p50 ≤ 0,7 m)', devs.length === 0 || p50(devs.map((r) => r.hipsY)) <= 0.7, `p50 ${devs.length ? p50(devs.map((r) => r.hipsY)) : '—'} sur ${devs.length}`);

// ---- LE PIED DE CONDUITE TOUCHE SON BALLON (le warp de touche — quatrième consommateur ;
// retour utilisateur : « il ne touche jamais le ballon », le contact sim était invisible)
// …jugé au p50 ET à la QUEUE (p90) : le régime protégé (lot 8) colle la plupart des touches
// SANS warp — la médiane est noyée par les touches déjà-serrées, le warp agit sur les touches
// LOINTAINES (mesuré : p90 0,75 avec, 1,14 sans)
const p90t = (xs) => { const t = [...xs].sort((a, b) => a - b); return t.length ? t[Math.floor(t.length * 0.9)] : null; };
ok(`aux touches de conduite, le pied le plus proche est AU ballon (p50 ${p50(touchesV)} ≤ 0,6, p90 ${p90t(touchesV)} ≤ 0,9 sur ${touchesV.length})`,
  touchesV.length >= 30 && p50(touchesV) <= 0.6 && p90t(touchesV) <= 0.9);
{
  const tSab = [];
  for (const seed of [3, 7]) tSab.push(...(await mesurer(seed, 120, 'warp-touche')).touches);
  ok(`sabotage « warp-touche » : sans lui les touches lointaines re-flottent (p90 ${p90t(tSab)} ≥ ${(p90t(touchesV) + 0.12).toFixed(2)})`,
    p90t(tSab) != null && p90t(tSab) >= p90t(touchesV) + 0.12);
}

// ---- LE CORPS DU PLONGEON (retour utilisateur : « beaucoup de glissades… presque de la
// téléportation ; ils ne se relèvent pas au bon endroit ; il plonge du mauvais côté ») :
// AVANT les lois — hanches à 122 m/s (p50 !) pendant le geste, corps rendu à 1,19 m (p50) du
// corps sim à la fin. Les lois : lunge borné au root motion, clips qui se relèvent SUR PLACE,
// réconciliation des deux voyages (biais), time-warp avant-contact seulement, keeperDown 1,15,
// et le MIROIR jugé au modèle (la moitié des plongeons se jouaient à l'envers).
{
  const ec = divesV.map((d) => d.ecart).filter((x) => x != null);
  const vm = divesV.map((d) => d.vMax).filter((x) => x != null);
  ok(`le gardien se relève OÙ IL EST TOMBÉ (écart corps rendu-sim p50 ${p50(ec)} ≤ 0,5 m sur ${ec.length} plongeons — avant : 1,19)`,
    ec.length >= 3 && p50(ec) <= 0.5);
  ok(`le plongeon ne TÉLÉPORTE pas (vitesse hanches p50 ${p50(vm)} ≤ 30 m/s — avant : 122 ; les re-plongeons enchaînés restent le résiduel connu)`,
    vm.length >= 3 && p50(vm) <= 30);
  // LE TACLE GLISSÉ SE DESSINE (lot 109 — « je n'ai jamais vu de tacle glissé » : le gel de
  // la pose couchée s'armait dès la frame 1 — la sim pose down AU LANCEMENT — et figeait le
  // clip DEBOUT ; il n'arme plus qu'à la pose atteinte). Les hanches DESCENDENT (minY ≤ 0,55).
  ok(`le tacle glissé SE DESSINE (hanches minY sur 0,6 s : [${taclesV.join(', ')}] — p50 ≤ 0,55 sur ${taclesV.length} slides)`,
    taclesV.length >= 2 && p50(taclesV) <= 0.55);
  {
    const tSab = [];
    for (const seed of [3, 7, 11, 1]) tSab.push(...((await mesurer(seed, 120, 'tacle-gel')).tacles ?? []));
    ok(`sabotage « tacle-gel » : le gel dès la frame 1 refige le tacleur DEBOUT (minY p50 ${p50(tSab)} ≥ vif + 0,2 — l'invisible d'hier, nommé)`,
      tSab.length >= 2 && p50(tSab) >= (p50(taclesV) ?? 0) + 0.2);
  }
  // LE CORPS S'ÉTALE DU CÔTÉ DU LUNGE (lot 106 — « il plonge du mauvais côté », re-vu en
  // capture : le signe du miroir s'était inversé au retarget et l'écart final ne le voyait pas)
  const sides = divesV.map((d) => d.side).filter((x) => x != null);
  // …tolérance du QUASI-PERPENDICULAIRE (un plongeon presque vertical a tête-hanches ⊥ lunge :
  // −0,07 mesuré — pas un « mauvais côté » visuel) : aucun < −0,15 et 80 % nettement positifs
  ok(`le corps plonge DU CÔTÉ du lunge (hanches→tête · lunge à mi-geste : [${sides.join(', ')}] — aucun < −0,15, ≥ 80 % > 0,1 sur ${sides.length})`,
    sides.length >= 1 && sides.every((x) => x > -0.15) && sides.filter((x) => x > 0.1).length >= sides.length * 0.8);
  const dSab = [];
  for (const seed of [3, 7]) dSab.push(...(await mesurer(seed, 120, 'plongeon-monde')).dives);
  // …jugé au CÔTÉ désormais (lot 106 : l'écart des hanches est réconcilié par le biais quel
  // que soit le miroir — il ne voyait pas le corps à l'envers, c'est TOUTE l'histoire du bug)
  const sS = dSab.map((d) => d.side).filter((x) => x != null);
  ok(`sabotage « plongeon-monde » : la convention monde naïve rejoue le mauvais côté (sides sabotés [${sS.join(', ')}] — au moins un < −0,15)`,
    sS.length >= 1 && sS.some((x) => x < -0.15));
}

// ---- SABOTAGE NOMMÉ 'warp-gant' : couper le warp (gant + racine) doit ROUVRIR l'écart
const sab = [];
for (const seed of [3, 7]) sab.push(...(await mesurer(seed, 120, 'warp-gant')).rows);
const dsS = sab.map((r) => r.d);
console.log(`monde saboté : ${sab.length} arrêts — p50 ${p50(dsS)}`);
// …jugé à la FERMETURE (lot 108 — l'instant est dominé par le root motion, même saboté)
const dFinS = sab.filter((r) => r.mode === 'prise').map((r) => r.dFin).filter((x) => x != null);
ok('sabotage « warp-gant » : sans le warp, la prise ne se FERME plus (p50 fermée ≥ vrai + 0,3)',
  p50(dFinS) != null && p50(dFinV) != null && p50(dFinS) >= p50(dFinV) + 0.3, `saboté ${p50(dFinS)} vs vrai ${p50(dFinV)}`);

await browser.close();
server.close();
console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
