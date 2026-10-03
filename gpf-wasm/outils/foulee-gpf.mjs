// foulee-gpf.mjs — LES GESTES EN COURSE, CUITS POUR LE CORPS (retour du 3 octobre : « voir un Dani Olmo dans la 3D… des mouvements smooth
// qui suivent les joueurs, peu importe le contexte, peu importe la zone »).
//
// Un geste « dans la foulée » du duel (pas.js, gesteFouleeStep) n'est pas un clip : ce sont des TEMPS posés sur les vols des pieds d'un
// joueur qui court — l'arc du passement, la vente de la feinte de corps, la touche du crochet et de la croqueta. Le contrôleur du duel
// (character-controller.js) les dessine image par image sur la foulée générée (motion-gait.js, gaitPose). Ce studio rejoue ce contrôleur
// HORS LIGNE, à 100 images/s, pour un départ type, puis cuit le résultat en animation de Gameplay Football (vers-gpf.mjs : la racine,
// 13 articulations, les touches en série — patch.py, étape 14).
//
// CE QUI EST REJOUÉ, et d'où :
//   · L'HORLOGE DE FOULÉE (pas.js, pasStep) : la phase avance de strideLaw(v) × les facteurs de cadence (direction, jambe, frein, virage,
//     pivot), mesurés sur le déplacement réel du corps — frein et virage lissés τ 0,15 s, lacet τ 0,1 s (_measureAccel) ;
//   · LES TEMPS DU GESTE (pas.js, gesteFouleeStep) : chacun s'arme au décollage de SON pied, dès que le précédent a commencé ; 'touche' :
//     le pied vise le ballon (opts.geste.vise) et le joue en fin de vol ; 'arc' : la jambe cercle le ballon (arcPassement) ; 'vend' : le
//     pied se pose large, le buste vend (la feinte de corps, Brault et al. 2010) ;
//   · LE PIED PAR PIED (_gesteFouleeOpts) : l'arc, la vente, le couloir élargi qui se referme au vol suivant, la posture de la série ;
//   · L'APPUI ANCRÉ (_anchorStance) : le pied posé reste au monde, le corps passe dessus ;
//   · L'INCLINAISON (_applyLean, leanPhys) : le tronc penche dans l'accélération (atan(a/g) × 1,25, borné 35°) et roule dans le virage
//     (atan(a/g) × 0,45, borné 22° — Dos'Santos et al. 2021 : 18-21° de tronc à la pose des coupes de 45-90°).
// LE CORPS DU JOUEUR (le déplacement) n'est pas celui d'une sim de match : c'est un départ type — l'allure d'entrée v0, la touche de
// coupe qui freine (freinCoupe, Dos'Santos et al. 2021 : × 0,97 à 45°, × 0,76 à 90°, × 0,67 à 180°), puis la sortie qui tourne à
// accélération latérale bornée (12 m/s²) et relance vers vSortie (τ 0,35 s). Le regard suit la course (τ 0,06 s).
//
// LES CONVENTIONS DU CORPS (mesurées sur ses animations, outils/pied-gpf) : à l'image 0, le pied GAUCHE est posé, le DROIT en vol (le
// « pied courant » d'un fichier est le droit ; son miroir, chargé d'office, part du gauche) ; `steps` compte les poses du geste (le corps
// en tire le pied de sortie) ; la classe de vitesse d'entrée se lit sur les deux premières clés de la racine, et un contrôle à l'allure de
// conduite (1,8-4,2 m/s) cherche la classe de la marche (4,2-6) : la première clé est reculée d'un rien pour que l'entrée lise ≥ 4,3 m/s.
//
//   node outils/foulee-gpf.mjs <geste> [numéro] [sortie.anim]     (un geste du répertoire COURSE ; sans sortie : le bilan seul)
//   node outils/foulee-gpf.mjs tous                               (tout le répertoire → gestes/course/)
//   STARTER=<moteur> : les modules de mouvement (le duel par défaut, branche feat/1v1-maquette, en lecture).
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { profilReference, versCorps, fkGpf, GPF_NODES, parseGpfAnim, sampleGpf } from './vers-gpf.mjs';

const STARTER = process.env.STARTER ?? '/home/delkit/DelkIT/skill-1v1/skills/threejs-aaa/assets/starter/src/engine';
const MG = await import(join(STARTER, 'motion-gait.js'));
const { strideLaw } = await import(join(STARTER, 'gait.js'));
const R = await import(join(STARTER, 'motion-rig.js'));
const V = await import(join(STARTER, 'vecmath.js'));
const { quatMul, quatConjugate: qinv, quatNormalize, applyQuat } = V;

const DEG = Math.PI / 180, G = 9.81, FPS = 100, BALL_R = 0.11, GPF_HIPS_Y = 0.984;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const qAxe = (ax, a) => { const s = Math.sin(a / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(a / 2)]; };

/** LE FREIN D'UNE COUPE selon son angle (°) — pas.js, freinCoupe (Dos'Santos et al. 2021, la vitesse à la pose / l'approche). */
export const freinCoupe = (deg) => { const a = Math.abs(deg); return a <= 45 ? 0.97 : a <= 90 ? 0.97 + (0.76 - 0.97) * (a - 45) / 45 : Math.max(0.67, 0.76 + (0.67 - 0.76) * (a - 90) / 90); };

