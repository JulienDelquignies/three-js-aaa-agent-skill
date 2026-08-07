#!/usr/bin/env node
// verify-tete.mjs — LE CIEL DU MATCH SE JOUE, ET LA TÊTE A TROIS MÉTIERS.
//
// Lot 34 : le jeu aérien manquait ENTIER (mesuré : 0 centre entré en surface sur 4 matchs,
// 0,8 s/match de fenêtre de tête avec un corps dessous). Livré : le CONTACT DE TÊTE
// (tete.js — au BUT en surface, DÉGAGEMENT près de son but, REMISE courte sinon ; à deux
// corps le DUEL AÉRIEN tranche sur strength), la CLOCHE DU CENTRE (strike-sim : l'arc de la
// rentrée au lieu du vol tendu mangé en route), la GÂCHETTE DU CENTRE (l'ailier à 21 m du
// but n'ouvrait jamais le bloc de décision — la serrure du lot 13) et la TOUCHE DE
// PRÉPARATION du centre (beginPass refusait 169/170 : le ballon d'aile vit à 1,2-1,4 m —
// le patron du tir, lot 6a). Fixtures balistiques : un VRAI arc (strike θ 0,7) redescend à
// hauteur de tête sur un corps posé — aucune écriture de ballon, la discipline tient.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { makeProfile } from '../assets/starter/src/engine/attributes.js';
import { teteStep } from '../assets/starter/src/engine/tete.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// LA MISE EN SCÈNE : un arc réel lancé vers un point, un corps posé sous la descente (x ≈ 9,5 m
// du départ pour θ 0,7 / v 11 : le ballon y repasse ~1,8-2,1 m en descendant), le reste du monde
// parqué loin. Aucune écriture de p/v du ballon — release nommé + strike, la discipline tient.
const ciel = (seed, arrange) => {
  const st = makeMatch({ full: true, seed });
  const cfg = matchCfg({ shotRange: 20 });
  for (let i = 0; i < 8 * 60 && !(st.phase === 'carry' && !st.restart); i++) matchStep(st, 1 / 60, cfg);
  for (const q of st.players) { q.p[0] = -45; q.p[2] = (q.id % 11) * 2 - 10; q.v = [0, 0]; q.act = null; }
  st.restart = null; st._teteCd = 0;
  const out = arrange(st) ?? {};
  st.ball.release('sortie');
  st.ball.restart([out.from?.[0] ?? 0, 0.11, out.from?.[1] ??  -20], { cause: 'touche' });
  st.ball.strike({ speed: out.v ?? 11, dirYaw: out.yaw ?? Math.PI / 2, elevation: 0.7, spinAxis: [0, 1, 0], spinRev: 0 });
  st.phase = 'flight'; st.possession.carrier = -1; st.hold = 0;
  // la mène pointe LE CORPS sous la descente (leçon de banc : lead [0,0,0] faisait COURIR le
  // receveur vers le rond central — il quittait le point de chute avant le ballon)
  const cible = st.players[out.to ?? -1];
  st.pass = { from: 0, to: out.to ?? -2, lead: cible ? [cible.p[0], 0, cible.p[2]] : [0, 0, 0], t: st.t, origin: [out.from?.[0] ?? 0, out.from?.[1] ?? -20], flight: 1.5 };
  return { st, cfg };
};
const run = (st, cfg, s) => { for (let i = 0; i < s * 60; i++) matchStep(st, 1 / 60, cfg); };

// ---------- 1. LA REPRISE AU BUT : un attaquant en surface sous l'arc → tête cadrée
{
  const { st, cfg } = ciel(3, (st) => {
    const q = st.players.find((p) => p.team === 0 && !p.keeper);
    const gx = st.pitch.attackGoal(0).x;                           // +hx
    q.p[0] = gx - 8; q.p[2] = 0; q.down = 0;                       // en pleine surface
    return { from: [gx - 8, -9.5], yaw: Math.PI / 2, to: q.id };   // l'arc vient du côté, retombe sur lui
  });
  run(st, cfg, 2);
  const tete = st.events.find((e) => e.type === 'tête' && e.mode === 'but');
  const shot = st.events.find((e) => e.type === 'shot' && e.kind === 'tête');
  ok(`la REPRISE AU BUT vit (tête mode=but de nº${tete?.by}, événement shot kind=tête portée ${shot?.range} m — le canal standard, le plongeon peut répondre)`,
    !!tete && !!shot && shot.range < 12.01);
}

// ---------- 2. LE DÉGAGEMENT : un défenseur sous l'arc près de SON but → loin du but
{
  const { st, cfg } = ciel(3, (st) => {
    const q = st.players.find((p) => p.team === 1 && !p.keeper);
    const own = st.pitch.ownGoal(1).x;                             // +hx (équipe 1 défend +x)
    q.p[0] = own - 10; q.p[2] = 0; q.down = 0;
    return { from: [own - 10, -9.5], yaw: Math.PI / 2, to: q.id };
  });
  const own = st.pitch.ownGoal(1);
  run(st, cfg, 1.6);
  const tete = st.events.find((e) => e.type === 'tête' && e.mode === 'dégagement');
  const fuit = st.ball.v[0] * Math.sign(own.x) < -3;               // le ballon FUIT le but propre
  ok(`le DÉGAGEMENT de la tête vit (mode=dégagement de nº${tete?.by}, ballon repoussé LOIN du but propre : vx·sgn=${(st.ball.v[0] * Math.sign(own.x)).toFixed(1)} < −3, en l'air vy=${st.ball.v[1].toFixed(1)})`,
    !!tete && fuit);
}

