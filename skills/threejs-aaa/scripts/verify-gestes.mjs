#!/usr/bin/env node
// verify-gestes.mjs — les GESTES TECHNIQUES (râteau, feinte de passe, arrêt semelle), prouvés sans
// navigateur. La demande utilisateur qui fonde le banc : « tu peux ajouter des gestes techniques ?
// des râteaux pour se retourner, des feintes de passes etc ? le ballon sous la semelle etc —
// tout ce qui fait le foot ».
//
// Quatre moitiés :
//   1. LE VOCABULAIRE : les techniques sont dans la table (checkAction peut rejuger), les clips
//      déclarent leur contact, et la feinte RESSEMBLE à la passe (un armé qui ne ressemble pas ne
//      trompe personne — c'est une clause, pas un espoir) ;
//   2. LA SITUATION : chaque geste exécuté en partie est SITUÉ — râteau sous presseur frontal,
//      semelle en champ libre — et ses mesures de sortie tiennent (retournement ≥ 120°, couple
//      soudé ≤ 0,9 m, ballon garé ≤ 0,5 m/s) ;
//   3. LES LOIS : la morsure d'une feinte ralentit VRAIMENT le mordu (un coureur, deux états,
//      rapport des vitesses = biteSlow — même instrument que la loi du paceBias) ;
//   4. LES SABOTAGES : sans presseur → refus, sortie bouchée → refus NOMMÉ, sous conteste → refus,
//      spam → cooldown.
import { MOVES, resolveTracks } from '../assets/starter/src/engine/animkit.js';
import { byId } from '../assets/starter/src/engine/technique.js';
import { makeRondo, RONDO, rondoInternals } from '../assets/starter/src/engine/rondo.js';
import { playRondo, skillInternals } from '../assets/starter/src/engine/rondo-sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- 1. le vocabulaire
{
  for (const id of ['rateau', 'feinte-passe', 'arret-semelle']) {
    const t = byId[id];
    ok(`« ${id} » est dans la table (intent carry, clip ${t?.clip})`, !!t && t.intent === 'carry' && !!MOVES[t.clip]);
  }
  for (const clip of ['rateau', 'feintePasse', 'arretSemelle']) {
    const m = MOVES[clip];
    const near = m.keys.reduce((b, k) => (Math.abs(k.t - m.contact) < Math.abs(b.t - m.contact) ? k : b), m.keys[0]);
    ok(`« ${clip} » déclare son contact sur une clé posée (${m.contact} s)`,
      typeof m.contact === 'number' && Math.abs(near.t - m.contact) < 1e-6 && Object.keys(near.pose).length > 0);
  }
  // LA FEINTE RESSEMBLE À LA PASSE : même clé de backswing (jambe de frappe à ≤ 12° près). C'est la
  // clause de la tromperie — si l'armé diverge, le défenseur (et l'œil) ne peuvent pas mordre.
  const bp = MOVES.passe.keys[1].pose, bf = MOVES.feintePasse.keys[1].pose;
  const dLeg = Math.max(
    Math.abs(bp.RightUpLeg[0] - bf.RightUpLeg[0]),
    Math.abs(bp.RightLeg[0] - bf.RightLeg[0]),
  );
  ok(`la feinte RESSEMBLE à la passe (backswing jambe à ${dLeg.toFixed(0)}° ≤ 12)`, dLeg <= 12);
  // …et au « contact », elle SE RETIENT : la cuisse de la passe traverse à 46°, la feinte s'arrête
  // sous 15° — l'anti-overshoot est la signature mécanique du geste retenu.
  const cP = MOVES.passe.keys.find((k) => Math.abs(k.t - MOVES.passe.contact) < 1e-6).pose.RightUpLeg[0];
  const cF = MOVES.feintePasse.keys.find((k) => Math.abs(k.t - MOVES.feintePasse.contact) < 1e-6).pose.RightUpLeg[0];
  ok(`…mais SE RETIENT au contact (cuisse passe ${cP}° vs feinte ${cF}° ≤ 15)`, cP >= 40 && cF <= 15);
  // la semelle est le clip de l'immobilité qui REGARDE : pendant la tenue, la tête se LÈVE
  const hold = MOVES.arretSemelle.keys[2].pose;
  ok(`la semelle lève la tête pendant la tenue (Head x ${hold.Head[0]}° ≤ 0 — le regard au jeu)`, hold.Head[0] <= 0);
  ok('les trois clips résolvent (resolveTracks)', ['rateau', 'feintePasse', 'arretSemelle'].every((c) => Object.keys(resolveTracks(MOVES[c]).tracks).length > 10));
}