/**
 * LE RÉPERTOIRE EN COURSE : chaque geste, pour une allure d'entrée v0 (m/s). Écrit pour le pied DROIT en premier (le miroir du corps fait
 * l'autre) ; `dir` : la sortie (rad, + à droite, depuis la course d'entrée) ; `frein` : la vitesse gardée à la touche ; `vSortie` : l'allure
 * visée après ; `apres` : la course gardée après le dernier temps (s). Les temps sont ceux du duel (skills-sim.js, les « …Foulee »).
 *   · crochet (intérieur) : le pied droit, en fin de vol, coupe le ballon vers la gauche du dedans — le corps freine et part (52 ou 80°
 *     selon l'espèce du cerveau : court, standard) ;
 *   · crochetChaloupe : le buste ment d'abord (le pied droit se pose large, la vente à droite), puis le gauche coupe à 90° de l'extérieur —
 *     la coupe de Dembélé, une feinte de corps poussée jusqu'au virage ;
 *   · crochetExt (extérieur) : le même pied pousse vers la droite de l'extérieur — avec son miroir, chaque côté se joue des deux pieds ;
 *   · croqueta (doubleContact) : l'intérieur droit passe le ballon devant le pied gauche, qui le pousse en diagonale (26°) — le corps garde
 *     son cap ;
 *   · feinteCorps : le pied droit se pose large, le buste vend la droite ; le gauche pousse de l'extérieur à gauche (40°) ;
 *   · passement : la jambe droite cercle le ballon (de dedans en dehors, par-devant), le pied gauche le pousse de l'extérieur à gauche.
 */
export const COURSE = {
  course: (v0) => ({ v0, beats: [], apres: 0, duree: 1.3 }),
  crochetCourt: (v0) => ({ v0, beats: [{ pied: 'right', type: 'touche', dir: -52 * DEG }], apres: 0.4 }),
  crochet: (v0) => ({ v0, beats: [{ pied: 'right', type: 'touche', dir: -80 * DEG }], apres: 0.45 }),
  crochetChaloupe: (v0) => ({ v0, beats: [{ pied: 'right', type: 'vend' }, { pied: 'left', type: 'touche', dir: -90 * DEG, exterieur: true }], apres: 0.45 }),
  crochetExt: (v0) => ({ v0, beats: [{ pied: 'right', type: 'touche', dir: 60 * DEG, exterieur: true }], apres: 0.4 }),
  croqueta: (v0) => ({ v0, beats: [{ pied: 'right', type: 'touche', cible: 'suivant' }, { pied: 'left', type: 'touche', dir: -26 * DEG }], apres: 0.4 }),
  feinteCorps: (v0) => ({ v0, beats: [{ pied: 'right', type: 'vend' }, { pied: 'left', type: 'touche', dir: -40 * DEG, exterieur: true }], apres: 0.4 }),
  passement: (v0) => ({ v0, beats: [{ pied: 'right', type: 'arc' }, { pied: 'left', type: 'touche', dir: -52 * DEG, exterieur: true }], apres: 0.4 }),
  // LE GRAND PONT (grand-pont.js du cerveau, sa référence : Olmo, Angleterre–Espagne — il fixe le défenseur qui vient, et quand celui-ci
  // s'engage, une touche pousse le ballon d'UN côté pendant qu'il le contourne de l'AUTRE, épaule contre épaule, et repart plein pot) :
  // l'extérieur du pied droit pousse le ballon à droite (24°, plus vite que lui : à 2,5 m devant, il passe à 1,1 m du défenseur — le
  // point du cerveau est à 1,4 m de côté ; à 14°, mesuré, il le frôlait à 0,6 m et ne passait jamais) ; le corps part à gauche (−32°) le
  // temps de passer le défenseur, puis revient chercher son ballon (+30°) en accélérant jusqu'au sprint
  grandPont: (v0) => ({ v0, beats: [{ pied: 'right', type: 'touche', dir: 24 * DEG, vb: v0 + 3.2, exterieur: true,
    corps: [{ dir: -32 * DEG, v: v0 + 1.0, dt: 0.42 }, { dir: 30 * DEG, v: Math.max(6.3, v0 + 2.2), dt: 9 }] }], apres: 0.95 }),
  // LE PETIT PONT (le cerveau, maybePetitPont : contre le glisseur en pas chassés, le ballon poussé ENTRE ses jambes, le porteur le contourne
  // contre son élan et rechasse) : l'intérieur du pied droit pousse droit devant ; le corps s'écarte à gauche (−32°) puis revient sur la ligne
  // derrière le défenseur (+22°)
  petitPont: (v0) => ({ v0, beats: [{ pied: 'right', type: 'touche', dir: 0, vb: v0 + 1.8,
    corps: [{ dir: -32 * DEG, v: v0, dt: 0.36 }, { dir: 22 * DEG, v: v0 + 0.9, dt: 9 }] }], apres: 0.8 }),
};
/** Les animations du répertoire en course : nom@allure → n° (specialvar1) — 200 + 10 × le rang du geste + le rang de l'allure. Les allures :
 *  2,5 m/s (le porteur qui ralentit devant un défenseur posté : le cerveau y décide ses passements, ses feintes — la variante à 3,5 y
 *  touchait trop loin devant, mesuré : 0 passement parti sur 35), 3,5 m/s (la conduite du corps, 3,3-3,8 mesurés) et 5 m/s (sa marche). */
