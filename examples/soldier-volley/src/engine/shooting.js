// shooting.js — LE TIR, LE CENTRE, LE DÉGAGEMENT : les gestes offensifs du match, sortis de
// match-sim (lot 16, volumétrie). Les lois sont INCHANGÉES au bit près (batterie) — seul le
// rangement change : une famille par fichier, un fichier par famille.
import { BALL } from './ball.js';
import { laneClearance } from './ball-predict.js';
import { simInternals } from './rondo-sim.js';
import { busy, winding, startGesture } from './gesture.js';
import { MOVES } from './animkit.js';

const d2 = (a, b) => Math.hypot(a[0] - b[0], (a[2] ?? a[1]) - (b[2] ?? b[1]));

// ---------------------------------------------------------------- le tir
/**
 * LE TIR — le geste qui manquait au vocabulaire. Conditions : à portée (shotRange du centre du
 * but), le couloir vers le coin visé est dégagé (laneClearance, GARDIEN EXCLU — c'est lui qu'on
 * défie), et le coin est choisi CONTRE le gardien réel (le plus loin de son z). Le refus se nomme.
 */
export function tryShot(st, c, cfg) {
  if (c.keeper) return false;
  const { pitch } = st;
  const goal = pitch.attackGoal(c.team);
  const dGoal = Math.hypot(goal.x - c.p[0], 0 - c.p[2]);
  // …la même portée grise que l'arbitre (lot 92 — une seule vérité) : le tir lointain choisi
  // par la menace ne se fait pas refuser à la porte.
  if (dGoal > cfg.shotRange * (st.full && cfg.menace?.grise ? cfg.menace.grise : 1)) return false;
  if (st.hold < cfg.shotHold) return false;
  if (Math.sign(c.p[0] - 0) !== Math.sign(goal.x) && dGoal > cfg.shotRange * 0.75) return false; // pas de sa moitié
  // L'ANGLE FERMÉ N'EST PAS UN TIR, C'EST UN CENTRE RATÉ : l'aile voyait 15 m de « portée » et
  // canonnait du couloir (0 centre mesuré — tryShot passait toujours avant tryCross). Au-delà de
  // l'épaule de la surface et hors du bout portant, le refus se nomme et l'aile SERT.
  if (Math.abs(c.p[2]) > pitch.goalHalf + 3 && dGoal > 8.5) return deny(st, 'angle-fermé');
  const gk = st.players.find((p) => p.keeper && p.team !== c.team);
  // les DEUX coins s'essaient, le plus loin du gardien d'abord — et à bout portant, on tire dans
  // le trafic (0,75 m de couloir n'existait jamais devant une défense postée côté but : 135 refus,
  // 0 tir en 90 s — un tir contré est du football, un attaquant muet n'en est pas)
  const corners = [pitch.goalHalf - 0.55, -(pitch.goalHalf - 0.55)]
    .sort((a, b) => (gk ? Math.abs(b - gk.p[2]) - Math.abs(a - gk.p[2]) : 0));
  const blockers = st.players.filter((q) => q.team !== c.team && !q.keeper && q.down <= 0).map((q) => q.p);
  const need = dGoal < 9 ? Math.min(cfg.shotClear, 0.3) : cfg.shotClear;
  let tz = null, margin = -1;
  for (const cz of corners) {
    const clr = laneClearance([st.ball.p[0], 0, st.ball.p[2]], [goal.x, 0, cz], blockers);
    const m = clr.margin ?? clr;
    if (m > margin) { margin = m; if (m >= need) { tz = cz; break; } }
  }
  if (tz == null) return deny(st, 'tir-couloir-fermé');
  // LA TOUCHE DE PRÉPARATION (cfg.prepTouch) : le ballon de course vit à 1,2-1,4 m — un poil
  // AU-DELÀ de la portée d'armement des techniques de frappe. Sans cette loi, le tir tentait et
  // se faisait refuser 'technique' EN BOUCLE (146 refus sur une seule course mesurés) jusqu'à
  // s'empaler sur le gardien (11 approches < 4 m, 0 tir). Le vrai footballeur SERRE sa dernière
  // touche avant la frappe : fenêtre de préparation posée sur le porteur (le régime de touche la
  // lit : touchF ≈ 0,3), l'ancre rafraîchie pour que le retour du ballon se POSSÈDE — au pas où
  // le ballon est au pied, la frappe arme.
  const bdShot = Math.hypot(c.p[0] - st.ball.p[0], c.p[2] - st.ball.p[2]);
  // (le POINTU DE NÉCESSITÉ — frapper du bout du pied SANS préparation le ballon à 1,3 m — est
  // une dette nommée : les portes d'armement de beginPass n'ont pas la portée du geste tendu,
  // et le premier jet mesuré tuait 37 % des tirs : le rush refusé en aval, le cerveau passait
  // au lieu de préparer — 'prépare-frappe' 40 → 3, 'timing' 142 → 254 sur 5 graines.)
  if (cfg.prepTouch !== false && bdShot > 0.95) {
    c._prepShot = st.t + 0.9;
    c.anchorHint = { t: st.t };
    return deny(st, 'prépare-frappe');
  }
  // LE RÉPERTOIRE DU TIR (« les frappes manquent de peps et de diversité ») : l'espèce se choisit
  // sur la GÉOMÉTRIE (près → on place, loin → on arme) + un tirage seedé + la note (une petite
  // dispersion de finition ose la lucarne). L'élévation se calcule balistiquement pour la hauteur
  // visée au plan du but — le gardien garde ses lois (gather ≤ 1,9 m, gant ≤ 2,1 m : une lucarne
  // à 1,7 m est un arrêt de grande envergure, pas un but gratuit).
  let shotKind = null;
  let tzAim = tz;
  if (cfg.shotVariety !== false) {
    const u = (st.rnd ?? (() => 0.5))();
    const fin = c.skill ? Math.max(0, Math.min(1, (0.9 - c.skill.shotSigma) / 0.9)) : 0.5;
    const elevFor = (yT, v) => Math.min(0.32, (yT + 4.9 * (dGoal / v) * (dGoal / v)) / Math.max(1, dGoal));
    // LE RÉPERTOIRE EXHAUSTIF (lot 39, retour utilisateur « flottante, enroulée, puissante,
    // ras-de-terre, etc ») : l'espèce se choisit sur la SITUATION — chaque frappe a sa loi.
    // Le spin est en rev/s, signé plus bas pour l'enroulée (Magnus réel : le gardien projette
    // LINÉAIREMENT — shotCross — et la courbe le bat, comme au vrai football). Les frappes de
    // cou-de-pied portent une rotation LISIBLE (0,5 rev) ; flottante et pointu quasi rien
    // (< 2 rad/s) — le gardien les lit TARD (floatRead, keeper.js).
    const gkOff = gk ? Math.abs(gk.p[0] - goal.x) : 0;
    const dGk = gk ? Math.hypot(gk.p[0] - c.p[0], gk.p[2] - c.p[2]) : 99;
    if (gkOff >= 4.2 && dGk <= 8 && dGoal >= 9 && dGoal <= 21 && u < 0.3) {
      // LE PIQUÉ est l'arme du UN-CONTRE-UN : le gardien sorti (≥ 4,2 m) et PRÈS du tireur
      // (≤ 8 m), le but loin derrière lui — il ne recule pas plus vite que le vol. Sur un
      // gardien LOIN du tireur, la cloche de 2 s se fait rattraper (prise à 1,65 m mesurée,
      // le repli gagne) : ce piqué-là n'existe pas au vocabulaire. Tirage rare (0,3 — à 0,75
      // le piqué dévorait 37 % du répertoire). L'élévation se RÉSOUT du duel : dégager 2,45 m
      // au passage du corps (traînée ×1,25 — le θ figé 0,58 passait à 1,16 m mesuré), vitesse
      // balistique EXACTE (un geste de toucher : ni plancher ni plafond de tir).
      const dCl = Math.min(dGk + 0.3, dGoal * 0.6);
      const el = Math.min(0.8, Math.max(0.5, Math.atan(1.25 * 2.45 / (dCl * (1 - dCl / dGoal)))));
      // …et la PORTÉE se compense (×1,18) : la traînée raccourcit la cloche balistique — le
      // ballon retombait 2,5 m AVANT la ligne, dans les gants du repli (mesuré au banc)
      shotKind = { id: 'piqué', speed: Math.sqrt(Math.max(8, dGoal * 1.18) * 9.81 / Math.sin(2 * el)), elev: el, exact: true, rev: 0.5 };
    } else if (dGoal < 8.5) {
      shotKind = u < 0.5 ? { id: 'placé', speed: 16.5, elev: 0.05, rev: 0.5 }
        : u < 0.72 ? { id: 'croisé', speed: 18, elev: 0.03, rev: 0.5 }
        : u < 0.9 ? { id: 'puissance', speed: 21, elev: 0.08, rev: 0.5 }
        // LE POINTU : le bout du pied, sans élan lisible — l'arme des petits espaces
        : { id: 'pointu', speed: 18.5, elev: 0.04, rev: 0.25 };
    } else {
      // …les FINISSEURS PROUVÉS gardent leurs bandes, les espèces prennent les MARGES
      // (premier jet mesuré 20 × 300 s : bandes larges aux nouvelles espèces → buts 30 → 15,
      // conversion 47 → 34 % — la variété ne doit pas dégrader la finition)
      const pLuc = 0.08 + 0.12 * fin;
      const lateral = Math.abs(st.ball.p[2]) >= 4 && dGoal >= 13;
      // LA PATTE FAIT L'ENROULÉE (lot 87, cfg.patte && st.full — le geste Robben) : l'AILIER
      // INVERSÉ (pied fort opposé à son côté : Robben, Messi) rentre SUR son pied — l'enroulée
      // est SON tir (fenêtre ×1,6) ; sur le pied de débordement elle se raréfie (×0,55, il
      // rase/centre) ; des deux pieds ×1,2. Facteur de fenêtre, physique intacte — le réduit
      // garde la fenêtre plate d'hier au bit. false : le tireur sans patte (sabotage nommé).
      const side = Math.sign(st.ball.p[2] * -(goal.x || 1));
      const sf = st.full && cfg.patte !== false ? (c.strongFoot ?? 'right') : null;
      // (l'ulp : 0,42+0,14 ≠ 0,56 au bit — sans patte la borne d'hier reste LITTÉRALE)
      const wIn = !sf ? 1 : sf === 'both' ? 1.2 : (side > 0) === (sf === 'right') ? 1.6 : 0.55;
      shotKind = u < 0.42 ? { id: 'puissance', speed: 21.5, elev: 0.09, rev: 0.5 }
        // L'ENROULÉE : de l'angle du repique, la mène se décale VERS LE CENTRE et le Magnus
        // la RAMÈNE au poteau (calibré : la courbe suit 1,44·(d/16)² au réel — arrivée à
        // 0,65-1,04 m au coin) — la lecture linéaire du gardien sous-estime l'arrivée,
        // c'est TOUT l'avantage du curler.
        : (lateral && u < (sf ? 0.42 + 0.14 * wIn : 0.56)) ? { id: 'enroulée', speed: 18.5, elev: elevFor(1.35, 18.5), curl: 8 }
        // LE RAS-DE-TERRE : le rasant appuyé au sol — sous le plongeon, mange les rebonds
        : u < 0.5 ? { id: 'ras-de-terre', speed: 20, elev: 0.015, rev: 0.5 }
        // LA FLOTTANTE : vite et SANS effet — pas d'axe à lire, le gardien part en retard
        : (dGoal >= 15 && u < 0.62) ? { id: 'flottante', speed: 20.5, elev: elevFor(1.2, 20.5), rev: 0.2 }
        : u < 0.78 ? { id: 'mi-hauteur', speed: 19, elev: elevFor(1.1, 19), rev: 0.5 }
        : u < 0.78 + pLuc ? { id: 'lucarne', speed: 19.5, elev: elevFor(1.7, 19.5), rev: 0.5 }
        : { id: 'placé', speed: 17.5, elev: 0.05, rev: 0.5 };
    }
    if (shotKind?.curl) {
      // le décalage d'aim ÉGALE la courbe mesurée (1,44·(d/16)², plafond 2 — au plafond 1,5
      // l'enroulée de 19 m dépassait son poteau de 0,54 m), jamais au-delà du milieu du cadre ;
      // le spin SIGNÉ ramène vers le vrai poteau tz
      const aimIn = Math.min(2.0, Math.max(0.7, 1.44 * (dGoal / 16) * (dGoal / 16)));
      tzAim = tz - Math.sign(tz) * Math.min(aimIn, Math.abs(tz) * 0.7);
      shotKind.rev = -Math.sign(goal.x) * Math.sign(tz) * shotKind.curl;
    }
  }
  const choice = {
    to: { id: -2 }, lead: [goal.x, 0, tzAim], style: 'ground', shot: true, shotKind,
    lane: { margin: +margin.toFixed(2) },
    shotInfo: { range: +dGoal.toFixed(2), tz: +tz.toFixed(2), gkZ: gk ? +gk.p[2].toFixed(2) : null },
  };
  return simInternals.beginPass(st, choice, cfg, { shot: true });
}

