// L'A/B DES GESTES PORTÉS, MESURÉ DANS LE RENDU DU DUEL — la même partie (même graine : la sim est identique au bit, meme-partie.mjs)
// jouée deux fois, gestes générés (A) puis gestes GameplayFootball (B, ?gpf=1). Pour chaque geste remplacé que la couche joue
// (controleInterieur, controleOriente, tacle), sur sa fenêtre [début, début + durée], les os RENDUS (matrixWorld) image par image :
//   pied → ballon   la distance la plus courte du centre du pied (milieu cheville / orteils) au centre du ballon sim, sur les
//                   0,3 premières secondes (le contrôle est rapporté à son contact) ; le tacle : sur toute la glissade (0,8 s)
//   pelouse         le point le plus bas des pieds — orteil et cheville contre leurs hauteurs DEBOUT (calibrées) — cm, < 0 = sous le sol
//   patinage        le pied POSÉ qui glisse : orteil à moins de 3 cm de sa hauteur DEBOUT (calibrée au coup d'envoi) ET pied
//                   lent (< 1 m/s horizontal) trois images de suite — le déplacement horizontal cumulé sur ces images (cm).
//                   (v2 pondérait la hauteur seule : un pied de foulée qui rase le sol à 5 m/s comptait — 1,5-4,6 m « patinés »
//                   par geste dans les DEUX versions, la foulée mesurée au lieu du patinage)
//   à-coups         l'accélération angulaire des os DANS LE REPÈRE DU JOUEUR (la rotation de la racine, que la sim impose, est
//                   retirée : le lacet d'un demi-tour n'est pas le geste) — °/s², p95 de la fenêtre — et le plus grand saut d'un os
//                   d'une image à l'autre (°/image) : les pops de fondu y montent
// (v1 mesurait les os en MONDE et la pelouse contre le profil : les deux versions y étaient dominées par la sim et la calibration)
// Usage : node rendu-ab.mjs <url duel> [secondes=180] [graines=1,2,3] [json]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const [URL, SECS = '180', GR = '1,2,3', OUT] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function joue(seed, gpf) {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}${gpf ? '&gpf=1' : ''}`, { waitUntil: 'load', timeout: 240000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length >= 2, null, { timeout: 240000 });
  const r = await pg.evaluate((SECS) => {
    const sc = window.__scene, st = sc.state, dt = 1 / 60, NOMS = /^(controleInterieur|controleOriente|tacle)(-gauche)?$/;
    const OS = ['Hips', 'Spine1', 'Head', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot', 'LeftArm', 'RightArm'];
    const fen = sc.players.map(() => null), out = [];
    // LA HAUTEUR DEBOUT de chaque joueur (coup d'envoi, les deux pieds posés) : orteils et chevilles — la référence de la pelouse
    sc.update(dt); const debout = sc.players.map((pl) => { pl.model.updateMatrixWorld(true); const B = pl.gestureLayer.bones, y = (n) => B.get(n).getWorldPosition(new (pl.model.position.constructor)()).y;
      return { toe: Math.min(y('LeftToeBase'), y('RightToeBase')), ankle: Math.min(y('LeftFoot'), y('RightFoot')) }; });
    sc.players.forEach((pl, j) => { const L = pl.gestureLayer, beg = L.begin.bind(L);
      L.begin = (spec, ...a) => { const n = String(spec?.name ?? '');
        if (fen[j]) { out.push(fen[j]); fen[j] = null; }
        if (NOMS.test(n)) fen[j] = { j, nom: n.replace(/-gauche$/, ''), gauche: /-gauche$/.test(n), t0: st.t, dur: spec.duration, f: [] };
        return beg(spec, ...a); }; });
    const q = new (sc.players[0].model.quaternion.constructor)(), v = new (sc.players[0].model.position.constructor)();
    for (let i = 0; i < SECS * 60; i++) {
      sc.update(dt);
      sc.players.forEach((pl, j) => { const F = fen[j]; if (!F) return;
        if (st.t > F.t0 + F.dur + 0.1) { out.push(F); fen[j] = null; return; }
        pl.model.updateMatrixWorld(true);
        const B = pl.gestureLayer.bones, rec = { t: +(st.t - F.t0).toFixed(3), ball: [...st.ball.p], o: {} };
        for (const os of OS) { const bo = B.get(os); bo.matrixWorld.decompose(v, q, v.clone()); bo.getWorldPosition(v); rec.o[os] = [v.x, v.y, v.z, q.x, q.y, q.z, q.w]; }
        for (const os of ['LeftToeBase', 'RightToeBase']) { B.get(os).getWorldPosition(v); rec.o[os] = [v.x, v.y, v.z]; }
        pl.model.getWorldQuaternion(q); rec.root = [q.x, q.y, q.z, q.w]; rec.ref = debout[j];
        F.f.push(rec); });
    }
    for (const F of fen) if (F) out.push(F);
    return out;
  }, +SECS);
  await pg.close();
  return r;
}
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qang = (a, b) => { const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]); return 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI; };
const local = (r, os) => { const o = r.o[os]; return qmul([-r.root[0], -r.root[1], -r.root[2], r.root[3]], [o[3], o[4], o[5], o[6]]); };
function mesures(F) {
  const R = F.f; if (R.length < 4) return null;
  const dt = 1 / 60, H = 0.05, ref = R[0].ref;
  let piedBallon = Infinity; const tMax = F.nom === 'tacle' ? 0.8 : 0.3;
  for (const r of R) if (r.t <= tMax) for (const s of ['Left', 'Right']) { const a = r.o[`${s}Foot`], t = r.o[`${s}ToeBase`], c = [(a[0] + t[0]) / 2, (a[1] + t[1]) / 2, (a[2] + t[2]) / 2];
    piedBallon = Math.min(piedBallon, Math.hypot(c[0] - r.ball[0], c[1] - r.ball[1], c[2] - r.ball[2])); }
  let bas = Infinity, basAt = 0; for (const r of R) { const v = Math.min(r.o.LeftToeBase[1] - ref.toe, r.o.RightToeBase[1] - ref.toe, r.o.LeftFoot[1] - ref.ankle, r.o.RightFoot[1] - ref.ankle); if (v < bas) { bas = v; basAt = r.t; } }
  let patin = 0;
  for (const s of ['Left', 'Right']) { let run = 0;
    for (let i = 1; i < R.length; i++) {
      const a = R[i - 1].o[`${s}ToeBase`], b = R[i].o[`${s}ToeBase`], d = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const pose = b[1] - ref.toe < 0.03 && d / dt < 1.0; run = pose ? run + 1 : 0;
      if (run >= 3) patin += d; } }
  const acc = []; let saut = 0, sautOu = '';
  for (const os of Object.keys(R[0].o)) { if (R[0].o[os].length < 7) continue; const w = [];
    for (let i = 1; i < R.length; i++) { const a = qang(local(R[i - 1], os), local(R[i], os)); if (a > saut) { saut = a; sautOu = `${os}@${R[i].t.toFixed(2)}`; } w.push(a / dt); }
    for (let i = 1; i < w.length; i++) acc.push(Math.abs(w[i] - w[i - 1]) / dt); }
  acc.sort((x, y) => x - y);
  return { piedBallon: piedBallon * 100, pelouse: bas * 100, pelouseAt: basAt, patin: patin * 100, acc95: acc[Math.floor(0.95 * (acc.length - 1))], saut, sautOu };
}
const med = (a) => { const s = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const R = { A: [], B: [] };
for (const seed of GR.split(',').map(Number)) for (const [k, g] of [['A', false], ['B', true]]) {
  const L = await joue(seed, g);
  for (const F of L) { const m = mesures(F); if (m) R[k].push({ seed, j: F.j, nom: F.nom, gauche: F.gauche, t0: +F.t0.toFixed(2), ...Object.fromEntries(Object.entries(m).map(([x, y]) => [x, typeof y === 'number' ? +y.toFixed(1) : y])) }); }
  console.log(`graine ${seed} ${k} : ${L.length} gestes mesurés`);
}
await b.close();
for (const nom of ['controleInterieur', 'controleOriente', 'tacle']) {
  const a = R.A.filter((x) => x.nom === nom), bb = R.B.filter((x) => x.nom === nom);
  const row = (L) => `n=${L.length} · pied→ballon ${med(L.map((x) => x.piedBallon)).toFixed(0)} cm · pelouse ${med(L.map((x) => x.pelouse)).toFixed(1)} cm (pire ${Math.min(...L.map((x) => x.pelouse)).toFixed(1)}) · patinage ${med(L.map((x) => x.patin)).toFixed(1)} cm · à-coups p95 ${Math.round(med(L.map((x) => x.acc95)))} °/s² · saut ${med(L.map((x) => x.saut)).toFixed(1)}°/image`;
  // les PAIRES (même graine, même joueur, même instant) : combien de fois B fait mieux que A
  const P = a.map((x) => [x, bb.find((y) => y.seed === x.seed && y.j === x.j && y.t0 === x.t0)]).filter(([, y]) => y);
  const mieux = (k, plusPetit = true) => P.filter(([x, y]) => (plusPetit ? y[k] < x[k] : y[k] > x[k])).length;
  const ou = (L) => { const c = {}; for (const x of L) { const [os, t] = String(x.sautOu).split('@'); const k = `${os}${+t < 0.1 ? '(début)' : +t > (x.nom === 'tacle' ? 1.2 : 0.5) ? '(fin)' : ''}`; c[k] = (c[k] ?? 0) + 1; } return JSON.stringify(Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 4)); };
  console.log(`\n${nom}\n  A généré : ${row(a)}\n  B GPF    : ${row(bb)}\n  paires ${P.length} — B mieux que A : pelouse ${mieux('pelouse', false)}, patinage ${mieux('patin')}, à-coups ${mieux('acc95')}, sauts ${mieux('saut')}\n  où sautent les os (A) ${ou(a)}\n  où sautent les os (B) ${ou(bb)}`);
}
if (OUT) writeFileSync(OUT, JSON.stringify(R, null, 1));
