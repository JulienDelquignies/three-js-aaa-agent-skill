#!/usr/bin/env node
// verify-roles.mjs — LE RÔLE DIT QUOI, ET ÇA SE PROUVE. Le poste dit où (formation), le rôle
// nuance (biais à identité par défaut), l'attribut dit comment ça réussit — trois couches
// composées. Les signatures de FLUX par joueur sont noyées par l'effet papillon (un rôle
// re-distribue tout le match — mesuré : six mondes, six récits) : le mécanisme se prouve sur
// FIXTURES (doctrine lot 8) — même monde, seul le rôle change, delta de cible exact.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { checkRoles, ROLES } from '../assets/starter/src/engine/roles.js';
import { arbitre } from '../assets/starter/src/engine/menace.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- 1. le contrat pur
{
  const c = checkRoles();
  ok(`le contrat des rôles tient (checkRoles : catalogue borné ±30 %, polyvalent identitaire, résolution honnête)`, c.ok, c.issues.join(' ; '));
}

// ---------- 2. l'IDENTITÉ : aucun rôle === polyvalent partout, octet pour octet
{
  const run = (roles) => {
    const st = makeMatch({ full: true, seed: 3, roles });
    const cfg = matchCfg({ shotRange: 20 });
    for (let i = 0; i < 60 * 60; i++) matchStep(st, 1 / 60, cfg);
    return JSON.stringify(st.events);
  };
  const tous = {}; for (let i = 0; i <= 9; i++) tous[i] = 'polyvalent';
  ok(`le DÉFAUT est l'identité (aucun rôle === dix polyvalents explicites, 60 s d'événements identiques — et la batterie des lots 10-15 reste verte au bit près)`,
    run(null) === run([tous, tous]));
}

// ---------- 3. le MÉCANISME sur fixture : même monde, seul le rôle change, delta de CIBLE exact
{
  const cible = (roleName, post = 8) => {
    const st = makeMatch({ full: true, seed: 5, roles: roleName ? [{ [post]: roleName }, null] : null });
    const cfg = matchCfg({ shotRange: 20 });
    const sgn = -st.pitch.ownGoal(0).sign;
    // une attaque POSÉE : porteur + 3 soutiens à l'ancre (les slotters), le joueur observé LOIN
    // (posté), la défense au large — le calage Loi 11 hors de portée (ligne haute)
    for (const q of st.players.filter((q) => q.team === 1)) q.p[0] = sgn * (q.keeper ? 51 : 44);
    const c0 = st.players.find((p) => p.team === 0 && p.post === 5);
    const near = st.players.filter((p) => p.team === 0 && !p.keeper && ![5, post].includes(p.post)).slice(0, 3);
    c0.p[0] = 0; c0.p[2] = 0;
    near.forEach((q, i) => { q.p[0] = 2; q.p[2] = (i - 1) * 3; });
    const obs = st.players.find((p) => p.team === 0 && p.post === post);
    obs.p[0] = sgn * 20; obs.p[2] = post === 7 ? 20 : 5;
    st.ball.restart([0.3, 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c0.id);
    st.possession = { team: 0, carrier: c0.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
    st._possChangeAt = st.t - 9; st._possTeam = 0;                 // attaque PLACÉE (pas une transition)
    matchStep(st, 1 / 60, cfg);
    return { x: obs.target[0] * sgn, z: Math.abs(obs.target[2]), job: obs.job };
  };
  const poly = cible(null), neuf = cible('neufDeSurface'), men = cible('meneur');
  ok(`la PROFONDEUR est un rôle (cible du 9 : polyvalent x ${poly.x.toFixed(1)}, neufDeSurface ${neuf.x.toFixed(1)} (+2 attendu), meneur ${men.x.toFixed(1)} (−1,75) — le 9 se tient haut, le 10 décroche, MÊME monde)`,
    neuf.x - poly.x >= 1.5 && poly.x - men.x >= 1.2, `jobs ${poly.job}/${neuf.job}/${men.job}`);
  const polyA = cible(null, 7), ailier = cible('ailierDePercussion', 7);
  ok(`la LARGEUR est un rôle (aile : polyvalent |z| ${polyA.z.toFixed(1)}, percussion ${ailier.z.toFixed(1)} — l'ailier craie la ligne, ×1,08)`,
    ailier.z - polyA.z >= 1);
}

// ---------- 4. l'ARBITRE lit le RÔLE : équipe neutre, monde serré — le rôle seul départage
// (dans une équipe DIRECTE (±35 %), le rôle (±15 %) ne renverse PAS le style : mesuré, et c'est
// le contrat — « un rôle nuance, il n'écrase pas » ; la composition équipe×rôle est prouvée par
// l'identité + le banc tactics)
{
  const monde = (roleName) => {
    const st = makeMatch({ full: true, seed: 5, roles: [{ 8: roleName }, null] });
    const sgn = -st.pitch.ownGoal(0).sign;
    const goal = st.pitch.attackGoal(0);
    for (const q of st.players.filter((q) => q.team === 1)) { q.p[0] = sgn * 20; q.p[2] = -25; }
    for (const q of st.players.filter((q) => q.team === 0 && !q.keeper)) { q.p[0] = -sgn * 20; q.p[2] = 25; }
    const gk1 = st.players.find((q) => q.team === 1 && q.keeper); gk1.p[0] = goal.x; gk1.p[2] = 0;
    const c = st.players.find((p) => p.team === 0 && p.post === 8);
    c.p[0] = goal.x - sgn * 11; c.p[2] = 0;
    const wall = st.players.filter((p) => p.team === 1 && !p.keeper).slice(0, 3);
    wall[0].p[0] = goal.x - sgn * 5.5; wall[0].p[2] = 2.4;   // P/T mesuré 1,03 — la fenêtre (1 ; 1,28) où ±15 % départagent
    wall[1].p[0] = goal.x - sgn * 5.5; wall[1].p[2] = -2.4;
    wall[2].p[0] = goal.x - sgn * 5.5; wall[2].p[2] = 0;
    const mate = st.players.find((p) => p.team === 0 && p.post === 9);
    mate.p[0] = goal.x - sgn * 7; mate.p[2] = 7;
    st.ball.restart([c.p[0] + 0.3, 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c.id);
    st.possession = { team: 0, carrier: c.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
    return arbitre(st, c, matchCfg({ shotRange: 20 }));
  };
  const men = monde('meneur'), neuf = monde('neufDeSurface');
  ok(`le RÔLE départage un monde serré (équipe neutre : le meneur → « ${men.meilleure} », le 9 → « ${neuf.meilleure} » — deux joueurs, deux footballs dans le MÊME système)`,
    men.meilleure === 'passe' && neuf.meilleure === 'tir');
}

// ---------- 5. sabotage nommé « rôles placebo » : trio de 9 contre trio de meneurs ⇒ deux récits
{
  const recit = (r) => {
    const st = makeMatch({ full: true, seed: 4, roles: [r, null] });
    const cfg = matchCfg({ shotRange: 20 });
    for (let i = 0; i < 90 * 60; i++) matchStep(st, 1 / 60, cfg);
    return JSON.stringify(st.events);
  };
  ok(`sabotage « rôles placebo » attrapé (trio de neufs ≠ trio de meneurs — le rôle ÉCRIT le match)`,
    recit({ 7: 'neufDeSurface', 8: 'neufDeSurface', 9: 'neufDeSurface' }) !== recit({ 7: 'meneur', 8: 'meneur', 9: 'meneur' }));
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
