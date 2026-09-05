// verify-attente.mjs — L'ATTENTE GÉNÉRÉE (engine/motion-idle.js, lot A8).
//
// Ce qu'on prouve : qu'un corps à l'arrêt est un corps de footballeur qui attend — les pieds ne
// bougent pas (une attente ne glisse pas), rien sous la pelouse, le poids qui passe d'un pied à
// l'autre, la respiration visible mais petite, les mains où l'espèce les met (sur les hanches,
// croisées devant le bas-ventre pour le mur, devant soi pour la garde et le gardien), les genoux de
// l'espèce ; que la politique choisit la bonne espèce pour la situation (temps mort, mur, gardien près
// du ballon, défenseur au contact) et le tempérament (calme, nerveux) ; que tout est pur, lent, varié
// par joueur, et que chaque clause attrape son sabotage nommé.
//
// Lancer : node skills/threejs-aaa/scripts/verify-attente.mjs

import { SHANON_PROFILE } from '../assets/starter/src/engine/motion-profile-shanon.js';
import { idlePose, idlePolicy, idlePortrait, idleCycleSpec, idleStyleFromSeed, checkIdleGen, IDLE_NAMES, IDLE_KINDS, NEUTRAL_IDLE_STYLE } from '../assets/starter/src/engine/motion-idle.js';
import { checkClip, resolveTracks, quatAngle } from '../assets/starter/src/engine/animkit.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`✓ ${label}`); } else { fail++; console.log(`✗ ${label}`); } };
const P = SHANON_PROFILE;
const cm = (m) => (m * 100).toFixed(1);

// ---- 1. les six espèces, style neutre : le contrat complet
for (const kind of IDLE_NAMES) {
  const r = checkIdleGen(P, { kind });
  const p = r.portrait;
  ok(r.ok, `${kind} — contrat : genou [${p.kneeMin.toFixed(0)}, ${p.kneeMax.toFixed(0)}]°, balancement ${cm(p.swayPP)} cm, respiration ${(p.breathPP * 1000).toFixed(0)} mm, poignet droit (${p.handR.map((v) => v.toFixed(2)).join(', ')})${r.ok ? '' : ' — ' + r.issues.join(' ; ')}`);
}

// ---- 2. vingt-quatre styles × six espèces : sous contrat, et personne n'attend pareil
{
  let bad = 0; const phases = [], sways = [];
  for (let s = 1; s <= 24; s++) {
    const st = idleStyleFromSeed(s); phases.push(st.phase); sways.push(st.sway);
    for (const kind of IDLE_NAMES) { const r = checkIdleGen(P, { kind, style: st }); if (!r.ok) { bad++; if (bad <= 3) console.log(`   graine ${s} ${kind} : ${r.issues.join(' ; ')}`); } }
  }
  ok(bad === 0, `24 styles × 6 espèces = 144 attentes sous contrat (${bad} rouges)`);
  const span = (a) => Math.max(...a) - Math.min(...a);
  ok(span(phases) > 0.6 && span(sways) > 0.3, `les horloges sont déphasées (phases sur ${span(phases).toFixed(2)} cycle) et les balancements varient (×${span(sways).toFixed(2)})`);
  const a = idlePose(P, 3, 'repos', idleStyleFromSeed(2)), b = idlePose(P, 3, 'repos', idleStyleFromSeed(17));
  let d = 0; for (const k in a.q) d = Math.max(d, quatAngle(a.q[k], b.q[k]) * 180 / Math.PI);
  ok(d > 2, `deux joueurs n'attendent pas pareil : ${d.toFixed(1)}° d'écart max au même instant`);
}

// ---- 3. pure, lente, et les cycles passent le contrat animkit
{
  const a = JSON.stringify(idlePose(P, 4.2, 'pret')), b = JSON.stringify(idlePose(P, 4.2, 'pret'));
  ok(a === b, 'idlePose est pure (deux appels identiques, même sortie)');
  for (const kind of IDLE_NAMES) {
    let worst = 0, prev = null;
    for (let i = 0; i <= 240; i++) { const g = idlePose(P, i / 60, kind); if (prev) for (const k in g.q) worst = Math.max(worst, quatAngle(prev.q[k], g.q[k]) * 60); prev = g; }
    const cap = kind === 'sautillement' ? 12 : 4;
    ok(worst <= cap, `${kind} : lent (${worst.toFixed(2)} rad/s au pire, ≤ ${cap})`);
  }
  for (const kind of ['repos', 'pretGardien', 'sautillement']) {
    const spec = idleCycleSpec(P, { kind });
    const c = checkClip(resolveTracks(spec));
    ok(c.ok, `cycle ${kind} en spec animkit (${spec.keys.length} clés, ${spec.duration.toFixed(1)} s) : checkClip${c.ok ? '' : ' — ' + c.issues.join(' ; ')}`);
  }
}

