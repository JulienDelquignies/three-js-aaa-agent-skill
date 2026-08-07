// tete.js — LE CIEL DU MATCH (lot 34). Le jeu aérien manquait ENTIER : mesuré avant, 0 centre
// entré en surface sur 4 matchs (vols tendus mangés par le premier rideau) et 0,8 s/match de
// fenêtre de tête avec un corps dessous — les centres retombaient, les dégagements attendaient
// le sol, le style « large et centres » n'avait pas sa finition. Ici vit le CONTACT DE TÊTE :
// un vol à hauteur de tête (min-max m — la tête DEBOUT : le saut authoré est une dette de
// scène) au-dessus d'un corps se REPREND — au BUT (canal shot standard : le plongeon du
// gardien répond à la physique, pas à un script), en DÉGAGEMENT (loin de son but, vers
// l'avant et le flanc), ou en REMISE (le coéquipier proche, cloche courte). À DEUX corps
// dans la fenêtre : le DUEL AÉRIEN tranche (note strength — le même levier que l'épaule —,
// jet seedé, événement 'duel' kind aérien). Gardé cfg.tete && st.full : le réduit et le
// rondo d'hier, au bit près. Dettes nommées : le saut (clip), la Loi 11 sur reprise de la
// tête (le sifflet vit à la prise au sol — une redirection de la tête n'appelle pas receive).
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export function teteStep(st, cfg) {
  const T = cfg.tete;
  const bp = st.ball.p;
  if (bp[1] < (T.min ?? 1.5) || bp[1] > (T.max ?? 2.2)) return;
  if ((st._teteCd ?? 0) > st.t) return;                            // un contact par fenêtre de vol
  const cands = st.players.filter((q) => q.down <= 0 && !q.keeper && !q.act && d2(q.p, bp) < (T.reach ?? 1.0))
    .sort((a, b) => d2(a.p, bp) - d2(b.p, bp));
  if (!cands.length) return;
  let joueur = cands[0];
  const rival = cands.find((q) => q.team !== joueur.team);
  if (rival) {
    // LE DUEL AÉRIEN : force contre force (chargeF — l'attribut strength des deux côtés)
    const edge = ((joueur.skill?.chargeF ?? 1) - (rival.skill?.chargeF ?? 1)) * 0.5;
    const perdant = (st.rnd ? st.rnd() : 0.5) < 0.5 + edge ? rival : joueur;
    if (perdant === joueur) joueur = rival;
    st.events.push({ t: +st.t.toFixed(2), type: 'duel', kind: 'aérien', by: joueur.id, contre: perdant.id, won: true });
  }
  st._teteCd = st.t + 0.8;
  st.lastTouch = joueur.team;
  const goal = st.pitch.attackGoal(joueur.team);
  const own = st.pitch.ownGoal(joueur.team);
  const sgn = Math.sign(goal.x || 1);
  const dGoal = Math.hypot(goal.x - joueur.p[0], joueur.p[2]);
  if (dGoal < (T.but ?? 12) && st.pitch.inBox(joueur.p[0], joueur.p[2], sgn)) {
    // LA TÊTE AU BUT : piquée vers un point du cadre seedé — canal shot standard
    const tz = ((st.rnd ? st.rnd() : 0.5) * 2 - 1) * (st.pitch.goalHalf - 0.5);
    st.ball.strike({ speed: 12.5, dirYaw: Math.atan2(tz - joueur.p[2], goal.x - joueur.p[0]), elevation: 0.03, spinAxis: [0, 1, 0], spinRev: 0 });
    st.pass = null;
    st.events.push({ t: +st.t.toFixed(2), type: 'tête', by: joueur.id, mode: 'but' });
    st.events.push({ t: +st.t.toFixed(2), type: 'shot', by: joueur.id, kind: 'tête', range: +dGoal.toFixed(1), speed: 12.5 });
    return;
  }
  if (Math.hypot(own.x - joueur.p[0], joueur.p[2]) < 24) {
    // LE DÉGAGEMENT DE LA TÊTE : loin de son but, vers l'avant et le flanc
    const fz = joueur.p[2] >= 0 ? 0.45 : -0.45;
    st.ball.strike({ speed: 11.5, dirYaw: Math.atan2(fz, -Math.sign(own.x)), elevation: 0.42, spinAxis: [0, 1, 0], spinRev: 0 });
    st.pass = null;
    st.events.push({ t: +st.t.toFixed(2), type: 'tête', by: joueur.id, mode: 'dégagement' });
    return;
  }
  // LA REMISE DE LA TÊTE : le coéquipier proche, en cloche courte (balistique de la rentrée,
  // raccourcie — la tête part de 1,8 m, pas du sol)
  const mate = st.players.filter((m) => m.team === joueur.team && m.id !== joueur.id && !m.keeper && m.down <= 0)
    .map((m) => ({ m, d: d2(m.p, joueur.p) })).filter((x) => x.d > 3 && x.d < 14).sort((a, b) => a.d - b.d)[0];
  const dir = mate ? Math.atan2(mate.m.p[2] - joueur.p[2], mate.m.p[0] - joueur.p[0]) : Math.atan2(0, -Math.sign(own.x));
  const theta = 0.4;
  const speed = Math.sqrt(Math.max(4, mate ? mate.d : 9) * 9.81 / Math.sin(2 * theta)) * 0.85;
  st.ball.strike({ speed, dirYaw: dir, elevation: theta, spinAxis: [0, 1, 0], spinRev: 0 });
  st.pass = mate
    ? { from: joueur.id, to: mate.m.id, lead: [mate.m.p[0], 0, mate.m.p[2]], style: 'tête', t: st.t, flight: 2 * speed * Math.sin(theta) / 9.81, origin: [joueur.p[0], joueur.p[2]] }
    : null;
  st.events.push({ t: +st.t.toFixed(2), type: 'tête', by: joueur.id, mode: 'remise', to: mate?.m.id });
}
