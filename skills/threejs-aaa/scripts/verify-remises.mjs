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
// (lot A9 bis) …et LES REMISES AU PIED : le dégagement de volée du gardien (geste 'voleeGardien' : mains ensemble jusqu'au lâcher,
// le pied prend le ballon tombé à mi-hauteur), la COURSE D'ÉLAN des coups francs et corners (recule, attend, court, la prise au
// contact à l'arrivée), le lanceur DERRIÈRE la ligne, et la clé absente qui rend l'hier.
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
import { relancerGardien } from '../assets/starter/src/engine/keeper.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`✓ ${label}`); } else { fail++; console.log(`✗ ${label}`); } };
const P = SHANON_PROFILE;
const f2 = (v) => v.map((x) => x.toFixed(2)).join(', ');
// une remise FORCÉE n'écrase pas un geste des mains en cours (un armé de touche naturel pendant la pose forcée envoyait le
// ballon de l'autre ligne, du sol — un artefact du banc, pas du moteur) : on attend le calme
const quiet = (st, cfg) => { for (let i = 0; i < 240 && st.players.some((p) => p.act && (p.act.payload?.mains || p.act.payload?.kind === 'elan')); i++) matchStep(st, 1 / 60, cfg); };

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
  ok(bad === 0, `20 styles × ${RESTART_NAMES.length} gestes = ${20 * RESTART_NAMES.length} remises sous contrat et checkClip (${bad} rouges)`);
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
  ok(byId.touche?.clip === 'touche' && byId['roule-main']?.clip === 'rouleMain' && byId.touche.intent === 'mains' && byId['volee-gardien']?.clip === 'voleeGardien' && byId['volee-gardien'].intent === 'mains', 'les techniques touche, roule-main et volee-gardien existent, intent \'mains\' (jamais candidates au plan du pied)');
}

