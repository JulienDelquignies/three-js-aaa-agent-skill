#!/usr/bin/env node
// verify-swing.mjs — LA DYNAMIQUE DU SWING, mesurée par FK sur le vrai squelette (shanon.glb, parsé
// brut — pas de three), en INTERPOLANT entre les clés (slerp) : c'est la vitesse INSTANTANÉE du
// pied qui fait une frappe, et elle n'existe qu'entre les clés.
//
// La découverte qui fonde ce banc : la clé de CONTACT des passes était la FIN du swing — la clé
// suivante (l'accompagnement) REVENAIT en arrière (cuisse −46° → −30°), donc la vitesse interpolée
// s'annulait PILE au contact. Un pied de frappe mesuré à 1-5 m/s dans le monde composé (réel :
// 15-25) pendant que tous les contrats d'angles étaient verts. Un swing PASSE À TRAVERS sa pose de
// contact ; il ne se gare pas dessus. C'est LE sabotage-référence de ce banc.
//
// Clauses par clip de frappe (× les deux pieds, via mirrorMove — le miroir est prouvé exact) :
//   1. la vitesse du pied à t=contact est une vitesse de frappe (≥ seuil du geste) ;
//   2. le PIC de vitesse est SUR le contact (±35 ms) — pas un pic d'armé ni d'accompagnement ;
//   3. le pied frappe à hauteur de ballon (≤ 0,3 m) ;
//   4. l'orientation du pied au contact est ÉCRITE (axe horizontal orteils ≥ 8 cm — un pied en
//      flexion plantaire totale n'a pas de surface) ;
//   5. le pied s'ÉTEND au contact (excursion horizontale depuis le repos ≥ seuil — la talonnade
//      s'étend VERS L'ARRIÈRE, c'est sa définition, vérifiée par le sens du mouvement).
// Contrôles : le pied d'accueil s'étend vers le ballon puis revient (l'amorti est un geste, pas
// une pose) — excursion ≥ 0,18 m et retour ≤ 60 % de l'excursion.
import { MOVES, resolveTracks, mirrorMove } from '../assets/starter/src/engine/animkit.js';
import { STANCES_CLIP as STANCES } from '../assets/starter/src/engine/approach.js';   // la stance DES CLIPS (la sim garde la sienne : STANCES)
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---- squelette réel (même parseur brut que la silhouette de verify-animkit)
const raw = readFileSync(new URL('../../../examples/showcase/public/shanon.glb', import.meta.url));
const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
let off = 12, json = null;
while (off < dv.byteLength) {
  const l = dv.getUint32(off, true), ty = dv.getUint32(off + 4, true);
  if (ty === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(raw.subarray(off + 8, off + 8 + l)));
  off += 8 + l + ((4 - (l % 4)) % 4); if (json) break;
}
const N = json.nodes, parent = new Map(); N.forEach((n, i) => (n.children || []).forEach((c) => parent.set(c, i)));
const nIdx = new Map(); N.forEach((n, i) => nIdx.set(String(n.name || '').replace(/^mixamorig\d*[:_]?/i, ''), i));
const chain = (name) => { const out = []; let k = nIdx.get(name); while (k != null) { out.unshift(k); k = parent.get(k); } return out; };
const qm = (a, c) => [a[3] * c[0] + a[0] * c[3] + a[1] * c[2] - a[2] * c[1], a[3] * c[1] - a[0] * c[2] + a[1] * c[3] + a[2] * c[0],
  a[3] * c[2] + a[0] * c[1] - a[1] * c[0] + a[2] * c[3], a[3] * c[3] - a[0] * c[0] - a[1] * c[1] - a[2] * c[2]];
const rv = (q, v) => { const [x, y, z, w] = q; const ux = y * v[2] - z * v[1], uy = z * v[0] - x * v[2], uz = x * v[1] - y * v[0];
  return [v[0] + 2 * (w * ux + y * uz - z * uy), v[1] + 2 * (w * uy + z * ux - x * uz), v[2] + 2 * (w * uz + x * uy - y * ux)]; };
