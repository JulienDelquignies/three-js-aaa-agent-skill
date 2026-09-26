import * as THREE from 'three/webgpu';
import { attribute, clamp, float, hash, instanceIndex, instancedBufferAttribute, max, mix, normalLocal, positionLocal, sin, time, uniform, vec3 } from 'three/tsl';

// crowd.js — LE PUBLIC (retour du 26/09 : « l'éclairage, la pelouse et le public » ; un stade vide de nuit se lit comme un entraînement).
// Un spectateur par siège occupé d'un stade construit par stadium-builder (les InstancedMesh nommés 'sieges' : on relit leurs matrices, le
// public hérite de la place ET de l'orientation vers la pelouse — marche aussi sur les virages du bol). Deux InstancedMesh (corps+bras,
// têtes) partagent l'index d'instance : la même phase, le même geste. Le mouvement est dans le SHADER (TSL, zéro coût CPU par spectateur) :
//   repos — le balancement lent, déphasé par un hash de l'index (une foule n'est jamais synchrone) ;
//   excitation (0-1, PAR CAMP : chaque instance porte son camp) — les plus fervents se lèvent d'abord, puis tous ; les bras montent,
//   les sauts partent chacun à sa cadence. cheer(camp) = le but ; tension(camp, k) = l'attaque qui se construit (on se soulève à demi).
// Tenues : le camp local en couleurs du club (maillot, second maillot, vestes sombres), le parcage visiteur aux couleurs adverses.
// Moteur générique : aucun football dans la géométrie, un « camp » est un index 0/1 ; la scène décide quand on s'enflamme.

const PEAU = [0xf1c7a5, 0xe0ac80, 0xc68a5e, 0x8d5a3b, 0x5c3a24, 0xf5d6bd, 0xd9a47c];
const NEUTRE = [0x23262d, 0x353b48, 0x4a3f35, 0xcfd3d8, 0x6b7280, 0x1f3a5f, 0x2d4a2d];

/** Concatène des BoxGeometry (non indexées) avec un attribut 'bras' (1 = sommet d'un bras, il monte quand on lève les bras). */
function assemble(parts) {
  const pos = [], nor = [], bras = [];
  for (const [g, b] of parts) {
    const ng = g.index ? g.toNonIndexed() : g; const P = ng.attributes.position.array, N = ng.attributes.normal.array;
    for (let i = 0; i < P.length; i++) { pos.push(P[i]); nor.push(N[i]); }
    for (let i = 0; i < P.length / 3; i++) bras.push(b);
    if (ng !== g) ng.dispose(); g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('bras', new THREE.Float32BufferAttribute(bras, 1));
  return out;
}
const boite = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };

/**
 * @param {THREE.Object3D} stadium  le groupe de buildStadium (les sièges y sont nommés 'sieges')
 * @param {{ teams: {primary:number, secondary:number}[], occupation?: number, visiteurs?: (x:number, z:number) => boolean, graine?: number, debordement?: number }} o  (debordement : l'émissif de nuit, 0 le jour)
 */