/** Un refus a une cause nommée (copie locale du registre du loop). */
function deny(st, cause) { (st.deny ??= {})[cause] = (st.deny[cause] ?? 0) + 1; return false; }

// ---------------------------------------------------------------- le centre
/**
 * LE CENTRE (« ça manque de centres ») — l'aile qui ne peut pas tirer SERT la surface : porteur
 * LARGE (couloir) et HAUT (approche du dernier tiers), au moins une cible dans la boîte, le
 * ballon enveloppe la défense par le HAUT (style lofted — le couloir au sol n'est pas requis,
 * c'est le point du centre). La mène vise la COURSE du coureur de surface, tirée vers le point
 * de penalty / second poteau. Cooldown d'équipe : le centre est une arme, pas une boucle.
 */
export function tryCross(st, c, cfg) {
  if (c.keeper) return false;
  const { pitch } = st;
  const goal = pitch.attackGoal(c.team);
  const sgn = Math.sign(goal.x || 1);
  // …les portes du plein format s'ouvrent au VRAI football (lot 34) : le centre part aussi
  // des DEMI-ESPACES (couloir 0,30) et de plus profond (le centre tôt, −13 m) — mesuré :
  // à 0,38/−9, la fenêtre géométrique n'existait que 2,4 % du portage, ~1 centre / 2 matchs.
  // Le réduit garde ses portes d'hier (st.full), au bit près.
  // LA PATTE DU CENTREUR (lot 100, cfg.patte && st.full — le 3e consommateur nommé au lot
  // 87) : le DÉBORDEUR (pied fort côté aile — le miroir de l'inversé) centre de SON pied :
  // précision pleine (sigmaF 0,85) et le centre PRÉCOCE est son arme (porte 3 m plus
  // profonde) ; l'INVERSÉ qui centre du mauvais pied disperse (×1,9 — au réel il repique
  // pour enrouler, lot 87) ; des deux pieds ×1. Le facteur voyage par choice.sigmaF
  // (contrat générique de beginPass : la dispersion DU geste) — physique intacte, aucun
  // tirage de plus (le σ existant se module). patte:false : le centreur sans patte d'hier.
  const sfC = st.full && cfg.patte !== false ? (c.strongFoot ?? 'right') : null;
  const piedsF = !sfC ? 1 : sfC === 'both' ? 1 : (Math.sign(c.p[2] * -(goal.x || 1)) > 0) === (sfC === 'right') ? 1.9 : 0.85;
  if (c.p[0] * sgn < pitch.hx - pitch.dims.box.depth - (st.full ? 13 + (piedsF < 1 ? 3 : 0) : 9)) return false;   // pas assez haut (le débordeur centre tôt)
  if (Math.abs(c.p[2]) < pitch.hz * (st.full ? 0.30 : 0.38)) return false;                 // pas dans le couloir
  if (st.hold < 0.25) return false;
  if ((st._crossCd?.[c.team] ?? -1) > st.t) return false;
  const boxX = pitch.hx - pitch.dims.box.depth;
  const inBox = st.players.filter((q) => q.team === c.team && !q.keeper && q.id !== c.id && q.down <= 0
    && q.p[0] * sgn > boxX - 1.5 && Math.abs(q.p[2]) < pitch.dims.box.width / 2 + 1.5);
  if (!inBox.length) return false;
  // la cible : le coureur le plus proche du POINT DE CHUTE utile (second poteau / penalty, côté
  // opposé au centreur — là où un centre fait mal)
  const spotZ = -Math.sign(c.p[2] || 1) * Math.max(2.0, pitch.goalHalf + 0.8);
  const spot = [goal.x - sgn * Math.max(3.5, pitch.dims.spot * 0.7), spotZ];
  const rec = inBox.sort((a, b) => Math.hypot(a.p[0] - spot[0], a.p[2] - spot[1]) - Math.hypot(b.p[0] - spot[0], b.p[2] - spot[1]))[0];
  const tI = cfg.leadTime ? cfg.leadTime(Math.hypot(rec.p[0] - c.p[0], rec.p[2] - c.p[2]), rec) : 0.35;
  let lead = [rec.p[0] + rec.v[0] * tI, 0, rec.p[2] + rec.v[1] * tI];
  // …tirée vers le point utile (le centre arrive DEVANT le coureur, côté but)
  lead = [lead[0] + (spot[0] - lead[0]) * 0.4, 0, lead[2] + (spot[1] - lead[2]) * 0.4];
  lead = [Math.max(-pitch.hx + 1.2, Math.min(pitch.hx - 1.2, lead[0])), 0,
    Math.max(-pitch.hz + 1.2, Math.min(pitch.hz - 1.2, lead[2]))];
  // un centre PART quand la fenêtre s'ouvre (même régime d'urgence que le dégagement). L'ESSAI
  // CONSIGNÉ : le centre-intention (décider → préparer → s'engager) posait 6 intentions / 4
  // matchs et n'en exécutait AUCUNE — l'intention injectée en plein dribble d'aile ne trouve pas
  // ses portes (ballon-vif entre les touches serrées) dans son TTL ; l'approche pilotée du
  // centre est au backlog nommé. Le départ immédiat servait 6 centres — le monde mesuré le
  // meilleur.
  // …ET LA TOUCHE DE PRÉPARATION DU CENTRE (lot 34 — le patron du tir, lot 6a) : le ballon
  // d'aile vit à 1,2-1,4 m en course — beginPass refusait 169 centres sur 170 mesurés
  // (l'engagement veut le ballon au pied ; la gâchette du lot 13 ne suffisait pas, il fallait
  // AUSSI la touche). Le centreur SERRE sa touche ; au pas suivant, le centre arme.
  const bdC = Math.hypot(c.p[0] - st.ball.p[0], c.p[2] - st.ball.p[2]);
  if (st.full && cfg.prepTouch !== false && bdC > 0.95) {          // st.full : le réduit centre comme hier, au bit près
    c._prepShot = st.t + 0.9;
    c.anchorHint = { t: st.t };
    return deny(st, 'prépare-centre');
  }
  // LE CENTRE BAS (lot 40) : au RAS DE LA LIGNE (les 9 derniers mètres — la zone du centre
  // en retrait), la cloche n'a plus de sens (l'angle est nul, le gardien cueille tout) — le
  // vrai geste est le centre FORT AU SOL vers le point de penalty, si le couloir existe
  // (contrairement à la cloche, le ballon à ras se fait couper : laneClearance). C'est LUI
  // qui donne son ballon à la reprise de volée (tete.js#voleeStep — mesuré avant : 0,0 s de
  // fenêtre de volée en surface, la chaîne ne produisait que des cloches à hauteur de tête).
  let bas = false;
  if (cfg.centreBas !== false && st.full && c.p[0] * sgn > pitch.hx - 9) {
    const blockers = st.players.filter((q) => q.team !== c.team && !q.keeper && q.down <= 0).map((q) => q.p);
    const clr = laneClearance([st.ball.p[0], 0, st.ball.p[2]], lead, blockers);
    bas = (clr.margin ?? clr) >= 0.45;
  }
  const r = simInternals.beginPass(st, { to: { id: rec.id }, lead, style: bas ? 'ground' : 'lofted', cross: true, bas, sigmaF: piedsF, lane: { margin: 9 } }, cfg, { forceUrgent: true });
  if (r) (st._crossCd ??= {})[c.team] = st.t + 5;
  return r;
}

