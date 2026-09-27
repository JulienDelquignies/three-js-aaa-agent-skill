// rondo-enchaine.js — L'ATELIER ENCHAÎNEMENT (match11.html?atelier=enchaine[&ralenti=0.5][&conduite=2.5][&lat=12][&passe=14]). Retour du
// 27/09 : « fais un atelier contrôle enchaîné par la conduite puis une passe latérale — l'enchaînement est catastrophique ». Le MÊME moteur
// et les MÊMES lois (match-sim, le rendu du match) ; l'atelier ne fait que DISPOSER qui peut recevoir, à chaque temps :
//   1. le passeur P donne au receveur R (passe m devant lui) — R est son seul coéquipier en jeu ;
//   2. R contrôle, puis CONDUIT (conduite s — la barre de passe hors d'atteinte, personne en face) ;
//   3. le latéral M entre en jeu à lat m sur le côté, à hauteur de R, la barre retombe : R donne à M.
// Les autres sont garés hors jeu (expulse, réécrits chaque image) ; le gardien adverse reste dans son but, loin. Chaque cycle se clôt au
// contrôle de M (+1,2 s) ou au bout de 12 s. Caméra de côté sur R ; HUD ; window.__atelier.enchaine.log (les temps de chaque maillon).
import * as THREE from 'three/webgpu';

const h = Math.hypot;

export function enchaineInit(scene, A) {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const c = scene._mcfg;
  const E = A.enchaine = { ralenti: Number(q.get('ralenti') ?? 0.5), conduite: Number(q.get('conduite') ?? 2.5), lat: Number(q.get('lat') ?? 12), passe: Number(q.get('passe') ?? 14), recul: Number(q.get('recul') ?? 4.5),
    cycle: 0, log: [], cur: null, park: new Map(), bar0: c.intentBarCalm, hold0: c.holdMax };
  if (c.dribble) c.dribble = { ...c.dribble, volume: 0 };   // pas de geste de dribble : l'enchaînement nu (contrôle, conduite, passe)
  try { place(scene, E); } catch (err) { E.erreur = String(err?.stack ?? err); if (typeof window !== 'undefined') window.__enchaineErr = E.erreur; }
}

function garer(q, x, z, E) { E.park.set(q.id, [x, z]); q.expulse = true; q._exit = [x, z]; q.p = [x, 0, z]; q.v = [0, 0]; q.act = null; q.intent = null; }
function lacher(q) { q.expulse = false; q._exit = null; q.act = null; q.down = 0; }

/** La mise en place d'un cycle. */
function place(scene, E) {
  const st = scene.state, P = st.players, cfg = scene._mcfg;
  const sg = Math.sign(st.pitch.attackGoal(0).x || 1), z0 = -6 + 6 * (E.cycle % 3), x0 = -sg * 34;   // dans NOTRE moitié (mesuré : à la médiane, R était HORS JEU — un seul adversaire derrière lui, le gardien — et P dégageait)
  const R = P.find((q) => q.team === 0 && !q.keeper && q.post === 8) ?? P.find((q) => q.team === 0 && !q.keeper);
  const Pp = P.find((q) => q.team === 0 && !q.keeper && q !== R && q.post === 4) ?? P.find((q) => q.team === 0 && !q.keeper && q !== R);
  const M = P.find((q) => q.team === 0 && !q.keeper && q !== R && q !== Pp && q.post === 7) ?? P.find((q) => q.team === 0 && !q.keeper && q !== R && q !== Pp);
  E.sg = sg; E.R = R.id; E.P = Pp.id; E.M = M.id; E.park.clear();
  let k = 0;
  for (const q of P) {
    if (q === R || q === Pp) continue;
    if (q.team === 1 && q.keeper) continue;   // le gardien adverse garde son but (à 60 m)
    garer(q, -40 + 8 * (k++ % 11), (q.team === 0 ? -1 : 1) * (st.pitch.hz - 2), E);
  }
  E.parkM = E.park.get(M.id);
  lacher(R); lacher(Pp);
  st.restart = null; st.pass = null; st.phase = 'carry'; st.possession = { team: 0, carrier: Pp.id }; st.hold = 0;
  Pp.p = [x0, 0, z0]; Pp.v = [0, 0]; Pp.speed = 0; Pp.yaw = Math.atan2(0, sg); Pp.intent = null; Pp._dribAt = -99;
  R.p = [x0 + sg * E.passe, 0, z0]; R.v = [0, 0]; R.speed = 0; R.yaw = Math.atan2(0, -sg); R.intent = null;
  st.ball.restart([x0 + sg * 0.45, 0.11, z0], { cause: 'coup-franc' });
  st.ball.possess(Pp.id);
  cfg.intentBarCalm = E.bar0; cfg.holdMax = E.hold0;
  E.t0 = st.t; E.phase = 'passe1'; E.cur = { cycle: ++E.cycle, t0: st.t };
}

/** Les événements : les maillons de la chaîne, datés. */
export function enchaineEvent(scene, A, e) {
  const E = A.enchaine, st = scene.state, cur = E?.cur; if (!cur) return;
  const t = +(st.t - E.t0).toFixed(2);
  if (e.type === 'windup' && e.by === E.P && cur.w1 == null) cur.w1 = t;
  if (e.type === 'pass' && e.by === E.P && cur.p1 == null) { cur.p1 = t; cur.to1 = e.to; }
  if ((e.type === 'control' || e.type === 'receive') && e.by === E.R && cur.c1 == null) { cur.c1 = t; cur.tech1 = e.tech ?? e.move ?? e.type; }
  if (e.type === 'touche' && e.by === E.R && cur.c1 != null) (cur.touches ??= []).push(t);
  if (e.type === 'windup' && e.by === E.R && cur.c1 != null && cur.w2 == null) { cur.w2 = t; cur.move2 = e.move; }
  if (e.type === 'pass' && e.by === E.R && cur.p2 == null) { cur.p2 = t; cur.to2 = e.to; }
  if ((e.type === 'control' || e.type === 'receive') && e.by === E.M && cur.c2 == null) { cur.c2 = t; E.fin = st.t + 1.2; }
  if (e.type === 'turnover') cur.perdu = t;
}

