#!/usr/bin/env node
// verify-charge.mjs — LE FOOTBALL SE JOUE AU CORPS, ET LE CORPS A UNE LOI.
//
// Lot 32 : le duel de CORPS, distinct du tacle (qui joue le ballon). Diagnostic fondateur :
// l'adversaire vivait à 1,28 m MÉDIAN du porteur mais la pression ballon ne mordait que
// 2,4 % du portage (le bouclier fait son métier) → 1 duel / 9 min, un jeu sans contact.
// La charge : un défenseur au corps (< dist) mûrit une horloge (time s) ; DE CÔTÉ le duel
// est LOYAL (strength ±, élan, seedé — gagné : le ballon JAILLIT en bousculade ; perdu :
// le chargeur rebondit, _bite) ; DERRIÈRE, la FILATURE est un métier (pas d'événement) et
// seul le PERCUTAGE est une faute (contact < 0,5 m + vitesse d'entrée > fuite + 0,8 —
// première géométrie : 33 fautes / 9 min, l'ombre de poursuite criminalisée, des 0-0 au
// sifflet). Équilibre livré (4 × 180 s) : 6,0 épaules / 0,8 faute / match, scores humains.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { simInternals } from '../assets/starter/src/engine/rondo-sim.js';
import { makeProfile } from '../assets/starter/src/engine/attributes.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const { chargeStep } = simInternals;

// une fixture d'ADJUDICATION : monde posé, porteur et chargeur écrits à la main, horloge mûre
const duelWorld = (seed, arrange) => {
  const st = makeMatch({ full: true, seed });
  const cfg = matchCfg({ shotRange: 20 });
  for (let i = 0; i < 30 * 60 && !(st.phase === 'carry' && st.possession.carrier >= 0 && !st.restart); i++) matchStep(st, 1 / 60, cfg);
  const c = st.players[st.possession.carrier];
  const foe = st.players.find((q) => q.team !== c.team && !q.keeper);
  foe.act = null; foe.down = 0;
  arrange(st, c, foe);
  st._chgT = 0.5;                                                  // l'horloge est MÛRE : la charge se joue à l'appel
  return { st, cfg, c, foe };
};
const cote = (st, c, foe) => {                                     // chargeur À L'ÉPAULE, vitesses appariées
  c.v = [3, 0]; foe.p[0] = c.p[0]; foe.p[2] = c.p[2] + 0.7; foe.v = [3, 0];
};

// ---------- 1. le duel LOYAL : la force écrit l'issue (déterministe à rnd fixé)
{
  const { st, cfg, c, foe } = duelWorld(3, cote);
  foe.skill = makeProfile({ strength: 100 }); c.skill = makeProfile({ strength: 0 });
  st.rnd = () => 0.5;
  const ev0 = st.events.length;
  chargeStep(st, c, 1 / 60, cfg);
  const d = st.events.slice(ev0).find((e) => e.type === 'duel' && e.kind === 'épaule');
  ok(`le FORT fait JAILLIR le ballon (strength 100 vs 0, rnd 0,5 : duel épaule gagné=${d?.won}, ballon lâché — phase ${st.phase}, porteur ${st.possession.carrier})`,
    d?.won === true && st.phase === 'loose' && st.possession.carrier === -1);
}
{
  const { st, cfg, c, foe } = duelWorld(3, cote);
  foe.skill = makeProfile({ strength: 0 }); c.skill = makeProfile({ strength: 100 });
  st.rnd = () => 0.5;
  const ev0 = st.events.length;
  chargeStep(st, c, 1 / 60, cfg);
  const d = st.events.slice(ev0).find((e) => e.type === 'duel' && e.kind === 'épaule');
  ok(`le FAIBLE rebondit (strength 0 vs 100 : duel perdu=${d?.won === false}, porteur INTACT, chargeur assis ${(foe._bite - st.t).toFixed(2)} s — le levier _bite)`,
    d?.won === false && st.phase === 'carry' && foe._bite > st.t);
}

