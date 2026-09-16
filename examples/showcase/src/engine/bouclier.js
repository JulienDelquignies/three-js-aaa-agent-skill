// bouclier.js — LA TENUE DE BALLE DOS AU BUT (Animations_A_Faire § 9 = A10 ter, cfg.bouclier && st.full ; note 379).
// Le geste existait (motion-contact 'protection', joué par la scène sur la géométrie) mais la sim ne TENAIT pas : le porteur
// pressé dans le dos conduisait ou se retournait, le ballon libre entre ses touches à portée du presseur. Ici : le porteur
// PRESSÉ DANS LE DOS (un adversaire côté but, à ≤ pression m, derrière son regard — lui-même posé, v ≤ vMax), SANS APPUI
// (aucune passe au-dessus de la barre d'adoption du moment) TIENT : il s'arrête (match-sim : la cible est sa place), met son
// corps entre le ballon et le presseur (yawWant à l'opposé, le ballon PORTÉ au pied — rondo-sim), ni passe ni conduite, jusqu'à
// un APPUI (une passe passe la barre, après min s), une FAUTE (LA POUSSÉE DANS LE DOS : le presseur collé à < contact m plus
// de pousse s — un tirage par tenue, pFaute × aggrF × le rôle qui presse, cfg.loi12), le presseur qui LÂCHE le dos (relache),
// l'expiration (max s, ou la tenue forcée holdMax) ou la perte. Le duel d'épaule ne se joue pas sur un porteur qui tient
// (duel.chargeStep : dans le dos d'un homme posé, c'est la poussée, pas l'épaule). Événement 'bouclier' à la sortie (duree,
// issue, par). Contrat : la distance adversaire-ballon ne descend pas sous 0,6 m pendant la tenue. Clé absente : l'hier au bit.
import { hyp } from './hyp.js';
import { tirage } from './rng.js';
import { role } from './roles.js';

/** Le presseur DANS LE DOS du porteur : côté but adverse (cos ≥ dos — à l'entrée ; −1 : de tout côté), à ≤ r m ; null sinon. */
export function presseurDos(st, c, K, r, dos = K.dos ?? 0.3) {
  const g = st.pitch.attackGoal(c.team), gx = g.x - c.p[0], gz = 0 - c.p[2], gl = hyp(gx, gz) || 1;
  let best = null;
  for (const q of st.players) {
    if (q.team === c.team || q.keeper || q.down > 0 || q._sub) continue;
    const dx = q.p[0] - c.p[0], dz = q.p[2] - c.p[2], d = hyp(dx, dz);
    if (d > r || d < 1e-6 || (dx * gx + dz * gz) / (d * gl) < dos) continue;   // pas côté but : un duel de face ou de flanc, pas une tenue
    if (!best || d < best.d) best = { q, d, dx, dz };
  }
  return best;
}

/** L'APPUI : une passe au-dessus de la barre du moment qui n'est pas une remise ARRIÈRE (le receveur à plus de arriere m vers son
 *  propre but) — « sans appui devant » (§ 9) : la remise arrière reste possible à l'expiration, elle ne dispense pas de tenir. */
const appui = (st, c, K, choice, bar) => !!choice && choice.score > bar
  && !(K.arriere != null && choice.to && (st.players[choice.to.id].p[0] - c.p[0]) * Math.sign(st.pitch.attackGoal(c.team).x || 1) < -K.arriere);

/** La tenue d'une image : le dos au presseur, la poussée dans le dos jugée une fois par tenue. */
function tenir(st, c, P, K, cfg) {
  const B = c._bouclier, q = P.q;
  c.yawWant = Math.atan2(-P.dz, -P.dx);
  if (!(st.full && cfg.loi12) || st._faute || B.juge) return;
  if (P.d >= (K.contact ?? 0.75)) { B.colle = null; return; }
  B.colle ??= st.t;
  if (st.t - B.colle < (K.pousse ?? 0.6)) return;
  B.juge = true;
  const pF = Math.min(0.9, (K.pFaute ?? 0.3) * (q.skill?.aggrF ?? 1) * (0.8 + 0.4 * (role(q).press ?? 0.5)));
  if (tirage(st, 'duel', q.id, st.rnd2 ?? st.rnd ?? (() => 0.5))() >= pF) return;
  st._faute = { t: st.t, par: q.id, sur: c.id, team: c.team, p: [c.p[0], c.p[2]], kind: 'poussée', vSur: 0, dir: [c.v[0], c.v[1]] };
  st.events.push({ t: +st.t.toFixed(2), type: 'faute', by: q.id, sur: c.id, kind: 'poussée', p: [+c.p[0].toFixed(1), +c.p[2].toFixed(1)] });
}

