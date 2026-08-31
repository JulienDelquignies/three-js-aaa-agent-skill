// duel.js — LES DUELS DE CORPS SUR PORTEUR (lot 33 : la volumétrie est une dette comme une
// autre — rondo-sim crevait le plafond de 1 250 à 1 263). La FAMILLE est cohésive : la CHARGE
// D'ÉPAULE (lot 32) et le TACLE GLISSÉ SUR PORTEUR (lot 33) — les deux paris physiques joués
// AU CORPS du porteur, résolus à la géométrie et au jet seedé, qui nourrissent l'arbitre de la
// Loi 12. Le tacle-debout et le glissé sur ballon LIBRE restent dans rondo-sim (ils appellent
// receive — les sortir ferait un cycle ; le sens d'import reste acyclique : rondo-sim → duel).
// AUCUN comportement ne change : la batterie au bit près est LA preuve.
import { situation, chooseTechnique } from './technique.js';
import { winding, abortGesture } from './gesture.js';
import { predictPath } from './ball-predict.js';
import { role } from './roles.js';

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** L'ÉCART DU BALLON AU RAYON DE GLISSE (lot 66) — le corps part DROIT dans sa course : si cette
 *  droite ne passe pas au ballon (cible instantanée ou prédite), le pied ne peut pas l'atteindre.
 *  Lu DEBOUT par les deux déclencheurs (porteur ici, ballon libre dans rondo-sim) : une glisse qui
 *  ne passe pas au ballon ne part pas — mesuré avant : 14 ratés secs/6 matchs, le corps couché à
 *  plus d'un mètre d'un ballon assis. */
