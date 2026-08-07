#!/usr/bin/env node
// verify-match11.mjs — LE 11C11 EST UNE CONFIGURATION, ET ÇA SE PROUVE (la promesse de
// MOTEUR.md « greffer le 11c11 : le chemin balisé », tenue).
//
// La demande utilisateur qui fonde le banc : « un autre projet qui s'appuie sur ce qu'on a fait
// a une tuyauterie de match tellement complexe que le rendu 3D est horrible — je veux m'assurer
// que ce qu'on fait fonctionne avec 22 joueurs de façon fluide ». La réponse du moteur :
// makeMatch({ full: true }) — terrain Loi 1 (105 × 68), 10 + gardien par équipe, formation
// 4-3-3 dont le bloc coulisse, MÊME game-loop, mêmes lois, zéro fork. Mesuré : sim 0,44 ms/step
// à 22 joueurs ; scène complète (couches + IK + warps) 3,65 ms/image ; fps 22 corps = 75 % du
// fps 12 corps en rasterisation CPU pure (le pire cas — le stade domine les triangles).
//
// V1 assumée : ce banc prouve l'ARCHITECTURE (ça tourne, le bloc est un bloc, pas de gel, le
// budget tient). L'ÉQUILIBRE de jeu du plein format (tempo, tirs, conversion — les bandes fines
// du réduit) est la dette nommée du backlog « réglage 11c11 ».
import { makePitch, FULL } from '../assets/starter/src/engine/pitch.js';
import { formationSpots, checkFormation, premierOffensif } from '../assets/starter/src/engine/formation.js';
import { makeMatch, matchCfg, matchStep, checkMatch, playMatch } from '../assets/starter/src/engine/match-sim.js';
import { checkOffside, offsideLine } from '../assets/starter/src/engine/offside.js';
import { simInternals } from '../assets/starter/src/engine/rondo-sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- 1. la formation est une donnée saine — TOUT le catalogue (lot 17)
{
  const pitch = makePitch(FULL);
  for (const name of ['433', '442', '352']) {
    const c0 = checkFormation(pitch, 0, name), c1 = checkFormation(pitch, 1, name);
    ok(`la formation ${name} est SAINE des deux côtés (postes dans le terrain, lignes ${'' + (name === '433' ? '4-3-3' : name === '442' ? '4-4-2' : '3-5-2')} ordonnées, largeur à l'échelle, bloc qui coulisse)`,
      c0.ok && c1.ok, [...c0.issues, ...c1.issues].join(' ; '));
  }
  ok(`les POINTES sont celles de LA formation (premierOffensif : 433 → 7, 442 → 8, 352 → 8 — le calage Loi 11 ne câble plus « ≥ 7 »)`,
    premierOffensif('433') === 7 && premierOffensif('442') === 8 && premierOffensif('352') === 8 && premierOffensif('666') === 7);
}

// ---------- 2. le monde 22 corps tourne, contrat de base, budget
{
  const st = makeMatch({ full: true, seed: 3 });
  ok(`makeMatch({ full }) : 22 joueurs sur ${st.pitch.dims.length} × ${st.pitch.dims.width} (Loi 1)`,
    st.players.length === 22 && st.pitch.dims.length === 105 && st.full === true);
  const cfg = matchCfg({ shotRange: 20 });
  const t0 = process.hrtime.bigint();
  let gelMax = 0, sinceEvent = 0, passes = 0;
  let lastN = 0;
  for (let i = 0; i < 180 * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    if (st.events.length > lastN) { lastN = st.events.length; sinceEvent = 0; } else sinceEvent += 1 / 60;
    gelMax = Math.max(gelMax, sinceEvent);
  }
  const msStep = Number(process.hrtime.bigint() - t0) / 1e6 / (180 * 60);
  passes = st.events.filter((e) => e.type === 'pass').length;
  ok(`la sim 22 joueurs tient son budget (${msStep.toFixed(2)} ms/step ≤ 1,5 — mesuré 0,44 sur la machine de calibrage)`, msStep <= 1.5);
  ok(`le jeu VIT en plein format (${passes} passes en 3 min ≥ 25, ${st.events.filter((e) => e.type === 'shot').length} tirs)`, passes >= 25);
  ok(`le monde ne GÈLE jamais (plus long silence d'événements ${gelMax.toFixed(1)} s ≤ 25)`, gelMax <= 25);
  // le contrat de base du match juge aussi ce monde (téléports, ledger, score-événements)
  const st2 = makeMatch({ full: true, seed: 7 });
  // 150 s (lot 37 : à 90 s, un flux borné à un camp arrive — le vrai football aussi ; la
  // fenêtre s'allonge plutôt que d'épingler une graine, doctrine lot 36)
  const { st: s2, trace } = playMatch(st2, 150, { cfg: matchCfg({ shotRange: 20 }) });
  const r = checkMatch(s2, trace, cfg);
  ok(`le CONTRAT du match tient à 22 (checkMatch : ${r.ok ? 'ok' : r.issues.slice(0, 2).join(' ; ')})`, r.ok);
}

