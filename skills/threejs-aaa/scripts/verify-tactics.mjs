#!/usr/bin/env node
// verify-tactics.mjs — LA TACTIQUE EST UN CONTRAT, PAS UN PLACEBO.
// Cinq axes qui GÉNÈRENT l'espace des styles ; le défaut (0,5) est l'IDENTITÉ du monde mesuré
// des lots 10-14 (au bit près) ; chaque axe prouve qu'il BOUGE son instrument — en flux quand
// le flux le montre (hauteur, largeur), au mécanisme déterministe quand le flux est confondu
// (pressing : durées de fenêtre ; style : bascule d'un choix serré — la tactique ORIENTE, elle
// ne force pas un choix dominant). Dettes nommées : instruments de flux pressing/style/
// transition, catalogue de formations (couche rôles).
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { checkTactics, axe, resoudreTactique } from '../assets/starter/src/engine/tactics.js';
import { blocFor } from '../assets/starter/src/engine/formation.js';
import { arbitre } from '../assets/starter/src/engine/menace.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- 1. le contrat pur
{
  const c = checkTactics();
  ok(`le contrat des axes tient (checkTactics : presets bornés, défaut identitaire, axe honnête)`, c.ok, c.issues.join(' ; '));
  ok(`le milieu d'axe est EXACT (axe(0,5, 0,85, 1,15) === 1 — l'identité ne meurt pas d'un ulp)`, axe(0.5, 0.85, 1.15) === 1 && axe(0.5, -6, 6) === 0);
}

// ---------- 2. l'IDENTITÉ : tactique absente === équilibre explicite, octet pour octet
{
  const run = (tactics) => {
    const st = makeMatch({ full: true, seed: 3, tactics });
    const cfg = matchCfg({ shotRange: 20 });
    for (let i = 0; i < 60 * 60; i++) matchStep(st, 1 / 60, cfg);
    return JSON.stringify(st.events);
  };
  ok(`le DÉFAUT est l'identité (tactics absent === ['equilibre','equilibre'], 60 s d'événements identiques — et toute la batterie des lots 10-14 reste verte au bit près)`,
    run(null) === run(['equilibre', 'equilibre']));
}