export function ecartCouloir(p, bp, portee = 2.6) {
  const v = Math.hypot(p.v[0], p.v[1]), dx = v > 0.5 ? p.v[0] / v : Math.cos(p.yaw), dz = v > 0.5 ? p.v[1] / v : Math.sin(p.yaw);
  const rx = bp[0] - p.p[0], rz = bp[2] - p.p[2], al = Math.max(0.35, Math.min(portee, rx * dx + rz * dz));
  return Math.hypot(rx - al * dx, rz - al * dz);
}

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
  // LA RETENUE DE SURFACE (169b, cfg.retenueSurface) : on ne se COUCHE pas dans sa surface —
  // le pari du glissé y coûte un penalty. L'épisode se décide UNE fois (le cooldown d'équipe
  // est consommé par le refus : il a CHOISI de rester debout) ; l'agressif (aggrF) se couche
  // quand même — la note fait le penalty. Clé absente : le pari d'hier au bit.
  if (st.full && cfg.retenueSurface
    && st.pitch.inBox(foe.p[0], foe.p[2], Math.sign(st.pitch.ownGoal(foe.team).x || 1))
    && (st.rnd2 ?? st.rnd ?? (() => 0.5))() > (cfg.retenueSurface.glisse ?? 0.3) * (foe.skill?.aggrF ?? 1)) {
    st._slideT[foe.team] = st.t;
    st.events.push({ t: +st.t.toFixed(2), type: 'retenue-surface', by: foe.id });   // le refus NOMMÉ — comptable (télémétrie, clause)
    return;
  }
  const sit = situation(foe.p, foe.yaw, bp, st.ball.v, bp[1]);
  const pick = chooseTechnique(sit, 'win', { bias: { 'tacle-glisse': 1 } })[0];
  // LA TABLE ET LE COULOIR SE LISENT DEBOUT (lot 66 — mesuré post-gazon : 21 des 38 glissés
  // partaient au sol sur une table qui REFUSAIT, 10 de plus sur un point FIGÉ que le ballon
  // assis avait déjà quitté — 82 % de corps couchés pour rien). Un pro RETIENT son tacle :
  // la situation (table technique) et le ballon PRÉDIT au milieu de la fenêtre de balayage
  // (predictPath — la physique réelle, gazon compris) valident le couloir AVANT que le corps
  // parte. Le JET, lui, reste le pari de l'engagé (accuracy 0,6 ± tackling — sans lui, 83
  // glissés sur 83 prenaient le ballon). S.predit:false = les plongeons d'hier (sabotage nommé).
  const tableOk = !!pick && pick.tech.id === 'tacle-glisse';
  const vq0 = Math.hypot(foe.v[0], foe.v[1]) || 1;
  // …mais l'IMPRUDENCE reste un chemin du réel : un couloir qui trouve les JAMBES du porteur
  // part même table refusée — c'est le tacle dangereux, la faute, le jaune.
  const jambes = d2(foe.p, c.p) < 2.2 && ecartCouloir(foe, [c.p[0], 0, c.p[2]], 0.35 + vq0 * 0.45) <= (S.body ?? 1.1);
  let couloirBallon = true;
  if (S.predit !== false) {
    if (!tableOk && !jambes) return;                        // rien à toucher : un pro reste debout
    // …et l'imprudence est l'EXCEPTION, pas la règle (mesuré : chaque situation jambes partait —
    // fautes 2,5/match, réel ~0,8/3 min) : 70 % du temps, le pro retient ce tacle-là aussi.
    if (!tableOk && (st.rnd ? st.rnd() : 0.5) > (S.imprudence ?? 0.3)) return;   // …le taux d'imprudence en clé (191)
    if (tableOk) {
      const tc = Math.min(0.4, Math.max(0.1, (sit.dist - 0.35) / Math.max(3.5, vq0)));
      const tMid = Math.min(0.5, (tc + 0.55) / 2);
      const path = predictPath(st.ball.snapshot(), { maxT: tMid + 0.05 });
      const fut = path[Math.min(path.length - 1, Math.round(tMid * 60))]?.p ?? bp;
      couloirBallon = ecartCouloir(foe, fut, 0.35 + vq0 * 0.45) <= (S.win ?? 1.0);
      if (!couloirBallon && !jambes) return;
    }
  }
  foe.slideCd = st.t + cfg.slideCooldown;
  st._slideT[foe.team] = st.t;
  foe.down = cfg.slideRecovery * (0.9 + 0.2 * (st.rnd ? st.rnd() : 0.5));
  const roll = st.rnd ? st.rnd() : 0.5;
  // +0,15 : l'accuracy 0,6 de la table couvrait AUSSI l'incertitude géométrique — désormais
  // validée AVANT l'engagement (table + couloir prédit). Le jet ne porte plus que l'exécution
  // (mesuré à 0,6 post-validation : 65 % d'échecs, un pro engagé sur bonne géométrie touche ~75 %).
  // …et un couloir qui ne trouve que l'HOMME ne gagne jamais le ballon : son issue est la faute
  // (dBody) ou le vide — jamais la prise.
  const won = tableOk && couloirBallon && roll < (pick.tech.accuracy ?? 0.6) + 0.15 + (foe.skill ? foe.skill.tackleReach * 2 : 0);
  if (won) {
    // LE BALLON SE PREND AU CONTACT, PAS AU LANCEMENT (lot 51, S.contact — retour utilisateur
    // « le ballon libre part dans le sens opposé tout seul ») : la déviation se résolvait à
    // l'INSTANT du déclenchement, tacleur encore à 1,3-2,6 m — le ballon s'inversait à côté
    // d'un corps qui commençait à peine à glisser. Le glissé est DEUX temps : le lancement
    // (ici — le pari est pris, le corps part au sol), le CONTACT (slideResolve, ~0,1-0,4 s
    // plus tard, géométrie RE-JUGÉE : un ballon qui s'est échappé fait un tacle dans le
    // vide — c'est le prix du pari). contact:false : l'instantané d'hier (sabotage nommé
    // « le tacle télékinésiste »).
    const vq = Math.hypot(foe.v[0], foe.v[1]) || 1;
    if (S.contact === false) {
      if (c.act && winding(c)) abortGesture(c, 'fauché', { log: st.gestures });
      st.events.push({ t: +st.t.toFixed(2), type: 'slide', by: foe.id, won: true, tech: 'tacle-glisse',
        foot: pick.foot, surface: pick.surface, team: foe.team, atk: c.team, sur: c.id, dist: +sit.dist.toFixed(2) });
      st.ball.release('contesté');
      st.ball.impulse([(foe.v[0] / vq) * 3.2, 0.4, (foe.v[1] / vq) * 3.2]);
      st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
      return;
    }
    foe._slide = { at: st.t + Math.min(0.4, Math.max(0.1, (sit.dist - 0.35) / Math.max(3.5, vq))),
      until: st.t + 0.55, sur: c.id, foot: pick.foot, surface: pick.surface, dir: [foe.v[0] / vq, foe.v[1] / vq] };
    foe._glisse = { v: [foe.v[0], foe.v[1]] };   // la glissade PORTE le corps (movement.js)
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

/** LE CONTACT DU GLISSÉ (lot 51) : résout les tacles lancés — le pied ARRIVE sur le ballon
 *  (dégagé dans la course de glisse, comme avant), ou le ballon n'y est plus (le vide — la
 *  géométrie re-jugée est ce qui rend le glissé esquivable). Appelé chaque image (rondo-sim) ;
 *  aucun _slide n'existe hors match : boucle vide, pas un bit ailleurs. */
export function slideResolve(st, cfg) {
  for (const q of st.players) {
    const g = q._slide;
    if (!g || st.t < g.at) continue;
    const S = cfg.slideTackle ?? {};
    const d = d2(q.p, st.ball.p);
    // le pied BALAYE pendant la glisse : le contact se prend n'importe quand dans la fenêtre
    // [at ; until] — passé `until` sans ballon, c'est le vide (le prix du pari)
    const winR = (S.win ?? 1.0) + (q.skill?.tackleReach ?? 0) * 2;   // …l'allonge du tacle au CONTACT aussi (191 — la note tackling en facteur des deux temps)
    if (!(d <= winR && st.ball.p[1] < 0.6) && st.t < (g.until ?? g.at)) continue;
    q._slide = null;
    if (d <= winR && st.ball.p[1] < 0.6) {
      const c = st.players[g.sur];
      if (c?.act && winding(c)) abortGesture(c, 'fauché', { log: st.gestures });
      st.events.push({ t: +st.t.toFixed(2), type: 'slide', by: q.id, won: true, tech: 'tacle-glisse',
        foot: g.foot, surface: g.surface, team: q.team, atk: c?.team, sur: g.sur, dist: +d.toFixed(2) });
      if (st.ball.owner != null) st.ball.release('contesté');
      st.ball.impulse([g.dir[0] * 3.2, 0.4, g.dir[1] * 3.2]);
      st.lastTouch = q.team;
      st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
    } else {
      st.events.push({ t: +st.t.toFixed(2), type: 'slide', by: q.id, won: false, tech: 'tacle-glisse', vide: true, team: q.team, dist: +d.toFixed(2) });
    }
  }
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

/**
 * LA FENÊTRE DU TACLE (lot 95, st.full && cfg.jockey — les appuis du défenseur). La minuterie
 * d'hier tacle À L'HEURE ; le défenseur DISCIPLINÉ tacle À LA FENÊTRE : le ballon prenable
 * (touche longue, ballon qui s'éloigne du pied porteur) jugé à la COMPOSURE — le posé exige
 * une fenêtre NETTE (prise serrée), l'impulsif s'élance sur du flou (mesuré avant : 6 des 8
 * tacles-debout partaient de DERRIÈRE le porteur, minuterie sèche). L'étau finit par mordre
 * (force ×2,2 sur la minuterie : un porteur pressé n'est jamais intouchable — le flux vit).
 * balPrenable est passé par l'appelant (rondo-sim) : le sens d'import reste acyclique.
 */
export function tackleWindow(st, q, cfg, balPrenable) {
  if (!st.full || cfg.jockey === false) return true;                // la minuterie d'hier, au bit
  if (st.pressure >= cfg.tackleTime * (cfg.jockey?.force ?? 1.5)) return true;
  return balPrenable(st.ball, q.p[0], q.p[2], 0.55 * (q.skill?.composureF ?? 1), 0.5);
}

/**
 * LA POLITIQUE DE L'ACCROCHAGE (lot 97) — la probabilité par ÉPISODE de dépassement, pure et
 * testable : le BATTU (dans le dos du porteur lancé) accroche-t-il ? La COMPOSURE est LE
 * facteur (l'impulsif 1,3 s'y résout, le posé 0,85 court — attributes.composureF), l'équipe
 * agressive (axe pressing) et le rôle qui presse assument plus de fautes ; la transition
 * PROMETTEUSE (< 2 défenseurs restants) fait la faute TACTIQUE (×1,8 — on la commet exprès,
 * et elle est GRAVE : le jaune vient vite) ; dans SA surface on n'offre pas un penalty (×0,15).
 * Base 0,065 : mesurée à 0,09 le monde rendait ~24 accrochages/90 min extrapolés — le réel en
 * siffle 10-15 ; à 0,065 il en tient ~17 et l'attaque respire (le gate des buts, A/B lot 97).
 */
export function accrocheP(q, pressAxe, danger, enSurface) {
  const base = 0.065 * (q.skill?.composureF ?? 1) * pressAxe * (danger ? 1.8 : 1);
  return Math.min(0.4, base * (enSurface ? 0.15 : 1));
}

/**
 * L'ACCROCHAGE DU BATTU (lot 97, st.full && cfg.accroche && cfg.loi12 — appelé au pas du
 * porteur, le site de chargeStep). Mesuré avant : 0,08 faute/match (réel 1,2-1,5 par 220 s) —
 * le tacle discipliné (lot 95) a asséché la dernière source ; or le monde réel tient ses
 * coups francs et ses cartons de LA faute du battu : le défenseur dépassé qui retient.
 * L'épisode se décide UNE fois (cooldown 6 s par homme, tirage st.rnd2 seedé) ; l'accroché
 * casse sa course (v ×0,5 — il s'arrache de la prise en perdant deux foulées, pas en
 * s'arrêtant ; tombé 0,6 s si faute tactique), le ballon VIT — l'avantage (Loi 5,
 * adjugeFaute) départage, le carton suit la récidive (grave compte double).
 */
export function accrocheStep(st, c, cfg, pressAxe = 1) {
  if (st.ball.owner !== c.id) return;
  const cv = Math.hypot(c.v[0], c.v[1]);
  if (cv < 2.6) return;
  const { pitch } = st;
  const og = pitch.ownGoal(1 - c.team);
  const gx = og.x - c.p[0], gz = 0 - c.p[2]; const gl = Math.hypot(gx, gz) || 1;
  for (const q of st.players) {
    if (q.team === c.team || q.keeper || q.down > 0 || (q._accCd ?? -1) > st.t || st._faute) continue;
    const d = d2(q.p, c.p);
    if (d > 1.6) continue;
    if (((q.p[0] - c.p[0]) * gx + (q.p[2] - c.p[2]) * gz) / (gl * (d || 1)) > -0.05) continue;  // pas dans le dos/à l'épaule
    if (Math.hypot(q.v[0], q.v[1]) > cv + 0.5) continue;                                        // pas battu de vitesse
    q._accCd = st.t + 6;                                            // une décision par épisode
    const restants = st.players.filter((r) => r.team === q.team && !r.keeper && r.down <= 0
      && ((r.p[0] - c.p[0]) * gx + (r.p[2] - c.p[2]) * gz) / gl > 0.5).length;
    const danger = restants < 2;
    const enSurface = pitch.inBox(q.p[0], q.p[2], Math.sign(pitch.ownGoal(q.team).x || 1));
    if ((st.rnd2 ?? st.rnd ?? (() => 0.5))() >= accrocheP(q, pressAxe, danger, enSurface) * (0.8 + 0.4 * role(q).press) * (q.skill?.aggrF ?? 1) * (enSurface && st.full && cfg.retenueSurface ? (cfg.retenueSurface.accro ?? 0.4) : 1)) continue;   // …l'AGRESSIVITÉ est une note (151) : le hargneux accroche (et paie ses fautes) — et LA RETENUE DE SURFACE (169b) resserre encore la main dans la boîte
    st._faute = { t: st.t, par: q.id, sur: c.id, team: c.team, p: [c.p[0], c.p[2]], grave: danger };
    // …ET LE PORTEUR S'ARRACHE UNE FOIS SUR DEUX (v2, mesuré : la v1 cassait TOUTES les courses
    // accrochées — A/B 18 → 13 buts, l'occasion supprimée chirurgicalement ; au réel le battu
    // qui retient ne stoppe pas toujours) : la faute est POSÉE (l'avantage la jouera — le
    // porteur qui file garde le ballon, l'arbitre laisse), la course VIT.
    const arrache = (st.rnd2 ?? st.rnd ?? (() => 0.5))() < 0.5;
    st.events.push({ t: +st.t.toFixed(2), type: 'faute', by: q.id, sur: c.id, kind: 'accrochage', prometteur: danger, arrache, p: [+c.p[0].toFixed(1), +c.p[2].toFixed(1)] });
    if (!arrache) {
      c.v[0] *= 0.5; c.v[1] *= 0.5;                                 // la course cassée — deux foulées, pas un arrêt
      if (danger) c.down = Math.max(c.down, 0.6);                   // la faute tactique le fauche
    }
    return;
  }
}

/** LE DUEL CONTESTÉ (lot 166, cfg.tacleDegage && st.full) : le tacle gagné n'est une PRISE
 *  propre qu'à la garde — sinon la fente POUSSE le ballon devant elle (libre, vif, 'contesté'
 *  au grand livre) : le réel ne donne ~qu'une moitié de prises nettes. La part de prise ×
 *  tacleGardeF : la note tackling agit sur l'EXÉCUTION du duel gagné. Mesuré (4×300 s) :
 *  2/6 duels gagnés dégagés ; l'effet TOUCHES visé au départ est NUL (1 c. 2 — requalifié,
 *  patron 158 : le déficit de touches vient des passes SERVO qui ne sortent jamais, front
 *  consigné). Rend true si dégagé (pas de prise) ; false : le chemin d'hier au bit. */
export function tacleDegage(st, q, cfg) {
  const TD = st.full && cfg.tacleDegage;
  if (!TD || !st.rnd || st.rnd() <= (TD.prise ?? 0.55) * (q.skill?.tacleGardeF ?? 1)) return false;
  const a = Math.atan2(st.ball.p[2] - q.p[2], st.ball.p[0] - q.p[0]) + (st.rnd() - 0.5) * (TD.bruit ?? 0.9);
  const v = TD.v ?? 7;
  if (st.events.length) st.events[st.events.length - 1].degage = true;
  st.ball.release('contesté');
  st.ball.impulse([Math.cos(a) * v - st.ball.v[0], 0, Math.sin(a) * v - st.ball.v[2]]);
  st.phase = 'loose'; st.possession.carrier = -1; st.hold = 0; st.pressure = 0;
  return true;
}

/** LE BLOC DE CHAMP (lot 176, cfg.contreTir && st.full — ~25-30 % des frappes du réel sont
 *  CONTRÉES par un corps, et c'est LA source des corners ; mesuré avant : 14/48 tirs croisaient
 *  un corps à < 0,4 m et certains TRAVERSAIENT jusqu'au but). Physique générique : tout ballon
 *  LIBRE, rapide (≥ vMin) et bas (≤ h) qui percute un corps ADVERSE au dernier toucheur dévie —
 *  le corps encaisse, le ricochet part large (± bruit rad), la vitesse est mangée (×0,3-0,6),
 *  l'événement 'contre' se nomme (télémétrie, ticker). Clé absente : le tir fantôme d'hier. */
export function contreTir(st, cfg) {
  const CT = cfg.contreTir;
  if (!st.full || !CT || st.ball.owner != null) return;
  const v = Math.hypot(st.ball.v[0], st.ball.v[2]);
  if (v < (CT.vMin ?? 13) || st.ball.p[1] > (CT.h ?? 1.3)) return;
  const dernier = st.players[st.lastPasser ?? -1];
  if (!dernier) return;
  for (const q of st.players) {
    if (q.team === dernier.team || q.keeper || q.down > 0 || (q._contreCd ?? -1) > st.t) continue;
    const d = Math.hypot(q.p[0] - st.ball.p[0], q.p[2] - st.ball.p[2]);
    if (d > (CT.rayon ?? 0.38)) continue;
    q._contreCd = st.t + 1.5;
    const rnd = st.rnd ?? (() => 0.5);
    const a = Math.atan2(st.ball.v[2], st.ball.v[0]) + (rnd() - 0.5) * 2 * (CT.bruit ?? 1.1);
    const k = 0.3 + rnd() * 0.3;
    st.ball.impulse([Math.cos(a) * v * k - st.ball.v[0], -st.ball.v[1] * 0.6, Math.sin(a) * v * k - st.ball.v[2]]);
    st.events.push({ t: +st.t.toFixed(2), type: 'contre', by: q.id, sur: dernier.id, v: +v.toFixed(1) });
    return;
  }
}

/** LA JAMBE TENDUE (lot 181, cfg.allonge && st.full — filmé : la passe croisait son receveur
 *  ATTITRÉ à 0,85-0,90 m et filait 7-23 m dans son dos, demi-tour ; à 60 Hz et 7,5 m/s le
 *  minimum continu passe ENTRE les échantillons du gate binaire receiveRadius). Le pied a une
 *  allonge : dans l'anneau [receiveRadius, max], ballon au sol qui LE DÉPASSE (radial fuyant),
 *  le receveur tend la jambe — une TOUCHE DÉGRADÉE, pas une prise : le ballon est freiné et
 *  reste LIBRE (hors servo — le canal où la NOTE mord enfin, dette 179/220) ; la part tuée
 *  suit controlF : l'artiste la pose à 1 m, le maladroit se la pousse 2-3 m plus loin. La
 *  passe est MORTE (lot 44 : la mène fantôme ne cible plus) ; une seule tentative par passe.
 *  Clé absente : le demi-tour d'hier au bit. */
export function jambeTendue(st, cfg) {
  const AL = cfg.allonge;
  if (!st.full || !AL || st.ball.owner != null || !st.pass || st.pass._tendue || st.pass.to < 0) return;
  if (st.ball.p[1] > (AL.h ?? 0.9)) return;
  const v = Math.hypot(st.ball.v[0], st.ball.v[2]);
  if (v < (AL.vMin ?? 4)) return;
  const q = st.players[st.pass.to];
  if (!q || q.keeper || q.down > 0) return;
  const bx = st.ball.p[0] - q.p[0], bz = st.ball.p[2] - q.p[2], d = Math.hypot(bx, bz);
  if (d <= (cfg.receiveRadius ?? 0.85) || d > (AL.max ?? 1.15)) return;
  if ((st.ball.v[0] * bx + st.ball.v[2] * bz) / d <= 0) return;    // il s'approche encore : la prise propre garde sa chance
  st.pass._tendue = true;
  const kill = Math.min(AL.cap ?? 0.85, (AL.kill ?? 0.62) * (q.skill?.controlF ?? 1));
  st.ball.impulse([-st.ball.v[0] * kill, -st.ball.v[1] * 0.5, -st.ball.v[2] * kill]);
  st.events.push({ t: +st.t.toFixed(2), type: 'control', by: q.id, tech: 'jambe-tendue', foot: 'any',
    surface: 'toe', speed: +v.toFixed(1), kill: +kill.toFixed(2), settle: null });
  st.pass = null; st.phase = 'loose'; st.possession.carrier = -1;
}
