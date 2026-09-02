import * as THREE from 'three/webgpu';

// part-tint — RECOLORER UNE PIÈCE D'UN PERSONNAGE QUI PARTAGE UN SEUL MATÉRIAU.
//
// Le problème, tel qu'on le rencontre vraiment : un personnage acheté ou scanné arrive avec UN atlas
// et UN matériau pour le maillot, la peau et les crampons. Teindre « le matériau » teint le joueur.
// J'en avais conclu — deux fois, et à tort — qu'il fallait un vêtement en plus (une chasuble), ce qui
// est un contournement et se voit comme tel.
//
// LA MESURE QUI RENVERSE ÇA : `Ch38_Shirt` est DÉJÀ un mesh séparé. Le fichier contient 7 meshes
// (Shorts, Shirt, Socks, Body, Shoes, Hair, Eyelashes) pour 2 matériaux. Or dans three.js le matériau
// est un attribut du DRAW CALL, pas de la texture : donner au mesh du maillot son propre clone de
// matériau ne PEUT PAS toucher le mesh du corps. La séparation était dans le fichier depuis le début ;
// personne ne l'avait regardée. C'est le genre de supposition qu'il faut mesurer avant d'écrire un
// module entier pour la contourner.
//
// Trois autres pistes ont été essayées et MESURÉES FAUSSES, elles valent d'être écrites ici pour que
// personne ne les reprenne :
//   • teinter un RECTANGLE UV en TSL : le rectangle du maillot dans l'atlas est [0,004..0,992] ×
//     [0,148..0,996] et contient 100 % des texels du short, 97,7 % des chaussures et 60,9 % DE LA PEAU.
//     Aucune pièce de cet atlas n'a de rectangle propre.
//   • masquer par CHROMA (la peau est saturée, le tissu non) : à seuil 0,08 le masque prend 99,5 % du
//     maillot mais aussi 100 % du short, 100 % des chaussettes et 19,5 % de la peau (ongles, blanc de
//     l'œil sont désaturés).
//   • réécrire l'atlas hors ligne : marche, mais coûte un fichier par équipe et interdit une couleur
//     choisie à l'exécution.
//
// POURQUOI `color` ET PAS UN REMPLACEMENT : dans three.js `material.color` MULTIPLIE la texture. Or
// l'albédo du maillot est un gris clair NEUTRE (sRGB 193,189,189, luminance linéaire 0,52) : le
// multiplier par la couleur d'équipe donne exactement cette couleur, en CONSERVANT les plis, les
// coutures, le flocage et l'occlusion ambiante peints dans la texture. Une teinte plate les effacerait.

/** Les matériaux sont mis en cache PAR COULEUR : dix joueurs en deux équipes doivent coûter deux
 *  matériaux, pas vingt — sinon on paie la couleur en appels de rendu. */
const cache = new WeakMap();

const cacheMap = new WeakMap();   // …et PAR TEXTURE (214) : un `map` fourni a son propre cache par couleur

function tintedMaterial(src, color, map = null) {
  const root = map ? (cacheMap.get(map) ?? (cacheMap.set(map, new WeakMap()), cacheMap.get(map))) : cache;
  let byColour = root.get(src);
  if (!byColour) { byColour = new Map(); root.set(src, byColour); }
  const key = color >>> 0;
  if (!byColour.has(key)) {
    const m = src.clone();
    m.color = new THREE.Color(color);
    // L'EMPLACEMENT DE TEXTURE (214, demande projet aval) : `map` REMPLACE la texture sur le CLONE de
    // la pièce — jamais sur le matériau partagé (corps, visage, chaussures lisent le même atlas).
    if (map) m.map = map;
    m.name = `${src.name || 'mat'}-tint-${key.toString(16)}${map ? '-map' : ''}`;
    byColour.set(key, m);
  }
  return byColour.get(key);
}

