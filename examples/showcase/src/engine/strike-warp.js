// LE WARP DE FRAPPE — l'alignement composé du pied sur le ballon, en loi de moteur.
//
// Le problème qu'il ferme, mesuré à l'audit membre-par-membre : le banc de swing prouve le CLIP
// (vitesse, pic sur le contact, surface écrite), le porté prouve le BALLON (il converge vers le
// point de stance), mais personne ne prouvait leur RENCONTRE — le pied FK du clip et le ballon
// porté se croisaient à 0,19–0,56 m selon l'épisode, parce qu'une pose authorée en espace
// personnage ne sait rien du monde. Unity/Unreal appellent ça Motion Warping ; ici c'est une
// autorité de plus dans la chaîne du rendu (charte, loi 1 : pendant l'armé, le pied frappeur
// n'avait AUCUNE autorité de fin — foot-lock se retire sur gestureHold), et elle obéit aux
// mêmes lois que toutes les autres :
//
//   1. LE CONTACT APPARTIENT AU CLIP. L'enveloppe vaut exactement 1 à l'instant de contact avec
//      une PENTE NULLE des deux côtés (C¹) : le warp corrige la POSITION, jamais la vitesse —
//      la vitesse au contact est celle que le banc de swing a prouvée. Un warp qui freine ou
//      accélère le pied au contact re-fabrique la caresse qu'on vient de tuer.
//   2. BORNÉ, ET LE REFUS EST NOMMÉ. L'offset est plafonné (warpMax) ; au-delà, la correction
//      est écrêtée ET la cause versée au registre ('warp-hors-borne') — une dette mesurable,
//      jamais un téléport silencieux. Si le registre se remplit, le bug est EN AMONT (stance ou
//      clip), et le registre le dit.
//   3. LA SURFACE S'ARRÊTE À LA SURFACE. La cible n'est pas le centre du ballon : c'est le point
//      d'arrêt (standoff) sur le côté d'où le pied authoré arrive — un pied warpe VERS le ballon,
//      pas DEDANS. La hauteur reste au clip (le banc la borne à 30 cm) : le warp est planaire.
//   4. APRÈS LE CONTACT, ON REND LA JAMBE. Le ballon part ; l'offset est GELÉ à l'instant du tir
//      (sinon le pied chasserait un ballon en vol) et l'enveloppe redescend en C¹ vers
//      l'accompagnement authoré.
//
// Pur et sans dépendance (vecmath/procedural) : la scène applique le résultat sur les os
// (twoBoneIK + aimChildAt — les mêmes primitives que foot-lock), en DERNIER dans la chaîne :
// mixer → poids des étages → warp. Les contraintes du monde se projettent en dernier (loi 2).

import { twoBoneIK } from './procedural.js';

/** Les bornes du warp — des actuateurs, pas des vœux (charte, loi 3). */
export const WARP = {
  winIn: 0.4,      // fraction FINALE de l'armé pendant laquelle le warp monte (0,4 = dernier 40 %)
  out: 0.12,       // s — la descente après contact (rendre la jambe à l'accompagnement)
  standoff: 0.18,  // m — distance d'arrêt du nœud cheville au CENTRE du ballon (la surface touche)
  warpMax: 0.4,    // m — correction maximale ; au-delà : écrêté + refus nommé
};

const clamp01 = (u) => Math.max(0, Math.min(1, u));
const smooth = (u) => { const t = clamp01(u); return t * t * (3 - 2 * t); };

/**
 * L'ENVELOPPE : 0 → 1 pendant la fin de l'armé, 1 PILE au contact, → 0 après.
 * smoothstep des deux côtés ⇒ pente nulle à t = antic (C¹) : au contact, le warp est IMMOBILE —
 * il ne verse aucune vitesse dans le pied, ni pour, ni contre. C'est la clause centrale du banc.
 * @param t      temps écoulé du geste (s) — `act.t`
 * @param antic  instant de contact (s) — `act.anticipation`
 */
export function warpEnvelope(t, antic, { winIn = WARP.winIn, out = WARP.out } = {}) {
  if (!(antic > 0)) return 0;
  const t0 = antic * (1 - winIn);
  if (t <= t0) return 0;
  if (t <= antic) return smooth((t - t0) / Math.max(1e-6, antic - t0));
  return 1 - smooth((t - antic) / Math.max(1e-6, out));
}

