#!/usr/bin/env node
// verify-loi12.mjs — LA LOI 12 EST UNE LOI, PAS UNE ANIMATION DE SIFFLET.
//
// Le contrat : la fente qui rate le ballon et trouve le corps est une FAUTE (détection,
// rondo-sim standTackleNow) ; l'arbitre la juge par la Loi 5 — l'AVANTAGE d'abord (fenêtre
// cfg.loi12.avantage), le sifflet ensuite ; la faute dans la surface du fautif est un PENALTY
// au point ; le coup franc du plein format tient le MUR (Loi 13, 9,15 m). La clé vit comme la
// Loi 11 : ON dans le preset matchCfg, gardée st.full — le réduit et le rondo restent au bit
// près (sentinelles 76/0 et 40/40 de la batterie) ; le sabotage est loi12:false, l'arbitre
// aveugle NOMMÉ. Doctrine lot 8 : l'adjudication se juge sur FIXTURES craftées (st._faute
// posé à la main), le flux ne fournit que l'existence.
import { makeMatch, matchCfg, matchStep, feuilleDeMatch } from '../assets/starter/src/engine/match-sim.js';
import { adjugeFaute } from '../assets/starter/src/engine/referee.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

const L12 = { avantage: 1.8, contact: 0.9, mur: 9.15 };
const CFG = () => matchCfg({ shotRange: 20, loi12: { ...L12 } });

// un état de match POSÉ, en phase carry (le juge lit le porteur) — chaque fixture part frais
const carryState = (seed) => {
  const st = makeMatch({ full: true, seed });
  const cfg = CFG();
  for (let i = 0; i < 30 * 60 && !(st.phase === 'carry' && st.possession.carrier >= 0 && !st.restart); i++) matchStep(st, 1 / 60, cfg);
  return st;
};

// ---------- 1. l'ADJUDICATEUR sur fixtures (l'avantage, le sifflet, le penalty, la cérémonie)
{
  // l'AVANTAGE GARDÉ : l'équipe lésée PORTE encore le ballon à la fin de la fenêtre → on joue
  const st = carryState(3);
  const F = { t: st.t - 2, par: 99, sur: st.possession.carrier, team: st.possession.team, p: [0, 0] };
  st._faute = { ...F };
  adjugeFaute(st, CFG());
  const av = st.events.find((e) => e.type === 'avantage');
  ok(`l'AVANTAGE se JOUE (équipe lésée ${F.team} porteuse à la fin de la fenêtre → événement 'avantage', aucun sifflet, st._faute soldé)`,
    !!av && av.team === F.team && st._faute === null && !st.restart && !st.events.some((e) => e.type === 'sortie'));
}
{
  // la FENÊTRE OUVERTE est un silence : faute fraîche, équipe lésée au ballon → le juge ATTEND
  const st = carryState(3);
  st._faute = { t: st.t, par: 99, sur: st.possession.carrier, team: st.possession.team, p: [0, 0] };
  adjugeFaute(st, CFG());
  ok(`la fenêtre OUVERTE attend (faute fraîche, lésé au ballon → ni sifflet ni avantage, st._faute vivant)`,
    !!st._faute && !st.restart && !st.events.some((e) => e.type === 'avantage' || e.type === 'sortie'));
}
{
  // l'AVANTAGE PERDU : le fautif a récupéré → sifflet AU POINT de la faute, l'équipe lésée remet
  const st = carryState(3);
  const holder = st.possession.team;
  const F = { t: st.t - 0.4, par: 99, sur: 1, team: 1 - holder, p: [8.3, -5.2] };   // lésé ≠ porteur
  st._faute = { ...F };
  adjugeFaute(st, CFG());
  const so = st.events.find((e) => e.type === 'sortie' && e.out === 'coup-franc');
  ok(`l'avantage PERDU siffle AVANT la fin de fenêtre (0,4 s < 1,8 : le fautif porte → coup franc équipe ${F.team} au point [${st.restart?.p?.join(', ')}])`,
    st.restart?.type === 'coup-franc' && st.restart.team === F.team
    && Math.abs(st.restart.p[0] - 8.3) < 0.01 && Math.abs(st.restart.p[1] - -5.2) < 0.01 && !!so);
  // …et la CÉRÉMONIE est complète : ballon lâché, monde en loose, preneur du bon camp désigné
  const tk = st.players[st.restart?.taker ?? -1];
  ok(`la cérémonie du sifflet (phase ${st.phase}, porteur ${st.possession.carrier}, preneur nº${tk?.id} équipe ${tk?.team}, remise posée à +${(st.restart.at - st.t).toFixed(1)} s)`,
    st.phase === 'loose' && st.possession.carrier === -1 && !!tk && tk.team === F.team && !tk.keeper && st.restart.placed === false);
}
{
  // le PENALTY : la faute vit dans la surface du FAUTIF → le point, pas le lieu de la faute
  const st = carryState(3);
  const cfg = CFG();
  const own = st.pitch.ownGoal(1);                                  // le camp du fautif (équipe 1)
  const F = { t: st.t - 2, par: 99, sur: 1, team: 0, p: [own.x - own.sign * 8, 1.0] };
  st._faute = { ...F };
  st.possession.team = 1;                                           // le fautif a le ballon : perdu
  adjugeFaute(st, cfg);
  const attendu = own.x - own.sign * st.pitch.dims.spot;
  ok(`la faute EN SURFACE est un PENALTY au point (surface du fautif : [${F.p.join(', ')}] → remise 'penalty' à [${st.restart?.p?.map((v) => +v.toFixed(1)).join(', ')}] = ${attendu} ± 0,01, cérémonie +${(st.restart?.at - st.t).toFixed(1)} s ≥ remise+1)`,
    st.restart?.type === 'penalty' && Math.abs(st.restart.p[0] - attendu) < 0.01 && Math.abs(st.restart.p[1]) < 0.01
    && st.restart.at - st.t > cfg.restartWait + 0.99);
  // …la MÊME faute UN MÈTRE hors surface est un coup franc au lieu (la ligne est une ligne)
  const st2 = carryState(3);
  st2._faute = { t: st2.t - 2, par: 99, sur: 1, team: 0, p: [st2.pitch.hx - st2.pitch.dims.box.depth - 1, 1.0] };
  st2.possession.team = 1;
  adjugeFaute(st2, CFG());
  ok(`…un mètre HORS surface : coup franc au LIEU (x=${st2.restart?.p?.[0]?.toFixed(1)}, pas de point de penalty)`,
    st2.restart?.type === 'coup-franc' && Math.abs(st2.restart.p[0] - (st2.pitch.hx - st2.pitch.dims.box.depth - 1)) < 0.01);
}

