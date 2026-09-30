// reprise-physique.js — UN BALLON QUI ARRIVE FORT N'EST PAS UNE TÊTE (cfg.reprisePhysique && st.full — retour utilisateur du 28/09 :
// « le gardien fait des dégagements dans la tête des attaquants et ça fait but alors que l'attaquant touche même pas le ballon »).
// Mesuré (diag-A, 18 800 s, 12 buts) : 3 buts sur 12 sont des « reprises » à < 0,25 s d'une frappe — la volée du gardien à 23-25 m/s
// reprise de la tête AU BUT par un attaquant à 0,86-0,98 m du ballon, sans temps de réaction ; la tête/volée au but REMPLAÇAIT la
// vitesse du ballon par une frappe cadrée neuve (tete.js : strike vers un point du cadre), quel que soit le ballon qui arrivait.
// Le réel : un ballon de 20+ m/s qui arrive sur un joueur n'a pas le temps d'être joué — il le PREND (visage, épaule, poitrine) et
// repart mou dans une direction de hasard ; la tête/volée au but se joue AU ballon (la tête à ≤ portée m, pas à un mètre).
// Deux portes (clé absente : l'hier au bit) :
//   subie   — ballon plus rapide que vMax m/s et qui VIENT vers le joueur : contact subi (rebond × garde, ±cone ° autour du renvoi) ;
//   porteeBut — la tête/volée AU BUT exige le ballon à ≤ portee m du joueur ; sinon elle ne se tente pas au but.
import { tirage } from './rng.js';
import { hyp } from './hyp.js';

/** Le contact subi : applique le rebond et renvoie true, ou false (la tête/volée d'hier). */
export function repriseSubie(st, j, cfg) {
  const K = st.full && cfg.reprisePhysique; if (!K) return false;
  const v = st.ball.v, sp = hyp(v[0], v[2]); if (sp < (K.vMax ?? 15)) return false;
  const dx = j.p[0] - st.ball.p[0], dz = j.p[2] - st.ball.p[2], d = hyp(dx, dz) || 1e-3;
  if ((v[0] * dx + v[2] * dz) / (sp * d) < (K.vient ?? 0.3)) return false;   // il ne vient pas sur lui : le ballon le dépasse (la tête d'hier)
  // …ET IL N'A PAS EU LE TEMPS DE LE VOIR VENIR : frappé il y a moins de tMin s (distance depuis la frappe / vitesse) — un centre de 18 m/s
  // attaqué de loin se joue (la tête d'hier), la volée du gardien reçue à 2 m non
  const F = st.ball.frappeAt; if (!F || hyp(st.ball.p[0] - F[0], st.ball.p[2] - F[2]) / sp > (K.tMin ?? 0.3)) return false;
  const r = tirage(st, 'duel', j.id, st.rnd ?? (() => 0.5)), a = Math.atan2(-v[2], -v[0]) + (r() * 2 - 1) * (K.cone ?? 60) * Math.PI / 180;
  st.ball.strike({ speed: sp * (K.garde ?? 0.3), dirYaw: a, elevation: 0.15 + 0.2 * r(), spinAxis: [0, 1, 0], spinRev: 0 });
  st._teteCd = st.t + 0.5; st.lastTouch = j.team; st.lastPasser = j.id; st.pass = null;
  st.events.push({ t: +st.t.toFixed(2), type: 'contact', kind: 'rebond-corps', by: j.id, v: +sp.toFixed(1) });
  return true;
}

/** La tête/volée au but a-t-elle le ballon à portée ? true sans la clé. Pure. */
export function porteeBut(st, j, bp, cfg, geste = 'tete') { const K = st.full && cfg.reprisePhysique; const P = K && (geste === 'volee' ? K.porteeVolee : K.portee); return !K || P == null || hyp(bp[0] - j.p[0], bp[2] - j.p[2]) <= P; }