/**
 * LE PLAN : où le pied DOIT finir, et ce qu'on a le droit de corriger.
 * `expectedXZ` — où la pose de contact du clip mettra le nœud cheville (sondé au chargement,
 * transformé par la matrice VIVANTE du modèle : l'erreur d'approche se corrige toute seule à
 * mesure que le corps s'assied sur l'ancre). `ballXZ` — le ballon porté (il converge vers le
 * point de stance : les deux cibles convergent ensemble, le gel au tir fige le reste).
 * @returns {{offset:[dx,dz], mag, full, denied}} offset À PLEINE enveloppe ; `full` = la
 *          correction demandée avant écrêtage ; `denied` = cause nommée ou null.
 */
export function planWarp(expectedXZ, ballXZ, { standoff = WARP.standoff, warpMax = WARP.warpMax } = {}) {
  const dx = expectedXZ[0] - ballXZ[0], dz = expectedXZ[1] - ballXZ[1];
  const d = Math.hypot(dx, dz);
  // dégénéré : le pied authoré tombe SUR le centre du ballon — aucune direction d'approche à
  // corriger (et un clip pareil est faux en amont) : on ne warpe pas au hasard, on le DIT.
  if (d < 1e-6) return { offset: [0, 0], mag: 0, full: 0, denied: 'warp-degenere' };
  const ux = dx / d, uz = dz / d;
  let ox = (ballXZ[0] + ux * standoff) - expectedXZ[0];
  let oz = (ballXZ[1] + uz * standoff) - expectedXZ[1];
  const full = Math.hypot(ox, oz);
  let denied = null;
  if (full > warpMax) { denied = 'warp-hors-borne'; const k = warpMax / full; ox *= k; oz *= k; }
  return { offset: [ox, oz], mag: Math.min(full, warpMax), full, denied };
}

/** LES BORNES DU GANT — le DEUXIÈME consommateur du warp de contact (la preuve que c'est une
 *  capacité moteur, pas un cas spécial de la frappe — Unreal/Unity ont UN Motion Warping pour
 *  tous les membres). La fenêtre couvre presque toute la détente (winIn 0,75 : un plongeon EST
 *  une extension), la borne vaut l'envergure du bras (au-delà, la portée IK écrête et nomme). */
export const HAND_WARP = {
  winIn: 0.75,     // fraction finale de la détente pendant laquelle le gant monte vers le ballon
  out: 0.15,       // s — après la résolution, on rend le bras au clip
  standoff: 0.16,  // m — le gant s'arrête à la SURFACE du ballon (paume, pas poignet traversant)
  warpMax: 1.6,    // m — au-delà de l'envergure : la portée IK écrête au réel, ceci n'est que le
                   // plafond de santé (mesuré à 1,1 : la borne mordait sur des arrêts LÉGAUX —
                   // main authorée à ~2 m d'un ballon à portée sim — et volait 0,5 m de pointage)
};

/**
 * LE PLAN EN 3D — la même loi que planWarp, la hauteur en plus : un gant SE LÈVE vers un ballon
 * qui vole (le pied de frappe reste planaire, sa hauteur appartient au clip — le banc la borne).
 * Mêmes quatre lois : surface (standoff le long de l'approche), borné + refus nommé, dégénéré
 * nommé, et l'enveloppe C¹ fait le reste.
 */
export function planWarp3(expected, ball, { standoff = HAND_WARP.standoff, warpMax = HAND_WARP.warpMax } = {}) {
  const dx = expected[0] - ball[0], dy = expected[1] - ball[1], dz = expected[2] - ball[2];
  const d = Math.hypot(dx, dy, dz);
  if (d < 1e-6) return { offset: [0, 0, 0], mag: 0, full: 0, denied: 'warp-degenere' };
  const k = standoff / d;
  let ox = (ball[0] + dx * k) - expected[0];
  let oy = (ball[1] + dy * k) - expected[1];
  let oz = (ball[2] + dz * k) - expected[2];
  const full = Math.hypot(ox, oy, oz);
  let denied = null;
  if (full > warpMax) { denied = 'warp-hors-borne'; const q = warpMax / full; ox *= q; oy *= q; oz *= q; }
  return { offset: [ox, oy, oz], mag: Math.min(full, warpMax), full, denied };
}

