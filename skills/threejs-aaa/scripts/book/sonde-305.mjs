// sonde 305 — LES INTENTIONS DE PASSE (25/09) : chaque intention adoptée par un porteur — jouée (une passe dans 1,2 s après sa fin) ou
// morte (TTL, déchirée, plus porteur) ; la latence adoption → passe, et pendant les mortes les refus nommés (st.deny : ancre,
// technique, timing…), la part des images où le ballon est PORTÉ, la distance ballon–corps et les vitesses.
// usage : node sonde-305.mjs [graine] [json des réglages] [durée par période, 1350]
const { makeMatch, matchStep, matchCfg } = await import('/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js');
const seed = +(process.argv[2] ?? 3), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 1350);
const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over });
const OK = [], KO = [], open = new Map(), pend = [], lat = []; const R = { passe: 0, autre: 0 }, DX = {}, FIN = {}, dist = [], dur = [];
let seen = 0;
for (let i = 0; i < DUR * 60 * 2.4; i++) { matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
  const evs = st.events.slice(seen); seen = st.events.length;
  st.players.forEach((p) => {
    const o = open.get(p.id);
    if (p.intent && !o) open.set(p.id, { t: st.t, deny: { ...(st.deny ?? {}) }, to: p.intent.choice.to.id, ttl: p.intent.until - st.t });
    if (o && p.intent) { const P2 = p; o.fr = (o.fr ?? 0) + 1; if (st.ball.owner === P2.id) o.own = (o.own ?? 0) + 1; o.dS = (o.dS ?? 0) + Math.hypot(st.ball.p[0] - P2.p[0], st.ball.p[2] - P2.p[2]); o.vS = (o.vS ?? 0) + Math.hypot(st.ball.v[0], st.ball.v[2]); o.pS = (o.pS ?? 0) + Math.hypot(P2.v[0], P2.v[1]); }
    if (false) {}
    else if (o && (!p.intent || p.intent.choice.to.id !== o.to && false)) {
      open.delete(p.id);
      pend.push({ id: p.id, t: st.t, o, carrier: st.possession.carrier === p.id, restart: !!st.restart, d: Math.hypot(st.ball.p[0] - p.p[0], st.ball.p[2] - p.p[2]), deny: { ...(st.deny ?? {}) } }); return;
          } });
  for (let k = pend.length - 1; k >= 0; k--) { const P = pend[k]; if (evs.some(e => e.type === 'pass' && e.by === P.id)) { R.passe++; lat.push(st.t - P.o.t); OK.push(P.o); pend.splice(k, 1); continue; }
    if (st.t - P.t > 1.2) { pend.splice(k, 1); R.autre++; KO.push(P.o); dur.push(P.t - P.o.t); const k2 = !P.carrier ? 'plus porteur' : P.restart ? 'arrêt' : (P.t - P.o.t >= P.o.ttl - 0.02 ? 'TTL expiré' : 'déchirée'); FIN[k2] = (FIN[k2] ?? 0) + 1; dist.push(P.d); for (const [c, n] of Object.entries(P.deny)) { const d = n - (P.o.deny[c] ?? 0); if (d > 0) DX[c] = (DX[c] ?? 0) + d; } } }
}
const q = (a, f) => { const s = [...a].sort((u, v) => u - v); return s[Math.floor(f * (s.length - 1))]?.toFixed(2); };
console.log('intentions', R.passe + R.autre, '→ passe', R.passe, ', mortes', R.autre, JSON.stringify(FIN));
console.log('latence adoption→passe p50', q(lat, .5), 'p90', q(lat, .9)); console.log('durée de vie des mortes p25/50/75', q(dur, .25), q(dur, .5), q(dur, .75), '; ballon–porteur à la mort p50', q(dist, .5), 'p75', q(dist, .75));
console.log('refus (deny) pendant les intentions mortes :\n  ' + Object.entries(DX).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k} ${v}`).join('\n  '));
const m = (A, k) => q(A.filter(o => o.fr).map(o => (o[k] ?? 0) / o.fr), .5);
for (const [n, A] of [['jouées', OK], ['mortes', KO]]) console.log(n, ': part des images ballon PORTÉ', m(A, 'own'), '; ballon–corps', m(A, 'dS'), 'm ; v ballon', m(A, 'vS'), '; v porteur', m(A, 'pS'));
