// LA COUCHE DE GESTE — la pose authorée, posée ABSOLUE sur le squelette, par membre, après le mixer.
//
// Née d'une chasse mesurée de bout en bout. Les gestes étaient joués en DELTAS ADDITIFS
// (makeClipAdditive) par-dessus la locomotion. L'algèbre de three est la même que celle du banc FK
// (delta = q_ref⁻¹ ⊗ q_t, appliqué base ⊗ delta — lu dans la source les deux côtés) ; ce qui
// diffère, c'est la BASE : le banc compose sur le REST du rig (celui contre lequel les specs sont
// écrites et prouvées), le jeu composait sur l'IDLE RETARGETÉ (Soldier → shanon), dont les locals
// portent 20° (cuisse), 32° (tibia), ~43° (bassin) d'écart au rest. Un delta est une GRANDE
// rotation valable près de son repère d'authoring : conjugué dans un repère tourné de 43°, le plan
// du balayage pivote — mesuré composé, la passe partait DERRIÈRE-HAUT (pied local z +0,55,
// y 0,43) quand le banc prouvait DEVANT-BAS (0,16 m). C'est le « beaucoup de talonnade » vu par
// l'utilisateur : des passes qui dessinaient des talonnades.
//
// La loi qui en sort : UN GESTE NE SE JOUE PAS EN DELTA — IL POSSÈDE SES OS, ABSOLUMENT.
//   pose_affichée(os, t) = slerp( pose_sous-jacente , q_rest(os) ⊗ q_spec(os, t) , poids(membre) )
// À poids 1, la pose affichée est PAR CONSTRUCTION celle que le banc de swing a validée — les deux
// instruments cessent d'être deux mondes. La base (idle, marche, course, n'importe quel retarget)
// n'a AUCUNE influence au contact : c'est la clause centrale du contrat, et c'est exactement la
// clause que le chemin additif ne pouvait pas tenir.
//
// Architecture (charte, lois 1-2) : une COUCHE, comme gaitLayer et foot-lock — écrite APRÈS le
// mixer, AVANT le warp de frappe et les verrous. L'horloge est celle de la SIM (act.t) : un seul
// instant, un seul contrat — le clip n'a plus d'horloge à lui qui puisse dériver. Les poids
// restent ceux des lois de composition (bras tout de suite, jambes fondues par l'arrivée) : cette
// couche ne décide pas QUAND le geste a les membres, seulement CE QUE les membres montrent.
//
// Pur : aucune dépendance rendu. Les « os » sont n'importe quel objet {quaternion:{x,y,z,w,set}} —
// three-compatible par structure, prouvable en node par des objets nus.

import { resolveTracks } from './animkit.js';

/** Les deux étages du corps — UNE seule définition (la scène et la couche lisent la même). */
export const UP_BONES = /Shoulder|Arm|ForeArm|Hand|Spine|Neck|Head/;
export const LEG_BONES = /Hips|UpLeg|Leg|Foot|ToeBase/;

const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qSlerp = (a, b, t) => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  if (d < 0) { d = -d; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let s0, s1;
  if (d < 0.9995) {
    const th = Math.acos(Math.min(1, d)), sth = Math.sin(th);
    s0 = Math.sin((1 - t) * th) / sth; s1 = Math.sin(t * th) / sth;
  } else { s0 = 1 - t; s1 = t; }
  const out = [a[0] * s0 + bx * s1, a[1] * s0 + by * s1, a[2] * s0 + bz * s1, a[3] * s0 + bw * s1];
  const n = hyp(out[0], out[1], out[2], out[3]) || 1;
  return [out[0] / n, out[1] / n, out[2] / n, out[3] / n];
};

/** Échantillonner la pose authorée à t : slerp entre les clés de chaque os (l'interpolation même
 *  du banc de swing — 240 Hz y a été prouvé continu). Clampe aux bornes du clip. */