/** (359, cfg.relanceObstacle) LE GARDIEN NE DÉGAGE PAS DANS UN ADVERSAIRE : mesuré (diag-A), la volée du gardien partait droit sur
 *  l'attaquant planté à 2 m devant lui (keeper.js ne lisait que ses coéquipiers ; la marge de couloir n'était qu'écrite). Le couloir
 *  vers (tx, tz) est-il libre sur ses distance premiers mètres (aucun adversaire à < couloir m) ? true sans la clé. Pure. */
export function relanceLibre(st, gk, tx, tz, cfg, main = false) {
  const K = st.full && cfg.relanceObstacle; if (!K || (main && K.main == null)) return true;
  // (361, relanceObstacle.main m) LE ROULÉ À LA MAIN LIT SON COULOIR ENTIER : la main ne regardait que le receveur (aucun adversaire à
  // < 4 m de lui) — mesuré (diag-A, seed 7 t=110) : un roulé à 9 m coupé en route, puis le lob au but. Sur toute sa longueur, main m.
  const dx = tx - gk.p[0], dz = tz - gk.p[2], L = hyp(dx, dz) || 1, ux = dx / L, uz = dz / L, D = main ? L : Math.min(L, K.distance ?? 8), CO = main ? K.main : (K.couloir ?? 1.2);
  return !st.players.some((q) => q.team !== gk.team && (q.down ?? 0) <= 0 && !q.expulse && !q._sub && (() => {
    const qx = q.p[0] - gk.p[0], qz = q.p[2] - gk.p[2], a = qx * ux + qz * uz; if (a < 0 || a > D) return false;
    return Math.abs(qx * uz - qz * ux) < CO; })());
}

/** (359, reprisePhysique.corpsVolee / corpsTete °) LA VOLÉE AU BUT PART DEVANT LE CORPS : mesuré (diag-C), 4 « tirs » à 155-177° du regard
 *  et de la course — le joueur qui file vers son camp à 5-6 m/s, ballon devant lui, le frappait à 26 m/s DANS SON DOS vers le but adverse.
 *  La tête garde plus d'angle (la déviation, la tête piquée de côté). true sans la sous-clé. Pure. */
export function butDansCorps(st, j, tx, tz, cfg, geste = 'volee') {
  const K = st.full && cfg.reprisePhysique; const A = K && (geste === 'volee' ? K.corpsVolee : K.corpsTete); if (A == null) return true;
  let d = Math.atan2(tz - j.p[2], tx - j.p[0]) - j.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d) <= A * Math.PI / 180;
}

/** (360, reprisePhysique.rayonReflexe m) LE CONTRE NE S'ÉTEND QU'À CE QU'ON A VU VENIR : le contre de tir (duel.contreTir) prenait tout
 *  ballon rapide et bas jusqu'à 1,48 m d'un corps — même frappé il y a un dixième (la relance du gardien renvoyée vers son but). Frappé
 *  depuis < tMin s : le rayon se borne à rayonReflexe (le corps, pas la jambe tendue). Le rayon d'hier sans la sous-clé. Pure. */
export function rayonReflexe(st, cfg, r) {
  const K = st.full && cfg.reprisePhysique; if (!K || K.rayonReflexe == null) return r;
  const F = st.ball.frappeAt, sp = hyp(st.ball.v[0], st.ball.v[2]); if (!F || sp < 1) return r;
  return hyp(st.ball.p[0] - F[0], st.ball.p[2] - F[2]) / sp < (K.tMin ?? 0.3) ? Math.min(r, K.rayonReflexe) : r;
}

/** (360, reprisePhysique.teteCd s) UNE TÊTE PAR CORPS : la tête armée (tete.js, force) contournait le délai entre deux têtes — mesuré (diag-A,
 *  graine 29 t=1219,85 puis 1219,87) : le même joueur deux fois de la tête en 0,02 s. true si ce corps vient de jouer de la tête. Pure. */
export function teteRecente(st, cfg, id) { const K = st.full && cfg.reprisePhysique; return !!K && K.teteCd != null && st._teteLast?.id === id && st.t - st._teteLast.t < K.teteCd; }
