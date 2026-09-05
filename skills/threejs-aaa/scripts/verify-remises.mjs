// verify-remises.mjs — LES REMISES À LA MAIN (engine/motion-restart.js + strike-sim, lot A9).
//
// Ce qu'on prouve : (1) les trois gestes générés — la touche, le roulé du gardien, le ramassage — tiennent
// leur contrat (ballon entre les mains jusqu'au lâcher, mains au bon endroit au contact, pieds au sol pour
// la touche, tronc qui s'arque puis fouette, retour debout) pour le style neutre et vingt styles, passent
// checkClip, et que l'IK de bras est exacte ; (2) que la SIM joue la touche à la main — le preneur ARME le geste
// 'touche', le ballon part de ses mains au contact (rentrée à ballY ≥ 1,7, 0,62 s après l'armé) vers un
// coéquipier — et que la relance à la main du gardien s'habille du roulé, lâché bas ; (3) que chaque clause
// attrape son sabotage nommé.
//
// Lancer : node skills/threejs-aaa/scripts/verify-remises.mjs

import { SHANON_PROFILE } from '../assets/starter/src/engine/motion-profile-shanon.js';
import { generateRestart, checkRestartGen, restartPortrait, armIK, RESTART_NAMES, RESTART_KINDS } from '../assets/starter/src/engine/motion-restart.js';
import { styleFromSeed } from '../assets/starter/src/engine/motion-strike.js';
import { checkClip, resolveTracks, MOVES } from '../assets/starter/src/engine/animkit.js';
import { fkPose, jointsToSpec, rx } from '../assets/starter/src/engine/motion-rig.js';
import { neutralJoints } from '../assets/starter/src/engine/motion-strike.js';
import { quatMul } from '../assets/starter/src/engine/vecmath.js';
import { byId } from '../assets/starter/src/engine/technique.js';
import { MOVE_TIMING } from '../assets/starter/src/engine/skills-sim.js';
import { TOUCHE_H } from '../assets/starter/src/engine/strike-sim.js';
import { makeMatch, matchCfg, playMatch, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { simInternals } from '../assets/starter/src/engine/rondo-sim.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`✓ ${label}`); } else { fail++; console.log(`✗ ${label}`); } };
const P = SHANON_PROFILE;
const f2 = (v) => v.map((x) => x.toFixed(2)).join(', ');

// ---- 1. les trois gestes, style neutre
for (const kind of RESTART_NAMES) {
  const spec = generateRestart(kind, P);
  const r = checkRestartGen(spec, P, kind);
  const c = checkClip(resolveTracks(spec));
  const p = r.portrait;
  ok(r.ok && c.ok, `${kind} (${spec.keys.length} clés, contact ${spec.contact} s) — mains au contact (${f2(p.midC)}) m, écart ${(p.apartC * 100).toFixed(0)} cm, bassin ${p.pelvisC[1].toFixed(2)} m${r.ok ? '' : ' — ' + r.issues.join(' ; ')}${c.ok ? '' : ' — checkClip : ' + c.issues.join(' ; ')}`);
}

// ---- 2. vingt styles de joueur : sous contrat
{
  let bad = 0;
  for (let s = 1; s <= 20; s++) for (const kind of RESTART_NAMES) {
    const spec = generateRestart(kind, P, { style: styleFromSeed(s) });
    const r = checkRestartGen(spec, P, kind), c = checkClip(resolveTracks(spec));
    if (!r.ok || !c.ok) { bad++; if (bad <= 3) console.log(`   graine ${s} ${kind} : ${[...r.issues, ...c.issues].join(' ; ')}`); }
  }
  ok(bad === 0, `20 styles × 3 gestes = 60 remises sous contrat et checkClip (${bad} rouges)`);
}

// ---- 3. l'IK de bras : exacte quand la cible est atteignable, sans saut de vrille
{
  const J = { ...neutralJoints() };
  J.Hips = rx(-6); J.Spine = rx(-5); J.Spine1 = rx(-3); J.Spine2 = rx(-2);
  const partial = fkPose(P, jointsToSpec(P, J), [0, 0, 0]);
  const mulAll = (...qs) => qs.reduce((a, q) => quatMul(a, q));
  let worst = 0;
  for (const target of [[0.16, 1.2, -0.32], [0.16, 1.75, -0.2], [0.16, 1.7, 0.18], [0.3, 0.95, -0.35], [0.05, 1.5, -0.4]]) {
    const Rpar = mulAll(J.Hips, J.Spine, J.Spine1, J.Spine2, [0, 0, 0, 1]);
    const r = armIK(P, 'Right', partial.RightArm.p, Rpar, target, [0.6, 0.2, 0.6]);
    const JJ = { ...J, RightArm: r.Rarm, RightForeArm: r.Rfore };
    const h = fkPose(P, jointsToSpec(P, JJ), [0, 0, 0]).RightHand.p;
    if (r.reachable) worst = Math.max(worst, Math.hypot(h[0] - target[0], h[1] - target[1], h[2] - target[2]));
  }
  ok(worst < 0.002, `armIK : le poignet arrive à ${(worst * 1000).toFixed(2)} mm de la cible (cinq cibles atteignables)`);
  // continuité : le poignet balaie 160° autour de l'épaule (de devant-bas à derrière la tête, à 34 cm — la sphère de
  // la touche) en 60 pas ; la rotation du bras ne saute jamais de plus de 6° entre deux pas. (Un arc qui passait à 16 cm
  // de l'épaule pliait le coude à 150° : là le plan du coude tourne vite, et c'est la géométrie, pas l'IK.)
  let jump = 0, prev = null;
  const sh = partial.RightArm.p;
  for (let i = 0; i <= 60; i++) {
    const th = (-40 + 160 * i / 60) * Math.PI / 180, target = [sh[0] - 0.03, sh[1] + 0.34 * Math.sin(th), sh[2] - 0.34 * Math.cos(th)];
    const Rpar = mulAll(J.Hips, J.Spine, J.Spine1, J.Spine2, [0, 0, 0, 1]);
    const r = armIK(P, 'Right', partial.RightArm.p, Rpar, target, [0.6, 0.2, 0.6]);
    if (prev) { const d = 2 * Math.acos(Math.min(1, Math.abs(prev[0] * r.Rarm[0] + prev[1] * r.Rarm[1] + prev[2] * r.Rarm[2] + prev[3] * r.Rarm[3]))) * 180 / Math.PI; jump = Math.max(jump, d); }
    prev = r.Rarm;
  }
  ok(jump < 6, `armIK : continue le long d'un arc (saut max ${jump.toFixed(1)}° par pas — le plan du coude vient du pôle, pas de la géométrie)`);
}

// ---- 4. le registre : les trois espèces sont des MOVES, avec leur timing, et les techniques les nomment
{
  ok(RESTART_NAMES.every((k) => MOVES[k] && MOVE_TIMING[k] && Math.abs(MOVE_TIMING[k].contact - RESTART_KINDS[k].contact) < 1e-6), `touche, rouleMain, ramassage sont des MOVES générés, contact ${RESTART_NAMES.map((k) => MOVE_TIMING[k]?.contact).join(' / ')} s`);
  ok(byId.touche?.clip === 'touche' && byId['roule-main']?.clip === 'rouleMain' && byId.touche.intent === 'mains', 'les techniques touche et roule-main existent, intent \'mains\' (jamais candidates au plan du pied)');
}

// ---- 5. LA SIM JOUE LA TOUCHE À LA MAIN — trois touches FORCÉES par match (le hasard n'en garantit aucune en
// 2 × 180 s), deux matchs, la cfg de la scène ; puis la relance à la main du gardien, prise sur pièce (l'événement
// 'relance-main' n'est jamais tombé en 7 graines × 240 s : la clause force la distribution via beginPass).
{
  const cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 180, pause: 6 } });
  let touches = 0, hauts = 0, delais = [], recus = 0, pris = 0, rentrees = 0, faces = [];
  for (const seed of [7, 3]) {
    let { st } = playMatch(makeMatch({ full: true, seed }), 12, { cfg });
    for (const x of [-20, 5, 25]) {
      const z = 33.9 * (x > 0 ? 1 : -1);
      st.ball.restart([x, 0.11, z], { cause: 'touche' });
      st.restart = { type: 'touche', p: [x, z], team: 1 - (st.lastTouch ?? 0), at: st.t + 2.5, placed: false };
      ({ st } = playMatch(st, 25, { cfg }));
    }
    const ev = st.events;
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i];
      if (e.type === 'restart-pris') pris++;
      if (e.type === 'rentrée') { rentrees++; faces.push(e.face); }
      if (e.type === 'windup' && e.tech === 'touche') {
        touches++;
        const r = ev.slice(i + 1, i + 40).find((x) => x.type === 'rentrée' && x.by === e.by);
        if (r && r.ballY >= 1.7) hauts++;
        if (r) delais.push(r.t - e.t);
        const team = st.players[e.by].team;
        const nxt = r && ev.slice(ev.indexOf(r) + 1, ev.indexOf(r) + 80).find((x) => (x.type === 'control' || x.type === 'receive' || x.type === 'intercept') && x.by != null);
        if (nxt && st.players[nxt.by].team === team) recus++;
      }
    }
  }
  const dmin = Math.min(...delais), dmax = Math.max(...delais);
  ok(touches >= 6 && rentrees === touches, `chaque touche s'ARME avant de partir : ${touches} armés 'touche' pour ${rentrees} rentrées (${pris} remises prises, 6 forcées)`);
  ok(touches > 0 && hauts === touches, `chaque touche part de la hauteur des mains : ${hauts}/${touches} rentrées à ballY ≥ 1,7 (TOUCHE_H ${TOUCHE_H})`);
  ok(delais.length === touches && dmin > 0.5 && dmax < 0.8, `le ballon part AU CONTACT du geste (${dmin.toFixed(2)}-${dmax.toFixed(2)} s après l'armé, contact ${RESTART_KINDS.touche.contact} s)`);
  ok(touches > 0 && recus / touches >= 0.5, `la touche trouve un coéquipier : ${recus}/${touches} premiers contacts pour l'équipe du preneur`);
  ok(faces.length === rentrees && Math.max(...faces) <= 15, `le lanceur FAIT FACE à sa cible au lâcher (écart corps-cible max ${Math.max(...faces)}° ≤ 15, ${faces.join('/')} — mesuré avant : il lançait dos au jeu, face à la lisse, 171°)`);
  // la relance à la main du gardien : le ballon dans ses gants, beginPass(mains) doit armer le roulé, et le ballon partir bas
  const st0 = playMatch(makeMatch({ full: true, seed: 7 }), 12, { cfg }).st;
  const gk = st0.players.find((p) => p.keeper && p.team === 0);
  st0.ball.restart([gk.p[0], 0.11, gk.p[2]], { cause: 'touche' });
  st0.ball.possess(gk.id); st0.possession.carrier = gk.id; st0.hold = 1.5;   // il a tenu le ballon (la porte 'timing' de beginPass lit st.hold)
  const libre = st0.players.filter((p) => p.team === gk.team && !p.keeper).sort((a, b) => Math.hypot(a.p[0] - gk.p[0], a.p[2] - gk.p[2]) - Math.hypot(b.p[0] - gk.p[0], b.p[2] - gk.p[2]))[1];
  const armed = simInternals.beginPass(st0, { to: { id: libre.id }, lead: [libre.p[0], 0, libre.p[2]], style: 'ground', lane: { margin: 6 } }, cfg, { forceUrgent: true, mains: true });   // lead = [x, 0, z], comme keeper.relancerGardien
  const w = st0.events.filter((e) => e.type === 'windup' && e.by === gk.id).pop();
  for (let i = 0; i < 120 && !st0.events.some((e) => e.type === 'pass' && e.from === gk.id && w && e.t >= w.t); i++) matchStep(st0, 1 / 60, cfg);
  const pr = st0.events.find((e) => e.type === 'pass' && e.from === gk.id && w && e.t >= w.t);
  ok(!!armed && w?.tech === 'roule-main' && w.move === 'rouleMain', `la relance à la main du gardien s'habille du roulé : windup tech ${w?.tech ?? '—'}, move ${w?.move ?? '—'}`);
  ok(!!pr && pr.ballY >= 0.2 && pr.ballY <= 0.6 && pr.t - w.t > 0.4 && pr.t - w.t < 0.8, `le roulé lâche le ballon BAS devant, au contact : passe à ballY ${pr?.ballY ?? '—'} m, ${pr ? (pr.t - w.t).toFixed(2) : '—'} s après l'armé (contact ${RESTART_KINDS.rouleMain.contact} s)`);
}

