#!/usr/bin/env node
// verify-loi14.mjs — LE PENALTY EST UNE CÉRÉMONIE, PAS UNE TOUCHE DÉGUISÉE.
//
// La Loi 14 : à la remise 'penalty' (née de la Loi 12), tous les corps sauf le preneur et le
// gardien de la ligne se tiennent HORS surface, HORS de l'arc (rayon du mur autour du POINT),
// DERRIÈRE le ballon ; le gardien défenseur TIENT SA LIGNE jusqu'à la frappe ; et le penalty
// SE JOUE (le preneur tire par le canal shot standard — le plongeon existant répond). Mesuré
// avant : gardien à 1,81 m devant sa ligne, coéquipiers en marche VERS le point, 1 corps en
// surface / 1 dans l'arc / 1 devant le ballon à la prise. Après : 0,32 m / 0 / 0 / 0, frappe
// à +1,6 s. Doctrine lot 8 : fixtures craftées (le flux ne produit presque jamais de penalty
// — fautes rares ET en surface) ; clé loi14 défaut de matchCfg, gardée st.full + type.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// craft : le penalty tel qu'adjugeFaute le pose (équipe 0 lésée, surface de l'équipe 1)
const penaltyWorld = (seed, cfg) => {
  const st = makeMatch({ full: true, seed });
  for (let i = 0; i < 8 * 60 && !(st.phase === 'carry' && !st.restart); i++) matchStep(st, 1 / 60, cfg);
  const own = st.pitch.ownGoal(1);
  const spot = [own.x - own.sign * st.pitch.dims.spot, 0];
  st.ball.release('arrêt-de-jeu');
  st.phase = 'loose'; st.possession.carrier = -1; st.pass = null;
  st.restart = { type: 'penalty', p: spot, team: 0, at: st.t + cfg.restartWait + 1, placed: false, taker: -1 };
  const evBase = st.events.length;
  let photo = null;
  for (let i = 0; i < 16 * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    if (!photo) {
      const e = st.events.slice(evBase).find((x) => x.type === 'restart-pris');
      if (e) {
        const gk = st.players.find((p) => p.keeper && p.team === 1);
        const corps = st.players.filter((p) => p.id !== e.by && !(p.keeper && p.team === 1));
        const dSpot = (p) => Math.hypot(p.p[0] - spot[0], p.p[2] - spot[1]);
        photo = {
          t: e.t, preneur: e.by,
          gkLigne: Math.abs(own.x - gk.p[0]), gkZ: Math.abs(gk.p[2]),
          enSurface: corps.filter((p) => st.pitch.inBox(p.p[0], p.p[2], Math.sign(own.x))).length,
          dansArc: corps.filter((p) => dSpot(p) < 9.15).length,
          devant: corps.filter((p) => (p.p[0] - spot[0]) * own.sign > 0).length,
        };
      }
    }
  }
  const evs = st.events.slice(evBase);
  return { st, spot, own, photo, evs };
};

// ---------- 1. la CÉRÉMONIE (photo à la prise) + la LIGNE + la FRAPPE
for (const seed of [3, 7]) {
  const { photo, evs } = penaltyWorld(seed, matchCfg({ shotRange: 20 }));
  ok(`graine ${seed} — la cérémonie est PROPRE à la prise (surface ${photo?.enSurface} = 0, arc ${photo?.dansArc} = 0, devant le ballon ${photo?.devant} = 0 — corps hors preneur et gardien de la ligne)`,
    !!photo && photo.enSurface === 0 && photo.dansArc === 0 && photo.devant === 0);
  ok(`graine ${seed} — le gardien TIENT SA LIGNE (${photo?.gkLigne.toFixed(2)} m ≤ 0,6 de la ligne, |z| ${photo?.gkZ.toFixed(1)} ≤ poteaux — était 1,81 m devant sans la loi)`,
    !!photo && photo.gkLigne <= 0.6 && photo.gkZ <= 3.7);
  const pris = evs.find((e) => e.type === 'restart-pris');
  const tir = evs.find((e) => e.type === 'shot' && e.t >= pris?.t);
  const issue = evs.find((e) => ['but', 'arrêt', 'sortie'].includes(e.type) && tir && e.t >= tir.t);
  ok(`graine ${seed} — le penalty SE JOUE (prise → frappe à +${tir ? (tir.t - pris.t).toFixed(1) : '∅'} s ≤ 5, issue « ${issue?.type ?? '∅'} » dans les 8 s — le canal shot standard, le plongeon peut répondre)`,
    !!pris && !!tir && tir.t - pris.t <= 5 && !!issue && issue.t - tir.t <= 8);
}

// ---------- 2. sabotage nommé « cérémonie foraine » : loi14:false → le monde d'hier, mesuré
{
  const { photo } = penaltyWorld(3, matchCfg({ shotRange: 20, loi14: false }));
  ok(`sabotage « cérémonie foraine » attrapé (loi14:false : gardien à ${photo?.gkLigne.toFixed(2)} m > 1 de sa ligne, ${(photo?.enSurface ?? 0) + (photo?.dansArc ?? 0) + (photo?.devant ?? 0)} violation(s) de cérémonie ≥ 1 — coéquipiers vers le point, la remise générique nommée)`,
    !!photo && photo.gkLigne > 1 && (photo.enSurface + photo.dansArc + photo.devant) >= 1);
}

// ---------- 3. la loi est UNE CLÉ DE TYPE : le coup franc sous loi14 garde SON mur (Loi 13)
{
  const st = makeMatch({ full: true, seed: 3 });
  const cfg = matchCfg({ shotRange: 20 });
  for (let i = 0; i < 8 * 60 && !(st.phase === 'carry' && !st.restart); i++) matchStep(st, 1 / 60, cfg);
  const og = st.pitch.ownGoal(1);
  const rp = [og.x - og.sign * 24, 3];
  st.ball.release('arrêt-de-jeu');
  st.phase = 'loose'; st.possession.carrier = -1; st.pass = null;
  st.restart = { type: 'coup-franc', p: rp, team: 0, at: st.t + 6, placed: false, taker: -1 };
  for (let i = 0; i < 5 * 60; i++) matchStep(st, 1 / 60, cfg);
  ok(`la cérémonie ne DÉBORDE pas de son type (coup franc sous loi14 : le mur Loi 13 vit — ${st.restart?._mur?.length ?? 0} corps désignés = 2, la Loi 14 n'a pas mangé la Loi 13)`,
    (st.restart?._mur?.length ?? 0) === 2);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
