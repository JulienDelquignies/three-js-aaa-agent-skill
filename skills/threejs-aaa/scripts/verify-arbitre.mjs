// verify-arbitre.mjs — LES GESTES DE L'ARBITRE (engine/motion-arbitre.js + referee.poserGeste/arbitreStep, lot A11 bis).
//
// Ce qu'on prouve : (1) les quatre gestes — le sifflet à la bouche, le carton au-dessus de la tête bras tendu, le bras
// qui désigne à l'horizontale, l'avantage à deux bras qui balaient — tiennent leur contrat pour le style neutre et
// vingt styles, et passent checkClip ; (2) que la SIM, sous cfg.arbitreGestes, met en file les gestes au sifflet (le
// sifflet d'abord, puis le bras vers le but attaqué), arrête le central pendant le sifflet et le tourne vers la
// direction, le laisse courir pour l'avantage, et que la clé absente rend l'hier (aucun geste, le pas d'hier) ;
// (3) chaque clause attrape son sabotage.
//
// Lancer : node skills/threejs-aaa/scripts/verify-arbitre.mjs

import { SHANON_PROFILE } from '../assets/starter/src/engine/motion-profile-shanon.js';
import { generateArbitre, checkArbitreGen, arbitrePortrait, ARBITRE_NAMES, ARBITRE_KINDS } from '../assets/starter/src/engine/motion-arbitre.js';
import { styleFromSeed } from '../assets/starter/src/engine/motion-strike.js';
import { checkClip, resolveTracks, MOVES } from '../assets/starter/src/engine/animkit.js';
import { MOVE_TIMING } from '../assets/starter/src/engine/skills-sim.js';
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { poserGeste } from '../assets/starter/src/engine/referee.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`✓ ${label}`); } else { fail++; console.log(`✗ ${label}`); } };
const P = SHANON_PROFILE;
const cm = (m) => (m * 100).toFixed(0);

// ---- 1. les quatre gestes, style neutre
const specs = {};
for (const kind of ARBITRE_NAMES) {
  const spec = generateArbitre(kind, P); specs[kind] = spec;
  const r = checkArbitreGen(spec, P, kind), c = checkClip(resolveTracks(spec));
  ok(r.ok && c.ok, `${kind} (${spec.keys.length} clés, ${spec.duration} s, le haut seul)${r.ok ? '' : ' — ' + r.issues.join(' ; ')}${c.ok ? '' : ' — checkClip : ' + c.issues.join(' ; ')}`);
}

// ---- 2. vingt styles × quatre gestes
{
  let bad = 0;
  for (let s = 1; s <= 20; s++) for (const kind of ARBITRE_NAMES) {
    const spec = generateArbitre(kind, P, { style: styleFromSeed(s) });
    const r = checkArbitreGen(spec, P, kind), c = checkClip(resolveTracks(spec));
    if (!r.ok || !c.ok) { bad++; if (bad <= 3) console.log(`   graine ${s} ${kind} : ${[...r.issues, ...c.issues].join(' ; ')}`); }
  }
  ok(bad === 0, `20 styles × 4 gestes = 80 gestes d'arbitre sous contrat et checkClip (${bad} rouges)`);
}

