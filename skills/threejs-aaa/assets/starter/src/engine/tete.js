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

/** LA PERCEPTION A UNE HORLOGE (le contrat de strikeNow, complété lot 50) : une redirection
 *  de première intention n'a PAS d'armé — seen 0, tout le monde paie sa réaction pleine
 *  (mesuré : les redirections étaient les seuls départs sans fenêtre aveugle). */
const surprend = (st) => { st._surprise = { t: st.t, seen: 0, n: (st._surprise?.n ?? 0) + 1 }; };

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
    surprend(st);
    st.pass = null;
    st.events.push({ t: +st.t.toFixed(2), type: 'tête', by: joueur.id, mode: 'but' });
    st.events.push({ t: +st.t.toFixed(2), type: 'shot', by: joueur.id, kind: 'tête', range: +dGoal.toFixed(1), speed: 12.5 });
    return;
  }
  if (Math.hypot(own.x - joueur.p[0], joueur.p[2]) < 24) {
    // LE DÉGAGEMENT DE LA TÊTE : loin de son but, vers l'avant et le flanc.
    // …SAUF PRESSÉ PRÈS DE SA LIGNE (lot 101, cfg.corner && st.full — la 2e source de corners,
    // mesurée : la claquette seule en rendait 1/8 matchs) : le défenseur qui dégage de la tête
    // à < 9 m de sa ligne avec un adversaire au corps (< 2,5 m) SÉCURISE DERRIÈRE — la tête
    // vers son propre coin, le corner concédé (le choix du vrai défenseur : le danger d'abord).
    // Tirage rnd2 une fois sur deux (l'autre : le dégagement d'hier). Clé absente : hier au bit.
    const presse = st.full && cfg?.corner && Math.abs(own.x - joueur.p[0]) < 12
      && st.players.some((q) => q.team !== joueur.team && q.down <= 0 && d2(q.p, joueur.p) < 3.5)
      && (st.rnd2 ?? st.rnd ?? (() => 0.5))() < 0.5;
    const fz = joueur.p[2] >= 0 ? 0.45 : -0.45;
    if (presse) {
      const coinYaw = Math.atan2(Math.sign(joueur.p[2] || 1) * 2.2, Math.sign(own.x || 1));
      st.ball.strike({ speed: 12.5, dirYaw: coinYaw, elevation: 0.35, spinAxis: [0, 1, 0], spinRev: 0 });
    } else st.ball.strike({ speed: 11.5, dirYaw: Math.atan2(fz, -Math.sign(own.x)), elevation: 0.42, spinAxis: [0, 1, 0], spinRev: 0 });
    surprend(st);
    st.pass = null;
    st.events.push({ t: +st.t.toFixed(2), type: 'tête', by: joueur.id, mode: 'dégagement', ...(presse ? { corner: true } : {}) });
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
  surprend(st);
  st.pass = mate
    ? { from: joueur.id, to: mate.m.id, lead: [mate.m.p[0], 0, mate.m.p[2]], style: 'tête', t: st.t, flight: 2 * speed * Math.sin(theta) / 9.81, origin: [joueur.p[0], joueur.p[2]] }
    : null;
  st.events.push({ t: +st.t.toFixed(2), type: 'tête', by: joueur.id, mode: 'remise', to: mate?.m.id });
}

