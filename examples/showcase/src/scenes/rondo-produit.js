// rondo-produit.js — LE PRODUIT MATCH (la liste du 17/09 : « 90 vraies minutes, pause / lecture / avance rapide, moments clés, résumés court et
// long, match complet » ; la référence Football Manager). La simulation ne change pas : ce module LIT l'état et les événements, règle la vitesse de
// LECTURE (scene.vitesse = pas de sim par image rendue — le moteur garde son dt 1/60) et dessine l'habillage :
//   le bandeau (minute, équipes, score), la ligne de commentaire tirée des événements, la barre de lecture, la liste des moments clés.
// Modes (?mode=) : complet — 2 × 45 vraies minutes, la vitesse au choix ; long / court — le RÉSUMÉ : la partie défile vite hors action et repasse
// en temps réel quand une action dangereuse se construit (long : le porteur à < 40 m du but adverse, les coups de pied arrêtés dans le camp ;
// court : < 28 m, corner, penalty, coup franc proche) et quelques secondes après chaque but ; demo — l'ancien format 2 × 3 min.
// Clavier : Espace pause, 1-4 vitesse (×1 ×2 ×4 ×8), N prochain moment, M la liste des moments.

const MODES = { complet: 'Match complet', long: 'Résumé long', court: 'Résumé court', demo: 'Démo (6 min)' };
const h = Math.hypot;

export function modeDe(q) { const m = q.get('mode'); return MODES[m] ? m : 'court'; }
/** La durée simulée d'une période selon le mode (s) : 45 vraies minutes, sauf la démo. */
export function dureeDe(mode) { return mode === 'demo' ? 180 : 2700; }

