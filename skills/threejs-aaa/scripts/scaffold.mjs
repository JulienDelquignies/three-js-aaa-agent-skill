#!/usr/bin/env node
/**
 * scaffold.mjs — copy the runnable AAA Three.js starter into a target directory.
 *
 * Usage:
 *   node scaffold.mjs <target-dir> [--name my-game] [--force]
 *
 * Copies assets/starter/ (a complete WebGPU + IBL + shadows + TSL-post-processing
 * vanilla Three.js project) and rewrites the project name in package.json/index.html.
 * Does NOT run npm install — it prints the next commands.
 *
 * Solve, don't punt: validates inputs, refuses to overwrite a non-empty dir unless
 * --force, and reports a clear error (with the offending path) on any failure.
 */
import { cp, mkdir, readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STARTER = resolve(__dirname, '..', 'assets', 'starter');

function parseArgs(argv) {
  const args = { _: [], name: null, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--name') args.name = argv[++i];
    else if (a === '--force') args.force = true;
    else if (a === '-h' || a === '--help') args.help = true;
    else args._.push(a);
  }
  return args;
}

function usage() {
  console.log(`scaffold.mjs — create a new AAA Three.js project from the starter.

Usage:
  node scaffold.mjs <target-dir> [--name my-game] [--force]

Options:
  --name <name>   Project name written into package.json/index.html (default: dir name)
  --force         Allow scaffolding into an existing non-empty directory
  -h, --help      Show this help

After scaffolding:
  cd <target-dir> && npm install && npm run dev`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length === 0) { usage(); process.exit(args.help ? 0 : 1); }

  const target = resolve(args._[0]);
  const name = (args.name || basename(target))
    .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'my-game';

  if (!existsSync(STARTER)) {
    console.error(`error: starter template not found at ${STARTER}`);
    console.error('This script must run from inside the threejs-aaa skill directory.');
    process.exit(1);
  }

  if (existsSync(target)) {
    const entries = await readdir(target);
    if (entries.length > 0 && !args.force) {
      console.error(`error: target directory is not empty: ${target}`);
      console.error('Pass --force to scaffold anyway (existing files may be overwritten).');
      process.exit(1);
    }
  } else {
    await mkdir(target, { recursive: true });
  }

  await cp(STARTER, target, { recursive: true });

  // Rewrite project name in package.json and index.html.
  await patchFile(join(target, 'package.json'), (s) =>
    s.replace(/"name":\s*"[^"]*"/, `"name": "${name}"`));
  await patchFile(join(target, 'index.html'), (s) =>
    s.replace(/<title>[^<]*<\/title>/, `<title>${name}</title>`));

  console.log(`\n✓ Scaffolded "${name}" into ${target}\n`);
  console.log('Next steps:');
  console.log(`  cd ${args._[0]}`);
  console.log('  npm install');
  console.log('  npm run dev\n');
  console.log('Then open the printed localhost URL. Edit src/game/ for your content;');
  console.log('src/engine/ holds reusable systems (renderer, IBL, shadows, post-processing).');
}

async function patchFile(path, fn) {
  if (!existsSync(path)) return;        // optional file — skip silently
  try {
    const src = await readFile(path, 'utf8');
    await writeFile(path, fn(src));
  } catch (err) {
    console.error(`warning: could not patch ${path}: ${err.message}`);
  }
}

main().catch((err) => { console.error(`error: ${err.message}`); process.exit(1); });
