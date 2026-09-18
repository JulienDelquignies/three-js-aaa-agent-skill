// attente-vivante.js — L'ATTENTE VIVANTE (285, cfg.attenteVivante && st.full — retour du 17/09 : « aux coups de pied arrêtés tout le
// monde est à l'arrêt en attendant que ça joue, il faut rendre ça vivant »). Mesuré avant (sonde-284, 4 × 90 min) : au milieu des
// attentes de remise, 89-91 % des joueurs de champ figés (< 0,25 m/s), 0,2 m/s de moyenne — chacun marchait à son poste puis s'y
// plantait. Ici l'attente a un CORPS : pendant l'attente d'une remise (hors engagement — la Loi 8 pose chacun — et hors penalty),
// chaque joueur de champ qui n'est ni le preneur, ni au mur, ni en fête, ni en marche vers un poste lointain reçoit un MICRO-DÉPLACEMENT
// continu autour de son poste (une marche aléatoire LISSÉE : deux images-clés seedées par joueur et par remise, interpolées en
// smoothstep — amplitude amp × workF × axe(tempo, 0,8, 1,2), période periode s) ; dans les appel dernières secondes, le camp qui remet
// DÉCROCHE (les receveurs à ≤ rayon m du point s'écartent de leur adversaire le plus proche de decroche m × otbF) et le camp qui défend
// SERRE son homme (colle m vers l'adversaire le plus proche à < serre m) — sans jamais entrer dans le RAYON DU RÈGLEMENT de la remise
// (Loi 15 : 2 m du lanceur ; 9,15 m ailleurs : le banc l'a attrapé au premier jet, un défenseur serré à 1,16 m du lanceur). Attributs en facteurs : workRate (l'amplitude), offTheBall (le
// décrochage), le 50 vaut 1 exact ; tactique : l'axe tempo, 0,5 identité. Déterministe (hash entier, pas de tirage global). Clé
// absente : l'attente plantée d'hier au bit.
import { hyp } from './hyp.js';
import { tac, axe } from './tactics.js';

/** Un hash [0 ; 1[ de trois entiers — stable, sans état. Pure. */
export function hashDe(a, b, c) { let h = (Math.imul(a + 1, 2654435761) ^ Math.imul(b + 1, 40503) ^ Math.imul(c + 1, 97)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) % 1000 / 1000; }

/** Le micro-déplacement d'un joueur à la date t d'une remise seedée : deux images-clés (angle, rayon ≤ amp) interpolées en
 *  smoothstep sur la période. Rend [dx, dz]. Pure. */
export function microDe(id, seed, t, K, ampF = 1) {
  const per = K.periode ?? 3, amp = (K.amp ?? 1.2) * ampF, k = Math.floor(t / per), u = t / per - k, s = u * u * (3 - 2 * u);
  const key = (n) => { const a = 2 * Math.PI * hashDe(id, seed, n), r = amp * (0.4 + 0.6 * hashDe(id, seed, n + 101)); return [r * Math.cos(a), r * Math.sin(a)]; };
  const A = key(k), B = key(k + 1);
  return [A[0] + (B[0] - A[0]) * s, A[1] + (B[1] - A[1]) * s];
}

/** Le pas de l'attente vivante : déplace les cibles des joueurs de champ éligibles autour de leur poste ; les appel dernières secondes
 *  décrochent le camp qui remet et serrent le camp qui défend. Appelé par match-sim après l'élection du preneur. */
export function attenteVivanteStep(st, r, cfg, taker) {
  const K = cfg.attenteVivante; if (!K || !r || r.type === 'engagement' || r.type === 'penalty' || !(r.at > st.t)) return 0;
  const seed = Math.round(r.at * 100) % 1000003, reste = r.at - st.t, spot = [r.p[0], r.p[1]]; let n = 0;
  const rLoi = r.type === 'touche' ? (K.loiTouche ?? 2.3) : (cfg.loi12?.mur ?? 9.15) + 0.3;   /* le rayon du règlement (Loi 15 : 2 m du lanceur ; Lois 13, 16, 17 : 9,15 m) — le camp qui défend ne s'y glisse jamais */
  for (const p of st.players) {
    if (p.keeper || p.down > 0 || p.expulse || p._sub || p === taker || p.job !== 'walk' || !p.target) continue;
    if (st._murCorps?.ids?.includes(p.id) || st._mur?.ids?.includes(p.id) || (st._celeb && (p.id === st._celeb.by || st._celeb.avec?.includes(p.id)))) continue;
    if (hyp(p.target[0] - p.p[0], p.target[2] - p.p[2]) > (K.loin ?? 5)) continue;   // encore en marche vers un poste lointain : la marche d'abord
    const tempoF = axe(tac(st, p.team).tempo ?? 0.5, K.lent ?? 0.8, K.vif ?? 1.2);
    const [dx, dz] = microDe(p.id, seed, st.t, K, (p.skill?.workF ?? 1) * tempoF);
    let ax = 0, az = 0;
    if (reste <= (K.appel ?? 2)) {
      const foes = st.players.filter((q) => q.team !== p.team && !q.keeper && q.down <= 0); let foe = null, dF = 99;
      for (const q of foes) { const d = hyp(q.p[0] - p.p[0], q.p[2] - p.p[2]); if (d < dF) { dF = d; foe = q; } }
      if (p.team === r.team && hyp(p.p[0] - spot[0], p.p[2] - spot[1]) <= (K.rayon ?? 18) && foe && dF > 0.1) { const m = (K.decroche ?? 2.5) * (p.skill?.otbF ?? 1) / dF; ax = (p.p[0] - foe.p[0]) * m; az = (p.p[2] - foe.p[2]) * m; }
      else if (p.team !== r.team && foe && dF < (K.serre ?? 4) && dF > 0.1) { const m = (K.colle ?? 0.6) / dF; ax = (foe.p[0] - p.p[0]) * m; az = (foe.p[2] - p.p[2]) * m; }
    }
    const mg = K.bord ?? 0.5, nx = Math.max(-st.pitch.hx + mg, Math.min(st.pitch.hx - mg, p.target[0] + dx + ax)), nz = Math.max(-st.pitch.hz + mg, Math.min(st.pitch.hz - mg, p.target[2] + dz + az));   /* jamais hors du terrain (le 207 l'a attrapé au deuxième jet) */
    if (p.team !== r.team && hyp(nx - spot[0], nz - spot[1]) < rLoi) continue;   /* dans le rayon du règlement : le poste d'hier, sans micro-déplacement */
    p.target = [nx, 0, nz]; n++;
  }
  return n;
}
