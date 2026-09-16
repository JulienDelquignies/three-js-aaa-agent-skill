// verify-contact.mjs — LE CONTACT GÉNÉRÉ (engine/motion-contact.js + duel.chuter + movement.jockey, lot A10).
//
// Ce qu'on prouve : (1) les six gestes — trois chutes (avant, côté, arrière) avec leur relevé, le trébuchement,
// le duel d'épaule, le bouclier — tiennent leur contrat (le corps se couche dans la direction du coup, une main au
// sol autour de l'impact, la tête jamais dans la pelouse, rien sous elle, le relevé passe par la flexion et ramène
// debout ; le buste plonge et se rattrape ; l'épaule sort et descend ; le bras se tend vers l'arrière-droite, le
// tronc tourne) pour le style neutre et vingt styles, et passent checkClip ; (2) que la SIM, sous cfg.contact,
// couche le fauté (chute NOMMÉE, ≥ 1,4 s à terre) et fait faire face au presseur qui recule (la course arrière et
// le pas chassé du lot A7 se déclenchent), et que la clé absente rend l'hier ; (3) chaque clause attrape son sabotage.
//
// Lancer : node skills/threejs-aaa/scripts/verify-contact.mjs

import { SHANON_PROFILE } from '../assets/starter/src/engine/motion-profile-shanon.js';
import { generateContact, checkContactGen, contactPortrait, CONTACT_NAMES, CONTACT_KINDS } from '../assets/starter/src/engine/motion-contact.js';
import { styleFromSeed } from '../assets/starter/src/engine/motion-strike.js';
import { checkClip, resolveTracks, MOVES } from '../assets/starter/src/engine/animkit.js';
import { MOVE_TIMING } from '../assets/starter/src/engine/skills-sim.js';
import { makeMatch, matchCfg, matchStep, playMatch } from '../assets/starter/src/engine/match-sim.js';
import { contactClock, VIE } from '../../../examples/showcase/src/scenes/rondo-contact.js';   // (A10 bis) l'horloge de la vie au sol est pure : prouvable ici

const RP_1609 = { elan: { recul: 3.5, lat: 1.5, vitesse: 4, patience: 4 }, volee: { h: 1, avance: 0.45, lacher: 0.72 }, touche: { recul: 0.25 } };   // remisesPied d'HIER (e81394e) — DATÉ 16/09 (lot A9 ter, note 368)
const SOL_1609 = { tenue: 0.9, corps: 0.9 };   // sol d'HIER sans aide — DATÉ 16/09 (relevé aidé, note 369 : sol.aide)
const TETE_1609 = { min: 1.5, max: 2.2, reach: 1.0, but: 12, saut: 0.75, duel: 1.9 };   // tete d'HIER sans armee — DATÉ 16/09 (lot B3, note 373)
const LOI12_1609 = { avantage: 1.8, contact: 0.9, mur: 9.15, jaune: 2 };   // loi12 d'HIER sans murTrot — DATÉ 16/09 (lot B4, note 374 ; viragesLisses/plantVitesse null : B5/B6, même note — mesuré : le lacet lissé isole le fauché de la graine 7, personne à 8 m)
const B_1609 = { tete: TETE_1609, loi12: LOI12_1609, viragesLisses: null, plantVitesse: null };   // les clés des lots B, éteintes : chaque clause de flux mesure le monde de son jour
let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`✓ ${label}`); } else { fail++; console.log(`✗ ${label}`); } };
const P = SHANON_PROFILE;
const ground = P.lengths.groundY;
const cm = (m) => (m * 100).toFixed(0);

// ---- 1. les six gestes, style neutre
const specs = {};
for (const kind of CONTACT_NAMES) {
  const spec = generateContact(kind, P); specs[kind] = spec;
  const r = checkContactGen(spec, P, kind), c = checkClip(resolveTracks(spec)), p = r.portrait;
  const facts = spec.lying != null ? `bassin ${p.atL.pelvis[1].toFixed(2)} m couché à ${spec.lying} s, ${p.end.pelvis[1].toFixed(2)} m debout à la fin` : kind === 'trebuche' ? `buste ${cm(p.atC.pelvis[2] - p.atC.chest[2])} cm devant le bassin au pire` : kind === 'epaule' ? `épaule droite +${cm(p.atC.rs[0] - p.start.rs[0])} cm à droite, −${cm(p.start.rs[1] - p.atC.rs[1])} cm` : `main droite à ${p.atH.rh[0].toFixed(2)} m à droite, ${cm(p.atH.rh[2] - p.atH.pelvis[2])} cm derrière`;
  ok(r.ok && c.ok, `${kind} (${spec.keys.length} clés, ${spec.duration} s) — ${facts}${r.ok ? '' : ' — ' + r.issues.join(' ; ')}${c.ok ? '' : ' — checkClip : ' + c.issues.join(' ; ')}`);
}

