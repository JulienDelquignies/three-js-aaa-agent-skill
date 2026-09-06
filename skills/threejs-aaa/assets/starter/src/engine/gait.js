// gait — L'HORLOGE UNIQUE DE LA FOULÉE, et le corps accordé dessus.
//
// « Les mouvements sont tous horribles » avait une cause n°1, mesurée : chaque clip de locomotion
// avançait à SA propre cadence (timeScale = v/strideᵢ, anim-state-machine._apply). À 3,7 m/s la marche
// tournait à 2,467 cycles/s et la course à 1,423 — dérive 1,044 cycle/s, le déphasage faisait un tour
// complet en 0,96 s et traversait l'opposition stricte des pieds DIX fois en dix secondes. Or un
// mélange marche/course à 50/50 moyenne les deux poses : un pied planté moyenné avec un pied en vol
// donne une jambe qui flotte, et aucun foot-lock ne rattrape une pose physiquement impossible.
//
// La règle de l'industrie (sync groups d'Unreal, GDC) tient en une phrase : LA PHASE APPARTIENT À
// L'ÉTAT DE LOCOMOTION, JAMAIS AUX CLIPS. Un seul φ ∈ [0,1) avance à la cadence biomécanique f(v) ;
// chaque clip porteur de foulée est ESCLAVE : action.time = ((φ+offset)·durée) et timeScale = 0.
// L'idle, lui, n'a PAS de foulée : il garde sa propre horloge (un idle asservi à φ se FIGE à l'arrêt —
// le joueur ne respire plus ; attrapé par les réfuteurs avant d'être écrit).
//
// Et la cadence n'est plus devinée. `stride: 2.6` était une constante inventée qui faisait tourner les
// jambes 12 à 28 % trop lentement ; la loi vient de Dorn, Schache & Pandy 2012 (J Exp Biol 215:1944,
// table 2, relue dans le papier — les valeurs citées de mémoire par la première recherche étaient
// fausses et ont été corrigées par les réfuteurs) : f·S = v exactement, par construction de la table.
//
// La SECONDE moitié du fichier est la couche « corps accordé » : bassin, colonne, bras, tête dérivés de
// (φ, v) en ADDITIF par-dessus le clip — parce que la mesure disait 9 os jamais animés, des bras à 36°
// et un tronc à 10°. Les nombres sont sourcés et CORRIGÉS : Pontzer et al. 2009 (J Exp Biol 212:523),
// condition CONTRÔLE (149,2° de déphasage bassin/épaules en marche à 1,5 m/s → 93,9° en course à
// 3,0 m/s ; lacet de tête ~6°). La première recherche citait la condition « poids aux coudes » —
// une perturbation expérimentale, pas la locomotion normale.
//
// Dépendance : aucune. Tout se prouve dans node (verify-gait.mjs), la scène ne fait qu'appliquer.

/**
 * LA LOI DE CADENCE — fréquence de CYCLE COMPLET (deux appuis) en Hz, en fonction de la vitesse sol.
 * Points d'ancrage : marche typique à 1,4 m/s (foulée 1,5 m), puis Dorn/Schache/Pandy 2012 table 2 :
 * 3,5 m/s → 1,88 Hz (S 1,86 m) ; 5,2 → 2,21 (2,35) ; 7,0 → 2,63 (2,67). Au-delà : extrapolation douce
 * bornée à 3,1 Hz (marquée comme telle — la table s'arrête où la table s'arrête).
 */
const LAW = [[0, 0], [1.4, 0.93], [3.5, 1.88], [5.2, 2.21], [7.0, 2.63], [9.0, 3.1]];
export function strideLaw(v) {
  const x = Math.max(0, Math.min(9.0, Math.abs(v)));
  // SOUS LA MARCHE (< 1,4 m/s) : la foulée RACCOURCIT avec l'allure (S ∝ v^0,75 — 0,59 m à 0,4 m/s,
  // 0,28 m à 0,15) au lieu de garder les 1,5 m du segment linéaire (f ∝ v ⇒ S constante : un joueur
  // qui se replace à 0,4 m/s faisait des enjambées de 1,5 m au ralenti — mesuré avec la foulée
  // générée du lot A7, où le chemin de pied suit la loi à la lettre). Continu en 1,4.
  if (x < 1.4) return 0.93 * Math.pow(x / 1.4, 0.25);
  for (let i = 1; i < LAW.length; i++) {
    if (x <= LAW[i][0]) {
      const [x0, y0] = LAW[i - 1], [x1, y1] = LAW[i];
      return y0 + (y1 - y0) * ((x - x0) / (x1 - x0 || 1));
    }
  }
  return LAW[LAW.length - 1][1];
}