export const ALLURES = [2.5, 3.5, 5.0];
export const NUMEROS = {};
{ let n = 200; for (const g of Object.keys(COURSE)) { if (g === 'course') continue; ALLURES.forEach((v0, k) => { NUMEROS[`${g}@${v0}`] = n + k; }); n += 10; } }

/** Le contrôleur du duel rejoué : l'état d'un porteur qui court. Repère MONDE du rejeu = celui de three.js : X, Z au sol ; le personnage
 *  regarde −Z à lacet nul ; lacet Y (three.js, rotation.y) = −ψ, ψ le cap (+ à droite). */
export function rejouerFoulee(spec, { P = profilReference(), style = MG.NEUTRAL_GAIT_STYLE, dt = 1 / FPS, balle0 = null } = {}) {
  const legK = MG.gaitLegK(P);
  const beats = spec.beats.map((b) => ({ ...b, etat: 'attente' }));
  const ivers = (cote) => (cote === 'right' ? 'Right' : 'Left');
  // l'état du corps : position (monde), vitesse, cap ψ, et ce qui suit le mouvement réel
  let X = 0, Z = 0, psi = 0, vit = spec.v0, dirV = 0, cible = null;
  const M = { brake: 0, turn: 0, yawRate: 0, vPrev: [0, -spec.v0], pPrev: [0, 0], psiPrev: 0, aTanS: 0, lean: [0, 0] };
  // la phase de départ : le pied droit en vol (la convention du corps), aux 2/5 de son vol — sauf `premier` : le pied gauche
  const s0 = MG.gaitPose(P, 0, spec.v0, 0, style, { legK }).meta.s;
  // (gaitPose : u du pied gauche = φ, du droit = φ + ½ ; en vol au-delà de l'appui s) — le pied de tête au départ : un geste qui TOUCHE
  // d'abord part aux 35 % de son vol, sa touche (aux 85 %) tombe vers l'image 22 — la triche du corps y a presque toute sa portée
  // ((f/24)^0,7 : mesuré, à l'image 11 le crochet ne partait plus que 3 à 6 fois sur 15, contre 10 à 15 vers l'image 20) ; un geste qui
  // VEND ou CERCLE d'abord (la touche au temps suivant) part aux 60 % : sa touche tombe vers l'image 45 au lieu de 53
  const W0 = spec.w0 ?? (spec.beats[0]?.type === 'touche' ? 0.35 : 0.6);
  let phi = spec.premier === 'left' ? s0 + (1 - s0) * W0 : (s0 + (1 - s0) * W0 + 0.5) % 1;
  // le ballon : devant le pied qui le jouera (couloir de ce pied), à l'allure du corps — `balle0` [droite, devant] relatif au corps
  let B = { p: null, v: [0, 0], libre: false };
  const frames = [], touches = [];
  let feetPrev = null, plants = { Left: null, Right: null }, gesteMem = { Left: { e: 'idle', vol: false, large: 1 }, Right: { e: 'idle', vol: false, large: 1 } };
  let tFin = null, serieW = 0;
  const T = (spec.duree ?? 2.5);
  for (let i = 0; i * dt <= T + 1e-9; i++) {
    const t = i * dt;
    // ── 1. LA CINÉMATIQUE DU CORPS : la course d'entrée ; après une touche à direction, le frein, puis la sortie (accélération latérale
    //    bornée, relance τ 0,35 s) ; le cap suit la course (τ 0,06 s)
    if (i > 0) {
      if (cible?.chemin) {   // le chemin du corps après la touche : le segment de l'instant
        let tc = t - cible.t0, k = 0; while (k < cible.chemin.length - 1 && tc > cible.chemin[k].dt) { tc -= cible.chemin[k].dt; k++; }
        cible.dir = cible.chemin[k].dir; cible.v = cible.chemin[k].v;
      }
      if (cible) {
        const err = wrap(cible.dir - dirV), wMax = 12 / Math.max(1, vit);
        dirV += clamp(err, -wMax * dt, wMax * dt);
        vit += (cible.v - vit) * (1 - Math.exp(-dt / 0.35));
      }
      X += Math.sin(dirV) * vit * dt; Z += -Math.cos(dirV) * vit * dt;
      psi += wrap(dirV - psi) * (1 - Math.exp(-dt / 0.06));
    }
    const vx = (X - M.pPrev[0]) / dt, vz = (Z - M.pPrev[1]) / dt; M.pPrev = [X, Z];
    const vW = i > 0 ? [vx, vz] : [Math.sin(dirV) * vit, -Math.cos(dirV) * vit];
    const ax = (vW[0] - M.vPrev[0]) / dt, az = (vW[1] - M.vPrev[1]) / dt; M.vPrev = vW;
    // le repère du corps : avant (sin ψ, −cos ψ), droite (cos ψ, sin ψ)
    const fx = Math.sin(psi), fz = -Math.cos(psi), rx = Math.cos(psi), rz = Math.sin(psi);
    const vF = vW[0] * fx + vW[1] * fz, vR = vW[0] * rx + vW[1] * rz, v = Math.hypot(vW[0], vW[1]);
    const aF = ax * fx + az * fz, aR = ax * rx + az * rz;
    { const dy = wrap(psi - M.psiPrev); M.psiPrev = psi; M.yawRate += (dy / dt - M.yawRate) * (1 - Math.exp(-dt / 0.1)); }
    const fwd = vF > 1.5 && Math.abs(vR) < vF && Math.hypot(ax, az) < 40, k15 = 1 - Math.exp(-dt / 0.15);
    M.brake += ((fwd ? clamp(-aF / 6, 0, 1) : 0) - M.brake) * k15;
    M.turn += ((fwd ? clamp(aR, -9, 9) : 0) - M.turn) * k15;
    // ── 2. L'HORLOGE DE FOULÉE (pas.js) : la cadence de l'allure réelle et de ses facteurs
    let f = strideLaw(v) * MG.gaitCadenceFactor(vF, vR) * MG.gaitLegFactor(legK, v) * MG.gaitBrakeCadence(M.brake) * MG.gaitTurnCadence(M.turn);
    const fp = MG.gaitPivotCadence(M.yawRate); if (fp > f) f = fp;
    if (i > 0) phi = (phi + f * dt) % 1;
    const pasT = 1 / Math.max(0.05, f);
    // ── 3. LES TEMPS DU GESTE : chacun s'arme au décollage de SON pied (le vol en cours compte pour le premier temps à l'image 0)
    const enVol = (k) => feetPrev?.[k]?.phase === 'swing';
    if (i === 1) {   // l'image 0 : les pieds en vol le sont déjà (en course, les deux le sont un instant) — seul le premier temps prend le sien
      for (const k of ['Left', 'Right']) gesteMem[k].volVu = enVol(k);
      if (beats[0] && enVol(ivers(beats[0].pied))) { beats[0].etat = 'vol'; beats[0].t0 = 0; beats[0].i0 = 0; }
    } else if (i > 1) for (const k of ['Left', 'Right']) {
      const vol = enVol(k), debut = vol && !gesteMem[k].volVu;
      gesteMem[k].volVu = vol;
      if (!debut) continue;
      const iB = beats.findIndex((b) => b.etat === 'attente');
      if (iB >= 0 && ivers(beats[iB].pied) === k && (iB === 0 || beats[iB - 1].etat !== 'attente')) { beats[iB].etat = 'vol'; beats[iB].t0 = t; beats[iB].i0 = i; }
    }
    // la fin d'un vol : le temps est fait (une touche s'est jouée avant la pose)
    for (const b of beats) if (b.etat === 'vol' && feetPrev && !enVol(ivers(b.pied)) && i > b.i0 + 2) { b.etat = 'fait'; b.i1 = i; }
    // ── 4. LE PIED PAR PIED (_gesteFouleeOpts) : arc, vente, couloir élargi, posture de la série, le pied qui vise
    const geste = { Left: { arc: false, elargi: 0 }, Right: { arc: false, elargi: 0 } };
    for (const k of ['Left', 'Right']) {
      const E = gesteMem[k], F0 = feetPrev?.[k], vol = F0?.phase === 'swing';
      const w = vol ? clamp(((F0.u ?? 0) - (F0.s ?? s0)) / Math.max(1e-3, 1 - (F0.s ?? s0)), 0, 1) : 0;
      const b = beats.find((x) => x.etat === 'vol' && ivers(x.pied) === k);
      if (vol && !E.vol) { E.e = b?.type === 'arc' ? 'arc' : b?.type === 'vend' ? 'vend' : E.e === 'pose' ? 'retour' : 'idle'; E.large = b?.type === 'vend' ? 4.2 : b?.type === 'arc' ? 2.6 : 1; }
      else if (!vol && E.vol) E.e = E.e === 'arc' || E.e === 'vend' ? 'pose' : E.e === 'retour' ? 'idle' : E.e;
      E.vol = vol;
      geste[k].arc = E.e === 'arc'; geste[k].vend = E.e === 'vend';
      geste[k].elargi = E.e === 'arc' || E.e === 'vend' ? Math.min(1, w / 0.6) * E.large : E.e === 'pose' ? E.large : E.e === 'retour' ? E.large * (1 - Math.min(1, w / 0.7)) : 0;
    }
    const nArcs = beats.filter((b) => b.type === 'arc').length;
    serieW += ((nArcs >= 2 && beats.some((b) => b.type === 'arc' && b.etat !== 'fait') ? 1 : 0) - serieW) * (1 - Math.exp(-dt / 0.12));
    if (serieW > 0.01) geste.serie = serieW;
    const bt = beats.find((b) => b.type === 'touche' && b.etat === 'vol' && !b.joue);
    geste.vise = bt ? ivers(bt.pied) : null;
    // ── 5. LE BALLON : tenu devant le pied qui le jouera tant qu'il n'est pas joué (le porté du duel), libre ensuite (il roule vers la
    //    destination de la touche) — repère monde
    const toC = (wx, wz) => { const dx = wx - X, dz = wz - Z; return [dx * rx + dz * rz, -(dx * fx + dz * fz)]; };   // [droite, arrière] (repère personnage : +Z arrière)
    if (!B.libre) {
      const prochain = beats.find((b) => b.type === 'touche' && !b.joue) ?? null;
      const lat = prochain ? (prochain.pied === 'right' ? 1 : -1) * 0.12 : 0, av = balle0?.[1] ?? 0.42;
      B.p = [X + fx * av + rx * lat, Z + fz * av + rz * lat];
    } else { B.p = [B.p[0] + B.v[0] * dt, B.p[1] + B.v[1] * dt]; const sp = Math.hypot(...B.v); if (sp > 0) { const d = Math.max(0, sp - 1.2 * dt) / sp; B.v = [B.v[0] * d, B.v[1] * d]; } }
    geste.balle = toC(B.p[0], B.p[1]);
    // ── 6. LA POSE : la foulée (1re passe), puis l'appui ancré au monde (2e passe)
    const opts = { legK, brake: M.brake, turn: M.turn, pivotHz: MG.gaitPivotCadence(M.yawRate) || undefined, pasT, geste };
    let g = MG.gaitPose(P, phi, vF, vR, style, opts);
    { const yawT = -psi, c = Math.cos(yawT), s = Math.sin(yawT);
      const toW = (p) => [X + c * p[0] + s * p[2], Z - s * p[0] + c * p[2]];
      const toCh = (w) => { const dx = w[0] - X, dz = w[1] - Z; return [c * dx - s * dz, s * dx + c * dz]; };
      const plant = {}, plantYaw = {}; let any = false;
      for (const side of ['Left', 'Right']) {
        const ft = g.feet[side];
        if (!ft || ft.phase === 'swing') { plants[side] = null; continue; }
        const own = ft.own ?? [0, 0, 0], base = [ft.p[0] - own[0], ft.p[2] - own[2]];
        let a = plants[side]; if (!a) a = plants[side] = { w: toW([base[0], 0, base[1]]), yaw: yawT };
        const bc = toCh(a.w); if (Math.hypot(bc[0] - base[0], bc[1] - base[1]) > 0.3) { a.w = toW([base[0], 0, base[1]]); a.yaw = yawT; }
        const pc = toCh(a.w), py = a.yaw - yawT, cy = Math.cos(py), sy = Math.sin(py);
        plant[side] = [pc[0] + cy * own[0] + sy * own[2], 0, pc[1] - sy * own[0] + cy * own[2]]; plantYaw[side] = py / DEG; any = true;
      }
      if (any) g = MG.gaitPose(P, phi, vF, vR, style, { ...opts, plant, plantYaw });
    }
    feetPrev = {}; for (const k of ['Left', 'Right']) feetPrev[k] = { ...g.feet[k], s: g.meta.s };
    // ── 7. LA TOUCHE : le pied qui vise, en fin de vol (aux 85 % — le cou-de-pied juste avant la pose), joue le ballon ; à cet instant le
    //    ballon EST au cou-de-pied (le porté l'y amène — on l'y pose, et le rejeu le mesure) ; il part vers sa destination
    if (bt) {
      const F1 = g.feet[ivers(bt.pied)], w = F1?.phase === 'swing' ? clamp(((F1.u ?? 0) - g.meta.s) / Math.max(1e-3, 1 - g.meta.s), 0, 1) : 1;
      if (w >= 0.85) {
        bt.joue = true; bt.iT = i; bt.tT = t;
        const W = R.fkPose(P, g.q, g.hips), ch = W[`${ivers(bt.pied)}Foot`].p, orteil = W[`${ivers(bt.pied)}ToeBase`].p;
        // le point de contact : le milieu du cou-de-pied (cheville → orteil), décalé du rayon du ballon vers le dedans (intérieur) ou le
        // dehors (extérieur) du pied — repère personnage → monde
        const m = [(ch[0] + orteil[0]) / 2, (ch[2] + orteil[2]) / 2], sgnPied = bt.pied === 'right' ? 1 : -1;
        // l'écart au ballon TENU (celui que le pied visait) : la peau du ballon au cou-de-pied — le pied l'a-t-il vraiment rejoint ?
        const bc = geste.balle, segD = (() => { const ax0 = ch[0], az0 = ch[2], ux = orteil[0] - ax0, uz = orteil[2] - az0, l2 = ux * ux + uz * uz || 1e-9, kk = clamp(((bc[0] - ax0) * ux + (bc[1] - az0) * uz) / l2, 0, 1); return Math.hypot(bc[0] - ax0 - ux * kk, bc[1] - az0 - uz * kk); })();
        const dedans = bt.exterieur ? sgnPied : -sgnPied, cx = m[0] + dedans * (BALL_R + 0.02), cz = m[1] - 0.03;
        const yawT = -psi, c = Math.cos(yawT), s = Math.sin(yawT);
        B.p = [X + c * cx + s * cz, Z - s * cx + c * cz];
        touches.push({ i, t, pied: bt.pied, p: [...B.p], ecartVise: segD - BALL_R, hCheville: ch[1] });
        // la destination : le temps suivant (la croqueta — devant le pied suivant), ou la sortie (dir) à l'allure de sortie
        if (bt.dir != null) {
          const ang = Math.abs(bt.dir) / DEG, dSortie = bt.dir;
          if (bt.corps) cible = { chemin: bt.corps, t0: t, dir: bt.corps[0].dir, v: bt.corps[0].v };   // un chemin (les ponts) : pas de frein de coupe
          else { vit *= freinCoupe(ang); cible = { dir: dSortie, v: Math.max(spec.v0, 3.2) * (ang > 60 ? 1.0 : 1.05) }; }
          const vb = bt.vb ?? cible.v + 0.9; B.v = [Math.sin(dSortie) * vb, -Math.cos(dSortie) * vb]; B.libre = true;
          tFin ??= t;
        } else { B.libre = false; }
      }
    }
    // ── 8. L'INCLINAISON (_applyLean, leanPhys) : tangage dans l'accélération tangentielle, roulis dans le virage — sur Spine, autour des
    //    axes du personnage (avant −Z, droite +X)
    const vl = Math.hypot(...vW), aTan = clamp(vl > 0.5 ? (ax * vW[0] + az * vW[1]) / vl : aF, -14, 14);
    M.aTanS += (Math.min(aTan, aF) - M.aTanS) * (1 - Math.exp(-dt / 0.06));
    const pitchV = M.aTanS > 0 ? Math.min(35, Math.atan(M.aTanS / G) / DEG * 1.25) : clamp(aF * 0.85, -9, 9);
    const rollV = clamp(Math.atan(aR / G) / DEG * 0.45, -22, 22), k08 = 1 - Math.exp(-dt / 0.08);
    M.lean[0] += (pitchV - M.lean[0]) * k08; M.lean[1] += (rollV - M.lean[1]) * k08;
    frames.push({ i, t, X, Z, psi, v, vF, vR, phi, q: { ...g.q }, hips: [...g.hips], lean: [...M.lean], balle: [...B.p], feet: { Left: g.feet.Left.phase, Right: g.feet.Right.phase } });
    if (tFin != null && beats.every((b) => b.etat === 'fait' || (b.type === 'touche' && b.joue)) && t >= tFin + spec.apres) break;
  }
  return { frames, touches, beats, P, legK };
}

