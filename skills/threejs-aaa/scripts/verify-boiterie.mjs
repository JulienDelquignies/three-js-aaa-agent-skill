// verify-boiterie.mjs — LA BOITERIE ET L'ENTRANT (Animations_A_Faire § 8 ; cfg.boiterie, cfg.entrant ; note 383). Le fauché d'une faute
// GRAVE boite duree s (p._boite posé par adjugeFaute : la scène passe opts.boite à la foulée, movement réduit la pointe de ralenti × k
// qui guérit) ; l'entrant d'un remplacement TROTTE (le marcheur d'hier). null : l'hier au bit.
import { makeMatch, matchCfg, matchStep, matchInternals } from '../assets/starter/src/engine/match-sim.js';
import { remplacer } from '../assets/starter/src/engine/referee.js';
import { rondoInternals } from '../assets/starter/src/engine/rondo.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const hyp = Math.hypot;
const monde = (over) => { const st = makeMatch({ full: true, seed: 3 }); const cfg = matchCfg({ ceremonie: null, ramasseurs: null, petitsGestes: null, ...over }); for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg); return { st, cfg }; };
const K = matchCfg({}).boiterie;

console.log('— (a) la faute grave fait boiter, et la pointe s\'en ressent —');
{
  const { st, cfg } = monde({});
  const V = st.players.find((q) => q.team === 0 && !q.keeper), D = st.players.find((q) => q.team === 1 && !q.keeper);
  st._faute = { t: st.t, par: D.id, sur: V.id, team: V.team, p: [V.p[0], V.p[2]], grave: true, kind: 'tacle-glissé-derrière', vSur: 3, dir: [1, 0] };
  const n0 = st.events.length; for (let i = 0; i < 60 * 3; i++) matchStep(st, 1 / 60, cfg);
  const e = st.events.slice(n0).find((x) => x.type === 'boiterie');
  ok(`LA BOITERIE (cfg.boiterie) : la faute grave adjugée pose p._boite sur la victime (${V._boite ? `côté ${V._boite.side}, ${V._boite.duree} s, ${(V._boite.until - st.t).toFixed(1)} s devant` : 'rien'}), l'événement 'boiterie' (${e ? e.t + ' s, côté ' + e.side : 'aucun'}) — le fautif n'a rien (${D._boite ? 'boite' : 'rien'})`,
    !!V._boite && V._boite.side === e?.side && V._boite.duree === K.duree && !D._boite && !!e);
  // la pointe : le même corps lancé en 'press' vers une cible lointaine, avec et sans boiterie (movePlayers seul, hors cerveaux)
  const { movePlayers } = rondoInternals;
  const pointe = (boite) => { const { st: s2, cfg: c2 } = monde({}); const P = s2.players.find((q) => q.team === 0 && !q.keeper); s2.restart = null; for (const q of s2.players) { q.p[0] = -45 - (q.id % 10); q.p[2] = 20; q.v[0] = 0; q.v[1] = 0; q.act = null; } P.p[0] = -40; P.p[2] = 0; P._boite = boite ? { until: s2.t + 300, duree: 300, side: 'left' } : null;   /* une boiterie LONGUE (k ≈ 0,96 à 12 s) : la clause mesure le ralenti, pas sa décroissance */ let vmax = 0;
    for (let i = 0; i < 60 * 12; i++) { P.job = 'press'; P.target = [80, 0, 0]; movePlayers(s2, 1 / 60, c2); s2.t += 1 / 60; vmax = Math.max(vmax, hyp(P.v[0], P.v[1])); } return vmax; };   // 12 s : le corps approche sa pointe avec une constante de ~6 s (mesuré : 3,7 m/s à 5 s pour une pointe de 6,6)
  const v0 = pointe(false), v1 = pointe(true);
  ok(`LA POINTE RÉDUITE : le même corps lancé 12 s atteint ${v1.toFixed(2)} m/s en boitant c. ${v0.toFixed(2)} sans (ralenti ${K.ralenti} × k ≈ 0,96 : plafond ${(v0 * (1 - K.ralenti * 0.96)).toFixed(2)} + 0,15 au plus)`, v1 > 1 && v1 <= v0 * (1 - K.ralenti * 0.96) + 0.15 && v1 < v0 - 0.5);
}
console.log('\n— (b) l\'entrant trotte —');
{
  const { st, cfg } = monde({});
  const V = st.players.find((q) => q.team === 0 && !q.keeper); V.p[0] = 0; V.p[2] = st.pitch.hz - 2; V.v[0] = 0; V.v[1] = 0;
  const r = remplacer(st, cfg, 0, V.id); st.restart = { type: 'touche', p: [10, st.pitch.hz], team: 1, at: st.t + 40, placed: true }; let phaseIn = null, walkF = null;   // la sortie se fait à l'arrêt de jeu (Loi 3) : une touche posée
  for (let i = 0; i < 60 * 40 && phaseIn == null; i++) { matchStep(st, 1 / 60, cfg); if (V._sub?.phase === 'in') { phaseIn = st.t; walkF = V._walkF; } }
  ok(`L'ENTRANT TROTTE (cfg.entrant.trot) : le remplacé sort (remplacer → ${r ? 'oui' : 'non'}), l'entrant naît à la ligne ${phaseIn != null ? 'à ' + phaseIn.toFixed(1) + ' s' : 'jamais'} et marche × ${walkF ?? '—'} (hier ×1)`, !!r && phaseIn != null && walkF === matchCfg({}).entrant.trot);
}
console.log('\n— (c) les clés absentes rendent l\'hier —');
{
  const { st, cfg } = monde({ boiterie: null, entrant: null, petitsGestes: null });
  const V = st.players.find((q) => q.team === 0 && !q.keeper), D = st.players.find((q) => q.team === 1 && !q.keeper);
  st._faute = { t: st.t, par: D.id, sur: V.id, team: V.team, p: [V.p[0], V.p[2]], grave: true, kind: 'tacle-glissé-derrière', vSur: 3, dir: [1, 0] };
  const n0 = st.events.length; for (let i = 0; i < 60 * 3; i++) matchStep(st, 1 / 60, cfg);
  const W = st.players.find((q) => q.team === 0 && !q.keeper && q.id !== V.id); W.p[0] = 0; W.p[2] = st.pitch.hz - 2; remplacer(st, cfg, 0, W.id); st.restart = { type: 'touche', p: [10, st.pitch.hz], team: 1, at: st.t + 40, placed: true }; let walkF = 'jamais';
  for (let i = 0; i < 60 * 40 && walkF === 'jamais'; i++) { matchStep(st, 1 / 60, cfg); if (W._sub?.phase === 'in') walkF = W._walkF; }
  ok(`boiterie:null, entrant:null — aucune boiterie (${V._boite ? 'boite' : 'rien'}, événements ${st.events.slice(n0).filter((x) => x.type === 'boiterie').length}), l'entrant marche (× ${walkF})`, !V._boite && walkF === null);
}
console.log(`\nboiterie : ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
