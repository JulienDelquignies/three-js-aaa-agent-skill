// rondo-atelier.js — L'ATELIER PASSES & CONTRÔLES (match11.html?atelier). Retour du 26/09 : « on n'est toujours pas bons — crée une
// scène qui s'appuie sur les mêmes passes et contrôles pour te focaliser sur les captures ». Ce n'est PAS une autre simulation : le
// même match 11c11, les mêmes lois (match-sim), le même rendu ; l'atelier ne fait que REGARDER. À chaque passe de jeu d'un joueur de
// champ : ralenti, caméra au ras du receveur (perpendiculaire à la passe), trois marqueurs au sol — le point VISÉ (jaune), la CIBLE du
// receveur (cyan), la trajectoire PRÉDITE du ballon (blanc) — et un relevé : l'écart du receveur à la ligne du ballon 0,3 s avant la
// prise, la balle après la 1re touche, le délai avant la 2e. Chaque réception s'inscrit dans window.__atelier.log.
// Captures : window.__atelier.arret = true suspend le monde aux instants clés (départ, −0,3 s, prise, +0,5 s, 2e touche) ;
// window.__atelier.go() repart. Lecture de l'état sim, jamais d'écriture.
import * as THREE from 'three/webgpu';
import { predictPath } from '../engine/ball-predict.js';

const h = Math.hypot;

export function atelierInit(scene) {
  // ?atelier=long|lob|prof|centre (plusieurs : long,lob) : ne suivre que ces passes — long ≥ 32 m, lob = levée, prof = en profondeur, centre
  const filtre = typeof location !== 'undefined' ? (new URLSearchParams(location.search).get('atelier') || '').split(',').filter(Boolean) : [];
  const A = { log: [], arret: false, gele: null, cur: null, ralenti: 0.4, filtre, go() { A.gele = null; } };
  const ring = (c, r) => { const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.72, r, 32), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; scene.scene.add(m); return m; };
  A.vise = ring(0xffd400, 0.45); A.cible = ring(0x21e0ff, 0.32); A.prise = ring(0xff4060, 0.3); A.chute = ring(0xff40ff, 0.55);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 90), 3));
  A.ligne = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })); A.ligne.visible = false; A.ligne.frustumCulled = false; scene.scene.add(A.ligne);
  if (typeof document !== 'undefined') {
    A.hud = document.createElement('div');
    A.hud.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:30;max-width:min(560px,calc(100vw - 24px));padding:8px 12px;border-radius:10px;background:rgba(10,12,18,.78);color:#e8ebf2;font:500 12px/1.45 ui-monospace,monospace;white-space:pre-wrap;pointer-events:none';
    document.body.appendChild(A.hud);
  }
  if (typeof window !== 'undefined') window.__atelier = A;
  scene._atelier = A;
  return A;
}

/** Le type d'une passe (et le filtre) : centre, prof (en profondeur), lob (levée), long (≥ 32 m), court sinon. Liste vide : tout passe. */
function typeDe(st, e, filtre) {
  const P = st.pass, c = st.players[e.by], d = P && c ? h(P.lead[0] - c.p[0], P.lead[2] - c.p[2]) : 0;
  const t = P?.cross ? 'centre' : P?.through ? 'prof' : P?.style === 'lofted' ? 'lob' : d >= 32 ? 'long' : 'court';
  if (!filtre) return t;
  if (!filtre.length) return t;
  return filtre.includes(t) || (filtre.includes('long') && d >= 32) ? t : null;
}

/** Le pas de temps de l'atelier : 0 quand le monde est suspendu, ralenti pendant une passe suivie. */
export function atelierDt(scene, dt) {
  const A = scene._atelier; if (!A) return dt;
  // ?vitesse=N accélère l'attente entre deux passes suivies ; la passe suivie se joue à vitesse 1 (puis au ralenti)
  if (A.v0 == null) A.v0 = scene.vitesse ?? 1; scene.vitesse = A.cur || A.gele || (A.dernier && A.now - (A.dernier.tFin ?? -9) < 1.2) ? 1 : A.v0;
  if (A.gele) return 0;
  return A.cur ? dt * A.ralenti : dt;
}

function geler(A, quand) { if (A.arret) A.gele = quand; if (A.cur) A.cur.moments.push(quand); }

