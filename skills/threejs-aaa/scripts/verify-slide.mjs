#!/usr/bin/env node
// verify-slide.mjs — LE TACLE GLISSÉ EST UN PARI, ET LE PRIX EST LE SOL.
//
// Lot 33 : le glissé SUR PORTEUR (le glissé sur ballon libre existait — « un ballon qui
// traîne »). Le dernier recours : un poursuivant lancé (≥ speed) sur un porteur LANCÉ
// (≥ carrySpeed — une construction lente se défend debout : sans cette porte, 20,8
// glissés/match, la fête du tacle) se couche pour le ballon. La géométrie de la table
// technique juge, PUIS le jet (accuracy 0,6 ± tackling — sans lui, 83/83 pris : glisser
// était strictement optimal). Issues : PRIS (dégagé fort, tacleur au sol — le coût EST la
// décision), FAUTE (jambes trouvées : la victime tombe ; par DERRIÈRE c'est GRAVE — la
// récidive compte DOUBLE, le jaune vient vite), ou le VIDE. Équilibre livré (6 × 180 s) :
// 1,8 glissé/match, 0,7 faute-tot/match (bande réelle), 3,0 tirs, 1,2 but.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { simInternals } from '../assets/starter/src/engine/rondo-sim.js';
import { adjugeFaute } from '../assets/starter/src/engine/referee.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const { slideTackleStep } = simInternals;

// la fixture : porteur LANCÉ, chasseur écrit à la main, horloges et espacements purgés
const chase = (seed, arrange) => {
  const st = makeMatch({ full: true, seed });
  const cfg = matchCfg({ shotRange: 20 });
  for (let i = 0; i < 30 * 60 && !(st.phase === 'carry' && st.possession.carrier >= 0 && !st.restart); i++) matchStep(st, 1 / 60, cfg);
  const c = st.players[st.possession.carrier];
  const foe = st.players.find((q) => q.team !== c.team && !q.keeper);
  foe.act = null; foe.down = 0; foe.slideCd = 0; st._slideT = {};
  c.v = [5, 0];
  arrange(st, c, foe);
  return { st, cfg, c, foe };
};
const bp = (st) => st.ball.p;

// ---------- 1. le PRIS : géométrie valide + jet réussi → le pari part, le CONTACT prend
// (lot 51 : la déviation se résolvait à l'instant du déclenchement, tacleur encore à
// 1,3-2,6 m — le ballon s'inversait « tout seul » à côté d'un corps qui commençait à peine
// à glisser. Désormais : lancement → glisse du corps (movement.js) → contact re-jugé dans
// la fenêtre. La fixture est FRONTALE : le tacleur coupe la route du ballon.)
{
  const { st, cfg, c, foe } = chase(3, (st, c, foe) => {
    foe.p[0] = bp(st)[0] + 1.6; foe.p[2] = bp(st)[2]; foe.v = [-5.5, 0]; foe.yaw = Math.PI;
  });
  st.rnd = () => 0.3;
  slideTackleStep(st, c, cfg);
  ok(`le PARI part au lancement (corps au sol down ${foe.down.toFixed(2)} s > 0, contact armé ${!!foe._slide} — pas encore d'événement : le ballon se joue quand le pied ARRIVE)`,
    foe.down > 0 && !!foe._slide && !st.events.some((e) => e.type === 'slide'));
  for (let i = 0; i < 0.8 * 60 && !st.events.some((e) => e.type === 'slide'); i++) matchStep(st, 1 / 60, cfg);
  const ev = st.events.find((e) => e.type === 'slide');
  ok(`…et le ballon est PRIS AU CONTACT ('slide' won=${ev?.won} sur nº${ev?.sur} à ${ev?.dist} m ≤ 1 — le monde peut déjà avoir re-pris le ballon libéré : la phase instantanée n'est pas la clause)`,
    ev?.type === 'slide' && ev.won === true && ev.sur === c.id && ev.dist <= 1.0);
}