export function samplePose(tracks, t) {
  const out = {};
  for (const [bone, keys] of Object.entries(tracks)) {
    if (!keys.length) continue;
    if (t <= keys[0].t) { out[bone] = keys[0].q; continue; }
    if (t >= keys[keys.length - 1].t) { out[bone] = keys[keys.length - 1].q; continue; }
    let i = 1; while (keys[i].t < t) i++;
    const a = keys[i - 1], b = keys[i];
    out[bone] = qSlerp(a.q, b.q, (t - a.t) / Math.max(1e-9, b.t - a.t));
  }
  return out;
}

/**
 * La couche d'un acteur.
 * @param bones Map nom-canonique → os ({quaternion}) — les os du CLONE joué
 * @param rest  Map nom-canonique → quat [x,y,z,w] OU os — le REST du rig (le template jamais animé
 *              de squad.js : exactement le repère du banc). Un rest pris sur un squelette déjà posé
 *              est une contamination — d'où le template, pas le clone.
 */
export class GestureLayer {
  constructor({ bones, rest, hipsWrite = null }) {
    this.bones = bones;
    this.rest = new Map();
    for (const [name, r] of rest) {
      const q = r.quaternion ? [r.quaternion.x, r.quaternion.y, r.quaternion.z, r.quaternion.w] : r;
      this.rest.set(name, [q[0], q[1], q[2], q[3]]);
    }
    // le BASSIN VOYAGE (root motion des specs : tacle, plongeon…) — la scène fournit l'écriture
    // (la conversion mètres-personnage → local-parent demande les matrices du modèle, qu'une
    // couche pure ne possède pas). Sans écrivain : les gestes couchés restent debout — mesuré,
    // le tacleur « glissait » à hauteur de hanches.
    this.hipsWrite = hipsWrite;
    this.spec = null; this.tracks = null; this.hipsPos = null; this.duration = 0; this.missing = [];
  }

  /** Prendre un geste. Renvoie { missing } — un os authoré absent du rig est un membre qui ne
   *  bougera pas : ça se DIT (la leçon du repli silencieux : 57 % des gestes jamais visibles). */
  begin(spec) {
    const r = resolveTracks(spec);
    this.spec = spec; this.tracks = r.tracks; this.hipsPos = r.hipsPos; this.duration = spec.duration ?? 0;
    // SÉMANTIQUE ABSOLUE VRAIE : pose(t) = rest ⊗ q_spec(t) — ce qui est écrit EST ce qui
    // s'affiche. La première version conjuguait par q_spec(0)⁻¹ « comme le banc » : pour les
    // JAMBES c'était un no-op (leur clé 0 est l'identité), mais pour les BRAS la clé 0 vaut
    // BASE_POSE — la conjugaison ANNULAIT la base des bras, et les valeurs authorées ne
    // s'affichaient jamais (mesuré composé : bras en croix à hauteur d'épaule sur 94-100 % des
    // images de geste pendant que les specs écrivaient un balancier). Deux instruments, une
    // sémantique : le banc FK compose désormais pareil.
    this.missing = Object.keys(r.tracks).filter((b) => !this.bones.has(b) || !this.rest.has(b));
    return { missing: this.missing };
  }

  end() { this.spec = null; this.tracks = null; this.hipsPos = null; }

  get active() { return !!this.tracks; }

  /**
   * Poser la pose du geste à l'instant t (l'horloge de la SIM), pondérée par étage.
   * À w = 1 : os.quaternion = q_rest ⊗ q_spec(t) — la pose du banc, quelle que soit la base.
   * À w = 0 : la base (mixer/locomotion) reste intacte. Entre : slerp — continu en t ET en w.
   */
  apply(t, wLegs, wUp) {
    if (!this.tracks) return;
    const tc = Math.max(0, Math.min(this.duration, t));
    const pose = samplePose(this.tracks, tc);
    for (const [name, q] of Object.entries(pose)) {
      const w = UP_BONES.test(name) ? wUp : wLegs;
      if (w <= 1e-4) continue;
      const bone = this.bones.get(name), rest = this.rest.get(name);
      if (!bone || !rest) continue;
      const target = qMul(rest, q);
      const bq = bone.quaternion;
      const out = w >= 1 ? target : qSlerp([bq.x, bq.y, bq.z, bq.w], target, w);
      bq.set(out[0], out[1], out[2], out[3]);
    }
    // le déplacement du bassin (mètres personnage [droite, haut, avant], lerp entre clés) — écrit
    // par la scène, pondéré comme les jambes : un tacle à poids plein COUCHE le corps
    if (this.hipsPos && this.hipsWrite && wLegs > 1e-4) {
      const ks = this.hipsPos;
      let d;
      if (tc <= ks[0].t) d = ks[0].p;
      else if (tc >= ks[ks.length - 1].t) d = ks[ks.length - 1].p;
      else {
        let i = 1; while (ks[i].t < tc) i++;
        const a = ks[i - 1], b = ks[i], u = (tc - a.t) / Math.max(1e-9, b.t - a.t);
        d = [a.p[0] + (b.p[0] - a.p[0]) * u, a.p[1] + (b.p[1] - a.p[1]) * u, a.p[2] + (b.p[2] - a.p[2]) * u];
      }
      this.hipsWrite(d, wLegs);
    }
  }
}

