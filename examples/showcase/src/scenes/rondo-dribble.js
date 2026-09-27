// rondo-dribble.js — L'ATELIER DRIBBLE (match11.html?atelier=dribble[&geste=passement|crochet|rateau|doubleContact|petitPont|roulette|
// frappeFeinte|tout][&ralenti=0.5][&v=3.5][&ecart=6]). Retour du 27/09 : « tu peux pas faire une scène exprès ? » — le passement en course
// n'arrivait qu'une fois par 5-10 minutes de match. Le MÊME moteur et les MÊMES lois (match-sim, skills-sim, le rendu du match) ; l'atelier
// MET EN SCÈNE une situation en boucle : un attaquant lancé à v m/s, ballon au pied, face à un défenseur à ecart m qui l'attend ; les 20 autres
// garés loin le long des lignes (réécrits chaque image) ; la tentative du geste choisi poussée (varieteGestes.poids, passementLance), les autres
// coupés (poids 0) ; le jeu de passe éteint (barre d'intention hors d'atteinte) pour que le duel se joue. Chaque cycle se clôt 1,5 s après le
// geste, à la perte, ou au bout de 7 s, puis se remet en place. Caméra de côté au ras du sol ; HUD ; window.__atelier.dribble.log.
import * as THREE from 'three/webgpu';

const h = Math.hypot;
const GESTES = ['passement', 'crochet', 'rateau', 'doubleContact', 'petitPont', 'roulette', 'frappeFeinte', 'semelle', 'feinte'];

export function dribbleInit(scene, A) {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const geste = q.get('geste') || 'passement', c = scene._mcfg;
  const D = A.dribble = { geste, ralenti: Number(q.get('ralenti') ?? 0.5), v: Number(q.get('v') ?? 3.5), ecart: Number(q.get('ecart') ?? 6), cycle: 0, t0: null, fin: null, log: [], cur: null, park: new Map() };
  // la tentative du geste choisi poussée, les autres coupés ; le jeu de passe éteint (le duel se joue)
  if (geste !== 'tout') { const poids = {}; for (const g of GESTES) poids[g] = g === geste ? 6 : 0; c.varieteGestes = { ...(c.varieteGestes ?? {}), poids }; }
  c.passementLance = { ...(c.passementLance ?? {}), course: 40, multi: 3 };
  c.intentBarCalm = 99; c.holdMax = 99;
  try { mettreEnPlace(scene, D); } catch (err) { D.erreur = String(err?.stack ?? err); if (typeof window !== 'undefined') window.__dribbleErr = D.erreur; }
}

/** La mise en place d'un cycle : l'attaquant lancé face au défenseur, les autres garés. */
function mettreEnPlace(scene, D) {
  const st = scene.state, P = st.players;
  const att = P.find((q) => q.team === 0 && !q.keeper && q.post === 8) ?? P.find((q) => q.team === 0 && !q.keeper);
  const def = P.find((q) => q.team === 1 && !q.keeper && q.post === 1) ?? P.find((q) => q.team === 1 && !q.keeper);
  const sg = Math.sign(st.pitch.attackGoal(0).x || 1), z0 = -8 + 4 * (D.cycle % 3);
  D.att = att.id; D.def = def.id; D.park.clear();
  let k = 0;
  for (const q of P) {
    if (q === att || q === def) continue;
    const bord = q.team === 0 ? -1 : 1, x = -40 + 8 * (k++ % 11);
    D.park.set(q.id, [x, bord * (st.pitch.hz - 2)]);
  }
  st.restart = null; st.pass = null; st.phase = 'carry'; st.possession = { team: 0, carrier: att.id }; st.hold = 1;
  att.p = [-sg * 4, 0, z0]; att.v = [sg * D.v, 0]; att.speed = D.v; att.yaw = Math.atan2(0, sg); att.act = null; att.intent = null; att.down = 0; att._skillCd = {};
  def.p = [-sg * 4 + sg * D.ecart, 0, z0]; def.v = [0, 0]; def.speed = 0; def.yaw = Math.atan2(0, -sg); def.act = null; def.down = 0;
  st.ball.restart([att.p[0] + sg * 0.45, 0.11, z0], { cause: 'coup-franc' });   // le ballon ne s'écrit pas : une remise nommée (ball-body — les causes sont celles du règlement ; l'atelier replace le ballon comme un coup franc rapide)
  st.ball.possess(att.id);
  D.t0 = st.t; D.fin = null; D.cur = { cycle: ++D.cycle, t: st.t, geste: null };
}