// LA SÉMANTIQUE EST CELLE DU JEU : ADDITIVE. Le jeu joue ces clips en delta sur l'idle
// (makeClipAdditive : delta vs image 0 = BASE_POSE), et l'idle garde les rotations de REPOS du rig
// — dont le retournement ~180° de la cuisse (sondé : RightUpLeg r ≈ [0, 0, 1, 0.04]). Le premier
// banc REMPLAÇAIT les rotations par les quats du spec (sémantique absolue) : le retournement
// sautait, la jambe pointait en l'air — « hauteur de frappe 135 cm » sur tous les clips, l'axe
// était innocent. q_final = q_repos ⊗ (q_spec(0)⁻¹ ⊗ q_spec(t)) — exactement ce que le mixer fait.
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
const world = (name, delta) => { let q = [0, 0, 0, 1], p = [0, 0, 0];
  for (const k of chain(name)) { const nm = String(N[k].name || '').replace(/^mixamorig\d*[:_]?/i, '');
    const t = N[k].translation || [0, 0, 0]; const rt = rv(q, t); p = [p[0] + rt[0], p[1] + rt[1], p[2] + rt[2]];
    // LE CANAL HANCHES (delta.__hips, mètres personnage [droite, haut, avant]) : le jeu déplace le
    // bassin (hipsWrite) — sans lui, le banc mesurait la stance d'un corps qui n'est pas là. Ce
    // rig regarde +Z dans son fichier : droite = −X, avant = +Z.
    if (nm === 'Hips' && delta.__hips) p = [p[0] - delta.__hips[0], p[1] + delta.__hips[1], p[2] + delta.__hips[2]];
    let local = N[k].rotation || [0, 0, 0, 1];
    if (delta[nm]) local = qm(local, delta[nm]);
    q = qm(q, local); }
  return p; };

// ---- slerp + pose interpolée à t quelconque (par os : entre ses deux clés encadrantes)
const slerp = (a, b, u) => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (d < 0) { d = -d; bb = [-b[0], -b[1], -b[2], -b[3]]; }
  if (d > 0.9995) { const r = a.map((x, i) => x + (bb[i] - x) * u); const n = Math.hypot(...r); return r.map((x) => x / n); }
  const th = Math.acos(Math.min(1, d)), s = Math.sin(th);
  const wa = Math.sin((1 - u) * th) / s, wb = Math.sin(u * th) / s;
  return [a[0] * wa + bb[0] * wb, a[1] * wa + bb[1] * wb, a[2] * wa + bb[2] * wb, a[3] * wa + bb[3] * wb];
};
const poseAt = (tracks, t) => {
  const pose = {};
  for (const [bone, ks] of Object.entries(tracks)) {
    if (!ks.length) continue;
    let i = ks.findIndex((k) => k.t > t);
    if (i === -1) pose[bone] = ks[ks.length - 1].q;
    else if (i === 0) pose[bone] = ks[0].q;
    else {
      const a = ks[i - 1], b = ks[i];
      pose[bone] = slerp(a.q, b.q, (t - a.t) / Math.max(1e-9, b.t - a.t));
    }
  }
  return pose;
};
/** la POSE ABSOLUE du clip à t : q_spec(t) tel quel, composé sur le rest par world() — LA sémantique
 *  de la couche de geste (rest ⊗ q_spec(t) : ce qui est écrit est ce qui s'affiche). L'ancienne
 *  conjugaison par q_spec(0)⁻¹ était un no-op pour les jambes (clé 0 = identité) mais ANNULAIT la
 *  BASE_POSE des bras — le banc validait des bras que le jeu n'affichait pas, et inversement. Le
 *  paramètre q0 est gardé pour la stabilité des appels ; il n'est plus consommé. */
