#!/usr/bin/env node
// verify-football-rules.mjs — LE CATALOGUE DES CHOSES IMPOSSIBLES AU FOOT (engine/football-rules.js).
//
// Deux choses sont prouvées ici, et la seconde est la seule qui compte vraiment :
//   1. l'état du jeu réel face au catalogue — combien de règles il viole, et de combien ;
//   2. que CHAQUE règle mord. Une règle sans sabotage nommé n'est pas un contrat, c'est une bonne
//      intention : on ne saura jamais si elle est verte parce que le jeu est correct ou parce qu'elle
//      ne regarde rien. Il y a donc exactement un sabotage par règle, et il doit déclencher CETTE
//      règle-là — pas une autre.
import { makeRondo, RONDO } from '../assets/starter/src/engine/rondo.js';
import { playRondo } from '../assets/starter/src/engine/rondo-sim.js';
import { FOOT_RULES, FOOT_LIMITS, checkFootball } from '../assets/starter/src/engine/football-rules.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

const game = (seed = 4, secs = 90) => {
  const st = makeRondo({ perTeam: 5, seed });
  const { trace } = playRondo(st, secs);
  return { st, trace };
};
/** deep copy of a game so a sabotage cannot leak into the next one */
const copy = (g) => ({ st: { ...g.st, area: [...g.st.area], events: JSON.parse(JSON.stringify(g.st.events)) }, trace: JSON.parse(JSON.stringify(g.trace)) });

const base = game();

console.log(`— le catalogue : ${FOOT_RULES.length} règles —`);
{
  const ids = FOOT_RULES.map((r) => r.id);
  ok('chaque règle a un id unique', new Set(ids).size === ids.length);
  ok('chaque règle dit CE QU\'ELLE INTERDIT et POURQUOI', FOOT_RULES.every((r) => r.title && r.why && r.why.length > 40));
  ok('chaque règle a une portée connue', FOOT_RULES.every((r) => ['frame', 'pair', 'event', 'events'].includes(r.scope)));
  ok('les règles d\'événement nomment leur événement (ou balaient tout)', FOOT_RULES.filter((r) => r.scope === 'event').every((r) => r.on));
}

console.log('\n— l\'état du jeu réel —');
{
  const r = checkFootball(base.st, base.trace);
  const green = Object.values(r.byRule).filter((v) => !v.violations).length;
  ok(`${green}/${FOOT_RULES.length} règles vertes sur une partie réelle`, green >= FOOT_RULES.length - 5,
    Object.entries(r.byRule).filter(([, v]) => v.violations).map(([id, v]) => `${id} ${v.pct}%`).join(', '));
  // les règles qui DOIVENT être vertes : ce sont des impossibilités physiques, pas des questions de style
  for (const id of ['ball-above-ground', 'ball-in-play', 'ball-no-teleport', 'player-top-speed',
    'players-in-the-box', 'one-carrier', 'pass-has-a-striker', 'correct-foot', 'strike-speed',
    'foot-height', 'ball-in-reach-at-strike', 'no-machine-gun-touches']) {
    ok(`  « ${id} » : aucune violation`, r.byRule[id].violations === 0, r.byRule[id].first || '');
  }
  // celles qui restent sont des dettes MESURÉES, pas des inconnues — on les borne pour éviter la dérive
  const budget = { 'technique-legal': 1, 'no-crossed-legs': 1, 'slide-in-range': 1, 'ball-ahead-at-strike': 10, 'carrier-owns-the-ball': 30, 'carry-reach': 2, 'not-inside-a-body': 4, 'players-not-overlapping': 2, 'ball-no-free-energy': 1 };
  for (const [id, max] of Object.entries(budget)) {
    ok(`  « ${id} » sous son budget de dette (${r.byRule[id].pct}% ≤ ${max}%)`, r.byRule[id].pct <= max, r.byRule[id].first || '');
  }
}

console.log('\n— un sabotage par règle : chacune doit mordre —');
const fires = (id, g) => {
  const r = checkFootball(g.st, g.trace);
  return r.byRule[id].violations > 0;
};
const sab = (id, label, mutate) => {
  const g = copy(base);
  mutate(g);
  const bit = fires(id, g);
  ok(`${id} — sabotage « ${label} »`, bit, bit ? '' : 'LA RÈGLE N\'A RIEN VU');
};

sab('ball-ahead-at-strike', 'passe frappée avec le ballon dans le dos',
  (g) => { for (const e of g.st.events) if (e.type === 'pass') { e.bearing = 170; e.style = 'ground'; } });
sab('ball-in-reach-at-strike', 'ballon frappé à 4 m du pied',
  (g) => { for (const e of g.st.events) if (e.type === 'pass') e.ballDist = 4; });
sab('foot-height', 'passe « du pied » sur un ballon à hauteur de tête',
  (g) => { for (const e of g.st.events) if (e.type === 'pass') e.ballY = 1.7; });
sab('strike-speed', 'frappe à 80 m/s',
  (g) => { for (const e of g.st.events) if (e.type === 'pass') e.speed = 80; });
