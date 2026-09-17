// ramasseurs.js — LES RAMASSEURS DE BALLE (Animations_A_Faire § 5 ; cfg.ramasseurs && st.full ; note 382). Le 225b rendait le ballon
// hors d'atteinte AU POINT de remise en une image (l'événement 'ramasseur'). Ici des CORPS, hors st.players (aucun pied dans le jeu) :
// n ramasseurs assis au bord (aux quarts des touches, à marge m dehors, face au terrain) ; au 'ramasseur', le plus proche du ballon
// TROTTE au ballon (vitesse), le RAMASSE (geste 'ramassage' — le ballon dans ses mains dès le contact du geste), se tourne vers le point
// de remise et le ROULE ('rouleMain' : le ballon part au contact à la vitesse qui l'arrête au point — le frottement du moteur mesuré :
// d = 0,667·v^1,56), puis revient s'asseoir ; le ballon arrêté à ≤ colle m du point s'y pose. La remise ATTEND (r.at) le ramasseur ;
// le ramasseur qui n'aboutit pas (patience s) rend le point d'hier en une image. Clé absente : l'hier au bit.
import { hyp } from './hyp.js';

const V0 = (d) => Math.min(9, Math.pow(Math.max(0.3, d) / 0.667, 1 / 1.56));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const pose = (st, r) => { st.ball.restart([r.p[0], 0.11, r.p[1]], { cause: r.type }); r.placed = true; r.placedAt = st.t; r.carried = false; r._fetchT0 = null; };

/** Au ballon hors d'atteinte (referee.ballFetch) : le ramasseur le plus proche part le chercher. true : le point d'hier attend. */
export function ramasseurPrend(st, r, cfg, cause) {
  const R = st.ramasseurs; if (!R || !R.length || st._ramasseur) return false;
  const b = st.ball.p; let k = 0, best = Infinity;
  R.forEach((q, i) => { const d = hyp(q.p[0] - b[0], q.p[2] - b[2]); if (d < best) { best = d; k = i; } });
  st._ramasseur = { boy: k, phase: 'va', t: st.t, t0: st.t, point: [r.p[0], r.p[1]], type: r.type, enMains: false };
  R[k].job = 'va';
  st.events.push({ t: +st.t.toFixed(2), type: 'ramasseur', cause, boy: k, d: +best.toFixed(1) });
  return true;
}