export function buildCrowd(stadium, { teams, occupation = 0.9, visiteurs = (x, z) => x > 0 && z < 0 && Math.abs(x) > Math.abs(z) * 1.25, graine = 7, debordement = 0.38 } = {}) {
  let s = graine >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const places = [];
  const m4 = new THREE.Matrix4();
  stadium.traverse((o) => { if (o.isInstancedMesh && o.name === 'sieges') for (let i = 0; i < o.count; i++) { if (rnd() > occupation) continue; o.getMatrixAt(i, m4); places.push(m4.clone().premultiply(o.matrix)); } });
  const n = places.length;
  // le spectateur assis, origine au centre du siège, face à +z (la pelouse) : cuisses, buste, bras (tagués), et la tête à part
  const corps = assemble([
    [boite(0.36, 0.14, 0.34, 0, 0.26, 0.14), 0],     // les cuisses
    [boite(0.44, 0.54, 0.26, 0, 0.58, -0.04), 0],    // le buste
    [boite(0.10, 0.46, 0.11, -0.26, 0.6, -0.02), 1], // bras gauche
    [boite(0.10, 0.46, 0.11, 0.26, 0.6, -0.02), 1],  // bras droit
  ]);
  const tete = assemble([[boite(0.2, 0.24, 0.22, 0, 0.98, -0.02), 0]]);
  // le camp de chaque spectateur (0 local, 1 visiteur) — lu par le shader
  const camp = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  const ex = [uniform(0), uniform(0)], tn = [uniform(0), uniform(0)];
  // LE DÉBORDEMENT DES MÂTS (la nuit) : les projecteurs d'en face éclairent les VISAGES — la lumière du rig tombe d'en haut et laisserait
  // la foule en blocs noirs. Un émissif calibré (spill, 0 le jour) : fort sur les faces tournées vers la pelouse (+z local), faible ailleurs.
  const spill = uniform(debordement);
  const cols = [new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3), new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)];
  const mkMat = (ci) => {
    const m = new THREE.MeshStandardNodeMaterial({ roughness: 0.85 });
    const teinte = instancedBufferAttribute(cols[ci], 'vec3');
    m.colorNode = teinte; m.emissiveNode = teinte.mul(spill).mul(max(normalLocal.z, 0).mul(0.75).add(normalLocal.y.max(0).mul(0.2)).add(0.25));
    const c = instancedBufferAttribute(camp, 'float');
    const ph = hash(instanceIndex).mul(6.2832), h2 = hash(instanceIndex.add(7919));
    const e = mix(ex[0], ex[1], c), t = mix(tn[0], tn[1], c);
    const debout = clamp(e.mul(1.7).sub(h2.mul(0.6)), 0, 1).max(clamp(t.mul(1.3).sub(h2), 0, 1).mul(0.5));
    const saut = e.mul(max(sin(time.mul(float(7).add(h2.mul(4))).add(ph)), 0)).mul(0.17);
    const bras = clamp(e.mul(1.5).sub(h2.mul(0.35)), 0, 1).mul(sin(time.mul(5).add(ph)).mul(0.12).add(0.88)).add(t.mul(0.25).mul(h2.greaterThan(0.7).select(1, 0)));
    const balance = sin(time.mul(0.7).add(ph)).mul(0.018);
    m.positionNode = positionLocal.add(vec3(balance, debout.mul(0.34).add(saut).add(attribute('bras', 'float').mul(bras).mul(0.52)), debout.mul(-0.06)));
    return m;
  };
  const mCorps = mkMat(0), mTete = mkMat(1);
  const iCorps = new THREE.InstancedMesh(corps, mCorps, n), iTete = new THREE.InstancedMesh(tete, mTete, n);
  const col = new THREE.Color(), pick = (a) => a[Math.floor(rnd() * a.length)];
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const M = places[i]; iCorps.setMatrixAt(i, M); iTete.setMatrixAt(i, M);
    p.setFromMatrixPosition(M); const v = visiteurs(p.x, p.z) ? 1 : 0; camp.array[i] = v;
    const T = teams[v] ?? teams[0], r = rnd();
    col.setHex(r < 0.45 ? T.primary : r < 0.68 ? T.secondary : pick(NEUTRE));
    col.offsetHSL(0, 0, (rnd() - 0.5) * 0.08); col.toArray(cols[0].array, i * 3);
    col.setHex(pick(PEAU)); col.toArray(cols[1].array, i * 3);
  }
  for (const im of [iCorps, iTete]) { im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; im.receiveShadow = true; im.name = 'public'; }
  const group = new THREE.Group(); group.name = 'public'; group.add(iCorps, iTete); stadium.add(group);
  // l'excitation : cible tenue quelques secondes, puis la retombée (jamais une coupure : la foule se rassoit)
  const E = [{ v: 0, hold: 0 }, { v: 0, hold: 0 }], TN = [{ v: 0, cible: 0 }, { v: 0, cible: 0 }];
  return {
    group, count: n, spill,
    /** Le but (ou le grand moment) du camp k : debout, bras levés, sauts, `duree` secondes. */
    cheer(k, duree = 7) { const X = E[k]; if (X) X.hold = Math.max(X.hold, duree); },
    /** La tension du camp k (0-1) : une attaque qui se construit — on se soulève à demi. */
    tension(k, v) { const X = TN[k]; if (X) X.cible = Math.max(0, Math.min(1, v)); },
    update(dt) {
      for (let k = 0; k < 2; k++) {
        const X = E[k]; X.hold = Math.max(0, X.hold - dt);
        X.v += ((X.hold > 0 ? 1 : 0) - X.v) * Math.min(1, dt * (X.hold > 0 ? 4 : 0.8)); ex[k].value = X.v;
        const Y = TN[k]; Y.v += (Y.cible - Y.v) * Math.min(1, dt * 1.5); tn[k].value = Y.v;
      }
    },
    dispose() { stadium.remove(group); corps.dispose(); tete.dispose(); mCorps.dispose(); mTete.dispose(); iCorps.dispose?.(); iTete.dispose?.(); },
  };
}
