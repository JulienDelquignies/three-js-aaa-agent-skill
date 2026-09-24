#!/usr/bin/env node
// verify-duel.mjs — le duel 1c1 (engine/duel-1v1.js), joué headless, sans navigateur.
// Deux lois, les deux défauts historiques du 1v1 de l'Office :
//   PERSONNE NE GÈLE — aucun joueur sous 0,25 m/s plus de 0,8 s d'affilée (hors geste, sol, point).
//   LES VIRAGES SE FONT SUR L'ÉLAN — le cap de la vitesse ne tourne jamais plus vite que
//   turnAccel/v (la loi de movePlayers, jugée contre la RÉFÉRENCE RONDO : une sim sabotée est
//   jugée contre la loi, pas contre elle-même).
// Chaque loi a son sabotage, qui doit la faire tomber :
//   --sabotage=inertie   turnAccel 99 (le demi-tour sur place)
//   --sabotage=gel       anti-gel coupé
// Usage : node verify-duel.mjs [--seeds=8] [--secs=60] [--sabotage=…] [--verbose]
import { makeDuel, DUEL } from '../assets/starter/src/engine/duel-1v1.js';
import { rondoStep } from '../assets/starter/src/engine/rondo-sim.js';
import { RONDO } from '../assets/starter/src/engine/rondo.js';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const SEEDS = Number(arg('seeds', 8)), SECS = Number(arg('secs', 60)), SAB = arg('sabotage', null);
const VERBOSE = process.argv.includes('--verbose');
const GEL_V = 0.25, GEL_MAX = 0.8, VIRAGE_TOL = 1.1;

let cfg = DUEL;
if (SAB === 'inertie') cfg = { ...DUEL, turnAccel: 99 };
else if (SAB === 'gel') cfg = { ...DUEL, duel: { ...DUEL.duel, gel: null } };
else if (SAB) { console.error(`sabotage inconnu : ${SAB}`); process.exit(2); }

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const q = (xs, f) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };

function jouer(seed, secs, cfg) {
  const st = makeDuel({ seed });
  const dt = 1 / 60, n = Math.round(secs / dt);
  const per = st.players.map(() => ({ gel: 0, gelMax: 0, gelTot: 0, h0: null, sp0: 0, ratios: [], sorties: [], demiTours: [], tour: null, actPrev: false }));
  let lastPoint = -99;
  for (let i = 0; i < n; i++) {
    const evN = st.events.length;
    rondoStep(st, dt, cfg);
    for (let k = evN; k < st.events.length; k++) if (st.events[k].type === 'duel-point') lastPoint = st.t;
    st.players.forEach((p, j) => {
      const m = per[j];
      if (![p.p[0], p.p[2], p.v[0], p.v[1]].every(Number.isFinite)) throw new Error(`graine ${seed} : position non finie (joueur ${p.id}, t=${st.t.toFixed(2)})`);
      const exempt = p.down > 0 || !!p.act || st.t - lastPoint < 0.5;
      if (!exempt && p.speed < GEL_V) { m.gel += dt; m.gelTot += dt; m.gelMax = Math.max(m.gelMax, m.gel); } else m.gel = 0;
      const sp = Math.hypot(p.v[0], p.v[1]), h = Math.atan2(p.v[1], p.v[0]);
      if (!exempt && sp >= 1 && m.h0 != null && m.sp0 >= 1) {
        let dh = h - m.h0; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
        const ratio = (Math.abs(dh) / dt) / (RONDO.turnAccel / Math.min(sp, m.sp0));
        // l'image qui SUIT un geste : le geste était l'autorité du corps (charte, une autorité par phase),
        // la loi de course reprend la main — comptée à part, pas contre la loi de movePlayers
        if (m.actPrev) m.sorties.push(ratio); else m.ratios.push(ratio);
        // le demi-tour lancé (≥ 3 m/s) : le temps pour tourner le cap de 90°
        if (sp >= 3) {
          if (!m.tour) m.tour = { h: m.h0, t: st.t };
          let tot = h - m.tour.h; while (tot > Math.PI) tot -= 2 * Math.PI; while (tot < -Math.PI) tot += 2 * Math.PI;
          if (Math.abs(tot) >= Math.PI / 2) { m.demiTours.push(st.t - m.tour.t); m.tour = null; }
          else if (st.t - m.tour.t > 2) m.tour = { h, t: st.t };
        } else m.tour = null;
      }
      m.h0 = sp >= 1 ? h : null; m.sp0 = sp; m.actPrev = !!p.act;
    });
  }
  const types = {};
  for (const e of st.events) types[e.type] = (types[e.type] ?? 0) + 1;
  return { st, per, types };
}

