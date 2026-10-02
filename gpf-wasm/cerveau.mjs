// cerveau.mjs — NOTRE CERVEAU AUX COMMANDES DE LEURS CORPS (lot L2 du cadrage du moteur de match).
//
// Le moteur de la skill (match-sim.js et ses modules) sait JOUER : tactique collective, rôles, élections du presseur et du
// couvreur, choix de la passe, arbitrage tir / centre / passe / conduite. Il n'a pas de mode « décision seule » : il décide
// sur SON monde, qu'il fait ensuite bouger. On lui prête donc le nôtre — celui de Gameplay Football — à chaque tick de
// décision (100 ms) : positions, vitesses, regards, ballon, possession. On le laisse décider, on lit ses décisions, et on les
// rend au corps sous forme d'intentions (`corps.mjs`). Ce qu'il fait ensuite bouger dans son monde est jeté au tick suivant,
// qui repart du monde de Gameplay Football.
//
// CE QUE LE CERVEAU DÉCIDE ICI : le placement de chacun (`assignMatchJobs` puis les couches de `movePlayers` : la cible et la
// vitesse voulue), le presseur (job « press »), et pour le porteur l'arbitrage (`arbitre`) puis la passe (`choosePass`).
// CE QUI RESTE AU CORPS, v1 : les gardiens, les coups de pied arrêtés et tout le jeu arrêté, les gestes de contact (contrôle,
// amorti, tacle), la célébration.
//
// LES REPÈRES. Gameplay Football : x le long (±55 m), y en travers (±36 m), z en haut ; l'équipe 0 attaque +x. Le moteur de
// la skill : x le long (±52,5 m), z en travers (±34 m), y en haut ; l'équipe 0 attaque +x. On passe de l'un à l'autre par une
// mise à l'échelle et z = −y (le repère reste direct, les regards gardent leur sens).
import { makeMatch, matchCfg, matchInternals } from '../skills/threejs-aaa/assets/starter/src/engine/match-sim.js';
import { movePlayers } from '../skills/threejs-aaa/assets/starter/src/engine/movement.js';
import { arbitre } from '../skills/threejs-aaa/assets/starter/src/engine/menace.js';
import { choosePass } from '../skills/threejs-aaa/assets/starter/src/engine/rondo.js';
import { finitionSigma } from '../skills/threejs-aaa/assets/starter/src/engine/strike-sim.js';
import { gauss } from '../skills/threejs-aaa/assets/starter/src/engine/attributes.js';
import { tirage as tirageCerveau } from '../skills/threejs-aaa/assets/starter/src/engine/rng.js';
import { BallBody } from '../skills/threejs-aaa/assets/starter/src/engine/ball-body.js';
import { uneTouche } from '../skills/threejs-aaa/assets/starter/src/engine/premiere-intention.js';
import { accrocheStep } from '../skills/threejs-aaa/assets/starter/src/engine/duel.js';
import { tac, axe } from '../skills/threejs-aaa/assets/starter/src/engine/tactics.js';
import { pressionDe } from '../skills/threejs-aaa/assets/starter/src/engine/reception.js';
import { pressPredicate } from '../skills/threejs-aaa/assets/starter/src/engine/skills-sim.js';
import { tackleWindow } from '../skills/threejs-aaa/assets/starter/src/engine/duel.js';
import { balPrenable } from '../skills/threejs-aaa/assets/starter/src/engine/dribble.js';
import { ecartCorps, talonPermis } from '../skills/threejs-aaa/assets/starter/src/engine/passe-faisable.js';
import { butDansCorps } from '../skills/threejs-aaa/assets/starter/src/engine/reprise-physique.js';
import { INTENTION, PASSE, EV, GESTE } from './contrat.mjs';

const GPF = { hx: 55, hy: 36 };

/**
 * Un cerveau pour un match : `tactiques` = les deux tactiques de la skill (noms de presets ou objets), `graine` = celle du
 * match. `decider(etat)` rend les intentions des joueurs que le cerveau pilote (tous sauf les gardiens).
 */
