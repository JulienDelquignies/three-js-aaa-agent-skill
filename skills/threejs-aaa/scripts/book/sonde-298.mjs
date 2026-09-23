// sonde 298 — L'ANATOMIE DES SÉQUENCES (la demande « il faut augmenter les passes par séquence » : 1,64-1,69 au monde du 296 ; le book,
// Référentiel 02 § 7, « séquence : passage de jeu appartenant à une équipe, terminé par une action défensive, un arrêt de jeu ou un
// tir » — 3,5-4,5 passes en jeu ouvert, 9,5-10,4 s). Même découpage que le grand livre (sonde-289) : une séquence commence à la
// reprise, au changement de possession ou à la première prise d'une équipe, finit au tir, au hors-jeu, au changement, à l'arrêt.
// Pour chaque séquence : le nombre de passes, la durée, COMMENT ELLE A COMMENCÉ (remise en jeu, récupération d'un ballon libre,
// interception, tacle…) et COMMENT ELLE A FINI (le dernier acte de l'équipe : passe ratée, conduite, contrôle, take-on, pique subie,
// tir, sortie, faute) ; la distribution 0 / 1 / 2 / 3-4 / 5-9 / 10+ passes ; et les séquences ÉCLAIR (< 2 s, 0 passe) — le ballon
// qui rebondit d'un camp à l'autre, que la définition du book (« action défensive ») ne compte probablement pas comme deux séquences.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—'), moy = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const O = { matchs: 0, seqs: [], debut: {}, fin: {}, finAvecPasses: {}, eclair: 0, eclairDebut: {} };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); O.matchs++;
  let seen = 0, seq = null; const last = [null, null];
  const fin = (cause) => { if (!seq) return; const d = st.t - seq.t0; O.seqs.push({ p: seq.passes, d, debut: seq.debut, fin: cause, team: seq.team, m: O.matchs });
    O.fin[cause] = (O.fin[cause] ?? 0) + 1; if (seq.passes >= 1) O.finAvecPasses[cause] = (O.finAvecPasses[cause] ?? 0) + 1;
    if (d < 2 && seq.passes === 0) { O.eclair++; O.eclairDebut[seq.debut] = (O.eclairDebut[seq.debut] ?? 0) + 1; } seq = null; };
  const debut = (team, how) => { if (seq && seq.team === team) return; fin(seq ? (last[seq.team]?.kind ?? '?') : '?'); seq = { team, t0: st.t, passes: 0, debut: how }; };
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (; seen < st.events.length; seen++) { const e = st.events[seen], p = e.by != null ? st.players[e.by] : null, tm = p?.team;
      const note = (t, k) => { if (t === 0 || t === 1) last[t] = { kind: k, t: st.t }; };
      if (e.type === 'restart-pris' && p) { fin(seq ? 'arrêt de jeu' : '?'); seq = { team: tm, t0: st.t, passes: 0, debut: 'remise en jeu' }; continue; }
      if (e.type === 'shot') { note(tm, 'tir'); fin('tir'); continue; }
      if (e.type === 'hors-jeu') { fin('hors-jeu'); continue; }
      if (e.type === 'faute') { fin('faute'); continue; }
      if (e.type === 'turnover') { debut(e.equipe, e.why ?? 'turnover'); continue; }
      if ((e.type === 'control' || e.type === 'receive' || e.type === 'loose-kept') && p && !p.keeper) { note(tm, e.miss ? 'contrôle raté' : 'contrôle'); if (!seq) debut(tm, 'prise'); continue; }
      if (e.type === 'pass' && p) { note(tm, e.clear ? 'dégagement' : 'passe'); if (seq && seq.team === tm && !e.clear) seq.passes++; continue; }
      if (e.type === 'touche') note(tm, 'conduite');
      else if (e.type === 'duel' && e.kind === 'take-on') note(tm, 'take-on');
      else if (e.type === 'tacle-pique' && e.sur != null) note(st.players[e.sur].team, 'pique subie');
      else if (e.type === 'duel' && e.kind === 'épaule' && e.sur != null) note(st.players[e.sur].team, 'charge subie'); }
  }
  fin('fin');
}
const n = O.matchs, S = O.seqs, N = S.length, eq = (x) => (x / n / 2).toFixed(1);
const bins = [[0, 0], [1, 1], [2, 2], [3, 4], [5, 9], [10, 999]];
console.log(`${n} matchs de 2 × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ${eq(N)} séquences par équipe et par match ; passes par séquence ${moy(S.map((s) => s.p)).toFixed(2)} (book 3,5-4,5), durée ${moy(S.map((s) => s.d)).toFixed(1)} s (9,5-10,4)`);
console.log(`  distribution : ${bins.map(([a, b]) => `${a === b ? a : b > 99 ? a + '+' : a + '-' + b} passes ${pc(S.filter((s) => s.p >= a && s.p <= b).length, N)} %`).join(' ; ')}`);
const S1 = S.filter((s) => s.p >= 1);
console.log(`  sans les séquences à 0 passe : ${eq(S1.length)} par équipe, ${moy(S1.map((s) => s.p)).toFixed(2)} passes, ${moy(S1.map((s) => s.d)).toFixed(1)} s ; ÉCLAIRS (< 2 s, 0 passe) ${eq(O.eclair)} par équipe — nées de : ${Object.entries(O.eclairDebut).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${eq(v)}`).join(', ')}`);
console.log(`  COMMENCÉES par : ${Object.entries(S.reduce((o, s) => ((o[s.debut] = (o[s.debut] ?? 0) + 1), o), {})).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${eq(v)}`).join(' ; ')}`);
console.log(`  FINIES par (dernier acte de l'équipe) : ${Object.entries(O.fin).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${eq(v)}`).join(' ; ')}`);
console.log(`  …celles qui avaient au moins une passe : ${Object.entries(O.finAvecPasses).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${eq(v)}`).join(' ; ')}`);
// LA POSSESSION AU SENS OPTA : un ÉCLAIR adverse (< 2 s, 0 passe) entre deux séquences de la MÊME équipe ne coupe pas sa possession
// (le ballon effleuré puis repris) — fusionnées, les passes s'additionnent.
const M = []; for (let k = 0; k < S.length; k++) { const s2 = S[k], prev = M[M.length - 1], nx = S[k + 1];
  if (prev && s2.p === 0 && s2.d < 2 && nx && nx.team === prev.team && nx.m === prev.m && s2.team !== prev.team) { prev.p += nx.p; prev.d += s2.d + nx.d; k++; continue; }
  if (prev && s2.team === prev.team && s2.m === prev.m && s2.debut !== 'remise en jeu') { prev.p += s2.p; prev.d += s2.d; continue; }
  M.push({ ...s2 }); }
console.log(`  POSSESSIONS FUSIONNÉES (éclair adverse effleuré, suites de la même équipe) : ${eq(M.length)} par équipe ; passes par possession ${moy(M.map((s) => s.p)).toFixed(2)} ; durée ${moy(M.map((s) => s.d)).toFixed(1)} s ; à 0 passe ${pc(M.filter((s) => s.p === 0).length, M.length)} %`);
