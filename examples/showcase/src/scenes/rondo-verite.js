// rondo-verite.js — L'ATELIER DE LA ZONE DE VÉRITÉ (match11.html?match&full&atelier=verite). Suite de la note 443 : les buts en trop
// viennent d'occasions trop faciles (au tir, 0 défenseur dans le cône 68 %, 1 défenseur plus près du but que le tireur, 8,5 % de tirs
// contrés contre 25-30 au réel) — un chantier du BLOC DÉFENSIF dans les 25 derniers mètres, qu'il faut VOIR. Le même match, les mêmes
// lois : l'atelier suit chaque attaque dont le porteur entre à moins de zone m du but adverse, dessine au sol le CÔNE de tir (ballon →
// poteaux) et l'axe ballon → but, et mesure image par image des grandeurs NON RARES (la leçon de la note 443 : les buts sont dans le
// bruit sur 4 matchs) : défenseurs dans le cône, plus près du but que le ballon, dans le couloir central, le presseur (distance,
// goal-side), la largeur de la ligne. Suspendu (window.__atelier.arret) à l'entrée, à l'ARMÉ du tir, au tir et à l'issue ; le relevé
// de chaque attaque dans window.__atelier.log. Lecture de l'état sim, jamais d'écriture.
import * as THREE from 'three/webgpu';

const h = Math.hypot;

/** Les grandeurs du bloc à cet instant, pour l'équipe qui défend contre le porteur `c`. Pure (lecture). */
export function blocDe(st, c) {
  const g = st.pitch.attackGoal(c.team), gx = g.x, half = st.pitch.goalHalf, b = st.ball.p;
  const defs = st.players.filter((q) => q.team !== c.team && !q.keeper && q.down <= 0);
  const a1 = Math.atan2(-half - 0.3 - b[2], gx - b[0]), a2 = Math.atan2(half + 0.3 - b[2], gx - b[0]), lo = Math.min(a1, a2), hi = Math.max(a1, a2);
  const dB = h(gx - b[0], b[2]);
  let cone = 0, gs = 0, couloir = 0, press = null, pd = Infinity;
  for (const q of defs) {
    const dq = h(gx - q.p[0], q.p[2]); if (dq < dB) gs++;
    const ang = Math.atan2(q.p[2] - b[2], q.p[0] - b[0]), devant = Math.sign(q.p[0] - b[0]) === Math.sign(gx - b[0]) && Math.abs(q.p[0] - b[0]) < Math.abs(gx - b[0]);
    if (devant && ang >= lo && ang <= hi) cone++;
    if (dq < dB && Math.abs(q.p[2]) < 9) couloir++;
    const d = h(q.p[0] - c.p[0], q.p[2] - c.p[2]); if (d < pd) { pd = d; press = q; }
  }
  const pressGS = press ? h(gx - press.p[0], press.p[2]) < h(gx - c.p[0], c.p[2]) : false;
  const bk = [...defs].sort((x, y) => h(gx - x.p[0], x.p[2]) - h(gx - y.p[0], y.p[2])).slice(0, 4);
  const largeur = bk.length ? Math.max(...bk.map((q) => q.p[2])) - Math.min(...bk.map((q) => q.p[2])) : 0;
  return { dB, cone, gs, couloir, pd, pressGS, pressJob: press?.job ?? '-', largeur };
}

export function veriteInit(scene, A) {
  const V = { zone: 25, cur: null, log: [] };
  const mk = (c) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.85 })); l.frustumCulled = false; l.visible = false; scene.scene.add(l); return l; };
  V.coneG = mk(0xff5050); V.coneD = mk(0xff5050); V.axe = mk(0xffd400);
  A.verite = V; A.log = V.log;
  return V;
}

function ligne(l, a, b) { const p = l.geometry.attributes.position; p.setXYZ(0, a[0], 0.04, a[1]); p.setXYZ(1, b[0], 0.04, b[1]); p.setXYZ(2, b[0], 0.04, b[1]); p.needsUpdate = true; l.visible = true; }

function clore(A, V, fin) {
  const c = V.cur; if (!c) return; c.fin = fin; c.tFin = A.now; V.log.push(c); V.cur = null; V.dernier = c;
  V.coneG.visible = V.coneD.visible = V.axe.visible = false;
}

/** Les événements : l'armé d'un tir, le tir, et les issues. */
export function veriteEvent(scene, A, e) {
  const V = A.verite, st = scene.state, c = V?.cur; if (!c) return;
  if (e.type === 'windup' && e.by === c.id && st.players[e.by]?.act?.payload?.choice?.shot && !c.arme) { c.arme = { t: st.t, ...blocDe(st, st.players[c.id]) }; A.gele = A.arret ? 'armé' : A.gele; }
  else if (e.type === 'shot' && e.by === c.id) { c.tir = { t: st.t, kind: e.kind, ...blocDe(st, st.players[c.id]) }; if (A.arret) A.gele = 'tir'; }
  else if (c.tir && (e.type === 'but' || e.type === 'arrêt' || e.type === 'sortie' || e.type === 'contre' || (e.by != null && e.by !== c.id && ['control', 'receive', 'tête', 'volée', 'clearance'].includes(e.type)))) {
    const q = e.by != null ? st.players[e.by] : null;
    c.issue = e.type === 'but' ? 'BUT' : e.type === 'arrêt' ? 'arrêt' : e.type === 'sortie' ? 'hors cadre' : e.type === 'contre' || (q && !q.keeper && q.team !== st.players[c.id].team) ? 'contré' : q?.keeper ? 'gardien' : 'repris';
    if (A.arret) A.gele = 'issue'; clore(A, V, c.issue);
  }
}