/** Les rotations d'articulation J (repère personnage, vers-gpf : J = bindQ ⊗ q ⊗ bindQ⁻¹) d'une image, l'inclinaison posée sur Spine autour
 *  des axes du personnage (la droite +X pour le tangage — en avant, la tête vers −Z —, l'avant −Z pour le roulis — vers la droite, la
 *  tête vers +X), et le cap ψ cuit dans le bassin (une rotation de −ψ autour de +Y). */
export function jointsDe(fr, P) {
  const J = {};
  for (const [b, q] of Object.entries(fr.q)) { const Bn = P.bones[b]; if (Bn) J[b] = quatNormalize(quatMul(Bn.bindQ, quatMul(q, qinv(Bn.bindQ)))); }
  // l'inclinaison : A(Spine) ← R ⊗ A(Spine), soit J(Spine) ← A(Hips)⁻¹ ⊗ R ⊗ A(Hips) ⊗ J(Spine)
  const Rl = quatMul(qAxe([1, 0, 0], -fr.lean[0] * DEG), qAxe([0, 0, 1], -fr.lean[1] * DEG));
  const AH = J.Hips ?? [0, 0, 0, 1];
  J.Spine = quatNormalize(quatMul(quatMul(qinv(AH), quatMul(Rl, AH)), J.Spine ?? [0, 0, 0, 1]));
  J.Hips = quatNormalize(quatMul([0, Math.sin(-fr.psi / 2), 0, Math.cos(-fr.psi / 2)], AH));
  return J;
}

