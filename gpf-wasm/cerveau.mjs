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
import { BallBody } from '../skills/threejs-aaa/assets/starter/src/engine/ball-body.js';
import { uneTouche } from '../skills/threejs-aaa/assets/starter/src/engine/premiere-intention.js';
import { accrocheStep } from '../skills/threejs-aaa/assets/starter/src/engine/duel.js';
import { tac, axe } from '../skills/threejs-aaa/assets/starter/src/engine/tactics.js';
import { INTENTION, PASSE, EV, GESTE } from './contrat.mjs';

const GPF = { hx: 55, hy: 36 };

/**
 * Un cerveau pour un match : `tactiques` = les deux tactiques de la skill (noms de presets ou objets), `graine` = celle du
 * match. `decider(etat)` rend les intentions des joueurs que le cerveau pilote (tous sauf les gardiens).
 */
export function creerCerveau({ graine = 7, tactiques = null, equipes = [0, 1], options = {} } = {}) {
  /** Les réglages de l'adaptateur, chacun débrayable pour la mesure A/B : `flux` (les tirages nommés du cerveau),
   *  `uneTouche` (la première intention posée avant le contact). */
  const OPT = { flux: true, uneTouche: true, fautes: true, ...options };
  const st = makeMatch({ full: true, seed: graine, ...(tactiques ? { tactics: tactiques } : {}) });
  // la configuration du CERVEAU : son chrono, son arbitre et ses remplacements se taisent — le temps, les Lois et les
  // changements appartiennent au corps (Gameplay Football) ; un chrono vivant ferait changer de camp le cerveau seul.
  const cfg = matchCfg({ chrono: null, loi3: null });
  // LE BALLON JOUABLE EN UNE TOUCHE EST CELUI DU CORPS : le cerveau refuse la première intention au-delà de 9,5 m/s à
  // l'arrivée — réglé pour ses passes à lui, dosées pour arriver à ≈ 5 m/s. Celles du corps arrivent à 9,5-15 m/s dans
  // 75 % des réceptions, et leur propre IA y joue en une touche avec 67-86 % de réussite (3 graines × 15 min). Le seuil
  // devient celui du corps : 15 m/s (au-delà, trop peu de cas pour juger).
  cfg.uneTouche = { ...cfg.uneTouche, vmax: 15 };
  // L'ACCROCHAGE CALÉ SUR LE CORPS : le cerveau règle sa probabilité par épisode (le défenseur battu dans le dos d'un porteur
  // lancé) pour ≈ 17 accrochages par match dans SON monde (duel.js, lot 97). Dans celui du corps l'épisode revient deux fois
  // plus : 35,9 accrochages sifflés par match à sa probabilité (8 matchs de 90 min). Le facteur rend son intention au cerveau.
  const ACCROCHE_CORPS = 17 / 35.9;
  cfg.accrocheMod = (s2, c, k) => accrocheStep(s2, c, k, axe(tac(s2, 1 - c.team).pressing, 0.7, 1.3) * ACCROCHE_CORPS);
  // …ET DANS SA SURFACE, LA RETENUE AUSSI : le cerveau y retient déjà la main (×0,15, puis retenueSurface.accro 0,4), mais
  // les attaques du corps finissent plus souvent en dribble dans la surface que dans son monde — 1 penalty par match mesuré
  // (8 matchs de 90 min), pour ≈ 0,27 au réel. La retenue de surface est calée sur ce taux.
  cfg.retenueSurface = { ...cfg.retenueSurface, accro: (cfg.retenueSurface?.accro ?? 0.4) * 0.27 };
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
  /** La une-touche décidée et pas encore frappée : { id (cerveau), cible (id du corps), jusqua }. */
  let uneToucheTenue = null;
  /** Les décisions de première intention (pour les bancs) : tentées, jouées, et les refus du cerveau par motif (st.deny). */
  const stats = { utDecisions: 0, utJouees: 0, fautes: 0 };
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
        if (uneToucheTenue && uneToucheTenue.id === q.id && st.t < uneToucheTenue.jusqua) {
          out.push({ id, genre: INTENTION.PASSER, cible: uneToucheTenue.cible, drapeaux: PASSE.COURTE, uneTouche: true }); continue;
        }
        if (porteur && q === porteur) { out.push({ id, ...porteurDecide(q), trace: poss?.trace }); continue; }
        const t = q.target ?? q.p;
        const [x, y] = versCorps(t[0], t[2]);
        const voulue = Math.hypot(q._wx ?? 0, q._wz ?? 0) / SX;
        if (q.job === 'press') out.push({ id, genre: INTENTION.PRESSER, x, y, vitesse: 8, job: q.job });
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
            uneToucheTenue = { id: R.id, cible: vol.ut, jusqua: st.t + t + 0.8 };
            const o = out.find(i => i.id === corpsDe.get(R.id));
            if (o) Object.assign(o, { genre: INTENTION.PASSER, cible: vol.ut, drapeaux: PASSE.COURTE, uneTouche: true });
          }
        }
      }
      return out;
    },
    /** Les compteurs de la première intention et les refus nommés du cerveau (st.deny), pour les bancs. */
    stats() { return { ...stats, refus: { ...(st.deny ?? {}) } }; },
  };

  /** Le temps (s) avant que le ballon arrive au receveur, sur sa ligne actuelle ; null s'il s'en éloigne. */
  function arriveeAuPied(R) {
    const vx = st.ball.v[0], vz = st.ball.v[2], v = Math.hypot(vx, vz);
    if (v < 0.5) return null;
    const le = ((R.p[0] - st.ball.p[0]) * vx + (R.p[2] - st.ball.p[2]) * vz) / v;
    return le > 0 ? le / v : null;
  }

  /** La décision du cerveau (`uneTouche`) au moment où le ballon arrive : rend l'id du corps du partenaire servi, ou null
   *  (le corps contrôlera). Le ballon est posé au pied du receveur avec sa vitesse et sa hauteur d'aujourd'hui. */
  function premiereIntention(R, t) {
    stats.utDecisions++;
    // LE MONDE AU CONTACT : le cerveau juge la pression, les couloirs et les partenaires à la RÉCEPTION — chacun est donc
    // projeté du temps qui reste (sa vitesse × t), le receveur au point où le ballon l'atteint. Juger 0,5 s avant, c'était
    // voir le presseur encore loin : 66 % de refus « pas envie », 9 % de une-touche.
    const bx = st.ball.p[0] + st.ball.v[0] * t, bz = st.ball.p[2] + st.ball.v[2] * t;
    for (const q of st.players) if (q !== R) { q.p = [q.p[0] + (q.v?.[0] ?? 0) * t, q.p[1], q.p[2] + (q.v?.[1] ?? 0) * t]; }
    R.p = [bx, R.p[1], bz];
    st.ball = new BallBody([bx, st.ball.p[1], bz], [st.ball.v[0], st.ball.v[1], st.ball.v[2]], [0, 0, 0]);
    if (!uneTouche(st, R, cfg)) return null;
    const m = st.pass?.to;
    return m != null && m !== R.id ? corpsDe.get(m) ?? null : null;
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
      const p = choosePass(st, cfg);
      const cible = p?.to && p.to.id >= 0 && !p.to.keeper ? corpsDe.get(p.to.id) : null;
      if (cible != null) {
        // LES GESTES DU CORPS (AI_GetAutoPass) : la « courte » au pied ; la « longue » DANS LA COURSE (même force, cible
        // avancée de 20 % vers le but adverse — pas une passe longue) ; la « haute » levée
        const drapeaux = p.through ? PASSE.LONGUE : p.style === 'lofted' || p.style === 'chip' || choix === 'centre' ? PASSE.HAUTE : PASSE.COURTE;
        const i = { genre: INTENTION.PASSER, cible, drapeaux };
        poss.intention = { i, jusqua: st.t + (cfg.intentTtl ?? 0.9) };
        return i;
      }
    }
    if (choix === 'tir') {
      // le côté ouvert : à l'opposé du gardien adverse
      const gk = st.players.find(q => q.keeper && q.team !== c.team);
      const [gx, gy] = versCorps(gk.p[0], gk.p[2]);
      const butX = c.team === 0 ? GPF.hx : -GPF.hx;
      return { genre: INTENTION.TIRER, x: butX, y: gy > 0 ? -2.6 : 2.6, puissance: 0.85 };
    }
    return conduite(c);
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
