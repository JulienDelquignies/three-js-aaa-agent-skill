import * as THREE from 'three/webgpu';

// mains.js — LES MAINS VIVANTES (26/09, retour « les animations — tout » ; mesuré au plan d'étude : les 24 os de doigts du rig ne sont
// animés par RIEN — les mains restent ouvertes, doigts écartés, comme la pose de liaison ; de près, c'est la première chose qui fait
// « mannequin »). Une main de footballeur qui court est RELÂCHÉE : doigts fléchis de 30-55° par phalange, pouce replié contre l'index.
// L'axe de flexion n'est pas deviné (le sondage à l'œil était ambigu) : il se DÉDUIT de la pose de liaison du squelette — la convention
// Mixamo pose les paumes vers le bas (−Y monde) : l'axe de flexion d'une phalange = (direction du doigt) × (−Y), ramené dans le repère
// local de l'os par la rotation de liaison. Le pouce plie autour de l'axe (direction du pouce) × (vers la paume, vers l'index).
// Absolu, pas cumulatif : q = q_liaison_local ⊗ R(axe local, θ) — rejoué à chaque image il ne dérive pas, et il gagne sur un clip qui
// écrirait les doigts à la liaison. Générique : tout rig aux noms Mixamo (…HandIndex1-3, Middle, Ring, Pinky, Thumb1-3).

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _a = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Vector3();
const DOIGT = /(Left|Right)Hand(Index|Middle|Ring|Pinky|Thumb)([123])$/;