/** Chaque image : les corps au bord, le ramasseur en course, les gestes et le ballon dans ses mains. */
export function ramasseursStep(st, dt, cfg) {
  const K = cfg.ramasseurs;
  if (!st.full || !K) { if (st.ramasseurs) st.ramasseurs = null; return; }
  const { hx, hz } = st.pitch, marge = K.marge ?? 2.4;
  const R = st.ramasseurs ??= [[hx * 0.55, hz + marge], [-hx * 0.55, hz + marge], [hx * 0.55, -hz - marge], [-hx * 0.55, -hz - marge]].slice(0, K.n ?? 4)
    .map((h) => ({ p: [h[0], 0, h[1]], v: [0, 0], yaw: Math.atan2(-Math.sign(h[1]), 0), speed: 0, job: 'assis', home: h, geste: null }));
  let F = st._ramasseur; const r = st.restart;
  if (F && (!r || r.type !== F.type)) { R[F.boy].job = 'revient'; R[F.boy].geste = null; st._ramasseur = F = null; }   // la remise a changé sous lui : il rentre
  const ev = (type, extra) => st.events.push({ t: +st.t.toFixed(2), type, ...extra });
  for (let k = 0; k < R.length; k++) {
    const q = R[k]; let tx = q.home[0], tz = q.home[1];
    if (F && F.boy === k) {
      const b = st.ball.p;
      if (F.phase === 'va') { tx = b[0]; tz = b[2]; if (hyp(q.p[0] - b[0], q.p[2] - b[2]) <= (K.portee ?? 0.7)) { F.phase = 'ramasse'; F.t = st.t; q.geste = { kind: 'ramassage', at: st.t, until: st.t + 1.12 }; ev('ramasseur-geste', { kind: 'ramassage', boy: k }); } }
      if (F.phase === 'ramasse') {
        tx = q.p[0]; tz = q.p[2];
        if (st.t - F.t >= 0.42) { F.enMains = true; q.yaw += wrap(Math.atan2(F.point[1] - q.p[2], F.point[0] - q.p[0]) - q.yaw) * Math.min(1, dt * 4); }   // le ballon en mains au contact, le corps se tourne vers le point
        if (st.t - F.t >= 1.12) { F.phase = 'roule'; F.t = st.t; q.geste = { kind: 'rouleMain', at: st.t, until: st.t + 1.05 }; ev('ramasseur-geste', { kind: 'rouleMain', boy: k }); }
      }
      if (F.phase === 'roule') {
        tx = q.p[0]; tz = q.p[2]; const dx = F.point[0] - q.p[0], dz = F.point[1] - q.p[2], d = hyp(dx, dz) || 1; q.yaw = Math.atan2(dz, dx);
        if (st.t - F.t >= 0.52 && F.enMains) {   // le contact du roulé : le ballon part à la vitesse qui l'arrête au point
          F.enMains = false; const v0 = V0(d - 0.5);
          st.ball.restart([q.p[0] + dx / d * 0.5, 0.11, q.p[2] + dz / d * 0.5], { cause: F.type }); st.ball.impulse([dx / d * v0, 0, dz / d * v0]);
          if (r) { r.placed = true; r.placedAt = st.t; r.carried = false; r._fetchT0 = null; st._ramasseurRoule = r; }
          ev('ramasseur-roule', { boy: k, d: +d.toFixed(1), v: +v0.toFixed(1) });
        }
        if (st.t - F.t >= 1.05) { st._ramasseur = null; q.job = 'revient'; F.fini = true; }
      }
      if (F.enMains) { const fx = Math.cos(q.yaw), fz = Math.sin(q.yaw); st.ball.restart([q.p[0] + fx * 0.35, 0.95, q.p[2] + fz * 0.35], { cause: F.type }); /* la cause de remise du ballon est celle de la remise (le ballon connaît ses causes) */ }
    } else if (q.job === 'revient' && hyp(q.p[0] - q.home[0], q.p[2] - q.home[1]) < 0.4) q.job = 'assis';
    const dx = tx - q.p[0], dz = tz - q.p[2], d = hyp(dx, dz), want = d > 0.3 ? Math.min(K.vitesse ?? 3.6, d * 3) : 0, k2 = Math.min(1, dt * 6);   // la cinématique des assistants
    q.v[0] += ((d > 1e-6 ? dx / d : 0) * want - q.v[0]) * k2; q.v[1] += ((d > 1e-6 ? dz / d : 0) * want - q.v[1]) * k2;
    q.p[0] += q.v[0] * dt; q.p[2] += q.v[1] * dt;
    const sp = hyp(q.v[0], q.v[1]); q.speed = sp;
    if (sp > 0.5) q.yaw = Math.atan2(q.v[1], q.v[0]); else if (!(F && F.boy === k)) q.yaw = Math.atan2(-Math.sign(q.home[1]), 0);   // assis : face au terrain
    if (q.geste && st.t >= q.geste.until) q.geste = null;
  }
  F = st._ramasseur;
  if (F && r) {
    r.at = Math.max(r.at ?? 0, st.t + 1.0);                       // la remise attend le ramasseur
    if (st.t - F.t0 > (K.patience ?? 12)) { pose(st, r); R[F.boy].geste = null; R[F.boy].job = 'revient'; st._ramasseur = null; ev('ramasseur', { cause: 'patience-ramasseur', boy: F.boy }); }
  }
  if (!F && r && r.placed && r.placedAt != null && st.t - r.placedAt < (K.rattrape ?? 6) && r.placedAt > 0 && st.ball.owner == null && hyp(st.ball.v[0], st.ball.v[2]) < 0.3) {   // le roulé arrêté près du point s'y pose (le ballon d'hier est AU point)
    const dP = hyp(st.ball.p[0] - r.p[0], st.ball.p[2] - r.p[1]);
    // …ET LE ROULÉ MORT LOIN DU POINT SE RATTRAPE (17/09, K.rattrape s — mesuré graine 3 : un roulé de 32 m arrêté à 11,7 m du point après la fenêtre de 6 s, personne n'y va, le lanceur attend au point : touche gelée jusqu'à la fin du match). Dans rattrape s après la pose, un roulé arrêté (v < 0,3) sans preneur se pose au point quelle que soit la distance. Absente : les 6 s et la colle d'hier, au bit.
    if (dP > 0.05 && (dP <= (K.colle ?? 2.5) || K.rattrape) && st._ramasseurRoule === r) { st.ball.restart([r.p[0], 0.11, r.p[1]], { cause: r.type }); st._ramasseurRoule = null; if (dP > (K.colle ?? 2.5)) ev('ramasseur', { cause: 'roulé-mort', d: +dP.toFixed(1) }); }
  }
}
