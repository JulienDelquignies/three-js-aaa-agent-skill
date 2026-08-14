#!/usr/bin/env node
// verify-matchday.mjs — the three modules that DRESS the possession game, proved headless:
//   engine/kit.js            le maillot/short/chaussettes générés sur le rig (géométrie + skin + coupe)
//   engine/stadium-night.js  le rig de nuit (ombre qui couvre la pelouse, 4 mâts, rien sous l'herbe)
//   engine/render-pipeline.js le contrat de la chaîne post (MSAA vs temporel, double AO, tonemap)
//
// Les deux premiers tournent sur les VRAIS objets three (le rig de nuit se construit sans renderer :
// seule l'IBL a besoin d'un GPU). Le troisième teste son PRÉDICAT sur des graphes synthétiques —
// createRenderPipeline exige un WebGPURenderer, mais c'est le contrat qui doit mordre, et un contrat
// se prouve avec des sabotages nommés, pas avec un GPU.
import * as THREE from '../../../examples/showcase/node_modules/three/build/three.webgpu.js';
import { buildKit, checkKit } from '../../../examples/showcase/src/engine/kit.js';
import { setupStadiumNight, checkStadiumNight } from '../../../examples/showcase/src/engine/stadium-night.js';
import { checkRenderPipeline } from '../../../examples/showcase/src/engine/render-pipeline.js';
import { generateStadium } from '../../../examples/showcase/src/engine/stadium.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const has = (r, needle) => !r.ok && r.issues.some((i) => i.toLowerCase().includes(needle.toLowerCase()));

// ---------------------------------------------------------------- 1. KIT
// A 1.80 m Mixamo-named T-pose. Bones only: fitRing falls back to its analytic radius, which is
// exactly the path a rig whose skin has not loaded takes — the harsher of the two cases.
function makeRig() {
  const root = new THREE.Group();
  const rn = new THREE.Object3D(); rn.name = 'RootNode'; root.add(rn);
  const mk = (name, parent, p) => { const b = new THREE.Bone(); b.name = 'mixamorig5' + name; b.position.set(...p); parent.add(b); return b; };
  const hips = mk('Hips', rn, [0, 0.93, 0.01]);
  const spine = mk('Spine', hips, [0, 0.1, 0]);
  const spine1 = mk('Spine1', spine, [0, 0.11, 0]);
  const spine2 = mk('Spine2', spine1, [0, 0.12, 0]);
  const neck = mk('Neck', spine2, [0, 0.13, 0]);
  mk('Head', neck, [0, 0.1, 0.02]);
  for (const [s, sx] of [['Left', 1], ['Right', -1]]) {
    const sh = mk(`${s}Shoulder`, spine2, [0.06 * sx, 0.08, 0]);
    const arm = mk(`${s}Arm`, sh, [0.12 * sx, 0, 0]);
    const fa = mk(`${s}ForeArm`, arm, [0.26 * sx, 0, 0]);
    mk(`${s}Hand`, fa, [0.24 * sx, 0, 0]);
    const ul = mk(`${s}UpLeg`, hips, [0.09 * sx, -0.06, 0]);
    const leg = mk(`${s}Leg`, ul, [0, -0.38, 0]);
    mk(`${s}Foot`, leg, [0, -0.42, 0]);
  }
  root.updateMatrixWorld(true);
  return root;
}

