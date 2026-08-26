// phases.js — LES QUATRE MOMENTS DU JEU, en pur. Le football collectif ne se lit pas sur la
// phase du BALLON (carry/flight/loose — le moteur l'a depuis le rondo) mais sur le moment de
// l'ÉQUIPE : attaque placée, défense placée, transition offensive, transition défensive — plus
// l'arrêt de jeu. C'est le SOCLE de la tactique : une tactique sans moments n'a pas de
// « quand », un rôle sans moments n'a pas de « pendant quoi ».
//
// La dérivation est VOLONTAIREMENT simple (v1) : qui a le ballon, et depuis combien de temps.
// Une transition est jeune (< win s depuis le changement de possession — les 5-6 secondes où le
// football se joue : le bloc adverse est déformé) ; passé la fenêtre, le jeu est PLACÉ. Le
// raffinement par la géométrie (une transition murée redevient placée tôt) est une dette nommée.
//
// L'horloge du regain (st._possChangeAt, st._possTeam) est TENUE par le match (assignMatchJobs,
// cfg.moments) — la dérivation, elle, est pure : un état entre, un moment sort, testable au banc.

/**
 * Le moment de `team`, du point de vue du football collectif.
 * @returns 'attaque-placée' | 'transition-off' | 'défense-placée' | 'transition-def' | 'arrêt'
 */
export function momentDuJeu(st, team, win = 5) {
  if (st.restart) return 'arrêt';
  const poss = st.possession.team >= 0 ? st.possession.team : st.lastTouch;
  if (poss !== 0 && poss !== 1) return 'arrêt';
  const depuis = st.t - (st._possChangeAt ?? -99);
  if (poss === team) return depuis < win ? 'transition-off' : 'attaque-placée';
  return depuis < win ? 'transition-def' : 'défense-placée';
}

/**
 * LE MARQUAGE DE SURFACE SUR CENTRE (lot 133, cfg.marquageCentre && st.full — retour
 * utilisateur : « les centres manquent de défenses sur les attaquants de surface »).
 * Mesuré avant : 53 % des attaquants de boîte LIBRES (> 3 m) à l'arrivée du centre malgré
 * un surnombre défensif de 2,6 corps — la défense tenait des ZONES, pas des corps ; et 0
 * dégagement défensif sur 17 centres. La loi du vrai foot : pendant le VOL d'un centre
 * adverse, chaque défenseur proche PREND l'attaquant de boîte le plus proche non pris —
 * cible GOAL-SIDE (0,8 m côté but), MAX 2 corps pris, et le marquage vit PENDANT LE VOL —
 * la RÉMANENCE après la retombée est un OPT-IN (le contrat du 123 rejoué : l'A/B APPARIÉ
 * mêmes graines a chargé la causalité — la rémanence 0,6-1,0 s coûtait 5-8 buts et jusqu'à
 * 23 % des tirs, la boîte densifiée ferme les couloirs de frappe, bande 17-33 crevée à
 * 10-15/20 ; le vol-seul tient la bande à 18). marquageCentre: { remanence: 0.6+ } =
 * l'équipe défensive qui PAIE en menace propre. Rayon = axe marquage (7-14) ;
 * presseurs/intercepteurs/receveurs gardent leur métier. false : les statues de zone.
 * Appelée par le match APRÈS l'assignation des jobs (l'autorité du marquage sur le spot).
 */
export function marquageCentre(st, cfg, { busy, tac, axe, d2 }) {
  if (!(st.full && cfg.marquageCentre !== false && !st.restart)) { st._marquage = null; return; }
  const MC = cfg.marquageCentre === true || cfg.marquageCentre == null ? {} : cfg.marquageCentre;
  const vol = st.pass && st.pass.cross;
  if (vol) {
    const atk = st.players[st.pass.from]?.team;
    if (atk == null) return;
    const def = atk === 0 ? 1 : 0;
    const gD = st.pitch.ownGoal(def), sgD = Math.sign(gD.x || 1);
    const rayon = MC.rayon ?? axe(tac(st, def).marquage, 7, 14);
    const boite = (q) => q.p[0] * sgD > (Math.abs(gD.x) - st.pitch.dims.box.depth - 2)
      && Math.abs(q.p[2]) < st.pitch.dims.box.width / 2 + 2;
    const cibles = st.players.filter((q) => q.team === atk && !q.keeper && q.down <= 0 && boite(q))
      .sort((a, b) => Math.abs(a.p[0] - gD.x) - Math.abs(b.p[0] - gD.x));   // le plus dangereux (près du but) se prend d'abord
    const pris = new Set(), pairs = [];
    for (const cible of cibles.slice(0, MC.max ?? 2)) {
      let best = null, bd = rayon;
      for (const m of st.players) {
        if (m.team !== def || m.keeper || m.down > 0 || pris.has(m.id) || busy(m)) continue;
        if (m.job === 'press' || m.job === 'intercept' || m.job === 'receive') continue;
        const dm = d2(m.p, cible.p);
        if (dm < bd) { bd = dm; best = m; }
      }
      if (!best) continue;
      pris.add(best.id);
      pairs.push([best.id, cible.id]);
    }
    // LA RÉMANENCE (opt-in — 0 au défaut : appariée, elle coûtait 5-8 buts) : les paires
    // consignées pour survivre à la retombée SI l'équipe la paie (MC.remanence > 0)
    st._marquage = { until: st.t + (MC.remanence ?? 0), pairs, sgD, gs: MC.goalSide ?? 0.8, vol: true };
  }
  const M = st._marquage;
  if (M && !vol) M.vol = false;
  if (!M || (!M.vol && st.t >= M.until)) { if (M) st._marquage = null; return; }
  for (const [mid, cid] of M.pairs) {
    const m = st.players[mid], cible = st.players[cid];
    if (!m || !cible || m.down > 0 || cible.down > 0 || busy(m)) continue;
    m.job = 'mark';
    m.target = [cible.p[0] + M.sgD * M.gs, 0, cible.p[2] + (0 - cible.p[2]) * 0.08];
  }
}

