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
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';

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

// ---- 4. le registre
ok(CONTACT_NAMES.every((k) => MOVES[k] && MOVE_TIMING[k] && Math.abs(MOVE_TIMING[k].contact - CONTACT_KINDS[k].contact) < 1e-6), `les six espèces sont des MOVES générés, contact ${CONTACT_NAMES.map((k) => MOVE_TIMING[k]?.contact).join(' / ')} s`);

// ---- 5. LA SIM (cfg.contact) : le fauté tombe, nommé ; le presseur qui recule fait face ; la clé absente rend l'hier
{
  const run = (over) => {
    const out = { fautes: 0, chutes: [], downs: [], press: 0, face: 0, back: 0, lat: 0, tripDowns: [] };
    for (const seed of [7, 3, 1, 5, 2, 4]) {   // 3 → 6 graines (le porté qui anticipe — cfg.porteAnticipe — a fait tomber les ballons vendangés et avec eux un tiers des duels : 2 chutes sur 3 graines, un compte, pas une loi)
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ recevoirSurPlace: null /* recevoirSurPlace null DATÉ 15/09 (dettes A12) : vert à HEAD~ (25/0), la réception sur place remange la presse (face 69 c. 65 sans la clé) — la clause mesure sa loi, pas la mienne */, blocPercu: null /* blocPercu null DATÉ 275 : vert à HEAD~ (25/0 au 274), le fauté qui tombe remangé (2 chutes pour 7 fautes) : le bloc qui perçoit change les duels — la clause mesure sa loi, pas le bloc perçu */, ligne: null /* ligne null DATÉ 273 : vert à HEAD~ (25/0 au 272), le fauté qui tombe remangé (2 chutes pour 7 fautes) : la ligne tenue change les duels — la clause mesure sa loi, pas la ligne */, familiarite: null /* familiarite null DATÉ 254 : vert à HEAD~ (25/0 au 255), les chutes remangées par la familiarité (0 chute pour 3 fautes) — la clause mesure le contact, pas la familiarité */, shotRange: 20, chrono: { periodes: 2, duree: 180, pause: 6 }, horsJeu: null /* horsJeu null DATÉ 259 : vert à HEAD~ (25/0 au 257), les chutes remangées par la course qui traverse (1 chute pour 6 fautes) — la clause mesure le contact, pas la Loi 11 */, contre: null /* contre null DATÉ 258b : vert à HEAD~ (25/0 au 258), les chutes (2 sur 6 × 300 s pour 9 fautes) remangées par le corps qui contre — la clause mesure le contact, pas le contre */, ...over });
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
  ok(on.downs.length >= 3 && med(on.downs) >= 1.3 && Math.max(...on.downs) <= 2.6, `le fauché reste à terre p50 ${med(on.downs).toFixed(2)} s (≥ 1,3 : le temps de tomber, de tenir, de se relever ; cfg.contact.chute ${matchCfg().contact.chute})`);
  const pct = (o, k) => 100 * o[k] / (o.press || 1);
  ok(pct(on, 'face') >= pct(off, 'face') + 8 && pct(on, 'back') + pct(on, 'lat') >= 6 && pct(on, 'back') + pct(on, 'lat') >= 2 * (pct(off, 'back') + pct(off, 'lat')), `le presseur qui recule FAIT FACE au porteur : ${pct(on, 'face').toFixed(0)} % des images de presse à ≤ 4,5 m (sans la clé ${pct(off, 'face').toFixed(0)}) — course arrière ${pct(on, 'back').toFixed(0)} % + pas chassé ${pct(on, 'lat').toFixed(0)} % (sans : ${pct(off, 'back').toFixed(0)} + ${pct(off, 'lat').toFixed(0)}) : les régimes du lot A7 vivent`);
  ok(off.chutes.length === 0 && off.downs.length === 0, `la clé absente rend l'hier : contact:null → ${off.chutes.length} chute nommée, ${off.fautes} fautes, les couchés d'hier (${off.tripDowns.length}) sans nom`);
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
sab('trébuchement qui ne plonge pas (pitch 4)', 'trebuche', () => ({ pitch: 4 }), /ne plonge pas/);
sab('épaule qui ne sort pas (shift 0, drop 0, roll 0)', 'epaule', () => ({ shift: 0, drop: 0, roll: 0 }), /ne sort pas|ne descend pas/);
sab('bouclier bras ballant (elev 5, back 0)', 'protection', () => ({ elev: 5, back: 0 }), /tendu|tourne/);

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
