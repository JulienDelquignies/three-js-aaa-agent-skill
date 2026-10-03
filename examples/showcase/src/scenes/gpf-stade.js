import { generateStadium, checkStadium } from '../engine/stadium.js';
import { buildStadium } from '../engine/stadium-builder.js';
import { makeTheme } from '../engine/club-theme.js';
import { setupStadiumNight } from '../engine/stadium-night.js';
import { setupStadiumJour } from '../engine/stadium-jour.js';
import { buildCrowd } from '../engine/crowd.js';
import { lights } from 'three/tsl';

// gpf-stade.js — LE STADE DE /match11 (lot L5 « L'image » : EX-28 stades, EX-29 public, EX-30 l'heure). Le stade paramétrique de la skill
// (stadium.js → stadium-builder.js) est construit AUTOUR DU TERRAIN DU CORPS : Gameplay Football joue sur 110 × 72 m (±55 × ±36), pas sur
// les 105 × 68 de la Loi 1 — le modèle reçoit ces dimensions, et ses tribunes, ses panneaux, sa pelouse peinte (tonte en damier, grain,
// usure) et ses cages (7,32 × 2,44, filets) les suivent. Repère : la scène de la page (x, z, −y) du corps EST le repère local du stade —
// centre au point central, long axe X, la tribune principale côté z < 0.
//   · le public (crowd.js) : un spectateur par siège occupé, animé dans le shader ; il se lève sur les buts (cheer) et se soulève quand une
//     attaque approche du but (tension) — le parcage visiteur aux couleurs de l'équipe de droite ;
//   · l'heure : jour et soir (stadium-jour.js : un soleil, pas de projecteurs), nuit (stadium-night.js : les mâts, la clé sur calque —
//     les joueurs et le ballon y sont inscrits par light()).
// Le changement de stade ou d'heure en plein match : dispose() puis une nouvelle construction (la partie continue, le corps n'en sait rien).

/** Les stades proposés : les trois signatures et les cinq niveaux génériques. */
export const STADES = {
  bol: { landmark: 'grandbol', nom: 'Le Grand Bol' }, arche: { landmark: 'arche', nom: 'L’Arche' }, nervures: { landmark: 'nervures', nom: 'Les Nervures' },
  1: { tier: 1, nom: 'Stade champêtre' }, 2: { tier: 2, nom: 'Stade municipal' }, 3: { tier: 3, nom: 'Stade de ville' }, 4: { tier: 4, nom: 'Stade moderne' }, 5: { tier: 5, nom: 'Enceinte' },
};
export const HEURES = { jour: 'Jour', soir: 'Fin d’après-midi', nuit: 'Nuit' };
/** Le terrain du corps (gf_frame : x ±55, y ±36) et ses buts. */
const TERRAIN = { L: 110, W: 72 }, BUT = { w: 7.32, h: 2.44 };

/**
 * @param {THREE.Scene} scene
 * @param {THREE.WebGPURenderer} renderer
 * @param {{ stade?: string, heure?: string, foule?: boolean, equipes: {primary:number, secondary:number}[], club: {nom:string, primary:number, secondary:number}, leger?: boolean }} o
 *   leger : l'écran étroit (téléphone) — l'ombre en 1024², la moitié du public
 */