/**
 * L'INTERCEPTEUR DU MATCH (lot 134, cfg.interception && st.full — retour utilisateur : « le
 * plus proche ne prête pas attention au ballon libre »). FILMÉ : un presseur à 1,0 m d'une
 * passe adverse LENTE qui roule 3 s sans que personne la vole — le rondo a son intercepteur
 * depuis toujours (son assignJobs), le match ne l'avait JAMAIS porté. Pendant le vol d'une
 * passe adverse basse (< 1,4 m) : le défenseur qui GAGNE le chemin (interceptPoint, slack >
 * 0,05) y va — UN seul, après SA latence de perception (lot 50, skill.reaction en facteur),
 * sans traverser le terrain (≤ rayon 8 m du point), mémoïsé 0,25 s (une lecture du monde,
 * pas un tremblement à 60 Hz). false : les spectateurs de couloir d'hier.
 */
export function intercepteurVol(st, cfg, { busy, predictPath, interceptPoint, defenders, atk }) {
  if (!(st.full && cfg.interception !== false && st.phase === 'flight' && st.pass && st.pass.to >= 0
    && !st.restart && st.players[st.pass.from]?.team === atk && st.ball.p[1] < 1.4)) return;
  const IC = cfg.interception === true || cfg.interception == null ? {} : cfg.interception;
  if (!st._ic || st._icPass !== st.pass || st.t - st._ic.t > 0.25) {
    const path = predictPath(st.ball, { dt: 1 / 20, maxT: 1.6 });
    let best = null;
    for (const q of defenders) {
      if (q.down > 0 || q.keeper || busy(q) || (st.t - st.pass.t) < (q.skill?.reaction ?? 0.18)) continue;
      const i = interceptPoint(path, q.p, cfg.speeds.chase, { reaction: 0, maxHeight: 1.2 });
      if (!i || i.slack <= (IC.slack ?? 0.05)) continue;
      if (Math.hypot(i.p[0] - q.p[0], i.p[2] - q.p[2]) > (IC.rayon ?? 8)) continue;
      if (!best || i.slack > best.i.slack) best = { q, i };
    }
    st._ic = best ? { t: st.t, id: best.q.id, p: [best.i.p[0], best.i.p[2]] } : { t: st.t, id: -1 };
    st._icPass = st.pass;
  }
  if (st._ic.id >= 0) {
    const q = st.players[st._ic.id];
    if (q && q.down <= 0 && !busy(q)) { q.job = 'intercept'; q.target = [st._ic.p[0], 0, st._ic.p[1]]; }
  }
}

/** Le contrat des moments — les symétries qui ne peuvent pas mentir. */
export function checkMoments() {
  const issues = [];
  const mk = (poss, depuis, restart = null) => ({
    restart, possession: { team: poss }, lastTouch: Math.max(0, poss), t: 100, _possChangeAt: 100 - depuis,
  });
  if (momentDuJeu(mk(0, 1), 0) !== 'transition-off') issues.push('un regain d\'une seconde n\'est pas une transition offensive');
  if (momentDuJeu(mk(0, 1), 1) !== 'transition-def') issues.push('la perte MIROIR n\'est pas une transition défensive');
  if (momentDuJeu(mk(0, 9), 0) !== 'attaque-placée') issues.push('9 s de possession ne sont pas une attaque placée');
  if (momentDuJeu(mk(0, 9), 1) !== 'défense-placée') issues.push('le miroir placé ne tient pas');
  if (momentDuJeu(mk(0, 1, { type: 'touche' }), 0) !== 'arrêt') issues.push('une remise en jeu n\'est pas un arrêt');
  // la fenêtre est un PARAMÈTRE, pas une constante cachée
  if (momentDuJeu(mk(0, 4), 0, 3) !== 'attaque-placée') issues.push('la fenêtre win n\'est pas honorée');
  return { ok: issues.length === 0, issues };
}
