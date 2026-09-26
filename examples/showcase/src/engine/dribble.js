import { BALL, PITCH, stepBall } from './ball.js'; import { toucheCorpsDe } from './touche-corps.js';

// Le ballon peut être un BallBody (position en lecture seule, audit de continuité) ou un objet nu
// `{p,v,w}` — les prédicteurs simulent des futurs sur des copies mutables, et c'est légitime. Ces deux
// helpers font que le dribble marche sur les deux sans jamais écrire de position.
const setVelocity = (ball, v, w) => {
  if (typeof ball.impulse === 'function') {
    ball.impulse([v[0] - ball.v[0], v[1] - ball.v[1], v[2] - ball.v[2]],
      [w[0] - ball.w[0], w[1] - ball.w[1], w[2] - ball.w[2]]);
  } else {
    ball.v[0] = v[0]; ball.v[1] = v[1]; ball.v[2] = v[2];
    ball.w[0] = w[0]; ball.w[1] = w[1]; ball.w[2] = w[2];
  }
};
const advance = (ball, dt) => (typeof ball.integrate === 'function' ? ball.integrate(dt) : stepBall(ball, dt));

// dribble — carrying the ball, the way it actually works. The tempting shortcut is to park the
// ball at a fixed offset in front of the player (`ballPos = playerPos + heading * 0.85`). That is
// why almost every hobby football game looks wrong: the ball is WELDED to the player, it never
// runs, never lags, never gets away, and no defender can ever nick it.
//
// A real dribble is a sequence of TOUCHES. Once every stride or two the plant foot nudges the
// ball; between touches the ball is FREE — it rolls under its own physics (ball.js: grass
// resistance and air drag) while the player runs to catch it back up. Everything that makes
// dribbling feel like football falls out of that loop:
//   • the ball–player distance BREATHES instead of being constant (the single clearest tell),
//   • sprinting forces long touches (the ball gets 3–4 m away) while close control keeps it under
//     the foot — so pace and control genuinely trade off,
//   • a touch that is too heavy for the current speed loses possession, which is what gives
//     defenders something to win.
//
// Dependency-free and node-testable; feeds a ball state that ball.js integrates.

/** How far ahead a touch should put the ball: close control ≈ 0.8 m, full sprint ≈ 2.4 m. */
export function touchDistance(speed, { close = 0.5, perSpeed = 0.36, max = 3.0 } = {}) {
  return Math.min(max, close + Math.max(0, speed - 1.5) * perSpeed);
}

/**
 * Speed to leave on the ball so it gains exactly `lead` metres on a player running at `speed`
 * before the grass hands it back. The ball decelerates at a ≈ rolling resistance + air drag, so
 * relative to the player it gains (v₀−v)²/2a — invert that. Deriving the push instead of guessing
 * a multiplier is what makes the dribble self-correcting at every pace: too strong and the ball
 * runs away, too weak and it never leaves the foot.
 */
export function touchDecel(speed, sol = null) {
  return (sol ? sol.dec0 + sol.decV * Math.min(Math.max(0.5, speed), sol.vMax ?? 3.2) : PITCH.rollResist * PITCH.gravity) + BALL.k * 0.42 * Math.max(2, speed) ** 2 * 0.35;   // (sol) la loi du ballon (ball.js), sinon hier
}
// LE CONTRAT DES DEUX RÉGIMES (mesuré par le consommateur carrière, consigné lot 146) : la
// conduite N'EST PAS « un ballon qui revient au pied » — c'est un SERVO qui le REPREND. Deux
// mondes : le porté sous tenue (~58 % du temps, distance médiane 0,33 m — le carry servo écrit
// le couple) et le ballon libre entre deux touches (~42 %, 0,79 m — l'écart ne se referme pas
// seul, −0,07 m/s). pushSpeed dose la touche EN SUPPOSANT la reprise servo ~0,2 s plus tard ;
// porter cette formule SANS le mécanisme de carry aggrave la conduite (1,06 → 1,35 m mesuré
// chez eux). Qui vendorise la loi doit vendoriser le servo.
export function pushSpeed(speed, lead, sol = null) {
  return speed + Math.sqrt(2 * touchDecel(speed, sol) * Math.max(0.05, lead));
}
/** LA CADENCE DE TOUCHE MESURÉE (cfg.conduite.cadence, le duel) : l'intervalle entre deux touches à l'allure v, interpolé entre deux régimes
 *  mesurés — Zago et al. 2016 (J Sports Sci 34:411) : 2,3-3,0 contacts/s en conduite de slalom (milieu 2,65, allure ≈ 3 m/s — estimée), 1,4-2,3/s en
 *  conduite droite à 5,7 m/s (milieu 1,85). K = { v: [v0, v1], f: [f0, f1] } (m/s, touches/s), borné aux extrémités. */
