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
