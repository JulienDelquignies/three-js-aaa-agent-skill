// duel.js — LES DUELS DE CORPS SUR PORTEUR (lot 33 : la volumétrie est une dette comme une
// autre — rondo-sim crevait le plafond de 1 250 à 1 263). La FAMILLE est cohésive : la CHARGE
// D'ÉPAULE (lot 32) et le TACLE GLISSÉ SUR PORTEUR (lot 33) — les deux paris physiques joués
// AU CORPS du porteur, résolus à la géométrie et au jet seedé, qui nourrissent l'arbitre de la
// Loi 12. Le tacle-debout et le glissé sur ballon LIBRE restent dans rondo-sim (ils appellent
// receive — les sortir ferait un cycle ; le sens d'import reste acyclique : rondo-sim → duel).
// AUCUN comportement ne change : la batterie au bit près est LA preuve.
import { situation, chooseTechnique } from './technique.js';
import { winding, abortGesture } from './gesture.js';

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** Un refus a une cause nommée (copie locale du registre du loop — le patron referee). */
const deny = (st, cause) => { (st.deny ??= {})[cause] = (st.deny[cause] ?? 0) + 1; return false; };

/**
 * LE TACLE GLISSÉ SUR PORTEUR (cfg.slideTackle && st.full — lot 33). Le glissé sur ballon
 * LIBRE vit plus bas (le plongeon d'un ballon qui traîne) ; ICI c'est le pari du DERNIER
 * RECOURS sur un homme lancé : un poursuivant à pleine vitesse qui ne fermera pas debout se
 * couche pour le ballon. La résolution est la GÉOMÉTRIE RÉELLE de l'instant (la table
 * technique, patron standTackleNow) : le ballon dans la fenêtre du tacle-glissé → PRIS
 * (dégagé fort — et le tacleur est AU SOL, gagné ou perdu : ce coût EST la décision) ; le
 * ballon protégé mais les JAMBES trouvées → FAUTE (la victime TOMBE ; PAR DERRIÈRE c'est
 * grave — la récidive compte double, le jaune vient vite) ; rien → la glissade dans le
 * vide, le porteur file. Anti-spam : cooldown du glissé partagé (slideCooldown) + espacement
 * d'équipe (st._slideT — un seul corps au sol par ballon).
 */
