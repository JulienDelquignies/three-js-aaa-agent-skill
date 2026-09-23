// sonde 289b — D'OÙ VIENNENT LES PERTES HORS PASSE (sonde 289 : la moitié des pertes du moteur sont des ballons LIBRES ramassés par
// l'adversaire sans qu'une passe soit en cours ; le réel : conduite/dribble 14-18 % + tacle hors dribble 8-12 % des ~110-140 pertes par
// équipe). Pour chaque changement de possession (événement turnover) hors passe ouverte : le DERNIER geste qui a rendu le ballon libre
// dans les 3 s — duel perdu par le porteur (tacle debout qui pique), tacle glissé, dégagement, tir (rebond, parade), tête, contrôle
// manqué, la touche de CONDUITE du porteur lui-même (le ballon s'échappe), rien — ; l'âge de la possession perdue, le tiers, et le
// PING-PONG (la possession reperdue ≤ 2 s après avoir été gagnée).
import { makeMatch, matchStep, matchCfg } from '/home/user/three-js-aaa-agent-skill/skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
const seeds = (process.argv[2] ?? '3,7').split(',').map(Number), over = JSON.parse(process.argv[3] ?? '{}'), DUR = +(process.argv[4] ?? 2700);
const pc = (a, b) => (b ? (100 * a / b).toFixed(1) : '—'), q = (a, x) => { a = [...a].sort((u, v) => u - v); return a.length ? a[Math.min(a.length - 1, Math.floor(x * a.length))] : NaN; };
const O = { matchs: 0, pertes: 0, passe: 0, cause: {}, age: [], agePing: 0, tiers: [0, 0, 0], parWhy: {}, porteurAvant: 0, gainPar: {} };
for (const seed of seeds) {
  const st = makeMatch({ full: true, seed }), cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: DUR, pause: 10 }, ...over }); O.matchs++;
  let seen = 0, passeOuverte = null, gainT = [0, 0], dernierPorteur = null; const recent = [];
  for (let i = 0; i < DUR * 60 * 2.4; i++) {
    matchStep(st, 1 / 60, cfg); if (st.restart?.type === 'fin') break;
    if (st.possession.carrier >= 0 && st.phase === 'carry') dernierPorteur = { id: st.possession.carrier, team: st.players[st.possession.carrier].team, t: st.t };
    for (; seen < st.events.length; seen++) { const e = st.events[seen], p = e.by != null ? st.players[e.by] : null;
      recent.push({ ...e, tt: st.t }); while (recent.length && st.t - recent[0].tt > 3) recent.shift();
      if (e.type === 'pass' && !e.clear && !e.mains && e.to >= 0 && p) passeOuverte = { team: p.team, t: st.t };
      if ((e.type === 'control' || e.type === 'receive' || e.type === 'loose-kept') && p && passeOuverte && p.team === passeOuverte.team) passeOuverte = null;
      if (e.type === 'turnover') { const perdant = 1 - e.equipe; O.pertes++; O.parWhy[e.why] = (O.parWhy[e.why] ?? 0) + 1;
        const ageP = st.t - gainT[perdant]; gainT[e.equipe] = st.t;
        if (passeOuverte && passeOuverte.team === perdant && st.t - passeOuverte.t < 6) { O.passe++; passeOuverte = null; continue; }
        passeOuverte = null; O.age.push(ageP); if (ageP <= 2) O.agePing++;
        const s = Math.sign(st.pitch.attackGoal(perdant).x || 1), z = (st.ball.p[0] * s + st.pitch.hx) / (2 * st.pitch.hx); O.tiers[z < 1 / 3 ? 0 : z < 2 / 3 ? 1 : 2]++;
        let cause = 'rien (ballon libre sans geste nommé)';
        for (let k = recent.length - 2; k >= 0; k--) { const r = recent[k], rp = r.by != null ? st.players[r.by] : null; if (!rp) continue;
          if (r.type === 'duel' && r.kind !== 'aérien' && rp.team === e.equipe && r.won) { cause = 'DUEL : le tacle debout pique le ballon au porteur'; break; }
          if (r.type === 'slide' && rp.team === e.equipe && r.won) { cause = 'TACLE GLISSÉ gagné'; break; }
          if (r.type === 'tacle-pique' && rp.team === e.equipe) { cause = 'TACLE PIQUÉ'; break; }
          if (r.type === 'pass' && r.clear && rp.team === perdant) { cause = 'DÉGAGEMENT'; break; }
          if (r.type === 'shot' && rp.team === perdant) { cause = 'TIR (rebond, parade, contre)'; break; }
          if (r.type === 'tête' && rp.team === perdant) { cause = 'TÊTE (dégagement, remise)'; break; }
          if (r.type === 'duel' && r.kind === 'aérien') { cause = 'DUEL AÉRIEN'; break; }
          if (r.type === 'control' && rp.team === perdant && (r.miss || r.issue === 'manque' || r.issue === 'conteste-perdu' || r.issue === 'lourde')) { cause = 'CONTRÔLE mauvais (hors fenêtre)'; break; }
          if (r.type === 'turnover' && r.equipe === perdant) { cause = 'PING-PONG : reperdu juste après le gain'; break; }
        }
        if (cause.startsWith('rien') && dernierPorteur && dernierPorteur.team === perdant && st.t - dernierPorteur.t < 1.5) { cause = 'CONDUITE : la touche du porteur s\'échappe, l\'adversaire ramasse'; O.porteurAvant++; }
        O.cause[cause] = (O.cause[cause] ?? 0) + 1;
        const gp = e.equipe; O.gainPar[e.why] = (O.gainPar[e.why] ?? 0) + 1; void gp;
      }
    }
  }
}
const n = O.matchs, horsPasse = O.pertes - O.passe;
console.log(`${n} matchs de 2 × ${(DUR / 60).toFixed(0)} min ${JSON.stringify(over)} — ${O.pertes} changements de possession (turnover) = ${(O.pertes / n / 2).toFixed(0)} par équipe et par match ; ${pc(O.passe, O.pertes)} % sur une passe en cours, ${horsPasse} hors passe`);
console.log(`  par « why » moteur : ${Object.entries(O.parWhy).map(([k, v]) => `${k} ${pc(v, O.pertes)} %`).join(' ; ')}`);
console.log(`  HORS PASSE, le geste d'avant : ${Object.entries(O.cause).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pc(v, horsPasse)} % (${(v / n / 2).toFixed(0)}/éq.)`).join(' ; ')}`);
console.log(`  âge de la possession perdue p25/p50/p75 ${q(O.age, 0.25).toFixed(1)}/${q(O.age, 0.5).toFixed(1)}/${q(O.age, 0.75).toFixed(1)} s ; reperdue ≤ 2 s après le gain ${pc(O.agePing, horsPasse)} % ; par tiers (du perdant) défensif ${pc(O.tiers[0], horsPasse)} %, médian ${pc(O.tiers[1], horsPasse)} %, offensif ${pc(O.tiers[2], horsPasse)} %`);