// ---------- 2. DERRIÈRE : la filature est un métier, le percutage une faute
{
  const { st, cfg, c, foe } = duelWorld(3, (st, c, foe) => {
    c.v = [4, 0]; foe.p[0] = c.p[0] - 0.4; foe.p[2] = c.p[2]; foe.v = [7, 0];   // il lui RENTRE dedans
  });
  const ev0 = st.events.length;
  chargeStep(st, c, 1 / 60, cfg);
  const fa = st.events.slice(ev0).find((e) => e.type === 'faute');
  ok(`le PERCUTAGE par derrière est une FAUTE (contact 0,4 m, entrée +3 m/s : 'faute' kind=${fa?.kind}, st._faute par nº${st._faute?.par} — l'arbitre de la Loi 12 prend)`,
    fa?.kind === 'charge-derrière' && st._faute?.par === foe.id && st.phase === 'carry');
}
{
  const { st, cfg, c, foe } = duelWorld(3, (st, c, foe) => {
    c.v = [4, 0]; foe.p[0] = c.p[0] - 0.7; foe.p[2] = c.p[2]; foe.v = [4, 0];   // il SUIT, même vitesse
  });
  const ev0 = st.events.length;
  chargeStep(st, c, 1 / 60, cfg);
  ok(`la FILATURE ne se siffle NI ne se joue (défenseur dans le dos à vitesse égale : 0 événement, horloge ré-armée à ${st._chgT} s, re-regard à +0,5 s)`,
    st.events.length === ev0 && st._chgT === 0.2 && foe._chgCd > st.t);
}

// ---------- 3. le COOLDOWN et le GARDIEN
{
  const { st, cfg, c, foe } = duelWorld(3, cote);
  st.rnd = () => 0.9;                                              // le porteur tient (pas de jailli)
  chargeStep(st, c, 1 / 60, cfg);
  const n1 = st.events.filter((e) => e.kind === 'épaule').length;
  st._chgT = 0.5;
  chargeStep(st, c, 1 / 60, cfg);                                  // le même chargeur, tout de suite
  ok(`l'anti-mitraillette tient (1er duel joué, cd ${(foe._chgCd - st.t).toFixed(1)} s → 2ᵉ appel immédiat : ${st.events.filter((e) => e.kind === 'épaule').length - n1} duel(s) de plus = 0)`,
    n1 === 1 && st.events.filter((e) => e.kind === 'épaule').length === n1);
  const { st: st2, cfg: cfg2, c: c2, foe: f2 } = duelWorld(3, cote);
  c2.keeper = true;
  const e0 = st2.events.length;
  chargeStep(st2, c2, 1 / 60, cfg2);
  ok(`on ne CHARGE pas le gardien porteur (faute réelle — v1 : aucun duel, ${st2.events.length - e0} événement(s))`, st2.events.length === e0);
}

// ---------- 4. le FLUX : la texture du contact existe, dans la bande du football
{
  let ep = 0, fa = 0, buts = 0;
  for (const seed of [1, 3, 5, 7]) {
    const st = makeMatch({ full: true, seed });
    const cfg = matchCfg({ shotRange: 20 });
    for (let i = 0; i < 180 * 60; i++) matchStep(st, 1 / 60, cfg);
    ep += st.events.filter((e) => e.type === 'duel' && e.kind === 'épaule').length;
    fa += st.events.filter((e) => e.type === 'faute').length;
    buts += st.score[0] + st.score[1];
  }
  ok(`la TEXTURE vit en match (4 × 180 s : ${(ep / 4).toFixed(1)} épaules/match ∈ [3 ; 10] — était 0,3 duel/match —, ${(fa / 4).toFixed(2)} faute/match ≤ 2 — réel ≈ 0,8 —, ${buts} buts en 4 matchs ≥ 2 : le jeu respire encore)`,
    ep / 4 >= 2 && ep / 4 <= 10 && fa / 4 <= 2);   // la clause juge LES ÉPAULES et LES FAUTES (lot 36 : les buts-respiration se jugent à UN endroit — match11/chrono — pas dans chaque banc de flux)
}

// ---------- 5. sabotage nommé « jeu sans contact » : charge:false → le monde d'hier
{
  const st = makeMatch({ full: true, seed: 3 });
  const cfg = matchCfg({ shotRange: 20, charge: false });
  for (let i = 0; i < 60 * 60; i++) matchStep(st, 1 / 60, cfg);
  ok(`sabotage « jeu sans contact » attrapé (charge:false : ${st.events.filter((e) => e.kind === 'épaule').length} épaule en 60 s — le défenseur plane à 1,3 m pour toujours, nommé)`,
    !st.events.some((e) => e.kind === 'épaule'));
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
