#!/usr/bin/env node
// verify-strike-warp.mjs — LA RENCONTRE (engine/strike-warp.js) : le pied du clip et le ballon
// porté doivent se croiser AU MÊME POINT, à L'INSTANT du contact, SANS toucher à la vitesse.
//
// Le banc de swing prouve le clip (vitesse, pic sur le contact, surface). Le porté prouve le
// ballon (il converge vers le point de stance). Ce banc prouve la RENCONTRE — la couche que
// Unity/Unreal appellent Motion Warping, ici avec des lois écrites : le contact appartient au
// clip (enveloppe à pente NULLE au contact — le warp corrige la position, jamais la vitesse),
// borné avec refus nommés (une correction impossible est une dette au registre, pas un téléport),
// la surface s'arrête à la surface (standoff — un pied warpe VERS le ballon, pas dedans), et
// après le tir on rend la jambe (gel de l'offset + descente C¹ vers l'accompagnement authoré).
//
// La clause reine est COMPOSÉE (charte, loi 8) : un mini-monde rejoue une frappe entière —
// trajectoire de clip qui traverse le point attendu à 12 m/s, ballon posé au pire résiduel
// mesuré à l'audit (0,56 m) — et mesure LE RÉSULTAT : le pied atterrit au standoff du ballon,
// à la vitesse du clip, et rend la jambe après. Les sabotages sont les bugs réels de cette
// famille : la rampe qui vise après le contact (elle freine la frappe), le warp qui vise le
// centre (pied DANS le ballon), l'écrêtage muet, le warp qui chasse le ballon parti.
import { WARP, warpEnvelope, planWarp, warpReach, checkStrikeWarp }
  from '../assets/starter/src/engine/strike-warp.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

console.log('— le contrat embarqué (checkStrikeWarp) —');
{
  const c = checkStrikeWarp();
  ok('checkStrikeWarp est vert sur la config du moteur', c.ok, c.issues.join(' ; '));
}

console.log('\n— l\'enveloppe : le contact appartient au clip —');
{
  const antic = 0.38, t0 = antic * (1 - WARP.winIn);
  ok(`le warp DORT avant sa fenêtre (t < ${t0.toFixed(3)} s ⇒ 0)`,
    warpEnvelope(0, antic) === 0 && warpEnvelope(t0 - 1e-3, antic) === 0);
  let mono = true;
  for (let i = 1; i <= 100; i++) {
    const a = warpEnvelope(t0 + (antic - t0) * (i - 1) / 100, antic);
    const b = warpEnvelope(t0 + (antic - t0) * i / 100, antic);
    if (b < a - 1e-12) mono = false;
  }
  ok('la montée est monotone (le pied ne fait pas d\'aller-retour vers sa cible)', mono);
  ok('l\'enveloppe vaut 1 PILE au contact', Math.abs(warpEnvelope(antic, antic) - 1) < 1e-12);
  const before = warpEnvelope(antic - 0.005, antic), after = warpEnvelope(antic + 0.005, antic);
  ok(`pente NULLE au contact, des deux côtés (±5 ms : ${before.toFixed(4)} / ${after.toFixed(4)} — le warp ne verse aucune vitesse)`,
    Math.abs(before - 1) <= 0.01 && Math.abs(after - 1) <= 0.01);
  ok(`la jambe est RENDUE après le contact (t ≥ antic + ${WARP.out} s ⇒ 0)`,
    warpEnvelope(antic + WARP.out + 1e-3, antic) === 0 && warpEnvelope(antic + 1, antic) === 0);
  let step = 0;
  for (let t = 0; t < antic + WARP.out + 0.01; t += 1e-3) {
    step = Math.max(step, Math.abs(warpEnvelope(t + 1e-3, antic) - warpEnvelope(t, antic)));
  }
  ok(`aucune marche dans l'enveloppe (pas de saut > 0,02 à 1 kHz — mesuré ${step.toFixed(4)})`, step <= 0.02);
  ok('anticipation nulle ou négative ⇒ pas de warp (jamais de division par zéro)',
    warpEnvelope(0.1, 0) === 0 && warpEnvelope(0.1, -1) === 0 && Number.isFinite(warpEnvelope(0.1, 1e-9)));
}

