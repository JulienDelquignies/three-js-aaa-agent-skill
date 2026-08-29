import { BALL, stepBall, kick } from './ball.js';
import { predictPath } from './ball-predict.js';
import { solvePass, solveGroundLeg, flightRace, interceptPoint } from './ball-predict.js';
import { axe as axeTac, tac as tacDe } from './tactics.js';   // le TEMPO (149) — sans tactiques : equilibre, l'identité
import { makeDribbler, dribbleStep, dribbleSteer, touchDistance, balPrenable, dansCone } from './dribble.js';
import { RONDO, assignJobs, choosePass, strikingFoot, rondoInternals } from './rondo.js';
import { situation, chooseTechnique, checkAction, TECHNIQUES, byId, footFor } from './technique.js';
import { chargeStep, slideTackleStep, slideResolve, ecartCouloir, tackleWindow, accrocheStep, tacleDegage } from './duel.js';
import { teteStep, voleeStep } from './tete.js';
import { coachStep } from './coach.js';
import { MOVES } from './animkit.js';
import { startGesture, stepGesture, abortGesture, busy, winding, following, checkGestures } from './gesture.js';
import { uneTouche } from './premiere-intention.js';
import { STANCES, anchorFor, reachable, glide, planStrike } from './approach.js';
import { offsideLine, isOffside } from './offside.js';
import { busteBlock } from './keeper.js';
import { arbitre } from './menace.js';
import { beginPass, strikeNow } from './strike-sim.js';
import { MOVE_TIMING, wrapA, touchEvent, maybeRateau, maybeFeinte, maybeSemelle, maybePassement, maybeCrochet, maybeDoubleContact, maybePetitPont, maybeRoulette, maybeFeinteFrappe, skillContactNow, skillFollowStep, pressPredicate, footPoint, stanceBallPoint } from './skills-sim.js';

// rondo-sim — the game loop of the possession game, headless: release, pass vs press, read, and who
// ends up with the ball. No renderer — the whole match is proved in node (verify-rondo) before drawn.

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const { movePlayers, separatePlayers, turnover } = rondoInternals;

/** Le POINT DU PIED du porteur — devant le pied de contrôle (mêmes décalages que la touche du receive),
 *  CLAMPÉ DANS LE CARRÉ : un porteur SUR la ligne portait son ballon 0,34 m dehors (6 sorties de but
 *  mesurées sur 3 graines). Le joueur s'arrête à la craie ; son ballon aussi. */


/** Un refus a une CAUSE NOMMÉE, et elle se compte. C'est le seul moyen de voir un étranglement :
 * quand le jeu s'effondre, le premier chiffre à lire est « qui dit non, et combien de fois ». */
function deny(st, cause) { (st.deny ??= {})[cause] = (st.deny[cause] ?? 0) + 1; return false; }

/** THE GESTURE CLOCK — every actor, every phase. A follow-through does not stop because the ball has
 *  left or possession changed; only a named interruption cuts a swing short (runs outside the phase machine). */
function stepGestures(st, dt, cfg) {
  for (const p of st.players) {
    if (!p.act) continue;
    // CLOSED DOWN MID-SWING. The windup is a real window: a defender who arrives during it takes the
    // ball off you. This is what makes pressing worth doing, and it did not exist while the ball left
    // at the instant of the decision — there was no interval to attack.
    if (winding(p) && st.phase === 'carry' && st.possession.carrier === p.id) {
      // TAKING THE BALL OFF A MAN MID-SWING IS A BLOCK, NOT A TACKLE : the defender has to
      // get to the BALL first (sans ça le windup était fatal — record halved, turnovers doubled).
      // …ET LE PRÉDICAT EST CELUI DU DUEL (pressPredicate) : à portée de jeu du BALLON, et qui BAT le
      // porteur au ballon — plus jamais « près du corps ». Le terme de la minuterie n'est plus une
      // bascule : c'est l'engagement d'un tacle-debout, que l'armé du porteur peut encore gagner
      // (son contact part avant celui du tacle → le tacle mord dans le vide, refus nommé).
      const press = pressPredicate(st, p, cfg);
      st.pressure = press.length ? st.pressure + dt : 0;
      // AND THE BALL TRAVELS WITH HIM — the swing suspends the dribble; the ball goes where he goes until the boot sends it (separation 2,09 → 1,53 m).
      // LE COUPLE CORPS-BALLON EST SOUDÉ PENDANT L'ARMÉ (mesuré : 0,4 m de divergence, le pied
      // frappait du vide) : le BALLON PORTÉ vit AU POINT DE STANCE du corps qui glisse (carry) —
      // au contact la stance est vraie par construction ; un ballon NON porté garde le frein d'assise ;
      if (st.ball.owner === p.id && p.act.payload?.stance) {
        // tau 0,05 → 0,035 : l'armé le plus court (passeRapide, contact 0,22 s) exige un couple vite
        // soudé (les passes partaient à 6-21° de leur stance). MAIS un ballon encore à > 0,45 m du
        // corps se rassemble DOUX (lot 63, st.full — film seed 7 : chaque virage sans contact restant
        // vivait à ±0,05 s d'un windup, le ballon REBROUSSAIT sec vers le stance depuis 0,8 m).
        st.ball.carry(stanceBallPoint(p, p.act.payload.stance, p.act.payload.pick.foot), dt, st.full && d2(p.p, st.ball.p) > 0.45 ? { tau: 0.12, vMax: 6.5 } : { tau: 0.035 });
      } else if (!(st._settling && st.t < st._settling.at)) st.ball.escort([0, 0], dt, { tau: 0.09 });
      //   et le CORPS GLISSE SUR L'ANCRE de la stance (approach.glide) : les derniers décimètres se
      //   règlent pendant l'armé, comme un vrai joueur ajuste ses derniers appuis. La vitesse écrite
      //   est celle du glissement, pour que l'inertie et l'animation lisent le mouvement réel.
      if (p.act.payload?.stance) {
        const A = p.act.payload;
        // l'ancre se recalcule sur le ballon COURANT : il freine encore de quelques centimètres au
        // début de l'armé, et une ancre figée sur sa position d'engagement raterait de ce freinage.
        const anchor = anchorFor([st.ball.p[0], st.ball.p[2]], A.outYaw, A.pick.foot, A.stance);
        // LA FOULÉE DE FRAPPE (lot 45, cfg.strideStrike && st.full) : l'ancre avance de
        // v0·e^(−t/τ), plafond cumulé, strikeNow re-résout. ET ELLE PORTE LES DEUX BOUTS (ride,
        // lot 48) : l'offset commit→ancre d'un porteur lancé est quasi nul — l'ease multipliait
        // le pas d'ancre par ~0 en début d'armé (falaise). Doc : match-config, NOTES 83.
        if (cfg.strideStrike && st.full && (A.v0 ?? 0) > 1) {
          const tau = cfg.strideStrike.tau ?? 0.6;
          const pas = A.v0 * Math.exp(-p.act.t / tau) * dt;
          A._foulee = (A._foulee ?? 0) + pas;
          if (A._foulee <= (cfg.strideStrike.max ?? 2.2)) {
            const cx = Math.cos(A.vYaw ?? A.outYaw), sx = Math.sin(A.vYaw ?? A.outYaw);
            anchor.p[0] += cx * pas; anchor.p[1] += sx * pas;
            if (cfg.strideStrike.ride !== false) { A.from[0] += cx * pas; A.from[1] += sx * pas; }
          }
        }
        // …et le segment ENTIER (ancre ET from porté) reste DANS le carré : le joueur s'arrête à la craie (sans la clampe le glissement poussait dehors)
        anchor.p[0] = Math.max(-st.area[0] / 2, Math.min(st.area[0] / 2, anchor.p[0]));
        anchor.p[1] = Math.max(-st.area[1] / 2, Math.min(st.area[1] / 2, anchor.p[1]));
        A.from[0] = Math.max(-st.area[0] / 2, Math.min(st.area[0] / 2, A.from[0]));
        A.from[1] = Math.max(-st.area[1] / 2, Math.min(st.area[1] / 2, A.from[1]));
        const t01 = Math.min(1, p.act.t / Math.max(1e-4, p.act.anticipation));
        const g = glide(A.from, A.fromYaw, anchor, t01);
        // ON CONTOURNE SON BALLON, ON NE LE TRAVERSE PAS : le chemin du glissement est poussé
        // radialement hors du cercle du ballon (les stances finissent au-delà — talonnade 0,38 > 0,32).
        {
          const bx = g.p[0] - st.ball.p[0], bz = g.p[1] - st.ball.p[2];
          const bd = Math.hypot(bx, bz), AVOID = 0.32;
          if (bd < AVOID && bd > 1e-6) { g.p[0] = st.ball.p[0] + (bx / bd) * AVOID; g.p[1] = st.ball.p[2] + (bz / bd) * AVOID; }
        }
        // L'ACTIONNEUR EST BORNÉ : le corps rejoint la courbe du glissement à vitesse humaine au
        // plus (même loi que le lacet : une demande, un taux borné). La borne rend STRUCTURELLE la
        // clause « aucun joueur au-dessus de 8,4 m/s » — sans elle, une ancre qui fuit (ballon
        // encore vivant, cas d'urgence) faisait poursuivre le glissement au-delà de 10 m/s.
        {
          const ex = g.p[0] - p.p[0], ez = g.p[1] - p.p[2];
          const el = Math.hypot(ex, ez), cap = cfg.glideMax * dt;
          const k = el > cap ? cap / el : 1;
          p.v[0] = (ex * k) / Math.max(1e-4, dt);
          p.v[1] = (ez * k) / Math.max(1e-4, dt);
          p.p[0] += ex * k; p.p[2] += ez * k;
        }
        p.yaw = g.yaw; p.yawWant = null;
        p.speed = Math.hypot(p.v[0], p.v[1]);
      }
      if (st.pressure >= tacleHorloge(st, press[0], cfg) && tackleWindow(st, press[0], cfg, balPrenable)) beginStandTackle(st, press[0], p, cfg);
    } else if (busy(p) && p.act?.payload?.kind === 'skill' && st.phase === 'carry' && st.possession.carrier === p.id) {
      // LA FENÊTRE DE DUEL RESTE OUVERTE PENDANT TOUT LE GESTE TECHNIQUE — armé ET accompagnement.
      // Sans elle, la semelle (1,0 s) et le raclage du râteau étaient des sanctuaires : un défenseur
      // à 2,4 m couvre cette distance en 0,4 s et devait regarder. Un geste technique s'assume.
      const press = pressPredicate(st, p, cfg);
      st.pressure = press.length ? st.pressure + dt : 0;
      if (st.pressure >= tacleHorloge(st, press[0], cfg) && tackleWindow(st, press[0], cfg, balPrenable)) beginStandTackle(st, press[0], p, cfg);
    }
    // l'accompagnement possédé (râteau qui tourne, semelle qui tient) écrit corps ET ballon ICI —
    // movePlayers se tait (ownsBody), la branche busy du pas de jeu aussi : une autorité.
    if ((following(p) || p.act?.payload?.skill === 'plongeon') && p.act?.payload?.kind === 'skill') skillFollowStep(st, p, dt, cfg);
    const actBefore = p.act;
    const evg = stepGesture(p, dt, { log: st.gestures });
    if (evg === 'contact') {
      if (p.act?.payload?.kind === 'pass') strikeNow(st, p, cfg);
      else if (p.act?.payload?.kind === 'tacle-debout') standTackleNow(st, p, cfg);
      else if (p.act?.payload?.kind === 'skill') skillContactNow(st, p, cfg);
    } else if (evg === 'end' && actBefore?.payload?.kind === 'skill') {
      // la fin d'un geste technique STAMPE ses mesures — le banc juge la sim, pas une trace échantillonnée
      const A = actBefore.payload;
      // LA SORTIE EXPLOSE (122, cfg.skill.sortieBurst && st.full) : l'élimination menée au bout AVEC le
      // ballon débouche sur une accélération franche (_pace ×1,28) — mesuré avant : TOUTES les sorties
      // plantées (passement 2,3, râteau 1,2, roulette 2,4 m/s à +1,5 s), le ralenti existait, l'explosion
      // jamais. Durée × accelF (l'attribut) ; la feinte garde son burst propre, la semelle protège. Absente : hier.
      const SB = st.full && cfg.skill?.sortieBurst;
      if (SB && (st.ball.owner === p.id || A.reussi) && A.skill !== 'plongeon' && A.skill !== 'semelle' && A.skill !== 'feinte') {
        p._pace = { until: st.t + (SB.dur ?? 1.2) * (p.skill?.accelF ?? 1), kind: 'sortie-geste', next: p._pace?.next ?? 0 };
        st.events.push({ type: 'burst', kind: 'sortie-geste', by: p.id, t: +st.t.toFixed(2) });
      }
      if (A.skill === 'rateau') {
        p.v[0] = Math.cos(A.exitYaw) * 1.6; p.v[1] = Math.sin(A.exitYaw) * 1.6;
        p.push = [Math.cos(A.exitYaw), Math.sin(A.exitYaw)];
        st.events.push({
          t: +st.t.toFixed(2), type: 'skill-end', kind: 'rateau', by: p.id,
          turned: +(Math.abs(wrapA(p.yaw - A.yaw0)) * 180 / Math.PI).toFixed(0),
          ballMax: +(A.ballMax ?? 0).toFixed(2),
        });
      } else if (A.skill === 'semelle') {
        st.events.push({ t: +st.t.toFixed(2), type: 'skill-end', kind: 'semelle', by: p.id, maxV: +(A.maxV ?? 0).toFixed(2) });
      } else if (A.skill === 'plongeon') {
        if (!A.resolved) deny(st, 'plongeon-battu');              // la détente n'a rien trouvé : l'état se nomme
        cfg.onDiveEnd?.(st, p, A, cfg);                           // …et le corps TOMBÉ paie sa chute (hook match, lot 91)
      } else if (A.skill === 'feinte') {
        st.events.push({ t: +st.t.toFixed(2), type: 'skill-end', kind: 'feinte', by: p.id });
      }
    }
  }
}

