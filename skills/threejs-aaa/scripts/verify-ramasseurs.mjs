// verify-ramasseurs.mjs — LES RAMASSEURS DE BALLE (Animations_A_Faire § 5, cfg.ramasseurs ; ramasseurs.js, note 382). Au ballon hors
// d'atteinte (le 225b rendait le point en une image) un CORPS trotte au ballon, le ramasse (ramassage), se tourne et le roule au point
// (rouleMain, la vitesse qui l'arrête là — frottement mesuré), s'assoit ; la remise attend. null : l'hier au bit.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const hyp = Math.hypot;

// LA FIXTURE : un match plein, tout le monde parqué loin, une touche posée à (10, hz) et le ballon mort à 4 m au-delà de la touche
// (hors du tablier : hors d'atteinte). On rejoue secs s et on lit les événements du ramasseur, le ballon, la remise.
const joue = (over, secs = 20) => {
  const st = makeMatch({ full: true, seed: 3 }); const cfg = matchCfg({ ceremonie: null, ...over });
  for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
  for (const q of st.players) { q.p[0] = -40 - (q.id % 10) * 1.5; q.p[2] = -20 + (q.team ? 4 : 0); q.v[0] = 0; q.v[1] = 0; q.act = null; q.intent = null; }
  const hz = st.pitch.hz, P = [10, hz];
  st.ball.release('arrêt-de-jeu'); st.ball.restart([10, 0.11, hz + 4], { cause: 'touche' }); st.ball.impulse([-st.ball.v[0], -st.ball.v[1], -st.ball.v[2]]);
  st.restart = { type: 'touche', p: P, team: 0, at: st.t + 0.5, placed: false }; st.phase = 'loose'; st.possession = { team: 0, carrier: -1 };
  const n0 = st.events.length, t0 = st.t; let tRoule = null, dArret = null, boyHome = null, boyPath = 0, prev = null, tPlace = null, dMinApres = Infinity, tPris = null;
  for (let i = 0; i < secs * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    const F = st._ramasseur, R = st.ramasseurs;
    if (F && R) { const q = R[F.boy]; if (prev) boyPath += hyp(q.p[0] - prev[0], q.p[2] - prev[1]); prev = [q.p[0], q.p[2]]; }
    const ev = st.events.slice(n0);
    if (tRoule == null) { const e = ev.find((x) => x.type === 'ramasseur-roule'); if (e) tRoule = e.t; }
    if (tRoule != null && dArret == null && st.t > tRoule + 0.3 && hyp(st.ball.v[0], st.ball.v[2]) < 0.3) dArret = hyp(st.ball.p[0] - P[0], st.ball.p[2] - P[1]);
    if (tPlace == null && st.restart?.placed) tPlace = st.t;
    if (tRoule != null && tPris == null) { dMinApres = Math.min(dMinApres, hyp(st.ball.p[0] - P[0], st.ball.p[2] - P[1])); if (st.events.slice(n0).some((x) => x.type === 'restart-pris')) tPris = st.t; }
    if (boyHome == null && R && tRoule != null && st.t > tRoule + 1.5) { const k = ev.find((x) => x.type === 'ramasseur')?.boy ?? 0; const q = R[k]; if (q.job === 'assis') boyHome = st.t; }
  }
  const E = st.events.slice(n0), ev = (t, f = () => true) => E.find((e) => e.type === t && f(e)) ?? null;
  return { st, t0, P, ram: ev('ramasseur'), ramasse: ev('ramasseur-geste', (e) => e.kind === 'ramassage'), roule: ev('ramasseur-geste', (e) => e.kind === 'rouleMain'), lance: ev('ramasseur-roule'), patience: ev('ramasseur', (e) => e.cause === 'patience-ramasseur'), pris: ev('restart-pris'), dArret, tPlace, boyHome, boyPath: +boyPath.toFixed(1), dMinApres: +dMinApres.toFixed(2), types: E.filter((e) => /ramasseur|restart-pris|touche/.test(e.type)).map((e) => `${e.t}:${e.type}${e.kind ? '/' + e.kind : ''}${e.cause ? '/' + e.cause : ''}${e.v != null ? '/v' + e.v : ''}`).join(' ') };
};
const K = matchCfg({}).ramasseurs;

