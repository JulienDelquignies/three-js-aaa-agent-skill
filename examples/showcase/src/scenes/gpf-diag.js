// gpf-diag.js — LE DIAGNOSTIC DE PERFORMANCE de la page L0 (?diag). La même partie (graine 7, coup d'envoi) est rejouée dans huit
// réglages, une page par réglage : chacun passe par son vrai chemin de démarrage (ombres, bloom, densité de pixels, API, carte).
// 3 s pour se poser (compilation des shaders), puis 5 s mesurées : images par seconde, calcul par image (simulation, poses,
// soumission du rendu), simulation par pas, poses par image. Le tableau final se copie d'un clic. Avec la carte graphique
// réellement utilisée, il dit ce qui limite : la carte (remplissage, ombres, bloom) ou le calcul.
const PHASES = [
  ['tel quel', ''],
  ['sans ombres', 'ombres=0'],
  ['sans bloom', 'bloom=0'],
  ['sans ombres ni bloom', 'ombres=0&bloom=0'],
  ['sans ombres ni bloom, densité 1', 'ombres=0&bloom=0&dpr=1'],
  ['sans ombres ni bloom, densité 0,5', 'ombres=0&bloom=0&dpr=0.5'],
  ['tel quel, carte la plus puissante', 'gpu=perf'],
  ['tel quel, WebGL 2', 'webgl'],
];
const KEY = 'gpf-diag-v1', SETTLE = 3000, MESURE = 5000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (i) => [i.vendor, i.architecture, i.device, i.description].filter(Boolean).join(' · ') || '(nom non exposé)';

export async function runDiag(scene) {
  const q = new URLSearchParams(location.search), k = Math.max(0, Math.min(PHASES.length - 1, Number(q.get('diag')) || 0));
  let D = { phases: [] };
  if (k > 0) { try { D = JSON.parse(sessionStorage.getItem(KEY)) || D; } catch { /* stockage indisponible : on mesure quand même */ } }
  const box = panel();
  box.textContent = `Diagnostic ${k + 1}/${PHASES.length} — ${PHASES[k][0]}…\nGarde l'onglet visible : environ ${Math.ceil(PHASES.length * 11 / 60)} min en tout.`;
  // se poser : 3 s d'horloge (les shaders se compilent) ET 3 s de jeu (avant le coup d'envoi, les joueurs attendent et un pas
  // de simulation coûte dix fois moins : mesurer là mentirait)
  await sleep(SETTLE);
  while ((scene.stats?.tMs ?? 0) < 3000) await sleep(200);
  const r = scene.renderer, t = scene.tot, a = { ...t, t0: performance.now() };
  await sleep(MESURE);
  const dt = (performance.now() - a.t0) / 1000, n = Math.max(1, t.frames - a.frames), cv = r.domElement;
  D.phases[k] = {
    label: PHASES[k][0], api: scene.api, px: `${cv.width}×${cv.height}`, gpu: gpuName(r),
    fps: (t.frames - a.frames) / dt, cpu: (t.cpuMs - a.cpuMs) / n,
    sim: (t.simMs - a.simMs) / Math.max(1, t.simSteps - a.simSteps), pose: (t.poseMs - a.poseMs) / n,
  };
  if (k === 0) D.env = await env(r, scene.scene);
  try { sessionStorage.setItem(KEY, JSON.stringify(D)); } catch { /* idem */ }
  if (k + 1 < PHASES.length) {
    const u = new URL(location.href), seed = q.get('seed');
    u.search = `?diag=${k + 1}` + (PHASES[k + 1][1] ? '&' + PHASES[k + 1][1] : '') + (seed ? `&seed=${seed}` : '');
    location.replace(u.href);
    return;
  }
  report(box, D);
}

