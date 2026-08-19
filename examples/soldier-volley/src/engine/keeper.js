// keeper — LE GARDIEN : la position qui coupe l'angle, la décision d'arrêt, rien d'autre.
//
// Un gardien n'est pas un joueur de champ lent : c'est un MÉTIER à deux lois.
//   1. LA POSITION : sur la ligne ballon-centre du but, à une profondeur qui coupe l'angle de tir
//      — sortir grandit le gardien (l'angle couvert croît), mais l'expose au lob et au débordement.
//      La profondeur suit la distance du ballon : ballon loin → près de sa ligne (rien à couper,
//      tout à couvrir) ; ballon qui approche → il avance (jusqu'à `depthMax`) ; ballon dans la
//      surface → il RE-RECULE (le duel se joue sur le réflexe, pas sur l'angle).
//   2. L'ARRÊT : un tir cadré qui va franchir la ligne se lit sur la BALISTIQUE (où le vol coupe
//      le plan du but, dans combien de temps). Dans le petit périmètre → il se saisit (gather) ;
//      au-delà et atteignable → PLONGEON (le geste, avec armé et prix : au sol après) ; hors de
//      portée → il est battu, et c'est un état honnête (le refus se nomme, pas d'aimant à ballon).
//
// Pur et sans dépendance : des nombres entrent (pitch, ballon, position), une intention sort.
// La sim exécute (movePlayers pour les jambes, la machine de gestes pour le plongeon) ; le banc
// rejoue les lois une par une (verify-keeper).

/** Les constantes du métier — bornées, commentées, sondables. */
export const KEEPER = {
  depthMin: 0.45,       // m — jamais collé À la ligne (le petit filet existe)
  depthMax: 2.6,        // m — jamais plus loin : au-delà c'est un libéro, pas un gardien (v1)
  depthGain: 0.11,      // m de sortie par m de ballon qui approche (entre far et near)
  farBall: 24,          // m — au-delà, profondeur minimale
  nearBall: 7,          // m — en deçà, le gardien re-recule (le duel du réflexe)
  gatherHalf: 0.55,     // m — un vol qui coupe le plan à moins que ça : il se saisit sans plonger
  diveReach: 2.95,      // m — l'envergure d'un plongeon : 1,35 de root motion (le clip) + ~1,6 de
                        // bras (IK deux os + warp de gant, audit-gants). 2,1 déclarait « battu »
                        // toute frappe aux coins du GRAND but (±3,11 depuis le centre) : mesuré
                        // sur matchs complets — 3 plongeons sur 21 tirs, 0 arrêt, 13 buts. La
                        // décision doit croire ce que le corps livré sait faire.
  diveTime: 0.9,        // s — le vol doit couper le plan dans ce délai pour déclencher (sinon on se replace)
  floatRead: 2.4,       // × réflexe — la FLOTTANTE (vol > 18 m/s à < 2 rad/s de spin) se lit tard :
                        // pas d'axe de rotation à deviner, le départ du plongeon se paie (lot 39)
  reflex: 0.12,         // s — le tir doit avoir volé au moins ça avant le déclenchement (pas d'oracle)
  groundTime: 0.65,     // s — le temps AU SOL après le plongeon (amortir, lire le jeu — réel 0,5-1,5 ;
                        // mesuré avant : 0,3 s, le corps repartait sans avoir touché terre — note 132)
  riseTime: 1.25,       // s — le relevé PAR ÉTAPES (rouler → appui bras → genou → debout), tronc borné
                        // ~250°/s (mesuré avant : 0,15-0,27 s, 700°/s, 11 m/s vertical — la catapulte)
  fallRest: 0.55,       // s — le reste de la CHUTE après la résolution du gant : le contact vit en l'air,
                        // le corps retombe encore (clip : contact 0,55 → couché 1,2)
};

/**
 * LE RELEVÉ A UN PRIX (lot 91). Un plongeon couche le corps ; se relever = sol (lire le jeu) +
 * étapes, et l'AGILITÉ est un FACTEUR (attributes.getupF [0,72 ; 1,28] → 0,9-1,6 s de relevé —
 * sans note : 1, le monde moyen). `resolved` : un arrêt paie AUSSI le reste de sa chute (le gant
 * résout en l'air) ; le battu a déjà fini de tomber quand son geste meurt.
 */