// ---- 3. ce que chaque geste a de propre
{
  const ps = arbitrePortrait(specs.siffler, P).pick(0.62), mouth = [0.03, ps.head[1] - 0.07, ps.head[2] - 0.10];
  ok(Math.hypot(ps.rh[0] - mouth[0], ps.rh[1] - mouth[1], ps.rh[2] - mouth[2]) < 0.20, `le sifflet : la main droite à ${cm(Math.hypot(ps.rh[0] - mouth[0], ps.rh[1] - mouth[1], ps.rh[2] - mouth[2]))} cm de la bouche, la tête relevée de ${ARBITRE_KINDS.siffler.headUp}°`);
  const pc = arbitrePortrait(specs.carton, P).pick(1.0);
  ok(pc.rh[1] > pc.head[1] + 0.30 && Math.hypot(pc.rh[0] - pc.rs[0], pc.rh[1] - pc.rs[1], pc.rh[2] - pc.rs[2]) > 0.46, `le carton : la main à +${cm(pc.rh[1] - pc.head[1])} cm au-dessus de la tête, le bras tendu (${cm(Math.hypot(pc.rh[0] - pc.rs[0], pc.rh[1] - pc.rs[1], pc.rh[2] - pc.rs[2]))} cm épaule-main), tenu ${(ARBITRE_KINDS.carton.hold - specs.carton.contact).toFixed(1)} s`);
  const pd = arbitrePortrait(specs.designer, P).pick(0.7);
  ok(Math.abs(pd.rh[1] - (pd.ls[1] + pd.rs[1]) / 2) < 0.14 && pd.rh[2] < pd.rs[2] - 0.42, `le bras qui désigne : à l'horizontale (${cm(pd.rh[1] - (pd.ls[1] + pd.rs[1]) / 2)} cm de l'épaule), ${cm(pd.rs[2] - pd.rh[2])} cm devant`);
  const pa = arbitrePortrait(specs.avantage, P); const z = pa.series.filter((x) => x.t > specs.avantage.contact && x.t < ARBITRE_KINDS.avantage.hold).map((x) => x.rh[2]);
  let ext = 0; for (let i = 1; i < z.length - 1; i++) if (z[i] < z[i - 1] && z[i] <= z[i + 1]) ext++;
  ok(ext === 2 && pa.pick(0.7).lh[2] < pa.pick(0.7).chest[2] - 0.32, `l'avantage : les deux bras devant (${cm(pa.pick(0.7).chest[2] - pa.pick(0.7).lh[2])} cm), ${ext} balayages vers l'avant`);
}

// ---- 4. le registre
ok(ARBITRE_NAMES.every((k) => MOVES[k] && MOVE_TIMING[k] && MOVES[k].upperOnly), `les quatre espèces sont des MOVES générés du haut du corps (contact ${ARBITRE_NAMES.map((k) => MOVE_TIMING[k]?.contact).join(' / ')} s)`);