/** LE VOL DEVIENT UN GESTE : le presseur S'ENGAGE dans un tacle-debout (armé 0,28 s — le clip tacleDebout
 *  jamais déclenché avant, mesuré 0 en 8 min). Pendant l'armé le porteur peut sortir le ballon (le duel) ;
 *  le transfert se joue AU CONTACT, sur un ballon à portée (standTackleNow). */
// L'HORLOGE DU PIQUE (lot 157, cfg.tacleVif && st.full) : 0,9 s de pression soutenue n'arrivait
// JAMAIS en flux (max 0,88 s / 30 min, 1 arme — la panique adverse lache a 0,15 s : le tacle
// perdait la course des horloges PAR CONSTRUCTION). Le pied qui pique s'engage a ~0,23 s (p75 des épisodes : 0,22), a la
// NOTE tackling (x(2 - tacleTempoF) : le bon 0,19 s, le maladroit 0,26, 50 = 0,225) — la porte
// de discipline du 95 (tackleWindow -> balPrenable) reste juge. false / rondo : 0,9 s d'hier.
function tacleHorloge(st, q, cfg) {
  if (!st.full || !cfg.tacleVif) return cfg.tackleTime;
  return cfg.tackleTime * (cfg.tacleVif.tot ?? 0.25) * (2 - (q?.skill?.tacleTempoF ?? 1));
}

function beginStandTackle(st, q, victim, cfg) {
  const move = MOVE_TIMING.tacleDebout;
  st.pressure = 0;
  q.tackleCd = st.t + cfg.standCooldown;              // manqué ou gagné : pas de mitraillette de duels
  q.yawWant = Math.atan2(st.ball.p[2] - q.p[2], st.ball.p[0] - q.p[0]);
  startGesture(q, { id: 'tacleDebout', ...move }, { payload: { kind: 'tacle-debout', victim: victim.id }, log: st.gestures });
  st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: q.id, move: 'tacleDebout', anticipation: move.contact });
}

/**
 * LE CONTACT DU TACLE-DEBOUT. Le duel se juge ICI, sur la géométrie réelle du contact — pas sur
 * celle d'il y a 0,28 s : si le porteur a sorti le ballon (passe partie, conduite hors de portée),
 * le tacle mord dans le vide et le refus se NOMME au registre (tacle-manqué). S'il gagne, le
 * transfert est PHYSIQUE : la technique de la table (tacle-debout) valide le contact, la première
 * touche du gagnant amortit le ballon (résiduel dans turnover) — plus jamais un ballon gelé à
 * distance ni une possession qui bascule sans événement.
 */
function standTackleNow(st, q, cfg) {
  const victimId = q.act?.payload?.victim ?? -1;
  const d = d2(q.p, st.ball.p);
  const still = st.phase === 'carry' && st.possession.carrier === victimId;
  const sit = situation(q.p, q.yaw, st.ball.p, st.ball.v, st.ball.p[1]);
  const pick = still && d <= cfg.receiveRadius + (q.skill?.tackleReach ?? 0) - (st.players[victimId]?.skill?.esquiveF ?? 0) ? chooseTechnique(sit, 'win', { bias: { 'tacle-debout': 1 } })[0] : null;   // LE DUEL EST TACKLING VS DRIBBLING (152) : le dribbleur esquive, le maladroit s'offre — ±16 cm de fenêtre entre les extrêmes
  const won = !!pick && pick.tech.id === 'tacle-debout';
  if (!won) {
    // le refus a une cause nommée, et l'événement du duel perdu reste visible dans le flux
    deny(st, still ? 'tacle-manqué' : 'tacle-orphelin');
    st.events.push({ t: +st.t.toFixed(2), type: 'duel', by: q.id, won: false, dist: +d.toFixed(2) });
    // LA LOI 12 (cfg.loi12 && st.full — le réduit vit sans arbitre, dette nommée) : la fente qui
    // rate le BALLON et trouve le CORPS est une FAUTE. Ici on MARQUE le fait (qui, sur qui, où) ;
    // le match l'ADJUGE (referee.adjugeFaute : l'avantage d'abord — Loi 5 —, le sifflet ensuite,
    // penalty si la faute vit dans la surface du fautif). Une faute à la fois : l'arbitre aussi.
    const vic = st.players[victimId];
    if (cfg.loi12 && st.full && still && vic && d2(q.p, vic.p) < (cfg.loi12.contact ?? 0.9) && !st._faute) {
      st._faute = { t: st.t, par: q.id, sur: victimId, team: vic.team, p: [vic.p[0], vic.p[2]] };
      st.events.push({ t: +st.t.toFixed(2), type: 'faute', by: q.id, sur: victimId, p: [+vic.p[0].toFixed(1), +vic.p[2].toFixed(1)] });
    }
    return;
  }
  // l'événement porte sa géométrie ET sa technique — checkAction peut le rejouer (technique-legal)
  st.events.push({
    t: +st.t.toFixed(2), type: 'duel', by: q.id, won: true, tech: 'tacle-debout', foot: pick.foot,
    surface: pick.surface, bearing: +sit.bearing.toFixed(1), side: sit.side, dist: +sit.dist.toFixed(2),
    height: +st.ball.p[1].toFixed(2), speed: +Math.hypot(st.ball.v[0], st.ball.v[2]).toFixed(1),
  });
  const victim = st.players[victimId];
  // …et un geste TECHNIQUE se fait fermer à n'importe quel instant (la semelle tenue, le raclage
  // du râteau) — pas seulement l'armé : sa fenêtre de duel est ouverte du début à la fin
  if (victim?.act && (winding(victim) || victim.act.payload?.kind === 'skill')) abortGesture(victim, 'fermé pendant l’armé', { log: st.gestures });
  // LE TACLE QUI DÉGAGE (166, duel.tacleDegage) : la prise n'est propre qu'à la garde
  if (tacleDegage(st, q, cfg)) return;
  receive(st, q.id, cfg);          // → turnover : amorti nommé (résiduel ~20 %), possession déclarée
}

// ==== LES GESTES TECHNIQUES : le ballon manipulé SANS le libérer. Trois lois : (1) déclenchement SITUÉ,
// refus NOMMÉ ; (2) la MÊME machine que les frappes (armé volable, contact, accompagnement, abort nommé) ;
// (3) le couple corps-ballon SOUDÉ (carry servo). La fréquence : persona.flair sous cooldowns — un événement, pas un tic.

export const skillInternals = { maybeRateau, maybeFeinte, maybeSemelle, maybePassement, maybeCrochet, maybeDoubleContact, maybePetitPont, maybeRoulette, maybeFeinteFrappe, skillContactNow };
export const simInternals = { beginPass: (...a) => beginPass(...a), strikeNow: (...a) => strikeNow(...a), receive: (...a) => receive(...a), chargeStep: (...a) => chargeStep(...a), slideTackleStep: (...a) => slideTackleStep(...a), choosePass: (...a) => choosePass(...a) };

/** Give the ball to `id`. A team-mate taking it keeps possession — only the INTENDED receiver
 *  scores the pass; any other shirt-mate is a scuffed ball kept in the family. Opponent = turnover. */