/**
 * L'horloge. `advance(v, dt)` la fait tourner à la cadence de la loi ; `apply(anchors)` asservit les
 * clips porteurs de foulée et LAISSE les autres tranquilles. Les ancres sont des objets
 * `{ stride?, dur, gaitOffset?, action }` — la forme exacte de blend1d dans anim-state-machine.
 */
export function makeGaitClock({ law = strideLaw } = {}) {
  return {
    phi: 0,
    law,
    advance(v, dt) {
      this.phi = (this.phi + law(v) * dt) % 1;
      return this.phi;
    },
    /** Le temps du clip pour cette ancre — le SEUL endroit qui convertit φ en secondes de clip. */
    timeFor(an) { return ((this.phi + (an.gaitOffset || 0)) % 1) * an.dur; },
    /**
     * Asservir les ancres d'un blend. Une ancre SANS foulée (l'idle) n'est jamais touchée : son
     * horloge continue, sinon un joueur à l'arrêt devient une statue qui ne respire plus.
     */
    apply(anchors) {
      for (const an of anchors) {
        if (!an.stride) continue;
        an.action.time = this.timeFor(an);
        an.action.timeScale = 0;
      }
    },
  };
}

/**
 * ALIGNER LES CLIPS SUR LE MÊME PIED. φ = 0 est défini comme « contact du pied GAUCHE » ; chaque clip
 * pose ce contact où son auteur l'a mis. `footYAt(u)` échantillonne la hauteur monde du pied gauche du
 * clip à la phase u ∈ [0,1) ; l'offset renvoyé place le minimum (le contact) à φ = 0. Sans ça, deux
 * clips parfaitement synchronisés en PHASE restent en opposition de PIEDS — synchroniser les horloges
 * ne sert à rien si l'une lit « gauche » où l'autre lit « droite ».
 */
export function phaseOffset(footYAt, { samples = 48 } = {}) {
  let best = 0, bestY = Infinity;
  for (let i = 0; i < samples; i++) {
    const u = i / samples;
    const y = footYAt(u);
    if (y < bestY) { bestY = y; best = u; }
  }
  return (1 - best) % 1;
}

// ---------------------------------------------------------------------------------------------------
// LE CORPS ACCORDÉ — bassin, colonne, bras, tête dérivés de (φ, v), en degrés ADDITIFS sur le clip.
// Fonction PURE : mêmes entrées, mêmes sorties, aucun état — c'est ce qui la rend idempotente à
// appliquer (la scène l'applique après le mixer, qui réécrit les os à chaque frame : rien ne s'accumule).

const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
const TAU = Math.PI * 2;

/** Les amplitudes, nommées pour être discutables. Sources en tête de fichier ; les valeurs « élite qui
 *  tourne le bassin de 30° » de la première recherche étaient ~70 % trop grandes et ont été rejetées. */
export const GAIT_TUNE = {
  pelvisYaw: { walk: 3.0, run: 6.5 },      // ° d'amplitude de lacet du bassin
  shoulderYaw: { walk: 4.5, run: 12.0 },   // ° — ceinture scapulaire, répartie Spine 20 / Spine1 35 / Spine2 45
  psi: { walk: 149.2, run: 93.9 },         // ° de déphasage bassin/épaules (Pontzer 2009, CONTRÔLE)
  armSwing: { walk: 14, run: 32 },         // ° de balancer d'épaule, en antiphase avec la jambe homolatérale
  elbow: { walk: 10, run: 52 },            // ° de flexion de coude tenue en course
  headMax: 6.0,                            // ° — la tête est STABILISÉE (Pontzer : ~6° de lacet en course)
  bob: { walk: 0.012, run: 0.03 },         // m d'oscillation verticale du bassin (2 rebonds par cycle)
};