{
  console.log('\n— kit.js : le maillot construit sur le rig —');
  const rig = makeRig();
  const kit = buildKit(rig, { shirt: 0xe8ecf2, shorts: 0x16233f, socks: 0xe8ecf2, trim: 0x16233f, number: 10 });
  ok('kit construit', !!kit.group, kit.check?.issues?.[0] || '');
  ok('contrat global OK (géométrie + skin + coupe)', kit.check.ok, kit.check.issues.join(' | ') || '');
  for (const need of ['maillot', 'mancheG', 'mancheD', 'shortG', 'shortD', 'chaussetteG', 'chaussetteD'])
    ok(`  pièce « ${need} » présente`, kit.meshes.some((p) => p.name === need));
  for (const p of kit.meshes) ok(`  pièce « ${p.name} » : contrat meshkit (fermée, volume positif)`, p.contract.ok, p.contract.issues?.[0] || '');
  ok('le groupe est un vrai objet scène (SkinnedMesh liés au squelette)',
    kit.group.children.length > 0 && kit.group.children.every((c) => c.isSkinnedMesh && c.skeleton.bones.length > 0));
  ok('déterministe (mêmes mesures au rebuild)', JSON.stringify(buildKit(makeRig(), { number: 10 }).measures) === JSON.stringify(kit.measures));
  const numbered = buildKit(makeRig(), { number: 7 });
  ok('le numéro ajoute de la géométrie sans casser le contrat', numbered.check.ok && numbered.meshes.length >= kit.meshes.length, numbered.check.issues[0] || '');

  // ---- sabotages nommés
  {
    const k = buildKit(makeRig());
    k.meshes[0].mesh.geometry.attributes.skinWeight.array[0] = 3;
    ok('sabotage « poids dénormalisés » attrapé', has(checkKit(k.meshes, makeRig(), k.measures), 'normalis'));
  }
  {
    const k = buildKit(makeRig());
    k.meshes[0].mesh.geometry.attributes.skinIndex.array[2] = 9999;
    ok('sabotage « index d\'os fantôme » attrapé', has(checkKit(k.meshes, makeRig(), k.measures), 'invalide'));
  }
  {
    const k = buildKit(makeRig());                                   // maillot rallongé : une robe
    const pos = k.meshes.find((p) => p.name === 'maillot').mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) < k.measures.hipsY) pos.setY(i, pos.getY(i) - 0.4);
    ok('sabotage « maillot longueur robe » attrapé', has(checkKit(k.meshes, makeRig(), k.measures), 'robe'));
  }
  {
    const k = buildKit(makeRig());                                   // manche étirée jusqu'au poignet
    const pos = k.meshes.find((p) => p.name === 'mancheG').mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) * 3.2);
    ok('sabotage « manche longue » attrapé', has(checkKit(k.meshes, makeRig(), k.measures), 'manche'));
  }
  {
    const k = buildKit(makeRig());                                   // chaussette qui s'arrête au mollet
    const pos = k.meshes.find((p) => p.name === 'chaussetteG').mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) - 0.18);
    ok('sabotage « chaussette qui n\'atteint pas le genou » attrapé', has(checkKit(k.meshes, makeRig(), k.measures), 'genou'));
  }
  {
    const rigless = new THREE.Group();
    const k = buildKit(rigless);
    ok('rig sans os → refus propre (pas de crash)', !k.check.ok && k.group === null, k.check.issues[0] || '');
  }
}

