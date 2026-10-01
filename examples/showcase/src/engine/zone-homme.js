// zone-homme.js — UNE ZONE, UN HOMME (lot 381, cfg.zoneHomme — T1 bis du chantier tactique ; 01/10 : « oui on y va »). Le diagnostic
// (lots 377-380) : les ailiers servis libres entre les lignes (9-10 m du plus proche adversaire, 70 % libres à 5 m), le latéral adverse à
// 16-17 m d'eux, en marquage d'un autre homme ; l'ailier MARQUABLE 33 % du temps. L'architecture d'hier : qui est marquable se décide
// autour du BALLON (rayon 22 m, zone loin sans marquage), l'affectation donne les hommes par DANGER (le plus près du but d'abord) aux
// défenseurs les plus proches du ballon, le reste tient un slot du bloc chaîné au ballon. Personne n'était responsable d'un ESPACE.
// La loi (le zonal à prise d'homme des livres, B12 § 1-4) :
//   (1) chaque défenseur de champ (hors presseur, intercepteur, couvreur) a une ZONE : son slot du bloc (formationSpots, coulissé) ;
//   (2) un attaquant (hors porteur) revient au défenseur dont la ZONE est la plus proche — affectation gloutonne par coût croissant
//       (distance attaquant ↔ slot × (2 − markF)), chaque homme une fois, chaque défenseur une fois ; l'attaquant à plus de `rayon` m
//       de toute zone n'est la responsabilité de personne (rayon × la consigne : zone `rZone` … homme `rHomme`) ;
//   (3) la PASSATION : la paire d'hier coûte × `tenue` — l'homme qui change de zone passe au voisin quand l'écart le justifie ;
//   (5) LA ZONE COULISSE, ELLE NE SAUTE PAS : mesuré, les slots du bloc chaîné au ballon bougeaient à 8,7 m/s en moyenne (ils sautent avec
//       chaque passe) — les cibles à 7,2 m/s, les paires vivaient 0,7 s p50. La zone de chaque défenseur suit son slot au premier ordre
//       (`tauZone` s), bornée à `vZone` m/s × workRate — le bloc glisse à l'allure d'un bloc ;
//   (4) le défenseur affecté vise CÔTÉ BUT de son homme à la distance élastique (368) × rôle × note (marquageDe, 377), part `w` du chemin
//       (zone `wZone` … homme 1), tenu en LAISSE à sa zone (zone `lZone` … homme `lHomme` m) ; le non affecté tient sa zone.
// Les rôles et notes : marqueSerre et markF (la distance), positioning (posF : le coût de la zone — le bon placeur prend son homme),
// la consigne marquage (rayon, laisse, part). Absente : l'architecture d'hier, au bit.
import { marquageDe, distanceElastique } from './marquage-elastique.js'; import { profondeurRole } from './occupation-role.js';
const hyp = Math.hypot, ax = (v, lo, hi) => lo + Math.max(0, Math.min(1, v ?? 0.5)) * (hi - lo);
const LIBRES = new Set(['mark']);