const deltasAt = (tracks, q0, t) => poseAt(tracks, t);
const hipsAt = (spec, t) => {   // lerp du canal hanches entre clés (la loi de gesture-layer)
  const ks = spec.keys.filter((k) => k.hips); if (!ks.length) return null;
  if (t <= ks[0].t) return ks[0].hips; if (t >= ks[ks.length - 1].t) return ks[ks.length - 1].hips;
  let i = 1; while (ks[i].t < t) i++; const a = ks[i - 1], b = ks[i], u = (t - a.t) / Math.max(1e-9, b.t - a.t);
  return a.hips.map((v, j) => v + (b.hips[j] - v) * u);
};

// ---- LE REPÈRE SE DÉRIVE DU SQUELETTE, PAS DE LA FOI (loi 8, appliquée au banc lui-même) :
// l'armature Mixamo est TOURNÉE (−90° X) — l'axe « y » des nœuds n'est pas le haut du monde. Le
// premier banc mesurait « hauteur de frappe 145 cm » sur TOUS les clips : c'était l'axe, pas les
// pieds. Le HAUT est la direction Hips→Head du repos ; le SOL est le pied au repos le long de cet
// axe ; l'horizontale est le complément. Les vitesses (des normes) n'ont jamais menti.
const restPose = {};
const UP = (() => {
  const hips = world('Hips', restPose), head = world('Head', restPose);
  const u = [head[0] - hips[0], head[1] - hips[1], head[2] - hips[2]];
  const n = Math.hypot(...u); return [u[0] / n, u[1] / n, u[2] / n];
})();
const upOf = (p) => p[0] * UP[0] + p[1] * UP[1] + p[2] * UP[2];
const GROUND = Math.min(upOf(world('LeftFoot', restPose)), upOf(world('RightFoot', restPose)));
const horiz = (a, b) => {   // distance horizontale (composante ⊥ UP du vecteur a−b)
  const d = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const k = d[0] * UP[0] + d[1] * UP[1] + d[2] * UP[2];
  return Math.hypot(d[0] - k * UP[0], d[1] - k * UP[1], d[2] - k * UP[2]);
};
// L'AVANT du personnage, dérivé du squelette (épaules × up — même loi que checkSquad) : la
// grandeur qu'aucune clause ne regardait. Ce banc a validé vitesse, pic, hauteur, orientation —
// toutes AVEUGLES À LA DIRECTION — pendant que chaque frappe de la bibliothèque balayait vers
// l'ARRIÈRE (passe : pied à −0,46 m d'avant au contact ; et la talonnade, seul geste censé aller
// derrière, faisait 0,00). L'utilisateur l'a vu à l'œil : « beaucoup de talonnade ». Une passe EST
// un pied qui traverse le ballon VERS LA CIBLE — c'est désormais une clause, plus une croyance.
const FORWARD = (() => {
  const l = world('LeftArm', restPose), r = world('RightArm', restPose);
  const a = [l[0] - r[0], l[1] - r[1], l[2] - r[2]];
  const f = [a[1] * UP[2] - a[2] * UP[1], a[2] * UP[0] - a[0] * UP[2], a[0] * UP[1] - a[1] * UP[0]];
  const n = Math.hypot(...f); return [f[0] / n, f[1] / n, f[2] / n];
})();
const fwdOf = (a, b) => (a[0] - b[0]) * FORWARD[0] + (a[1] - b[1]) * FORWARD[1] + (a[2] - b[2]) * FORWARD[2];

