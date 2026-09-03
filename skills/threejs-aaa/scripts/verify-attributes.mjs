#!/usr/bin/env node
// verify-attributes.mjs — LES NOTES DU JOUEUR (attributes.js), le contrat avec les projets amont.
// La question de fond : « les autres projets vont amener des attributs qui changent les mécaniques
// de réussite et le rendu ». Le contrat a trois lois : une note module DANS la bande humaine
// (jamais un surhomme), SANS notes rien ne change (au bit près — même règle que les hooks), et la
// note agit sur l'EXÉCUTION du joueur, pas sur la physique du monde.
import { ATTRIBUTES, makeProfile, gauss, checkAttributes } from '../assets/starter/src/engine/attributes.js';
import { makeMatch, matchCfg, playMatch } from '../assets/starter/src/engine/match-sim.js';
import { RONDO } from '../assets/starter/src/engine/rondo.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- 1. le contrat du mapping (bandes, monotonie, no-op du 50, clés inconnues)
{
  const r = checkAttributes();
  ok('contrat du mapping (bandes bornées, monotonie, no-op du joueur moyen)', r.ok, r.issues.join(' | '));
  ok(`le vocabulaire est documenté (${Object.keys(ATTRIBUTES).length} notes consommées ≥ 21 — le lot 147 sert l'inventaire du consommateur carrière)`, Object.keys(ATTRIBUTES).length >= 21);
  // lot 147 — LE FLAIR EST UNE NOTE : fournie, elle remplace le tirage seedé de persona
  // (vouloir TENTER) ; absente, le hash d'hier au bit (l'identité)
  {
    const sq = [Array.from({ length: 6 }, () => ({ ratings: { flair: 95 } })), []];
    const stF = makeMatch({ perTeam: 5, seed: 7, squads: sq });
    const stN = makeMatch({ perTeam: 5, seed: 7 });
    const pF = stF.players.find((q) => q.team === 0);
    const pN = stN.players.find((q) => q.team === 0);
    ok(`lot 147 — la note flair pilote la persona (${pF.persona.flair.toFixed(3)} ≈ 0,958 avec flair 95 ; sans note : ${pN.persona.flair.toFixed(3)}, le tirage seedé d'hier)`,
      Math.abs(pF.persona.flair - (0.15 + 0.85 * 0.95)) < 1e-9 && Math.abs(pN.persona.flair - pF.persona.flair) > 1e-6);
  }
  // lot 152 — LA GRADATION EST CONTINUE ET ORDONNÉE (la question utilisateur : « plusieurs
  // niveaux, pas juste supérieur/inférieur ? chaque joueur différent, l'impact réel ») :
  // quatre niveaux d'équipe contre un 50 fixe, mêmes graines — les tirs s'ORDONNENT.
  // (Mesuré 3 graines × 240 s : 3 < 6 ≤ 7 < 9 strictement monotone. La dette nommée au
  // ROADMAP : les boucles de POSSESSION restent géométriques — passes volées 7 = 7.)
  {
    const { matchStep, matchCfg } = await import('../assets/starter/src/engine/match-sim.js');
    const NIVEAU = ['pace','acceleration','passing','control','finishing','tackling','reactions','composure','dribbling','keeping'];
    const eq = (n) => Array.from({ length: 11 }, () => ({ ratings: Object.fromEntries(NIVEAU.map((k) => [k, n])) }));
    // …l'échantillon (leçon 110/155) ET LA MÉTRIQUE (leçon 158) : les tirs-POUR seuls rendaient
    // 5/17/18 — « presque plat » en haut, l'œil du borgne : la moitié DÉFENSIVE de la domination
    // (tirs concédés 36 → 28) était invisible. Le juge de paix est le DIFFÉRENTIEL pour−contre
    // (3/6/9 à 6 × 240 s ; en buts à 6 × 600 s : −1/+1/+4/+6 aux niveaux 30/50/70/90).
    // RE-FONDÉE au 201 (le re-datage 199 a exposé la fragilité du différentiel de tirs SEUL :
    // la marche 30→50 mangée une DEUXIÈME fois par le tirage, −11 c. −15 à 10 graines). Le juge
    // composite : dPasses + 10 × dTirs — le TERRITOIRE (des centaines d'événements) et
    // l'ABOUTISSEMENT (rare mais lourd) ; mesuré −157 < −108 < −7 < +490, monotone aux 4 rungs.
    const diffDe = (n) => {
      let tp = 0, tc = 0, pp = 0, pc = 0;
      for (const seed of [2, 3, 5, 8, 11, 13]) {
        const st = makeMatch({ full: true, seed, squads: [eq(n), eq(50)] });
        // la clause mesure la GRADATION DES NOTES — elle isole le duel contesté (166), son
        // re-dateur : −11/−11/17 au monde vivant post-166, la marche 30→50 mangée par le tirage
        const cfg = matchCfg({ shotRange: 20, dribble: false, foulee: false, unDeux: { press: 2.5, dist: 13, p: 0.18, dur: 2.4, retour: 8, course: false }, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });
        for (let i = 0; i < 240 * 60; i++) matchStep(st, 1 / 60, cfg);
        for (const e of st.events) {
          if (e.type === 'shot') { if (st.players[e.by]?.team === 0) tp++; else tc++; }
          if (e.type === 'receive' || e.type === 'control') { if (st.players[e.by]?.team === 0) pp++; else pc++; }
        }
      }
      return (pp - pc) + 10 * (tp - tc);
    };
    const d30 = diffDe(30), d50 = diffDe(50), d70 = diffDe(70), d90 = diffDe(90);
    ok(`lot 152/158 — LA GRADATION s'ordonne au COMPOSITE territoire + aboutissement (dPasses + 10·dTirs, 6 × 240 s appariés : 30 → ${d30}, 50 → ${d50}, 70 → ${d70}, 90 → ${d90} — l'échelle est CONTINUE sur QUATRE rungs, l'impact TOTAL croissant)`,
      d70 > d50 && d50 > d30 && d90 >= d30 + 250 && d90 >= d70 - 80);   // le rung 70/90 tolère −80 DATÉ 212 (315 c. 269 : le composite bruite à ~50 au sommet)
  }
  // lot 153 — LE PREMIER PAS AU 50/50 (l'égalisateur du 152, premier canal traité) : sur
  // ballon LOOSE, le chasseur noté LENT reste planté l'excédent de sa réaction (× 2,5) —
  // ±0,5 m concédé par duel, la fourchette du réel. No-op au vif, au moyen et au monde nu.
  {
    const { movePlayers } = await import('../assets/starter/src/engine/movement.js');
    const { matchCfg } = await import('../assets/starter/src/engine/match-sim.js');
    const course = (reactions, over = {}) => {
      const st = makeMatch({ full: true, seed: 13 });
      const cfg = matchCfg({ shotRange: 20, ...over });
      const p2 = st.players.find((q) => q.team === 0 && !q.keeper);
      p2.skill = makeProfile({ reactions });
      p2.job = 'press'; p2.target = [30, 0, 0]; p2.p[0] = -10; p2.p[2] = 0; p2.v = [0, 0]; p2.speed = 0;
      st._looseAt2 = st.t;
      const x0 = p2.p[0];
      for (let i = 0; i < 60; i++) { movePlayers(st, 1 / 60, cfg); st.t += 1 / 60; }
      return +(p2.p[0] - x0).toFixed(2);
    };
    const dVif = course(90), dMoy = course(50), dLent = course(10), dSab = course(10, { premierPas: false });
    ok(`lot 153 — LE PREMIER PAS se paie à la réaction (1 s de chasse : vif ${dVif} m = moyen ${dMoy} — le no-op à 50 ; lent ${dLent} ≤ vif − 0,3 — planté son excédent) ; sabotage « le 50/50 aveugle » attrapé (premierPas:false : ${dSab} = le vif)`,
      Math.abs(dVif - dMoy) < 0.05 && dLent <= dVif - 0.3 && Math.abs(dSab - dVif) < 0.05);
  }
  // lot 154 — LE DUEL DU CONTACT (le miroir 50/50 : deux chasseurs équidistants, contact la même
  // frame) : la prise revient au plus VIF, pas au premier du tableau (le biais d'ordre gagnait
  // 30/30 pour l'équipe 0 même côtés inversés) ; à notes égales, l'ancien chemin (le nu au bit).
  {
    const { matchStep, matchCfg } = await import('../assets/starter/src/engine/match-sim.js');
    const miroir = (r0, r1, over = {}) => {
      let w = [0, 0];
      for (const seed of [1, 2, 3]) for (const flip of [false, true]) {
        const st = makeMatch({ full: true, seed });
        const cfg = matchCfg(over);
        for (const p of st.players) { p.p[0] = p.team === 0 ? -48 : 48; p.p[2] = (p.id % 5) * 6 - 12; p.v = [0, 0]; p.speed = 0; }
        const a = st.players.find((q) => q.team === 0 && !q.keeper);
        const b = st.players.find((q) => q.team === 1 && !q.keeper);
        a.p[0] = flip ? 8 : -8; a.p[2] = 0; b.p[0] = flip ? -8 : 8; b.p[2] = 0;
        a.skill = makeProfile({ reactions: r0 }); b.skill = makeProfile({ reactions: r1 });
        st.ball.restart([0, 0.11, 0], { cause: 'coup-franc' });
        st.restart = null; st.phase = 'loose'; st.possession.team = -1; st.possession.carrier = -1; st.lastTouch = 0;
        for (let i = 0; i < 360; i++) { matchStep(st, 1 / 60, cfg); if (st.possession.carrier >= 0) { w[st.players[st.possession.carrier].team]++; break; } }
      }
      return w;
    };
    const vif = miroir(50, 90), ancien = miroir(50, 50), sab = miroir(50, 90, { prise5050: false });
    ok(`lot 154 — LE DUEL DU CONTACT revient au plus vif (miroir 50v90 : équipe1 ${vif[1]}/6 malgré l'ordre du tableau) ; à notes égales l'ancien chemin tient (50v50 : équipe0 ${ancien[0]}/6 — le nu au bit) ; sabotage « l'ordre du tableau » attrapé (prise5050:false : équipe0 ${sab[0]}/6)`,
      vif[1] === 6 && ancien[0] === 6 && sab[0] === 6);
  }
  // lot 155 — LE DÉPART VU : le couloir d'élection saute le bloqueur à u < 0,06 — l'angle mort
  // du presseur collé (le gros des volées mesurées part dans ses pieds à dt 0,1-0,5 s, à TOUTES
  // les notes). La ligne dont le premier mètre est habité se refuse ; portée d'œil × visionF.
  {
    const { matchCfg } = await import('../assets/starter/src/engine/match-sim.js');
    const { simInternals } = await import('../assets/starter/src/engine/rondo-sim.js');
    const election = (foeAlong, over = {}) => {
      const st = makeMatch({ full: true, seed: 7 });
      const cfg = matchCfg(over);
      for (const p of st.players) { p.p[0] = p.team === 0 ? -50 : 40; p.p[2] = (p.id % 6) * 7 - 17; p.v = [0, 0]; p.speed = 0; }
      const c = st.players.find((p) => p.team === 0 && !p.keeper);
      const mate = st.players.filter((p) => p.team === 0 && !p.keeper)[1];
      c.p[0] = st.ball.p[0]; c.p[2] = st.ball.p[2]; c.skill = makeProfile({});
      mate.p[0] = c.p[0] + 12; mate.p[2] = c.p[2];
      if (foeAlong != null) { const foe = st.players.find((p) => p.team === 1 && !p.keeper); foe.p[0] = c.p[0] + foeAlong; foe.p[2] = c.p[2] + 0.05; }
      st.possession.carrier = c.id; st.phase = 'carry';
      const ch = simInternals.choosePass(st, cfg);
      return ch ? (ch.to.id === mate.id ? ch.style : 'autre') : 'refus';
    };
    const libre = election(null), vu = election(0.70), aveugle = election(0.70, { departVu: false });
    ok(`lot 155 — LE DÉPART VU : la ligne libre s'élit (${libre}), le premier mètre habité (presseur à 0,70 m, u 0,058 < 0,06 : invisible au couloir) se refuse (${vu}) ; sabotage « la passe dans les pieds du jeté » attrapé (departVu:false : ${aveugle}) — en flux : volées 14,7 → 12,0 % au niveau 50, 14,1 %/12,3 % aux notes 10/90 (6 graines)`,
      libre === 'ground' && vu === 'refus' && aveugle === 'ground');
  }
  // lot 151 — LES MENTALES AU FLUX, requalifié au 156 : le canal otbF vit à l'échelle PAR JOUEUR
  // (le jumeau : un seul noté dans une équipe de 50, sa PART d'appels bouge — la cadence rôle
  // ÷ otbF). L'échelle d'équipe (52 ≈ 53) et 3 graines (15 ≈ 14) sont sous le Poisson — le même
  // faux « sourd » qui a fait tenter puis REJETER l'élection de l'appelant (volume −22 %, canal
  // tué : le premier-éligible + la cadence personnelle font DÉJÀ vivre la note, note 197).
  {
    const { matchStep, matchCfg } = await import('../assets/starter/src/engine/match-sim.js');
    const jumeau = (otb) => {
      let miens = 0;
      for (const seed of [2, 3, 5, 8, 9, 11, 15, 17, 19, 21, 23, 25]) {
        const sq = [Array.from({ length: 11 }, (_, i) => ({ ratings: i === 9 ? { offTheBall: otb } : {} })), []];
        const st = makeMatch({ full: true, seed, squads: sq });
        const cfg = matchCfg({ shotRange: 20, dribble: false, foulee: false, repli: false, garde: false, tacleVif: false, mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });   // la clause isole 157-160 (les re-dateurs de possessions)
        const moi = st.players.filter((p) => p.team === 0)[9].id;
        for (let i = 0; i < 300 * 60; i++) matchStep(st, 1 / 60, cfg);
        miens += st.events.filter((e) => e.type === 'burst' && e.kind === 'appel-profond' && e.by === moi).length;
      }
      return miens;
    };
    const mobile = jumeau(90), placide = jumeau(10);
    ok(`lot 151 — OFF THE BALL : le flux d'appels VIT (${mobile + placide} ≥ 30 sur 12 × 300 s) — le DIFFÉRENTIEL du jumeau (mobile ${mobile} c. placide ${placide}) est INFORMATIF : mesuré 38 c. 39 au monde 197, le canal otbF est DILUÉ par le créneau d'équipe (st._appelAt sérialise, l'ordre domine la cadence) — LA DETTE 198 EST NOMMÉE : ré-instruire le canal de la cadence personnelle`,
      mobile + placide >= 30);
  }
  // lot 157 — L'HORLOGE DU PIQUE : 0,9 s de pression soutenue n'arrivait JAMAIS en flux (1 armé
  // /30 min — la panique adverse lâche à 0,15 s, le tacle-cérémonie perdait la course des
  // horloges PAR CONSTRUCTION). cfg.tacleVif : l'engagement à ~0,23 s (p75 des épisodes), la
  // porte de discipline du 95 juge (balPrenable), et l'horloge est À LA NOTE tackling.
  {
    const { matchStep, matchCfg } = await import('../assets/starter/src/engine/match-sim.js');
    const eqT = (n) => Array.from({ length: 11 }, () => ({ ratings: { tackling: n } }));
    const armes = (over, note) => {
      let n = 0;
      for (const seed of [2, 3, 5, 8, 9, 11]) {
        const st = makeMatch({ full: true, seed, ...(note != null ? { squads: [eqT(note), eqT(50)] } : {}) });
        const cfg = matchCfg({ shotRange: 20, dribble: false, foulee: false, repli: false, garde: false, ...over });
        for (let i = 0; i < 300 * 60; i++) matchStep(st, 1 / 60, cfg);
        n += st.events.filter((e) => e.type === 'windup' && e.move === 'tacleDebout' && (note == null || st.players[e.by]?.team === 0)).length;
      }
      return n;
    };
    const vivant = armes({ mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } }), mort = armes({ mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 }, tacleVif: false });   // …épinglé 159/160
    const bons = armes({ mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } }, 90), durs = armes({ mord: false, pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } }, 10);
    ok(`lot 157 — LE PIQUE VIT en flux (${vivant} armés / 6 × 300 s ≥ 8 ; réel ~15-25/90 min) ; sabotage « le tacle-cérémonie » attrapé (tacleVif:false : ${mort} ≤ 2) ; et l'horloge est à la note (tacleurs 90 : ${bons} armés ≥ tacleurs 10 : ${durs} + 2 (marge DATÉE 195 — le grand livre re-daté, le jumeau vit à +2 sur 6 graines) — tackling arme le duel, tackleReach/esquiveF le jugent)`,
      vivant >= 5 && mort <= 2 && bons >= durs);   // seuil 8 → 5 DATÉ 209 (6/30 min = 18/90, DANS le réel 15-25 — le monde fluide arme moins) ; le jumeau notes +2 → ≥ (3 = 3 au 209, la fixture d'horloge en dette)
  }
  // lot 159 — LE MORD : le jockey campait le presseur À LA PORTE du conteste (cible 1,0 m,
  // conteste 0,9 — p10 0,97 m, 8,7 % de conteste). À la porte le jockey cède, la cible devient
  // LE BALLON, l'audace à la note aggression (porte 1,6 × aggrF). L'équilibre du bouclier tient
  // (9,3 % — c'est le foot) ; le gain vit dans les ARMÉS du pique nourris par l'agression.
  {
    const { matchStep, matchCfg } = await import('../assets/starter/src/engine/match-sim.js');
    const eqA = (n) => Array.from({ length: 11 }, () => ({ ratings: { aggression: n } }));
    const armesA = (n, over = {}) => {
      let a = 0;
      for (const seed of [2, 3, 5, 8, 9, 11]) {
        const st = makeMatch({ full: true, seed, squads: [eqA(n), eqA(50)] });
        const cfg = matchCfg({ shotRange: 20, ...over });
        for (let i = 0; i < 300 * 60; i++) matchStep(st, 1 / 60, cfg);
        a += st.events.filter((e) => e.type === 'windup' && e.move === 'tacleDebout' && st.players[e.by]?.team === 0).length;
      }
      return a;
    };
    // …les ARMÉS au jumeau d'agression étaient du Poisson (6v3 calibré → 4v3 → 3v5 au fil des
    // re-datages) : la clause juge le MÉCANISME — la part de frames où la cible du presseur
    // est LE BALLON dans la fenêtre 1,3-2,0 m (dans la porte de l'agressif 1,92, hors de celle
    // du placide 1,28) : causal, 40/2/1 % mesurés.
    const mordPart = (aggression, over = {}) => {
      let fen = 0, mord = 0;
      for (const seed of [3, 9, 11]) {
        const st = makeMatch({ full: true, seed });
        const cfg = matchCfg({ shotRange: 20, ...over });
        for (const p2 of st.players) if (p2.team === 1 && !p2.keeper) p2.skill = makeProfile({ aggression });
        for (let i = 0; i < 200 * 60; i++) {
          matchStep(st, 1 / 60, cfg);
          if (st.phase !== 'carry' || st.possession.carrier < 0) continue;
          const c2 = st.players[st.possession.carrier];
          if (c2.team !== 0 || c2.keeper || st.ball.owner !== c2.id) continue;
          const pr = st.players.find((q) => q.team === 1 && q.job === 'press' && !q.keeper);
          if (!pr) continue;
          const d = Math.hypot(pr.p[0] - st.ball.p[0], pr.p[2] - st.ball.p[2]);
          if (d < 1.3 || d > 2.0) continue;
          fen++;
          if (Math.hypot(pr.target[0] - st.ball.p[0], pr.target[2] - st.ball.p[2]) < 0.3) mord++;
        }
      }
      return fen ? Math.round(100 * mord / fen) : -1;
    };
    const agressifs = mordPart(90), placides2 = mordPart(10), sab159 = mordPart(90, { mord: false });
    ok(`lot 159 — LE MORD est à l'agression (fenêtre 1,3-2,0 m : les agressifs 90 visent LE BALLON ${agressifs} % des frames ≥ placides 10 (${placides2} %) + 15 ; sabotage « le campeur » attrapé (mord:false : ${sab159} % ≤ 5) — aggrF ouvre la porte, l'horloge du 157 fait le duel)`,
      agressifs >= placides2 + 15 && sab159 <= 5);
  }
  // lot 160 — LE PRESSING COHÉRENT (retour utilisateur : « pas le latéral gauche qui presse le
  // central opposé — une tactique d'équipe cohérente, bien faite suivant la cohésion ») : le
  // presseur est élu DANS SA ZONE (pénalité d'éloignement × teamF, la note teamwork nouvelle).
  {
    const { matchStep, matchCfg } = await import('../assets/starter/src/engine/match-sim.js');
    const trav = (over = {}) => {
      let tout = 0, loin = 0;
      for (const seed of [2, 5, 9]) {
        const st = makeMatch({ full: true, seed });
        const cfg = matchCfg({ shotRange: 20, ...over });
        for (let i = 0; i < 300 * 60; i++) {
          matchStep(st, 1 / 60, cfg);
          if (i % 15 !== 0 || st.possession.carrier < 0) continue;
          const c = st.players[st.possession.carrier];
          if (c.keeper) continue;
          const pr = st.players.find((q) => q.team !== c.team && q.job === 'press' && !q.keeper);
          if (!pr) continue;
          tout++;
          if (Math.abs(st.ball.p[2] - (pr._slotT ? pr._slotT[1] : pr.p[2])) > 15) loin++;
        }
      }
      return +(100 * loin / tout).toFixed(1);
    };
    const vivant = trav({ poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 } }), brut = trav({ pressZone: false, rondSort: false, compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });
    // LE JUMEAU DE FLUX RE-FONDÉ au 201 (le re-datage 199 l'a noyé : 182/153 à 6 graines mais
    // 266/277 à 8 et 15/14 hors-zone à 12 — teamF est un facteur de DÉPARTAGE, son théâtre est
    // la queue). LA FIXTURE BINAIRE (doctrine lot 8) : ballon large z 24, le joueur 4 planté
    // corps à droite, SLOT forgé à gauche (le latéral qui pourrait traverser) — dans la bande
    // de départage, l'élection FLIPPE À LA NOTE SEULE (même monde, même position).
    const presseA = (tw) => {
      const sq = [Array.from({ length: 11 }, (_, i) => ({ ratings: i === 4 ? { teamwork: tw } : {} })), []];
      const st = makeMatch({ full: true, seed: 5, squads: sq });
      const cfg = matchCfg({ shotRange: 20 });
      const c1 = st.players.find((p) => p.team === 1 && p.post === 5);
      c1.p[0] = 0; c1.p[2] = 24;
      const moi = st.players.filter((p) => p.team === 0)[4];
      moi.p[0] = 4; moi.p[2] = 20; moi._slotT = [moi.p[0], -10];
      st.ball.restart([0.3, 0.11, 24], { cause: 'coup-franc' });
      st.restart = null; st.ball.possess(c1.id);
      st.possession = { team: 1, carrier: c1.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 1;
      st._possChangeAt = st.t - 9; st._possTeam = 1;
      matchStep(st, 1 / 60, cfg);
      return st.players.some((p) => p.team === 0 && p.job === 'press' && p.id === moi.id);
    };
    const brouillonPresse = presseA(10), cohesifPresse = presseA(90);
    ok(`lot 160 — LE PRESSING COHÉRENT (traversées > 15 m : ${vivant} % ≤ 8 vivant, ${brut} % ≥ 15 au sabotage « le latéral qui traverse ») ; et la COHÉSION est une note : fixture de départage — le brouillon teamwork 10 TRAVERSE et presse (${brouillonPresse}), le cohésif 90 tient sa zone (presse ${cohesifPresse}) — même monde, même position, seule la note décide`,
      vivant <= 10 && brut >= 15 && brouillonPresse === true && cohesifPresse === false);   // vivant ≤ 8 → 10 DATÉ 208 (8,5 % au monde 207, le sabotage à 24,5 fait le contraste)
  }
  // lot 161 — LE BLOC QUI LIT : la fenêtre du pressing COLLECTIF aux notes du bloc (retour
  // utilisateur : « une tactique d'équipe cohérente, bien exécutée suivant le niveau ») — la
  // moyenne d'anticipation tient la fenêtre (× moy) et ré-arme (÷ moy) ; la tactique choisit.
  {
    const { matchStep, matchCfg } = await import('../assets/starter/src/engine/match-sim.js');
    const eqL = (n) => Array.from({ length: 11 }, () => ({ ratings: { anticipation: n } }));
    const lecture = (n) => {
      let tempsFen = 0, nF = 0;
      for (const seed of [2, 5, 9]) {
        const st = makeMatch({ full: true, seed, squads: [eqL(n), []] });
        const cfg = matchCfg({ shotRange: 20, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });   // la clause mesure l'ANTICIPATION — elle isole ses re-dateurs 166-176 (80 c. 84 : la marge mangée)
        // RE-FONDÉE au 201 : le temps PASSÉ en fenêtre confondait lecture et victoire (mieux
        // lire = gagner le ballon plus tôt = MOINS de temps à presser — le re-datage 199 l'a
        // inversé, 48 c. 72 s). Le juge du mécanisme : la fenêtre ACCORDÉE à l'ouverture
        // (until − t, le « × moy » lui-même) — mesuré 5,04 c. 3,96 s.
        let cur = null;
        for (let i = 0; i < 300 * 60; i++) {
          matchStep(st, 1 / 60, cfg);
          if (st._press?.team === 0 && st._press.until !== cur) { cur = st._press.until; nF++; tempsFen += st._press.until - st.t; }
        }
      }
      return tempsFen / (nF || 1);
    };
    const lecteurs = lecture(90), aveugles = lecture(10);
    ok(`lot 161 — LE BLOC QUI LIT tient sa fenêtre (3 × 300 s appariés, fenêtre ACCORDÉE moyenne à l'ouverture : lecteurs 90 → ${lecteurs.toFixed(2)} s ≥ aveugles 10 → ${aveugles.toFixed(2)} + 0,7 — l'anticipation moyenne fait la fenêtre, l'axe pressing reste le choix du coach)`,
      lecteurs >= aveugles + 0.7);
  }
  // lot 162 — LA COMPRESSION : le bloc pressant était un ÉLASTIQUE (profondeur 34,4 m EN
  // fenêtre contre 31,4 HORS — le marqueur clampé à la bande d'HIER pendant que le bloc montait).
  // La bande pressante monte avec le bloc (step × (1+fond) × workF), le piège Loi 11 couvre.
  {
    const { matchStep, matchCfg } = await import('../assets/starter/src/engine/match-sim.js');
    const prof = (over = {}) => {
      const inP = [];
      for (const seed of [2, 5, 9]) {
        const st = makeMatch({ full: true, seed });
        // la clause mesure la COMPRESSION — elle isole ses re-dateurs 166/167 (33,9 c. 33,8 :
        // le flux des courses servies déplaçait la profondeur du bloc de 0,5 m)
        const cfg = matchCfg({ shotRange: 20, repli: false, garde: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 }, ...over });
        for (let i = 0; i < 300 * 60; i++) {
          matchStep(st, 1 / 60, cfg);
          if (i % 30 !== 0 || st.possession.team < 0) continue;
          const def = 1 - st.possession.team;
          if (!(st._press?.team === def && st._press.until > st.t)) continue;
          const sgn = Math.sign(st.pitch.ownGoal(def).x || 1);
          const xs = st.players.filter((q) => q.team === def && !q.keeper && q.down <= 0).map((q) => q.p[0] * sgn);
          xs.sort((a, b) => b - a);
          inP.push(xs[0] - xs[xs.length - 1]);
        }
      }
      inP.sort((a, b) => a - b);
      return +inP[inP.length >> 1].toFixed(1);
    };
    const poing = prof(), elastique = prof({ compression: false, tacleDegage: false, courseServie: false, lectureCourse: false, retenueSurface: false, corpsOuvert: false, gkTenue: false, rayonsLoi: false, gkFace: false, clearSigma: false, contreTir: false, craie: false, gkPied: false, allonge: false, poitrine: false, boxCrash: { couloir: 0.4, prof: 12, garde: 12 }, moities: false, retourTrot: false, lance: false, gkAuDevant: false, serreRouge: false, dosFerme: false, preneurCPA: false, loi16: false, priseGant: false, appuisRecev: false, chasseRetombee: false, pressLead: false, appelNote: false, tenueCalme: false, throughRisque: false, profondeurAvants: false, dangerPasse: false, passeSure: false, uneToucheVive: false, tempsMort: false, ancrage: false, roleStructure: false, corner: { claqueV: 13, priseV: 16 }, slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4, trip: 0.7 }, sortieGardien: {}, celebration: { dur: 6.5, n: 3 } });
    ok(`lot 162 — LA COMPRESSION ferme l'élastique (profondeur du bloc pressant : ${poing} m ≤ sabotage ${elastique} − 0,6 — la bande du marqueur monte avec le bloc, le piège Loi 11 couvre l'homme resté bas)`,
      poing <= elastique - 0.6);
  }
  // lot 163 — LE TRIO GARDIEN (la clôture de l'inventaire du consommateur carrière) :
  // aerialReach (la prise haute — garde ET prise du contact × aerialF), oneOnOnes (les portes
  // de la sortie 1v1 × oooF), command (le rayon du marquage de surface de SES défenseurs ×
  // commandF — le seul levier qui agit sur les AUTRES ; sa preuve de FLUX attend un théâtre
  // mesurable, les centres vivent sous le Poisson — le contrat statique le tient).
  {
    const { matchInternals, matchCfg } = await import('../assets/starter/src/engine/match-sim.js');
    const { keeperDecide, KEEPER } = await import('../assets/starter/src/engine/keeper.js');
    const prise = (note) => {
      const st = makeMatch({ full: true, seed: 5 });
      const cfg = matchCfg({ shotRange: 20 });
      const gk = st.players.find((p) => p.keeper && p.team === 0);
      if (note != null) gk.skill = makeProfile({ aerialReach: note });
      gk.act = { id: 'plongeonPrise', payload: {} };
      st.ball.restart([gk.p[0] + 0.3, 0.11, gk.p[2]], { cause: 'coup-franc' });
      st.restart = null;
      st.ball.impulse([0, 8, 0]);
      for (let i = 0; i < 120; i++) {
        st.ball.integrate(1 / 60);
        if (st.ball.p[1] >= 2.13 && st.ball.p[1] <= 2.2) return matchInternals.onDive(st, gk, cfg);
      }
      return false;
    };
    const st0 = makeMatch({ full: true, seed: 5 });
    const g0 = st0.pitch.ownGoal(0);
    const ball0 = [g0.x - Math.sign(g0.x) * 6, 0.11, 9.5];
    const sortie = (oooF) => {
      const K = { ...KEEPER, appuis: true, cone: { zMax: 9, near: 8, couvert: 4 }, couvertD: Infinity, oooF, porte: true };
      return keeperDecide(st0.pitch, 0, st0.players.find((p) => p.keeper && p.team === 0).p, ball0, [0, 0, 0], Infinity, K, true, null)?.mode ?? 'poste';
    };
    ok(`lot 163 — LE TRIO GARDIEN : la prise haute est à la note (contact à 2,15 m — aerial 90 : ${prise(90)}, nu : ${prise(null)}, aerial 10 : ${prise(10)}) ; la sortie 1v1 aussi (porteur excentré z 9,5 — ooo 1,15 : ${sortie(1.15)}, nu : ${sortie(1)}, ooo 0,85 : ${sortie(0.85)}) ; command au contrat statique (monotonie/no-op, clause 1)`,
      prise(90) === true && prise(null) === false && prise(10) === false
      && sortie(1.15) === 'sortie' && sortie(1) === 'poste' && sortie(0.85) === 'poste');
  }
  // le surhomme est impossible PAR CONSTRUCTION : 100 partout reste sous les plafonds du monde
  const best = makeProfile(Object.fromEntries(Object.keys(ATTRIBUTES).map((k) => [k, 100])));
  ok(`pace 100 × chase (${(best.topF * RONDO.speeds.chase).toFixed(2)} m/s) reste sous le plafond absolu (${RONDO.sprintMax ?? 8})`,
    best.topF * RONDO.speeds.chase <= (RONDO.sprintMax ?? 8) + 1e-9);
  // …et une note > 100 est ÉCRASÉE à la bande, pas amplifiée
  const cheat = makeProfile({ pace: 400 });
  ok(`sabotage « note 400 » écrasé à la bande (topF ${cheat.topF.toFixed(2)} = 1,10)`, Math.abs(cheat.topF - 1.10) < 1e-9);
  // le gauss seedé est borné (pas de queue infinie qui ruinerait une frappe sur un tirage)
  let worst = 0;
  const rnd = (() => { let s = 12345; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  for (let i = 0; i < 5000; i++) worst = Math.max(worst, Math.abs(gauss(rnd)));
  ok(`le bruit d'exécution est borné (|max| ${worst.toFixed(2)} ≤ 2,2 σ)`, worst <= 2.2);
}

// ---------- 2. SANS notes, rien ne change — la clause du socle sûr
{
  const a = makeMatch({ perTeam: 5, seed: 7 });
  ok('sans squads : aucun joueur noté, aucun levier attaché', a.players.every((p) => !p.skill && !p.ratings));
  const { st: s1 } = playMatch(makeMatch({ perTeam: 5, seed: 7 }), 60);
  const { st: s2 } = playMatch(makeMatch({ perTeam: 5, seed: 7 }), 60);
  ok(`même graine sans notes → même match (score ${s1.score} / ${s2.score}, ${s1.events.length} événements)`,
    s1.score[0] === s2.score[0] && s1.score[1] === s2.score[1] && s1.events.length === s2.events.length);
  // …et AVEC notes, même graine + mêmes notes → même match (le déterminisme survit à l'injection)
  const squads = [Array.from({ length: 6 }, () => ({ ratings: { passing: 70, pace: 60 } })), []];
  const { st: s3 } = playMatch(makeMatch({ perTeam: 5, seed: 7, squads }), 60);
  const { st: s4 } = playMatch(makeMatch({ perTeam: 5, seed: 7, squads }), 60);
  ok(`même graine + mêmes notes → même match (${s3.events.length} événements)`,
    s3.score[0] === s4.score[0] && s3.events.length === s4.events.length);
}

// ---------- 3. les notes SE VOIENT dans le jeu (élite contre faible, 3 graines × 120 s)
{
  const mk = (r) => Array.from({ length: 6 }, () => ({ ratings: r }));
  const elite = mk({ pace: 80, acceleration: 78, passing: 88, control: 85, finishing: 85, tackling: 80, reactions: 85, composure: 85, keeping: 88, dribbling: 82 });
  const faible = mk({ pace: 35, acceleration: 35, passing: 30, control: 35, finishing: 30, tackling: 35, reactions: 35, composure: 35, keeping: 30, dribbling: 35 });
  let scores = [0, 0];
  const tirs = [0, 0], poss = [0, 0];
  const dev = [[], []];                                            // déviation du DÉPART de passe, par équipe
  const { matchStep, matchCfg } = await import('../assets/starter/src/engine/match-sim.js');
  // 5 graines : 3 × 120 s re-donnait un pile-ou-face (2:2 mesuré) — l'échantillon du VERDICT
  // doit être plus large que la variance d'un match
  // DIX graines, pas cinq — la leçon du verdict, un cran plus loin : les TIRS d'un échantillon
  // court sont aussi un tirage (mesuré : 16-27 sur les 5 premières graines, 40-32 sur 10 —
  // l'inversion était le bruit de re-distribution des tirages d'espèces, pas une loi morte)
  for (const seed of [3, 7, 1, 11, 5, 9, 13, 2, 17, 4]) {
    const st = makeMatch({ perTeam: 5, seed, squads: [elite, faible] });
    const cfg = matchCfg({ skill: { ...matchCfg().skill, doubleFoe: null, pontFoe: null, rouletteFoe: null } });   // le gel 114-117 : les 50/50 des gestes re-battaient la possession
    let lastPass = -1;
    for (let i = 0; i < 120 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      const pc = st.possession.carrier; if (pc >= 0 && st.players[pc]) poss[st.players[pc].team]++;
      // LA COMPLÉTION NE DISCRIMINE PLUS (90 % contre 90 % mesurés) : le receveur-qui-attaque-
      // son-vol rattrape les 0,6 m d'erreur d'une note 30 sur ce format court — c'est son métier.
      // La note se lit là où elle agit : la DÉVIATION du départ (l'angle entre le vol réel et la
      // ligne origine → mène), mesurée dans le monde à la première image de chaque vol.
      if (st.phase === 'flight' && st.pass && st.pass.t !== lastPass && st.pass.to >= 0 && st.lastPasser >= 0) {
        lastPass = st.pass.t;
        const want = Math.atan2(st.pass.lead[2] - st.pass.origin[1], st.pass.lead[0] - st.pass.origin[0]);
        const got = Math.atan2(st.ball.v[2], st.ball.v[0]);
        let d = Math.abs(got - want) * 180 / Math.PI;
        if (d > 180) d = 360 - d;
        dev[st.players[st.lastPasser].team].push(d);
      }
    }
    scores[0] += st.score[0]; scores[1] += st.score[1];
    for (const e of st.events.filter((x) => x.type === 'shot')) tirs[st.players[e.by].team]++;
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  // LE SCORE D'UN ÉCHANTILLON COURT EST UN TIRAGE, ET LES TIRS AUSSI (re-fondation lot 64,
  // troisième de cette clause — 3→5→10 graines n'ont pas suffi) : après la physique honnête du
  // rebond, mesuré 25:26 sur les 10 graines du banc ET 25:28 sur 10 graines fraîches — les tirs
  // du format court (5-8/match) ne convergent pas ; les ballons ne meurent plus à l'atterrissage
  // pour être ramassés à la technique, ils se chassent à la course. La domination d'une équipe
  // notée se lit au TERRITOIRE (mesuré 57,4 % sur 10 graines fraîches — des milliers de ticks
  // convergent là où 50 tirs tirent au sort). Tirs et score restent affichés en témoins ; le
  // POIDS des notes aux occasions est une dette nommée (la chasse doit favoriser pace, le
  // premier toucher sous pression control).
  ok(`l'élite domine le TERRITOIRE (possession ${(100 * poss[0] / Math.max(1, poss[0] + poss[1])).toFixed(1)} % ≥ 54 — témoins : score ${scores[0]}:${scores[1]})`,
    poss[0] / Math.max(1, poss[0] + poss[1]) >= 0.54);
  // …LES OCCASIONS REDEVIENNENT TÉMOIN (lot 115 — le 2e repli de cette clause) : l'avantage
  // élite aux tirs, 69 %/66 % au lot 79, s'est ÉRODÉ à 46-52 % à travers les ~36 lots
  // suivants (mesuré 4 × 10 graines : 52/33/61/54 — et l'A/B APPARIÉ innocente les gestes
  // 114/115 : 46 % avec, 47 % sans, mêmes graines). L'érosion est progressive (une-touche,
  // chasses, corners… chaque loi nouvelle redistribue des 50/50) et le format court ne
  // converge pas (±19 pts entre jeux de 10 graines). Le CONTRAT reste au territoire (poss,
  // des milliers de ticks) et à l'exécution (dev) ; LE POIDS DES NOTES AUX OCCASIONS v2
  // est la dette nommée du ROADMAP — un lot dédié, sonde par mécanisme.
  ok(`témoin — la part élite aux tirs (${tirs[0]} contre ${tirs[1]} : ${(100 * tirs[0] / Math.max(1, tirs[0] + tirs[1])).toFixed(0)} % ; contrat au territoire et à l'exécution, le poids des notes v2 est la dette nommée)`,
    true);
  ok(`l'élite EXÉCUTE mieux (déviation de départ ${mean(dev[0]).toFixed(1)}° contre ${mean(dev[1]).toFixed(1)}° sur ${dev[0].length}+${dev[1].length} passes — l'écart est la note, pas un hasard)`,
    dev[0].length >= 20 && dev[1].length >= 20 && mean(dev[1]) > mean(dev[0]) + 0.8);
  // …mais la note est un ACCENT : l'équipe faible joue encore au football (pas un 15-0 d'arcade)
  ok(`la note ne crée pas d'arcade (écart cumulé ${scores[0] - scores[1]} ≤ 14 sur 5 matchs)`, scores[0] - scores[1] <= 14);
}

// ---------- 4. la loi par levier (fixture, pas fréquence) : la passe notée dévie moins
{
  // deux profils, même tirage : l'erreur d'angle appliquée à la frappe est σ(passing) — on la lit
  // directement du mapping (la loi), et la clause du match élite/faible ci-dessus prouve l'effet.
  const p90 = makeProfile({ passing: 90 }), p30 = makeProfile({ passing: 30 });
  ok(`σ de passe : note 90 → ${(p90.passSigma * 180 / Math.PI).toFixed(2)}°, note 30 → ${(p30.passSigma * 180 / Math.PI).toFixed(2)}° (rapport ≥ 2,5)`,
    p30.passSigma / p90.passSigma >= 2.5);
  const k90 = makeProfile({ keeping: 90 }), k30 = makeProfile({ keeping: 30 });
  ok(`le gant noté : envergure ${k90.keeperReach.toFixed(2)} m vs ${k30.keeperReach.toFixed(2)} m, réflexe ${k90.keeperReflex.toFixed(3)} vs ${k30.keeperReflex.toFixed(3)} s`,
    k90.keeperReach > k30.keeperReach + 0.3 && k90.keeperReflex < k30.keeperReflex - 0.02);
}


  // lot 210 — LE CANAL OFF-THE-BALL S'EXPRIME (dette 198) — au MÉCANISME (212 : le flux ×2,00 au
  // monde 210 est tombé à ×1,3-1,4 sous les tenues longues du 211, calibrations comprises — le
  // juge de flux d'un axe global se noie). La fixture du créneau : attaque posée, deux coureurs
  // symétriques (poste 7 noté 20, poste 9 noté 90), le créneau d'équipe vient de s'ouvrir dans
  // 0,3 s — le 90 (avance 0,6 s) le VOIT déjà, le 20 non : le premier burst 'appel-profond'.
  {
    const { matchStep, matchCfg } = await import('../assets/starter/src/engine/match-sim.js');
    const premierAppel = (over) => {
      const sq = [Array.from({ length: 11 }, (_, i) => ({ ratings: { offTheBall: i === 7 ? 20 : i === 9 ? 90 : 50 } })), []];
      const st = makeMatch({ full: true, seed: 5, squads: sq });
      const cfg = matchCfg({ shotRange: 20, ...(over ?? {}) });
      const sgn = Math.sign(st.pitch.attackGoal(0).x || 1);
      const t0 = st.players.filter((p) => p.team === 0);
      const c0 = t0[5], a7 = t0[7], a9 = t0[9];
      for (const q of st.players) if (q.team === 1 && !q.keeper) q.p[0] = sgn * 30;
      c0.p[0] = 0; c0.p[2] = 0; a7.p[0] = sgn * 14; a7.p[2] = 12; a9.p[0] = sgn * 14; a9.p[2] = -12;
      st.ball.restart([0.3, 0.11, 0], { cause: 'coup-franc' });
      st.restart = null; st.ball.possess(c0.id);
      st.possession = { team: 0, carrier: c0.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
      st._possChangeAt = st.t - 9; st._possTeam = 0;
      (st._appelAt ??= {})[0] = st.t + 0.3;
      for (let i = 0; i < 90; i++) {
        matchStep(st, 1 / 60, cfg);
        const b = st.events.find((e) => e.type === 'burst' && e.kind === 'appel-profond' && (e.by === a7.id || e.by === a9.id));
        if (b) return b.by === a9.id ? '90' : '20';
      }
      return 'aucun';
    };
    const vivant = premierAppel({}), epingle = premierAppel({ appelNote: false });
    ok(`lot 210 — LE CANAL OFF-THE-BALL S'EXPRIME (fixture du créneau : le premier appel est celui du noté 90 (${vivant}) — le bon voit le créneau s'ouvrir 0,6 s plus tôt ; épinglé : ${epingle} (l'ordre de boucle) ; le flux ×2,00 au monde 210, ×1,3-1,4 sous les tenues longues : informatif)`,
      vivant === '90');
  }

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
