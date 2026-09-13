// LE NOYAU COMMUN DE DUEL (268, cfg.noyau && st.full — Modèle 11 lot 1, §2 le noyau log-linéaire, §3 le dribble ; Bible 15).
// Hier le take-on était résolu par la géométrie et des tirages épars : tout geste « vendu » mordait le défenseur (le
// passement, le crochet chaloupé, le double contact, la roulette — sans tirage), le petit pont tirait sa réussite à la
// note, et la dépossession venait plus tard, par la physique (le tacle debout, le pique, la prise) ; ni faute obtenue
// (0,8 % ; réel 11,6), ni sortie en touche (0 ; réel 15,5), ni gradient spatial (22 / 24 / 18 / 18 % par bande ; réel
// 68 → 41). LA LOI : au CONTACT d'un geste de dribble contre un homme (le foe du geste, ou le plus proche à moins de
// zone m), le duel se juge UNE fois par un noyau multinomial log-linéaire — huit issues du book (franchi / franchi +
// faute obtenue / franchi + sortie / neutre + touche / neutre / dépossédé / dépossédé + faute de l'attaquant / dépossédé
// + sortie), un score de franchissement s = Σ w·f sur les features du book (la MARGE DE FRANCHISSEMENT μ* du disque
// d'atteinte de Fujimura-Sugihara — centre x_d + A(α,t) v_d, rayon V_max (t − A), allonge ρ_d ; l'éventail de 9 points
// à 2-5 m devant le dribbleur, ± 75°, le disque évalué quand le ballon y passe (τ = d / v_a ≤ T, + séjour) —, la vitesse relative, le désalignement du buste du
// défenseur, la distance à la touche, la pression secondaire, la distance au but, les défenseurs dans le cône de 3 m,
// les attributs composites a_A − a_D bornés à ± 0,7 log-odds), des intercepts b_o par issue (initialisés aux parts du
// book, RECUITS sur les données du moteur : cfg.noyau.b), le tirage Gumbel-max sur le flux 'duel' (huit uniformes,
// rejeu exact). LES CONSÉQUENCES (appliquerNoyau, après le contact) : franchi = la morsure d'hier (le verrou du battu) ;
// franchi + faute = la faute POSÉE (l'avantage la joue, Loi 5) ; les sorties poussent le ballon en touche quand la ligne
// est à moins de sortieMax m (sinon l'issue se remappe, nommée) ; neutre = le statu quo (aucune morsure) ; dépossédé =
// le transfert physique d'aujourd'hui (receive → turnover) ; dépossédé + faute = la faute de l'attaquant. Le journal :
// l'événement duel kind 'take-on' porte l'issue, μ*, la bande x et les features. Clé absente : la géométrie d'hier au
// bit. Ce que le lot nomme : le volume (199 gestes / match c. 25 take-ons — Bible 14 lot 2), le bruit OU de forme
// (τ 240 s), l'inclinaison du buste (pas de pose 3D), la jambe d'appui (poids nul par le book), le tacle et l'aérien
// par le même noyau (§4-5), la course de coupe (§7), le glissé imposé à 3,3 par équipe (§4.2).
import { hyp } from './hyp.js';
import { tirage } from './rng.js';

export const ISSUES = ['FRANCHI', 'FRANCHI_FAUTE', 'FRANCHI_SORTIE', 'NEUTRE_TOUCHE', 'NEUTRE', 'DEPOSSEDE', 'DEPOSSEDE_FAUTE', 'DEPOSSEDE_SORTIE'];
export const PARTS_BOOK = [0.446, 0.116, 0.032, 0.100, 0.033, 0.241, 0.007, 0.023];
/** Les intercepts du book : ln(part_o / part_FRANCHI) — le point de départ du recuit. */
export const B_BOOK = PARTS_BOOK.map((p) => Math.log(p / PARTS_BOOK[0]));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), n1 = (F, h) => Math.max(-1, Math.min(1, ((F ?? 1) - 1) / h));

/** Le disque d'atteinte de Fujimura-Sugihara à t s : { cx, cz, R }. α re-ajusté pour que R(1 s) soit la distance courue en 1 s par le profil du moteur. Pure. */
export function disqueDe(q, t, K, cfg) {
  const al = K.alpha ?? 2.05, A = (1 - Math.exp(-al * t)) / al, vmax = (cfg.speeds?.chase ?? 6.4) * (q.skill?.topF ?? 1);
  return { cx: q.p[0] + A * q.v[0], cz: q.p[2] + A * q.v[1], R: vmax * (t - A) + (K.rho ?? 0.95) };
}

