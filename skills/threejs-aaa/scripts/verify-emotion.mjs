// verify-emotion.mjs — L'ÉMOTION GÉNÉRÉE (engine/motion-emotion.js + referee.fete + rondo-fete, lot A11).
//
// Ce qu'on prouve : (1) les huit gestes — le poing, les bras levés, la main à l'oreille, le retour calme, la glissade
// sur les genoux, l'accolade, l'applaudissement, la protestation — tiennent leur contrat (chaque geste a sa signature
// mesurable, un geste du haut revient à sa pose de départ, la glissade se met à genoux, vit et se relève debout) pour le
// style neutre et vingt styles, et passent checkClip ; (2) que la SIM, sous cfg.fete, donne au buteur le geste de sa
// PERSONA (flair → glissade, oreille ; calm → calme ; burstiness → poing ; sinon bras levés), lance la glissade après
// la course d'élan (le corps porté et tenu au sol), et que la clé absente rend l'événement d'hier ; (3) chaque
// clause attrape son sabotage.
//
// Lancer : node skills/threejs-aaa/scripts/verify-emotion.mjs

import { SHANON_PROFILE } from '../assets/starter/src/engine/motion-profile-shanon.js';
import { generateEmotion, checkEmotionGen, emotionPortrait, EMOTION_NAMES, EMOTION_KINDS } from '../assets/starter/src/engine/motion-emotion.js';
import { styleFromSeed } from '../assets/starter/src/engine/motion-strike.js';
import { checkClip, resolveTracks, MOVES } from '../assets/starter/src/engine/animkit.js';
import { MOVE_TIMING } from '../assets/starter/src/engine/skills-sim.js';
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`✓ ${label}`); } else { fail++; console.log(`✗ ${label}`); } };
const P = SHANON_PROFILE;
const cm = (m) => (m * 100).toFixed(0);

// ---- 1. les neuf gestes, style neutre (A11 : huit ; A9 ter : le saut du mur)
const specs = {};
for (const kind of EMOTION_NAMES) {
  const spec = generateEmotion(kind, P); specs[kind] = spec;
  const r = checkEmotionGen(spec, P, kind), c = checkClip(resolveTracks(spec));
  ok(r.ok && c.ok, `${kind} (${spec.keys.length} clés, ${spec.duration} s${spec.upperOnly ? ', le haut seul' : spec.ownsLegs ? ', possède les jambes' : ''})${r.ok ? '' : ' — ' + r.issues.join(' ; ')}${c.ok ? '' : ' — checkClip : ' + c.issues.join(' ; ')}`);
}

// ---- 2. vingt styles × neuf gestes
{
  let bad = 0;
  for (let s = 1; s <= 20; s++) for (const kind of EMOTION_NAMES) {
    const spec = generateEmotion(kind, P, { style: styleFromSeed(s) });
    const r = checkEmotionGen(spec, P, kind), c = checkClip(resolveTracks(spec));
    if (!r.ok || !c.ok) { bad++; if (bad <= 3) console.log(`   graine ${s} ${kind} : ${[...r.issues, ...c.issues].join(' ; ')}`); }
  }
  ok(bad === 0, `20 styles × 9 gestes = 180 émotions sous contrat et checkClip (${bad} rouges)`);
}