/**
 * Recolorer les pièces dont le NOM correspond, sans toucher aux autres.
 * @param model  la racine (un personnage déjà cloné : les clones de SkeletonUtils PARTAGENT les
 *               matériaux, ce qui est précisément pourquoi il faut cloner le matériau ici)
 * @param match  RegExp sur le nom du mesh (ex. /Shirt/i)
 * @param color  la couleur d'équipe (0xRRGGBB)
 * @returns { applied, parts, skipped, check }
 */
export function tintPart(model, { match = /Shirt/i, color = 0xffffff, map = null } = {}) {
  const parts = [], skipped = [];
  model.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    if (Array.isArray(o.material)) { skipped.push(`${o.name}: matériaux multiples (non géré)`); return; }
    if (match.test(o.name)) {
      o.material = tintedMaterial(o.material, color, map);
      parts.push(o);
    }
  });
  return { applied: parts.length, parts, skipped, check: checkTint(model, { match, color, map }) };
}

/**
 * CONTRAT. La clause qui compte n'est pas « le maillot a changé de couleur » — c'est « ET LA PEAU N'A
 * PAS CHANGÉ ». Les deux se prouvent sans œil humain et sans rendu, parce que la garantie est
 * STRUCTURELLE : si le matériau du maillot n'est partagé avec aucune autre pièce, alors aucune
 * commande de rendu ne peut colorer les deux. C'est cette non-appartenance qu'on vérifie.
 */
export function checkTint(model, { match = /Shirt/i, color = 0xffffff, map = null } = {}) {
  const issues = [];
  const hit = [], miss = [];
  model.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) (match.test(o.name) ? hit : miss).push(o); });

  if (!hit.length) issues.push(`aucune pièce ne correspond à ${match} — le personnage n'a pas été recoloré`);

  const want = new THREE.Color(color);
  for (const o of hit) {
    const c = o.material?.color;
    if (!c) { issues.push(`${o.name} : matériau sans couleur`); continue; }
    if (Math.abs(c.r - want.r) + Math.abs(c.g - want.g) + Math.abs(c.b - want.b) > 0.02) {
      issues.push(`${o.name} : teinte ${'#' + c.getHexString()} au lieu de ${'#' + want.getHexString()}`);
    }
    // LA clause : le matériau teint ne doit appartenir qu'aux pièces visées.
    const shared = miss.filter((m) => m.material === o.material);
    if (shared.length) issues.push(`${o.name} partage son matériau avec ${shared.map((m) => m.name).join(', ')} — la teinte déborderait sur ${shared[0].name}`);
    // …et il faut garder la TEXTURE, sinon on a remplacé un vêtement par un aplat de couleur.
    if (!o.material.map) issues.push(`${o.name} : la texture a disparu (teinte plate — plis et coutures perdus)`);
    // …ET LA TEXTURE FOURNIE EST AU CONTRAT glTF DE L'ASSET (214) : origine en haut à gauche (flipY false), sRGB — sinon la carte SHANON_UV ment d'une demi-image
    if (map && o.material.map !== map) issues.push(`${o.name} : la texture fournie n'est pas montée`);
    if (o.material.map && o.material.map.flipY !== false) issues.push(`${o.name} : map.flipY doit être false (origine glTF en haut à gauche — la carte UV serait retournée)`);
    if (o.material.map && o.material.map.colorSpace !== THREE.SRGBColorSpace) issues.push(`${o.name} : map.colorSpace doit être sRGB (les couleurs d'équipe seraient délavées)`);
  }
  // et le reste du personnage n'a pas bougé
  for (const o of miss) {
    if (map && o.material?.map === map) issues.push(`${o.name} a reçu la texture du maillot alors qu'il ne devait pas`);
    const c = o.material?.color;
    if (c && Math.abs(c.r - want.r) + Math.abs(c.g - want.g) + Math.abs(c.b - want.b) < 0.02 && want.getHex() !== 0xffffff) {
      issues.push(`${o.name} a pris la couleur d'équipe alors qu'il ne devait pas`);
    }
  }
  return { ok: issues.length === 0, issues, parts: hit.map((o) => o.name) };
}