// ---------- 3. LA REMISE : au milieu, un coéquipier à portée → la tête le sert
{
  const { st, cfg } = ciel(3, (st) => {
    const q = st.players.find((p) => p.team === 0 && !p.keeper);
    const m = st.players.filter((p) => p.team === 0 && !p.keeper && p.id !== q.id)[0];
    q.p[0] = 0; q.p[2] = 0; q.down = 0;
    m.p[0] = 6; m.p[2] = 2; m.down = 0;                            // le coéquipier à ~6,3 m
    st._mate = m.id;
    return { from: [0, -9.5], yaw: Math.PI / 2, to: q.id };
  });
  run(st, cfg, 1.6);
  const tete = st.events.find((e) => e.type === 'tête' && e.mode === 'remise');
  ok(`la REMISE de la tête vit (mode=remise vers nº${tete?.to} = nº${st._mate}, st.pass posé pour le vol suivant)`,
    !!tete && tete.to === st._mate);
}

// ---------- 4. LE DUEL AÉRIEN : deux corps sous l'arc, la force tranche (déterministe)
{
  // …les jobs font DÉRIVER les corps pendant le vol (deux mises en scène de flux perdues sur
  // la dérive) : la fixture DIRECTE juge l'adjudicateur — ballon posé à 1,85 m par la porte
  // légale du restart, deux corps écrits, UNE image de teteStep. Zéro dérive, déterminisme pur.
  const st = makeMatch({ full: true, seed: 3 });
  const cfg = matchCfg({ shotRange: 20 });
  for (let i = 0; i < 8 * 60 && !(st.phase === 'carry' && !st.restart); i++) matchStep(st, 1 / 60, cfg);
  for (const q of st.players) { q.p[0] = -45; q.p[2] = (q.id % 11) * 2 - 10; q.v = [0, 0]; q.act = null; }
  const a = st.players.find((p) => p.team === 0 && !p.keeper);
  const b = st.players.find((p) => p.team === 1 && !p.keeper);
  a.p[0] = 0; a.p[2] = -0.3; a.down = 0; a.skill = makeProfile({ strength: 0 });
  b.p[0] = 0; b.p[2] = 0.3; b.down = 0; b.skill = makeProfile({ strength: 100 });
  st.ball.release('sortie');
  st.ball.restart([0, 1.85, 0], { cause: 'touche' });
  st.phase = 'flight'; st.possession.carrier = -1; st._teteCd = 0; st.restart = null;
  st.pass = { from: 0, to: a.id, lead: [0, 0, 0], t: st.t, origin: [-9, 0], flight: 1 };
  st.rnd = () => 0.5;
  teteStep(st, cfg);
  const duel = st.events.find((e) => e.type === 'duel' && e.kind === 'aérien');
  const tete = st.events.find((e) => e.type === 'tête');
  ok(`le DUEL AÉRIEN tranche à la force (strength 100 vs 0, rnd 0,5, une image : duel gagné par nº${duel?.by} = nº${b.id}, contre nº${duel?.contre} = nº${a.id}, et la tête est à LUI — nº${tete?.by})`,
    duel?.by === b.id && duel?.contre === a.id && tete?.by === b.id);
}

// ---------- 5. LA FENÊTRE est la loi : trop haut, personne ne joue
{
  const { st, cfg } = ciel(3, (st) => {
    const q = st.players.find((p) => p.team === 0 && !p.keeper);
    q.p[0] = 0; q.p[2] = 0;
    return { from: [0, -5.5], yaw: Math.PI / 2, to: q.id, v: 13 }; // à 5,5 m du départ : le ballon passe à ~3 m
  });
  run(st, cfg, 0.45);
  ok(`la FENÊTRE de hauteur est la loi (ballon au-dessus de la tête à son passage : ${st.events.filter((e) => e.type === 'tête').length} tête = 0 — on ne joue pas ce qu'on ne peut pas toucher)`,
    !st.events.some((e) => e.type === 'tête'));
}

// ---------- 6. sabotage nommé « jeu au sol » : tete:false → le vol traverse, personne ne saute
{
  const { st, cfg } = ciel(3, (st) => {
    const q = st.players.find((p) => p.team === 0 && !p.keeper);
    q.p[0] = 0; q.p[2] = 0;
    return { from: [0, -9.5], yaw: Math.PI / 2, to: q.id };
  });
  const cfg0 = matchCfg({ shotRange: 20, tete: false });
  for (let i = 0; i < 0.9 * 60; i++) matchStep(st, 1 / 60, cfg0);
  ok(`sabotage « jeu au sol » attrapé (tete:false : le même arc sur le même corps → ${st.events.filter((e) => e.type === 'tête').length} tête — le monde d'hier attend que ça retombe, nommé)`,
    !st.events.some((e) => e.type === 'tête'));
}

// ---------- 7. le FLUX : le ciel existe en match (rentrées, dégagements — les centres s'ouvrent)
{
  let tetes = 0, centres = 0;
  for (const seed of [1, 3, 5, 7]) {
    const st = makeMatch({ full: true, seed });
    const cfg = matchCfg({ shotRange: 20 });
    for (let i = 0; i < 180 * 60; i++) matchStep(st, 1 / 60, cfg);
    tetes += st.events.filter((e) => e.type === 'tête').length;
    centres += st.events.filter((e) => e.type === 'centre').length;
  }
  ok(`le CIEL vit en match (4 × 180 s : ${tetes} têtes ≥ 2 — était 0 —, ${centres} centre(s) ≥ 1 ; l'abondance des centres est la dette nommée « approche pilotée »)`,
    tetes >= 2 && centres >= 1);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
