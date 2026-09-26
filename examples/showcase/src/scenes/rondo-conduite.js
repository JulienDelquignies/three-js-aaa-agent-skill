// rondo-conduite.js — L'ATELIER CONDUITE & CONTRÔLE (match11.html?match&full&atelier=conduite). Retour du 27/09 : « j'ai vraiment un
// problème avec les contrôles et les conduites de balle — on dirait que les joueurs ne sont pas du tout amis avec le ballon ». Le même
// match, les mêmes lois, le même rendu : l'atelier REGARDE et MESURE, dans la sim ET à l'écran, contre les repères du football réel :
//   conduite — l'intervalle entre deux touches (trot 0,6-1,0 s ; sprint 1,0-1,6 s ; pressé 0,3-0,5 s), la distance ballon-corps
//   (trot 0,5-1,5 m devant ; sprint 3-6 m ; pressé < 0,6 m), et À L'ÉCRAN : le PIED au contact à chaque touche (< 0,25 m du ballon rendu) ;
//   contrôle — la vitesse du ballon absorbée (60-90 %), la balle à 0,5-1,5 m après 0,5 s, la 2e touche 0,4-0,8 s après, le pied au contact.
// Chaque touche et chaque contrôle s'inscrivent dans window.__atelier.log ; window.__atelier.bilan() rend la synthèse ; ?arret : le monde
// se suspend aux touches hors repère (window.__atelier.go() repart). Lecture de l'état sim et du rendu, jamais d'écriture.
import * as THREE from 'three/webgpu';
import { jugeInit, jugeImage, jugeTouche, jugeBilan } from './rondo-juge.js';   // l'arbitre visuel (téléportations, glisses, jambes étirées, allonge)

const h = Math.hypot;
const _f = new THREE.Vector3();

export const REPERES = {
  intervalle: { trot: [0.6, 1.0], sprint: [1.0, 1.6], presse: [0.3, 0.5] },
  distance: { trot: [0.5, 1.5], sprint: [3, 6], presse: [0, 0.6] },
  pied: 0.25, absorbe: [0.6, 0.9], apres05: [0.5, 1.5], deuxieme: [0.4, 0.8],
};

/** Le régime de conduite du porteur : pressé (un adversaire à < 3 m), sprint (≥ 5 m/s), trot sinon. Pure (lecture). */
function regimeDe(st, c) {
  const pr = Math.min(99, ...st.players.filter((q) => q.team !== c.team && q.down <= 0).map((q) => h(q.p[0] - c.p[0], q.p[2] - c.p[2])));
  const v = h(c.v[0], c.v[1]);
  return { reg: pr < 3 ? 'presse' : v >= 5 ? 'sprint' : 'trot', v, pr };
}

/** La distance du ballon RENDU au pied le plus proche du joueur rendu (os LeftFoot / RightFoot), en m. null sans squelette. */
function piedDe(scene, id) {
  const pl = scene.players?.[id], b = scene.ball?.position; if (!pl?.legs || !b) return null;
  let best = null;
  for (const f of ['left', 'right']) { const foot = pl.legs[f]?.foot; if (!foot) continue; foot.getWorldPosition(_f); const d = _f.distanceTo(b); if (best == null || d < best) best = d; }
  return best;
}

export function conduiteInit(scene, A) {
  const C = { log: [], ouverts: [], dernier: {}, suivi: null };
  A.conduite = C; A.log = C.log;
  A.bilan = () => bilanDe(C.log);
  C.juge = jugeInit(); A.juge = () => jugeBilan(C.juge);
  return C;
}