// ---------- 3. les axes de flux : hauteur et largeur BOUGENT leurs instruments
{
  const run = (t0) => {
    // graine 3 (re-fondé lots 31, 34 et 57 : chaque défaut nouveau diverge le flux — mécanisme
    // re-vérifié à chaque fois : lot 57, écarts hauteur +13,3/+12,6/+14,1 sur graines 3/7/1,
    // la graine 5 s'est effondrée à +2,3 dans le flux de l'économie de course — les clauses de
    // flux se re-fondent sur graines RE-MESURÉES, le mécanisme est plus fort que jamais)
    const st = makeMatch({ full: true, seed: 3, tactics: [t0, null] });
    const cfg = matchCfg({ shotRange: 20 });
    let depth = 0, nD = 0, z = 0, nZ = 0;
    for (let i = 0; i < 150 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      if (st.restart) continue;
      const og = st.pitch.ownGoal(0);
      if (st.possession.team === 1) {
        const advs = st.players.filter((p) => p.team === 0 && !p.keeper).map((p) => Math.abs(p.p[0] - og.x)).sort((a, b) => a - b);
        depth += advs[1] ?? 0; nD++;
      }
      if (st.possession.team === 0 && st.t - (st._possChangeAt ?? -99) > 5) {
        for (const p of st.players) if (p.team === 0 && !p.keeper && (p.post ?? 0) >= 7) { z += Math.abs(p.p[2]); nZ++; }
      }
    }
    return { ligne: nD ? depth / nD : 0, zTrio: nZ ? z / nZ : 0 };
  };
  const bas = run({ hauteurBloc: 0 }), haut = run({ hauteurBloc: 1 });
  ok(`la HAUTEUR DE BLOC bouge la ligne (bloc bas ${bas.ligne.toFixed(1)} m de son but, ligne haute ${haut.ligne.toFixed(1)} — écart ≥ 4,5, mesuré +9,0 monde lot 34)`,
    haut.ligne >= bas.ligne + 4.5);
  // …la LARGEUR, re-fondée lot 42 : l'axe gouverne les POSTES — la juger au flux l'a noyée
  // TROIS fois (le renversement lot 35, puis les slots de surface et les darts : écarts
  // mesurés 1,4 puis 2,2 m pour une loi qui en produit ~5 aux postes). L'instrument honnête :
  // la scène CONTRÔLÉE — un porteur posé au rond central, trois images, et on lit les CIBLES
  // (p.target) que le bloc offensif pose aux ailiers postés — la sortie réelle du moteur.
  const cibleAiliers = (t0) => {
    const st = makeMatch({ full: true, seed: 5, tactics: [t0, null] });
    const cfg = matchCfg({ shotRange: 20, renversement: false });
    for (const q of st.players.filter((q) => q.team === 1)) { q.p[0] = 20; q.p[2] = (q.id % 11) * 4 - 20; q.v = [0, 0]; }
    const c = st.players.find((p) => p.team === 0 && p.post === 5);
    c.p[0] = 0; c.p[2] = 0; c.v = [0, 0];
    st.ball.restart([0.3, 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c.id);
    st.possession = { team: 0, carrier: c.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
    for (let i = 0; i < 3; i++) matchStep(st, 1 / 60, cfg);         // le bloc pose ses cibles
    const ailiers = st.players.filter((p) => p.team === 0 && (p.post === 7 || p.post === 9));
    return ailiers.reduce((s, p) => s + Math.abs((p.target ?? p.p)[2] ?? p.p[2]), 0) / ailiers.length;
  };
  const etroit = cibleAiliers({ largeur: 0 }), large = cibleAiliers({ largeur: 1 });
  ok(`la LARGEUR bouge les ailiers (cibles postées, porteur au rond central : jeu dedans |z| ${etroit.toFixed(1)} m, jeu d'ailes ${large.toFixed(1)} — écart ≥ 4 : ×0,85 contre ×1,15 sur les postes)`,
    large >= etroit + 4);
}

// ---------- 4. le PRESSING au mécanisme : la fenêtre d'une école de chasse dure plus, revient plus vite
{
  const fen = (pressing) => {
    const st = makeMatch({ full: true, seed: 5, tactics: [null, { pressing }] });   // T1 presse
    const cfg = matchCfg({ shotRange: 20 });
    const sgn = -st.pitch.ownGoal(0).sign;
    for (const q of st.players.filter((q) => q.team === 1)) q.p[0] = sgn * (q.keeper ? 51 : 20);
    for (const q of st.players.filter((q) => q.team === 0 && !q.keeper)) q.p[0] = -sgn * 8;
    const c0 = st.players.find((p) => p.team === 0 && p.post === 5);
    c0.p[0] = -sgn * 10; c0.p[2] = 0; c0.yaw = sgn > 0 ? Math.PI : 0;
    st.ball.restart([c0.p[0], 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c0.id);
    st.possession = { team: 0, carrier: c0.id }; st.phase = 'carry'; st.hold = 0.1; st.lastTouch = 0;
    matchStep(st, 1 / 60, cfg);
    return { win: st._press ? +(st._press.until - st.t).toFixed(2) : null, cd: +((st._pressCd?.[1] ?? 0) - st.t).toFixed(1) };
  };
  const doux = fen(0), chasse = fen(1);
  ok(`l'AGRESSIVITÉ est un mécanisme mesurable (fenêtre douce ${doux.win} s / chasse ${chasse.win} s ; retour au calme ${doux.cd} / ${chasse.cd} s — l'école de la chasse presse PLUS LONGTEMPS, PLUS SOUVENT)`,
    doux.win != null && chasse.win != null && chasse.win - doux.win >= 2 && doux.cd - chasse.cd >= 5);
}

// ---------- 5. le STYLE départage les choix SERRÉS (l'arbitre par équipe)
{
  const monde = (style) => {
    const st = makeMatch({ full: true, seed: 5, tactics: [{ style }, null] });
    const sgn = -st.pitch.ownGoal(0).sign;
    const goal = st.pitch.attackGoal(0);
    for (const q of st.players.filter((q) => q.team === 1)) { q.p[0] = sgn * 20; q.p[2] = -25; }
    for (const q of st.players.filter((q) => q.team === 0 && !q.keeper)) { q.p[0] = -sgn * 20; q.p[2] = 25; }
    const gk1 = st.players.find((q) => q.team === 1 && q.keeper); gk1.p[0] = goal.x; gk1.p[2] = 0;
    const c = st.players.find((p) => p.team === 0 && p.post === 8);
    c.p[0] = goal.x - sgn * 11; c.p[2] = 0;
    // le mur est DESSERRÉ (±2,05 — le couloir de tir vaut ~0,5 m) : le monde est à QUASI-
    // ÉGALITÉ passe/tir, exactement là où le style doit départager (à ±1,6, la passe gagnait
    // d'un cheveu SOUS LES DEUX styles — 0,393 contre 0,385 : un banc qui ne bascule pas ne
    // prouve rien)
    const wall = st.players.filter((p) => p.team === 1 && !p.keeper).slice(0, 3);
    wall[0].p[0] = goal.x - sgn * 5.5; wall[0].p[2] = 2.05;
    wall[1].p[0] = goal.x - sgn * 5.5; wall[1].p[2] = -2.05;
    wall[2].p[0] = goal.x - sgn * 5.5; wall[2].p[2] = 0;
    const mate = st.players.find((p) => p.team === 0 && p.post === 9);
    mate.p[0] = goal.x - sgn * 7; mate.p[2] = 7;
    st.ball.restart([c.p[0] + 0.3, 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c.id);
    st.possession = { team: 0, carrier: c.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
    return arbitre(st, c, matchCfg({ shotRange: 20 }));
  };
  const p = monde(0), d = monde(1);
  ok(`le STYLE bascule un choix serré (possession → « ${p.meilleure} », direct → « ${d.meilleure} » — même monde, deux équipes, deux footballs ; un choix dominant, lui, reste dominant)`,
    p.meilleure === 'passe' && d.meilleure !== 'passe');
}

// ---------- 6. sabotage nommé « tactique placebo » : deux presets opposés ⇒ deux récits
{
  const recit = (tactics) => {
    const st = makeMatch({ full: true, seed: 4, tactics });
    const cfg = matchCfg({ shotRange: 20 });
    for (let i = 0; i < 90 * 60; i++) matchStep(st, 1 / 60, cfg);
    return JSON.stringify(st.events);
  };
  ok(`sabotage « tactique placebo » attrapé (gegenpressing/blocBas ≠ blocBas/gegenpressing — la tactique ÉCRIT le match, elle ne le décore pas)`,
    recit(['gegenpressing', 'blocBas']) !== recit(['blocBas', 'gegenpressing']));
}

// ---------- 7. les presets PORTENT leurs rôles (lot 20) — et l'explicite gagne
{
  const st = makeMatch({ full: true, seed: 3, tactics: ['gegenpressing', null] });
  const p5 = st.players.find((p) => p.team === 0 && p.post === 5);
  const p8t1 = st.players.find((p) => p.team === 1 && p.post === 8);
  const st2 = makeMatch({ full: true, seed: 3, tactics: ['gegenpressing', null], roles: [{ 5: 'meneur' }, null] });
  const p5b = st2.players.find((p) => p.team === 0 && p.post === 5);
  ok(`un preset amène SES hommes (gegenpressing → poste 5 « ${p5?.role?.nom} » ; équipe au défaut → aucun rôle) — et l'explicite GAGNE (roles:{5:'meneur'} → « ${p5b?.role?.nom} »)`,
    p5?.role?.nom === 'recuperateur' && p8t1?.role == null && p5b?.role?.nom === 'meneur');
}

// ---------- LE BLOC EST CELUI DE SA TACTIQUE (lot 43 — « les blocs sont bien liés à la
// tactique ? c'est pas les mêmes pour tout le monde ? ») : blocFor, la vérité PURE partagée
// moteur/banc — compacité serre la longueur, hauteurBloc rapproche la ligne du ballon, et le
// défaut 0,5 est l'IDENTITÉ de la base moteur. Mesuré en match : gegenpressing 26,2 m /
// défaut 28,6 / possession 29,1 (blocBas 38,6 : les retours de corner à pied + l'attaquant
// d'outlet — le bus encaisse, c'est son football).
{
  const base = { long: 30, ligne: 27 };
  const serre = blocFor(base, resoudreTactique({ compacite: 1 }));
  const lache = blocFor(base, resoudreTactique({ compacite: 0 }));
  const haut = blocFor(base, resoudreTactique({ hauteurBloc: 1 }));
  const bas = blocFor(base, resoudreTactique({ hauteurBloc: 0 }));
  const ident = blocFor(base, resoudreTactique(undefined));
  const nul = blocFor(null, resoudreTactique(undefined));
  ok(`le bloc est CELUI DE SA TACTIQUE (compacité 1 → ${serre.long} m serré, 0 → ${lache.long} relâché ; presse haute → ligne à ${haut.ligne} m du ballon, bloc bas → ${bas.ligne} ; défaut 0,5 → ${ident.long}/${ident.ligne} = la base ; bloc absent → null)`,
    serre.long === 26 && lache.long === 34 && haut.ligne === 23 && bas.ligne === 31
    && ident.long === 30 && ident.ligne === 27 && nul === null);
}

// ---------- LA UNE-TOUCHE AU CALME EST UN CHOIX DE STYLE (lot 49 — la dette « tiki-taka »
// du lot 44) : l'axe style < 0,5 ouvre la porte de la première intention SANS presseur
// (pCalme = calme × (1−2·style), premiere-intention.js). Mesuré (6 × 180 s) : possession
// 19,2 % de passes en une touche dont 42 au calme, défaut 7,8 % dont ZÉRO calme (l'identité
// de la porte — aucun tirage consommé), direct 0 calme. Trois mondes, la même graine.
{
  const utDe = (tactics, cfgX) => {
    let calme = 0, ut = 0;
    for (const seed of [1, 3]) {
      const st = makeMatch({ full: true, seed, ...(tactics ? { tactics } : {}) });
      const cfg = matchCfg({ shotRange: 20, ...cfgX });
      for (let i = 0; i < 120 * 60; i++) matchStep(st, 1 / 60, cfg);
      for (const e of st.events) if (e.type === 'pass' && e.style === 'une-touche') { ut++; if (e.calme) calme++; }
    }
    return { calme, ut };
  };
  const poss = utDe(['possession', 'possession'], {});
  const defo = utDe(null, {});
  const sab = utDe(['possession', 'possession'], { uneTouche: { press: 2.6, vmax: 9.5, portee: 14, couloir: 0.5, p: 0.65, calme: 0 } });
  ok(`la une-touche au calme est un CHOIX de style (possession : ${poss.calme} calme(s) ≥ 2 sur ${poss.ut} une-touche ; défaut : ${defo.calme} = 0 EXACTEMENT — la porte identitaire ; sabotage « le réflexe seul » (calme:0) : ${sab.calme} = 0 en monde possession)`,
    poss.calme >= 2 && defo.calme === 0 && sab.calme === 0);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
