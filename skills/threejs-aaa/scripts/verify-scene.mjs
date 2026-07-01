#!/usr/bin/env node
/**
 * verify-scene.mjs — validate scene SEMANTIC/SPATIAL correctness (the AAA placement rules the skill
 * owns, not the user): support (rests on, not through), non-penetration (furniture through wall),
 * facing/orientation (chair faces desk, sit orientation), containment (door in a wall opening),
 * attachment (ball at the foot, not through the body). Prints violations + suggested fixes.
 *
 * Usage:
 *   node verify-scene.mjs --selftest            # prove every rule on canonical examples
 *   node verify-scene.mjs --spec scene.json     # validate a declared scene (exit 0 ok / 1 fail)
 *
 * Logic lives in ../assets/starter/src/engine/scene-validate.js so the SAME checks run at runtime
 * (gate/auto-correct placement while building the scene) and headless in CI.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ENGINE = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'starter', 'src', 'engine');
const S = await import(`${ENGINE}/scene-validate.js`);
const vm = await import(`${ENGINE}/vecmath.js`);

const box = (c, e, q = [0, 0, 0, 1]) => ({ c, e, q });
const qY = (deg) => vm.quatFromAxisAngle([0, 1, 0], deg * vm.RAD);

let fails = 0;
const assert = (name, cond) => { console.log(`  ${cond ? '✓' : '✗'} ${name}`); if (!cond) fails++; };

function selftest() {
  console.log('Support — plant ON a table (not through):');
  {
    const table = box([0, 0.375, 0], [0.6, 0.375, 0.6]);         // top at y=0.75
    const plantOK = box([0, 0.9, 0], [0.15, 0.15, 0.15]);        // underside at 0.75
    assert('plant resting on table passes', S.restsOn(plantOK, table).ok);
    const plantThrough = box([0, 0.55, 0], [0.15, 0.15, 0.15]);  // sunk into the table
    const r = S.restsOn(plantThrough, table);
    assert('plant sunk into table fails', !r.ok);
    assert('  → suggests a corrected Y (snap onto top)', Math.abs(r.fix.position[1] - 0.9) < 1e-6);
    const floating = box([0, 1.4, 0], [0.15, 0.15, 0.15]);
    assert('floating plant fails', !S.restsOn(floating, table).ok);
  }

  console.log('\nNon-penetration — furniture must not go through a wall:');
  {
    const wall = box([0, 1, 0], [3, 1, 0.1]);                    // thin wall in the z=0 plane
    const cabinetOK = box([0, 0.5, 0.55], [0.4, 0.5, 0.4]);      // in front of the wall
    assert('cabinet in front of wall passes', S.noPenetration(cabinetOK, wall).ok);
    const cabinetThrough = box([0, 0.5, 0.05], [0.4, 0.5, 0.4]); // straddling the wall
    const r = S.noPenetration(cabinetThrough, wall);
    assert('cabinet through wall fails', !r.ok);
    assert('  → suggests a push-out position', r.fix && Math.abs(r.fix.position[2]) > Math.abs(cabinetThrough.c[2]));
  }

  console.log('\nOrientation — chair faces the desk; sit pose is correct:');
  {
    const desk = box([0, 0.4, 2], [0.8, 0.4, 0.5]);
    const chairOK = box([0, 0.45, 0.6], [0.25, 0.45, 0.25], qY(0));   // +Z faces the desk
    assert('chair facing desk passes', S.facing(chairOK, desk.c).ok);
    const chairAway = box([0, 0.45, 0.6], [0.25, 0.45, 0.25], qY(180));
    assert('chair turned away fails', !S.facing(chairAway, desk.c).ok);
    // sit: pelvis on the seat, oriented like the chair
    const seat = box([0, 0.45, 0.6], [0.24, 0.04, 0.24]);            // seat top y=0.49
    const pelvisOK = box([0, 0.59, 0.6], [0.2, 0.1, 0.16]);          // underside at 0.49
    const sitGood = S.sitPose(pelvisOK, seat, qY(0), qY(0));
    assert('sitting: buttocks on seat + aligned passes', sitGood.every((c) => c.ok));
    const pelvisFloat = box([0, 0.9, 0.6], [0.2, 0.1, 0.16]);
    const sitFloat = S.sitPose(pelvisFloat, seat, qY(0), qY(0));
    assert('sitting above the seat fails (seatContact)', sitFloat.find((c) => c.name === 'seatContact').ok === false);
    const sitTwist = S.sitPose(pelvisOK, seat, qY(90), qY(0));
    assert('sitting facing the wrong way fails (sitOrientation)', sitTwist.find((c) => c.name === 'sitOrientation').ok === false);
  }

  console.log('\nContainment — a door correctly set into a wall opening:');
  {
    const wall = { c: [0, 1.2, 0], normal: [0, 0, 1], halfThickness: 0.12, tU: [1, 0, 0], tV: [0, 1, 0], openCenter: [0, 1.05, 0], openHalf: [0.5, 1.05] };
    const doorOK = box([0, 1.05, 0], [0.46, 1.0, 0.05], qY(0));     // in the plane, fits opening
    assert('door set in the opening passes', S.insideOpening(doorOK, wall).ok);
    const doorTurned = box([0, 1.05, 0], [0.46, 1.0, 0.05], qY(90)); // face no longer along wall normal
    assert('door rotated 90° fails (misaligned)', !S.insideOpening(doorTurned, wall).ok);
    const doorThrough = box([0, 1.05, 0.6], [0.46, 1.0, 0.05], qY(0)); // sticking out of the wall
    const r = S.insideOpening(doorThrough, wall);
    assert('door sticking through the wall fails', !r.ok);
    assert('  → suggests pulling it onto the wall plane', Math.abs(r.fix.position[2]) < 1e-6);
    const doorBig = box([0, 1.05, 0], [0.9, 1.0, 0.05], qY(0));      // wider than the opening
    assert('door bigger than opening fails (containment)', !S.insideOpening(doorBig, wall).ok);
  }

  console.log('\nAttachment — ball at the foot for a volley, not through the body:');
  {
    const body = box([0, 1.0, 0], [0.3, 0.9, 0.2]);                 // torso+legs box
    const footTip = [0.42, 0.35, 0];
    const ballOK = { c: [0.5, 0.4, 0], radius: 0.12 };
    assert('ball at the foot tip, clear of body passes', S.attachment(ballOK, footTip, body).ok);
    const ballInBody = { c: [0.05, 1.0, 0], radius: 0.12 };
    assert('ball inside the body fails (through body)', !S.attachment(ballInBody, footTip, body).ok);
    const ballFar = { c: [1.2, 0.4, 0], radius: 0.12 };
    assert('ball far from the foot fails', !S.attachment(ballFar, footTip, body).ok);
  }

  console.log('\nStructure orientation — the goal/door faces the right way (the football bug):');
  {
    const pitchCentre = [0, 1, 0];
    const goalOK = box([30, 1.35, 0], [0.1, 1.35, 4], qY(-90));      // mouth faces -X toward the pitch
    assert('goal facing the pitch passes', S.facing(goalOK, pitchCentre).ok);
    const goalWrong = box([30, 1.35, 0], [0.1, 1.35, 4], qY(90));    // faces away
    assert('goal facing away fails', !S.facing(goalWrong, pitchCentre).ok);
  }

  console.log('\nHeld in hand — object gripped, not clipping the body:');
  {
    const body = box([0, 1.0, 0], [0.3, 0.9, 0.2]);
    const sword = box([0.9, 1.0, 0], [0.05, 0.5, 0.05]);
    const hand = [0.55, 1.0, 0], grip = [0.55, 1.0, 0];
    assert('sword gripped at hand, clear of body passes', S.heldInHand(sword, grip, hand, body).every((c) => c.ok));
    assert('grip far from hand fails', !S.heldInHand(sword, [0.2, 1.0, 0], hand, body).find((c) => c.name === 'gripAtHand').ok);
    const swordThroughBody = box([0.05, 1.0, 0], [0.05, 0.5, 0.05]);
    assert('sword clipping body fails', !S.heldInHand(swordThroughBody, grip, hand, body).find((c) => c.name === 'clearOfBody').ok);
  }

  console.log('\nGravity/support — nothing floats:');
  {
    const table = box([2, 0.375, 0], [0.6, 0.375, 0.6]);
    assert('box on ground passes', S.supported(box([0, 0.5, 0], [0.3, 0.5, 0.3]), { groundY: 0 }).ok);
    assert('box on a table passes', S.supported(box([2, 0.9, 0], [0.15, 0.15, 0.15]), { supports: [table], groundY: 0 }).ok);
    const r = S.supported(box([0, 2, 0], [0.3, 0.5, 0.3]), { groundY: 0 });
    assert('floating box fails', !r.ok);
    assert('  → suggests dropping it to the ground', Math.abs(r.fix.position[1] - 0.5) < 1e-6);
  }

  console.log('\nUpright / stability / scale:');
  {
    assert('upright bottle passes', S.upright(box([0, 0.2, 0], [0.05, 0.15, 0.05], qY(0))).ok);
    assert('tipped bottle fails', !S.upright(box([0, 0.2, 0], [0.05, 0.15, 0.05], vm.quatFromAxisAngle([1, 0, 0], 40 * vm.RAD))).ok);
    const support = box([0, 0.375, 0], [0.6, 0.375, 0.6]);
    assert('object centred over base is stable', S.stableOnBase(box([0, 0.9, 0], [0.1, 0.15, 0.1]), support).ok);
    assert('object past the base topples', !S.stableOnBase(box([1.2, 0.9, 0], [0.1, 0.15, 0.1]), support).ok);
    assert('plausible door size passes', S.withinScale(box([0, 1.05, 0], [0.45, 1.0, 0.05]), 'door').ok);
    assert('giant chair fails scale', !S.withinScale(box([0, 1.6, 0], [0.3, 1.6, 0.3]), 'chair').ok);
  }

  console.log('\nContinuity / containment / flush / clearance:');
  {
    assert('connected road segments pass', S.connected([0, 0, 0], [0.02, 0, 0]).ok);
    assert('disconnected segments fail', !S.connected([0, 0, 0], [0.5, 0, 0]).ok);
    const room = box([0, 1.5, 0], [2, 1.5, 2]);
    assert('object inside room passes', S.containedWithin(box([0, 1, 0], [0.2, 0.2, 0.2]), room).ok);
    assert('object poking outside fails', !S.containedWithin(box([0, 3.2, 0], [0.2, 0.2, 0.2]), room).ok);
    const wall = { point: [0, 1, 0], normal: [0, 0, 1] };
    assert('cabinet flush against wall passes', S.flushAgainst(box([0, 1, 0.4], [0.4, 0.9, 0.4]), wall).ok);
    const rg = S.flushAgainst(box([0, 1, 1.0], [0.4, 0.9, 0.4]), wall);
    assert('cabinet gapped from wall fails', !rg.ok);
    assert('  → suggests sliding it flush', Math.abs(rg.fix.position[2] - 0.4) < 1e-6);
    assert('enough clearance passes', S.clearance(box([0, 1, 0], [0.5, 0.5, 0.5]), box([2, 1, 0], [0.5, 0.5, 0.5]), 0.8).ok);
    assert('too little clearance fails', !S.clearance(box([0, 1, 0], [0.5, 0.5, 0.5]), box([1.2, 1, 0], [0.5, 0.5, 0.5]), 0.8).ok);
  }

  console.log('\nContinuity — roads/pipes connect, fence runs, terrain seams:');
  {
    const a = { start: [0, 0, 0], end: [10, 0, 0] };
    assert('aligned connected segments pass', S.tangentContinuity(a, { start: [10, 0, 0], end: [20, 0, 0] }).ok);
    assert('gapped segments fail', !S.tangentContinuity(a, { start: [11, 0, 0], end: [20, 0, 0] }).ok);
    assert('kinked segments fail', !S.tangentContinuity(a, { start: [10, 0, 0], end: [12, 0, 8] }).ok);
    assert('continuous fence run passes', S.runContinuity([{ start: [0, 0, 0], end: [2, 0, 0], top: 1 }, { start: [2, 0, 0], end: [4, 0, 0], top: 1 }]).ok);
    assert('broken fence run fails', !S.runContinuity([{ start: [0, 0, 0], end: [2, 0, 0], top: 1 }, { start: [2.5, 0, 0], end: [4, 0, 0], top: 1 }]).ok);
    assert('matching terrain seam passes', S.seamHeightsMatch([1, 1.2, 1.4], [1, 1.2, 1.4]).ok);
    assert('mismatched seam fails (crack)', !S.seamHeightsMatch([1, 1.2, 1.4], [1, 1.9, 1.4]).ok);
  }

  console.log('\nNavigation — headroom, doorway, stairs, reachability:');
  {
    assert('enough headroom passes', S.headroom(2.4).ok);
    assert('low ceiling fails', !S.headroom(1.7).ok);
    assert('passable doorway passes', S.doorwayPassable(0.9, 2.1).ok);
    assert('tiny doorway fails', !S.doorwayPassable(0.5, 1.6).ok);
    assert('uniform climbable stairs pass', S.stepsTraversable([0.17, 0.17, 0.17, 0.17]).ok);
    assert('too-tall step fails', !S.stepsTraversable([0.17, 0.6, 0.17]).ok);
    const adj = { spawn: ['a'], a: ['b', 'spawn'], b: ['a'], island: [] };
    assert('reachable objective passes', S.reachable(adj, 'spawn', ['a', 'b']).ok);
    assert('unreachable objective fails', !S.reachable(adj, 'spawn', ['island']).ok);
  }

  console.log('\nRelative scale / duplicates / units:');
  {
    assert('table/seat ratio plausible passes', S.relativeScale(0.74, 0.45, [1.4, 1.9], 'table/seat').ok);
    assert('chair taller than table fails', !S.relativeScale(0.45, 0.74, [1.4, 1.9], 'table/seat').ok);
    assert('distinct meshes pass', S.noCoincidentDupe(box([0, 0, 0], [1, 1, 1]), box([3, 0, 0], [1, 1, 1])).ok);
    assert('coincident duplicate fails', !S.noCoincidentDupe(box([0, 0, 0], [1, 1, 1]), box([0, 0, 0], [1, 1, 1])).ok);
    assert('correct unit scale passes', S.unitSanity(2.0, 2.0).ok);
    assert('cm-imported asset (×100) fails', !S.unitSanity(200, 2.0).ok);
  }

  console.log(`\n${fails === 0 ? '✓ ALL SELF-TESTS PASSED' : `✗ ${fails} SELF-TEST(S) FAILED`}`);
  return fails === 0;
}

const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) { console.log('Usage: verify-scene.mjs --selftest | --spec <file.json>'); process.exit(0); }
if (argv.includes('--selftest')) process.exit(selftest() ? 0 : 1);
const si = argv.indexOf('--spec');
if (si !== -1 && argv[si + 1]) {
  let spec; try { spec = JSON.parse(readFileSync(resolve(argv[si + 1]), 'utf8')); } catch (e) { console.error(`error: ${e.message}`); process.exit(1); }
  const rep = S.validateScene(spec);
  for (const c of rep.checks) console.log(`  ${c.ok ? '✓' : '✗'} ${(c.name || '').padEnd(16)} ${c.detail}`);
  if (rep.fixes.length) { console.log('\nsuggested fixes:'); for (const f of rep.fixes) console.log(`  ${f.constraint.type}: ${JSON.stringify(f.fix)}`); }
  console.log(`\n${rep.ok ? '✓ scene VALID' : `✗ scene INVALID (${rep.failed.join(', ')})`}`);
  process.exit(rep.ok ? 0 : 1);
}
console.log('Nothing to do. Try --selftest or --spec <file.json>.');
process.exit(1);
