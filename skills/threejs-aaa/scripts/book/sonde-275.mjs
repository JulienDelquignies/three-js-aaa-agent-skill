// sonde 275 — LE BLOC QUI PERÇOIT : après une passe latérale > 15 m, l'instant où la CIBLE de bloc de chaque posté de la défense (p._slotT / p.target) bouge d'au moins 1 m vers le côté du ballon — le décalage 1er → dernier (Bible 10 §4.4 : 0,6-1,2 s, l'ordre ATT → MID côté ballon → DEF côté ballon → MID opposé → DEF opposé) ; l'ordre de déclenchement par ligne ; la fenêtre W du renversement > 35 m (réception → premier défenseur à < 4 m qui n'y était PAS à la réception).
import { makeMatch, matchStep, matchCfg } from '../../assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const o = { n: 0, decal: [], ordre: { DEF: [], MID: [], ATT: [] }, W: [], renv: 0, onsets: [] };
const ligneDe = (p) => p.post < 4 ? 'DEF' : p.post < 7 ? 'MID' : 'ATT';
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed, tactics: null }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); o.n++;
  let seen = 0; const pend = []; const prevT = new Map();
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (e.type === 'pass' && e.to >= 0 && st.pass) { const dz = st.pass.lead[2] - st.pass.origin[1], dx = st.pass.lead[0] - st.pass.origin[0]; if (Math.abs(dz) > 15) { const def = 1 - st.players[e.by].team; const snap = new Map(); for (const p of st.players) if (p.team === def && !p.keeper) snap.set(p.id, [p.target ? p.target[0] : p.p[0], p.target ? p.target[2] : p.p[2], p.p[0], p.p[2]]); pend.push({ t: st.t, def, side: Math.sign(dz), snap, onset: new Map(), done: false, renv: Math.hypot(dx, dz) > 35, lead: st.pass.lead, recu: null, near0: null }); } }
      if (e.type === 'receive' && pend.length) { const w = pend[pend.length - 1]; if (!w.recu && st.t - w.t < 4 && st.players[e.by]?.team !== w.def) { w.recu = st.t; const r = st.players[e.by]; w.rec = r; w.near0 = new Set(st.players.filter((q) => q.team === w.def && Math.hypot(q.p[0] - r.p[0], q.p[2] - r.p[2]) < 4).map((q) => q.id)); } }
    }
    for (const w of pend) { if (w.done) continue;
      for (const p of st.players) { if (p.team !== w.def || p.keeper || w.onset.has(p.id)) continue; const s0 = w.snap.get(p.id); if (!s0) continue; const tz = p.target ? p.target[2] : p.p[2]; if ((tz - s0[1]) * w.side >= 1) w.onset.set(p.id, st.t - w.t); }
      if (w.recu && w.W == null && w.rec) { for (const q of st.players) if (q.team === w.def && !w.near0.has(q.id) && Math.hypot(q.p[0] - w.rec.p[0], q.p[2] - w.rec.p[2]) < 4) { w.W = st.t - w.recu; break; } }
      if (st.t - w.t > 3) { w.done = true; const ts = [...w.onset.values()]; if (ts.length >= 4) { ts.sort((a, b) => a - b); o.decal.push(ts[ts.length - 1] - ts[0]); o.onsets.push(ts.length); for (const [id, t] of w.onset) o.ordre[ligneDe(st.players[id])].push(t); } if (w.renv && w.recu) { o.renv++; if (w.W != null) o.W.push(w.W); else o.W.push(3); } }
    }
  }
}
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }, mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
console.log(`${o.n} × ${DUR / 60} min ${JSON.stringify(over)} — passes latérales > 15 m : ${o.decal.length} avec ≥ 4 cibles qui bougent (${mean(o.onsets).toFixed(1)} postés en moyenne)`);
console.log(`décalage 1er → dernier (la CIBLE de bloc bouge de 1 m vers le côté ballon) : p50 ${q(o.decal, 0.5).toFixed(2)} s, p90 ${q(o.decal, 0.9).toFixed(2)} (cible 0,6-1,2) ; onset par ligne p50 : DEF ${q(o.ordre.DEF, 0.5).toFixed(2)} s, MID ${q(o.ordre.MID, 0.5).toFixed(2)}, ATT ${q(o.ordre.ATT, 0.5).toFixed(2)} (l'ordre du book : ATT → MID → DEF)`);
console.log(`fenêtre W du renversement > 35 m (réception → premier défenseur NOUVEAU à < 4 m, 3 s si aucun) : p50 ${q(o.W, 0.5).toFixed(2)} s, moyenne ${mean(o.W).toFixed(2)} (cible 1,5-2,5) sur ${o.renv} renversements reçus`);
