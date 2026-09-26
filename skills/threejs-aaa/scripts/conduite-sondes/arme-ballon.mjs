// LE BALLON PENDANT L'ARMÉ D'UNE FRAPPE, VU DU RENDU. Pour chaque armé (geste 'pass' : tir, passe, dégagement — de l'engagement au
// contact) : le ballon qui BOUGE SANS PIED à 0,2 m (le servo du porté au point de stance — l'aimant), sa vitesse au plus fort, les images
// d'ACCÉLÉRATION INEXPLIQUÉE (au sol, > 2 m/s² au-delà du roulement, sans pied à 0,2 m) ; AU CONTACT : le ballon au pied QUI FRAPPE (rendu) et
// au pied le plus proche ; le mouvement du corps pendant l'armé (le glissement sur l'ancre). En bout de partie : tirs, buts, refus
// stance-au-contact. Usage : node arme-ballon.mjs <url> [secondes=120] [graines=1,2,3,4] [sortie.json]
import { chromium } from '../../../../examples/showcase/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const [URL, SECS = '120', GR = '1,2,3,4', OUT] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const A = [], G = [];
for (const seed of GR.split(',').map(Number)) {
  const pg = await b.newPage({ viewport: { width: 320, height: 180 } });
  await pg.goto(`${URL}${URL.includes('?') ? '&' : '?'}seed=${seed}`, { waitUntil: 'load', timeout: 240000 });
  await pg.waitForFunction(() => !!window.__scene && window.__scene.players?.length === 2, null, { timeout: 240000 });
  const r = await pg.evaluate((SECS) => {
    const sc = window.__scene, st = sc.state, dt = 1 / 60, W = (o) => { const e = o.matrixWorld.elements; return [e[12], e[13], e[14]]; };
    const B = sc.players.map((pl) => { const f = {}; pl.model.traverse((o) => { if (o.isBone && !f[o.name]) f[o.name] = o; }); return f; });
    const bl = st.ball, dist = (q) => Math.hypot(q[0] - bl.p[0], q[1] - bl.p[1], q[2] - bl.p[2]);
    const pieds = (j, cote) => Math.min(...(cote ? [cote + 'Foot', cote + 'ToeBase'] : ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']).map((k) => dist(W(B[j][k]))));
    const out = [], ouv = new Map(); let ne = 0, bv0 = null;
    for (let i = 0; i < SECS * 60; i++) {
      sc.update(dt); for (const pl of sc.players) pl.model.updateMatrixWorld(true);
      const bv = [bl.v[0], bl.v[2]];
      sc.players.forEach((pl, j) => { const s = pl.sim, a = s.act;
        let o = ouv.get(j);
        if (o && o.act !== a) { o.coupe = true; delete o.act; delete o.prev; delete o.pp; out.push(o); ouv.delete(j); o = null; }   // le geste a disparu sans contact
        if (!o && a && a.payload?.kind === 'pass' && !a.payload.mains && !a.fired) { o = { act: a, j, t: st.t, tech: a.payload.pick?.tech?.id ?? a.id, foot: a.payload.pick?.foot, n: 0, porte: 0, glisse: 0, vMax: 0, inexp: 0, corps: 0, piedMin0: +pieds(j).toFixed(3) }; ouv.set(j, o); }
        if (!o) return;
        if (!a.fired) {
          o.n++; const d = pieds(j), porte = bl.owner === s.id; if (porte) o.porte++;
          const bs = Math.hypot(...bv); o.vMax = Math.max(o.vMax, bs);
          if (d > 0.2 && o.prev) o.glisse += Math.hypot(bl.p[0] - o.prev[0], bl.p[2] - o.prev[2]);
          if (bv0 && bl.p[1] < 0.16 && d > 0.2) { const sp = Math.hypot(...bv0), ux = sp > 0.1 ? bv0[0] / sp : 0, uz = sp > 0.1 ? bv0[1] / sp : 0, rou = sp > 0.1 ? 0.4 + 0.17 * sp : 0;
            if (Math.hypot((bv[0] - bv0[0]) / dt + ux * rou, (bv[1] - bv0[1]) / dt + uz * rou) > 2) o.inexp++; }
          if (o.pp) o.corps += Math.hypot(s.p[0] - o.pp[0], s.p[2] - o.pp[2]);
          o.prev = [...bl.p]; o.pp = [...s.p];
          // la DERNIÈRE image d'armé (le contact part à l'image suivante, le ballon y vole déjà) : le pied qui va frapper, et la stance réalisée
          const cote = o.foot === 'left' ? 'Left' : o.foot === 'right' ? 'Right' : null, S = a.payload.stance;
          o.piedAvant = +(cote ? pieds(j, cote) : d).toFixed(3); o.procheAvant = +d.toFixed(3); o.bPre = [bl.p[0] + bl.v[0] * dt, bl.p[1] + bl.v[1] * dt, bl.p[2] + bl.v[2] * dt];   // où le ballon serait à l'image du contact sans la frappe
          if (S) { const dx = bl.p[0] - s.p[0], dz = bl.p[2] - s.p[2], di = Math.hypot(dx, dz) || 1e-9, fx = Math.cos(s.yaw), fz = Math.sin(s.yaw), cr = fx * dz / di - fz * dx / di;
            const ab = Math.acos(Math.max(-1, Math.min(1, (fx * dx + fz * dz) / di))) * 180 / Math.PI, be = ((cr > 0) === (o.foot === 'left')) ? ab : -ab;
            o.eDist = +(di - S.dist).toFixed(3); o.eBear = +(((be - S.bearing + 540) % 360) - 180).toFixed(1); o.eYaw = +((((s.yaw - (a.payload.outYaw ?? s.yaw)) * 180 / Math.PI + 540) % 360) - 180).toFixed(1); }
        } else {   // l'image du contact : le ballon vient de partir du point de contact (≤ 1 image de vol)
          const cote = o.foot === 'left' ? 'Left' : o.foot === 'right' ? 'Right' : null;
          o.piedFrappe = +(cote ? pieds(j, cote) : pieds(j)).toFixed(3);
          if (o.bPre) { const bp = o.bPre; o.piedContact = +Math.min(...(cote ? [cote + 'Foot', cote + 'ToeBase'] : ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']).map((k) => { const q = W(B[j][k]); return Math.hypot(q[0] - bp[0], q[1] - bp[1], q[2] - bp[2]); })).toFixed(3); delete o.bPre; } o.piedProche = +pieds(j).toFixed(3); o.vDepart = +Math.hypot(...bl.v).toFixed(1);
          delete o.prev; delete o.pp; delete o.act; out.push(o); ouv.delete(j);
        }
      });
      bv0 = bv;
      while (ne < st.events.length) ne++;
    }
    const ev = st.events;
    return { out, tirs: ev.filter((e) => e.type === 'shot').length, buts: ev.filter((e) => e.type === 'but').length, deny: st.deny ?? {} };
  }, +SECS);
  A.push(...r.out.map((x) => ({ seed, ...x }))); G.push({ seed, tirs: r.tirs, buts: r.buts, deny: r.deny });
  await pg.close(); console.log(`graine ${seed} : ${r.out.length} armés, ${r.tirs} tirs, ${r.buts} buts, stance-au-contact ${r.deny['stance-au-contact'] ?? 0}, ballon-vif ${r.deny['ballon-vif'] ?? 0}, ancre ${r.deny.ancre ?? 0}`);
}
await b.close();
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const m = (L, f, d = 2) => `${q(L.map(f), 0.5).toFixed(d)} [${q(L.map(f), 0.1).toFixed(d)}–${q(L.map(f), 0.9).toFixed(d)}]`;
const P = A.filter((x) => !x.coupe);
console.log(`\n${A.length} armés (${A.length - P.length} coupés avant le contact) — médiane [p10–p90]`);
console.log(`  durée ${m(P, (x) => x.n / 60)} s ; ballon PORTÉ (servo) ${m(P, (x) => x.porte / Math.max(1, x.n))} de l'armé`);
console.log(`  ballon qui bouge SANS pied à 0,2 m : ${m(P, (x) => x.glisse)} m (${P.filter((x) => x.glisse > 0.1).length}/${P.length} > 0,1 m, ${P.filter((x) => x.glisse > 0.3).length} > 0,3 m) ; vitesse du ballon au plus fort ${m(P, (x) => x.vMax, 1)} m/s ; images d'accélération inexpliquée ${m(P, (x) => x.inexp, 0)}`);
console.log(`  corps pendant l'armé ${m(P, (x) => x.corps)} m`);
console.log(`  À L'IMAGE DU CONTACT : le pied qui frappe au ballon d'avant la frappe ${m(P.filter((x) => x.piedContact != null), (x) => x.piedContact)} m (${P.filter((x) => x.piedContact <= 0.2).length}/${P.length} ≤ 0,2 m)`);
console.log(`  DERNIÈRE IMAGE AVANT LE CONTACT : ballon au pied qui frappe ${m(P, (x) => x.piedAvant)} m (${P.filter((x) => x.piedAvant <= 0.2).length}/${P.length} ≤ 0,2 m), au pied le plus proche ${m(P, (x) => x.procheAvant)} m`);
{ const S = P.filter((x) => x.eDist != null); console.log(`  stance réalisée : écart de distance |${m(S, (x) => Math.abs(x.eDist))}| m, de relèvement |${m(S, (x) => Math.abs(x.eBear), 1)}|° (${S.filter((x) => Math.abs(x.eDist) > 0.22 || Math.abs(x.eBear) > 22).length}/${S.length} hors porte 0,22 m / 22°), lacet contre la sortie |${m(S, (x) => Math.abs(x.eYaw), 1)}|°`); }
const T = G.reduce((s, g) => ({ tirs: s.tirs + g.tirs, buts: s.buts + g.buts, sac: s.sac + (g.deny['stance-au-contact'] ?? 0) }), { tirs: 0, buts: 0, sac: 0 });
console.log(`  parties : ${T.tirs} tirs, ${T.buts} buts, ${T.sac} refus stance-au-contact`);
{ const K = {}; for (const x of P) K[x.tech] = (K[x.tech] ?? 0) + 1; console.log('  gestes :', Object.entries(K).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')); }
if (OUT) writeFileSync(OUT, JSON.stringify({ A, G }));