export function keeperRise(getupF = 1, resolved = true, K = KEEPER) {
  const getup = K.riseTime * Math.max(0.5, Math.min(2, getupF));
  return { ground: K.groundTime, getup, total: K.groundTime + getup + (resolved ? K.fallRest : 0) };
}

/**
 * LE BLOCAGE DU BUSTE (lot 93, st.full && cfg.parades — appelé par receive, branche gardien).
 * Un tir DANS LE CORPS, rapide (≥ cfg.busteV) et à hauteur de POITRINE, ne se cueille pas en
 * mains : le buste ENCAISSE, le ballon rebondit devant (un 50/50 honnête — le vrai football des
 * frappes dans le gardien), l'arrêt se nomme {mode:'buste'} pour la scène (clip paradeBuste).
 * Sous le seuil ou hors de la fenêtre : false — la prise d'hier, au bit près.
 */
export function busteBlock(st, gk, cfg) {
  const vIn = Math.hypot(st.ball.v[0], st.ball.v[1] ?? 0, st.ball.v[2]);
  const y = st.ball.p[1] ?? 0;
  if (vIn < (cfg.busteV ?? 12) || y < 0.85 || y > 1.45) return false;
  st.ball.impulse([-st.ball.v[0] * 1.55, -(st.ball.v[1] ?? 0) * 0.8, -st.ball.v[2] * 1.55]);
  if (st.ball.owner != null) st.ball.release('perte');
  st.possession.carrier = -1; st.phase = 'loose'; st.hold = 0; st.pressure = 0;
  st.lastTouch = gk.team; st.pass = null;
  st.events.push({ t: +st.t.toFixed(2), type: 'arrêt', by: gk.id, mode: 'buste' });
  return true;
}

/**
 * OÙ VIVENT LES GANTS (lot 91). Le point du ballon TENU après une prise : contre la poitrine,
 * AU SOL pendant le couché, remonté avec le relevé — la sim énonce le profil (le QUOI), la scène
 * ancre les mains dessus (le COMMENT). `u` : 0 couché → 1 debout, lu de gk.down contre le relevé.
 */
export function keeperHoldPoint(gk, K = KEEPER) {
  const u = gk.rise && gk.down > 0 ? Math.max(0, Math.min(1, 1 - gk.down / gk.rise.getup)) : 1;
  const y = 0.24 + 0.71 * u * u;                       // l'écrasement au sol, la remontée avec le tronc
  return [gk.p[0] + Math.cos(gk.yaw) * 0.32, y, gk.p[2] + Math.sin(gk.yaw) * 0.32];
}

/**
 * LA POSITION. Renvoie le point où le gardien de `team` doit être, pour un ballon en `ball` (xz).
 * Sur le segment ballon → centre du but, à `depth` du but, borné latéralement à l'ouverture
 * (un gardien ne couvre pas le poteau depuis l'extérieur du poteau).
 */
export function keeperSpot(pitch, team, ball, K = KEEPER) {
  const g = pitch.ownGoal(team);
  const dx = ball[0] - g.x, dz = ball[2] - 0;
  const d = Math.hypot(dx, dz) || 1e-6;
  const t = Math.max(0, Math.min(1, (K.farBall - d) / (K.farBall - K.nearBall)));
  // approche → sort ; très près (sous nearBall) → re-recule linéairement vers depthMin
  let depth = K.depthMin + (K.depthMax - K.depthMin) * t;
  if (d < K.nearBall) depth = K.depthMin + (K.depthMax - K.depthMin) * Math.max(0, d / K.nearBall) * (K.nearBall - K.depthMin) / K.nearBall;
  depth = Math.max(K.depthMin, Math.min(K.depthMax, depth));
  const x = g.x + (dx / d) * depth;
  const z = (dz / d) * depth;
  return { x, z: Math.max(-pitch.goalHalf + 0.2, Math.min(pitch.goalHalf - 0.2, z)), depth };
}

/**
 * LE VOL COUPE-T-IL MON PLAN ? Balistique plate (la traînée du vrai vol est faible sur 10-20 m ;
 * le banc borne l'erreur) : renvoie { t, z, y } au franchissement du plan x = ligne de but du
 * gardien, ou null si le vol s'en éloigne / retombe avant.
 */
