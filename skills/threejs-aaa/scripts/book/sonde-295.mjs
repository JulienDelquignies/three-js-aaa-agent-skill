// sonde 295 — LA COMPTABILITÉ DES PERTES AU SENS DU BOOK (quatre lois 290-294 ont baissé chacune leur canal sans bouger le total
// ~215-225 pertes par équipe ; le Référentiel 02 dit 110-140). Mais la table du book (Modèle 09 § 7.1) répartit les pertes entre
// passes (bloquée, hors d'atteinte, interceptée), contrôle raté, dribble, tacle, sortie non forcée, hors-jeu/faute — sans TIRS ni
// DÉGAGEMENTS : un tir arrêté ou un dégagement récupéré n'y est pas une « perte de balle ». Chaque changement de possession
// ('turnover', l'équipe qui gagne le ballon) est classé par la DERNIÈRE ACTION de l'équipe qui le perd (dans les 6 s) : tir, dégagement,
// tête, passe de jeu, remise en jeu, conduite (touche), contrôle, take-on, pique subie, rien. Et les SORTIES qui rendent le ballon à
// l'adversaire (la remise lui revient). Le compte « au sens du book » = tout sauf tir et dégagement.
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—');
const O = { matchs: 0, turn: 0, cat: {}, sorties: 0, sortiesCat: {}, possessions: [0, 0] };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); O.matchs++;
  let seen = 0; const last = [null, null]; let r0 = null, team0 = st.possession.team;
  const note = (team, kind) => { if (team === 0 || team === 1) last[team] = { kind, t: st.t }; };
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (; seen < st.events.length; seen++) { const e = st.events[seen], p = e.by != null ? st.players[e.by] : null, tm = p?.team;
      if (e.type === 'pass') note(tm, e.clear ? 'dégagement' : e.mains ? 'remise en jeu (main)' : 'passe');
      else if (e.type === 'shot') note(tm, 'tir');
      else if (e.type.startsWith('tête')) note(tm, 'tête');
      else if (e.type === 'touche') note(tm, 'conduite');
      else if (e.type === 'control' || e.type === 'receive' || e.type === 'loose-kept') note(tm, e.miss ? 'contrôle raté' : 'contrôle');
      else if (e.type === 'duel' && e.kind === 'take-on') note(tm, 'take-on');
      else if (e.type === 'tacle-pique' && e.sur != null) note(st.players[e.sur].team, 'pique subie');
      else if (e.type === 'duel' && e.kind === 'épaule' && e.sur != null) note(st.players[e.sur].team, 'charge subie');
      if (e.type === 'turnover') { const perd = 1 - e.equipe, L = last[perd]; O.turn++;
        const k = L && st.t - L.t < 6 ? L.kind : 'rien (> 6 s)'; O.cat[k] = (O.cat[k] ?? 0) + 1; O.possessions[e.equipe]++; } }
    // la SORTIE qui rend le ballon à l'adversaire : une remise en jeu naît pour l'équipe qui n'avait pas le ballon
    if (st.restart && !r0 && st.restart.type !== 'fin' && st.restart.team != null && team0 >= 0 && st.restart.team !== team0 && !['coup-franc', 'penalty', 'engagement', 'but'].includes(st.restart.type)) {
      O.sorties++; const L = last[team0], k = (L && st.t - L.t < 6 ? L.kind : 'rien') + ' → ' + st.restart.type; O.sortiesCat[k] = (O.sortiesCat[k] ?? 0) + 1; }
    r0 = st.restart; if (st.possession.team >= 0) team0 = st.possession.team;
  }
}
const n = O.matchs, eq = (x) => (x / n / 2).toFixed(1), T = O.turn;
const horsBook = (O.cat['tir'] ?? 0) + (O.cat['dégagement'] ?? 0);
console.log(`${n} matchs de 2 × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — changements de possession en jeu ${eq(T)} par équipe et par match ; + sorties rendues à l'adversaire ${eq(O.sorties)}`);
console.log(`  par dernière action de l'équipe qui perd : ${Object.entries(O.cat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${eq(v)} (${pc(v, T)} %)`).join(' ; ')}`);
console.log(`  sorties : ${Object.entries(O.sortiesCat).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${eq(v)}`).join(' ; ')}`);
console.log(`  PERTES AU SENS DU BOOK (en jeu hors tirs et dégagements, + sorties non forcées hors tirs) : ${eq(T - horsBook + O.sorties - Object.entries(O.sortiesCat).filter(([k]) => k.startsWith('tir') || k.startsWith('dégagement')).reduce((a, [, v]) => a + v, 0))} par équipe (le book 110-140) ; tirs ${eq(O.cat['tir'] ?? 0)}, dégagements ${eq(O.cat['dégagement'] ?? 0)} retirés`);