// la carte qui dessine : le nom que l'API expose (WebGPU : adapterInfo du périphérique ; WebGL : le moteur de rendu démasqué)
function gpuName(r) {
  const b = r.backend;
  try {
    if (b?.isWebGPUBackend) { const i = b.device?.adapterInfo; return i ? fmt(i) : '(nom non exposé)'; }
    const gl = b?.gl; if (!gl) return '?';
    const e = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
  } catch (e) { return `erreur : ${e.message}`; }
}

// la machine : navigateur, cœurs, écran, les cartes que WebGPU propose selon la préférence, la taille de la scène
async function env(r, scene) {
  const out = { ua: navigator.userAgent, coeurs: navigator.hardwareConcurrency, ecran: `${innerWidth}×${innerHeight} (densité ${devicePixelRatio})` };
  if (navigator.gpu) {
    for (const pp of ['high-performance', 'low-power']) {
      try { const a = await navigator.gpu.requestAdapter({ powerPreference: pp }); out[pp] = a?.info ? fmt(a.info) : '(aucune)'; }
      catch { out[pp] = '(erreur)'; }
    }
  }
  let objets = 0, corps = 0;
  scene.traverse((o) => { if (o.isMesh && o.visible) { objets += Array.isArray(o.material) ? o.material.length : 1; if (o.isSkinnedMesh) corps++; } });
  Object.assign(out, { objets, corps });
  return out;
}

function panel() {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', zIndex: 40, maxWidth: '94vw', maxHeight: '82vh',
    overflow: 'auto', padding: '14px 16px', borderRadius: '12px', background: 'rgba(10,12,18,.93)', border: '1px solid rgba(255,255,255,.15)',
    color: '#e8ebf2', font: '12px/1.45 ui-monospace,Menlo,Consolas,monospace', whiteSpace: 'pre',
  });
  document.body.appendChild(el);
  return el;
}

function report(box, D) {
  const E = D.env || {}, P = D.phases.filter(Boolean), pad = (s, n) => String(s).padEnd(n), num = (x, d) => (x ?? 0).toFixed(d).padStart(8);
  const L = [
    `Diagnostic du match GPF — ${new Date().toLocaleString('fr-FR')}`,
    `Navigateur : ${E.ua}`,
    `Processeur : ${E.coeurs} cœurs logiques · écran ${E.ecran}`,
    `Carte utilisée : ${P[0]?.api} — ${P[0]?.gpu}`,
    `Cartes proposées par WebGPU : « perf » ${E['high-performance'] ?? '—'} ; « éco » ${E['low-power'] ?? '—'}`,
    `Carte en WebGL 2 : ${P.find((p) => p.api === 'WebGL 2')?.gpu ?? '—'}`,
    `Scène : ${E.objets} objets dessinés, dont ${E.corps} maillages animés`,
    '',
    `${pad('réglage', 36)}images/s  calcul/img  simu/pas  poses/img  pixels`,
    ...P.map((p) => `${pad(p.label, 36)}${num(p.fps, 1)}${num(p.cpu, 2)} ms${num(p.sim, 2)} ms${num(p.pose, 2)} ms  ${p.px} ${p.api}`),
  ];
  const text = L.join('\n');
  box.textContent = text + '\n\n';
  const copy = document.createElement('button'), again = document.createElement('a');
  copy.textContent = 'Copier le diagnostic'; again.textContent = 'Relancer'; again.href = '?diag';
  for (const b of [copy, again]) Object.assign(b.style, { font: '600 13px system-ui', marginRight: '12px', padding: '6px 12px', borderRadius: '8px', border: '0', background: '#3b82f6', color: '#fff', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' });
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(text); copy.textContent = 'Copié ✓'; }
    catch { const s = getSelection(), rg = document.createRange(); rg.selectNodeContents(box.firstChild); s.removeAllRanges(); s.addRange(rg); copy.textContent = 'Sélectionné : Ctrl+C'; }
  };
  box.append(copy, again);
  try { sessionStorage.removeItem(KEY); } catch { /* idem */ }
  window.__gpfDiag = D;
}
