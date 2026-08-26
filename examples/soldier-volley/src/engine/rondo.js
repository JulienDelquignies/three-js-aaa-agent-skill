import { BALL } from './ball.js';
import { BallBody } from './ball-body.js';
import { predictPath, solvePass, laneClearance, interceptPoint, PASS_STYLE } from './ball-predict.js';
import { winding } from './gesture.js';
import { makePersona } from './persona.js';
import { offsideLine } from './offside.js';
import { tac, axe } from './tactics.js';
import { movePlayers, separatePlayers } from './movement.js';
import { dansCone } from './dribble.js';
import { RONDO } from './rondo-config.js';
export { RONDO };

// rondo — the brain of a "passe à dix": 5 v 5, the team in possession strings passes, the team out
// of possession hunts the ball. Dependency-free (ball.js + ball-predict.js only) and fully
// simulatable headless, so the whole game can be proved in node before a single triangle is drawn.
//
// The design fights the two classic failures of AI football:
//   THE BEEHIVE — every player converging on the ball. Cured by giving each off-ball player an
//   explicit JOB (support angle / presser / cover / marker) and scoring positions, never by
//   pointing everyone at the ball.
//   THE HOPEFUL PASS — a ball hit at a covered team-mate. Cured by scoring lanes with real
//   clearance geometry and by INVERSE BALLISTICS, so the chosen pass actually arrives.


const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** Build the opening position: two teams of `perTeam`, ring formation, ball on team 0. */
export function makeRondo({ perTeam = 5, seed = 1, area = RONDO.area } = {}) {
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const players = [];
  for (let t = 0; t < 2; t++) {
    for (let i = 0; i < perTeam; i++) {
      const a = (i / perTeam) * Math.PI * 2 + (t ? Math.PI / perTeam : 0);
      const r = t === 0 ? area[0] * 0.34 : area[0] * 0.19;
      players.push({
        team: t, id: players.length,
        p: [Math.cos(a) * r + (rnd() - 0.5), 0, Math.sin(a) * r * 0.8 + (rnd() - 0.5)],
        v: [0, 0], speed: 0, yaw: a + Math.PI, job: 'support', target: null, foot: 'right',
        persona: makePersona(t * perTeam + i, seed),   // l'identité de mouvement — une source, sim ET visuel
        down: 0,          // seconds still on the ground after a slide tackle
        push: null,       // the direction the carrier wants his ball to go
        act: null,        // the gesture in progress (gesture.js) — it owns him while it runs
        yawWant: null,    // a facing he is turning ONTO, at a bounded rate — never a snap
      });
    }
  }
  const carrier = 0;
  return {
    t: 0, players, area,
    // LE HASARD DU JEU EST SEEDÉ, ET IL VIT SUR L'ÉTAT. La tenue délibérée du porteur et la variance
    // du temps au sol d'un tacle tirent ici — jamais Math.random : même graine, même partie, et le
    // contrat de déterminisme de verify-rondo le prouve à chaque run.
    rnd,
    // LE BALLON EST UN CORPS, pas un objet nu. Sa position est en lecture seule : écrire `ball.p`
    // LÈVE. C'est ce qui rend les 285 téléportations mesurées impossibles par construction plutôt
    // qu'interdites par une règle qui, elle, était aveugle (voir ball-body.js).
    ball: new BallBody([players[carrier].p[0] + 0.6, BALL.radius, players[carrier].p[2]]),
    possession: { team: 0, carrier }, hold: 0, pressure: 0,
    gestures: [],                    // the log every swing writes to (gesture.js) — the contract reads it
    passes: 0, best: 0, turnovers: 0,
    phase: 'carry', pass: null, lastPasser: -1, events: [],
  };
}

const mates = (st, team) => st.players.filter((p) => p.team === team);
const foes = (st, team) => st.players.filter((p) => p.team !== team);

/** Which foot should strike, given where the player faces and where the ball must go. */
export function strikingFoot(yaw, from, to) {
  const side = Math.cos(yaw) * (to[2] - from[2]) - Math.sin(yaw) * (to[0] - from[0]);
  return side > 0 ? 'right' : 'left';
}

/**
 * Score every available pass and return the best. This is where possession is kept or lost:
 * an open lane, a receiver who is not under pressure, a sane distance, and a change of angle
 * that drags the press out of shape.
 */
