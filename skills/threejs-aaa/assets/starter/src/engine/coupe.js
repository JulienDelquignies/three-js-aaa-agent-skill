// coupe — LES VIRAGES EN CHANGEMENT D'APPUI (cfg.coupe && st.full — le duel, 2026-09-27 : « il manque les virages en changement d'appui,
// les courbes ne vont pas : les joueurs font des virages secs avec des changements d'appui »).
//
// Mesuré avant (sonde virages-appui, 8 graines × 120 s) : un virage de 45-90° durait 0,53 s sur un ARC de 1,1 m de rayon (p50), 34 % de l'angle
// pris pendant un VOL (aucun pied au sol : physiquement impossible — sans appui, pas de force) et au plus 35 % sur un même appui ; la loi
// de la locomotion plafonnait l'accélération latérale à turnAccel (6 m/s²) partout et tout le temps. Le réel (Dos'Santos et al. 2021,
// J Sports Sci, 27 hommes, sans ballon) : la coupe se fait sur UN appui planté — 45° / 90° / 180° : approche 5,22 / 4,51 / 4,00 m/s, pose
// 5,06 / 3,43 / 2,68, sortie 5,27 / 3,29 / 2,20 ; appui 0,20 / 0,30 / 0,51 s ; au-delà de ~60° l'avant-dernier appui FREINE (la vitesse de
// pose). Soit, pendant l'appui de coupe, 15-20 m/s² de poussée (une coupe de 45° à 5 m/s en 0,2 s) — trois fois le plafond continu.
//
// LA LOI (joueurs de champ SANS le ballon — le porteur garde sa conduite). (1) Sans appui, la vitesse ne change pas : pendant un VOL de la
// foulée (pas.pasEtat) la course est balistique ; sur l'appui, la locomotion reçoit l'accélération du cycle (÷ la part d'appui du cycle). (2) LA COUPE : un joueur de champ lancé sans le
// ballon (≥ vMin) dont la course voulue s'écarte de ≥ angle° de sa vitesse COUPE — pas de côté : le pied OPPOSÉ au virage se plante (virer à
// droite : l'appui gauche), l'avant-dernier appui freine à la vitesse de pose (≥ frein°, pas.freinCoupe), puis sur l'appui planté le vecteur
// vitesse va de celui de pose à celui de sortie sur la course voulue (arrêtée à la pose), en la durée d'appui mesurée ;
// le regard suit (le slew de course, 9,4 rad/s, y suffit). L'horloge de foulée tient le pied planté au sol toute la durée (pas.js) et le rendu le pose écarté (motion-gait, opts.coupe).
import { pasEtat, freinCoupe, pasVols } from './pas.js';
import { startGesture } from './gesture.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), D = 180 / Math.PI;
const lerp3 = (x, a, b, c) => (x <= 90 ? a + (b - a) * Math.max(0, x - 45) / 45 : b + (c - b) * (x - 90) / 90);
/** La durée de l'appui de coupe (s) selon l'angle (°) — Dos'Santos et al. 2021 : 0,20 / 0,30 / 0,51 s à 45 / 90 / 180° (0,18 en deçà). */
export const appuiCoupe = (deg) => (deg < 45 ? 0.18 + 0.02 * (deg - 30) / 15 : lerp3(Math.min(180, deg), 0.20, 0.30, 0.51));
/** La vitesse de SORTIE rapportée à l'approche (Dos'Santos : 5,27/5,22 ; 3,29/4,51 ; 2,20/4,00). */
export const sortieCoupe = (deg) => (deg <= 45 ? 1.0 : lerp3(Math.min(180, deg), 1.0, 0.73, 0.55));

/** La coupe de ce pas de temps pour p : { v } (la vitesse imposée — l'appui de coupe ou son frein), { gate } (le facteur de la locomotion
 *  ordinaire : 0 en vol, 1/part d'appui sur l'appui), et p._coupe tenu. want = [wx, wz], la course voulue (m/s). */