const css = (el, s) => { el.style.cssText = s; return el; };
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export function produitInit(scene, { teams, nomDe, sauter }) {
  const P = { mode: scene._mode ?? 'court', teams, nomDe, sauter, pause: false, vUser: 1, turbo: false, moments: [], com: { txt: '', t: -9, prio: 0 }, dernierTir: null, butT: -99, vCur: 1 };
  if (typeof document === 'undefined') return P;
  const old = document.getElementById('score'); if (old) old.style.display = 'none';
  // LE BANDEAU (en haut, centré — FM : minute, équipes, score)
  P.bar = css(document.createElement('div'), 'position:fixed;top:10px;left:50%;transform:translateX(-50%);z-index:40;display:flex;align-items:stretch;gap:0;font:700 15px/1 system-ui,sans-serif;color:#fff;border-radius:6px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.45);pointer-events:none');
  P.min = css(document.createElement('div'), 'background:#3a1650;padding:8px 10px;min-width:62px;text-align:center');
  const eq = (t) => css(document.createElement('div'), `background:${hex(t.secondary)};padding:8px 14px;border-bottom:3px solid ${hex(t.primary)}`);
  P.eqA = eq(teams[0]); P.eqB = eq(teams[1]);
  P.sc = css(document.createElement('div'), 'background:#111;padding:8px 12px;min-width:54px;text-align:center;font-variant-numeric:tabular-nums');
  P.bar.append(P.min, P.eqA, P.sc, P.eqB); document.body.appendChild(P.bar);
  // LE COMMENTAIRE (bandeau bas, centré)
  P.comEl = css(document.createElement('div'), 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:40;max-width:min(720px,calc(100vw - 32px));padding:8px 18px;border-radius:18px;background:rgba(70,140,220,.88);color:#fff;font:600 14px/1.3 system-ui,sans-serif;text-align:center;pointer-events:none;transition:opacity .25s;opacity:0');
  document.body.appendChild(P.comEl);
  // LA BARRE DE LECTURE (en bas)
  P.ctl = css(document.createElement('div'), 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:41;display:flex;flex-wrap:wrap;justify-content:center;gap:6px;padding:6px 8px;border-radius:10px;background:rgba(12,14,20,.78);font:600 13px system-ui,sans-serif');
  const btn = (label, title, fn) => { const b = css(document.createElement('button'), 'min-width:34px;height:30px;padding:0 10px;border:0;border-radius:6px;background:#2a2f3a;color:#e8ebf2;font:inherit;cursor:pointer'); b.textContent = label; b.title = title; b.addEventListener('click', fn); P.ctl.appendChild(b); return b; };
  P.bPause = btn('⏸', 'Pause / lecture (Espace)', () => togglePause(P));
  P.bV = [1, 2, 4, 8].map((v) => btn(`×${v}`, `Vitesse ×${v} (${[1, 2, 4, 8].indexOf(v) + 1})`, () => { P.vUser = v; P.turbo = false; P.pause = false; }));
  P.bNext = btn('⏭', 'Aller au prochain moment (N)', () => { P.turbo = true; P.pause = false; });
  P.bMom = btn('Moments', 'Les moments clés (M)', () => { P.list.style.display = P.list.style.display === 'none' ? 'block' : 'none'; });
  P.bCam = btn('Caméra', 'Changer de caméra (V)', () => camSuivante(scene, P));
  P.sel = css(document.createElement('select'), 'height:30px;border:0;border-radius:6px;background:#2a2f3a;color:#e8ebf2;font:inherit;padding:0 6px');
  for (const [k, v] of Object.entries(MODES)) { const o = document.createElement('option'); o.value = k; o.textContent = v; if (k === P.mode) o.selected = true; P.sel.appendChild(o); }
  P.sel.title = 'Mode de match (recharge la page)';
  P.sel.addEventListener('change', () => { const u = new URL(location.href); u.searchParams.set('mode', P.sel.value); location.href = u.toString(); });
  P.ctl.appendChild(P.sel); document.body.appendChild(P.ctl);
  P.bCam.textContent = `Caméra : ${{ rapprochee: 'Rapprochée', tv: 'Télé', tactique: 'Tactique', joueur: 'Joueur' }[scene._plan] ?? 'Télé'}`;
  // LA LISTE DES MOMENTS
  P.list = css(document.createElement('div'), 'position:fixed;right:12px;top:56px;z-index:41;display:none;width:min(300px,calc(100vw - 24px));max-height:60vh;overflow:auto;padding:10px 12px;border-radius:10px;background:rgba(12,14,20,.86);color:#e8ebf2;font:500 13px/1.45 system-ui,sans-serif');
  document.body.appendChild(P.list);
  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); togglePause(P); }
    else if (e.key >= '1' && e.key <= '4') { P.vUser = [1, 2, 4, 8][+e.key - 1]; P.turbo = false; P.pause = false; }
    else if (e.key === 'n' || e.key === 'N') { P.turbo = true; P.pause = false; }
    else if (e.key === 'm' || e.key === 'M') P.bMom.click();
    else if (e.key === 'v' || e.key === 'V') camSuivante(scene, P);
  });
  return P;
}

function togglePause(P) { P.pause = !P.pause; }
function camSuivante(scene, P) { const n = scene.cycleCam?.(); if (n) { P.bCam.textContent = `Caméra : ${n}`; dire(P, scene._t ?? 0, `Caméra ${n.toLowerCase()}`, 9); } }

/** La minute affichée (FM : « 67' », « 45+2' »), à partir du chrono de la sim. */
function minuteDe(scene) {
  const st = scene.state, ch = scene._mcfg?.chrono, C = st._chrono; if (!ch || !C) return '';
  const tR = Math.max(0, st.t - (C.periode - 1) * (ch.duree + (ch.pause ?? 6)) - (st._ceremonie?.fin ?? 0)), R = C.ratio ?? 1;
  const base = (C.periode - 1) * 45, m = Math.floor(Math.min(ch.duree, tR) * R / 60) + base;
  return tR > ch.duree ? `${base + 45}+${Math.max(1, Math.ceil((tR - ch.duree) * R / 60))}'` : `${m}'`;
}

function dire(P, now, txt, prio = 1) { if (prio >= P.com.prio || now - P.com.t > 2.2) P.com = { txt, t: now, prio }; }
function moment(P, scene, txt, cle = false) { const m = { min: minuteDe(scene), txt, cle, t: scene.state.t }; P.moments.push(m); P.listDirty = true; return m; }
/** L'action en cours (un tir et ses 4 s de suite) : un seul moment — « Occasion : X — arrêt de Y », remplacé par le but s'il tombe. */
function action(P, scene) { const m = P.moments[P.moments.length - 1]; return m && m.occ && scene.state.t - m.t < 4 ? m : null; }