/** Le portrait dynamique d'un clip : trajectoire du pied à 240 Hz + les nombres du contact. */
function swingPortrait(spec, foot) {
  const r = resolveTracks(spec);
  const F = foot === 'right' ? 'RightFoot' : 'LeftFoot';
  const T = foot === 'right' ? 'RightToeBase' : 'LeftToeBase';
  const h = 1 / 240;
  const q0 = poseAt(r.tracks, 0);
  const rest = world(F, deltasAt(r.tracks, q0, 0));
  const pts = [], toes = [];
  const at = (t) => ({ ...deltasAt(r.tracks, q0, t), __hips: hipsAt(spec, t) });
  for (let t = 0; t <= r.duration + 1e-9; t += h) { pts.push(world(F, at(t))); toes.push(world(T, at(t))); }
  const speed = (i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / (2 * h);
  };
  const iC = Math.round((spec.contact ?? 0) / h);
  let peak = 0, iPeak = 0;
  for (let i = 0; i < pts.length; i++) { const s = speed(i); if (s > peak) { peak = s; iPeak = i; } }
  const pC = pts[Math.min(iC, pts.length - 1)], toeC = toes[Math.min(iC, pts.length - 1)];
  const exc = horiz(pC, rest);
  let excMax = 0; for (const p of pts) excMax = Math.max(excMax, horiz(p, rest));
  // la direction : où est le pied au contact (avant/arrière), et dans quel sens il TRAVERSE
  // (composante avant de la vitesse au contact) — le miroir préserve l'avant, donc les deux pieds
  // se jugent avec le même axe
  const a = pts[Math.max(0, iC - 1)], b = pts[Math.min(pts.length - 1, iC + 1)];
  return {
    vContact: speed(iC), peak, tPeak: iPeak * h, height: upOf(pC) - GROUND,
    toeAxis: horiz(toeC, pC),
    exc, excMax,
    endExc: horiz(pts.at(-1), rest),
    fwdAt: fwdOf(pC, rest),
    vFwd: fwdOf(b, a) / (2 * h),
  };
}

console.log('— les frappes : le pied PASSE À TRAVERS le contact —');
// seuils par geste : une passe posée frappe moins vite qu'une frappe, un talon moins qu'une passe.
// Exception assumée : une déviation ne FRAPPE pas — elle PRÉSENTE la surface sur la trajectoire,
// c'est le ballon qui a la vitesse. On exige seulement que le pied accompagne (≥ 2 m/s), pas qu'il
// arme — exiger 8 m/s d'une remise de première en ferait une passe déguisée.
const STRIKES = { passe: 10, passeRapide: 10, passeExterieur: 8, frappe: 12, talonnade: 6, passePivot: 8, deviation: 2 };
// LA DIRECTION, par geste : vers où le pied traverse au contact (composante avant de sa vitesse).
// Une frappe vers l'avant traverse vers l'avant ; la talonnade traverse vers l'ARRIÈRE (c'est sa
// définition) ; la déviation présente la surface (direction libre, c'est le ballon qui a le sens).
const DIRECTION = { passe: 1, passeRapide: 1, passeExterieur: 1, frappe: 1, passePivot: 1, talonnade: -1, deviation: 0 };
for (const [id, vMin] of Object.entries(STRIKES)) {
  for (const [foot, spec] of [['right', MOVES[id]], ['left', mirrorMove(MOVES[id])]]) {
    const s = swingPortrait(spec, foot);
    const lbl = `« ${id} » pied ${foot === 'right' ? 'droit' : 'gauche'}`;
    ok(`${lbl} : vitesse du pied au contact ${s.vContact.toFixed(1)} m/s (≥ ${vMin})`, s.vContact >= vMin);
    ok(`  pic (${s.peak.toFixed(1)} m/s) SUR le contact (t=${s.tPeak.toFixed(3)} vs ${spec.contact} ± 0,035 s)`,
      Math.abs(s.tPeak - spec.contact) <= 0.035);
    ok(`  hauteur de frappe ${(s.height * 100).toFixed(0)} cm (≤ 30)`, s.height <= 0.30);
    ok(`  orientation du pied ÉCRITE au contact (axe orteils horiz. ${(s.toeAxis * 100).toFixed(0)} cm ≥ 8)`, s.toeAxis >= 0.08);
    const dir = DIRECTION[id];
    if (dir > 0) ok(`  le pied TRAVERSE VERS L'AVANT (v_avant ${s.vFwd.toFixed(1)} m/s ≥ 60 % de ${s.vContact.toFixed(1)})`,
      s.vFwd >= 0.6 * s.vContact);
    else if (dir < 0) ok(`  le talon TRAVERSE VERS L'ARRIÈRE (v_avant ${s.vFwd.toFixed(1)} m/s ≤ −60 % de ${s.vContact.toFixed(1)})`,
      s.vFwd <= -0.6 * s.vContact);
  }
}