export function creerCerveau({ graine = 7, tactiques = null, equipes = [0, 1], options = {} } = {}) {
  /** Les réglages de l'adaptateur, chacun débrayable pour la mesure A/B : `flux` (les tirages nommés du cerveau),
   *  `uneTouche` (la première intention posée avant le contact), `talon` (la passe hors du corps : 'tourne' — se tourner
   *  d'abord —, 'autre' — une autre passe —, null — telle quelle), `pTalon` (la part des talonnades permises jouées),
   *  `seuilCorps` (l'écart au regard, en degrés, au-delà duquel la passe est hors du corps ; null : celui du cerveau, 100°),
   *  `reprise` (la reprise au but en première intention). */
  const OPT = { accroche: 1.7, flux: true, uneTouche: true, fautes: true, presseGarde: true, tacle: true, mord: true, jockeyCap: null, presse: null, rayonCharge: 3, finition: true, rayonSurface: 2.2, ombre: true, talon: 'tourne', pTalon: 0.02, seuilCorps: null, reprise: true, ...options };
  const st = makeMatch({ full: true, seed: graine, ...(tactiques ? { tactics: tactiques } : {}) });
  // la configuration du CERVEAU : son chrono, son arbitre et ses remplacements se taisent — le temps, les Lois et les
  // changements appartiennent au corps (Gameplay Football) ; un chrono vivant ferait changer de camp le cerveau seul.
  const cfg = matchCfg({ chrono: null, loi3: null });
  // LE BALLON JOUABLE EN UNE TOUCHE EST CELUI DU CORPS : le cerveau refuse la première intention au-delà de 9,5 m/s à
  // l'arrivée — réglé pour ses passes à lui, dosées pour arriver à ≈ 5 m/s. Celles du corps arrivent à 9,5-15 m/s dans
  // 75 % des réceptions, et leur propre IA y joue en une touche avec 67-86 % de réussite (3 graines × 15 min). Le seuil
  // devient celui du corps : 15 m/s (au-delà, trop peu de cas pour juger).
  cfg.uneTouche = { ...cfg.uneTouche, vmax: 15 };
  // (à l'essai) le plafond du jockey — 2,9 m/s dans le monde du cerveau ; les porteurs du corps conduisent à 3,3-3,8 m/s
  if (OPT.jockeyCap) cfg.jockey = { ...cfg.jockey, cap: OPT.jockeyCap };
  // L'ACCROCHAGE CALÉ SUR LE CORPS : le cerveau règle sa probabilité par épisode (le défenseur battu dans le dos d'un porteur
  // lancé) pour ≈ 17 accrochages par match dans SON monde (duel.js, lot 97). L'épisode dépend du pressing du corps : sous la
  // chasse permanente, 35,9 accrochages par match à sa probabilité (facteur 17/35,9) ; sous le pressing à la garde du cerveau
  // (l'ombre côté but, l'engagement à 3 m), il revient moins — le facteur × 1,7 rend ≈ 17 (8 matchs × 45 min : 17,2 par 90).
  const ACCROCHE_CORPS = (17 / 35.9) * (OPT.accroche ?? 1);
  cfg.accrocheMod = (s2, c, k) => accrocheStep(s2, c, k, axe(tac(s2, 1 - c.team).pressing, 0.7, 1.3) * ACCROCHE_CORPS);
  // …ET DANS SA SURFACE, LA RETENUE AUSSI : le cerveau y retient déjà la main (×0,15, puis retenueSurface.accro 0,4), mais
  // les attaques du corps finissent plus souvent en dribble dans la surface que dans son monde — 1 penalty par match mesuré
  // (8 matchs de 90 min), pour ≈ 0,27 au réel. La retenue de surface est calée sur ce taux.
  cfg.retenueSurface = { ...cfg.retenueSurface, accro: (cfg.retenueSurface?.accro ?? 0.4) * 0.27 };
  // LA RÉUSSITE DE LA PASSE CALÉE SUR LE CORPS (selection.js — le modèle du cerveau, calé dans son monde) : sur 3 430 passes du
  // cerveau (8 graines × 30 min), il prévoyait 81 % et en réussissait 72 %. L'écart vit SOUS PRESSION : 59 % des passes partent
  // avec la pression du porteur > 0,8 (le presseur arrive pendant l'armé de 0,4 s du corps, et leurs défenseurs bloquent de
  // près) — 65 % réussies pour 80 % prévus. Le terme « bloc » (pRel = 1 − bloc × pression, 0,06 dans son monde) et le calage
  // par classe sont réajustés ensemble sur les issues du corps (log-vraisemblance, bancs/autopsie-passes.mjs) : bloc 0,45.
  // Le choix en valeur attendue du cerveau (choix.js) lit cette réussite : la passe sous pression perd de sa valeur.
  cfg.selection = { ...cfg.selection, bloc: 0.45, calage: { ...cfg.selection.calage,
    BACK_SAFE: [1.731, 1.265], MID_GROUND: [1.333, 0.672], SHORT_GROUND: [1.679, 1.304], THROUGH: [0.209, 0.365],
    LONG_GROUND: [1.072, 0.348], CHANNEL: [1.138, 0.932] } };
  const SX = st.pitch.hx / GPF.hx, SZ = st.pitch.hz / GPF.hy;
  const versCerveau = (x, y) => [x * SX, -y * SZ];
  const versCorps = (x, z) => [x / SX, -z / SZ];
  /** id stable Gameplay Football → joueur du cerveau, et l'inverse. */
  let cerveauDe = null, corpsDe = null;
  /** LA POSSESSION EN COURS, côté cerveau : son début, la tenue tirée au calme, l'arbitrage mémorisé, l'intention adoptée. */
  let poss = null;
  /** CE QUE LE JOURNAL DU CORPS APPREND AU CERVEAU (`observer`) :
   *  · la dernière équipe à toucher le ballon ;
   *  · LE TENEUR — le dernier joueur à l'avoir touché, et depuis quand : la tenue du porteur (`st.hold`) se compte de là.
   *    La possession que déclare le corps clignote quand le ballon s'écarte d'un pas en conduite ; le journal, non ;
   *  · LA PASSE EN VOL — du contact (l'événement PASSE) à la touche d'un autre joueur. Le cerveau de la skill fait attaquer
   *    sa passe au receveur et y fait réagir la défense (`st.phase = 'flight'`, `st.pass`) ; sans elle, il voyait un ballon
   *    libre et renvoyait le receveur à son poste pendant le vol — mesuré : 221 intentions « aller » sur 224 vols. */
  let dernierToucheur = null, teneur = { id: null, t: 0 }, vol = null;
  /** La première intention décidée et pas encore jouée : { id (cerveau), i (l'intention : la passe ou la reprise au but), jusqua }. */
  let uneToucheTenue = null;
  /** Les décisions de première intention (pour les bancs) : tentées, jouées, et les refus du cerveau par motif (st.deny). */
  const stats = { utDecisions: 0, utJouees: 0, fautes: 0, tacles: 0, seTourne: 0, autreChoix: 0, talons: 0, angles: [0, 0, 0, 0], reprises: { tete: 0, volee: 0, sol: 0 }, reprisesJouees: 0 };
  /** LES ENGAGEMENTS EN COURS : le défenseur qui a décidé de tacler (id cerveau → fin du geste, s). */
  const engagements = new Map();
  /** La durée du geste de tacle debout du cerveau (animkit-data.js, tacleDebout : 0,7 s, contact à 0,28 s). */
  const DUREE_TACLE = 0.7;
  /** LE GARDIEN DU CORPS NE REÇOIT PAS LA PASSE EN RETRAIT : la règle lui interdit les mains, et le moteur ne lui a pas appris
   *  à la jouer du pied (leur propre IA ne lui passe presque jamais : 0,3 % de ses passes). Mesuré, sur 45 min × 3 graines :
   *  32 passes au gardien (4,1 %), 4 dans nos filets — la « courte » de 24 m part à 29 m/s, monte à 2 m, et passe au-dessus du
   *  gardien planté. La ligne vers les gardiens est donc fermée au cerveau (`st.laneVeto`, le veto de sa propre sélection). */
  let vetoGardiens = null;
  /** LA LATENCE DU CORPS : entre l'ordre de passer et la frappe, le corps de Gameplay Football met 0,4 s — son geste s'arme
   *  (médiane ; p25 0,3, p75 0,5 — `bancs/autopsie-passes.mjs`, 3 graines). Le cerveau de la skill juge le calme sur l'instant
   *  (`calmFoe`), réglé pour ses corps à lui ; ici on le juge À LA FRAPPE : où seront le ballon et l'adversaire quand le ballon
   *  partira. Sans cela, mesuré : le porteur décidait avec l'adversaire à 1,7 m qui fonçait à 5 m/s, et 57 % de nos passes
   *  partaient avec un adversaire à moins d'un mètre (leur IA : 18 %) — réussies à 63 %. */
  const LATENCE = 0.4;
  /** LA PREMIÈRE INTENTION SE DÉCIDE AVANT LE CONTACT : le corps doit avoir l'ordre de passer quand le ballon arrive (leur
   *  propre IA le pose jusqu'à 1 s avant). Le cerveau de la skill tranche à la réception (`receive` → `uneTouche`) ; ici il
   *  tranche UNE FOIS par passe, quand le ballon est à moins de la latence du corps + un tick du receveur — une seule fois,
   *  sinon ses tirages se répéteraient à chaque tick et gonfleraient ses chances. L'ordre tient jusqu'à la frappe. */
  const AVANCE_UNE_TOUCHE = LATENCE + 0.1;
  /** Un tirage seedé et sans état (la graine, le porteur, l'instant) — le cerveau ne consomme pas son propre hasard. */
  const tirage = (a, b) => { let h = (graine * 2654435761 ^ a * 40503 ^ Math.round(b * 1000) * 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

  /** L'APPARIEMENT, une fois, au coup d'envoi : les gardiens ensemble, puis chaque joueur de champ au poste du cerveau le
   *  plus proche (les deux moteurs posent un 4-3-3 dans leur moitié). */
  function apparier(etat) {
    cerveauDe = new Map(); corpsDe = new Map();
    for (const eq of [0, 1]) {
      const corps = etat.joueurs.filter(j => j.equipe === eq);
      const cerveau = st.players.filter(q => q.team === eq);
      const gkC = corps.find(j => j.role === 0) ?? corps[0];
      const gkB = cerveau.find(q => q.keeper);
      cerveauDe.set(gkC.id, gkB); corpsDe.set(gkB.id, gkC.id);
      const libres = cerveau.filter(q => !q.keeper);
      for (const j of corps.filter(j => j !== gkC)) {
        const [x, z] = versCerveau(j.x, j.y);
        let best = null, bd = Infinity;
        for (const q of libres) { const d = Math.hypot(q.p[0] - x, q.p[2] - z); if (d < bd) { bd = d; best = q; } }
        libres.splice(libres.indexOf(best), 1);
        cerveauDe.set(j.id, best); corpsDe.set(best.id, j.id);
      }
    }
    vetoGardiens = Object.fromEntries(st.players.filter(q => q.keeper).map(q => [q.id, Infinity]));
  }

  /** LA PASSE EN VOL, dans le repère du cerveau, au premier tick qui suit le contact : d'où elle part, où le corps la joue
   *  (AI_GetPass : le receveur, sa vitesse × la durée de passe du moteur, et pour la « longue » 20 % de la distance vers le
   *  but adverse), son style, sa durée. */
  function volDuCerveau(etat) {
    const P = etat.joueurs.find(j => j.id === vol.passeur), R = etat.joueurs.find(j => j.id === vol.cible);
    const qP = cerveauDe.get(vol.passeur), qR = cerveauDe.get(vol.cible);
    if (!P || !R || !qP || !qR || qP.team !== qR.team) return null;
    const dt = Math.max(0, etat.t / 1000 - vol.t);
    const ox = etat.ballon[0] - etat.ballonV[0] * dt, oy = etat.ballon[1] - etat.ballonV[1] * dt;
    const d = Math.hypot(R.x - ox, R.y - oy), T = Math.pow(Math.min(1, Math.max(0, 0.3 + d * 0.05)), 0.7) * 0.7;
    let ax = R.x + R.v[0] * T, ay = R.y + R.v[1] * T;
    if (vol.geste === GESTE.PASSE_LONGUE) ax += (P.equipe === 0 ? 1 : -1) * d * 0.2;
    const vh = Math.hypot(etat.ballonV[0], etat.ballonV[1]);
    const [lx, lz] = versCerveau(ax, ay), [x0, z0] = versCerveau(ox, oy);
    const L = Math.hypot(lx - x0, lz - z0);
    return { from: qP.id, to: qR.id, lead: [lx, 0, lz], style: vol.geste === GESTE.PASSE_HAUTE ? 'lofted' : L > 13 ? 'driven' : 'ground',
      t: vol.t, flight: (L / Math.max(4, vh * SX)) * 1.15, origin: [x0, z0], ...(vol.geste === GESTE.PASSE_LONGUE ? { through: true } : {}) };
  }

  /** LE MONDE DU CORPS, prêté au cerveau. */
  function preter(etat) {
    st.t = etat.t / 1000;
    for (const j of etat.joueurs) {
      const q = cerveauDe.get(j.id); if (!q) continue;
      const [x, z] = versCerveau(j.x, j.y);
      q.p = [x, 0, z];
      q.v = [j.v[0] * SX, -j.v[1] * SZ];
      q.speed = Math.hypot(q.v[0], q.v[1]);
      if (Math.hypot(j.dir[0], j.dir[1]) > 0.1) q.yaw = Math.atan2(-j.dir[1], j.dir[0]);
      // l'expulsé (par le corps ou par le cerveau) n'existe plus pour les cerveaux : le levier natif de la skill (down géant)
      if (!j.actif) {
        // …et il marche vers sa sortie, la ligne de touche la plus proche (le chemin de l'expulsé de la skill, Loi 12 — sans
        // sortie posée, son administration plantait sur un expulsé par le corps)
        q.expulse = true; q.down = 9e9;
        q._exit ??= [Math.max(-st.pitch.hx + 2, Math.min(st.pitch.hx - 2, x)), (z >= 0 ? 1 : -1) * (st.pitch.hz + 2.5)];
      } else q.down = 0;
    }
    const [bx, bz] = versCerveau(etat.ballon[0], etat.ballon[1]);
    st.ball = new BallBody([bx, Math.max(0.11, etat.ballon[2]), bz], [etat.ballonV[0] * SX, etat.ballonV[2], -etat.ballonV[1] * SZ], [0, 0, 0]);
    // la possession : le porteur que Gameplay Football déclare (son équipe, son rang dans l'équipe)
    const { equipe, joueur } = etat.possession;
    const porteurCorps = equipe >= 0 && joueur >= 0 ? etat.joueurs.filter(j => j.equipe === equipe)[joueur] : null;
    const porteur = porteurCorps ? cerveauDe.get(porteurCorps.id) : null;
    st.pass = null;
    if (porteur) {
      st.ball.possess(porteur.id);
      st.possession = { team: porteur.team, carrier: porteur.id };
      st.phase = 'carry';
      // la tenue se compte depuis sa première touche (le journal), pas depuis le dernier clignotement de la possession
      const depuis = teneur.id === porteurCorps.id ? teneur.t : st.t;
      st.hold = Math.max(0, st.t - depuis); porteur._controleAt = depuis;
      vol = null;
    } else if (vol && etat.enJeu && !etat.cpa && (vol.pass ??= volDuCerveau(etat))) {
      st.phase = 'flight'; st.pass = vol.pass;
      st.possession = { team: st.players[vol.pass.from].team, carrier: -1 };
      st.lastPasser = vol.pass.from; st.hold = 0;
    } else {
      st.possession = { team: dernierToucheur ?? st.lastTouch ?? 0, carrier: -1 };
      st.phase = 'loose'; st.hold = 0;
    }
    if (dernierToucheur === 0 || dernierToucheur === 1) st.lastTouch = dernierToucheur;
    st.restart = null; st._whistle = null;
    // LA FAUTE DU CERVEAU VIT SA FENÊTRE D'AVANTAGE (Loi 5) d'un tick à l'autre — sauf ballon mort : le corps a arrêté le jeu
    if (!etat.enJeu || etat.cpa) st._faute = null;
    st.laneVeto = vetoGardiens;
    // LES TIRAGES NOMMÉS DU CERVEAU (rng.tirage, lot 264) : son pas de simulation les arme à chaque image — le tick physique
    // (1/60 s), les compteurs remis à zéro. Sans eux, chaque tirage retombait sur un générateur séquentiel : le hasard d'une
    // décision dépendait de tous les tirages faits avant elle dans le tick.
    if (OPT.flux && cfg.flux) { const F = st._flux ??= { seed: (st.seed ?? 1) >>> 0, tick: 0, k: new Map() }; F.tick = Math.round(st.t * 60); F.k.clear(); }
    st._decide = true;
  }

  return {
    st,
    /** Le journal du corps (`corps.journal()`), à chaque lecture : touches, passes, arrêts de jeu. */
    observer(evenements) {
      for (const ev of evenements) {
        if (ev.type === EV.TOUCHE) {
          dernierToucheur = ev.equipe;
          if (ev.joueur !== teneur.id) teneur = { id: ev.joueur, t: ev.t / 1000 };
          if (uneToucheTenue && ev.joueur !== corpsDe.get(uneToucheTenue.id)) uneToucheTenue = null;   // un autre a joué le ballon
          else if (uneToucheTenue?.i.genre === INTENTION.TIRER && ev.b === GESTE.TIR) { stats.reprisesJouees++; uneToucheTenue = null; }
          if (vol && ev.joueur !== vol.passeur) vol = null;
        } else if (ev.type === EV.PASSE) {
          if (uneToucheTenue && corpsDe.get(uneToucheTenue.id) === ev.joueur) { stats.utJouees++; uneToucheTenue = null; }
          vol = { passeur: ev.joueur, cible: ev.b, geste: ev.a, t: ev.t / 1000, pass: null };
        }
        else if (ev.type === EV.BUT || ev.type === EV.FAUTE || ev.type === EV.HORS_JEU || ev.type === EV.CPA) vol = null;
      }
    },
    /**
     * Les intentions d'un tick. `etat` = corps.etat() ; le journal arrive par `observer`.
     * Rend [{ id, genre, x, y, vitesse, cible, puissance, drapeaux }] pour les joueurs des `equipes` pilotées.
     */
    decider(etat) {
      if (!cerveauDe) apparier(etat);
      preter(etat);
      // LA LOI 12 DU CERVEAU S'ADJUGE DANS SON ADMINISTRATION (assignMatchJobs → adjugeFaute) : l'avantage d'abord, puis le
      // sifflet. On lit sa décision autour de l'appel — et le sifflet part au corps (gf_faute : coup franc ou penalty,
      // carton), ou le carton seul quand l'avantage a été joué (gf_carton)
      const F0 = OPT.fautes ? st._faute : null, n0 = st.events.length;
      matchInternals.assignMatchJobs(st, cfg);
      decideTacle(etat);
      const fautes = [];
      if (F0 && !st._faute) {
        const cartons = st.events.slice(n0).filter(e => e.type === 'carton' && e.by === F0.par);
        const gravite = cartons.some(e => e.couleur === 'rouge') ? 3 : cartons.length ? 2 : 1;
        const fautif = corpsDe.get(F0.par), victime = corpsDe.get(F0.sur);
        // le lieu de la FAUTE (F0.p, là où le porteur a été retenu), pas celui de la victime au coup de sifflet : pendant
        // l'avantage elle a pu entrer dans la surface — mesuré, 7 penalties en 8 matchs pour ≈ 2 au réel
        const [lx, ly] = versCorps(F0.p[0], F0.p[1]);
        if (st.restart && (st.restart.type === 'coup-franc' || st.restart.type === 'penalty')) fautes.push({ fautif, victime, gravite, x: lx, y: ly });
        else if (gravite > 1) fautes.push({ carton: fautif, couleur: gravite });
        stats.fautes++;
      }
      // les couches de placement qui vivent dans le mouvement (zone-homme, occupation, compression, cible lissée…) :
      // on les laisse écrire la cible et la vitesse voulue ; le pas qu'elles font faire au monde prêté est jeté
      movePlayers(st, 0.1, cfg);
      const out = [];
      const porteur = st.players[st.possession.carrier] ?? null;
      for (const q of st.players) {
        if (!equipes.includes(q.team)) continue;
        const id = corpsDe.get(q.id); if (id == null) continue;
        if (q.keeper) { out.push({ id, genre: INTENTION.IA }); continue; }
        // le défenseur engagé dans un tacle fonce sur le porteur le temps du geste (l'ordre PRESSER : aimant au ballon, hâte) —
        // le tacle lui-même reste aux réflexes du corps
        if ((engagements.get(q.id) ?? -1) > st.t) { const t2 = q.target ?? q.p; const [x2, y2] = versCorps(t2[0], t2[2]); out.push({ id, genre: INTENTION.PRESSER, x: x2, y: y2, vitesse: 8, job: 'tacle' }); continue; }
        if (uneToucheTenue && uneToucheTenue.id === q.id && st.t < uneToucheTenue.jusqua) {
          out.push({ id, ...uneToucheTenue.i }); continue;
        }
        if (porteur && q === porteur) { out.push({ id, ...porteurDecide(q), trace: poss?.trace }); continue; }
        const t = q.target ?? q.p;
        const [x, y] = versCorps(t[0], t[2]);
        const voulue = Math.hypot(q._wx ?? 0, q._wz ?? 0) / SX;
        // LE PRESSEUR DU CERVEAU VA À SA GARDE (movement.js : il sprinte jusqu'à 4,2 m du porteur, puis arrive sous contrôle à
        // ≤ 2,9 m/s vers un point côté but, et ne mord le ballon qu'à < 1,6 m). L'ordre PRESSER du corps le faisait foncer,
        // aimanté, droit sur le porteur : 60 % de nos passes partaient avec un adversaire à moins d'1 m (réel : un quart sous
        // pression). Il reçoit désormais sa cible et sa vitesse ; les réflexes de tacle du corps restent les siens.
        // …ET IL MORD (match-sim.js, lot 159 — à < 1,6 m sa cible devient LE BALLON) : c'est son engagement, que le corps
        // exécute par sa chasse aimantée (PRESSER) ; le tacle lui-même reste aux réflexes du corps
        const mord = q.job === 'press' && OPT.mord && q.target && Math.hypot(q.target[0] - st.ball.p[0], q.target[2] - st.ball.p[2]) < 0.6;
        const porteurP = st.players[st.possession.carrier];
        // …et PRÈS DE SON BUT le défenseur s'engage de plus loin : on ne laisse pas frapper (mesuré : 22 % des tirs partaient
        // sans défenseur à 3 m, convertis à 55 %)
        const pres30 = porteurP && Math.hypot(st.pitch.ownGoal(q.team).x - porteurP.p[0], porteurP.p[2]) < 30;
        const aPortee = OPT.rayonCharge && porteurP && porteurP.team !== q.team && Math.hypot(q.p[0] - porteurP.p[0], q.p[2] - porteurP.p[2]) < OPT.rayonCharge * (pres30 && !OPT.ombre ? OPT.rayonSurface : 1);
        if (q.job === 'press' && aPortee) out.push({ id, genre: INTENTION.PRESSER, x, y, vitesse: 8, job: 'charge' });
        // L'OMBRE : près de son but (porteur à moins de 30 m), le presseur suit SA GARDE côté but — la cible du cerveau, entre le
        // ballon et le but — sans plonger, à la vitesse du porteur + 1 m/s (le plafond de 2,9 m/s du jockey est fait pour les
        // conduites du monde du cerveau ; les porteurs du corps vont à 3,3-3,8 m/s). Mesuré (8 × 45 min) : charger dès 6,6 m
        // près du but faisait 75 % de buts sur des ballons traînants de mêlées ; l'ombre rend 67 % de buts sur passe, 3 buts
        // par match à l'xG près, 20 tirs, 79 % de passes réussies
        else if (q.job === 'press' && OPT.ombre && pres30 && porteurP && porteurP.team !== q.team) out.push({ id, genre: INTENTION.ALLER, x, y, vitesse: Math.min(8, Math.hypot(porteurP.v[0], porteurP.v[1]) / SX + 1), job: 'ombre' });
        else if (q.job === 'press' && OPT.presse === 'corps') out.push({ id, genre: INTENTION.PRESSER, x, y, vitesse: 8, drapeaux: 1, job: q.job });
        else if (q.job === 'press' && (!OPT.presseGarde || mord)) out.push({ id, genre: INTENTION.PRESSER, x, y, vitesse: 8, job: mord ? 'mord' : q.job });
        else out.push({ id, genre: INTENTION.ALLER, x, y, vitesse: Math.max(1.5, Math.min(8, voulue || 5)), job: q.job });
      }
      // L'ACCROCHAGE DU BATTU (duel.js, lot 97 de la skill — le défenseur dépassé qui retient le porteur, l'axe de pressing de
      // son équipe), une fois le tick décidé : la faute ouverte s'adjuge aux ticks suivants (ci-dessus). Le corps ne sifflait
      // que les contacts de ses tacles : 7 fautes par match.
      out.fautes = fautes;
      if (OPT.fautes && cfg.loi12 && etat.enJeu && !etat.cpa) {
        const c = st.players[st.possession.carrier];
        if (c && st.phase === 'carry' && !st._faute && cfg.accroche !== false) (cfg.accrocheMod ?? accrocheStep)(st, c, cfg);
      }
      // LA PREMIÈRE INTENTION, une fois par passe : le monde est déjà décidé pour ce tick, on peut le salir (il est reprêté au
      // suivant) — le ballon posé au pied du receveur, à sa vitesse d'arrivée, et la fonction du cerveau tranche
      if (OPT.uneTouche && st.phase === 'flight' && vol?.pass && vol.ut === undefined) {
        const R = st.players[vol.pass.to];
        const t = R && !R.keeper && equipes.includes(R.team) ? arriveeAuPied(R) : null;
        if (t != null && t <= AVANCE_UNE_TOUCHE) {
          vol.ut = premiereIntention(R, t);
          if (vol.ut) {
            uneToucheTenue = { id: R.id, i: vol.ut, jusqua: st.t + t + 0.8 };
            const o = out.find(i => i.id === corpsDe.get(R.id));
            if (o) { for (const k of Object.keys(o)) if (k !== 'id') delete o[k]; Object.assign(o, vol.ut); }
          }
        }
      }
      return out;
    },
    /** Les compteurs de la première intention et les refus nommés du cerveau (st.deny), pour les bancs. */
    stats() { return { ...stats, refus: { ...(st.deny ?? {}) } }; },
  };

  /**
   * LE TACLE DU CERVEAU (rondo-sim.js, le pas du porteur) : la pression est un duel sur le BALLON — un défenseur dans le rayon de
   * contestation (0,9 m) et plus près du ballon que le porteur (pressPredicate) ; elle s'accumule tant qu'il y en a un ; quand elle
   * passe l'horloge du tacle (tacleHorloge, plus longue dans sa surface) et que le ballon est prenable (tackleWindow), le défenseur
   * s'engage — recharge de 1,5 s. Le presseur se tient à sa garde (presseGarde) ; sans cette décision il ne taclait plus jamais
   * (mesuré : 12 buts par match), et l'ordre PRESSER permanent le faisait coller au porteur (60 % des passes sous pression).
   */
  function decideTacle(etat) {
    const c = st.players[st.possession.carrier];
    if (!OPT.tacle || !c || st.phase !== 'carry' || !etat.enJeu || etat.cpa) { st.pressure = 0; return; }
    const press = pressPredicate(st, c, cfg);
    st.pressure = press.length ? (st.pressure ?? 0) + 0.1 : 0;
    const q = press[0];
    if (q && st.pressure >= horlogeTacle(q) && tackleWindow(st, q, cfg, balPrenable)) {
      st.pressure = 0; q.tackleCd = st.t + cfg.standCooldown;
      engagements.set(q.id, st.t + DUREE_TACLE); stats.tacles++;
    }
  }

  /** L'horloge du tacle — copie de rondo-sim.js tacleHorloge (non exportée) : tackleTime × tacleVif.tot × (2 − tempo du
   *  tacleur), × frein ÷ agressivité quand le ballon est dans SA surface (la retenue de surface, lot 169). */
  function horlogeTacle(q) {
    if (!st.full || !cfg.tacleVif) return cfg.tackleTime;
    let h = cfg.tackleTime * (cfg.tacleVif.tot ?? 0.25) * (2 - (q?.skill?.tacleTempoF ?? 1));
    const RS = cfg.retenueSurface;
    if (RS && q) {
      const g = st.pitch?.ownGoal?.(q.team);
      if (g && Math.abs(st.ball.p[0] - g.x) < 16.5 && Math.abs(st.ball.p[2]) < 20.16 && Math.abs(q.p[0] - g.x) < 18) h *= (RS.frein ?? 1.9) / Math.max(0.7, q.skill?.aggrF ?? 1);
    }
    return h;
  }

  /** Le temps (s) avant que le ballon arrive au receveur, sur sa ligne actuelle ; null s'il s'en éloigne. */
  function arriveeAuPied(R) {
    const vx = st.ball.v[0], vz = st.ball.v[2], v = Math.hypot(vx, vz);
    if (v < 0.5) return null;
    const le = ((R.p[0] - st.ball.p[0]) * vx + (R.p[2] - st.ball.p[2]) * vz) / v;
    return le > 0 ? le / v : null;
  }

  /** La décision du cerveau au moment où le ballon arrive : la reprise au but (`repriseAuBut`), sinon la passe en une touche
   *  (`uneTouche`) — rend l'intention, ou null (le corps contrôlera). Le ballon est posé au pied du receveur avec sa vitesse et
   *  sa hauteur d'aujourd'hui. */
  function premiereIntention(R, t) {
    stats.utDecisions++;
    // LE MONDE AU CONTACT : le cerveau juge la pression, les couloirs et les partenaires à la RÉCEPTION — chacun est donc
    // projeté du temps qui reste (sa vitesse × t), le receveur au point où le ballon l'atteint. Juger 0,5 s avant, c'était
    // voir le presseur encore loin : 66 % de refus « pas envie », 9 % de une-touche.
    const bx = st.ball.p[0] + st.ball.v[0] * t, bz = st.ball.p[2] + st.ball.v[2] * t;
    for (const q of st.players) if (q !== R) { q.p = [q.p[0] + (q.v?.[0] ?? 0) * t, q.p[1], q.p[2] + (q.v?.[1] ?? 0) * t]; }
    R.p = [bx, R.p[1], bz];
    // la hauteur du ballon au contact : son vol balistique (sans rebond ni frottement — un indicateur de geste)
    const h = Math.max(0, st.ball.p[1] + st.ball.v[1] * t - 4.905 * t * t);
    st.ball = new BallBody([bx, st.ball.p[1], bz], [st.ball.v[0], st.ball.v[1], st.ball.v[2]], [0, 0, 0]);
    if (OPT.reprise) { const r = repriseAuBut(R, h); if (r) return r; }
    if (!uneTouche(st, R, cfg)) return null;
    const m = st.pass?.to;
    const cible = m != null && m !== R.id ? corpsDe.get(m) ?? null : null;
    return cible != null ? { genre: INTENTION.PASSER, cible, drapeaux: PASSE.COURTE, uneTouche: true } : null;
  }

  /**
   * LA REPRISE AU BUT EN PREMIÈRE INTENTION — les lois du cerveau (tete.js, voleeStep) au contact projeté : dans la surface, LA
   * TÊTE (ballon entre tete.min et le front sauté) à moins de tete.but m du but, LA VOLÉE (volee.min-max) à moins de volee.but
   * m, le but dans le corps (reprisePhysique.corpsTete / corpsVolee) ; AU SOL, ce que l'arbitrage du cerveau choisirait le
   * ballon au pied (`arbitre` : le tir s'il vaut plus que la passe, le centre, la conduite). Le cerveau de la skill reprend
   * ses vols au contact dans son monde ; le corps, lui, ne reprend que si on le lui a demandé avant (son ordre de la latence).
   * Rend l'intention de tir (la loi de finition du cerveau, au point de contact) ou null.
   */
  function repriseAuBut(R, h) {
    const goal = st.pitch.attackGoal(R.team), sgn = Math.sign(goal.x || 1);
    const dG = Math.hypot(goal.x - R.p[0], R.p[2]), surface = st.pitch.inBox(R.p[0], R.p[2], sgn);
    const T = cfg.tete ?? {}, V = cfg.volee ?? {};
    let geste = null;
    if (h >= (T.min ?? 1.5)) { if (h <= (T.max ?? 2.2) + (T.saut ?? 0.75) && surface && dG < (T.but ?? 12) && butDansCorps(st, R, goal.x, 0, cfg, 'tete')) geste = 'tete'; }
    else if (h >= (V.min ?? 0.25)) { if (h <= (V.max ?? 1.15) && surface && dG < (V.but ?? 14) && butDansCorps(st, R, goal.x, 0, cfg, 'volee')) geste = 'volee'; }
    else if (butDansCorps(st, R, goal.x, 0, cfg, 'volee')) {
      // au sol : l'arbitrage du cerveau, le ballon posé au pied du receveur (le monde est reprêté au tick suivant)
      const sauve = { phase: st.phase, possession: st.possession, pass: st.pass, hold: st.hold, ball: st.ball };
      st.phase = 'carry'; st.possession = { team: R.team, carrier: R.id }; st.pass = null; st.hold = 0;
      st.ball = new BallBody([R.p[0], 0.11, R.p[2]], [0, 0, 0], [0, 0, 0]); st.ball.possess(R.id);
      const r = arbitre(st, R, cfg);
      Object.assign(st, sauve);
      if (r?.meilleure === 'tir') geste = 'sol';
    }
    if (!geste) return null;
    stats.reprises[geste]++;
    return { ...tirDuCerveau(R), reprise: geste };
  }

  /**
   * LE PORTEUR, aux portes du cerveau (rondo-sim.js, le bloc de décision du porteur) :
   *  · LA TENUE : on ne décide qu'au-delà de `holdMin` (0,4 s) moins le budget d'armé — et AU CALME (aucun adversaire à
   *    `calmFoe` du ballon), au-delà d'une tenue délibérée tirée par possession (`tenueCalme.calm`, 1,2-3 s, plafond 2,5 s,
   *    × le calme du joueur × l'axe tempo). Sans cette porte, le porteur passait au premier tick : deux fois trop de passes.
   *  · L'ARBITRAGE est mémorisé 0,25 s (« une lecture du monde, pas un tremblement ») ;
   *  · L'INTENTION DE PASSE adoptée vit `intentTtl` (0,9 s) — le destinataire ne change pas à chaque tick.
   * En attendant : la conduite.
   */
  function porteurDecide(c) {
    if (!poss || poss.id !== c.id) {
      const [lo, hi] = cfg.tenueCalme?.calm ?? cfg.holdCalmFull ?? [1, 2];
      const tempo = st.tactics?.[c.team]?.tempo ?? 0.5;
      const axeTempo = 1.4 + (0.6 - 1.4) * tempo;
      poss = { id: c.id, debut: st.t, calme: Math.min(cfg.tenueCalme?.plafond ?? 2.5, (lo + tirage(c.id, st.t) * (hi - lo)) * (c.persona?.calm ?? 1)) * axeTempo,
        holdMin: (cfg.holdMin ?? 0.4) * axeTempo, arb: null, intention: null };
    }
    const tenue = st.t - poss.debut;
    // l'adversaire le plus proche du ballon À LA FRAPPE : chacun projeté de la latence du corps, à sa vitesse
    const bx = st.ball.p[0] + (c.v?.[0] ?? 0) * LATENCE, bz = st.ball.p[2] + (c.v?.[1] ?? 0) * LATENCE;
    const adv = Math.min(...st.players.filter(q => q.team !== c.team).map(q => Math.hypot(q.p[0] + (q.v?.[0] ?? 0) * LATENCE - bx, q.p[2] + (q.v?.[1] ?? 0) * LATENCE - bz)));
    const auCalme = adv > (cfg.calmFoe ?? 1.8);
    const porte = Math.max(0, (auCalme ? poss.calme : poss.holdMin) - (cfg.windupBudget ?? 0.55));
    poss.trace = { tenue, porte, adv: adv / SX, auCalme };   // pour les bancs : la porte du porteur à cet instant
    if (tenue < porte) return conduite(c);
    if (poss.intention && st.t < poss.intention.jusqua) return poss.intention.i;
    if (!poss.arb || st.t - poss.arb.t > 0.25) poss.arb = { t: st.t, r: arbitre(st, c, cfg) };
    const choix = poss.arb.r?.meilleure;
    poss.trace.choix = choix; poss.trace.arbAge = st.t - poss.arb.t;
    if (choix === 'passe' || choix === 'centre') {
      let p = choosePass(st, cfg);
      // LA PASSE DANS LE CORPS (passe-faisable.js — la porte au contact de la skill, 100°) : au-delà, le corps de Gameplay
      // Football n'a que ses gestes « 180 » — la talonnade, à l'arrêt comme en plein sprint. Le cerveau ne la permet que courte
      // et au sol (talonReel, ≤ 10 m) ; sinon, selon le réglage : « tourne » — le joueur SE TOURNE D'ABORD avec le ballon,
      // la passe partira quand elle sera dans le corps — ou « autre » — il choisit une autre passe, dans le corps.
      if (OPT.talon && p?.lead) {
        const h = horsDuCorps(c, p, choix);
        if (h && OPT.talon === 'autre') {
          const veto = st.laneVeto; st.laneVeto = { ...veto, [p.to.id]: Infinity };
          const p2 = choosePass(st, cfg); st.laneVeto = veto; stats.autreChoix++;
          if (!p2?.lead || horsDuCorps(c, p2, choix)) return conduite(c);
          p = p2;
        } else if (h) { stats.seTourne++; return seTourner(c, p.lead); }
      }
      const cible = p?.to && p.to.id >= 0 && !p.to.keeper ? corpsDe.get(p.to.id) : null;
      if (cible != null) {
        if (p.lead) { const th = ecartCorps(p.lead[0] - c.p[0], p.lead[2] - c.p[2], c.yaw) * 180 / Math.PI; stats.angles[th < 45 ? 0 : th < 100 ? 1 : th < 150 ? 2 : 3]++; }
        // LES GESTES DU CORPS (AI_GetAutoPass) : la « courte » au pied ; la « longue » DANS LA COURSE (même force, cible
        // avancée de 20 % vers le but adverse — pas une passe longue) ; la « haute » levée
        const drapeaux = p.through ? PASSE.LONGUE : p.style === 'lofted' || p.style === 'chip' || choix === 'centre' ? PASSE.HAUTE : PASSE.COURTE;
        // la prévision du cerveau (selection.js : la probabilité brute, calée, la classe) — pour le banc de cohérence
        const i = { genre: INTENTION.PASSER, cible, drapeaux, sel: p.cls ? { p: p.pBrut, pHat: p.pSucc, cls: p.cls, Pc: pressionDe(st, c, cfg.passe ?? {}, cfg).P } : null };
        poss.intention = { i, jusqua: st.t + (cfg.intentTtl ?? 0.9) };
        return i;
      }
    }
    if (choix === 'tir') {
      if (poss.tir && st.t < poss.tir.jusqua) return poss.tir.i;
      const i = tirDuCerveau(c);
      poss.tir = { i, jusqua: st.t + (cfg.intentTtl ?? 0.9) };
      return i;
    }
    return conduite(c);
  }

  /**
   * LE TIR DU CERVEAU, avec SON échelle de finition (strike-sim.js, lot 258 — « mesuré avant : conversion 24,5 % (réel 11),
   * cadrés 55 % (33) », exactement les nôtres sans elle) : le point visé — le côté ouvert, à 0,9 m du poteau, la hauteur tirée
   * dans le mélange du cerveau (ras de terre, mi-hauteur, lucarne) —, puis les écarts de cap et d'élévation de finitionSigma
   * (pression du défenseur le plus proche, distance, vitesse de frappe, fatigue, finition du tireur) et la frappe sous-dosée
   * sous pression. Le corps ne pilote pas la hauteur d'une frappe : un tir que le cerveau envoie AU-DESSUS devient un tir à
   * côté, du même côté — le cadrage reste celui du cerveau. Tirages seedés (le flux 'tir' du cerveau).
   */
  function tirDuCerveau(c) {
    const gk = st.players.find(q => q.keeper && q.team !== c.team);
    const goal = st.pitch.attackGoal(c.team);
    const DEMI = 3.66, BARRE = 2.44, SPD = 28;
    const cote = gk && gk.p[2] > 0 ? -1 : 1;
    const zVise = cote * (DEMI - 0.9);
    if (!OPT.finition || !cfg.finition) { const [x0, y0] = versCorps(goal.x, zVise); return { genre: INTENTION.TIRER, x: x0, y: y0, puissance: 0.85 }; }
    const F = cfg.finition, rnd = tirageCerveau(st, 'tir', c.id, st.rnd ?? (() => 0.5));
    const H = F.hauteur ?? {}, u = rnd(), pB = H.p?.[0] ?? 0.62, pM = H.p?.[1] ?? 0.30;
    const yVise = u < pB ? (H.bas ?? 0.35) : u < pB + pM ? (H.mi ?? 1.0) : (H.lucarne ?? 1.95);
    let foeP = 99;
    for (const q of st.players) if (q.team !== c.team && !q.keeper && q.down <= 0) foeP = Math.min(foeP, Math.hypot(q.p[0] - c.p[0], q.p[2] - c.p[2]));
    const P = Math.max(0, Math.min(1, 1 - Math.max(0, foeP - 1) / Math.max(0.5, (F.press ?? 5) - 1)));
    const dG = Math.hypot(goal.x - c.p[0], zVise - c.p[2]);
    const L = finitionSigma(F, { finF: c.skill?.finF ?? 1, composureF: c.skill?.composureF ?? 1.075, weakF: c.skill?.weakF ?? 1, faible: false, P, stam: c.stam ?? 1, spd: SPD, dG });
    const zArr = zVise + dG * Math.tan(gauss(rnd) * L.sigPsi), yArr = yVise + dG * Math.tan(gauss(rnd) * L.sigTheta);
    const cadre = Math.abs(zArr) < DEMI && yArr > 0 && yArr < BARRE;
    // au-dessus (ou dessous) mais dans la largeur : le manqué devient un manqué à côté, du même côté que la visée
    const zFinal = cadre || Math.abs(zArr) >= DEMI ? zArr : Math.sign(zArr || cote) * (DEMI + 0.8);
    const [x, y] = versCorps(goal.x, zFinal);
    const puissance = Math.max(0.3, Math.min(1, 0.85 * Math.exp(gauss(rnd) * L.sigV + L.muV)));
    stats.tirs = (stats.tirs ?? 0) + 1; if (cadre) stats.tirsCadres = (stats.tirsCadres ?? 0) + 1;
    return { genre: INTENTION.TIRER, x, y, puissance };
  }

  /** La passe hors du corps (au-delà de passeFaisable.contact du regard) et qui n'est pas une talonnade permise : { th (°), dP }
   *  ou null. La talonnade permise est comptée. */
  function horsDuCorps(c, p, choix) {
    const K = cfg.passeFaisable; if (K?.contact == null) return null;
    const dx = p.lead[0] - c.p[0], dz = p.lead[2] - c.p[2], dP = Math.hypot(dx, dz);
    const th = ecartCorps(dx, dz, c.yaw) * 180 / Math.PI;
    if (th <= (OPT.seuilCorps ?? K.contact)) return null;
    // la talonnade permise (courte, au sol) reste RARE : un tirage par possession et par destinataire (stable d'un tick à
    // l'autre — sinon le joueur qui se tourne retirerait sa chance à chaque tick), calé sur le réel (0,2-0,5 % des passes)
    if (talonPermis(st, cfg, dP, { style: p.style, cross: choix === 'centre', clear: !!p.clear })
      && tirage(c.id * 64 + (p.to?.id ?? 0), poss?.debut ?? st.t) < OPT.pTalon) { stats.talons++; return null; }
    return { th, dP };
  }

  /** SE TOURNER D'ABORD : la conduite vers la passe voulue, au pas (2 m/s) — le corps pivote avec le ballon. */
  function seTourner(c, lead) {
    const dx = lead[0] - c.p[0], dz = lead[2] - c.p[2], n = Math.hypot(dx, dz) || 1;
    const [x, y] = versCorps(c.p[0] + (dx / n) * 8, c.p[2] + (dz / n) * 8);
    return { genre: INTENTION.CONDUIRE, x, y, vitesse: 2 };
  }

  /** LA CONDUITE : la poussée du cerveau (`push`, lissée 0,35 s), prolongée à 8 m ; sa vitesse voulue (le seau « carry »). */
  function conduite(c) {
    const u = c.push && Math.hypot(c.push[0], c.push[1]) > 0.1 ? c.push
      : [(c.target?.[0] ?? c.p[0]) - c.p[0], (c.target?.[2] ?? c.p[2]) - c.p[2]];
    const n = Math.hypot(u[0], u[1]) || 1;
    const [x, y] = versCorps(c.p[0] + (u[0] / n) * 8, c.p[2] + (u[1] / n) * 8);
    const voulue = Math.hypot(c._wx ?? 0, c._wz ?? 0) / SX;
    return { genre: INTENTION.CONDUIRE, x, y, vitesse: Math.max(2, Math.min(6, voulue || 4.2)) };
  }
}
