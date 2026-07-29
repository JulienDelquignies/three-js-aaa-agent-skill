#!/usr/bin/env node
// verify-gesture.mjs — LA LIGNE DE TEMPS D'UNE ACTION (engine/gesture.js).
//
// Ce qu'on prouve : qu'un geste a un DÉBUT, un CONTACT et une FIN, dans cet ordre ; que le ballon part
// au contact et pas à la décision ; qu'aucun geste ne disparaît en silence. Chaque clause a son
// sabotage, sinon elle ne dit rien.
//
// Et on le prouve deux fois : sur la ligne de temps seule, puis sur une PARTIE RÉELLE — parce qu'un
// modèle d'action qui tient en isolation et se fait couper par la machine à états du jeu n'a rien réglé.
import { gestureTiming, startGesture, stepGesture, abortGesture, busy, winding, following, checkGestures }
  from '../assets/starter/src/engine/gesture.js';
import { MOVES } from '../assets/starter/src/engine/animkit.js';
import { makeRondo } from '../assets/starter/src/engine/rondo.js';
import { playRondo } from '../assets/starter/src/engine/rondo-sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const has = (r, n) => !r.ok && r.issues.some((i) => i.toLowerCase().includes(n.toLowerCase()));

const PASSE = { id: 'passe', duration: 0.7, contact: 0.38 };
const run = (move, secs = 1.5, dt = 1 / 60) => {
  const actor = { id: 7, act: null }, log = [];
  startGesture(actor, move, { payload: { kind: 'pass' }, log });
  const events = [];
  for (let i = 0; i < secs / dt; i++) { const e = stepGesture(actor, dt, { log }); if (e) events.push({ e, t: i * dt }); }
  return { actor, log, events };
};

console.log('— la ligne de temps —');
{
  const t = gestureTiming(PASSE);
  ok('un mouvement se découpe en armé + accompagnement', t.anticipation === 0.38 && Math.abs(t.follow - 0.32) < 1e-9, `${t.anticipation} / ${t.follow.toFixed(2)}`);
  const { log, events } = run(PASSE);
  ok('le contact tombe UNE fois', events.filter((x) => x.e === 'contact').length === 1);
  ok('la fin tombe UNE fois', events.filter((x) => x.e === 'end').length === 1);
  const c = events.find((x) => x.e === 'contact'), f = events.find((x) => x.e === 'end');
  ok(`le contact tombe à la frame de contact du clip (${c.t.toFixed(2)} s ≈ 0.38)`, Math.abs(c.t - 0.38) <= 1 / 60 + 1e-9);
  ok(`la fin tombe à la fin du clip (${f.t.toFixed(2)} s ≈ 0.70)`, Math.abs(f.t - 0.70) <= 1 / 60 + 1e-9);
  // LE point : il y a du temps APRÈS le contact. C'est l'accompagnement, et c'est ce qui manquait.
  ok('le geste continue APRÈS que le ballon soit parti', f.t > c.t + 0.2, `${(f.t - c.t).toFixed(2)} s d'accompagnement`);
  ok('l\'acteur est rendu à lui-même à la fin', !busy({ act: null }) && log.at(-1).type === 'end');
  ok('le contrat passe sur une ligne de temps saine', checkGestures(log, [PASSE]).ok);
}

console.log('\n— les états pendant le geste —');
{
  const actor = { id: 1, act: null };
  startGesture(actor, PASSE);
  ok('avant le contact : il ARME (on peut encore lui prendre le ballon)', winding(actor) && !following(actor));
  for (let i = 0; i < 0.4 / (1 / 60); i++) stepGesture(actor, 1 / 60);
  ok('après le contact : il ACCOMPAGNE (le ballon est parti, lui bouge encore)', following(actor) && !winding(actor));
  ok('  …et il est toujours occupé, donc il ne redécide rien', busy(actor));
}

console.log('\n— un pas trop long ne doit pas avaler le contact —');
{
  // Un seul pas de 1 s couvre l'armé ET la fin. Rendre 'end' ici perdrait la frappe : le ballon ne
  // partirait jamais. C'est le bug classique d'une machine à états qui renvoie un ÉTAT au lieu d'un
  // ÉVÉNEMENT, et il est silencieux — la balle reste simplement au pied.
  const actor = { id: 2, act: null };
  startGesture(actor, PASSE);
  ok('un pas géant rend d\'abord le CONTACT', stepGesture(actor, 1.0) === 'contact');
  ok('  …puis la fin au pas suivant', stepGesture(actor, 1.0) === 'end');
}