/** Chaque image : les garés restent garés, les temps de la chaîne, la caméra de côté, le HUD. */
export function enchaineUpdate(scene, A) {
  const E = A.enchaine, st = scene.state, P = st.players, cfg = scene._mcfg; A.now = st.t;
  if (!E.cur) return false;
  for (const [id, [x, z]] of E.park) { const q = P[id]; q.p = [x, 0, z]; q.v = [0, 0]; q.speed = 0; q.act = null; }
  const R = P[E.R], Pp = P[E.P], M = P[E.M], t = st.t - E.t0, cur = E.cur;
  // 1 → 2 : le passeur a donné, il sort (R n'a plus que lui-même) ; R contrôle : la barre hors d'atteinte, il CONDUIT
  if (E.phase === 'passe1' && cur.p1 == null && st.possession?.carrier === E.P) st._calmHold = Math.min(st._calmHold ?? 0.5, 0.5);   // P donne vite (la tenue calme tirait 9-11 s)
  if (E.phase === 'passe1' && cur.p1 != null) { E.phase = 'vol'; }
  if (E.phase === 'vol' && cur.c1 != null) { E.phase = 'conduite'; garer(Pp, -40, -(st.pitch.hz - 2), E); cfg.intentBarCalm = 99; cfg.holdMax = 99; }
  // 2 → 3 : le latéral entre à hauteur, la barre retombe — la passe latérale
  if (E.phase === 'conduite' && t - cur.c1 >= E.conduite) {
    E.phase = 'laterale'; E.park.delete(M.id); lacher(M);
    const v = h(R.v[0], R.v[1]), ux = v > 0.5 ? R.v[0] / v : E.sg, uz = v > 0.5 ? R.v[1] / v : 0, cote = R.p[2] > 0 ? -1 : 1;
    M.p = [R.p[0] - uz * cote * E.lat + ux * 1.5, 0, R.p[2] + ux * cote * E.lat + uz * 1.5]; M.v = [ux * v, uz * v]; M.yaw = Math.atan2(uz, ux);
    cfg.intentBarCalm = E.bar0; cur.ordre = +t.toFixed(2);   // holdMax reste hors d'atteinte : R a déjà tenu 2,5 s — le rétablir le jetait dans l'IMPROVISATION (le plan sans le temps : 'technique', 'ancre', puis la passe rapide de l'urgence)
  }
  // la trace de R (pour les sondes) : la vitesse, le cap, l'acte, la couche de geste
  (cur.trace ??= []).push([+t.toFixed(3), +h(R.v[0], R.v[1]).toFixed(2), +R.yaw.toFixed(3), R.act?.id ?? null, st.phase, +h(st.ball.p[0] - R.p[0], st.ball.p[2] - R.p[2]).toFixed(2)]);
  if (cur.trace.length > 2000) cur.trace.shift();
  if ((E.fin != null && st.t >= E.fin) || t > 12 || (cur.perdu != null && t - cur.perdu > 0.8)) {
    cur.issue = cur.c2 != null ? 'ok' : cur.p2 != null ? 'passe ratée' : cur.c1 != null ? 'pas de passe' : 'pas de contrôle';
    delete cur.trace; E.log.push(cur); E.fin = null; place(scene, E);
  }
  let pris = false;
  if (scene.cam && !scene.free) {
    const f = E.phase === 'passe1' ? Pp : R, v = h(f.v[0], f.v[1]);
    const ux = v > 0.5 ? f.v[0] / v : E.sg, uz = v > 0.5 ? f.v[1] / v : 0;
    const s = f.p[2] > 0 ? 1 : -1;   // la caméra du côté de la ligne la plus proche, regard vers le centre : le latéral entre dans le cadre
    const want = new THREE.Vector3(f.p[0] + ux * 0.8, 1.3, f.p[2] + s * E.recul);
    scene.cam.position.lerp(want, 0.12);
    const look = new THREE.Vector3(f.p[0] + ux * 0.6, 0.7, f.p[2] - s * 0.5);
    E._look = E._look ? E._look.lerp(look, 0.2) : look; scene.cam.lookAt(E._look); pris = true;
  }
  if (A.hud) {
    const f = (x) => x == null ? '—' : x.toFixed(2);
    A.hud.textContent = `ATELIER ENCHAÎNEMENT — contrôle → conduite ${E.conduite} s → passe latérale (${E.lat} m) · ralenti ×${E.ralenti}\n`
      + `cycle ${cur.cycle} [${E.phase}] : passe ${f(cur.p1)} · contrôle ${f(cur.c1)}${cur.tech1 ? ` (${cur.tech1})` : ''} · touches ${cur.touches?.length ?? 0} · armé ${f(cur.w2)}${cur.move2 ? ` (${cur.move2})` : ''} · passe ${f(cur.p2)} · reçue ${f(cur.c2)}\n`
      + `${E.log.length} cycles : ${E.log.filter((x) => x.issue === 'ok').length} complets`;
  }
  return pris;
}

/** Le pas de temps : le ralenti de l'atelier. */
export function enchaineDt(A, dt) { return dt * (A.enchaine?.ralenti ?? 1); }