/** Les événements : la touche de conduite (sim 'touche' du porteur), le contrôle / la réception, et ce qui les clôt. */
export function conduiteEvent(scene, A, e) {
  const C = A.conduite, st = scene.state; if (!C || st.restart) return;
  const c = e.by != null ? st.players[e.by] : null; if (!c || c.keeper) return;
  if (e.type === 'touche' || ((e.type === 'control' || e.type === 'receive') && !e.miss)) jugeTouche(C.juge, scene, c.id, e.type);
  if (e.type === 'touche' && st.possession?.carrier === c.id) {
    const R = regimeDe(st, c), prev = C.dernier[c.id];
    const T = { k: 'touche', id: c.id, t: st.t, ...R, intervalle: prev && st.t - prev.t < 3 ? st.t - prev.t : null, dCorps: h(st.ball.p[0] - c.p[0], st.ball.p[2] - c.p[2]), pied: piedDe(scene, c.id), piedMin: null, fin: st.t + 0.15 };
    C.dernier[c.id] = { t: st.t }; C.ouverts.push(T); C.suivi = c.id;
    if (A.arret && T.intervalle != null && (T.intervalle > REPERES.intervalle[R.reg][1] * 1.5)) A.gele = `touche après ${T.intervalle.toFixed(2)} s (${R.reg})`;
  } else if ((e.type === 'control' || e.type === 'receive') && !e.miss) {
    const vIn = h(C._pv?.[0] ?? st.ball.v[0], C._pv?.[1] ?? st.ball.v[2]);
    const K = { k: 'contrôle', id: c.id, t: st.t, tech: e.tech ?? e.type, vIn, v02: null, a05: null, deuxieme: null, pied: piedDe(scene, c.id), piedMin: null, fin: st.t + 0.15, clos: st.t + 3 };
    C.ouverts.push(K); C.dernier[c.id] = { t: st.t, controle: K }; C.suivi = c.id;
  }
  // la 2e touche d'un contrôle : la première touche / passe / tir qui suit
  if (e.type === 'touche' || e.type === 'pass' || e.type === 'shot' || e.type === 'windup') {
    const K = C.ouverts.find((x) => x.k === 'contrôle' && x.id === c.id && x.deuxieme == null && st.t > x.t + 0.05);
    if (K) K.deuxieme = st.t - K.t;
  }
}

/** Chaque image : mesures ouvertes (le pied au contact dans ± 0,15 s, la vitesse absorbée, la balle à +0,5 s), caméra, HUD. */
export function conduiteUpdate(scene, A) {
  const C = A.conduite, st = scene.state; A.now = st.t;
  jugeImage(C.juge, scene);
  for (const x of C.ouverts) {
    const p = piedDe(scene, x.id); if (p != null && st.t <= x.fin) x.piedMin = Math.min(x.piedMin ?? Infinity, p);
    if (x.k === 'contrôle') {
      const q = st.players[x.id];
      if (x.v02 == null && st.t - x.t >= 0.2) x.v02 = h(st.ball.v[0], st.ball.v[2]);
      if (x.a05 == null && st.t - x.t >= 0.5) x.a05 = h(st.ball.p[0] - q.p[0], st.ball.p[2] - q.p[2]);
    }
  }
  C._pv = [st.ball.v[0], st.ball.v[2]];
  for (let i = C.ouverts.length - 1; i >= 0; i--) { const x = C.ouverts[i]; if (st.t > (x.k === 'contrôle' ? x.clos : x.fin)) { C.log.push(x); C.ouverts.splice(i, 1); } }
  if (C.log.length > 4000) C.log.splice(0, C.log.length - 4000);
  // la caméra : de côté, basse, sur le porteur suivi (le pied et le ballon se lisent)
  const id = st.possession?.carrier >= 0 && !st.players[st.possession.carrier].keeper ? st.possession.carrier : C.suivi;
  let pris = false;
  if (id != null && scene.cam && !scene.free) {
    const q = st.players[id], v = h(q.v[0], q.v[1]), ux = v > 0.5 ? q.v[0] / v : Math.cos(q.yaw ?? 0), uz = v > 0.5 ? q.v[1] / v : Math.sin(q.yaw ?? 0);
    const s = -Math.sign(q.p[2] || 1), want = new THREE.Vector3(q.p[0] - uz * s * 7.5 - ux * 2, 2.8, q.p[2] + ux * s * 7.5 - uz * 2);
    scene.cam.position.lerp(want, A.gele ? 0.3 : 0.1);
    const look = new THREE.Vector3((q.p[0] + st.ball.p[0]) / 2, 0.4, (q.p[2] + st.ball.p[2]) / 2);
    C._look = C._look ? C._look.lerp(look, 0.25) : look; scene.cam.lookAt(C._look); pris = true;
  }
  if (A.hud) A.hud.textContent = texteBilan(bilanDe(C.log), A.gele);
  return pris;
}