/** Une fois par image (avant le pas des corps) : l'affectation zone → homme de l'équipe sans ballon. Écrit st._zh = Map(id → cible). */
export function zoneHommeStep(st, K, cfg) {
  const B = st._zhB; st._zh = null;
  if (!B || !B.spots || st.restart || !(st.possession?.team >= 0) || B.team === st.possession.team) return;   // les zones de la dernière assignation des métiers (pas à chaque image)
  const def = B.team, atk = 1 - def, T = st.tactics?.[def], car = st.possession.carrier;
  const Z = st._zhZ ??= new Map(), dt = st._zhT != null ? Math.max(0, Math.min(0.1, st.t - st._zhT)) : 0; st._zhT = st.t;
  for (const p of st.players) { if (p.team !== def || p.keeper) continue; const r = B.spots[B.mapD[p.post ?? 0]]; if (!r) continue; let z = Z.get(p.id);
    if (!z || z.team !== def) { Z.set(p.id, { x: r[0], z: r[1], team: def }); continue; }
    let dx = (r[0] - z.x) * (1 - Math.exp(-dt / (K.tauZone ?? 0.8))), dz = (r[1] - z.z) * (1 - Math.exp(-dt / (K.tauZone ?? 0.8))); const m = hyp(dx, dz), mx = (K.vZone ?? 5) * (p.skill?.workF ?? 1) * dt;
    if (m > mx) { dx *= mx / m; dz *= mx / m; } z.x += dx; z.z += dz; }
  const zone = (p) => { const z = Z.get(p.id); return [z.x, z.z]; };
  const D = st.players.filter((p) => p.team === def && !p.keeper && !p.expulse && !p._sub && p.down <= 0 && LIBRES.has(p.job) && Z.has(p.id));
  const A = st.players.filter((q) => q.team === atk && !q.keeper && !q.expulse && !q._sub && q.id !== car);
  const R = ax(T?.marquage, K.rZone ?? 12, K.rHomme ?? 22), prev = st._zhPrev ?? new Map(), paires = [];
  for (const p of D) { const s = zone(p);
    for (const q of A) { const dz = hyp(q.p[0] - s[0], q.p[2] - s[1]); if (dz > R) continue; const d = dz * (1 - (K.corps ?? 0)) + hyp(q.p[0] - p.p[0], q.p[2] - p.p[2]) * (K.corps ?? 0);   // (381) le coût : la zone, et la part `corps` de la distance au corps (qui peut y être)
      paires.push({ p, q, c: d * (2 - (p.skill?.markF ?? 1)) * (2 - (p.skill?.posF ?? 1)) * (prev.get(p.id) === q.id ? K.tenue ?? 0.7 : 1) }); } }
  paires.sort((a, b) => a.c - b.c);
  const pris = new Set(), fait = new Set(), out = new Map(), nPrev = new Map(), b = st.ball.p, g = st.pitch.ownGoal(def);
  const w = ax(T?.marquage, K.wZone ?? 0.75, 1), lai = ax(T?.marquage, K.lZone ?? 8, K.lHomme ?? 18);
  for (const { p, q } of paires) { if (fait.has(p.id) || pris.has(q.id)) continue; fait.add(p.id); pris.add(q.id); nPrev.set(p.id, q.id);
    const s = zone(p), M = marquageDe(cfg.marquageElastique ?? {}, cfg.marquageConsigne, T, p);
    const dE = Math.max(K.plancher ?? 0.8, distanceElastique(hyp(q.p[0] - b[0], q.p[2] - b[2]), M.K) * M.f);
    const gx = g.x - q.p[0], gz = -q.p[2], gl = hyp(gx, gz) || 1;
    let tx = s[0] + (q.p[0] + (gx / gl) * dE - s[0]) * w, tz = s[1] + (q.p[2] + (gz / gl) * dE - s[1]) * w;
    const dl = hyp(tx - s[0], tz - s[1]); if (dl > lai) { tx = s[0] + (tx - s[0]) * lai / dl; tz = s[1] + (tz - s[1]) * lai / dl; }
    out.set(p.id, [tx, tz]); }
  st._zhPrev = nPrev; st._zh = out;
}

/** Dans la boucle de mouvement : le défenseur affecté prend la cible de sa zone-homme. */
export function zoneHommeCorps(st, p) {
  const c = st._zh?.get(p.id); if (!c || !LIBRES.has(p.job)) return;
  p.target = [c[0], p.target?.[1] ?? 0, c[1]];
}

/** (381) L'ALLURE DE LA PRISE : mesuré, la moitié du temps le défenseur affecté était à plus de 8 m de sa cible (16,5 m en moyenne), au trot
 *  (3,3 m/s, effort 0,52) — l'économie de course gouvernait. Le défenseur qui a un homme et en est à plus de `rejoint` m y court à l'allure
 *  de son RÔLE (vGarde … vPointe : la garde court, la pointe trottine) × workRate. Renvoie { v, eps } ou null. */
export function zoneHommeAllure(st, p, K, OR) {
  const c = st._zh?.get(p.id); if (!c || !LIBRES.has(p.job)) return null;
  if (hyp(c[0] - p.p[0], c[1] - p.p[2]) < (K.rejoint ?? 4)) return null;
  const r = Math.max(0, Math.min(1, profondeurRole(st, p, OR ?? {}) / 0.8));
  return { v: ax(r, K.vGarde ?? 6, K.vPointe ?? 4) * (p.skill?.workF ?? 1), eps: ax(r, K.epsGarde ?? 0.95, K.epsPointe ?? 0.65) };
}