// ---- 4. ce que chaque espèce a de propre
{
  const pr = (kind) => idlePortrait(P, { kind, seconds: 12, n: 120 }).frames;
  const repos = pr('repos');
  const px = repos.map((f) => f.pelvis[0]);
  ok(Math.max(...px) > 0.02 && Math.min(...px) < -0.02, `repos : le poids passe d'un pied à l'autre (bassin de ${cm(Math.min(...px))} à +${cm(Math.max(...px))} cm)`);
  const lists = repos.map((f) => f.L.hip[1] - f.R.hip[1]);
  ok(Math.max(...lists) > 0.002 && Math.min(...lists) < -0.002, `repos : le bassin roule vers la jambe libre (hanches à ±${cm(Math.max(...lists))} cm l'une de l'autre)`);
  const saut = pr('sautillement');
  const py = saut.map((f) => f.pelvis[1]);
  const ankleTop = Math.max(...saut.map((f) => f.L.ankle[1])) - P.bones.LeftFoot.bindP[1];
  ok(Math.max(...py) - Math.min(...py) > 0.02 && Math.max(...py) - Math.min(...py) < 0.06 && ankleTop > 0.02, `sautillement : rebond de ${cm(Math.max(...py) - Math.min(...py))} cm, sur la pointe au sommet (cheville +${cm(ankleTop)} cm)`);
  const gk = pr('pretGardien')[0], pt = pr('pret')[0], rp = repos[0];
  ok(gk.pelvis[1] < pt.pelvis[1] - 0.02 && pt.pelvis[1] < rp.pelvis[1] - 0.03, `le gardien est plus bas que la garde, la garde plus basse que le repos (bassin ${gk.pelvis[1].toFixed(2)} < ${pt.pelvis[1].toFixed(2)} < ${rp.pelvis[1].toFixed(2)} m)`);
  ok(gk.R.hand[0] - gk.L.hand[0] > pt.R.hand[0] - pt.L.hand[0] + 0.1, `les gants du gardien sont plus ouverts que les mains du défenseur (${cm(gk.R.hand[0] - gk.L.hand[0])} c. ${cm(pt.R.hand[0] - pt.L.hand[0])} cm)`);
  const mur = pr('mur')[0];
  ok((mur.head[2] - mur.chest[2]) < (rp.head[2] - rp.chest[2]) - 0.015 && IDLE_KINDS.mur.headDown >= 8, `mur : menton rentré (tête ${cm((rp.head[2] - rp.chest[2]) - (mur.head[2] - mur.chest[2]))} cm plus en avant de la poitrine qu'au repos, baissée de ${IDLE_KINDS.mur.headDown}°)`);
  const mh = pr('mainsHanches')[0];
  ok(mh.R.elbow[0] > mh.R.hand[0] + 0.03 && mh.R.elbow[2] > mh.R.hand[2], `mains sur les hanches : coudes dehors et derrière (coude x ${mh.R.elbow[0].toFixed(2)} > main ${mh.R.hand[0].toFixed(2)})`);
}

// ---- 5. la politique : la situation choisit l'espèce, le tempérament la nuance
{
  const calm = { calm: 1.2, burstiness: 0.9 }, nerv = { calm: 0.9, burstiness: 1.3 }, plain = { calm: 1.0, burstiness: 1.0 };
  ok(idlePolicy({ keeper: true, dead: false, ballD: 20 }, plain) === 'pretGardien' && idlePolicy({ keeper: true, dead: false, ballD: 50 }, plain) === 'repos', 'le gardien se met en position quand le ballon est à moins de 32 m, se relâche au-delà');
  ok(idlePolicy({ keeper: true, dead: true, ballD: 10 }, calm) === 'mainsHanches' && idlePolicy({ keeper: true, dead: true, ballD: 10 }, plain) === 'repos', 'le gardien au temps mort : mains sur les hanches s\'il est calme, repos sinon');
  ok(idlePolicy({ wall: true, keeper: false, dead: true }, nerv) === 'mur' && idlePolicy({ wall: true, keeper: true, dead: true }, calm) === 'mur', 'dans le mur, tout le monde fait le mur');
  ok(idlePolicy({ dead: true }, nerv) === 'sautillement' && idlePolicy({ dead: true }, calm) === 'mainsHanches' && idlePolicy({ dead: true }, plain) === 'repos', 'le temps mort : le nerveux sautille, le calme met les mains sur les hanches, l\'autre se repose');
  ok(idlePolicy({ dead: false, defending: true, carrierD: 3 }, plain) === 'pret' && idlePolicy({ dead: false, defending: true, carrierD: 9 }, plain) === 'repos' && idlePolicy({ dead: false, defending: false, carrierD: 3 }, plain) === 'repos', 'le défenseur à moins de 5,5 m du porteur adverse se met en garde ; loin, ou en possession, il se repose');
  ok(idlePolicy({ dead: true }, nerv) === idlePolicy({ dead: true }, nerv), 'la politique est pure');
}

// ---- 6. les sabotages nommés
const sab = (label, args, want) => {
  const r = checkIdleGen(P, args);
  const hit = !r.ok && r.issues.some((i) => want.test(i));
  ok(hit, `sabotage « ${label} » attrapé${hit ? ` (${r.issues.find((i) => want.test(i)).slice(0, 90)})` : r.ok ? ' — PASSÉ SOUS LE CONTRAT' : ` — autre motif : ${r.issues.join(' ; ').slice(0, 120)}`}`);
};
sab('pieds qui suivent le balancement (slide 1)', { kind: 'repos', opts: { override: { slide: 1 } } }, /pieds bougent/);
sab('orteil sous la pelouse (pointe basse)', { kind: 'sautillement', opts: { override: { heel: -30 } } }, /sous la pelouse/);
sab('mains loin des hanches', { kind: 'mainsHanches', opts: { override: { arms: { elev: 60, fwd: 40, elbow: 0, twist: 0 } } } }, /crête|coude/);
sab('mur bras ouverts', { kind: 'mur', opts: { override: { arms: { elev: 25, fwd: 10, elbow: 20, twist: 0 } } } }, /mains sont à|bas-ventre/);
sab('pas de respiration', { kind: 'repos', opts: { override: { breath: 0 } } }, /respiration/);
sab('garde jambes tendues', { kind: 'pret', opts: { override: { knee: 4 } } }, /genou/);
sab('gants du gardien fermés', { kind: 'pretGardien', opts: { override: { arms: { elev: -12, fwd: 30, elbow: 40, twist: 60 } } } }, /gants|devant/);
sab('balancement de marin (sway 0,15)', { kind: 'repos', opts: { override: { sway: 0.15 } } }, /balancement/);

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