console.log('\n— la CONCORDANCE stance ↔ clip : le ballon est porté là où le pied frappe —');
// La stance (approach.js) dit au porté OÙ poser le ballon ; le clip dit où le pied frappe. Si les
// deux divergent, le couple est soudé au mauvais point et le warp paie la différence — mesuré
// composé : 0,45 m de résiduel avec l'ancienne table écrite à la main. La table est désormais
// DÉRIVÉE (S = pied_contact + standoff · direction) et cette clause interdit qu'elle re-mente :
// ré-authorer un clip sans re-mesurer sa stance fait refuser le banc.
{
  const rightAxis = (() => {
    const f = FORWARD, u = UP;
    const r = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]];
    const n = Math.hypot(...r); return [r[0] / n, r[1] / n, r[2] / n];
  })();
  const h = 1 / 240;
  for (const id of Object.keys(STRIKES)) {
    const spec = MOVES[id];
    const r = resolveTracks(spec);
    const q0 = poseAt(r.tracks, 0);
    const at = (t) => world('RightFoot', { ...deltasAt(r.tracks, q0, t), __hips: hipsAt(spec, t) });
    // depuis l'ORIGINE du modèle (la position que anchorFor place) — le bassin voyage sur les frappes
    // générées, un os qui recule ne dit pas où la sim doit poser le corps
    const hips = [0, 0, 0];
    const c = at(spec.contact), a = at(spec.contact - h), b = at(spec.contact + h);
    const v = [(b[0] - a[0]) / (2 * h), (b[1] - a[1]) / (2 * h), (b[2] - a[2]) / (2 * h)];
    const vn = Math.hypot(...v) || 1;
    const S = [c[0] + (v[0] / vn) * 0.18, c[1] + (v[1] / vn) * 0.18, c[2] + (v[2] / vn) * 0.18];
    const d = [S[0] - hips[0], S[1] - hips[1], S[2] - hips[2]];
    const fwd = fwdOf(S, hips);
    const lat = d[0] * rightAxis[0] + d[1] * rightAxis[1] + d[2] * rightAxis[2];
    const st = STANCES[id];
    const sx = Math.cos(st.bearing * Math.PI / 180) * st.dist, sy = Math.sin(st.bearing * Math.PI / 180) * st.dist;
    const gap = Math.hypot(fwd - sx, lat - sy);
    ok(`« ${id} » : la stance de la table est celle du clip (écart ${(gap * 100).toFixed(0)} cm ≤ 8 — mesuré {dist ${Math.hypot(fwd, lat).toFixed(2)}, bearing ${(Math.atan2(lat, fwd) * 180 / Math.PI).toFixed(0)}°})`,
      gap <= 0.08);
  }
}

console.log('\n— les contrôles : l\'amorti est un GESTE (le pied va au ballon, puis revient) —');
for (const id of ['controleInterieur', 'controleExterieur', 'controleSemelle']) {
  for (const [foot, spec] of [['right', MOVES[id]], ['left', mirrorMove(MOVES[id])]]) {
    const s = swingPortrait(spec, foot);
    const lbl = `« ${id} » pied ${foot === 'right' ? 'droit' : 'gauche'}`;
    ok(`${lbl} : le pied S'ÉTEND vers le ballon (excursion max ${(s.excMax * 100).toFixed(0)} cm ≥ 18)`, s.excMax >= 0.18);
    ok(`  …et REVIENT (fin à ${(s.endExc * 100).toFixed(0)} cm ≤ 60 % de l'excursion)`, s.endExc <= s.excMax * 0.6 + 0.02);
  }
}

