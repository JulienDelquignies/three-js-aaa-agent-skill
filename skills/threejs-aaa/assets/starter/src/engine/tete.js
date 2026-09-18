import { tirage } from './rng.js'; import { modeTeteDefensive } from './petits-gestes.js'; import { vitesseGeste } from './repertoire.js';
import { xgDe } from './xg.js';
import { predictPath, ballAt } from './ball-predict.js'; import { startGesture } from './gesture.js'; import { MOVE_TIMING } from './skills-sim.js';   // (B3) la tête armée
import { MOVES } from './animkit.js';   // (C1) la retournée : le clip authored porte son contact (0,52 s)
// tete.js — LE CIEL DU MATCH (lot 34). Le jeu aérien manquait ENTIER : mesuré avant, 0 centre
// entré en surface sur 4 matchs (vols tendus mangés par le premier rideau) et 0,8 s/match de
// fenêtre de tête avec un corps dessous — les centres retombaient, les dégagements attendaient
// le sol, le style « large et centres » n'avait pas sa finition. Ici vit le CONTACT DE TÊTE :
// un vol à hauteur de tête (min-max m — et depuis le lot 112, le CIEL au-dessus : la
// détente T.saut × sautF, le clip de saut authoré) au-dessus d'un corps se REPREND — au BUT (canal shot standard : le plongeon du
// gardien répond à la physique, pas à un script), en DÉGAGEMENT (loin de son but, vers
// l'avant et le flanc), ou en REMISE (le coéquipier proche, cloche courte). À DEUX corps
// dans la fenêtre : le DUEL AÉRIEN tranche (note strength — le même levier que l'épaule —,
// jet seedé, événement 'duel' kind aérien). Gardé cfg.tete && st.full : le réduit et le
// rondo d'hier, au bit près. Dettes nommées : le PRÉ-SAUT anticipé (le corps qui monte
// AVANT le contact — la scène démarre le clip dans sa montée en attendant), la Loi 11 sur
// reprise de tête (le sifflet vit à la prise au sol — la redirection n'appelle pas receive).
const d2 = (a, b) => hyp(a[0] - b[0], a[2] - b[2]);

/** LA PERCEPTION A UNE HORLOGE (le contrat de strikeNow, complété lot 50) : une redirection
 *  de première intention n'a PAS d'armé — seen 0, tout le monde paie sa réaction pleine
 *  (mesuré : les redirections étaient les seuls départs sans fenêtre aveugle). */
const surprend = (st) => { st._surprise = { t: st.t, seen: 0, n: (st._surprise?.n ?? 0) + 1 }; };