export function toucheCadenceT(K, v) {
  const u = Math.max(0, Math.min(1, (v - K.v[0]) / (K.v[1] - K.v[0])));
  return 1 / (K.f[0] + (K.f[1] - K.f[0]) * u);
}
/** LA VITESSE QUI AMÈNE LE BALLON À D MÈTRES EN T SECONDES sur CE sol (le duel) : inversée sur l'intégrateur même (stepBall, la loi du terrain et
 *  l'air) — la formule v = D/T + a·T/2 prenait la décélération à l'allure du CORPS, pas du ballon (rdv-erreur : ballon à 0,33 m de la cible, p50). */
export function vitesseRdv(D, T, sol) {
  if (!(D > 0) || !(T > 0)) return null;
  const n = Math.max(6, Math.ceil(T * 60)), O = { sol }, va = (v0) => { const s = { p: [0, BALL.radius, 0], v: [v0, 0, 0], w: [0, 0, -v0 / BALL.radius] }; for (let i = 0; i < n; i++) stepBall(s, T / n, O); return s.p[0]; };
  let lo = 0, hi = 12; if (va(hi) < D) return null;
  for (let i = 0; i < 28; i++) { const mid = (lo + hi) / 2; if (va(mid) < D) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
/** Seconds until the player is back on the ball after a touch of `lead` metres. */
export function touchInterval(speed, lead, sol = null) {
  return 2 * Math.sqrt(2 * Math.max(0.05, lead) / touchDecel(speed, sol));
}

/**
 * The heading a dribbler must actually run to KEEP the ball while heading toward `want`. A player
 * who runs their intended line and ignores where the ball went is not dribbling — that is exactly
 * how a ball ends up 20 m away on a curved run. Real dribblers bend their path to their ball, more
 * strongly the further off-line it has drifted. Feed the result to the character controller.
 */
export function dribbleSteer(ball, player, { pull = 0.6, reach = 1.15 } = {}) {
  const wx = player.want ? player.want[0] : player.heading[0];
  const wz = player.want ? player.want[1] : player.heading[1];
  const bx = ball.p[0] - player.p[0], bz = ball.p[2] - player.p[1];
  const d = hyp(bx, bz);
  if (d < reach * 0.9) return [wx, wz];                    // ball at the foot: just go where you want
  const k = Math.min(1, (d - reach * 0.9) / 1.6) * pull;   // the further it drifted, the harder you chase
  const hx = wx + (bx / d - wx) * k, hz = wz + (bz / d - wz) * k;
  const l = hyp(hx, hz) || 1;
  return [hx / l, hz / l];
}

/**
 * LA PRISE A UNE PORTÉE DE PIED (lot 62 — capture utilisateur : « le ballon change de sens sans
 * être touché »). Mesuré (3 graines × 300 s) : 80 des 105 captures accordaient la possession à un
 * ballon qui FUYAIT le preneur (jusqu'à 0,9 m), et le servo du porté le retournait le tick même —
 * 39 des 42 demi-tours sans contact du match venaient de ce seul site. La règle du réel : on
 * possède un ballon AU pied (< prise) ou qui VIENT au pied (pas fuyant) ; un ballon qui fuit se
 * court — et la touche réelle le jouera quand le pied l'atteint (dribbleStep, lot 58).
 */
/** LE CÔNE AVANT (lot 70) : une touche de PIED n'existe que si le ballon est DEVANT le corps
 *  (relèvement ≤ cone°). Les chemins sans géométrie (amorti-poursuite, quart-de-touche, capture)
 *  écrasaient des ballons DANS LE DOS — mesuré : 54 % des amortis-poursuite à > 100°, prises à
 *  p90 107° — « le joueur se réoriente avec la balle sans la toucher » (retour utilisateur).
 *  La table des techniques (technique.js) porte déjà ses fenêtres ; ce cône est la même loi
 *  pour les touches HORS table. cfg.priseCone:false = la touche omnisciente d'hier (sabotage). */
export const dansCone = (yaw, px, pz, bx, bz, cone = 100) => {
  const a = Math.atan2(bz - pz, bx - px) - yaw;
  return Math.abs(((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) <= cone * Math.PI / 180;
};

export function balPrenable(ball, px, pz, prise = 0.5, fuite = 0.5) {
  const bx = ball.p[0] - px, bz = ball.p[2] - pz, dd = hyp(bx, bz);
  return dd < prise || (dd > 1e-4 ? (ball.v[0] * bx + ball.v[2] * bz) / dd : 0) < fuite;
}

export function makeDribbler(cfg = {}) {
  return {
    sinceTouch: 0,          // metres of player travel since the last touch
    touches: 0,
    lost: false,
    cfg: {
      reach: 1.15,          // m — a foot can only touch a ball it can actually reach
      prise: null,          // m — LA TOUCHE SE PREND AU PIED (lot 58) : on REJOINT le ballon à
      //                       ≤ prise avant de le repousser (absent : la touche d'hier part dès
      //                       reach — la jambe tendue). La touche d'URGENCE à pleine allonge
      //                       reste quand le ballon fuit plus vite qu'on ne referme (le poke).
      minStride: 0.55,      // m of travel between touches (stride pacing, not per-frame)
      minPush: 2.5,         // m/s — even a standing touch sends the ball on
      controlRadius: 3.6,   // m — beyond this the ball has run away
      steer: 0.8,           // how strongly a touch redirects the ball to the desired heading
      ...cfg,
    },
  };
}

/**
 * Advance one frame of a dribble. The player is driven by the game (controller/AI); this only
 * decides WHEN a touch happens and what it does to the ball, then integrates the ball.
 *
 * @param {object} d       dribbler state from makeDribbler()
 * @param {object} ball    { p:[x,y,z], v:[x,y,z], w:[x,y,z] } — mutated
 * @param {object} player  { p:[x,z], speed, heading:[x,z] unit, want:[x,z] unit desired heading }
 * @param {number} dt
 * @returns {{touched:boolean, dist:number, ahead:number, control:number, lost:boolean}}
 */
export function dribbleStep(d, ball, player, dt) {
  const c = d.cfg;
  const [px, pz] = player.p;
  const hx = player.heading[0], hz = player.heading[1];
  const wantX = player.want ? player.want[0] : hx, wantZ = player.want ? player.want[1] : hz;

  d.sinceTouch += player.speed * dt;

  const bx = ball.p[0] - px, bz = ball.p[2] - pz;
  const dist = hyp(bx, bz);
  const ahead = (bx * hx + bz * hz);                       // signed: how far in front the ball is

  let touched = false, ev = null;
  // A touch lands when the foot actually REACHES the ball, stride-paced so it is not re-kicked
  // every frame. Triggering on "distance travelled" instead was the bug that killed turns: once
  // the ball escaped the trigger window it was never touched again and simply rolled away.
  // …ET LA TOUCHE SE PREND AU PIED (cfg.prise, lot 58 — captures utilisateur : « le ballon ne
  // touche jamais le pied », touches de sprint mesurées à 1,07 m p50 = la jambe tendue) : le
  // corps REJOINT son ballon avant de le repousser. L'exception est réelle : un ballon qui FUIT
  // plus vite qu'on ne le referme se joue à pleine allonge (le poke de la course).
  const prise = c.prise ?? c.reach;
  const bvAway = dist > 1e-4 ? (ball.v[0] * bx + ball.v[2] * bz) / dist : 0;
  // (2026-09-24) LA TOUCHE AU PIED QUI LA JOUE (player.pas — pas.js, cfg.pas ; absent : la touche d'hier au bit). La touche « au pied »
  // à la distance ne savait pas où étaient les pieds : deux touches par pas, le pied rendu à 0,7 m du ballon (p50) à l'instant du
  // contact. Ici le ballon n'est touché que par un pied EN FIN DE VOL (w ≥ pasW) dont la balle du pied l'atteint — dans son couloir
  // (± pasLat du centre du pied), rejoint (le ballon au plus pasAvant devant elle, pas plus de 0,3 m derrière) — une fois par vol.
  // …EN MOUVEMENT seulement (≥ pasV m/s, la foulée générée pleine) : à l'arrêt l'horloge ne tourne pas, aucun pied ne vole — le porteur
  // garé derrière un ballon mort ne le toucherait jamais (le gel du duel) ; là, la touche de semelle / d'intérieur d'hier.
  let piedPas = null, pasMode = null, pasPorteeV = null;
  const pasOn = !!player.pas && player.speed >= (c.pasV ?? 1.0);
  d.horloge = (d.horloge ?? 0) + dt;
  const rdvEnCours = pasOn && ((d.rdv && d.horloge < d.rdv.t + 0.15) || (player.pas?.P?.rdv && player.pas.P.rdv.reste > -0.15));   // un ballon ENVOYÉ au pied qui va se poser : on le laisse arriver (le rendez-vous de la foulée aussi — la prise d'un ballon libre le déclare, pas.recupTouche)
  if (pasOn) {
    const fx = Math.cos(player.yaw ?? Math.atan2(hz, hx)), fz = Math.sin(player.yaw ?? Math.atan2(hz, hx)), bA = bx * fx + bz * fz, bD = -bx * fz + bz * fx;
    d.pasJoue = player.pas.joue ?? (d.pasJoue ??= {});   // le registre du JOUEUR (pas.js : partagé avec la touche du porté, rouvert à chaque vol qui commence — une touche par vol)
    const ct = player.pas.contact(bA, bD);
    if (ct && ct.d <= (c.pasR ?? 0.16) && !d.pasJoue[ct.pied]) { piedPas = ct.pied; pasMode = 'contact'; }          // le ballon (rayon 0,11) au contact du cou-de-pied (±5 cm)
    // …sinon, un ballon À PORTÉE (la prise d'hier) se joue avec le pied qui FINIT son vol — le plus en avant, à l'instant où il se pose :
    // le porteur qui tourne autour d'un ballon mort sans qu'un pied le rejoigne exactement le gardait à 0,15 m d'un défenseur figé 1 s
    // (graine 1) ; le rendu n'a plus qu'un reste à corriger, et c'est toujours un pied, une fois par vol
    // …(2026-09-25) mais seulement si ce pied PEUT l'atteindre : sa pose (pasProchains) à ≤ pasPortee du ballon — le rendu l'y amène (viseBallon,
    // ≤ 0,4 m) ; plus loin, on attend le vol suivant (le corps s'approche), un cycle au plus (jamais de porteur figé). Mesuré sans : la queue
    // des touches de rattrapage à 0,4-0,57 m (p75-p90) du cou-de-pied rendu.
    // (c.rdvPied, cfg.conduite.cadence — le duel) LE RENDEZ-VOUS SE TIENT : le pied du rendez-vous qui FINIT son vol joue le ballon s'il est à sa
    // portée (sa pose à ≤ pasPortee — le rendu l'y amène, viseBallon ≤ 0,4 m) ; exiger le contact exact du cou-de-pied (0,16 m) laissait passer
    // 54 % des rendez-vous (rdv-tenu.mjs : le ballon arrivé à 0,5 m, le porteur le rattrapait une foulée plus tard — le ballon, un corps à part)
    else if (c.rdvPied && rdvEnCours && player.pas.P?.rdv && player.pas.finVol?.[player.pas.P.rdv.pied] && !d.pasJoue[player.pas.P.rdv.pied]) {
      const pr = player.pas.P.rdv.pied, pose = player.pas.prochains?.filter((r) => r.pied === pr).sort((a, b) => a.t - b.t)[0], dPose = pose ? Math.hypot(bA - pose.avant, bD - pose.droite) : 9;
      if (dPose <= (c.rdvPortee ?? 0.25)) { piedPas = pr; pasMode = 'rdv'; pasPorteeV = +dPose.toFixed(2); }   // 0,25 : au-delà le rendu n'amène pas le pied (contact-debug : touches « rdv » à 0,3-0,5 m du cou-de-pied rendu à pasPortee 0,4)
    }
    else if (dist < prise && !rdvEnCours) { const fv = ['left', 'right'].filter((k) => player.pas.finVol?.[k] && !d.pasJoue[k]); if (fv.length) {
      const cand = fv.length === 1 ? fv[0] : (bD < 0 ? 'left' : 'right'), pose = player.pas.prochains?.filter((r) => r.pied === cand).sort((a, b) => a.t - b.t)[0];
      const dPose = pose ? Math.hypot(bA - pose.avant, bD - pose.droite) : 0, loin = dPose > (c.pasPortee ?? 0.55);
      if (!loin || d.horloge - (d.pasAttente ??= d.horloge) > (player.pas.P?.T ?? 0.6)) { piedPas = cand; pasMode = 'fin'; pasPorteeV = +dPose.toFixed(2); }
    } }
    if (piedPas || !(dist < prise)) d.pasAttente = null;
  }
  const auPied = pasOn ? !!piedPas || (!rdvEnCours && bvAway > player.speed + 0.3 && dist < c.reach) : dist < prise || (!c.rdvPied && bvAway > player.speed + 0.3 && dist < c.reach);   // (c.rdvPied, le duel) au pas, plus de touche à pleine allonge sur un ballon qui fuit (1,15 m : le ballon partait à 0,8-1 m du pied rendu) — on le rejoint
  // …ET LA TOUCHE EXIGE LE CÔNE AVANT (player.coneOk, lot 76 — posé par le match ; absent :
  // bit-près) : un pied ne pousse pas un ballon dans le dos — le corps le contourne d'abord.
  if (auPied && player.coneOk !== false && (piedPas || d.sinceTouch >= c.minStride)) {   // (pas) un vol, une touche : la foulée cadence, plus la distance
    // turning shortens the touch — you cannot push the ball 3 m ahead and still be with it after
    // a 40° change of direction. This is real technique, and it is what makes curved runs work.
    const turn = Math.abs(player.turnRate || 0);
    // LA TOUCHE LIT L'ESPACE : seul, on pousse loin ; un défenseur à 2 m raccourcit la touche
    // (close control). Mesuré sans cette loi : 11,4 % du temps de conduite avec le ballon échappé
    // au-delà de 2,2 m — le porteur courait après son propre ballon, la « conduite imprécise »
    // que l'œil lit immédiatement. player.space = distance du plus proche adversaire (l'appelant
    // la fournit ; absente, la loi est neutre — le rondo d'avant est inchangé au bit près).
    const space = player.space ?? 99;
    const kSpace = Math.max(0.5, Math.min(1, space / 4));
    // …et la NOTE de dribble : le mauvais dribbleur pousse plus loin qu'il ne maîtrise
    // …ET LE RÉGIME (player.touchF, posé par le match — absent : le rondo au bit près) : LA
    // CONDUITE EST SERRÉE PAR DÉFAUT, la touche LANCÉE est l'acte nommé d'un démarrage. La
    // poussée pleine (0,36 × v ≈ 2,7 m à 6 m/s) servie à toutes les croisières mettait 18 % du
    // temps de conduite à > 2 m du ballon — le temps s'accumule sur le PLATEAU lointain de
    // chaque poussée (homme et ballon filent à la même allure, la fermeture n'arrive qu'en fin
    // de roulement). Mesuré : bursts nommés = 0,1 % du porté — le geste long était devenu la règle.
    // (2026-09-25, player.vPlan — cfg.conduite.couple) LA TOUCHE SE DOSE SUR L'ALLURE VOULUE (au plus +0,6 m/s au-dessus de l'allure) : le porteur couplé à
    // son ballon (movement) ne le dépasse plus ; dosée sur l'allure couplée, chaque touche resservait la même lenteur et la conduite s'enrayait
    // (mesuré : le temps de conduite à 1-2 m/s triplé). Absent : l'allure de l'instant, hier au bit.
    const vP = player.vPlan != null ? Math.max(player.speed, Math.min(player.vPlan, player.speed + (player.vPlanPas ?? 0.6))) : player.speed;   // +0,6 m/s par touche : +1,5 poussait le ballon à 0,9 m devant et 0,9 touche/s (mesuré 1,4-2,3/s en conduite droite)
    const lead = (touchDistance(vP) / (1 + turn * 1.9)) * kSpace * (player.leadF ?? 1) * (player.touchF ?? 1) * (player.serreK ?? 1);   // (290) × serreK : la touche se serre sous la pression lue (serre.js ; absent : 1)
    // …et le canal VITESSE (player.touchDamp, absent = 1 : bit-près) : une touche d'AMORTI EN
    // COURSE absorbe au lieu de relancer — le ballon roule SOUS l'allure du corps et se cale
    // pour la frappe. Mesuré sans lui : pushSpeed lit la vitesse du porteur, donc chaque touche
    // « courte » RELANÇAIT le ballon à v+1 (7,0 mesuré à 6,1 de course) — le ballon de course ne
    // se posait jamais, le tir jamais armé (l'empalement sur le gardien).
    const sp0 = Math.max(2.0, Math.max(c.minPush, pushSpeed(vP, lead, c.sol)) * (player.touchDamp ?? 1)), sp = player.serreV != null ? Math.min(sp0, Math.max(2.0, player.speed + player.serreV)) : sp0;   // (290) pressé : le ballon pas plus vite que le corps de plus de serreV
    // the touch aims where the player WANTS to go (this is what carries the ball through a turn),
    // blended with the ball's current line so a touch never teleports its direction
    const cvx = ball.v[0], cvz = ball.v[2];
    const cl = hyp(cvx, cvz);
    const curX = cl > 0.2 ? cvx / cl : wantX, curZ = cl > 0.2 ? cvz / cl : wantZ;
    // UNE TOUCHE QUI CORRIGE, CORRIGE VRAIMENT : quand la ligne du ballon a divergé de plus de
    // 60° du cap voulu (déviation, duel, rebond), le mélange avec la ligne courante perpétuait
    // l'erreur — la queue de 111° d'écart mesurée. Ce cas-là, le pied REPREND le ballon plein cap.
    const div = Math.acos(Math.max(-1, Math.min(1, curX * wantX + curZ * wantZ)));
    const steerK = div > Math.PI / 3 ? 1 : c.steer;
    let dx = curX + (wantX - curX) * steerK, dz = curZ + (wantZ - curZ) * steerK;
    const dl = hyp(dx, dz) || 1; dx /= dl; dz /= dl;
    // LEAD THE TURN: by the time the player catches this touch they will have rotated further, so
    // aim inside the curve rather than down the current tangent. Touching the tangent is exactly
    // what leaves the ball drifting to the outside and behind on a curved run.
    if (turn > 1e-4) {
      // rotate by HALF the turn the player will complete before catching this touch — aim at the
      // middle of the arc. Using an eyeballed fraction of a stride instead was 13× too small and
      // left the ball drifting to the outside of every curve.
      const a = (player.turnRate || 0) * touchInterval(player.speed, lead, c.sol) * 0.5;
      const ca = Math.cos(a), sa = Math.sin(a);
      const rx = dx * ca - dz * sa, rz = dx * sa + dz * ca;
      dx = rx; dz = rz;
    }
    // UNE TOUCHE EST UNE VITESSE, JAMAIS UNE POSITION. `setVelocity` passe par le corps du ballon
    // quand il y en a un (ball-body.js), et reste compatible avec un objet nu pour les prédicteurs et
    // les harnais qui simulent des futurs sur une copie.
    let spT = player.corpsK ? toucheCorpsDe(sp, dx, dz, player.corps, player.speed, player.corpsK) : sp;   // (292) LA TOUCHE SUIT LE CORPS (touche-corps.js) : on pousse loin devant soi, on crochète court
    // (2026-09-24) LA TOUCHE PLANIFIÉE SUR LA FOULÉE (player.pas.prochains — pas.js ; absent : hier au bit) : la longueur voulue (lead,
    // la loi d'hier) devient un RENDEZ-VOUS — la fin de vol d'un des prochains pieds la plus proche de l'intervalle de reprise (touchInterval),
    // et le ballon part vers le point où CE pied sera alors (le corps à sa vitesse, le pied dans son couloir), à la vitesse qui l'y amène
    // freiné par la pelouse (s = v₀t − at²/2). Poussé « à x m » sans égard aux pieds, le ballon traversait le couloir de l'autre pied et
    // arrivait entre deux poses : la moitié des touches se jouaient à 0,45 m du pied rendu (mode « fin »).
    if (piedPas && player.pas?.prochains && player.speed >= (c.pasV ?? 1.0)) {
      const tVoulu = player.toucheT ?? touchInterval(vP, lead, c.sol), R = player.pas.prochains.filter((r) => r.t > 0.12);   // (player.toucheT, cfg.conduite.cadence — le duel) LA CADENCE MESURÉE du dribble (Zago 2016) : le rendez-vous au pied de la touche suivante, pas au bout du roulement (≈ 2 s à 3,5 m/s : le ballon partait, roulait, le porteur le rattrapait — un corps à part)
      const rdv = R.reduce((b, r) => (!b || Math.abs(r.t - tVoulu) < Math.abs(b.t - tVoulu) ? r : b), null);
      if (rdv) {
        // (2026-09-25) …LE CORPS SUIT SON ARC : en virage, le rendez-vous calculé sur la tangente (le corps tout droit à sa vitesse) envoyait le
        // ballon DEHORS — mesuré : lacet ≥ 2,5 rad/s, 11 % de touches au contact d'un pied, 46 % au rattrapage de fin de vol (pied à 0,35 m).
        // Le corps tourne à son lacet de l'instant (pas.js) jusqu'au cap voulu (sans le dépasser) ; la vitesse tourne avec lui, le pied se
        // pose dans le repère du corps TOURNÉ.
        const kP = vP / Math.max(0.5, player.speed), vel0 = player.vel ?? [hx * player.speed, hz * player.speed], vel = [vel0[0] * kP, vel0[1] * kP], yaw0 = player.yaw ?? Math.atan2(hz, hx), om = player.pas.lacet ?? 0;   // le corps à l'allure voulue
        const dPsi = Math.atan2(Math.sin(Math.atan2(wantZ, wantX) - yaw0), Math.cos(Math.atan2(wantZ, wantX) - yaw0));
        const rot = (tt) => { const a = om * tt; return Math.sign(om) === Math.sign(dPsi) ? Math.sign(a) * Math.min(Math.abs(a), Math.abs(dPsi)) : a * Math.exp(-tt / 0.2); };
        let bxp = px, bzp = pz; const N = 8, h = rdv.t / N;
        for (let k = 0; k < N; k++) { const a = rot((k + 0.5) * h), ca = Math.cos(a), sa = Math.sin(a); bxp += (vel[0] * ca - vel[1] * sa) * h; bzp += (vel[0] * sa + vel[1] * ca) * h; }
        if (player.cage) { const [hx, hz, mc] = player.cage; bxp = Math.max(-hx + mc, Math.min(hx - mc, bxp)); bzp = Math.max(-hz + mc, Math.min(hz - mc, bzp)); }   // (player.cage, le duel) le corps s'arrête à la grille (murCorps) : un rendez-vous prédit au-delà envoyait le ballon dans le mur
        const yT = yaw0 + rot(rdv.t), fx = Math.cos(yT), fz = Math.sin(yT);
        const lat = rdv.droite * 1.25;                                                   // dans SON couloir, un peu dehors : l'autre pied passe à côté
        let tx = bxp + fx * rdv.avant - fz * lat, tz = bzp + fz * rdv.avant + fx * lat;
        if (player.cage) { const [hx, hz] = player.cage, r = BALL.radius + 0.02; tx = Math.max(-hx + r, Math.min(hx - r, tx)); tz = Math.max(-hz + r, Math.min(hz - r, tz)); }
        const ex = tx - ball.p[0], ez = tz - ball.p[2], el = hyp(ex, ez), a = touchDecel(vP, c.sol);
        if (el > 0.05) { const v0 = el / rdv.t + a * rdv.t / 2, vR = c.rdvPied && c.sol ? vitesseRdv(el, rdv.t, c.sol) : null; dx = ex / el; dz = ez / el; spT = vR ?? (v0 >= a * rdv.t ? v0 : Math.sqrt(2 * a * el)); const aT = rot(rdv.t), vl = hyp(vel[0], vel[1]) || 1; d.rdv = { pied: rdv.pied, t: d.horloge + rdv.t, cible: [tx, tz], corps: [bxp, bzp], cap: [(vel[0] * Math.cos(aT) - vel[1] * Math.sin(aT)) / vl, (vel[0] * Math.sin(aT) + vel[1] * Math.cos(aT)) / vl] };   /* (c.rdvPied) la vitesse inversée sur le sol même ; le corps prédit et son cap d'arrivée — le porteur tient cette ligne jusqu'à la touche (match-sim) */ if (player.pas.P) player.pas.P.rdv = { pied: rdv.pied, reste: rdv.t }; }
      }
    }
    setVelocity(ball, [dx * spT, Math.max(ball.v[1], 0), dz * spT],
      [ball.v[2] / BALL.radius, 0, -(dx * spT) / BALL.radius]);   // le pied la fait rouler : lift avant
    d.sinceTouch = 0; d.touches++; touched = true; if (piedPas) d.pasJoue[piedPas] = true;
    // LA TOUCHE PORTE SA GÉOMÉTRIE (lot 55) : l'angle entrant→sortant et la vitesse du kick —
    // l'événement les inscrit, la scène en fait un GESTE (une cassure de 110° n'est pas une
    // caresse de course). Calcul pur sur des valeurs déjà là : la physique ne bouge pas d'un bit.
    // …un ballon RASSEMBLÉ (quasi posé au pied — la prise du lot 58) n'a plus de ligne : sa
    // cassure se lit contre le CAP DU CORPS (heading → kick), le vrai angle du demi-tour.
    ev = { dev: Math.acos(Math.max(-1, Math.min(1, (cl > 0.2 ? curX : hx) * dx + (cl > 0.2 ? curZ : hz) * dz))) * 180 / Math.PI, spd: sp, ...(piedPas ? { foot: piedPas, pas: pasMode, ...(pasPorteeV != null ? { portee: pasPorteeV } : {}) } : player.pas ? { pas: 'lent' } : {}) };
  }

  advance(ball, dt);

  const nd = hyp(ball.p[0] - px, ball.p[2] - pz);
  d.lost = nd > c.controlRadius;
  return { touched, ev, dist: nd, ahead, control: Math.max(0, 1 - nd / c.controlRadius), lost: d.lost };
}

/**
 * Contract for a dribble trace ([{t, dist, ahead, touched, speed}]). These rules are written
 * against the FAILURE MODES of fake dribbling, not against the implementation:
 *   glued      — a constant ball–player distance is the signature of a welded ball
 *   runaway    — the ball must stay inside control range for a clean dribble
 *   behind     — the ball must lead the player, not trail them
 *   machine-gun— one touch per stride, not one per frame
 */
export function checkDribble(trace, { controlRadius = 4.2, minVariation = 0.15, maxTouchRate = 4 } = {}) {
  const issues = [];
  if (trace.length < 10) return { ok: false, issues: ['trace trop courte'] };
  const dists = trace.map((s) => s.dist);
  const mean = dists.reduce((a, b) => a + b, 0) / dists.length;
  const sd = Math.sqrt(dists.reduce((a, b) => a + (b - mean) ** 2, 0) / dists.length);
  if (sd < minVariation) issues.push(`ballon COLLÉ au joueur (écart-type ${sd.toFixed(3)} m — un vrai dribble respire)`);
  const worst = Math.max(...dists);
  if (worst > controlRadius) issues.push(`ballon perdu : ${worst.toFixed(2)} m > rayon de contrôle ${controlRadius} m`);
  const behind = trace.filter((s) => s.ahead < -0.15).length / trace.length;
  if (behind > 0.25) issues.push(`le ballon traîne DERRIÈRE le joueur ${(behind * 100).toFixed(0)}% du temps`);
  const dur = trace[trace.length - 1].t - trace[0].t;
  const touches = trace.filter((s) => s.touched).length;
  if (dur > 0 && touches / dur > maxTouchRate) issues.push(`${(touches / dur).toFixed(1)} touches/s — le pied mitraille le ballon`);
  if (touches === 0) issues.push('aucune touche : le ballon n\'est jamais joué');
  return { ok: issues.length === 0, issues, stats: { mean: +mean.toFixed(2), sd: +sd.toFixed(2), worst: +worst.toFixed(2), touches } };
}
import { hyp } from './hyp.js';