export function coupeStep(st, p, cfg, wx, wz, dt) {
  const K = cfg.coupe, E = pasEtat(p), P = p._pas, sp = Math.hypot(p.v[0], p.v[1]);
  const auSol = !E || E.appui.left || E.appui.right, share = P ? partAppui(P.v) : 1;
  const porteur = st.possession?.carrier === p.id && st.phase === 'carry';
  let C = p._coupe;
  if (C && C.etat === 'fin' && st.t >= C.until) C = p._coupe = null;
  if (porteur && !C) {   // le PORTEUR garde sa conduite (les touches calées sur la foulée, pas.js) — sauf LA COUPE BALLE AU PIED (K.porteur, plus bas)
    C = K.porteur && E ? coupePorteur(st, p, cfg, wx, wz, E, sp) : null;
    if (!C) return !p.act && (p._coupeTenir ?? -1) > st.t ? { v: [p.v[0], p.v[1]], gate: 0 } : { v: null, gate: 1 };   // (la coupe attend son pied : la course TENUE, pas tournée en courbe)
  }
  // LA DÉCISION : lancé, sans le ballon, pas de geste, la course voulue loin de la vitesse
  const avant = Math.cos(wrap(Math.atan2(p.v[1], p.v[0]) - p.yaw)) > 0.5;   // en COURSE AVANT (le recul, le pas chassé du jockey changent d'appui autrement)
  if (!C && E && !p.keeper && !porteur && !p.act && avant && sp >= (K.vMin ?? 1.8) && Math.hypot(wx, wz) >= 1.0) {
    const from = Math.atan2(p.v[1], p.v[0]), to = Math.atan2(wz, wx), d = wrap(to - from), ang = Math.abs(d) * D;
    if (ang >= (K.angle ?? 35)) {
      const cote = Math.sign(d), pied = cote > 0 ? 'left' : 'right';   // pas de côté : virer à DROITE (lacet croissant) se pousse sur l'appui GAUCHE
      C = p._coupe = { etat: 'attente', cote, pied, from, to, d, ang, vApp: sp, vPose: sp * freinCoupe(ang), t0: st.t, G: appuiCoupe(ang) };
      // la POSE ÉCARTÉE du pied de coupe (rendu) : la poussée latérale moyenne de l'appui (m/s²) — une jambe qui pousse de côté se pose loin du bassin
      const aLat = sp * Math.sin(Math.min(Math.PI / 2, Math.abs(d))) / Math.max(0.15, C.G); C.lat = Math.min(K.latMax ?? 0.5, (K.lat0 ?? 0.18) + (K.latK ?? 0.018) * aLat);
      st.events.push({ t: +st.t.toFixed(2), type: 'coupe', phase: 'decide', by: p.id, ang: +ang.toFixed(0), pied, v: +sp.toFixed(1) });
    }
  }
  if (!C || C.etat === 'fin') return { v: null, gate: porteur ? 1 : auSol ? 1 / share : 0 };
  if ((p.act && !(C.porteur && p.act.payload?.coupe)) || (porteur !== !!C.porteur) || p.down > 0) { p._coupe = null; return { v: null, gate: porteur ? 1 : auSol ? 1 / share : 0 }; }   // un geste, le ballon reçu (ou perdu), une chute : la coupe s'efface — la coupe du porteur vit avec SA touche
  if (C.etat === 'attente') {
    // le pied de coupe se POSE (fin de son vol) — ou il est déjà au sol seul à la décision : l'appui de coupe commence
    // au-delà de frein°, L'ORDRE DES APPUIS : l'avant-dernier (l'autre pied) FREINE d'abord, le pied de coupe ne porte le virage qu'après lui — un
    // demi-tour à 4 m/s planté sur un seul appui laissait le corps filer 0,5 m au-delà du pied (grand écart, bassin à genoux, mesuré au rendu)
    const autreP = C.pied === 'left' ? 'right' : 'left';
    if (P?.evt?.[autreP] === 'fin') C.pfc = true;
    const ordreOk = C.ang < (K.frein ?? 60) || C.pfc;
    const pose = ordreOk && (P?.evt?.[C.pied] === 'fin' || (st.t === C.t0 && E.appui[C.pied] && st.t - (P?.poseT?.[C.pied] ?? -9) < (K.recente ?? 0.07)));   // (ou posé à l'instant : un appui déjà à mi-course ne porte plus la coupe — la pose suivante)
    if (pose) { C.etat = 'appui'; C.tA = st.t; C.vA = Math.min(sp, Math.max(C.vPose, sp * 0.9)); C.fromA = Math.atan2(p.v[1], p.v[0]); C.dA = wrap(C.to - C.fromA);
      st.events.push({ t: +st.t.toFixed(2), type: 'coupe', phase: 'appui', by: p.id, ang: +(Math.abs(C.dA) * D).toFixed(0), pied: C.pied, v: +sp.toFixed(1) }); }
    else if (st.t - C.t0 > (K.attente ?? 0.45)) { p._coupe = null; return { v: null, gate: auSol ? 1 / share : 0 }; }
    else {
      // L'AVANT-DERNIER APPUI FREINE (≥ frein°) : sur l'autre pied au sol, la vitesse descend vers celle de pose (≤ freinA m/s²) ; en vol, rien
      const autre = E.appui[C.pied === 'left' ? 'right' : 'left'];
      if (C.ang >= (K.frein ?? 60) && autre && sp > C.vPose) { const nv = Math.max(C.vPose, sp - (K.freinA ?? 12) / share * dt), k = nv / Math.max(1e-6, sp); return { v: [p.v[0] * k, p.v[1] * k], gate: 0 }; }
      return { v: auSol ? null : [p.v[0], p.v[1]], gate: 0 };   // en attendant la pose, la course ne tourne pas (le virage attend l'appui)
    }
  }
  // L'APPUI DE COUPE : la poussée garde sa direction sur l'appui — le VECTEUR vitesse va en ligne droite de l'entrée (vA sur le cap d'approche) à
  // la sortie (vS sur la course voulue) en G s : le demi-tour passe près de l'arrêt (freine, repart), la coupe de 45° creuse à peine. (Le cap qui
  // TOURNAIT à allure tenue faisait décrire au corps un arc de ~1 m autour du pied planté en 0,45 s — hors de portée de la jambe : le pied glissait.)
  const u = Math.min(1, (st.t - C.tA) / C.G), e = u * u * (3 - 2 * u), vS = C.vSortie ?? C.vApp * sortieCoupe(C.ang);   // (vSortie : le demi-tour ARRÊTÉ du porteur sort à l'allure voulue)
  const vx = Math.cos(C.fromA) * C.vA + (Math.cos(C.to) * vS - Math.cos(C.fromA) * C.vA) * e, vz = Math.sin(C.fromA) * C.vA + (Math.sin(C.to) * vS - Math.sin(C.fromA) * C.vA) * e;
  if (u >= 1) { C.etat = 'fin'; C.until = st.t + (K.repos ?? 0.25); p._capW = C.to;
    st.events.push({ t: +st.t.toFixed(2), type: 'coupe', phase: 'fin', by: p.id, ang: +(Math.abs(C.dA) * D).toFixed(0), v: +Math.hypot(vx, vz).toFixed(1) }); }
  return { v: [vx, vz], gate: 0 };
}

