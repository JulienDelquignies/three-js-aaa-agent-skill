// verify-orientation.mjs — LA PASSE DANS LE SENS DU GESTE (cfg.orientationPasse ; note 395). Retour utilisateur du 17/09 : « des passes faites
// dans des directions qui ne correspondent pas forcément au geste ». Mesuré (2 × 300 s) : 10 des 42 passes PLANIFIÉES partaient à plus de
// 60° du regard au contact — la passe-rapide à 64-110° (l'armé de 0,22 s ne tourne le corps que de 50°), puis les pivots à 60-130° : le
// porteur ADOPTE une passe arrière et court encore une seconde vers l'avant (la tenue calme) sans se tourner, l'engagement en tête (le
// preneur courait 1 s puis pivotait). La loi, en trois branchements : (1) l'adoption au-delà de tourner ° pose le _retour du 240b (la poussée
// vise le receveur) ; (2) beginPass choisit LA TECHNIQUE POUR LE TOUR QU'ELLE DOIT FAIRE — fenêtre (turn, plafonnée à fenetre °) + ce que
// l'armé tourne (marge × retournement.rate × antic) ≥ l'écart regard→sortie ; libre (presseur > presse m), rien ne tient → il S'OUVRE SUR
// PLACE (regard tenu vers la sortie, pointe capée à vTour, refus nommé 'orientation'), le pivot exclu (son clip ne tourne le bassin que de
// 38°) ; pressé : le talon si la sortie est derrière, sinon l'hier ; (3) l'engagement part au holdMin d'origine. null : l'hier au bit.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const hyp = Math.hypot, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a)), deg = (a) => wrap(a) * 180 / Math.PI;
const PINS = { verticalite: null, decalage: null, receveurOuvert: null };   // les clés SŒURS du 17/09, nulles : ce banc mesure l'orientation seule
const KO = matchCfg({}).orientationPasse;

// LE MATCH : les passes planifiées (ni urgentes ni une-touche) qui partent à plus de 60° du regard au contact, et le bilan
const match = (over, seeds = [3, 7], secs = 300) => {
  const R = { planifiees: 0, gros: 0, passes: 0, pertes: 0, engagement: [] };
  for (const seed of seeds) {
    const st = makeMatch({ full: true, seed }), cfg = matchCfg({ ...PINS, ...over });
    for (let i = 0; i < 60 * secs; i++) matchStep(st, 1 / 60, cfg);
    for (const e of st.events) if (e.type === 'pass') { R.passes++; if (!e.urgent && e.style !== 'une-touche') { R.planifiees++; if (Math.abs(e.out ?? 0) > 60) R.gros++; } }
    R.pertes += st.turnovers ?? 0;
    const eng = st.events.find((e) => e.type === 'restart-pris' && e.kind === 'engagement') ?? st.events.find((e) => e.type === 'restart-pris');
    const first = st.events.find((e) => e.type === 'pass' && eng && e.t > eng.t);
    if (first) R.engagement.push({ seed, tech: first.tech, out: first.out, delai: +(first.t - eng.t).toFixed(2) });
  }
  return R;
};

console.log('— (a) le match : la passe planifiée part dans le sens du geste —');
const A = match({}), N = match({ orientationPasse: null });
ok(`LES PASSES PLANIFIÉES À > 60° DU REGARD : ${A.gros} sur ${A.planifiees} avec la clé (2 × 300 s, graines 3 et 7) contre ${N.gros} sur ${N.planifiees} hier (mesuré 10/42) — au plus 2, et hier au moins 6`, A.gros <= 2 && N.gros >= 6);
ok(`…sans dégrader le monde : ${A.pertes} pertes contre ${N.pertes} hier (≤ 1,15 ×), ${A.passes} passes contre ${N.passes} (≥ 0,75 ×)`, A.pertes <= N.pertes * 1.15 + 2 && A.passes >= N.passes * 0.75);