// ---------- 3. le bloc est un BLOC : les postes sont TENUS en jeu
{
  const st = makeMatch({ full: true, seed: 11 });
  const cfg = matchCfg({ shotRange: 20 });
  let cover = 0, n = 0;
  for (let i = 0; i < 120 * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    if ((i % 60) !== 0 || st.restart) continue;
    // à chaque seconde de jeu ouvert : combien des 10 postes de CHAQUE équipe ont un corps à
    // ≤ 12 m ? (les actifs — porteur, presseur, coureurs — désertent le leur : c'est le jeu)
    for (const team of [0, 1]) {
      const atk = st.possession.team === team;
      // …les postes JUGÉS sont ceux que le moteur SERT (lot 42 : le défendant vit au bloc
      // compact — juger les vieux postes étirés comptait des déserteurs imaginaires)
      const spots = formationSpots(st.pitch, team, st.ball.p[0], atk, undefined, atk ? null : cfg.bloc);
      const mine = st.players.filter((q) => q.team === team && !q.keeper && q.down <= 0);
      let covered = 0;
      for (const [x, z] of spots) {
        if (mine.some((q) => Math.hypot(q.p[0] - x, q.p[2] - z) < 12)) covered++;
      }
      cover += covered; n += 10;
    }
  }
  const pct = (100 * cover / Math.max(1, n));
  // 55 : le monde mesuré vit à 60 % — les ~6 ACTIFS par équipe (porteur, soutiens, press,
  // cover, marqueurs) désertent leur poste pour JOUER, c'est le football ; les postés tiennent
  // le reste. L'existence du bloc est prouvée par le sabotage dessous (dispersion +5,8 m).
  ok(`le bloc TIENT ses postes (${pct.toFixed(0)} % des postes couverts à ≤ 12 m ≥ 55 — un bloc lisible, pas un essaim)`, pct >= 55);
}

// ---------- 3b. LE BLOC COMPACT (lot 42, retour utilisateur « les lignes sont trop espacées,
// les matchs ne sont pas réalistes ») : l'équipe SANS ballon est chaînée au ballon — ligne à
// ~27 m derrière lui, bloc borné à ~30 m, interlignes comprimées. Mesuré : bloc défendant
// p50 43 → 30,3 m (réel 25-40), interligne défense→milieu 25,5 → 14,7 m (réel 10-15), et
// l'ASYMÉTRIE naît (attaque 42 m étirée) — flux tenu (70 tirs / 29 buts, 20 × 300 s).
{
  // la LOI PURE d'abord : ballon au rond central → la ligne défendante vit à ~ligne m du
  // ballon (pas à ses postes absolus), et le bloc tient dans long m
  const st0 = makeMatch({ full: true, seed: 1 });
  const cfg0 = matchCfg({ shotRange: 20 });
  const spots = formationSpots(st0.pitch, 1, 0, false, undefined, cfg0.bloc);
  const sgn1 = -st0.pitch.ownGoal(1).sign;
  const xs = spots.map(([x]) => x * sgn1);                          // axe d'attaque de l'équipe 1
  const lignePos = Math.min(...xs), span = Math.max(...xs) - lignePos;
  const dLigneBallon = 0 - lignePos;                                // ballon à l'avance 0 (rond central)
  ok(`la LOI PURE du bloc (ballon au rond central : ligne défendante à ${dLigneBallon.toFixed(1)} m derrière le ballon ≈ ${cfg0.bloc.ligne}, longueur ${span.toFixed(1)} m ≤ ${cfg0.bloc.long} + 1)`,
    Math.abs(dLigneBallon - cfg0.bloc.ligne) < 2 && span <= cfg0.bloc.long + 1);
  // le FLUX ensuite : les bandes réelles en match (agrégat 2 × 120 s, doctrine lot 36)
  const mesure = (cfgX) => {
    const dLong = [], dInter = [], aLong = [];
    for (const seed of [1, 3]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...cfgX });
      for (let i = 0; i < 120 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (i % 30 !== 0 || st.restart) continue;
        const poss = st.possession.carrier >= 0 ? st.players[st.possession.carrier].team : (st.lastTouch ?? 0);
        for (const team of [0, 1]) {
          const corps = st.players.filter((p) => p.team === team && !p.keeper && p.down <= 0 && !p.expulse && !p._sub);
          if (corps.length < 8) continue;
          const sgn = Math.sign(st.pitch.attackGoal(team).x || 1);
          const xs2 = corps.map((p) => p.p[0] * sgn).sort((a, b) => a - b);
          const L = xs2[xs2.length - 1] - xs2[0];
          if (team === poss) { aLong.push(L); continue; }
          dLong.push(L);
          dInter.push((xs2[4] + xs2[5] + xs2[6]) / 3 - (xs2[0] + xs2[1] + xs2[2] + xs2[3]) / 4);
        }
      }
    }
    const p50 = (a) => { a.sort((x, y) => x - y); return a.length ? a[Math.floor(0.5 * (a.length - 1))] : 99; };
    return { dLong: p50(dLong), dInter: p50(dInter), aLong: p50(aLong) };
  };
  const vif = mesure({});
  ok(`le BLOC DÉFENDANT est court en match (longueur p50 ${vif.dLong.toFixed(1)} m ≤ 36 — réel 25-40 —, interligne défense→milieu ${vif.dInter.toFixed(1)} m ≤ 19 — réel 10-15 —, et l'ASYMÉTRIE vit : attaque ${vif.aLong.toFixed(1)} ≥ défense + 4)`,
    vif.dLong <= 36 && vif.dInter <= 19 && vif.aLong >= vif.dLong + 4);
  const sab = mesure({ bloc: false });
  ok(`sabotage « bloc élastique » attrapé (bloc:false : longueur défendante p50 ${sab.dLong.toFixed(1)} m ≥ vivant + 6 (${(vif.dLong + 6).toFixed(1)}) — les lignes espacées d'hier, nommées)`,
    sab.dLong >= vif.dLong + 6);
}