export function shotCross(pitch, team, ball, ballV, g = 9.81) {
  const goal = pitch.ownGoal(team);
  const vx = ballV[0];
  const dx = goal.x - ball[0];
  if (Math.abs(vx) < 1e-4 || Math.sign(vx) !== Math.sign(dx)) return null;   // ne va pas vers ma ligne
  const t = dx / vx;
  if (t <= 0 || t > 2.5) return null;
  const z = ball[2] + ballV[2] * t;
  const y = Math.max(0, (ball[1] ?? 0.11) + (ballV[1] ?? 0) * t - 0.5 * g * t * t);
  return { t, z, y };
}

/**
 * LA DÉCISION. Renvoie l'intention du gardien :
 *   { mode: 'poste', spot }                      — se placer (la loi n°1)
 *   { mode: 'gather', spot }                     — le vol arrive dans le petit périmètre : s'en saisir
 *   { mode: 'dive', side, cross }                — plongeon (side = signe z du plongeon)
 *   { mode: 'battu', cross }                     — hors de portée : l'état honnête
 * `shotAge` : depuis combien de temps ce vol existe (le réflexe n'est pas un oracle).
 */
export function keeperDecide(pitch, team, me, ball, ballV, shotAge = Infinity, K = KEEPER, threat = true, spin = null) {
  const spot = keeperSpot(pitch, team, ball, K);
  const cross = shotCross(pitch, team, ball, ballV);
  const speed = Math.hypot(ballV[0], ballV[2]);
  // UNE PASSE EN RETRAIT N'EST PAS UN TIR : sans menace (dernier contact = SA propre équipe), le
  // gardien ne plonge JAMAIS — il vient CUEILLIR le ballon qui arrive vers lui (mesuré avant :
  // 10 plongeons sur 14 étaient des essuie-glaces sur les retraits de ses défenseurs).
  if (!threat) {
    if (cross && speed >= 2 && cross.t < 1.4) return { mode: 'gather', spot: { x: spot.x, z: Math.max(-pitch.goalHalf + 0.2, Math.min(pitch.goalHalf - 0.2, cross.z)), depth: spot.depth } };
    return { mode: 'poste', spot };
  }
  // UNE BALLE MOLLE QUI RENTRE SE RAMASSE. Sous le seuil de tir (6 m/s), un vol qui coupe quand
  // même le plan du but n'est pas un « poste » : le gardien SORT DESSUS et s'en saisit — mesuré
  // avant la loi : des roulements de 2-5 m/s (touche de conduite, poke de tacle, contrôle long)
  // finissaient au fond pendant que le gardien tenait son spot en spectateur (5 buts sans tir).
  if (cross && speed >= 1.5 && speed < 6 && cross.t < 2.2 && Math.abs(cross.z) <= pitch.goalHalf + 0.3 && cross.y < 1.2) {
    return { mode: 'gather', spot: { x: spot.x, z: Math.max(-pitch.goalHalf + 0.2, Math.min(pitch.goalHalf - 0.2, cross.z)), depth: spot.depth } };
  }
  // LE UN-CONTRE-UN : un ballon LENT (porté, conduit, roulant — pas un tir) DANS SA SURFACE se
  // CHARGE — le gardien sort au-devant, sur la ligne ballon-but, à un pas du ballon. La sortie
  // dans les pieds a besoin de jambes : posté à 2 m du trajet, il regardait le dribble du
  // repique le traverser (7 buts sans tir mesurés après la loi du cut-inside).
  {
    const g = pitch.ownGoal(team);
    if (speed < 6.5 && pitch.inBox(ball[0], ball[2], Math.sign(g.x)) ) {
      const dx = g.x - ball[0], dz = 0 - ball[2];
      const dl = Math.hypot(dx, dz) || 1;
      return { mode: 'sortie', spot: { x: ball[0] + (dx / dl) * 0.55, z: Math.max(-pitch.goalHalf - 1.5, Math.min(pitch.goalHalf + 1.5, ball[2] + (dz / dl) * 0.55)), depth: spot.depth } };
    }
  }
  // LA FLOTTANTE SE LIT TARD (lot 39) : un vol RAPIDE quasi SANS EFFET (< 2 rad/s — pas d'axe
  // de rotation à lire, la trajectoire ne se « devine » pas) étire le réflexe (× floatRead) —
  // le gardien part en retard, le plongeon se compresse. Les frappes de cou-de-pied portent
  // leur rotation lisible (≥ 3 rad/s) : lecture d'hier, au bit près quand spin est absent.
  const floaty = spin != null && spin < 2 && speed > 18;
  if (!cross || speed < 6 || shotAge < K.reflex * (floaty ? (K.floatRead ?? 2.4) : 1)) return { mode: 'poste', spot };
  if (cross.t > K.diveTime) return { mode: 'poste', spot };                    // trop tôt : se replacer d'abord
  if (Math.abs(cross.z) > pitch.goalHalf + 0.6 || cross.y > pitch.goalH + 0.4) return { mode: 'poste', spot }; // non cadré
  const dz = cross.z - me[2];
  if (Math.abs(dz) <= K.gatherHalf) return { mode: 'gather', spot: { x: spot.x, z: cross.z, depth: spot.depth } };
  if (Math.abs(dz) <= K.diveReach) return { mode: 'dive', side: Math.sign(dz), cross };
  return { mode: 'battu', cross };
}