/** Prépare les mains d'un modèle skinné : pour chaque phalange, l'axe local de flexion et la rotation locale de liaison. */
export function preparerMains(model) {
  const sms = []; model.traverse((o) => { if (o.isSkinnedMesh && o.skeleton) sms.push(o); });
  const SM = sms.sort((a, b) => b.skeleton.bones.length - a.skeleton.bones.length)[0]; const S = SM?.skeleton; if (!S) return null;   // le squelette le PLUS COMPLET (le corps — le short n'a que 7 os)
  // LE MAILLAGE PORTE-T-IL SES DOIGTS ? (26/09, « un doigt parti en vrille ») — mesuré sur shanon : les mains du corps sont pesées
  // presque entièrement sur l'os Hand (~1 250 sommets par main) et un seul os de doigt porte des sommets (Ring3, ~175) : plier les
  // phalanges n'y tordait QUE ce morceau d'annulaire. On ne pose les mains que si au moins 3 doigts par main portent ≥ 20 sommets
  // (poids > 0,3) ; sinon null — la main reste celle du modèle.
  if (!SM.geometry.userData.doigtsRepeses) repeserDoigts(SM);   // (26/09) la peau des doigts reconstruite si le modèle ne la porte pas
  { const si = SM.geometry.attributes.skinIndex, sw = SM.geometry.attributes.skinWeight, n = {};
    if (!si || !sw) return null;
    for (let v = 0; v < si.count; v++) for (let k = 0; k < 4; k++) { if (sw.getComponent(v, k) <= 0.3) continue; const m = DOIGT.exec(S.bones[si.getComponent(v, k)]?.name ?? ''); if (m && m[2] !== 'Thumb') { const key = m[1] + m[2]; n[key] = (n[key] ?? 0) + 1; } }
    for (const side of ['Left', 'Right']) if (['Index', 'Middle', 'Ring', 'Pinky'].filter((d) => (n[side + d] ?? 0) >= 20).length < 3) return null; }
  const monde = new Map();   // os → [position, rotation] monde de LIAISON
  // (26/09) la pose de REPOS DE LA SCÈNE, pas la liaison des boneInverses : sur shanon l'index et le majeur n'y ont pas la même orientation
  // (le « V » : leur axe déduit de la liaison les faisait tourner sur eux-mêmes) — lue au moment de la préparation, le modèle au repos
  model.updateMatrixWorld(true);
  S.bones.forEach((b) => { const p = new THREE.Vector3(), q = new THREE.Quaternion(); b.getWorldPosition(p); b.getWorldQuaternion(q); monde.set(b, [p, q]); });
  // (26/09, « un doigt parti en vrille ») : un axe PAR PHALANGE (direction du doigt × paume) partait de biais sur les doigts écartés — le
  // doigt vrillait au lieu de plier (l'index et le majeur restaient tendus, un « V »). Tous les doigts d'une main plient désormais autour
  // de la MÊME ligne : les jointures (Index1 → Pinky1), orientée comme n × f du majeur (le sens validé à l'image) ; le pouce garde le sien.
  const nom = (side, n) => S.bones.find((x) => x.name.endsWith(`${side}Hand${n}`));
  const axeMain = {};
  for (const side of ['Left', 'Right']) {
    const i1 = nom(side, 'Index1'), p1 = nom(side, 'Pinky1'), m1 = nom(side, 'Middle1'), m2 = nom(side, 'Middle2'), h = nom(side, ''), t2 = nom(side, 'Thumb2');
    if (!i1 || !p1 || !m1 || !m2 || !h || !t2) continue;
    const w = monde.get(p1)[0].clone().sub(monde.get(i1)[0]).normalize(), f = monde.get(m2)[0].clone().sub(monde.get(m1)[0]).normalize();
    // (26/09, « t'as tourné les doigts dans le mauvais sens ») : l'hypothèse « paume vers −Y » était fausse sur la pose de repos de la
    // scène — mesuré en match, le bout du majeur partait vers le DOS de la main (hyperextension) sur les deux mains. Le côté PAUME se lit
    // désormais sur le squelette : le pouce (Thumb2) est du côté de la paume par rapport au plan (doigt, jointures). La rotation d'axe a
    // déplace le bout selon a × f : on veut (a × f) · paume > 0.
    const nrm = new THREE.Vector3().crossVectors(f, w), paume = monde.get(t2)[0].clone().sub(monde.get(h)[0]);
    if (paume.dot(nrm) < 0) nrm.negate();
    axeMain[side] = new THREE.Vector3().crossVectors(w, f).dot(nrm) >= 0 ? w : w.negate();
  }
  const out = [];
  for (const b of S.bones) {
    const m = DOIGT.exec(b.name); if (!m) continue;
    const enfant = b.children.find((c) => c.isBone), W = monde.get(b), We = enfant ? monde.get(enfant) : null; if (!W || !We) continue;
    let axeMonde;
    if (m[2] === 'Thumb') {
      const f = We[0].clone().sub(W[0]).normalize(), idx = nom(m[1], 'Index1'), Wi = idx ? monde.get(idx) : null, n = Wi ? Wi[0].clone().sub(W[0]).normalize() : new THREE.Vector3(0, -1, 0);
      axeMonde = new THREE.Vector3().crossVectors(n, f); if (axeMonde.lengthSq() < 1e-8) continue; axeMonde.normalize();
    } else { if (!axeMain[m[1]]) continue; axeMonde = axeMain[m[1]].clone(); }
    const axeLocal = axeMonde.applyQuaternion(W[1].clone().invert());           // dans le repère de l'os
    out.push({ os: b, doigt: m[2], rang: +m[3], axe: axeLocal, q0: b.quaternion.clone() });
  }
  return out.length ? out : null;
}

/** Pose les mains : flexion par phalange (rad) — { base, milieu, bout } pour les doigts, { pouce } pour le pouce ; `serre` 0..1 module tout. */
export function poserMains(M, { serre = 1, base = 0.45, milieu = 0.6, bout = 0.3, pouce = 0.3, ecart = 0.1 } = {}) {   // (26/09) relâchée, pas en griffe : la base plie presque autant que le milieu
  if (!M) return;
  for (const P of M) {
    let th = P.doigt === 'Thumb' ? pouce * (P.rang === 1 ? 0.5 : 1) : [0, base, milieu, bout][P.rang];
    // le petit doigt plie un peu plus, l'index un peu moins (la main relâchée se ferme de l'auriculaire vers l'index)
    if (P.doigt === 'Pinky') th *= 1 + ecart * 2; else if (P.doigt === 'Ring') th *= 1 + ecart; else if (P.doigt === 'Index') th *= 1 - ecart;
    _q.setFromAxisAngle(P.axe, th * serre);
    P.os.quaternion.copy(P.q0).multiply(_q);
  }
}