/**
 * Les deltas du corps pour une phase et une vitesse. `null` à l'arrêt — la couche n'existe pas quand on
 * ne marche pas, et c'est une clause du contrat (un biais au repos décale TOUTES les poses d'animkit).
 * Convention : φ = 0 au contact du pied GAUCHE (voir phaseOffset).
 * @returns { euler: { Bone: [x°, y°, z°] }, hipsY: m } ou null
 */
export function gaitLayer(phi, v, T = GAIT_TUNE) {
  if (v < 0.15) return null;
  const r = Math.max(0, Math.min(1, (v - 0.4) / 2.6));       // marche → course
  const s = TAU * phi;

  // le bassin mène ; les épaules suivent avec le déphasage mesuré (149° marche → 94° course), qui est
  // précisément ce qui distingue une course d'une marche vue de dos
  const pelvis = lerp(T.pelvisYaw.walk, T.pelvisYaw.run, r) * Math.sin(s);
  // ψ a SA rampe : les mesures de Pontzer sont à 1,5 m/s (marche) et 3,0 m/s (course) — la rampe
  // d'amplitude (0,4 → 3,0) appliquée ici décalait ψ de 23° à vitesse de marche, et la clause du
  // contrat l'a attrapé avant l'écran.
  const rPsi = Math.max(0, Math.min(1, (v - 1.5) / 1.5));
  const psi = (lerp(T.psi.walk, T.psi.run, rPsi) * Math.PI) / 180;
  const girdle = lerp(T.shoulderYaw.walk, T.shoulderYaw.run, r) * Math.sin(s - psi);

  // la tête compense la rotation qui lui arrive par la colonne : le REGARD est stable, pas le cou
  const head = Math.max(-T.headMax, Math.min(T.headMax, -girdle * 0.75));

  // les bras s'opposent à leur jambe : à φ = 0 la jambe GAUCHE est au contact (devant), donc le bras
  // gauche est derrière et le droit devant. Le swing est un cos, le coude se fléchit avec la vitesse.
  const swing = lerp(T.armSwing.walk, T.armSwing.run, r) * Math.cos(s);
  const elbow = lerp(T.elbow.walk, T.elbow.run, r);

  return {
    euler: {
      Hips: [0, pelvis, 0],
      Spine: [0, girdle * 0.20, 0],
      Spine1: [0, girdle * 0.35, 0],
      Spine2: [0, girdle * 0.45, 0],
      Neck: [0, head * 0.4, 0],
      Head: [0, head * 0.6, 0],
      LeftArm: [swing, 0, 0],               // +X = le bras part vers l'arrière ; cos(0) > 0 : gauche derrière
      RightArm: [-swing, 0, 0],
      LeftForeArm: [-elbow * 0.5 - Math.max(0, -swing) * 0.4, 0, 0],
      RightForeArm: [-elbow * 0.5 - Math.max(0, swing) * 0.4, 0, 0],
    },
    hipsY: -lerp(T.bob.walk, T.bob.run, r) * (0.5 - 0.5 * Math.cos(2 * s)),  // 2 rebonds par cycle, vers le bas
  };
}

// ---------------------------------------------------------------------------------------------------
/**
 * CONTRAT. Les clauses correspondent une à une aux façons dont la locomotion redevient fausse en
 * silence ; verify-gait.mjs porte un sabotage nommé par clause — dont, pour la dérive de phase,
 * l'ANCIEN CODE lui-même (timeScale = v/strideᵢ par ancre) : la clause doit le condamner, sinon elle
 * ne mesure pas le défaut qui a motivé le module.
 */