// ---- 2. vingt styles × six gestes
{
  let bad = 0;
  for (let s = 1; s <= 20; s++) for (const kind of CONTACT_NAMES) {
    const spec = generateContact(kind, P, { style: styleFromSeed(s) });
    const r = checkContactGen(spec, P, kind), c = checkClip(resolveTracks(spec));
    if (!r.ok || !c.ok) { bad++; if (bad <= 3) console.log(`   graine ${s} ${kind} : ${[...r.issues, ...c.issues].join(' ; ')}`); }
  }
  ok(bad === 0, `20 styles × 6 gestes = 120 contacts sous contrat et checkClip (${bad} rouges)`);
}

// ---- 3. ce que chaque geste a de propre
{
  const pa = contactPortrait(specs.chuteAvant, P), pc = contactPortrait(specs.chuteCote, P), pr = contactPortrait(specs.chuteArriere, P);
  ok(pa.atL.head[2] < pa.atL.pelvis[2] - 0.3 && pc.atL.head[0] > pc.atL.pelvis[0] + 0.25 && pr.atL.head[2] > pr.atL.pelvis[2] + 0.3, `les trois chutes couchent le corps dans leur sens : avant (tête ${cm(pa.atL.pelvis[2] - pa.atL.head[2])} cm devant le bassin), côté (tête ${cm(pc.atL.head[0] - pc.atL.pelvis[0])} cm à droite), arrière (tête ${cm(pr.atL.head[2] - pr.atL.pelvis[2])} cm derrière)`);
  const braceT = (p, spec) => p.series.find((s) => s.t >= spec.contact - 0.12 && Math.min(s.lh[1], s.rh[1]) < ground + 0.14)?.t;
  ok([pa, pc, pr].every((p, i) => { const t = braceT(p, [specs.chuteAvant, specs.chuteCote, specs.chuteArriere][i]); return t != null && t <= [specs.chuteAvant, specs.chuteCote, specs.chuteArriere][i].lying; }), `une main amortit AVANT la pose couchée (mains au sol à ${[pa, pc, pr].map((p, i) => braceT(p, [specs.chuteAvant, specs.chuteCote, specs.chuteArriere][i])?.toFixed(2)).join(' / ')} s pour des impacts à ${[specs.chuteAvant, specs.chuteCote, specs.chuteArriere].map((s) => s.contact).join(' / ')})`);
  const kneel = pa.series.filter((s) => s.t > specs.chuteAvant.rise && s.t < specs.chuteAvant.duration - 0.2);
  const lowKnee = kneel.some((s) => Math.min(s.lk[1], s.rk[1]) < ground + 0.10 && s.pelvis[1] > ground + 0.40);
  ok(lowKnee, `le relevé de la chute avant passe par le genou (un genou à ≤ 10 cm du sol sous un bassin à ≥ 40 cm) puis la flexion (bassin ${pa.series.filter((s) => s.t > specs.chuteAvant.rise).reduce((m, s) => Math.max(m, s.pelvis[1] < P.lengths.hipsY - 0.3 ? s.pelvis[1] : 0), 0).toFixed(2)} m) avant debout`);
  const headMin = Math.min(...[pa, pc, pr].flatMap((p) => p.series.map((s) => s.head[1])));
  ok(headMin > ground + 0.07, `la tête ne touche jamais la pelouse (au plus bas ${headMin.toFixed(2)} m — sur le dos elle repose, à plat ventre elle se relève de ${CONTACT_KINDS.chuteAvant.headUp}°)`);
  const pt = contactPortrait(specs.trebuche, P);
  ok(pt.end.pelvis[1] > P.lengths.hipsY - 0.03 && Math.abs(pt.end.chest[2] - pt.end.pelvis[2]) < 0.08, `le trébuchement se rattrape debout (bassin ${pt.end.pelvis[1].toFixed(2)} m, buste d'aplomb) après ${cm(pt.start.pelvis[1] - pt.atC.pelvis[1])} cm d'affaissement`);
  const pe = contactPortrait(specs.epaule, P);
  ok(pe.atC.rf[0] - pe.start.rf[0] > 0.12 && pe.atC.pelvis[0] > 0.05, `l'épaule s'appuie : appui droit écarté de ${cm(pe.atC.rf[0] - pe.start.rf[0])} cm, bassin décalé de ${cm(pe.atC.pelvis[0])} cm vers l'adversaire`);
  const pp = contactPortrait(specs.protection, P);
  ok(pp.atH.lh[2] < pp.atH.pelvis[2] && pp.atH.rh[2] > pp.atH.pelvis[2] + 0.1, `le bouclier : la main droite derrière (${cm(pp.atH.rh[2] - pp.atH.pelvis[2])} cm), la gauche devant — le corps entre le ballon et l'adversaire`);
}

