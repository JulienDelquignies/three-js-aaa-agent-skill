// premiere-intention.js — JOUER LE BALLON SANS LE POSSÉDER : la famille de la première
// intention. La remise de tête et la volée vivent dans tete.js (le répertoire aérien) ; ICI
// vit la passe en UNE TOUCHE au sol (lot 44) — extraite de rondo-sim au bit près quand la
// volumétrie a touché son plafond (1250), et étendue au CALME par l'axe de style (lot 49).
//
// La une-touche a deux portes, une seule mécanique :
//   — SOUS PRESSION (lot 44) : un presseur dans les jambes FORCE la première intention —
//     c'est un réflexe de survie, ouvert à toutes les équipes.
//   — AU CALME PAR STYLE (lot 49, UT.calme × l'axe tactics.style) : le tiki-taka joue en
//     première intention par CHOIX — la porte s'ouvre sans presseur, proportionnelle à
//     (0,5 − style) × 2 : possession (style 0,1) → 80 % de la clé, direct (style ≥ 0,5) →
//     JAMAIS. À style 0,5 (le défaut) pCalme = 0 et AUCUN tirage n'est consommé : l'identité
//     au défaut, au bit près (le court-circuit est la preuve).
// Le vrai geste garde ses conditions : ballon jouable (≤ vmax, au sol), une ligne courte et
// OUVERTE (couloir), et le déchet MAJORÉ — ×1,6 pressé (le geste le plus dur du football),
// ×1,3 au calme (choisi, préparé — mais toujours une première intention). Tirage seedé, la
// note de contrôle module. Refusée ou pas d'option : le contrôle normal reprend, rien n'est
// dû. Dette nommée : la photo Loi 11 (comme la remise de tête).
// false : le monde à deux touches d'hier (sabotage nommé) ; calme:0 : le réflexe seul.

import { laneClearance } from './ball-predict.js';
import { gauss } from './attributes.js';
import { tac } from './tactics.js';

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** La passe en une touche du receveur `p` — true si le ballon est REPARTI (le patron de la
 *  remise de tête : sans possession) ; false : le contrôle normal reprend. */
export function uneTouche(st, p, cfg) {
  const UT = st.full && !p.keeper && st.pass && st.pass.to === p.id ? cfg.uneTouche : null;
  if (!UT) return false;
  const arrU = Math.hypot(st.ball.v[0], st.ball.v[2]);
  const foeU = st.players.filter((q) => q.team !== p.team && q.down <= 0)
    .reduce((b, q) => (!b || d2(q.p, p.p) < d2(b.p, p.p) ? q : b), null);
  const pressOk = foeU && d2(foeU.p, p.p) < (UT.press ?? 2.6);
  const pCalme = (UT.calme ?? 0.5) * Math.max(0, 1 - 2 * (tac(st, p.team).style ?? 0.5));
  if ((pressOk || (pCalme > 0 && (st.rnd ? st.rnd() : 0.5) < pCalme)) && arrU <= (UT.vmax ?? 9.5)
    && st.ball.p[1] < 0.5
    && (st.rnd ? st.rnd() : 0.5) < (UT.p ?? 0.65) * Math.min(1.2, p.skill?.controlF ?? 1)) {
    const blockers = st.players.filter((q) => q.team !== p.team && !q.keeper && q.down <= 0).map((q) => q.p);
    const mate = st.players
      .filter((m) => m.team === p.team && m.id !== p.id && !m.keeper && m.down <= 0)
      .map((m) => ({ m, d: d2(m.p, p.p) }))
      .filter((x) => x.d > 3 && x.d < (UT.portee ?? 14))
      .map((x) => ({ ...x, marge: laneClearance([p.p[0], 0, p.p[2]], [x.m.p[0], 0, x.m.p[2]], blockers).margin ?? 0 }))
      .filter((x) => x.marge >= (UT.couloir ?? 0.5))
      .sort((a, b) => b.marge - a.marge)[0];
    if (mate) {
      st.passes++; st.best = Math.max(st.best, st.passes);
      st.events.push({ t: +st.t.toFixed(2), type: 'receive', by: p.id, count: st.passes });
      st.lastTouch = p.team;
      const sigU = (p.skill?.passSigma ?? cfg.execSigma ?? 0.044) * (pressOk ? 1.6 : 1.3);
      const yawU = Math.atan2(mate.m.p[2] - p.p[2], mate.m.p[0] - p.p[0]) + gauss(st.rnd ?? (() => 0.5)) * sigU;
      // …ET LE RENVOI S'AMORTIT (lot 51 — « des contrôles pas beaux ») : une première intention
      // DÉVIE le flux, elle ne le renverse pas pleine vitesse (mesuré : un vol de 7 m/s renvoyé
      // à ~180° instantanément — physiquement absurde, visuellement du ping-pong). La vitesse
      // sortante se borne à l'angle de déviation : dans le flux → pleine (12), perpendiculaire
      // → 8, à contre-courant → 4 (le LAYOFF du vrai football : la remise en retrait est douce).
      const bvl = Math.hypot(st.ball.v[0], st.ball.v[2]) || 1;
      const cosDev = ((mate.m.p[0] - p.p[0]) * st.ball.v[0] + (mate.m.p[2] - p.p[2]) * st.ball.v[2]) / (mate.d * bvl);
      const spdU = Math.min(Math.min(12, Math.max(6, mate.d * 0.85)), 4 + 8 * (0.5 + 0.5 * cosDev));
      st.ball.strike({ speed: spdU, dirYaw: yawU, elevation: 0.03, spinAxis: [0, 1, 0], spinRev: 0 });
      // LA PERCEPTION A UNE HORLOGE (le contrat de strikeNow, complété lot 50) : une première
      // intention n'a PAS d'armé — seen 0, TOUT LE MONDE paie sa réaction pleine. Mesuré avant :
      // 0/39 fenêtres posées — la passe la moins lisible du football était la seule que la
      // défense lisait instantanément (armée : 135/135, l'armé vu remboursait les regardeurs).
      st._surprise = { t: st.t, seen: 0, n: (st._surprise?.n ?? 0) + 1 };
      st.pass = { from: p.id, to: mate.m.id, lead: [mate.m.p[0], 0, mate.m.p[2]], style: 'une-touche', t: st.t, flight: mate.d / (spdU * 0.97), origin: [p.p[0], p.p[2]] };
      st.phase = 'flight'; st.possession.carrier = -1; st.hold = 0;
      st.events.push({ t: +st.t.toFixed(2), type: 'pass', style: 'une-touche', by: p.id, to: mate.m.id, d: +mate.d.toFixed(1), ...(pressOk ? {} : { calme: true }) });
      return true;
    }
  }
  return false;
}
