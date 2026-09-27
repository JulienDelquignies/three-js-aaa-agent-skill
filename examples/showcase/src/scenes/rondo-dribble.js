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
// LE SCÉNARIO PAR GESTE (27/09 : « fais pareil pour les autres gestes ») — chaque geste a SA situation de déclenchement dans skills-sim : le crochet
// un défenseur qui FERME la course devant (fermeture relative ≥ 0,8 m/s, 1-2,3 m), le râteau une CHARGE de face (≥ 1,5 m/s, ≤ 1,45 m), le double
// contact un défenseur qui SE JETTE (≥ 2,2 m/s, 0,9-2,1 m), le petit pont un GLISSEUR en pas chassés (0,8-1,8 m), la roulette un POURSUIVANT en
// diagonale (≥ 0,8 m/s), la feinte de frappe un CONTREUR devant le but (≤ 25 m). La feinte (de PASSE) n'a pas de scénario :
// elle vit dans une intention de passe (receveur, ancre) — mesuré : un porteur scripté vers son receveur perdait le ballon, laissé à lui il
// tournait le dos au bloqueur ; geste SUR PLACE comme la feinte de frappe (0-9 cm d'appui mesurés), couvert par la même ancre. Un défenseur qui attend n'en déclenche aucun (mesuré : 0 crochet
// en 48 s). Le défenseur est SCRIPTÉ jusqu'au geste (ou 2,5 s), puis la sim le reprend. v, ecart : l'attaquant et l'écart initial.
const SCEN = {
  passement: { v: 3.5, ecart: 6, def: 'attend' }, semelle: { v: 0.6, ecart: 4, def: 'attend' }, feinte: { v: 2.5, ecart: 5, def: 'attend' }, tout: { v: 3.5, ecart: 6, def: 'attend' },
  crochet: { v: 3.5, ecart: 4.5, def: 'charge', vDef: 2.5 }, rateau: { v: 1.2, ecart: 3.2, def: 'charge', vDef: 4.2 },
  doubleContact: { v: 1.8, ecart: 3.4, def: 'charge', vDef: 4.8 }, petitPont: { v: 0.7, ecart: 2.4, lat: 0.6, def: 'glisse', vDef: 2.0 },
  roulette: { v: 3.0, ecart: -1.0, lat: 1.1, def: 'poursuit', vDef: 4.0 }, frappeFeinte: { v: 1.6, ecart: 3.0, def: 'attend', but: 23 },
};

