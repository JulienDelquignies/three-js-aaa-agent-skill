// rondo-warp.js — LE WARP DE FRAPPE de la scène, extrait de Rondo.js (au plafond) au lot B1
// (« le pied sur le ballon », doc Branchements_Moteur_Animations § 1, note 370). Mesuré en page avant :
// 25 frappes, pied→ballon au tir p25/med/p75 = 0,23/0,30/0,35 m ; la cible du warp dépassait la
// jambe sur TOUTES (1,09-1,34 × A+B) et 132 images étaient refusées « non calibrées » (la première
// frappe de chaque clip × pied × rig n'avait pas de moyenne mobile). Deux réponses, sans moteur :
//   1. L'AMORCE : le clip GÉNÉRÉ connaît son contact — FK du profil à spec.contact, le pied en
//      repère modèle (= repère personnage : droite +X, haut +Y, avant −Z ; le gauche joue le
//      miroir du spec, sa clé « -gauche »). La moyenne mobile en ligne reprend par-dessus.
//   2. LA FENTE DU BASSIN : quand la cible enveloppée dépasse la portée de la jambe, le bassin
//      avance vers elle (hipsNudge, en monde) de ce qu'il faut pour la mettre à portée, borné
//      LUNGE.max — AVANT le verrou des pieds, qui re-plante l'appui sous le bassin déplacé (la
//      jambe d'appui s'étire, comme un vrai corps qui va chercher un ballon un peu loin). Le
//      reliquat au-delà reste écrêté (dette nommée : le placement sim du corps, § 1 du doc).
// Deux phases : strikeWarpPlan AVANT le verrou (calibration, amorce, plan, fente, cible), puis
// strikeWarpApply APRÈS (l'IK deux os de la jambe frappeuse) — l'ordre de la pile de Rondo.js.
import { warpEnvelope, planWarp, warpReach, twoBoneIK } from '../engine/strike-warp.js';
import { aimChildAt } from '../engine/foot-lock.js';
import { fkPose } from '../engine/motion-rig.js';
import { resolveDense, sampleQ, sampleHips } from '../engine/motion-strike.js';

export const LUNGE = { max: 0.15, drop: 0.06 };   // la fente : au plus 15 cm vers le ballon et 6 cm d'assise — au-delà, c'est le corps entier qui devait être plus près (sim)

const deny = (scene, k) => { scene._warpStats.denied[k] = (scene._warpStats.denied[k] ?? 0) + 1; };

/** L'amorce : le pied frappeur du spec JOUÉ (déjà en miroir pour le gauche) à son contact, en repère
 *  modèle — null pour un clip écrit à la main (pas de profil FK) ou un spec sans contact. */
export function seedContact(pl, spec, foot) {
  if (!spec?.keys || !pl.profile || !(spec.contact > 0)) return null;
  try {
    const { tracks, hipsPos } = resolveDense(spec);
    const w = fkPose(pl.profile, sampleQ(tracks, spec.contact), sampleHips(hipsPos, spec.contact));
    const p = w[foot === 'left' ? 'LeftFoot' : 'RightFoot']?.p;
    return p ? [p[0], p[1], p[2]] : null;
  } catch { return null; }
}

