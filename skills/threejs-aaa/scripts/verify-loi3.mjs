#!/usr/bin/env node
// verify-loi3.mjs — LE REMPLACEMENT EST UNE LOI, LA POLITIQUE EST AU PROJET.
//
// Loi 3 : remplacer(st, cfg, team, outId, inSpec) FILE le changement ; il s'exécute À
// L'ARRÊT DE JEU (on ne change pas pendant que le ballon roule) ; le sortant marche vers
// la touche (levier de l'expulsion : down géant — les cerveaux l'oublient), à la ligne
// L'IDENTITÉ CHANGE (ratings→makeProfile, nom, numéro — l'ardoise disciplinaire PART AVEC
// L'HOMME : le carton appartient à l'homme, pas au maillot), et le corps REVIENT. Limite
// loi3.changements, expulsé irremplaçable, feuille remplacements. Le moteur ne décide
// jamais QUI sort — comme Unity ne substitue pas à votre place.
import { makeMatch, matchCfg, matchStep, feuilleDeMatch } from '../assets/starter/src/engine/match-sim.js';
import { adjugeFaute, remplacer } from '../assets/starter/src/engine/referee.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

const settle = (seed, cfg) => {
  const st = makeMatch({ full: true, seed });
  for (let i = 0; i < 30 * 60 && !(st.phase === 'carry' && st.possession.carrier >= 0 && !st.restart); i++) matchStep(st, 1 / 60, cfg);
  return st;
};
const siffle = (st, cfg, par) => {
  st._faute = { t: st.t - 2, par, sur: 1, team: 1 - st.players[par].team, p: [4, 4] };
  st.possession.team = st.players[par].team;
  adjugeFaute(st, cfg);
  st.restart = null;
};
const arret = (st) => {                                            // un arrêt de jeu crafté (touche)
  const hz = st.pitch.hz;
  st.ball.release('sortie');
  st.ball.restart([10, 0.11, hz - 0.15], { cause: 'touche' });
  st.phase = 'loose'; st.possession.carrier = -1; st.pass = null;
  st.restart = { type: 'touche', p: [10, hz - 0.15], team: 0, at: st.t + 2, placed: true, taker: -1 };
};

// ---------- 1. la file, l'arrêt de jeu, la marche, l'identité, le retour
{
  const cfg = matchCfg({ shotRange: 20 });
  const st = settle(3, cfg);
  const q = st.players.find((p) => p.team === 1 && !p.keeper);
  const avant = { name: q.name, skill: q.skill };
  ok(`remplacer() FILE (pendant le jeu : accepté=${remplacer(st, cfg, 1, q.id, { ratings: { pace: 0.9 }, name: 'Entrant', number: 99 })}, rien ne bouge tant que le ballon roule)`,
    st._subs?.[1]?.length === 1 && !q._sub);
  for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
  ok(`…et le ballon ROULE encore : pas d'exécution hors arrêt (sub en file=${st._subs[1].length}, sortant intact down=${q.down})`,
    st._subs[1].length === 1 && q.down <= 0);
  arret(st);
  q.p[0] = 10; q.p[2] = 28;                                        // près de la touche : la marche se mesure vite
  for (let i = 0; i < 10 * 60; i++) matchStep(st, 1 / 60, cfg);
  const ev = st.events.find((e) => e.type === 'remplacement');
  ok(`l'ARRÊT DE JEU exécute (événement 'remplacement' équipe ${ev?.team} minute ${ev?.minute}, identité changée : « ${q.name} » nº${q.number}, pace ${q.ratings?.pace}, profil ${q.skill ? 'noté' : 'nu'} ≠ avant « ${avant.name ?? 'défaut'} »)`,
    !!ev && ev.team === 1 && q.name === 'Entrant' && q.number === 99 && q.ratings?.pace === 0.9 && !!q.skill);
  for (let i = 0; i < 8 * 60; i++) matchStep(st, 1 / 60, cfg);
  ok(`…et le NOUVEL homme REVIENT (|z|=${Math.abs(q.p[2]).toFixed(1)} < ${st.pitch.hz - 2.5}, down=${q.down}, les cerveaux le reprennent)`,
    Math.abs(q.p[2]) < st.pitch.hz - 2.5 && q.down <= 0 && !q._sub);
  ok(`la FEUILLE compte (remplacements ${JSON.stringify(feuilleDeMatch(st).remplacements)} = [0,1])`,
    JSON.stringify(feuilleDeMatch(st).remplacements) === '[0,1]');
}

