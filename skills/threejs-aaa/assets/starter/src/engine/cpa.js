// LES REMISES ONT UNE STRUCTURE (223-226 — audit aval : « tout le monde va à la touche », « personne
// dans la surface au coup franc », « le gardien n'a personne à qui donner »). Trois lois, une par
// espèce, toutes sous clé (absente : la marche vers le point de remise d'hier, au bit) :
//   cfSpots      — LA MONTÉE SUR COUP FRANC (224, cfg.cpaMontee) : dans le rayon, les grands (chargeF)
//                  montent aux postes de la surface (premier poteau, penalty, second poteau, retrait) ;
//                  le défendant les marque goal-side (ou tient la zone — tac.cpa.marquage), le mur reste.
//   remiseCible  — LA TOUCHE N'AIMANTE QUE SES APPUIS (226, cfg.remise) : trois appuis (devant sur la
//                  ligne, dedans, derrière), le reste tient la formation autour du point ; LE RENVOI SE
//                  SORT (223, cfg.relance) : la sortie de balle.
//   sortieBalle  — LA SORTIE DE BALLE (223, cfg.relance, tac.cpa.sortieBut ≠ 'long') : les deux
//                  centraux écartés aux coins de la surface, le pivot qui décroche dans l'axe, les
//                  latéraux hauts et larges — au renvoi ET quand le gardien a le ballon en jeu.
//   placement    — l'événement demandé par l'aval : à la prise d'un coup de pied arrêté, combien
//                  d'attaquants et de défenseurs dans la surface visée.
import { hyp } from './hyp.js';
import { formationSpots, formationPour, LIGNES, mapPostes } from './formation.js';

const dd = (a, b) => hyp(a[0] - b[0], (a[2] ?? a[1]) - (b[2] ?? b[1]));
const vifs = (st, team, r) => st.players.filter((q) => q.team === team && !q.keeper && q.id !== r?.taker && q.down <= 0 && !q.expulse && !q._sub);

export function cfSpots(st, r, p, cfg) {
  const M = cfg.cpaMontee;
  const g = st.pitch.attackGoal(r.team), sg = Math.sign(g.x || 1);
  if (hyp(r.p[0] - g.x, r.p[1]) > (M.rayon ?? 35) || r.taker == null) return null;   // le plan attend l'ÉLECTION du preneur (elireTaker, après ce site) : le tireur ne monte pas
  const P = st._cfPlan?.at === r.at ? st._cfPlan : (st._cfPlan = (() => {
    const cz = Math.sign(r.p[1] || 1), gh = st.pitch.goalHalf, spot = st.pitch.dims.spot ?? 11;
    const cpa = st.tactics?.[r.team]?.cpa;
    const n = Math.max(2, Math.min(5, (M.n ?? 4) + (cpa?.coupFranc === 'direct' ? -1 : cpa?.coupFranc === 'centre' ? 1 : 0)));
    const posts = [[g.x - sg * 5.5, cz * (gh - 1)], [g.x - sg * spot, 0], [g.x - sg * 5.5, -cz * (gh - 1)], [g.x - sg * (M.retrait ?? 18), cz * 4], [g.x - sg * 9, -cz * 6]].slice(0, n);
    const atk = vifs(st, r.team, r).sort((a, b) => (b.skill?.chargeF ?? 1) - (a.skill?.chargeF ?? 1)).slice(0, posts.length);   // LES GRANDS MONTENT (l'attribut aérien)
    const map = {};
    atk.forEach((q, i) => { map[q.id] = posts[i]; });
    // le défendant : le MUR d'abord (le même choix que match-sim : les deux plus près de leur but), puis zone ou homme
    const og = st.pitch.ownGoal(1 - r.team);
    const defs = st.players.filter((q) => q.team !== r.team && !q.keeper && q.down <= 0 && !q.expulse && !q._sub);
    if (hyp(og.x - r.p[0], r.p[1]) < 30) r._mur ??= [...defs].sort((a, b) => hyp(og.x - a.p[0], a.p[2]) - hyp(og.x - b.p[0], b.p[2])).slice(0, 2).map((q) => q.id);
    const pris = new Set(r._mur ?? []);
    if (st.tactics?.[1 - r.team]?.cpa?.marquage === 'zone') {
      posts.forEach((pt) => { const m = defs.filter((d) => !pris.has(d.id)).sort((a, b) => dd(a.p, pt) - dd(b.p, pt))[0]; if (m) { pris.add(m.id); map[m.id] = [pt[0] + sg * 0.3, pt[1]]; } });
    } else atk.forEach((q, i) => { const m = defs.filter((d) => !pris.has(d.id)).sort((a, b) => dd(a.p, posts[i]) - dd(b.p, posts[i]))[0]; if (m) { pris.add(m.id); map[m.id] = [posts[i][0] + sg * 0.9, posts[i][1] * 0.92]; } });
    return { at: r.at, team: r.team, map };
  })());
  const m = P.map[p.id] ?? null;
  if (m) p._walkF = M.trot ?? 1.6;   // les monteurs TROTTENT à leur poste (brief : bloc parti de 16-20 m, 0,3-0,6 s avant la frappe)
  return m;
}

const clampIn = (pitch, x, z) => [Math.max(-pitch.hx + 0.8, Math.min(pitch.hx - 0.8, x)), 0, Math.max(-pitch.hz + 0.8, Math.min(pitch.hz - 0.8, z))];

/** la formation d'attaque ancrée sur un point (les sans-poste d'une remise) */
const spotDe = (st, team, p, anchor, tac) => {
  const spots = formationSpots(st.pitch, team, anchor[0], true, formationPour(tac(st, team).formation, true), null, anchor[1] ?? 0);
  const s = spots?.[p.post];
  return s ? [s[0], 0, s[1]] : null;
};