export function teteStep(st, cfg, force = null) {
  const T = cfg.tete;
  const bp = st.ball.p;
  if (!force && st._enchaine && st.t < st._enchaine.until) return;   // (note 386) idem pour la tête réactive
  // LA DÉTENTE (lot 112, T.saut — la hauteur de saut du joueur moyen, m) : le ciel au-dessus
  // de la tête debout (max) s'atteint EN SAUTANT — la fenêtre devient PAR JOUEUR
  // [min ; max + saut × sautF] (l'attribut jumping : un facteur, jamais une branche ; mesuré
  // avant : 1,7 vol/match traversait 2,2-3,0 m sur un corps, muet). Clé absente : hier au bit.
  const porte = (q) => (T.max ?? 2.2) + (T.saut ?? 0) * (q.skill?.sautF ?? 1);
  let joueur, saute, cands;
  if (force) {
    // (B3) LA TÊTE ARMÉE se résout AU CONTACT DE L'ACTE (teteContact) : le ballon doit y être — la prédiction a sa marge (armee.marge) —,
    // sinon la tête est MANQUÉE (événement nommé) : l'acte finit son accompagnement, le vol continue, un autre corps peut le reprendre.
    const A = T.armee || {}, marge = A.marge ?? 0.25, d = d2(force.p, bp);
    if (bp[1] < (T.min ?? 1.5) - marge || bp[1] > porte(force) + marge || d > (T.reach ?? 1.0) + marge) {
      st.events.push({ t: +st.t.toFixed(2), type: 'tête-manquée', by: force.id, d: +d.toFixed(2), h: +bp[1].toFixed(2) }); return;
    }
    joueur = force; saute = !!force.act?.payload?.saut;
    cands = [force, ...st.players.filter((q) => q.id !== force.id && q.down <= 0 && !q.keeper && d2(q.p, bp) < (T.reach ?? 1.0) && bp[1] <= porte(q))
      .sort((a, b) => d2(a.p, bp) - d2(b.p, bp))];
  } else {
    if (bp[1] < (T.min ?? 1.5) || bp[1] > (T.max ?? 2.2) + (T.saut ?? 0) * 1.25) return;
    if ((st._teteCd ?? 0) > st.t) return;                            // un contact par fenêtre de vol
    cands = st.players.filter((q) => q.down <= 0 && !q.keeper && !q.act
      && d2(q.p, bp) < (T.reach ?? 1.0) && bp[1] <= porte(q))
      .sort((a, b) => d2(a.p, bp) - d2(b.p, bp));
    if (!cands.length) return;
    joueur = cands[0];
    saute = bp[1] > (T.max ?? 2.2);
  }
  const arme = force ? { arme: true } : {};
  let gene = 0, geneV = 1;
  const rival = cands.find((q) => q.team !== joueur.team);
  if (rival) {
    // LE DUEL AÉRIEN AU CONTACT : force contre force (chargeF — l'attribut strength des deux
    // côtés) — ET AU CIEL, détente contre détente (lot 112 : le duel sauté se gagne autant à
    // l'impulsion qu'au corps)
    const edge = saute
      ? ((joueur.skill?.chargeF ?? 1) - (rival.skill?.chargeF ?? 1)) * 0.25
        + ((joueur.skill?.sautF ?? 1) - (rival.skill?.sautF ?? 1)) * 0.25
      : ((joueur.skill?.chargeF ?? 1) - (rival.skill?.chargeF ?? 1)) * 0.5;
    const perdant = tirage(st, 'duel', joueur.id, st.rnd ?? (() => 0.5))() < 0.5 + edge ? rival : joueur;
    if (perdant === joueur) joueur = rival;
    st.events.push({ t: +st.t.toFixed(2), type: 'duel', kind: 'aérien', by: joueur.id, contre: perdant.id, won: true, ...(saute ? { saut: true } : {}) });
  } else if (T.duel) {
    // LE DUEL SE CONTESTE EN VENANT (lot 112, T.duel — rayon m) : le rival d'hier devait
    // partager le même mètre (mesuré : 0 duel sur 10 matchs) — le vrai duel aérien se joue à
    // qui VIENT sous le vol. Le venant hors de portée de contact ne JOUE pas le ballon (pas
    // de téléport) : s'il gagne le jet, il GÊNE — la tête contestée part bruitée (±T.gene
    // rad) et molle (×T.geneV). Clé absente : hier au bit.
    const venant = st.players.filter((q) => q.team !== joueur.team && q.down <= 0 && !q.keeper
      && !q.act && d2(q.p, bp) < T.duel && bp[1] <= porte(q))
      .sort((a, b) => d2(a.p, bp) - d2(b.p, bp))[0];
    if (venant) {
      const edge = saute
        ? ((joueur.skill?.chargeF ?? 1) - (venant.skill?.chargeF ?? 1)) * 0.25
          + ((joueur.skill?.sautF ?? 1) - (venant.skill?.sautF ?? 1)) * 0.25
        : ((joueur.skill?.chargeF ?? 1) - (venant.skill?.chargeF ?? 1)) * 0.5;
      const tenu = tirage(st, 'duel', joueur.id, st.rnd ?? (() => 0.5))() < 0.5 + edge;
      if (!tenu) { gene = (tirage(st, 'duel', joueur.id, st.rnd ?? (() => 0.5))() * 2 - 1) * (T.gene ?? 0.35) * (2 - (joueur.skill?.headF ?? 1)); geneV = T.geneV ?? 0.8; }   // …le CADRE tenu même gêné (147, heading — ×1 exact à 50)
      st.events.push({ t: +st.t.toFixed(2), type: 'duel', kind: 'aérien', by: joueur.id, contre: venant.id, won: tenu, ...(tenu ? {} : { gene: true }), ...(saute ? { saut: true } : {}) });
    }
  }
  st._teteCd = st.t + 0.8;
  st.lastTouch = joueur.team; st.lastPasser = joueur.id;   // le toucher au grand livre (195, Loi 17)
  const goal = st.pitch.attackGoal(joueur.team);
  const own = st.pitch.ownGoal(joueur.team);
  const sgn = Math.sign(goal.x || 1);
  const dGoal = hyp(goal.x - joueur.p[0], joueur.p[2]);
  if (dGoal < (T.but ?? 12) && st.pitch.inBox(joueur.p[0], joueur.p[2], sgn)) {
    // LA TÊTE AU BUT : piquée vers un point du cadre seedé — canal shot standard
    const tz = (tirage(st, 'tir', joueur.id, st.rnd ?? (() => 0.5))() * 2 - 1) * (st.pitch.goalHalf - 0.5);
    const vT = st.full && cfg.repertoire ? vitesseGeste('tête', cfg.repertoire, joueur, { dGoal }) : 12.5;   /* (279) la tête du book : 13 m/s × powF (null : 12,5 d'hier) */
    st.ball.strike({ speed: vT * geneV * (joueur.skill?.headF ?? 1), dirYaw: Math.atan2(tz - joueur.p[2], goal.x - joueur.p[0]) + gene, elevation: 0.03, spinAxis: [0, 1, 0], spinRev: 0 });   // …la PUISSANCE de la tête au but (147, heading)
    surprend(st);
    st.pass = null;
    st.events.push({ t: +st.t.toFixed(2), type: 'tête', by: joueur.id, ...arme, mode: 'but', h: +bp[1].toFixed(2), ...(saute ? { saut: true } : {}) });
    const xgT = st.full && cfg.xg ? xgDe(st, joueur, cfg, true) : null; if (xgT) (st.xg ??= [0, 0])[joueur.team] += +xgT.ref.toFixed(3);   // (272) la tête porte son xG (δ_tête recentré)
    st.events.push({ t: +st.t.toFixed(2), type: 'shot', by: joueur.id, kind: 'tête', geste: 'tête', range: +dGoal.toFixed(1), speed: +(vT * geneV).toFixed(1), ...(xgT ? { xg: +xgT.ref.toFixed(3), xgDec: +xgT.dec.toFixed(3), omega: +xgT.omega.toFixed(2) } : {}) });
    return;
  }
  if (hyp(own.x - joueur.p[0], joueur.p[2]) < 24) {
    // LE DÉGAGEMENT DE LA TÊTE : loin de son but, vers l'avant et le flanc.
    // …SAUF PRESSÉ PRÈS DE SA LIGNE (lot 101, cfg.corner && st.full — la 2e source de corners,
    // mesurée : la claquette seule en rendait 1/8 matchs) : le défenseur qui dégage de la tête
    // à < 9 m de sa ligne avec un adversaire au corps (< 2,5 m) SÉCURISE DERRIÈRE — la tête
    // vers son propre coin, le corner concédé (le choix du vrai défenseur : le danger d'abord).
    // Tirage rnd2 une fois sur deux (l'autre : le dégagement d'hier). Clé absente : hier au bit.
    const presse = st.full && cfg?.corner && Math.abs(own.x - joueur.p[0]) < 12
      && st.players.some((q) => q.team !== joueur.team && q.down <= 0 && d2(q.p, joueur.p) < 3.5)
      && tirage(st, 'intention', joueur.id, st.rnd2 ?? st.rnd ?? (() => 0.5))() < 0.5;
    const fz = joueur.p[2] >= 0 ? 0.45 : -0.45;
    if (presse) {
      const coinYaw = Math.atan2(Math.sign(joueur.p[2] || 1) * 2.2, Math.sign(own.x || 1));
      st.ball.strike({ speed: 12.5 * geneV, dirYaw: coinYaw + gene, elevation: 0.35, spinAxis: [0, 1, 0], spinRev: 0 });
    } else st.ball.strike({ speed: 11.5 * geneV, dirYaw: Math.atan2(fz, -Math.sign(own.x)) + gene, elevation: 0.42, spinAxis: [0, 1, 0], spinRev: 0 });
    surprend(st);
    st.pass = null;
    st.events.push({ t: +st.t.toFixed(2), type: 'tête', by: joueur.id, ...arme, mode: 'dégagement', h: +bp[1].toFixed(2), ...(saute ? { saut: true } : {}), ...(presse ? { corner: true } : {}) });
    return;
  }
  // LA REMISE DE LA TÊTE : le coéquipier proche, en cloche courte (balistique de la rentrée,
  // raccourcie — la tête part de 1,8 m, pas du sol)
  const candsT = st.players.filter((m) => m.team === joueur.team && m.id !== joueur.id && !m.keeper && m.down <= 0)
    .map((m) => ({ m, d: d2(m.p, joueur.p) })).filter((x) => x.d > 3 && x.d < 14).sort((a, b) => a.d - b.d);
  const lanceur = st.full && cfg.toucheAuPied && st.pass?.style === 'touche' ? st.pass.from : null;   /* (284) la remise de tête sur une touche ne REVIENT au lanceur qu'avec la part remiseLanceur × (2 − decF) — le bon décideur cherche l'autre */
  const mate = lanceur != null && candsT.length > 1 && candsT[0].m.id === lanceur && tirage(st, 'intention', joueur.id, st.rnd2 ?? st.rnd ?? (() => 0.5))() >= (cfg.toucheAuPied.remiseLanceur ?? 0.35) * (2 - (joueur.skill?.decF ?? 1)) ? candsT[1] : candsT[0];
  const dir = mate ? Math.atan2(mate.m.p[2] - joueur.p[2], mate.m.p[0] - joueur.p[0]) : Math.atan2(0, -Math.sign(own.x));
  const theta = 0.4;
  const speed = Math.sqrt(Math.max(4, mate ? mate.d : 9) * 9.81 / Math.sin(2 * theta)) * 0.85;
  st.ball.strike({ speed: speed * geneV, dirYaw: dir + gene, elevation: theta, spinAxis: [0, 1, 0], spinRev: 0 });
  surprend(st);
  st.pass = mate
    ? { from: joueur.id, to: mate.m.id, lead: [mate.m.p[0], 0, mate.m.p[2]], style: 'tête', t: st.t, flight: 2 * speed * Math.sin(theta) / 9.81, origin: [joueur.p[0], joueur.p[2]] }
    : null;
  st.events.push({ t: +st.t.toFixed(2), type: 'tête', by: joueur.id, ...arme, mode: 'remise', to: mate?.m.id, h: +bp[1].toFixed(2), ...(saute ? { saut: true } : {}) });
}

