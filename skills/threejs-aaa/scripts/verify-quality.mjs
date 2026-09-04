// LE BANC DE LA QUALITÉ (perf lots 1-3-5 + lot 2) — sans navigateur : la détection choisit la marche de départ, la
// boucle décide au centile, l'escalier nomme ses bords, le pipeline retire SSR au repli et le contrôle ROUGIT sur un
// shader refusé. Chaque garde est cassé une fois ici (sabotages nommés) avant d'être signé.
import { lireMachine, marcheDepart, decider, prochaineMarche, cransDpr } from '../assets/starter/src/engine/quality.js';
import { tierFor, rendererPath, checkRenderPipeline } from '../../../examples/showcase/src/engine/render-pipeline.js';
let pass = 0, fail = 0; const ok = (m, c) => { c ? pass++ : fail++; console.log((c ? '✓ ' : '✗ ') + m); };

// (1) la marche de départ
const go = marcheDepart({ gpu: 'ANGLE (Intel, Intel(R) UHD Graphics 615 Direct3D11 vs_5_0 ps_5_0, D3D11)', cores: 4, mem: 8, largeur: 1200, chemin: 'webgl2' });
const i7 = marcheDepart({ gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)', cores: 12, mem: 8, largeur: 1200, chemin: 'webgl2' });
const tel = marcheDepart({ gpu: 'Apple GPU', cores: 6, mem: null, largeur: 412, chemin: 'webgpu' });
const inconnu = marcheDepart({ gpu: null, cores: null, mem: null, largeur: 1440, chemin: 'webgpu' });
const petit = marcheDepart({ gpu: 'Mesa Intel(R) Xe Graphics (TGL GT2)', cores: 4, mem: 4, largeur: 1200, chemin: 'webgl2' });
const forceQ = marcheDepart({ gpu: 'SwiftShader', cores: 2, mem: 2, largeur: 300, chemin: 'webgl2' }, { q: 'high' });
ok(`lot 1 — LA MARCHE DE DÉPART SE CHOISIT D'APRÈS LA MACHINE (Surface Go, UHD 615 derrière 1 200 px → ${go.tier} ; i7 + RTX → ${i7.tier} ; téléphone 412 px → ${tel.tier} ; signaux absents, 1 440 px → ${inconnu.tier} (le doute va au haut, la mesure tranche) ; 4 cœurs et 4 Go sans GPU nommé → ${petit.tier} ; ?q=high sur SwiftShader → ${forceQ.tier})`,
  go.tier === 'low' && i7.tier === 'high' && tel.tier === 'low' && inconnu.tier === 'high' && petit.tier === 'low' && forceQ.tier === 'high' && /UHD Graphics 615/.test(go.raisons[0]));
const m0 = lireMachine({ renderer: { backend: { gl: { getExtension: () => null, getParameter: () => 'FAUX GPU' } } }, nav: { hardwareConcurrency: 2, deviceMemory: 4 }, win: { innerWidth: 900, devicePixelRatio: 1.5 } });
const m1 = lireMachine({ renderer: { backend: { isWebGPUBackend: true, adapter: { info: { vendor: 'intel', architecture: 'gen-9', device: '', description: '' } } } }, nav: {}, win: {} });
ok(`…et lireMachine lit ce qui existe (webgl2 : ${m0.chemin} / ${m0.gpu} / ${m0.cores} cœurs / ${m0.mem} Go / ${m0.largeur} px ; webgpu : ${m1.chemin} / ${m1.gpu}), null sinon (${m1.cores})`,
  m0.chemin === 'webgl2' && m0.gpu === 'FAUX GPU' && m0.cores === 2 && m0.largeur === 900 && m1.chemin === 'webgpu' && m1.gpu === 'intel gen-9' && m1.cores === null);

// (2) la décision au centile
const lent = Array.from({ length: 100 }, (_, k) => (k % 12 === 0 ? 48 : 16.7));   // p50 16,7, p95 48 (1 à-coup sur 12) : la moyenne dirait 19,3 ms = 52 ips « ok », le centile dit non
const vif = Array(100).fill(15), tiede = Array(100).fill(20);
const d1 = decider(lent, { up: 0 }), d2 = decider(vif, { up: 0 }), d3 = decider(vif, { up: 1 }), d4 = decider(tiede, { up: 1 }), d5 = decider([16, 16, 16], { up: 0 });
ok(`lot 3 — LA BOUCLE DÉCIDE AU CENTILE (à-coups 1 sur 12 à 48 ms : moyenne 19,3 ms mais p95 ${d1.p95} → ${d1.action} ; vif 15 ms, 1re fenêtre → ${d2.action} (up ${d2.up}), 2e → ${d3.action} ; tiède 20 ms → ${d4.action} et le compteur retombe (${d4.up}) ; 3 images → ${d5.action})`,
  d1.action === 'descend' && d1.p95 === 48 && d2.action === 'tient' && d2.up === 1 && d3.action === 'monte' && d4.action === 'tient' && d4.up === 0 && d5.action === 'attend');
const a = prochaineMarche(2, 5, 'descend'), b = prochaineMarche(4, 5, 'descend'), c = prochaineMarche(0, 5, 'monte'), e = prochaineMarche(3, 5, 'monte');
ok(`lot 5 — L'ESCALIER NOMME SES BORDS (2 → ${a.i} ; 4 descend → ${b.i}, ${b.bord} ; 0 monte → ${c.bord} ; 3 monte → ${e.i})`,
  a.i === 3 && !a.bord && b.i === 4 && b.bord === 'plancher' && c.bord === 'plafond' && e.i === 2 && !e.bord);
const r15 = cransDpr(1.5, 1.5, 0.75), r1 = cransDpr(1, 1, 0.75), r2 = cransDpr(2, 1.5, 0.75);
ok(`…et les crans de résolution (DPR 1,5 cap 1,5 plancher 0,75 → [${r15.map((x) => x.toFixed(2))}] ; DPR 1 → [${r1}] VIDE, signalé par l'escalier et non tu ; DPR 2 cap 1,5 → [${r2.map((x) => x.toFixed(2))}])`,
  r15.length === 1 && Math.abs(r15[0] - 0.75) < 1e-9 && r1.length === 0 && r2.length === 1 && Math.abs(r2[0] - 1) < 1e-9);
// le sabotage : un seuil sur la MOYENNE laisserait passer les à-coups — le juge au centile les attrape
const moy = lent.reduce((s, x) => s + x, 0) / lent.length;
ok(`sabotage « la moyenne d'hier » attrapé (moyenne ${moy.toFixed(1)} ms < 22,2 dirait « tient », le centile descend : ${d1.action})`, moy < 1000 / 45 && d1.action === 'descend');

// (3) lot 2 : SSR retirée au repli, le contrôle rougit
const glR = { backend: { gl: {} } }, gpuR = { backend: { isWebGPUBackend: true } };
const tGl = tierFor(glR, 'high'), tGpu = tierFor(gpuR, 'high'), tLow = tierFor(glR, 'low');
ok(`lot 2 — SSR RETIRÉE SUR LE REPLI WEBGL2 (chemin ${rendererPath(glR)} : ssr ${tGl.ssr}, motif « ${tGl.ssrRetire?.slice(0, 22)}… » ; webgpu : ssr ${tGpu.ssr}, inchangé ; low : ${tLow.ssr})`,
  rendererPath(glR) === 'webgl2' && tGl.ssr === false && !!tGl.ssrRetire && rendererPath(gpuR) === 'webgpu' && tGpu.ssr === true && tLow.ssr === false);
const pipeSain = { postProcessing: { outputColorTransform: false }, toneMapping: 4, passes: { gtao: {}, traa: {}, bloom: {}, sharpen: {} }, declared: ['bloom', 'gtao', 'traa', 'sharpen'], tier: 'high', path: 'webgl2' };
const sain = checkRenderPipeline(pipeSain, { samples: 0, userData: { shaderErrors: [] } });
const refuse = checkRenderPipeline(pipeSain, { samples: 0, userData: { shaderErrors: [{ fragment: "fragment : ERROR: 0:248: 'max' : no matching overloaded function found" }] } });
const ssrRepli = checkRenderPipeline({ ...pipeSain, passes: { ...pipeSain.passes, ssr: {} }, declared: [...pipeSain.declared, 'ssr'] }, { samples: 0, userData: { shaderErrors: [] } });
ok(`…et LE CONTRÔLE ROUGIT sur un shader refusé (sain : ${sain.ok} ; programme refusé consigné : ${!refuse.ok} — « ${refuse.issues[0]?.slice(0, 60)}… » ; SSR construite sur le repli : ${!ssrRepli.ok}) — un contrôle qui dit « tout va bien » sur un shader refusé est pire qu'aucun contrôle`,
  sain.ok && !refuse.ok && /max/.test(refuse.issues[0] ?? '') && !ssrRepli.ok);
console.log(`\n${pass} ✓ / ${fail} ✗`); process.exit(fail ? 1 : 0);
