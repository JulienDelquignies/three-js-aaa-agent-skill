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
import { offsideLine } from './offside.js';

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
    // LE COMMANDEMENT (163) : le rayon du marquage de surface × commandF du GARDIEN de la
    // défense — le seul levier d'attribut qui agit sur LES AUTRES : le gardien qui commande
    // étend la zone où ses défenseurs prennent les corps ; 1 exact à 50/nu, au bit.
    const gkD = st.players.find((q) => q.keeper && q.team === def);
    const rayon = (MC.rayon ?? axe(tac(st, def).marquage, 7, 14)) * (gkD?.skill?.commandF ?? 1);
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

/**
 * L'ACCOMPAGNEMENT DE LA MONTÉE (lot 137, cfg.accompagne && st.full — retour utilisateur :
 * « devant ça manque de solution ; si un joueur monte avec le ballon il se retrouve vite
 * esseulé »). MESURÉ : pendant une montée (> 3 m/s soutenue), 0 coéquipier DEVANT le
 * porteur (p50, < 20 m), le soutien le plus proche à 14 m (7,7 posé) — le porteur monte à
 * 5-6 m/s, les soutiens trottent vers des slots à 3,4-3,9 : l'écart se creuse. LA LOI du
 * vrai foot : la montée DÉCLENCHE des courses — les DEUX mieux placés (un par couloir,
 * le rôle appel en facteur — JAMAIS un corps déjà devant : les pointes gardent LEUR course,
 * l'apparié a chargé le rappel des avancés) sprintent À HAUTEUR (+7 m, ±couloir), en burst
 * (_pace 'accompagne' — l'exemption d'allure existante) ; l'axe transition module le
 * volume (contre → 2, conservation → 1). Mémo 0,4 s. false : l'esseulé d'hier.
 */