// ---- 3 bis. (A10 bis) LA POSE TENUE VIT, et l'horloge de la scène la fait vivre à l'heure de la sim
{
  for (const kind of ['chuteAvant', 'chuteCote', 'chuteArriere']) {
    const spec = specs[kind], p = contactPortrait(spec, P);
    const pick = (t) => p.series.reduce((b, s) => Math.abs(s.t - t) < Math.abs(b.t - t) ? s : b, p.series[0]);
    const gap = (a, b) => Math.max(...['head', 'lh', 'rh', 'lf', 'rf', 'pelvis'].map((k) => Math.hypot(a[k][0] - b[k][0], a[k][1] - b[k][1], a[k][2] - b[k][2])));
    const L = pick(spec.lying), R = pick(spec.rise), M = pick((spec.lying + spec.rise) / 2);
    ok(gap(L, M) > 0.08 && gap(L, R) < 0.02, `${kind} : la pose tenue vit (à mi-tenue ${cm(gap(L, M))} cm de mouvement) et le cycle se ferme (rise = lying à ${cm(gap(L, R))} cm)`);
  }
  // l'horloge : tant que la sim a plus de temps à terre que le clip n'en demande, va-et-vient dans [lying, rise[ ; puis elle avance et finit DEBOUT quand la sim relève, sans saut de pose (≤ 2,5 images par image)
  const spec = specs.chuteAvant, T = spec.duration, dt = 1 / 60;
  const horloge = (downTotal) => {
    const pl = { gestureLayer: { spec }, sim: { down: downTotal } }, meta = { t0: 0, offset: 0 };
    let now = 0, prev = 0, prevD = 0, maxJump = 0, minT = Infinity, maxT = -Infinity, turns = 0, tEnd = null, downAtRise = null;
    for (let i = 0; i < 300; i++) {
      now += dt; pl.sim.down = downTotal - now;
      const tl = now - meta.t0 + meta.offset, t = contactClock(pl, meta, tl, dt, now) ?? tl;
      if (i) { maxJump = Math.max(maxJump, Math.abs(t - prev)); const d = Math.sign(t - prev); if (d && prevD && d !== prevD) turns++; if (d) prevD = d; }
      if (pl.sim.down > 0 && t >= spec.lying - 1e-9 && downAtRise == null) { if (t >= spec.rise) downAtRise = pl.sim.down; else { minT = Math.min(minT, t); maxT = Math.max(maxT, t); } }
      if (pl.sim.down <= 0 && tEnd == null) tEnd = t;
      prev = t;
    }
    return { maxJump, minT, maxT, turns, tEnd, downAtRise };
  };
  const a = horloge(2.6), b = horloge(1.6);
  ok(a.turns >= 1 && a.minT >= spec.lying - 1e-9 && a.maxT < spec.rise && Math.abs(a.downAtRise - (T - spec.rise)) <= 3 * dt && a.maxJump <= 2.5 * dt + 1e-9 && Math.abs(a.tEnd - T) < 0.05, `down 2,6 s : la tenue fait ${a.turns} demi-tour(s) dans [${spec.lying}, ${spec.rise}[ (${a.minT.toFixed(2)}-${a.maxT.toFixed(2)}) à ×${VIE}, le relevé part quand il reste ${a.downAtRise?.toFixed(2)} s de sim (le clip en demande ${(T - spec.rise).toFixed(2)}) et finit debout à l'heure sim (t ${a.tEnd?.toFixed(2)} pour ${T}) sans saut (max ${(a.maxJump / dt).toFixed(1)} image/image)`);
  ok(b.maxJump <= 2.5 * dt + 1e-9 && Math.abs(b.tEnd - T) < 0.05 && b.turns === 0, `down 1,6 s (hier) : trop court pour la tenue — le clip avance plus vite (max ${(b.maxJump / dt).toFixed(1)} image/image) et finit quand même debout à l'heure sim (t ${b.tEnd?.toFixed(2)})`);
}