/** Phase 1 — avant le verrou. Pose la cible dans pl._warpT (null : rien à faire cette image). */
export function strikeWarpPlan(scene, pl) {
  pl._warpT = null; pl._lunge = 0;
  const a = pl.sim.act;
  if (a?.payload?.mains) return;                                   // un lancer n'a pas de pied de frappe (lot A9)
  if (!a || a.payload?.kind !== 'pass' || !a.payload.pick) { pl._warp = null; pl._warpCal = null; return; }
  const foot = a.payload.pick.foot === 'left' ? 'left' : 'right';
  const clKey = `${pl.rig}:${a.id}:${foot}`;
  const leg = pl.legs?.[foot], lens = pl.legLens?.[foot];
  if (!leg?.up || !leg.knee || !leg.foot || !lens) return;
  const V = scene._wv, F = scene._wf, T = scene._wt, H = scene._wh;

  // ---- CALIBRATION EN LIGNE. Le pied lu ICI est la pose PURE du clip de cette image (le mixer
  // ré-écrit chaque os à chaque update : le warp de l'image précédente est déjà effacé). On garde
  // la dernière image d'avant-contact ; au passage du tir, on interpole les deux images qui
  // encadrent l'instant exact et on verse en moyenne mobile — la vérité composée, mesurée sur le
  // jeu réel, par (clip × pied × rig). Un probe hors pile a été essayé : il mesurait une ombre.
  leg.foot.getWorldPosition(F);
  if (!a.fired) {
    V.copy(F); pl.model.worldToLocal(V);
    pl._warpCal = { t: a.t, local: [V.x, V.y, V.z] };
  } else if (pl._warpCal && pl._warpCal.t < a.anticipation) {
    // …à l'IMAGE DU TIR, pas interpolé à l'instant sim `anticipation` : la fusion (rondo-fusion)
    // re-cadence le swing pour que le contact du clip tombe SUR le tick du tir — la pose pure de
    // cette image EST le contact composé. L'interpolation d'hier (u ≈ 0,2 entre les deux images)
    // mesurait le pied 8-10 cm en arrière (amorce z −0,29 c. moyenne mobile −0,19, mesuré B1) : le
    // plan visait 10 cm trop loin et le pied traversait le ballon (cheville à 0,125 m du centre
    // pour un standoff de 0,18 ; creux médian −1 cm).
    pl._warpCal = null;
    V.copy(F); pl.model.worldToLocal(V);
    const at = [V.x, V.y, V.z];
    const prev = scene._contactLive.get(clKey);
    scene._contactLive.set(clKey, prev ? prev.map((v, i) => v + (at[i] - v) * 0.4) : at);
  }
  let cl = scene._contactLive.get(clKey);
  if (!cl) {
    cl = seedContact(pl, pl.gestureLayer?.spec, foot);            // l'AMORCE (B1)
    if (cl) { scene._contactLive.set(clKey, cl); scene._warpStats.amorces = (scene._warpStats.amorces ?? 0) + 1; }
    else { deny(scene, 'warp-non-calibré'); return; }
  }

  const env = warpEnvelope(a.t, a.anticipation);
  if (env <= 0) { pl._warp = null; return; }
  // le poids réel des jambes du geste module l'enveloppe : le warp corrige la jambe du geste
  // dans la proportion où le geste la possède (pleine dès ~0,85 — au contact le poids y est)
  const s = env * Math.min(1, (pl._wLegs ?? 1) / 0.85);
  if (s <= 1e-3) return;
  let plan = pl._warp;
  if (!a.fired) {
    // avant le contact : re-viser chaque image — les DEUX cibles convergent (le corps s'assied
    // sur l'ancre, le ballon porté converge vers le point de stance), l'offset converge avec
    V.fromArray(cl); pl.model.localToWorld(V);
    const b = scene.state.ball.p;
    plan = planWarp([V.x, V.z], [b[0], b[2]]);
    pl._warp = plan;
    if (plan.denied) deny(scene, plan.denied);
  }
  if (!plan || (plan.denied && plan.mag <= 0)) return;
  T.set(F.x + plan.offset[0] * s, F.y, F.z + plan.offset[1] * s);
  leg.up.getWorldPosition(H);
  const R = (lens.A + lens.B) * 0.995;
  // ---- LA FENTE DU BASSIN (B1) : la cible dépasse la jambe → le bassin avance vers elle, à
  // l'horizontale, du rayon manquant à cette hauteur (borné) ; le verrou re-plante l'appui après.
  {
    const dx = T.x - H.x, dz = T.z - H.z, h = H.y - T.y, r = Math.hypot(dx, dz), d = Math.hypot(r, h);
    if (d > R && pl.hipsNudge && r > 1e-3) {
      const rOk = R > Math.abs(h) + 1e-3 ? Math.sqrt(R * R - h * h) : 0;
      const lunge = Math.min(LUNGE.max, Math.max(0, r - rOk));
      if (lunge > 1e-3) {
        // …et le bassin DESCEND avec la fente (le genou d'appui plie) : à portée pleine, une cible
        // au sol se lit plus haut qu'elle n'est — mesuré cheville 0,17-0,21 m au tir pour un
        // ballon dont le centre est à 0,11 ; l'assise rapproche la hanche du plan du ballon
        pl.hipsNudge([dx / r * lunge, -LUNGE.drop * lunge / LUNGE.max, dz / r * lunge]);
        leg.up.getWorldPosition(H);                              // la hanche a bougé avec le bassin
        pl._lunge = lunge; scene._warpStats.fentes = (scene._warpStats.fentes ?? 0) + 1;
      }
    }
  }
  if (!warpReach([H.x, H.y, H.z], [T.x, T.y, T.z], lens.A, lens.B)) {
    // ÉCRÊTER, PAS REFUSER : le refus binaire annulait TOUTE la correction pile aux images où le
    // pied est le plus tendu — c'est-à-dire exactement AU CONTACT (mesuré au sweep : 62 % des
    // passes avec au moins un refus de portée dans ±0,05 s du contact). La fraction atteignable
    // vaut mieux que rien ; le reliquat reste une dette NOMMÉE au registre.
    const d = H.distanceTo(T);
    T.set(H.x + (T.x - H.x) * (R / d), H.y + (T.y - H.y) * (R / d), H.z + (T.z - H.z) * (R / d));
    deny(scene, 'warp-écrêté-portée');
  }
  if (!a.fired && scene._warpStats.mags.length < 4000) { scene._warpStats.n++; scene._warpStats.mags.push(plan.mag); }
  pl._warpT = [T.x, T.y, T.z]; pl._warpLeg = { leg, lens };
}

/** Phase 2 — après le verrou : l'autorité de la jambe frappeuse, même primitive que foot-lock
 *  (IK deux os, plan de pliage du genou = celui du clip), depuis la hanche telle qu'elle est. */
export function strikeWarpApply(scene, pl) {
  const t = pl._warpT;
  if (!t) return;
  const { leg, lens } = pl._warpLeg, H = scene._wh, K = scene._wk, M = scene._wm;
  leg.up.getWorldPosition(H); leg.knee.getWorldPosition(K);
  const sol = twoBoneIK([H.x, H.y, H.z], t, lens.A, lens.B, [K.x - H.x, K.y - H.y, K.z - H.z]);
  aimChildAt(leg.up, leg.knee, M.fromArray(sol.mid));
  aimChildAt(leg.knee, leg.foot, M.fromArray(sol.end));
}