// LA VOLÉE (lot 40) — le pied joue le ballon EN VOL, sous la fenêtre de tête. Mesuré avant :
// 4,4 s/12 min de fenêtres à hauteur de pied sur un corps, ZÉRO geste — et 0,0 s en surface
// face au but, car la chaîne du centre ne produisait QUE des cloches (le centre BAS naît avec
// ce lot, shooting.js). Deux métiers seulement : la REPRISE AU BUT en surface (l'espèce
// 'volée' — 'demi-volée' si le ballon REMONTE de son rebond, vy > 0) et le DÉGAGEMENT
// d'urgence près de son but. PAS de remise de volée : à hauteur de pied, hors de ces deux
// urgences, le vrai geste est le CONTRÔLE — la prise au sol existante s'en charge. Entre
// 1,15 et 1,5 m : la fenêtre MORTE (le contrôle de poitrine est une dette nommée). Le duel
// aérien reste à la tête (au pied c'est le pique au sol qui arbitre). Gardé cfg.volee &&
// st.full, cooldown partagé avec la tête (un contact aérien par fenêtre de vol).
export function voleeStep(st, cfg) {
  const V = cfg.volee;
  const bp = st.ball.p;
  if (bp[1] < (V.min ?? 0.25) || bp[1] > (V.max ?? 1.15)) return;
  if ((st._teteCd ?? 0) > st.t) return;
  const joueur = st.players.filter((q) => q.down <= 0 && !q.keeper && !q.act && d2(q.p, bp) < (V.reach ?? 1.1))
    .sort((a, b) => d2(a.p, bp) - d2(b.p, bp))[0];
  if (!joueur) return;
  const goal = st.pitch.attackGoal(joueur.team);
  const own = st.pitch.ownGoal(joueur.team);
  const sgn = Math.sign(goal.x || 1);
  const dGoal = Math.hypot(goal.x - joueur.p[0], joueur.p[2]);
  if (dGoal < (V.but ?? 14) && st.pitch.inBox(joueur.p[0], joueur.p[2], sgn)) {
    // LA REPRISE DE VOLÉE : première intention, le canal shot standard — le plongeon répond
    const demi = st.ball.v[1] > 0.3;
    const tz = ((st.rnd ? st.rnd() : 0.5) * 2 - 1) * (st.pitch.goalHalf - 0.6);
    st._teteCd = st.t + 0.8;
    st.lastTouch = joueur.team;
    st.ball.strike({ speed: 17, dirYaw: Math.atan2(tz - joueur.p[2], goal.x - joueur.p[0]), elevation: 0.06, spinAxis: [0, 1, 0], spinRev: 0.5 });
    surprend(st);
    st.pass = null;
    st.events.push({ t: +st.t.toFixed(2), type: 'volée', by: joueur.id, mode: 'but', demi });
    st.events.push({ t: +st.t.toFixed(2), type: 'shot', by: joueur.id, kind: demi ? 'demi-volée' : 'volée', range: +dGoal.toFixed(1), speed: 17 });
    return;
  }
  if (Math.hypot(own.x - joueur.p[0], joueur.p[2]) < 24) {
    // LE DÉGAGEMENT DE VOLÉE : le défenseur boxe le vol loin de son but, vers l'avant et le flanc
    st._teteCd = st.t + 0.8;
    st.lastTouch = joueur.team;
    const fz = joueur.p[2] >= 0 ? 0.5 : -0.5;
    st.ball.strike({ speed: 14, dirYaw: Math.atan2(fz, -Math.sign(own.x)), elevation: 0.38, spinAxis: [0, 1, 0], spinRev: 0 });
    surprend(st);
    st.pass = null;
    st.events.push({ t: +st.t.toFixed(2), type: 'volée', by: joueur.id, mode: 'dégagement' });
    return;
  }
  // L'AMORTI DE LA RETOMBÉE (lot 52, V.amorti — retour utilisateur « les contrôles sur les
  // passes longues sont tous ratés ») : le DESTINATAIRE de la passe joue le ballon EN
  // DESCENTE, à portée, hors des deux urgences — la première touche du pied/de la cuisse TUE
  // le vol (le ballon meurt à ses pieds, la prise suit au pas d'après). Mesuré avant : 56/82
  // passes longues finissaient en chasse au rebond (le vol retombait, cabriolait — p90
  // 5 rebonds, 9 m, 2,8 s — et le receveur poursuivait). C'était la loi manquante nommée au
  // lot 40 (« le contrôle est le vrai geste ») : LE VOICI. La note de contrôle module le
  // résiduel (un mauvais premier toucher laisse le ballon vivre un peu).
  if (V.amorti !== false && st.pass && st.pass.to === joueur.id && st.ball.v[1] < -0.4) {
    st._teteCd = st.t + 0.8;
    st.lastTouch = joueur.team;
    const ctl = Math.min(1.2, joueur.skill?.controlF ?? 1);
    const k = (V.amortiK ?? 0.85) * ctl;
    // …et l'amorti amortit AUSSI la rotation (lot 54 — le spin orphelin ; doc : match-config)
    st.ball.impulse([-st.ball.v[0] * k, -st.ball.v[1] * 0.85, -st.ball.v[2] * k],
      st.full && cfg.amortiSpin !== false ? [-st.ball.w[0] * k, -st.ball.w[1] * k, -st.ball.w[2] * k] : null);
    st.pass = null;
    st.events.push({ t: +st.t.toFixed(2), type: 'control', by: joueur.id, tech: 'amorti-retombée', foot: 'any',
      surface: bp[1] > 0.7 ? 'thigh' : 'instep', speed: +Math.hypot(st.ball.v[0], st.ball.v[2]).toFixed(1), settle: null });
    return;
  }
  // sinon : ON NE VOLLEYE PAS — le contrôle au sol est le vrai geste du milieu de terrain
}