sab('carrier-owns-the-ball', 'un adversaire plus proche du ballon que le porteur',
  (g) => { for (const s of g.trace) { if (s.phase !== 'carry' || s.carrier < 0) continue; const f = s.players.find((p) => p.team !== s.team); if (f) f.p = [s.ball[0], s.ball[2]]; } });
sab('carry-reach', 'le porteur abandonne son ballon à 10 m',
  (g) => { for (const s of g.trace) { if (s.phase !== 'carry' || s.carrier < 0) continue; const c = s.players.find((p) => p.id === s.carrier); if (c) c.p = [s.ball[0] + 10, s.ball[2]]; } });
sab('not-inside-a-body', 'ballon à l\'intérieur d\'un joueur',
  (g) => { for (const s of g.trace) { s.ball[1] = 0.11; s.players[0].p = [s.ball[0], s.ball[2]]; } });
sab('ball-above-ground', 'ballon sous la pelouse',
  (g) => { g.trace[10].ball[1] = -0.4; });
sab('ball-in-play', 'ballon parti à 90 m',
  (g) => { g.trace[10].ball[0] = 90; });
sab('ball-no-teleport', 'ballon téléporté entre deux images',
  (g) => { g.trace[10].ball[0] += 60; });
sab('ball-no-free-energy', 'ballon qui remonte tout seul en plein vol',
  (g) => { for (let i = 1; i < g.trace.length; i++) { g.trace[i - 1].phase = 'flight'; g.trace[i].phase = 'flight'; g.trace[i - 1].ball[1] = 1; g.trace[i].ball[1] = 3; } });
sab('player-top-speed', 'joueur à 40 m/s',
  (g) => { g.trace[10].players[0].speed = 40; });
sab('players-not-overlapping', 'deux joueurs au même point',
  (g) => { g.trace[10].players[1].p = [...g.trace[10].players[0].p]; });
sab('players-in-the-box', 'joueur hors de l\'aire de jeu',
  (g) => { g.trace[10].players[0].p = [90, 0]; });
sab('one-carrier', 'phase « conduite » sans porteur',
  (g) => { for (const s of g.trace) { s.phase = 'carry'; s.carrier = -1; } });
sab('pass-has-a-striker', 'passe d\'un joueur vers lui-même',
  (g) => { for (const e of g.st.events) if (e.type === 'pass') e.to = e.from; });
sab('correct-foot', 'frappe sans pied identifié',
  (g) => { for (const e of g.st.events) if (e.type === 'pass') e.foot = 'aucun'; });
sab('no-machine-gun-touches', 'le même joueur frappe deux fois en 30 ms',
  (g) => { const p = g.st.events.filter((e) => e.type === 'pass'); if (p.length > 1) { p[1].from = p[0].from; p[1].t = p[0].t + 0.03; } });
sab('technique-legal', 'un amorti de la poitrine sur un ballon au sol',
  (g) => { for (const e of g.st.events) if (e.tech) { e.tech = 'amorti-poitrine'; e.surface = 'chest'; e.foot = 'none'; e.height = 0.11; } });
sab('no-crossed-legs', 'intérieur du pied droit sur un ballon arrivant à gauche',
  (g) => { for (const e of g.st.events) if (e.tech) { e.side = 'left'; e.foot = 'right'; e.surface = 'inside'; e.bearing = 60; } });
sab('slide-in-range', 'tacle glissé déclenché à 12 m du ballon',
  (g) => { let n = 0; for (const e of g.st.events) if (e.type === 'slide') { e.dist = 12; n++; }
    if (!n) g.st.events.push({ t: 1, type: 'slide', by: 0, dist: 12, tech: 'tacle-glisse' }); });

{
  const covered = new Set(['ball-ahead-at-strike', 'ball-in-reach-at-strike', 'foot-height', 'strike-speed',
    'carrier-owns-the-ball', 'carry-reach', 'not-inside-a-body', 'ball-above-ground', 'ball-in-play',
    'ball-no-teleport', 'ball-no-free-energy', 'player-top-speed', 'players-not-overlapping',
    'players-in-the-box', 'one-carrier', 'pass-has-a-striker', 'correct-foot', 'no-machine-gun-touches',
    'technique-legal', 'no-crossed-legs', 'slide-in-range']);
  const missing = FOOT_RULES.map((r) => r.id).filter((id) => !covered.has(id));
  ok('AUCUNE règle sans sabotage (le catalogue ne peut pas grossir en silence)', missing.length === 0, missing.join(', '));
}

console.log('\n— la talonnade est la seule exception au cône avant —');
{
  const g = copy(base);
  for (const e of g.st.events) if (e.type === 'pass') { e.bearing = 170; e.style = 'talonnade'; }
  ok('un ballon frappé dans le dos EN TALONNADE est légal', !fires('ball-ahead-at-strike', g));
  const g2 = copy(base);
  for (const e of g2.st.events) if (e.type === 'pass') { e.bearing = 170; e.style = 'ground'; }
  ok('  …mais pas au pied normal', fires('ball-ahead-at-strike', g2));
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