/** (B3, cfg.tete.armee) LA TÊTE S'ARME : le vol est déterministe — à chaque image on regarde où sera le ballon dans le temps de contact
 *  du clip (tete 0,42 s sauté, teteDebout 0,22 s debout) ; s'il y est à hauteur de tête et qu'un corps libre y sera aussi (sa position +
 *  sa vitesse × τ, à reach m), il ARME l'acte maintenant : windup skill 'tete' (anticipation τ), payload { kind 'tete', saut,
 *  ownsBody, mobile } — le corps continue sa course sous l'armé (mobile : movement ne le plante pas), le contact se résout à l'heure de
 *  l'acte (teteContact → teteStep forcé). Une seule tête armée par vol. Hier : la tête se décidait à l'image du contact, l'armé et
 *  l'impulsion étaient perdus — la scène jouait la seconde moitié du geste (0 windup 'tete' en 12 matchs). Absente : hier au bit. */
export function teteArmerStep(st, cfg) {
  const T = cfg.tete, A = T?.armee;
  if (!A || (st._teteCd ?? 0) > st.t || st.players.some((q) => q.act?.payload?.kind === 'tete') || (st._enchaine && st.t < st._enchaine.until)) return;   // (note 386) le ballon remonté par la poitrine appartient à la reprise enchaînée, pas à la tête
  const porte = (q) => (T.max ?? 2.2) + (T.saut ?? 0) * (q.skill?.sautF ?? 1);
  const mvS = MOVE_TIMING.tete || { duration: 0.9, contact: 0.42 }, mvD = MOVE_TIMING.teteDebout || { duration: 0.55, contact: 0.22 };
  const path = predictPath(st.ball, { maxT: Math.max(mvS.contact, mvD.contact) + 1 / 30 });
  let why = 'fenêtre';                                             // le dernier motif de non-armé du vol (lu par les sondes : st._teteArmWhy)
  for (const [mv, id, sauteVoulu] of [[mvS, 'tete', true], [mvD, 'teteDebout', false]]) {
    const tau = mv.contact, b = ballAt(path, tau), marge = A.marge ?? 0.25;
    // la fenêtre de l'armé descend d'une demi-marge sous celle du contact réactif : un vol raide (7 m/s) traverse [min ; max] en 0,1 s et
    // le corps qui arrive freine — mesuré au banc : manqué d'une image (b22 1,55 m à 1,06 m du corps, puis 1,42 m à 0,94) ; la portée
    // de l'armé est celle du contact (reach), la marge ne joue qu'à la résolution (teteStep forcé : reach + marge)
    if (b[1] < (T.min ?? 1.5) - marge * 0.5 || b[1] > (T.max ?? 2.2) + (T.saut ?? 0) * 1.25) continue;
    const saute = b[1] > (T.max ?? 2.2);
    if (saute !== sauteVoulu) continue;
    const ou = (q) => [q.p[0] + q.v[0] * tau, 0, q.p[2] + q.v[1] * tau];
    const pres = st.players.filter((q) => q.down <= 0 && !q.keeper && !q._sub && b[1] <= porte(q) && d2(ou(q), b) < (T.reach ?? 1.0));
    const q = pres.filter((q) => !q.act).sort((x, y) => d2(ou(x), b) - d2(ou(y), b))[0];
    if (!q) { why = pres.length ? 'acte' : 'personne'; continue; }
    const idG = id === 'tete' && modeTeteDefensive(st, q, b, cfg) ? 'teteDefensive' : id;   // (§ 10) le dégagement s'arme en teteDefensive (même durée, même contact : le flux d'hier)
    startGesture(q, { id: idG, duration: mv.duration, contact: mv.contact }, { payload: { kind: 'tete', saut: saute, ownsBody: true, mobile: true }, log: st.gestures });
    st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: q.id, move: idG, skill: 'tete', anticipation: +tau.toFixed(2), ...(saute ? { saut: true } : {}), h: +b[1].toFixed(2) });
    st._teteArmWhy = null; return;
  }
  st._teteArmWhy = why;
}