// ---------------------------------------------------------------- 2. NUIT
{
  console.log('\n— stadium-night.js : le rig de nuit sur le vrai stade —');
  const model = generateStadium({ tier: 5, landmark: 'grandbol' });
  const scene = new THREE.Scene();
  const night = setupStadiumNight(scene, null, { at: [0, 0, 0], model });   // sans renderer : pas d'IBL, tout le reste
  const r = checkStadiumNight(night, model);
  ok('rig de nuit construit sans GPU (l\'IBL est la seule pièce qui en exige un)', !!night.group && !!night.sun);
  ok('contrat de nuit OK sur un tier 5 (toit)', r.ok, r.issues.join(' | ') || '');
  ok('`sun` est directionnelle et projette l\'ombre (exigence GodraysNode)', night.sun.isDirectionalLight && night.sun.castShadow);
  ok('huit nappes de projecteurs (4 quadrants + 2 lavages de cage + 2 lavages du rond central — lots 44 et 52 : « la cage/le milieu est trop sombre », chaque zone du terrain se lit)', night.spots.length === 8);
  ok('aucun spot ne projette d\'ombre (une seule passe de profondeur)', night.spots.every((s) => !s.castShadow));
  ok('le brouillard de nuit est posé sur la scène', scene.fog instanceof THREE.FogExp2);
  {
    const c = night.sun.shadow.camera, span = Math.max(c.right - c.left, c.top - c.bottom);
    ok(`frustum d'ombre ajusté au terrain (${span.toFixed(0)} m, pas le bol entier)`, span < 160, `${span.toFixed(0)} m`);
  }
  // tiers 1–3 publient de vrais pylônes : le rig doit les SUIVRE, pas inventer des coins
  for (const tier of [1, 2, 3]) {
    const m = generateStadium({ tier });
    const s2 = new THREE.Scene();
    const n2 = setupStadiumNight(s2, null, { model: m });
    const c2 = checkStadiumNight(n2, m);
    ok(`tier ${tier} (pylônes) : contrat OK`, c2.ok, c2.issues.join(' | ') || '');
    if (m.lights?.type === 'pylon' && Array.isArray(m.lights.at)) {
      const near = n2.spots.every((sp) => m.lights.at.some(([x, z]) => Math.hypot(sp.position.x - x, sp.position.z - z) < 0.5));
      ok(`  tier ${tier} : chaque projecteur est SUR son pylône (model.lights fait foi)`, near);
    }
    n2.dispose();
  }
  // un stade décalé : tout est local, donc le contrat doit rester vert et rien ne doit passer sous l'herbe
  {
    const s3 = new THREE.Scene();
    const n3 = setupStadiumNight(s3, null, { at: [120, 3, -40], model });
    ok('stade décalé/surélevé : contrat toujours vert (frame locale)', checkStadiumNight(n3, model).ok);
    n3.dispose();
  }

  // ---- sabotages nommés
  const rebuild = () => setupStadiumNight(new THREE.Scene(), null, { model });
  { const n = rebuild(); n.sun.castShadow = false; ok('sabotage « personne ne projette d\'ombre » attrapé', has(checkStadiumNight(n, model), 'ombre')); n.dispose(); }
  { const n = rebuild(); n.sun.castShadow = false; n.spots[0].castShadow = true; n.sun = n.spots[0];
    ok('sabotage « godrays sur un SpotLight » attrapé', has(checkStadiumNight(n, model), 'ni directionnelle')); n.dispose(); }
  { const n = rebuild(); const c = n.sun.shadow.camera; c.left = -300; c.right = 300; c.top = 300; c.bottom = -300; c.updateProjectionMatrix();
    n.sun.shadow.updateMatrices = () => {};                            // fige le frustum saboté
    ok('sabotage « frustum qui englobe le stade » attrapé', has(checkStadiumNight(n, model), 'trop large')); n.dispose(); }
  { const n = rebuild(); n.sun.shadow.camera.top = 1; n.sun.shadow.camera.bottom = -1; n.sun.shadow.camera.updateProjectionMatrix();
    n.sun.shadow.updateMatrices = () => {};
    ok('sabotage « ombre tronquée en bord de terrain » attrapé', has(checkStadiumNight(n, model), 'couvre pas')); n.dispose(); }
  { const n = rebuild(); for (const s of n.spots) s.visible = false; ok('sabotage « moins de 4 mâts allumés » attrapé', has(checkStadiumNight(n, model), 'dirigée')); n.dispose(); }
  { const n = rebuild(); n.sun.intensity = 2.4; ok('sabotage « clé au niveau du soleil (2,4) » attrapé', has(checkStadiumNight(n, model), 'SOLEIL')); n.dispose(); }

  // ---- la clé masquée sur un calque : ce qui fait vraiment tomber le bol dans la nuit
  {
    const s = new THREE.Scene();
    const pelouse = new THREE.Mesh(new THREE.PlaneGeometry(105, 68), new THREE.MeshBasicMaterial()); pelouse.name = 'pelouse'; s.add(pelouse);
    const tribune = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 60), new THREE.MeshBasicMaterial()); tribune.name = 'tribune'; s.add(tribune);
    const n = setupStadiumNight(s, null, { model });
    ok('clé masquée sur son calque (le bol ne la reçoit plus)', n.sun.layers.mask !== 1 && n.keyLayer === 1, `masque ${n.sun.layers.mask}`);
    ok('  la pelouse EST sur le calque de la clé', pelouse.layers.test(n.sun.layers));
    ok('  la tribune ne l\'est PAS (c\'est tout le principe)', !tribune.layers.test(n.sun.layers));
    ok('  contrat vert', checkStadiumNight(n, model).ok, checkStadiumNight(n, model).issues.join(' | '));
    const joueur = new THREE.Group(); joueur.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
    n.light(joueur);
    ok('  light() inscrit tout un sous-arbre (joueur + maillot)', joueur.children.every((c) => c.layers.test(n.sun.layers)));
    pelouse.layers.disable(1);
    ok('sabotage « clé masquée, pelouse oubliée » attrapé (pelouse noire)', has(checkStadiumNight(n, model), 'pelouse noire'));
    n.dispose();
  }
  {
    const s = new THREE.Scene();                       // aucune surface nommée : on refuse de masquer
    const n = setupStadiumNight(s, null, { model });
    ok('sans surface nommée : pas de masquage (plutôt que de rendre une pelouse noire)', n.keyLayer === 0 && n.sun.layers.mask === 1);
    n.dispose();
  }
  {
    const s = new THREE.Scene();
    const pelouse = new THREE.Mesh(new THREE.PlaneGeometry(105, 68), new THREE.MeshBasicMaterial()); pelouse.name = 'pelouse'; s.add(pelouse);
    const n = setupStadiumNight(s, null, { model, keyLayer: 0 });
    ok('keyLayer: 0 désactive le masquage (comportement d\'avant)', n.sun.layers.mask === 1 && checkStadiumNight(n, model).ok);
    n.dispose();
  }
  { const n = rebuild(); n.scene.environmentIntensity = 1.0; ok('sabotage « IBL de jour sous la nuit » attrapé', has(checkStadiumNight(n, model), 'IBL de jour')); n.dispose(); }
  { const n = rebuild(); n.group.traverse((o) => { if (o.isHemisphereLight) o.intensity = 1.2; });
    ok('sabotage « ambiance qui écrase la clé » attrapé', has(checkStadiumNight(n, model), 'trop plate')); n.dispose(); }
  {
    const n = rebuild();
    const aim = Math.hypot(n.spots[0].position.x - n.spots[0].target.position.x, n.spots[0].position.y, n.spots[0].position.z - n.spots[0].target.position.z);
    ok('les mâts éclairent VRAIMENT la pelouse (E = I/d² au point visé ≥ la clé)', n.spots[0].intensity / (aim * aim) >= n.sun.intensity,
      `E=${(n.spots[0].intensity / (aim * aim)).toFixed(2)} vs clé ${n.sun.intensity}`);
    n.dispose();
  }
  { const n = rebuild(); n.spots[0].position.y = -5; ok('sabotage « projecteur sous la pelouse » attrapé', has(checkStadiumNight(n, model), 'sous la pelouse')); n.dispose(); }
  // Celui-là est le bug RÉEL qu'on a payé : le boot du moteur (Lighting.js) laisse un soleil de jour
  // dans la scène, hors du groupe de nuit — tous les autres contrats restaient verts et le « match en
  // nocturne » se rendait en plein après-midi.
  {
    const s = new THREE.Scene();
    const jour = new THREE.DirectionalLight(0xfff2e0, 2.4); s.add(jour);
    const n = setupStadiumNight(s, null, { model });
    ok('le rig de nuit ÉTEINT le soleil de jour laissé par le moteur', jour.visible === false);
    ok('  contrat vert une fois le jour éteint', checkStadiumNight(n, model).ok, checkStadiumNight(n, model).issues.join(' | '));
    jour.visible = true;
    ok('sabotage « soleil de jour rallumé hors du rig » attrapé', has(checkStadiumNight(n, model), 'hors du rig'));
    n.dispose();
    ok('dispose() rend ses lumières à la scène', jour.visible === true);
  }
  { ok('rien construit → refus propre', has(checkStadiumNight(null, model), 'aucun groupe')); }
  night.dispose();
  ok('dispose() rend la scène (fond, environnement, brouillard)', scene.fog === undefined || scene.fog === null);
}

