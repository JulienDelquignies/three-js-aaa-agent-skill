// LA NATURE DES GESTES (269, cfg.nature && st.full — Modèle 11 lot 2, Bible 14 lot 2 (T15bis), Bible 15 lot 2 (D20, D21)).
// Hier tout le monde dribblait (le meilleur / le médian 2,0 ; réel ≥ 5 — Doku 162 tentatives sur une saison) parce que
// le moteur modulait le TAUX de réussite et non la FRÉQUENCE de tentative ; et le tacle glissé était l'action ordinaire
// (18 / match, réel 6,7) avec 6 % de fautes (réel 24). LA LOI : (1) LE SPÉCIALISTE — la tentative de geste de dribble
// se multiplie par exp(k · (le flair centré + a_A)) ÷ sinh(k)/k (l'ESPÉRANCE à 1 sur le flair uniforme : le volume se
// redistribue, il ne gonfle pas) : le joueur à flair 1 tente e^k = 5 × plus que le médian, celui à 0,15 5 × moins, l'attribut composite du dribbleur (a_A du 268)
// s'y ajoute ; (2) LE GLISSÉ DE DERNIER RECOURS — le book (§4.2) : le glissé est un geste DOMINÉ (il ne récupère pas mieux,
// il dégage et il fait faute), on ne s'y couche que BATTU (sur porteur : le ballon n'est plus prenable debout, il fuit — balPrenable faux ;
// sur ballon libre : la course perdue, jugée par trySlide) et à un taux IMPOSÉ (p par occasion × aggrF × la consigne duel —
// le refus coûte un cooldown personnel refusCd — consommer l'espacement d'équipe éteignait tout, 0,5 glissé / match) ; (3) LA FAUTE DU GLISSÉ — le glissé manqué à
// portée du corps est une faute avec pFaute (recuit pour P(faute | glissé) 0,239 du book), sa nature 'tacle-glissé'
// (l'arbitre juge la nature et le carton, 257). Clé absente : les gestes et le glissé d'hier au bit. Ce que le lot
// nomme : le tacle debout par le noyau (§4.2 colonne debout), le glissé comme segment balayé (§4.1), le trou défensif
// post-glissé mesuré (§4.4), bravery et decisions (le moteur n'a pas ces notes), la tromperie (lot 3).
import { hyp } from './hyp.js';
import { tirage } from './rng.js';
import { role } from './roles.js';
import { aAttaquant } from './noyau.js';
import { balPrenable } from './dribble.js';

/** Le facteur de tentative du spécialiste : exp(k · (flair centré + a_A)) ÷ sinh(k)/k (l'espérance à 1 sur le flair uniforme), borné. Pure. */
export function specialisteF(c, K) {
  const fl = ((c.persona?.flair ?? 0.575) - 0.575) / 0.425, k = K.k ?? 1.6;
  return Math.max(K.min ?? 0.1, Math.min(K.max ?? 6, Math.exp(k * (fl + aAttaquant(c))) * k / Math.sinh(k)));   // ÷ E[e^{k·u}] sur u uniforme : l'espérance à 1 — la loi REDISTRIBUE le volume, elle ne le gonfle pas (mesuré sans : 28-39 → 53-57 gestes / match)
}

/** Le glissé est-il permis à foe sur le ballon ? Battu (le ballon fuit debout — sauf ballon libre : la course perdue est jugée en amont) et le taux imposé. Pure hors tirage. */
export function glissePermis(st, foe, K, cfg, libre = false) {
  if (!libre && K.battu !== false && balPrenable(st.ball, foe.p[0], foe.p[2], K.prise ?? 0.55, K.fuite ?? 0.5)) return false;   // prenable debout : on reste debout (sur ballon LIBRE, trySlide a déjà jugé la course perdue)
  const p = (K.p ?? 0.35) * (foe.skill?.aggrF ?? 1) * ((role(foe).duel ?? 0.5) !== 0.5 ? 0.6 + 0.8 * role(foe).duel : 1);
  return tirage(st, 'duel', foe.id, st.rnd ?? (() => 0.5))() < p;
}

/** La faute du glissé manqué (le corps à portée) : pose st._faute si le tirage tombe sous pFaute. Rend true si faute. */
export function fauteGlisse(st, foe, c, K, cfg, chuter) {
  if (!c || !cfg.loi12 || st._faute || foe.down > 0 && false) return false;
  const d = hyp(c.p[0] - foe.p[0], c.p[2] - foe.p[2]);
  if (d > (K.portee ?? 1.8)) return false;
  if (tirage(st, 'duel', foe.id, st.rnd ?? (() => 0.5))() >= (K.pFaute ?? 0.4)) return false;
  const vSpd = hyp(c.v[0], c.v[1]), grave = vSpd > 1.5 && ((c.p[0] - foe.p[0]) * c.v[0] + (c.p[2] - foe.p[2]) * c.v[1]) / (d * vSpd || 1) > 0.55;
  st._faute = { t: st.t, par: foe.id, sur: c.id, team: c.team, p: [c.p[0], c.p[2]], grave, kind: grave ? 'tacle-glissé-derrière' : 'tacle-glissé', vSur: vSpd, dir: [c.v[0], c.v[1]] };
  st.events.push({ t: +st.t.toFixed(2), type: 'faute', by: foe.id, sur: c.id, kind: grave ? 'tacle-glissé-derrière' : 'tacle-glissé', nature: true, p: [+c.p[0].toFixed(1), +c.p[2].toFixed(1)] });
  chuter(st, c, foe, cfg, 'tacle-glissé', null);
  if (st.ball.owner === c.id) st.ball.release('perte');
  st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
  return true;
}
