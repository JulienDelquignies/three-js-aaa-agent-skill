// L'ESCALIER DE QUALITÉ (perf lots 3 et 5 — doc quality.js) : les marches réversibles (nappes en texture, moitié des
// sièges, chaîne de post basse, crans de résolution propres), la construction d'après la marche de départ, l'application
// journalisée, et la boucle d'ajustement au centile. Tout prend la scène (sc) en paramètre : Rondo reste une scène.
import { decider, prochaineMarche, cransDpr } from './quality.js';

  /** La moitié des sièges (perf lot 5, marche réversible) : les derniers rangs se vident, un soir de semaine. */
export function setSieges(sc, pleins) {
  sc._stade?.group.traverse((o) => { if (o.isInstancedMesh && o.userData.fullCount) o.count = pleins ? o.userData.fullCount : Math.floor(o.userData.fullCount / 2); });
  }

  /** Les nappes en texture (perf lot 5, marche réversible) : la nuit cuit ses flaques, les corps prennent l'émissif calibré. */
export function setNappes(sc, cuites) {
  if (!sc.night?.setBake) return;
  sc.night.setBake(cuites);
  const roots = new Set(); sc.scene.traverse((o) => { if (o.isSkinnedMesh) { let n = o; while (n.parent && n.parent !== sc.scene) n = n.parent; roots.add(n); } });
    for (const r of roots) sc._bakeCorps(r, cuites);
    if (sc.ball) sc._bakeCorps(sc.ball, cuites);
  }

  // L'ESCALIER (perf lot 5 — mesuré : trois tiers écrits, un seul aiguillage, un facteur 2,2 entre low et high et aucune
  // marche). Les postes mesurés donnent les marches, la moins chère à l'œil d'abord, la résolution en DERNIER (c'est
  // celle qu'on voit le plus sur un écran dense) : high → nappes en texture (−217 ms) → moitié des sièges (−100) →
  // chaîne de post basse (−333 ; = low, 550) → crans de résolution propres (dpr/n) jusqu'au plancher. Descendre vite,
  // remonter lentement (decider). ?marche=N force une marche et coupe la boucle ; ?dynres=0 coupe la boucle seule.
export function construireEscalier(sc, q) {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1, cap = sc._dprCap ?? dpr, plancher = 0.75;
    const marches = [{ nom: 'high' }, { nom: 'high − nappes' }, { nom: 'high − nappes − sièges' }, { nom: 'low (post bas)' }, ...cransDpr(dpr, cap, plancher).map((d) => ({ nom: `low − résolution ${d.toFixed(2)}`, dpr: d }))];
    const force = q.get('marche'); const depart = sc._tier === 'low' ? 3 : 0;
    sc._ladder = { marches, rung: depart, log: [], up: 0, force: force != null };
    sc._drLog = sc._ladder.log;
    if (force != null) appliquerMarche(sc, Math.max(0, Math.min(marches.length - 1, +force)), 'forcée ?marche');
    else if (depart) appliquerMarche(sc, depart, `départ ${sc._tier} : ${sc._depart?.raisons?.join(' ; ')}`);
    else sc._ladder.log.push({ t: 0, de: 0, a: 0, pourquoi: `départ ${sc._tier} : ${sc._depart?.raisons?.join(' ; ')}` });
  }

export function appliquerMarche(sc, i, pourquoi, mesure = null) {
    const L = sc._ladder; if (!L) return; const m = L.marches[i]; if (!m) return;
    const de = L.rung; L.rung = i;
    setNappes(sc, i >= 1 || sc._nappesForcees === true);
    if (!sc._seatsFull) setSieges(sc, i < 2);
    const tier = i >= 3 ? 'low' : 'high'; if (sc.pipeline?.setTier && sc.pipeline.tier !== tier) { sc.pipeline.setTier(tier); sc._pipeCheckAt = 3; }
    if (sc.renderer?.setPixelRatio) sc.renderer.setPixelRatio(m.dpr ?? sc._dprCap ?? sc.renderer.getPixelRatio());
    L.log.push({ t: +(typeof performance !== 'undefined' ? performance.now() / 1000 : 0).toFixed(1), de, a: i, marche: m.nom, pourquoi, ...(mesure ? { p50: +mesure.p50.toFixed(1), p95: +mesure.p95.toFixed(1), p99: +mesure.p99.toFixed(1) } : {}) });
    if (typeof console !== 'undefined') console.info(`qualité : marche ${de} → ${i} (${m.nom}) — ${pourquoi}${mesure ? ` [p50 ${mesure.p50.toFixed(1)} / p95 ${mesure.p95.toFixed(1)} / p99 ${mesure.p99.toFixed(1)} ms]` : ''}`);
  }

// LA BOUCLE D'AJUSTEMENT (perf lot 3 — mesuré : elle mesurait un fps MOYEN sur 2 s, décidait de descendre, calculait
// un cran sous le plancher de son tier et ne faisait rien, sans le dire — sur 12 combinaisons DPR × tier, 4 seulement
// pouvaient descendre). Désormais : un CENTILE (p95 des intervalles) juge la fenêtre de 2 s, la descente est
// immédiate, la remontée après deux fenêtres rapides (l'hystérésis du lot 62), et la marche suivante vient de
// l'ESCALIER (post, nappes, sièges, puis résolution) — au bout, le plancher se SIGNALE dans le journal.
// Une fenêtre gelée (onglet caché, chargement, GC massif) se rejette au lieu de se lire comme de la lenteur.
export function boucleQualite(sc, nowW) {
  if (!sc._ladder || sc._ladder.force) return;
  {
      if (sc._drT0 == null) { sc._drT0 = nowW; sc._drIv = []; sc._drLast = nowW; }
      else {
        sc._drIv.push(nowW - sc._drLast); sc._drLast = nowW;
        if (nowW - sc._drT0 >= 2000) {
          const win = nowW - sc._drT0;
          if (win < 4000) {
            const L = sc._ladder, d = decider(sc._drIv, { up: L.up });
            L.up = d.up;
            if (d.action === 'descend' || d.action === 'monte') {
              const n = prochaineMarche(L.rung, L.marches.length, d.action);
              if (n.bord) { if (L.log[L.log.length - 1]?.bord !== n.bord) { L.log.push({ t: +(nowW / 1000).toFixed(1), de: L.rung, a: L.rung, bord: n.bord, pourquoi: `${d.action} demandé mais ${n.bord} atteint`, p50: +d.p50.toFixed(1), p95: +d.p95.toFixed(1), p99: +d.p99.toFixed(1) }); console.warn(`qualité : ${n.bord} atteint (marche ${L.rung}, p95 ${d.p95.toFixed(1)} ms) — plus rien à lâcher`); } }
              else appliquerMarche(sc, n.i, d.action === 'descend' ? `p95 ${d.p95.toFixed(1)} ms > ${(1000 / 45).toFixed(1)} (45 ips au centile)` : `deux fenêtres rapides (p95 ${d.p95.toFixed(1)} ms < ${(1000 / 55).toFixed(1)})`, d);
            }
          }
          sc._drT0 = nowW; sc._drIv = [];
        }
      }
    }
}
