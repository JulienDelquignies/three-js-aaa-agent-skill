// episodes.mjs — LE LECTEUR D'ÉPISODES, l'enregistreur (24/09 : dix lois locales réfutées sur les pertes et les passes par séquence —
// les moyennes ne montrent plus la cause ; on regarde les pertes elles-mêmes). Joue des matchs de 90 min et garde des PERTES EN JEU
// (changement de possession hors remise en jeu) : 3 s avant, 1 s après, 20 images par seconde — chaque joueur (x, z, son job), le
// ballon (x, z, hauteur), le porteur. La cause est la dernière action de l'équipe qui perd (la comptabilité de sonde-295).
// usage : node episodes.mjs fichier.json [graines] [nombre par graine]
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
import { writeFileSync } from 'node:fs';
const out = process.argv[2] ?? 'episodes.json', seeds = (process.argv[3] ?? '3,7').split(',').map(Number), parGraine = +(process.argv[4] ?? 12);
const JOBS = ['carry', 'receive', 'support', 'press', 'cover', 'mark', 'intercept', 'walk', 'keeper', 'contre'];
const jc = (j) => { const k = JOBS.indexOf(j); return k < 0 ? JOBS.length : k; };
const r1 = (x) => Math.round(x * 10) / 10;
const episodes = [];
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 2700, pause: 10 } });
  const ring = [], pend = [], last = [null, null]; let seen = 0, gardes = 0; const cibles = { conduite: 0, 'take-on': 0, contrôle: 0, 'pique subie': 0, 'charge subie': 0, passe: 0 };
  const quota = { conduite: 4, 'take-on': 2, contrôle: 2, 'pique subie': 2, 'charge subie': 0, passe: 2 };
  const meta = st.players.map((P) => ({ id: P.id, team: P.team, keeper: !!P.keeper, post: P.post ?? null, name: P.name ?? null }));
  for (let i = 0; i < 2700 * 60 * 2.4 && gardes < parGraine; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    if (i % 3 === 0) { ring.push({ t: +st.t.toFixed(2), b: [r1(st.ball.p[0]), r1(st.ball.p[2]), r1(st.ball.p[1])], c: st.possession.carrier, ph: st.phase[0], r: st.restart ? 1 : 0,
      p: st.players.map((P) => [r1(P.p[0]), r1(P.p[2]), jc(P.job), P.down > 0 ? 1 : 0]) }); if (ring.length > 60) ring.shift();
      for (const e of pend) if (e.apres.length < 20) e.apres.push(ring[ring.length - 1]); }
    for (let k = pend.length - 1; k >= 0; k--) if (pend[k].apres.length >= 20) { const e = pend.splice(k, 1)[0]; episodes.push({ ...e.ep, frames: [...e.avant, ...e.apres] }); gardes++; }
    for (; seen < st.events.length; seen++) { const e = st.events[seen], p = e.by != null ? st.players[e.by] : null, tm = p?.team;
      const note = (t, k) => { if (t === 0 || t === 1) last[t] = { kind: k, t: st.t, by: e.sur ?? e.by }; };
      if (e.type === 'pass') note(tm, e.clear ? 'dégagement' : 'passe');
      else if (e.type === 'touche') note(tm, 'conduite');
      else if (e.type === 'control' || e.type === 'receive' || e.type === 'loose-kept') note(tm, e.miss ? 'contrôle raté' : 'contrôle');
      else if (e.type === 'duel' && e.kind === 'take-on') note(tm, 'take-on');
      else if (e.type === 'tacle-pique' && e.sur != null) note(st.players[e.sur].team, 'pique subie');
      else if (e.type === 'duel' && e.kind === 'épaule' && e.sur != null) note(st.players[e.sur].team, 'charge subie');
      if (e.type === 'turnover' && st.t > 120 && !st.restart && ring.length >= 60) { const perd = 1 - e.equipe, L = last[perd]; if (!L || st.t - L.t > 6) continue;
        const k = L.kind === 'contrôle raté' ? 'contrôle' : L.kind; if (!(k in quota) || cibles[k] >= quota[k]) continue;
        const ecart = gardes + pend.length; if (ecart >= parGraine) continue; cibles[k]++;
        pend.push({ avant: [...ring], apres: [], ep: { seed, t: +st.t.toFixed(1), minute: Math.floor(st.t / 60), cause: k, perd, gagne: e.equipe, gagneur: e.by, perdant: L.by ?? null, why: e.why, meta } }); } }
  }
}
writeFileSync(out, JSON.stringify({ jobs: JOBS, pitch: { hx: 52.5, hz: 34 }, episodes }));
console.log(`${episodes.length} épisodes → ${out}`, episodes.map((e) => `${e.seed}/${e.minute}' ${e.cause}`).join(', '));
