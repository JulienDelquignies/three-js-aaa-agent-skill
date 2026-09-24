// Ce que le générateur PRÉVOIT par vitesse (avant, style neutre) contre la littérature (temps de contact : Weyand 2000,
// Cavanagh & Kram 1989, Nummela 2007 ; foulée = 2 pas).
const E = decodeURI(new URL('../../../../', import.meta.url).pathname) + 'examples/showcase/src/engine/';
const { gaitParams, gaitLegK } = await import(E + 'motion-gait.js');
const { SHANON_PROFILE } = await import(E + 'motion-profile-shanon.js');
const LIT = { 3: { tc: 0.27, S: 2.2 }, 4: { tc: 0.225, S: 2.8 }, 5: { tc: 0.19, S: 3.4 }, 6: { tc: 0.165, S: 3.9 }, 7: { tc: 0.14, S: 4.3 }, 8: { tc: 0.12, S: 4.6 } };
const legK = gaitLegK(SHANON_PROFILE); console.log('legK shanon', legK.toFixed(3));
for (const v of [2, 3, 4, 5, 6, 7, 8]) {
  const p = gaitParams(v, 0, undefined, null, legK);
  const S = v * p.T, tc = p.s * p.T, L = LIT[v];
  console.log(`v ${v} : cycle ${p.T.toFixed(3)} s, foulée ${S.toFixed(2)} m, cadence ${(120 / p.T).toFixed(0)} pas/min, appui s ${p.s.toFixed(3)} → contact ${tc.toFixed(3)} s, vol ${(100 * (1 - 2 * p.s)).toFixed(0)} %, balayage d'appui ${(v * tc).toFixed(2)} m, drop ${(100 * p.drop).toFixed(1)} cm, swingH ${(100 * p.swingH).toFixed(0)} cm` +
    (L ? `   | LIT contact ${L.tc} s → appui ${(L.tc / p.T).toFixed(3)}, vol ${(100 * (1 - 2 * L.tc / p.T)).toFixed(0)} %, foulée ${L.S} m, balayage ${(v * L.tc).toFixed(2)} m` : ''));
}