/** Les événements du pas : une passe de jeu ouvre un suivi, le contrôle du receveur le marque. */
export function atelierEvent(scene, e) {
  const A = scene._atelier, st = scene.state; if (!A) return;
  if (e.type === 'pass' && !e.clear && !e.mains && e.to >= 0 && st.pass && !st.restart && !st.players[e.by]?.keeper && typeDe(st, e, A.filtre)) {
    const r = st.players[e.to], c = st.players[e.by], L = st.pass.lead;
    A.cur = { n: A.log.length + 1, by: e.by, to: e.to, t: st.t, style: e.style ?? '-', d: h(L[0] - c.p[0], L[2] - c.p[2]), lead: [L[0], L[2]], vol: st.pass.flight ?? 1,
      dLead0: h(L[0] - r.p[0], L[2] - r.p[2]), moments: [], pv: [st.ball.v[0], st.ball.v[2]], type: typeDe(st, e, []), hMax: 0 };
    const path = predictPath(st.ball, { dt: 1 / 20, maxT: Math.min(4.4, (st.pass.flight ?? 2) + 0.5) }), pos = A.ligne.geometry.attributes.position;
    for (let i = 0; i < 90; i++) { const s = path[Math.min(i, path.length - 1)]; pos.setXYZ(i, s.p[0], Math.max(0.03, s.p[1]), s.p[2]); }
    pos.needsUpdate = true; A.ligne.visible = true; A.vise.visible = true; A.vise.position.set(L[0], 0.03, L[2]);
    { let haut = false; A.cur.chuteP = null; for (const s of path) { if (s.p[1] > 1.2) haut = true; else if (haut && s.p[1] < 0.5) { A.cur.chuteP = [s.p[0], s.p[2]]; break; } }
      A.chute.visible = !!A.cur.chuteP; if (A.cur.chuteP) A.chute.position.set(A.cur.chuteP[0], 0.03, A.cur.chuteP[1]); }
    geler(A, 'départ');
  } else if (A.cur && e.by === A.cur.to && (e.type === 'control' || e.type === 'receive') && A.cur.tPrise == null) {
    const r = st.players[e.by], b = st.ball.p;
    A.cur.tPrise = st.t; A.cur.tech = e.tech ?? e.type; A.cur.miss = !!e.miss; A.cur.issue = e.issue ?? '-'; A.cur.pPrise = [b[0], b[2]];
    A.cur.priseCorps = h(b[0] - r.p[0], b[2] - r.p[2]); A.cur.priseVise = h(b[0] - A.cur.lead[0], b[2] - A.cur.lead[1]);
    A.prise.visible = true; A.prise.position.set(b[0], 0.03, b[2]);
    geler(A, 'prise');
  } else if (A.cur && (e.type === 'turnover' || (e.type === 'pass' && e.by !== A.cur.to))) clore(A, e.type === 'turnover' ? 'perdu' : 'interrompu');
  else if (A.cur && A.cur.tPrise != null && e.by === A.cur.to && (e.type === 'pass' || e.type === 'shot' || e.type === 'windup')) { A.cur.t2 = st.t - A.cur.tPrise; A.cur.deux = e.type; clore(A, 'ok'); }
}

function clore(A, fin) {
  const c = A.cur; if (!c) return; c.fin = fin; c.tFin = A.now; A.log.push(c); A.cur = null;
  A.vise.visible = A.cible.visible = A.prise.visible = A.ligne.visible = A.chute.visible = false;
}