const Q = (a, p) => { const s = a.filter((x) => x != null && isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : null; };
const dans = (x, [a, b]) => x != null && x >= a && x <= b;

/** La synthèse contre les repères. Pure. */
export function bilanDe(log) {
  const T = log.filter((x) => x.k === 'touche'), K = log.filter((x) => x.k === 'contrôle'), B = {};
  for (const r of ['trot', 'sprint', 'presse']) {
    const A = T.filter((x) => x.reg === r);
    B[r] = { n: A.length, intervalle: Q(A.map((x) => x.intervalle), 0.5), distance: Q(A.map((x) => x.dCorps), 0.5), dansIntervalle: A.filter((x) => dans(x.intervalle, REPERES.intervalle[r])).length / Math.max(1, A.filter((x) => x.intervalle != null).length) };
  }
  const piedT = T.map((x) => x.piedMin ?? x.pied), piedK = K.map((x) => x.piedMin ?? x.pied);
  B.piedTouche = { p50: Q(piedT, 0.5), p90: Q(piedT, 0.9), ok: piedT.filter((d) => d != null && d <= REPERES.pied).length / Math.max(1, piedT.filter((d) => d != null).length) };
  const abs = K.filter((x) => x.v02 != null && x.vIn > 3).map((x) => 1 - x.v02 / x.vIn);
  B.controle = { n: K.length, absorbe: Q(abs, 0.5), dansAbsorbe: abs.filter((a) => dans(a, REPERES.absorbe)).length / Math.max(1, abs.length), a05: Q(K.map((x) => x.a05), 0.5), a05p90: Q(K.map((x) => x.a05), 0.9), dansA05: K.filter((x) => dans(x.a05, REPERES.apres05)).length / Math.max(1, K.filter((x) => x.a05 != null).length), deuxieme: Q(K.map((x) => x.deuxieme), 0.5), deuxiemeP90: Q(K.map((x) => x.deuxieme), 0.9), dansDeuxieme: K.filter((x) => dans(x.deuxieme, REPERES.deuxieme)).length / Math.max(1, K.filter((x) => x.deuxieme != null).length), piedP50: Q(piedK, 0.5), piedOk: piedK.filter((d) => d != null && d <= REPERES.pied).length / Math.max(1, piedK.filter((d) => d != null).length) };
  return B;
}

function texteBilan(B, gele) {
  const f = (x, k = 2) => x == null ? '—' : x.toFixed(k), pc = (x) => `${Math.round(100 * x)} %`, R = REPERES;
  const L = ['trot', 'sprint', 'presse'].map((r) => `${r.padEnd(6)} n ${String(B[r].n).padStart(3)} : intervalle p50 ${f(B[r].intervalle)} s (repère ${R.intervalle[r].join('-')}, dans le repère ${pc(B[r].dansIntervalle)}) · ballon-corps p50 ${f(B[r].distance)} m (repère ${R.distance[r].join('-')})`);
  const K = B.controle;
  return `ATELIER CONDUITE & CONTRÔLE${gele ? ` — suspendu : ${gele}` : ''}\nCONDUITE\n${L.join('\n')}\npied au contact à la touche (écran) : p50 ${f(B.piedTouche.p50)} m, p90 ${f(B.piedTouche.p90)} m — ≤ ${R.pied} m : ${pc(B.piedTouche.ok)}\nCONTRÔLE (n ${K.n})\nvitesse absorbée p50 ${K.absorbe == null ? '—' : pc(K.absorbe)} (repère 60-90 %, dans ${pc(K.dansAbsorbe)}) · balle à +0,5 s p50 ${f(K.a05)} m p90 ${f(K.a05p90)} (repère 0,5-1,5, dans ${pc(K.dansA05)}) · 2e touche p50 ${f(K.deuxieme)} s p90 ${f(K.deuxiemeP90)} (repère 0,4-0,8, dans ${pc(K.dansDeuxieme)}) · pied au contact p50 ${f(K.piedP50)} m (≤ ${R.pied} : ${pc(K.piedOk)})`;
}
