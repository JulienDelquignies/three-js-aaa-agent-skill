// L'EMPREINTE BIT-PRÈS — reconstruit post-redémarrage (les valeurs se RE-BASENT ici ;
// l'historique vit dans NOTES). Hash FNV de l'état (positions/vitesses/score/événements).
import { makeMatch, matchCfg, matchStep } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const fnv = (str) => { let h = 0xcbf29ce484222325n; for (const c of str) { h ^= BigInt(c.charCodeAt(0)); h = (h * 0x100000001b3n) & 0xffffffffffffffffn; } return h.toString(16).padStart(16, '0'); };
const dump = (st) => JSON.stringify({ p: st.players.map((q) => [q.p[0].toFixed(4), q.p[2].toFixed(4), (q.yaw ?? 0).toFixed(3)]), b: [st.ball.p[0].toFixed(4), st.ball.p[1].toFixed(4), st.ball.p[2].toFixed(4)], s: st.score ?? null, e: st.events?.length ?? 0 });
for (const seed of [3, 7]) {
  const st = makeMatch({ full: true, seed });
  const cfg = matchCfg({ shotRange: 20, ...(process.argv[2] ? JSON.parse(process.argv[2]) : {}) });
  for (let i = 0; i < 90 * 60; i++) matchStep(st, 1 / 60, cfg);
  console.log(`match seed ${seed}: ${fnv(dump(st))}`);
}