const dW = (st, cfg, k) => (st.full && cfg.amortiSpin !== false ? [-st.ball.w[0] * k, -st.ball.w[1] * k, -st.ball.w[2] * k] : null); // l'amorti amortit AUSSI la rotation (lot 54 — le spin orphelin ; doc : match-config)
function receive(st, id, cfg = RONDO) {
  const p = st.players[id];
  // LE SIFFLET DE LA LOI 11 : photographié hors-jeu au départ (st.pass.off), son PREMIER toucher
  // est l'infraction — le drapeau se lève ICI, l'administration est le métier du match
  // (st._whistle). La position n'est pas une faute, la participation l'est ; le toucher
  // s'accomplit, le jeu s'arrête une image plus tard, comme sur un vrai terrain.
  if (st.pass?.off?.[id] && cfg.offside && st.full && !st.restart) {
    st.events.push({ t: +st.t.toFixed(2), type: 'hors-jeu', by: id, at: st.pass.off[id], p: [+p.p[0].toFixed(2), +p.p[2].toFixed(2)] });
    st._whistle = { p: [p.p[0], p.p[2]], team: p.team === 0 ? 1 : 0 };
  }
  // un ballon encore PORTÉ par un autre change de mains ici : la sortie se nomme (vol de balle)
  if (st.ball.owner != null && st.ball.owner !== id) st.ball.release('perte');
  if (p.team === st.possession.team) {
    // LA PREMIÈRE INTENTION (une-touche — lot 44 pressée, lot 49 au calme par l'axe de
    // style) : extraite dans premiere-intention.js au plafond de volumétrie — le ballon
    // repart SANS être possédé (le patron de la remise de tête), doc et lois là-bas.
    if (uneTouche(st, p, cfg)) return;
    if (st.pass && st.pass.to === id) {
      st.passes++; st.best = Math.max(st.best, st.passes);
      st.events.push({ t: +st.t.toFixed(2), type: 'receive', by: id, count: st.passes });
    } else st.events.push({ t: +st.t.toFixed(2), type: 'loose-kept', by: id });
    // l'origine de conduite (lot 92) tient tant que le porteur ne change pas (chaque touche re-passe ici)
    if (st.possession.carrier !== id || !p._takeP) p._takeP = [p.p[0], p.p[2]];
    st.possession.carrier = id; st.phase = 'carry'; st.pass = null;
    st.hold = 0; st.pressure = 0;
    p.intent = null; p.anchorHint = null;  // une possession neuve décide pour elle-même — plan ET cap (le hint survivant pilotait vers l'ancre d'un autre monde)
    // LE GARDIEN PREND À DEUX MAINS : sa prise est un CATCH (les gardiens n'existent pas au
    // rondo) ; le tir DANS LE CORPS à hauteur de poitrine : le buste ENCAISSE (lot 93).
    if (p.keeper) {
      if (st.full && cfg.parades !== false && busteBlock(st, p, cfg)) return;
      st.ball.impulse([-st.ball.v[0] * 0.92, -st.ball.v[1] * 0.6, -st.ball.v[2] * 0.92], dW(st, cfg, 0.92));
      if (st.ball.owner !== id) st.ball.possess(id);
      st.events.push({ t: +st.t.toFixed(2), type: 'control', by: id, tech: 'prise-gardien', foot: 'both',
        surface: 'hands', speed: +Math.hypot(st.ball.v[0], st.ball.v[2]).toFixed(1), settle: null });
      return;
    }
    // WHICH CONTROL. A ball arriving on the left is taken with the left foot, or with the outside of
    // the right — the technique table decides from the geometry, and the choice is recorded so the
    // catalogue can rule on it. A ball nobody has a legal control for is simply not controlled: it
    // runs, and that is a loose ball, which is correct football rather than a magic first touch.
    const sit = situation(p.p, p.yaw, st.ball.p, st.ball.v, st.ball.p[1]);
    const pick = chooseTechnique(sit, 'control')[0];
    if (pick) {
      p.foot = pick.foot;
      // A CONTROL BRINGS THE BALL TO THE FOOT (damping alone stopped it dead a metre away — the
      // ball must END UP at your feet, that is the gesture). AND IT IS DIRECTIONAL: settling on
      // the CURRENT facing pointed back at the passer (ball behind the man 55 % of next strikes) —
      // a first touch is taken INTO the direction you intend to go, away from the nearest opponent.
      const mv = MOVE_TIMING[pick.tech.clip];
      const T = Math.max(0.12, (mv?.duration ?? 0.5) - (mv?.contact ?? 0.2));
      const foe = st.players.filter((q) => q.team !== p.team && q.down <= 0)
        .reduce((b, q) => (!b || d2(q.p, p.p) < d2(b.p, p.p) ? q : b), null);
      let tx = Math.cos(p.yaw), tz = Math.sin(p.yaw);
      if (foe) {
        const ax = p.p[0] - foe.p[0], az = p.p[2] - foe.p[2], al = Math.hypot(ax, az) || 1;
        tx = ax / al; tz = az / al;
      }
      p.yawWant = Math.atan2(tz, tx);              // he turns ONTO it — movePlayers slews, never snaps
      const lat = pick.foot === 'left' ? 1 : -1;               // left of forward is (fz, -fx) here
      // UN CONTRÔLE EST UNE IMPULSION, PAS UNE TÉLÉPORTATION. C'était le pire des cinq sites : 208
      // sauts par partie, 0,93 m en moyenne et 1,70 m au pire — le ballon APPARAISSAIT au pied. Un
      // vrai contrôle amortit le ballon et l'envoie où le joueur le veut ; il y ARRIVE pendant
      // l'accompagnement du geste, qui dure justement ce qu'il faut. `solveGroundLeg` inverse la
      // balistique au sol sur ball.js lui-même (roulement + traînée), donc la vitesse donnée produit
      // vraiment la distance voulue dans le temps voulu.
      // ON VISE OÙ LE PIED SERA, PAS OÙ IL EST. Le ballon met le temps de l'accompagnement à arriver ;
      // pendant ce temps le joueur a couru. Viser sa position actuelle, c'est poser le ballon là où il
      // ÉTAIT — ce qui se voit exactement comme le défaut d'origine, en moins brutal.
      // …À 0,65 DE LA VITESSE, PAS 1,0 : le receveur DÉCÉLÈRE dans sa réception (l'amorti d'arrivée
      // de movePlayers freine en approchant la cible), donc projeter sa vitesse INSTANTANÉE sur
      // toute la durée du geste vise au-delà de lui — mesuré sur 6 graines : 5,2 % de contrôles
      // finissant à plus d'un mètre, tous entre 1,0 et 1,2 m (le ballon dépasse l'homme qui
      // ralentit). Le facteur est balayé, pas choisi : 1,0 → 5,2 %, 0,65 → 2,9 %, 0,45 → 3,7 %
      // (trop court fait l'erreur inverse). 0,65 ≈ la vitesse moyenne d'un freinage linéaire.
      // LA CAPTURE — LE PORTÉ COMMENCE ICI. Le contrôle ne calcule plus une livraison vers le point
      // où le pied SERA (solveGroundLeg : quatre correctifs successifs, la mène 0,65 balayée, 3-9 %
      // de dette control-at-foot — toute la négociation) : il PREND le ballon. L'amorti tue la
      // vitesse incidente (l'impulsion, le geste réel), possess() déclare la possession, et le
      // PORTÉ (carry vers le point du pied, chaque image de la phase carry) amène le ballon au pied
      // PAR l'intégrateur — continu, borné, et contestable à tout instant (release('contesté')).
      // La touche directionnelle survit entière : yawWant tourne le corps hors du presseur, et le
      // point du pied suit ce regard — le ballon vient AVEC la rotation, comme un vrai contrôle
      // orienté.
      // LE POIDS DE LA PASSE SE PAIE AU CONTRÔLE : le résiduel d'amorti croît avec la vitesse
      // d'arrivée (une passe douce se pose, une fusée REBONDIT du pied — mesuré avant : douce
      // p50 0,22 m, fusée 0,29 — quasi identiques, le poids n'existait pas), et l'assise prend
      // plus longtemps. Amplification bornée (×2,6 max) : le contrôle reste un geste maîtrisé,
      // pas une roulette.
      // LE POIDS DE LA PASSE SE PAIE AU CONTRÔLE — et il se paie en RISQUE, pas en lenteur (la
      // première version allongeait l'assise : mesurée engloutie par l'urgence, une ombre). Un
      // ballon au-delà de ~10 m/s peut ÉCHAPPER à la touche : le contrôle est manqué, le ballon
      // reste LIBRE avec son résiduel — contestable, exactement ce qu'un défenseur attend d'une
      // passe trop appuyée. Le taux suit la vitesse et la précision de la surface (accuracy), le
      // tirage est seedé (le hasard de la partie, pas un dé caché).
      const arr = Math.hypot(st.ball.v[0], st.ball.v[2]);
      const pMiss = Math.max(0, Math.min(0.35, (arr - 10) * 0.07 / Math.max(0.5, pick.tech.accuracy * (p.skill?.controlF ?? 1))));
      if (pMiss > 0 && (st.rnd ? st.rnd() : 0.5) < pMiss) {
        deny(st, 'contrôle-manqué');
        st.ball.impulse([-st.ball.v[0] * 0.62, -st.ball.v[1] * 0.8, -st.ball.v[2] * 0.62], dW(st, cfg, 0.62));
        st.events.push({ t: +st.t.toFixed(2), type: 'control', by: id, tech: pick.tech.id, foot: pick.foot,
          surface: pick.surface, speed: +arr.toFixed(1), miss: true, settle: null });
        // LE CONTRÔLE RATÉ TUE LA PASSE (lot 44, st.full — capture utilisateur : le receveur
        // du long ballon restait PLANTÉ, ciblé sur son ancien point de chute par st.pass
        // vivant, pendant que l'adversaire prenait sa touche fuyante). La livraison est MORTE
        // — ballon libre — et le fautif CHASSE sa touche (réflexe lossReact). Le rondo garde
        // son monde d'hier au bit près (doctrine).
        if (st.full) {
          st.pass = null; st.phase = 'loose'; st.possession.carrier = -1;
          if (cfg.lossReact) (st._lossAt ??= {})[id] = st.t;
        }
        return;                                                    // pas de possession : la touche a fui
      }
      st.ball.impulse([-st.ball.v[0] * (1 - pick.tech.power), -st.ball.v[1], -st.ball.v[2] * (1 - pick.tech.power)], dW(st, cfg, 1 - pick.tech.power));
      st.ball.possess(id);
      st._settling = { ev: st.events.length, id, at: st.t + T };
      st.events.push({
        t: +st.t.toFixed(2), type: 'control', by: id, tech: pick.tech.id, foot: pick.foot, surface: pick.surface,
        bearing: +sit.bearing.toFixed(1), side: sit.side, dist: +sit.dist.toFixed(2), height: +sit.height.toFixed(2),
        speed: +Math.hypot(st.ball.v[0], st.ball.v[2]).toFixed(1),
        // OÙ LE BALLON A FINI, relativement au joueur — le nombre que la règle juge. Il n'existe PAS
        // encore à cet instant : le contrôle est devenu continu, le ballon met l'accompagnement du
        // geste à arriver. L'inscrire maintenant, ce serait inscrire l'intention à la place du
        // résultat (mesuré : 0,8 m au contact contre 0,36 m à l'arrivée). Il est rempli plus bas,
        // quand le ballon est vraiment arrivé.
        settle: null,
      });
    } else {
      // LE CÔNE AVANT D'ABORD (lot 70, cfg.priseCone — doc dansCone/match-config) : hors cône en
      // match, PAS de touche — le ballon COURT (le pivot en cours reprend à la capture ; le vrai dos se chasse)
      if (st.full && cfg.priseCone !== false && !dansCone(p.yaw, p.p[0], p.p[2], st.ball.p[0], st.ball.p[2], cfg.priseCone ?? 100)) {
        deny(st, 'controle-dos'); st.pass = null; st.phase = 'loose'; st.possession.carrier = -1; return;
      }
      // L'AMORTI DE POURSUITE (lot 52, st.full) : non contesté → la touche ÉCRASE (doc match-config, NOTES 88)
      const AP = st.full ? cfg.amortiPoursuite : null;
      const foeAP = AP ? Math.min(...st.players.filter((q) => q.team !== p.team && q.down <= 0).map((q) => d2(q.p, st.ball.p)), 99) : 99;
      if (AP && foeAP > cfg.contestRadius) {
        st.ball.impulse([-st.ball.v[0] * AP, -st.ball.v[1] * 0.6, -st.ball.v[2] * AP], dW(st, cfg, AP));
        st.events.push({ t: +st.t.toFixed(2), type: 'control', by: id, tech: 'amorti-poursuite', foot: 'any',
          surface: 'sole', speed: +Math.hypot(st.ball.v[0], st.ball.v[2]).toFixed(1), settle: null });
      } else { st.ball.impulse([-st.ball.v[0] * 0.25, 0, -st.ball.v[2] * 0.25], dW(st, cfg, 0.25)); if (st.full) st.events.push({ // la touche muette se nomme (lot 54)
        t: +st.t.toFixed(2), type: 'control', by: id, tech: 'quart-de-touche', foot: 'any', surface: 'sole', speed: +Math.hypot(st.ball.v[0], st.ball.v[2]).toFixed(1), settle: null }); }
    }
  } else {
    // LE CÔNE VAUT AUSSI POUR L'ADVERSAIRE (lot 71, contrat zéro-contact-fantôme) : une
    // interception/récupération est une touche de PIED — dos = le ballon file, le vol continue
    if (st.full && cfg.priseCone !== false && !dansCone(p.yaw, p.p[0], p.p[2], st.ball.p[0], st.ball.p[2], cfg.priseCone ?? 100)) { deny(st, 'controle-dos'); return; }
    // LA CAUSE DIT LE GESTE : une interception prend un ballon en vol, un tacle prend le ballon d'un
    // porteur (duel debout ou glissade — la clause 10 de checkRondo exige l'événement physique
    // correspondant), une récupération ramasse un ballon LIBRE au sol — trois football différents,
    // et l'ancien étiquetage « tackle » pour un ramassage de ballon perdu mentait sur les deux.
    turnover(st, id, st.phase === 'flight' ? 'interception' : st.phase === 'loose' ? 'récupération' : 'tackle', cfg);
  }
}

/**
 * THE SLIDE TACKLE — the action that was missing. A ball running loose beyond anyone's standing reach
 * could not be attacked at all: the game simply waited for someone to walk into it. A slide is the
 * only way to reach a ball 1 to 3 metres away, and it is a COMMITMENT — you go to ground, and if you
 * do not get it you are out of the play while you get up. That cost is what makes it a decision
 * rather than a free extra metre of reach.
 */
/** LA RÉSOLUTION D'UN GLISSÉ sur ballon libre — partagée entre l'instantané (réduit, le monde
 *  d'hier au bit près) et le CONTACT différé (match, lot 51) : l'événement, la prise (release +
 *  receive), le poke vers un partenaire debout, la phase loose du corps couché. */
function resoudreGlisse(st, cfg, p, pick, sit, dEvent, dPoke, won) {
  st.events.push({
    t: +st.t.toFixed(2), type: 'slide', by: p.id, won, tech: 'tacle-glisse', foot: pick.foot, surface: pick.surface,
    // l'événement dit QUI a glissé et QUI avait le ballon : la clause de discipline de checkRondo le lit — et son sabotage l'injecte
    team: p.team, atk: st.possession.team,
    bearing: +sit.bearing.toFixed(1), side: sit.side, dist: +dEvent.toFixed(2), height: +st.ball.p[1].toFixed(2),
    speed: +Math.hypot(st.ball.v[0], st.ball.v[2]).toFixed(1),
  });
  if (!won) return;
  // Un tacle ne fait pas APPARAÎTRE le ballon près du tacleur : le pied le RENVOIE — une
  // impulsion, dont l'intégrateur fait une course. Le poke vise un PARTENAIRE DEBOUT (sans
  // lui : à l'opposé de l'adversaire), et un ballon gagné au sol est LOOSE, pas porté (le
  // tacleur purge sa glissade — le 50/50 du vrai football).
  st.ball.release('perte');                  // un tacle qui gagne PREND — la sortie du porté se nomme
  receive(st, p.id, cfg);                       // bookkeeping: possession, turnover count, sequence reset
  const mate = st.players.filter((q) => q.team === p.team && q.id !== p.id && q.down <= 0)
    .reduce((b, q) => (!b || d2(q.p, st.ball.p) < d2(b.p, st.ball.p) ? q : b), null);
  const foe = st.players.filter((q) => q.team !== p.team && q.down <= 0)
    .reduce((b, q) => (!b || d2(q.p, st.ball.p) < d2(b.p, st.ball.p) ? q : b), null);
  let ux = 0, uz = 0;
  if (mate) { ux = mate.p[0] - st.ball.p[0]; uz = mate.p[2] - st.ball.p[2]; }
  else if (foe) { ux = st.ball.p[0] - foe.p[0]; uz = st.ball.p[2] - foe.p[2]; }
  else { ux = p.p[0] - st.ball.p[0]; uz = p.p[2] - st.ball.p[2]; }
  const ul = Math.hypot(ux, uz) || 1;
  const back = Math.min(3.2, dPoke / 0.28);
  st.ball.impulse([(ux / ul) * back - st.ball.v[0], -st.ball.v[1], (uz / ul) * back - st.ball.v[2]]);
  if (p.down > 0) { st.phase = 'loose'; st.pass = null; st.possession.carrier = -1; st.hold = 0; st.pressure = 0; }
}

/** LE CONTACT DU PLONGEON (lot 51, match — « le ballon part dans le sens opposé tout seul ») :
 *  le plongeon PART au déclenchement (trySlide — corps au sol, cooldowns), le ballon se joue
 *  quand le pied ARRIVE (~0,1-0,4 s), géométrie RE-JUGÉE — un ballon parti, pris ou monté fait
 *  un plongeon dans le VIDE. Appelé CHAQUE image (rondoStep — trySlide ne tourne qu'en carry,
 *  un contact en attente doit résoudre dans TOUTES les phases). Aucun _slideL hors match. */
function resolveSlideL(st, cfg) {
  for (const p of st.players) {
    const gL = p._slideL;
    if (!gL || st.t < gL.at) continue;
    const d = d2(p.p, st.ball.p);
    const touche = d <= 1.0 && st.ball.p[1] < 0.6 && st.ball.owner == null;
    // le pied BALAYE pendant la glisse — le contact se prend dans la fenêtre [at ; until]
    if (!touche && st.t < (gL.until ?? gL.at)) continue;
    p._slideL = null;
    const rival = st.players.filter((q) => q.team !== p.team && q.down <= 0)
      .reduce((b, q) => (!b || d2(q.p, st.ball.p) < d2(b.p, st.ball.p) ? q : b), null);
    const won = touche && (!rival || d2(rival.p, st.ball.p) > cfg.receiveRadius);
    resoudreGlisse(st, cfg, p, gL.pick, gL.sit, d, d, won);
  }
}