export function slideTackleStep(st, c, cfg) {
  const S = cfg.slideTackle;
  // le DERNIER RECOURS : on ne se couche que sur un porteur LANCÉ (une construction lente se
  // défend debout — sans cette porte : 20,8 glissés/match mesurés, la fête du tacle)
  if (Math.hypot(c.v[0], c.v[1]) < (S.carrySpeed ?? 4)) return;
  const bp = st.ball.p;
  const foe = st.players.filter((q) => q.team !== c.team && !q.keeper && q.down <= 0 && !q.act
    && (q.slideCd ?? 0) <= st.t && Math.hypot(q.v[0], q.v[1]) >= (S.speed ?? 4.2))
    .filter((q) => {
      const d = d2(q.p, bp);
      if (d < (S.at?.[0] ?? 1.3) || d > (S.at?.[1] ?? 2.6)) return false;
      const vq = Math.hypot(q.v[0], q.v[1]);
      return ((bp[0] - q.p[0]) * q.v[0] + (bp[2] - q.p[2]) * q.v[1]) / (d2(q.p, bp) * vq || 1) > 0.5;
    })
    .sort((a, b) => d2(a.p, bp) - d2(b.p, bp))[0];
  if (!foe) return;
  if (st.t - ((st._slideT ??= {})[foe.team] ?? -99) < 6) return;
  foe.slideCd = st.t + cfg.slideCooldown;
  st._slideT[foe.team] = st.t;
  foe.down = cfg.slideRecovery * (0.9 + 0.2 * (st.rnd ? st.rnd() : 0.5));
  const sit = situation(foe.p, foe.yaw, bp, st.ball.v, bp[1]);
  const pick = chooseTechnique(sit, 'win', { bias: { 'tacle-glisse': 1 } })[0];
  // la géométrie VALIDE ne suffit pas : le glissé est un PARI (accuracy de la table 0,6,
  // modulée par la note tackling ±0,2) — sans le jet, 83 glissés sur 83 prenaient le ballon
  // et glisser était strictement optimal ; le RATÉ est ce qui produit fautes et vides
  const roll = st.rnd ? st.rnd() : 0.5;
  const won = !!pick && pick.tech.id === 'tacle-glisse'
    && roll < (pick.tech.accuracy ?? 0.6) + (foe.skill ? foe.skill.tackleReach * 2 : 0);
  if (won) {
    // le ballon est PRIS : dégagé dans la course du tacleur (une frappe du sol, pas une prise)
    if (c.act && winding(c)) abortGesture(c, 'fauché', { log: st.gestures });
    st.events.push({ t: +st.t.toFixed(2), type: 'slide', by: foe.id, won: true, tech: 'tacle-glisse',
      foot: pick.foot, surface: pick.surface, team: foe.team, atk: c.team, sur: c.id, dist: +sit.dist.toFixed(2) });
    const vq = Math.hypot(foe.v[0], foe.v[1]) || 1;
    st.ball.release('contesté');
    st.ball.impulse([(foe.v[0] / vq) * 3.2, 0.4, (foe.v[1] / vq) * 3.2]);
    st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
    return;
  }
  const dBody = d2(foe.p, c.p);
  if (dBody < (S.body ?? 1.1)) {
    // les jambes avant le ballon : la FAUTE — la victime TOMBE, et par DERRIÈRE c'est GRAVE
    const vSpd = Math.hypot(c.v[0], c.v[1]);
    const grave = vSpd > 1.5 && ((c.p[0] - foe.p[0]) * c.v[0] + (c.p[2] - foe.p[2]) * c.v[1]) / (dBody * vSpd || 1) > 0.55;
    if (c.act && winding(c)) abortGesture(c, 'fauché', { log: st.gestures });
    c.down = S.trip ?? 0.7;
    st.events.push({ t: +st.t.toFixed(2), type: 'slide', by: foe.id, won: false, tech: 'tacle-glisse', team: foe.team, atk: c.team, sur: c.id, faute: true });
    if (cfg.loi12 && !st._faute) {
      st._faute = { t: st.t, par: foe.id, sur: c.id, team: c.team, p: [c.p[0], c.p[2]], grave };
      st.events.push({ t: +st.t.toFixed(2), type: 'faute', by: foe.id, sur: c.id, kind: grave ? 'tacle-glissé-derrière' : 'tacle-glissé', p: [+c.p[0].toFixed(1), +c.p[2].toFixed(1)] });
    }
    // le fauché ne porte plus rien : ballon lâché à ses pieds, monde en loose (la discipline
    // du porteur couché ET celle du ballon possédé — l'arbitre sifflera par-dessus)
    st.ball.release('perte');
    st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
    return;
  }
  // la glissade dans le vide : le porteur file, le pari est perdu au sol
  deny(st, 'glissé-dans-le-vide');
  st.events.push({ t: +st.t.toFixed(2), type: 'slide', by: foe.id, won: false, tech: 'tacle-glisse', team: foe.team, atk: c.team, dist: +sit.dist.toFixed(2) });
}

/**
 * LA CHARGE D'ÉPAULE (cfg.charge && st.full — lot 32). Le duel de CORPS, distinct du tacle
 * (qui joue le BALLON) : un défenseur au corps du porteur (< dist) accumule une horloge de
 * charge ; pleine, la charge SE JOUE. Par DERRIÈRE un porteur lancé : FAUTE (Loi 12 — la
 * détection pose le fait, l'arbitre l'adjuge : avantage, coup franc, cartons). De côté ou de
 * face : duel LOYAL — force contre force (note strength, l'élan du chargeur pèse, st.rnd
 * seedé ; base 42 % : protéger son ballon est un métier). Gagné : le ballon JAILLIT
 * (release('contesté') + poussée latérale — le 50/50 vit par la machinerie loose existante).
 * Perdu : le chargeur REBONDIT (levier natif _bite : sa pointe s'assoit 0,45 s). Jamais sur
 * le gardien porteur (charger le gardien est une faute réelle — v1 : on ne charge pas).
 */
