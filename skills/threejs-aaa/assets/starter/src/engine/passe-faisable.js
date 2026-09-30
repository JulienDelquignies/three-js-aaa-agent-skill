// passe-faisable.js — LA PASSE QUE LE CORPS PEUT DONNER (cfg.passeFaisable && st.full — retour utilisateur du 28/09 : « on a encore des
// passes dans des angles pas possibles »). Mesuré avant (diag-C, 4 × 900 s, 793 frappes) : 9 % de frappes physiquement impossibles —
// la une-touche sortait dans le DOS du receveur (37 / 72 à > 100° du regard, `deviation_prolonge` médiane 162°), le pressé frappait une
// passe-intérieur à 100-135° quand son corps n'avait tourné que 72-80° pendant l'armé, la passe en l'air pivotait le corps à 685-1 234 °/s,
// et AUCUN terme du choix ne lisait le regard ni la course. Le réel : ~90 % des passes partent à ±45° de la ligne des hanches ; au-delà de
// ~100° c'est la talonnade (rare, courte, douce) ou le joueur se tourne d'abord ; à pleine course on ne renverse pas le jeu d'un coup de pied.
// Quatre branchements (chacun lit ici sa sous-clé ; la clé absente : l'hier au bit) :
//   choosePass (rondo.js)        — coutAngle : la passe coûte son écart au regard (au-delà de libre °) et, lancé, son écart à la course ;
//   la porte pressée (strike-sim) — le geste le plus tournant ne couvre pas l'écart à tol ° près : pas de passe (le cerveau choisit autre chose) ;
//   la une-touche (premiere-intention) — la sortie à plus de uneTouche ° du regard n'est pas candidate ;
//   le pivot des passes en l'air (rondo-sim) — le corps tourne au plus lacet rad/s (pas de téléport).
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const D = Math.PI / 180;

/** L'écart (rad, ≥ 0) entre la direction (dx, dz) et le cap yaw. Pure. */
export function ecartCorps(dx, dz, yaw) { return Math.abs(wrap(Math.atan2(dz, dx) - yaw)); }

/** Le coût d'angle d'une passe de c vers lead (≥ 0), tempéré par la technique (gesteF) — 0 sans la sous-clé. Pure. */
export function coutAngle(st, c, lead, cfg) {
  const K = st.full && cfg.passeFaisable; if (!K || K.cout == null) return 0;
  const dx = lead[0] - c.p[0], dz = lead[2] - c.p[2]; if (Math.hypot(dx, dz) < 1e-3) return 0;
  const tF = Math.max(0.6, c.skill?.gesteF ?? 1);
  const eb = ecartCorps(dx, dz, c.yaw), v = Math.hypot(c.v[0], c.v[1]);
  const corps = K.cout * Math.max(0, eb - (K.libre ?? 45) * D) / (90 * D);
  const course = v > (K.vCourse ?? 3) ? (K.coutCourse ?? K.cout) * (v / 4) * Math.max(0, ecartCorps(dx, dz, Math.atan2(c.v[1], c.v[0])) - 90 * D) / (90 * D) : 0;
  return (corps + course) / tF;
}

/** La porte pressée : true si le meilleur geste (cap rad) ne couvre pas l'écart dY (rad). Pure. */
export function horsCorps(st, cfg, dY, cap) { const K = st.full && cfg.passeFaisable; return !!K && K.tol != null && dY > cap + K.tol * D; }

/** La une-touche : la sortie vers (tx, tz) depuis p est-elle dans le corps ? true sans la sous-clé. Pure. */
export function uneToucheDansCorps(st, p, tx, tz, cfg) { const K = st.full && cfg.passeFaisable; return !K || K.uneTouche == null || ecartCorps(tx - p.p[0], tz - p.p[2], p.yaw) <= K.uneTouche * D; }

/** Le pivot des passes en l'air : le cap vers want, borné à lacet rad/s ; want sans la sous-clé. Pure. */
export function lacetBorne(st, cfg, yaw, want, dt) { const K = st.full && cfg.passeFaisable; if (!K || K.lacet == null) return want; const d = wrap(want - yaw), m = K.lacet * dt; return Math.abs(d) <= m ? want : yaw + Math.sign(d) * m; }

/** (360, passeFaisable.contact °) LA PORTE AU CONTACT : le choix suppose que le corps tournera pendant l'armé (turn + rate × antic) ;
 *  mesuré (lot 359) : les passes PRESSÉES en « déviation » partaient à 104-123° du regard — le corps avait tourné moins que prévu.
 *  Au contact, au-delà de contact ° entre la frappe et le regard (hors talon, hors tir, hors mains), la passe n'est pas une passe :
 *  une TOUCHE DE FORTUNE — molle (≤ vPoke m/s) et bruitée (σ rad × dépassement / 60°). Renvoie { vMax, dPsi } ou null. */
export function porteContact(st, c, cfg, dirYaw, rnd, opt = {}) {
  const K = st.full && cfg.passeFaisable; if (!K || K.contact == null || opt.heel || opt.shot || opt.mains || opt.cross) return null;   // le centre se frappe en travers par nature : sa loi est sa stance
  const th = ecartCorps(Math.cos(dirYaw), Math.sin(dirYaw), c.yaw) / D; if (th <= K.contact) return null;
  const u = rnd(), g = (u + rnd() - 1) * 2;   // triangulaire [-2, 2] — deux tirages seedés
  st.events.push({ t: +st.t.toFixed(2), type: 'refus', kind: 'touche-fortune', by: c.id, deg: Math.round(th) });
  return { vMax: K.vPoke ?? 7, dPsi: g * (K.sigma ?? 0.25) * (th - K.contact) / 60 };
}

/** (360, passeFaisable.sigmaAngle) L'IMPRÉCISION PAIE L'ANGLE : la dispersion de passe (reception.sigmaPasse) ne lisait ni le regard ni
 *  la course — une passe à 90° de travers partait aussi juste qu'une passe face au jeu. Facteur 1 + k (1 − cos θ) / technique (gesteF),
 *  θ l'écart frappe↔regard : ×1,2 à 45°, ×1,8 à 90° (k 0,8, technique moyenne). 1 sans la sous-clé. Pure. */
export function sigmaAngleF(st, c, cfg, from, lead) {
  const K = st.full && cfg.passeFaisable; if (!K || K.sigmaAngle == null) return 1;
  const th = ecartCorps(lead[0] - from[0], lead[2] - from[2], c.yaw);
  return 1 + K.sigmaAngle * (1 - Math.cos(th)) / Math.max(0.6, c.skill?.gesteF ?? 1);
}