function trySlide(st, cfg) {
  // WHEN. Not at a pass in flight (interception's job — 157/90 s otherwise) : a slide is for a STRAYED ball, which keeps it rare enough to read.
  const car = st.possession.carrier >= 0 ? st.players[st.possession.carrier] : null;
  const strayed = car ? d2(car.p, st.ball.p) > cfg.strikeReach : true;
  if (!strayed) return;
  if (st.ball.owner != null) return;                            // un ballon PORTÉ se dispute debout (le duel), pas au sol
  if (st.ball.p[1] > 0.4) return;                               // you do not slide at a ball in the air
  if (Math.hypot(st.ball.v[0], st.ball.v[2]) > cfg.slideMaxBall) return;   // nor at one going too fast to win
  // A SLIDE IS A LAST RESORT, not a longer reach (anyone-in-range going down = 182 slides in 90 s,
  // possession 18 passes → 4). You slide when you are LOSING THE RACE to an opponent — everything
  // else is a normal run.
  // …ET C'EST UN GESTE DÉFENSIF (mesuré : 9,4/min dont 69 % par l'équipe en possession — or un
  // porteur POURSUIT sa touche échappée, il ne se couche pas). Seuls les défenseurs se jettent,
  // une fois par slideCooldown, et seulement s'ils perdent NETTEMENT la course (slideMargin 0,4).
  let best = null;
  for (const p of st.players) {
    if (p.down > 0 || p.act) continue;
    if (p.team === st.possession.team) continue;                         // le tacle glissé est défensif
    if ((p.slideCd ?? -1) > st.t) continue;                              // il vient déjà de se jeter
    const d = d2(p.p, st.ball.p);
    if (d < cfg.slideRange[0] || d > cfg.slideRange[1]) continue;
    const mine = st.players.filter((q) => q.team === p.team && q.id !== p.id && q.down <= 0);
    const foes = st.players.filter((q) => q.team !== p.team && q.down <= 0);
    if (mine.some((q) => d2(q.p, st.ball.p) < d)) continue;              // a team-mate is nearer: his ball
    const rival = foes.reduce((b, q) => (!b || d2(q.p, st.ball.p) < d2(b.p, st.ball.p) ? q : b), null);
    if (!rival) continue;
    const dRival = d2(rival.p, st.ball.p);
    // he only goes down if staying up loses it: the opponent is closer, or close enough to arrive first
    if (dRival > d - cfg.slideMargin) continue;
    // …mais pas si l'adversaire A DÉJÀ le ballon au pied : plonger sur un ballon contrôlé n'a plus
    // rien à disputer — c'était la moitié du spam résiduel mesuré (3-6/min malgré cooldown+marge)
    if (dRival < 0.55) continue;
    // …et pas non plus si la menace n'est pas IMMINENTE : l'adversaire à plus d'un pas et demi du
    // ballon laisse le temps de défendre debout — le plongeon préventif était le reste du spam
    if (dRival > 1.6) continue;
    if (!best || d < best.d) best = { p, d, dRival };
  }
  if (!best) return;
  const p = best.p;
  // UN SEUL PLONGEON PAR BALLON. Mesuré (seed 1) : trois défenseurs de la même équipe au sol sur le
  // MÊME ballon en 0,3 s — le cooldown par joueur ne voit pas les coéquipiers, et un coéquipier DÉJÀ
  // couché ne compte plus comme « plus proche » (filtre down). Le ballon qu'un partenaire attaque au
  // sol est SON ballon : l'équipe espace ses plongeons.
  const lastSlide = (st._slideT ??= {})[p.team] ?? -99;
  if (st.t - lastSlide < 4) return;
  const sit = situation(p.p, p.yaw, st.ball.p, st.ball.v, st.ball.p[1]);
  const pick = chooseTechnique(sit, 'win', { bias: { 'tacle-glisse': 1 } })[0];
  if (!pick || pick.tech.id !== 'tacle-glisse') return;
  // LE COULOIR (ballon PRÉDIT à mi-fenêtre — l'instantané a re-cassé au se-montrer 67a : 11 secs) ET LA COURSE SE LISENT DEBOUT (lot 66, doc ecartCouloir duel.js) ; predit:false = hier
  if (st.full && cfg.slideTackle?.predit !== false) {
    const tMid = Math.min(0.5, (Math.min(0.4, Math.max(0.1, (best.d - 0.35) / 5)) + 0.55) / 2);
    if (ecartCouloir(p, predictPath(st.ball.snapshot(), { maxT: tMid + 0.05 })[Math.round(tMid * 60)]?.p ?? st.ball.p) > 0.85
      || (best.d - 0.35) / 5 > best.dRival / 2.5 + 0.1) return;
  }
  p.slideCd = st.t + cfg.slideCooldown;                        // gagné ou perdu : pas deux plongeons de suite
  st._slideT[p.team] = st.t;
  // le temps au sol n'est plus une constante d'horloger (mesuré : 1,200 s pile sur chaque tacle,
  // référence réelle 0,5-1 s) — variance seedée ±10 % autour de slideRecovery
  p.down = cfg.slideRecovery * (0.9 + 0.2 * (st.rnd ? st.rnd() : 0.5));  // he is on the ground either way
  // LE MATCH JOUE LE CONTACT (lot 51) : le pied arrive dans ~0,1-0,4 s, la géométrie re-jugée
  // au sommet de trySlide — le réduit garde l'instantané d'hier, au bit près (doctrine st.full).
  if (st.full) {
    p._slideL = { at: st.t + Math.min(0.4, Math.max(0.1, (best.d - 0.35) / 5)), until: st.t + 0.55, pick, sit };
    const vL = Math.hypot(p.v[0], p.v[1]);
    const dirL = vL > 0.5 ? [p.v[0] / vL, p.v[1] / vL] : [Math.cos(p.yaw), Math.sin(p.yaw)];
    p._glisse = { v: [dirL[0] * Math.max(4, vL), dirL[1] * Math.max(4, vL)] };   // la glissade porte le corps
    return;
  }
  // he gets there if he is genuinely the first: an opponent already on the ball wins the duel
  const rival = st.players.filter((q) => q.team !== p.team && q.down <= 0).reduce((b, q) => (d2(q.p, st.ball.p) < d2(b.p, st.ball.p) ? q : b), st.players.find((q) => q.team !== p.team));
  const won = !rival || d2(rival.p, st.ball.p) > cfg.receiveRadius;
  resoudreGlisse(st, cfg, p, pick, sit, sit.dist, best.d, won);
}

/**
 * Advance the whole game by `dt`.
 * @param {object} st  state from makeRondo()
 */
