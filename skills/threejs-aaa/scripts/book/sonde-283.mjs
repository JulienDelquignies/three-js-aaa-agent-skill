// sonde 283 — LA CONTINUATION DEPUIS LA SURFACE (Modèle 06 §3, §8.1) : la valeur de position xT de chaque passe (ΔV = V(arrivée) − V(départ)),
// la part de passes reculées (réel 36 %), les passes depuis la surface (ΔV, remises en retrait vers l'axe à ≥ 88 m), la porte du tir en
// surface à 10 Hz (EV_cont, seuil, tir élu), les tirs par touche en surface et le xG moyen des tirs — la sonde du lot 283.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
import { arbitre } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/menace.js';
import { xtDe, versBook } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/xt.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; }, moy = (a) => a.length ? a.reduce((u, v) => u + v, 0) / a.length : NaN;
const o = { n: 0, passes: 0, vR: [], dV: [], recul: 0, box: { n: 0, dV: [], recul: 0, retrait: 0, vers: [] }, dec: [], touches: 0, shotsIn: 0, shots: 0, xg: [], buts: 0, reussite: 0, tiers: 0 };
for (const seed of seeds) {
  const overC = { ...over }; for (const k of ['xt']) if (overC[k] && matchCfg({})[k]) overC[k] = { ...matchCfg({})[k], ...overC[k] };
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...overC }); o.n++;
  let seen = 0, prevOwner = null, pend = null;
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    const ow = st.ball.owner, c = ow != null ? st.players[ow] : null;
    if (c && !c.keeper) { const g = st.pitch.attackGoal(c.team), s = Math.sign(g.x || 1), inBox = st.pitch.inBox(c.p[0], c.p[2], s);
      if (ow !== prevOwner && inBox) o.touches++;
      if (inBox && !st.restart && i % 6 === 0) { const a = arbitre(st, c, cfg), t = a.tir; if (t && t.ev != null) o.dec.push({ ev: t.ev, seuil: t.seuil, q: t.q, tir: a.meilleure === 'tir' }); }
      if (pend && pend.team === c.team && c.id !== pend.by) { const vR = xtDe(st.pitch, g, c.p), dV = vR - pend.V0; o.passes++; o.dV.push(dV); o.vR.push(vR); if ((c.p[0] - pend.p[0]) * s < -2) o.recul++; const [xB] = versBook(st.pitch, g, c.p); if (xB > 70) o.tiers++;
        if (pend.box) { o.box.n++; o.box.dV.push(dV); if ((c.p[0] - pend.p[0]) * s < -2) o.box.recul++; if (xB >= 88 && Math.abs(c.p[2]) < 12 && (c.p[0] - pend.p[0]) * s < 0) o.box.retrait++; o.box.vers.push(xtDe(st.pitch, g, c.p)); }
        o.reussite++; pend = null; } else if (pend && c.team !== pend.team) pend = null;
    } prevOwner = ow;
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (e.type === 'pass') { const by = st.players[e.by]; if (!by) continue; const g = st.pitch.attackGoal(by.team), s = Math.sign(g.x || 1); pend = { by: by.id, team: by.team, p: [...by.p], V0: xtDe(st.pitch, g, by.p), box: st.pitch.inBox(by.p[0], by.p[2], s) }; }
      if (e.type === 'shot') { const by = st.players[e.by]; if (!by) continue; const g = st.pitch.attackGoal(by.team), s = Math.sign(g.x || 1); o.shots++; if (st.pitch.inBox(by.p[0], by.p[2], s)) o.shotsIn++; const xg = e.xg ?? e.shotInfo?.xg; if (xg != null) o.xg.push(xg); }
      if (e.type === 'but') o.buts++;
    }
  }
}
const n = o.n;
console.log(`${n} × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)}`);
console.log(`passes reçues / match ${(o.passes / n).toFixed(0)} : ΔxT moyen ${(1000 * moy(o.dV)).toFixed(2)} ‰ (p50 ${(1000 * q(o.dV, 0.5)).toFixed(2)}, p90 ${(1000 * q(o.dV, 0.9)).toFixed(2)}), reculées ${(100 * o.recul / Math.max(1, o.passes)).toFixed(1)} % (réel 36), reçues dans le dernier tiers ${(100 * o.tiers / Math.max(1, o.passes)).toFixed(1)} %, VALEUR DE POSITION moyenne des réceptions ${(1000 * moy(o.vR)).toFixed(1)} ‰ (p90 ${(1000 * q(o.vR, 0.9)).toFixed(1)})`);
console.log(`passes DEPUIS LA SURFACE / match ${(o.box.n / n).toFixed(1)} : ΔxT moyen ${(1000 * moy(o.box.dV)).toFixed(1)} ‰, reculées ${(100 * o.box.recul / Math.max(1, o.box.n)).toFixed(0)} %, remises en retrait vers l'axe (≥ 88 m, |z| < 12) ${(o.box.retrait / n).toFixed(1)} / match, V du point reçu p50 ${q(o.box.vers, 0.5).toFixed(3)} p90 ${q(o.box.vers, 0.9).toFixed(3)}`);
console.log(`la porte en surface (10 Hz, ${o.dec.length} décisions) : EV_cont p50 ${q(o.dec.map((d) => d.ev), 0.5).toFixed(3)} p90 ${q(o.dec.map((d) => d.ev), 0.9).toFixed(3)}, seuil p50 ${q(o.dec.map((d) => d.seuil), 0.5).toFixed(3)}, xG_dec p50 ${q(o.dec.map((d) => d.q), 0.5).toFixed(3)}, tir élu ${(100 * o.dec.filter((d) => d.tir).length / Math.max(1, o.dec.length)).toFixed(0)} %`);
console.log(`tirs / match ${(o.shots / n).toFixed(1)} (25,3), dedans ${(o.shotsIn / n).toFixed(1)} (16,2), touches en surface ${(o.touches / n).toFixed(1)} (51), tirs par touche ${(o.shotsIn / Math.max(1, o.touches)).toFixed(2)} (0,32) ; xG moyen du tir ${moy(o.xg).toFixed(3)} (0,10-0,12) ; buts ${(o.buts / n).toFixed(2)}`);