/** Les événements : le geste joué, ses tours, s'il a mordu. */
export function dribbleEvent(scene, A, e) {
  const D = A.dribble, st = scene.state; if (!D?.cur) return;
  if (e.type === 'skill' && e.by === D.att && !/-vendu$/.test(e.kind ?? '')) { D.cur.geste = e.kind; D.cur.tours = e.tours ?? null; D.cur.enCourse = e.enCourse ?? null; D.cur.v = h(st.players[D.att].v[0], st.players[D.att].v[1]); D.fin ??= st.t + 1.8; }
  if (e.type === 'skill' && e.by === D.att && /-vendu$/.test(e.kind ?? '')) D.cur.mordu = (e.bitten?.length ?? 0) > 0;
}

/** Chaque image : les garés restent garés, le cycle se clôt et repart, la caméra de côté, le HUD. */
export function dribbleUpdate(scene, A) {
  const D = A.dribble, st = scene.state, P = st.players; A.now = st.t;
  for (const [id, [x, z]] of D.park) { const q = P[id]; q.p = [x, 0, z]; q.v = [0, 0]; q.speed = 0; q.act = null; }
  const att = P[D.att], perdu = st.possession?.team === 1 || st.restart != null;   // perdu : la défense l'a (un ballon qui file devant le pied reste à lui)
  if ((D.fin != null && st.t >= D.fin) || perdu && st.t - D.t0 > 0.5 || st.t - D.t0 > 7) {
    D.cur.issue = D.cur.geste ? (perdu ? 'perdu' : 'gardé') : perdu ? 'perdu sans geste' : 'pas de geste';
    D.log.push(D.cur); mettreEnPlace(scene, D);
  }
  let pris = false;
  if (scene.cam && !scene.free) {
    const v = h(att.v[0], att.v[1]), ux = v > 0.5 ? att.v[0] / v : Math.cos(att.yaw), uz = v > 0.5 ? att.v[1] / v : Math.sin(att.yaw);
    const want = new THREE.Vector3(att.p[0] + uz * 4.8 + ux * 0.6, 1.25, att.p[2] - ux * 4.8 + uz * 0.6);
    scene.cam.position.lerp(want, 0.15);
    const look = new THREE.Vector3(att.p[0] + ux * 0.4, 0.6, att.p[2] + uz * 0.4);
    D._look = D._look ? D._look.lerp(look, 0.25) : look; scene.cam.lookAt(D._look); pris = true;
  }
  if (A.hud) {
    const L = D.log, faits = L.filter((x) => x.geste), c = D.cur;
    const par = {}; for (const x of faits) par[x.geste] = (par[x.geste] ?? 0) + 1;
    A.hud.textContent = `ATELIER DRIBBLE [${D.geste}] — ralenti ×${D.ralenti}, attaquant lancé à ${D.v} m/s, défenseur à ${D.ecart} m\n`
      + `cycle ${c.cycle}${c.geste ? ` : ${c.geste}${c.tours ? ` ${c.tours} tour(s)` : ''}${c.enCourse ? ' en course' : ''}${c.mordu != null ? (c.mordu ? ' — défenseur MORDU' : ' — pas mordu') : ''}` : ' : …'}\n`
      + `${faits.length} gestes sur ${L.length} cycles : ${Object.entries(par).map(([k, n]) => `${k} ${n}`).join(', ') || '—'} · mordus ${faits.filter((x) => x.mordu).length}`;
  }
  return pris;
}

/** Le pas de temps : le ralenti de l'atelier. */
export function dribbleDt(A, dt) { return dt * (A.dribble?.ralenti ?? 1); }
