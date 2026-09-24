// calibre.mjs — LA CALIBRATION CONJOINTE DE LA BASE DU JEU (25/09 ; douze leviers locaux se sont compensés depuis le 290 : on les
// déplace ENSEMBLE). Tire N configurations au hasard dans des plages RÉALISTES (chaque borne se justifie : les vitesses de course,
// le rayon de prise plafonné à la fenêtre de la table des techniques 1,0 m, …), les joue par sonde-303 sur des demi-matchs, et
// les note par l'écart aux cibles du book (z-scores pondérés). usage : node calibre.mjs N graines duréeParPériode fichierSortie
import { spawn } from 'node:child_process'; import { writeFileSync, appendFileSync } from 'node:fs';
import { matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const [,, Nst = '40', seedsArg = '3,7', durArg = '1350', out = '/tmp/calibre.jsonl', rngSeed = '1'] = process.argv;
const N = +Nst, dur = +durArg, k90 = 2700 / dur;
let s0 = +rngSeed; const rnd = () => { s0 = (s0 * 1664525 + 1013904223) % 4294967296; return s0 / 4294967296; };
const U = (a, b) => a + (b - a) * rnd();
const B = matchCfg({});
// LES CIBLES (Référentiel 02, Modèle 09) : valeur, tolérance, poids
const CIBLES = { passes: [447, 30, 1], completion: [82.5, 1.5, 1], passesParPossession: [4.0, 0.5, 2], pertes: [125, 20, 1.5], longs: [47, 8, 0.5], uneTouche: [20, 6, 0.7], manquesPct: [3, 1.5, 0.7], tirs: [26, 6, 0.5] };
const score = (R) => Object.entries(CIBLES).reduce((a, [k, [v, t, w]]) => a + w * ((R[k] - v) / t) ** 2, 0);
const tirer = (base) => base ? {} : {
  speeds: { ...B.speeds, press: +U(5.6, 6.8).toFixed(2), chase: +U(5.6, 6.8).toFixed(2) },
  gardeTiers: { ...B.gardeTiers, proche: +U(1.5, 3).toFixed(2), milieu: +U(3, 7).toFixed(2), loin: +U(5, 11).toFixed(2) },
  rushedRadius: +U(3.2, 6).toFixed(2), strikeReach: +U(1.25, 1.6).toFixed(2), receiveRadius: +U(0.85, 1.0).toFixed(2),
  tacleDebout: { ...B.tacleDebout, k: +U(0.45, 0.65).toFixed(3) },
  hommeLibre: { ...B.hommeLibre, seuil: +U(2.5, 4).toFixed(2), malus: +U(3, 6).toFixed(2) },
  passeMarque: { ...B.passeMarque, remiseF: +U(0.35, 1).toFixed(2) },
  avantContact: { ...B.avantContact, seuil: +U(0.6, 1.3).toFixed(2) },
  holdMax: +U(2, 4).toFixed(2), dribble: { ...B.dribble, volume: +U(0.15, 0.35).toFixed(3) },
  uneToucheVive: { ...B.uneToucheVive, base: +U(0.1, 0.7).toFixed(2), press: +U(2.2, 3.4).toFixed(2) },   // la une-touche au calme (216 : base 0,7) et le réflexe pressé
  passe: { ...B.passe, tClean: +U(0.25, 0.4).toFixed(3) },   // le budget du contrôle propre : 0,25 s au book (Modèle 09 § 6.1), 0,4 au moteur
};
const jobs = []; for (let i = 0; i <= N; i++) { const cfg = tirer(i === 0); for (const s of seedsArg.split(',')) jobs.push({ i, cfg, s }); }
const res = {};
let j = 0; const run = () => new Promise((ok) => { const next = () => { if (j >= jobs.length) return ok(); const J = jobs[j++];
  const p = spawn('node', ['sonde-303.mjs', J.s, JSON.stringify(J.cfg), String(dur)], { cwd: '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/scripts/book' }); let o = '';
  p.stdout.on('data', (d) => (o += d)); p.on('close', () => { const m = o.match(/^JSON (.*)$/m); if (m) { const R = JSON.parse(m[1]); (res[J.i] ??= { cfg: J.cfg, R: [] }).R.push(R);
    if (res[J.i].R.length === seedsArg.split(',').length) { const A = {}; for (const k of Object.keys(R)) A[k] = res[J.i].R.reduce((a, x) => a + x[k], 0) / res[J.i].R.length;
      for (const k of ['passes', 'possessions', 'pertes', 'longs', 'uneTouche', 'contestesPerdus', 'tirs']) A[k] *= k90;
      const sc = score(A); appendFileSync(out, JSON.stringify({ i: J.i, score: +sc.toFixed(2), A, cfg: J.cfg }) + '\n'); } } next(); }); }; next(); });
writeFileSync(out, '');
await Promise.all([run(), run(), run(), run()]);
console.log('fini →', out);
