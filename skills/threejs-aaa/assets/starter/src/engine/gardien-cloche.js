// gardien-cloche.js — LE GARDIEN LIT LA CLOCHE (lot 366, cfg.gkCloche — 30/09, lu dans les stats complètes : les lobs qui restent
// entrent TOUS, 9 sur 9, dont 3 de 37 m). Deux lois d'hier faisaient ce cadeau :
//   1. shotCross ne voit un vol que s'il coupe la ligne dans les 2,5 s — la cloche de 30-38 m en met 2,5 à 3,5 : le gardien ne voyait
//      PAS de tir, il tenait son poste calculé sur la position COURANTE du ballon (encore loin : le libéro restait haut) ;
//   2. le retour du libéro est plafonné au trot (libero.retour 3,5 m/s) : 15 m de retour prenaient 4,3 s.
// Mesuré au banc d'essai : même la cloche de 31 m (2 s de vol, vue par shotCross) laissait le gardien sorti de 15 m à son poste — le
// « se replacer » d'un vol encore long vise le poste calculé sur le ballon LOIN (le libéro haut) : 1,3 m reculés en 2 s.
// La loi : un ballon adverse EN L'AIR qui file vers mon but, PASSE AU-DESSUS du gardien (plus haut que `portee` à son droit) et
// retombe dans le cadre (balistique) se lit après le réflexe (reaction s) ; le gardien sorti de plus de `sorti` m se RETOURNE et SPRINTE vers sa ligne, sur le point de chute (le regard
// sur sa course tant qu'il est loin — pas une course arrière à 6 m/s —, sur le ballon à `face` m de la ligne). Le vol final (< 2,5 s)
// revient à la décision d'hier dès que le gardien est à moins de `sorti` m de sa ligne (keeperDecide : la prise, le plongeon, la claquette). Absente : hier au bit.

const hyp = Math.hypot;

/** La chute balistique du ballon sur le plan de ma ligne : { t, z, y } ou null (ne va pas vers ma ligne, ou retombe avant). */
function chute(pitch, team, b, v, tMax = 5, rebond = 8) {
  const g = pitch.ownGoal(team), dx = g.x - b[0];
  if (Math.abs(v[0]) < 1e-3 || Math.sign(v[0]) !== Math.sign(dx)) return null;
  const t = dx / v[0]; if (t <= 0 || t > tMax) return null;
  const y = (b[1] ?? 0.11) + (v[1] ?? 0) * t - 4.905 * t * t;
  if (y < -0.5) {   // retombe AVANT la ligne : dans les `rebond` derniers mètres, le rebond file au but (mesuré : la cloche de 25 m tombe à 2 m
    const vy = v[1] ?? 0, h = b[1] ?? 0.11, tL = (vy + Math.sqrt(vy * vy + 2 * 9.81 * Math.max(0, h))) / 9.81;   // de la ligne et roule dedans)
    if (Math.abs(g.x - (b[0] + v[0] * tL)) > rebond) return null;
    return { t, z: b[2] + v[2] * t, y: 0, rebond: true };
  }
  return { t, z: b[2] + v[2] * t, y: Math.max(0, y) };
}

/** Le gardien lit-il une cloche ? Pose sa cible et son regard, et renvoie true (la décision d'hier est alors sautée pour cette image). */
export function gardienCloche(st, gk, cfg, pitch, shotAge) {
  const C = st.full && cfg.gkCloche; if (!C || st.restart || gk.down > 0 || st.lastTouch === gk.team) return false;
  const b = st.ball.p, v = st.ball.v, G = pitch.ownGoal(gk.team), sg = Math.sign(G.x || 1);
  const off = Math.abs(gk.p[0] - G.x);
  if (off < (C.sorti ?? 3)) return false;                                            // sur sa ligne : la décision d'hier suffit
  if (b[1] < 1 && (v[1] ?? 0) < 2) return false;                                      // pas un ballon en l'air
  if (v[0] * sg < (C.vMin ?? 4)) return false;                                        // ne file pas vers mon but
  if (shotAge < (C.reaction ?? 0.35)) return false;                                   // le réflexe : lire la trajectoire prend du temps
  const X = chute(pitch, gk.team, b, v, 5, C.rebond ?? 8); if (!X) return false;
  const tk = (gk.p[0] - b[0]) / v[0];                                                 // le ballon au droit du gardien : il passe AU-DESSUS ?
  const suivi = gk._cloche != null && st.t - gk._cloche < 0.25;                      // la cloche DÉJÀ lue se suit jusqu'à la ligne (mesuré : lâchée quand le
  // ballon redescendait sous la portée, le poste d'hier le remettait face au jeu, en course arrière à 2,5 m/s — battu sous la barre)
  if (!suivi && tk > 0 && (b[1] ?? 0.11) + (v[1] ?? 0) * tk - 4.905 * tk * tk < (C.portee ?? 2.6)) return false;   // à portée devant lui : le métier d'hier
  if (Math.abs(X.z) > pitch.goalHalf + 1.5 || X.y > pitch.goalH + 1.2) return false;  // ne retombe pas dans le cadre : le poste d'hier
  const zc = Math.max(-pitch.goalHalf + 0.3, Math.min(pitch.goalHalf - 0.3, X.z));
  gk.job = 'keeper'; gk.target = [G.x - sg * (C.ligne ?? 0.6), 0, zc]; gk._cloche = st.t;
  // …le repli est une RUPTURE (l'effort plein, la pointe) — mesuré sans : l'effort du placement (ε 0,85, poussée non pleine), 1,5 m/s²
  // et 4 m/s au plus sur 7 m de retour
  if (C.rupture !== false && hyp(gk.target[0] - gk.p[0], gk.target[2] - gk.p[2]) > 1.5) gk._pace = { ...(gk._pace ?? { next: st.t + 3 }), until: st.t + 0.3, kind: 'cloche' };
  const loin = hyp(gk.target[0] - gk.p[0], gk.target[2] - gk.p[2]) > (C.face ?? 3.5);
  gk.yawWant = loin ? Math.atan2(gk.target[2] - gk.p[2], gk.target[0] - gk.p[0]) : Math.atan2(b[2] - gk.p[2], b[0] - gk.p[0]);
  if (!gk._clocheEv || st.t - gk._clocheEv > 3) { gk._clocheEv = st.t; st.events.push({ t: +st.t.toFixed(2), type: 'gk-cloche', by: gk.id, off: +off.toFixed(1), tChute: +X.t.toFixed(2) }); }
  return true;
}