// ---- 4. le registre
ok(CONTACT_NAMES.every((k) => MOVES[k] && MOVE_TIMING[k] && Math.abs(MOVE_TIMING[k].contact - CONTACT_KINDS[k].contact) < 1e-6), `les six espèces sont des MOVES générés, contact ${CONTACT_NAMES.map((k) => MOVE_TIMING[k]?.contact).join(' / ')} s`);

// ---- 5. LA SIM (cfg.contact) : le fauté tombe, nommé ; le presseur qui recule fait face ; la clé absente rend l'hier
{
  const run = (over) => {
    const out = { fautes: 0, chutes: [], downs: [], press: 0, face: 0, back: 0, lat: 0, tripDowns: [] };
    for (const seed of [7, 3, 1, 5, 2, 4]) {   // 3 → 6 graines (le porté qui anticipe — cfg.porteAnticipe — a fait tomber les ballons vendangés et avec eux un tiers des duels : 2 chutes sur 3 graines, un compte, pas une loi)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ ...B_1609, remisesPied: RP_1609 /* remisesPied hier DATÉ 16/09 (A9 ter, note 368) */, recevoirSurPlace: null /* recevoirSurPlace null DATÉ 15/09 (dettes A12) : vert à HEAD~ (25/0), la réception sur place remange la presse (face 69 c. 65 sans la clé) — la clause mesure sa loi, pas la mienne */, familiarite: null /* familiarite null DATÉ 254 : vert à HEAD~ (25/0 au 255), les chutes remangées par la familiarité (0 chute pour 3 fautes) — la clause mesure le contact, pas la familiarité */, shotRange: 20, chrono: { periodes: 2, duree: 180, pause: 6 }, horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (25/0 au 257), les chutes remangées par la course qui traverse (1 chute pour 6 fautes) — la clause mesure le contact, pas la Loi 11 */, contre: null /* contre null DATÉ 258b : vert à HEAD~ (25/0 au 258), les chutes (2 sur 6 × 300 s pour 9 fautes) remangées par le corps qui contre — la clause mesure le contact, pas le contre */, ...over });
      const downAt = {};
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        const c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
        for (const p of st.players) {
          if (p.down > 0) { if (downAt[p.id] == null) downAt[p.id] = { t: st.t, named: !!p._chute && p._chute.t >= st.t - 0.05 }; }
          else if (downAt[p.id] != null) { (downAt[p.id].named ? out.downs : out.tripDowns).push(st.t - downAt[p.id].t); downAt[p.id] = null; }
          if (c && p.job === 'press' && p.team !== c.team && !p.keeper) {
            const dx = c.p[0] - p.p[0], dz = c.p[2] - p.p[2], d = Math.hypot(dx, dz);
            if (d <= 4.5 && p.speed > 0.6) {
              out.press++;
              const fx = Math.cos(p.yaw), fz = Math.sin(p.yaw), sp = p.speed;
              const along = (p.v[0] * fx + p.v[1] * fz) / sp, lat = Math.abs(p.v[0] * (-fz) + p.v[1] * fx) / sp;
              if ((dx * fx + dz * fz) / d > 0.7) out.face++;
              if (along < -0.5) out.back++; else if (lat > 0.7) out.lat++;
            }
          }
        }
      }
      for (const e of st.events) { if (e.type === 'chute') out.chutes.push(e); if (e.type === 'faute') out.fautes++; }
    }
    return out;
  };
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
  const on = run({}), off = run({ contact: null });
  const kinds = [...new Set(on.chutes.map((e) => e.kind))];
  ok(on.chutes.length >= 3 && on.chutes.every((e) => ['avant', 'cote', 'arriere'].includes(e.kind) && e.by >= 0 && e.cause), `le fauté TOMBE, nommé : ${on.chutes.length} chutes sur 6 × 300 s (${kinds.join(', ')} ; causes ${[...new Set(on.chutes.map((e) => e.cause))].join(', ')}) pour ${on.fautes} fautes`);
  ok(on.downs.length >= 3 && med(on.downs) >= 1.3 && Math.max(...on.downs) <= 3.2, `le fauché reste à terre p50 ${med(on.downs).toFixed(2)} s (≥ 1,3 : le temps de tomber, de tenir, de se relever ; cfg.contact.chute ${matchCfg().contact.chute})`);
  const pct = (o, k) => 100 * o[k] / (o.press || 1);
  ok(pct(on, 'face') >= pct(off, 'face') + 8 && pct(on, 'back') + pct(on, 'lat') >= 6 && pct(on, 'back') + pct(on, 'lat') >= 2 * (pct(off, 'back') + pct(off, 'lat')), `le presseur qui recule FAIT FACE au porteur : ${pct(on, 'face').toFixed(0)} % des images de presse à ≤ 4,5 m (sans la clé ${pct(off, 'face').toFixed(0)}) — course arrière ${pct(on, 'back').toFixed(0)} % + pas chassé ${pct(on, 'lat').toFixed(0)} % (sans : ${pct(off, 'back').toFixed(0)} + ${pct(off, 'lat').toFixed(0)}) : les régimes du lot A7 vivent`);
  ok(off.chutes.length === 0 && off.downs.length === 0, `la clé absente rend l'hier : contact:null → ${off.chutes.length} chute nommée, ${off.fautes} fautes, les couchés d'hier (${off.tripDowns.length}) sans nom`);
}