/**
 * LE REPESAGE DES DOIGTS (26/09 — la peau de shanon pèse ses mains sur l'os Hand, un seul os de doigt porte des sommets). Pour chaque
 * sommet dont l'os dominant est la main ou un doigt : en ESPACE DE LIAISON (bindMatrix × position ; l'origine d'un os = boneInverse⁻¹),
 * la distance aux SEGMENTS des phalanges (Index1→2, 2→3, 3→4, idem Middle, Ring, Pinky, Thumb) et aux segments de la PAUME (Hand → la
 * base de chaque doigt). Plus proche d'une phalange : le sommet passe à cet os, PARTAGÉ avec l'os d'avant près de la jointure (poids
 * 0,5 → 1 sur le premier quart du segment) — la peau plie au lieu de casser ; plus proche de la paume : l'os Hand. Une fois par géométrie
 * (partagée par les clones), marquée geometry.userData.doigtsRepeses. Rend le nombre de sommets réattribués.
 */
export function repeserDoigts(SM) {
  const g = SM.geometry, S = SM.skeleton, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  g.userData.doigtsRepeses = true;
  if (!pos || !si || !sw) return 0;
  const idx = new Map(S.bones.map((b, i) => [b.name.replace(/^.*?(Left|Right)Hand/, '$1Hand'), i]));
  const O = S.boneInverses.map((m) => new THREE.Vector3().setFromMatrixPosition(_m.copy(m).invert()));
  const segs = [];   // [a, b, os, osParent]
  for (const side of ['Left', 'Right']) {
    const H = idx.get(`${side}Hand`); if (H == null) continue;
    for (const d of ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']) {
      const ch = [1, 2, 3, 4].map((k) => idx.get(`${side}Hand${d}${k}`)); if (ch.some((x) => x == null)) continue;
      segs.push({ a: O[H], b: O[ch[0]], os: H, par: null, main: H });                        // la paume (Hand → la base du doigt)
      for (let k = 0; k < 3; k++) segs.push({ a: O[ch[k]], b: O[ch[k + 1]], os: ch[k], par: k === 0 ? H : ch[k - 1], main: H });
    }
  }
  if (!segs.length) return 0;
  const mains = new Set(segs.map((x) => x.main)), doigts = new Set(segs.map((x) => x.os));
  const v = new THREE.Vector3(), ab = new THREE.Vector3(), av = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < pos.count; i++) {
    let dom = -1, wd = 0; for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > wd) { wd = w; dom = si.getComponent(i, k); } }
    if (!mains.has(dom) && !doigts.has(dom)) continue;
    v.fromBufferAttribute(pos, i).applyMatrix4(SM.bindMatrix);
    let best = null, bd = Infinity, bt = 0;
    for (const sg of segs) {
      if (sg.main !== dom && !doigts.has(dom)) continue;                                        // la bonne main
      ab.subVectors(sg.b, sg.a); av.subVectors(v, sg.a); const L2 = ab.lengthSq() || 1e-9, t = Math.max(0, Math.min(1, av.dot(ab) / L2));
      const d = av.addScaledVector(ab, -t).length(); if (d < bd) { bd = d; best = sg; bt = t; }
    }
    if (!best) continue;
    const wOs = best.par == null ? 1 : Math.min(1, 0.5 + 2 * bt);                              // la jointure partagée sur le premier quart
    si.setXYZW(i, best.os, best.par ?? best.os, 0, 0); sw.setXYZW(i, wOs, 1 - wOs, 0, 0); n++;
  }
  si.needsUpdate = true; sw.needsUpdate = true;
  return n;
}
