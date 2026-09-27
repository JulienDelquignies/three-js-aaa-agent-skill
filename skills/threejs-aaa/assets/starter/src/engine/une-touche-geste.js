// une-touche-geste.js — LE GESTE DE LA PASSE EN UNE TOUCHE SELON L'ORIENTATION (cfg.uneToucheGeste && st.full — demande du 27/09 : « ajoute
// tous les gestes de passes en une touche nécessaires, pour chaque orientation »). Mesuré avant : la une-touche (premiere-intention.js)
// émettait 'receive' + 'pass' sans geste — la scène dessinait un CONTRÔLE (le clip de réception) pendant que le ballon repartait à
// 6-12 m/s ; la déviation n'existait que pour la passe ARMÉE. Le vrai football a un geste par géométrie :
//   rendu d'où il vient (déviation > retour °)                    → la REMISE (plat du pied bloqué, sans armé) — la TALONNADE s'il
//                                                                   repart dans son dos (le ballon venait de derrière) ;
//   dans sa ligne (déviation < ligne °)                          → la PROLONGATION (la pichenette qui laisse filer), même derrière lui ;
//   derrière le corps (sortie à > derriere ° du regard)          → la TALONNADE (le talon, bassin carré) ;
//   de côté, du côté où l'intérieur l'envoie (pied droit → gauche) → la DÉVIATION OUVERTE (l'intérieur, le bassin s'ouvre) ;
//   de côté, du côté du pied qui joue                             → l'EXTÉRIEUR (le pied se retourne, la jambe ne croise pas) ;
//   sinon la déviation — PROTÉGÉE (adversaire à ≤ protege m) ou EN COURSE (≥ course m/s).
// Le pied : celui du côté du ballon (le plus proche), le pied fort s'il arrive dans l'axe. Pure : rend { geste, foot, surface, dev, sortie }.
import { hyp } from './hyp.js';

const DEG = 180 / Math.PI, wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export function gesteUneTouche(st, p, bvIn, cible, cfg) {
  const K = st.full && cfg.uneToucheGeste; if (!K) return null;
  const b = st.ball.p, ex = cible[0] - p.p[0], ez = cible[1] - p.p[2], el = hyp(ex, ez) || 1, vl = hyp(bvIn[0], bvIn[2]);
  const sortie = wrap(Math.atan2(ez, ex) - p.yaw) * DEG;                                   // > 0 : à gauche du regard (convention de la scène : lat > 0 = gauche)
  const dev = vl > 0.3 ? Math.acos(Math.max(-1, Math.min(1, (ex * bvIn[0] + ez * bvIn[2]) / (el * vl)))) * DEG : 90;
  const lat = (b[0] - p.p[0]) * Math.sin(p.yaw) - (b[2] - p.p[2]) * Math.cos(p.yaw);      // > 0 : le ballon à gauche
  const fort = p.strongFoot === 'left' ? 'left' : 'right';
  let foot = Math.abs(lat) < (K.axe ?? 0.08) ? fort : lat > 0 ? 'left' : 'right';
  let adv = 99; for (const q of st.players) if (q.team !== p.team && q.down <= 0 && !q.keeper) adv = Math.min(adv, hyp(q.p[0] - p.p[0], q.p[2] - p.p[2]));
  const v = hyp(p.v[0], p.v[1]);
  let geste, surface = 'inside';
  const derriere = Math.abs(sortie) > (K.derriere ?? 120), talon = () => { geste = 'talonnade'; surface = 'heel'; foot = sortie > 0 ? 'left' : 'right'; };
  // l'ORDRE compte (mesuré : 43 % de talonnades — des ballons venus de face qui CONTINUAIENT leur ligne dans son dos : il les laisse filer
  // d'une pichenette, corps ouvert, il ne les talonne pas) : le rendu d'abord (talon s'il repart derrière : le ballon venait de son dos),
  // la ligne ensuite (prolongation, même derrière), puis le vrai derrière, puis le côté.
  if (dev > (K.retour ?? 140)) { if (derriere) talon(); else geste = 'deviation_remise'; }
  else if (dev < (K.ligne ?? 35) || (derriere && dev < (K.prolongeDos ?? 80))) { geste = 'deviation_prolonge'; surface = 'outside'; }   // dans son dos sans casser la ligne : il ouvre le corps et prolonge (mesuré : 24 % de talonnades sinon)
  else if (derriere) talon();
  else if (Math.abs(sortie) >= 50) {
    const cotePied = sortie > 0 ? 'left' : 'right';                                           // l'EXTÉRIEUR envoie du côté du pied qui joue
    if (cotePied === foot) { geste = 'deviation_exterieur'; surface = 'outside'; }
    else geste = 'deviation_ouverte';
  } else geste = adv <= (K.protege ?? 1.5) ? 'deviation_protegee' : v >= (K.course ?? 3) ? 'deviation_course' : 'deviation';
  return { geste, foot, surface, dev: Math.round(dev), sortie: Math.round(sortie) };
}