/** LE BILAN d'un rejeu, mesuré sur la FK de notre squelette : à chaque touche, le cou-de-pied au ballon ; le glissement des appuis (la
 *  cheville posée qui bouge au monde) ; l'allure, le cap final. */
export function bilan(sim) {
  const { frames, touches, P } = sim, out = { touches: [], glisse: [], vMin: Infinity, vFin: 0, cap: 0 };
  for (const T of touches) {
    const fr = frames[T.i], W = R.fkPose(P, fr.q, fr.hips), pied = T.pied === 'right' ? 'Right' : 'Left';
    const ch = W[`${pied}Foot`].p, o = W[`${pied}ToeBase`].p, c = Math.cos(-fr.psi), s = Math.sin(-fr.psi);
    const aW = (p) => [fr.X + c * p[0] + s * p[2], p[1], fr.Z - s * p[0] + c * p[2]];
    const A = aW(ch), O = aW(o), b = [T.p[0], P.lengths.groundY + BALL_R, T.p[1]];   // le centre du ballon : le sol du squelette + le rayon
    // la distance du centre du ballon au segment cheville → orteil (le cou-de-pied), moins le rayon : l'écart de la peau du ballon au pied
    const u = [O[0] - A[0], O[1] - A[1], O[2] - A[2]], l2 = u[0] ** 2 + u[1] ** 2 + u[2] ** 2, k = clamp(((b[0] - A[0]) * u[0] + (b[1] - A[1]) * u[1] + (b[2] - A[2]) * u[2]) / l2, 0, 1);
    const d = Math.hypot(b[0] - A[0] - u[0] * k, b[1] - A[1] - u[1] * k, b[2] - A[2] - u[2] * k);
    out.touches.push({ t: T.t, pied: T.pied, d: d - BALL_R, h: A[1] - P.lengths.groundY, vise: T.ecartVise });
  }
  // le glissement : pour chaque appui (pied en 'stance'), la cheville au monde, de la pose au décollage
  for (const side of ['Left', 'Right']) {
    let deb = null;
    for (const fr of frames) {
      // l'appui à plat (stance) : la cheville ; au déroulé (peel), le talon se lève et le pied pivote sur l'avant — l'orteil
      const ph = fr.feet[side], W = R.fkPose(P, fr.q, fr.hips), pt = ph === 'peel' ? W[`${side}ToeBase`].p : W[`${side}Foot`].p, c = Math.cos(-fr.psi), s = Math.sin(-fr.psi);
      const w = [fr.X + c * pt[0] + s * pt[2], fr.Z - s * pt[0] + c * pt[2]];
      const cle = ph === 'swing' ? null : ph;
      if (cle && (!deb || deb.ph !== cle)) deb = { ph: cle, w };
      else if (cle) out.glisse.push(Math.hypot(w[0] - deb.w[0], w[1] - deb.w[1]));
      else deb = null;
    }
  }
  for (const fr of frames) { out.vMin = Math.min(out.vMin, fr.v); }
  out.vFin = frames.at(-1).v; out.cap = frames.at(-1).psi / DEG; out.duree = frames.at(-1).t;
  return out;
}