export function chargeStep(st, c, dt, cfg) {
  if (c.keeper) return;
  const B = cfg.charge;
  const foe = st.players.filter((q) => q.team !== c.team && !q.keeper && q.down <= 0 && !q.act
    && d2(q.p, c.p) < (B.dist ?? 0.85) && (q._chgCd ?? 0) <= st.t)
    .sort((a, b) => d2(a.p, c.p) - d2(b.p, c.p))[0];
  if (!foe) { st._chgT = 0; return; }
  st._chgT = (st._chgT ?? 0) + dt;
  if (st._chgT < (B.time ?? 0.4)) return;
  st._chgT = 0;
  foe._chgCd = st.t + (B.cd ?? 2.5);
  // l'angle du délit : DERRIÈRE n'est pas une faute — la FILATURE est le métier du défenseur
  // (première version : 33 fautes / 9 min, toutes « par derrière », des 0-0 étouffés au
  // sifflet — l'ombre de poursuite criminalisée). La faute par derrière est le PERCUTAGE :
  // dans le dos, AU CONTACT (< 0,55 m) et en SURVITESSE (il lui rentre dedans, +0,6 m/s).
  const vSpd = Math.hypot(c.v[0], c.v[1]);
  const dxp = c.p[0] - foe.p[0], dzp = c.p[2] - foe.p[2];
  const dp = Math.hypot(dxp, dzp) || 1;
  const behind = vSpd > 1.5 && (dxp * c.v[0] + dzp * c.v[1]) / (dp * vSpd) > 0.55;
  if (behind) {
    // la vitesse D'ENTRÉE (projetée chargeur→porteur) : un crash, pas un pas plus vite —
    // à +0,6 de survitesse brute il restait 16 fautes / 9 min (réel ≈ 2,5)
    const vInto = (dxp * foe.v[0] + dzp * foe.v[1]) / dp;
    if (dp < 0.5 && vInto > vSpd + 0.8 && cfg.loi12 && !st._faute) {
      st._faute = { t: st.t, par: foe.id, sur: c.id, team: c.team, p: [c.p[0], c.p[2]] };
      st.events.push({ t: +st.t.toFixed(2), type: 'faute', by: foe.id, sur: c.id, kind: 'charge-derrière', p: [+c.p[0].toFixed(1), +c.p[2].toFixed(1)] });
    } else {
      st._chgT = (B.time ?? 0.4) * 0.5;                           // la filature ré-arme, sans événement
      foe._chgCd = st.t + 0.5;
    }
    return;
  }
  // …et l'ÉLAN DU PORTEUR PÈSE CONTRE (un homme lancé se charge mal — sans ce terme, 11
  // ballons jaillis / 12 min étouffaient l'attaque : tirs 5 → 2,25 par match mesurés)
  const edge = ((foe.skill?.chargeF ?? 1) - (c.skill?.chargeF ?? 1)) * 0.5
    + Math.min(0.15, Math.hypot(foe.v[0], foe.v[1]) * 0.02)
    - Math.min(0.14, vSpd * 0.022);
  const won = (st.rnd ? st.rnd() : 0.5) < 0.40 + edge;
  st.events.push({ t: +st.t.toFixed(2), type: 'duel', by: foe.id, won, kind: 'épaule', sur: c.id });
  if (!won) { foe._bite = st.t + 0.45; return; }
  // l'épaule a gagné : le ballon jaillit du pied — latéral à la course, côté seedé
  if (c.act && winding(c)) abortGesture(c, 'chargé', { log: st.gestures });
  const side = (st.rnd ? st.rnd() : 0.5) < 0.5 ? 1 : -1;
  const ux = vSpd > 0.5 ? c.v[0] / vSpd : Math.cos(c.yaw), uz = vSpd > 0.5 ? c.v[1] / vSpd : Math.sin(c.yaw);
  st.ball.release('contesté');
  // …une bousculade, pas une passe à l'adversaire : le ballon s'écarte PEU (1,4 m/s — à
  // 2,2 le 50/50 tournait turnover un coup sur deux : tirs 5 → 2,3/match, l'attaque étouffée)
  st.ball.impulse([-uz * side * 1.4 + ux * 0.8, 0, ux * side * 1.4 + uz * 0.8]);
  st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
}