// ---- 6. les sabotages nommés (par la substitution des paramètres d'espèce)
const sab = (label, kind, mutate, want) => {
  const K = RESTART_KINDS[kind], saved = { ...K };
  Object.assign(K, mutate(K));
  const spec = generateRestart(kind, P);
  const r = checkRestartGen(spec, P, kind);
  Object.assign(K, saved);
  const hit = !r.ok && r.issues.some((i) => want.test(i));
  ok(hit, `sabotage « ${label} » attrapé${hit ? ` (${r.issues.find((i) => want.test(i)).slice(0, 90)})` : r.ok ? ' — PASSÉ SOUS LE CONTRAT' : ` — autre motif : ${r.issues.join(' ; ').slice(0, 120)}`}`);
};
sab('touche lâchée bas (releaseH 1,3)', 'touche', () => ({ releaseH: 1.3 }), /lâcher à/);
sab('touche sans armé derrière la tête (back −0,2)', 'touche', () => ({ back: -0.2, backH: 1.5 }), /DERRIÈRE la tête/);
sab('touche sans fouetté (whip 0, arch 0)', 'touche', () => ({ whip: 0, arch: 0 }), /arque|fouette/);
sab('roulé lâché haut (releaseH 0,9)', 'rouleMain', () => ({ releaseH: 0.9 }), /lâcher à/);
sab('roulé sans armé (backswing −0,1)', 'rouleMain', () => ({ backswing: -0.1 }), /armé derrière/);
sab('ramassage qui ne se baisse pas (dip 0,05, lean 20)', 'ramassage', () => ({ dip: 0.05, lean: 20 }), /cueillent|baisse/);

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