// ---- 3. ce que chaque geste a de propre
{
  const pp = emotionPortrait(specs.poing, P), K = EMOTION_KINDS.poing;
  const sh = (s) => (s.ls[1] + s.rs[1]) / 2;
  ok(K.pumps.every((t) => pp.pick(t).rh[1] > sh(pp.pick(t)) + 0.10) && pp.pick((K.pumps[0] + K.pumps[1]) / 2).rh[1] < pp.pick(K.pumps[0]).rh[1] - 0.06, `le poing monte deux fois (${K.pumps.map((t) => '+' + cm(pp.pick(t).rh[1] - sh(pp.pick(t))) + ' cm').join(', ')} sur l'épaule) et redescend entre les deux`);
  const pb = emotionPortrait(specs.brasLeves, P).pick(0.9);
  ok(pb.lh[1] > pb.head[1] + 0.08 && pb.rh[1] > pb.head[1] + 0.08 && Math.abs(pb.lh[0]) > 0.25, `les bras levés : mains à +${cm(pb.rh[1] - pb.head[1])} cm au-dessus de la tête, en V (${cm(pb.rh[0] - pb.lh[0])} cm entre elles)`);
  const po = emotionPortrait(specs.oreille, P).pick(1.2);
  ok(Math.hypot(po.rh[0] - 0.10, po.rh[1] - po.head[1], po.rh[2] - po.head[2] - 0.02) < 0.19 && Math.abs(po.lh[1] - po.pelvis[1]) < 0.16, `la main à l'oreille : ${cm(Math.hypot(po.rh[0] - 0.10, po.rh[1] - po.head[1], po.rh[2] - po.head[2] - 0.02))} cm de l'oreille droite, la gauche sur la hanche (${cm(Math.abs(po.lh[1] - po.pelvis[1]))} cm de la crête)`);
  const pc = emotionPortrait(specs.calme, P).pick(0.95);
  ok(pc.lh[2] < pc.chest[2] - 0.18 && Math.abs(pc.lh[1] - (pc.ls[1] + pc.rs[1]) / 2) < 0.18, `le retour calme : les mains devant (${cm(pc.chest[2] - pc.lh[2])} cm) à hauteur d'épaule, la tête basse (${EMOTION_KINDS.calme.headDown}°)`);
  const pg = emotionPortrait(specs.glissade, P), G = specs.glissade, L = pg.pick(G.lying), M = pg.pick((G.lying + G.rise) / 2), E = pg.end;
  ok(L.lk[1] < P.lengths.groundY + 0.12 && L.rk[1] < P.lengths.groundY + 0.12 && L.lf[2] > L.pelvis[2] + 0.2 && L.head[1] > L.pelvis[1] + 0.55, `la glissade se met À GENOUX : genoux à ${cm(L.lk[1] - P.lengths.groundY)} cm du sol, pieds ${cm(L.lf[2] - L.pelvis[2])} cm derrière, buste droit (tête ${cm(L.head[1] - L.pelvis[1])} cm au-dessus du bassin)`);
  ok(L.rh[0] - L.lh[0] > 0.9 && M.rh[1] > L.rh[1] + 0.15 && E.pelvis[1] > P.lengths.hipsY - 0.05, `…les bras ouverts (${cm(L.rh[0] - L.lh[0])} cm), qui montent en V pendant la tenue (+${cm(M.rh[1] - L.rh[1])} cm), puis le relevé debout (bassin ${E.pelvis[1].toFixed(2)} m)`);
  const pa = emotionPortrait(specs.accolade, P).pick(0.68);
  ok(pa.lh[2] < pa.chest[2] - 0.25 && Math.abs(pa.lh[0] - pa.rh[0]) < 0.38, `l'accolade enveloppe devant (mains ${cm(pa.chest[2] - pa.lh[2])} cm devant la poitrine, ${cm(Math.abs(pa.lh[0] - pa.rh[0]))} cm entre elles)`);
  const ap = emotionPortrait(specs.applaudir, P); const dd = ap.series.map((s) => Math.hypot(s.lh[0] - s.rh[0], s.lh[1] - s.rh[1], s.lh[2] - s.rh[2]));
  let claps = 0; for (let i = 1; i < dd.length - 1; i++) if (dd[i] < dd[i - 1] && dd[i] <= dd[i + 1] && dd[i] < 0.14) claps++;
  ok(claps === 3 && Math.max(...dd) > 0.24, `l'applaudissement : ${claps} claquements (mains à ${cm(Math.min(...dd))} cm), écartées de ${cm(Math.max(...dd))} cm entre deux`);
  const yaws = specs.proteste.keys.filter((k) => k.t > specs.proteste.contact && k.t < EMOTION_KINDS.proteste.hold).map((k) => k.pose.Head?.[1] ?? 0);
  ok(Math.max(...yaws) > 6 && Math.min(...yaws) < -6, `la protestation : la tête dit non (lacet ${Math.min(...yaws).toFixed(0)}° ↔ +${Math.max(...yaws).toFixed(0)}°), les avant-bras ouverts, les épaules qui montent (${EMOTION_KINDS.proteste.shrug}°)`);
}