// ---------- 2. la situation, en partie jouée
{
  const evAll = [], endAll = [], denyAll = {};
  for (const seed of [7, 3]) {
    const { st } = playRondo(makeRondo({ perTeam: 5, seed }), 120);
    evAll.push(...st.events.map((e) => ({ ...e, _seed: seed })));
    for (const [k, v] of Object.entries(st.deny ?? {})) denyAll[k] = (denyAll[k] ?? 0) + v;
  }
  const sk = evAll.filter((e) => e.type === 'skill');
  const ends = evAll.filter((e) => e.type === 'skill-end');
  const rat = sk.filter((e) => e.kind === 'rateau');
  const fei = sk.filter((e) => e.kind === 'feinte');
  const sem = sk.filter((e) => e.kind === 'semelle');
  ok(`les trois gestes EXISTENT en partie (${rat.length} râteaux, ${fei.length} feintes, ${sem.length} semelles sur 2×120 s)`,
    rat.length >= 2 && fei.length >= 6 && sem.length >= 1);

  // le râteau est SITUÉ : presseur frontal proche — l'événement porte sa géométrie, on la juge
  ok(`chaque râteau a son presseur frontal (foe ≤ ${RONDO.skill.rateauFoe} m, relèvement ≤ ${RONDO.skill.rateauFront}°)`,
    rat.every((e) => e.foe <= RONDO.skill.rateauFoe + 0.01 && e.bearing <= RONDO.skill.rateauFront + 0.5),
    rat.map((e) => `${e.foe}m/${e.bearing}°`).join(' '));
  const ratEnds = ends.filter((e) => e.kind === 'rateau');
  ok(`le râteau SE RETOURNE (${ratEnds.map((e) => e.turned + '°').join(' ')} — tous ≥ 120°)`,
    ratEnds.length >= 1 && ratEnds.every((e) => e.turned >= 120));
  ok(`…et le couple reste SOUDÉ pendant le raclage (ballon ≤ 0,9 m du corps, pire ${Math.max(...ratEnds.map((e) => e.ballMax)).toFixed(2)} m)`,
    ratEnds.every((e) => e.ballMax <= 0.9));

  // la feinte MORD : une part réelle des feintes assoit au moins un défenseur
  const withBite = fei.filter((e) => (e.bitten ?? []).length > 0).length;
  ok(`la feinte MORD (${withBite}/${fei.length} feintes assoient ≥ 1 défenseur, ≥ 40 %)`, withBite / Math.max(1, fei.length) >= 0.4);
  // …et la VRAIE passe suit pendant que le mordu est assis (fenêtre morsure 0,55 s après contact)
  const feiEnds = ends.filter((e) => e.kind === 'feinte');
  let followed = 0;
  for (const fe of feiEnds) {
    if (evAll.some((e) => e.type === 'windup' && !e.skill && e.by === fe.by && e._seed === fe._seed
      && e.t >= fe.t && e.t - fe.t < 1.0)) followed++;
  }
  ok(`la feinte PRÉCÈDE une vraie passe (${followed}/${feiEnds.length} suivies d'un armé ≤ 1 s, ≥ 45 %)`,
    followed / Math.max(1, feiEnds.length) >= 0.45);

  // la semelle est un geste de CHAMP LIBRE et le ballon est GARÉ (ou la tenue casse, nommée)
  ok(`chaque semelle part en champ libre (foe ≥ ${RONDO.skill.semelleFoe} m)`,
    sem.every((e) => e.foe >= RONDO.skill.semelleFoe - 0.01), sem.map((e) => e.foe + 'm').join(' '));
  const semEnds = ends.filter((e) => e.kind === 'semelle');
  ok(`le ballon sous la semelle est GARÉ (maxV ≤ 0,5 m/s) ou la tenue casse NOMMÉE (${semEnds.map((e) => e.broke ? 'cassée' : e.maxV + 'm/s').join(' ')})`,
    semEnds.every((e) => e.broke === 'pressé' || e.maxV <= 0.5));

  // les cooldowns tiennent : jamais deux râteaux du même joueur à moins de rateauCd − ε
  let cdOk = true;
  for (const kind of ['rateau', 'feinte', 'semelle']) {
    const cd = { rateau: RONDO.skill.rateauCd, feinte: RONDO.skill.feinteCd, semelle: RONDO.skill.semelleCd }[kind];
    const byP = new Map();
    for (const e of sk.filter((x) => x.kind === kind)) {
      const k = `${e._seed}:${e.by}`;
      if (byP.has(k) && e.t - byP.get(k) < cd - 0.05) cdOk = false;
      byP.set(k, e.t);
    }
  }
  ok('les cooldowns tiennent (jamais deux gestes du même joueur sous le délai)', cdOk);
  // les refus de situation se NOMMENT — le registre a des entrées, pas un silence
  ok(`les refus sont NOMMÉS au registre (rateau-sans-issue : ${denyAll['rateau-sans-issue'] ?? 0})`,
    (denyAll['rateau-sans-issue'] ?? 0) >= 1);
}