console.log('— (a) le ramasseur va au ballon, le ramasse, le roule au point —');
{
  const r = joue({});
  ok(`LE CORPS QUI VA (cfg.ramasseurs) : 'ramasseur' ${r.ram ? `à ${(r.ram.t - r.t0).toFixed(2)} s (${r.ram.cause}, ramasseur ${r.ram.boy} à ${r.ram.d} m)` : 'jamais'}, le ramassage ${r.ramasse ? `à ${(r.ramasse.t - r.t0).toFixed(1)} s` : 'jamais'} après ${r.boyPath} m de course, le roulé ${r.roule ? `à ${(r.roule.t - r.t0).toFixed(1)} s` : 'jamais'}`,
    !!r.ram && r.ram.cause === 'hors-atteinte' && !!r.ramasse && !!r.roule && r.ramasse.t - r.ram.t > 1 && r.ramasse.t - r.ram.t < 9 && r.roule.t - r.ramasse.t > 1.0 && r.roule.t - r.ramasse.t < 1.3, r.types.slice(0, 200));
  ok(`LE ROULÉ AU POINT : lancé à ${r.lance?.v ?? '—'} m/s pour ${r.lance?.d ?? '—'} m, le ballon s'arrête à ${r.dArret != null ? r.dArret.toFixed(2) : '—'} m du point puis s'y POSE (au plus près ${r.dMinApres} m avant la prise), la remise posée (${r.tPlace != null ? (r.tPlace - r.t0).toFixed(1) + ' s' : 'jamais'}) et prise (${r.pris ? (r.pris.t - r.t0).toFixed(1) + ' s' : 'jamais'})`,
    !!r.lance && r.dArret != null && r.dArret < 3.0 && r.dMinApres < 0.1 && r.tPlace != null && !!r.pris && r.pris.t > r.lance.t, r.types.slice(0, 200));
  ok(`…et le ramasseur revient s'asseoir (${r.boyHome != null ? (r.boyHome - r.t0).toFixed(1) + ' s' : 'jamais'})`, r.boyHome != null);
}
console.log('\n— (b) la clé absente rend l\'hier ; le sabotage est attrapé —');
{
  const h = joue({ ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null }, 30);   // le preneur parqué à 40 m met ~25 s à venir : on lui laisse le temps
  ok(`LA CLÉ ABSENTE : ramasseurs:null — 'ramasseur' ${h.ram ? `à ${(h.ram.t - h.t0).toFixed(2)} s (${h.ram.cause})` : 'jamais'} et le ballon AU POINT en une image (posé à ${h.tPlace != null ? (h.tPlace - h.t0).toFixed(2) : '—'} s), aucun corps (${h.st.ramasseurs ? 'des ramasseurs' : 'aucun'}), aucun geste (${h.ramasse ? 'ramassage' : 'aucun'})`,
    !!h.ram && !h.st.ramasseurs && !h.ramasse && h.tPlace != null && h.tPlace - h.ram.t < 0.05 && !!h.pris);
  const s = joue({ ramasseurs: { ...K, vitesse: 0.2 } }, 16);
  ok(`sabotage « le ramasseur à 0,2 m/s » attrapé (il n'arrive pas : le point d'hier après patience ${K.patience} s — ${s.patience ? `'patience-ramasseur' à ${(s.patience.t - s.t0).toFixed(1)} s` : 'jamais'}, ramassage ${s.ramasse ? 'oui' : 'non'})`, !!s.patience && !s.ramasse && s.tPlace != null);
}
console.log(`\nramasseurs : ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