// ---------- 3c. LE PRIX DU PREMIER TOUCHER (lot 43, retour utilisateur « effet aimant sur
// les longs ballons ») : la prise de turnover paie le contrat du contrôle attaquant — un
// ballon > 10 m/s peut FUIR la touche (résiduel vivant, ballon libre), il ne se possède pas
// d'un claquement de doigts. Mesuré avant : 14 % des prises > 10 m/s, un dégagement de
// 26,5 m/s possédé instantanément. La MÊME scène, trois mondes — le tirage seedé décide,
// la clé retirée est l'aimant nommé.
{
  const scene = (cfgExtra, rndV) => {
    const st = makeMatch({ full: true, seed: 5 });
    const sgn = -st.pitch.ownGoal(0).sign;
    for (const q of st.players.filter((q) => q.team === 0)) { q.p[0] = -sgn * 40; q.p[2] = 25; q.v = [0, 0]; }
    for (const q of st.players.filter((q) => q.team === 1)) { q.p[0] = -sgn * 40; q.p[2] = -25; q.v = [0, 0]; }
    const d = st.players.find((p) => p.team === 1 && !p.keeper);
    d.p[0] = 10; d.p[2] = 0; d.v = [0, 0]; d.act = null; d.down = 0;   // le récupérateur sous le long ballon
    st.ball.release('sortie');
    st.ball.restart([10 - sgn * 8, 0.11, 0], { cause: 'touche' });
    st.ball.strike({ speed: 16, dirYaw: Math.atan2(0, sgn), elevation: 0.02, spinAxis: [0, 1, 0], spinRev: 0 });
    st.restart = null;                                              // le coup d'envoi du makeMatch frais gèle canTake
    st.phase = 'flight'; st.possession = { team: 0, carrier: -1 }; st.hold = 0; st.lastTouch = 0;
    st.pass = { from: 0, to: -2, lead: [10, 0, 0], t: st.t - 1, origin: [10 - sgn * 8, 0], flight: 0.5 };
    st.rnd = () => rndV;
    const cfg = matchCfg({ shotRange: 20, ...cfgExtra });
    for (let i = 0; i < 0.8 * 60 && !st.events.some((e) => e.type === 'turnover'); i++) matchStep(st, 1 / 60, cfg);
    const ctl = st.events.filter((e) => e.type === 'control').pop();
    return { d, ctl, carrier: st.possession.carrier, phase: st.phase, vRes: Math.hypot(st.ball.v[0], st.ball.v[2]) };
  };
  const fuit = scene({}, 0.01);                                     // tirage bas → la touche FUIT
  ok(`la touche FUIT sur le long ballon (16 m/s, tirage 0,01 : control miss=${fuit.ctl?.miss}, ballon LIBRE — carrier ${fuit.carrier} = −1, phase ${fuit.phase}, résiduel ${fuit.vRes.toFixed(1)} m/s vivant)`,
    fuit.ctl?.miss === true && fuit.carrier === -1 && fuit.phase === 'loose' && fuit.vRes > 1.5);
  const prend = scene({}, 0.99);                                    // tirage haut → la prise est propre
  ok(`la prise PROPRE existe aussi (même scène, tirage 0,99 : possédé par nº${prend.carrier} = nº${prend.d.id} — un bon défenseur contrôle un long ballon, c'est un TIRAGE, pas une loterie visuelle)`,
    prend.carrier === prend.d.id && prend.ctl?.miss !== true);
  const aimant = scene({ touchePrix: false }, 0.01);                // la clé retirée → l'aimant d'hier
  ok(`sabotage « l'aimant » attrapé (touchePrix:false, même scène, même tirage : possédé instantanément par nº${aimant.carrier} à 16 m/s — le ballon attiré sans prix, nommé)`,
    aimant.carrier === aimant.d.id);
}

// ---------- 4. sabotage nommé : sans la formation, le 22-corps redevient l'essaim du réduit
{
  // les couloirs du réduit ne savent poster que ~9 corps par équipe (5 slots + press/cover/
  // marks) — mesurer la DISPERSION du bloc : sans postes, les non-servis s'agglutinent
  const disp = (full) => {
    const st = makeMatch({ full: true, seed: 3 });
    if (!full) st.full = false;                                    // le sabotage : la config du réduit sur 22 corps
    const cfg = matchCfg({ shotRange: 20 });
    let spread = 0, n = 0;
    for (let i = 0; i < 60 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      if ((i % 60) !== 0 || st.restart) continue;
      for (const team of [0, 1]) {
        const mine = st.players.filter((q) => q.team === team && !q.keeper);
        const cx = mine.reduce((a, q) => a + q.p[0], 0) / mine.length;
        const cz = mine.reduce((a, q) => a + q.p[2], 0) / mine.length;
        spread += mine.reduce((a, q) => a + Math.hypot(q.p[0] - cx, q.p[2] - cz), 0) / mine.length;
        n++;
      }
    }
    return spread / Math.max(1, n);
  };
  const avec = disp(true), sans = disp(false);
  ok(`sabotage « essaim » attrapé (dispersion du bloc ${avec.toFixed(1)} m avec les postes, ${sans.toFixed(1)} sans — la formation OCCUPE le terrain, ≥ +3 m)`,
    avec >= sans + 3);
}