/**
 * CONTRAT. La clause reine est celle que le chemin additif ne pouvait pas tenir : à poids plein,
 * la BASE N'A AUCUNE INFLUENCE — la pose affichée est celle du banc, que le squelette sorte d'un
 * idle natif, d'un retarget tordu de 43°, ou d'une course. verify-gesture-layer.mjs porte les
 * sabotages (dont la reconstitution exacte du bug : le delta conjugué dans le repère tourné).
 */
export function checkGestureLayer() {
  const issues = [];
  const rest = [0, -0.02, 0.999, 0.042];                       // la cuisse shanon (~180° Z), mesurée
  const spec = { duration: 0.4, contact: 0.2, keys: [
    { t: 0, pose: {} },
    { t: 0.2, pose: { RightUpLeg: [-40, -20, 0] } },
    { t: 0.4, pose: {} },
  ] };
  const mkBone = (q) => ({ quaternion: { x: q[0], y: q[1], z: q[2], w: q[3], set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; } } });
  const norm = (q) => { const n = hyp(...q) || 1; return q.map((v) => v / n); };
  const qOf = (b) => [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w];
  const angle = (a, b) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]))) * 180 / Math.PI;
  const attendu = (layer, t) => qMul(layer.rest.get('RightUpLeg'), samplePose(layer.tracks, t).RightUpLeg);
  // deux bases très différentes : l'os au rest, et l'os dans un repère tourné de 43° (le bug vécu)
  const twisted = norm(qMul([0, Math.sin(0.375), 0, Math.cos(0.375)], rest));
  const b1 = mkBone(rest), b2 = mkBone(twisted);
  const L1 = new GestureLayer({ bones: new Map([['RightUpLeg', b1]]), rest: new Map([['RightUpLeg', rest]]) });
  const L2 = new GestureLayer({ bones: new Map([['RightUpLeg', b2]]), rest: new Map([['RightUpLeg', rest]]) });
  L1.begin(spec); L2.begin(spec);
  L1.apply(0.2, 1, 1); L2.apply(0.2, 1, 1);
  if (angle(qOf(b1), qOf(b2)) > 0.01) issues.push('à poids 1 la base influence encore la pose — c\'est le bug additif reconstitué');
  if (angle(qOf(b1), attendu(L1, 0.2)) > 0.01) issues.push('à poids 1 la pose n\'est pas rest ⊗ spec — ce n\'est plus celle que le banc valide');
  // à poids 0, la base est intacte
  const b3 = mkBone(twisted);
  const L3 = new GestureLayer({ bones: new Map([['RightUpLeg', b3]]), rest: new Map([['RightUpLeg', rest]]) });
  L3.begin(spec); L3.apply(0.2, 0, 0);
  if (angle(qOf(b3), twisted) > 1e-6) issues.push('à poids 0 la couche touche quand même les os');
  // un os authoré absent du rig se DÉCLARE
  const L4 = new GestureLayer({ bones: new Map(), rest: new Map() });
  const r4 = L4.begin(spec);
  if (!r4.missing.includes('RightUpLeg')) issues.push('os manquant silencieux — le membre ne bougera pas et personne ne le sait');
  return { ok: issues.length === 0, issues };
}
import { hyp } from './hyp.js';
