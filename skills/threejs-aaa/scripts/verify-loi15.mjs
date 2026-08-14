#!/usr/bin/env node
// verify-loi15.mjs — LA TOUCHE SE LANCE À LA MAIN, ET LE HORS-JEU N'Y EXISTE PAS.
//
// Loi 15 : à la prise d'une remise 'touche' (hook générique cfg.onTake — la prise a un
// métier), le lanceur sert un coéquipier à portée de bras (loi15.range) et le ballon part
// EN CLOCHE (~32°, release('touche') au grand livre). L'exemption de la Loi 11 est
// STRUCTURELLE : st.pass sans photo .off — le sifflet n'a rien à lire, le veto de cerveau
// n'a jamais tourné. Doctrine lot 8 : fixtures craftées (mesure de flux consignée : 0
// sortie latérale en 3×180 s — le jeu vit central ; la loi vit par fixtures). Le réduit
// joue sa touche au pied comme avant, au bit près (st.full garde le lancer).
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { isOffside } from '../assets/starter/src/engine/offside.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// un monde posé avec une remise de TOUCHE craftée au point [10, +hz], équipe 0
const toucheWorld = (seed, cfg, arrange) => {
  const st = makeMatch({ full: true, seed });
  for (let i = 0; i < 8 * 60 && !(st.phase === 'carry' && !st.restart); i++) matchStep(st, 1 / 60, cfg);
  const hz = st.pitch.hz;
  st.ball.release('sortie');
  st.ball.restart([10, 0.11, hz - 0.15], { cause: 'touche' });
  st.phase = 'loose'; st.possession.carrier = -1; st.pass = null;
  st.restart = { type: 'touche', p: [10, hz - 0.15], team: 0, at: st.t + 2, placed: true, taker: -1 };
  if (arrange) arrange(st);
  return st;
};
const run = (st, cfg, secs) => { for (let i = 0; i < secs * 60; i++) matchStep(st, 1 / 60, cfg); };

// ---------- 1. la touche VOLE en cloche, à portée de bras, et un coéquipier la prend
{
  const cfg = matchCfg({ shotRange: 20 });
  const st = toucheWorld(3, cfg);
  let apex = 0, rentree = null;
  for (let i = 0; i < 10 * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    rentree ??= st.events.find((e) => e.type === 'rentrée');
    if (rentree && st.t - rentree.t < 1.6) apex = Math.max(apex, st.ball.p[1]);
  }
  ok(`la touche se LANCE (événement 'rentrée' de nº${rentree?.by} vers nº${rentree?.to}, portée ${rentree?.range} m ≤ 18)`,
    !!rentree && rentree.range <= 18.01 && rentree.by !== rentree.to);
  ok(`…et VOLE en cloche (apex ${apex.toFixed(2)} m ∈ [1 ; 3,4] — une main au-dessus de la tête, pas un pied rasant)`,
    apex >= 1 && apex <= 3.4);
  // …receive OU ramassage (lot 52 : la chute prédite peut transformer la reprise en course
  // au point de chute — un 'loose-kept' du monde qui continue EST la reprise)
  const prise = st.events.find((e) => (e.type === 'receive' || e.type === 'loose-kept') && e.t > rentree?.t);
  ok(`…et le jeu la REPREND (receive à t=${prise?.t} — le vol atterrit chez un corps, le monde continue)`,
    !!rentree && !!prise && prise.t - rentree.t < 4);
}

// ---------- 2. L'EXEMPTION DE LA LOI 11 : un receveur posté HORS-JEU reçoit sans sifflet
{
  const cfg = matchCfg({ shotRange: 20 });
  const st = toucheWorld(3, cfg, (st) => {
    const hz = st.pitch.hz;
    // la défense (équipe 1) tient une ligne à x=5 ; UN attaquant posté à x=12 — HORS-JEU
    for (const q of st.players.filter((p) => p.team === 1 && !p.keeper)) q.p[0] = Math.min(q.p[0], 5 - Math.abs(q.p[2]) * 0.01);
    const mates = st.players.filter((p) => p.team === 0 && !p.keeper);
    mates.forEach((m) => { m.p[0] = -30; m.p[2] = 0; });          // tous hors de portée…
    mates[0].p[0] = 8; mates[0].p[2] = hz - 1.2;                  // …sauf le PRENEUR au point
    mates[1].p[0] = 12; mates[1].p[2] = hz - 8;                   // …et l'appelé, DEVANT la ligne
    st._cible = mates[1].id;
  });
  const cible = st.players[st._cible];
  let offAuLancer = null, rentree = null, sifflet = false;
  for (let i = 0; i < 10 * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    if (!rentree) {
      const e = st.events.find((x) => x.type === 'rentrée');
      if (e) { rentree = e; offAuLancer = isOffside(st, 0, cible.p); }
    }
    sifflet ||= st.events.some((e) => e.type === 'hors-jeu');
  }
  ok(`l'appelé ÉTAIT hors-jeu au lancer (isOffside=${offAuLancer} — l'exemption est EXERCÉE, pas creuse) et il est SERVI (rentrée vers nº${rentree?.to} = nº${st._cible})`,
    offAuLancer === true && rentree?.to === st._cible);
  ok(`…et AUCUN sifflet de Loi 11 (« il n'y a pas de hors-jeu sur une rentrée de touche » — la photo n'a jamais été prise : ${sifflet ? 'SIFFLÉ' : 'silence'})`,
    !sifflet);
}

// ---------- 3. sabotage nommé « touche au pied » : loi15:false → le monde d'hier
{
  const cfg = matchCfg({ shotRange: 20, loi15: false });
  const st = toucheWorld(3, cfg);
  let apex = 0, pris = null;
  for (let i = 0; i < 8 * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    pris ??= st.events.find((e) => e.type === 'restart-pris');
    if (pris && st.t - pris.t < 1.2) apex = Math.max(apex, st.ball.p[1]);
  }
  ok(`sabotage « touche au pied » attrapé (loi15:false : aucune 'rentrée', prise au sol — apex ${apex.toFixed(2)} m < 1 dans la seconde suivant la prise)`,
    !st.events.some((e) => e.type === 'rentrée') && !!pris && apex < 1);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
