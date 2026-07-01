#!/usr/bin/env node
/**
 * verify-temporal.mjs — validate ANIMATION-TIME correctness by sampling checks across frames:
 * foot-skate, an object detaching mid-motion, pops/teleports, loop-seam hitches, impossible speeds,
 * and foot-plant phase errors. Snapshot checks (verify-scene / verify-interaction) can't see these.
 *
 * Usage:
 *   node verify-temporal.mjs --selftest          # prove every temporal rule
 *   node verify-temporal.mjs --spec seq.json     # validate a sampled sequence (exit 0 ok / 1 fail)
 *
 * Sample your animation by stepping the AnimationMixer and recording world transforms per frame
 * (see reference/20-temporal-correctness.md). Logic: ../assets/starter/src/engine/temporal-validate.js
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENGINE = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'starter', 'src', 'engine');
const T = await import(`${ENGINE}/temporal-validate.js`);

let fails = 0;
const assert = (name, cond) => { console.log(`  ${cond ? '✓' : '✗'} ${name}`); if (!cond) fails++; };

function selftest() {
  console.log('Attachment through motion — ball stays at the foot through contact (the volley):');
  {
    // 5 frames around contact: foot and ball coincide → attached throughout
    const foot = [[0, 0.3, 0], [0.1, 0.35, 0], [0.2, 0.4, 0], [0.3, 0.45, 0], [0.4, 0.5, 0]];
    const ballOnFoot = foot.map((f) => [f[0] + 0.05, f[1], f[2]]);
    assert('ball stays at foot passes', T.attachmentThroughout(foot, ballOnFoot, 0.12).ok);
    const ballDrifts = foot.map((f, i) => [f[0] + 0.05 + (i === 3 ? 0.5 : 0), f[1], f[2]]);
    assert('ball detaching mid-contact fails', !T.attachmentThroughout(foot, ballDrifts, 0.12).ok);
  }

  console.log('\nFoot-skate — planted foot must not slide:');
  {
    const grounded = [true, true, true, true];
    const fixed = [[1, 0, 2], [1, 0, 2], [1, 0, 2], [1, 0, 2]];
    assert('locked planted foot passes', T.noFootSkate(fixed, grounded).ok);
    const sliding = [[1, 0, 2], [1.1, 0, 2], [1.2, 0, 2], [1.3, 0, 2]];
    assert('sliding planted foot fails', !T.noFootSkate(sliding, grounded).ok);
  }

  console.log('\nPops / motion limits — no teleports, no impossible speed:');
  {
    const smooth = [[0, 0, 0], [0.05, 0, 0], [0.1, 0, 0], [0.15, 0, 0]];
    assert('smooth motion passes', T.noPops(smooth).ok);
    const teleport = [[0, 0, 0], [0.05, 0, 0], [3.0, 0, 0], [3.05, 0, 0]];
    assert('teleport pop fails', !T.noPops(teleport).ok);
    assert('plausible speed passes', T.withinMotionLimits(smooth).ok);
    assert('supersonic hand fails', !T.withinMotionLimits(teleport).ok);
  }

  console.log('\nLoop seam — a looping clip matches at the seam:');
  {
    const first = [[0, 1, 0], [0.2, 1, 0]];
    assert('matched loop endpoints pass', T.loopSeam(first, [[0, 1, 0], [0.2, 1, 0]]).ok);
    assert('loop hitch fails', !T.loopSeam(first, [[0.3, 1, 0], [0.2, 1, 0]]).ok);
  }

  console.log('\nFoot-plant phase — no floating walk, no double-planted skate:');
  {
    const L = [true, false, true, false, true], Rr = [false, true, false, true, false];
    const root = [[0, 0, 0], [0.1, 0, 0], [0.2, 0, 0], [0.3, 0, 0], [0.4, 0, 0]];
    assert('alternating gait passes', T.footPlantPhase(L, Rr, root).ok);
    const airborne = [false, false, false, false, false];
    assert('both-feet-airborne walk fails', !T.footPlantPhase(airborne, airborne, root).ok);
    const bothDown = [true, true, true, true, true];
    assert('root sliding while both planted fails (skate)', !T.footPlantPhase(bothDown, bothDown, root).ok);
  }

  console.log('\nInteraction sync — two effectors meet in the window:');
  {
    const a = [[0, 1, 0], [0.3, 1, 0], [0.6, 1, 0]], b = [[1.2, 1, 0], [0.9, 1, 0], [0.61, 1, 0]];
    assert('hands meeting passes', T.interactionMeet(a, b).ok);
    const bMiss = [[1.2, 1, 0], [1.1, 1, 0], [1.0, 1, 0]];
    assert('hands missing fails', !T.interactionMeet(a, bMiss).ok);
  }

  console.log(`\n${fails === 0 ? '✓ ALL SELF-TESTS PASSED' : `✗ ${fails} SELF-TEST(S) FAILED`}`);
  return fails === 0;
}

const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) { console.log('Usage: verify-temporal.mjs --selftest | --spec <file.json>'); process.exit(0); }
if (argv.includes('--selftest')) process.exit(selftest() ? 0 : 1);
const si = argv.indexOf('--spec');
if (si !== -1 && argv[si + 1]) {
  let spec; try { spec = JSON.parse(readFileSync(resolve(argv[si + 1]), 'utf8')); } catch (e) { console.error(`error: ${e.message}`); process.exit(1); }
  const rep = T.validateSequence(spec);
  for (const c of rep.checks) console.log(`  ${c.ok ? '✓' : '✗'} ${(c.name || '').padEnd(18)} ${c.detail}`);
  console.log(`\n${rep.ok ? '✓ sequence VALID' : `✗ sequence INVALID (${rep.failed.join(', ')})`}`);
  process.exit(rep.ok ? 0 : 1);
}
console.log('Nothing to do. Try --selftest or --spec <file.json>.');
process.exit(1);