/** (B3) Le contact de l'acte 'tete' (rondo-sim, stepGesture 'contact') : la tête se résout maintenant, forcée sur ce corps. */
export function teteContact(st, p, cfg) { if (cfg.tete) teteStep(st, cfg, p); }

// LA RETOURNÉE ARMÉE (lot C1 — Animations_A_Faire § 2, cfg.retournee ; absente : hier au bit). Le clip authored `retournee` (1,35 s,
// contact 0,52 : accroupi, détente, le corps couché en l'air, la jambe droite en ciseaux par-dessus la tête, la retombée et le relevé
// DANS le clip) n'avait aucun déclencheur. Le vol est déterministe (le patron de B3) : un ballon libre prédit au contact du clip entre
// hMin et hMax m (la fenêtre au-dessus de la tête debout, sous le saut de tête), à `reach` d'un attaquant DOS AU BUT (le regard à plus de
// `dos` rad de la direction du but), dans la surface, à moins de `but` m, sans adversaire à `libre` m → l'acte part (ownsBody, le corps
// planté sur son point d'appel), et le contact de l'acte (retourneeContact) frappe au but depuis le ballon réel — ou se nomme manqué.
export function retourneeArmerStep(st, cfg) {
  const R = cfg.retournee; if (!R || (st._teteCd ?? 0) > st.t || st.ball.owner != null) return;
  if (st.players.some((q) => q.act?.payload?.kind === 'retournee')) return;
  const mv = MOVES.retournee ?? { duration: 1.35, contact: 0.52 }, tau = mv.contact;
  const b = ballAt(predictPath(st.ball, { maxT: tau + 1 / 30 }), tau);
  if (b[1] < (R.hMin ?? 1.5) || b[1] > (R.hMax ?? 2.1)) return;
  for (const q of st.players) {
    if (q.down > 0 || q.keeper || q._sub || q.act || d2(q.p, b) > (R.reach ?? 0.7)) continue;
    const goal = st.pitch.attackGoal(q.team), sgn = Math.sign(goal.x || 1);
    if (!st.pitch.inBox(q.p[0], q.p[2], sgn) || hyp(goal.x - q.p[0], q.p[2]) > (R.but ?? 16)) continue;
    let dA = Math.atan2(0 - q.p[2], goal.x - q.p[0]) - q.yaw; while (dA > Math.PI) dA -= 2 * Math.PI; while (dA < -Math.PI) dA += 2 * Math.PI;
    if (Math.abs(dA) < (R.dos ?? 2.0)) continue;                                                  // face ou de profil au but : la volée ou la tête, pas le ciseau
    if (st.players.some((o) => o.team !== q.team && o.down <= 0 && d2(o.p, q.p) < (R.libre ?? 1.5))) continue;   // un corps adverse à portée : le ciseau serait une faute
    startGesture(q, { id: 'retournee', duration: mv.duration, contact: mv.contact }, { payload: { kind: 'retournee', ownsBody: true, pick: { foot: 'right' }, h: b[1] }, log: st.gestures });
    st._teteCd = st.t + tau + 0.3;                                                                // un contact aérien par fenêtre de vol : la tête et la volée attendent l'acte
    st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: q.id, move: 'retournee', skill: 'retournee', anticipation: +tau.toFixed(2), h: +b[1].toFixed(2), dos: +Math.abs(dA).toFixed(2), ...(st._enchaine?.id === q.id && st.t < st._enchaine.until ? { enchaine: 'poitrine' } : {}) });   // (note 386)
    return;
  }
}

