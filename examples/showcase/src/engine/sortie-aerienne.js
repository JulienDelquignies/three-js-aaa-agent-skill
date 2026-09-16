// sortie-aerienne — LA SORTIE AÉRIENNE DU GARDIEN (lot B10 = doc Branchements § 10, cfg.sortieAerienne ; absente : hier au bit).
//
// Mesuré avant (12 matchs × 300 s) : 1 prise aérienne, 7 ballons hauts passés à moins de 2 m du gardien — il ne VENAIT pas au-devant
// des centres : keeperSpot le tient sur sa bissectrice, keeperDecide ne lit que le vol qui coupe le plan du but (le tir), et la prise
// à deux mains (receive → 'prise-gardien') attend un ballon sous 1,9 m à portée de bras. Le centre qui retombe dans la surface de but
// se jouait à la tête de l'attaquant ou se ramassait au rebond.
//
// LA LOI : le vol est déterministe (predictPath, comme la tête armée B3). Sur un ballon LIBRE qui monte ou qui est haut, le gardien
// cherche le premier point où le vol REDESCEND entre `bas` et `haut` m dans SA zone (à ≤ `zone` m de sa ligne, |z| ≤ goalHalf + `large`)
// et qu'il atteint avant le ballon (réaction + distance à la vitesse de sortie, marge) sans qu'un attaquant y soit avant lui (le duel :
// personne à moins de `duel` m/s × le temps du vol). Il y COURT (job keeper, la cible au point) ; quand le ballon arrive dans le temps de
// contact du clip et que le point est à portée de détente, il ARME `plongeonPrise` (le saut à deux mains, généré A6 — payload.aerienne)
// et le contact du plongeon (match-sim onDive, chaque image de la détente) résout la prise — avec la portée du saut en plus (`saut`),
// ou la claquette (le poing) si le ballon est un missile. Le tir cadré reste au réflexe de keeperDecide : la sortie ne concerne que
// le ballon qui retombe dans la zone.
import { predictPath } from './ball-predict.js';
import { startGesture } from './gesture.js';
import { MOVES } from './animkit.js';
import { shotCross } from './keeper.js';
const hyp = Math.hypot;