// ---------- 2. l'ardoise disciplinaire PART AVEC L'HOMME
{
  const cfg = matchCfg({ shotRange: 20 });
  const st = settle(3, cfg);
  const q = st.players.find((p) => p.team === 1 && !p.keeper);
  siffle(st, cfg, q.id); siffle(st, cfg, q.id);                    // récidive → JAUNE
  const j1 = st.events.filter((e) => e.type === 'carton' && e.couleur === 'jaune').length;
  remplacer(st, cfg, 1, q.id, { name: 'Neuf' });
  arret(st);
  q.p[0] = 10; q.p[2] = 28;
  for (let i = 0; i < 10 * 60; i++) matchStep(st, 1 / 60, cfg);
  siffle(st, cfg, q.id); siffle(st, cfg, q.id);                    // le NOUVEL homme : 2 fautes → JAUNE, pas rouge
  const jaunes = st.events.filter((e) => e.type === 'carton' && e.couleur === 'jaune').length;
  const rouges = st.events.filter((e) => e.type === 'carton' && e.couleur === 'rouge').length;
  ok(`le carton appartient à L'HOMME, pas au maillot (jaune avant sub=${j1}, 2 fautes du NOUVEL homme → 2ᵉ jaune SANS rouge : jaunes=${jaunes}, rouges=${rouges} — l'ardoise est repartie vierge)`,
    j1 === 1 && jaunes === 2 && rouges === 0 && !st.players[q.id].expulse);
}

// ---------- 3. la LIMITE et les refus nommés
{
  const cfg = matchCfg({ shotRange: 20, loi3: { changements: 1 } });
  const st = settle(3, cfg);
  const [a, b] = st.players.filter((p) => p.team === 1 && !p.keeper);
  const r1 = remplacer(st, cfg, 1, a.id, null);
  const r2 = remplacer(st, cfg, 1, b.id, null);
  ok(`la LIMITE refuse (changements:1 — premier=${r1}, second=${r2})`, r1 === true && r2 === false);
  // …et l'EXPULSÉ est irremplaçable (le rouge laisse l'équipe à 10 — la loi réelle)
  const st2 = settle(3, matchCfg({ shotRange: 20 }));
  const c = st2.players.find((p) => p.team === 1 && !p.keeper);
  for (let k = 0; k < 4; k++) siffle(st2, matchCfg({ shotRange: 20 }), c.id);
  ok(`l'EXPULSÉ est irremplaçable (rouge posé : remplacer=${remplacer(st2, matchCfg({ shotRange: 20 }), 1, c.id, null)} — l'équipe RESTE à 10)`,
    c.expulse === true && remplacer(st2, matchCfg({ shotRange: 20 }), 1, c.id, null) === false);
}

// ---------- 4. sabotage nommé « porte tournante fermée » : loi3 absent → l'API refuse tout
{
  const cfg = matchCfg({ shotRange: 20, loi3: false });
  const st = settle(3, cfg);
  const q = st.players.find((p) => p.team === 1 && !p.keeper);
  ok(`sabotage « porte tournante fermée » attrapé (loi3:false : remplacer=${remplacer(st, cfg, 1, q.id, null)}, aucune file posée)`,
    remplacer(st, cfg, 1, q.id, null) === false && !st._subs);
}

// ---------- 5. lot 184 : L'ENTRÉE À LA MÉDIANE (cfg.entreeMediane — la Loi 3 complète)
{
  const entre = (over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, repli: false, ...(over ?? {}) });   // (221) repli:false — la clause dépend de LA première remise après 30 s de la graine 3 ; le repli en change le monde et le changement demandé s'annule à la reprise
    let demande = false, xIn = null, longe = false, tOut = null, tIn = null;
    for (let i = 0; i < 200 * 60 && xIn == null; i++) {
      matchStep(st, 1 / 60, cfg);
      // DATÉ 240 : la scène FABRIQUE son arrêt de jeu (ballon poussé en touche à 30 s) — la graine 3 ne s'arrêtait plus entre 30 et 200 s (le flux du 240, les sorties rares), la clause attendait une remise qui ne venait pas
      if (!demande && st.t > 30 && !st.restart && !st._sortie184) { st._sortie184 = true; st.ball.release('sortie'); st.ball.restart([0, 0.11, st.pitch.hz + 1.5], { cause: 'touche' }); }
      if (!demande && st.t > 30 && st.restart) {
        const sortant = st.players.find((q) => q.team === 0 && !q.keeper && Math.abs(q.p[0]) > 20);
        if (sortant) { remplacer(st, cfg, 0, sortant.id, { name: 'Entrant' }); demande = true; }
      }
      for (const ev of st.events.slice(-3)) if (ev.type === 'remplacement' && tOut == null) tOut = ev.t;
      if (st.players.some((q) => q._sub?.phase === 'longe')) longe = true;
      if (tOut != null && !st.players.some((q) => q._sub)) {
        tIn = st.t;
        const e = st.players.find((q) => q.name === 'Entrant');
        xIn = e ? Math.abs(e.p[0]) : 99;
      }
    }
    return { xIn, longe, aDix: tOut != null && tIn != null ? +(tIn - tOut).toFixed(1) : null };
  };
  const V = entre({}), E = entre({ entreeMediane: false });
  ok(`lot 184 — L'ENTRÉE À LA MÉDIANE : l'entrant LONGE la touche (${V.longe}) et entre à x = ${V.xIn?.toFixed(1)} m ≤ 1,5 de la ligne médiane, l'équipe à dix ${V.aDix} s (le trajet réel) ; l'épinglé entre au miroir de la sortie (longe ${E.longe} = false, x ${E.xIn?.toFixed(1)} ≥ 15 — l'apparition d'hier)`,
    V.longe === true && V.xIn != null && V.xIn <= 1.5 && V.aDix > 5 && E.longe === false && E.xIn >= 15);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