/** LA CUISSON : le rejeu → le fichier .anim du corps. Une clé toutes les 2 images (le corps interpole en ligne et sur la sphère) ; la
 *  racine = le corps du rejeu dans le repère du départ, à l'échelle des jambes du corps ; la ligne football : les touches puis la
 *  destination du ballon (la dernière entrée : là où il est à la dernière image) ; <gfserie>, <steps>, ballcontrol, specialvar1. */
export function versAnim(sim, numero) {
  const { frames, touches, P } = sim, C = restOffsets(P);
  const k = (P.lengths.hipsY - P.lengths.groundY) / GPF_HIPS_Y;
  const pas = 2, idx = []; for (let i = 0; i < frames.length; i += pas) idx.push(i); if (idx.at(-1) !== frames.length - 1) idx.push(frames.length - 1);
  for (const T of touches) if (!idx.includes(T.i)) idx.push(T.i);
  idx.sort((a, b) => a - b);
  const poses = idx.map((i) => {
    const fr = frames[i], J = jointsDe(fr, P);
    // le bassin : le corps du rejeu (repère du départ : [droite, haut, avant] = [X, ·, −Z]) + le balancement de la foulée (hips, repère
    // personnage) tourné du cap
    const c = Math.cos(fr.psi), s = Math.sin(fr.psi), hx = fr.hips[0], hz = -(fr.hips[2] ?? 0);
    const hips = [fr.X + hx * c + hz * s, fr.hips[1], -fr.Z + hz * c - hx * s];
    return { f: i, S: versCorps(J, hips, P, C) };
  });
  // LA CLASSE D'ENTRÉE : la première clé reculée pour que les deux premières lisent ≥ 4,3 m/s (un contrôle à l'allure de conduite cherche
  // la classe de la marche) — au plus quelques millimètres
  { const a = poses[0].S.p, b = poses[1].S.p, df = poses[1].f - poses[0].f, d = Math.hypot(b[0] - a[0], b[1] - a[1]), vIn = d / df * FPS;
    if (vIn < 4.3) { const ux = (b[0] - a[0]) / (d || 1), uy = (b[1] - a[1]) / (d || 1), recul = 4.3 * df / FPS - d; poses[0].S.p = [a[0] - ux * recul, a[1] - uy * recul, a[2]]; } }
  const fmt = (x) => x.toFixed(6);
  const lignes = [`player,${poses.map((p) => `${p.f},${p.S.p.map(fmt).join(',')}`).join(',')}`];
  for (const n of GPF_NODES) lignes.push(`${n},${poses.map((p) => `${p.f},${p.S.q[n].map(fmt).join(',')}`).join(',')}`);
  // la ligne football : [droite, avant] → le repère du corps (la gauche +X, l'avant −Y), à l'échelle ; le ballon au sol (son rayon)
  const vers = (wx, wz) => [-wx / k, wz / k, BALL_R];   // monde du rejeu : X droite, Z arrière → corps : x = −droite, y = −avant = Z
  const fin = frames.at(-1);
  const entrees = [...touches.map((T) => ({ f: T.i, b: vers(T.p[0], T.p[1]) })), { f: fin.i, b: vers(fin.balle[0], fin.balle[1]) }];
  lignes.push(`extension,football,${entrees.map((e) => `${e.f},${e.b.map(fmt).join(',')}`).join(',')}`);
  const poses_ = frames.filter((fr, i) => i > 0 && frames[i - 1].feet && ['Left', 'Right'].some((s) => frames[i - 1].feet[s] === 'swing' && fr.feet[s] !== 'swing')).length;
  lignes.push(`<gfserie>\n\t1\n</gfserie>`, `<steps>\n\t${Math.max(1, poses_)}\n</steps>`, `<type>\n\tballcontrol\n</type>`, `<specialvar1>\n\t${numero}\n</specialvar1>`);
  return { texte: lignes.join('\n') + '\n', poses, entrees, steps: poses_ };
}
function restOffsets(P) {
  const SEG = { LeftArm: ['LeftForeArm', [0, 0, -1]], LeftForeArm: ['LeftHand', [0, 0, -1]], RightArm: ['RightForeArm', [0, 0, -1]], RightForeArm: ['RightHand', [0, 0, -1]],
    LeftUpLeg: ['LeftLeg', [0, 0, -0.42]], LeftLeg: ['LeftFoot', [0, -0.04, -0.44]], RightUpLeg: ['RightLeg', [0, 0, -0.42]], RightLeg: ['RightFoot', [0, -0.04, -0.44]] };
  const gpfVec = (v) => [-v[0], v[2], v[1]], C = {};
  for (const [bone, [child, dG]] of Object.entries(SEG)) C[bone] = V.quatFromTo(V.norm(V.sub(P.bones[child].bindP, P.bones[bone].bindP)), V.norm(gpfVec(dG)));
  return C;
}

