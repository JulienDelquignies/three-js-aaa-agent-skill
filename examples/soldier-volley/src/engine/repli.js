// L'OBLIGATION DE REPLI (221, cfg.repli && st.full — déporté de match-sim ; doc : match-config.repli).
// Audit aval, constat 1 : « six joueurs de champ devant le ballon dans son propre camp — une équipe qui a
// renoncé ». Sondé : 244/267 corps restés devant la ligne du ballon après une perte étaient des MARQUEURS
// d'un appui de passe arrière (plafonnés à 5,6 m/s), 54 ne repassaient jamais derrière la ligne en 8 s.
// La loi (le filtre des marquables vit dans match-sim) : quand mon équipe n'a pas le ballon, tout joueur
// de champ DEVANT la ligne du ballon (côté but adverse, > marge) sauf les POINTES — axe tactique repli :
// round(axe(repli, 0, 2)) pointes, identité 1 — rentre en SPRINT (burst 'repli' : pointe ×1,28, exempt de
// l'allure qui le plafonnait au trot, voire à la marche loin de son poste) vers un point DERRIÈRE la ligne
// du ballon. L'engagement est une note : delai × (2 − workF) après la perte. Absente : l'hier au bit.
export function repliStep(st, cfg, { defenders, atk, pitch, tac, axe }) {
  const RP = cfg.repli, defTeam = atk === 0 ? 1 : 0;
  const sgD = Math.sign(pitch.ownGoal(defTeam).x || 1);   // sgD : vers MON but
  const marge = RP.marge ?? 2;
  const devantDe = (p) => (p.p[0] - st.ball.p[0]) * sgD < -marge;   // devant = plus loin de mon but que le ballon
  const nP = Math.round(axe(tac(st, defTeam).repli ?? 0.5, 0, 2));
  const cand = st._bRepli ??= []; cand.length = 0;
  for (const p of defenders) if (!p.keeper && p.down <= 0 && devantDe(p)) cand.push(p);
  cand.sort((a, b) => (a.p[0] - b.p[0]) * sgD);   // le plus DEVANT d'abord : les pointes gardent leur poste
  const depuis = st.t - (st._possChangeAt ?? -99);
  for (let k = nP; k < cand.length; k++) {
    const p = cand[k];
    if (p.job === 'press' || p.job === 'intercept' || p.job === 'cover' || p.job === 'receive' || p.job === 'walk' || p._sub) continue;   // un remplaçant en trajet (Loi 3) ou un marcheur de cérémonie n'est pas un défenseur en jeu
    if (depuis < (RP.delai ?? 0.4) * (2 - (p.skill?.workF ?? 1))) continue;
    const kind = (p._pace?.until ?? -1) > st.t ? p._pace.kind : null;
    if (kind && kind !== 'repli') continue;
    p._pace = { until: st.t + 0.5, kind: 'repli', next: p._pace?.next ?? st.t + 8 };
    if (!p.target || (p.target[0] - st.ball.p[0]) * sgD < marge) p.target = [st.ball.p[0] + sgD * marge * 1.5, 0, p.target ? p.target[2] : p.p[2]];
  }
}