export function sortieBalle(st, team, p, cfg, tac) {
  const R = cfg.relance, pitch = st.pitch;
  const cpa = st.tactics?.[team]?.cpa;
  if (cpa?.sortieBut === 'long') return null;
  const og = pitch.ownGoal(team), sg = -Math.sign(og.x || 1);   // sg : vers l'avant
  const P = st._sbPlan?.[team] && st.t - st._sbPlan[team].t < 0.5 ? st._sbPlan[team] : ((st._sbPlan ??= {})[team] = (() => {
    const f = tac(st, team).formation, name = formationPour(f, true);
    const lignes = LIGNES[name] ?? [4, 3, 3], nD = lignes[0], ids = mapPostes(f);
    const spots = formationSpots(pitch, team, og.x + sg * 10, true, name, null, 0) ?? [];
    const byPost = {}; for (const q of st.players) if (q.team === team && !q.keeper && q.down <= 0 && !q.expulse && !q._sub) byPost[q.post] = q;
    const defs = ids.slice(0, nD).map((k) => byPost[k]).filter(Boolean);   // la ligne arrière, de gauche à droite
    const pivot = byPost[ids[nD]];
    const map = {};
    const bx = og.x + sg * (pitch.dims.box.depth + (R.prof ?? -4)), bz = pitch.dims.box.width / 2 - (R.ecart ?? 1);
    if (defs.length >= 4) {   // 4 ou 5 derrière : les deux extérieurs sont les latéraux, les deux suivants les centraux écartés, un cinquième reste dans l'axe
      const [fbL, ...rest] = defs; const fbR = rest.pop();
      [fbL, fbR].forEach((q, i) => { if (q) map[q.id] = [og.x + sg * (R.lateral ?? 30), (i === 0 ? 1 : -1) * (pitch.hz - 6)]; });
      rest.forEach((q, i) => { map[q.id] = rest.length === 3 && i === 1 ? [bx - sg * 2, 0] : [bx, (i === 0 ? 1 : -1) * bz]; });
    } else defs.forEach((q, i) => { map[q.id] = i === 1 ? [bx - sg * 2, 0] : [bx, (i === 0 ? 1 : -1) * bz]; });   // 3 derrière : les deux extérieurs écartés, le central dans l'axe
    if (pivot) map[pivot.id] = [og.x + sg * (R.pivot ?? 22), Math.sign(st.ball.p[2] || 1) * 3];
    return { t: st.t, map, spots };
  })());
  const m = P.map[p.id];
  if (p.job === 'walk') p._walkF = R.trot ?? 1.5;   // la sortie de balle se prend au TROT (brief : renvoi joué en 4-8 s)
  if (m) return clampIn(pitch, m[0], m[1]);
  const s = P.spots?.[p.post];
  return s ? clampIn(pitch, s[0], s[1]) : null;
}

export function remiseCible(st, r, p, cfg, tac) {
  const pitch = st.pitch;
  if (r.type === 'sortie-de-but' && cfg.relance) return sortieBalle(st, r.team, p, cfg, tac);
  if (r.type !== 'touche' || !cfg.remise || r.taker == null) return null;   // idem : les appuis s'élisent une fois le lanceur connu
  const R = cfg.remise, g = pitch.attackGoal(r.team), sg = Math.sign(g.x || 1), cz = Math.sign(r.p[1] || 1);
  const P = st._touchePlanA?.at === r.at ? st._touchePlanA : (st._touchePlanA = (() => {
    const mates = vifs(st, r.team, r).sort((a, b) => dd(a.p, r.p) - dd(b.p, r.p));
    const n = Math.max(1, Math.min(4, Math.round((R.appuis ?? 3) + (tac(st, r.team).relation ?? 0.5) * 2 - 1)));   // le jeu combiné (axe relation) amène un appui de plus
    const posts = [[r.p[0] + sg * (R.court ?? 8), cz * (pitch.hz - 2)], [r.p[0] + sg * 2, cz * (pitch.hz - (R.dedans ?? 8))], [r.p[0] - sg * (R.arriere ?? 8), cz * (pitch.hz - 2)], [r.p[0] + sg * 14, cz * (pitch.hz - 6)]].slice(0, n);
    const map = {};
    mates.slice(0, posts.length).forEach((q, i) => { map[q.id] = posts[i]; });
    return { at: r.at, map };
  })());
  const m = P.map[p.id];
  if (m) { p._walkF = R.trot ?? 1.4; return clampIn(pitch, m[0], m[1]); }   // l'appui vient au trot (brief : 1 appui en < 2 s)
  return spotDe(st, r.team, p, [r.p[0], r.p[1]], tac);   // le reste tient sa formation autour du point
}

/** l'événement `placement` : à la prise d'un coup de pied arrêté (corner, coup franc, touche), la surface visée */
export function placementEvent(st, type, team) {
  if (!st.full || !['corner', 'coup-franc', 'touche', 'sortie-de-but'].includes(type)) return;
  const g = st.pitch.attackGoal(team), sg = Math.sign(g.x || 1);
  const box = (q) => Math.abs(q.p[0] - g.x) < st.pitch.dims.box.depth && Math.abs(q.p[2]) < st.pitch.dims.box.width / 2;
  const att = st.players.filter((q) => q.team === team && !q.keeper && box(q)).length;
  const def = st.players.filter((q) => q.team !== team && !q.keeper && box(q)).length;
  st.events.push({ t: +st.t.toFixed(2), type: 'placement', espece: type, team, attaquantsSurface: att, defenseursSurface: def });
}