/** LA COUPE BALLE AU PIED (cfg.coupe.porteur — 2026-09-27, « donne au porteur des virages secs sur appui ») : mesuré avant (virages-appui,
 *  16 × 120 s), le porteur virait en COURBE — 45°+ en 0,62 s, 15 % par une coupe, 33 % de l'angle au plus sur un appui, sortie à 2,0 m/s —
 *  quand les joueurs sans ballon coupaient en 0,25-0,35 s (88-94 % par une coupe). Le geste réel : le pied du CÔTÉ du virage (virer à droite :
 *  le droit) joue le ballon dans la nouvelle direction juste avant sa pose — la touche de coupe —, puis l'autre pied se PLANTE et pousse
 *  (la coupe des joueurs de champ, plus haut : l'avant-dernier appui freine au-delà de frein°, le vecteur vitesse tourne sur l'appui). Ici :
 *  la course voulue s'écarte de ≥ angle° de la vitesse, lancé (≥ vMin), le ballon au pied devant (≤ ballon m) ; le pied qui touche est le
 *  prochain à voler — sinon on attend le pas suivant. La touche est un temps de geste dans la foulée
 *  (pas.gesteFouleeStep : le ballon tenu devant ce pied, joué à sa pose vers la sortie, la poussée de sortie ensuite). (2026-09-28, « rendre secs
 *  aussi les virages progressifs » — des 188 virages du porteur restés en courbe : 38 voulaient presque s'arrêter en tournant, 19 attendaient le
 *  bon pied pendant que la locomotion tournait déjà) : le DEMI-TOUR ARRÊTÉ (course voulue lente, sortie à son allure) et la course TENUE pendant
 *  l'attente du pied. */
