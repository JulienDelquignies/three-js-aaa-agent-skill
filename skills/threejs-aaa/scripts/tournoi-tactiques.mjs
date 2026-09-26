#!/usr/bin/env node
// tournoi-tactiques.mjs — LES TACTIQUES CHANGENT-ELLES LE MATCH ? (26/09, audit : « aucune matrice tactique A contre B n'est versionnée »).
// Chaque preset de tactics.js joue contre l'équilibre, des deux côtés (A-B puis B-A : le terrain, le coup d'envoi et la patte s'annulent),
// sur N graines, 2 × 45 min. Par tactique, la MOYENNE de ce qu'un spectateur (et un analyste) lit :
//   buts / tirs / xG pour et contre, la possession, la HAUTEUR DU BLOC (x moyen des 10 de champ quand l'adversaire a le ballon, en m
//   depuis son propre but), la LARGEUR en possession (écart-type z des 10), le PPDA (passes adverses dans leurs 60 % / nos récupérations
//   dans cette zone), les ballons longs (≥ 32 m), et les récupérations hautes (dans le dernier tiers adverse).
// Usage : node tournoi-tactiques.mjs [graines=3,7] [durée période s=2700] [presets=tous] — un preset par processus avec --un <nom>.
import { makeMatch, matchStep, matchCfg } from '../assets/starter/src/engine/match-sim.js';
import { TACTIQUES } from '../assets/starter/src/engine/tactics.js';
import { ROLES_FORMATION } from '../assets/starter/src/engine/formation.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2), un = args.indexOf('--un');
const graines = (args[0] && args[0] !== '--un' ? args[0] : '3,7').split(',').map(Number), DUR = +(args[1] && !args[1].startsWith('--') ? args[1] : 2700);
const hyp = Math.hypot;

/** Un match : tactiques [a, b] → les mesures des DEUX équipes. */
export function jouer(seed, ta, tb, dur = DUR) {
  const tac = [ta, tb].map((t) => ({ ...TACTIQUES[t], nom: t }));
  const roles = tac.map((t) => ({ ...(ROLES_FORMATION[t.formation ?? '433'] ?? {}), ...(t.roles ?? {}) }));
  const st = makeMatch({ full: true, seed, tactics: tac, roles }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: dur, pause: 10 } });
  const M = [0, 1].map(() => ({ buts: 0, tirs: 0, xg: 0, hBloc: 0, nH: 0, larg: 0, nL: 0, passesAdv60: 0, recup60: 0, longs: 0, recupHaute: 0 }));
  let seen = 0;
  for (let i = 0; i < dur * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    for (; seen < st.events.length; seen++) {
      const e = st.events[seen], p = e.by != null ? st.players[e.by] : null;
      if (e.type === 'but' && e.team != null) M[e.team].buts++;
      else if (e.type === 'shot' && p) { M[p.team].tirs++; M[p.team].xg += e.xg ?? 0; }
      else if (e.type === 'pass' && p && !e.clear && !p.keeper) {
        const own = st.pitch.ownGoal(p.team), dOwn = Math.abs(p.p[0] - own.x);
        if (dOwn < 63) M[1 - p.team].passesAdv60++;
        const r = e.to >= 0 ? st.players[e.to] : null; if (r && hyp(r.p[0] - p.p[0], r.p[2] - p.p[2]) >= 32) M[p.team].longs++;
      } else if (e.type === 'turnover' && e.equipe != null) {
        const w = e.equipe, q = st.players[e.by], adv = st.pitch.ownGoal(1 - w), d = q ? Math.abs(q.p[0] - adv.x) : 99;
        if (d < 63) M[w].recup60++; if (d < 35) M[w].recupHaute++;
      }
    }
    if (i % 30 === 0 && !st.restart && st.possession.team >= 0) {
      const att = st.possession.team, def = 1 - att;
      const D = st.players.filter((q) => q.team === def && !q.keeper), own = st.pitch.ownGoal(def);
      M[def].hBloc += D.reduce((a, q) => a + Math.abs(q.p[0] - own.x), 0) / D.length; M[def].nH++;
      const A = st.players.filter((q) => q.team === att && !q.keeper), mz = A.reduce((a, q) => a + q.p[2], 0) / A.length;
      M[att].larg += Math.sqrt(A.reduce((a, q) => a + (q.p[2] - mz) ** 2, 0) / A.length); M[att].nL++;
    }
  }
  const poss = st._chrono?.poss ?? [1, 1], tot = poss[0] + poss[1] || 1;
  return M.map((m, k) => ({ buts: m.buts, tirs: m.tirs, xg: m.xg, possession: poss[k] / tot, hauteurBloc: m.hBloc / (m.nH || 1), largeur: m.larg / (m.nL || 1), ppda: m.passesAdv60 / Math.max(1, m.recup60), longs: m.longs, recupHautes: m.recupHaute, butsContre: M[1 - k].buts, tirsContre: M[1 - k].tirs, xgContre: M[1 - k].xg }));
}

function moyenne(L) { const o = {}; for (const k of Object.keys(L[0])) o[k] = L.reduce((a, x) => a + x[k], 0) / L.length; return o; }

if (un >= 0) {
  const nom = args[un + 1], L = [];
  for (const s of graines) { L.push(jouer(s, nom, 'equilibre')[0]); L.push(jouer(s, 'equilibre', nom)[1]); }
  console.log(JSON.stringify({ nom, ...moyenne(L) }));
} else if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const presets = (args[2] ?? Object.keys(TACTIQUES).join(',')).split(',');
  const R = presets.map((nom) => { const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), graines.join(','), String(DUR), '--un', nom], { encoding: 'utf8' }); try { return JSON.parse(r.stdout.trim().split('\n').pop()); } catch { return { nom, erreur: r.stderr.slice(0, 200) }; } });
  const f = (x, k = 2) => (x == null || !isFinite(x) ? '—' : x.toFixed(k));
  console.log(`TOURNOI (chaque preset contre l'équilibre, des deux côtés, graines ${graines.join(',')}, 2 × ${DUR} s)`);
  console.log('preset          buts  contre  tirs  contre  xG    xGc   poss  bloc(m) larg(m) PPDA  longs récupH');
  for (const r of R) console.log(r.erreur ? `${r.nom} : ${r.erreur}` : `${r.nom.padEnd(15)} ${f(r.buts)}  ${f(r.butsContre)}   ${f(r.tirs, 1).padStart(4)}  ${f(r.tirsContre, 1).padStart(4)}   ${f(r.xg)}  ${f(r.xgContre)}  ${f(100 * r.possession, 0)}%  ${f(r.hauteurBloc, 1).padStart(5)}   ${f(r.largeur, 1).padStart(5)}  ${f(r.ppda, 1).padStart(4)}  ${f(r.longs, 0).padStart(4)}  ${f(r.recupHautes, 1)}`);
}