console.log('\n— le plan : borné, à la surface, refus nommés —');
{
  // le cas réel : le pire résiduel de l'audit (0,56 m entre pied attendu et ballon)
  const p = planWarp([0.56, 0], [0, 0]);
  const land = [0.56 + p.offset[0], p.offset[1]];
  ok(`le résiduel de l'audit (0,56 m) se ferme SANS refus (offset ${p.mag.toFixed(2)} m ≤ ${WARP.warpMax})`,
    p.denied === null && p.mag <= WARP.warpMax);
  ok(`…et le pied atterrit AU standoff (${Math.hypot(...land).toFixed(3)} m = ${WARP.standoff} du centre)`,
    Math.abs(Math.hypot(...land) - WARP.standoff) < 1e-9);
  // la direction d'approche est respectée quelle que soit la géométrie (résiduel 0,5 m — dans la
  // borne : 0,5 − standoff = 0,32 ≤ warpMax ; hors borne, c'est la clause d'écrêtage qui juge)
  let onSurface = true;
  for (const ang of [0.3, 1.2, 2.5, 4.0, 5.5]) {
    const b = [1, -0.5], e = [b[0] + Math.cos(ang) * 0.5, b[1] + Math.sin(ang) * 0.5];
    const q = planWarp(e, b);
    const l = [e[0] + q.offset[0] - b[0], e[1] + q.offset[1] - b[1]];
    if (q.denied || Math.abs(Math.hypot(...l) - WARP.standoff) > 1e-9) onSurface = false;
  }
  ok('depuis TOUTE direction, la cible est sur le cercle de surface (5 géométries)', onSurface);
  const good = planWarp([WARP.standoff, 0], [0, 0]);
  ok(`un clip déjà juste n'est PAS touché (pied à standoff pile ⇒ offset ${good.mag.toFixed(4)} m)`, good.mag < 1e-9);
  const far = planWarp([1.2, 0.4], [0, 0]);
  ok(`au-delà de la borne : écrêté À la borne (${far.mag.toFixed(2)} = ${WARP.warpMax}) ET refus NOMMÉ (${far.denied})`,
    Math.abs(far.mag - WARP.warpMax) < 1e-9 && far.denied === 'warp-hors-borne' && far.full > WARP.warpMax);
  const deg = planWarp([0, 0], [0, 0]);
  ok('dégénéré (pied sur le centre) : offset nul, cause nommée, aucun NaN',
    deg.offset[0] === 0 && deg.offset[1] === 0 && deg.denied === 'warp-degenere'
    && Number.isFinite(deg.mag) && Number.isFinite(deg.full));
}

console.log('\n— la portée : on n\'étire pas un genou —');
{
  ok('cible dans la portée de la jambe : acceptée', warpReach([0, 0.9, 0], [0.3, 0.2, 0.3], 0.45, 0.45));
  ok('cible au-delà de l\'extension : REFUSÉE (le clip garde le pied)',
    !warpReach([0, 0.9, 0], [0.9, 0.0, 0.5], 0.45, 0.45));
}

