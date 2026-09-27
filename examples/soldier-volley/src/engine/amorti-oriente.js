// amorti-oriente.js — L'AMORTI AÉRIEN ORIENTÉ ET L'AMORTI DE LA TÊTE (cfg.amortiOriente && st.full — retour utilisateur 27/09 : « continue sur
// les contrôles poitrine, tête, genou… et les enchaînements qui suivent »). Mesuré (4 graines × 900 s, sondes ctl-aerien / retombee-dbg,
// filmé) : 71 amortis aériens / h (cuisse 29, cou-de-pied 27, poitrine 13) ; l'amorti TUAIT le vol sur place (−0,85 × v), le ballon
// cabriolait 0,6 s aux pieds (0,1-0,45 m de haut) puis le corps pivotait vers sa suite, le ballon DERRIÈRE lui (ballon à 170° du regard
// pendant 0,3-1 s — « il tourne sur lui-même ») ; au-dessus de 1,55 m, la tête ne savait que REMETTRE ou dégager, jamais amortir.
// Le vrai geste : l'amorti POSE le ballon devant, DANS la direction de l'action suivante (le contrôle orienté aérien), le corps tourne
// avec lui ; le receveur libre d'un ballon haut l'amortit de la tête jusqu'à ses pieds.
// Ici : la direction est celle du contrôle au sol (controle-oriente.capControle : l'avant libre, sinon loin du presseur) ; le ballon est
// posé à devant m dans cette direction, là où le corps sera dans tau s (sa vitesse × tau), au sol à cet instant (balistique exacte), la
// vitesse horizontale bornée (vMax) ; yawWant suit. La tête : le destinataire de la passe, sans adversaire à ≤ tete.libre m, ballon
// ≤ tete.max m, hors des deux urgences (la tête au but, le dégagement). Clé absente : l'hier au bit.
import { hyp } from './hyp.js';
import { capControle } from './controle-oriente.js';

/** Pose le ballon devant le joueur, dans la direction de la suite. Rend l'angle (°, relatif au regard) ou null (clé absente). Mutateur. */
export function poserAmorti(st, p, cfg, surface, dw = null) {
  const K = st.full && cfg.amortiOriente; if (!K) return null;
  // …SEULEMENT LIBRE (≤ libre m : personne) : le ballon posé roule seul 0,4-0,5 s — mesuré, orienté SOUS pression, les pertes à 3 s passaient
  // de 17 % à 30 % des amortis aériens. Pressé, le vrai geste TUE le ballon aux pieds : l'amorti d'hier (null).
  if (st.players.some((o) => o.team !== p.team && o.down <= 0 && !o.expulse && hyp(o.p[0] - p.p[0], o.p[2] - p.p[2]) < (K.libre ?? 4))) return null;
  // …JAMAIS DANS LE DOS : le receveur d'un long ballon regarde le passeur, l'avant du jeu est derrière lui — posé là, le ballon TRAVERSAIT
  // le corps (mesuré : ballon derrière le regard 22 % des 1,2 s suivantes, pertes à 3 s 4 → 9). Le vrai amorti met le ballon de CÔTÉ-avant
  // (≤ angle ° du regard) ; le demi-tour se fait ensuite au sol, avec lui.
  const [cx, cz] = capControle(st, p, cfg), b = st.ball.p, v = st.ball.v;
  let da = Math.atan2(cz, cx) - p.yaw; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
  const aM = (K.angle ?? 70) * Math.PI / 180, yd = p.yaw + Math.max(-aM, Math.min(aM, da)), dx = Math.cos(yd), dz = Math.sin(yd);
  const tau = surface === 'head' ? (K.tete?.tau ?? 0.55) : surface === 'chest' ? (K.tauPoitrine ?? 0.5) : (K.tau ?? 0.4), dv = K.devant ?? 0.6;
  const tx = p.p[0] + p.v[0] * tau + dx * dv, tz = p.p[2] + p.v[1] * tau + dz * dv;
  let vx = (tx - b[0]) / tau, vz = (tz - b[2]) / tau; const vh = hyp(vx, vz), vM = K.vMax ?? 3; if (vh > vM) { vx *= vM / vh; vz *= vM / vh; }
  const vy = (0.11 - b[1] + 4.905 * tau * tau) / tau;
  st.ball.impulse([vx - v[0], vy - v[1], vz - v[2]], dw);
  p.yawWant = yd;
  // …et le ballon posé RETOMBE avant d'être repris : la prise d'un ballon libre va jusqu'à 1,9 m (rondo-sim) — mesuré, 0,1 s après un amorti
  // de la tête, un 'amorti-poursuite' le saisissait à 1,39 m et le tenait EN L'AIR. La fenêtre d'enchaînement (prise ≤ 0,45 m) le laisse tomber.
  st._enchaine = { id: p.id, mode: 'amorti', until: st.t + tau };
  let a = Math.atan2(dz, dx) - p.yaw; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
  return Math.round(a * 180 / Math.PI);
}

/** Le receveur peut-il amortir de la tête ce ballon (hauteur h) ? Pure. */
export function amortiTetePossible(st, q, b, cfg, qp = q.p) {
  const K = st.full && cfg.amortiOriente, T = K?.tete; if (!T || !st.pass || st.pass.to !== q.id || b[1] > (T.max ?? 2.0)) return false;
  // le ballon DEVANT (≤ cone ° du regard) : la tête réactive accepte un ballon dans le dos à 1,1 m (mesuré : un amorti à 152°, le coureur
  // lancé à 4,5 m/s le laissait derrière lui 1,5 s) — là, c'est une tête, pas un amorti
  let a = Math.atan2(b[2] - qp[2], b[0] - qp[0]) - q.yaw; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
  if (Math.abs(a) > (T.cone ?? 60) * Math.PI / 180) return false;
  if (st.players.some((o) => o.team !== q.team && o.down <= 0 && !o.expulse && hyp(o.p[0] - q.p[0], o.p[2] - q.p[2]) < (T.libre ?? 2.5))) return false;
  const goal = st.pitch.attackGoal(q.team), own = st.pitch.ownGoal(q.team), sgn = Math.sign(goal.x || 1);
  if (hyp(goal.x - q.p[0], q.p[2]) < (cfg.tete?.but ?? 12) && st.pitch.inBox(q.p[0], q.p[2], sgn)) return false;   // la tête au but reste la tête
  if (hyp(own.x - q.p[0], q.p[2]) < 24) return false;                                                               // le dégagement aussi
  return true;
}