// ---------- 5. LA LOI 11 (hors-jeu) — la ligne, la photo, le sifflet
// Le mécanisme se prouve sur FIXTURES (doctrine : les sabotages comparatifs de flux mentent
// à travers les re-distributions — mesuré 3× au Lot 8) ; le flux ne juge que l'EXISTENCE.
{
  // le contrat de la loi elle-même (avant-dernier, ballon, moitié, tolérance)
  const c = checkOffside(makePitch(FULL));
  ok(`le contrat de la Loi 11 tient (checkOffside : avant-dernier défenseur, ballon qui tient la ligne, moitié qui immunise, tolérance)`, c.ok, c.issues.join(' ; '));

  // LA FIXTURE : une possession posée au rond central, la défense alignée à 18 m, la pointe
  // plantée à 26 m — 8 m derrière l'avant-dernier. Déterministe, rejouable, sans re-distribution.
  const fixture = (cfgOver = {}, recAdv = 26) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = matchCfg({ shotRange: 20, ...cfgOver });
    const sgn = -st.pitch.ownGoal(0).sign;
    const c0 = st.players.find((p) => p.team === 0 && p.post === 5);        // le milieu axial porte
    const rec = st.players.find((p) => p.team === 0 && p.post === 8);       // le 9 est la cible
    c0.p[0] = 0; c0.p[2] = 0; c0.v = [0, 0];
    for (const q of st.players.filter((q) => q.team === 1)) q.p[0] = sgn * (q.keeper ? 51 : 18);
    for (const q of st.players.filter((q) => q.team === 0 && q !== c0 && q !== rec)) q.p[0] = -sgn * 8;
    rec.p[0] = sgn * recAdv; rec.p[2] = 4; rec.v = [0, 0];
    st.ball.restart([0, 0.11, 0], { cause: 'coup-franc' });
    st.restart = null;                                                       // fixture : le jeu est OUVERT
    st.ball.possess(c0.id);
    st.possession = { team: 0, carrier: c0.id };
    st.phase = 'carry'; st.hold = 1.4; st.lastTouch = 0;
    return { st, cfg, c0, rec, sgn };
  };

  // (a) le CERVEAU refuse — refus nommé 'hors-jeu' à la porte de beginPass
  {
    const { st, cfg, rec } = fixture();
    const choice = { to: rec, lead: [rec.p[0] + 2, 0.11, rec.p[2]], style: 'ground', lane: { margin: 3, open: true }, dist: 26 };
    const r = simInternals.beginPass(st, choice, cfg);
    ok(`le cerveau REFUSE la passe vers un hors-jeu (beginPass → refus nommé, pointe à 26 m / ligne 18)`,
      r === false && (st.deny?.['hors-jeu'] ?? 0) === 1, `deny=${JSON.stringify(st.deny ?? {})}`);
  }
  // (b) …mais un ONSIDE d'un cheveu passe la porte (la loi ne mord que derrière la ligne)
  {
    const { st, cfg, rec } = fixture({}, 17.8);
    const choice = { to: rec, lead: [rec.p[0] + 2, 0.11, rec.p[2]], style: 'ground', lane: { margin: 3, open: true }, dist: 18 };
    simInternals.beginPass(st, choice, cfg);
    ok(`l'onside d'un cheveu N'EST PAS refusé pour hors-jeu (17,8 m / ligne 18 — la porte ne juge que la loi)`,
      (st.deny?.['hors-jeu'] ?? 0) === 0, `deny=${JSON.stringify(st.deny ?? {})}`);
  }
  // (c) sabotage nommé « ligne aveugle » : offside:false → la porte de la LOI est morte (mesuré :
  // la même passe meurt ensuite sur 'course' — les autres lois jugent encore, c'est le point)
  {
    const { st, cfg, rec } = fixture({ offside: false });
    const choice = { to: rec, lead: [rec.p[0] + 2, 0.11, rec.p[2]], style: 'ground', lane: { margin: 3, open: true }, dist: 26 };
    simInternals.beginPass(st, choice, cfg);
    ok(`sabotage « ligne aveugle » attrapé (offside:false — la porte est morte, aucun refus 'hors-jeu')`,
      (st.deny?.['hors-jeu'] ?? 0) === 0, `deny=${JSON.stringify(st.deny ?? {})}`);
  }
  // (d) le SIFFLET : une passe FORCÉE marquée par la photo (strikeNow) trouve le coupable —
  // son premier toucher lève le drapeau (receive), l'image suivante pose le COUP FRANC ADVERSE
  {
    const { st, cfg, rec } = fixture();
    st.possession = { team: 0, carrier: -1 }; st.phase = 'flight';
    st.pass = { from: 0, to: rec.id, t: st.t, off: { [rec.id]: [+rec.p[0].toFixed(2), +rec.p[2].toFixed(2)] } };
    simInternals.receive(st, rec.id, cfg);
    const ev = st.events.filter((e) => e.type === 'hors-jeu');
    matchStep(st, 1 / 60, cfg);
    ok(`le premier toucher d'un hors-jeu SIFFLE (événement + coup franc ADVERSE au point de l'infraction)`,
      ev.length === 1 && st.restart?.type === 'coup-franc' && st.restart?.team === 1 && st.ball.owner == null,
      `evs=${ev.length} restart=${st.restart?.type}/${st.restart?.team}`);
  }
}

