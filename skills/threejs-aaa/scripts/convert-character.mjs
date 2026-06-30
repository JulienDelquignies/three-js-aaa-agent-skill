#!/usr/bin/env node
/**
 * convert-character.mjs — Mixamo/FBX character → optimized GLB for Three.js.
 *
 * Usage:
 *   node convert-character.mjs <input.fbx|input.glb> <output.glb> [--compress meshopt|draco]
 *                                                                  [--no-optimize] [--ktx2]
 *
 * Pipeline:
 *   1. If input is .fbx, convert to .glb via FBX2glTF (preferred) or print Blender steps.
 *   2. Optimize the .glb with @gltf-transform/cli: dedup, prune, resample, then
 *      Meshopt (default; best for animation) or Draco compression; optional KTX2 textures.
 *
 * This script orchestrates external CLIs. It checks for them and, if missing, prints the
 * exact install command and a manual fallback instead of failing opaquely.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function parseArgs(argv) {
  const args = { _: [], compress: 'meshopt', optimize: true, ktx2: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--compress') args.compress = argv[++i];
    else if (a === '--no-optimize') args.optimize = false;
    else if (a === '--ktx2') args.ktx2 = true;
    else if (a === '-h' || a === '--help') args.help = true;
    else args._.push(a);
  }
  return args;
}

function usage() {
  console.log(`convert-character.mjs — Mixamo/FBX → optimized GLB.

Usage:
  node convert-character.mjs <input.fbx|.glb> <output.glb> [options]

Options:
  --compress <meshopt|draco>  Compression (default: meshopt — best for animated characters)
  --ktx2                      Also compress textures to KTX2 (needs toktx/basisu)
  --no-optimize               Skip the gltf-transform optimization pass
  -h, --help                  Show this help

Requires (install if missing):
  npm i -g @gltf-transform/cli         # optimization + compression
  npm i -g fbx2gltf                    # FBX→glTF (or use Blender, steps printed if absent)`);
}

function has(cmd) {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(probe, [cmd], { stdio: 'ignore' }).status === 0;
}

function run(cmd, cmdArgs) {
  console.log(`$ ${cmd} ${cmdArgs.join(' ')}`);
  const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit' });
  if (r.error) throw new Error(`failed to run ${cmd}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} exited with code ${r.status}`);
}

function printBlenderFallback(input) {
  console.error('\nNo FBX→glTF CLI found. Either install one:');
  console.error('  npm i -g fbx2gltf            (Facebook FBX2glTF)');
  console.error('  npm i -g @gltf-transform/cli (for the optimization step)');
  console.error('\nOr convert manually in Blender:');
  console.error(`  1. File → Import → FBX  (${input}); enable "Automatic Bone Orientation"`);
  console.error('  2. Mixamo FBX imports at 0.01 scale — select all, apply scale (Ctrl+A → Scale)');
  console.error('  3. (Optional) Import each "without skin" animation FBX and stash as NLA strips');
  console.error('  4. File → Export → glTF 2.0 (.glb); enable "Group by NLA Track" for multiple clips');
  console.error('  5. Re-run this script on the exported .glb to optimize it');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length < 2) { usage(); process.exit(args.help ? 0 : 1); }

  const input = resolve(args._[0]);
  const output = resolve(args._[1]);
  if (!existsSync(input)) { console.error(`error: input not found: ${input}`); process.exit(1); }
  if (!['meshopt', 'draco'].includes(args.compress)) {
    console.error(`error: --compress must be "meshopt" or "draco" (got "${args.compress}")`);
    process.exit(1);
  }

  const ext = extname(input).toLowerCase();
  let glb = input;

  // Step 1: FBX → GLB if needed.
  if (ext === '.fbx') {
    if (has('FBX2glTF') || has('fbx2gltf')) {
      const bin = has('FBX2glTF') ? 'FBX2glTF' : 'fbx2gltf';
      glb = join(tmpdir(), `char-${Date.now()}.glb`);
      try { run(bin, ['-b', '-i', input, '-o', glb.replace(/\.glb$/, '')]); }
      catch (e) { console.error(`error: ${e.message}`); printBlenderFallback(input); process.exit(1); }
      // FBX2glTF appends _out.glb in some versions; resolve actual file:
      if (!existsSync(glb)) {
        const alt = glb.replace(/\.glb$/, '_out.glb');
        if (existsSync(alt)) glb = alt;
        else { console.error('error: FBX2glTF did not produce the expected .glb'); process.exit(1); }
      }
    } else {
      printBlenderFallback(input);
      process.exit(1);
    }
  } else if (ext !== '.glb' && ext !== '.gltf') {
    console.error(`error: unsupported input extension "${ext}" (expected .fbx, .glb, or .gltf)`);
    process.exit(1);
  }

  // Step 2: optimize with gltf-transform.
  if (!args.optimize) {
    if (glb !== output) run('cp', [glb, output]);
    console.log(`\n✓ Wrote ${output} (no optimization)`);
    return;
  }
  if (!has('gltf-transform')) {
    console.error('\nerror: gltf-transform not found. Install it:');
    console.error('  npm i -g @gltf-transform/cli');
    console.error(`\nIntermediate GLB is at: ${glb}`);
    process.exit(1);
  }

  const optArgs = ['optimize', glb, output, '--compress', args.compress];
  if (args.ktx2) optArgs.push('--texture-compress', 'ktx2');
  try { run('gltf-transform', optArgs); }
  catch (e) {
    // Fall back to a minimal, widely-supported flag set.
    console.error(`note: full optimize failed (${e.message}); trying compression only`);
    run('gltf-transform', [args.compress, glb, output]);
  }

  console.log(`\n✓ Wrote optimized character: ${output}`);
  console.log('Load it with GLTFLoader; clone instances with SkeletonUtils.clone (NOT .clone()).');
  console.log('See reference/05-characters-mixamo.md for the animation/state-machine setup.');
}

try { main(); } catch (err) { console.error(`error: ${err.message}`); process.exit(1); }
