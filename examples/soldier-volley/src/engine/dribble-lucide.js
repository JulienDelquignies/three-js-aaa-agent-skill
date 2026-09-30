// dribble-lucide.js — LE GRAND DRIBBLEUR CHOISIT SES MOMENTS (cfg.dribbleLucide && st.full — 30/09 : « les attributs sont-ils suffisamment
// présents pour différencier les joueurs ? » ; mesuré (4 × 30 min, 65 c. 50, effectifs notés) : la note de dribble était corrélée
// NÉGATIVEMENT au taux de réussite (−0,2 à −0,36) — les dribbleurs ≥ 72 tentaient 94 dribbles (les < 50 : 20) dans des situations
// PERDUES (marge μ −0,97 c. −0,37 pour les 62-72), 33 % de réussite, 52 % de dépossession. Le noyau de duel (noyau.js) les avantageait
// bien ; c'est la DÉCISION de tenter (skills-sim.dribM : rôle × volume × zone × spécialiste) qui ne lisait pas la situation.
// Le réel : l'élite dribble beaucoup, mais au bon moment (Messi, Doku : 55-65 % de réussite sur un volume élevé).
// Ici, au tick de décision, le porteur ESTIME le duel contre l'homme devant lui avec le même noyau que le contact (features → logits
// → probas) : il ne tente que si P(franchi) − P(dépossédé) ≥ seuil, seuil abaissé par le flair (le goût du risque, ± flair × 2 × 0,5)
// et relevé pour le lucide (decisions) ; aucun homme devant : la décision d'hier. Le meilleur dribbleur a une meilleure P dans la
// même situation : il tente PLUS souvent — mais plus à perte. Clé absente : l'hier au bit.
import { featuresDe, logitsDe, probasDe } from './noyau.js';
import { hyp } from './hyp.js';

/** × sur la fréquence de tentative (skills-sim.dribM) : 0 si le duel est perdu d'avance, 1 sinon. */
export function luciditeDribble(st, c, cfg) {
  const K = st.full && cfg.dribbleLucide, KN = cfg.noyau; if (!K || !KN) return 1;
  const prog = hyp(c.v[0], c.v[1]) > 0.8 ? Math.atan2(c.v[1], c.v[0]) : c.yaw;
  let q = null, dq = K.portee ?? 5;
  for (const r of st.players) { if (r.team === c.team || r.keeper || r.down > 0 || r.expulse || r._sub) continue;
    const dx = r.p[0] - c.p[0], dz = r.p[2] - c.p[2], d = hyp(dx, dz); if (d >= dq) continue;
    let a = Math.atan2(dz, dx) - prog; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
    if (Math.abs(a) <= (K.cone ?? 75) * Math.PI / 180) { q = r; dq = d; } }
  if (!q) return 1;
  const p = probasDe(logitsDe(featuresDe(st, c, q, KN, cfg), KN)), net = p[0] + p[1] + p[2] - (p[5] + p[6] + p[7]);
  const seuil = (K.seuil ?? -0.1) - (K.flair ?? 0.15) * ((c.persona?.flair ?? 0.5) - 0.5) * 2 + (K.lucide ?? 0.3) * ((c.skill?.decF ?? 1) - 1);
  c._dribNet = net;   // l'estimation (instrument)
  return net >= seuil ? 1 : 0;
}