export function choosePass(st, cfg = RONDO) {
  const c = st.players[st.possession.carrier];
  if (!c) return null;
  const foesL = foes(st, c.team);
  const opp = foesL.map((p) => p.p);
  // the pass leaves the BALL, not the player's navel — the dribbler carries it a metre or two
  // ahead, and judging the lane from his hips is how a "clear" pass hits a defender's shin
  const origin = [st.ball.p[0], BALL.radius, st.ball.p[2]];
  // LA LOI 11 EST DANS LE CERVEAU AVANT D'ÊTRE DANS LE SIFFLET (cfg.offside — 11c11 seulement) :
  // on ne SERT pas un coéquipier en position de hors-jeu. La position se juge MAINTENANT ; la
  // photo légale, elle, se prend au DÉPART du ballon (strikeNow) — entre les deux vit l'armé,
  // et c'est exactement la fenêtre de l'appel timé : le coureur qui jaillit de la ligne pendant
  // l'armé est servi LÉGALEMENT. Clé absente (rondo, réduit futsal) : pas un bit ne bouge.
  const offL = cfg.offside && st.full ? offsideLine(st, c.team) : null;
  // LE STYLE ÉCRIT LES CIRCUITS (lot 36) : l'axe style [0..1] de la tactique (0 possession ↔
  // 1 direct) module le VOCABULAIRE — la possession bascule tôt et volontiers (le jeu en U),
  // le direct sert la PROFONDEUR (le coureur d'abord). À 0,5 : les valeurs d'aujourd'hui,
  // EXACTEMENT (axe() au milieu exact — la leçon ulp de tactics). Rondo/réduit : st.full.
  const _sty = (cfg.renversement || cfg.appelBonus) && st.full ? tac(st, c.team).style : 0.5;
  // …ET LA FIXATION MÛRE OUVRE LA PROFONDEUR (lot 98, renversement.ouvre) : le bloc attiré côté
  // ballon (≥ 3 passes conclues) libère la course de rupture — le service du coureur (lot 41)
  // pèse plus au barème. C'est le VRAI dividende de la fixation au football : la profondeur
  // d'abord, l'aile opposée ensuite. Mesuré avant la loi : le dosage du renversement seul
  // faisait RECULER le jeu (dernier tiers 42 → 37 %, fins basses 12 → 20). ouvre absent : 1.
  const _fixMur = st.full && cfg.renversement && (st._fix?.team === c.team ? st._fix.n : 0) >= 3;
  const _appelEff = (cfg.appelBonus ?? 0) * axe(_sty, 0.7, 1.3) * (_fixMur ? (cfg.renversement.ouvre ?? 1) : 1);
  // la DENSITÉ côté ballon, comptée une fois par appel : le bloc qui comprime est la
  // CONDITION du renversement (clé absente ou monde réduit : jamais dense, pas un bit)
  // …ET LA FIXATION D'ABORD (lot 98, renversement.fix — retour utilisateur « le football passe
  // d'abord par les une-deux du même côté avant de changer : il faut fixer côté ballon ») :
  // mesuré, 12,3 renversements / 220 s (réel 0,3-0,9), 30 % sans UNE passe du même côté. Le
  // droit à la diagonale se GAGNE : n passes conclues du même côté (st._fix, beginPass) —
  // possession 5 (elle déforme avant d'ouvrir), direct 3 (il joue vite) ; le grand passeur
  // (passSigma < 2°) la voit un temps plus tôt ; et pas deux diagonales dans la même
  // respiration (respire s d'équipe — à 20 s le monde rendait encore 5,3 bascules/220 s,
  // réel 0,3-0,9). fix:false : les bascules libres d'hier, au bit près.
  const _fixOK = cfg.renversement?.fix === false
    || ((st._fix?.team === c.team ? st._fix.n : 0)
        >= Math.max(1, Math.round(3 + axe(_sty, 2, 0)) - ((c.skill?.passSigma ?? 1) < 0.035 ? 1 : 0))
      && (st._basculeAt?.[c.team] ?? -99) < st.t - (cfg.renversement?.respire ?? 20));
  const _dense = !!(cfg.renversement && st.full) && _fixOK
    && foesL.filter((q) => q.down <= 0 && d2(q.p, origin) < (cfg.renversement.rayon ?? 12)).length
      >= (cfg.renversement.dense ?? 5) + axe(_sty, -1, 1);
  // LA SORTIE AU GARDIEN (lot 136, cfg.sortieGardien && st.full — mesuré : 0 passe au gardien
  // / 533, la sortie n°1 du vrai foot n'existait pas : le barème enterre le recul). Le porteur
  // PRESSÉ dans son tiers bas avec un couloir propre vers son gardien : le retrait se BONIFIE —
  // la possession y tient (axe style), le sang-froid (composureF) ose ; cooldown d'équipe
  // (beginPass le pose) contre le ping-pong gardien-défenseur. false : le gardien invisible.
  let gardienOk = false;
  if (st.full && cfg.sortieGardien !== false && st.pitch && !c.keeper
    && (st._gkOutCd?.[c.team] ?? -1) < st.t) {
    const _og = st.pitch.ownGoal(c.team), _osg = Math.sign(_og.x || 1);
    if (c.p[0] * _osg > st.pitch.hx * 0.05) {   // son tiers bas (repère : vers SON but)
      let foeP = 99;
      for (const q of foesL) if (q.down <= 0) foeP = Math.min(foeP, d2(q.p, c.p));
      gardienOk = foeP < (cfg.sortieGardien?.press ?? 5);
    }
  }
  let best = null;
  for (const m of mates(st, c.team)) {
    if (m.id === c.id) continue;
    // EN VETO : beginPass a fait courir la défense sur le vrai vol vers ce receveur (flightRace) et
    // elle gagne — re-proposer la même ligne à l'image suivante, c'est mourir en boucle sur un refus.
    // Le veto expire vite (la défense bouge), et tombe à holdMax : forcé, on joue le moins mauvais.
    if (st.laneVeto?.[m.id] > st.t && st.hold < cfg.holdMax) continue;
    // UN CORPS QUI NE PEUT PAS JOUER N'EST PAS UNE OPTION (lot 52 — exposé par le banc de
    // l'expulsion : le cerveau a servi un expulsé en marche vers sa sortie). Au sol, expulsé,
    // remplacé : hors barème. Le réduit garde son étalon au bit près (dette nommée : ses
    // corps au sol d'un tacle restent techniquement visables ~1 s).
    if (st.full && (m.down > 0 || m.expulse || m._sub)) continue;
    if (offL && m.p[0] * offL.sgn > offL.adv + 0.05) continue;      // hors-jeu : on attend sa course
    const d = d2(origin, m.p);
    // LE RENVERSEMENT (cfg.renversement && st.full — lot 35, diagnostic utilisateur « densité
    // du jeu axial ») : quand le bloc adverse COMPRIME le côté ballon, l'aile OPPOSÉE est la
    // sortie — la diagonale longue, en cloche, PAR-DESSUS le bloc. Mesuré avant : 76 % du jeu
    // à |z| < 8 (réel ~45), passe max du vocabulaire 21,9 m, 1 renversement / 4 matchs (réel
    // 3-8). Le candidat de bascule se juge par SA loi : portée étendue, point doux neutralisé,
    // le lofted est sa nature (pas une pénalité) — le reste du barème (pression à l'arrivée,
    // sens du jeu) continue de parler.
    const bascule = _dense && Math.sign(m.p[2] || 1) !== Math.sign(origin[2] || 1)
      && Math.abs(m.p[2] - origin[2]) > (cfg.renversement.dz ?? 18);
    // LE COULOIR OUVERT (lot 99, cfg.couloir && st.full — la dette du lot 98 : le jeu vivait
    // 65 % dans l'axe, réel ~35, et 4 % des ailiers LIBRES étaient servis). Deux verrous
    // tenaient l'aile hors du jeu : la passe d'ÉCARTEMENT (15-25 m latérale) vivait HORS
    // PORTÉE (passRange ~13 — le même verrou que la bascule avant sa loi), et le barème
    // n'avait aucune valeur de position. Le vrai football SAIT qu'un ailier lancé dans un
    // couloir libre est une RAMPE (débordement lot 87, centre lot 47) : l'option d'AILE
    // (|z| > largeur/4) en zone offensive avec DU CHAMP devant elle (aucun adversaire à
    // moins de `champ` m dans sa bande ± large m) ÉTEND la portée (couloir.portee) et vaut
    // un bonus — modulé par l'axe tactique LARGEUR (×0,6…1,4 ; 0,5 = ×1 exact) et la POINTE
    // DE VITESSE du receveur (topF 0,9…1,1 → ×0,7…1,3 ; 1 = ×1 exact — l'ailier rapide dans
    // l'espace est LE danger). Clé absente : 0 et portée d'hier, pas un bit.
    let couloirB = 0;
    if (st.full && cfg.couloir && Math.abs(m.p[2]) > st.area[1] * 0.25) {
      const _g = st.pitch.attackGoal(c.team), _sg = Math.sign(_g.x || 1);
      if (_sg * m.p[0] > -5) {
        let champ = 99;
        for (const o of foesL) {
          if (o.down > 0 || Math.abs(o.p[2] - m.p[2]) > (cfg.couloir.large ?? 6)) continue;
          if (_sg * (o.p[0] - m.p[0]) > -1) champ = Math.min(champ, Math.hypot(o.p[0] - m.p[0], o.p[2] - m.p[2]));
        }
        if (champ > (cfg.couloir.champ ?? 8))
          couloirB = (cfg.couloir.bonus ?? 2.2) * axe(tac(st, c.team).largeur, 0.6, 1.4)
            * (0.7 + 3 * Math.max(0, Math.min(0.2, (m.skill?.topF ?? 1) - 0.9)));
      }
    }
    // L'ÉCART DE CIRCULATION (lot 105, cfg.ecarte — « encore trop axial » : C→W 2 % mesuré,
    // le ballon central ne SORT jamais). Le couloir (lot 99) exige un couloir VIDE (champ 8 —
    // le débordement lancé) : en bloc organisé il ne s'ouvre pas. La sortie d'axe du VRAI
    // football sert l'ailier MARQUÉ À DISTANCE RAISONNABLE (> marque m — le un-contre-un
    // commence) : porteur POSÉ (pressure < calme), cible NETTEMENT plus large (Δ|z| > dz),
    // bonus × axe largeur et portée étendue. Clé absente : 0 et la porte d'hier, pas un bit.
    let ecarteB = 0;
    if (st.full && cfg.ecarte && couloirB === 0 && Math.abs(m.p[2]) > (cfg.ecarte.z ?? 12)
      && Math.abs(m.p[2]) - Math.abs(c.p[2]) > (cfg.ecarte.dz ?? 6) && st.pressure < (cfg.ecarte.calme ?? 0.4)) {
      let marque = 99;
      for (const o of foesL) if (o.down <= 0) marque = Math.min(marque, d2(o.p, m.p));
      if (marque > (cfg.ecarte.marque ?? 2.5)) ecarteB = (cfg.ecarte.bonus ?? 1.4) * axe(tac(st, c.team).largeur, 0.6, 1.4);
    }
    // L'APPEL ÉTIRE LA PORTÉE (cfg.appelRange — PLEIN FORMAT seulement, comme toute la Loi 11) :
    // un coureur en rupture se sert DANS la course, plus loin qu'une passe de circulation (le
    // dart sortait de l'enveloppe en 0,6 s — mesuré : 11 appels, 1 servi). La garde st.full est
    // une leçon MESURÉE : sans elle, les bursts cadencés du réduit héritaient de l'extension et
    // un monde calibré 76 clauses a bougé (tempsLoin 4,6 > 2,5). Clé ou format absents : + 0.
    const rMax = bascule ? (cfg.renversement.portee ?? 38)
      : couloirB > 0 ? Math.max(cfg.passRange[1], cfg.couloir.portee ?? 24)   // la passe d'ÉCARTEMENT a sa porte (lot 99)
      : ecarteB > 0 ? Math.max(cfg.passRange[1], cfg.ecarte.portee ?? 32)     // la sortie d'axe a la sienne (lot 105)
      : gardienOk && m.keeper ? (cfg.sortieGardien?.portee ?? 26)             // la sortie au gardien a la SIENNE (lot 136 — le retrait vit à 20-30 m)
      : cfg.passRange[1] + (st.full && (m._pace?.until ?? -1) > st.t && m._pace.kind === 'appel'
        ? (cfg.appelRange ?? 0) + (cfg.tranchant && m._pace.rupture ? (cfg.tranchant.portee ?? 12) : 0) : 0);   // …la RUPTURE (140) se sert de LOIN
    if (d < cfg.passRange[0] || d > rMax) continue;
    // aim slightly in front of the receiver so he runs onto it rather than waiting for it
    // LA MÈNE SUIT LA COURSE (cfg.leadTime — le match la dérive du temps de vol : un coureur à
    // 6 m/s sur un vol d'une seconde reçoit 4 m derrière lui avec une mène figée de 0,28 s ;
    // mesuré en match : 21 % de passes reçues). Le rondo garde sa mène courte (carré court).
    const tLead = cfg.leadTime ? cfg.leadTime(d2(origin, m.p), m) : 0.28;
    const lead = [m.p[0] + m.v[0] * tLead, BALL.radius, m.p[2] + m.v[1] * tLead];
    const lane = laneClearance(origin, lead, opp, { corridor: cfg.corridor });
    // LA LIBERTÉ DU RECEVEUR SE MESURE À L'ARRIVÉE, PAS SUR LA PHOTO. La pression « maintenant »
    // notait libre un homme dont le marqueur arrivait pendant l'armé + le vol — mesuré : la
    // possession médiane tacklée mourait 0,76 s APRÈS la réception, la pression commençait AVEC le
    // ballon. Les défenseurs sont donc PROJETÉS au moment d'arrivée (armé ~0,4 s + vol au tempo du
    // jeu) — même philosophie que la course du couloir : le temps, pas la géométrie figée.
    const tArr = 0.4 + d / 9;
    const recvPressure = Math.min(...foesL.map((o) => Math.hypot(o.p[0] + o.v[0] * tArr - lead[0], o.p[2] + o.v[1] * tArr - lead[2])), 99);
    // a lofted ball beats a blocked lane, at the cost of being slower and harder to control
    const style = bascule ? 'lofted'                               // la diagonale VOLE par-dessus le bloc
      : lane.open ? (d > 13 ? 'driven' : 'ground') : (lane.margin > 0.5 ? 'driven' : 'lofted');
    const blocked = !lane.open && style !== 'lofted';
    if (blocked) continue;
    // UNE PASSE MANQUÉE PRÈS DE LA LIGNE EST UNE SORTIE EN PRÉPARATION. Mesuré : la sortie de but
    // était devenue la première cause de perte (77/191 sur 8 graines), dont un tiers en vol — le
    // ballon dépasse son receveur et roule ~8 m. Si la ligne de sortie est à moins de 3 m DERRIÈRE
    // le point de réception (dans l'axe de la passe), le ballon raté ne pardonne pas : pénalité.
    let overrun = 99;
    {
      const ux = (lead[0] - origin[0]) / d, uz = (lead[2] - origin[2]) / d;
      const hx = st.area[0] / 2, hz = st.area[1] / 2;
      if (ux > 1e-6) overrun = Math.min(overrun, (hx - lead[0]) / ux);
      else if (ux < -1e-6) overrun = Math.min(overrun, (-hx - lead[0]) / ux);
      if (uz > 1e-6) overrun = Math.min(overrun, (hz - lead[2]) / uz);
      else if (uz < -1e-6) overrun = Math.min(overrun, (-hz - lead[2]) / uz);
    }
    // LE COUREUR VIVANT A SA LOI AUSSI (lot 36 — l'équilibrage nommé au lot 35 : la bascule,
    // option sûre, avait tué le service de l'appel — 0-2 servis / 3 graines) : comme la
    // bascule, la course profonde ne se juge pas au point doux des 10 m. Gardé st.full via
    // le kind 'appel' (les bursts du réduit n'existent que sous st.full — miroirs intacts).
    const servi = st.full && (m._pace?.until ?? -1) > st.t && m._pace.kind === 'appel';
    // LA PASSE EN PROFONDEUR AU SOL (128, cfg.throughBall && servi — demande utilisateur :
    // « comment gérer le bon ajustement ? ») : LE RENDEZ-VOUS ITÉRÉ — la mène générique
    // (position + v×tLead estimé) arrivait derrière le coureur (l'estimation ignore le roulis
    // réel) ; ici le point s'auto-cohère (t passe = t course : solvePass rend le temps du
    // roulis EXACT, 2 itérations convergent) + LA POINTE D'INTERVALLE (2,5 m plus profond —
    // le coureur attaque l'espace, pas son ombre) ; l'ARRIVÉE se dose au CONTROL du receveur
    // (4,8 + 1,7 × controlF : le bon toucher reçoit plus vif, moins interceptable — l'attribut
    // dans l'équation même du dosage). Le couloir vers CE point est re-jugé. Absente : hier.
    let through = null;
    if (servi && cfg.throughBall) {
      const vRun = Math.hypot(m.v[0], m.v[1]);
      if (vRun > 2.5) {
        const dirC = [m.v[0] / vRun, m.v[1] / vRun];
        const arr = Math.max(4.2, Math.min(6.5, 4.8 + 1.7 * ((m.skill?.controlF ?? 1) - 0.85) / 0.3));
        // …L'AIGUILLE (140) : le couloir exigé se resserre pour le PASSEUR à la vision
        // (visionF 0,85…1,15, 1 = ×1 exact au 50) — la tranchante passe par le chas
        const aiguille = st.full && cfg.tranchant ? Math.max(0.78, Math.min(1.15, 2 - (c.skill?.visionF ?? 1))) : 1;
        // le rendez-vous itéré, essayé avec un PLANCHER d'avance (0 = la pointe d'hier)
        const essaye = (plancher) => {
          let tRdv = d2(origin, m.p) / 11, P = null, solT = null;
          for (let it = 0; it < 2; it++) {
            const adv = Math.max(vRun * tRdv + (cfg.throughBall.pointe ?? 2.5), plancher);
            P = [m.p[0] + dirC[0] * adv, BALL.radius, m.p[2] + dirC[1] * adv];
            solT = solvePass(origin, P, { style: 'ground', arrival: arr });
            if (!solT) return null;
            tRdv = solT.flightTime;
          }
          const laneT = laneClearance(origin, P, opp, { corridor: (cfg.corridor ?? 1.15) * aiguille });
          return laneT.open ? { lead: P, lane: laneT, arr } : null;
        };
        // …la RUPTURE REND-EZ-VOUS DERRIÈRE LA LIGNE (140) : le coureur est ON-SIDE à la passe
        // (dart capé à la ligne), le BALLON va derrière elle — le point profond (ligne + pointe
        // 6 m, plafonné hors des gants à −8 m du but) se TENTE d'abord ; couloir fermé ou
        // insolvable, on RETOMBE sur le point d'hier (le plancher dur tuait la candidature :
        // through 59 → 42 mesuré). La sonde AVANT : 3 réceptions derrière la ligne / 20 min.
        let plancher = 0;
        if (cfg.tranchant && m._pace?.rupture) {
          const _gx = st.pitch.attackGoal(c.team).x, gS = Math.sign(_gx || 1);
          const dxu = dirC[0] * gS;
          if (dxu > 0.4) {
            let ligne = -Infinity;
            for (const q of foesL) if (!q.keeper && q.down <= 0) ligne = Math.max(ligne, q.p[0] * gS);
            plancher = Math.min((ligne - m.p[0] * gS + (cfg.tranchant.pointe ?? 6)) / dxu,
              (Math.abs(_gx) - 8 - m.p[0] * gS) / dxu);
          }
        }
        through = (plancher > 0 ? essaye(plancher) : null) ?? essaye(0);
      }
    }
    const score =
      Math.min(lane.margin, 4) * 2.4                       // clearance is king
      + Math.min(recvPressure, 9) * 1.15                    // pass to the man who will BE free
      - (bascule || servi ? 0.8 : Math.abs(d - 10) * 0.32)  // 10 m is the sweet spot — bascule et course ont LEUR loi
      - (m.id === st.lastPasser ? 2.6 : 0)                  // don't ping-pong
      - (style === 'lofted' && !bascule ? 2.2 : 0)          // ground ball whenever possible — le lofted EST la bascule
      - (overrun < 3 ? (3 - overrun) * 0.9 : 0)             // ne joue pas VERS la sortie toute proche
      + (bascule ? (cfg.renversement.bonus ?? 1.5) + axe(_sty, 0.5, -0.5) : 0)   // sortir de l'étau — la possession y tient
      + (servi ? _appelEff - (cfg.appelBonus ?? 0) : 0)     // le delta du style sur le service (le terme de base vit plus bas)
      // LE MATCH A UN SENS DE JEU (cfg.passBias, match-sim) : le rondo conserve, une équipe
      // PROGRESSE — sans ce terme, mesuré : possession dominante (191 c. 140 images de conduite)
      // entièrement à x = −15, toutes les pertes entre −9 et −23, zéro sortie de camp en 120 s.
      + (cfg.passBias ? cfg.passBias(st, c, { to: m, lead, lane, dist: d }) : 0)
      // …ET L'APPEL EST SERVI (cfg.appelBonus) : un coureur en rupture APPELLE le ballon — la
      // passe qui le suit est la définition même de « suivre l'appel » (mesuré avant : 5 appels
      // servis sur 74 — les ruptures étaient un décor)
      + ((m._pace?.until ?? -1) > st.t ? (cfg.appelBonus ?? 0) : 0)
      // LA VERTICALITÉ DU REGAIN (lot 111, cfg.moments.vertical && st.full) : le bloc adverse
      // est DÉFORMÉ ~5 s après le regain — la passe qui AVANCE pèse (récup → tir : 5 % mesuré,
      // réel 15-20 ; le désordre s'attaque MAINTENANT). Sous-clé absente : 0, l'hier au bit.
      + (st.full && cfg.moments?.vertical && st._possChangeAt != null
        && st.t - st._possChangeAt < (cfg.moments.win ?? 5)
        && Math.sign(st.pitch.attackGoal(c.team).x || 1) * (m.p[0] - c.p[0]) > 8 ? cfg.moments.vertical : 0)
      + couloirB + ecarteB                                    // le couloir ouvert (lot 99) + la sortie d'axe (lot 105)
      + (gardienOk && m.keeper ? (cfg.sortieGardien?.bonus ?? 5.2)
        * Math.max(0, (0.5 - (st.full ? tac(st, c.team).style : 0.5)) * 2)
        * Math.min(1.2, c.skill?.composureF ?? 1) : 0);       // la sortie au gardien (136) : PENTE DE STYLE pure —
                                                              // 0 au défaut 0,5 (l'identité, le patron UT.calme du 49),
                                                              // pleine en possession — le Guardiola vit dans le preset
    // …le THROUGH remplace la mène et le style du candidat servi (le rendez-vous a son couloir jugé)
    // …ET LA TRANCHANTE PÈSE SES ÉLIMINÉS (140, cfg.tranchant — retour utilisateur : « pas
    // encore vu une passe en profondeur vraiment tranchante ») : chaque défenseur DÉPASSÉ par
    // le ballon vaut au barème (mesuré avant : 3 réceptions derrière la ligne / 20 min) —
    // × visionF du passeur (l'attribut passing en facteur) × axe style (le direct ose plus)
    let tranchB = 0;
    if (through && st.full && cfg.tranchant) {
      const gS = Math.sign(st.pitch.attackGoal(c.team).x || 1);
      let el = 0;
      for (const o of opp) if (o[0] * gS > origin[0] * gS + 0.5 && o[0] * gS < through.lead[0] * gS - 0.5) el++;
      tranchB = Math.min(4, el) * (cfg.tranchant.parDefenseur ?? 0.55) * (c.skill?.visionF ?? 1) * axe(_sty, 0.9, 1.1);
    }
    if (!best || score + tranchB > best.score) best = through
      ? { to: m, lead: through.lead, style: 'ground', score: score + (cfg.throughBall?.bonus ?? 0.6) + tranchB, lane: through.lane, dist: d, bascule, through: true, arrival: through.arr }
      : { to: m, lead, style, score, lane, dist: d, bascule };
  }
  return best;
}

