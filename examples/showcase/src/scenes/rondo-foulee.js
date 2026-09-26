// rondo-foulee.js — LA TOUCHE AU PAS (chantier « conduite et contrôle à la foulée », 27/09). La sim décide QUAND le ballon est touché ; la
// foulée du rendu tournait sans le savoir, et la touche tombait à n'importe quelle phase : le pied libre était parfois en début de vol,
// derrière le corps, et le warp le tirait jusqu'à 0,6 m vers le ballon (« la jambe qui s'allonge »). Le vrai dribbleur AJUSTE ses derniers
// pas pour arriver sur son ballon avec le bon pied. Ici, avant chaque touche connue d'avance — prévue par la sim (predictTouch, ≤ 0,2 s),
// ou le cycle du porté qui respire (sim p._resp : t0 + T) — la scène choisit le pied qui sera en FIN DE VOL à cet instant et accélère ou
// retient la foulée (au plus ± bornes × la cadence) pour qu'il y arrive : sa phase propre u vaut uCible (juste avant la pose) au contact.
// Le warp de touche prend ce pied. Lecture de la sim, écriture de la seule phase de foulée du rendu. ?foulee-libre : l'horloge d'hier.

const wrap = (x) => ((x + 0.5) % 1 + 1) % 1 - 0.5;

/** L'instant (horloge scène) de la prochaine touche connue du porteur, ou null. */
function prochaineTouche(scene, pl) {
  const st = scene.state, s = pl.sim;
  if (pl._touchPre != null && pl._touchPre > scene._t) return pl._touchPre;
  // le RECEVEUR : la passe arrive à t + vol (la sim le sait dès le départ — 0,5-2 s d'avance : le contrôle au pas)
  if (st.pass && st.pass.to === s.id && !st.restart && st.ball.p[1] < 1.2) { let dt = st.pass.t + (st.pass.flight ?? 1) - st.t;
    // …mais le receveur VA au ballon et le prend plus tôt (mesuré : 0,13-0,2 s avant la fin du vol) : l'instant où le ballon entre à portée (R) à la vitesse de rapprochement
    const b = st.ball.p, dx = s.p[0] - b[0], dz = s.p[2] - b[2], d = Math.hypot(dx, dz), R = scene._mcfg?.receiveRadius ?? 0.85;
    if (d > 1e-3) { const vc = ((st.ball.v[0] - s.v[0]) * dx + (st.ball.v[2] - s.v[1]) * dz) / d; if (vc > 0.5) dt = Math.min(dt, Math.max(0, d - R) / vc); }
    if (dt > 0) return scene._t + dt; }
  if (st.possession?.carrier === s.id && st.ball.owner === s.id && s._resp && !s.act) { const dt = s._resp.t0 + s._resp.T - st.t; if (dt > 0) return scene._t + dt; }
  // la CONDUITE libre : le ballon revient à portée de pied (prise) à la vitesse de fermeture — l'estimation de predictTouch, à plus long horizon
  if (st.possession?.carrier === s.id && st.ball.owner == null && st.phase === 'carry' && !s.act && st.ball.p[1] < 1) {
    const b = st.ball.p, dx = b[0] - s.p[0], dz = b[2] - s.p[2], d = Math.hypot(dx, dz), prise = st._drb?.cfg?.prise ?? 0.5;
    if (d > 1e-3) { const vc = (s.v[0] * dx + s.v[1] * dz) / d - (st.ball.v[0] * dx + st.ball.v[2] * dz) / d; const dt = d <= prise ? 0 : vc > 0.2 ? (d - prise) / vc : null; if (dt != null && dt > 0) return scene._t + dt; } }
  return null;
}

/** Avant ctrl.update : ajuste la phase de la foulée vers la touche. dt = le pas de rendu du joueur. */
export function fouleeSteer(scene, pl, dt, K = {}) {
  const g = pl.ctrl?.gait; if (!g || scene._fouleeLibre) return;
  const f = pl._fEst ?? 0; if (pl._phiPrev != null && dt > 0) { const df = ((g.phi - pl._phiPrev) % 1 + 1) % 1; if (df < 0.3) pl._fEst = f + (df / dt - f) * 0.3; }
  const tT = prochaineTouche(scene, pl), horizon = K.horizon ?? 0.6;
  if (tT == null || !(pl._fEst > 0.3)) { pl._touchFootPlan = null; pl._phiPrev = g.phi; return; }
  const D = tT - scene._t; if (D <= 0.02 || D > horizon) { if (D <= 0.02) pl._touchFootPlan = pl._touchFootPlan ?? null; pl._phiPrev = g.phi; return; }
  const fq = pl._fEst, phiT = g.phi + fq * D, uC = K.uCible ?? 0.94;   // u du pied (0 = sa pose) : juste avant la pose, le pied est devant, au ballon
  // le pied gauche se pose à φ = 0, le droit à φ = 0,5 : l'écart de phase à rattraper pour chacun
  const eL = wrap(uC - phiT), eR = wrap(uC + 0.5 - phiT);
  // le pied CÔTÉ BALLON à coût comparable (± 0,08 de phase) : on touche du pied qui est du côté du ballon
  const s = pl.sim, b = scene.state.ball.p, lat = (b[0] - s.p[0]) * Math.sin(s.yaw) - (b[2] - s.p[2]) * Math.cos(s.yaw), cote = lat > 0 ? 'left' : 'right';
  let foot = Math.abs(eL) <= Math.abs(eR) ? 'left' : 'right';
  if (foot !== cote && Math.abs(Math.abs(eL) - Math.abs(eR)) < (K.cote ?? 0.08)) foot = cote;
  // le cycle du porté (329 : une touche par foulée, du côté du pied fort) se joue du PIED FORT — la foulée s'y cale d'un cycle à l'autre
  const fort = s.strongFoot && s.strongFoot !== 'both' ? s.strongFoot : null;
  if (fort && scene.state.ball.owner === s.id && s._resp) foot = fort;
  const e = foot === 'left' ? eL : eR, borne = (K.borne ?? 0.35) * fq;
  const r = Math.max(-borne, Math.min(borne, e / D));
  g.phi = ((g.phi + r * dt) % 1 + 1) % 1;
  pl._touchFootPlan = foot; pl._touchPlanT = tT;
  pl._phiPrev = g.phi;
}
