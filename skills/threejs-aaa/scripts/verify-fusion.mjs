#!/usr/bin/env node
// verify-fusion.mjs — LA LOI DE FUSION D'UN GESTE EN FLUX (rondo-fusion.js, lot A2) : l'heure du clip pour
// l'heure de la sim, le poids des jambes, le tir tenu. Des lois PURES ; le monde composé (le pied qui arrive
// à la vitesse du clip, l'appui posé, aucune glissade) se juge à audit-membres.mjs sur le build.
import { FUSION, sampleTime, legsByArrive, legsByContact, fusionSample, isStrikeSpec } from '../../../examples/showcase/src/scenes/rondo-fusion.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`✓ ${label}`); } else { fail++; console.log(`✗ ${label}`); } };
const rate = (t, antic, F) => (sampleTime(t + 5e-4, antic, F) - sampleTime(t - 5e-4, antic, F)) / 1e-3;

console.log('— l\'horloge d\'échantillonnage : en avance à t = 0, à l\'heure vraie au swing, le contact invariant —');
for (const antic of [0.22, 0.35, 0.45, 0.9]) {
  const r0 = rate(0.1 * antic, antic), r1 = rate(0.8 * antic, antic), r2 = rate(0.95 * antic, antic);
  ok(Math.abs(sampleTime(0, antic) - FUSION.lead * antic) < 1e-12 && Math.abs(sampleTime(antic, antic) - antic) < 1e-12 && Math.abs(sampleTime(antic * 1.3, antic) - antic * 1.3) < 1e-12,
    `antic ${antic} : t = 0 échantillonné à ${(FUSION.lead * antic).toFixed(3)} (la clé neutre sautée), le contact à l'heure du contact, l'accompagnement à l'heure vraie`);
  ok(Math.abs(r0 - (1 - FUSION.lead / FUSION.conv)) < 1e-6 && Math.abs(r1 - 1) < 1e-6 && Math.abs(r2 - 1) < 1e-6,
    `antic ${antic} : l'armé à ×${r0.toFixed(2)}, le SWING (de ${FUSION.conv} × antic au contact) à ×${r1.toFixed(2)} — le pied arrive à la vitesse du clip`);
}
{
  let mono = true, jump = 0; const antic = 0.35;
  for (let t = 0; t < antic * 1.5; t += 0.002) { const a = sampleTime(t, antic), b = sampleTime(t + 0.002, antic); if (b < a) mono = false; jump = Math.max(jump, b - a); }
  ok(mono && jump < 0.0025, `l'horloge est monotone et continue (saut max ${(jump * 1000).toFixed(2)} ms par 2 ms de sim)`);
  const hier = { ...FUSION, conv: 1 };
  ok(Math.abs(rate(0.9 * antic, antic, hier) - 0.7) < 1e-6 && Math.abs(sampleTime(0.2, 0.35, hier) - (0.2 + 0.3 * 0.35 * (1 - 0.2 / 0.35))) < 1e-12,
    `SABOTAGE nommé « conv 1 » (la loi d'hier) : le swing à ×0,70 — 5-6 m/s composé contre 11 au clip, la dette A2`);
}

console.log('\n— le poids des jambes : l\'arrivée et le contact qui approche (les lois d\'hier, déplacées) —');
ok(legsByArrive(0) === 1 && legsByArrive(2.5) === 0 && legsByArrive(1.25) === 0.5 && legsByArrive(9) === 0, 'par l\'arrivée : 1 − v/2,5 borné (posé : 1 ; 2,5 m/s : 0)');
ok(legsByContact(0, 0.3) === 0 && legsByContact(0.24, 0.3) === 1 && Math.abs(legsByContact(0.12, 0.3) - Math.pow(0.5, 1.5)) < 1e-12 && legsByContact(0.3 + 0.15, 0.3) === 0 && legsByContact(0.44, 0.3) === 1,
  'par le contact : (t/(0,8·antic))^1,5, plein au dernier cinquième de l\'armé, rendu 0,15 s après le contact');
{
  // le poids composé au contact : wLegs suit sa cible en τ 0,05 s (Rondo.js) — antic 0,22 (passe rapide) et 0,45
  const w = (antic) => { let x = 0; for (let t = 0; t < antic; t += 1 / 60) x += (Math.max(legsByArrive(4), legsByContact(t, antic)) - x) * Math.min(1, (1 / 60) / 0.05); return x; };
  ok(w(0.22) >= 0.9 && w(0.45) >= 0.95, `en course (4 m/s), les jambes sont au geste au contact : ${w(0.22).toFixed(2)} pour une passe rapide (0,22 s), ${w(0.45).toFixed(2)} pour une frappe (0,45 s)`);
  ok(w(0.22) * 1 >= 0.9 && w(0.22) * 0.7 < 0.7, `la vitesse composée au contact ≈ poids × cadence : ${(w(0.22) * 1).toFixed(2)} × clip aujourd'hui, ${(w(0.22) * 0.7).toFixed(2)} × clip hier (swing à ×0,7)`);
}