/**
 * LA PORTÉE : une cible que la jambe ne peut pas atteindre ne se force pas — on n'étire pas un
 * genou (même garde-fou que foot-lock : au-delà de 99,5 % de l'extension, on REND le pied au clip
 * et on nomme le refus). A = cuisse (hanche→genou), B = tibia (genou→cheville), en mètres monde.
 */
export function warpReach(hipW, targetW, A, B) {
  const d = Math.hypot(targetW[0] - hipW[0], targetW[1] - hipW[1], targetW[2] - hipW[2]);
  return d <= (A + B) * 0.995;
}

/** twoBoneIK re-exporté : la scène résout la jambe avec la MÊME primitive que foot-lock. */
export { twoBoneIK };

/**
 * CONTRAT. Chaque clause est une façon dont « le pied rencontre le ballon » redevient faux en
 * silence. verify-strike-warp.mjs porte les sabotages ; ceci est l'auto-test embarqué (la scène
 * le verse au rapport, comme checkApproach).
 */
export function checkStrikeWarp(cfg = WARP) {
  const issues = [];
  const eps = 0.005;
  const antic = 0.38;
  // 1. le contact appartient au clip : enveloppe = 1 pile au contact, pente nulle des deux côtés
  if (Math.abs(warpEnvelope(antic, antic, cfg) - 1) > 1e-9) issues.push('l\'enveloppe ne vaut pas 1 au contact');
  if (Math.abs(warpEnvelope(antic - eps, antic, cfg) - 1) > 0.01) issues.push('pente non nulle AVANT le contact : le warp verse de la vitesse dans la frappe');
  if (Math.abs(warpEnvelope(antic + eps, antic, cfg) - 1) > 0.01) issues.push('pente non nulle APRÈS le contact : le warp freine l\'accompagnement');
  // 2. le warp dort avant sa fenêtre et rend la jambe après
  if (warpEnvelope(antic * (1 - cfg.winIn) - 1e-3, antic, cfg) !== 0) issues.push('le warp tire avant sa fenêtre');
  if (warpEnvelope(antic + cfg.out + 1e-3, antic, cfg) !== 0) issues.push('le warp ne rend pas la jambe après le contact');
  // 3. la surface s'arrête à la surface : cible à standoff du centre, jamais dedans
  const p = planWarp([0.5, 0], [0, 0], cfg);
  const land = Math.hypot(0.5 + p.offset[0], p.offset[1]);
  if (Math.abs(land - cfg.standoff) > 1e-6) issues.push(`la cible n'est pas au standoff (${land.toFixed(3)} m vs ${cfg.standoff})`);
  // 4. borné, et le refus est nommé
  const far = planWarp([cfg.warpMax + cfg.standoff + 0.3, 0], [0, 0], cfg);
  if (far.mag > cfg.warpMax + 1e-9) issues.push('la borne ne mord pas');
  if (far.denied !== 'warp-hors-borne') issues.push('écrêtage silencieux : la borne doit NOMMER son refus');
  // 5. dégénéré sans NaN
  const deg = planWarp([0, 0], [0, 0], cfg);
  if (!Number.isFinite(deg.offset[0]) || deg.denied !== 'warp-degenere') issues.push('cas dégénéré non nommé (pied sur le centre du ballon)');
  // 6. LE PLAN 3D (le gant) obéit aux mêmes lois : surface en 3D, borne nommée, dégénéré nommé
  const h = planWarp3([0, 1.6, 0.5], [0, 1.0, 0]);
  const land3 = Math.hypot(0 + h.offset[0] - 0, 1.6 + h.offset[1] - 1.0, 0.5 + h.offset[2] - 0);
  if (Math.abs(land3 - HAND_WARP.standoff) > 1e-6) issues.push(`le gant ne s'arrête pas à la surface (${land3.toFixed(3)} m vs ${HAND_WARP.standoff})`);
  const far3 = planWarp3([HAND_WARP.warpMax + 2, 0, 0], [0, 0, 0]);
  if (far3.mag > HAND_WARP.warpMax + 1e-9 || far3.denied !== 'warp-hors-borne') issues.push('la borne 3D ne mord pas ou ne se nomme pas');
  const deg3 = planWarp3([1, 1, 1], [1, 1, 1]);
  if (!Number.isFinite(deg3.offset[1]) || deg3.denied !== 'warp-degenere') issues.push('dégénéré 3D non nommé');
  return { ok: issues.length === 0, issues };
}