/**
 * The best place for an off-ball team-mate to offer himself, sampled and scored around `anchor`
 * (the carrier, or the BALL while a pass is in flight — there is no carrier during those seconds
 * and everyone still has to keep moving).
 */
function supportSpot(st, me, cfg, anchor, carrierId, { sector = 0, claimed = [], ring = null, bias = cfg.stationBias } = {}) {
  const opp = foes(st, me.team).map((p) => p.p);
  // .map(p => p.p): these must be POSITIONS. Holding player objects here made every distance NaN,
  // and since `NaN > NaN` is false the "best" candidate never updated — every supporter silently
  // kept the FIRST candidate in the list, i.e. the same point. That is how a whole team collapses
  // onto one spot with no error anywhere. Guard the score below so it can never happen quietly.
  const others = mates(st, me.team).filter((p) => p.id !== me.id && p.id !== carrierId).map((p) => p.p);
  const [ax, az] = st.area;
  // WHERE THE RING IS CENTRED. Sampling it on the ball looks right and measures wrong: when the ball
  // drifts off centre, the edge guard below rejects the whole far half of the ring, so every supporter
  // is forced onto the near side and the team folds onto the ball. Pulling the centre back toward the
  // middle of the grid keeps the ring INSIDE the box at any ball position, which is what lets five men
  // actually stand around it. (Occupancy of the box: 21% of the area with the ring on the ball.)
  // …ET IL EST ANCRÉ SUR L'EMA DU BALLON (`ring`, assignJobs), pas sur le ballon de l'image : ancré
  // brut, chaque touche re-tournait le ring entier et la station sautait > 1,5 m ~2,5 fois par
  // seconde — les soutiens couraient en permanence à p50 3,0-3,5 m/s vers des points en fuite
  // (sonde tempo-espaces). En phase loose, `bias` = 1 : les secteurs s'ancrent au CENTRE du carré,
  // pour que le ring ne s'effondre pas du côté du scramble (deux soutiens mesurés à 0,50 m).
  const rc = ring ?? anchor;
  const cx = rc[0] * (1 - bias), cz = rc[2] * (1 - bias);
  const scoreAt = (p, a) => {
    if (Math.abs(p[0]) > ax / 2 - 1.2 || Math.abs(p[2]) > az / 2 - 1.2) return -Infinity;   // stay in the grid
    const nearMate = Math.min(...others.map((o) => d2(o, p)), 99);
    const nearClaim = Math.min(...claimed.map((c) => d2(c, p)), 99);
    // PÉNALITÉ DURE, PAS UN TERME : deux coéquipiers à 0,5 m n'offrent qu'une seule ligne à eux
    // deux, et le terme doux (×0,7) était DOMINÉ par le terme de secteur (×7,5) — mesuré : soutiens
    // id5/id7 à 0,50 m l'un de l'autre, moitié du carré vide (seed 3, t=48,65 s). Un candidat qui
    // marche sur un coéquipier n'est pas un mauvais candidat, c'est un non-candidat.
    if (nearMate < cfg.mateGap || nearClaim < cfg.mateGap) return -Infinity;
    const lane = laneClearance(anchor, p, opp, { corridor: cfg.corridor });
    const nearFoe = Math.min(...opp.map((o) => d2(o, p)), 99);
    const s =
      Math.min(lane.margin, 4) * 2.2                        // show for a clean lane
      + Math.min(nearFoe, 8) * 0.95                         // get away from your marker
      + Math.min(nearMate, 10) * 0.7                        // spread: don't stand on a team-mate
      + Math.cos(a - sector) * 7.5                          // hold YOUR angle of the rondo — this IS the shape,
      //                                                      and it must outweigh the convenience of standing still
      + Math.min(nearClaim, 7) * 1.5                        // and never the spot a mate just claimed
      - d2(me.p, p) * 0.22;                                 // mild: prefer the nearer of two equally good spots
    if (!Number.isFinite(s) && s !== -Infinity) throw new Error('supportSpot: score non fini (positions corrompues)');
    return s;
  };
  let best = null;
  for (let ring = 0; ring < 3; ring++) {
    const r = cfg.supportMin + (cfg.supportMax - cfg.supportMin) * (ring / 2);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const p = [cx + Math.cos(a) * r, 0, cz + Math.sin(a) * r];
      const score = scoreAt(p, a);
      if (score === -Infinity) continue;
      if (!best || score > best.score) best = { p, score };
    }
  }

  // COMMIT TO THE STATION — hold the spot you claimed unless another is better by `commitMargin`
  // AND you have held this one at least `spotTenure`. Worth keeping the old negative result: with
  // the ring re-centred on the raw ball every frame, every non-zero margin measured WORSE — the
  // anthill was the ring moving, not the decision flapping. With the ring now EMA-anchored, the
  // hysteresis bites on the right cause: station jumps > 1.5 m measured at ~2.5/s per supporter
  // before, and the tenure is what turns "in transit forever" into "hold your angle, adjust by
  // steps". The re-score is still what stops you holding a place gone bad (−Infinity evicts).
  if (me.spotTeam !== st.possession.team) me.spot = null;      // stations do not survive a turnover
  me.spotTeam = st.possession.team;
  if (me.spot) {
    const held = me.spot;
    const a = Math.atan2(held[2] - cz, held[0] - cx);
    const heldScore = scoreAt(held, a);
    const tenure = st.t - (me.spotT ?? -99);
    if (heldScore !== -Infinity && (tenure < cfg.spotTenure || !best || best.score < heldScore + cfg.commitMargin)) return held;
  }
  me.spot = best ? best.p : [...me.p];
  me.spotT = st.t;
  return me.spot;
}