/**
 * CONTRAT. Les façons dont un gardien redevient un cône : hors de la ligne ballon-but (il ne
 * coupe rien), profondeur crevée (libéro ou poteau rentré), plongeon-oracle (avant le réflexe),
 * plongeon sur un ballon non cadré, aimant à ballon (arrêt déclaré hors d'envergure).
 */
export function checkKeeper(pitch, K = KEEPER) {
  const issues = [];
  // 1. la position vit sur la ligne ballon-but (échantillon d'angles et de distances)
  for (const [bx, bz] of [[0, 0], [8, 6], [15, -9], [4, 3], [20, 0]]) {
    const s = keeperSpot(pitch, 0, [pitch.ownGoal(0).x + bx, 0, bz], K);
    const g = pitch.ownGoal(0);
    const cross = (bx) * (s.z - 0) - (bz) * (s.x - g.x);              // colinéarité (ballon-but) × (gardien-but)
    const clamped = Math.abs(s.z) >= pitch.goalHalf - 0.25;           // …sauf borné à l'ouverture
    if (Math.abs(cross) > 0.35 && !clamped) issues.push(`gardien hors de la ligne ballon-but (ballon +${bx}/${bz} : écart ${cross.toFixed(2)})`);
    if (s.depth < K.depthMin - 1e-6 || s.depth > K.depthMax + 1e-6) issues.push(`profondeur crevée (${s.depth.toFixed(2)})`);
  }
  // 2. loin → près de sa ligne ; à l'approche → il sort
  const far = keeperSpot(pitch, 0, [0, 0, 0], K).depth;
  const mid = keeperSpot(pitch, 0, [pitch.ownGoal(0).x + 12, 0, 0], K).depth;
  if (!(mid > far)) issues.push(`le gardien ne sort pas quand le ballon approche (loin ${far.toFixed(2)}, à 12 m ${mid.toFixed(2)})`);
  // 3. pas d'oracle : un tir trop jeune ne déclenche pas
  const me = [pitch.ownGoal(0).x + 0.6, 0, 0];
  const shot = keeperDecide(pitch, 0, me, [me[0] + 9, 0.11, 1.5], [-14, 2.0, 0.5], 0.02, K);
  if (shot.mode === 'dive' || shot.mode === 'gather') issues.push('plongeon-oracle : le gardien lit un tir de 20 ms');
  // 4. un tir cadré atteignable déclenche ; le même hors d'envergure est un état « battu »
  const onT = keeperDecide(pitch, 0, me, [me[0] + 9, 0.11, 1.6], [-14, 1.5, -1.0], 0.3, K);
  if (onT.mode !== 'dive' && onT.mode !== 'gather') issues.push(`tir cadré atteignable non traité (${onT.mode})`);
  // une passe en retrait (menace = false), même rapide et cadrée, ne déclenche JAMAIS un plongeon
  const retrait = keeperDecide(pitch, 0, me, [me[0] + 9, 0.11, 1.5], [-14, 1.5, -0.9], 0.3, K, false);
  if (retrait.mode === 'dive') issues.push('le gardien plonge sur une passe en retrait de sa propre équipe');
  // une balle MOLLE qui coupe le plan (roulement de 3 m/s vers le petit filet) se RAMASSE — le
  // poste-spectateur laissait rentrer les touches de conduite et les pokes de tacle
  const molle = keeperDecide(pitch, 0, me, [me[0] + 4, 0.11, 0.8], [-3, 0, 0], Infinity, K);
  if (molle.mode !== 'gather' && molle.mode !== 'sortie') issues.push(`balle molle qui rentre non ramassée (${molle.mode} — le gardien regarde le ballon franchir sa ligne)`);
  // le UN-CONTRE-UN : un ballon lent DANS la surface → il CHARGE (sortie au-devant, à un pas du
  // ballon) ; le même ballon lent HORS surface → il tient son poste (pas un libéro)
  const unContreUn = keeperDecide(pitch, 0, me, [me[0] + 5, 0.11, 2], [1.5, 0, 0.5], Infinity, K);
  if (unContreUn.mode !== 'sortie') issues.push(`le gardien ne charge pas le un-contre-un dans sa surface (${unContreUn.mode})`);
  else if (Math.hypot(unContreUn.spot.x - (me[0] + 5), unContreUn.spot.z - 2) > 1.2) issues.push('la charge du un-contre-un ne va pas AU ballon');
  const loin = keeperDecide(pitch, 0, me, [me[0] + 14, 0.11, 2], [1.5, 0, 0.5], Infinity, K);
  if (loin.mode === 'sortie') issues.push('le gardien charge hors de sa surface (libéro)');
  const wide = keeperDecide(pitch, 0, me, [me[0] + 9, 0.11, pitch.goalHalf + 3], [-14, 0.5, 0], 0.3, K);
  if (wide.mode === 'dive') issues.push('plongeon sur un ballon non cadré');
  const far2 = keeperDecide(pitch, 0, [me[0], 0, -pitch.goalHalf + 0.3], [me[0] + 8, 0.11, pitch.goalHalf - 0.2], [-13, 1.2, 0.4], 0.3, K);
  if (far2.mode === 'dive' && Math.abs((shotCross(pitch, 0, [me[0] + 8, 0.11, pitch.goalHalf - 0.2], [-13, 1.2, 0.4])?.z ?? 0) - (-pitch.goalHalf + 0.3)) > K.diveReach) {
    issues.push('aimant à ballon : plongeon déclaré au-delà de l\'envergure');
  }
  // 5. LE RELEVÉ (lot 91) : borné à la bande humaine, monotone à l'agilité, et le battu paie MOINS
  //    (sa chute est déjà consommée) mais paie — un plongeon sans prix est la catapulte d'hier
  const rMid = keeperRise(1, true, K), rAgile = keeperRise(0.72, true, K), rRaide = keeperRise(1.28, true, K);
  if (!(rAgile.getup >= 0.85 && rRaide.getup <= 1.65)) issues.push(`relevé hors bande humaine (${rAgile.getup.toFixed(2)}–${rRaide.getup.toFixed(2)} s, attendu ~0,9-1,6)`);
  if (!(rAgile.getup < rMid.getup && rMid.getup < rRaide.getup)) issues.push('l\'agilité ne module pas le relevé (non monotone)');
  if (!(rMid.ground >= 0.5 && rMid.ground <= 1.0)) issues.push(`temps au sol hors bande (${rMid.ground} s, réel 0,5-1,0)`);
  const rBattu = keeperRise(1, false, K);
  if (!(rBattu.total < rMid.total && rBattu.total >= rMid.ground + rMid.getup - 1e-9)) issues.push('le battu ne paie pas sol + relevé (ou re-paie une chute déjà tombée)');
  // …et le point du tenu suit le corps : couché au sol, debout à hauteur de porté
  const bas = keeperHoldPoint({ p: [0, 0, 0], yaw: 0, down: 2, rise: { ground: 0.65, getup: 1.25 } }, K);
  const haut = keeperHoldPoint({ p: [0, 0, 0], yaw: 0, down: 0 }, K);
  if (!(bas[1] < 0.35 && haut[1] > 0.85)) issues.push(`le ballon tenu ne suit pas le corps (couché ${bas[1].toFixed(2)}, debout ${haut[1].toFixed(2)})`);
  return { ok: issues.length === 0, issues };
}