/** La marge de franchissement μ* (m) : le meilleur des 9 points de l'éventail (2-5 m devant, ± 75°), le pire des trois instants où le ballon y passe (τ = d / v_a, + séjour). Pure, zéro allocation. */
export function margeDe(c, q, K, cfg) {
  const yaw = hyp(c.v[0], c.v[1]) > 0.8 ? Math.atan2(c.v[1], c.v[0]) : c.yaw, T = K.T ?? 1.2, nP = K.points ?? 9, va = Math.max(2.5, hyp(c.v[0], c.v[1]) * 0.6 + 2.5);
  let best = -Infinity;
  for (let i = 0; i < nP; i++) {
    const a = yaw + (K.secteur ?? 1.31) * (2 * i / (nP - 1) - 1), d = (K.dMin ?? 2) + ((K.dMax ?? 5) - (K.dMin ?? 2)) * ((i * 7) % nP) / (nP - 1);
    const tau = d / va; if (tau > T) continue;   // le dribbleur doit pouvoir y être dans l'horizon
    const px = c.p[0] + d * Math.cos(a), pz = c.p[2] + d * Math.sin(a);
    let mu = Infinity;   // le ballon est en p à τ ; le défenseur ne doit pas l'y atteindre pendant qu'il y passe (τ … τ + séjour)
    for (let k = 0; k < 3; k++) { const D = disqueDe(q, tau + k * (K.sejour ?? 0.1), K, cfg); const m = hyp(px - D.cx, pz - D.cz) - D.R; if (m < mu) mu = m; }
    if (mu > best) best = mu;
  }
  return best === -Infinity ? -(K.rho ?? 0.95) : best;
}

/** Les features du take-on c contre q : { mu, dv, dpsi, dside, press, x, nc, aA, aD, near }. Pure. */
export function featuresDe(st, c, q, K, cfg) {
  const hz = st.pitch?.hz ?? 34, hx = st.pitch?.hx ?? 52.5, gS = Math.sign(st.pitch.attackGoal(c.team).x || 1);
  const axe = Math.atan2(c.p[2] - q.p[2], c.p[0] - q.p[0]), prog = hyp(c.v[0], c.v[1]) > 0.8 ? Math.atan2(c.v[1], c.v[0]) : c.yaw;
  let press = 0, nc = 0;
  for (const r of st.players) {
    if (r.team === c.team || r === q || r.keeper || r.down > 0 || r.expulse || r._sub) continue;
    const d = hyp(r.p[0] - c.p[0], r.p[2] - c.p[2]);
    if (d < (K.pressR ?? 6)) press++;
    if (d < 3 && Math.abs(wrap(Math.atan2(r.p[2] - c.p[2], r.p[0] - c.p[0]) - prog)) < 0.8) nc++;
  }
  const sA = c.skill, sD = q.skill;
  const aA = sA ? 0.34 * n1(sA.gesteF, 0.15) + 0.22 * n1(sA.getupF, 0.28) * -1 + 0.18 * -n1(sA.dribbleLeadF, 0.07) + 0.14 * n1(sA.controlF, 0.15) + 0.12 * ((c.persona?.flair ?? 0.5) - 0.5) * 2 : 0;
  const aD = sD ? 0.30 * Math.max(-1, Math.min(1, (sD.tackleReach ?? 0) / 0.10)) + 0.24 * n1(sD.posF, 0.15) + 0.22 * n1(sD.getupF, 0.28) * -1 + 0.14 * n1(sD.anticipF, 0.15) + 0.10 * n1(sD.chargeF, 0.15) : 0;
  const dside = hz - Math.abs(c.p[2]);
  return { mu: margeDe(c, q, K, cfg), dv: hyp(c.v[0], c.v[1]) - hyp(q.v[0], q.v[1]), dpsi: Math.abs(wrap(q.yaw - axe)), dside, press, x: Math.max(0, Math.min(1, (c.p[0] * gS + hx) / (2 * hx))), nc, aA, aD, near: Math.max(0, 1 - dside / (K.sortieMax ?? 8)) };
}

/** Les logits des huit issues : s = Σ w·f (le franchissement), b_o l'intercept, ± s selon la famille, la touche près de la ligne. Pure. */
export function logitsDe(f, K, out = new Array(8)) {
  const W = K.w ?? {}, b = K.b ?? B_BOOK;
  const s = (W.mu ?? 0.6) * Math.max(-2, Math.min(3, f.mu)) + (W.dv ?? 0.15) * Math.max(-4, Math.min(4, f.dv)) + (W.psi ?? 0.5) * f.dpsi + (W.side ?? 0.04) * Math.min(12, f.dside) - (W.press ?? 0.25) * f.press - (W.goal ?? 0.9) * (f.x - 0.6) - (W.nc ?? 0.4) * f.nc + (W.attA ?? 0.35) * f.aA - (W.attD ?? 0.35) * f.aD;
  const so = (W.sortie ?? 1.5) * f.near;
  out[0] = b[0] + s; out[1] = b[1] + s + (W.faute ?? 0) ; out[2] = b[2] + s + so; out[3] = b[3] + so; out[4] = b[4]; out[5] = b[5] - s; out[6] = b[6] - s; out[7] = b[7] - s + so;
  return out;
}