// ---------- 2. la FAUTE : le ballon protégé, les jambes trouvées — et DERRIÈRE c'est GRAVE
{
  const { st, cfg, c, foe } = chase(3, (st, c, foe) => {
    foe.p[0] = c.p[0] - 0.8; foe.p[2] = c.p[2] + 0.3;              // au CORPS, dans le dos du porteur
    foe.v = [5.5, 0]; foe.yaw = Math.PI;                           // …et sa glissade regarde AILLEURS : la table refuse
  });
  st.rnd = () => 0.1;   // (219b) SOUS le taux d'imprudence (slideTackle.imprudence 0,2 depuis le 191 — à 0,3 le pro RETIENT ce tacle : la fixture de 33 jugeait le monde d'avant la clé)
  slideTackleStep(st, c, cfg);
  const fa = st.events.find((e) => e.type === 'faute' && e.kind?.startsWith('tacle-glissé'));
  ok(`les JAMBES avant le ballon : FAUTE ${fa?.kind} (victime couchée down=${c.down.toFixed(2)} ≈ 0,7, monde en loose, st._faute grave=${st._faute?.grave})`,
    !!fa && c.down > 0.5 && st.phase === 'loose' && st._faute?.grave === true);
  // …et l'IMPRUDENCE compte DOUBLE : UNE glissée grave suffit au jaune (seuil récidive 2)
  st.possession.team = foe.team;                                   // le lésé n'a plus le ballon : sifflet
  st._faute.t = st.t - 2;                                          // la fenêtre d'avantage est close (fixture)
  adjugeFaute(st, cfg);
  const jaune = st.events.find((e) => e.type === 'carton' && e.couleur === 'jaune' && e.by === foe.id);
  ok(`…et le JAUNE vient sur UNE seule glissée par derrière (récidive ×2 : cumul fautes=${st.players[foe.id]._fautes} = 2 → carton immédiat)`,
    st.players[foe.id]._fautes === 2 && !!jaune);
}

// ---------- 3. le VIDE : ni ballon ni jambes — la glissade pour rien, le porteur file
{
  const { st, cfg, c, foe } = chase(3, (st, c, foe) => {
    foe.p[0] = bp(st)[0] - 2.2; foe.p[2] = bp(st)[2] + 1.1;        // loin du corps (> 1,1), glissade détournée
    foe.v = [5.5, 0]; foe.yaw = Math.PI;
  });
  st.rnd = () => 0.3;
  cfg.slideTackle = { ...cfg.slideTackle, predit: false };   // (219b) le monde d'AVANT la prédiction (191) : depuis, un pro sans ballon ni jambes en vue reste DEBOUT — la glissade dans le vide est un sabotage nommé, pas le défaut
  const carrier0 = st.possession.carrier;
  slideTackleStep(st, c, cfg);
  const ev = st.events[st.events.length - 1];
  ok(`la glissade dans le VIDE (ni ballon ni jambes : 'slide' won=false sans faute, le porteur FILE — carry intact, porteur nº${st.possession.carrier} = nº${carrier0}, refus « glissé-dans-le-vide » ${st.deny?.['glissé-dans-le-vide'] ?? 0} ≥ 1)`,
    ev?.type === 'slide' && ev.won === false && !ev.faute && st.phase === 'carry' && st.possession.carrier === carrier0 && (st.deny?.['glissé-dans-le-vide'] ?? 0) >= 1);
}

// ---------- 4. le JET fait le pari (même géométrie valide, jet raté → pas de prise)
{
  const { st, cfg, c, foe } = chase(3, (st, c, foe) => {
    foe.p[0] = bp(st)[0] - 1.8; foe.p[2] = bp(st)[2]; foe.v = [5.5, 0]; foe.yaw = 0;
  });
  st.rnd = () => 0.95;                                             // le pari se perd
  const e0 = st.events.length;
  slideTackleStep(st, c, cfg);
  const ev = st.events.slice(e0).find((e) => e.type === 'slide');
  ok(`le GLISSÉ est un PARI (même géométrie que le pris, jet 0,95 > 0,6 : won=${ev?.won}${ev?.faute ? ' — et si près du corps, le raté EST la faute' : ''})`,
    ev?.won === false);
}