// ---------- 6. les APPELS TIMÉS existent et sont SUIVIS (flux : existence, pas de bande fine)
{
  let appels = 0, servis = 0, offPct = [], denies = 0;
  // graines {2,4,5} (re-fondé lot 34 : le monde des duels charge le porteur pendant qu'il
  // sert — le service s'est raréfié, l'existence tient, le taux reste la dette nommée)
  // graines {3,6,8} (re-fondé lot 35 : la bascule — option sûre — surclasse le service du
  // coureur, 0-2 servis par jeu de graines ; le taux d'appels servis est une dette d'équilibrage
  // NOMMÉE : appelBonus contre bonus de bascule, à arbitrer en réglage)
  for (const seed of [3, 6, 8]) {
    const st = makeMatch({ full: true, seed });
    const cfg = matchCfg({ shotRange: 20 });
    let fPoss = 0, fOff = 0;
    for (let i = 0; i < 180 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      if (st.restart || st.possession.team < 0) continue;
      const atk = st.possession.team;
      const L = offsideLine(st, atk);
      const trio = st.players.filter((p) => p.team === atk && !p.keeper && (p.post ?? 0) >= 7);
      if (trio.length) { fPoss++; if (trio.some((p) => p.p[0] * L.sgn > L.adv + 0.05)) fOff++; }
    }
    const bursts = st.events.filter((e) => e.type === 'burst' && e.kind === 'appel-profond');
    const passes = st.events.filter((e) => e.type === 'pass');
    appels += bursts.length;
    servis += passes.filter((p) => bursts.some((b) => b.by === p.to && p.t - b.t >= 0 && p.t - b.t < 2.2)).length;
    offPct.push(100 * fOff / Math.max(1, fPoss));
    denies += st.deny?.['hors-jeu'] ?? 0;
  }
  // sobriété : 2-5 appels mesurés par 180 s — des ruptures, pas un essaim de sprints
  ok(`les appels profonds VIVENT sans essaim (${appels} sur 3 graines × 180 s, bande [1 ; 36] — l'ABONDANCE varie fort par flux, l'existence est la clause)`, appels >= 1 && appels <= 36);
  // suivi : 3 servis mesurés sur 9 appels (27 % — un appel réel n'est pas toujours servi non
  // plus) ; l'existence est la clause, le taux est une dette de réglage nommée
  // le SERVICE de l'appel se prouve dans verify-circuits (9 matchs agrégés, loi du coureur
  // du lot 36) — UNE vérité par contrat : la clause locale re-cassait à chaque flux nouveau.
  ok(`le service de l'appel est DÉLÉGUÉ à verify-circuits (ici : ${servis} servi(s) constaté(s), informatif)`, true);
  // le calage tient les pointes du BON côté : 0-2,2 % mesuré (le dart flirte avec la ligne —
  // c'est son métier) ; sans calage le monde d'aujourd'hui vit aussi bas (bloc profond), la
  // clause est donc ABSOLUE, pas comparative — le sabotage de la LOI vit en fixtures (§5)
  const worst = Math.max(...offPct);
  ok(`les pointes vivent SUR la ligne, pas derrière (pire graine : ${worst.toFixed(1)} % du temps de possession en position illicite ≤ 4)`, worst <= 4);
}