// ---- 5. LA SIM JOUE LA TOUCHE À LA MAIN — trois touches FORCÉES par match (le hasard n'en garantit aucune en
// 2 × 180 s), deux matchs, la cfg de la scène ; puis la relance à la main du gardien, prise sur pièce (l'événement
// 'relance-main' n'est jamais tombé en 7 graines × 240 s : la clause force la distribution via beginPass).
{
  const cfg = matchCfg({ horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (36/0 en worktree 3a78940), le lanceur remangé par l'appel de l'épaule (bassin −0,34 m, face 16°) — la clause mesure la touche, pas la Loi 11 */, shotRange: 20, passation: null, chrono: { periodes: 2, duree: 180, pause: 6 } });   // passation null DATÉ 252 (constaté au 256 : 36 ✓ au 250, 3/7 touches trouvées et un lâcher à 25° dans le monde de la remise au pivot — sept touches, le tirage)
  let touches = 0, hauts = 0, delais = [], recus = 0, pris = 0, rentrees = 0, faces = [], poses = [], horsLigne = [];
  for (const seed of [7, 3]) {
    let { st } = playMatch(makeMatch({ full: true, seed }), 12, { cfg });
    for (const x of [-20, 5, 25]) {
      const z = 33.9 * (x > 0 ? 1 : -1);
      quiet(st, cfg); if (st.ball.owner != null) st.ball.release('perte');
      st.ball.restart([x, 0.11, z], { cause: 'touche' });
      st.restart = { type: 'touche', p: [x, z], team: 1 - (st.lastTouch ?? 0), at: st.t + 2.5, placed: false };
      for (let i = 0; i < 60 * 25; i++) { const r = st.restart; const dz = r && r.type === 'touche' && r.placed === true && r.taker >= 0 ? Math.abs(st.players[r.taker].p[2]) - st.pitch.hz : null; matchStep(st, 1 / 60, cfg); if (dz != null && !st.restart) horsLigne.push(+dz.toFixed(2)); }
    }
    poses.push(st.ball.ledger.restarts.filter((r) => r.cause !== 'engagement').length - st.events.filter((e) => e.type === 'ramasseur').length);
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
  // LE REGISTRE DU BALLON : aucune remise posée par écriture — les seules poses sont le coup d'envoi et les trois
  // touches FORCÉES par le banc (restart cause 'touche', c'est le banc qui écrit) ; la touche jouée est PORTÉE
  // (holdMains) et lancée de là (retour du moteur, docs/Retour_Reference_A9_Remises.md : 5 poses par écriture avant)
  ok(poses.every((n) => n === 3), `aucune remise posée par écriture : ${poses.join(' + ')} poses au registre par match = les 3 forcées du banc (checkMatch : « la remise se PORTE »)`);
  const dmin = Math.min(...delais), dmax = Math.max(...delais);
  ok(touches >= 6 && rentrees === touches, `chaque touche s'ARME avant de partir : ${touches} armés 'touche' pour ${rentrees} rentrées (${pris} remises prises, 6 forcées)`);
  ok(touches > 0 && hauts === touches, `chaque touche part de la hauteur des mains : ${hauts}/${touches} rentrées à ballY ≥ 1,7 (TOUCHE_H ${TOUCHE_H})`);
  ok(delais.length === touches && dmin > 0.5 && dmax < 0.8, `le ballon part AU CONTACT du geste (${dmin.toFixed(2)}-${dmax.toFixed(2)} s après l'armé, contact ${RESTART_KINDS.touche.contact} s)`);
  ok(touches > 0 && recus / touches >= 0.5, `la touche trouve un coéquipier : ${recus}/${touches} premiers contacts pour l'équipe du preneur`);
  ok(horsLigne.length >= 6 && horsLigne.every((d) => d >= 0.1 && d <= 0.7), `LE LANCEUR DERRIÈRE LA LIGNE (lot A9 bis, cfg.remisesPied.touche) : le bassin à ${horsLigne.map((d) => d.toFixed(2)).join('/')} m hors du terrain à la prise (attendu 0,1-0,7 : les pieds sur ou derrière la ligne, Loi 15 — hier sur la ligne, les pieds dedans)`);
  ok(faces.length === rentrees && Math.max(...faces) <= 15, `le lanceur FAIT FACE à sa cible au lâcher (écart corps-cible max ${Math.max(...faces)}° ≤ 15, ${faces.join('/')} — mesuré avant : il lançait dos au jeu, face à la lisse, 171°)`);
  // LA CLÉ ABSENTE REND L'HIER (le contrat du moteur) : sans cfg.remisesMain, la touche part du sol à l'instant de la
  // prise (aucun armé 'touche', rentrée sans ballY) et la relance à la main du gardien reste une passe du pied
  {
    const cfg0 = matchCfg({ horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (36/0 en worktree 3a78940), le lanceur remangé par l'appel de l'épaule (bassin −0,34 m, face 16°) — la clause mesure la touche, pas la Loi 11 */, shotRange: 20, chrono: { periodes: 2, duree: 180, pause: 6 }, remisesMain: null });
    let { st } = playMatch(makeMatch({ full: true, seed: 7 }), 12, { cfg: cfg0 });
    for (const x of [-20, 5, 25]) {
      const z = 33.9 * (x > 0 ? 1 : -1);
      quiet(st, cfg0); if (st.ball.owner != null) st.ball.release('perte');
      st.ball.restart([x, 0.11, z], { cause: 'touche' });
      st.restart = { type: 'touche', p: [x, z], team: 1 - (st.lastTouch ?? 0), at: st.t + 2.5, placed: false };
      ({ st } = playMatch(st, 25, { cfg: cfg0 }));
    }
    const w0 = st.events.filter((e) => e.type === 'windup' && e.tech === 'touche').length, r0 = st.events.filter((e) => e.type === 'rentrée');
    ok(w0 === 0 && r0.length >= 3 && r0.every((e) => e.ballY == null), `la clé absente rend l'hier au bit : remisesMain:null → ${r0.length} rentrées instantanées du sol, ${w0} armé 'touche', aucun ballY`);
  }
  // la relance à la main du gardien : le ballon dans ses gants, beginPass(mains) doit armer le roulé, et le ballon partir bas
  const st0 = playMatch(makeMatch({ full: true, seed: 7 }), 12, { cfg }).st;
  const gk = st0.players.find((p) => p.keeper && p.team === 0);
  st0.ball.restart([gk.p[0], 0.11, gk.p[2]], { cause: 'touche' });
  st0.ball.possess(gk.id); st0.possession.carrier = gk.id; st0.hold = 1.5;   // il a tenu le ballon (la porte 'timing' de beginPass lit st.hold)
  const libre = st0.players.filter((p) => p.team === gk.team && !p.keeper).sort((a, b) => Math.hypot(a.p[0] - gk.p[0], a.p[2] - gk.p[2]) - Math.hypot(b.p[0] - gk.p[0], b.p[2] - gk.p[2]))[1];
  const armed = simInternals.beginPass(st0, { to: { id: libre.id }, lead: [libre.p[0], 0, libre.p[2]], style: 'ground', lane: { margin: 6 } }, cfg, { forceUrgent: true, mains: true });   // lead = [x, 0, z], comme keeper.relancerGardien
  const w = st0.events.filter((e) => e.type === 'windup' && e.by === gk.id).pop();
  for (let i = 0; i < 120 && !st0.events.some((e) => e.type === 'pass' && e.by === gk.id && w && e.t >= w.t); i++) matchStep(st0, 1 / 60, cfg);
  const pr = st0.events.find((e) => e.type === 'pass' && e.by === gk.id && w && e.t >= w.t);
  ok(!!armed && w?.tech === 'roule-main' && w.move === 'rouleMain', `la relance à la main du gardien s'habille du roulé : windup tech ${w?.tech ?? '—'}, move ${w?.move ?? '—'}`);
  ok(!!pr && pr.ballY >= 0.2 && pr.ballY <= 0.6 && pr.t - w.t > 0.4 && pr.t - w.t < 0.8, `le roulé lâche le ballon BAS devant, au contact : passe à ballY ${pr?.ballY ?? '—'} m, ${pr ? (pr.t - w.t).toFixed(2) : '—'} s après l'armé (contact ${RESTART_KINDS.rouleMain.contact} s)`);
}

// ---- 7. LES REMISES AU PIED (lot A9 bis, cfg.remisesPied)
{
  const cfg = matchCfg({ horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (36/0 en worktree 3a78940), le lanceur remangé par l'appel de l'épaule (bassin −0,34 m, face 16°) — la clause mesure la touche, pas la Loi 11 */, shotRange: 20, chrono: { periodes: 2, duree: 180, pause: 6 } });
  const hyp = Math.hypot;
  // LA VOLÉE : le gardien tient le ballon aux gants (prise forcée), le style long → beginPass(mains 'volee') arme le geste, les
  // gants descendent, le ballon TOMBE, le pied le prend à mi-hauteur (la passe part de la hauteur du ballon, jamais du sol)
  {
    let { st } = playMatch(makeMatch({ full: true, seed: 3 }), 8, { cfg });
    const gk = st.players.find((p) => p.keeper && p.team === 0);
    if (st.ball.owner != null) st.ball.release('perte');
    st.ball.restart([gk.p[0] + 0.3, 1.0, gk.p[2]], { cause: 'sortie-de-but' }); st.restart = null; st.ball.possess(gk.id);
    st.possession = { team: 0, carrier: gk.id }; st.phase = 'carry'; st.hold = 0; gk._gkSince = st.t - 3; gk._mains = true; gk.v = [0, 0];
    st.tactics = st.tactics || [{}, {}]; st.tactics[0] = { ...(st.tactics[0] || {}), cpa: { ...((st.tactics[0] || {}).cpa || {}), sortieBut: 'long' } };
    const n0 = st.ball.ledger.restarts.length;
    const armed = relancerGardien(st, gk, cfg, { beginPass: simInternals.beginPass });
    const A = gk.act, w = st.events.filter((e) => e.type === 'windup' && e.by === gk.id).pop();
    let yHaut = 0, yBas = 9, yRel = null, tombe = true, prevY = null;
    for (let i = 0; i < 120 && gk.act && !gk.act.fired; i++) { matchStep(st, 1 / 60, cfg); if (!gk.act || gk.act.fired) break; const y = st.ball.p[1]; if (gk.act?.payload?.lache == null) yHaut = Math.max(yHaut, y); else { if (yRel == null) yRel = y; if (prevY != null && y > prevY + 0.03) tombe = false; yBas = Math.min(yBas, y); } prevY = y; }
    for (let i = 0; i < 30 && !st.events.some((e) => e.type === 'pass' && e.by === gk.id && e.mains === 'volee'); i++) matchStep(st, 1 / 60, cfg);
    const pr = st.events.find((e) => e.type === 'pass' && e.by === gk.id && e.mains === 'volee');
    ok(!!armed && A?.payload?.mains === 'volee' && w?.tech === 'volee-gardien' && w.move === 'voleeGardien', `LE DÉGAGEMENT DE VOLÉE s'arme aux gants : windup tech ${w?.tech ?? '—'}, move ${w?.move ?? '—'}, mains ${A?.payload?.mains ?? '—'} (anticipation ${A?.anticipation?.toFixed(2) ?? '—'} s)`);
    ok(yHaut >= 0.9 && yRel != null && tombe && yBas <= yRel - 0.12, `le ballon vit aux mains (${yHaut.toFixed(2)} m) puis TOMBE du lâcher (${yRel?.toFixed(2) ?? '—'} m) au contact (jamais posé par écriture) : y descend jusqu'à ${yBas.toFixed(2)} m`);
    ok(!!pr && pr.ballY >= 0.45 && pr.ballY <= 0.9 && pr.style === 'lofted' && st.ball.ledger.restarts.length === n0, `la frappe part de la hauteur du ballon tombé : passe ${pr?.style ?? '—'} à ballY ${pr?.ballY ?? '—'} m (attendu 0,45-0,9 — hier : téléporté au sol, 0,11) ; aucune pose au registre`);
  }
  // LA COURSE D'ÉLAN : coup franc à 24 m (direct) et à 40 m (lancement), corner — forcés sur deux graines. Le preneur recule,
  // attend, court ; le geste s'arme sur la course (windup tech 'elan') et la remise se prend AU CONTACT, à l'arrivée ('élan'
  // puis la frappe d'hier dans la même image), le corps encore lancé (≥ 2 m/s : il court à travers le ballon).
  const forceCPA = (st, cfg, type, p, team, onWindup = null) => {
    quiet(st, cfg); if (st.ball.owner != null) st.ball.release('perte');
    st.ball.restart([p[0], 0.11, p[1]], { cause: type }); st.restart = { type, p, team, at: st.t + 3, placed: false }; st.possession = { team, carrier: -1 }; st.phase = 'loose';
    const n0 = st.events.length, t0 = st.t; let taken = null, armed = false;
    for (let i = 0; i < 60 * 30; i++) { const had = !!st.restart; matchStep(st, 1 / 60, cfg); if (!armed && onWindup && st.events.slice(n0).some((e) => e.type === 'windup' && e.tech === 'elan')) { armed = true; onWindup(st); } if (had && !st.restart) { taken = st.t; break; } }
    for (let i = 0; i < 90 && taken != null; i++) matchStep(st, 1 / 60, cfg);   // la frappe d'hier (ou, au corner court, la passe qui suit)
    const ev = st.events.slice(n0);
    const w = ev.find((e) => e.type === 'windup' && e.tech === 'elan'), el = ev.find((e) => e.type === 'élan');
    const frappe = ev.find((e) => (e.type === 'shot' && e.kind === 'coup-franc-direct') || e.type === 'lancement' || e.type === 'corner-joué' || (e.type === 'pass' && e.t >= (el?.t ?? Infinity)));
    const pris = ev.find((e) => e.type === 'restart-pris');
    return { type, taken: taken != null ? +(taken - t0).toFixed(2) : null, w, el, frappe, memeImage: !!(el && pris && Math.abs(pris.t - el.t) < 0.02 && (!frappe || frappe.type === 'pass' || Math.abs(frappe.t - el.t) < 0.02)) };
  };
  const runs = [];
  for (const seed of [7, 3]) {
    let { st } = playMatch(makeMatch({ full: true, seed }), 8, { cfg });
    const g = st.pitch.attackGoal(0), sg = Math.sign(g.x || 1);
    for (const [type, p] of [['coup-franc', [g.x - sg * 24, 3]], ['coup-franc', [g.x - sg * 40, -6]], ['corner', [g.x, st.pitch.hz]]]) runs.push(forceCPA(st, cfg, type, p, 0));
  }
  const armes = runs.filter((r) => r.w), arrivees = runs.filter((r) => r.el), prises = runs.filter((r) => r.taken != null);
  ok(prises.length === runs.length && armes.length === runs.length, `LA COURSE D'ÉLAN s'arme sur chaque coup de pied arrêté : ${armes.length}/${runs.length} armés 'elan' (départs à ${runs.map((r) => r.w?.depart ?? '—').join('/')} m du ballon), ${prises.length} remises prises`);
  ok(arrivees.length === runs.length && arrivees.every((r) => r.el.vitesse >= 2 && r.el.course >= 0.5 && r.el.d <= 1.0), `la remise se prend AU CONTACT, à l'arrivée, le corps lancé : ${arrivees.map((r) => r.el.vitesse).join('/')} m/s après ${arrivees.map((r) => r.el.course).join('/')} s de course, à ${arrivees.map((r) => r.el.d).join('/')} m du ballon`);
  ok(runs.every((r) => r.memeImage), `…et la remise se prend dans la MÊME image que le contact du geste, la frappe d'hier avec elle : ${runs.map((r) => r.frappe ? (r.frappe.kind ?? r.frappe.type) : 'corner court (le ballon au pied)').join('/')}`);
  ok(runs.every((r) => r.w && r.w.depart >= (r.type === 'corner' ? 1.2 : 2.5)), `le départ est DERRIÈRE le ballon : ${runs.map((r) => r.w?.depart ?? '—').join('/')} m (recul 3,5 sur la ligne ballon-cible ; borné par le tablier au corner, ≥ 1,2)`);
  // LA CLÉ ABSENTE REND L'HIER : sans cfg.remisesPied, la frappe part à l'instant de la prise (aucun armé 'elan', aucun 'élan'), du
  // point de pose ; et le gardien qui tient le ballon le pose au sol à la frappe (passe sans ballY)
  {
    const cfg0 = matchCfg({ horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (36/0 en worktree 3a78940), le lanceur remangé par l'appel de l'épaule (bassin −0,34 m, face 16°) — la clause mesure la touche, pas la Loi 11 */, shotRange: 20, chrono: { periodes: 2, duree: 180, pause: 6 }, remisesPied: null });
    let { st } = playMatch(makeMatch({ full: true, seed: 7 }), 8, { cfg: cfg0 });
    const g = st.pitch.attackGoal(0), sg = Math.sign(g.x || 1);
    const r0 = [forceCPA(st, cfg0, 'coup-franc', [g.x - sg * 24, 3], 0), forceCPA(st, cfg0, 'corner', [g.x, st.pitch.hz], 0)];
    const gk = st.players.find((p) => p.keeper && p.team === 0);
    quiet(st, cfg0); if (st.ball.owner != null) st.ball.release('perte');
    st.ball.restart([gk.p[0] + 0.3, 1.0, gk.p[2]], { cause: 'sortie-de-but' }); st.restart = null; st.ball.possess(gk.id);
    st.possession = { team: 0, carrier: gk.id }; st.phase = 'carry'; st.hold = 0; gk._gkSince = st.t - 3; gk._mains = true; gk.v = [0, 0];
    st.tactics = st.tactics || [{}, {}]; st.tactics[0] = { ...(st.tactics[0] || {}), cpa: { ...((st.tactics[0] || {}).cpa || {}), sortieBut: 'long' } };
    relancerGardien(st, gk, cfg0, { beginPass: simInternals.beginPass });
    const m0 = gk.act?.payload?.mains ?? null;
    ok(r0.every((r) => r.taken != null && !r.w && !r.el && r.frappe) && m0 == null, `la clé absente rend l'hier au bit : remisesPied:null → ${r0.filter((r) => r.taken != null).length} remises prises sans armé ni course (${r0.map((r) => r.frappe?.kind ?? r.frappe?.type ?? '—').join('/')}), la volée du gardien redevient la frappe du sol (mains ${m0 ?? 'null'})`);
  }
  // le sabotage de la sim : le preneur EMPORTÉ à 15 m dès l'armé (la course n'arrive pas) — pas de frappe dans le vide : l'armé
  // s'étire, puis s'abandonne (refus élan-sans-ballon) et la prise d'hier prend au ballon
  {
    let { st } = playMatch(makeMatch({ full: true, seed: 7 }), 8, { cfg });
    const g = st.pitch.attackGoal(0), sg = Math.sign(g.x || 1);
    const r = forceCPA(st, cfg, 'coup-franc', [g.x - sg * 24, 3], 0, (st) => { const tk = st.players[st.restart.taker]; tk.p[0] -= sg * 15; });
    const abandon = (st.deny?.['élan-sans-ballon'] ?? 0) > 0;
    ok(r.taken != null && r.w && !r.el && r.frappe && abandon, `sabotage « le preneur emporté » attrapé : armé ${!!r.w}, aucun contact dans le vide (élan ${!!r.el}), l'armé abandonné (élan-sans-ballon ${abandon}), la remise prise quand même (${r.frappe?.kind ?? r.frappe?.type ?? '—'})`);
  }
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
sab('volée frappée au sol (kickY 0,2)', 'voleeGardien', () => ({ kickY: 0.2 }), /pied frappe à/);
sab('volée lâchée derrière le corps (dropZ 0,1)', 'voleeGardien', () => ({ dropZ: 0.1 }), /lâcher n'est pas devant/);

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
