#!/usr/bin/env node
/**
 * verify-interaction.mjs — validate a character↔object interaction (orientation, reach, hand-on-
 * target, feet on ground) and print a pass/fail report. Also self-tests the procedural-animation
 * and interaction math.
 *
 * Usage:
 *   node verify-interaction.mjs --spec interaction.json   # validate a spec, exit 0=ok / 1=fail
 *   node verify-interaction.mjs --selftest                # run built-in assertions (IK/align/validate)
 *   node verify-interaction.mjs --example                 # print an example spec to stdout
 *
 * The validation logic lives in ../assets/starter/src/engine/{interaction,procedural,vecmath}.js
 * so the SAME code runs in the browser at runtime and here in headless CI.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = resolve(HERE, '..', 'assets', 'starter', 'src', 'engine');
const { validateInteraction, alignToSocket, socketWorld } = await import(`${ENGINE}/interaction.js`);
const { twoBoneIK } = await import(`${ENGINE}/procedural.js`);
const vm = await import(`${ENGINE}/vecmath.js`);

function printReport(report) {
  for (const c of report.checks) {
    console.log(`  ${c.ok ? '✓' : '✗'} ${c.name.padEnd(14)} ${c.detail}`);
  }
  console.log(`\n${report.ok ? '✓ interaction VALID' : `✗ interaction INVALID (failed: ${report.failed.join(', ')})`}`);
  return report.ok;
}

const EXAMPLE = {
  // A character reaching to grab a lever on a wall panel.
  actor: { pos: [0, 0, 0], quat: [0, 0, 0, 1], radius: 0.35 },
  object: {
    pos: [0, 1.1, 0.7], quat: [0, 0, 0, 1], radius: 0.15,
    socket: { pos: [0, 0, -0.05], quat: [0, 0, 0, 1] }, // grip point on the object's near face
  },
  effector: { pos: [0, 1.1, 0.65], quat: [0, 0, 0, 1] }, // the hand
  feet: [[0.12, 0, 0], [-0.12, 0, 0]],
  groundY: 0,
  tolerances: { pos: 0.05, facingDeg: 30, orientDeg: 20, reach: 1.4, ground: 0.03 },
};

// ---------------- self-test ----------------
let failures = 0;
const approx = (a, b, eps = 1e-4) => Math.abs(a - b) <= eps;
function assert(name, cond) {
  console.log(`  ${cond ? '✓' : '✗'} ${name}`);
  if (!cond) failures++;
}

function selftest() {
  console.log('Two-bone IK:');
  {
    const root = [0, 0, 0], lenA = 1, lenB = 1;
    const target = [1.2, 0.5, 0];
    const ik = twoBoneIK(root, target, lenA, lenB, [0, 0, 1]);
    assert('upper-bone length preserved', approx(vm.dist(ik.root, ik.mid), lenA));
    assert('fore-bone length preserved', approx(vm.dist(ik.mid, ik.end), lenB));
    assert('reachable target flagged reachable', ik.reachable === true);
    // out of reach:
    const far = twoBoneIK(root, [5, 0, 0], lenA, lenB, [0, 0, 1]);
    assert('out-of-reach flagged', far.reachable === false);
    assert('out-of-reach limb fully extended', approx(vm.dist(far.root, far.end), lenA + lenB, 1e-3));
    // exact-reach midpoint sanity (straight target at distance 2 → mid at 1):
    const straight = twoBoneIK(root, [1.9999, 0, 0], lenA, lenB, [0, 1, 0]);
    assert('near-full-extension keeps bone lengths', approx(vm.dist(straight.mid, straight.end), lenB, 1e-2));
  }

  console.log('\nalignToSocket (position + orientation):');
  {
    const objectXf = { pos: [2, 1, 0], quat: vm.quatFromAxisAngle([0, 1, 0], Math.PI / 3) };
    const objectSocket = { pos: [0, 0, -0.1], quat: vm.quatFromAxisAngle([0, 1, 0], Math.PI) };
    const charAttach = { pos: [0.05, 1.0, 0.1], quat: vm.quatFromAxisAngle([0, 1, 0], -Math.PI / 6) };
    const placed = alignToSocket(objectXf, objectSocket, charAttach);
    // After placing the character, its attach point world transform must equal the object socket.
    const charAttachWorld = socketWorld({ pos: placed.pos, quat: placed.quat }, charAttach);
    const objSocketWorld = socketWorld(objectXf, objectSocket);
    assert('attach position matches socket', vm.dist(charAttachWorld.pos, objSocketWorld.pos) < 1e-4);
    assert('attach orientation matches socket', vm.quatAngle(charAttachWorld.quat, objSocketWorld.quat) < 1e-3);
  }

  console.log('\nvalidateInteraction (correct case passes):');
  {
    const r = validateInteraction(EXAMPLE);
    assert('valid grab passes all checks', r.ok === true);
  }

  console.log('\nvalidateInteraction (bad cases fail the RIGHT checks):');
  {
    // Hand far from target → onTarget + (maybe) reach fail.
    const badHand = structuredClone(EXAMPLE);
    badHand.effector.pos = [0.6, 1.1, 0.65];
    const r1 = validateInteraction(badHand);
    assert('hand-off-target fails onTarget', r1.failed.includes('onTarget'));

    // Character turned away → facing fails.
    const badFacing = structuredClone(EXAMPLE);
    badFacing.actor.quat = vm.quatFromAxisAngle([0, 1, 0], Math.PI); // face -Z, away from object
    const r2 = validateInteraction(badFacing);
    assert('turned-away fails facing', r2.failed.includes('facing'));

    // Hand rotated 90° off the grip → orientation fails.
    const badOrient = structuredClone(EXAMPLE);
    badOrient.effector.quat = vm.quatFromAxisAngle([1, 0, 0], Math.PI / 2);
    const r3 = validateInteraction(badOrient);
    assert('wrong wrist rotation fails orientation', r3.failed.includes('orientation'));

    // Foot floating → groundContact fails.
    const badFeet = structuredClone(EXAMPLE);
    badFeet.feet = [[0.12, 0.2, 0], [-0.12, 0, 0]];
    const r4 = validateInteraction(badFeet);
    assert('floating foot fails groundContact', r4.failed.includes('groundContact'));

    // Object too far → reach fails.
    const badReach = structuredClone(EXAMPLE);
    badReach.object.pos = [0, 1.1, 3.0]; badReach.effector.pos = [0, 1.1, 2.95]; badReach.target = { pos: [0, 1.1, 2.95] };
    const r5 = validateInteraction(badReach);
    assert('far object fails reach', r5.failed.includes('reach'));
  }

  console.log(`\n${failures === 0 ? '✓ ALL SELF-TESTS PASSED' : `✗ ${failures} SELF-TEST(S) FAILED`}`);
  return failures === 0;
}

// ---------------- main ----------------
const argv = process.argv.slice(2);
if (argv.includes('-h') || argv.includes('--help')) {
  console.log('Usage: verify-interaction.mjs --spec <file.json> | --selftest | --example');
  process.exit(0);
}
if (argv.includes('--example')) { console.log(JSON.stringify(EXAMPLE, null, 2)); process.exit(0); }
if (argv.includes('--selftest')) { process.exit(selftest() ? 0 : 1); }

const si = argv.indexOf('--spec');
if (si !== -1 && argv[si + 1]) {
  let spec;
  try { spec = JSON.parse(readFileSync(resolve(argv[si + 1]), 'utf8')); }
  catch (e) { console.error(`error: cannot read/parse spec: ${e.message}`); process.exit(1); }
  const report = validateInteraction(spec);
  process.exit(printReport(report) ? 0 : 1);
}

console.log('Nothing to do. Try: --selftest | --spec <file.json> | --example');
process.exit(1);
