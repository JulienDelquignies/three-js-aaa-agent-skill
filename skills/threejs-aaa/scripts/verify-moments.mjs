#!/usr/bin/env node
// verify-moments.mjs — LES QUATRE MOMENTS DU JEU SONT UN SOCLE, ET ÇA SE PROUVE.
// La dérivation pure (phases.js), l'horloge du regain (match-sim), les événements 'moment',
// le consommateur d'équipe (contre-press de transition — Gegenpressing), le sabotage nommé.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { momentDuJeu, checkMoments } from '../assets/starter/src/engine/phases.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- 1. le contrat pur
{
  const c = checkMoments();
  ok(`le contrat des moments tient (checkMoments : transitions jeunes, placé installé, miroirs, arrêt, fenêtre paramétrée)`, c.ok, c.issues.join(' ; '));
}

// ---------- 2. l'horloge du regain vit dans le match (événements + dérivation cohérents)
{
  const st = makeMatch({ full: true, seed: 3 });
  const cfg = matchCfg({ shotRange: 20 });
  let coherent = true, checked = 0;
  for (let i = 0; i < 120 * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    if ((i % 120) !== 0 || st.restart) continue;
    const m0 = momentDuJeu(st, 0, cfg.moments.win), m1 = momentDuJeu(st, 1, cfg.moments.win);
    checked++;
    // les miroirs ne peuvent pas mentir : une équipe attaque ⇔ l'autre défend, même jeunesse
    const paire = (m0 === 'transition-off' && m1 === 'transition-def') || (m0 === 'transition-def' && m1 === 'transition-off')
      || (m0 === 'attaque-placée' && m1 === 'défense-placée') || (m0 === 'défense-placée' && m1 === 'attaque-placée');
    if (!paire) coherent = false;
  }
  const evs = st.events.filter((e) => e.type === 'moment');
  const trans = evs.filter((e) => e.kind === 'transition').length;
  // une lecture toutes les 2 s sur 120 s ⇒ ~60 échantillons hors remises (la première borne
  // exigeait > 300 : une erreur d'arithmétique du banc, pas du moteur)
  ok(`les MIROIRS tiennent en flux (${checked} lectures, deux équipes toujours en moments conjugués)`, coherent && checked >= 40);
  ok(`le regain s'ÉVÉNEMENTE (${evs.length} événements 'moment', dont ${trans} transitions — mesurable, pas un état caché)`, trans >= 5 && evs.length >= trans);
  // chaque 'placée' suit une 'transition' de la MÊME équipe (l'installation n'invente pas de possession)
  let ordre = true;
  for (let i = 0; i < evs.length; i++) if (evs[i].kind === 'placée') {
    const prev = evs.slice(0, i).reverse().find((e) => e.kind === 'transition');
    if (!prev || prev.team !== evs[i].team) ordre = false;
  }
  ok(`une installation suit TOUJOURS sa transition (même équipe — l'ordre des moments est causal)`, ordre);
}

// ---------- 3. la distribution du jeu ouvert + le consommateur d'équipe
{
  const st = makeMatch({ full: true, seed: 4 });
  const cfg = matchCfg({ shotRange: 20 });
  const tm = { t: 0, ouvert: 0 };
  for (let i = 0; i < 180 * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    const m = momentDuJeu(st, 0, cfg.moments.win);
    if (m === 'arrêt') continue;
    tm.ouvert += 1 / 60;
    if (m === 'transition-off' || m === 'transition-def') tm.t += 1 / 60;
  }
  const pct = (100 * tm.t) / Math.max(1, tm.ouvert);
  // mesuré 48-54 % (3 graines) ; le vrai foot vit ~40-50 % en transitions — bande large, le
  // point est l'EXISTENCE des deux régimes, pas un réglage fin
  ok(`le jeu ouvert se PARTAGE entre placé et transition (${pct.toFixed(0)} % en transition ∈ [30 ; 65])`, pct >= 30 && pct <= 65);
  const cp = st.events.filter((e) => e.type === 'press' && e.kind === 'contre-press').length;
  ok(`le CONTRE-PRESS d'équipe vit (${cp} fenêtres 'contre-press' — la transition défensive est un comportement, pas une étiquette)`, cp >= 1 && cp <= 20);
}

// ---------- 4. déterminisme + sabotage nommé
{
  const seq = (over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, ...over });
    for (let i = 0; i < 90 * 60; i++) matchStep(st, 1 / 60, cfg);
    return st.events.filter((e) => e.type === 'moment' || (e.type === 'press' && e.kind === 'contre-press'));
  };
  const a = seq({}), b = seq({});
  ok(`la séquence des moments est DÉTERMINISTE (même graine → même récit, ${a.length} événements)`,
    JSON.stringify(a) === JSON.stringify(b) && a.length > 5);
  const sans = seq({ moments: false });
  ok(`sabotage « jeu sans moments » attrapé (moments:false — ${sans.length} événement(s) : ni horloge, ni contre-press d'équipe)`,
    sans.length === 0);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
