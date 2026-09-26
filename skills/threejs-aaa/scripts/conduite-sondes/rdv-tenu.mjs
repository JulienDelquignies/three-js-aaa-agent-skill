// LE RENDEZ-VOUS DE LA TOUCHE EST-IL TENU ? (sans navigateur, moteur STARTER) — « le joueur et le ballon doivent ne faire qu'un » : une touche
// planifiée envoie le ballon au pied qui va se poser (P.rdv : pied, échéance) ; la touche suivante devrait partir de CE pied à CETTE échéance.
// Pour chaque rendez-vous du porteur en course : tenu (touche du bon pied à ±0,15 s), tenu par l'autre pied, ou MANQUÉ — et pourquoi, lu à
// l'échéance : le ballon au cou-de-pied le plus proche (pasContact, m), sa place dans le repère du corps, sa vitesse contre celle du corps,
// l'état (porté au servo, geste, possession perdue). Puis les trous de conduite (> 0,8 s sans touche) : ce que fait le ballon pendant.
// Usage : node rdv-tenu.mjs [graines=8] [secondes=120] [cle=valeur JSON de duelCfg, ex. conduite='{"cadence":null}']
import { makeDuel, duelCfg } from '../../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../../assets/starter/src/engine/match-sim.js';
import { pasContact } from '../../assets/starter/src/engine/pas.js';
const [NG = '8', SECS = '120', ...KV] = process.argv.slice(2);
const over = Object.fromEntries(KV.map((s) => { const i = s.indexOf('='); return [s.slice(0, i), JSON.parse(s.slice(i + 1))]; }));
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };
const R = { plans: 0, tenu: 0, autre: 0, manque: 0, pourquoi: {}, dMan: [], avMan: [], relMan: [], trous: [], trouPourquoi: {}, dtTouches: [], conduite: 0, touches: 0 };
for (let seed = 1; seed <= Number(NG); seed++) {
  const st = makeDuel({ seed }), base = duelCfg(), cfg = duelCfg({ ...over, ...(over.conduite ? { conduite: { ...base.conduite, ...over.conduite } } : {}) }), dt = 1 / 60;
  let ne = 0, plan = null, derniere = null, trou = null, derTouche = null;
  for (let i = 0; i < Number(SECS) * 60; i++) {
    matchStep(st, dt, cfg);
    const car = st.possession?.carrier ?? -1, c = st.players[car], enCourse = c && st.phase === 'carry' && !st.restart && !c.act && c.speed >= 1;
    const touches = [];
    while (ne < st.events.length) { const e = st.events[ne++]; if (e.type === 'touche' && e.by === car && e.pas !== 'porté') touches.push(e); }
    if (enCourse) R.conduite++;
    for (const e of touches) {
      if (enCourse) { R.touches++; if (derniere && derniere.by === car) R.dtTouches.push(st.t - derniere.t); }
      derniere = { t: st.t, by: car }; derTouche = (e.pas ?? '?') + (e.geste ? ':' + e.geste : '') + (e.spd != null ? ` ${e.spd >= 4 ? '≥4' : e.spd >= 2.5 ? '2.5-4' : '<2.5'}m/s` : '');
      if (plan && plan.by === car && st.t >= plan.due - 0.15 && st.t <= plan.due + 0.3) { if (e.foot === plan.pied) R.tenu++; else R.autre++; plan = null; }
      const P = c?._pas; if (enCourse && P?.rdv && P.rdv.reste > 0.05) { R.plans++; plan = { by: car, pied: P.rdv.pied, due: st.t + P.rdv.reste }; }
    }
    // l'échéance passée sans touche : manqué — lu MAINTENANT (0,15 s après l'échéance)
    if (plan && st.t > plan.due + 0.3) {
      R.manque++; const p = st.players[plan.by], P = p._pas;
      let k = 'autre';
      if (st.possession.carrier !== plan.by || st.phase !== 'carry') k = 'possession';
      else if (p.act) k = 'geste:' + (p.act.payload?.kind ?? p.act.id);
      else if (st.ball.owner === plan.by) k = 'porté';
      else if (p.speed < 1) k = 'lent';
      if (k === 'autre' && plan.lu) { k = plan.lu.d > 0.16 ? 'ballon-loin-du-pied' : 'pied-déjà-joué'; R.dMan.push(plan.lu.d); R.avMan.push(plan.lu.av); R.relMan.push(plan.lu.rel); }
      R.pourquoi[k] = (R.pourquoi[k] ?? 0) + 1; plan = null;
    }
    // à l'échéance exacte, la géométrie : le ballon au cou-de-pied le plus proche (les deux pieds en vol), sa place, la vitesse relative
    if (plan && !plan.lu && st.t >= plan.due) {
      const p = st.players[plan.by], fx = Math.cos(p.yaw), fz = Math.sin(p.yaw), bx = st.ball.p[0] - p.p[0], bz = st.ball.p[2] - p.p[2];
      const bA = bx * fx + bz * fz, bD = -bx * fz + bz * fx, ct = pasContact(p, bA, bD);
      plan.lu = { d: ct ? ct.d : 9, av: bA, rel: (st.ball.v[0] - p.v[0]) * fx + (st.ball.v[2] - p.v[1]) * fz };
    }
    // les trous : conduite en course sans touche
    if (enCourse) { if (!trou) trou = { t0: st.t, raisons: {}, avant: derTouche, d: [], av: [], vr: [] }; const d = Math.hypot(st.ball.p[0] - c.p[0], st.ball.p[2] - c.p[2]), fx = Math.cos(c.yaw), fz = Math.sin(c.yaw), av = (st.ball.p[0] - c.p[0]) * fx + (st.ball.p[2] - c.p[2]) * fz;
      const r = st.ball.owner === car ? 'porté' : c._pas?.rdv && c._pas.rdv.reste > -0.15 ? 'rdv-en-cours' : av < -0.1 ? 'ballon-derrière' : d > 0.62 ? 'ballon-hors-prise' : 'à-portée-sans-pied'; trou.raisons[r] = (trou.raisons[r] ?? 0) + 1; trou.d.push(d); trou.av.push(av); trou.vr.push((st.ball.v[0] - c.v[0]) * fx + (st.ball.v[2] - c.v[1]) * fz); }
    if (trou && (touches.length || !enCourse)) { const dur = st.t - trou.t0; R.trous.push(dur); if (dur > 0.8) { for (const [k, v] of Object.entries(trou.raisons)) R.trouPourquoi[k] = (R.trouPourquoi[k] ?? 0) + v; (R.trouAvant ??= {})[trou.avant] = ((R.trouAvant[trou.avant]) ?? 0) + dur; (R.trouD ??= []).push(q(trou.d, 0.5)); (R.trouAv ??= []).push(q(trou.av, 0.5)); (R.trouVr ??= []).push(q(trou.vr, 0.5)); (R.trouFin ??= {})[touches.length ? 'touche' : 'fin-de-course'] = ((R.trouFin?.[touches.length ? 'touche' : 'fin-de-course']) ?? 0) + 1; } trou = null; }
  }
}
const pc = (n, d) => (100 * n / Math.max(1, d)).toFixed(0) + ' %';
console.log(`${R.touches} touches en ${(R.conduite / 60).toFixed(0)} s de conduite en course : ${(R.touches / (R.conduite / 60)).toFixed(2)} touches/s (réf. Zago 2016 : 2,3-3,0) ; intervalle ${q(R.dtTouches, 0.1).toFixed(2)} / ${q(R.dtTouches, 0.5).toFixed(2)} / ${q(R.dtTouches, 0.9).toFixed(2)} s`);
console.log(`${R.plans} rendez-vous planifiés : tenus ${pc(R.tenu, R.plans)}, par l'autre pied ${pc(R.autre, R.plans)}, MANQUÉS ${pc(R.manque, R.plans)} — ${Object.entries(R.pourquoi).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
if (R.dMan.length) console.log(`  manqués « ballon loin du pied » à l'échéance : cou-de-pied ${q(R.dMan, 0.5).toFixed(2)} [${q(R.dMan, 0.1).toFixed(2)}–${q(R.dMan, 0.9).toFixed(2)}] m, ballon devant le corps ${q(R.avMan, 0.5).toFixed(2)} [${q(R.avMan, 0.1).toFixed(2)}–${q(R.avMan, 0.9).toFixed(2)}] m, vitesse relative ${q(R.relMan, 0.5).toFixed(2)} [${q(R.relMan, 0.1).toFixed(2)}–${q(R.relMan, 0.9).toFixed(2)}] m/s`);
const tot = Object.values(R.trouPourquoi).reduce((a, b) => a + b, 0);
console.log(`trous > 0,8 s : ${R.trous.filter((x) => x > 0.8).length} (${pc(R.trous.filter((x) => x > 0.8).reduce((a, b) => a + b, 0) * 60, R.conduite)} du temps de conduite) — pendant : ${Object.entries(R.trouPourquoi).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v, tot)}`).join(', ')}`);
if (R.trouAvant) { console.log(`  trous > 0,8 s — la touche d'AVANT (secondes de trou) : ${Object.entries(R.trouAvant).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')}`);
  console.log(`  pendant (médianes par trou) : ballon à ${q(R.trouD, 0.5).toFixed(2)} [${q(R.trouD, 0.1).toFixed(2)}–${q(R.trouD, 0.9).toFixed(2)}] m du corps, devant ${q(R.trouAv, 0.5).toFixed(2)} m, vitesse relative ${q(R.trouVr, 0.5).toFixed(2)} [${q(R.trouVr, 0.1).toFixed(2)}–${q(R.trouVr, 0.9).toFixed(2)}] m/s ; finis par ${Object.entries(R.trouFin).map(([k, v]) => `${k} ${v}`).join(', ')}`); }