// ---------- 5. le DERNIER RECOURS : un porteur lent ne déclenche RIEN
{
  const { st, cfg, c, foe } = chase(3, (st, c, foe) => {
    c.v = [2, 0];                                                  // construction lente
    foe.p[0] = bp(st)[0] - 1.8; foe.p[2] = bp(st)[2]; foe.v = [5.5, 0]; foe.yaw = 0;
  });
  const e0 = st.events.length;
  slideTackleStep(st, c, cfg);
  ok(`on ne se couche PAS sur une construction lente (porteur à 2 m/s : ${st.events.length - e0} événement = 0 — le glissé est le geste de l'échappée)`,
    st.events.length === e0);
}

// ---------- 6. le FLUX : la texture en bande, le jeu respire
{
  let att = 0, fa = 0, buts = 0, secs = 0;
  for (const seed of [1, 2, 3, 4, 5, 7]) {
    const st = makeMatch({ full: true, seed });
    const cfg = matchCfg({ shotRange: 20 });
    for (let i = 0; i < 180 * 60; i++) matchStep(st, 1 / 60, cfg);
    att += st.events.filter((e) => e.type === 'slide' && (e.sur != null || e.faute)).length;
    fa += st.events.filter((e) => e.type === 'faute').length;
    secs += st.events.filter((e) => e.type === 'slide' && e.bearing !== undefined && !e.won && !e.faute && e.dist > 1).length;
    buts += st.score[0] + st.score[1];
  }
  // LE CORPS NE SE COUCHE PLUS À CÔTÉ (lot 66) : post-gazon, 14 ratés secs/6 matchs — le glissé
  // sur ballon libre partait dans SA course, le pied passait à > 1 m du ballon assis. Le couloir
  // se lit DEBOUT (ecartCouloir) ; le vide résiduel est l'esquive/le jet, pas l'absurde.
  ok(`le corps ne se couche plus à côté (${(secs / 6).toFixed(1)} raté(s) sec(s) libre(s)/match ≤ 1 — le couloir se lit debout)`, secs / 6 <= 1);
  // Bande RE-FONDÉE au lot 62 (plancher 0,5 → 0,25, récit) : la prise au pied a rendu le ballon
  // de conduite plus souvent LIBRE entre les touches (+67 % de touches mesurées) — le PIQUE
  // debout (pokeReach) joue désormais une part de ce que seul le tacle couché prenait, et c'est
  // le football réel : on ne se couche pas sur un ballon qu'on peut piquer debout. RE-FONDÉE au
  // lot 97 (plancher 0,25 → 0,15, récit) : l'ACCROCHAGE DU BATTU prend à son tour une part de la
  // niche — le défenseur dépassé RETIENT (la faute tactique) au lieu de se jeter, le vrai foot ;
  // mesuré 0,2/match, gamme réelle basse. S'il meurt (< 0,15), c'est une régression.
  // garde-fou fautes 2 → 2,5 (lot 67a, récit) : le monde du se-montrer bouge plus — mesuré 2,2
  // dont 1,3 de CHARGES-derrière (duel lot 32, hors périmètre glissé — dette nommée : 1,3/3 min
  // ≈ 40/90 min, le réel en fait 5-10) et 0,8 de glissés-imprudence (le chemin voulu, avec sa
  // retenue à 70 %). Le garde-fou reste : les fautes ne doivent pas hacher le jeu.
  ok(`le DERNIER RECOURS vit en bande (6 × 180 s : ${(att / 6).toFixed(1)} glissé(s) engagé(s)/match ∈ [0,15 ; 5], ${(fa / 6).toFixed(1)} faute-tot/match ≤ 2,5, ${buts} buts ≥ 3 : le jeu respire)`,
    att / 6 >= 0.15 && att / 6 <= 5 && fa / 6 <= 2.5);   // les buts se jugent à UN endroit (lot 36)
}

// ---------- 7. sabotage nommé « personne ne se couche » : slideTackle:false → le monde d'hier
{
  const st = makeMatch({ full: true, seed: 3 });
  const cfg = matchCfg({ shotRange: 20, slideTackle: false });
  for (let i = 0; i < 60 * 60; i++) matchStep(st, 1 / 60, cfg);
  ok(`sabotage « personne ne se couche » attrapé (slideTackle:false : ${st.events.filter((e) => e.type === 'slide' && e.sur != null).length} glissé-sur-porteur en 60 s — l'échappée redevient inarrêtable, nommé)`,
    !st.events.some((e) => e.type === 'slide' && e.sur != null));
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