export function construireStade(scene, renderer, { stade = 'bol', heure = 'nuit', foule = true, equipes, club, leger = false }) {
  const S = STADES[stade] ?? STADES.bol;
  const model = generateStadium({ tier: S.tier ?? 4, landmark: S.landmark ?? null, seed: 3, pitch: { ...TERRAIN }, goal: { ...BUT } });
  const chk = checkStadium(model);
  if (!chk.ok) console.warn('[stade] checkStadium', chk.issues);
  const theme = makeTheme({ seed: 3, name: club.nom, primary: club.primary, secondary: club.secondary });
  const built = buildStadium(model, theme, { at: [0, 0, 0] });
  scene.add(built.group);
  const h = HEURES[heure] ? heure : 'nuit';
  // le public AVANT la lumière (la nuit inscrit sur son calque ce qu'elle trouve) ; au soir et le jour, pas de débordement des mâts
  const public_ = foule ? buildCrowd(built.group, { teams: equipes, occupation: leger ? 0.45 : 0.9, debordement: { jour: 0, soir: 0.12 }[h] ?? 0.38 }) : null;
  const lumiere = h === 'nuit'
    ? setupStadiumNight(scene, renderer, { at: [0, 0, 0], model, shadowMapSize: leger ? 1024 : 2048 })
    : setupStadiumJour(scene, renderer, { at: [0, 0, 0], model, heure: h, shadowMapSize: leger ? 1024 : 2048 });
  // LES CAGES ET LES DRAPEAUX SOUS LA CLÉ DE NUIT : la clé n'éclaire que ce qui est inscrit sur son calque (la pelouse, les joueurs, le ballon) ;
  // sans elle, les montants vus de près (le plan derrière le but, les ralentis) sortaient presque noirs. Les groupes du mobilier posés sur
  // les lignes de but (cages) et aux quatre coins (drapeaux) y sont inscrits
  built.group.traverse((o) => {
    if (o === built.group || !o.parent || o.parent !== built.group) return;
    const x = Math.abs(o.position.x), z = Math.abs(o.position.z), surLigne = Math.abs(x - TERRAIN.L / 2) < 0.3;
    if (surLigne && (z < 0.05 || Math.abs(z - TERRAIN.W / 2) < 0.3)) lumiere.light?.(o);
  });
  // LA CLÉ DE NUIT ÉTAIT ÉTEINTE (diagnostic du 3 octobre). stadium-night pose la clé (la directionnelle qui porte l'ombre des joueurs) sur le
  // seul calque 1, pour qu'elle n'éclaire que la pelouse et ce qu'on y inscrit. Mais three r185 ne retient une lumière que si la CAMÉRA voit l'un
  // de ses calques (Renderer._projectObject) : la caméra ne voyant que le calque 0, la clé n'éclairait rien et ne projetait aucune ombre — mesuré :
  // aucun programme de la passe d'ombre des joueurs la nuit (7 le jour) ; vu : pas d'ombre sous les joueurs. Elle redevient visible, et le
  // masquage voulu passe par les MATÉRIAUX (l'éclairage sélectif de three, NodeMaterial.lightsNode) : tout ce qui n'est pas inscrit sous la clé
  // (tribunes, sièges, toits, public, mobilier) reçoit la liste des lumières de la nuit SANS elle ; la pelouse, ses abords, les cages et les
  // drapeaux (calque 1), les joueurs et le ballon (le défaut : toutes les lumières) restent sous elle. Le module de la skill n'est pas touché
  // (le Rondo de la skill a le même défaut : gpf-wasm/docs/adaptateur.md § 11).
  const copies = new Map();
  if (h === 'nuit' && lumiere.sun) {
    lumiere.sun.layers.enableAll();
    const sansCle = []; lumiere.group.traverse((o) => { if (o.isLight && o !== lumiere.sun) sansCle.push(o); });
    const L = lights(sansCle), sousCle = (o) => o.layers.isEnabled(1);
    // un matériau partagé entre un objet sous la clé et un autre : l'autre reçoit une copie (sinon la cage perdrait la clé avec le banc)
    const garde = new Set(); built.group.traverse((o) => { if ((o.isMesh || o.isLine) && sousCle(o)) for (const m of [].concat(o.material)) garde.add(m); });
    built.group.traverse((o) => {
      if (!(o.isMesh || o.isLine) || sousCle(o)) return;
      const ms = [].concat(o.material).map((m) => {
        if (!m?.isNodeMaterial) return m;
        if (!garde.has(m)) { m.lightsNode = L; return m; }
        if (!copies.has(m)) { const c = m.clone(); c.lightsNode = L; copies.set(m, c); }
        return copies.get(m);
      });
      o.material = Array.isArray(o.material) ? ms : ms[0];
    });
  }
  // L'OMBRE N'EST REÇUE QUE PAR LA PELOUSE (et ses abords) : aucune structure du stade ne projette (stadium-builder, lot 68 : archCast), seuls
  // les corps et le ballon le font, sur l'herbe. Le jour, sans le calque de la nuit, chaque tribune, chaque siège et les 16 672 spectateurs
  // compilaient une variante « reçoit l'ombre du soleil » et l'échantillonnaient à chaque fragment, pour rien — mesuré (essai du 3 octobre,
  // compteur info.memory.programs) : 59-67 programmes de jour contre 44-52 de nuit
  built.group.traverse((o) => { if (o.isMesh && o.name !== 'pelouse' && o.name !== 'abords') o.receiveShadow = false; });
  // LES TOITS QUI BOUCHENT (rondo-cameras.js, 26/09) : une caméra plus haute qu'un toit et de son côté le voit par-dessus — son dessus,
  // sans lumière, mangeait le bas du cadre ; masqué tant qu'elle y est
  const toits = []; built.group.traverse((o) => { if (o.isMesh && o.name === 'toit') toits.push(o); });
  return {
    model, built, lumiere, public: public_, stade: stade in STADES ? stade : 'bol', heure: h, nom: S.nom, capacite: model.capacity, check: chk,
    /** Inscrire un objet (joueur, ballon) sous la clé de nuit ; sans effet le jour. */
    light(o) { lumiere.light?.(o); },
    /** Chaque image : les toits selon la caméra, le public. */
    update(dt, cam) {
      if (cam) for (const o of toits) {
        const p = o.position, memeCote = Math.abs(p.z) > Math.abs(p.x) ? Math.sign(p.z) === Math.sign(cam.position.z) : Math.sign(p.x) === Math.sign(cam.position.x);
        o.visible = !(memeCote && cam.position.y > p.y - 0.5);
      }
      public_?.update(dt);
    },
    dispose() {
      public_?.dispose(); lumiere.dispose(); scene.remove(built.group); built.dispose(); for (const c of copies.values()) c.dispose();
    },
  };
}