/** (C1) Le contact de l'acte 'retournee' : le ballon réel à portée et dans la fenêtre → la frappe au but (le canal shot, espèce 'retournée') ; sinon manquée, nommée. */
export function retourneeContact(st, p, cfg) {
  const R = cfg.retournee; if (!R) return;
  const bp = st.ball.p, goal = st.pitch.attackGoal(p.team), d = d2(p.p, bp);
  if (st.ball.owner != null || d > (R.reach ?? 0.7) + 0.25 || bp[1] < (R.hMin ?? 1.5) - 0.3 || bp[1] > (R.hMax ?? 2.1) + 0.3) {
    st.events.push({ t: +st.t.toFixed(2), type: 'retournée-manquée', by: p.id, h: +bp[1].toFixed(2), d: +d.toFixed(2) }); return;
  }
  const dGoal = hyp(goal.x - p.p[0], p.p[2]), v = (R.vitesse ?? 16) * (p.skill?.voleeF ?? 1);
  const tz = (tirage(st, 'tir', p.id, st.rnd ?? (() => 0.5))() * 2 - 1) * (st.pitch.goalHalf - 0.6);
  st._teteCd = st.t + 0.8; st.lastTouch = p.team; st.lastPasser = p.id;
  st.ball.strike({ speed: v, dirYaw: Math.atan2(tz - bp[2], goal.x - bp[0]), elevation: R.elevation ?? 0.05, spinAxis: [0, 1, 0], spinRev: 0.5 });
  surprend(st); st.pass = null;
  st.events.push({ t: +st.t.toFixed(2), type: 'retournée', by: p.id, h: +bp[1].toFixed(2), ...(st._enchaine?.id === p.id ? { enchaine: 'poitrine' } : {}) }); st._enchaine = cfg.enchainement ? { id: p.id, mode: 'tir', until: st.t + (cfg.enchainement.apres ?? 0.35) } : null;   // (note 386)
  const xgV = st.full && cfg.xg ? xgDe(st, p, cfg, false, cfg.xg.d?.retournee ?? cfg.xg.d?.volee ?? 0) : null; if (xgV) (st.xg ??= [0, 0])[p.team] += +xgV.ref.toFixed(3);
  st.events.push({ t: +st.t.toFixed(2), type: 'shot', by: p.id, kind: 'retournée', geste: 'retournée', range: +dGoal.toFixed(1), speed: +v.toFixed(1), ...(xgV ? { xg: +xgV.ref.toFixed(3), xgDec: +xgV.dec.toFixed(3), omega: +xgV.omega.toFixed(3) } : {}) });
}