// ---- 5 bis. (A10 bis) LA SIM SOUS cfg.sol : le fauché reste à terre plus longtemps, n'agit plus couché, et personne ne marche dans son corps
{
  const run = (over) => {
    const out = { downs: [], actes: 0, framesSol: 0, framesCorps: 0 };
    for (const seed of [7, 3, 1, 5, 2, 4]) {
      const st = makeMatch({ full: true, seed }), cfg = matchCfg({ ...B_1609, familiarite: null, remisesPied: { elan: { recul: 3.5, lat: 1.5, vitesse: 4.0, patience: 4 }, volee: { h: 1.0, avance: 0.45, lacher: 0.72 }, touche: { recul: 0.25 } } /* remisesPied A9 bis DATÉ 16/09 (lot A9 ter, note 368 : la sortie de but longue et la touche longue courent, le mur saute — le flux des fautes change ; la clause mesure cfg.sol, pas les remises) */, ...over });
      const downAt = {}, prevAct = {};
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        for (const p of st.players) {
          const sol = p.down > 0 && p.down < 100 && !p.expulse && !p._sub && !p.keeper;
          if (sol) { if (downAt[p.id] == null) downAt[p.id] = st.t; out.framesSol++;
            if (p.act && prevAct[p.id] !== p.act && !p._chuteActAt) { out.actes++; }
            if (st.players.some((q) => q !== p && q.down <= 0 && Math.hypot(q.p[0] - p.p[0], q.p[2] - p.p[2]) < 0.6)) out.framesCorps++; }
          else if (downAt[p.id] != null) { if (p._chute && st.t - p._chute.t < 6) out.downs.push(st.t - downAt[p.id]); downAt[p.id] = null; }
          prevAct[p.id] = p.act;
        }
      }
    }
    return out;
  };
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
  const on = run({ sol: SOL_1609 }), off = run({ sol: null });   // sol DATÉ 16/09 (A10 bis mesurait sans l'aide du 369 : l'aidant se poste à 1 m du corps)
  ok(on.downs.length >= 3 && med(on.downs) >= 2.0 && med(off.downs) < 2.0, `le fauché reste à terre p50 ${med(on.downs).toFixed(2)} s sous cfg.sol (sans la clé ${med(off.downs).toFixed(2)} : la chute 0,66 + le relevé 0,7 ne laissaient que 0,2 s de tenue)`);
  ok(on.actes === 0, `aucun acte de la sim sur un corps couché sous cfg.sol (${on.actes} ; sans la clé ${off.actes} — mesuré en page : une frappe 0,5 s après la chute)`);
  ok(on.framesCorps / Math.max(1, on.framesSol) <= 0.03 && on.framesCorps / Math.max(1, on.framesSol) < off.framesCorps / Math.max(1, off.framesSol), `personne ne marche dans un corps couché : ${(100 * on.framesCorps / Math.max(1, on.framesSol)).toFixed(1)} % des images au sol avec un debout à < 0,6 m (sans la clé ${(100 * off.framesCorps / Math.max(1, off.framesSol)).toFixed(1)} %)`);
}

