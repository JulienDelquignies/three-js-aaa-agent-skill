#!/usr/bin/env node
// verify-part-tint.mjs — RECOLORER UNE PIÈCE D'UN PERSONNAGE À MATÉRIAU PARTAGÉ (engine/part-tint.js).
//
// Ce qu'on prouve, et l'ordre compte : la pièce visée change de couleur, ET AUCUNE AUTRE. La seconde
// moitié est la seule qui soit difficile, parce qu'elle est silencieuse — un maillot teint avec la
// peau se voit ; un maillot teint dont la peau a viré de deux pour cent ne se voit pas, et c'est ce
// qui a fait croire pendant deux sessions qu'il fallait un vêtement supplémentaire.
//
// La garantie est STRUCTURELLE plutôt que visuelle : si le matériau de la pièce n'est partagé avec
// aucune autre, aucune commande de rendu ne peut colorer les deux. C'est cette non-appartenance qu'on
// vérifie, donc sans rendu et sans œil humain.
import * as THREE from '../../../examples/showcase/node_modules/three/build/three.webgpu.js';
import { tintPart, checkTint } from '../../../examples/showcase/src/engine/part-tint.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const has = (r, n) => !r.ok && r.issues.some((i) => i.toLowerCase().includes(n.toLowerCase()));

/** Un personnage comme ceux qu'on achète vraiment : plusieurs pièces, UN SEUL matériau partagé. */
function sourceMaterial() {
  const tex = new THREE.DataTexture(new Uint8Array([193, 189, 189, 255]), 1, 1);
  tex.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff });
  m.name = 'Ch38_body';
  return m;
}
/** `shared` reproduit le vrai chemin : SkeletonUtils.clone duplique le graphe mais PARTAGE les
 *  matériaux, donc les dix joueurs pointent tous sur le matériau du GLB chargé une fois. */
function makeCharacter(shared = sourceMaterial()) {
  const root = new THREE.Group();
  for (const name of ['Ch38_Shirt', 'Ch38_Body', 'Ch38_Shorts', 'Ch38_Shoes', 'Ch38_Socks']) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), shared);
    m.name = name; root.add(m);
  }
  return root;
}
const matOf = (root, name) => { let r = null; root.traverse((o) => { if (o.name === name) r = o.material; }); return r; };
const RED = 0xc8202f;

console.log('— recolorer le maillot d\'un personnage à matériau partagé —');
{
  const c = makeCharacter();
  const before = matOf(c, 'Ch38_Shirt');
  ok('au départ, TOUTES les pièces partagent le même matériau (c\'est le problème)',
    before === matOf(c, 'Ch38_Body') && before === matOf(c, 'Ch38_Shorts'));

  const r = tintPart(c, { match: /Shirt/i, color: RED });
  ok('une seule pièce est teinte', r.applied === 1, r.check.parts.join(','));
  ok('contrat vert', r.check.ok, r.check.issues.join(' | '));
  ok('le maillot a la couleur d\'équipe', matOf(c, 'Ch38_Shirt').color.getHex() === RED);
  // LA clause : la peau n'a pas bougé, et elle ne PEUT pas bouger.
  ok('la peau n\'a pas changé de matériau', matOf(c, 'Ch38_Body') === before);
  ok('le maillot ne partage plus son matériau avec la peau',
    matOf(c, 'Ch38_Shirt') !== matOf(c, 'Ch38_Body'));
  ok('…ni avec le short, les crampons, les chaussettes',
    ['Ch38_Shorts', 'Ch38_Shoes', 'Ch38_Socks'].every((n) => matOf(c, n) !== matOf(c, 'Ch38_Shirt')));
  // La TEXTURE est conservée : `color` MULTIPLIE la carte, donc plis, coutures et flocage restent.
  // Un remplacement par un aplat donnerait la bonne couleur et un vêtement en carton.
  ok('la texture est conservée (plis, coutures, occlusion peints restent)', !!matOf(c, 'Ch38_Shirt').map);
  ok('  …et c\'est la MÊME image que l\'originale (on n\'a pas rechargé un atlas)',
    matOf(c, 'Ch38_Shirt').map === before.map);
}

console.log('\n— deux équipes —');
{
  const a = makeCharacter(), b = makeCharacter();
  tintPart(a, { match: /Shirt/i, color: 0xe8ecf2 });
  tintPart(b, { match: /Shirt/i, color: RED });
  ok('les deux équipes ont des maillots de couleurs différentes',
    matOf(a, 'Ch38_Shirt').color.getHex() !== matOf(b, 'Ch38_Shirt').color.getHex());
  ok('…et la même peau', matOf(a, 'Ch38_Body').color.getHex() === matOf(b, 'Ch38_Body').color.getHex());
  // LE COÛT : dix joueurs en deux équipes doivent coûter DEUX matériaux, pas vingt — sinon la couleur
  // se paie en appels de rendu, ce qui est le genre de régression qu'aucun contrat visuel n'attrape.
  // LE COÛT, mesuré sur le vrai chemin de clonage (un seul matériau source, partagé par les clones).
  const src = sourceMaterial();
  const team = Array.from({ length: 5 }, () => { const c = makeCharacter(src); tintPart(c, { match: /Shirt/i, color: RED }); return matOf(c, 'Ch38_Shirt'); });
  ok('cinq joueurs de la même équipe partagent UN matériau (pas cinq)', new Set(team).size === 1, `${new Set(team).size} matériau(x)`);
  const both = Array.from({ length: 5 }, (_, i) => { const c = makeCharacter(src); tintPart(c, { match: /Shirt/i, color: i < 3 ? RED : 0xe8ecf2 }); return matOf(c, 'Ch38_Shirt'); });
  ok('deux équipes coûtent DEUX matériaux, pas dix', new Set(both).size === 2, `${new Set(both).size}`);
}

console.log('\n— sabotages —');
{
  // le contournement qu'on veut interdire : teindre le matériau partagé lui-même
  const c = makeCharacter();
  matOf(c, 'Ch38_Shirt').color = new THREE.Color(RED);
  ok('sabotage « teinter le matériau partagé (la peau vire aussi) » attrapé',
    has(checkTint(c, { match: /Shirt/i, color: RED }), 'partage son matériau'));
}
{
  const c = makeCharacter(); tintPart(c, { match: /Shirt/i, color: RED });
  matOf(c, 'Ch38_Shirt').color = new THREE.Color(0x00ff00);
  ok('sabotage « mauvaise couleur » attrapé', has(checkTint(c, { match: /Shirt/i, color: RED }), 'teinte'));
}
{
  const c = makeCharacter(); tintPart(c, { match: /Shirt/i, color: RED });
  matOf(c, 'Ch38_Shirt').map = null;
  ok('sabotage « aplat de couleur, texture jetée » attrapé', has(checkTint(c, { match: /Shirt/i, color: RED }), 'texture a disparu'));
}
{
  const c = makeCharacter();
  const r = tintPart(c, { match: /Maillot/i, color: RED });
  ok('sabotage « le motif ne correspond à rien (personnage muet) » attrapé', r.applied === 0 && has(r.check, 'aucune pièce'));
}
{
  // la teinte déborde : la peau a pris la couleur d'équipe
  const c = makeCharacter(); tintPart(c, { match: /Shirt/i, color: RED });
  let body = null; c.traverse((o) => { if (o.name === 'Ch38_Body') body = o; });
  body.material = body.material.clone(); body.material.color = new THREE.Color(RED);
  ok('sabotage « la peau a pris la couleur d\'équipe » attrapé', has(checkTint(c, { match: /Shirt/i, color: RED }), 'pris la couleur'));
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