// ---------- 2. l'INTÉGRATION matchStep : le juge est APPELÉ, la perte se voit à l'image
{
  const st = carryState(3);
  const cfg = CFG();
  const holder = st.possession.team;
  st._faute = { t: st.t - 2, par: 99, sur: 1, team: 1 - holder, p: [4, 4] };        // fenêtre close, lésé sans ballon
  matchStep(st, 1 / 60, cfg);
  ok(`matchStep PORTE le sifflet (st._faute clos en une image → remise '${st.restart?.type}' équipe ${st.restart?.team})`,
    st.restart?.type === 'coup-franc' && st.restart.team === 1 - holder && st._faute === null);
}

// ---------- 3. le MUR (Loi 13) : 9,15 m tenus, deux corps sur la ligne ballon→but
// La fixture AMÈNE la meute au point (au sifflet réel, les corps sont sur la faute) : sans ça,
// le bloc naturel se tient déjà à ~9 m et le rayon n'a rien à mordre (mesuré 8,8 des deux côtés).
const meuteAuPoint = (st, rp, og) => {
  st.ball.release('arrêt-de-jeu');
  st.phase = 'loose'; st.possession.carrier = -1; st.pass = null;
  const ux = (og.x - rp[0]) / Math.hypot(og.x - rp[0], rp[1]), uz = (0 - rp[1]) / Math.hypot(og.x - rp[0], rp[1]);
  const meute = st.players.filter((q) => q.team === 1 && !q.keeper)
    .sort((a, b) => Math.hypot(a.p[0] - rp[0], a.p[2] - rp[1]) - Math.hypot(b.p[0] - rp[0], b.p[2] - rp[1])).slice(0, 4);
  const spots = [[ux * 2.6 - uz * 0.5, uz * 2.6 + ux * 0.5], [ux * 3.2 + uz * 0.6, uz * 3.2 - ux * 0.6], [-uz * 3.0, ux * 3.0], [uz * 3.0, -ux * 3.0]];
  meute.forEach((q, i) => { q.p[0] = rp[0] + spots[i][0]; q.p[2] = rp[1] + spots[i][1]; });
  st.restart = { type: 'coup-franc', p: rp, team: 0, at: st.t + 8, placed: false, taker: -1 };
};
{
  const st = carryState(3);
  const og = st.pitch.ownGoal(1);                                   // défenseurs = équipe 1
  const rp = [og.x - og.sign * 24, 3];                              // coup franc à 24 m du but
  meuteAuPoint(st, rp, og);
  for (let i = 0; i < 6.5 * 60; i++) matchStep(st, 1 / 60, CFG());
  const r = st.restart;
  const ds = st.players.filter((q) => q.team === 1 && !q.keeper).map((q) => Math.hypot(q.p[0] - rp[0], q.p[2] - rp[1])).sort((a, b) => a - b);
  const gx = og.x - rp[0], gz = 0 - rp[1], gl = Math.hypot(gx, gz);
  const murX = rp[0] + (gx / gl) * 9.15, murZ = rp[1] + (gz / gl) * 9.15;
  const murOk = (r?._mur ?? []).map((id) => st.players[id]).filter((q) => q && Math.hypot(q.p[0] - murX, q.p[2] - murZ) < 1.6);
  ok(`le MUR se TIENT (meute posée à 2,6-3,2 m, 6,5 s de marche : plus proche ${ds[0]?.toFixed(1)} m ≥ 8,4 ; ${r?._mur?.length ?? 0} corps désignés, ${murOk.length} ≥ 2 posés à < 1,6 m du point de mur [${murX.toFixed(1)}, ${murZ.toFixed(1)}] sur la ligne ballon→but)`,
    !!r && ds[0] >= 8.4 && (r._mur?.length ?? 0) === 2 && murOk.length === 2);
  // sabotage nommé « penalty déguisé » : loi12:false → le rayon retombe au réduit (restartClear 3 m)
  const st2 = carryState(3);
  meuteAuPoint(st2, [...rp], og);
  for (let i = 0; i < 6.5 * 60; i++) matchStep(st2, 1 / 60, matchCfg({ shotRange: 20, loi12: false }));
  const ds2 = st2.players.filter((q) => q.team === 1 && !q.keeper).map((q) => Math.hypot(q.p[0] - rp[0], q.p[2] - rp[1])).sort((a, b) => a - b);
  ok(`sabotage « penalty déguisé » attrapé (loi12:false : la meute reste à ${ds2[0]?.toFixed(1)} m < 8,4 — un coup franc sans mur, nommé)`,
    ds2[0] < 8.4 && !st2.restart?._mur);
}