console.log('— (b) l\'engagement : le preneur se tourne et donne —');
{
  const a = A.engagement, n = N.engagement;
  ok(`L'ENGAGEMENT (graines 3 et 7) : la première passe part à ${a.map((x) => `${Math.abs(x.out ?? 99).toFixed(0)}° (${x.tech}, ${x.delai} s)`).join(' / ')} du regard — ≤ 45°, jamais le talon, en moins de 1,5 s ; hier ${n.map((x) => `${Math.abs(x.out ?? 99).toFixed(0)}° (${x.tech}, ${x.delai} s)`).join(' / ')}`,
    a.length === 2 && a.every((x) => Math.abs(x.out ?? 99) <= 45 && x.tech !== 'talonnade' && x.delai <= 1.5) && n.every((x) => Math.abs(x.out ?? 0) > 45));
}

// LA FIXTURE : le porteur A lancé vers +x avec le ballon au pied, le receveur B derrière-gauche à ~150°, le monde parqué loin (personne à 14 m) — ou un presseur F devant
const fixture = (over, { presse = null, secs = 4 } = {}) => {
  const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg({ ...PINS, tenueCalme: null, holdCalmFull: [0.2, 0.3], ...over });   // la tenue calme courte : la fixture juge l'orientation, pas le tempo
  for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
  if (st.ball.owner != null) st.ball.release('perte');
  for (const q of st.players) { q.p[0] = -40 - (q.id % 11) * 1.5; q.p[2] = q.team ? 28 : -28; q.v = [0, 0]; q.act = null; q.job = 'walk'; q.target = [q.p[0], 0, q.p[2]]; q.intent = null; q._retour = null; q._regard = null; q._regardUntil = null; }
  const A = st.players.find((q) => q.team === 0 && !q.keeper), B = st.players.find((q) => q.team === 0 && !q.keeper && q !== A);
  const sg = Math.sign(st.pitch.attackGoal(0).x || 1), yaw0 = sg > 0 ? 0 : Math.PI;   // le porteur court vers SON but d'attaque (sinon la poussée le retourne d'elle-même)
  A.p[0] = 5 * sg; A.p[2] = 0; A.yaw = yaw0; A.yawWant = null; A.v = [3 * sg, 0]; A.speed = 3; A.job = 'carry'; A.target = [9 * sg, 0, 0];
  const bP = [A.p[0] - 6 * sg, 3.5]; B.p[0] = bP[0]; B.p[2] = bP[1]; B.yaw = yaw0; B.v = [0, 0]; B.speed = 0; B.job = 'walk'; B.target = [B.p[0], 0, B.p[2]];   // à ~150° derrière, 7 m (passRange 13 : le porteur s'éloigne en courant)
  const ligne = st.players.filter((q) => q.team === 1 && !q.keeper).slice(1, 5), lP = ligne.map((q, k) => [A.p[0] + 13 * sg, (k - 1.5) * 7]);   // une ligne de quatre défenseurs à 13 m devant (lance.surnombre 3) : sans elle le porteur est « lancé » (enLance) et ne redonne jamais
  ligne.forEach((q, k) => { q.p[0] = lP[k][0]; q.p[2] = lP[k][1]; q.yaw = yaw0 + Math.PI; q.v = [0, 0]; q.job = 'walk'; q.target = [q.p[0], 0, q.p[2]]; });
  let F = null, fP = null; if (presse != null) { F = st.players.find((q) => q.team === 1 && !q.keeper); fP = [A.p[0] - presse * 0.77 * sg, -presse * 0.64]; F.p[0] = fP[0]; F.p[2] = fP[1]; F.yaw = yaw0 + Math.PI; F.v = [0, 0]; F.job = 'walk'; F.target = [F.p[0], 0, F.p[2]]; }   // derrière-droite (−140°), du côté opposé au receveur : le presseur qui chasse, pas le jockey posté (le passement a sa loi)
  st.ball.restart([A.p[0] + 0.35 * sg, 0.11, 0], { cause: 'engagement' }); st.restart = null; st.ball.possess(A.id); st.possession = { team: 0, carrier: A.id }; st.phase = 'carry'; st.hold = 1; st.lastTouch = 0;
  const n0 = st.events.length; let ev = null, vMin = 9, tStart = st.t, refus0 = st.deny?.orientation ?? 0;
  for (let i = 0; i < 60 * secs; i++) {
    for (const q of st.players) if (q !== A && q !== B && q !== F && !ligne.includes(q)) { q.p[0] = -40 - (q.id % 11) * 1.5; q.p[2] = q.team ? 28 : -28; q.v = [0, 0]; q.act = null; }
    B.p[0] = bP[0]; B.p[2] = bP[1]; B.v = [0, 0]; ligne.forEach((q, k) => { q.p[0] = lP[k][0]; q.p[2] = lP[k][1]; q.v = [0, 0]; q.act = null; }); if (F) { F.p[0] = A.p[0] - presse * 0.77 * sg; F.p[2] = A.p[2] - presse * 0.64; F.v = [0, 0]; }   // le chasseur COLLE au porteur
    matchStep(st, 1 / 60, cfg);
    if (A.intent || A.act) vMin = Math.min(vMin, A.speed);
    ev = st.events.slice(n0).find((e) => e.type === 'pass' && e.by === A.id);
    if (ev) break;
  }
  return { ev, tour: ev ? Math.abs(deg(A.yaw - yaw0)) : null, vMin, delai: ev ? +(ev.t - tStart).toFixed(2) : null, refus: (st.deny?.orientation ?? 0) - refus0, to: ev ? ev.to === B.id : false };
};