/** LA PREUVE CÔTÉ CORPS : le fichier cuit, relu par le lecteur du convertisseur, la FK du corps — à chaque touche, la cheville du pied qui
 *  joue au ballon de la ligne football (le corps juge la touche là) ; la vitesse d'entrée que le corps lira (ses deux premières clés) et sa
 *  classe ; la vitesse de sortie (les deux dernières). */
export function verifierAnim(texte, touches) {
  const A = parseGpfAnim(texte), lig = texte.split('\n').find((l) => l.startsWith('extension,football')).split(',').slice(2).map(Number), ent = [];
  for (let i = 0; i + 3 < lig.length; i += 4) ent.push({ f: lig[i], b: [lig[i + 1], lig[i + 2], lig[i + 3]] });
  const res = ent.slice(0, -1).map((e, j) => {
    const W = fkGpf(sampleGpf(A, e.f)), pied = touches[j]?.pied === 'left' ? 'left' : 'right', a = W[`${pied}_ankle`].p;
    return { f: e.f, d: Math.hypot(a[0] - e.b[0], a[1] - e.b[1]), h: a[2] };
  });
  const p0 = A.player[0], p1 = A.player[1], pN = A.player.at(-1), pM = A.player.at(-2);
  const vIn = Math.hypot(p1.p[0] - p0.p[0], p1.p[1] - p0.p[1]) / (p1.f - p0.f) * 100, vOut = Math.hypot(pN.p[0] - pM.p[0], pN.p[1] - pM.p[1]) / (pN.f - pM.f) * 100;
  const classe = (v) => (v < 1.8 ? 'arrêt' : v < 4.2 ? 'conduite' : v < 6 ? 'marche' : 'sprint');
  return { touches: res, vIn, vOut, classeIn: classe(vIn), classeOut: classe(vOut), images: A.frames };
}