// ---------- 3. la morsure est une LOI (même instrument que la loi du paceBias)
{
  const { movePlayers } = rondoInternals;
  const steady = (bitUntil) => {
    const r = { id: 0, team: 0, p: [0, 0, 0], v: [0, 0], speed: 0, yaw: 0, down: 0, act: null, job: 'press', target: null, push: null, yawWant: null, _bite: bitUntil };
    const st = { players: [r], area: [200, 200], t: 0, ball: { p: [50, 0.11, 50], v: [0, 0, 0] }, events: [], rnd: () => 0.5 };
    for (let i = 0; i < 3 * 60; i++) { r.target = [100, 0, 0]; movePlayers(st, 1 / 60, RONDO); st.t += 1 / 60; }
    return r.speed;
  };
  const libre = steady(-1), mordu = steady(1e9);
  const ratio = mordu / libre;
  ok(`un mordu court à ${(100 * ratio).toFixed(0)} % du libre (loi : biteSlow = ${(100 * RONDO.skill.biteSlow).toFixed(0)} %, ±3 pts)`,
    Math.abs(ratio - RONDO.skill.biteSlow) < 0.03, `libre ${libre.toFixed(2)} m/s, mordu ${mordu.toFixed(2)} m/s`);
}

// ---------- 4. les sabotages
{
  const { maybeRateau, maybeFeinte } = skillInternals;
  const mk = (over = {}) => ({
    id: 0, team: 0, p: [0, 0, 0], v: [0, 0], speed: 0, yaw: 0, down: 0, act: null,
    job: 'carry', target: null, push: null, yawWant: null, persona: { flair: 1, calm: 1 }, ...over,
  });
  const world = (players) => ({
    players, area: [34, 26], t: 10, phase: 'carry', possession: { carrier: 0, team: 0 },
    ball: { p: [0.35, 0.11, 0], v: [0, 0, 0], owner: 0, possess() {}, carry() {}, release() {}, escort() {} },
    events: [], gestures: [], rnd: () => 0, deny: {},
  });
  // râteau SANS presseur : refusé sans événement (pas de retournement gratuit)
  {
    const c = mk();
    const st = world([c]);
    ok('sabotage « râteau sans presseur » refusé', maybeRateau(st, c, RONDO) === false && !c.act && st.events.length === 0);
  }
  // râteau SANS ISSUE : un adversaire garé derrière — refus NOMMÉ au registre
  {
    const c = mk();
    const foe = mk({ id: 1, team: 1, p: [1.2, 0, 0], v: [-2.5, 0] });          // frontal, il ferme
    const behind = mk({ id: 2, team: 1, p: [-1.2, 0, 0] });                    // la sortie est bouchée
    const st = world([c, foe, behind]);
    const r = maybeRateau(st, c, RONDO);
    ok('sabotage « râteau sans issue » refusé ET NOMMÉ', r === false && (st.deny['rateau-sans-issue'] ?? 0) >= 1 && !c.act);
  }
  // …et la MÊME situation avec la sortie libre S'EXÉCUTE (le refus mesurait la sortie, pas un hasard)
  {
    const c = mk();
    const foe = mk({ id: 1, team: 1, p: [1.2, 0, 0], v: [-2.5, 0] });
    const st = world([c, foe]);
    const r = maybeRateau(st, c, RONDO);
    ok('…la même situation avec sortie libre S\'EXÉCUTE', r === true && !!c.act && c.act.payload.skill === 'rateau');
  }
  // spam : le cooldown refuse le second râteau immédiat
  {
    const c = mk({ _skillCd: { rateau: 999 } });
    const foe = mk({ id: 1, team: 1, p: [1.2, 0, 0], v: [-2.5, 0] });
    const st = world([c, foe]);
    ok('sabotage « spam de râteaux » refusé (cooldown)', maybeRateau(st, c, RONDO) === false && !c.act);
  }
  // feinte SOUS CONTESTE : refusée (se figer 0,4 s avec un homme sur le ballon = offrir le tacle)
  {
    const c = mk({ intent: { choice: { to: { id: 1 } } } });
    const mate = mk({ id: 1, team: 0, p: [5, 0, 0] });
    const foe = mk({ id: 2, team: 1, p: [0.5, 0, 0.2], v: [0, 0] });           // SUR le ballon
    const st = world([c, mate, foe]);
    ok('sabotage « feinte sous conteste » refusé', maybeFeinte(st, c, RONDO, true) === false && !c.act);
  }
}

