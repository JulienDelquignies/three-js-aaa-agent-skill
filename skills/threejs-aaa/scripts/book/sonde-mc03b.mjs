import { kick, simulate } from '../../assets/starter/src/engine/ball.js';
const vAt20 = (v0) => { const s = kick([0, 0.3, 0], { speed: v0, elevation: 0.06 }); const { path } = simulate(s, { dt: 1 / 120, maxT: 5, until: (st) => st.p[0] >= 20, opts: { ground: false } }); const l = path[path.length - 1]; return Math.hypot(l.v[0], l.v[1], l.v[2]); };
console.log(`4   vitesse à 20 m (vol pur, sans sol) selon v0 : ${[10, 14, 16, 18, 20, 22, 26, 30, 35].map((v) => `${v} → ${vAt20(v).toFixed(1)}`).join(' ; ')} m/s (cible : inflexion vers 16-20, saturation 17-21)`);