// LA VOLÉE (lot 40) — le pied joue le ballon EN VOL, sous la fenêtre de tête. Mesuré avant :
// 4,4 s/12 min de fenêtres à hauteur de pied sur un corps, ZÉRO geste — et 0,0 s en surface
// face au but, car la chaîne du centre ne produisait QUE des cloches (le centre BAS naît avec
// ce lot, shooting.js). Deux métiers seulement : la REPRISE AU BUT en surface (l'espèce
// 'volée' — 'demi-volée' si le ballon REMONTE de son rebond, vy > 0) et le DÉGAGEMENT
// d'urgence près de son but. PAS de remise de volée : à hauteur de pied, hors de ces deux
// urgences, le vrai geste est le CONTRÔLE — la prise au sol existante s'en charge. Entre
// 1,15 et 1,5 m : la fenêtre MORTE (le contrôle de poitrine est une dette nommée). Le duel
// aérien reste à la tête (au pied c'est le pique au sol qui arbitre). Gardé cfg.volee &&
// st.full, cooldown partagé avec la tête (un contact aérien par fenêtre de vol).
export function voleeStep(st, cfg) {
  const V = cfg.volee;
  const bp = st.ball.p;
  if (bp[1] < (V.min ?? 0.25) || bp[1] > (V.max ?? 1.15)) return;
  if ((st._teteCd ?? 0) > st.t) return;
  const joueur = st.players.filter((q) => q.down <= 0 && !q.keeper && !q.act && d2(q.p, bp) < (V.reach ?? 1.1))
    .sort((a, b) => d2(a.p, bp) - d2(b.p, bp))[0];
  if (!joueur) return;
  const goal = st.pitch.attackGoal(joueur.team);
  const own = st.pitch.ownGoal(joueur.team);
  const sgn = Math.sign(goal.x || 1);
  const dGoal = hyp(goal.x - joueur.p[0], joueur.p[2]);
  if (dGoal < (V.but ?? 14) && st.pitch.inBox(joueur.p[0], joueur.p[2], sgn)) {
    // LA REPRISE DE VOLÉE : première intention, le canal shot standard — le plongeon répond
    const demi = st.ball.v[1] > 0.3;
    const tz = (tirage(st, 'tir', joueur.id, st.rnd ?? (() => 0.5))() * 2 - 1) * (st.pitch.goalHalf - 0.6);
    st._teteCd = st.t + 0.8;
    st.lastTouch = joueur.team; st.lastPasser = joueur.id;   // le toucher au grand livre (195, Loi 17)
    const vV = st.full && cfg.repertoire ? vitesseGeste(demi ? 'demi-volée' : 'volée', cfg.repertoire, joueur, { dGoal }) : 17;   /* (279) la volée du book : 26 [20-31] × powF (null : 17 d'hier) */
    st.ball.strike({ speed: vV, dirYaw: Math.atan2(tz - joueur.p[2], goal.x - joueur.p[0]), elevation: 0.06, spinAxis: [0, 1, 0], spinRev: 0.5 });
    surprend(st);
    st.pass = null;
    st.events.push({ t: +st.t.toFixed(2), type: 'volée', by: joueur.id, mode: 'but', demi, ...(st._enchaine?.id === joueur.id && st.t < st._enchaine.until ? { enchaine: 'poitrine' } : {}) });
    st._enchaine = cfg.enchainement ? { id: joueur.id, mode: 'tir', until: st.t + (cfg.enchainement.apres ?? 0.35) } : null;   // (note 386) la reprise se nomme ; sous clé, le tireur ne se RE-PREND pas sa volée (mesuré : 'amorti-poursuite' 3 images après le tir, le ballon encore à portée)
    const xgV = st.full && cfg.xg ? xgDe(st, joueur, cfg, false, cfg.xg.d?.[demi ? 'demiVolee' : 'volee'] ?? 0) : null; if (xgV) (st.xg ??= [0, 0])[joueur.team] += +xgV.ref.toFixed(3);   // (272) la volée porte son xG (δ volée −0,45 / demi-volée −0,20, § 2.3)
    st.events.push({ t: +st.t.toFixed(2), type: 'shot', by: joueur.id, kind: demi ? 'demi-volée' : 'volée', geste: 'volée', range: +dGoal.toFixed(1), speed: vV, ...(xgV ? { xg: +xgV.ref.toFixed(3), xgDec: +xgV.dec.toFixed(3), omega: +xgV.omega.toFixed(2) } : {}) });
    return;
  }
  if (hyp(own.x - joueur.p[0], joueur.p[2]) < 24) {
    // LE DÉGAGEMENT DE VOLÉE : le défenseur boxe le vol loin de son but, vers l'avant et le flanc
    st._teteCd = st.t + 0.8;
    st.lastTouch = joueur.team; st.lastPasser = joueur.id;   // le toucher au grand livre (195, Loi 17)
    const fz = joueur.p[2] >= 0 ? 0.5 : -0.5;
    st.ball.strike({ speed: 14, dirYaw: Math.atan2(fz, -Math.sign(own.x)), elevation: 0.38, spinAxis: [0, 1, 0], spinRev: 0 });
    surprend(st);
    st.pass = null;
    st.events.push({ t: +st.t.toFixed(2), type: 'volée', by: joueur.id, mode: 'dégagement' });
    return;
  }
  // L'AMORTI DE LA RETOMBÉE (lot 52, V.amorti — retour utilisateur « les contrôles sur les
  // passes longues sont tous ratés ») : le DESTINATAIRE de la passe joue le ballon EN
  // DESCENTE, à portée, hors des deux urgences — la première touche du pied/de la cuisse TUE
  // le vol (le ballon meurt à ses pieds, la prise suit au pas d'après). Mesuré avant : 56/82
  // passes longues finissaient en chasse au rebond (le vol retombait, cabriolait — p90
  // 5 rebonds, 9 m, 2,8 s — et le receveur poursuivait). C'était la loi manquante nommée au
  // lot 40 (« le contrôle est le vrai geste ») : LE VOICI. La note de contrôle module le
  // résiduel (un mauvais premier toucher laisse le ballon vivre un peu).
  if (V.amorti !== false && st.pass && st.pass.to === joueur.id && st.ball.v[1] < -0.4) {
    st._teteCd = st.t + 0.8;
    st.lastTouch = joueur.team; st.lastPasser = joueur.id;   // le toucher au grand livre (195, Loi 17)
    const ctl = Math.min(1.2, joueur.skill?.controlF ?? 1);
    const k = (V.amortiK ?? 0.85) * ctl;
    // …et l'amorti amortit AUSSI la rotation (lot 54 — le spin orphelin ; doc : match-config)
    st.ball.impulse([-st.ball.v[0] * k, -st.ball.v[1] * 0.85, -st.ball.v[2] * k],
      st.full && cfg.amortiSpin !== false ? [-st.ball.w[0] * k, -st.ball.w[1] * k, -st.ball.w[2] * k] : null);
    st.pass = null;
    st.events.push({ t: +st.t.toFixed(2), type: 'control', by: joueur.id, tech: 'amorti-retombée', foot: 'any',
      surface: bp[1] > 0.7 ? 'thigh' : 'instep', speed: +hyp(st.ball.v[0], st.ball.v[2]).toFixed(1), settle: null });
    return;
  }
  // sinon : ON NE VOLLEYE PAS — le contrôle au sol est le vrai geste du milieu de terrain
}