export function rondoStep(st, dt, cfg = RONDO) {
  st.t += dt;
  (cfg.assignJobs ?? assignJobs)(st, cfg);   // le match branche ici son attribution directionnelle
  // LA LATENCE DE PERCEPTION — mesurée avant : 10 % des défenseurs re-ciblaient dans l'IMAGE du
  // départ de passe (17 ms — surhumain). Après l'événement-surprise, un adversaire du porteur
  // GARDE sa cible d'avant le temps de sa réaction résiduelle : il court sur l'ancienne image du
  // monde, comme un vrai défenseur surpris. Son équipe à lui SAIT ce qu'elle joue (pas de délai).
  if (st._surprise) {
    for (const p of st.players) {
      // QUI REGARDAIT ? La politique de regard (gaze.js) donne ~65 % des hors-ballon les yeux sur
      // le ballon — CEUX-LÀ ont vu l'armé et le déduisent de leur réaction ; les ~35 % qui
      // SCANNAIENT ailleurs paient leur réaction PLEINE. Part HACHÉE (joueur × passe), pas tirée :
      // le flux seedé de la partie ne bouge pas d'un bit. Une claquette (seen = 0) surprend tout
      // le monde. Première version sans le regard : l'armé vu annulait le délai de TOUTES les
      // passes — la loi ne mordait que sur les claquettes, mesuré p10 = 0 ms sur l'urgence.
      const k = ((p.id * 7919 + (st._surprise.n ?? 0) * 104729) % 97) / 97;
      const scanning = k < 0.35;
      const base = p.skill?.reaction ?? p.persona?.reaction ?? 0.2;
      const rt = scanning ? base : Math.max(0, base - (st._surprise.seen ?? 0));
      if (p.team !== st.possession.team && !p.keeper && st.t - st._surprise.t < rt) {
        if (p._heldT) p.target = p._heldT;
      } else p._heldT = p.target ? [...p.target] : null;
    }
  }
  movePlayers(st, dt, cfg);
  slideResolve(st, cfg);               // le contact du glissé sur porteur (lot 51) — duel.js
  resolveSlideL(st, cfg);              // …et sur ballon libre (aucun _slideL hors match)
  stepGestures(st, dt, cfg);           // swings run on their own clock, outside the phase machine
  // les contraintes du monde se projettent APRÈS toutes les autorités (locomotion PUIS glissement
  // d'armé) — projetées avant, le dernier écrivain les défaisait (voir separatePlayers)
  separatePlayers(st, cfg);
  // LA MESURE DU CONTRÔLE ARRIVE QUAND LE BALLON ARRIVE. Un contrôle continu n'a pas de résultat à
  // l'instant du contact ; l'écrire là reviendrait à noter l'intention. On remplit l'événement quand
  // le geste est fini, c'est-à-dire quand le fait existe.
  if (st._settling && st.t >= st._settling.at) {
    const pl = st.players[st._settling.id];
    const ev = st.events[st._settling.ev];
    if (pl && ev) {
      // LA MESURE EST CONSCIENTE DE LA POSSESSION. Un ballon encore PORTÉ à la fin de la fenêtre
      // du contrôle se juge (et le porté rend la règle structurelle : il est au pied par carry) ;
      // un ballon qui n'est PLUS à lui a été relâché à cause nommée — frappé (la trace l'a montré :
      // capture 0,82 → 0,26 m, armé soudé, passe partie AVANT la fin de la fenêtre — un
      // enchaînement une-touche légitime que l'ancienne mesure comptait comme un contrôle mort à
      // 1,29 m), contesté, ou perdu — et CE contrat-là l'a jugé. Un instant, un contrat ;
      // l'exemption reste bornée dans le harnais.
      if (st.ball.owner === st._settling.id) ev.settle = +d2(pl.p, st.ball.p).toFixed(2);
      else ev.oneTouche = true;
    }
    st._settling = null;
  }

  if (st.phase === 'carry') {
    const c = st.players[st.possession.carrier];
    if (!c) { st.phase = 'loose'; return st; }

    // A GESTURE IN PROGRESS OWNS THE PLAYER. He has committed: he does not re-decide and he does not
    // dribble — he plants and swings, and the ball leaves at the CONTACT instant of that swing. The
    // gesture itself is advanced by stepGestures(), for every actor and in every phase, because a
    // follow-through does not stop because the ball has left.
    // …MAIS LE BALLON VIT PENDANT L'ACCOMPAGNEMENT. Un tacle-debout gagné fait du tacleur le porteur
    // pendant ~0,4 s de follow EN PHASE CARRY — un cas que le porteur-passeur ne produit jamais (sa
    // frappe bascule en flight). Pendant l'ARMÉ, l'autorité du ballon est stepGestures (porté au
    // point de stance) ; pendant le FOLLOW en carry, personne n'écrivait : le ballon gelait sur
    // place. Une autorité par phase : porté → carry au pied ; libre → physique.
    if (busy(c)) {
      st.hold += dt;
      if (c.act.fired) {
        // un geste ownsBody (râteau, semelle) écrit son ballon dans skillFollowStep — une autorité ;
        // la feinte, elle, garde le porté au pied ordinaire pendant sa rétraction
        if (c.act.payload?.ownsBody) { /* stepGestures possède corps et ballon */ }
        else if (st.ball.owner === c.id) st.ball.carry(footPoint(st, c, cfg), dt);
        else st.ball.integrate(dt);
      }
      return st;
    }

    // LE TENU DU GARDIEN (hook heldBall — match, lot 91) : après la prise, le ballon vit aux
    // GANTS tant que le corps se relève — ni conduite, ni duel sur un ballon tenu (Loi 12).
    if (cfg.heldBall?.(st, c, dt, cfg)) { st.hold += dt; return st; }

    // the carrier really dribbles: touches, the ball free in between (dribble.js)
    if (!st._drb) st._drb = makeDribbler(st.full && cfg.prise !== false ? { prise: cfg.prise ?? 0.62 } : {}); // la touche au pied (lot 58) — doc : match-config
    // where the BALL should be pushed — the escape direction assignJobs computed, not the direction of
    // the player's own next step (those differ: he stands behind the ball, so his step is toward it)
    let want = c.push || (c.target ? (() => {
      const dx = c.target[0] - c.p[0], dz = c.target[2] - c.p[2], l = Math.hypot(dx, dz) || 1;
      return [dx / l, dz / l];
    })() : [Math.cos(c.yaw), Math.sin(c.yaw)]);
    // LA CONDUITE RENTRE SES TOUCHES PRÈS DE LA CRAIE. La sortie de but était devenue la première
    // cause de perte (77/191 sur 8 graines), l'essentiel en phase carry : la poussée de conduite,
    // décidée sur l'évasion, shave la ligne et la touche suivante sort. À moins de 1,3 m de la
    // ligne, la demande de poussée est mélangée vers l'intérieur — le geste d'un joueur réel qui
    // garde son ballon en jeu.
    {
      const mX = st.area[0] / 2 - Math.abs(st.ball.p[0]);
      const mZ = st.area[1] / 2 - Math.abs(st.ball.p[2]);
      let wx2 = want[0], wz2 = want[1];
      if (mX < 1.3) { const k = (1.3 - mX) / 1.3; wx2 = wx2 * (1 - k) - Math.sign(st.ball.p[0]) * k; }
      if (mZ < 1.3) { const k = (1.3 - mZ) / 1.3; wz2 = wz2 * (1 - k) - Math.sign(st.ball.p[2]) * k; }
      if (wx2 !== want[0] || wz2 !== want[1]) {
        const l2 = Math.hypot(wx2, wz2) || 1;
        want = [wx2 / l2, wz2 / l2];
      }
    }
    // `heading` here is the body's MOMENTUM, like evadeKeep — how the dribble model decides how hard a
    // touch may be. It read the facing, which was the drift until the carrier started facing his ball;
    // after that, heading and `want` became the same vector and every touch went full strength straight
    // down the push, so the ball simply outran a man capped at 4.2 m/s (`carry-reach` 0.4 % → 8.8 % of
    // carry frames with the ball beyond 3 m). Two consumers of yaw, one meaning changed, both to fix.
    const csp = Math.hypot(c.v[0], c.v[1]);
    const heading = csp > 0.4 ? [c.v[0] / csp, c.v[1] / csp] : [Math.cos(c.yaw), Math.sin(c.yaw)];
    // LE CÔNE DU PORTÉ (lot 76 — l'aimant : 18 % des touches au kick dos) : ni servo ni touche
    // hors du cône avant EN COURSE — le corps CONTOURNE son ballon ; à l'ARRÊT (< 1,5) la
    // semelle tourne avec (réel — sinon hold jamais > 0,6, zéro appel). Talent : ±7°. false : hier.
    const coneP = () => !st.full || cfg.porteCone === false || c.speed < 1.5
      || dansCone(c.yaw, c.p[0], c.p[2], st.ball.p[0], st.ball.p[2], (cfg.porteCone ?? 120) * (2 - (c.skill?.dribbleLeadF ?? 1)));
    const pl = { p: [c.p[0], c.p[2]], speed: c.speed, heading, want, turnRate: 0, leadF: c.skill?.dribbleLeadF,
      touchF: c.touchF, coneOk: coneP(),   // le RÉGIME de touche + le cône (posés par le match, absents au rondo)
      touchDamp: c.touchDamp,   // le canal VITESSE (l'amorti de préparation — posé par le match)
      space: Math.min(...st.players.filter((q) => q.team !== c.team && q.down <= 0).map((q) => d2(q.p, c.p)), 99) };
    pl.heading = dribbleSteer(st.ball, pl);
    // LE PORTÉ — la possession est un ÉTAT DU MOTEUR (ball-body : possess/carry/release), plus
    // une négociation (l'historique : quatre autorités en guerre ici, control-at-foot à 33 %).
    //   PORTÉ (owner = porteur) : le ballon converge vers le POINT DU PIED (carry, servo borné).
    //   CONDUITE : release('conduite') — touches réelles, ballon libre entre elles, interceptable.
    //   CONTESTÉ : release('contesté') — le duel se joue sur un ballon PHYSIQUE, le 50/50 est réel.
    //   Re-capture : intention formée + ballon au pied non contesté — possess() + porté.
    const foeBall = Math.min(...st.players.filter((q) => q.team !== c.team && q.down <= 0).map((q) => d2(q.p, st.ball.p)), 99);
    const contested = foeBall < cfg.contestRadius && foeBall < d2(c.p, st.ball.p) - cfg.contestSlack;
    const intentFresh = !!c.intent || (c.anchorHint && st.t - c.anchorHint.t < 0.4);
    const settling = st._settling && st.t < st._settling.at;
    if (st.ball.owner === c.id) {
      if (contested) {
        st.ball.release('contesté');
        { const rD = dribbleStep(st._drb, st.ball, pl, dt); if (rD.touched) touchEvent(st, c, rD.ev); }  // il tente de l'emmener hors du duel
      } else if (intentFresh || settling) {   // porté — le rassemblement > 0,45 m COURBE (lot 62, st.full), il ne claque pas
        // …avec une GRÂCE (0,3 s de servo MOU hors cône) : l'approche de frappe ARQUE autour du
        // ballon — traverser le dos est un pas, l'ORBITE durable non (strict : 55 tirs/70 A/B).
        if (coneP()) { c._dosT = 0; st.ball.carry(footPoint(st, c, cfg), dt, st.full && d2(c.p, st.ball.p) > 0.45 ? { tau: 0.12, vMax: 6.5 } : {}); }
        else if ((c._dosT = (c._dosT ?? 0) + dt) <= (cfg.porteDosGrace ?? 0.3)) st.ball.carry(footPoint(st, c, cfg), dt, { tau: 0.25, vMax: 4 });
        else { deny(st, 'porte-dos'); st.ball.release('porte-dos'); }   // l'orbite durable : le ballon vit, le corps se retourne
      } else {
        st.ball.release('conduite');
        { const rD = dribbleStep(st._drb, st.ball, pl, dt); if (rD.touched) touchEvent(st, c, rD.ev); }
      }
    // LE RAMASSAGE DU BALLON MORT (lot 107, cfg.ramasse && st.full — « des ballons qui traînent » :
    // mesuré, des loose de 2+ s avec un corps à 0,1 m — la re-capture exigeait une INTENTION ;
    // le vrai joueur POSE le pied sur un ballon lent à portée). Le cône et le prenable tiennent.
    } else if ((intentFresh || (st.full && cfg.ramasse && !st.restart && Math.hypot(st.ball.v[0], st.ball.v[2]) < (cfg.ramasse.v ?? 1.5)
      && dansCone(c.yaw, c.p[0], c.p[2], st.ball.p[0], st.ball.p[2], cfg.ramasse.cone ?? 80))) && !contested && d2(c.p, st.ball.p) < cfg.captureRadius && (!st.full || cfg.prisePied === false || balPrenable(st.ball, c.p[0], c.p[2], cfg.prisePied ?? 0.5)) && (!st.full || cfg.priseCone === false || dansCone(c.yaw, c.p[0], c.p[2], st.ball.p[0], st.ball.p[2], cfg.priseCone ?? 100))) {
      st.ball.possess(c.id);
      // …le ramassage SE POSE (lot 107 — sans ça la branche du porté re-lâchait la frame d'après, cap non aligné : touches dos) ; jamais pendant une remise (le taker court-circuitait le CF).
      if (st.full && cfg.ramasse && !intentFresh) st._settling = { ev: st.events.length, id: c.id, at: st.t + (cfg.ramasse.pose ?? 0.3) };
      st.ball.carry(footPoint(st, c, cfg), dt, st.full && d2(c.p, st.ball.p) > 0.45 ? { tau: 0.12, vMax: 6.5 } : {});
    } else {
      const rD = dribbleStep(st._drb, st.ball, pl, dt); if (rD.touched) touchEvent(st, c, rD.ev);
    }
    // LE PIQUE (cfg.pokeReach, match) : un ballon de conduite LIBRE est libre AUSSI pour
    // l'adversaire — le pied qui l'atteint AVANT le porteur le dévie (poke tackle, sans duel de
    // corps). Mesuré sans lui : le plus proche défenseur passait à 0,70 m du ballon (p50 des
    // courses ≥ 6 m) sans AUCUN mécanisme pour le jouer — le tacle formel a ses fenêtres de
    // corps, le ballon entre deux touches n'avait pas de loi. Gates : le défenseur bat vraiment
    // le porteur au point (marge 0,15 m), ballon au sol, cooldown par pied (le pique est un
    // geste, pas un aimant).
    if (cfg.pokeReach && st.ball.owner == null && st.phase === 'carry' && st.ball.p[1] < 0.45
      && !(c.act && c.act.payload?.ownsBody)) {
      for (const q of st.players) {
        if (q.team === c.team || q.keeper || q.down > 0) continue;
        if ((q._pokeCd ?? -1) > st.t) continue;
        const dq = d2(q.p, st.ball.p);
        // …et la NOTE de tacle joue la portée du pique (loi attributs no 3 : la note agit sur
        // l'EXÉCUTION) — sans elle, un défenseur faible piquait comme un fort et ÉGALISAIT le
        // monde noté gratuitement (verdict attributs inversé mesuré : élite 16 tirs contre 27)
        if (dq < cfg.pokeReach + (q.skill?.tackleReach ?? 0) && dq < d2(c.p, st.ball.p) - 0.15) {
          // …et le pique SE RÉUSSIT à la note (loi attributs no 3) : un tackling bas manque son
          // pied une fois sur deux — sans ce tirage, le pique offrait des récupérations SANS
          // duel à l'équipe qui défend le plus, et le monde noté s'égalisait (61-69 mesuré,
          // l'élite dominait 40-32 avant le pique). Le raté a un coût : le cooldown court.
          const pokeSkill = 0.5 + 0.45 * Math.max(0, Math.min(1, ((q.skill ? (q.skill.tackleReach + 0.10) / 0.20 : 0.5))));
          if ((st.rnd ? st.rnd() : 0.5) > pokeSkill) { q._pokeCd = st.t + 0.9; continue; }
          const ux = st.ball.p[0] - q.p[0], uz = st.ball.p[2] - q.p[2];
          const ul = Math.hypot(ux, uz) || 1;
          // le pique TRAVERSE le ballon : déviation franche loin du pied qui pique — un 50/50
          st.ball.impulse([-st.ball.v[0] * 0.55 + (ux / ul) * 3.4, 0, -st.ball.v[2] * 0.55 + (uz / ul) * 3.4]);
          q._pokeCd = st.t + 1.2;
          st.lastTouch = q.team;
          st.events.push({ t: +st.t.toFixed(2), type: 'pique', by: q.id, sur: c.id, dist: +dq.toFixed(2) });
          st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
          return st;
        }
      }
    }

    trySlide(st, cfg);                       // a touch that got away can be taken off him
    if (st.phase !== 'carry') return st;      // …and if it was, the phase has already changed
    // UN BALLON AU-DELÀ DE LA PORTÉE DE CONDUITE N'EST PLUS PORTÉ — IL EST LIBRE, ET LA PHASE LE
    // DIT. Mesuré (carry-reach 1,2 % → 19,1 %) : après un tacle glissé perdu ou un renversement,
    // le « porteur » est AU SOL avec le ballon à 3 m ; la phase disait encore carry, or le vol de
    // balle exige la proximité du PORTEUR — le défenseur garé sur le ballon ne pouvait pas le
    // réclamer, et l'impasse durait des secondes, étiquetée possession. Le seuil est CELUI DE LA
    // RÈGLE (carryMax) : au-delà, l'étiquette est fausse — c'est un 50/50, la phase libre applique
    // le premier-arrivé et l'impasse se dissout.
    // …ET LA BASCULE LIT LA LOI DE TOUCHE (cfg.carryLawLoose, match — absent : le rayon plat du
    // rondo, au bit près). Une touche de course LÉGALE met le ballon à portée-de-pied +
    // touchDistance(v) + marge DEVANT le corps — exactement la fenêtre que le banc de conduite
    // reconnaît. La couper au rayon plat (3,0 m) arrachait l'étiquette au dribbleur en pleine
    // foulée, et la chasse du ballon libre transformait sa touche en 50/50 offert : mesuré,
    // 41 bascules sans événement / 4 matchs, 20 volées par l'adversaire, dont 4 touches
    // parfaitement légales — « le joueur en perd possession alors que ce n'est pas normal ».
    let looseAt = cfg.carryLoose;
    if (cfg.carryLawLoose && c.speed > 0.5) {
      const ahead = ((st.ball.p[0] - c.p[0]) * c.v[0] + (st.ball.p[2] - c.p[2]) * c.v[1]) / (c.speed || 1) > 0;
      if (ahead) looseAt = Math.max(cfg.carryLoose, 1.15 + touchDistance(c.speed) + 0.5);
      // …PLAFONNÉE en plein format (lot 37, retour utilisateur « le ballon paraît loin du
      // pied ») : à 4 m/s la fenêtre montait à 3,6 m devant — 12 épisodes de possession
      // fantôme à 1,8-2,9 m mesurés en 12 min, 11 en croisière. Au-delà de 2,2 m, le ballon
      // est LIBRE : un vrai 50/50 — la chasse (carrySurge) ne change pas, l'ÉTIQUETTE cesse
      // de mentir. Le réduit garde sa loi (st.full).
      if (st.full) looseAt = Math.min(looseAt, 2.2);
    }
    if (d2(c.p, st.ball.p) > looseAt) {
      st.ball.release('perte');
      st._exCarrier = { id: c.id, t: st.t };   // lot 104 : la conduite qui vient de fuir a un nom (lu sous cfg.tenue seulement)
      st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
      return st;
    }
    st.hold += dt;
    // LA PRESSION EST UN DUEL, PAS UNE MINUTERIE DE VOISINAGE. L'ancien prédicat (« 1,45 m du corps
    // pendant 0,5 s » → receive() instantané) était la cause n°1 de la non-forme du jeu : 54 % des
    // pertes sans AUCUN geste, gagnant jusqu'à 2,33 m du ballon, ballon gelé net à distance,
    // possession médiane 0,40 s (sonde duels-tacles). Le résultat négatif consigné ci-avant
    // (« exiger d'être plus près du ballon que le corps-bouclier → record 0 ») valait pour un monde
    // à tackleTime 0,5 SANS modèle de tacle : le bouclier demandait un modèle de tacle fait pour
    // lui, et c'est ce que le tacle-debout est. Le prédicat regarde le BALLON (pressPredicate :
    // contestRadius + shieldSlack), la minuterie s'engage dans un GESTE (beginStandTackle), le
    // transfert se joue au contact — mesuré après bascule : turnover toutes les ~11 s au lieu de
    // 1,6 s, et 0 flip sans événement physique (clause 10 de checkRondo).
    const press = pressPredicate(st, c, cfg);
    st.pressure = press.length ? st.pressure + dt : 0;
    if (st.pressure >= tacleHorloge(st, press[0], cfg) && tackleWindow(st, press[0], cfg, balPrenable)) beginStandTackle(st, press[0], c, cfg);
    // LE DUEL DE CORPS (cfg.charge && st.full — lot 32). Mesuré : l'adversaire vit à 1,28 m
    // MÉDIAN du porteur mais la pression ballon ne s'accumule que 2,4 % du portage (le
    // bouclier protège le BALLON — c'est son métier) → 1 duel / 9 min, un jeu sans contact.
    // Le football réel se joue AU CORPS : la charge d'épaule loyale (le ballon peut jaillir),
    // la charge PAR DERRIÈRE est une faute (Loi 12) ; un ballon jailli SORT du bloc de portage.
    if (cfg.charge && st.full) {
      chargeStep(st, c, dt, cfg);
      if (st.phase !== 'carry') return st;
    }
    // …et L'ACCROCHAGE DU BATTU (lot 97, cfg.accroche && loi12 — duel.js : LA source de fautes
    // du vrai football, le dépassé qui retient ; modulations tactique/rôle passées par le hook)
    if (st.full && cfg.accroche !== false && cfg.loi12 && !st._faute) cfg.accrocheMod ? cfg.accrocheMod(st, c, cfg) : accrocheStep(st, c, cfg);
    // …et le TACLE GLISSÉ SUR PORTEUR (cfg.slideTackle && st.full — lot 33) : le pari du
    // dernier recours. Le glissé sur ballon LIBRE existait (« un ballon qui traîne ») ; sur
    // porteur, la table technique juge la géométrie réelle — ballon pris, jambes fauchées
    // (faute, grave par derrière), ou glissade dans le vide. Le monde peut basculer : return.
    if (cfg.slideTackle && st.full) {
      slideTackleStep(st, c, cfg);
      if (st.phase !== 'carry') return st;
    }
    // release — but only off a ball the foot can actually reach. Striking a ball 2.8 m away was 17 %
    // of passes; the ball is not in front of him and the leg has nothing to hit.
    const reachNow = d2(c.p, st.ball.p) <= cfg.strikeReach;
    // …ET LA GÂCHETTE DU BUT NE DÉPEND PAS DU PIED (11c11) : en course poussée (carrySurge), le
    // ballon vit à 1,2-1,4 m DEVANT — reachNow n'est vrai qu'à l'INSTANT de la touche, et la
    // cadence de décision le rate : l'échappée ne PENSAIT jamais (mesuré : le porteur contesté
    // portait le ballon DANS le but — 12 buts / 16 tirs sur 4 matchs complets, ~la moitié en
    // conduite pure, des 2-2 systématiques ; trois greffes d'arbitre bit-identiques avant de
    // trouver CETTE serrure). Près du but, le bloc de décision s'ouvre aussi ballon-en-avant —
    // tryShot pose alors sa touche de préparation (lot 6a) et la frappe arme à la touche
    // suivante. Réduit et rondo : inchangés au bit près (st.full + cfg.tryShot).
    const gachetteNear = st.full && !!cfg.tryShot && !!st.pitch
      && Math.hypot(st.pitch.attackGoal(c.team).x - c.p[0], c.p[2]) < (cfg.shotRange ?? 15);
    // …et la GÂCHETTE DU CENTRE (lot 34) : l'ailier au couloir vit à ~21 m du centre du but —
    // gachetteNear ne s'ouvrait jamais pour lui, tryCross n'était JAMAIS appelé en course
    // (mesuré : 1 centre / 2 matchs malgré des portes géométriques élargies — la même serrure
    // que la découverte du lot 13 : instrumenter la BRANCHE). La géométrie de centre vivante
    // ouvre le bloc de décision, comme le but l'ouvre.
    const gachetteCentre = st.full && !!cfg.tryCross && !!st.pitch
      && c.p[0] * Math.sign(st.pitch.attackGoal(c.team).x || 1) > st.pitch.hx - st.pitch.dims.box.depth - 13
      && Math.abs(c.p[2]) > st.pitch.hz * 0.30;
    // THE WINDUP IS CARVED OUT OF THE HOLD, NOT ADDED TO IT. A first attempt at a windup simply
    // delayed every release by its length and the game fell apart — record 6, turnovers 25 → 103,
    // because every pass now had an extra beat for a defender to arrive in. The swing is not extra
    // time: it is the last part of the time he already had. He commits one anticipation EARLIER, so
    // the ball still leaves at holdMin. Same football, visible movement.
    // the earliest ANY gesture could need to start; beginPass then re-checks against the one it picked
    // DÉCIDER → PRÉPARER → S'ENGAGER, et la décision COLLE. Re-choisir la passe à chaque image
    // pendant que les portes disent non était un oscillateur, mesuré tel quel : le veto de course
    // bascule le receveur, outYaw saute, l'ANCRE passe de l'autre côté du ballon, et le corps —
    // piloté vers une cible qui change à 60 Hz — n'arrive jamais (refus d'ancre p50 = 1,02 m, sans
    // AUCUN progrès sur 1 637 refus ; pertes par tacle 67 → 182). Un joueur choisit SA passe puis
    // arrange ses appuis POUR ELLE : l'intention est adoptée une fois, elle pilote l'approche
    // jusqu'à s'engager — et elle ne meurt que de sa mort propre (course perdue, balistique nulle,
    // ou son délai : un plan qui n'a pas abouti en `intentTtl` est un plan mort, pas un dogme).
    // LA TENUE DÉLIBÉRÉE — le tempo d'un rondo n'est pas le minimum légal en boucle. Mesuré (sonde
    // tempo-espaces / premiere-touche) : hold p50 = 0,38 s (= holdMin + armé), 0-1,6 % des
    // inter-passes dans la bande 2-5 s du vrai rondo, contrôle→passe 0,39 s alors que 84 % des
    // réceptions se font SANS presseur à 1,5 m. Un porteur au calme (adversaire > calmFoe) tient son
    // ballon un temps tiré dans holdCalm — par st.rnd, le hasard SEEDÉ de la partie — avant
    // d'adopter une intention ; pressé, l'urgence garde ses droits (holdMin, improvisation).
    if (st._calmKey !== `${st.possession.carrier}:${st.turnovers}:${st.passes}`) {
      st._calmKey = `${st.possession.carrier}:${st.turnovers}:${st.passes}`;
      // × persona.calm : le posé et le vif ne tiennent pas le ballon pareil — l'identité au tempo
      { const hc = (st.full && cfg.holdCalmFull) || cfg.holdCalm; st._calmHold = (hc[0] + (st.rnd ? st.rnd() : 0.5) * (hc[1] - hc[0])) * (c.persona?.calm ?? 1) * axeTac(tacDe(st, c.team).tempo, 1.5, 0.5); }   // LE TEMPO (149) : la circulation vive raccourcit la tenue — 0,5 = ×1
    }
    const foeBody = Math.min(...st.players.filter((q) => q.team !== c.team && q.down <= 0).map((q) => d2(q.p, c.p)), 99);
    const calm = foeBody > cfg.calmFoe;
    // …et beginPass lit CE holdMin-là (la porte 'timing') : au calme la fenêtre s'étire à 0,8-1,0 s,
    // pressé elle retombe au holdMin d'origine — fixer puis donner.
    st._holdMin = calm ? Math.min(1.0, st._calmHold) : cfg.holdMin;
    // ON NE PASSE PAS UN BALLON QU'ON EST ENCORE EN TRAIN DE POSER : pas d'engagement avant la fin
    // de la fenêtre du contrôle + settleExtra (70 % des contrôles étaient refrappés avant la fin du
    // follow-through). L'urgence contestée, elle, joue quand même : le duel n'attend pas l'assise.
    const settleGate = st._settling && st._settling.id === c.id && st.t < st._settling.at + cfg.settleExtra;
    // LES NICHES DU 1c1, du plus spécifique au plus général (114-117) : le jeté franc se perfore (croqueta), le glisseur se traverse (pont), le poursuivant s'enroule (roulette) — sortie fermée : le râteau reprend
    if (!settleGate && maybeDoubleContact(st, c, cfg)) return st;
    if (!settleGate && maybePetitPont(st, c, cfg)) return st;
    if (!settleGate && maybeRoulette(st, c, cfg)) return st;
    // LE RÂTEAU AVANT QUE LE DUEL S'INSTALLE : presseur qui ferme la face, sortie arrière libre — on se retourne avec le pas d'avance (refus nommés sinon)
    if (!settleGate && maybeRateau(st, c, cfg)) return st;
    // le crochet coupe une COURSE fermée, le passement ment à un jockey POSTÉ — deux situations
    // disjointes du râteau (la charge frontale) ; leurs clés n'existent qu'au match
    // …le passement s'enchaîne LIBREMENT sur un contrôle (l'assise bloquait pile la fenêtre du jockey posté, 6 fenêtres/4 matchs)
    if (maybePassement(st, c, cfg)) return st;
    if (!settleGate && maybeCrochet(st, c, cfg)) return st;
    if (st.hold >= Math.max(0, cfg.holdMin - cfg.windupBudget) && (reachNow || gachetteNear || gachetteCentre) && (!settleGate || contested)) {
      // PENDANT UNE LIVRAISON (contrôle en route vers le pied), on planifie CONTRE LE POINT
      // D'ARRIVÉE — pas contre le ballon en voyage (le corps partait vers l'ancre d'un ballon
      // mouvant : control-at-foot 1 % → 33 %), et pas rien du tout non plus (bloquer l'intention
      // pendant la livraison : 4 109 refus, 0,3 s d'exposition en plus, record 8,5 → 5). Un vrai
      // joueur pense sa suite pendant que le ballon vient : beginPass reçoit le point d'arrivée et
      // le temps de livraison restant, et n'accorde l'engagement que si le contact tombe après.
      if (c.intent && (c.intent.until < st.t || !st.players[c.intent.choice.to.id] || st.players[c.intent.choice.to.id].team !== c.team)) c.intent = null;
      // ON NE POSE PAS SON BALLON SOUS UN ADVERSAIRE. L'assise freine le ballon ; un ballon
      // immobile avec un défenseur DESSUS n'est plus une possession, c'est un duel — mesuré :
      // l'adversaire venait se garer à 0,11 m du ballon posé (le modèle ne lui donne pas encore le
      // vol de balle debout, c'est le chantier « duel/protection »), et carrier-owns-the-ball est
      // monté à 58,6 % des images de conduite. Le prédicat est CELUI DE LA RÈGLE — l'adversaire
      // BAT le porteur au ballon (plus près que lui de l'écart de tolérance, ET à portée de jeu) —
      // pas « un adversaire est proche » : dans un rondo le presseur vit à moins d'un mètre du
      // ballon, c'est sa définition, et ce prédicat-là a étranglé le jeu à 98 passes / 505 tacles
      // (14 073 refus). Contesté ⇒ l'intention meurt et la CONDUITE reprend : les touches
      // d'évasion emmènent le ballon hors de l'emprise — ce qu'un vrai porteur fait d'un ballon
      // disputé.
      // L'ARBITRE DE MENACE (cfg.menace, 11c11 — menace.js) : l'ordre figé tir-puis-centre
      // devient un CHOIX sur une échelle unique, et le contrat est INJECTABLE — cfg.decide
      // remplace la politique entière (un projet aval amène son cerveau, le moteur garde
      // l'exécution et ses portes nommées). Mémoïsé 0,25 s : un arbitrage est une lecture du
      // monde, pas un tremblement à 60 Hz. Clé absente (rondo, réduit) : l'ancien ordre, au bit
      // près. L'événement 'arbitre' (au changement d'avis, dernier tiers) rend le choix LISIBLE.
      // …ET LE DUEL N'ÉTEINT PAS LA GÂCHETTE PRÈS DU BUT (11c11) : l'attaquant lancé, défenseur
      // dans le dos, est EXACTEMENT l'homme qui doit frapper — le régime d'urgence de beginPass
      // existe pour ça. Mesuré avant : le porteur contesté n'avait AUCUN cerveau offensif (tout
      // ce bloc sauté) et portait le ballon DANS le but — 12 buts / 16 tirs sur 4 matchs
      // complets, ~la moitié en conduite pure, des 2-2 systématiques. Le réduit garde sa loi
      // du duel (ses 76 clauses sont calibrées sans tir contesté — dette nommée).
      const gachette = !contested || gachetteNear || gachetteCentre;
      let arb = null;
      if (cfg.menace && st.full && gachette && (cfg.tryShot || cfg.tryCross)) {
        if (!c._arb || st.t - c._arb.t > 0.25) c._arb = { t: st.t, r: (cfg.decide ?? arbitre)(st, c, cfg) };
        arb = c._arb.r;
        if (arb && arb.meilleure !== c._arbPrev) {
          c._arbPrev = arb.meilleure;
          const goal = st.pitch?.attackGoal?.(c.team);
          if (goal && Math.abs(goal.x - c.p[0]) < st.pitch.hx * 0.67) {
            st.events.push({ t: +st.t.toFixed(2), type: 'arbitre', by: c.id, choix: arb.meilleure,
              tir: arb.tir?.score, centre: arb.centre?.score, passe: arb.passe?.score, conduite: arb.conduite?.score });
          }
        }
      }
      // LE TIR — le geste du match (cfg.tryShot, match-sim) : évalué AVANT l'intention de
      // passe, parce qu'une occasion de but domine une ligne de passe. Le rondo n'a pas de but :
      // le hook n'y existe pas, et ce bloc est un no-op. Sous arbitre : seulement s'il GAGNE.
      if (gachette && cfg.tryShot && (!arb || arb.meilleure === 'tir') && cfg.tryShot(st, c, cfg)) return st;
      // ON TIRE SI ON PEUT ; ON FEINTE LA FRAPPE SI UN CONTREUR FERME (le refus du tir vient d'être nommé — la feinte achète l'angle qui manquait, le contreur s'assoit)
      if (!contested && maybeFeinteFrappe(st, c, cfg, contested)) return st;
      // LE CENTRE (cfg.tryCross, match) : l'aile qui ne peut pas tirer SERT la surface
      if (!contested && cfg.tryCross && (!arb || arb.meilleure === 'centre') && cfg.tryCross(st, c, cfg)) return st;
      // …et le DÉGAGEMENT se décide ICI aussi (pas seulement au duel installé : mesuré, la branche
      // contestée ne tournait que 17 fois en 120 s — l'équipe épinglée perdait le ballon par tacle
      // AVANT d'y entrer ; ses propres portes lisent l'étau)
      if (cfg.tryClear && cfg.tryClear(st, c, cfg)) return st;
      if (contested) {
        // UN BALLON CONTESTÉ SE JOUE MAINTENANT — pas « se re-dribble sur place ». Reprendre
        // l'évasion laissait le cycle se répéter (le défenseur suit le ballon : garé, délogé,
        // regaré — carrier-owns-the-ball 60,8 % en 5 c. 5). Un joueur de rondo dont le ballon est
        // disputé le sort DU PREMIER GESTE LÉGAL (improvisation d'urgence, veto de course levé :
        // le moins mauvais ballon vaut mieux que le duel qu'on est en train de perdre) ; s'il n'y a
        // AUCUN geste légal, alors seulement l'évasion reprend.
        // …MAIS PAS AU PREMIER FRÔLEMENT. Depuis que le duel est un vrai geste (tacle-debout à
        // tackleTime), le porteur a une fenêtre : jouer la panique dès la première image de
        // conteste produisait le ping-pong mesuré (intervalle entre pertes p50 1,5-1,9 s, les
        // possessions neuves mouraient sur des balles improvisées interceptées). Il laisse d'abord
        // l'évasion travailler ; l'urgence ne prend la main que si le duel s'installe (pressure).
        if (c.intent) c.intent = null;
        deny(st, 'contesté');
        if (st.pressure > 0.15 * (c.skill?.decF ?? 1)) {   // …LES DÉCISIONS sont une note (151) : le bon garde la tête un instant de plus, le mauvais panique tôt
          const choice = choosePass(st, cfg);
          if (choice) beginPass(st, choice, cfg, { forceUrgent: true });
        }
      } else if (!c.intent) {
        const choice = choosePass(st, cfg);
        // AU CALME, LA BARRE MONTE ET LA TENUE SE PAIE : l'intention ne s'adopte qu'au-delà de la
        // tenue délibérée tirée pour CETTE possession (st._calmHold, seedée) et d'une barre de
        // score relevée (intentBarCalm) — le porteur conduit, fixe, PUIS donne. Pressé, la barre
        // et la tenue d'origine reprennent : l'urgence reste prompte.
        // L'ENGAGEMENT EST UNE PASSE (lot 45, cfg.engagementPasse && st.full) : pendant la
        // fenêtre après le coup d'envoi, le preneur DONNE — barre abaissée, tenue dispensée
        // (le monde entier est devant lui : la barre calme refusait la passe courte et il
        // partait en conduite — retour utilisateur). false : l'engagement porté d'hier.
        const engagementCall = st.full && cfg.engagementPasse !== false
          && st._engagement && st._engagement.by === c.id && st.t - st._engagement.t < 2.5;
        // …et la BARRE CALME AU TEMPO (164) : la vive adopte plus tôt, la posée exige mieux
        const bar = calm ? (engagementCall ? 0.2 : cfg.intentBarCalm * axeTac(tacDe(st, c.team).tempo, 1.3, 0.7)) : 3.2;
        // …ET LE BALLON RÉCUPÉRÉ SE DOMPTE (cfg.settleMin, match) : même pressé, on ne redonne
        // pas à l'image de la prise — la course au ballon libre fabriquait un ping-pong de
        // récupérations-éclair (23 passes/min mesurées, la bande futsal s'arrête à 20). L'appel
        // en rupture (runnerCall) reste dispensé : servir une course EST une première touche.
        const heldEnough = (!calm || st.hold >= st._calmHold) && st.hold >= (cfg.settleMin ?? 0);
        // L'APPEL CASSE LA TENUE : au tempo posé, les tenues (1,5-2,5 s) et les courses (0,7-1,1 s)
        // étaient désynchronisées — le temps d'avoir « assez tenu », la course était finie (3
        // appels servis sur 41 mesurés). Au vrai foot, la course DÉCLENCHE le ballon : un coureur
        // en rupture au bout d'une ligne qui score dispense de finir la tenue délibérée.
        const runnerCall = choice && (st.players[choice.to.id]?._pace?.until ?? -1) > st.t;
        // …ET LE JETÉ DÉCLENCHE (lot 144, cfg.fixe && st.full) : le porteur A fixé — le presseur
        // LANCÉ sur lui dispense de finir la tenue, la barre s'abaisse : le ballon part PENDANT
        // qu'il vole (l'élection qui avance vit dans choosePass). false : la tenue sourde d'hier.
        const jeteCall = st.full && cfg.fixe && choice && st.players.some((q) => {
          if (q.team === c.team || q.keeper || q.down > 0) return false;
          const dx = c.p[0] - q.p[0], dz = c.p[2] - q.p[2], d = Math.hypot(dx, dz);
          if (d > (cfg.fixe.rayon ?? 4.5) || d < 0.8) return false;
          const v = Math.hypot(q.v[0], q.v[1]);
          return v >= (cfg.fixe.vitesse ?? 4) && (q.v[0] * dx + q.v[1] * dz) / (v * d) > 0.75;
        });
        // …une intention de CENTRE vivante ne se re-décide pas (le choix de passe l'écrasait à
        // l'image suivante — 0 centre exécuté) : elle meurt de sa mort propre (TTL, receveur)
        // …et l'intention vers un COUREUR meurt AVEC la course (lot 36 : adoptées plus souvent
        // par la loi du coureur, les intentions qui échouent à s'engager occupaient le porteur
        // TTL plein — tirs 18 → 10 sur 10 graines mesurés ; on arrête de chercher le coureur
        // quand la course est finie, c'est tout)
        if (!c.intent?.choice?.cross && choice && ((choice.score > (jeteCall ? Math.min(bar, cfg.fixe?.barre ?? 1.2) : bar) && (heldEnough || runnerCall || engagementCall || jeteCall)) || st.hold >= cfg.holdMax)) {
          const paceTo = st.players[choice.to.id]?._pace;
          const ttl = st.full && (paceTo?.until ?? -1) > st.t && paceTo.kind === 'appel'
            ? Math.min(st.t + cfg.intentTtl, paceTo.until + 0.3) : st.t + cfg.intentTtl;
          c.intent = { choice, until: ttl };
        }
        // LA SEMELLE VIT DANS LA TENUE : pas d'intention encore, du champ, du calme — le pied se
        // pose sur le ballon et la tête se lève. Le geste ALLONGE la tenue de sa durée (busy),
        // ce qui est exactement ce qu'il fait au vrai foot.
        if (!c.intent && maybeSemelle(st, c, cfg, calm, foeBody)) return st;
      }
      if (c.intent) {
        // l'intention vise le receveur VIVANT : la mène se rafraîchit sur sa course réelle — c'est le même receveur, pas une re-décision (strikeNow re-résout de toute façon au contact)
        const rec = st.players[c.intent.choice.to.id];
        // LE SERVICE DU COUREUR EST UNE URGENCE DE TIMING (lot 36) : les portes (technique 932 /
        // ballon-vif 865 / ancre 642 refus) mangeaient la fenêtre de course ENTIÈRE — le remède
        // natif du tir (lot 6a) : la touche de PRÉPARATION, armée UNE fois par intention
        const runnerVif = st.full && (rec?._pace?.until ?? -1) > st.t && rec._pace.kind === 'appel';
        if (runnerVif
          && cfg.prepTouch !== false && d2(c.p, st.ball.p) > 0.95 && !((c._prepShot ?? -1) > st.t)) {
          c._prepShot = st.t + 0.9;
          c.anchorHint ??= { t: st.t };
        }
        const tI = cfg.leadTime ? cfg.leadTime(Math.hypot(rec.p[0] - c.p[0], rec.p[2] - c.p[2]), rec) : 0.28;
        c.intent.choice.lead = [rec.p[0] + rec.v[0] * tI, BALL.radius, rec.p[2] + rec.v[1] * tI];
        // LA FEINTE AVANT LA PASSE : l'intention est prête, un défenseur vit dans le cône de la
        // fausse direction — tout l'armé se joue (volable !), le ballon reste, le mordu s'assoit,
        // et la VRAIE passe part au geste suivant sur une ligne morte. Une feinte par intention.
        if (maybeFeinte(st, c, cfg, contested)) return st;
        // …ET LE SERVICE DU COUREUR S'EXÉCUTE EN URGENCE (lot 41, cfg.appelUrgent) : le
        // commentaire du lot 36 le disait — « une urgence de timing » — mais l'engagement
        // passait par le régime CALME (mesuré : latence burst → passe p50 1,43 s, le ballon
        // partait quand la course FINISSAIT). Le régime urgent du contesté et du centre —
        // portes courtes, armé prompt, et le déchet d'urgence qui va avec (execSigma ×1,25 :
        // une passe pressée se rate plus). Après : p50 0,60 s — la foulée est servie —,
        // service 32 → 48 % ; appelPret tient la QUEUE (p90 1,08 contre 1,50 en ablation).
        // false : le service nonchalant d'hier (sabotage nommé).
        beginPass(st, c.intent.choice, cfg, runnerVif && cfg.appelUrgent !== false ? { forceUrgent: true } : undefined);
      }
    }
  } else {
    // LA REMISE PORTÉE (match) : pas posée = le preneur possède le pas du ballon (ramassage → porté ; cfg.ballFetch true quand il l'a avancé lui-même). Hook absent (rondo) : physique pure.
    if (!(cfg.ballFetch && cfg.ballFetch(st, dt, cfg))) st.ball.integrate(dt);
    st._drb = null;
    // first player within reach takes it — defenders included: that is the interception. BUT the
    // ball must have LEFT the passer first (releaseClear) : sinon il « intercepte » sa propre passe
    // 0,02 s après la frappe (mesuré : toutes). …ET LA GARDE A UNE HORLOGE (cfg.releaseTtl, match) :
    const gone = st.pass ? Math.hypot(st.ball.p[0] - st.pass.origin[0], st.ball.p[2] - st.pass.origin[1]) : 99;
    // une passe MORTE près de son origine (3,3 m/s sous pressing, arrêtée à 0,6 m — graine 3) gardait
    // `gone ≤ releaseClear` POUR TOUJOURS : plus aucun droit de prise, gel de 145 s. La protection ne
    // vaut que l'instant du départ — passé le TTL, il est à prendre. Clé absente (rondo) : Infinity.
    const released = gone > cfg.releaseClear || (st.pass && st.t - st.pass.t > (cfg.releaseTtl ?? Infinity));
    // LE COACH LIT LE MATCH (lot 113) : score/chrono/momentum → axes par paliers (coach.js)
    if (cfg.coach && st.full) coachStep(st, cfg);
    // LE CIEL SE JOUE (cfg.tete && st.full — lot 34) : un vol à hauteur de tête sur un corps se REPREND — but/dégagement/remise ; à deux, le duel aérien (tete.js)
    if (cfg.tete && st.full && st.phase === 'flight' && released) teteStep(st, cfg);
    // …et SOUS la fenêtre, LA VOLÉE (lot 40) : reprise en surface / dégagement d'urgence — le pied joue le vol avant la prise au sol (tete.js)
    if (cfg.volee && st.full && st.phase === 'flight' && released) voleeStep(st, cfg);
    let taker = -1, bestD = Infinity;
    if (released) {
      for (const p of st.players) {
        // UN HOMME AU SOL NE RÉCLAME PAS UN BALLON (3 prises par corps couchés post-tacle mesurées) — possession = homme DEBOUT au ballon, le temps au sol est le prix du plongeon.
        if (p.down > 0) continue;
        const d = d2(p.p, st.ball.p);
        if (d < cfg.receiveRadius && st.ball.p[1] < 1.9 && d < bestD) { bestD = d; taker = p.id; }
      }
      // LE DUEL DU CONTACT (lot 154, cfg.prise5050 && st.full) : dans la fenêtre du simultané (~12 cm)
      // la prise revient au plus VIF (reaction STRICTEMENT meilleure) ; à notes égales, l'ancien chemin
      // — le monde noté 50 = le nu au bit (avant : le centimètre, i.e. l'ordre du tableau au miroir).
      if (taker >= 0 && st.full && cfg.prise5050 && st.players[taker].skill) {
        const fen = cfg.prise5050.fenetre ?? 0.12, t0 = st.players[taker];
        for (const p of st.players) {
          if (p.down > 0 || p.team === t0.team || !p.skill) continue;
          const d = d2(p.p, st.ball.p);
          if (d < cfg.receiveRadius && st.ball.p[1] < 1.9 && d - bestD < fen
            && p.skill.reaction < st.players[taker].skill.reaction) taker = p.id;
        }
      }
    }
    // une remise a un ayant droit et une heure — et LA PRISE A UN MÉTIER (cfg.onTake : la remise peut se jouer AUTREMENT qu'au pied — la touche Loi 15 se LANCE à la main). Clé absente : au bit près.
    const priseT = st.restart?.type ?? null;
    if (taker >= 0 && (!cfg.canTake || cfg.canTake(st, taker))) {
      receive(st, taker, cfg);
      if (priseT && !st.restart && cfg.onTake) cfg.onTake(st, taker, priseT, cfg);
    }
  }
  // OUT OF PLAY IS A RULE OF THE BALL, NOT OF A PHASE. This test only ran while the ball was loose or
  // in flight, so a ball dribbled over the line simply stayed out — and once the carrier began pushing
  // the ball ahead of himself, that is exactly what happened: the catalogue caught it as `ball-in-play`
  // on seeds where a carry ran into the corner. The line does not care who has it.
  if (Math.abs(st.ball.p[0]) > st.area[0] / 2 || Math.abs(st.ball.p[2]) > st.area[1] / 2) {
    // LE MATCH A DES LOIS DE SORTIE (but / touche / corner / sortie de but — cfg.onOut, match-sim) ; le rondo garde sa remise unique en jeu réduit
    if (cfg.onOut) { cfg.onOut(st, cfg); return st; }
    const other = st.players.filter((p) => p.team !== st.possession.team && p.down <= 0)
      .sort((a, b) => d2(a.p, st.ball.p) - d2(b.p, st.ball.p))[0];
    // LA seule discontinuité légitime — et elle se DÉCLARE. `restart()` lève si la cause est absente ou inconnue : ce qui est exceptionnel doit se nommer, sinon ça redevient le chemin normal.
    st.ball.restart([
      Math.max(-st.area[0] / 2 + 1, Math.min(st.area[0] / 2 - 1, st.ball.p[0])), BALL.radius,
      Math.max(-st.area[1] / 2 + 1, Math.min(st.area[1] / 2 - 1, st.ball.p[2])),
    ], { cause: 'sortie-de-but' });
    if (other) turnover(st, other.id, 'out');
  }
  return st;
}