/** Chaque image : les marqueurs, le relevé −0,3 s, la 2e touche, la caméra de l'atelier, le HUD. Rend true si la caméra est prise. */
export function atelierUpdate(scene) {
  const A = scene._atelier, st = scene.state; if (!A) return false;
  const c = A.cur; A.now = st.t;
  if (c) {
    const r = st.players[c.to], b = st.ball.p, dt = st.t - c.t;
    if (r.target) { A.cible.visible = true; A.cible.position.set(r.target[0], 0.035, r.target[2]); }
    if (c.tPrise == null) {
      // la CHUTE (ballon aérien) : première image sous 0,5 m après 1,2 m — l'écart au point visé, le receveur au ballon
      c.hMax = Math.max(c.hMax, b[1]);
      if (c.chute == null && c.hMax > 1.2 && b[1] < 0.5 && st.ball.v[1] < 0) { c.chute = [b[0], b[2]]; c.errChute = h(b[0] - c.lead[0], b[2] - c.lead[1]); c.recChute = h(r.p[0] - b[0], r.p[2] - b[2]); geler(A, 'chute'); }
      // l'instant « −0,3 s » : le ballon est à 0,3 s du receveur à sa vitesse actuelle (le vol prédit ment sous les lois de réception)
      const vb = h(st.ball.v[0], st.ball.v[2]), dR = h(b[0] - r.p[0], b[2] - r.p[2]);
      if (c.lat03 == null && vb > 1 && dR / vb <= 0.3) {
        const ux = st.ball.v[0] / vb, uz = st.ball.v[2] / vb;
        c.lat03 = Math.abs((r.p[0] - b[0]) * uz - (r.p[2] - b[2]) * ux); c.vR03 = h(r.v[0], r.v[1]); geler(A, '−0,3 s');
      }
      if (dt > c.vol + 3) clore(A, 'jamais reçu');
    } else {
      const t = st.t - c.tPrise, d = h(b[0] - r.p[0], b[2] - r.p[2]);
      c.maxApres = Math.max(c.maxApres ?? 0, d);
      if (c.a05 == null && t >= 0.5) { c.a05 = d; geler(A, '+0,5 s'); }
      const dv = h(st.ball.v[0] - c.pv[0], st.ball.v[2] - c.pv[1]);
      if (t > 0.1 && dv > 0.8 && b[1] < 0.5 && d < 1.3) { c.t2 = t; c.deux = 'touche'; geler(A, '2e touche'); clore(A, 'ok'); }
      else if (t > 3) { c.t2 = null; clore(A, '> 3 s'); }
      else if (st.ball.owner != null && st.ball.owner !== c.to) clore(A, 'perdu');
    }
    if (A.cur) A.cur.pv = [st.ball.v[0], st.ball.v[2]];
  }
  // la caméra : de côté, perpendiculaire à la passe, à hauteur d'homme ; elle suit le receveur
  const f = A.cur ?? A.dernier;
  if (A.cur) A.dernier = A.cur;
  let pris = false;
  if (f && scene.cam && !scene.free && (A.cur || st.t - (f.tFin ?? st.t) < 1.2)   /* la caméra tient 1,2 s après la clôture : le cadre ne décroche pas sur la 2e touche */) {
    const r = st.players[f.to], ux = f.lead[0] - st.players[f.by].p[0], uz = f.lead[1] - st.players[f.by].p[2], ul = h(ux, uz) || 1;
    const nx = -uz / ul, nz = ux / ul, s = nx * (0 - r.p[0]) + nz * (-st.pitch.hz - r.p[2]) > 0 ? 1 : -1;   // du côté de la tribune principale
    // le cadre : pendant le vol, le receveur ET le point visé (là où la prise doit se jouer) ; après la prise, le receveur et son ballon
    const fx = f.tPrise == null ? (r.p[0] + f.lead[0]) / 2 : (r.p[0] * 2 + st.ball.p[0]) / 3, fz = f.tPrise == null ? (r.p[2] + f.lead[1]) / 2 : (r.p[2] * 2 + st.ball.p[2]) / 3;
    const ecart = f.tPrise == null ? h(r.p[0] - f.lead[0], r.p[2] - f.lead[1]) : h(r.p[0] - st.ball.p[0], r.p[2] - st.ball.p[2]), recul = 7 + ecart * 0.9;   // le cadre s'ouvre avec l'écart à couvrir
    const want = new THREE.Vector3(fx + nx * s * recul - ux / ul * 2, 2.6 + ecart * 0.35, fz + nz * s * recul - uz / ul * 2);
    scene.cam.position.lerp(want, A.gele ? 0.3 : 0.12);
    const look = new THREE.Vector3(fx, 0.8, fz);
    A._look = A._look ? A._look.lerp(look, 0.2) : look; scene.cam.lookAt(A._look); pris = true;
  }
  if (A.hud) {
    const fmt = (x, k = 2) => x == null ? '—' : x.toFixed(k), L = A.log, last = L[L.length - 1];
    const ok = L.filter((x) => x.tPrise != null), q = (a, p) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(p * (s.length - 1))] : null; };
    const ligneC = c ? `passe ${c.n} en cours [${c.type}] : ${c.style}, ${fmt(c.d, 1)} m, receveur à ${fmt(c.dLead0, 1)} m du point visé${c.lat03 != null ? `, à ${fmt(c.lat03)} m de la ligne à −0,3 s` : ''}${c.chute ? ` · chute à ${fmt(c.errChute)} m du point visé, receveur à ${fmt(c.recChute)} m` : ''}${c.tPrise != null ? ` · prise ${c.tech} à ${fmt(c.priseCorps)} m du corps` : ''}` : 'en attente d\'une passe…';
    const ligneL = last ? `dernière (${last.n}) : ${last.style} ${fmt(last.d, 1)} m · −0,3 s ${fmt(last.lat03)} m · prise ${last.tech ?? '—'} ${fmt(last.priseCorps)} m · +0,5 s ${fmt(last.a05)} m · max ${fmt(last.maxApres)} m · 2e ${last.deux ?? '—'} ${fmt(last.t2)} s · ${last.fin}` : '';
    const ligneS = ok.length ? `sur ${ok.length} réceptions : −0,3 s p50/p90 ${fmt(q(ok.map((x) => x.lat03), 0.5))}/${fmt(q(ok.map((x) => x.lat03), 0.9))} m · balle max après p90 ${fmt(q(ok.map((x) => x.maxApres), 0.9))} m · 2e p50/p90 ${fmt(q(ok.map((x) => x.t2), 0.5))}/${fmt(q(ok.map((x) => x.t2), 0.9))} s` : '';
    A.hud.textContent = `ATELIER PASSES & CONTRÔLES${A.filtre.length ? ` [${A.filtre.join(', ')}]` : ''}${A.gele ? ` — suspendu : ${A.gele}` : ''}\n● jaune : point visé   ● cyan : cible du receveur   ● rouge : prise   ● magenta : chute prévue   — blanc : trajectoire prédite\n${ligneC}\n${ligneL}\n${ligneS}`;
  }
  return pris;
}
