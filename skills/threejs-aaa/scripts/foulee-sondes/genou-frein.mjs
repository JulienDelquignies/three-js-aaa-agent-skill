// Le genou en VOL (max) du générateur : ligne droite contre frein / virage, à vitesse égale ; la référence des coureurs (volRef).
const E = process.env.ENG || '/home/delkit/DelkIT/skill-1v1/examples/showcase/src/engine/';
const MG = await import(E + 'motion-gait.js'); const { SHANON_PROFILE: P } = await import(E + 'motion-profile-shanon.js');
const { volRef } = await import(E + 'foulee-rbds.js');
const ref = (v) => { let m = 0; for (let i = 0; i <= 40; i++) m = Math.max(m, volRef(v, i / 40).genou); return m; };
const kmax = (v, opts) => { const pr = MG.gaitPortrait(P, { vF: v, vR: 0, opts, n: 240 }); let m = 0, w = null; for (const f of pr.frames) for (const s of ['L', 'R']) if (f[s].phase === 'swing' && f[s].kneeAngle > m) { m = f[s].kneeAngle; } return m; };
const cases = [['droit', {}], ['frein .5', { brake: 0.5 }], ['frein 1', { brake: 1 }], ['virage 4.5', { turn: 4.5 }], ['virage 9', { turn: 9 }], ['virage -9', { turn: -9 }], ['frein+virage 9', { brake: 1, turn: 9 }]];
console.log('v    réf  ' + cases.map((c) => c[0].padStart(15)).join(''));
for (const v of [2.5, 3, 3.5, 4, 4.5, 5.5, 7]) console.log(String(v).padEnd(5), ref(v).toFixed(0).padStart(4), cases.map(([, o]) => kmax(v, { griffe: 1, ...o }).toFixed(0).padStart(15)).join(''));
