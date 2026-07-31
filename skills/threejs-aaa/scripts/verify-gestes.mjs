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

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