/** Chaque image : ouvre/ferme le suivi d'une attaque, dessine le cône, mesure, la caméra, le HUD. Rend true si la caméra est prise. */
export function veriteUpdate(scene, A) {
  const V = A.verite, st = scene.state; A.now = st.t;
  const id = st.possession?.carrier ?? -1, car = id >= 0 ? st.players[id] : null;
  if (!V.cur && car && !car.keeper && !st.restart) {
    const g = st.pitch.attackGoal(car.team);
    if (h(g.x - car.p[0], car.p[2]) < V.zone) { V.cur = { n: V.log.length + 1, id, team: car.team, t: st.t, entree: blocDe(st, car), images: 0, sCone: 0, sGs: 0, sCouloir: 0, sPd: 0 }; if (A.arret) A.gele = 'entrée'; }
  }
  const c = V.cur;
  if (c) {
    const car2 = st.players[c.id];
    if (!c.tir && (st.restart || (st.possession.carrier !== c.id && st.possession.team !== c.team))) clore(A, V, 'perdu');
    else if (!c.tir && st.possession.carrier !== c.id && st.possession.team === c.team) clore(A, V, 'passé');
    else if (c.tir && st.t - c.tir.t > 3) clore(A, V, 'tir sans issue lue');
    else {
      const m = blocDe(st, car2); c.images++; c.sCone += m.cone; c.sGs += m.gs; c.sCouloir += m.couloir; c.sPd += m.pd; c.m = m;
      const g = st.pitch.attackGoal(c.team), half = st.pitch.goalHalf, b = st.ball.p;
      ligne(V.coneG, [b[0], b[2]], [g.x, -half]); ligne(V.coneD, [b[0], b[2]], [g.x, half]); ligne(V.axe, [b[0], b[2]], [g.x, 0]);
    }
  }
  // la caméra : derrière le porteur, surélevée, vers le but (la défense se lit de face)
  const f = V.cur ?? (V.dernier && st.t - (V.dernier.tFin ?? -9) < 1.5 ? V.dernier : null);
  let pris = false;
  if (f && scene.cam && !scene.free) {
    const g = st.pitch.attackGoal(f.team), b = st.ball.p, gx = g.x - b[0], gz = -b[2], gl = h(gx, gz) || 1;
    const want = new THREE.Vector3(b[0] - gx / gl * 10, 7.5, b[2] - gz / gl * 10);
    scene.cam.position.lerp(want, A.gele ? 0.3 : 0.1);
    const look = new THREE.Vector3(b[0] + gx * 0.45, 0.5, b[2] + gz * 0.45);
    V._look = V._look ? V._look.lerp(look, 0.2) : look; scene.cam.lookAt(V._look); pris = true;
  }
  if (A.hud) {
    const F = (x, k = 1) => (x == null || !isFinite(x) ? '—' : x.toFixed(k));
    const L = V.log, tirs = L.filter((x) => x.tir), cur = V.cur;
    const ligneC = cur ? `attaque ${cur.n} en cours (porteur ${cur.id}) : à ${F(cur.m?.dB)} m du but · dans le cône ${cur.m?.cone ?? '—'} · plus près du but ${cur.m?.gs ?? '—'} · couloir central ${cur.m?.couloir ?? '—'} · presseur ${cur.m?.pressJob} à ${F(cur.m?.pd)} m ${cur.m?.pressGS ? '(goal-side)' : '(DÉPASSÉ)'} · ligne ${F(cur.m?.largeur, 0)} m` : 'en attente d\'une attaque dans les 25 m…';
    const d = L[L.length - 1];
    const ligneD = d ? `dernière (${d.n}) : ${d.fin}${d.tir ? ` · au tir ${F(d.tir.dB)} m, cône ${d.tir.cone}, plus près ${d.tir.gs}, presseur ${F(d.tir.pd)} m ${d.tir.pressGS ? 'goal-side' : 'dépassé'}` : ''}` : '';
    const moy = (A2, k) => A2.length ? A2.reduce((s, x) => s + x.tir[k], 0) / A2.length : null;
    const ligneS = L.length ? `${L.length} attaques : ${tirs.length} tirs (${L.filter((x) => x.fin === 'BUT').length} buts, ${L.filter((x) => x.fin === 'contré').length} contrés, ${L.filter((x) => x.fin === 'hors cadre').length} hors cadre) · au tir : cône ${F(moy(tirs, 'cone'))}, plus près du but ${F(moy(tirs, 'gs'))}, presseur goal-side ${tirs.length ? Math.round(100 * tirs.filter((x) => x.tir.pressGS).length / tirs.length) : '—'} %, distance ${F(moy(tirs, 'dB'))} m` : '';
    A.hud.textContent = `ATELIER ZONE DE VÉRITÉ${A.gele ? ` — suspendu : ${A.gele}` : ''}\n— rouge : le cône de tir (ballon → poteaux)   — jaune : l'axe ballon → but\n${ligneC}\n${ligneD}\n${ligneS}`;
  }
  return pris;
}
