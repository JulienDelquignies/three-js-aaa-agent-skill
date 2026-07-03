#!/usr/bin/env node
// verify-gamestate.mjs — the FM data layer (engine/game-state.js): deterministic roster/budget for a
// given (seed, level), squad quality growing with the level, ratings bounded, message/unread flow.
import { makeGameState } from '../assets/starter/src/engine/game-state.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

const snap = (s) => JSON.stringify({ b: s.budget, p: s.players });
ok('déterministe (même seed → même effectif)', snap(makeGameState({ seed: 4, level: 2 })) === snap(makeGameState({ seed: 4, level: 2 })));
ok('le seed change l’effectif', snap(makeGameState({ seed: 4, level: 2 })) !== snap(makeGameState({ seed: 5, level: 2 })));
const avg = (l) => { const s = makeGameState({ seed: 3, level: l }); return s.players.reduce((a, p) => a + p.note, 0) / s.players.length; };
ok('qualité d’effectif croissante avec le niveau', avg(1) < avg(2) && avg(2) < avg(4), `${avg(1).toFixed(1)} → ${avg(4).toFixed(1)}`);
{
  const s = makeGameState({ seed: 7, level: 3 });
  ok('effectif complet (G/D/M/A, 14 joueurs)', s.players.length === 14 && ['G', 'D', 'M', 'A'].every((p) => s.players.some((x) => x.poste === p)));
  ok('notes bornées (30–88)', s.players.every((p) => p.note >= 30 && p.note <= 88));
  ok('budget croissant avec le niveau', makeGameState({ seed: 7, level: 1 }).budget < makeGameState({ seed: 7, level: 4 }).budget);
  const u0 = s.unread;
  s.addMessage({ from: 'Agent', text: 'test' });
  ok('message reçu → non-lu incrémenté', s.messages[0].text === 'test' && s.unread === u0 + 1);
  s.markRead();
  ok('ouverture des messages → badge remis à zéro', s.unread === 0);
}
{
  const s2 = makeGameState({ seed: 9, level: 3 });
  const a = s2.scoutTrip('train'), b = s2.scoutTrip('jet');
  ok('voyages de scouting → shortlist + rapports', s2.shortlist.length === 2 && s2.messages[0].from === 'Chef du scouting' && a.mode === 'train' && b.mode === 'jet');
  const avgJ = [1, 2, 3, 4, 5].map(() => makeGameState({ seed: 9, level: 3 })).map((st) => st.scoutTrip('jet').note);
  ok('déterminisme du scouting (même état → même prospect)', new Set(avgJ).size === 1, `${avgJ[0]}`);
}
{
  const s3 = makeGameState({ seed: 9, level: 3 });
  ok('forme au départ : 100', s3.forme === 100);
  s3.scoutTrip('train'); const fTrain = s3.forme;
  s3.scoutTrip('jet');
  ok('les voyages fatiguent (jet > train)', fTrain < 100 && s3.forme < fTrain, `100 → ${fTrain} → ${s3.forme}`);
  const r = s3.vacation();
  ok('vacances → forme restaurée + message', s3.forme === 100 && r.gained > 0 && s3.messages[0].text.includes('vacances'));
  for (let i = 0; i < 12; i++) s3.scoutTrip('jet');
  ok('forme bornée à 0 (jamais négative)', s3.forme === 0);
}
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
