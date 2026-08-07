#!/usr/bin/env node
// verify-frappes.mjs — LE RÉPERTOIRE DES FRAPPES : CHAQUE ESPÈCE A SA LOI, ET SA PHYSIQUE.
//
// Lot 39 (retour utilisateur « flottante, enroulée, puissante, ras de terre, etc — liste à
// compléter pour être exhaustif ») : l'espèce se choisit sur la SITUATION (gardien sorti →
// piqué ; angle de repique → enroulée ; loin → flottante possible ; petits espaces → pointu)
// et s'exécute avec SA physique — l'enroulée porte un VRAI Magnus (ball.js l'intégrait déjà :
// le gardien projette LINÉAIREMENT via shotCross, la courbe le bat comme au vrai football),
// la flottante vole SANS axe de rotation et se LIT TARD (floatRead), le ras-de-terre rase.
// Leçons d'équilibre consignées dans shooting.js : les finisseurs prouvés gardent leurs
// bandes (buts 30 → 15 mesurés au premier jet trop généreux), le piqué est RARE (37 % de
// piqués n'est pas du football), le pointu-sans-préparation est une dette nommée.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { tryShot } from '../assets/starter/src/engine/shooting.js';
import { KEEPER, keeperDecide } from '../assets/starter/src/engine/keeper.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// le monde de fixture (patron verify-menace) : plein format, tout le monde parqué loin,
// la scène posée à la main — release/restart/possess, la séquence légale du ballon
const mk = (cfgExtra = {}) => {
  const st = makeMatch({ full: true, seed: 5 });
  const sgn = -st.pitch.ownGoal(0).sign;
  const goal = st.pitch.attackGoal(0);
  for (const q of st.players.filter((q) => q.team === 1)) { q.p[0] = -sgn * 30; q.p[2] = -28; q.v = [0, 0]; }
  for (const q of st.players.filter((q) => q.team === 0 && !q.keeper)) { q.p[0] = -sgn * 30; q.p[2] = 28; q.v = [0, 0]; }
  return { st, sgn, goal, cfg: matchCfg({ shotRange: 20, ...cfgExtra }) };
};
const pose = (st, c, x, z) => {
  c.p[0] = x; c.p[2] = z; c.v = [0, 0];
  st.ball.restart([x + 0.3, 0.11, z], { cause: 'coup-franc' });
  st.restart = null; st.ball.possess(c.id);
  st.possession = { team: 0, carrier: c.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
};
// arme le tir (rnd épinglé choisit l'espèce), vole, échantillonne le passage au plan du but
const frappe = (st, c, cfg, u, gkX = null) => {
  st.rnd = () => u;
  tryShot(st, c, cfg);
  let launch = null, plane = null, yAtGk = null, maxY = 0, grace = 30;
  const gx = st.pitch.attackGoal(0).x;
  for (let i = 0; i < 4 * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    const shot = st.events.find((e) => e.type === 'shot');
    if (shot && !launch && st.phase === 'flight') launch = { p: [...st.ball.p], v: [...st.ball.v] };
    if (launch && !plane) {
      maxY = Math.max(maxY, st.ball.p[1]);
      if (gkX != null && yAtGk == null && Math.abs(st.ball.p[0] - gkX) < 0.35) yAtGk = st.ball.p[1];
      if (Math.abs(st.ball.p[0]) >= Math.abs(gx) - 0.1) plane = { z: st.ball.p[2], y: st.ball.p[1] };
    }
    // …une grâce de 0,5 s après le passage du plan : l'événement 'but' se juge quelques
    // images APRÈS le franchissement (le banc coupait 3 images avant le but du piqué)
    if (plane && grace-- <= 0) break;
    if (st.events.some((e) => e.type === 'but' || e.type === 'arrêt')) break;
  }
  return { shot: st.events.find((e) => e.type === 'shot'), launch, plane, yAtGk, maxY };
};

// ---------- 1. L'ENROULÉE COURBE — et bat la lecture linéaire (le contrat du gardien)
{
  const { st, sgn, goal, cfg } = mk();
  const gk1 = st.players.find((q) => q.team === 1 && q.keeper);
  gk1.p[0] = -sgn * 30; gk1.p[2] = -20;                              // pas de gardien : on juge la BALISTIQUE
  const c = st.players.find((p) => p.team === 0 && !p.keeper);
  const z = 5.5, dx = Math.sqrt(15 * 15 - z * z);
  pose(st, c, goal.x - sgn * dx, z);                                  // dGoal 15, angle de repique
  const r = frappe(st, c, cfg, 0.5);                                  // u 0,5 ∈ [0,42 ; 0,56) latéral → enroulée
  const zLin = r.launch && r.plane ? r.launch.p[2] + r.launch.v[2] * ((goal.x - r.launch.p[0]) / r.launch.v[0]) : null;
  const corner = st.pitch.goalHalf - 0.55;
  ok(`l'ENROULÉE courbe (kind=${r.shot?.kind}, arrivée z=${r.plane?.z.toFixed(2)} au poteau ${corner.toFixed(2)}, ` +
    `lecture linéaire z=${zLin?.toFixed(2)} — la courbe bat la projection de ${zLin != null && r.plane ? Math.abs(r.plane.z - zLin).toFixed(2) : '?'} m, cadrée y=${r.plane?.y.toFixed(2)})`,
    r.shot?.kind === 'enroulée' && !!r.plane && Math.abs(r.plane.z - corner) < 0.9
    && zLin != null && Math.abs(r.plane.z - zLin) >= 0.5
    && Math.abs(r.plane.z - corner) < Math.abs(zLin - corner) && r.plane.y < st.pitch.goalH);
}

// ---------- 2. LE PIQUÉ est l'arme du UN-CONTRE-UN : gardien sorti PRÈS du tireur → par-dessus
{
  const { st, sgn, goal, cfg } = mk();
  const gk1 = st.players.find((q) => q.team === 1 && q.keeper);
  gk1.p[0] = goal.x - sgn * 9; gk1.p[2] = 0.5;                        // RUÉ dans le un-contre-un : à 5 m du tireur
  const c = st.players.find((p) => p.team === 0 && !p.keeper);
  pose(st, c, goal.x - sgn * 14, 0.5);                                // dGoal 14, dGk 5
  const r = frappe(st, c, cfg, 0.2, gk1.p[0]);                        // u 0,2 < 0,3 un-contre-un → piqué
  const but = st.events.some((e) => e.type === 'but');
  ok(`le PIQUÉ du un-contre-un passe par-dessus (kind=${r.shot?.kind}, y=${r.yAtGk?.toFixed(2)} m au passage du gardien ≥ 2,2 — gants à 2,1 —, apogée ${r.maxY.toFixed(2)} m, but=${but} : il ne recule pas plus vite que le vol)`,
    r.shot?.kind === 'piqué' && r.yAtGk != null && r.yAtGk >= 2.2 && but);
}

// ---------- 3. LE RAS-DE-TERRE rase — sous le plongeon, jamais au-dessus du demi-mètre
{
  const { st, sgn, goal, cfg } = mk();
  const gk1 = st.players.find((q) => q.team === 1 && q.keeper);
  gk1.p[0] = -sgn * 30; gk1.p[2] = -20;
  const c = st.players.find((p) => p.team === 0 && !p.keeper);
  pose(st, c, goal.x - sgn * 12, 0.5);                                // central, 12 m
  const r = frappe(st, c, cfg, 0.45);                                 // u 0,45 ∈ [0,42 ; 0,5) central → ras-de-terre
  ok(`le RAS-DE-TERRE rase (kind=${r.shot?.kind}, apogée ${r.maxY.toFixed(2)} m ≤ 0,5 sur tout le vol — sous le plongeon)`,
    r.shot?.kind === 'ras-de-terre' && !!r.plane && r.maxY <= 0.5);
}

// ---------- 4. LA FLOTTANTE SE LIT TARD (contrat keeperDecide : le spin est l'axe qu'on lit)
{
  const st = makeMatch({ full: true, seed: 5 });
  const own = st.pitch.ownGoal(0);
  const me = [own.x, 0, 0];
  const ball = [own.x + own.sign * -9, 0.5, 1.2];                     // 9 m devant sa ligne
  const v = [own.sign * 20.5, 0.5, 0.3];                              // 20,5 m/s vers le cadre
  // même vol, même âge (0,2 s — après le réflexe 0,12, avant la lecture tardive 0,29) :
  // SANS axe (1 rad/s) le gardien n'a rien à lire → poste ; AVEC axe (3,5) → il plonge
  const tard = keeperDecide(st.pitch, 0, me, ball, v, 0.2, KEEPER, true, 1.0);
  const lisible = keeperDecide(st.pitch, 0, me, ball, v, 0.2, KEEPER, true, 3.5);
  const hier = keeperDecide(st.pitch, 0, me, ball, v, 0.2, KEEPER, true, null);
  ok(`la FLOTTANTE se lit tard (même vol à 0,2 s : spin 1 rad/s → ${tard.mode}, spin 3,5 → ${lisible.mode} ; sans fil de spin → ${hier.mode} — le monde d'hier au bit près)`,
    tard.mode === 'poste' && lisible.mode === 'dive' && hier.mode === 'dive');
}

// ---------- 5. sabotage nommé « le pied unique » : shotVariety:false → le tendu d'hier, sans effet
{
  const { st, sgn, goal, cfg } = mk({ shotVariety: false });
  const gk1 = st.players.find((q) => q.team === 1 && q.keeper);
  gk1.p[0] = -sgn * 30; gk1.p[2] = -20;
  const c = st.players.find((p) => p.team === 0 && !p.keeper);
  const z = 5.5, dx = Math.sqrt(15 * 15 - z * z);
  pose(st, c, goal.x - sgn * dx, z);                                  // la MÊME scène que l'enroulée
  const r = frappe(st, c, cfg, 0.5);
  const zLin = r.launch && r.plane ? r.launch.p[2] + r.launch.v[2] * ((goal.x - r.launch.p[0]) / r.launch.v[0]) : null;
  const spin = Math.hypot(st.ball.w[0], st.ball.w[1], st.ball.w[2]);
  ok(`sabotage « pied unique » attrapé (shotVariety:false : kind=${r.shot?.kind}, courbe ${zLin != null && r.plane ? Math.abs(r.plane.z - zLin).toFixed(2) : '?'} m < 0,2 — le vol tendu d'hier, sans Magnus, nommé)`,
    r.shot?.kind === 'tendu' && !!r.plane && zLin != null && Math.abs(r.plane.z - zLin) < 0.2);
}

// ---------- 6. le FLUX : le répertoire VIT en match (balayage coupe-circuit, doctrine lot 36)
{
  const especes = new Set();
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const st = makeMatch({ full: true, seed });
    const cfg = matchCfg({ shotRange: 20 });
    for (let i = 0; i < 300 * 60; i++) matchStep(st, 1 / 60, cfg);
    for (const e of st.events) if (e.type === 'shot') especes.add(e.kind);
    if (especes.size >= 4) break;
  }
  ok(`le RÉPERTOIRE vit en match (${especes.size} espèces distinctes ≥ 4 : ${[...especes].join(', ')} — mesuré 20 × 300 s : 7 espèces, conversions 32-67 %)`,
    especes.size >= 4);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