// ---- 3 bis. (A9 ter) LE SAUT DU MUR : accroupi, détente, les deux pieds décollés au sommet, les mains croisées devant, la réception
{
  const sp = specs.sautMur, p = emotionPortrait(sp, P), S = p.pick(sp.contact), C = p.pick(0.10), E = p.end, restF = (p.start.lf[1] + p.start.rf[1]) / 2;
  ok(S.lf[1] - restF > 0.2 && S.rf[1] - restF > 0.2 && S.pelvis[1] - p.start.pelvis[1] > 0.22, `le mur SAUTE : pieds à +${cm(S.lf[1] - restF)} / +${cm(S.rf[1] - restF)} cm, bassin à +${cm(S.pelvis[1] - p.start.pelvis[1])} cm au sommet (contact ${sp.contact} s)`);
  ok(C.pelvis[1] < p.start.pelvis[1] - 0.05, `…après un accroupi (bassin −${cm(p.start.pelvis[1] - C.pelvis[1])} cm à 0,10 s)`);
  ok(Math.hypot(S.lh[0] - S.rh[0], S.lh[1] - S.rh[1], S.lh[2] - S.rh[2]) < 0.30 && S.lh[1] < S.chest[1] - 0.15 && S.lh[2] < S.pelvis[2] - 0.08, `…les mains croisées devant le bas-ventre (${cm(Math.hypot(S.lh[0] - S.rh[0], S.lh[1] - S.rh[1], S.lh[2] - S.rh[2]))} cm l'une de l'autre, ${cm(S.chest[1] - S.lh[1])} cm sous la poitrine, ${cm(S.pelvis[2] - S.lh[2])} cm devant)`);
  ok(Math.abs(E.pelvis[1] - p.start.pelvis[1]) < 0.04 && E.lf[1] - restF < 0.03 && E.rf[1] - restF < 0.03 && p.lowest > -0.03, `…et la réception ramène au sol (bassin ${cm(E.pelvis[1] - p.start.pelvis[1])} cm, pieds ${cm(E.lf[1] - restF)} / ${cm(E.rf[1] - restF)} cm ; rien sous la pelouse : ${cm(p.lowest)} cm)`);
}

// ---- 4. le registre
ok(EMOTION_NAMES.every((k) => MOVES[k] && MOVE_TIMING[k] && Math.abs(MOVE_TIMING[k].contact - EMOTION_KINDS[k].contact) < 1e-6), `les huit espèces sont des MOVES générés, contact ${EMOTION_NAMES.map((k) => MOVE_TIMING[k]?.contact).join(' / ')} s`);
ok(EMOTION_NAMES.filter((k) => k !== 'glissade' && k !== 'sautMur').every((k) => MOVES[k].upperOnly) && MOVES.sautMur.ownsLegs && MOVES.glissade.ownsLegs && MOVES.glissade.lying > 0 && MOVES.glissade.rise > MOVES.glissade.lying, 'sept gestes du haut (les jambes restent à la foulée), la glissade possède les jambes et déclare lying/rise (la scène la tient et la relève comme une chute)');