console.log('\n— le tir tenu : la sim tire au tick suivant t ≥ antic, la couche retient ce retard pour l\'accompagnement —');
{
  const spec = { name: 'passeRapide-gauche' }, antic = 0.22, pl = {};
  ok(isStrikeSpec(spec) && isStrikeSpec({ name: 'frappe' }) && !isStrikeSpec({ name: 'plongeonBas' }) && !isStrikeSpec({ name: 'voleeGardien' }) && !isStrikeSpec(null), 'la loi ne s\'applique qu\'aux frappes générées (famille strike), miroir compris ; plongeon, remise authorée : la loi d\'hier');
  const dt = 1 / 60, raw = []; for (const k of [12, 13, 14, 15, 16]) { const t = k * dt; const act = { t, fired: t >= antic }; raw.push(fusionSample(t, antic, act, pl, spec, dt)); }
  const seq = raw.map((x) => +x.toFixed(4));
  ok(seq[2] === 0.22 && Math.abs(seq[3] - 0.2367) < 1e-3 && Math.abs(seq[4] - 0.2533) < 1e-3 && seq[1] < seq[2] && seq[2] < seq[3],
    `act.t 12/60 → 13/60 → 14/60 (tir) → 15/60 : clip à ${seq.join(' → ')} — la clé de contact À L'IMAGE DU TIR, puis ×1 avec 13 ms de retard constant`);
  const steps = raw.slice(1).map((x, i) => x - raw[i]);
  ok(steps.every((d) => d >= 0.85 * dt - 1e-9 && d <= dt + 1e-9), `aucune image figée : le pas d'horloge vaut ${steps.map((d) => (d / dt).toFixed(2)).join(', ')} tick (≥ 0,85 — retenir le retard d'un coup à l'image du tir faisait 0,18)`);
  { const seq2 = [], plP = {}; for (const k of [20, 21, 22, 23, 24]) { const t = k * dt; seq2.push(fusionSample(t, 0.38, { t, fired: t >= 0.38 }, plP, { name: 'passe' }, dt)); }
    const st2 = seq2.slice(1).map((x, i) => x - seq2[i]);
    ok(Math.abs(seq2[3] - 0.38) < 1e-9 && st2.every((d) => d >= 0.95 * dt - 1e-9), `une passe (0,38 s, tir à 23/60) : contact à l'image du tir, swing à ×${(st2[0] / dt).toFixed(2)} (le retard n'est que 3 ms)`); }
  ok(Math.abs(fusionSample(0.9, 0.9, { t: 0.9, fired: true }, {}, { name: 'voleeGardien' }) - 0.9) < 1e-12 && Math.abs(fusionSample(0.3, 0.55, null, {}, { name: 'plongeonBas' }) - sampleTime(0.3, 0.55, { ...FUSION, conv: 1 })) < 1e-12,
    'hors frappe générée : ni retard tenu, ni convergence avancée — l\'horloge d\'hier au bit');
  const pl2 = {}; fusionSample(0.3, 0.22, { t: 0.3, fired: true }, pl2, spec);
  ok(pl2._fireOff === 1 / 30, 'un geste rejoint après son tir (contrôle rapporté) : le retard retenu est borné à un tick (1/30 s au plus)');
  const pl3 = { _fireOff: 0.013 }; fusionSample(0.1, 0.22, { t: 0.1, fired: false }, pl3, spec);
  ok(pl3._fireOff === null, 'un nouvel acte non tiré remet le retard à zéro');
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