// ---------------------------------------------------------------- l'assemblage
/** LE DÉGAGEMENT — sous siège dans son propre tiers, on met le ballon loin et haut, vers un
 *  flanc : imprécis PAR NATURE (accuracy 0,3 dans la table — un dégagement rend souvent un
 *  50/50), mais il sort l'équipe de l'étau. Cooldown d'équipe : un dégagement est un soupir,
 *  pas un style de jeu. */
export function tryClear(st, c, cfg) {
  const { pitch } = st;
  if (c.keeper) return false;
  const own = pitch.ownGoal(c.team);
  const depth = (c.p[0] - own.x) * -own.sign;                      // profondeur depuis SA ligne
  if (depth > pitch.hx * 0.66) return false;                       // pas dans son tiers : on joue
  if ((st._clearCd?.[c.team] ?? -1) > st.t) return false;
  // l'étau se lit aux CORPS, pas à la minuterie de duel (st.pressure ne s'accumule qu'en
  // conteste installé — l'équipe épinglée était taclée avant) : deux corps à 2,6 m, ou un seul
  // mais collé (1,4 m) profond dans le tiers
  const near = st.players.filter((q) => q.team !== c.team && q.down <= 0 && d2(q.p, c.p) < 2.6).length;
  const glued = st.players.some((q) => q.team !== c.team && q.down <= 0 && d2(q.p, c.p) < 1.4);
  if (!(near >= 2 || (glued && depth < pitch.hx * 0.45))) return false;
  const sgn = -own.sign;                                           // vers l'avant
  // LE DÉGAGEMENT EN CATASTROPHE (lot 101, cfg.corner && st.full — la 3e source de corners,
  // mesurée la plus volumineuse : 8 clears < 12 m de la ligne / 8 matchs) : épinglé PROFOND
  // (< 12 m) et collé, le vrai défenseur SÉCURISE DERRIÈRE — n'importe où sauf devant son but,
  // le corner concédé est le moindre danger. Tirage rnd2 45 % ; sinon (ou clé absente) : le
  // dégagement au flanc d'hier, au bit près.
  const panique = st.full && cfg.corner && depth < 12 && (glued || near >= 2)
    && (st.rnd2 ?? st.rnd ?? (() => 0.5))() < 0.45;
  const flank = c.p[2] >= 0 ? -pitch.hz * 0.55 : pitch.hz * 0.55;  // le flanc OPPOSÉ à la mêlée
  const lead = panique
    ? [own.x + own.sign * 8, 0, Math.sign(c.p[2] || 1) * pitch.hz * 0.75]  // DERRIÈRE la ligne, écarté du but : la sortie assumée (le vol croise la ligne de fond avant la touche)
    : [c.p[0] + sgn * pitch.hx * 0.85, 0, flank];
  const r = simInternals.beginPass(st, { to: { id: -2 }, lead, style: 'lofted', clear: true, lane: { margin: 9 } }, cfg, { clear: true, forceUrgent: true });
  if (r) (st._clearCd ??= {})[c.team] = st.t + 6;
  return r;
}
