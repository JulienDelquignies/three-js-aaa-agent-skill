// LA QUALITÉ SE CHOISIT D'APRÈS LA MACHINE, PUIS SE MESURE EN JOUANT (perf lots 1, 3, 5 — campagne de mesure du 11c11 :
// le tier se choisissait sur la largeur CSS de la fenêtre, un test de « téléphone », jamais de « GPU faible » ; une
// Surface Go 1 derrière une fenêtre large prenait le tier haut, 1 200 ms l'image ; le tier bas en vaut 550 et il n'y
// avait AUCUNE marche entre les deux ; la résolution dynamique se taisait quand son ensemble de crans était vide).
// Trois fonctions PURES, testables au banc sans navigateur :
//   lireMachine   — les signaux disponibles (nom du GPU, cœurs, mémoire, largeur, chemin de rendu), rien de plus ;
//   marcheDepart  — la détection ne fait que choisir la MARCHE DE DÉPART : jamais une liste de GPU à maintenir, un
//                   faisceau de signaux faibles (un GPU intégré/logiciel se NOMME, ≤ 4 cœurs ET ≤ 4 Go, une fenêtre
//                   étroite) ; le doute va au tier haut, la mesure des premières secondes tranche ;
//   decider       — la boucle : un CENTILE (p95 des intervalles d'image) sur la fenêtre, jamais une moyenne (le rapport
//                   p99/médiane vaut ~2,1 : les à-coups sont ce que l'œil juge) ; descente immédiate, remontée après
//                   deux fenêtres rapides consécutives (l'hystérésis du lot 62, gardée), et un ensemble de crans VIDE
//                   se SIGNALE — un interrupteur qu'on croit avoir actionné est le pire des défauts.

const GPU_FAIBLE = /SwiftShader|llvmpipe|softpipe|Mesa OffScreen|Intel\(R\) (HD|UHD) Graphics( \d{3})?\b|Intel\(R\) Iris\(R\) Plus|Intel\(R\) Iris\(TM\)|Mali-(4|T|G5)|Adreno \(TM\) [345]\d\d|PowerVR|Apple A(8|9|10)\b|VideoCore/i;

/** Les signaux tels qu'ils existent — null quand la plateforme ne les donne pas. */
export function lireMachine({ renderer = null, nav = typeof navigator !== 'undefined' ? navigator : null, win = typeof window !== 'undefined' ? window : null } = {}) {
  let gpu = null, chemin = 'inconnu';
  const b = renderer?.backend;
  if (b?.isWebGPUBackend) { chemin = 'webgpu'; const info = b.adapter?.info ?? b.device?.adapterInfo ?? null; if (info) gpu = [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(' ') || null; }
  else if (b?.gl) { chemin = 'webgl2'; try { const gl = b.gl, ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch { gpu = null; } }
  return { gpu: gpu ? String(gpu) : null, cores: nav?.hardwareConcurrency ?? null, mem: nav?.deviceMemory ?? null, largeur: win?.innerWidth ?? null, dpr: win?.devicePixelRatio ?? null, chemin };
}

/** La marche de départ : 'low' ou 'high', et les raisons nommées. `q` (?q=) l'emporte toujours. */
export function marcheDepart(m, { q = null, fullMode = true } = {}) {
  if (q === 'low' || q === 'high' || q === 'ultra') return { tier: q, raisons: [`?q=${q}`] };
  const raisons = [];
  if (m.gpu && GPU_FAIBLE.test(m.gpu)) raisons.push(`GPU faible nommé : ${m.gpu.slice(0, 60)}`);
  if (m.cores != null && m.mem != null && m.cores <= 4 && m.mem <= 4) raisons.push(`${m.cores} cœurs et ${m.mem} Go`);
  if (fullMode && m.largeur != null && m.largeur < 700) raisons.push(`fenêtre étroite ${m.largeur} px`);
  return { tier: raisons.length ? 'low' : 'high', raisons: raisons.length ? raisons : ['aucun signal faible : tier haut, la mesure tranche'] };
}

const cent = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * (b.length - 1)))] ?? 0; };

/**
 * La décision d'une fenêtre. intervalles : ms entre images sur la fenêtre. etat.up : fenêtres rapides consécutives.
 * bas : au-dessus, on descend (p95 > 22,2 ms ≡ 45 ips au centile) ; haut : au-dessous deux fois de suite, on monte.
 * @returns {{action:'descend'|'monte'|'tient'|'attend', p50:number, p95:number, p99:number, up:number}}
 */
export function decider(intervalles, etat = { up: 0 }, { bas = 1000 / 45, haut = 1000 / 55, minImages = 8 } = {}) {
  if (!intervalles || intervalles.length < minImages) return { action: 'attend', p50: 0, p95: 0, p99: 0, up: etat.up ?? 0 };
  const p50 = cent(intervalles, 0.5), p95 = cent(intervalles, 0.95), p99 = cent(intervalles, 0.99);
  if (p95 > bas) return { action: 'descend', p50, p95, p99, up: 0 };
  if (p95 < haut) { const up = (etat.up ?? 0) + 1; return up >= 2 ? { action: 'monte', p50, p95, p99, up: 0 } : { action: 'tient', p50, p95, p99, up }; }
  return { action: 'tient', p50, p95, p99, up: 0 };
}

/** La marche suivante dans un escalier de n marches ; au bout, plancher/plafond NOMMÉ (jamais silencieux). */
export function prochaineMarche(i, n, action) {
  if (action === 'descend') return i + 1 < n ? { i: i + 1, bord: null } : { i, bord: 'plancher' };
  if (action === 'monte') return i > 0 ? { i: i - 1, bord: null } : { i, bord: 'plafond' };
  return { i, bord: null };
}

/** L'escalier des crans de résolution propres (dpr/n, lot 73) sous le cap, jusqu'au plancher — vide si rien ne passe. */
export function cransDpr(dpr, cap, plancher) {
  const r = [dpr, dpr / 2, dpr / 3, dpr / 4].filter((x) => x < cap - 1e-3 && x >= plancher - 1e-3);
  return r;
}