/** Chaque image du gardien (match-sim, avant keeperDecide) : true = la sortie possède le gardien cette image (cible posée ou détente en cours). */
export function sortieAerienne(st, gk, cfg, pitch) {
  const SA = cfg.sortieAerienne; if (!(st.full && SA) || gk.down > 0) return false;
  if (gk.act) return !!gk.act.payload?.aerienne;                                    // la détente en cours : la boucle gardien la laisse vivre
  const b = st.ball, v = b.v;
  if (b.owner != null || st.restart) { gk._sortieAerienne = null; return false; }
  const own = pitch.ownGoal(gk.team), sg = Math.sign(own.x || 1);
  if (hyp(b.p[0] - own.x, b.p[2]) > (SA.portee ?? 40) || (b.p[1] < 0.5 && v[1] < 1.5)) { gk._sortieAerienne = null; return false; }   // ni haut ni montant
  const cross = shotCross(pitch, gk.team, b.p, v), sp = hyp(v[0], v[2]);
  if (cross && sp >= 6 && cross.t < 0.9 && Math.abs(cross.z) <= pitch.goalHalf + 0.6 && cross.y <= pitch.goalH + 0.4) { gk._sortieAerienne = null; return false; }   // un tir cadré IMMINENT : le réflexe (keeperDecide) ; le lob qui retombe avant la ligne se va chercher
  const path = predictPath(b, { dt: 1 / 30, maxT: SA.horizon ?? 3 });
  let best = null;
  for (const s of path) {
    const y = s.p[1]; if (s.t < 0.1 || s.v[1] > 0 || y < (SA.bas ?? 1.6) || y > (SA.haut ?? 2.3)) continue;   // le ballon qui REDESCEND, à hauteur de prise sautée
    if ((s.p[0] - own.x) * sg > 0 || Math.abs(s.p[0] - own.x) > (SA.zone ?? 5.5) || Math.abs(s.p[2]) > pitch.goalHalf + (SA.large ?? 2.5)) continue;
    const dK = hyp(s.p[0] - gk.p[0], s.p[2] - gk.p[2]), dR = Math.max(0, dK - (SA.detente ?? 1.0)), a = SA.accel ?? 2.6, vM = SA.vitesse ?? 5.5;   // le temps de course : l'accélération du pas (mesurée 2,6 m/s² depuis l'arrêt) puis la pointe
    const tK = (SA.reaction ?? 0.2) + (dR < vM * vM / (2 * a) ? Math.sqrt(2 * dR / a) : vM / (2 * a) + dR / vM);
    let tA = Infinity;                                                                  // le premier attaquant à CE point (à `duel` m/s)
    for (const q of st.players) { if (q.team === gk.team || q.down > 0 || q.expulse || q._sub) continue; tA = Math.min(tA, hyp(s.p[0] - q.p[0], s.p[2] - q.p[2]) / (SA.duel ?? 7) + 0.1); }
    if (tA < s.t - 0.05 && tA < tK + (gk._sortieAerienne ? -0.3 : 0.1)) break;         // un attaquant y sera avant le ballon ET avant lui : le ciel se joue à la tête (tete.js), et au-delà le vol prédit est une fiction — la sortie DÉCIDÉE tient (on ne lâche que s'il est nettement premier : la décision n'hésite pas image par image)
    if (tK > s.t - (SA.marge ?? 0.1)) continue;                                          // il n'y serait pas avant le ballon : le point suivant, plus bas, plus près
    best = { p: s.p, t: s.t, dK, poing: tA < s.t + (SA.poing ?? 0.3) }; break;          // (C3) l'attaquant arrive AVEC le ballon (après lui) : on sort du POING, pas des deux mains
  }
  if (!best) { gk._sortieAerienne = null; return false; }
  if (st.t - (gk._sortieLog ?? -9) > 2) { gk._sortieLog = st.t; st.events.push({ t: +st.t.toFixed(2), type: 'sortie-aerienne', by: gk.id, h: +best.p[1].toFixed(2), dans: +best.t.toFixed(2), d: +best.dK.toFixed(2) }); }   // la décision se nomme une fois par vol
  gk._sortieAerienne = { p: best.p, at: st.t + best.t };
  gk.job = 'keeper'; gk.target = [best.p[0], 0, best.p[2]]; gk._walkF = null;
  gk.yawWant = Math.atan2(b.p[2] - gk.p[2], b.p[0] - gk.p[0]);
  const id = best.poing && MOVES.sortiePoing ? 'sortiePoing' : 'plongeonPrise', mv = MOVES[id];   // (C3) le poing quand l'attaquant arrive avec le ballon (le clip généré sortiePoing, motion-keeper)
  if (best.p[1] >= (SA.sautDes ?? 1.9) && best.t <= mv.contact + 0.05 && best.dK <= (SA.detente ?? 1.0) + 0.2) {   // au-dessus de la prise debout (receive → 'prise-gardien' sous 1,9 m) : le ballon arrive dans le temps de contact du clip, le point à portée de détente
    const L = best.dK || 1, ux = (best.p[0] - gk.p[0]) / L, uz = (best.p[2] - gk.p[2]) / L;
    const fxK = Math.cos(gk.yaw), fzK = Math.sin(gk.yaw), sideFoot = (fxK * uz - fzK * ux) > 0 ? 'left' : 'right';   // le côté du clip au regard réel (comme le plongeon)
    startGesture(gk, { id, duration: mv.duration, contact: mv.contact }, {
      payload: { kind: 'skill', skill: 'plongeon', ownsBody: true, pick: { foot: sideFoot }, lunge: [ux, uz], speed: Math.min(4, best.dK / Math.max(0.15, best.t)),
        cross: { x: best.p[0], z: best.p[2], y: best.p[1], t: best.t }, lungeMax: Math.min(0.72, best.dK + 0.1), aerienne: true, poing: id === 'sortiePoing' },
      log: st.gestures,
    });
    st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: gk.id, move: id, foot: sideFoot, skill: 'plongeon', anticipation: mv.contact, mains: 2, sortie: true, poing: id === 'sortiePoing', h: +best.p[1].toFixed(2), dans: +best.t.toFixed(2) });
  }
  return true;
}