/**
 * WHERE TO TAKE THE BALL. The carrier used to run in a straight line directly away from the single
 * nearest defender, 3.5 m, clamped to the box. Measured, that produced a carrier turning 4.3°/s — a
 * straight line — with a defender inside 1.5 m of him HALF THE TIME, which is what an anthill feels
 * like from the outside even when the defender COUNT is fine (mean 1.28 inside the swarm radius).
 *
 * Escaping one man is not dribbling. This scores candidate directions the way supportSpot scores
 * candidate positions — the same pattern, for the same reason: the good answer is a compromise between
 * things that pull in different directions, and a compromise is what a score is for.
 *   + get away from EVERY defender, not the nearest one (their minimum, so a second man closing hurts)
 *   + stay off the box edge — being pinned against the chalk is how possession is actually lost
 *   + do not run into your own supports, they are the passing options
 *   + keep going the way you were going, a little: without it the pick flips frame to frame and reads
 *     as jitter rather than as a move. This term is the whole difference between evasion and a shuffle.
 *
 * Heading convention is THIS module's: `p.yaw = atan2(v[1], v[0])`, so forward is [cos, sin] — 90° off
 * the project-wide atan2(x, z) used by world-basis.js and the CharacterController.
 */
export function evadeSpot(st, c, cfg = RONDO) {
  const enemies = st.players.filter((p) => p.team !== c.team);
  const mates = st.players.filter((p) => p.team === c.team && p.id !== c.id);
  const hx = st.area[0] / 2, hz = st.area[1] / 2;
  // `evadeKeep` means MOMENTUM — "you are already running that way, it costs you to change" — so it
  // must read the velocity, not the facing. It used to read `c.yaw`, which was the same thing back when
  // facing was derived from the drift. It is not any more: the carrier now faces his ball, which is the
  // direction he is PUSHING it. Left on yaw, the term closed a loop — push sets the facing, the facing
  // rewards the same push — and the carrier became literally unbeatable: 63 passes and 0 turnovers on
  // seed 6, versus 19 and 15 with the loop broken. A feedback loop reads as brilliance right up until
  // you notice the defence has stopped existing.
  const sp = Math.hypot(c.v[0], c.v[1]);
  const hdx = sp > 0.4 ? c.v[0] / sp : Math.cos(c.yaw), hdz = sp > 0.4 ? c.v[1] / sp : Math.sin(c.yaw);
  // SAMPLED AROUND THE BALL, NOT AROUND THE PLAYER. Sampling around the player sends him to a point
  // the ball is not on the way to, so he walks off and leaves it behind: measured, 65 % of passes were
  // struck with the ball BEHIND the striker (bearing up to 180°) and 15 % of carry frames had an
  // opponent closer to the ball than the man supposedly carrying it. Aiming past the ball is what
  // keeps the ball between him and where he is going — which is the definition of carrying it.
  const org = cfg.evadeAroundBall ? [st.ball.p[0], 0, st.ball.p[2]] : [c.p[0], 0, c.p[2]];
  // LA CONDUITE A UN SENS (lot 47, cfg.evadeGoal — match seulement ; clé absente : le rondo
  // sans but, au bit près). Le porteur de champ PROGRESSE vers le but adverse — et l'AILIER
  // en moitié offensive PERCE VERS LA LIGNE DE FOND (cfg.wingDrive : l'approche pilotée du
  // centre — mesuré avant : 105 portages d'aile, 4 atteignaient la zone de centre, avance
  // max p50 12,4 m — l'évasion pure recyclait vers la médiane ; le terme foe arbitre
  // naturellement les directions bouchées). evadeGoal:0 : l'errance d'hier (sabotage nommé).
  let gxu = 0, gzu = 0;
  if (cfg.evadeGoal && st.full && st.pitch && !c.keeper) {
    const goal = st.pitch.attackGoal(c.team);
    const sgnG = Math.sign(goal.x || 1);
    let tx = goal.x, tz = 0;
    if (cfg.wingDrive !== false && Math.abs(c.p[2]) > st.pitch.hz * 0.30 && c.p[0] * sgnG > 0) {
      tx = sgnG * (st.pitch.hx - 6);
      tz = Math.sign(c.p[2]) * Math.min(Math.abs(c.p[2]), st.pitch.hz * 0.42);
    }
    const gl = Math.hypot(tx - c.p[0], tz - c.p[2]) || 1;
    gxu = (tx - c.p[0]) / gl; gzu = (tz - c.p[2]) / gl;
    // …ET LE MUET N'A PLUS DE SENS UNIQUE (lot 92, même clé menace.muteD — la dévaluation
    // d'arbitre ne suffisait pas : sans AUCUNE option (passe 0,08 plancher), la conduite
    // misérable gagnait encore et le porteur FONÇAIT 18 m dans le bloc, parfois jusqu'aux
    // pieds du gardien). Passé le rayon muet × COMPOSURE (le posé temporise tôt, l'impulsif
    // fonce plus longtemps — l'attribut en facteur), la PROGRESSION s'éteint (×0,15) :
    // l'évasion redevient protection/écart, le corps attend le soutien.
    const mR = (cfg.menace?.muteD ?? 0) * (c.skill?.composureF ?? 1);
    const mD = mR && c._takeP ? Math.hypot(c.p[0] - c._takeP[0], c.p[2] - c._takeP[1]) : 0;
    if (mR && mD > mR) { gxu *= 0.15; gzu *= 0.15; }
  }
  let best = null;
  for (let i = 0; i < cfg.evadeSamples; i++) {
    const a = (i / cfg.evadeSamples) * Math.PI * 2;
    const dx = Math.cos(a), dz = Math.sin(a);
    const x = org[0] + dx * cfg.evadeStep, z = org[2] + dz * cfg.evadeStep;
    if (Math.abs(x) > hx - 1.0 || Math.abs(z) > hz - 1.0) continue;      // off the chalk: not an option
    //  (0,6 → 1,0 : la touche de conduite porte le ballon ~1 m au-delà du point visé — une cible à
    //  0,7 m de la ligne est déjà une sortie de but en préparation, 49 sorties sur 4 graines)
    let foe = Infinity;
    for (const f of enemies) foe = Math.min(foe, Math.hypot(f.p[0] - x, f.p[2] - z));
    let mate = Infinity;
    for (const m of mates) mate = Math.min(mate, Math.hypot(m.p[0] - x, m.p[2] - z));
    const edge = Math.min(hx - Math.abs(x), hz - Math.abs(z));
    const score = foe * cfg.evadeFoe + Math.min(mate, 4) * cfg.evadeMate
      + edge * cfg.evadeEdge + (dx * hdx + dz * hdz) * cfg.evadeKeep
      + (dx * gxu + dz * gzu) * (cfg.evadeGoal ?? 0);
    if (!Number.isFinite(score)) throw new Error('evadeSpot: score non fini (positions corrompues)');
    if (!best || score > best.score) best = { score, p: [x, 0, z] };
  }
  return best ? best.p : null;
}

