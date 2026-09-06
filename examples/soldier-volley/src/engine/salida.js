// LA SALIDA LAVOLPIANA ET LA CONDUCCIÓN (239, doctrine 1.1-1.2 — Guardiola, Xavi, Dall'Oglio : « le 6 s'intercale
// entre les centraux dès la première passe » ; « le central libre porte le ballon en appât, pour faire sortir un
// adversaire, puis donne à celui que la sortie a libéré »). Mesuré avant (film-relance, 6 × 300 s) : en relance basse
// le pivot vivait à 9,5 m DEVANT les centraux, sous pression (≥ 3 adversaires à < 25 m, 75 % des images) comme sans ;
// un central libre conduisait 5,5 m p50 (réel 6-12) et donnait toujours avant le cadrage.
import { LIGNES, mapPostes, formationPour, pivotDe } from './formation.js';

// 244b (cfg.postesNommes) : le pivot est le 6 DE LA GRILLE (DM(C), sinon M(C)) — hier ids[nD], le premier milieu, soit l'intérieur gauche en 4-3-3
const ligneArriere = (st, team, tac, cfg) => { const f = tac(st, team).formation, ids = mapPostes(f), nD = (LIGNES[formationPour(f, true)] ?? [4, 3, 3])[0], kP = cfg?.postesNommes ? pivotDe(formationPour(f, true)) : nD; return { ids, nD, cbs: ids.slice(1, nD - 1), pivot: kP == null ? null : ids[kP] }; };

// (1) LA SALIDA (cfg.salida && st.full) : ballon au central ou au gardien à < zone m du but propre, ≥ pression adversaires
// à < portee m du ballon → le spot du PIVOT descend ENTRE les centraux (x = leur ligne + prof, z 0) — le +1 de la relance.
// Le spot est muté pour l'image (le buffer se recalcule à chaque image ; seul le support du pivot le lit). La tactique
// sortieBut 'long' s'en passe (comme sortieBalle). Absente : le pivot à 22 m d'hier au bit.
export function salidaStep(st, cfg, { atk, spots, carrier, pitch, tac }) {
  const S = cfg.salida; st._salida = null; if (!S || !spots || !carrier) return null;
  if (st.tactics?.[atk]?.cpa?.sortieBut === 'long') return null;
  const og = pitch.ownGoal(atk), sg = -Math.sign(og.x || 1);
  if (Math.abs(carrier.p[0] - og.x) >= (S.zone ?? 30)) return null;
  const { cbs, pivot } = ligneArriere(st, atk, tac, cfg);
  if (!carrier.keeper && !cbs.includes(carrier.post)) return null;
  let n = 0; for (const q of st.players) if (q.team !== atk && !q.keeper && q.down <= 0 && Math.hypot(q.p[0] - st.ball.p[0], q.p[2] - st.ball.p[2]) < (S.portee ?? 25)) n++;
  if (n < (S.pression ?? 3)) return null;
  let sx = 0, k = 0; for (const q of st.players) if (q.team === atk && cbs.includes(q.post) && q.down <= 0) { sx += q.p[0]; k++; }
  if (!k || pivot == null || !spots[pivot]) return null;
  spots[pivot] = [sx / k + sg * (S.prof ?? -1), 0];
  st._salida = { t: st.t, pivot, n };
  return st._salida;
}

// (2) LA CONDUCCIÓN (cfg.conduc && st.full) : le CENTRAL porteur, dans sa moitié, LIBRE (aucun adversaire à < libre m),
// conduit DROIT DEVANT (cap à pas m) tant que la portée depuis la prise reste sous max × axe(style : jeu court 1,3 /
// long 0,7) × visionF × arbitre.conduite du rôle ; st._conduc.tient allonge la tenue (rondo-sim, × tenue) — l'appât : on ne
// donne pas tant que personne ne sort. Cadré (adversaire à < engage) ou au plafond : le cap d'hier, la passe part
// vers celui que la sortie a libéré (l'arbitre de passe lit déjà le receveur libre). Absente : l'hier au bit.
export function conduccion(st, cfg, { p, atk, foeGuard, sg, tac, axe, role }) {
  const C = cfg.conduc; if (!C) { st._conduc = null; return null; }
  const { cbs } = ligneArriere(st, atk, tac);
  if (!cbs.includes(p.post) || p.p[0] * sg >= 0) { st._conduc = null; return null; }
  if (!st._conduc || st._conduc.id !== p.id) st._conduc = { id: p.id, x0: p.p[0], z0: p.p[2], tient: false };
  const K = st._conduc, port = Math.hypot(p.p[0] - K.x0, p.p[2] - K.z0);
  const max = (C.max ?? 12) * axe(tac(st, atk).style ?? 0.5, C.styleCourt ?? 1.3, C.styleLong ?? 0.7) * (p.skill?.visionF ?? 1) * (role(p).arbitre?.conduite ?? 1);
  K.tient = foeGuard > (C.libre ?? 5) && port < max;
  if (!K.tient) return null;
  return [p.p[0] + sg * (C.pas ?? 6), p.p[2]];
}