// ---- 5. LA SIM (cfg.arbitreGestes) : la file au sifflet, l'arrêt et la direction, l'avantage en courant, la clé absente
{
  const run = (over, f) => { const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg({ ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, /* DATÉ 16/09 : la cérémonie d'engagement occupe les 3 s du banc, le ramasseur retarde la remise */ ...over }); for (let i = 0; i < 3 * 60; i++) matchStep(st, 1 / 60, cfg); return f(st, cfg); };
  const trace = (st, cfg, secs) => { const rows = []; for (let i = 0; i < secs * 60; i++) { matchStep(st, 1 / 60, cfg); const a = st.arbitre; rows.push({ t: +st.t.toFixed(2), kind: a?.geste?.kind ?? null, dir: a?.geste?.dir ?? null, speed: +(a?.speed ?? 0).toFixed(2), yaw: +(a?.yaw ?? 0).toFixed(2) }); } return rows; };
  const A = run({}, (st, cfg) => { st._whistle = { p: [10, 5], team: 0 }; const dirAtt = Math.sign(st.pitch.attackGoal(0).x || 1) > 0 ? 0 : Math.PI; return { rows: trace(st, cfg, 3.5), dirAtt, ev: st.events.filter((e) => e.type === 'sortie' && e.out === 'coup-franc').length }; });
  const kinds = [...new Set(A.rows.map((r) => r.kind))];
  const iS = A.rows.findIndex((r) => r.kind === 'siffler'), iD = A.rows.findIndex((r) => r.kind === 'designer');
  ok(A.ev >= 1 && iS >= 0 && iD > iS, `au sifflet du coup franc la file joue le sifflet (${A.rows[iS]?.t} s) puis le bras qui désigne (${A.rows[iD]?.t} s) — kinds vus : ${kinds.filter(Boolean).join(', ')}`);
  const stop = A.rows.filter((r) => r.kind === 'siffler').map((r) => r.speed), stopMin = Math.min(...stop);
  ok(stopMin < 0.35, `le central S'ARRÊTE pour siffler (vitesse min ${stopMin.toFixed(2)} m/s pendant le sifflet, ${stop.length} images)`);
  const dRows = A.rows.filter((r) => r.kind === 'designer'), lastD = dRows[dRows.length - 1];
  const dyaw = lastD ? Math.abs(Math.atan2(Math.sin(lastD.yaw - A.dirAtt), Math.cos(lastD.yaw - A.dirAtt))) : 9;
  ok(lastD && lastD.dir === A.dirAtt && dyaw < 0.25, `…et se tourne vers le but attaqué par l'équipe du coup franc (dir ${A.dirAtt.toFixed(2)}, lacet final à ${dyaw.toFixed(2)} rad)`);
  const Fa = run({}, (st, cfg) => { const par = st.players.find((q) => q.team === 1 && !q.keeper).id, sur = st.players.find((q) => q.team === 0 && !q.keeper).id; st._faute = { t: st.t - 3, par, sur, team: 0, p: [8, 4], kind: 'tacle-debout', vSur: 5, dir: [1, 0], grave: true }; st.players[par]._fautes = 0; st.players[par]._ardoise = 99; return { rows: trace(st, cfg, 5), cartons: st.events.filter((e) => e.type === 'carton').length }; });
  const seqF = Fa.rows.map((r) => r.kind).filter((k, i, a) => k && k !== a[i - 1]);
  ok(Fa.cartons >= 1 && seqF[0] === 'siffler' && seqF.includes('carton') && seqF.indexOf('designer') > seqF.indexOf('carton'), `la FAUTE adjugée (adjugeFaute) enchaîne sifflet → carton → bras qui désigne (${seqF.join(' → ')}, ${Fa.cartons} carton)`);
  const B = run({}, (st, cfg) => { poserGeste(st, cfg, { kind: 'carton', couleur: 'jaune', dir: 1 }); poserGeste(st, cfg, { kind: 'siffler' }); poserGeste(st, cfg, { kind: 'avantage', enCourant: true }); return { q: st.arbitre.gestes.map((g) => g.kind), rows: trace(st, cfg, 4.2) }; });
  const av = B.rows.filter((r) => r.kind === 'avantage');
  ok(B.q[0] === 'siffler' && B.q[1] === 'carton' && B.q[2] === 'avantage', `la file met le sifflet DEVANT le carton (${B.q.join(' → ')})`);
  ok(av.length > 0 && Math.max(...av.map((r) => r.speed)) > 0.8, `l'avantage se signale EN COURANT (vitesse max ${Math.max(...av.map((r) => r.speed)).toFixed(2)} m/s pendant le geste)`);
  const N = run({ arbitreGestes: null }, (st, cfg) => { st._whistle = { p: [10, 5], team: 0 }; poserGeste(st, cfg, { kind: 'carton', couleur: 'jaune' }); return trace(st, cfg, 2); });
  ok(N.every((r) => r.kind === null), `la clé absente rend l'hier : arbitreGestes:null → aucun geste posé ni joué sur ${N.length} images après un sifflet et un carton (le pas d'hier, l'empreinte des joueurs au bit)`);
}

// ---- 6. les sabotages nommés
const sab = (label, kind, mutate, want) => {
  const K = ARBITRE_KINDS[kind], saved = { ...K };
  Object.assign(K, mutate(K));
  const spec = generateArbitre(kind, P);
  const r = checkArbitreGen(spec, P, kind);
  Object.assign(K, saved); for (const k of Object.keys(K)) if (!(k in saved)) delete K[k];
  const hit = !r.ok && r.issues.some((i) => want.test(i));
  ok(hit, `sabotage « ${label} » attrapé${hit ? ` (${r.issues.find((i) => want.test(i)).slice(0, 90)})` : r.ok ? ' — PASSÉ SOUS LE CONTRAT' : ` — autre motif : ${r.issues.join(' ; ').slice(0, 120)}`}`);
};
sab('le sifflet loin de la bouche (elbow 60)', 'siffler', () => ({ elbow: 60 }), /bouche/);
sab('le carton à mi-hauteur (elev 90)', 'carton', () => ({ elev: 90 }), /au-dessus/);
sab('le bras qui ne désigne pas (fwd 30)', 'designer', () => ({ fwd: 30 }), /devant|épaule/);
sab('l\'avantage sans balayage (sweeps 0)', 'avantage', () => ({ sweeps: 0 }), /balayage/);

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