console.log(`duel 1c1 — ${SEEDS} graines × ${SECS} s${SAB ? ` — SABOTAGE ${SAB}` : ''}`);
const res = [];
for (let s = 1; s <= SEEDS; s++) res.push({ seed: s, ...jouer(s, SECS, cfg) });

// ---------- PERSONNE NE GÈLE
for (const r of res) {
  const worst = Math.max(...r.per.map((m) => m.gelMax));
  const pct = r.per.map((m) => ((m.gelTot / SECS) * 100).toFixed(1) + '%').join(' / ');
  ok(`graine ${r.seed} : personne ne gèle plus de ${GEL_MAX} s`, worst <= GEL_MAX, `pire ${worst.toFixed(2)} s, temps sous ${GEL_V} m/s ${pct}`);
}

// ---------- LES VIRAGES SUR L'ÉLAN
{
  const all = res.flatMap((r) => r.per.flatMap((m) => m.ratios));
  const over = all.filter((x) => x > VIRAGE_TOL).length;
  ok(`les virages suivent la loi turnAccel/v (${all.length} images en course)`, over === 0,
    `p50 ${q(all, 0.5).toFixed(2)}, p99 ${q(all, 0.99).toFixed(2)}, max ${Math.max(0, ...all).toFixed(2)} × la loi, ${over} images au-delà de ${VIRAGE_TOL}`);
  const sorties = res.flatMap((r) => r.per.flatMap((m) => m.sorties));
  console.log(`  (info) sorties de geste : ${sorties.length} images, ${sorties.filter((x) => x > VIRAGE_TOL).length} au-delà de ${VIRAGE_TOL}, max ${Math.max(0, ...sorties).toFixed(2)} × la loi`);
  const dts = res.flatMap((r) => r.per.flatMap((m) => m.demiTours));
  ok(`un quart de tour lancé (≥ 3 m/s) prend du temps (${dts.length} mesurés)`, dts.length === 0 || q(dts, 0.1) >= 0.3,
    dts.length ? `p10 ${q(dts, 0.1).toFixed(2)} s, p50 ${q(dts, 0.5).toFixed(2)} s` : 'aucun');
}

// ---------- LE DUEL VIT (informatif + garde-fous)
{
  const tot = (k) => res.reduce((a, r) => a + (r.types[k] ?? 0), 0);
  const points = tot('duel-point'), pertes = res.reduce((a, r) => a + r.st.turnovers, 0) - points;
  ok(`des points se marquent (${points} en ${SEEDS * SECS} s)`, points >= SEEDS / 2);
  ok(`le défenseur récupère des ballons (${pertes} récupérations)`, pertes >= SEEDS / 2);
  const autres = {};
  for (const r of res) for (const [k, v] of Object.entries(r.types)) if (!['duel-point', 'duel-pas', 'turnover'].includes(k)) autres[k] = (autres[k] ?? 0) + v;
  console.log(`  événements : ${Object.entries(autres).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(`  pas d'anti-gel : ${tot('duel-pas')} · score par graine : ${res.map((r) => r.st._duel.score.join('-')).join('  ')}`);
}

// ---------- DÉTERMINISME (même graine, même partie)
{
  const a = jouer(3, 20, cfg).st, b = jouer(3, 20, cfg).st;
  const sig = (st) => JSON.stringify([st.events.length, st.players.map((p) => p.p.map((x) => +x.toFixed(6))), st.ball.p.map((x) => +x.toFixed(6))]);
  ok('même graine, même partie (au bit)', sig(a) === sig(b));
}

if (VERBOSE) for (const r of res) console.log(`  graine ${r.seed}:`, JSON.stringify(r.types));
console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