/** Run the game for `seconds` and return the state plus a sampled trace for the contract. */
export function playRondo(st, seconds, { dt = 1 / 60, cfg = RONDO, sample = 6 } = {}) {
  const trace = [];
  const n = Math.round(seconds / dt);
  let lastTO = st.turnovers, since = 0;
  for (let i = 0; i < n; i++) {
    rondoStep(st, dt, cfg);
    if (st.turnovers !== lastTO) { lastTO = st.turnovers; since = 0; } else since += dt;
    if (i % sample === 0) {
      trace.push({
        t: +st.t.toFixed(2), phase: st.phase, team: st.possession.team, passes: st.passes, since: +since.toFixed(2), carrier: st.possession.carrier,
        ball: [+st.ball.p[0].toFixed(2), +st.ball.p[1].toFixed(2), +st.ball.p[2].toFixed(2)],
        players: st.players.map((p) => ({ id: p.id, team: p.team, job: p.job, p: [+p.p[0].toFixed(2), +p.p[2].toFixed(2)], speed: +p.speed.toFixed(2), yaw: +p.yaw.toFixed(3), down: +p.down.toFixed(2) })),
      });
    }
  }
  return { st, trace };
}

/**
 * Contract for a possession game. Written against what makes AI football look stupid:
 * the beehive, a defence that never wins the ball, an attack that never completes a pass,
 * players teleporting, and the ball leaving the world.
 */
