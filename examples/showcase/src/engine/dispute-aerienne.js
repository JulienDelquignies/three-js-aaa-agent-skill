// dispute-aerienne.js — LE LONG BALLON SE DISPUTE (lot 374, cfg.disputeAerienne — T7 du chantier tactique ; B15 du livre : 38-50 duels
// aériens par match, le défenseur central gagne 55,7 % — 65-70 % pour les DC —, le vainqueur ne récupère le second ballon que 45 % au
// milieu). Sondé (30 min) : 61 ballons en l'air (passes lofted et dégagements), 35 sur 56 atterris SANS AUCUN adversaire à moins de 3 m
// du toucheur, 27 contrôlés tranquillement par le coéquipier (à 1,1 m) — 7 duels aériens par match. Cause : l'intercepteur du match
// (phases.intercepteurVol, lot 134) ne lit que les passes BASSES (< 1,4 m, points jouables ≤ 1,2 m, rayon 8 m) ; aucun défenseur n'allait
// au point de chute d'un ballon aérien.
// La loi : pendant le vol d'une passe EN L'AIR adverse (lofted, chip ou dégagement — le centre a sa loi, marquageCentre), le défenseur qui
// peut ATTEINDRE le point de chute (temps de course ≤ le vol restant + marge s, ≤ rayon m) y va, CÔTÉ BUT du receveur (decal m) — un seul,
// mémoïsé 0,25 s — même en retard (marge 3 s : il dispute au moins le second ballon ; à 0,6 s, 20 cas sur 67 et le défenseur à 6 m au
// toucher ; à 3 s, à 3,4 m, têtes et duels aériens ×2) ; le duel aérien et le second ballon se jouent ensuite par les lois de tête existantes (tete.js). Absente : hier au bit.
const hyp = Math.hypot;

export function disputeAerienneStep(st, cfg, K, { busy, defenders, atk }) {
  const P = st.pass;
  if (!P || P.cross || st.restart || st.phase !== 'flight' || st.players[P.from]?.team !== atk) { st._da = null; return; }
  const aerien = P.style === 'lofted' || P.style === 'chip' || P.clear || st.ball.p[1] > (K.hMin ?? 1.6);
  if (!aerien || !P.lead) { st._da = null; return; }
  const tRest = Math.max(0, (P.flight ?? 1.5) - (st.t - P.t));
  if (!st._da || st._da.pass !== P || st.t - st._da.t > 0.25) {
    // …ON ATTAQUE L'HOMME, PAS LE POINT (sondé, v1 au point de chute : le défenseur désigné à 6,5 m du ballon au premier toucher — le
    // receveur va AU-DEVANT de sa passe et la prend à ~1,1 m avant le point visé) : la cible est le receveur, là où il va (sa cible de
    // réception), côté but ; sans receveur (le dégagement), le point de chute.
    const R = P.to >= 0 ? st.players[P.to] : null, L = R ? (R.target ? [R.target[0], 0, R.target[2]] : R.p) : P.lead, g = st.pitch.ownGoal(1 - atk);
    let best = null;
    for (const q of defenders) {
      if (q.down > 0 || q.keeper || busy(q) || st.t - P.t < (q.skill?.reaction ?? 0.18)) continue;
      const d = hyp(L[0] - q.p[0], L[2] - q.p[2]); if (d > (K.rayon ?? 25)) continue;
      const tq = d / ((cfg.speeds?.chase ?? 6.4) * (q.skill?.topF ?? 1));
      if (tq > tRest + (K.marge ?? 0.6)) continue;
      if (!best || tq < best.tq) best = { q, tq };
    }
    let cible = null;
    if (best) { const ref = L, gx = g.x - ref[0], gz = 0 - ref[2], gl = hyp(gx, gz) || 1, dc = K.decal ?? 0.8;
      cible = [L[0] + (gx / gl) * dc, L[2] + (gz / gl) * dc]; }
    st._da = { pass: P, t: st.t, id: best ? best.q.id : -1, cible };
  }
  if (st._da.id >= 0) { const q = st.players[st._da.id]; if (q && q.down <= 0 && !busy(q)) { q.job = 'intercept'; q.target = [st._da.cible[0], 0, st._da.cible[1]]; } }
}