console.log('\n— LA CLAUSE REINE, composée : une frappe entière, rejouée —');
// Le mini-monde : la trajectoire du clip traverse le point attendu E à v_clip = 12 m/s (le banc de
// swing garantit ce profil) ; le ballon B est posé au pire résiduel de l'audit. Le warp est la
// SEULE chose qu'on ajoute. On mesure le RÉSULTAT — pas l'intention.
const composeStrike = ({ E = [0.56, 0], B = [0, 0], vClip = 12, antic = 0.38, cfg = WARP, env = warpEnvelope } = {}) => {
  const plan = planWarp(E, B, cfg);
  const foot = (t) => {
    const clip = [E[0] + (t - antic) * vClip, E[1]];             // le clip traverse E au contact
    const s = env(t, antic, cfg);
    return [clip[0] + plan.offset[0] * s, clip[1] + plan.offset[1] * s];
  };
  const h = 1e-3;
  const at = foot(antic);
  const va = foot(antic - h), vb = foot(antic + h);
  return {
    plan,
    distAtContact: Math.hypot(at[0] - B[0], at[1] - B[1]),
    speedBefore: Math.hypot(at[0] - va[0], at[1] - va[1]) / h,
    speedAfter: Math.hypot(vb[0] - at[0], vb[1] - at[1]) / h,
    offClipAfter: (() => { const t = antic + cfg.out + 1e-3; const f = foot(t); return Math.hypot(f[0] - (E[0] + (t - antic) * vClip), f[1] - E[1]); })(),
  };
};
{
  const r = composeStrike();
  ok(`AU CONTACT le pied est à la surface du ballon (${(r.distAtContact * 100).toFixed(1)} cm = standoff ${WARP.standoff * 100} ± 1)`,
    Math.abs(r.distAtContact - WARP.standoff) < 0.01);
  ok(`AU CONTACT la vitesse est celle du CLIP (${r.speedBefore.toFixed(2)} / ${r.speedAfter.toFixed(2)} m/s vs 12 ± 2 %)`,
    Math.abs(r.speedBefore - 12) / 12 <= 0.02 && Math.abs(r.speedAfter - 12) / 12 <= 0.02);
  ok(`APRÈS (antic + ${WARP.out} s) la jambe est RENDUE au clip (écart ${(r.offClipAfter * 1000).toFixed(2)} mm)`,
    r.offClipAfter < 1e-3);
}

console.log('\n— les sabotages : chaque clause doit mordre —');
{
  // 1. la rampe qui vise APRÈS le contact — « plus doux », et elle freine la frappe : au contact
  // l'enveloppe bouge encore, le warp verse de la vitesse CONTRE le swing.
  const late = (t, antic) => { const u = Math.max(0, Math.min(1, (t - antic * 0.6) / (antic * 0.4 + 0.05))); return u * u * (3 - 2 * u); };
  const r1 = composeStrike({ env: late });
  ok(`sabotage « rampe qui vise après le contact » attrapé (vitesse au contact ${r1.speedBefore.toFixed(1)} m/s ≠ 12 ± 2 %)`,
    Math.abs(r1.speedBefore - 12) / 12 > 0.02);
  // 2. le warp qui vise le CENTRE du ballon (standoff 0) : le pied atterrit DANS le ballon.
  // (résiduel 0,35 m — dans la borne, pour que ce soit bien le standoff qu'on juge, pas l'écrêtage)
  const r2 = composeStrike({ E: [0.35, 0], cfg: { ...WARP, standoff: 0 } });
  ok(`sabotage « viser le centre du ballon » attrapé (pied à ${(r2.distAtContact * 100).toFixed(1)} cm du centre — dans le ballon)`,
    r2.distAtContact < 0.11);
  // 3. le warp qui ne rend JAMAIS la jambe (enveloppe collée à 1 après le tir) : l'accompagnement
  // authoré n'existe plus, le pied reste tiré vers un point que le ballon a quitté.
  const stuck = (t, antic, cfg) => (t >= antic * 0.6 ? Math.min(1, warpEnvelope(Math.min(t, antic), antic, cfg) + (t > antic ? 1 : 0)) : warpEnvelope(t, antic, cfg));
  const r3 = composeStrike({ env: stuck });
  ok(`sabotage « la jambe jamais rendue » attrapé (écart au clip après le geste : ${(r3.offClipAfter * 100).toFixed(0)} cm)`,
    r3.offClipAfter > 0.1);
  // 4. l'écrêtage MUET : la borne mord sans nommer — la dette disparaît du registre.
  const silent = (e, b, cfg) => { const p = planWarp(e, b, cfg); return { ...p, denied: null }; };
  const s4 = silent([1.2, 0.4], [0, 0], WARP);
  ok('sabotage « écrêtage silencieux » attrapé (borne mordue SANS cause nommée = dette invisible)',
    s4.full > WARP.warpMax && s4.denied === null);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