/** Un événement de la sim : le commentaire, les moments. */
export function produitEvent(scene, P, e) {
  const st = scene.state, now = scene._t ?? st.t, n = (id) => (id != null && st.players[id] ? P.nomDe(st.players[id]) : '?'), eq = (tm) => P.teams[tm]?.name ?? '';
  switch (e.type) {
    case 'pass': if (e.to >= 0 && !e.clear && st.players[e.by] && !st.restart) { const d = e.d ?? 0; if (e.through || e.cls === 'THROUGH' || e.cls === 'CHIP_THROUGH') dire(P, now, `${n(e.by)} lance ${n(e.to)} en profondeur`, 2); else if (e.cls === 'CROSS' || e.cls === 'CUTBACK') dire(P, now, `Centre de ${n(e.by)}…`, 2); else if (d > 30 || e.cls === 'SWITCH' || e.cls === 'LONG_GROUND') dire(P, now, `${n(e.by)} change le jeu vers ${n(e.to)}`, 1); else if (now - P.com.t > 3) dire(P, now, `${n(e.by)} cherche ${n(e.to)}`, 0); } break;
    case 'shot': P.dernierTir = e.by; P.tirT = st.t; dire(P, now, `Frappe de ${n(e.by)} !`, 3); break;
    case 'arrêt': { dire(P, now, `Arrêt de ${n(e.by)}`, 3); const A = action(P, scene); if (A) { if (!A.arret) { A.arret = true; A.txt += ` — arrêt de ${n(e.by)}`; P.listDirty = true; } } else moment(P, scene, `Arrêt de ${n(e.by)} (${eq(st.players[e.by]?.team)})`); break; }
    case 'but': { const tm = e.team ?? st.players[P.dernierTir]?.team, sc = P.dernierTir != null && st.players[P.dernierTir]?.team === tm ? n(P.dernierTir) : null; P.butT = st.t; dire(P, now, `BUT ! ${sc ? sc + ' — ' : ''}${eq(tm)} · ${st.score[0]}-${st.score[1]}`, 5); const A = action(P, scene); if (A) P.moments.splice(P.moments.indexOf(A), 1); moment(P, scene, `⚽ But ${sc ? 'de ' + sc + ' ' : ''}(${eq(tm)}) — ${st.score[0]}-${st.score[1]}`, true); break; }
    case 'sortie': if (P.dernierTir != null && e.out === 'sortie-de-but' && now - P.com.t < 2.5) dire(P, now, 'À côté !', 3); else if (e.out === 'corner') { dire(P, now, `Corner pour ${eq(e.team)}`, 2); } break;
    case 'faute': dire(P, now, `Faute de ${n(e.by)} sur ${n(e.sur)}`, 2); break;
    case 'carton': dire(P, now, `Carton ${e.couleur} pour ${n(e.by)}`, 4); moment(P, scene, `${e.couleur === 'rouge' ? '🟥' : '🟨'} ${n(e.by)} (${eq(st.players[e.by]?.team)})`, e.couleur === 'rouge'); break;
    case 'hors-jeu': dire(P, now, `Hors-jeu de ${n(e.by)}`, 2); break;
    case 'tacle-pique': dire(P, now, `${n(e.by)} chipe le ballon à ${n(e.sur)}`, 1); break;
    case 'skill': if (/vendu|petitPont/.test(e.kind ?? '') && (e.bitten?.length || e.reussi)) dire(P, now, `${n(e.by)} élimine son adversaire`, 2); break;
    case 'temps-additionnel': dire(P, now, `${Math.max(1, Math.round((e.sec ?? 60) * (st._chrono?.ratio ?? 1) / 60))} minute(s) de temps additionnel`, 3); break;
  }
  if (e.type === 'shot') { const c = st.players[e.by]; if (c) { const g = st.pitch.attackGoal(c.team); if (h(g.x - c.p[0], c.p[2]) < 20 && !action(P, scene)) moment(P, scene, `Occasion : ${n(e.by)} (${eq(c.team)})`).occ = true; } }
}