// ---- 5. LA SIM (cfg.fete) : le geste vient de la persona ; la glissade se lance après l'élan ; la clé absente rend l'hier
{
  const fete = (over, persona) => {
    const squads = [0, 1].map(() => Array.from({ length: 11 }, () => ({ persona })));
    const st = makeMatch({ full: true, seed: 3, squads }), cfg = matchCfg(over);
    for (let i = 0; i < 4 * 60; i++) matchStep(st, 1 / 60, cfg);
    st.ball.restart([st.pitch.hx - 7, 0.11, 2.6], { cause: 'engagement' }); st.lastTouch = 0;
    st.ball.strike({ speed: 30, dirYaw: 0, elevation: 0.03 });
    const out = { but: null, celeb: null, glissade: null, downMax: 0, vGlisse: null, dist: 0, downAt: null, p0: null };
    let seen = st.events.length;
    for (let i = 0; i < 10 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      for (; seen < st.events.length; seen++) { const e = st.events[seen]; if (e.type === 'but' && !out.but) out.but = e; if (e.type === 'celebration' && !out.celeb) out.celeb = e; if (e.type === 'glissade' && !out.glissade) { out.glissade = e; out.vGlisse = st.players[e.by].speed; out.p0 = [...st.players[e.by].p]; } }
      if (out.glissade) { const p = st.players[out.glissade.by]; out.downMax = Math.max(out.downMax, p.down); if (p.down > 0) out.dist = Math.hypot(p.p[0] - out.p0[0], p.p[2] - out.p0[2]); }
    }
    return out;
  };
  const g = fete({}, { flair: 0.9, calm: 1.0, burstiness: 1.0 }), c = fete({}, { flair: 0.3, calm: 1.2, burstiness: 1.0 }), p = fete({}, { flair: 0.3, calm: 0.95, burstiness: 1.3 }), b = fete({}, { flair: 0.3, calm: 0.95, burstiness: 0.8 }), o = fete({}, { flair: 0.55, calm: 1.05, burstiness: 0.8 }), n = fete({ fete: null }, { flair: 0.9, calm: 1.0, burstiness: 1.0 });
  ok(!!g.but && !!g.celeb, `le but forcé se fête : ${g.but ? 'but' : 'pas de but'}, célébration de ${g.celeb?.by} avec ${g.celeb?.avec?.length ?? 0} compagnon(s)`);
  ok(g.celeb?.geste === 'glissade' && c.celeb?.geste === 'calme' && p.celeb?.geste === 'poing' && b.celeb?.geste === 'brasLeves' && o.celeb?.geste === 'oreille', `la persona choisit le geste : flair 0,9 → ${g.celeb?.geste}, calm 1,2 → ${c.celeb?.geste}, burstiness 1,3 → ${p.celeb?.geste}, sans relief → ${b.celeb?.geste}, flair 0,55 posé → ${o.celeb?.geste}`);
  ok(!!g.glissade && g.vGlisse > 2.5 && g.downMax >= 1.8 && g.dist >= 1.2, `la glissade se lance après la course d'élan (à ${g.vGlisse?.toFixed(1)} m/s, ${(g.glissade?.t - g.celeb?.t).toFixed(1)} s après le but) : le corps tenu au sol ${g.downMax.toFixed(1)} s, porté sur ${g.dist.toFixed(1)} m`);
  ok(!c.glissade && !p.glissade, 'les autres tempéraments ne glissent pas');
  ok(!!n.celeb && n.celeb.geste == null && !n.glissade, `la clé absente rend l'hier : fete:null → célébration sans geste (${JSON.stringify(Object.keys(n.celeb ?? {}))}), pas de glissade`);
}

// ---- 6. les sabotages nommés
const sab = (label, kind, mutate, want) => {
  const K = EMOTION_KINDS[kind], saved = { ...K };
  Object.assign(K, mutate(K));
  const spec = generateEmotion(kind, P);
  const r = checkEmotionGen(spec, P, kind);
  Object.assign(K, saved); for (const k of Object.keys(K)) if (!(k in saved)) delete K[k];
  const hit = !r.ok && r.issues.some((i) => want.test(i));
  ok(hit, `sabotage « ${label} » attrapé${hit ? ` (${r.issues.find((i) => want.test(i)).slice(0, 90)})` : r.ok ? ' — PASSÉ SOUS LE CONTRAT' : ` — autre motif : ${r.issues.join(' ; ').slice(0, 120)}`}`);
};
sab('le poing qui ne monte pas (fwd 30)', 'poing', () => ({ fwd: 30, elbow: 60 }), /ne monte pas/);
sab('les bras à mi-hauteur (elev 80)', 'brasLeves', () => ({ elev: 80 }), /au-dessus de la tête/);
sab('la main loin de l\'oreille (elbow 60)', 'oreille', () => ({ elbow: 60 }), /oreille/);
sab('la glissade debout (kneel 0.45)', 'glissade', () => ({ kneel: 0.45 }), /genoux/);
sab('la glissade figée (vie 0)', 'glissade', () => ({ vie: 0 }), /FIGÉE/);
sab('l\'accolade bras écartés (elev 60, rot 0)', 'accolade', () => ({ elev: 60, rot: 0 }), /écartées|enveloppent/);
sab('l\'applaudissement muet (claps 0)', 'applaudir', () => ({ claps: 0 }), /claquement/);
sab('le mur qui ne saute pas (h 0)', 'sautMur', () => ({ h: 0 }), /décollent|ne monte pas/);
sab('le mur les bras ouverts (elev 60)', 'sautMur', () => ({ elev: 60, fwd: 10, elbow: 10 }), /croisées/);
sab('la protestation sans le non (shake 0)', 'proteste', () => ({ shake: 0 }), /ne dit pas non/);

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