export function checkRondo(st, trace, cfg = RONDO) {
  const issues = [];
  if (!trace.length) return { ok: false, issues: ['trace vide'] };

  // 1. the ball stays in the world and on the deck
  for (const s of trace) {
    if (!s.ball.every(Number.isFinite)) { issues.push('ballon non fini'); break; }
    if (Math.abs(s.ball[0]) > st.area[0] / 2 + 2 || Math.abs(s.ball[2]) > st.area[1] / 2 + 2) { issues.push(`ballon hors du carré (${s.ball[0]}, ${s.ball[2]})`); break; }
    if (s.ball[1] < BALL.radius - 0.05) { issues.push('ballon sous la pelouse'); break; }
  }
  // 2. NO BEEHIVE: never more than 3 defenders inside 3.5 m of the ball. Judged on SETTLED
  // possession only — a team that just won the ball by pressing is bunched by definition, and
  // scoring that instant measures the tackle, not the shape.
  // measured in TIME, not as a snapshot maximum: four defenders converging for the instant a pass
  // is received is correct football, and a peak count cannot tell that apart from a real beehive.
  // A genuine beehive is permanent — the sabotage below sits at 100%.
  const settled = trace.filter((s) => (s.since ?? 99) > 1.5);
  // The swarm radius is a FRACTION OF THE BOX, not a fixed 3.5 m. Third time this session that a
  // metric, not the system, was the thing that was wrong: in a real rondo box (12–16 m) four defenders
  // within 3.5 m of the ball is the DEFINITION of the exercise, not a defect, and an absolute radius
  // called it a beehive 39% of the time. Scaled to the box, the same rule keeps its meaning at any size.
  const swarmR = Math.min(3.5, cfg.swarmFrac * Math.min(st.area[0], st.area[1]));
  const nearCount = (s) => s.players.filter((p) => p.team !== s.team && Math.hypot(p.p[0] - s.ball[0], p.p[1] - s.ball[2]) < swarmR).length;
  const crowded = settled.filter((s) => nearCount(s) > 3).length;
  const allIn = settled.filter((s) => nearCount(s) > 4).length;
  const worstSwarm = settled.length ? Math.max(...settled.map(nearCount)) : 0;
  const crowdPct = settled.length ? crowded / settled.length : 0;
  const allInPct = settled.length ? allIn / settled.length : 0;
  if (crowdPct > 0.25) issues.push(`ESSAIM : plus de 3 défenseurs collés au ballon ${(crowdPct * 100).toFixed(0)}% du temps`);
  if (allInPct > 0.08) issues.push(`ESSAIM : toute la défense sur le ballon ${(allInPct * 100).toFixed(0)}% du temps`);
  // 3. the team in possession stays SPREAD (mean pairwise distance)
  let minSpread = Infinity;
  for (const s of settled) {
    const team = s.players.filter((p) => p.team === s.team);
    let sum = 0, k = 0;
    for (let i = 0; i < team.length; i++) for (let j = i + 1; j < team.length; j++) { sum += Math.hypot(team[i].p[0] - team[j].p[0], team[i].p[1] - team[j].p[1]); k++; }
    if (k) minSpread = Math.min(minSpread, sum / k);
  }
  // …and the same for spread: 5 m was written against a 26 m box. Both thresholds were absolute metres
  // fitted to one box size, which is why the grid could never be tightened without the contract
  // screaming — and a rondo played in a 34 x 26 m square is why the ball reads as far from everyone.
  const spreadMin = cfg.spreadFrac * Math.min(st.area[0], st.area[1]);
  if (settled.length && minSpread < spreadMin) issues.push(`bloc trop compact en possession installée (écartement moyen ${minSpread.toFixed(1)} m < ${spreadMin.toFixed(1)})`);
  // 4. nobody teleports
  const top = Math.max(...Object.values(cfg.speeds)) + 1.5;
  for (const s of trace) for (const p of s.players) if (p.speed > top) { issues.push(`joueur ${p.id} à ${p.speed} m/s (> ${top.toFixed(1)})`); break; }
  // 5. the game actually plays: passes complete AND the defence wins it back
  if (st.best < 3) issues.push(`l'attaque n'enchaîne pas (record ${st.best} passes)`);
  if (st.turnovers < 1) issues.push('la défense ne récupère jamais le ballon');
  // 6. both teams get to play
  const teams = new Set(trace.map((s) => s.team));
  if (teams.size < 2) issues.push('une seule équipe a eu le ballon');
  // 7. THE CARRIER IS NOT GLUED TO A DEFENDER. The crowd clauses count HOW MANY defenders are near the
  //    ball, which a carrier being permanently harried does not trip — one man on him is not a crowd.
  //    But that is exactly what reads as an anthill from the outside, and it was invisible: every
  //    variant of the carry, good and bad, passed the contract. Measured as the share of carry time
  //    with a defender inside tackle range: 50% before players had momentum, 30% after, 100% for the
  //    sabotage. The threshold catches the pathology, not the tuning.
  // Measured against the CARRIER'S BODY, not against the ball. They used to be the same point; they
  // are not any more, now that he shields the ball from behind it — and a defender arriving at the
  // ball with a body in the way is good football, not an anthill. The clause is named "glued to the
  // carrier", so it measures the carrier. (Fourth time this scene that a metric, not the system, was
  // the thing that needed fixing — the tell each time is a clause whose name and whose arithmetic
  // have quietly drifted apart.)
  const carry = trace.filter((s) => s.phase === 'carry' && s.carrier >= 0);
  const harried = carry.filter((s) => {
    const c = s.players.find((p) => p.id === s.carrier);
    if (!c) return false;
    const mine = Math.hypot(c.p[0] - s.ball[0], c.p[1] - s.ball[2]);
    // …and BEATEN, not merely close. A defender touch-tight behind a man who is shielding the ball is normal football; what is not normal is a defender permanently between the carrier and his ball.
    return s.players.some((p) => p.team !== s.team
      && Math.hypot(p.p[0] - c.p[0], p.p[1] - c.p[1]) < cfg.tackleRadius
      && Math.hypot(p.p[0] - s.ball[0], p.p[1] - s.ball[2]) < mine);
  }).length;
  const harriedPct = carry.length ? harried / carry.length : 0;
  if (carry.length > 30 && harriedPct > cfg.harriedMax) issues.push(`le porteur est collé par un défenseur ${(harriedPct * 100).toFixed(0)}% du temps de conduite — il ne s'échappe jamais`);

  // 8. jobs are distributed, not everyone on the same task
  const jobs = new Set(trace[Math.floor(trace.length / 2)].players.map((p) => p.job));
  if (jobs.size < 3) issues.push(`rôles indifférenciés (${[...jobs].join(',')})`);

  // 9. THE TEAM IN POSSESSION OCCUPIES THE GRID. Clause 3 measures mean pairwise distance, which a
  //    RING and a LINE score identically — and it stayed green while the possession team spanned 15 %
  //    of the box, i.e. while the thing looked like an anthill on screen. Area is what "occupying the
  //    space" actually means: five men holding a shape have a convex hull, five men in a knot do not.
  //    (Fifth time this scene that a green clause and a broken picture disagreed, and every time the
  //    clause was measuring a proxy rather than the thing it was named after.)
  const occ = settled.map((s) => hullArea(s.players.filter((p) => p.team === s.team).map((p) => p.p)));
  const occupy = occ.length ? occ.reduce((a, b) => a + b, 0) / occ.length / (st.area[0] * st.area[1]) : 1;
  if (settled.length > 60 && occupy < cfg.occupyMin) {
    issues.push(`bloc recroquevillé : l'équipe en possession n'occupe que ${(occupy * 100).toFixed(0)} % du carré (< ${(cfg.occupyMin * 100).toFixed(0)} %)`);
  }

  // 10. UN VOL DE BALLE EST UN GESTE, PAS UN FLIP D'ÉTIQUETTE. Le chiffre fondateur de la fournée
  //     duels : 54 % des pertes (157/291) basculaient la possession sans AUCUN événement physique —
  //     gagnant jusqu'à 2,33 m du ballon, premier geste du « voleur » : la passe suivante. Chaque
  //     turnover par tacle doit être adossé à un duel GAGNÉ (tacle-debout, événement 'duel') ou à un
  //     tacle glissé gagné (événement 'slide') dans la même fenêtre d'instant.
  const evs = st.events ?? [];
  const tackleTOs = evs.filter((e) => e.type === 'turnover' && e.why === 'tackle');
  const orphans = tackleTOs.filter((e) => !evs.some((g) => (g.type === 'duel' || g.type === 'slide') && g.won && Math.abs(g.t - e.t) <= 0.15));
  if (orphans.length) issues.push(`VOL SANS GESTE : ${orphans.length} bascule(s) de possession par tacle sans duel ni glissade gagné (t=${orphans[0].t})`);
  // 11. PAS DE TÉLÉKINÉSIE : arrêter un ballon vivant exige d'être à sa portée. Mesuré avant : 39
  //     arrêts d'un ballon > 1 m/s (jusqu'à 9,5 m/s) tué net avec un gagnant au-delà du rayon de jeu.
  //     Le tacle glissé est exempté : son pied ATTEINT le ballon à 1-3,2 m, et l'événement le dit.
  const teleki = tackleTOs.concat(evs.filter((e) => e.type === 'turnover' && e.why === 'interception'))
    .filter((e) => (e.d ?? 0) > cfg.receiveRadius && (e.v0 ?? 0) > 1 && (e.v1 ?? 0) < 0.5 * (e.v0 ?? 0)
      && !evs.some((g) => g.type === 'slide' && g.won && Math.abs(g.t - e.t) <= 0.15));
  if (teleki.length) issues.push(`TÉLÉKINÉSIE : ${teleki.length} ballon(s) arrêté(s) à distance (t=${teleki[0].t}, ${teleki[0].v0}→${teleki[0].v1} m/s à ${teleki[0].d} m)`);
  // 12. LE TACLE GLISSÉ EST RARE ET DÉFENSIF. Mesuré avant : 9,4/min, 69 % par l'équipe en
  //     possession (49 % par le porteur sur son propre ballon). Budget : ≤ 3/min (cible de jeu
  //     2/min, le seuil de contrat laisse la variance multi-graines), et ZÉRO par l'équipe qui a
  //     déjà le ballon — courir derrière sa touche est le travail de la conduite.
  const slideEvs = evs.filter((e) => e.type === 'slide');
  const slideByAtk = slideEvs.filter((e) => e.team != null && e.atk != null && e.team === e.atk);
  if (slideByAtk.length) issues.push(`GLISSADE DE POSSESSION : ${slideByAtk.length} tacle(s) glissé(s) par l'équipe qui avait le ballon (t=${slideByAtk[0].t})`);
  // durée arrondie à la seconde ENTIÈRE : 119,9 s lus comme 1,998 min faisaient déclarer 3,0026/min pour 6 glissades en 2 minutes — le budget se juge sur la partie, pas sur l'artefact du dernier pas
  const gameMin = trace.length ? Math.max(0.5, Math.ceil(trace[trace.length - 1].t) / 60) : 1;
  if (slideEvs.length / gameMin > 3) issues.push(`SPAM DE GLISSADES : ${(slideEvs.length / gameMin).toFixed(1)}/min (max 3)`);
  // 13. LA POSSESSION EST UN HOMME DEBOUT. 19 épisodes mesurés de phase carry avec porteur au sol (jusqu'à 6,7 s, un « porteur » couché que la défense ne pouvait pas déposséder).
  for (const s of carry) {
    const cd = s.players.find((p) => p.id === s.carrier);
    if (cd && (cd.down ?? 0) > 0) { issues.push(`PORTEUR AU SOL : phase carry à t=${s.t} avec porteur ${s.carrier} couché (down=${cd.down})`); break; }
  }

  return {
    ok: issues.length === 0, issues,
    stats: { best: st.best, turnovers: st.turnovers, swarm: worstSwarm, crowdPct: +(crowdPct * 100).toFixed(1), spread: +minSpread.toFixed(1), settled: settled.length, harried: +(harriedPct * 100).toFixed(0), occupy: +(occupy * 100).toFixed(1) },
  };
}

/** Convex-hull area of a set of [x, z] (monotone chain). The shape metric clause 3 cannot see. */
function hullArea(pts) {
  const p = pts.map((q) => [q[0], q[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return 0;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  const h = lo.slice(0, -1).concat(hi.slice(0, -1));
  let s = 0;
  for (let i = 0; i < h.length; i++) { const a = h[i], b = h[(i + 1) % h.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s) / 2;
}

export { predictPath };