// ---- 5 ter. (A10 quater) LE RELEVÉ AIDÉ (cfg.sol.aide) : le jeu arrêté, un coéquipier vient tendre la main au fauché qui se relève
{
  const hyp = Math.hypot;
  const force = (st, cfg, fid, foeId, restart, helpersAt = []) => {
    const f = st.players[fid]; if (st.ball.owner != null) st.ball.release('perte');
    for (const ha of helpersAt) { const h = st.players[ha.id]; h.p[0] = f.p[0] + ha.dx; h.p[2] = f.p[2] + ha.dz; h.v = [0, 0]; }   // deux coéquipiers près : l'un sera le preneur du coup franc (exclu), l'autre l'aidant
    f.down = 2.6; f._chute = { t: st.t, kind: 'avant', side: 1, by: foeId, cause: 'tacle' }; f.v = [0, 0];
    if (restart) { const p = [f.p[0] + 0.5, f.p[2]]; st.ball.restart([p[0], 0.11, p[1]], { cause: 'coup-franc' }); st.restart = { type: 'coup-franc', p, team: f.team, at: st.t + 4, placed: false }; st.possession = { team: f.team, carrier: -1 }; st.phase = 'loose'; }
    const n0 = st.events.length, t0 = st.t; let aide = null, geste = null, dG = null, dMin = 9, upAt = null; const jobs = new Set();
    for (let i = 0; i < 60 * 6; i++) {
      matchStep(st, 1 / 60, cfg);
      for (const e of st.events.slice(n0)) { if (e.type === 'aide' && !aide) aide = { ...e, tRel: st.t - t0 }; if (e.type === 'windup' && e.skill === 'aide' && !geste) { geste = { ...e, tRel: st.t - t0 }; const h = st.players[e.by]; dG = hyp(h.p[0] - f.p[0], h.p[2] - f.p[2]); } }
      if (aide) { const h = st.players[aide.by]; if (f.down > 0) { dMin = Math.min(dMin, hyp(h.p[0] - f.p[0], h.p[2] - f.p[2])); if (!geste) jobs.add(h.job); } }
      if (upAt == null && f.down <= 0) upAt = st.t - t0;
    }
    return { f, aide, geste, dG, dMin, upAt, jobs: [...jobs], helper: aide ? st.players[aide.by] : null };
  };
  const runs = [];
  for (const seed of [3, 7]) {
    const cfg = matchCfg({ ...B_1609, familiarite: null });
    let { st } = playMatch(makeMatch({ full: true, seed }), 10, { cfg });
    const f = st.players.find((p) => !p.keeper && p.team === 0 && p.down <= 0), foe = st.players.find((p) => p.team === 1 && !p.keeper);
    const mates = st.players.filter((p) => p.team === 0 && !p.keeper && p !== f).slice(0, 2);
    runs.push({ genre: 'jeu arrêté', foe, ...force(st, cfg, f.id, foe.id, true, [{ id: mates[0].id, dx: 3, dz: 1 }, { id: mates[1].id, dx: -2.5, dz: 2 }]) });
    for (let i = 0; i < 300; i++) matchStep(st, 1 / 60, cfg);
    const f2 = st.players.find((p) => !p.keeper && p.team === 1 && p.down <= 0 && hyp(st.ball.p[0] - p.p[0], st.ball.p[2] - p.p[2]) > 16);
    const foe2 = st.players.find((p) => p.team === 0 && !p.keeper);
    if (f2) runs.push({ genre: 'ballon loin', foe: foe2, ...force(st, cfg, f2.id, foe2.id, false) });
  }
  const A = matchCfg().sol.aide;
  ok(runs.length >= 3 && runs.every((r) => r.aide && r.helper.team === r.f.team && r.aide.by !== r.foe.id && !r.helper.keeper), `LE RELEVÉ AIDÉ : un coéquipier vient au fauché (${runs.map((r) => `${r.genre} : ${r.aide ? '#' + r.aide.by + ' à ' + r.aide.d + ' m' : 'personne'}`).join(' ; ')}) — jamais le fauteur, jamais le gardien`);
  ok(runs.every((r) => r.geste && r.geste.tRel < r.upAt && r.dG <= A.dist + 0.6), `…et lui TEND LA MAIN avant le relevé : geste 'mainTendue' à ${runs.map((r) => r.geste ? `${r.geste.tRel.toFixed(2)} s (relevé ${r.upAt.toFixed(2)}), ${r.dG.toFixed(2)} m` : '—').join(' ; ')} (≤ dist ${A.dist} + 0,6)`);
  ok(runs.every((r) => r.dMin >= matchCfg().sol.corps - 0.2 && r.jobs.includes('walk')), `…posté hors du corps couché (au plus près ${runs.map((r) => r.dMin.toFixed(2)).join('/')} m ≥ corps ${matchCfg().sol.corps} − 0,2), arrivé en marchant (métiers ${runs.map((r) => r.jobs.join('→')).join(' ; ')})`);
  {
    const cfg0 = matchCfg({ ...B_1609, familiarite: null, sol: { ...matchCfg().sol, aide: null } });
    let { st } = playMatch(makeMatch({ full: true, seed: 3 }), 10, { cfg: cfg0 });
    const f = st.players.find((p) => !p.keeper && p.team === 0 && p.down <= 0), foe = st.players.find((p) => p.team === 1 && !p.keeper), mate = st.players.find((p) => p.team === 0 && !p.keeper && p !== f);
    const r = force(st, cfg0, f.id, foe.id, true, [{ id: mate.id, dx: 3, dz: 1 }]);
    ok(!r.aide && !r.geste && r.upAt != null, `sol.aide null : le relevé solitaire d'hier (personne ne vient, relevé à ${r.upAt?.toFixed(2)} s)`);
    const cfg1 = matchCfg({ ...B_1609, familiarite: null });
    let { st: s1 } = playMatch(makeMatch({ full: true, seed: 7 }), 10, { cfg: cfg1 });
    const f1 = s1.players.find((p) => !p.keeper && p.team === 0 && p.down <= 0), foe1 = s1.players.find((p) => p.team === 1 && !p.keeper);
    for (const q of s1.players) if (q.team === 0 && q !== f1 && !q.keeper) { q.p[0] = f1.p[0] + 30 * (q.p[0] > f1.p[0] ? 1 : -1); }   // tous les coéquipiers à 30 m : personne ne peut arriver avant le relevé
    const r1 = force(s1, cfg1, f1.id, foe1.id, true);
    ok(!r1.aide, `personne à portée (coéquipiers à 30 m, trot ${A.trot} m/s contre ${(2.6 - A.avant + 0.4).toFixed(1)} s de sol) : aucun aidant élu — on ne tend pas la main à un homme debout`);
  }
}