/** Assign every player a job and a target. This is the anti-beehive layer. */
export function assignJobs(st, cfg = RONDO) {
  const car = st.players[st.possession.carrier];
  const atkTeam = st.possession.team;
  // The predicted path costs ~100 ball integrations. Recomputing it every frame is the single
  // hottest thing in the game loop and buys nothing: a pass takes ~1 s and the prediction barely
  // moves between frames. Refresh it ~8×/s, and always when a new pass starts.
  let path = null;
  if (st.phase === 'flight') {
    if (!st._path || st._pathAt !== st.pass || st.t - st._pathT > 0.12) {
      // …et la prédiction couvre le VOL ENTIER en plein format (lot 52) : maxT figé à 2,2 s
      // tronquait le chemin d'un renversement (~2,5 s de vol) — le receveur visait un chemin
      // coupé avant la CHUTE et courait après le rebond. Le réduit garde 2,2 au bit près.
      const maxT = st.full ? Math.max(2.2, (st.pass?.flight ?? 0) + 0.6) : 2.2;
      st._path = predictPath(st.ball, { dt: 1 / 45, maxT });
      st._pathT = st.t; st._pathAt = st.pass;
    }
    path = st._path;
  } else { st._path = null; }
  // While the ball is travelling there is no carrier, so everything anchors on the ball. (Shifting
  // the whole defence onto the INCOMING RECEIVER instead was tried and measured worse: the press
  // arrives with the ball and possession collapses — 4 passes per sequence instead of 7.)
  // The press attacks THE BALL, not the man. Aiming it at the carrier's body was fine while he stood
  // on top of the ball; now that he shields it from behind, a presser aimed at his body walks into his
  // back — measured as the carrier being inside tackle range 56 % of the carry, worse than before he
  // shielded at all. What a defender actually goes for is the ball.
  const anchor = st.ball.p;
  const carrierId = car ? car.id : -1;

  // L'ANCRE DU RING EN EMA (τ = ringTau). Le ring de soutien échantillonné sur le ballon BRUT
  // re-tournait à chaque touche : la station sautait > 1,5 m ~2,5 fois/s et par soutien, la cible de
  // marche bougeait > 3 m/s sur 10-11 % des images (churn 18-19 m/s : des téléports de cible), et
  // les soutiens couraient en permanence à p50 3,0-3,5 m/s (sonde tempo-espaces). Le ring suit le
  // ballon en ~0,5 s — la DÉFENSE, elle, attaque toujours le ballon réel (`anchor`).
  {
    const dtR = Math.max(0, st.t - (st._ringT ?? st.t));
    st._ringT = st.t;
    if (!st._ring) st._ring = [st.ball.p[0], st.ball.p[2]];
    const aR = 1 - Math.exp(-dtR / Math.max(1e-3, cfg.ringTau ?? 0.5));
    st._ring[0] += (st.ball.p[0] - st._ring[0]) * aR;
    st._ring[1] += (st.ball.p[2] - st._ring[1]) * aR;
  }
  // …et en phase LOOSE, les secteurs s'ancrent au CENTRE du carré (bias 1) : ancrés sur le ballon
  // d'un scramble, le ring s'effondrait du côté de la mêlée (deux soutiens à 0,50 m, moitié du
  // carré vide — seed 3, t=48,65 s, sonde tempo-espaces).
  const ringAnchor = st.phase === 'loose' ? [0, 0, 0] : [st._ring[0], 0, st._ring[1]];
  const ringBias = st.phase === 'loose' ? 1 : cfg.stationBias;

  // supporters are assigned ONE AT A TIME, each holding its own angle of the rondo and avoiding the
  // spots its team-mates just claimed. Scoring them all independently in the same frame makes every
  // player pick the same "best" spot and the whole team collapses onto one point (measured: 0.6 m
  // of spread), which in turn drags all five defenders onto the ball.
  const supporters = mates(st, atkTeam).filter((p) => p.id !== carrierId);
  const claimed = [];
  // Sectors are handed out BY CURRENT ANGLE, not by shirt number. Assigning slot i to player i
  // makes players criss-cross the middle to reach a slot on the far side — and the middle is where
  // the ball is, so the whole team keeps funnelling past it. Sorting by angle and rotating the
  // whole ring to the best fit means nobody ever has to cross.
  const ring = supporters
    .map((p) => ({ p, a: Math.atan2(p.p[2] - ringAnchor[2], p.p[0] - ringAnchor[0]) }))
    .sort((x, y) => x.a - y.a);
  let sx = 0, sz = 0;
  ring.forEach((e, i) => { const b = (i / Math.max(1, ring.length)) * Math.PI * 2; sx += Math.cos(e.a - b); sz += Math.sin(e.a - b); });
  const offset = Math.atan2(sz, sx);                         // rotate the ring onto the team as it stands
  const sectorOf = new Map(ring.map((e, i) => [e.p.id, (i / Math.max(1, ring.length)) * Math.PI * 2 + offset]));

  for (const p of st.players) {
    if (p.team === atkTeam) {
      if (car && p.id === car.id) {
        // A SWING PLANTS THE FEET TOO. Locking only the facing was half a lock and measurably worse:
        // `assignJobs` kept re-targeting him to stand behind a ball whose push direction was still
        // rotating, so he physically walked around his own ball while his shoulders stayed committed —
        // and the ball finished at his side or behind him, which is how a rondo ends up being played
        // with 18 backheels out of 38 passes. If the body is committed, so is where it is going.
        if (p.act) { p.job = 'carry'; p.target = [p.p[0], 0, p.p[2]]; continue; }
        // the carrier does not stand still: he drifts off the presser's shoulder into space,
        // which is what buys the extra half-second the pass needs
        p.job = 'carry';
        const near = foes(st, atkTeam).reduce((b, o) => (d2(o.p, car.p) < d2(b.p, car.p) ? o : b), foes(st, atkTeam)[0]);
        // THE CARRIER STANDS BEHIND HIS BALL. evadeSpot answers "which way should this ball go"; the
        // player's own target is then that direction taken BACKWARDS from the ball, so the ball stays
        // between him and where he is going. Sending him to the escape point itself makes him run PAST
        // the ball (measured: an opponent closer to it than him 45 % of carry frames, and 45 % of passes
        // still struck backwards). Standing off it by a boot's length is what dribbling actually is.
        const goal = near && d2(near.p, car.p) < cfg.pressRadius ? evadeSpot(st, car, cfg) : null;
        if (goal && cfg.carryStandoff > 0) {
          const gx = goal[0] - st.ball.p[0], gz = goal[2] - st.ball.p[2];
          const gl = Math.hypot(gx, gz) || 1;
          // …décalé CÔTÉ PIED FRAPPEUR : la stance d'une passe met le corps sur le côté du ballon, pas
          // pile derrière. Se tenir derrière-décalé pendant la conduite, c'est arriver à l'engagement
          // déjà à un demi-pas de l'ancre — mesuré, la porte d'atteignabilité refusait sinon assez
          // d'engagements pour doubler les pertes (record 4,5 / pertes 64 contre 8,4 / 28).
          const lat = (p.foot === 'left' ? 1 : -1) * cfg.carrySideBias;
          const px = -(gx / gl), pz = -(gz / gl);
          const lx = -pz * lat, lz = px * lat;               // perpendiculaire, côté frappeur
          p.target = [st.ball.p[0] + (px + lx) * cfg.carryStandoff, 0, st.ball.p[2] + (pz + lz) * cfg.carryStandoff];
          p.push = [gx / gl, gz / gl];                       // the direction the ball should be pushed
        } else { p.target = goal; p.push = null; }
        // L'INTENTION DE PASSE PILOTE L'APPROCHE. Quand l'engagement a été refusé (ancre hors
        // d'atteinte, ou fenêtre pas encore ouverte), beginPass a déposé OÙ le geste veut le corps —
        // derrière le ballon côté PASSE, pas côté fuite. Tant que cette intention est fraîche, c'est
        // elle la destination : le standoff d'évasion la contredit (p50 = 1,07 m d'écart angulaire
        // autour du ballon, un pas jamais fait — 122 pertes par tacle en 4 parties). Un joueur qui a
        // choisi sa passe marche sur sa position de frappe ; l'évasion reprend si l'intention expire.
        if (p.anchorHint && st.t - p.anchorHint.t < 0.4) {
          let tx = p.anchorHint.p[0], tz = p.anchorHint.p[1];
          // …ET ON MARCHE À TRAVERS LE POINT, PAS JUSQU'À LUI. L'amorti d'arrivée de movePlayers
          // (s = d·2,6) fait ramper les derniers décimètres — mesuré : borner le glissement à
          // 0,5 m a fait payer chaque passe ~0,25 s de rampe (taux de perte 0,58 → 0,75). Un
          // joueur qui va planter son appui traverse le point à vitesse de pas : la cible de
          // MARCHE dépasse l'ancre de 0,35 m dans la direction du chemin, et c'est l'engagement
          // (reachable ≤ 0,5) puis le glissement qui règlent l'arrêt — pas l'amorti générique.
          // …mais SEULEMENT TANT QU'ON EST LOIN (> 0,5 m) : en deçà, l'engagement (reachable ≤ 0,6)
          // a déjà la main et viser au-delà de l'ancre ne fait que la TRAVERSER — mesuré : le
          // receveur en livraison finissait 0,35 m PASSÉ son point d'assise (control-at-foot
          // 2,9 % → 5,9 %) et le segment rasait le ballon (not-inside-a-body 4,9 %).
          {
            const ax = tx - p.p[0], az = tz - p.p[2], al = Math.hypot(ax, az);
            if (al > 0.5) { tx += (ax / al) * 0.35; tz += (az / al) * 0.35; }
          }
          // …EN CONTOURNANT SON BALLON : l'ancre est souvent de l'autre côté de lui, et la droite
          // du pas le traverse (not-inside-a-body l'a compté). Si le segment corps→ancre passe dans
          // le cercle du ballon, on vise un point de PASSAGE décalé perpendiculairement — le détour
          // d'un pas que fait n'importe quel joueur autour d'un ballon posé.
          const bx = st.ball.p[0], bz = st.ball.p[2];
          const dxs = tx - p.p[0], dzs = tz - p.p[2], L2 = dxs * dxs + dzs * dzs || 1;
          const u = Math.max(0, Math.min(1, ((bx - p.p[0]) * dxs + (bz - p.p[2]) * dzs) / L2));
          const cx = p.p[0] + dxs * u - bx, cz = p.p[2] + dzs * u - bz;
          const cd = Math.hypot(cx, cz), AVOID = 0.34;
          if (u > 0 && u < 1 && cd < AVOID) {
            const nx = cd > 1e-6 ? cx / cd : -dzs / Math.sqrt(L2), nz = cd > 1e-6 ? cz / cd : dxs / Math.sqrt(L2);
            tx = bx + nx * AVOID; tz = bz + nz * AVOID;
          }
          p.target = [tx, 0, tz];
        }
        continue;
      }
      // the intended receiver runs onto the ball; everyone else offers an angle
      if (path && st.pass && st.pass.to === p.id) {
        p.job = 'receive';
        // …et un vol HAUT se reçoit À LA CHUTE (lot 52, match — mesuré : le receveur visait le
        // premier point atteignable EN TEMPS, ballon à 2 m au-dessus de sa tête ; il regardait
        // le vol le survoler, la chute vivait 5-10 m plus loin — receveur à 4,3 m p50 de la
        // chute, 68 % des longs en chasse au rebond). En plein format on ne vise que les
        // points JOUABLES (≤ 1,2 m) ; le réduit garde sa fenêtre d'hier au bit près.
        const i = interceptPoint(path, p.p, cfg.speeds.chase, { reaction: 0, maxHeight: st.full ? 1.2 : 2.2 });
        p.target = i ? [i.p[0], 0, i.p[2]] : [st.pass.lead[0], 0, st.pass.lead[2]];
      } else if (st.phase === 'loose' && p === supporters.reduce((b, q) => (!b || d2(q.p, anchor) < d2(b.p, anchor) ? q : b), null)) {
        // UN BALLON LIBRE SE DISPUTE. L'équipe « en possession » d'un ballon perdu envoyait ses cinq
        // hommes tenir le ring pendant que la défense ramassait gratuitement — et pire : quand
        // PERSONNE n'allait au ballon, la partie gelait (mesuré, graine 11 : ballon posé à v=0
        // pendant 115 s, le presseur arrêté à 0,88 m — voir le deadlock ci-dessous). Le plus proche
        // court au ballon : c'est le 50/50 du vrai football.
        p.job = 'receive';
        p.target = [anchor[0], 0, anchor[2]];
      } else {
        p.job = 'support';
        const sector = sectorOf.get(p.id) ?? 0;
        p.target = supportSpot(st, p, cfg, anchor, carrierId, { sector, claimed, ring: ringAnchor, bias: ringBias });
        claimed.push(p.target);
      }
    } else {
      p.job = 'mark'; p.target = null;
    }
  }

  // --- defending team: one presser, one cover, the rest mark the best options
  const def = foes(st, atkTeam);
  if (path) {
    // ball in flight: anyone who can legally get there goes for it — that is the interception
    let bestI = null;
    for (const p of def) {
      const i = interceptPoint(path, p.p, cfg.speeds.chase);
      if (i && (!bestI || i.slack > bestI.i.slack)) bestI = { p, i };
    }
    if (bestI) { bestI.p.job = 'intercept'; bestI.p.target = [bestI.i.p[0], 0, bestI.i.p[2]]; }
  }
  {
    const rest = def.filter((p) => p.job !== 'intercept').sort((a, b) => d2(a.p, anchor) - d2(b.p, anchor));
    // (Résultat négatif consigné : un rôle de presseur COLLANT — gardé tant qu'un autre défenseur
    // n'est pas 0,8 m plus près — visait à supprimer l'ex-presseur en transit, deuxième silhouette
    // de l'essaim mesuré. Effet réel : essaim quasi inchangé (58 → 49-61 %) et pression continue
    // qui étouffe l'attaque, record moyen 8,4 → 6,8 sur 8 graines. L'élection reste au plus près.)
    const pr = rest[0] ?? null;
    st._pressId = pr ? pr.id : -1;
    if (pr) {
      pr.job = 'press';
      // close the ball down, arriving on the touch-line side to cut the field in half
      // …SAUF SUR BALLON LIBRE : le poste « côté ligne » (0,7 m latéral) + l'amorti d'arrivée
      // (0,18 m) posaient le presseur à 0,88 m d'un ballon mort — 3 cm AU-DELÀ du receiveRadius
      // (0,85), et la partie gelait pour toujours (mesuré, graine 11 : 115 s sans une passe,
      // personne d'autre ne venant depuis que le ring de soutien s'ancre au centre en phase loose).
      // Un ballon libre n'a pas de côté : on va LE CHERCHER.
      pr.target = st.phase === 'loose' ? [anchor[0], 0, anchor[2]]
        : [anchor[0] + (anchor[0] > 0 ? 0.7 : -0.7), 0, anchor[2]];
    }
    // cover: stand in the single most dangerous lane
    const options = mates(st, atkTeam).filter((m) => m.id !== carrierId)
      .map((m) => ({ m, margin: laneClearance(anchor, m.p, def.map((d) => d.p), { corridor: cfg.corridor }).margin }))
      .sort((a, b) => b.margin - a.margin);
    let markers = rest.filter((q) => q !== pr);
    if (markers.length && options[0]) {
      const m = options[0].m;
      // LE COVER COUPE LA LIGNE, IL NE DOUBLE PAS LE PRESSEUR. À 0,42 × la ligne il vivait à
      // 1,5-3 m du ballon : un deuxième presseur — les 2 défenseurs les plus proches tous deux
      // < 2,5 m du ballon 49-57 % du temps installé, séparation p25 = 15-23° (sonde tempo-espaces).
      // Il se poste aux 2/3 de la ligne (coverFrac), jamais à moins de coverMinDist du ballon, ET
      // sous un angle minimal vu du ballon (coverMinAngle) : plus petit, il pivote latéralement
      // autour du ballon — il coupe toujours la passe, mais depuis un cône DISTINCT du presseur.
      let vx = (m.p[0] - anchor[0]) * cfg.coverFrac, vz = (m.p[2] - anchor[2]) * cfg.coverFrac;
      {
        const vl = Math.hypot(vx, vz);
        if (vl > 1e-6 && vl < cfg.coverMinDist) { vx *= cfg.coverMinDist / vl; vz *= cfg.coverMinDist / vl; }
      }
      if (pr) {
        const px = pr.p[0] - anchor[0], pz = pr.p[2] - anchor[2];
        if (Math.hypot(px, pz) > 0.3) {                        // presseur SUR le ballon : angle indéfini
          let dAng = Math.atan2(vz, vx) - Math.atan2(pz, px);
          while (dAng > Math.PI) dAng -= 2 * Math.PI;
          while (dAng < -Math.PI) dAng += 2 * Math.PI;
          const minA = (cfg.coverMinAngle * Math.PI) / 180;
          if (Math.abs(dAng) < minA) {
            const rot = (dAng >= 0 ? 1 : -1) * (minA - Math.abs(dAng));
            const cs = Math.cos(rot), sn = Math.sin(rot);
            const nx = vx * cs - vz * sn, nz = vx * sn + vz * cs;
            vx = nx; vz = nz;
          }
        }
      }
      const cp = [
        clamp(anchor[0] + vx, -st.area[0] / 2, st.area[0] / 2), 0,
        clamp(anchor[2] + vz, -st.area[1] / 2, st.area[1] / 2),
      ];
      // (Résultat négatif consigné : élire comme cover « l'homme le plus proche du POSTE » plutôt
      // que le 2ᵉ plus près du ballon devait vider la zone du ballon — mesuré : essaim inchangé
      // (le 2ᵉ corps collé est un marqueur/ex-presseur en transit, pas le cover), et les lignes
      // les plus dangereuses héritaient des marqueurs les plus proches — record moyen 8,4 → 5,6,
      // frappes 43,9 → 39,1, un porteur collé 62 % sur la graine 4. Le cover reste le 2ᵉ au ballon,
      // qui SORT vers son poste par le plancher radial.)
      const cov = markers[0] ?? null;
      if (cov) {
        cov.job = 'cover';
        cov.target = cp;
        markers = markers.filter((q) => q.id !== cov.id);
      }
    }
    // markers: goal-side of their man, shading the lane
    markers.forEach((d, i) => {
      const m = options[i + 1]?.m || options[options.length - 1]?.m;
      if (!m) { d.target = [...d.p]; return; }
      d.job = 'mark';
      const mx = anchor[0] - m.p[0], mz = anchor[2] - m.p[2];
      const ml = Math.hypot(mx, mz) || 1;
      const step = Math.min(2.2, ml * 0.3);                     // a step goal-side of your man…
      let tx = m.p[0] + (mx / ml) * step, tz = m.p[2] + (mz / ml) * step;      // …not a walk to the ball
      // …et jamais un POSTE dans la zone du presseur : quand le porteur conduit VERS l'homme
      // marqué, le pas côté ballon plaçait le marqueur sous 2,5 m — la deuxième silhouette de
      // l'essaim mesuré. Le poste du marqueur garde un rayon de courtoisie autour du ballon.
      {
        const rx = tx - anchor[0], rz = tz - anchor[2];
        const rl = Math.hypot(rx, rz);
        if (rl > 1e-6 && rl < 2.8) { tx = anchor[0] + (rx / rl) * 2.8; tz = anchor[2] + (rz / rl) * 2.8; }
      }
      d.target = [tx, 0, tz];
    });
  }
  return st;
}