export function accompagneMontee(st, cfg, { tac, axe, role }) {
  if (!(st.full && cfg.accompagne !== false && !st.restart)) { st._montee = null; return; }
  const c = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
  if (!c || c.keeper) { st._montee = null; return; }
  const g = st.pitch.attackGoal(c.team), sg = Math.sign(g.x || 1);
  const vAv = (c.v[0] ?? 0) * sg;
  const AC = cfg.accompagne === true || cfg.accompagne == null ? {} : cfg.accompagne;
  if (vAv > (AC.seuil ?? 3)) { if (!st._montee || st._montee.id !== c.id) st._montee = { id: c.id, t0: st.t, memo: 0 }; }
  else { st._montee = null; return; }
  const M = st._montee;
  if (st.t - M.t0 < (AC.tenu ?? 0.6)) return;                     // la montée se PROUVE avant d'appeler
  if (st.t - M.memo < 0.4) { for (const e of M.ids ?? []) relance(st, e.id, c, sg, AC, e.ov); return; }
  M.memo = st.t;
  const n = Math.max(1, Math.round(1.5 + axe(tac(st, c.team).transition, -0.5, 0.5)));
  const cands = st.players.filter((q) => q.team === c.team && !q.keeper && q.down <= 0 && !q.act
    && q.id !== c.id && (q.p[0] - c.p[0]) * sg > -12 && (q.p[0] - c.p[0]) * sg < (AC.devant ?? 7) + 2
    && Math.abs(q.p[2] - c.p[2]) < 26)
    .map((q) => ({ q, s: -Math.hypot(q.p[0] - c.p[0], q.p[2] - c.p[2]) + axe(role(q).appel, -4, 4) }))
    .sort((a, b) => b.s - a.s);
  const pris = [];
  for (const { q } of cands) {                                     // un par CÔTÉ — le porteur a deux couloirs
    const cote = Math.sign(q.p[2] - c.p[2] || 1);
    if (pris.some((p2) => p2.cote === cote)) continue;
    pris.push({ id: q.id, cote });
    if (pris.length >= n) break;
  }
  // L'OVERLAP DE DÉPASSEMENT (lot 138, AC.overlap — la dette du 137 : le « devant profond »).
  // Porteur EXCENTRÉ (|z| > bord) qui monte : le candidat de SON côté ne vient pas à hauteur,
  // il le DOUBLE côté TOUCHE (+devant m, le couloir extérieur) — le latéral dans le dos de
  // l'ailier porteur. L'élection pèse le rôle largeurR (le piston vit pour ça) ; burst long,
  // événement 'burst' kind 'overlap' (le ticker et la clause le lisent). overlap:false : hier.
  if (AC.overlap !== false && Math.abs(c.p[2]) > (AC.overlap?.bord ?? 8) && pris.length) {
    const zS = Math.sign(c.p[2] || 1);
    const ext = pris.find((p2) => p2.cote === zS);                 // le coureur du côté touche
    if (ext) {
      const q = st.players[ext.id];
      const wR = axe(role(q).largeurR, 0, 2);                      // le piston/latéral (largeurR 1,3 → ×1,6) double, l'intérieur accompagne
      if (wR >= 1) {
        ext.overlap = true;
        if ((M.ovEv ?? 0) < st.t - 3) { M.ovEv = st.t; st.events.push({ t: +st.t.toFixed(2), type: 'burst', kind: 'overlap', by: q.id }); }
      }
    }
  }
  M.ids = pris.map((p2) => ({ id: p2.id, ov: !!p2.overlap }));
  for (const e of M.ids) relance(st, e.id, c, sg, AC, e.ov);
}
function relance(st, id, c, sg, AC, ov = false) {
  const q = st.players[id];
  if (!q || q.down > 0 || q.act) return;
  const cote = Math.sign(q.p[2] - c.p[2] || 1);
  q.job = 'receive';   // l'accompagnement est une COURSE : le plafond de chasse (support capait à 4,4 — le porteur file à 5,5+)
  q.target = ov
    ? [c.p[0] + sg * (AC.overlap?.devant ?? 16), 0,
      Math.sign(c.p[2] || 1) * Math.min(st.pitch.hz - 2, Math.abs(c.p[2]) + (AC.overlap?.large ?? 6))]
    : [c.p[0] + sg * (AC.devant ?? 7), 0, c.p[2] + cote * (AC.couloir ?? 10)];
  q._pace ??= { until: -1, next: 0 };
  if (q._pace.until < st.t + 0.3) { q._pace.until = st.t + (ov ? 1.6 : 1.2); q._pace.kind = ov ? 'overlap' : 'accompagne'; }
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

/** LE BOX CRASH (lot 123, déporté du match au 182b) — POST-PASS d'autorité : la géométrie du
 *  centre REMPLIT la surface (N plus proches + rôle appel, soutien épargné, Loi 11, cache
 *  0,6 s), et depuis 182b LES CORPS ATTAQUENT LE VOL (l'attaque du centre, cfg.boxCrash.attaque
 *  — filmé : les postes étaient STATIQUES, le centre croisait un corps de boîte à 0,8 m et se
 *  perdait ; seul le receveur attitré courait au ballon). Absente : hier. */
export function boxCrashStep(st, cfg, { busy, tac, axe, role, d2 }) {
  const pitch = st.pitch;
  if (st.full && cfg.boxCrash && !st.restart && st.possession.team >= 0) {
    const atk = st.possession.team;
    const g2 = pitch.attackGoal(atk), sg2 = Math.sign(g2.x || 1), zB = st.ball.p[2];
    const bc = (st._boxCrash ??= {});
    if ((bc[atk]?.t ?? -1) < st.t - 0.6) {
      const geo = Math.abs(zB) > pitch.hz * (cfg.boxCrash.couloir ?? 0.4)
        && st.ball.p[0] * sg2 > pitch.hx - pitch.dims.box.depth - (cfg.boxCrash.prof ?? 18);
      if (geo) {
        const n = Math.max(2, Math.min(4, Math.round(3 + axe(tac(st, atk).hauteur, -1, 1))));
        const bx = g2.x - sg2 * 9;
        const cands = st.players.filter((q) => q.team === atk && !q.keeper && q.down <= 0
          && q.id !== st.possession.carrier && q.job !== 'press' && q.job !== 'intercept'
          && d2(q.p, st.ball.p) > (cfg.boxCrash.garde ?? 12))
          .map((q) => ({ id: q.id, s: -Math.hypot(q.p[0] - bx, q.p[2]) + axe(role(q).appel, -3, 3) }))
          .sort((x, y) => y.s - x.s).slice(0, n).map((x) => x.id);
        bc[atk] = { t: st.t, ids: cands, zC: Math.sign(zB || 1) };
      } else bc[atk] = { t: st.t, ids: [], zC: 1 };
    }
    // …LE PLONGEON SEUL en défaut (le statique DIVISAIT les buts par 2, A/B apparié) : le crash ne vit qu'au VOL ; attente = l'opt-in payant.
    const E = bc[atk], offL = cfg.offside ? offsideLine(st, atk) : null;
    if (E?.ids?.length) {
      const vol = st.pass && st.pass.cross && st.players[st.pass.from]?.team === atk;
      if (vol || cfg.boxCrash.attente) {
        const g3 = pitch.attackGoal(atk), sg3 = Math.sign(g3.x || 1), zC = E.zC;
        const P = vol
          ? [[g3.x - sg3 * 5.5, zC * 3.4], [g3.x - sg3 * 11, -zC * 1], [g3.x - sg3 * 6.5, -zC * 4.5], [g3.x - sg3 * 16, zC * 2]]
          : [[g3.x - sg3 * 18, zC * 5], [g3.x - sg3 * 19.5, -zC * 1], [g3.x - sg3 * 18, -zC * 7], [g3.x - sg3 * 22, zC * 3]];
        const AT = vol && cfg.boxCrash.attaque ? cfg.boxCrash.attaque : null;   // clé absente : les statues d'hier au bit
        const vB = AT ? Math.hypot(st.ball.v[0], st.ball.v[2]) : 0;
        for (let k = 0; k < E.ids.length; k++) {
          const q = st.players[E.ids[k]];
          if (!q || q.down > 0 || busy(q) || st.possession.carrier === q.id) continue;
          if (vol && q.id === st.pass.to) continue;   // le RECEVEUR du centre court au point de chute, jamais au poteau (5/17 vs 12/27 mesurés sans l'exemption)
          q.job = 'support';
          // …L'ATTAQUE DU CENTRE (182b) : le poste est un point de DÉPART, pas une statue — le
          // corps dont le rai du vol passe à portée de pas ATTAQUE le point d'interception qu'il
          // peut tenir avant le ballon (filmé : des centres croisaient un corps de boîte à 0,8 m,
          // muets — seul le receveur attitré courait). La lecture se paie à la note (reaction ×
          // (2 − anticipF), le patron du lecteur 168) ; attaque:false = les statues d'hier.
          if (AT && vB > 1 && st.t - st.pass.t > (q.skill?.reaction ?? 0.18) * (2 - (q.skill?.anticipF ?? 1))) {
            const ux = st.ball.v[0] / vB, uz = st.ball.v[2] / vB;
            const along = (q.p[0] - st.ball.p[0]) * ux + (q.p[2] - st.ball.p[2]) * uz;
            if (along > 0.5) {
              const cX = st.ball.p[0] + ux * along, cZ = st.ball.p[2] + uz * along;
              const dMoi = Math.hypot(q.p[0] - cX, q.p[2] - cZ);
              if (dMoi < (AT.porte ?? 2.5) && dMoi / 6.4 < along / vB + 0.1) {
                q.target = [cX, 0, cZ];
                continue;
              }
            }
          }
          const px = offL ? offL.sgn * Math.min(P[k][0] * offL.sgn, offL.adv - 0.15) : P[k][0];
          q.target = [px, 0, P[k][1]];
        }
      }
    }
  }
}