console.log('— (c) la fixture libre : le porteur lancé se retourne avant de donner —');
{
  const r = fixture({});
  ok(`LE PORTEUR LANCÉ À 3 m/s, receveur à ~150° derrière, personne à 2,2 m : ${r.ev ? `${r.ev.tech} à ${Math.abs(r.ev.out).toFixed(0)}° du regard, le corps a tourné ${r.tour?.toFixed(0)}°, pointe minimale ${r.vMin.toFixed(1)} m/s, ${r.refus} refus 'orientation', en ${r.delai} s` : 'pas de passe'} — ≤ 45°, tourné ≥ 90°, freiné (< 2,8 m/s), des refus nommés, en ≤ 2,5 s`,
    !!r.ev && r.to && Math.abs(r.ev.out) <= 45 && r.tour >= 90 && r.vMin < 2.8 && r.refus > 0 && r.delai <= 2.5 && r.ev.tech !== 'passe-pivot' && r.ev.tech !== 'talonnade');
  const n = fixture({ orientationPasse: null });
  ok(`orientationPasse:null — le même lancé : ${n.ev ? `${n.ev.tech} à ${Math.abs(n.ev.out).toFixed(0)}° du regard, tourné ${n.tour?.toFixed(0)}°, pointe minimale ${n.vMin.toFixed(1)} m/s` : 'pas de passe en 4 s'} (hier : il court sur son élan, le receveur sort de portée ou la frappe part à moitié tournée)`,
    !n.ev || Math.abs(n.ev.out) > 45 || n.tour < 90);
}

console.log('— (d) la fixture pressée : le pressé joue sans attendre —');
{
  const r = fixture({ passements: null }, { presse: 1.7 });
  ok(`LE PRESSEUR QUI CHASSE À 1,7 m (derrière-droite) : ${r.ev ? `${r.ev.tech} en ${r.delai} s, ${r.refus} refus 'orientation'` : 'pas de passe en 4 s'} — la passe part SANS refus d'orientation (pressé : le geste d'hier, le talon si la sortie est derrière ; le tempo du pressé n'est pas la loi de ce banc)`,
    !!r.ev && r.refus === 0);
}

console.log('— (e) la technique choisie pour le tour —');
{
  const KP = { ...KO, marge: 0.6 };
  const tour = (turn, antic) => Math.min(turn, KP.fenetre) * Math.PI / 180 + KP.marge * 4 * antic;
  ok(`LA FENÊTRE D'UN CANDIDAT : passe (turn 40, armé 0,38 s) couvre ${(tour(40, 0.38) * 180 / Math.PI).toFixed(0)}°, passe-rapide (35, 0,22 s) ${(tour(35, 0.22) * 180 / Math.PI).toFixed(0)}°, pivot plafonné (150 → ${KP.fenetre}, 0,52 s) ${(tour(150, 0.52) * 180 / Math.PI).toFixed(0)}° — la posée prend le relais de la rapide au-delà de ~65°`,
    tour(40, 0.38) > tour(35, 0.22) && tour(35, 0.22) * 180 / Math.PI < 70 && tour(40, 0.38) * 180 / Math.PI > 85);
}

console.log(`orientation : ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