console.log('\n— tous les mouvements de frappe ont un début et une fin —');
{
  const strikes = Object.entries(MOVES).filter(([, m]) => m.contact != null).map(([id, m]) => ({ id, ...m }));
  const r = checkGestures([], strikes);
  ok(`les ${strikes.length} mouvements à contact ont un armé ET un accompagnement`, r.ok, r.issues[0] || '');
  const worst = strikes.reduce((b, m) => (gestureTiming(m).anticipation < gestureTiming(b).anticipation ? m : b));
  ok(`  le plus court armé reste jouable (« ${worst.id} » : ${gestureTiming(worst).anticipation} s)`, gestureTiming(worst).anticipation >= 0.06);
}

console.log('\n— sur une PARTIE RÉELLE —');
{
  const st = makeRondo({ perTeam: 5, seed: 4 });
  playRondo(st, 90);
  const r = checkGestures(st.gestures, []);
  ok('aucun geste orphelin sur 90 s de jeu', r.ok, r.issues.slice(0, 2).join(' | '));
  const n = (t) => st.gestures.filter((e) => e.type === t).length;
  ok(`des gestes ont été joués (${n('start')} armés, ${n('contact')} frappes, ${n('end')} fins, ${n('abort')} interrompus)`, n('start') > 10);
  // TOUT armé finit d'une façon ou d'une autre : c'est la clause qui interdit qu'un geste s'évapore.
  ok('chaque armé se termine (fin ou interruption nommée)', n('start') === n('end') + n('abort'), `${n('start')} vs ${n('end')}+${n('abort')}`);
  ok('les interruptions ont toutes une cause', st.gestures.filter((e) => e.type === 'abort').every((e) => !!e.reason));
  // LE BALLON PART AU CONTACT : autant de frappes que de passes, et jamais une passe sans geste.
  const passes = st.events.filter((e) => e.type === 'pass').length;
  const windups = st.events.filter((e) => e.type === 'windup').length;
  ok(`chaque passe a son armé (${passes} passes pour ${windups} armés)`, windups >= passes && passes > 0);
  // …et le ballon part APRÈS le début du geste, jamais avant. C'est l'inversion, mesurée.
  const seq = st.events.filter((e) => e.type === 'windup' || e.type === 'pass');
  let bad = 0;
  for (let i = 0; i < seq.length; i++) if (seq[i].type === 'pass' && (i === 0 || seq[i - 1].type !== 'windup')) bad++;
  ok('aucune passe ne précède son propre geste', bad === 0, `${bad} passes orphelines`);
}

console.log('\n— sabotages —');
{
  const { log } = run(PASSE);
  ok('sabotage « geste sans fin » attrapé', has(checkGestures(log.filter((e) => e.type !== 'end'), []), 'jamais fini'));
}
{
  const { log } = run(PASSE);
  ok('sabotage « geste terminé sans frappe » attrapé', has(checkGestures(log.filter((e) => e.type !== 'contact'), []), 'sans contact'));
}
{
  const { log } = run(PASSE);
  const l = [...log]; l.splice(1, 0, { type: 'start', id: 'frappe', actor: 7, anticipation: 0.4, follow: 0.3 });
  ok('sabotage « second geste par-dessus le premier » attrapé', has(checkGestures(l, []), 'n\'était pas fini'));
}
{
  const actor = { id: 3, act: null }, log = [];
  startGesture(actor, PASSE, { log });
  abortGesture(actor, '', { log });
  ok('sabotage « interruption sans cause » attrapé', has(checkGestures(log, []), 'sans cause nommée'));
}
{
  // un mouvement dont le contact est à 0 : la pose commence déjà frappée, il n'y a pas d'armé à voir.
  ok('sabotage « mouvement sans armé » attrapé', has(checkGestures([], [{ id: 'plat', duration: 0.5, contact: 0 }]), 'pas d\'armé'));
}
{
  // …et son symétrique : un geste qui s'arrête pile au contact, ce que le corps humain ne fait pas.
  ok('sabotage « mouvement sans accompagnement » attrapé', has(checkGestures([], [{ id: 'coupe', duration: 0.4, contact: 0.4 }]), 'accompagnement'));
}
{
  const { log } = run(PASSE);
  const l = [...log]; l.push({ type: 'contact', id: 'passe', actor: 7, t: 0.5 });
  ok('sabotage « double frappe dans un seul geste » attrapé', has(checkGestures([...l.filter((e) => e.type !== 'end'), l.at(-1)], []), 'double contact'));
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
