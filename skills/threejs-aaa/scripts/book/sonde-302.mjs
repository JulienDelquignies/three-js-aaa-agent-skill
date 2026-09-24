// sonde 302 — LE CONTRÔLE RATÉ ET LA REMISE EN UNE TOUCHE (le lecteur de pertes, 24/09 : « beaucoup de contrôles ratés ? trop de
// remises en une touche pourries ? »). (1) LE CONTRÔLE : les contrôles manqués nommés (control miss) et les TOUCHES LOURDES (le ballon
// à plus de 1,5 m du pied dans la demi-seconde après un contrôle réussi), par équipe et par match, et ce qu'ils deviennent (perdus dans
// les 2 s). Le book (Modèle 09 § 7.1) : contrôle raté 9-13 % des pertes (~12-15 par équipe). (2) LA UNE-TOUCHE : les passes jouées SANS
// contrôle (le ballon frappé moins de 0,35 s après la prise, ou de volée) — nombre, réussite (première touche d'un coéquipier), PERTE
// dans les 2 s après la réception suivante, vitesse, longueur, direction (arrière ?) — contre les passes jouées après contrôle. Le book
// (test 8) : la une-touche stricte 15-25 par équipe.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const hyp = Math.hypot, pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—'), q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.min(a.length - 1, Math.floor(x * a.length))] : NaN; };
const mk = () => ({ n: 0, ok: 0, perdu2: 0, v: [], L: [], arr: 0 });
const O = { matchs: 0, ctrl: 0, miss: 0, missPerdu: 0, lourd: 0, lourdPerdu: 0, un: mk(), apres: mk(), unTech: {}, missTech: {} };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); O.matchs++;
  let seen = 0; const pris = {}, watch = []; let pass = null;
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (const w of watch) if (!w.done && w.kind === 'ctrl' && st.t - w.t <= 0.5) { const p = st.players[w.id]; if (hyp(st.ball.p[0] - p.p[0], st.ball.p[2] - p.p[2]) > 1.5 && st.possession.carrier !== w.id) { w.lourd = true; w.done = true; } }
    for (; seen < st.events.length; seen++) { const e = st.events[seen], p = e.by != null ? st.players[e.by] : null;
      if ((e.type === 'control' || e.type === 'receive') && p && !p.keeper && !st.restart) {
        if (pass && !pass.fini) { pass.fini = true; const A = pass.un ? O.un : O.apres; if (p.team === pass.team && !e.miss) { A.ok++; watch.push({ kind: 'suite', t: st.t, team: p.team, A }); } }
        if (e.type === 'control') { O.ctrl++; if (e.miss) { O.miss++; O.missTech[e.tech] = (O.missTech[e.tech] ?? 0) + 1; watch.push({ kind: 'miss', t: st.t, team: p.team }); } else watch.push({ kind: 'ctrl', t: st.t, id: p.id, team: p.team }); }
        pris[p.id] = st.t; }
      if (e.type === 'pass' && p && !p.keeper && !e.clear && !e.mains && e.to >= 0 && !st.restart) {
        const tenue = pris[p.id] != null ? st.t - pris[p.id] : 9, un = tenue < 0.35 || e.style === 'une-touche' || /une|layoff|remise/i.test(e.cls ?? '');
        const A = un ? O.un : O.apres, r = st.players[e.to]; A.n++; A.v.push(hyp(st.ball.v[0], st.ball.v[2])); A.L.push(r ? hyp(r.p[0] - p.p[0], r.p[2] - p.p[2]) : 0);
        const sg = Math.sign(st.pitch.attackGoal(p.team).x || 1); if (r && (r.p[0] - p.p[0]) * sg < -1) A.arr++;
        if (un) O.unTech[e.cls ?? e.style ?? '?'] = (O.unTech[e.cls ?? e.style ?? '?'] ?? 0) + 1;
        pass = { t: st.t, team: p.team, un, fini: false }; }
      if (e.type === 'turnover') for (const w of watch) { if (w.done || w.team === e.equipe || st.t - w.t > 2) continue;
        if (w.kind === 'miss') O.missPerdu++; else if (w.kind === 'ctrl' && w.lourd) O.lourdPerdu++; else if (w.kind === 'suite') w.A.perdu2++; w.done = true; } }
    for (let k = watch.length - 1; k >= 0; k--) { const w = watch[k]; if (st.t - w.t > 2) { if (w.kind === 'ctrl' && w.lourd) O.lourd++; watch.splice(k, 1); } }
    if (pass && st.t - pass.t > 6) pass = null;
  }
}
const n = O.matchs, eq = (x) => (x / n / 2).toFixed(1), qs = (a) => [0.25, 0.5, 0.75].map((x) => q(a, x).toFixed(1)).join('/');
console.log(`${n} match(s) de 2 × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)}`);
console.log(`  CONTRÔLES : ${eq(O.ctrl)} par équipe ; MANQUÉS ${eq(O.miss)} (${pc(O.miss, O.ctrl)} %), perdus dans les 2 s ${eq(O.missPerdu)} ; TOUCHES LOURDES (> 1,5 m) ${eq(O.lourd)} (${pc(O.lourd, O.ctrl)} %), perdues ${eq(O.lourdPerdu)} — le book : contrôle raté ~12-15 pertes par équipe ; manqués par technique : ${Object.entries(O.missTech).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${eq(v)}`).join(', ')}`);
for (const [nm, A] of [['UNE-TOUCHE (< 0,35 s ou remise)', O.un], ['après contrôle', O.apres]])
  console.log(`  ${nm} : ${eq(A.n)} par équipe (${pc(A.n, O.un.n + O.apres.n)} % des passes) ; réussies ${pc(A.ok, A.n)} % ; le receveur PERD dans les 2 s ${pc(A.perdu2, A.ok)} % ; vers l'arrière ${pc(A.arr, A.n)} % ; longueur ${qs(A.L)} m, vitesse ${qs(A.v)} m/s`);
console.log(`  une-touche par classe : ${Object.entries(O.unTech).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${eq(v)}`).join(', ')}`);