/** Les probabilités (softmax). Pure. */
export function probasDe(l) { let m = -Infinity; for (const x of l) if (x > m) m = x; let z = 0; const p = l.map((x) => { const e = Math.exp(x - m); z += e; return e; }); return p.map((e) => e / z); }

/** L'issue tirée par Gumbel-max sur le flux 'duel' (huit uniformes). rnd : () => u. Pure. */
export function tirerIssue(l, rnd) {
  let best = -Infinity, k = 0;
  for (let o = 0; o < l.length; o++) { const u = Math.max(1e-12, Math.min(1 - 1e-12, rnd())); const g = -Math.log(-Math.log(u)); if (l[o] + g > best) { best = l[o] + g; k = o; } }
  return ISSUES[k];
}

/** Le duel au contact du geste de p (A = payload) : trouve l'homme, juge, journalise ; rend { issue, q, f, franchi } ou null (aucun homme). */
export function noyauAuContact(st, p, A, cfg) {
  const K = cfg.noyau; let q = st.players[A.foeId ?? -1];
  if (!q || q.team === p.team || q.down > 0) { q = null; let dm = K.zone ?? 2.2; for (const r of st.players) { if (r.team === p.team || r.keeper || r.down > 0 || r.expulse || r._sub) continue; const d = hyp(r.p[0] - p.p[0], r.p[2] - p.p[2]); if (d < dm) { dm = d; q = r; } } }
  if (!q) return null;
  const f = featuresDe(st, p, q, K, cfg), l = logitsDe(f, K), rnd = tirage(st, 'duel', p.id, st.rnd ?? (() => 0.5));
  let issue = tirerIssue(l, rnd), remap = false;
  if (f.dside > (K.sortieMax ?? 8) && /SORTIE|TOUCHE/.test(issue)) { remap = true; issue = issue === 'FRANCHI_SORTIE' ? 'FRANCHI' : issue === 'NEUTRE_TOUCHE' ? 'NEUTRE' : 'DEPOSSEDE'; }
  const hz = st.pitch?.hz ?? 34;
  st.events.push({ t: +st.t.toFixed(2), type: 'duel', kind: 'take-on', by: p.id, contre: q.id, geste: A.skill, issue, mu: +f.mu.toFixed(2), x: +f.x.toFixed(2), couloir: Math.abs(p.p[2]) > hz * 0.5, ...(remap ? { remap: true } : {}), ...(K.journal ? { f: { mu: +f.mu.toFixed(2), dv: +f.dv.toFixed(2), dpsi: +f.dpsi.toFixed(2), dside: +f.dside.toFixed(1), press: f.press, x: +f.x.toFixed(2), nc: f.nc, aA: +f.aA.toFixed(2), aD: +f.aD.toFixed(2), near: +f.near.toFixed(2) } } : {}) });
  return { issue, q, f, franchi: issue.startsWith('FRANCHI') };
}

/** Les conséquences après le contact (appelé par le pas de jeu, avec receive) : la faute posée, la sortie, la dépossession. */
export function appliquerNoyau(st, cfg, receive, abort) {
  const N = st._noyau; st._noyau = null; if (!N) return;
  const p = st.players[N.p], q = N.q, K = cfg.noyau, I = N.issue;
  if (I === 'FRANCHI_FAUTE' && !st._faute && cfg.loi12) {
    st._faute = { t: st.t, par: q.id, sur: p.id, team: p.team, p: [p.p[0], p.p[2]], grave: false, kind: 'take-on', vSur: hyp(p.v[0], p.v[1]), dir: [p.v[0], p.v[1]], arrache: true };
    st.events.push({ t: +st.t.toFixed(2), type: 'faute', by: q.id, sur: p.id, kind: 'take-on', arrache: true, p: [+p.p[0].toFixed(1), +p.p[2].toFixed(1)] });
  } else if (I === 'DEPOSSEDE_FAUTE' && !st._faute && cfg.loi12) {
    st._faute = { t: st.t, par: p.id, sur: q.id, team: q.team, p: [q.p[0], q.p[2]], grave: false, kind: 'faute-offensive', vSur: 0, dir: [0, 0] };
    st.events.push({ t: +st.t.toFixed(2), type: 'faute', by: p.id, sur: q.id, kind: 'faute-offensive', p: [+q.p[0].toFixed(1), +q.p[2].toFixed(1)] });
    abort(p); st.ball.release('perte'); st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
  } else if (I === 'DEPOSSEDE') {
    abort(p); if (st.ball.owner === p.id) st.ball.release('perte'); receive(st, q.id, cfg);
  } else if (/SORTIE|TOUCHE/.test(I)) {
    const sz = Math.sign(p.p[2] || 1), v = K.vSortie ?? 9;
    abort(p); if (st.ball.owner != null) st.ball.release('sortie'); st.ball.impulse([-st.ball.v[0] * 0.5, 0, sz * v - st.ball.v[2]]);
    st.lastTouch = I === 'NEUTRE_TOUCHE' ? q.team : p.team;   // la touche pour l'attaquant sur le neutre, pour la défense sinon
    st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
  }
}