export function dribbleInit(scene, A) {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
  const geste = q.get('geste') || 'passement', c = scene._mcfg;
  const Sc = SCEN[geste] ?? SCEN.passement;
  const D = A.dribble = { geste, sc: Sc, ralenti: Number(q.get('ralenti') ?? 0.5), v: Number(q.get('v') ?? Sc.v), ecart: Number(q.get('ecart') ?? Sc.ecart), cycle: 0, t0: null, fin: null, log: [], cur: null, park: new Map() };
  // la tentative du geste choisi poussée, les autres coupés ; le jeu de passe éteint (le duel se joue)
  if (geste !== 'tout') { const poids = {}; for (const g of GESTES) poids[g] = g === geste ? 20 : 0; c.varieteGestes = { ...(c.varieteGestes ?? {}), poids }; }
  c.passementLance = { ...(c.passementLance ?? {}), course: 40, multi: 3 };
  if (geste !== 'tout' && geste !== 'passement' && c.passements) c.passements = { ...c.passements, plancher: 0 };
  if (geste !== 'tout' && geste !== 'crochet' && c.decalage) c.decalage = { ...c.decalage, plancher: 0 };   // …et celui du crochet en course (le même contournement)   // le plancher d'appétit du passement contournait le poids 0 (mesuré : geste=crochet jouait 7 passements sur 8)
  c.intentBarCalm = 99; c.holdMax = 99;
  // la cadence du dribble (un geste par 60 s et par joueur — mesuré : 1 crochet puis plus rien sur 10 cycles) et le volume (0,35) sont des lois du MATCH ; l'atelier rejoue le duel
  if (c.dribble) c.dribble = { ...c.dribble, cadence: 0, volume: Math.max(3, c.dribble.volume ?? 1) };
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
    q.expulse = true; q._exit = [x, bord * (st.pitch.hz - 2)];   // HORS DU JEU (mesuré : le porteur donnait au garé à 30 m — « receive 6 » —, la tenue ne l'en empêchait pas) : ni cible de passe, ni presseur
  }
  st.restart = null; st.pass = null; st.phase = 'carry'; st.possession = { team: 0, carrier: att.id }; st.hold = 1;
  const x0 = D.sc.but ? st.pitch.attackGoal(0).x - sg * D.sc.but : -sg * 4, zA = D.sc.but ? 0 : z0;
  att.p = [x0, 0, zA]; att.v = [sg * D.v, 0]; att.speed = D.v; att.yaw = Math.atan2(0, sg); att.act = null; att.intent = null; att.down = 0; att._skillCd = {}; att._dribAt = -99;
  def.p = [x0 + sg * D.ecart, 0, zA + (D.sc.lat ?? 0)]; def.v = [0, 0]; def.speed = 0; def.yaw = D.sc.def === 'poursuit' ? Math.atan2(0, sg) : Math.atan2(0, -sg); def.act = null; def.down = 0;
  st.ball.restart([att.p[0] + sg * 0.45, 0.11, zA], { cause: 'coup-franc' });   // le ballon ne s'écrit pas : une remise nommée (ball-body — les causes sont celles du règlement ; l'atelier replace le ballon comme un coup franc rapide)
  st.ball.possess(att.id);
  D.t0 = st.t; D.fin = null; D._gdir = null; D.cur = { cycle: ++D.cycle, t: st.t, geste: null };
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
  // le défenseur SCRIPTÉ jusqu'au geste (ou 2,5 s) : il charge, glisse ou poursuit — écrit comme les garés, la sim le reprend ensuite
  const dtS = Math.max(0, Math.min(0.05, st.t - (D._tPrev ?? st.t))); D._tPrev = st.t;
  const df = P[D.def], at = P[D.att];
  if (D.sc.def !== 'attend' && !D.cur.geste && st.t - D.t0 < 2.5 && dtS > 0) {
    let ux, uz;
    if (D.sc.def === 'charge') { const dx = at.p[0] - df.p[0], dz = at.p[2] - df.p[2], d = h(dx, dz) || 1; if (d < 0.9) { ux = 0; uz = 0; } else { ux = dx / d; uz = dz / d; } }
    else if (D.sc.def === 'glisse') {   // les pas chassés DEVANT lui, en navette (± 0,7 m de son axe) : le glisseur reste dans le cône du pont (40°)
      const off = df.p[2] - at.p[2]; D._gdir ??= -Math.sign(D.sc.lat ?? 1); if (off * D._gdir > 0.7) D._gdir = -D._gdir;
      const dx = at.p[0] - df.p[0], d = Math.abs(dx); ux = d > 1.9 ? 0.35 * Math.sign(dx) : 0; uz = D._gdir; const n = h(ux, uz); ux /= n; uz /= n; }
    else { const dx = at.p[0] - df.p[0], dz = at.p[2] - df.p[2], d = h(dx, dz) || 1; const sgA = Math.sign(at.v[0] || 1); ux = 0.8 * sgA + 0.2 * dx / d; uz = 0.6 * dz / d; const n = h(ux, uz) || 1; ux /= n; uz /= n; }
    const vD = D.sc.vDef ?? 0; df.v = [ux * vD, uz * vD]; df.speed = vD; df.p = [df.p[0] + ux * vD * dtS, 0, df.p[2] + uz * vD * dtS];
    if (D.sc.def !== 'glisse' && vD > 0 && (ux || uz)) df.yaw = Math.atan2(uz, ux);
  }
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
    A.hud.textContent = `ATELIER DRIBBLE [${D.geste}] — ralenti ×${D.ralenti}, attaquant à ${D.v} m/s, défenseur qui ${({ attend: 'attend', charge: 'charge', glisse: 'glisse', poursuit: 'poursuit' })[D.sc.def]} (${D.ecart} m)\n`
      + `cycle ${c.cycle}${c.geste ? ` : ${c.geste}${c.tours ? ` ${c.tours} tour(s)` : ''}${c.enCourse ? ' en course' : ''}${c.mordu != null ? (c.mordu ? ' — défenseur MORDU' : ' — pas mordu') : ''}` : ' : …'}\n`
      + `${faits.length} gestes sur ${L.length} cycles : ${Object.entries(par).map(([k, n]) => `${k} ${n}`).join(', ') || '—'} · mordus ${faits.filter((x) => x.mordu).length}`;
  }
  return pris;
}

/** Le pas de temps : le ralenti de l'atelier. */
export function dribbleDt(A, dt) { return dt * (A.dribble?.ralenti ?? 1); }
