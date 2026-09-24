// sonde 304 — LES TENUES (25/09, « creuse, on doit trouver ») : chaque prise de balle d'un joueur de champ (contrôle, réception, ballon
// gardé) jusqu'à sa fin — passe, perte, tir, dégagement, arrêt ; les durées, la course, et pour les PERTES la dernière action du porteur
// (ou subie) et la géométrie des pertes après une touche de conduite (ballon–porteur, ballon–gagneur, temps depuis la touche, vitesses).
// usage : node sonde-304.mjs [graine] [json des réglages] [durée par période, 1350]
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seed = +(process.argv[2] ?? 3), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 1350);
const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over });
let seen = 0, cur = null; const H = [], fin = {}, W = {}, G = []; const dist = [];
const close = (k) => { if (!cur) return; const d = st.t - cur.t; H.push(d); fin[k] = (fin[k] ?? 0) + 1; (dist[k] ??= []).push(d); cur = null; };
for (let i = 0; i < DUR * 60 * 2.4; i++) { matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
  if (cur) { const P = st.players[cur.id]; cur.run += Math.hypot(P.v[0], P.v[1]) / 60; }
  for (; seen < st.events.length; seen++) { const e = st.events[seen], p = e.by != null ? st.players[e.by] : null;
    if ((e.type === 'control' || e.type === 'receive' || e.type === 'loose-kept') && p && !p.keeper && !st.restart) { if (cur && cur.id === p.id) continue; close('reprise'); cur = { id: p.id, t: st.t, run: 0, last: e.type + (e.miss ? ':miss:' + (e.issue ?? '') : '') + (e.tech ? ':' + e.tech : '') }; }
    else if (cur && e.type === 'pass' && e.by === cur.id) { const r = cur.run; close(e.clear ? 'dégagement' : 'passe'); (dist.run ??= []).push(r); }
    else if (cur && e.type === 'shot' && e.by === cur.id) close('tir');
    else if (cur && e.type === 'turnover') { const P = st.players[cur.id], k = (e.why ?? '?') + '<' + (cur.last ?? '-') + ' ' + (st.t - cur.t < 0.8 ? '<0.8s' : '>0.8s') + (st.ball.owner === P.id ? '' : ''); W[k] = (W[k] ?? 0) + 1; if (cur.last === 'touche') { const R = st.players[e.by], h = Math.hypot; G.push([h(st.ball.p[0]-P.p[0], st.ball.p[2]-P.p[2]), R ? h(st.ball.p[0]-R.p[0], st.ball.p[2]-R.p[2]) : -1, st.t - cur.tT, h(P.v[0],P.v[1]), cur.spT, cur.foeT, cur.devT]); } close('perte'); }
    else if (cur && e.by === cur.id && e.type === 'touche') { const P = st.players[cur.id]; cur.last = 'touche'; cur.tT = st.t; cur.spT = e.spd; cur.devT = e.dev; cur.foeT = Math.min(...st.players.filter(q => q.team !== P.team && !q.keeper).map(q => Math.hypot(q.p[0]-P.p[0], q.p[2]-P.p[2]))); }
    else if (cur && e.by === cur.id) cur.last = e.type + (e.kind ? ':' + e.kind : '') + (e.miss ? ':miss' : '');
    else if (cur && e.sur === cur.id) cur.last = 'subi ' + e.type + (e.kind ? ':' + e.kind : '');
    else if (cur && e.type === 'restart-pris') close('arrêt'); } }
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(f * (s.length - 1))]?.toFixed(2); };
console.log(JSON.stringify(over).slice(0, 60), 'tenues', H.length, 'médiane', q(H, .5), 'p25/p75', q(H, .25), q(H, .75), 'fins', JSON.stringify(fin));
for (const k of Object.keys(dist)) console.log('  ', k, 'n', dist[k].length, 'méd', q(dist[k], .5), 'p75', q(dist[k], .75), 'p90', q(dist[k], .9));
console.log(Object.entries(W).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([k,v])=>k+' '+v).join('\n'));
const med=(i)=>q(G.map(g=>g[i]),.5); console.log('touche→perte n',G.length,'ballon-porteur',med(0),'ballon-gagneur',med(1),'dt depuis touche',med(2),'v porteur',med(3),'v touche',med(4),'adv le + proche à la touche',med(5),'cassure',med(6));
for (const g of G) console.log(g.map(x=>(+x).toFixed(2)).join(' '));