/** Hand the ball to `team` at `carrier` — the turnover, and the moment the score resets. */
function turnover(st, carrier, why, cfg = null) {
  st.turnovers++;
  st.best = Math.max(st.best, st.passes);
  const w = st.players[carrier];
  const sp0 = Math.hypot(st.ball.v[0], st.ball.v[2]);
  const dW = w ? d2(w.p, st.ball.p) : 99;
  // l'événement porte SA géométrie (loi 8) : distance gagnant→ballon au flip, vitesse avant/après —
  // c'est ce que les clauses « vol sans geste » et « télékinésie » de checkRondo lisent.
  const ev = { t: +st.t.toFixed(2), type: 'turnover', why, to: st.players[carrier].team, by: carrier, after: st.passes, d: +dW.toFixed(2), v0: +sp0.toFixed(2), v1: +sp0.toFixed(2) };
  st.events.push(ev);
  st.passes = 0;
  st.possession = { team: st.players[carrier].team, carrier };
  st.phase = 'carry'; st.pass = null; st.hold = 0; st.pressure = 0; st.lastPasser = -1;
  // LE BALLON N'EST PAS « REMIS À ZÉRO » — NI GELÉ À DISTANCE. Deux accidents fondateurs ici :
  // (1) cette ligne appelait rest(), qui plaquait au sol un ballon encore en l'air — refusé par
  // l'invariant de ball-body dès le premier essai (interception à 0,80 m de haut) ; (2) elle
  // appliquait ensuite impulse(−v) : 100 % de la vitesse horizontale tuée en une image, mesuré
  // 130-172 fois par 6 min, p50 = 4,19 m/s → 0,00 exactement, y compris quand le « gagnant » était
  // à 2,33 m du ballon (sonde duels-tacles / ballon-vol : 39 arrêts télékinésiques). La règle est
  // celle de BallBody étendue à la VITESSE : une impulsion d'arrêt n'est légale que si son auteur
  // est À PORTÉE DE JEU du ballon — sa première touche l'amortit (résiduel ~20 %, comme les
  // contrôles attaquants qui gardent 5-18 %) et se NOMME au registre (événement 'control').
  // Hors portée : le ballon VIT, il continue sa course et le gagnant va le chercher.
  // …ET LE CÔNE AVANT VAUT POUR LA PRISE DE TURNOVER (lot 71 — le contrat « zéro contrôle sans
  // membre ») : dos au ballon, l'amorti n'existe pas — le ballon VIT (le chemin hors-portée
  // ci-dessous, déjà prouvé) et le gagnant se retourne pour aller le chercher. st.full : le
  // rondo d'hier au bit près.
  const coneOk = !st.full || cfg?.priseCone === false
    || (w && dansCone(w.yaw, w.p[0], w.p[2], st.ball.p[0], st.ball.p[2], cfg?.priseCone ?? 100));
  if (!coneOk && st.deny) st.deny['controle-dos'] = (st.deny['controle-dos'] ?? 0) + 1;
  if (w && w.down <= 0 && dW <= RONDO.receiveRadius && coneOk) {
    // LE PRIX DU PREMIER TOUCHER (lot 43, cfg.touchePrix — match) : un ballon RAPIDE ne se
    // possède pas d'un claquement de doigts. Mesuré avant (retour utilisateur « effet aimant
    // sur les longs ballons ») : 14 % des prises de turnover au-delà de 10 m/s, un dégagement
    // de 26,5 m/s possédé instantanément — le ballon ATTIRÉ au pied sans geste. Le MÊME
    // contrat que le contrôle attaquant (pMiss) : au-delà du seuil, la touche peut FUIR — le
    // résiduel reste vivant, le ballon est LIBRE, le récupérateur va le chercher. C'est
    // exactement ce qu'un long ballon coûte au vrai football. Clé absente (rondo) : pas un bit.
    const TP = st.full ? cfg?.touchePrix : null;   // le réduit vit le monde d'hier (doctrine st.full)
    if (TP) {
      const pMiss = Math.max(0, Math.min(TP.max ?? 0.55,
        (sp0 - (TP.seuil ?? 10)) * (TP.taux ?? 0.07) / Math.max(0.5, w.skill?.controlF ?? 1)));
      if (pMiss > 0 && (st.rnd ? st.rnd() : 0.5) < pMiss) {
        st.ball.impulse([-st.ball.v[0] * 0.62, -st.ball.v[1] * 0.8, -st.ball.v[2] * 0.62]);
        st.events.push({ t: +st.t.toFixed(2), type: 'control', by: carrier, speed: +sp0.toFixed(1), miss: true, settle: null });
        st.phase = 'loose'; st.possession = { team: st.players[carrier].team, carrier: -1 };
        // …et le fautif CHASSE sa touche (lot 44, réflexe lossReact — capture utilisateur :
        // le receveur restait PLANTÉ à côté de sa touche fuyante, l'adversaire prenait)
        if (cfg?.lossReact) (st._lossAt ??= {})[carrier] = st.t;
        ev.v1 = +Math.hypot(st.ball.v[0], st.ball.v[2]).toFixed(2);
        return;
      }
    }
    st.ball.impulse([-st.ball.v[0] * 0.8, -st.ball.v[1] * 0.6, -st.ball.v[2] * 0.8], [-st.ball.w[0] * 0.8, -st.ball.w[1], -st.ball.w[2] * 0.8]);
    st.ball.possess(carrier);
    if (sp0 > 0.5) {
      st._settling = { ev: st.events.length, id: carrier, at: st.t + 0.3 };
      st.events.push({ t: +st.t.toFixed(2), type: 'control', by: carrier, speed: +sp0.toFixed(1), settle: null });
    }
  }
  ev.v1 = +Math.hypot(st.ball.v[0], st.ball.v[2]).toFixed(2);
}

export { predictPath };
export const rondoInternals = { supportSpot, movePlayers, separatePlayers, turnover };