// ---- 6. les sabotages nommés (par la substitution des paramètres d'espèce)
const sab = (label, kind, mutate, want) => {
  const K = CONTACT_KINDS[kind], saved = { ...K };
  Object.assign(K, mutate(K));
  const spec = generateContact(kind, P);
  const r = checkContactGen(spec, P, kind);
  Object.assign(K, saved);
  const hit = !r.ok && r.issues.some((i) => want.test(i));
  ok(hit, `sabotage « ${label} » attrapé${hit ? ` (${r.issues.find((i) => want.test(i)).slice(0, 90)})` : r.ok ? ' — PASSÉ SOUS LE CONTRAT' : ` — autre motif : ${r.issues.join(' ; ').slice(0, 120)}`}`);
};
sab('chute qui ne se couche pas (dip 0,3)', 'chuteAvant', () => ({ dip: 0.3 }), /ne se couche pas/);
sab('chute sans direction (fwd 0)', 'chuteAvant', () => ({ fwd: 0.02 }), /direction de la chute/);
sab('chute qui s\'enfonce dans la pelouse (pitch −96)', 'chuteAvant', () => ({ pitch: -96 }), /sous la pelouse/);
sab('pose tenue figée (vie 0)', 'chuteAvant', () => ({ vie: 0 }), /FIGÉE/);
sab('trébuchement qui ne plonge pas (pitch 4)', 'trebuche', () => ({ pitch: 4 }), /ne plonge pas/);
sab('épaule qui ne sort pas (shift 0, drop 0, roll 0)', 'epaule', () => ({ shift: 0, drop: 0, roll: 0 }), /ne sort pas|ne descend pas/);
sab('bouclier bras ballant (elev 5, back 0)', 'protection', () => ({ elev: 5, back: 0 }), /tendu|tourne/);

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
