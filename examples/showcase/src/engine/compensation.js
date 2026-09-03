// compensation.js — LA CHAISE À QUATRE PIEDS, côté ATTAQUE (230). La bibliothèque (Moulin) : « une chaise à quatre pieds »
// — quand le latéral monte, un milieu DESCEND dans son couloir : la défense de repos garde ses quatre pieds, le contre
// adverse ne trouve pas le trou derrière le latéral. Mesuré AVANT (6 × 300 s) : latéral monté ≥ 12 m devant sa ligne sur
// 11 % des images en camp adverse, COMBLÉ (un non-défenseur à < 10 m de son poste de ligne) 24 % du temps.
// La loi : pour chaque EXTÉRIEUR de la ligne arrière (|z du spot| ≥ ext) monté de ≥ monte m devant sa LIGNE réelle (hystérésis
// hyst m une fois engagé), le PIVOT posté (le 6 ; pivot:false : le milieu le plus proche, rôle press : bonus m) voit son propre spot TIRÉ vers le spot vacant (part × posF, le placement est une note). Un milieu
// par latéral ; le porteur et un joueur en burst restent. Le patron Unity/Unreal : la loi ici, les nombres dans
// cfg.compensation, le rôle par son axe, l'homme par son facteur.
import { LIGNES, mapPostes, formationPour } from './formation.js';

/** @returns Map poste → [x, z, part] du spot vacant à tirer, ou null. */
export function compenserLateral(st, cfg, { atk, posted, spots, sg, formation, role, axe, d2 }) {
  const K = cfg.compensation; if (!K || !st.full) return null;
  if (K.transition !== true && st._momentK === 'transition') return null;   // en contre, tout le monde court : la chaise attend le jeu installé
  const ids = mapPostes(formation), L = LIGNES[formationPour(formation, true)] ?? [4, 3, 3], nD = L[0], nM = L[1];
  const byPost = {}; for (const q of st.players) if (q.team === atk && !q.keeper && q.down <= 0 && !q._sub) byPost[q.post] = q;
  const prev = st._compK?.[atk] ?? new Set(), now = new Set(), used = new Set(); let out = null;
  // le repère est la LIGNE RÉELLE (médiane des x de la ligne arrière), pas le spot : « devant son spot » était l'état normal du latéral (45 % des images), devant sa ligne est le débordement (11 %)
  const xs = ids.slice(0, nD).map((k) => byPost[k]).filter(Boolean).map((q) => q.p[0] * sg).sort((a, b) => a - b);
  if (!xs.length) return null;
  const ligneX = xs[Math.floor(xs.length / 2)];
  for (const k of ids.slice(0, nD)) {
    const sp = spots[k], d = byPost[k]; if (!sp || !d || Math.abs(sp[1]) < (K.ext ?? 10)) continue;
    const monte = d.p[0] * sg - ligneX, seuil = (K.monte ?? 12) - (prev.has(k) ? (K.hyst ?? 3) : 0);
    if (monte < seuil) continue;
    // …côté OPPOSÉ au ballon seulement (oppose) : côté ballon, le milieu descendu devenait la sortie arrière de l'ailier — le jeu recyclait (4 buts / 20 × 300 s, débordements −30 %) ; « le latéral opposé rentre, quatre en équilibre derrière »
    if (K.oppose !== false && Math.sign(sp[1]) === Math.sign(st.ball.p[2] || 1) && Math.abs(st.ball.p[2] - sp[1]) < (K.opposeM ?? 20)) continue;
    let best = null, bd = Infinity;
    const ok = (q) => q && !used.has(q.post) && posted.includes(q) && st.possession.carrier !== q.id && (q._pace?.until ?? -1) <= st.t;
    // LE MÊME descend tant qu'il le peut (mémoire par latéral) : sans elle, le compensateur qui lançait un appel était remplacé par le suivant — la cascade des milieux tirés (appels profonds 100 → 71, contre-appels 35 → 69)
    const memo = st._compWho?.[atk]?.[k];
    if (memo != null && ok(byPost[memo]) && d2(byPost[memo].p, [sp[0], 0, sp[1]]) < (K.memoR ?? 25)) best = memo;   // …tant qu'il est à portée du couloir (memoR) : de loin, il n'arrive jamais
    else for (const m of (K.pivot === true ? [ids[nD]] : ids.slice(nD, nD + nM))) {   // pivot:true : seul le 6 descend (mesuré : il est presque toujours slotter, rien n'est comblé)
      const q = byPost[m]; if (!ok(q)) continue;
      const dd = d2(q.p, [sp[0], 0, sp[1]]) - axe(role(q).press, 0, K.bonus ?? 6);
      if (dd < bd) { bd = dd; best = m; }
    }
    if (best == null) continue;
    used.add(best); now.add(k); ((st._compWho ??= {})[atk] ??= {})[k] = best;
    // …et il TIENT sa cadence d'appel pendant qu'il garde le couloir (pas de course profonde depuis le poste de latéral)
    const c = byPost[best]; if (c._pace) c._pace.next = Math.max(c._pace.next ?? 0, st.t + (K.tenue ?? 1));
    (out ??= new Map()).set(best, [sp[0], sp[1], Math.min(1, (K.part ?? 0.7) * (byPost[best].skill?.posF ?? 1))]);
  }
  (st._compK ??= {})[atk] = now;
  return out;
}

/** Le poste est-il un compensateur ACTIF (un latéral de son équipe est monté, il tient le couloir) ? Lu par
 *  l'accompagnement (phases.js) : le compensateur ne double pas, il ne vole pas le débordement du latéral. */
export function estCompensateur(st, team, post) {
  const K = st._compK?.[team], W = st._compWho?.[team]; if (!K || !K.size || !W) return false;
  for (const k of K) if (W[k] === post) return true;
  return false;
}