console.log('\n— la SILHOUETTE des bras : un balancier plié, jamais un épouvantail —');
// La grandeur que quatre sessions n'ont pas mesurée (le sweep l'a payée en captures) : vitesse,
// hauteur, direction du PIED étaient des clauses — les BRAS, jamais. Mesuré composé : bras en
// croix sur 94-100 % des images de geste (coude 161-170°, main au-dessus du cou jusqu'à 12,5 %),
// bras d'équilibre jeté DERRIÈRE tendu raide sur 100 % des frappes. Le vrai balancier : coude
// plié (≤ 152° d'angle intérieur), le bras devant-latéral (|azimut| ≤ 125°), les mains SOUS le
// cou. Jugé en FK sur toute la durée du clip, les deux pieds — le tacle (bras d'appui au sol,
// levés en glissade) est l'exception assumée et n'est pas dans la liste.
{
  const az = (a, b) => {   // azimut du vecteur horizontal a−b vs l'AVANT (0 = devant, 180 = derrière)
    const d = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const k = d[0] * UP[0] + d[1] * UP[1] + d[2] * UP[2];
    const h = [d[0] - k * UP[0], d[1] - k * UP[1], d[2] - k * UP[2]];
    const n = Math.hypot(...h) || 1;
    return Math.acos(Math.max(-1, Math.min(1, (h[0] * FORWARD[0] + h[1] * FORWARD[1] + h[2] * FORWARD[2]) / n))) * 180 / Math.PI;
  };
  const elbow = (sh, fo, ha) => {
    const a = [sh[0] - fo[0], sh[1] - fo[1], sh[2] - fo[2]], b = [ha[0] - fo[0], ha[1] - fo[1], ha[2] - fo[2]];
    const la = Math.hypot(...a) || 1, lb = Math.hypot(...b) || 1;
    return Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb)))) * 180 / Math.PI;
  };
  // La TENUE, pas l'instant : un vrai bras passe par le presque-tendu en route entre deux
  // positions (une image ou deux d'interpolation) — le pathologique mesuré au sweep était la
  // TENUE : 80-96 % des images à coude ≥ 150°, 46 % des vecteurs jetés derrière. On borne donc
  // la FRACTION du temps, pas le pire échantillon.
  for (const id of ['passe', 'passeRapide', 'frappe', 'controleInterieur']) {
    for (const [foot, spec] of [['right', MOVES[id]], ['left', mirrorMove(MOVES[id])]]) {
      const r = resolveTracks(spec);
      const q0 = poseAt(r.tracks, 0);
      let n = 0, locked = 0, behind = 0, worstHand = -Infinity;
      for (let t = 0; t <= spec.duration + 1e-9; t += 1 / 60) {
        const d = deltasAt(r.tracks, q0, t);
        for (const side of ['Left', 'Right']) {
          const sh = world(`${side}Arm`, d), fo = world(`${side}ForeArm`, d), ha = world(`${side}Hand`, d);
          const nk = world('Neck', d);
          n++;
          // un bras qui PEND détendu est presque droit (~160°, la BASE même) et c'est naturel —
          // l'épouvantail, c'est tendu ET LEVÉ : le verrou ne compte que bras au-dessus de −40°
          const L = Math.hypot(ha[0] - sh[0], ha[1] - sh[1], ha[2] - sh[2]) || 1;
          const elev = Math.asin(Math.max(-1, Math.min(1, (upOf(ha) - upOf(sh)) / L))) * 180 / Math.PI;
          if (elbow(sh, fo, ha) >= 155 && elev > -40) locked++;
          if (az(ha, sh) >= 130 && elev > -50) behind++;
          worstHand = Math.max(worstHand, upOf(ha) - upOf(nk));
        }
      }
      const lbl = `« ${id} » pied ${foot === 'right' ? 'droit' : 'gauche'}`;
      ok(`${lbl} : le coude vit PLIÉ (verrouillé ≥ 155° sur ${(100 * locked / n).toFixed(0)} % des images ≤ 20 — avant le fix : 80-96 %)`,
        locked / n <= 0.20);
      ok(`  le bras vit DEVANT (jeté derrière ≥ 130° sur ${(100 * behind / n).toFixed(0)} % ≤ 10 — avant : 46 % des vecteurs)`,
        behind / n <= 0.10);
      ok(`  mains SOUS le cou (pire ${(worstHand * 100).toFixed(0)} cm ≤ +3)`, worstHand <= 0.03);
    }
  }
  // sabotage : le bras LIVRÉ avant le sweep — tendu raide, jeté derrière à hauteur d'épaule
  // (les valeurs mêmes de l'ancienne clé de récup de frappe, axe Z au lieu de X)
  const flung = JSON.parse(JSON.stringify(MOVES.frappe));
  for (const k of flung.keys) if (k.pose.RightArm) { k.pose.RightArm = [-14, -4, 48]; k.pose.RightForeArm = [5, 0, -24]; }
  {
    const r = resolveTracks(flung);
    const q0 = poseAt(r.tracks, 0);
    let n = 0, locked = 0, behind = 0;
    for (let t = 0; t <= flung.duration; t += 1 / 60) {
      const d = deltasAt(r.tracks, q0, t);
      const sh = world('RightArm', d), fo = world('RightForeArm', d), ha = world('RightHand', d);
      n++;
      const L = Math.hypot(ha[0] - sh[0], ha[1] - sh[1], ha[2] - sh[2]) || 1;
      const elev = Math.asin(Math.max(-1, Math.min(1, (upOf(ha) - upOf(sh)) / L))) * 180 / Math.PI;
      if (elbow(sh, fo, ha) >= 155 && elev > -40) locked++;
      if (az(ha, sh) >= 130 && elev > -50) behind++;
    }
    ok(`sabotage « bras d'épouvantail (la version livrée, axe Z) » attrapé par la TENUE (verrouillé ${(100 * locked / n).toFixed(0)} %, derrière ${(100 * behind / n).toFixed(0)} %)`,
      locked / n > 0.20 || behind / n > 0.10);
  }
}

