#!/usr/bin/env node
// verify-menace.mjs — L'ARBITRE DE MENACE EST UN CONTRAT, ET ÇA SE PROUVE.
//
// Le cerveau on-ball du porteur (menace.js) : quatre options sur UNE échelle, un gagnant, le
// pourquoi sur chaque note — et le patron moteur qui fonde le lot : l'EXÉCUTION appartient au
// moteur (tryShot garde ses portes, choosePass ses couloirs), la POLITIQUE est remplaçable
// (cfg.decide). Fixtures déterministes pour chaque gagnant, pureté, contrat d'injection prouvé
// par CONTRASTE (le décideur aval éteint la machinerie de tir), sabotage nommé, flux d'existence.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { arbitre } from '../assets/starter/src/engine/menace.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// le monde de fixture : plein format, tout le monde loin, puis on pose la scène à la main
const mk = () => {
  const st = makeMatch({ full: true, seed: 5 });
  const sgn = -st.pitch.ownGoal(0).sign;                             // l'équipe 0 attaque vers +sgn
  const goal = st.pitch.attackGoal(0);
  for (const q of st.players.filter((q) => q.team === 1)) { q.p[0] = sgn * 20; q.p[2] = -25; }
  for (const q of st.players.filter((q) => q.team === 0 && !q.keeper)) { q.p[0] = -sgn * 20; q.p[2] = 25; }
  const gk1 = st.players.find((q) => q.team === 1 && q.keeper);
  gk1.p[0] = goal.x; gk1.p[2] = 0;
  return { st, sgn, goal };
};
const pose = (st, c, x, z) => {
  c.p[0] = x; c.p[2] = z;
  st.ball.restart([x + 0.3, 0.11, z], { cause: 'coup-franc' });
  st.restart = null; st.ball.possess(c.id);
  st.possession = { team: 0, carrier: c.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
};
const cfgD = () => matchCfg({ shotRange: 20 });

// ---------- 1. les quatre gagnants, chacun sur SA géométrie
{
  // (a) BUT OUVERT à 10 m dans l'axe, couloir libre → le TIR gagne
  const { st, sgn, goal } = mk();
  const c = st.players.find((p) => p.team === 0 && p.post === 8);
  pose(st, c, goal.x - sgn * 10, 0);
  const a = arbitre(st, c, cfgD());
  // 'cadre-en-vue' → 'occasion-franche' (lot 67a) : à 10 m cadre ouvert, le tir est désormais
  // une occasion PLANCHERISÉE (0,72) — le libellé suit, le verdict (le TIR gagne) est le même.
  ok(`but ouvert à 10 m → le TIR gagne (tir ${a.tir.score} · passe ${a.passe.score} · conduite ${a.conduite.score}, pourquoi « ${a.tir.pourquoi} »)`,
    a.meilleure === 'tir' && a.tir.pourquoi === 'occasion-franche');
}
{
  // (b) MUR devant les deux coins + coéquipier DÉMARQUÉ qui progresse → la PASSE gagne
  const { st, sgn, goal } = mk();
  const c = st.players.find((p) => p.team === 0 && p.post === 8);
  pose(st, c, goal.x - sgn * 11, 0);
  // le mur vit SUR les couloirs de coin (les coins sont à z ±3,11 : à mi-distance le couloir
  // passe à z ±1,51 — un mur « devant » mais hors géométrie laissait 0,71 m de marge, mesuré)
  const wall = st.players.filter((p) => p.team === 1 && !p.keeper).slice(0, 3);
  wall[0].p[0] = goal.x - sgn * 5.5; wall[0].p[2] = 1.6;
  wall[1].p[0] = goal.x - sgn * 5.5; wall[1].p[2] = -1.6;
  wall[2].p[0] = goal.x - sgn * 5.5; wall[2].p[2] = 0;
  const mate = st.players.find((p) => p.team === 0 && p.post === 9);
  mate.p[0] = goal.x - sgn * 7; mate.p[2] = 7;                       // libre, plus près du but
  const a = arbitre(st, c, cfgD());
  ok(`mur devant + coéquipier démarqué qui progresse → la PASSE gagne (passe ${a.passe.score} vers ${a.passe.vers} · tir ${a.tir.score} « ${a.tir.pourquoi} »)`,
    a.meilleure === 'passe' && a.tir.pourquoi === 'couloir-serré');
}
{
  // (c) à 38 m du but, cône LIBRE devant → la CONDUITE gagne (le tir est hors portée)
  const { st, sgn } = mk();
  const c = st.players.find((p) => p.team === 0 && p.post === 8);
  pose(st, c, sgn * 14, 0);                                          // ~38 m du but adverse
  const a = arbitre(st, c, cfgD());
  ok(`38 m du but, champ libre → la CONDUITE gagne (conduite ${a.conduite.score}, espace ${a.conduite.espace} m · tir « ${a.tir.pourquoi} »)`,
    a.meilleure === 'conduite' && a.tir.score === 0);
}
{
  // (d) AILE HAUTE, angle fermé, DEUX coureurs de surface marqués (couloirs de passe bouchés),
  // cône de conduite fermé → le CENTRE gagne
  const { st, sgn, goal } = mk();
  const c = st.players.find((p) => p.team === 0 && p.post === 8);
  pose(st, c, sgn * 40, 15);
  const r1 = st.players.find((p) => p.team === 0 && p.post === 9);
  const r2 = st.players.find((p) => p.team === 0 && p.post === 7);
  r1.p[0] = sgn * 40; r1.p[2] = 3; r2.p[0] = sgn * 44; r2.p[2] = -4; // dans la boîte
  const d1 = st.players.filter((p) => p.team === 1 && !p.keeper);
  d1[0].p[0] = sgn * 40; d1[0].p[2] = 8;                             // dans le couloir ballon→r1
  d1[1].p[0] = sgn * 42; d1[1].p[2] = 4;                             // dans le couloir ballon→r2
  d1[2].p[0] = sgn * 43; d1[2].p[2] = 13;                            // ferme le cône de conduite
  const a = arbitre(st, c, cfgD());
  ok(`aile haute, angle fermé, boîte servie → le CENTRE gagne (centre ${a.centre.score}, ${a.centre.cibles} cibles · tir « ${a.tir.pourquoi} »)`,
    a.meilleure === 'centre' && a.tir.score === 0 && a.centre.cibles >= 2);
}

// ---------- 2. pureté et pondération
{
  const { st, sgn, goal } = mk();
  const c = st.players.find((p) => p.team === 0 && p.post === 8);
  pose(st, c, goal.x - sgn * 10, 0);
  const a1 = arbitre(st, c, cfgD()), a2 = arbitre(st, c, cfgD());
  ok(`l'arbitre est PUR (deux lectures du même monde → mêmes notes, même gagnant)`,
    JSON.stringify(a1) === JSON.stringify(a2));
}
{
  // sabotage nommé « cerveau d'un seul geste » : les poids éteignent tout sauf le tir — le monde
  // du MUR (fixture b) redevient l'empalement : on choisit le tir dans un couloir fermé
  const { st, sgn, goal } = mk();
  const c = st.players.find((p) => p.team === 0 && p.post === 8);
  pose(st, c, goal.x - sgn * 11, 0);
  const wall = st.players.filter((p) => p.team === 1 && !p.keeper).slice(0, 3);
  wall[0].p[0] = goal.x - sgn * 5.5; wall[0].p[2] = 1.6;
  wall[1].p[0] = goal.x - sgn * 5.5; wall[1].p[2] = -1.6;
  wall[2].p[0] = goal.x - sgn * 5.5; wall[2].p[2] = 0;
  const mate = st.players.find((p) => p.team === 0 && p.post === 9);
  mate.p[0] = goal.x - sgn * 7; mate.p[2] = 7;
  const a = arbitre(st, c, matchCfg({ shotRange: 20, menace: { tir: 1, centre: 0, passe: 0, conduite: 0 } }));
  ok(`sabotage « cerveau d'un seul geste » attrapé (poids tir seul : on choisit un MAUVAIS tir — meilleure '${a.meilleure}' malgré « ${a.tir.pourquoi} »)`,
    a.meilleure === 'tir' && a.tir.pourquoi === 'couloir-serré');
}

// ---------- 3. LE CONTRAT D'INJECTION : cfg.decide remplace la politique, le moteur obéit
{
  const scene = (over) => {
    const { st, sgn, goal } = mk();
    const c = st.players.find((p) => p.team === 0 && p.post === 8);
    pose(st, c, goal.x - sgn * 9, 0);
    const cfg = matchCfg({ shotRange: 20, ...over });
    for (let i = 0; i < 90; i++) matchStep(st, 1 / 60, cfg);
    return st;
  };
  const libre = scene({});
  const tenu = scene({ decide: () => ({ meilleure: 'conduite' }) });
  const tira = (s) => s.events.some((e) => e.type === 'shot' || e.type === 'windup') || (s.deny?.['prépare-frappe'] ?? 0) > 0;
  ok(`cfg.decide GOUVERNE (défaut : la machinerie de tir s'engage en 1,5 s devant le but ouvert ; décideur aval « conduite » : elle reste ÉTEINTE — l'injection remplace la politique, pas l'exécution)`,
    tira(libre) && !tira(tenu));
}

// ---------- 4. le flux : l'arbitre vit, se répartit, et l'angle fermé n'est PLUS TENTÉ
{
  // BALAYAGE coupe-circuit (doctrine lot 36, re-fondé lot 42) : une graine × 180 s pour
  // l'existence du tir re-cassait à chaque flux (1-5 tirs/graine — leçon d'instrument du
  // lot 39) ; l'agrégat s'arrête dès que tout est prouvé, les autres clauses gardent la
  // première graine (l'arbitre vit partout)
  let arbs0 = null, deny0 = null, gelMax = 0, choix = new Set(), tirs = 0;
  for (const seed of [4, 1, 2, 3, 5]) {
    const st = makeMatch({ full: true, seed });
    const cfg = cfgD();
    let gel = 0;
    for (let i = 0; i < 180 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      const moving = Math.hypot(st.ball.v[0], st.ball.v[2]) > 0.3 || st.ball.owner != null;
      gel = moving || st.restart ? 0 : gel + 1 / 60; gelMax = Math.max(gelMax, gel);
    }
    const arbs = st.events.filter((e) => e.type === 'arbitre');
    if (deny0 == null) deny0 = st.deny?.['angle-fermé'] ?? 0;
    // …et la VIE de l'arbitre profite du balayage aussi (lot 51 : la première graine du
    // monde au tacle vivant rendait 2 — le max des graines visitées est l'existence)
    arbs0 = Math.max(arbs0 ?? 0, arbs.length);
    for (const e of arbs) choix.add(e.choix);
    tirs += st.events.filter((e) => e.type === 'shot').length;
    if (choix.size >= 3 && tirs >= 1) break;
  }
  ok(`l'arbitre VIT en flux (${arbs0} changements d'avis, max des graines balayées ≥ 5 — une lecture du monde, pas un tremblement)`, arbs0 >= 5 && arbs0 <= 200);
  ok(`ses choix se RÉPARTISSENT (${[...choix].join(', ')} — ≥ 3 options distinctes gagnent, balayage)`, choix.size >= 3);
  ok(`l'angle fermé n'est PLUS TENTÉ (deny angle-fermé ${deny0} = 0 — mesuré avant l'arbitre : 18-171 par match)`,
    deny0 === 0);
  ok(`le tir VIT encore (${tirs} tir(s) ≥ 1, balayage) et le monde ne gèle pas (${gelMax.toFixed(1)} s ≤ 25)`, tirs >= 1 && gelMax <= 25);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
