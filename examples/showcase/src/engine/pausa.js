// LA PAUSA (253, cfg.pausa && st.full — la carte du book, Bible 07 §7 : « une désynchronisation volontaire : le
// porteur ralentit pour laisser les courses de ses partenaires prendre de l'avance sur les ajustements des
// défenseurs », 3-6 par match de 1,5-3,5 s ; mesuré avant 0,5). Une DÉCISION, pas une lenteur : le porteur au calme
// (ttp ≥ seuil), dans la zone [55 ; 88] % du terrain, avec ≥ engages adversaires lancés vers le ballon (v > 2 m/s)
// et UNE COURSE partenaire en cours pas encore servable, TIENT — il ne donne pas, il ne conduit pas — jusqu'à ce que
// la course devienne l'option (servie), que la pression arrive (ttp < garde), que la course meure ou que max s
// passent (expirée). Le seuil d'entrée suit le TEMPO tactique (posé : audacieux, 1,3 s ; vif : prudent, 1,8 s), le
// rôle (tenue) et le sang-froid (composureF). L'événement `pausa` porte durée, issue et le GAIN de l'option
// (score à la sortie / score à l'entrée ≥ gainMin = la pausa a produit de la valeur ; sinon c'est de l'hésitation,
// comptée comme telle). Clé absente : l'adoption d'hier au bit.
import { hyp } from './hyp.js';
import { role } from './roles.js';
import { axe as axeTac, tac as tacDe } from './tactics.js';

/** Le temps avant la pression (s) : le presseur le plus prompt, distance moins le contact sur sa vitesse de fermeture. */
export function ttpDe(st, c, K) {
  let best = Infinity;
  for (const q of st.players) {
    if (q.team === c.team || q.keeper || q.down > 0) continue;
    const dx = c.p[0] - q.p[0], dz = c.p[2] - q.p[2], d = hyp(dx, dz);
    if (d > (K.rayon ?? 12)) continue;
    const ferme = Math.max(0.3, (q.v[0] * dx + q.v[1] * dz) / (d || 1));
    best = Math.min(best, Math.max(0, d - (K.contact ?? 1.0)) / ferme);
  }
  return best;
}

/** Les adversaires ENGAGÉS : lancés vers le ballon à plus de seuil m/s. */
export function engages(st, c, seuil = 2) {
  let n = 0;
  for (const q of st.players) {
    if (q.team === c.team || q.keeper || q.down > 0) continue;
    const dx = st.ball.p[0] - q.p[0], dz = st.ball.p[2] - q.p[2], dl = hyp(dx, dz) || 1;
    if ((q.v[0] * dx + q.v[1] * dz) / dl > seuil) n++;
  }
  return n;
}

/** true : le porteur TIENT cette image (aucune intention n'est adoptée). */
export function pausaStep(st, c, cfg, choice) {
  const K = cfg.pausa, P = c._pausa;
  const ttp = ttpDe(st, c, K);
  if (P && (st.hold + 0.05 < st.t - P.t0 || st.t - P.t0 > (K.max ?? 2.5) + 2)) { c._pausa = null; return false; }   // la possession a changé de mains depuis : la pausa est PERDUE, sans événement (le journal ne compte que les tenues vécues)
  if (P) {
    const duree = st.t - P.t0, coureur = st.players[P.run];
    const issue = choice && choice.to?.id === P.run ? 'servie' : ttp < (K.garde ?? 0.9) ? 'pression'
      : duree > (K.max ?? 2.5) || st.hold >= (cfg.holdMax ?? 3) + 1 ? 'expiree' : !coureur || (coureur._runT ?? -1) <= st.t ? 'course-morte' : null;
    if (!issue) return true;
    c._pausa = null;
    const gain = choice && P.score > 0 ? choice.score / P.score : null;
    st.events.push({ t: +st.t.toFixed(2), type: 'pausa', by: c.id, duree: +duree.toFixed(2), issue, ...(gain != null ? { gain: +gain.toFixed(2) } : {}), ...(gain != null && gain >= (K.gainMin ?? 1.15) ? { valeur: true } : {}) });
    return false;
  }
  if (st.hold > (cfg.holdMax ?? 3) - (K.marge ?? 1.0)) return false;
  const course = st.players.find((m) => m.team === c.team && m.id !== c.id && m.down <= 0 && (m._runT ?? -1) > st.t + (K.courseMin ?? 0.5));
  if (!course || (choice && choice.to?.id === course.id)) return false;
  const sgn = -st.pitch.ownGoal(c.team).sign, adv = (c.p[0] * sgn + st.pitch.hx) / (2 * st.pitch.hx);
  if (adv < (K.zone?.[0] ?? 0.55) || adv > (K.zone?.[1] ?? 0.88)) return false;
  if (engages(st, c, K.engage ?? 2) < (K.engages ?? 2)) return false;
  const seuil = axeTac(tacDe(st, c.team).tempo, K.ttpPose ?? 1.3, K.ttpVif ?? 1.8) * axeTac(role(c).tenue ?? 0.5, K.tenueBas ?? 1.25, K.tenueHaut ?? 0.8) / (c.skill?.composureF ?? 1);
  if (ttp < seuil) return false;
  c._pausa = { t0: st.t, run: course.id, score: choice?.score ?? 0 };
  return true;
}