/** LA POITRINE (lot 182a, cfg.poitrine && st.full — la fenêtre MORTE [1,15 ; 1,55] nommée au
 *  lot 40 : entre volee.max et tete.min AUCUNE loi ne jouait le vol — filmé aux centres :
 *  des ballons de boîte croisant un corps à 0,5 m à hauteur de poitrine, perdus). Le geste
 *  réel : le COÉQUIPIER du dernier toucheur encaisse le vol du buste — le ballon meurt et
 *  TOMBE devant lui (l'amorti n'est pas une prise : ballon LIBRE, hors servo — la note du
 *  contrôle module le résiduel, le canal du 181). L'adversaire ne joue pas la poitrine en
 *  vol (son ciel est la tête, son urgence la volée). Cooldown partagé _teteCd (un contact
 *  aérien par fenêtre de vol). Clé absente : la fenêtre morte d'hier au bit. */
export function chestStep(st, cfg, dt = 1 / 60) {
  const P = cfg.poitrine;
  if (!P || !st.full) return;                                      // clé absente : la fenêtre morte d'hier
  const bp = st.ball.p, bv = st.ball.v;
  // …au SEGMENT de la frame, pas au point (leçon 181 : un centre à 15-20 m/s fait 0,3 m par
  // échantillon — le rayon binaire par frame regardait le vol passer ENTRE deux images)
  const b0 = [bp[0] - bv[0] * dt, bp[1] - bv[1] * dt, bp[2] - bv[2] * dt];
  if (Math.max(b0[1], bp[1]) < (P.min ?? 1.15) || Math.min(b0[1], bp[1]) > (P.max ?? 1.55)) return;
  if ((st._teteCd ?? 0) > st.t) return;
  const camp = st.lastTouch;
  if (camp == null) return;
  const sx = bp[0] - b0[0], sz = bp[2] - b0[2], sl = sx * sx + sz * sz;
  let joueur = null, bd = 99, bt = 1;
  for (const q of st.players) {
    if (q.down > 0 || q.keeper || q.act || q.team !== camp) continue;
    const tS = sl > 1e-9 ? Math.max(0, Math.min(1, ((q.p[0] - b0[0]) * sx + (q.p[2] - b0[2]) * sz) / sl)) : 1;
    const h = b0[1] + (bp[1] - b0[1]) * tS;
    if (h < (P.min ?? 1.15) || h > (P.max ?? 1.55)) continue;
    const d = hyp(q.p[0] - (b0[0] + sx * tS), q.p[2] - (b0[2] + sz * tS));
    // le RECEVEUR ATTITRÉ coupe SA passe d'un pas de buste (reachTo — filmé : le centre tendu ne
    // chute pas en boîte, il le croisait à 0,8 m en route vers une chute lointaine, muet)
    const portee = st.pass && st.pass.to === q.id ? (P.reachTo ?? 0.9) : (P.reach ?? 0.55);
    if (d < portee && d < bd) { bd = d; joueur = q; bt = tS; }
  }
  if (!joueur) return;
  st.lastTouch = joueur.team; st.lastPasser = joueur.id;   // le toucher au grand livre (195, Loi 17)
  const ctl = Math.min(1.2, joueur.skill?.controlF ?? 1);
  const k = Math.min(0.9, (P.kill ?? 0.78) * ctl);
  const dw = st.full && cfg.amortiSpin !== false ? [-st.ball.w[0] * k, -st.ball.w[1] * k, -st.ball.w[2] * k] : null;
  // (L'ENCHAÎNEMENT, note 386 — cfg.enchainement) LA POITRINE PRÉPARE LA REPRISE : dans la surface, face au but, elle POSE le ballon
  // devant (avance m/s dans le regard, pop vertical) — il retombe à hauteur de reprise en delai s et voleeStep l'enchaîne (la volée) ;
  // dos au but et libre, elle le REMONTE au-dessus de la tête (pop m/s, un peu vers le but) et retourneeArmerStep l'arme au pas d'après
  // (le ciseau). Hier : le ballon mourait devant (kill) et le cooldown de 0,8 s fermait toute reprise. Clé absente : hier au bit.
  const E = st.full ? cfg.enchainement : null, goal = st.pitch.attackGoal(joueur.team), sgn = Math.sign(goal.x || 1);
  const dG = hyp(goal.x - joueur.p[0], joueur.p[2]), boite = st.pitch.inBox(joueur.p[0], joueur.p[2], sgn) && dG < (E?.but ?? 16);
  let dA = Math.atan2(0 - joueur.p[2], goal.x - joueur.p[0]) - joueur.yaw; while (dA > Math.PI) dA -= 2 * Math.PI; while (dA < -Math.PI) dA += 2 * Math.PI;
  const libre = !st.players.some((o) => o.team !== joueur.team && o.down <= 0 && d2(o.p, joueur.p) < (E?.libre ?? 1.5));
  let mode = null;
  // …le ballon est POSÉ à l'heure de la reprise : vers un point (devant m dans le regard / au-dessus de lui, hauteur m) atteint en tau s —
  // la vitesse se déduit du ballon réel (la poitrine le prend jusqu'à 0,9 m du corps : un pop droit laissait le ciseau à 0,75 m, hors portée)
  const pose = (tau, devant, hauteur) => { const tx = joueur.p[0] + Math.cos(joueur.yaw) * devant, tz = joueur.p[2] + Math.sin(joueur.yaw) * devant;
    st.ball.impulse([-st.ball.v[0] + (tx - bp[0]) / tau, -st.ball.v[1] + (hauteur - bp[1] + 4.905 * tau * tau) / tau, -st.ball.v[2] + (tz - bp[2]) / tau], dw); };
  if (E?.retournee && cfg.retournee && boite && Math.abs(dA) >= (cfg.retournee.dos ?? 2.0) && libre) {
    const R = E.retournee, tau = (MOVES.retournee?.contact ?? 0.52) + 0.05;
    pose(tau, -(R.devant ?? 0.15), R.hauteur ?? 1.75);   // au-dessus de lui, un peu derrière (vers le but : il est dos)
    st._teteCd = st.t + 0.05; mode = 'retournee';
  } else if (E?.volee && cfg.volee && boite && Math.abs(dA) <= (E.volee.face ?? 1.0)) {
    const V = E.volee, tau = V.delai ?? 0.45;
    pose(tau, V.devant ?? 0.6, V.hauteur ?? 0.7);      // devant lui, à hauteur de reprise
    st._teteCd = st.t + tau - 0.05; mode = 'volee';
  } else {
    st._teteCd = st.t + 0.8;
    st.ball.impulse([-st.ball.v[0] * k, -st.ball.v[1] * 0.8 - 0.5, -st.ball.v[2] * k], dw);
  }
  if (mode) st._enchaine = { id: joueur.id, mode, until: st.t + 1.4 };
  st.pass = null;
  st.events.push({ t: +st.t.toFixed(2), type: 'control', by: joueur.id, tech: 'poitrine', foot: 'any',
    surface: 'chest', speed: +hyp(st.ball.v[0], st.ball.v[2]).toFixed(1), settle: null, ...(mode ? { enchaine: mode } : {}) });
}
import { hyp } from './hyp.js';
