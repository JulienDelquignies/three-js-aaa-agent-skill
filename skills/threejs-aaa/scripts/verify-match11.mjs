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
import { formationSpots, checkFormation } from '../assets/starter/src/engine/formation.js';
import { makeMatch, matchCfg, matchStep, checkMatch, playMatch } from '../assets/starter/src/engine/match-sim.js';
import { checkOffside, offsideLine } from '../assets/starter/src/engine/offside.js';
import { simInternals } from '../assets/starter/src/engine/rondo-sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- 1. la formation est une donnée saine
{
  const pitch = makePitch(FULL);
  for (const team of [0, 1]) {
    const c = checkFormation(pitch, team);
    ok(`la formation 4-3-3 de l'équipe ${team} est SAINE (postes dans le terrain, lignes ordonnées, largeur, bloc qui coulisse)`, c.ok, c.issues.join(' ; '));
  }
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
  const { st: s2, trace } = playMatch(st2, 90, { cfg: matchCfg({ shotRange: 20 }) });
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
      const spots = formationSpots(st.pitch, team, st.ball.p[0], atk);
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
  for (const seed of [1, 3, 4]) {
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
  ok(`les appels profonds VIVENT sans essaim (${appels} sur 3 graines × 180 s, bande [3 ; 36])`, appels >= 3 && appels <= 36);
  // suivi : 3 servis mesurés sur 9 appels (27 % — un appel réel n'est pas toujours servi non
  // plus) ; l'existence est la clause, le taux est une dette de réglage nommée
  ok(`au moins un appel est SERVI (${servis} passes vers le coureur dans sa fenêtre — le mouvement nourrit le ballon)`, servis >= 1);
  // le calage tient les pointes du BON côté : 0-2,2 % mesuré (le dart flirte avec la ligne —
  // c'est son métier) ; sans calage le monde d'aujourd'hui vit aussi bas (bloc profond), la
  // clause est donc ABSOLUE, pas comparative — le sabotage de la LOI vit en fixtures (§5)
  const worst = Math.max(...offPct);
  ok(`les pointes vivent SUR la ligne, pas derrière (pire graine : ${worst.toFixed(1)} % du temps de possession en position illicite ≤ 4)`, worst <= 4);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
