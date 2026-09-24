#!/usr/bin/env node
// verify-duel.mjs — le duel 1c1 v2 (engine/duel-1v1.js : un MATCH sur la cage, lois du 11c11), headless.
// Les lois que la v1 (base rondo) ratait, mesurées :
//   LE CORPS NE PIVOTE PAS D'UN COUP — aucune image où le lacet tourne à plus de 2 000 °/s (la v1 :
//     44 images, jusqu'à 10 685 °/s — un demi-tour en une image).
//   PERSONNE NE GÈLE — aucun joueur sous 0,25 m/s plus de 0,8 s d'affilée (hors geste, sol, remise).
//   AUCUNE REMISE NE GÈLE — aucune remise en jeu ne dure plus de 20 s (sans gardien, la sortie de but
//     et le coup franc du match attendaient pour toujours).
//   LE DUEL EXISTE — les deux joueurs à moins de 5 m l'un de l'autre en médiane ; des buts, des tirs.
// Sabotages (chacun doit faire tomber sa loi) :
//   --sabotage=rondo    st.full éteint (les lois du corps du 11c11 coupées : la v1)
//   --sabotage=remises  les sorties rendues au match (pas de grille)
// Usage : node verify-duel.mjs [--seeds=8] [--secs=60] [--sabotage=…]
import { makeDuel, duelCfg } from '../assets/starter/src/engine/duel-1v1.js';
import { matchStep, matchCfg } from '../assets/starter/src/engine/match-sim.js';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const SEEDS = Number(arg('seeds', 8)), SECS = Number(arg('secs', 60)), SAB = arg('sabotage', null);
if (SAB && !['rondo', 'remises'].includes(SAB)) { console.error(`sabotage inconnu : ${SAB}`); process.exit(2); }
const GEL_V = 0.25, GEL_MAX = 0.8, SNAP = 2000, REMISE_MAX = 20, DIST_MAX = 5;

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const q = (xs, f) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };

function jouer(seed, secs) {
  const st = makeDuel({ seed });
  let cfg = duelCfg();
  if (SAB === 'rondo') st.full = false;
  if (SAB === 'remises') cfg = { ...cfg, onOut: matchCfg().onOut };
  const dt = 1 / 60, gel = [0, 0], y0 = [null, null], m = { gelMax: 0, remise: 0, remiseMax: 0, yaw: [], dist: [] };
  for (let i = 0; i < Math.round(secs / dt); i++) {
    matchStep(st, dt, cfg);
    m.remise = st.restart ? m.remise + dt : 0; m.remiseMax = Math.max(m.remiseMax, m.remise);
    st.players.forEach((p, j) => {
      if (![p.p[0], p.p[2], p.yaw].every(Number.isFinite)) throw new Error(`graine ${seed} : état non fini (joueur ${p.id}, t=${st.t.toFixed(2)})`);
      gel[j] = !p.act && p.down <= 0 && !st.restart && p.speed < GEL_V ? gel[j] + dt : 0; m.gelMax = Math.max(m.gelMax, gel[j]);
      if (y0[j] != null) { let d = p.yaw - y0[j]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; m.yaw.push(Math.abs(d) / dt * 180 / Math.PI); }
      y0[j] = p.yaw;
    });
    m.dist.push(Math.hypot(st.players[0].p[0] - st.players[1].p[0], st.players[0].p[2] - st.players[1].p[2]));
  }
  const types = {}; for (const e of st.events) types[e.type] = (types[e.type] ?? 0) + 1;
  return { st, m, types };
}

console.log(`duel 1c1 v2 (lois du 11c11) — ${SEEDS} graines × ${SECS} s${SAB ? ` — SABOTAGE ${SAB}` : ''}`);
const res = [];
for (let s = 1; s <= SEEDS; s++) res.push({ seed: s, ...jouer(s, SECS) });

{
  const yaw = res.flatMap((r) => r.m.yaw), snaps = yaw.filter((x) => x > SNAP).length;
  ok(`le corps ne pivote jamais d'un coup (aucune image > ${SNAP} °/s)`, snaps === 0, `p99 ${q(yaw, 0.99).toFixed(0)} °/s, max ${Math.max(...yaw).toFixed(0)} °/s, ${snaps} images au-delà`);
}
for (const r of res) ok(`graine ${r.seed} : personne ne gèle plus de ${GEL_MAX} s`, r.m.gelMax <= GEL_MAX, `pire ${r.m.gelMax.toFixed(2)} s`);
for (const r of res) ok(`graine ${r.seed} : aucune remise ne dure plus de ${REMISE_MAX} s`, r.m.remiseMax <= REMISE_MAX, `la plus longue ${r.m.remiseMax.toFixed(1)} s`);
{
  const d50 = q(res.flatMap((r) => r.m.dist), 0.5);
  ok(`les deux joueurs se disputent le ballon (écart médian ≤ ${DIST_MAX} m)`, d50 <= DIST_MAX, `${d50.toFixed(1)} m`);
  const tot = (k) => res.reduce((a, r) => a + (r.types[k] ?? 0), 0);
  ok(`des buts se marquent (${tot('but')} en ${SEEDS * SECS} s)`, tot('but') >= SEEDS);
  ok(`des tirs partent (${tot('shot')})`, tot('shot') >= SEEDS * 3);
  console.log(`  gestes ${tot('skill')}, duels ${tot('duel')}, piques ${tot('tacle-pique')}, glissés ${tot('slide')}, contres ${tot('contre')}, grille ${tot('grille')} · scores ${res.map((r) => r.st.score.join('-')).join('  ')}`);
}
{
  const sig = (st) => JSON.stringify([st.events.length, st.score, st.players.map((p) => p.p.map((x) => +x.toFixed(6))), st.ball.p.map((x) => +x.toFixed(6))]);
  ok('même graine, même partie (au bit)', sig(jouer(3, 20).st) === sig(jouer(3, 20).st));
}
console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