export function checkGait({ clock = null, layer = gaitLayer, law = strideLaw } = {}) {
  const issues = [];

  // 1. la loi passe par la table de Dorn (f·S = v) — pas par une constante inventée
  for (const [v, f] of [[3.5, 1.88], [5.2, 2.21], [7.0, 2.63]]) {
    if (Math.abs(law(v) - f) > 0.02) issues.push(`cadence hors la loi à ${v} m/s : ${law(v).toFixed(2)} Hz au lieu de ${f}`);
  }
  if (!(law(2) < law(4) && law(4) < law(6))) issues.push('la cadence ne croît pas avec la vitesse');

  if (clock) {
    // 2. deux ancres asservies ne dérivent JAMAIS — mesuré à travers la même API que la scène utilise
    const A = { stride: 1.5, dur: 1.0, action: { time: 0, timeScale: 1 } };
    const B = { stride: 2.3, dur: 0.7, action: { time: 0, timeScale: 1 } };
    let worst = 0;
    for (let i = 0; i < 600; i++) {
      const v = 2 + 2.5 * Math.sin(i / 40);                 // vitesse qui traverse le mélange marche/course
      clock.advance(v, 1 / 60);
      clock.apply([A, B]);
      const pa = A.action.time / A.dur, pb = B.action.time / B.dur;
      const d = Math.abs(pa - pb) % 1;
      worst = Math.max(worst, Math.min(d, 1 - d));
    }
    if (worst > 1e-9) issues.push(`les ancres dérivent (écart de phase max ${worst.toFixed(4)} cycle)`);
    // 3. l'idle n'est pas asservi : pas de foulée, pas de φ — sinon statue à l'arrêt
    const idle = { dur: 2.0, action: { time: 0.42, timeScale: 1 } };
    clock.apply([idle]);
    if (idle.action.time !== 0.42 || idle.action.timeScale !== 1) issues.push('l\'idle a été asservi à φ : à l\'arrêt le joueur devient une statue');
    // 4. la phase n'avance pas à l'arrêt (elle est une distance, pas une horloge murale)
    const p0 = clock.phi;
    for (let i = 0; i < 300; i++) clock.advance(0, 1 / 60);
    if (Math.abs(clock.phi - p0) > 1e-9) issues.push('φ avance à l\'arrêt : la phase est redevenue une horloge murale');
  }

  // 5. la couche corps : pure, nulle à l'arrêt, bras opposés, épaules contre bassin, tête bornée
  const g1 = layer(0.3, 4), g2 = layer(0.3, 4);
  if (JSON.stringify(g1) !== JSON.stringify(g2)) issues.push('gaitLayer n\'est pas pure (deux appels identiques diffèrent)');
  if (layer(0.5, 0) !== null) issues.push('gaitLayer non nulle à l\'arrêt : elle biaise toutes les poses d\'animkit');
  let armBad = 0, headWorst = 0;
  for (let i = 0; i < 32; i++) {
    const g = layer(i / 32, 5);
    if (!g) continue;
    if (Math.abs(g.euler.LeftArm[0] + g.euler.RightArm[0]) > 1e-9) armBad++;
    headWorst = Math.max(headWorst, Math.abs(g.euler.Head[1] / 0.6));
  }
  if (armBad) issues.push(`les bras ne s'opposent pas (${armBad}/32 phases)`);
  if (headWorst > GAIT_TUNE.headMax + 1e-6) issues.push(`la tête tourne de ${headWorst.toFixed(1)}° (> ${GAIT_TUNE.headMax}° : le regard n'est plus stabilisé)`);
  // le déphasage bassin/épaules : mesuré sur les courbes, pas lu dans la config
  const peak = (f) => { let bu = 0, bv = -Infinity; for (let i = 0; i < 720; i++) { const u = i / 720, x = f(u); if (x > bv) { bv = x; bu = u; } } return bu; };
  for (const [v, lo, hi] of [[1.5, 130, 165], [4.5, 85, 115]]) {
    const dp = ((peak((u) => layer(u, v).euler.Hips[1]) - peak((u) => layer(u, v).euler.Spine2[1])) % 1 + 1) % 1;
    const deg = Math.min(dp, 1 - dp) * 360;
    if (deg < lo || deg > hi) issues.push(`déphasage bassin/épaules à ${v} m/s : ${deg.toFixed(0)}° hors [${lo}, ${hi}] (Pontzer 2009, contrôle)`);
  }
  // …et l'amplitude grandit avec la vitesse (un balancer de bras identique à 1 et 6 m/s est un robot)
  const amp = (v) => Math.max(...Array.from({ length: 32 }, (_, i) => Math.abs(layer(i / 32, v)?.euler.LeftArm[0] ?? 0)));
  if (!(amp(6) > amp(1.2) * 1.5)) issues.push('le balancer des bras ne grandit pas avec la vitesse');

  return { ok: issues.length === 0, issues };
}