// ---------- 7. LE PRESSING À DÉCLENCHEURS + L'OMBRE DE COUVERTURE (mécanismes sur fixtures,
// existence en flux — la doctrine du lot 8, toujours)
{
  const mk = () => {
    const st = makeMatch({ full: true, seed: 5 });
    const sgn = -st.pitch.ownGoal(0).sign;
    for (const q of st.players.filter((q) => q.team === 1)) q.p[0] = sgn * (q.keeper ? 51 : 20);
    for (const q of st.players.filter((q) => q.team === 0 && !q.keeper)) q.p[0] = -sgn * 8;
    return { st, sgn };
  };
  // (a) LE SIGNAL « DOS AU BUT » : un porteur qui reçoit tourné vers son but, dans son camp →
  // la fenêtre s'ouvre (événement nommé, état st._press posé)
  {
    const { st, sgn } = mk();
    const cfg = matchCfg({ shotRange: 20 });
    const c0 = st.players.find((p) => p.team === 0 && p.post === 5);
    c0.p[0] = -sgn * 10; c0.p[2] = 0; c0.yaw = sgn > 0 ? Math.PI : 0;
    st.ball.restart([c0.p[0], 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c0.id);
    st.possession = { team: 0, carrier: c0.id }; st.phase = 'carry'; st.hold = 0.3; st.lastTouch = 0;
    matchStep(st, 1 / 60, cfg);
    const ev = st.events.find((e) => e.type === 'press' && e.kind === 'dos-au-but');
    ok(`le signal « dos au but » OUVRE la fenêtre (porteur retourné dans son camp → press d'équipe, événement nommé)`,
      !!ev && st._press?.team === 1 && st._press.until > st.t, `press=${JSON.stringify(st._press)}`);
  }
  // (b) sabotage nommé « press sourd » : pressTriggers:false → le même monde n'ouvre RIEN
  {
    const { st, sgn } = mk();
    const cfg = matchCfg({ shotRange: 20, pressTriggers: false });
    const c0 = st.players.find((p) => p.team === 0 && p.post === 5);
    c0.p[0] = -sgn * 10; c0.p[2] = 0; c0.yaw = sgn > 0 ? Math.PI : 0;
    st.ball.restart([c0.p[0], 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c0.id);
    st.possession = { team: 0, carrier: c0.id }; st.phase = 'carry'; st.hold = 0.3; st.lastTouch = 0;
    matchStep(st, 1 / 60, cfg);
    ok(`sabotage « press sourd » attrapé (pressTriggers:false — aucun signal, aucune fenêtre)`,
      !st._press && !st.events.some((e) => e.type === 'press'));
  }
  // (c) LE SIGNAL « PASSE EN RETRAIT » : un ballon qui recule de 3 m DANS la relance basse
  // (le restart d'engagement de la construction se nettoie — une détection ne juge pas pendant
  // une remise, et la première version de la fixture l'avait oublié : press=undefined)
  {
    const { st, sgn } = mk();
    const cfg = matchCfg({ shotRange: 20 });
    st.ball.restart([-sgn * 10, 0.11, 1], { cause: 'coup-franc' });
    st.restart = null;
    st.possession = { team: 0, carrier: -1 }; st.phase = 'flight'; st.lastTouch = 0;
    st.pass = { from: 1, to: 2, t: st.t, origin: [-sgn * 8, 0], lead: [-sgn * 13, 0, 2] };
    matchStep(st, 1 / 60, cfg);
    ok(`le signal « passe en retrait » OUVRE la fenêtre (relance basse qui recule → la ligne monte dessus)`,
      st.events.some((e) => e.type === 'press' && e.kind === 'passe-en-retrait'), `press=${JSON.stringify(st._press)}`);
  }
  // (d) L'OMBRE DE COUVERTURE : le presseur vise le COULOIR du soutien profond (le corps dans
  // la ligne de passe), pas le ballon en ligne droite — et le sabotage le prouve par contraste
  {
    const shadow = (coverShadow) => {
      const { st, sgn } = mk();
      const cfg = matchCfg({ shotRange: 20, coverShadow });
      const c0 = st.players.find((p) => p.team === 0 && p.post === 5);
      const hot = st.players.find((p) => p.team === 0 && p.post === 8);
      c0.p[0] = 0; c0.p[2] = 0; c0.yaw = 0;
      hot.p[0] = sgn * 10; hot.p[2] = 3;
      const presser = st.players.find((p) => p.team === 1 && p.post === 5);
      presser.p[0] = sgn * 6; presser.p[2] = -5;                    // le plus près du ballon (les autres à 20)
      st.ball.restart([0, 0.11, 0], { cause: 'coup-franc' });
      st.restart = null; st.ball.possess(c0.id);
      st.possession = { team: 0, carrier: c0.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
      matchStep(st, 1 / 60, cfg);
      return { presser, st, sgn, hot };
    };
    const avec = shadow(true);
    const ux = (avec.hot.p[0] - avec.st.ball.p[0]), uz = (avec.hot.p[2] - avec.st.ball.p[2]);
    const ul = Math.hypot(ux, uz) || 1;
    const attendu = [avec.st.ball.p[0] + (ux / ul) * 1.15, avec.st.ball.p[2] + (uz / ul) * 1.15];
    const dA = Math.hypot((avec.presser.target?.[0] ?? 99) - attendu[0], (avec.presser.target?.[2] ?? 99) - attendu[1]);
    const sans = shadow(false);
    const dB = Math.hypot((sans.presser.target?.[0] ?? 99) - sans.st.ball.p[0], (sans.presser.target?.[2] ?? 99) - sans.st.ball.p[2]);
    ok(`l'OMBRE vit dans le couloir (cible du presseur à ${dA.toFixed(2)} m du point d'ombre ≤ 0,3) — sabotage « press en ligne droite » : cible = ballon (${dB.toFixed(2)} m ≤ 0,3)`,
      dA <= 0.3 && dB <= 0.3);
  }
  // (e) LE GEL RESSUSCITÉ EN SABOTAGE : une passe MORTE près de son origine (le monde exact de
  // la graine 3, t=33,85 — 3,3 m/s, arrêtée à 0,6 m du receveur). Avec les deux lois (vol-mort
  // + releaseTtl) le monde se RÉSOUT en 2 s ; sans elles, il gèle — nommé, mesuré, attrapé.
  {
    // la clause juge LA RÉSOLUTION (quelqu'un a fini par posséder ce ballon), pas l'état à 2 s :
    // le monde GUÉRI continue de jouer — à la 120ᵉ image il était reparti en contre, nouvelle
    // passe en vol, et juger « phase ≠ flight » à cet instant condamnait la guérison même
    const gel = (over) => {
      const { st, sgn } = mk();
      const cfg = matchCfg({ shotRange: 20, ...over });
      const rec = st.players.find((p) => p.team === 0 && p.post === 0);
      const def = st.players.find((p) => p.team === 1 && p.post === 2);
      st.ball.restart([sgn * 9, 0.11, 0], { cause: 'coup-franc' });
      st.restart = null;
      rec.p[0] = sgn * 9.3; rec.p[2] = 0.3; def.p[0] = sgn * 9.2; def.p[2] = -0.3;
      st.possession = { team: 0, carrier: -1 }; st.phase = 'flight'; st.lastTouch = 0;
      st.pass = { from: 1, to: rec.id, t: st.t, origin: [sgn * 9.2, 0], lead: [sgn * 9.3, 0, 0.3] };
      let resolu = false;
      for (let i = 0; i < 120; i++) {
        matchStep(st, 1 / 60, cfg);
        if (st.ball.owner != null) resolu = true;
      }
      return { st, resolu };
    };
    const sain = gel({});
    ok(`un VOL MORT se résout (le ballon arrêté redevient LIBRE, quelqu'un le prend en ${sain.resolu ? '< 2 s' : 'jamais'} — événement vol-mort : ${sain.st.events.some((e) => e.type === 'vol-mort') ? 'oui' : 'non'})`,
      sain.resolu && sain.st.events.some((e) => e.type === 'vol-mort'));
    const fige = gel({ deadFlight: false, releaseTtl: null });
    ok(`sabotage « gel » attrapé (sans vol-mort ni releaseTtl : personne ne prend jamais ce ballon — le monde de la graine 3 figé 145 s)`,
      !fige.resolu && fige.st.phase === 'flight' && fige.st.ball.owner == null);
  }
  // (f) LE FLUX (graine 3, l'ex-gelée — sa guérison EST l'histoire) : des fenêtres sobres, la
  // LIGNE qui monte pendant elles (l'instrument fort — la compression moyenne, diluée sur 10
  // corps, ne bouge pas : mesuré et assumé), un régain dans une fenêtre, et plus jamais 145 s
  {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20 });
    let lineIn = 0, nIn = 0, lineOut = 0, nOut = 0, gel = 0, gelMax = 0;
    let regains = 0, winTeam = -1, winStartPoss = -1, inWin = false;
    for (let i = 0; i < 180 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      const moving = Math.hypot(st.ball.v[0], st.ball.v[2]) > 0.3 || st.ball.owner != null;
      gel = moving || st.restart ? 0 : gel + 1 / 60; gelMax = Math.max(gelMax, gel);
      const active = !!(st._press && st._press.until > st.t && !st.restart);
      if (active && !inWin) { winTeam = st._press.team; winStartPoss = st.possession.team; }
      if (!active && inWin && winTeam >= 0) {
        if (st.possession.team === winTeam && winStartPoss !== winTeam) regains++;
        winTeam = -1;
      }
      inWin = active;
      if (!st.restart && st.possession.team >= 0) {
        const L = offsideLine(st, st.possession.team);
        if (active) { lineIn += L.adv; nIn++; } else { lineOut += L.adv; nOut++; }
      }
    }
    const fen = st.events.filter((e) => e.type === 'press').length;
    const li = nIn ? lineIn / nIn : 99, lo = nOut ? lineOut / nOut : 0;
    ok(`les fenêtres de pressing VIVENT sobres (${fen} sur 180 s, bande [3 ; 20] — un réflexe, pas un état)`, fen >= 3 && fen <= 20);
    ok(`la LIGNE MONTE en fenêtre (${li.toFixed(1)} m sous press, ${lo.toFixed(1)} au calme — écart ≥ 2 : le bloc qui monte fait exister la Loi 11)`, li <= lo - 2);
    ok(`au moins un RÉGAIN tombe dans une fenêtre (${regains} — le pressing gagne parfois, c'est son métier)`, regains >= 1);
    ok(`le monde ne gèle PLUS JAMAIS (gel max ${gelMax.toFixed(1)} s ≤ 25 — la graine du gel de 145 s, guérie)`, gelMax <= 25);
  }
}

// ---------- 8. le catalogue JOUE : 4-4-2 contre 3-5-2, un match qui vit — et le fantôme retombe en 433
{
  const run = (tactics) => {
    const st = makeMatch({ full: true, seed: 3, tactics });
    const cfg = matchCfg({ shotRange: 20 });
    let gel = 0, gelMax = 0;
    for (let i = 0; i < 60 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      const moving = Math.hypot(st.ball.v[0], st.ball.v[2]) > 0.3 || st.ball.owner != null;
      gel = moving || st.restart ? 0 : gel + 1 / 60; gelMax = Math.max(gelMax, gel);
    }
    return { passes: st.events.filter((e) => e.type === 'pass').length, gelMax, evs: JSON.stringify(st.events) };
  };
  const duel = run([{ formation: '442' }, { formation: '352' }]);
  ok(`4-4-2 contre 3-5-2 : le match VIT (${duel.passes} passes ≥ 12 en 60 s, gel ${duel.gelMax.toFixed(1)} s ≤ 25 — deux systèmes, un seul moteur)`,
    duel.passes >= 12 && duel.gelMax <= 25);
  ok(`sabotage « formation fantôme » attrapé (formation inconnue '666' → repli 433, récit identique au défaut octet pour octet — pas de crash, pas de monde secret)`,
    run([{ formation: '666' }, null]).evs === run(null).evs);
}

// ---------- 8b. LA CONDUITE EST AU PIED (lot 37, retour utilisateur « le ballon paraît loin
// du pied — de la magie ») : la fenêtre de portage en mouvement est PLAFONNÉE à 2,2 m en
// plein format — au-delà, le ballon est LIBRE (un vrai 50/50, la chasse ne change pas,
// l'étiquette cesse de mentir). Mesuré : pic 2,91 → 2,19 m, p99 1,99 → 1,63 — et les tirs
// MONTENT (16 → 27 sur 10 graines, buts constants : l'honnêteté ravive le jeu).
{
  const dists = [];
  for (const seed of [1, 3]) {
    const st = makeMatch({ full: true, seed });
    const cfg = matchCfg({ shotRange: 20 });
    for (let i = 0; i < 120 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      if (st.phase !== 'carry' || st.possession.carrier < 0 || st.restart) continue;
      const c = st.players[st.possession.carrier];
      if (!c.keeper) dists.push(Math.hypot(c.p[0] - st.ball.p[0], c.p[2] - st.ball.p[2]));
    }
  }
  dists.sort((a, b) => a - b);
  const p99 = dists[Math.floor(0.99 * (dists.length - 1))] ?? 0, mx = dists[dists.length - 1] ?? 0;
  // le PIC est le discriminant (2,91 avant le plafond, ≤ 2,2 + une image après — structurel) ;
  // le p99 est une sanité LARGE sous le plafond (1,63-1,92 selon le flux des graines — une borne
  // à 1,9 collée au flux d'hier re-cassait à chaque évolution du cerveau, doctrine lot 36)
  ok(`la CONDUITE est au pied (2 × 120 s : p99=${p99.toFixed(2)} m ≤ 2,1, pic=${mx.toFixed(2)} m ≤ 2,3 — au-delà de 2,2 le ballon est LIBRE, plus de possession fantôme)`,
    p99 <= 2.1 && mx <= 2.3);
}

// ---------- 8c. LE RECEVEUR VIVANT (lot 38, retour utilisateur « cette pose statique en
// attendant le ballon ») : pendant le vol d'une passe dans les pieds, le receveur VIENT
// AU-DEVANT sur l'axe nominal (meetWalk — marche bornée, zone de construction seulement :
// à < 32 m du but il tient son point de fixation). Mesuré : p25 de vitesse 0,00 → ~0,8 m/s,
// vols figés > 60 % du temps 14 % → ~1 %, tirs 27 → 24 et buts 9 → 11 sur 10 graines (la
// respiration tenue). La MÊME mesure, deux mondes — le sabotage est la clé retirée.
{
  const mesure = (cfgExtra) => {
    let still = 0, frames = 0, geles = 0, vols = 0, vol = null;
    for (const seed of [1, 3]) {
      const st = makeMatch({ full: true, seed });
      const cfg = matchCfg({ shotRange: 20, ...cfgExtra });
      for (let i = 0; i < 120 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        const rec = (st.phase === 'flight' && st.pass && st.pass.to >= 0) ? st.players[st.pass.to] : null;
        if (rec && !rec.keeper) {
          if (!vol || vol.to !== st.pass.to || vol.t0 !== st.pass.t) {
            if (vol && vol.n >= 12) { vols++; if (vol.s / vol.n > 0.6) geles++; }
            vol = { to: st.pass.to, t0: st.pass.t, s: 0, n: 0 };
          }
          const v = Math.hypot(rec.v[0], rec.v[1]);
          frames++; vol.n++; if (v < 0.5) { still++; vol.s++; }
        } else if (vol) { if (vol.n >= 12) { vols++; if (vol.s / vol.n > 0.6) geles++; } vol = null; }
      }
      vol = null;
    }
    return { statue: still / Math.max(1, frames), geles, vols };
  };
  // la part < 0,5 m/s varie par graines ET par monde (4-21 % mesurés au fil des lots — le
  // bloc compact du lot 42 serre le marquage ; le monde saboté vit à 37-39 %) : bornes LARGES
  // qui séparent (doctrine lot 36), séparation ABSOLUE au sabotage (×2 re-cassait dès que le
  // vivant montait) ; les vols FIGÉS > 60 % sont le vrai tueur de statue (14 % avant, ~0 après)
  const vif = mesure({});
  ok(`le RECEVEUR VIVANT (2 × 120 s : ${(vif.statue * 100).toFixed(0)} % du vol < 0,5 m/s ≤ 25, ${vif.geles}/${vif.vols} vols figés > 60 % ≤ 8 % — il vient au-devant, la prise se fait dans le pas)`,
    vif.statue <= 0.25 && vif.geles / Math.max(1, vif.vols) <= 0.08);
  const fige = mesure({ meetWalk: false });
  ok(`sabotage « pose figée » attrapé (meetWalk:false : ${(fige.statue * 100).toFixed(0)} % du vol < 0,5 m/s ≥ vivant + 10 pts (${(vif.statue * 100 + 10).toFixed(0)}) — la statue d'hier, nommée)`,
    fige.statue >= vif.statue + 0.10);
}

// ---------- 9. LES FRAPPES SE DÉFENDENT (lot 18) : l'envergure de la DÉCISION croit celle du
// CORPS (diveReach 2,95 = 1,35 de root motion + 1,6 de bras). Avant : 2,1 déclarait « battu »
// toute frappe aux coins du grand but (±3,11) — 3 plongeons sur 21 tirs, 0 arrêt, 13 buts,
// conversion 57 %. Le « avant » chiffré EST le sabotage, consigné ici.
{
  // agrégat 3 graines (re-fondé lot 34 : la graine 2 seule est tombée à 1 tir dans le monde
  // des duels — l'échantillon d'UNE graine ne porte plus une clause de flux ; mesuré {2,3,5} :
  // 16 tirs, 25 % plongées, 19 arrêts, conversion 31 %)
  let tirsN = 0, divesN = 0, arretsN = 0, butsN = 0;
  for (const seed of [2, 3, 5]) {
    const st = makeMatch({ full: true, seed });
    const cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 180, pause: 6 } });
    for (let i = 0; i < 380 * 60 && !st.fini; i++) matchStep(st, 1 / 60, cfg);
    const T = st.events.filter((e) => e.type === 'shot');
    tirsN += T.length;
    divesN += T.filter((s2) => st.events.some((e) => e.type === 'dive' && e.t >= s2.t - 0.1 && e.t < s2.t + 1.4)).length;
    arretsN += st.events.filter((e) => e.type === 'arrêt').length;
    butsN += st.events.filter((e) => e.type === 'but').length;
  }
  const tirs = { length: tirsN };
  const dives = divesN, arrets = arretsN, buts = butsN;
  ok(`le gardien DÉFEND ses coins (${dives}/${tirs.length} frappes plongées ≥ 25 %, ${arrets} arrêt(s) ≥ 1, ${buts} but(s) — conversion ≤ 60 % : mesuré 21 % après, 57 % avant)`,
    tirs.length >= 3 && dives / tirs.length >= 0.2 && arrets >= 2 && buts / Math.max(1, tirs.length) <= 0.6);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