// ---------- 5. LE RÉPERTOIRE ÉLARGI (la demande utilisateur, deuxième vague : « passement de
// jambes, crochet, feinte de frappe — à la perfection, sans erreur de placement de membres »).
// Les clés de ces gestes n'existent qu'au MATCH (MATCH.skill) : le rondo est INERTE par
// construction — c'est une clause, pas une promesse. Les déclenchements se prouvent sur
// FIXTURES (la leçon des sabotages de flux), le placement de membres à l'audit composé.
{
  const { MATCH, makeMatch, matchCfg, matchStep } = await import('../assets/starter/src/engine/match-sim.js');
  const { maybePassement, maybeCrochet, maybeFeinteFrappe } = skillInternals;
  const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const M = { ...RONDO, skill: MATCH.skill, shotRange: MATCH.shotRange };
  const mk = (over = {}) => ({
    id: 0, team: 0, p: [0, 0, 0], v: [0, 0], speed: 0, yaw: 0, down: 0, act: null,
    job: 'carry', target: null, push: null, yawWant: null, persona: { flair: 1, calm: 1 }, ...over,
  });
  const world = (players) => ({
    players, area: [46, 30], t: 10, phase: 'carry', possession: { carrier: 0, team: 0 }, hold: 1,
    ball: { p: [0.35, 0.11, 0], v: [0, 0, 0], owner: 0, possess() {}, carry() {}, release() {}, escort() {} },
    events: [], gestures: [], rnd: () => 0, deny: {},
  });
  // le vocabulaire : dans la table, clips déclarés
  for (const id of ['passement-jambes', 'crochet', 'feinte-frappe']) {
    const t = byId[id];
    ok(`« ${id} » est dans la table (intent carry, clip ${t?.clip})`, !!t && t.intent === 'carry' && !!MOVES[t.clip]);
  }
  // LA RESSEMBLANCE DE L'ARMÉ : la feinte de frappe copie la clé de backswing de `frappe`, os
  // pour os — un armé qui ne ressemble pas à la frappe ne fait asseoir personne
  {
    const armF = MOVES.frappe.keys[1].pose, armFF = MOVES.feinteFrappe.keys[1].pose;
    const same = Object.keys(armF).every((b) => JSON.stringify(armF[b]) === JSON.stringify(armFF[b]));
    ok('la feinte de frappe RESSEMBLE à la frappe (backswing identique os pour os)', same);
    // …et LA RETENUE est la signature : la cuisse meurt à ≤ 12° là où la frappe traverse à 62°
    const retenue = MOVES.feinteFrappe.keys[2].pose.RightUpLeg[0];
    ok(`…et se RETIENT au contact (cuisse ${retenue}° ≤ 12 — la frappe traverse à 62)`, retenue <= 12);
  }
  // LE PASSEMENT : jockey POSTÉ en face → armé ; charge → refus (le râteau possède la charge) ;
  // sorties bouchées → refus NOMMÉ
  {
    const c = mk({ speed: 0.5, v: [0.5, 0] });
    const foe = mk({ id: 1, team: 1, p: [1.6, 0, 0.2], v: [0, 0] });
    const st = world([c, foe]);
    const r = maybePassement(st, c, M);
    ok('le passement s\'arme sur le jockey posté (fixture)', r === true && c.act?.id === 'passementJambes'
      && st.events.some((e) => e.type === 'skill' && e.kind === 'passement'));
  }
  {
    const c = mk({ speed: 0.5, v: [0.5, 0] });
    const foe = mk({ id: 1, team: 1, p: [1.6, 0, 0.2], v: [-2.5, 0] });        // il CHARGE
    const st = world([c, foe]);
    ok('sabotage « passement sous la charge » refusé (c\'est l\'affaire du râteau)', maybePassement(st, c, M) === false && !c.act);
  }
  {
    const c = mk({ speed: 0.5, v: [0.5, 0] });
    const foe = mk({ id: 1, team: 1, p: [1.6, 0, 0.2], v: [0, 0] });
    const g1 = mk({ id: 2, team: 1, p: [c.p[0] + Math.cos(0.9) * 1.5, 0, c.p[2] + Math.sin(0.9) * 1.5], v: [0, 0] });
    const g2 = mk({ id: 3, team: 1, p: [c.p[0] + Math.cos(-0.9) * 1.5, 0, c.p[2] + Math.sin(-0.9) * 1.5], v: [0, 0] });
    const st = world([c, foe, g1, g2]);
    const r = maybePassement(st, c, M);
    ok('sabotage « passement sans issue » refusé ET NOMMÉ', r === false && (st.deny['passement-sans-issue'] ?? 0) >= 1);
  }
  // LE CROCHET : un défenseur qui FERME la course → la coupe part à l'opposé (60-95°) ; un
  // jockey statique → refus (c'est l'affaire du passement)
  {
    const c = mk({ speed: 3, v: [3, 0] });
    const foe = mk({ id: 1, team: 1, p: [1.5, 0, 0.4], v: [-2.2, 0] });
    const st = world([c, foe]);
    const r = maybeCrochet(st, c, M);
    const dYaw = c.act ? Math.abs(wrapA(c.act.payload.exitYaw - 0)) * 180 / Math.PI : 0;
    ok(`le crochet s'arme sur la course fermée et coupe à l'opposé (${dYaw.toFixed(0)}° ∈ [60 ; 95])`,
      r === true && c.act?.id === 'crochet' && dYaw >= 60 && dYaw <= 95);
  }
  {
    const c = mk({ speed: 3, v: [3, 0] });
    const foe = mk({ id: 1, team: 1, p: [1.5, 0, 0.4], v: [0, 0] });           // posté, il ne ferme pas
    const st = world([c, foe]);
    ok('sabotage « crochet sur jockey statique » refusé', maybeCrochet(st, c, M) === false && !c.act);
  }
  // LE COUPLE SOUDÉ DU CROCHET, en monde réel : le ballon suit l'ARC (≤ 0,95 m du corps) et le
  // lacet finit SUR la sortie — mesuré en jouant le geste dans un vrai match téléporté
  {
    const st = makeMatch({ perTeam: 5, seed: 3 });
    const cfg = matchCfg();
    for (let i = 0; i < 120; i++) matchStep(st, 1 / 60, cfg);
    const c = st.players.find((p) => !p.keeper && p.team === 0);
    const foe = st.players.find((p) => !p.keeper && p.team === 1);
    st.restart = null; st.phase = 'carry'; st.possession = { team: 0, carrier: c.id }; st.hold = 1;
    st.players.forEach((p) => { if (p !== c && p !== foe) p.p = [p.p[0], 0, -13]; p.down = 0; p.act = null; p._skillCd = {}; p.intent = null; });
    c.p = [0, 0, 5]; c.v = [3, 0]; c.speed = 3; c.yaw = 0; c.persona = { ...(c.persona ?? {}), flair: 1 };
    foe.p = [1.5, 0, 5.4]; foe.v = [-2.2, 0];
    if (st.ball.owner != null) st.ball.release('perte');
    st.ball.restart([0.4, 0.11, 5], { cause: 'engagement' });
    st.ball.possess(c.id);
    st.rnd = () => 0.01;
    const armed = skillInternals.maybeCrochet(st, c, cfg);
    let ballMax = 0, exitYaw = c.act?.payload?.exitYaw ?? 0;
    for (let i = 0; i < 45 && c.act; i++) {
      matchStep(st, 1 / 60, cfg);
      ballMax = Math.max(ballMax, Math.hypot(c.p[0] - st.ball.p[0], c.p[2] - st.ball.p[2]));
    }
    const dEnd = Math.abs(wrapA(c.yaw - exitYaw));
    ok(`le crochet garde le couple soudé (ballon ≤ ${ballMax.toFixed(2)} m ≤ 0,95) et sort SUR son lacet (écart ${(dEnd * 180 / Math.PI).toFixed(0)}°)`,
      armed === true && ballMax <= 0.95 && dEnd <= 0.25);
  }
  // LA FEINTE DE FRAPPE : à portée, un contreur dans le cône → armé ; sans contreur → refus ;
  // et la MORSURE est longue (0,7 s — on ne se jette pas devant une demi-frappe)
  {
    const st = makeMatch({ perTeam: 5, seed: 3 });
    const cfg = matchCfg();
    for (let i = 0; i < 120; i++) matchStep(st, 1 / 60, cfg);
    const c = st.players.find((p) => !p.keeper && p.team === 0);
    const foe = st.players.find((p) => !p.keeper && p.team === 1);
    st.restart = null; st.phase = 'carry'; st.possession = { team: 0, carrier: c.id }; st.hold = 1;
    st.players.forEach((p) => { if (p !== c && p !== foe) p.p = [p.p[0] < 0 ? p.p[0] : -8, 0, -13]; p.down = 0; p.act = null; p._skillCd = {}; p.intent = null; });
    const goal = st.pitch.attackGoal(c.team);
    c.p = [goal.x - Math.sign(goal.x) * 11, 0, 1]; c.v = [0, 0]; c.speed = 0; c.yaw = Math.atan2(-1, Math.sign(goal.x)); c.persona = { ...(c.persona ?? {}), flair: 1 };
    foe.p = [c.p[0] + Math.sign(goal.x) * 1.8, 0, 0.9]; foe.v = [0, 0]; foe._bite = -1;
    if (st.ball.owner != null) st.ball.release('perte');
    st.ball.restart([c.p[0] + Math.sign(goal.x) * 0.4, 0.11, c.p[2]], { cause: 'engagement' });
    st.ball.possess(c.id);
    st.rnd = () => 0.01;
    const armed = skillInternals.maybeFeinteFrappe(st, c, cfg, false);
    let bit = -1;
    for (let i = 0; i < 30 && c.act; i++) { matchStep(st, 1 / 60, cfg); if (foe._bite > 0 && bit < 0) bit = foe._bite - st.t; }
    ok(`la feinte de frappe s'arme sur le contreur et le fait ASSEOIR longtemps (morsure ${bit.toFixed(2)} s ≥ 0,45)`,
      armed === true && bit >= 0.45);
    // …et l'événement porte ses mordus
    ok('l\'événement « frappeFeinte » porte ses mordus', st.events.some((e) => e.kind === 'frappeFeinte' && (e.bitten ?? []).length >= 1));
  }
  // L'INERTIE DU RONDO est une clause : les MÊMES fixtures armées, jouées avec les clés du RONDO
  // (sans le répertoire du match) → refus AVANT tout tirage
  {
    const c = mk({ speed: 0.5, v: [0.5, 0] });
    const foe = mk({ id: 1, team: 1, p: [1.6, 0, 0.2], v: [0, 0] });
    const st = world([c, foe]);
    st.rnd = () => { throw new Error('le rondo ne tire JAMAIS pour un geste qu\'il ne connaît pas'); };
    const r1 = maybePassement(st, c, RONDO);
    const c2 = mk({ speed: 3, v: [3, 0] });
    const foe2 = mk({ id: 1, team: 1, p: [1.5, 0, 0.4], v: [-2.2, 0] });
    const st2 = world([c2, foe2]);
    st2.rnd = st.rnd;
    const r2 = maybeCrochet(st2, c2, RONDO);
    ok('le RONDO est inerte pour le répertoire du match (refus sans tirage — au bit près)', r1 === false && r2 === false);
  }
  // EN FLUX (8 graines × 120 s) : le répertoire vit dans le match. HUIT graines, pas quatre —
  // la feinte de frappe sort ~0,5 fois par graine (mesuré : 4 sur 8 graines, dont 0 sur les
  // 4 premières) : un échantillon de 4 est SOUS le plancher de bruit de re-distribution, la
  // clause virait au rouge à chaque loi nouvelle sans qu'aucun mécanisme ne soit mort (la
  // fixture, elle, le prouve à chaque run). La bande d'un flux se taille plus large que son bruit.
  {
    const kinds = {};
    for (const seed of [3, 7, 11, 1, 5, 9, 13, 2]) {
      const st = makeMatch({ perTeam: 5, seed });
      const cfg = matchCfg();
      for (let i = 0; i < 120 * 60; i++) matchStep(st, 1 / 60, cfg);
      for (const e of st.events.filter((x) => x.type === 'skill')) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
    }
    ok(`le répertoire élargi VIT en match (crochet ${kinds.crochet ?? 0} ≥ 3, passement ${kinds.passement ?? 0} ≥ 1, feinte de frappe ${kinds.frappeFeinte ?? 0} ≥ 1)`,
      (kinds.crochet ?? 0) >= 3 && (kinds.passement ?? 0) >= 1 && (kinds.frappeFeinte ?? 0) >= 1);
  }
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