/** Le résumé : l'action est-elle digne d'être vue à ×1 ? */
function interessant(scene, P) {
  const st = scene.state, long = P.mode === 'long', lim = long ? 30 : 20;
  if (st.t - P.butT < 7) return true;
  if (P.tirT != null && st.t - P.tirT < 3) return true;                                        // le tir et sa suite (arrêt, rebond, corner)
  const r = st.restart; if (r) { if (r.type === 'penalty') return true; if (r.type === 'corner') return long; if (r.type === 'coup-franc' && r.p) { const tm = r.team, g = tm != null ? st.pitch.attackGoal(tm) : null; if (g && h(g.x - r.p[0], r.p[1]) < (long ? 30 : 24)) return true; } return false; }
  const id = st.possession?.carrier, c = id >= 0 ? st.players[id] : null, tm = c ? c.team : st.possession?.team;
  const pt = c ? c.p : st.ball.p; if (tm == null || tm < 0) return false;
  // le danger : près du but ET dans l'axe (le porteur coincé au poteau de corner n'est pas une action), ou une remontée rapide (contre) en résumé long
  const g = st.pitch.attackGoal(tm), dx = Math.abs(g.x - pt[0]), axe = Math.abs(pt[2]) < (long ? 22 : 16);
  if (h(dx, pt[2]) < lim && axe) return true;
  if (long && c && dx < 45 && Math.sign(g.x) * c.v[0] > 5) return true;
  return false;
}

/** Chaque image : la vitesse de lecture (scene.vitesse), le bandeau, le commentaire, la liste. */
export function produitUpdate(scene, P) {
  const st = scene.state, resume = P.mode === 'long' || P.mode === 'court';
  let v = P.vUser;
  if (st._ceremonie?.actif) { if (P.mode === 'court') { if (!P.saute) P.saute = P.sauter?.() ?? true; v = 8; } else v = Math.max(v, 1); }   // le résumé court entre au coup d'envoi (la cérémonie sautée, le retour en place à ×8)
  else if (P.turbo || resume) { const i = interessant(scene, P); if (i) { if (P.turbo && !resume) P.turbo = false; v = P.turbo ? 32 : v; if (P.turbo && i) { P.turbo = false; v = P.vUser; } } else v = P.mode === 'long' ? 12 : 32; }
  if (st.fini) v = 1;
  // la vitesse de lecture change par paliers doux (jamais ×32 → ×1 en une image : l'œil suit le ralentissement)
  P.vCur = v <= P.vCur ? v : Math.min(v, P.vCur + Math.max(1, P.vCur * 0.25));
  scene.vitesse = P.pause ? 0 : Math.round(P.vCur);
  if (!P.bar) return;
  P.min.textContent = st.fini ? 'FIN' : (minuteDe(scene) || "0'");
  P.eqA.textContent = P.teams[0].name; P.eqB.textContent = P.teams[1].name; P.sc.textContent = `${st.score[0]} - ${st.score[1]}`;
  const now = scene._t ?? st.t, vis = P.com.txt && now - P.com.t < 3.2;
  if (vis && P.comEl.textContent !== P.com.txt) P.comEl.textContent = P.com.txt;
  P.comEl.style.opacity = vis ? '1' : '0';
  const hb = P.ctl.offsetHeight + 22; if (P._hb !== hb) { P._hb = hb; P.comEl.style.bottom = `${hb}px`; }
  P.bPause.textContent = P.pause ? '▶' : '⏸';
  for (const [k, b] of P.bV.entries()) b.style.background = !P.pause && !resume && P.vUser === [1, 2, 4, 8][k] ? '#4a6cf0' : '#2a2f3a';
  if (resume && !P.pause) P.bNext.style.background = scene.vitesse > 8 ? '#4a6cf0' : '#2a2f3a';
  if (P.listDirty) { P.listDirty = false; P.list.innerHTML = `<b>Moments clés</b><br>` + (P.moments.length ? P.moments.slice().reverse().map((m) => `<div style="padding:3px 0;border-top:1px solid #2a2f3a;${m.cle ? 'color:#ffd54a' : ''}">${m.min} · ${m.txt}</div>`).join('') : '<i>aucun pour l\'instant</i>'); }
}
