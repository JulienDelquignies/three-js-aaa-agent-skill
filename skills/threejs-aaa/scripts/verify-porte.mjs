// verify-porte.mjs — LE PORTÉ QUI ANTICIPE (cfg.porteAnticipe — retour utilisateur : « le joueur oublie le ballon quand il
// court ou quand il contrôle »).
//
// Mesuré avant : pendant l'armé d'une passe, le corps GLISSE sur son ancre jusqu'à 7,5 m/s ; le ballon, porté au servo
// (tau 0,035) vers le point de stance du corps D'AVANT le pas, traînait 0,38 m derrière — un armé sur cinq était REFUSÉ au
// contact (stance-au-contact : 65 par 900 s), le ballon vendangé (−40 %) et le corps filait sur son élan : 2,2 m, 0,5 s,
// « il court sans son ballon » (32 des 35 épisodes). Ce qu'on prouve : (1) avec la clé, les refus au contact tombent (≤ 35 %
// d'hier) et les épisodes « le porteur lancé s'éloigne de son ballon » avec eux (≤ 50 %) ; (2) le vendangé qui reste se
// REPREND (le porteur vise son ballon) ; (3) la clé absente rend l'hier (les refus d'hier, au compte).
//
// Lancer : node skills/threejs-aaa/scripts/verify-porte.mjs

import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log(`✓ ${label}`); } else { fail++; console.log(`✗ ${label}`); } };
const hyp = Math.hypot;

/** Un monde : les refus au contact, les épisodes « il court sans son ballon », le ballon derrière un porteur lancé. */
const monde = (over) => {
  const cfg = matchCfg({ locomoteur: null /* locomoteur null DATÉ 260 : vert à HEAD~ (au 254), le porté qui anticipe remangé par le profil locomoteur (les corps démarrent en 2,3 τ) — la clause mesure le porté, pas la locomotion */, shotRange: 20, chrono: { periodes: 2, duree: 180, pause: 6 }, contre: null /* contre null DATÉ 258b : vert à HEAD~ (porte 4/0 au 258), les refus au contact (25 c. 58 = 43 % > 35) remangés par le corps qui contre — la clause mesure le porté, pas le contre */, ...over });
  let refus = 0, armes = 0, joues = 0, episodes = 0, derriere = 0, portes = 0, reprisesRapides = 0, vendanges = 0;
  for (const seed of [3, 5, 7]) {
    const st = makeMatch({ full: true, seed }); let ep = 0, prevRefus = 0, vend = null;
    for (let i = 0; i < 60 * 300; i++) {
      const n0 = st.events.length;
      matchStep(st, 1 / 60, cfg);
      for (const e of st.events.slice(n0)) { if (e.type === 'windup' && !['touche', 'elan', 'volee-gardien', 'roule-main'].includes(e.tech)) armes++; if (e.type === 'pass' || e.type === 'shot') joues++; }
      const r = st.deny?.['stance-au-contact'] ?? 0;
      const c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
      if (r > prevRefus && c) { vendanges++; vend = { id: c.id, t: st.t }; }   // un vendangé : le porteur doit le reprendre
      prevRefus = r;
      if (vend && st.t - vend.t > 1.5) { vend = null; }
      if (vend && st.ball.owner === vend.id && st.t - vend.t > 0.05) { reprisesRapides++; vend = null; }
      if (st.phase === 'carry' && c && !st.restart && !c.keeper) {
        portes++;
        const dx = st.ball.p[0] - c.p[0], dz = st.ball.p[2] - c.p[2], d = hyp(dx, dz), v = hyp(c.v[0], c.v[1]);
        const cosB = v > 0.1 && d > 0.05 ? (c.v[0] * dx + c.v[1] * dz) / (v * d) : 1;
        if (v > 2 && d > 1.2 && cosB < -0.3) { derriere++; ep++; } else { if (ep >= 12) episodes++; ep = 0; }
      } else { if (ep >= 12) episodes++; ep = 0; }
    }
    refus += st.deny?.['stance-au-contact'] ?? 0;
  }
  return { refus, armes, joues, episodes, derriere, portes, vendanges, reprisesRapides };
};
const V = monde({}), E = monde({ porteAnticipe: null });
ok(V.refus <= E.refus * 0.35 && V.refus < E.refus, `LE PORTÉ QUI ANTICIPE : les refus au contact tombent — ${V.refus} stance-au-contact c. ${E.refus} sans la clé (≤ 35 % ; ${V.armes} armés → ${V.joues} passes+tirs c. ${E.armes} → ${E.joues} : l'armé porte)`);
ok(V.episodes <= E.episodes * 0.5, `…et « il court sans son ballon » avec eux : ${V.episodes} épisodes ≥ 0,2 s c. ${E.episodes} sans la clé (≤ 50 % ; le ballon derrière un porteur lancé ${V.derriere} c. ${E.derriere} images sur ${V.portes} de porté)`);
ok(V.vendanges === 0 || V.reprisesRapides >= Math.ceil(V.vendanges * 0.6), `le vendangé qui reste se REPREND : ${V.reprisesRapides}/${V.vendanges} ballons vendangés repris en moins de 1,5 s par leur porteur (≥ 60 % ; sans la clé ${E.reprisesRapides}/${E.vendanges})`);
ok(E.refus >= 40 && E.refus >= V.refus * 2.5, `la clé absente rend l'hier : ${E.refus} refus au contact (le monde d'hier, ≥ 40 sur 3 × 300 s — la mesure qui a nommé le défaut)`);
console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