// ---------- 4. sabotages nommés : la porte est la SEULE porte
{
  // « arbitre aveugle » : loi12:false → un st._faute posé reste INERTE (personne ne le lit)
  const st = carryState(3);
  st._faute = { t: st.t - 5, par: 99, sur: 1, team: 0, p: [4, 4] };
  const evBase = st.events.length;
  for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, matchCfg({ shotRange: 20, loi12: false }));
  ok(`sabotage « arbitre aveugle » attrapé (loi12:false : st._faute inerte après 1 s, aucun sifflet ni avantage)`,
    !!st._faute && !st.events.slice(evBase).some((e) => e.type === 'avantage' || (e.type === 'sortie' && e.out === 'coup-franc')));
}
{
  // « avantage myope » : avantage:0 → sifflet IMMÉDIAT même si le lésé porte (la fenêtre EST la loi)
  const st = carryState(3);
  st._faute = { t: st.t, par: 99, sur: st.possession.carrier, team: st.possession.team, p: [2, 2] };
  adjugeFaute(st, matchCfg({ shotRange: 20, loi12: { ...L12, avantage: 0 } }));
  ok(`sabotage « avantage myope » attrapé (avantage:0 → sifflet immédiat malgré le lésé porteur — la fenêtre est la clémence, nommée)`,
    st.restart?.type === 'coup-franc' && !st.events.some((e) => e.type === 'avantage'));
}

// ---------- 5. le FLUX existe et la FEUILLE compte (détection réelle, graine 1)
{
  // graine 9 × 25 s (re-fondé lot 32 : le glissé (lot 33) a re-divergé le flux — première faute
  // mesurée à t=20,0 graine 9, une charge-derrière : la détection a TROIS sources (tacle raté,
  // percutage, glissé fauché))
  const st = makeMatch({ full: true, seed: 9 });
  const st0 = makeMatch({ full: true, seed: 9 });
  const cfg = CFG(), cfg0 = matchCfg({ shotRange: 20, loi12: false });
  for (let i = 0; i < 25 * 60; i++) { matchStep(st, 1 / 60, cfg); matchStep(st0, 1 / 60, cfg0); }
  const n = st.events.filter((e) => e.type === 'faute').length;
  ok(`la DÉTECTION vit en match (graine 9 × 25 s : ${n} faute(s) ≥ 1 — la fente qui trouve le corps se nomme ; loi12:false : ${st0.events.filter((e) => e.type === 'faute').length} = 0)`,
    n >= 1 && st0.events.filter((e) => e.type === 'faute').length === 0);
  const f = feuilleDeMatch(st);
  const parEquipe = [0, 0];
  for (const e of st.events) if (e.type === 'faute') parEquipe[st.players[e.by].team]++;
  ok(`la FEUILLE compte les fautes PAR FAUTIF (${JSON.stringify(f.fautes)} = recompte ${JSON.stringify(parEquipe)})`,
    f.fautes[0] === parEquipe[0] && f.fautes[1] === parEquipe[1]);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
