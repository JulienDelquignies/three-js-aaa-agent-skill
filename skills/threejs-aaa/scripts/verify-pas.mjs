#!/usr/bin/env node
// verify-pas — L'HORLOGE DE FOULÉE DANS LA SIM (engine/pas.js, cfg.pas — le duel l'allume) : la conduite touche le ballon avec le pied
// qui l'ATTEINT (le cou-de-pied des pieds du générateur, tabulés), une fois par vol au plus ; le passement se fait DANS la foulée (le
// corps court, le ballon est tenu devant). Mesuré avant (sonde de rendu, duel, 60 s) : le pied « qui jouait » à 0,7 m du ballon (p50)
// à l'instant de la touche, deux touches par pas ; les passements plantaient le corps (0 m/s, 0,6-1,6 s).
// Sabotage : cfg.pas false — la conduite d'hier (aucune touche au contact du pied), le passement planté.
// Usage : node verify-pas.mjs   (sans navigateur ; ~1 min)
import { makeDuel, duelCfg } from '../assets/starter/src/engine/duel-1v1.js';
import { matchStep } from '../assets/starter/src/engine/match-sim.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`✓ ${label}`); } else { fail++; console.log(`✗ ${label}`); } };
const q = (xs, f) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(f * (s.length - 1))] : NaN; };

const GRAINES = Array.from({ length: Number(process.env.GRAINES ?? 8) }, (_, i) => i + 1);   // GRAINES=16 : l'échantillon doublé (les clauses de gestes sont bruitées sur 8)
function jouer(pas, seeds = GRAINES, secs = 120, drb = null) {   // 8 graines : sur 4 le double contact (8 en 32 min) pouvait manquer — la clause du répertoire tombait par l'échantillon
  const R = { gestes: {}, gV: [], gOk: 0, gN: 0, portee: [], touches: 0, enCourse: 0, contact: 0, parVol: 0, passFoulee: 0, passCale: 0, vMin: [], ballMax: [], buts: 0, conduite: 0, tenu: 0, libre: 0, derriere: 0 };
  for (const seed of seeds) {
    const st = makeDuel({ seed }), cfg = duelCfg({ pas, ...(drb ?? {}) }), dt = 1 / 60; let ne = 0; const open = {}, dernier = {};   // (sabotage) des clés de dribble changées
    for (let i = 0; i < secs * 60; i++) {
      matchStep(st, dt, cfg);
      while (ne < st.events.length) {
        const e = st.events[ne++];
        if (e.type === 'touche') {
          R.touches++; const c = st.players[e.by]; if (e.portee != null) R.portee.push(e.portee);
          if (c.speed >= 1.2 && e.pas !== 'porté') { R.enCourse++; if (e.pas === 'contact' || (e.pas === 'geste' && e.contact)) R.contact++; }   // (2026-09-25) le PORTÉ n'est pas une touche (un pied passe près d'un ballon tenu au servo) : hors du compte   // (2026-09-25) la touche d'un geste au cou-de-pied est une touche au contact
          // une touche par VOL : deux touches du même pied à moins d'un demi-cycle
          if (e.foot && c._pas && e.pas !== 'lent') { R.synchro = (R.synchro ?? 0) + 1; const k = `${e.by}${e.foot}`; if (dernier[k] != null && st.t - dernier[k] < 0.5 * c._pas.T) R.parVol++; dernier[k] = st.t; }   // (les touches lentes, < 1 m/s, sont celles d'hier : cadencées à la distance)
        }
        if (e.type === 'skill' && e.kind === 'passement') { if (e.foulee) R.passFoulee++; else R.passCale++; open[e.by] = { vs: [], bm: 0, foulee: !!e.foulee }; }
        if (e.type === 'skill' && e.foulee && !/-vendu/.test(e.kind)) { R.gestes[e.kind] = (R.gestes[e.kind] ?? 0) + 1; R.gN++; (R._suivis ??= []).push({ by: e.by, t: st.t + 1.5, ev0: st.events.length, vs: [] }); }
        if (e.type === 'but' || e.type === 'goal') R.buts++;
      }
      { const car = st.possession?.carrier ?? -1, c = st.players[car];   // la conduite en course : le ballon TENU au servo, le ballon libre DERRIÈRE le porteur
        if (c && !c.keeper && st.phase === 'carry' && !st.restart && !c.act && Math.hypot(...c.v) >= 1) { /* (2026-09-26) le joueur de champ : le gardien qui marche ballon EN MAIN n'est pas une conduite au servo */ R.conduite++; if (st.ball.owner === car) R.tenu++; else { R.libre++; const v = Math.hypot(...c.v); if (((st.ball.p[0] - c.p[0]) * c.v[0] + (st.ball.p[2] - c.p[2]) * c.v[1]) / v < -0.1) R.derriere++; } } }
      for (let g = (R._suivis ?? []).length - 1; g >= 0; g--) { const x = R._suivis[g], p = st.players[x.by]; if (p.act?.payload?.foulee) x.vs.push(p.speed);
        if (st.t >= x.t) { if (x.vs.length) R.gV.push(Math.min(...x.vs)); if (st.phase === 'carry' && st.possession.carrier === x.by || st.events.slice(x.ev0).some((e) => e.type === 'shot' && e.by === x.by)) R.gOk++; R._suivis.splice(g, 1); } }
      for (const [id, o] of Object.entries(open)) {
        const p = st.players[id];
        if (p.act?.payload?.skill === 'passement') { o.vs.push(p.speed); o.bm = Math.max(o.bm, Math.hypot(st.ball.p[0] - p.p[0], st.ball.p[2] - p.p[2])); }
        else { if (o.vs.length) { R.vMin.push(Math.min(...o.vs)); if (o.foulee) R.ballMax.push(o.bm); } delete open[id]; }
      }
    }
  }
  return R;
}

