// coup-envoi.js — LE COUP D'ENVOI (338, cfg.coupEnvoi && st.full — retour utilisateur 26/09 : « corrige le placement des joueurs
// au coup d'envoi » et « le joueur qui fait le coup d'envoi ne peut pas partir en dribble »). Sondé avant (4 engagements, 2 graines) :
//   — la grille d'hier (6 rangées pour 10 joueurs de champ, i % 6) EMPILAIT 6 paires de coéquipiers à < 1,5 m à CHAQUE engagement,
//     ignorait la formation, et l'engageur était le PREMIER du tableau — le latéral gauche ;
//   — l'engageur conduisait 1,5-3,5 m avant de donner (jusqu'à 6,6 s) : la Loi 8 veut que le ballon soit JOUÉ, et le preneur ne le
//     retouche pas avant un autre joueur.
// Ici : chaque équipe prend SA formation (l'engageuse la forme d'attaque, l'autre la forme défensive) repliée dans sa moitié — la
// ligne la plus haute à bord m de la ligne médiane, chaque ligne plus bas de (fMax − f) × L × recul ; l'ENGAGEUR est la pointe (le
// plus haut, le plus axial), le second homme le suivant ; l'adversaire qui tomberait dans le rond en sort radialement (rayon + marge).
// Le preneur venu du filet après un but garde la place de l'engageur (le chercheur de ballon — dette nommée : la pointe devrait engager).
// L'engageur TIENT son ballon sous la semelle jusqu'à sa passe (match-sim, branche du porteur : engageurTient), borné à tenue s.
import { FORMATIONS, formationPour } from './formation.js';
import { tac } from './tactics.js';
import { hyp } from './hyp.js';

/** Les postes d'engagement des deux équipes : { spots: { id: [x, z] }, taker, second } (gardiens exclus). Pure. */
export function postesEngagement(st, kickTeam, takerId, cfg) {
  const K = cfg.coupEnvoi, { pitch } = st, L = pitch.dims.length, R = (pitch.dims?.circle ?? 9.15) + (K.marge ?? 1);
  const out = {}; let taker = takerId, second = -1;
  for (const team of [0, 1]) {
    const sign = pitch.ownGoal(team).sign, F = FORMATIONS[formationPour(tac(st, team).formation, team === kickTeam)] ?? FORMATIONS[433];
    const fMax = Math.max(...F.map(([f]) => f));
    const field = st.players.filter((q) => q.team === team && !q.keeper && !q.expulse && !q._sub);
    const P = field.map((q) => { const [f, fz] = F[q.post ?? 0] ?? F[0]; return { q, f, fz }; });
    if (team === kickTeam) {
      const ord = [...P].sort((a, b) => (b.f - a.f) || (Math.abs(a.fz) - Math.abs(b.fz)));
      if (!(taker >= 0) || !field.some((q) => q.id === taker)) taker = ord[0]?.q.id ?? -1;
      second = ord.find((o) => o.q.id !== taker)?.q.id ?? -1;
    }
    for (const { q, f, fz } of P) {
      let x = sign * ((fMax - f) * L * (K.recul ?? 0.38) + (K.bord ?? 0.6)), z = fz * pitch.hz * 0.92;
      if (team !== kickTeam) { const d = hyp(x, z); if (d < R) { if (Math.abs(z) < 0.5) x = sign * R; else { x *= R / d; z *= R / d; } } }
      out[q.id] = [x, z];
    }
  }
  return { spots: out, taker, second };
}

/** La place de chacun : l'engageur derrière le ballon, le second homme au bord du rond, les autres à leur poste. */
function place(st, E, p, cfg) {
  const sg = st.pitch.ownGoal(p.team).sign;
  if (p.keeper) { const g = st.pitch.ownGoal(p.team); return [g.x - g.sign * 0.8, 0]; }
  return p.id === E.taker ? [sg * 1.2, 0.4] : p.id === E.second && cfg.engagementPasse !== false ? [sg * 2.6, -2.4] : E.spots[p.id];
}

/** La pose des corps (début de période — les vestiaires : la seule discontinuité légitime). */
export function placerEngagement(st, kickTeam, cfg) {
  const E = postesEngagement(st, kickTeam, -1, cfg);
  for (const p of st.players) {
    if (p.expulse || p._sub) continue;
    const s = place(st, E, p, cfg); if (!s) continue;
    p.p = [s[0], 0, s[1]]; p.v = [0, 0]; p.yaw = Math.atan2(0 - p.p[2], 0 - p.p[0]); p.act = null; p.intent = null; p.down = 0;
  }
}

/** Les cibles à rejoindre en marchant (après un but). */
export function spotsEngagement(st, kickTeam, takerId, cfg) {
  const E = postesEngagement(st, kickTeam, takerId, cfg), spots = {};
  for (const p of st.players) { if (p.expulse || p._sub) continue; const s = place(st, E, p, cfg); if (s) spots[p.id] = s; }
  return spots;
}

/** L'engageur tient son ballon : de la prise du coup d'envoi à sa passe (st.pass), borné à tenue s. Pure. */
export function engageurTient(st, p, cfg) {
  const E = st._engagement; return !!E && E.by === p.id && !(st.pass && st.pass.t >= E.t) && st.t - E.t < (cfg.coupEnvoi?.tenue ?? 6);
}