// ---------------------------------------------------------------- 3. PIPELINE
{
  console.log('\n— render-pipeline.js : le contrat de la chaîne post —');
  const good = (over = {}) => ({
    postProcessing: { outputColorTransform: false },
    tier: 'ultra', toneMapping: THREE.AgXToneMapping,
    declared: ['bloom', 'ssgi', 'ssr', 'taau', 'sharpen'],
    passes: { bloom: {}, ssgi: {}, ssr: {}, taau: {}, sharpen: {} },
    ...over,
  });
  const R0 = { samples: 0 };
  ok('chaîne ultra saine acceptée', checkRenderPipeline(good(), R0).ok, checkRenderPipeline(good(), R0).issues.join(' | '));
  ok('chaîne low saine acceptée (pas de temporel exigé)',
    checkRenderPipeline(good({ tier: 'low', declared: ['bloom', 'fxaa'], passes: { bloom: {}, fxaa: {} } }), R0).ok);

  // ---- sabotages nommés : chacun est un bug qu'on a déjà payé une fois
  ok('sabotage « MSAA + passe temporelle » attrapé (TRAA/TAAU exigent les samples jitterés bruts)',
    has(checkRenderPipeline(good(), { samples: 4 }), 'MSAA'));
  ok('sabotage « GTAO + SSGI » attrapé (double occlusion ambiante)',
    has(checkRenderPipeline(good({ declared: ['gtao', 'ssgi', 'traa'], passes: { gtao: {}, ssgi: {}, traa: {} } }), R0), 'double occlusion'));
  ok('sabotage « SSGI sur le tier low » attrapé',
    has(checkRenderPipeline(good({ tier: 'low', declared: ['ssgi'], passes: { ssgi: {} } }), R0), 'low'));
  ok('sabotage « high sans passe temporelle » attrapé (SSR/SSGI bruités)',
    has(checkRenderPipeline(good({ tier: 'high', declared: ['ssr'], passes: { ssr: {} } }), R0), 'temporelle'));
  ok('sabotage « outputColorTransform laissé à true » attrapé (double tonemap)',
    has(checkRenderPipeline(good({ postProcessing: { outputColorTransform: true } }), R0), 'outputColorTransform'));
  ok('sabotage « tone mapping ni AgX ni ACES » attrapé',
    has(checkRenderPipeline(good({ toneMapping: THREE.LinearToneMapping }), R0), 'tone mapping'));
  ok('sabotage « passe déclarée mais absente du graphe » attrapé (godrays sans DirectionalLight)',
    has(checkRenderPipeline(good({ declared: ['bloom', 'godrays', 'taau'], passes: { bloom: {}, taau: {} } }), R0), 'godrays'));
  ok('rien construit → refus propre', has(checkRenderPipeline(null, R0), 'pipeline invalide'));
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