console.log(`— la conduite au pied qui l'atteint, le passement dans la foulée (duel, ${GRAINES.length} graines × 120 s) —`);
const A = jouer(true), H = jouer(false);
const part = A.contact / Math.max(1, A.enCourse);
ok(part >= 0.55, `en course (≥ 1,2 m/s), ${(100 * part).toFixed(0)} % des touches se jouent AU COU-DE-PIED d'un pied qui vole (${A.contact}/${A.enCourse} ; plancher 55 % — le porté exclu : hier compté, ce n'était pas une touche ; 60 % sans lui avant la conduite libre, les autres touches sont des fins de vol à portée du rendu)`);
const W = jouer(true, GRAINES, 120, { conduite: false, recup: false }), tenu = (R) => R.tenu / Math.max(1, R.conduite), derr = (R) => R.derriere / Math.max(1, R.libre);
ok(tenu(A) <= 0.08 && tenu(W) > 0.15, `en course le ballon n'est plus TENU au servo (une force sans pied) : ${(100 * tenu(A)).toFixed(0)} % du temps de conduite (plafond 8 % — la tenue dos au presseur, le ballon quasi mort) ; sabotage conduite + récupération d'hier (le servo) : ${(100 * tenu(W)).toFixed(0)} %, la clause mord`);
ok(derr(A) <= 0.18 && derr(W) > derr(A), `le porteur ne dépasse pas son ballon : ballon libre DERRIÈRE lui ${(100 * derr(A)).toFixed(0)} % du temps (plafond 18 %) ; sabotage conduite + récupération d'hier : ${(100 * derr(W)).toFixed(0)} %, la clause mord`);
ok(A.parVol <= 0.01 * A.synchro, `une touche par vol au plus : ${A.parVol} doublons sur ${A.synchro} touches synchronisées au pas (plafond 1 %)`);
ok(A.passFoulee >= 4 && q(A.vMin, 0.5) >= 1.2 && q(A.ballMax, 0.9) <= 0.8, `le passement se fait DANS la foulée : ${A.passFoulee} lancés (${A.passCale} calés sous 1,4 m/s), le corps court encore à ${q(A.vMin, 0.5).toFixed(1)} m/s au plus bas (p50 ; plancher 1,2), le ballon reste devant (≤ ${q(A.ballMax, 0.9).toFixed(2)} m au p90 ; plafond 0,8)`);
const S = jouer(true, GRAINES, 120, { pasPortee: 9 });   // (8 graines : sur 4 le sabotage ne mordait que dans une — p90 de ~35 touches = la 4e plus grande)
ok(q(A.portee, 0.9) <= 0.42 && q(S.portee, 0.9) > 0.42, `la touche de rattrapage (fin de vol, sans rendez-vous) ne part que si le pied PEUT atteindre le ballon : sa pose à ≤ ${q(A.portee, 0.9).toFixed(2)} m du ballon au p90 (${A.portee.length} touches ; plafond 0,42 — le rendu l'y amène, viseBallon ≤ 0,4 m) ; sabotage sans l'attente : ${q(S.portee, 0.9).toFixed(2)} m, la clause mord`);
const kinds = Object.keys(A.gestes), Z = jouer(true, GRAINES, 120, { dribble1c1: false, passements: { ...duelCfg().passements, envie: 2, plancher: 0.35 } });
ok(kinds.length >= 4 && q(A.gV, 0.5) >= 1.2 && A.gOk >= 0.5 * A.gN, `le RÉPERTOIRE de la cage dans la foulée : ${A.gN} gestes, ${kinds.length} espèces (${kinds.map((k) => `${k} ${A.gestes[k]}`).join(', ')} ; plancher 4), le corps court pendant (${q(A.gV, 0.5).toFixed(1)} m/s au plus bas, p50), ${(100 * A.gOk / Math.max(1, A.gN)).toFixed(0)} % gardés ou tirés à +1,5 s (plancher 50 % — le dribble contre un défenseur REPLACÉ, face au but gardé : l'ordre des dribbles réussis du haut niveau, ≈ 45-55 % ; 60 % tant qu'il fuyait un défenseur qui le chassait de dos)`);
ok(Object.keys(Z.gestes).length < kinds.length, `sabotage — sans le répertoire de la cage (dribble1c1 false, le passement d'hier en tête) : ${Object.keys(Z.gestes).length} espèces (${Object.entries(Z.gestes).map(([k, v]) => `${k} ${v}`).join(', ')}) : la clause mord`);
ok(A.buts >= 0.6 * H.buts, `le jeu vit : ${A.buts} buts (hier ${H.buts})`);
ok(H.contact === 0 && q(H.vMin, 0.5) < 0.5, `sabotage — sans l'horloge (cfg.pas false) : ${H.contact} touches au contact d'un pied, les passements plantés (${q(H.vMin, 0.5).toFixed(1)} m/s au plus bas) : les clauses mordent`);
console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