/** true : le porteur TIENT cette image (aucune intention n'est adoptée — rondo-sim). bar : la barre d'adoption du moment. */
export function bouclierStep(st, c, cfg, choice, bar) {
  const K = cfg.bouclier, B = c._bouclier;
  const fin = (issue) => {
    st.events.push({ t: +st.t.toFixed(2), type: 'bouclier', by: c.id, par: B.par, duree: +(st.t - B.t0).toFixed(2), issue });
    c._bouclier = null; c._bouclierCd = st.t + (K.cd ?? 3); c._bouclierGrace = st.t + (K.grace ?? 0.8); c.yawWant = null;   // la grâce : pas de duel d'épaule dans le dos le temps de donner
    return false;
  };
  if (B) {
    if (st.t - B.t0 > (K.max ?? 2.0) + 1) { c._bouclier = null; c._bouclierCd = st.t + (K.cd ?? 3); return false; }   // la possession a changé de mains entre deux ticks (le bloc ne parle qu'au porteur) : la tenue est PERDUE, sans événement — le patron de la pausa
    if (st.ball.owner !== c.id || st.restart || c.down > 0 || c.act) return fin('perdu');
    if (st._faute && st._faute.sur === c.id) return fin('faute');
    const P = presseurDos(st, c, K, (K.pression ?? 1.3) + (K.hysteresis ?? 0.4), -1);   // le presseur ORBITE autour du corps : la tenue le suit (yawWant), de tout côté
    if (!P) return fin('relache');
    if ((Math.cos(c.yaw) * P.dx + Math.sin(c.yaw) * P.dz) / P.d > (K.face ?? 0.2)) return fin('deborde');   // passé devant le regard : le duel d'hier reprend
    const duree = st.t - B.t0;
    if (appui(st, c, K, choice, bar) && duree >= (K.min ?? 0.8)) return fin('appui');
    if (duree >= (K.max ?? 2.0) || st.hold >= (cfg.holdMax ?? 3) - 0.2) return fin('expiree');
    tenir(st, c, P, K, cfg);
    return true;
  }
  // LE PORTEUR EN CONDUITE N'EST PAS « owner » (le ballon vit entre deux touches) : la possession et le ballon au pied jugent
  // l'entrée (mesuré 2 × 300 s : 561 ticks sur 668 sans owner) ; à l'engagement le ballon libre est BLOQUÉ sous la semelle
  // (possess + 'control' arret-semelle, le patron de la pausa au pied) et le porté du bouclier le tient au pied.
  if (st.possession?.carrier !== c.id || st.phase !== 'carry' || (st.ball.owner != null && st.ball.owner !== c.id) || c.act || c.keeper || c.down > 0 || st.restart || (c._bouclierCd ?? -1) > st.t) return false;
  const dB = hyp(st.ball.p[0] - c.p[0], st.ball.p[2] - c.p[2]);
  if (dB > (K.pied ?? 1.2) || st.ball.p[1] > 0.5 || st.hold > (cfg.holdMax ?? 3) - (K.marge ?? 1.0) || (c.speed ?? 0) > (K.vMax ?? 4)) return false;
  if (appui(st, c, K, choice, bar)) return false;                                        // un appui devant : on donne
  const P = presseurDos(st, c, K, K.pression ?? 1.3);
  if (!P || (Math.cos(c.yaw) * P.dx + Math.sin(c.yaw) * P.dz) / P.d > -(K.face ?? 0.2)) return false;   // pas dans son dos : de face ou de flanc, un duel
  c._bouclier = { t0: st.t, par: P.q.id, colle: null, juge: false };
  if (st.ball.owner !== c.id) { const vB = hyp(st.ball.v[0], st.ball.v[2]); st.ball.possess(c.id); st.events.push({ t: +st.t.toFixed(2), type: 'control', by: c.id, tech: 'arret-semelle', foot: c.foot, surface: 'sole', speed: +vB.toFixed(1), settle: null }); }
  tenir(st, c, P, K, cfg);
  return true;
}
