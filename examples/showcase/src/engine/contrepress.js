// contrepress.js — LE CONTRE-PRESSING CHRONOMÉTRÉ (229). La bibliothèque : « 6 s (Guardiola), 5 s (Klopp),
// 8-10 s (Rangnick) » — le contre-press est une HORLOGE, pas une fenêtre rare : à la perte, si le bloc
// est COMPACT (≥ compact des siens à < rayon m) et la zone permise (pas à 80 m de son but — l'axe
// hauteurBloc décide : 0,5 exclut le tiers propre), les n plus proches (rôle press ≥ 0,25) forment la
// MEUTE : le premier est déjà presseur (i = 0 du bloc), les autres FERMENT les sorties (la sortie la plus
// proche du ballon, à ferme m côté ballon — « le premier sprint dans le joueur »), pendant dur ×
// pressing × work. À la mort de l'horloge (regain, remise, chasseurs échus) : le RECUL-FREIN, un
// burst 'repli' immédiat (la loi 221 fait le reste). Mesuré AVANT (6 × 300 s) : 1,3 chasseur à +1 s,
// 0,7 à +8 s, jamais plus de 2 ; regain < 5 s dans 27 % des pertes.
// Le patron Unity/Unreal : la loi ici, les nombres dans cfg.contrePress, le profil par les axes tactiques
// (pressing, hauteurBloc), les hommes par leurs facteurs (workF) et leur rôle (press). LA CHAISE À QUATRE PIEDS
// (Moulin, CP.chaise) : la ligne arrière ne chasse pas — mesuré sans elle : 19 chasseurs sur 66 étaient des défenseurs,
// et la bande montait à 13 buts (le dos ouvert).
import { LIGNES, mapPostes, formationPour } from './formation.js';

/** LE DÉPOSSÉDÉ SE RETOURNE (cfg.lossReact, déporté verbatim du match-sim au 229) : pendant lossReact s
 *  l'ex-porteur CHASSE son ballon ; s'éteint au regain ou à la mort de la fenêtre. */
export function lossReactStep(st, cfg, { busy }) {
  if (!cfg.lossReact || !st._lossAt) return;
  for (const idS of Object.keys(st._lossAt)) {
    const id = +idS, la = st._lossAt[id], p = st.players[id];
    if (!p || st.t - la > cfg.lossReact * (p.skill?.workF ?? 1)) { delete st._lossAt[id]; continue; }   // WORK RATE est une note (151) : le travailleur chasse sa perte plus longtemps
    const ownerNow = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
    if (ownerNow && ownerNow.team === p.team) { delete st._lossAt[id]; continue; }
    if (p.down > 0 || busy(p) || st.possession.carrier === p.id) continue;
    // un joueur DÉJÀ en chasse garde sa cible (fixture orbite aveugle, +2,1 m les deux bras) ; le contre-press ne re-cible que le coureur de slot
    if (p.job === 'press' || p.job === 'intercept') continue;
    p.job = 'press';
    p.target = [st.ball.p[0] + st.ball.v[0] * 0.25, 0, st.ball.p[2] + st.ball.v[2] * 0.25];
    p.push = null;
  }
}

const pace = (p, st, until, kind) => {
  const k = (p._pace?.until ?? -1) > st.t ? p._pace.kind : null;
  if (!k) p._pace = { until, kind, next: p._pace?.next ?? st.t + 8 };
};

/** La meute chronométrée — après l'affectation des postes et le dépossédé (elle s'applique par-dessus). */
export function contrePressStep(st, cfg, { busy, tac, axe, role, d2, pitch }) {
  const CP = cfg.contrePress; if (!CP || !st.full) return;
  const poss = st.possession.team, prev = st._cpPoss ?? -1;
  if (poss >= 0 && poss !== prev) {
    if (prev >= 0 && !st.restart) {
      const loser = prev, T = tac(st, loser), hx = pitch.hx;
      const x = st.ball.p[0] * Math.sign(pitch.attackGoal(loser).x || 1);
      const mine = st.players.filter((p) => p.team === loser && !p.keeper && p.down <= 0);
      const near = mine.filter((p) => d2(p.p, st.ball.p) < (CP.rayon ?? 20)).length;
      // la zone permise : à 0,5 le tiers propre est exclu ; bloc bas (0) : la moitié adverse seulement ; gegenpressing (1) : presque partout
      if (near >= (CP.compact ?? 4) && x > axe(T.hauteurBloc, 0, -hx * 2 / 3)) {
        const dur = (CP.dur ?? 5.5) * axe(T.pressing, 0.6, 1.4);
        const f = T.formation, arriere = new Set(CP.chaise === false ? [] : mapPostes(f).slice(0, (LIGNES[formationPour(f, true)] ?? [4, 3, 3])[0]));
        const hunters = mine.filter((p) => role(p).press >= 0.25 && !arriere.has(p.post))
          .sort((a, b) => d2(a.p, st.ball.p) - d2(b.p, st.ball.p)).slice(0, CP.n ?? 3)
          .map((p) => ({ id: p.id, until: st.t + dur * (p.skill?.workF ?? 1) }));
        if (hunters.length) {
          st._cp = { team: loser, t0: st.t, hunters };
          st.events.push({ t: +st.t.toFixed(2), type: 'contre-press', team: loser, n: hunters.length, dur: +dur.toFixed(1) });
        }
      }
    }
    st._cpPoss = poss;
  }
  const cp = st._cp; if (!cp) return;
  const alive = cp.hunters.filter((h) => h.until > st.t);
  if (poss === cp.team || st.restart || !alive.length) {
    // LE RECUL-FREIN : l'horloge morte sans regain, la meute rentre tout de suite (burst repli — la loi 221 prend le relais)
    if (poss !== cp.team) for (const h of cp.hunters) {
      const p = st.players[h.id];
      if (p && p.down <= 0) pace(p, st, st.t + (CP.frein ?? 0.5), 'repli');
    }
    st._cp = null; return;
  }
  const owner = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
  const outlets = st.players.filter((q) => q.team !== cp.team && !q.keeper && q !== owner && q.down <= 0)
    .sort((a, b) => d2(a.p, st.ball.p) - d2(b.p, st.ball.p)).slice(0, cp.hunters.length);
  const pris = new Set();
  for (const h of alive) {
    const p = st.players[h.id];
    if (!p || p.down > 0 || busy(p) || st.possession.carrier === p.id) continue;
    if (p.job === 'press' || p.job === 'intercept') continue;   // le presseur du bloc et le dépossédé gardent leur cible
    let best = null, bd = Infinity;
    for (const o of outlets) if (!pris.has(o.id)) { const d = d2(p.p, o.p); if (d < bd) { bd = d; best = o; } }
    if (!best) break;
    pris.add(best.id);
    // la LIGNE se ferme au point ferme [0..1] du chemin ballon → sortie (0 : la cage sur le ballon, 1 : le marquage de la sortie)
    const f = CP.ferme ?? 0.5;
    p.job = 'press'; p.target = [st.ball.p[0] + (best.p[0] - st.ball.p[0]) * f, 0, st.ball.p[2] + (best.p[2] - st.ball.p[2]) * f]; p.push = null;
    if (CP.elan && st.t - cp.t0 < CP.elan) pace(p, st, cp.t0 + CP.elan, 'contre-press');   // le premier sprint
  }
}