console.log('\n— les sabotages : chaque clause doit mordre —');
{
  // LE SABOTAGE-RÉFÉRENCE : la passe LIVRÉE avant ce banc — l'accompagnement RECULE après le
  // contact (cuisse −46° → −30°), la vitesse interpolée s'annule pile sur la pose de contact.
  const parked = JSON.parse(JSON.stringify(MOVES.passe));
  // (sur un spec DENSE — 60 Hz, généré — « garer » c'est tenir la pose de contact sur toutes les clés
  // à partir de l'image qui précède le contact : le pied s'arrête SUR le ballon au lieu de le traverser)
  const kC = parked.keys.find((k) => Math.abs(k.t - parked.contact) < 1e-6);
  if (kC) for (const k of parked.keys) if (k.t >= parked.contact - 1 / 60 - 1e-6) { k.pose = JSON.parse(JSON.stringify(kC.pose)); k.hips = kC.hips ? [...kC.hips] : k.hips; }
  const s = swingPortrait(parked, 'right');
  ok(`sabotage « pose de contact GARÉE (l'accompagnement recule) » attrapé (vitesse au contact ${s.vContact.toFixed(1)} m/s)`,
    s.vContact < 10 || Math.abs(s.tPeak - parked.contact) > 0.035);
}
{
  // le contact déclaré au PIC D'ARMÉ ARRIÈRE (la découverte de l'audit composé : passage avant
  // ~0,3 s après la frame contact déclarée)
  const early = JSON.parse(JSON.stringify(MOVES.passe));
  early.contact = 0.22;                                        // la clé d'armé, pied en arrière
  const s = swingPortrait(early, 'right');
  ok(`sabotage « contact déclaré au pic d'armé » attrapé (pic à t=${s.tPeak.toFixed(2)} vs contact 0,22)`,
    Math.abs(s.tPeak - early.contact) > 0.035 || s.vContact < 10);
}
{
  // un contrôle-POSE (le pied ne va jamais au ballon) doit être refusé par la clause d'excursion
  const statue = JSON.parse(JSON.stringify(MOVES.controleInterieur));
  for (const k of statue.keys) for (const b of Object.keys(k.pose)) { if (/Leg|Foot/.test(b)) k.pose[b] = [0, 0, 0]; }
  const s = swingPortrait(statue, 'right');
  ok(`sabotage « contrôle-statue (le pied ne va pas au ballon) » attrapé (excursion ${(s.excMax * 100).toFixed(0)} cm)`, s.excMax < 0.18);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