// ── la ligne de commande ─────────────────────────────────────────────────────────────────────────────────────────────────────────
function rapport(nom, v0, sim, B) {
  const t = B.touches.map((x) => `${x.t.toFixed(2)} s pied ${x.pied === 'right' ? 'droit' : 'gauche'} : le ballon tenu à ${(x.vise * 100).toFixed(1)} cm du cou-de-pied (cheville à ${(x.h * 100).toFixed(0)} cm du sol)`).join(' · ');
  const gl = [...B.glisse].sort((a, b) => a - b), p90 = gl.length ? gl[Math.floor(0.9 * (gl.length - 1))] : 0;
  return `${nom}@${v0} : ${B.duree.toFixed(2)} s · ${t || 'aucune touche'} · allure ${v0} → min ${B.vMin.toFixed(1)} → ${B.vFin.toFixed(1)} m/s · cap final ${B.cap.toFixed(0)}° · appuis : glisse p90 ${(p90 * 100).toFixed(1)} cm`;
}
const direct = import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1] ?? '').href;
if (direct) {
  const [mode, ...args] = process.argv.slice(2);
  const P = profilReference();
  const faire = (nom, v0, sortie) => {
    const sim = rejouerFoulee(COURSE[nom](v0), { P }), B = bilan(sim), n = NUMEROS[`${nom}@${v0}`] ?? 199;
    console.log(rapport(nom, v0, sim, B));
    if (sortie) {
      const A = versAnim(sim, n); writeFileSync(sortie, A.texte);
      const Vf = verifierAnim(A.texte, sim.touches);
      console.log(`   → ${sortie.split('/').slice(-2).join('/')} (n° ${n}, ${A.poses.length} clés, ${Vf.images} images, ${A.steps} poses) · le corps : entrée ${Vf.vIn.toFixed(1)} m/s (${Vf.classeIn}), sortie ${Vf.vOut.toFixed(1)} m/s (${Vf.classeOut}) · touches ${Vf.touches.map((x) => `image ${x.f} cheville à ${(x.d * 100).toFixed(0)} cm du ballon (${(x.h * 100).toFixed(0)} cm du sol)`).join(', ')}`);
    }
    return sim;
  };
  if (mode === 'tous') {
    const dos = new URL('../gestes/course/', import.meta.url).pathname; mkdirSync(dos, { recursive: true });
    const rep = {};
    for (const cle of Object.keys(NUMEROS)) {
      const [nom, v] = cle.split('@'); if (nom === 'course') continue;
      const sim = faire(nom, +v, join(dos, `${nom}-${v.replace('.', '')}.anim`));
      const bD = COURSE[nom](+v).beats.filter((b) => b.dir != null).at(-1), sortie = bD?.corps ? bD.corps.at(-1).dir : bD?.dir ?? 0;   // la sortie : la direction finale du corps
      (rep[nom] ??= { n: {}, duree: {}, sortie: Math.round(sortie / DEG) }); rep[nom].n[v] = NUMEROS[cle]; rep[nom].duree[v] = +sim.frames.at(-1).t.toFixed(2);
    }
    // LE RÉPERTOIRE, pour gestes-course.mjs (sa table COURSE doit le reproduire : bancs/course-essai.mjs le vérifie)
    writeFileSync(join(dos, 'repertoire.json'), JSON.stringify(rep, null, 1) + '\n');
    console.log(`répertoire : ${join(dos, 'repertoire.json')}`);
  } else if (COURSE[mode]) faire(mode, +(args[0] ?? 3.5), args[1] ?? null);
  else console.log(`usage : node outils/foulee-gpf.mjs <${Object.keys(COURSE).join('|')}> [v0=3.5] [sortie.anim] | tous`);
}
