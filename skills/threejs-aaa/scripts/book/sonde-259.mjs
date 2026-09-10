// sonde 259 — l'épaule du dernier défenseur : hors-jeu sifflés, photos, refus ; à chaque passe vers un coureur (appel-profond ≤ 2,5 s avant) la marge du coureur à la ligne AU DÉPART du ballon, le départ de l'appel par rapport à la frappe, la profondeur du point visé derrière la ligne ; la marge des avants à la ligne en phase de possession.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
import { offsideLine } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/offside.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 5400);
const o = { n: 0, hjTente: 0, epAppels: 0, epServis: 0, epMarge: [], epHJ: 0, horsJeu: 0, photos: 0, denyHJ: 0, passes: 0, through: 0, versCoureur: 0, marge: [], depart: [], prof: [], margeAvants: [], appels: 0, appelsServis: 0, recu: [] };
const q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.floor(x * a.length)] : NaN; };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 }, ...over }); o.n++;
  let seen = 0; const appelAt = new Map(), epSet = new Map(); let lastPass = null;
  for (let i = 0; i < DUR * 60; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    if (i % 60 === 0 && st.phase === 'carry' && st.possession.team >= 0) { const atk = st.possession.team; const L = offsideLine(st, atk); const av = st.players.filter((p) => p.team === atk && !p.keeper && p.id !== st.possession.carrier).map((p) => L.adv - p.p[0] * L.sgn).sort((u, v) => u - v).slice(0, 2); o.margeAvants.push(...av); }
    if (lastPass && st.pass && st.pass.t === lastPass.t && lastPass.recv == null && st.ball.owner === lastPass.to) { const L = offsideLine(st, lastPass.team); lastPass.recv = L.adv - st.ball.p[0] * L.sgn; o.recu.push(lastPass.recv); }
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (e.type === 'burst' && e.kind === 'appel-profond') { appelAt.set(e.by, e.t); o.appels++; if (e.epaule) { o.epAppels++; epSet.set(e.by, e.t); } }
      if (e.type === 'hors-jeu') { o.horsJeu++; if (e.tente) o.hjTente++; if (epSet.has(e.by) && e.t - epSet.get(e.by) < 4) o.epHJ++; }
      if (e.type === 'pass' && e.to >= 0) { o.passes++; if (e.through) o.through++; if (st.pass?.off) o.photos++;
        const tgt = st.players[e.to], by = st.players[e.by]; const ta = appelAt.get(e.to);
        if (tgt && by && ta != null && e.t - ta <= 2.5) { o.versCoureur++; o.appelsServis++; const L = offsideLine(st, by.team); o.marge.push(L.adv - tgt.p[0] * L.sgn); o.depart.push(e.t - ta); if (epSet.has(e.to) && e.t - epSet.get(e.to) <= 2.5) { o.epServis++; o.epMarge.push(L.adv - tgt.p[0] * L.sgn); } if (st.pass?.lead) o.prof.push(st.pass.lead[0] * L.sgn - L.adv); lastPass = { t: st.pass?.t, to: e.to, team: by.team, recv: null }; }
      }
    }
  }
  o.denyHJ += st.deny?.['hors-jeu'] ?? 0;
}
const n = o.n, f = (x) => (x / n).toFixed(2);
console.log(`${n} × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — hors-jeu sifflés / match ${f(o.horsJeu)} (réel 3,1-4,5) ; photos (un coéquipier hors-jeu au départ) ${f(o.photos)} ; refus du cerveau « hors-jeu » ${f(o.denyHJ)} ; passes ${f(o.passes)}, through ${f(o.through)} ; appels profonds ${f(o.appels)}, servis ≤ 2,5 s ${f(o.appelsServis)} (${(100 * o.appelsServis / Math.max(1, o.appels)).toFixed(0)} %)`);
console.log(`passe vers un coureur : marge du coureur à la ligne AU DÉPART (m, + = en jeu) p10 ${q(o.marge, 0.1).toFixed(2)} p50 ${q(o.marge, 0.5).toFixed(2)} p90 ${q(o.marge, 0.9).toFixed(2)} (${o.marge.length}) ; hors-jeu à < 0 : ${o.marge.filter((m) => m < 0).length} ; départ de l'appel → frappe p50 ${q(o.depart, 0.5).toFixed(2)} s (p10 ${q(o.depart, 0.1).toFixed(2)}, p90 ${q(o.depart, 0.9).toFixed(2)}) ; point visé derrière la ligne p50 ${q(o.prof, 0.5).toFixed(1)} m (p90 ${q(o.prof, 0.9).toFixed(1)}) ; reçu derrière la ligne p50 ${q(o.recu, 0.5).toFixed(1)} m (${o.recu.length})`);
console.log(`l'appel de l'épaule : ${f(o.epAppels)} / match, servis ${f(o.epServis)} (marge au départ p10 ${q(o.epMarge, 0.1).toFixed(2)} p50 ${q(o.epMarge, 0.5).toFixed(2)} p90 ${q(o.epMarge, 0.9).toFixed(2)}), sifflés hors-jeu ${f(o.epHJ)} ; sifflets sur tentative ${f(o.hjTente)}`);
console.log(`marge des avants à la ligne en possession (m) : p10 ${q(o.margeAvants, 0.1).toFixed(1)} p50 ${q(o.margeAvants, 0.5).toFixed(1)} p90 ${q(o.margeAvants, 0.9).toFixed(1)} (${o.margeAvants.length} images)`);