function coupePorteur(st, p, cfg, wx, wz, E, sp) {
  const K = cfg.coupe.porteur, wm = Math.hypot(wx, wz), tenu = p._coupeTenir ?? -9; p._coupeTenir = null;   // (la tenue ne survit qu'à l'attente du bon pied)
  if (p.act || p.keeper || !p._pas || sp < (K.vMin ?? 1.5) || wm < (K.voulue ?? 0.3)) return null;
  const from = Math.atan2(p.v[1], p.v[0]), to = Math.atan2(wz, wx), d = wrap(to - from), ang = Math.abs(d) * D;
  if (ang < (K.angle ?? 30)) return null;
  const cote = Math.sign(d), piedT = cote > 0 ? 'right' : 'left', pied = cote > 0 ? 'left' : 'right';
  // LE DEMI-TOUR ARRÊTÉ : la course voulue lente (le porteur veut s'arrêter en tournant — 38 des 188 virages restés en courbe) sort à son allure
  const vS = Math.min(sp * sortieCoupe(ang), Math.max(K.sortieMin ?? 0.6, wm)), G0 = appuiCoupe(ang);
  const bx = st.ball.p[0] - p.p[0], bz = st.ball.p[2] - p.p[2], db = Math.hypot(bx, bz);
  // (essayée et retirée : la coupe du CORPS SEUL quand le ballon roule déjà vers la course voulue — le corps freinait sur l'appui pendant que le
  // ballon filait : ballon gardé 68 → 46 %, libre à +1,5 s 17 % ; duel 48 × 120 s : battu 64 → 59 %, perdu 29 → 34 %)
  let vB = null;
  {
    if (db > (K.ballon ?? 0.9) || st.ball.p[1] > 0.3 || (st.ball.owner != null && st.ball.owner !== p.id) || bx * p.v[0] + bz * p.v[1] < 0) return null;
    // le pied du côté du virage joue sur SON PROCHAIN VOL (comme le crochet) : déjà en l'air à la décision, il n'avait pas le temps d'amener le
    // ballon devant lui — 30 % des touches de coupe se jouaient au rattrapage de la pose (ballon jusqu'à 0,9 m du pied), 70 % au cou-de-pied
    const V = pasVols(p, 3).filter((v) => v.t0 >= 0.02);
    if (V[0]?.pied !== piedT) {   // l'autre pied vole d'abord : on TIENT la course jusqu'au vol du bon pied (≤ tenir s) — sinon la locomotion tournait
      p._coupeTenir = tenu > st.t ? tenu : tenu > st.t - 1 ? null : st.t + (K.tenir ?? 0.4);   // en courbe pendant l'attente et l'écart retombait sous le seuil (19 des 188) — une tenue à la fois
      return null;
    }
    // LA TOUCHE VA AU RENDEZ-VOUS DU PIED DE SORTIE (la loi de la conduite : v₀ = d/t + a·t/2, le ballon freiné par la pelouse) : le porteur, après la
    // pose (~0,1 s), tourne sur l'appui (G s, à mi-vitesse de sortie en moyenne) puis sort à vS ; le pied de sortie se pose ~0,2 s après, 0,4 m devant.
    // (vS + 0,8 m/s — 3,8 m/s à 3,2 m/s d'approche — le ballon s'échappait : libre à +1,5 s après 21 % des coupes, jusqu'à 3,5 m au p90)
    const tR = 0.1 + G0 + 0.2, dR = vS * (G0 / 2 + 0.2) + 0.4, a = st.ball.sol ? st.ball.sol.dec0 + st.ball.sol.decV * Math.min(2, vS) : 1.2;
    vB = Math.max(K.vBalle?.[0] ?? 1.6, Math.min(K.vBalle?.[1] ?? 5.0, dR / tR + a * tR / 2));
    if (st.ball.owner !== p.id) st.ball.possess(p.id);
    startGesture(p, { id: 'coupeBalle', contact: 9, duration: 9 }, {
      payload: { kind: 'skill', skill: 'coupe', coupe: true, pick: { foot: piedT }, mobile: true, yaw0: p.yaw, exitYaw: to, ballMax: 0,
        foulee: { beats: [{ pied: piedT, type: 'touche', dir: to, v: vB }] } },
      log: st.gestures,
    });
    p._dribAt = st.t;
  }
  p._coupeTenir = null;
  const aLat = sp * Math.sin(Math.min(Math.PI / 2, Math.abs(d))) / Math.max(0.15, G0), KC = cfg.coupe;
  const C = p._coupe = { etat: 'attente', porteur: true, cote, pied, from, to, d, ang, vApp: sp, vPose: sp * freinCoupe(ang), vSortie: vS, t0: st.t, G: G0, lat: Math.min(KC.latMax ?? 0.5, (KC.lat0 ?? 0.18) + (KC.latK ?? 0.018) * aLat) };
  st.events.push({ t: +st.t.toFixed(2), type: 'coupe', phase: 'decide', by: p.id, ang: +ang.toFixed(0), pied, v: +sp.toFixed(1), porteur: true, vBalle: +vB.toFixed(1) });
  return C;
}

// la part d'appui du cycle (au moins un pied au sol), tabulée par allure depuis la table même de l'horloge (pas.pasEtat sur un cycle)
const PART = new Map();
function partAppui(v) {
  const k = Math.round(Math.max(0, Math.min(9, v)) * 4) / 4; let s = PART.get(k); if (s != null) return s;
  const fake = { _pas: { phi: 0, v: k } }; let n = 0, a = 0;
  for (let i = 0; i < 48; i++) { fake._pas.phi = i / 48; const e = pasEtat(fake); if (e) { n++; if (e.appui.left || e.appui.right) a++; } }
  s = n ? Math.max(0.3, a / n) : 1; PART.set(k, s); return s;
}
