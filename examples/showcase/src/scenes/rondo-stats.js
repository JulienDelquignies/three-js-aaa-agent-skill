// rondo-stats.js — LES STATS DU MATCH À L'ÉCRAN, ET LA VUE 2D (30/09 : « des stats complètes du foot […] tu peux aussi prévoir la 2d »).
// LECTURE SEULE : le moteur de stats (engine/stats.js) lit les événements et l'état après chaque pas de sim ; ce module l'affiche.
//   - le PANNEAU (bouton « Stats », touche S, ?stats=1 l'ouvre au chargement) : des onglets Match / Tirs / Passes / Défense / Duels /
//     Gardiens / Discipline / Joueurs / Cartes, un filtre mi-temps (match, 1re, 2e), et des terrains 2D : la carte des tirs (taille = xG),
//     la courbe d'xG, le réseau de passes (position moyenne de chaque joueur, traits pesés par le nombre de passes réussies), les
//     heatmaps d'équipe et de joueur ; un clic sur un joueur ouvre sa fiche (note, heatmap, schéma de passes : à qui, courtes / moyennes /
//     longues, en hauteur / au sol, et tout le détail).
//   - la VUE 2D EN DIRECT (bouton « 2D », touche D, ?vue2d=1) : le terrain vu de dessus, les joueurs (couleurs du maillot, le porteur
//     cerclé), le ballon et son ombre de hauteur.
// Le rendu 3D ne change pas : tout est un calque HTML/canvas, fermé par défaut.
// terrain2D(ctx, w, h) est réutilisable : il dessine le terrain et rend la projection (x, z) monde → pixels.

import { makeStats, statsStep, statsReport } from '../engine/stats.js';

const css = (el, s) => { el.style.cssText = s; return el; };
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f1 = (x) => (x == null ? '–' : (Math.round(x * 10) / 10).toLocaleString('fr-FR'));
const f2 = (x) => (x == null ? '–' : x.toFixed(2).replace('.', ','));
const pc = (x) => (x == null ? '–' : `${Math.round(x)} %`);
const ONGLETS = ['Match', 'Tirs', 'Passes', 'Défense', 'Duels', 'Gardiens', 'Discipline', 'Joueurs', 'Cartes'];
const ISSUES = { but: 'But', arrete: 'Arrêté', contre: 'Contré', cadre: 'Cadré', 'hors-cadre': 'Hors cadre', frole: 'Frôle le montant', autre: '—' };
const PARTIES = { pied: 'Pied', tete: 'Tête', volee: 'Volée' };

/** LE TERRAIN 2D (réutilisable) : dessine la pelouse et les lignes dans (w × h) et rend la projection. hx, hz : les demi-dimensions. */
export function projection2D(w, h, { hx = 52.5, hz = 34, marge = 8 } = {}) {
  const k = Math.min((w - 2 * marge) / (2 * hx), (h - 2 * marge) / (2 * hz)), ox = w / 2, oz = h / 2;
  return { P: (x, z) => [ox + x * k, oz + z * k], k, ox, oz };
}
export function terrain2D(ctx, w, h, { hx = 52.5, hz = 34, marge = 8, herbe = '#1d5a34', ligne = 'rgba(255,255,255,.75)' } = {}) {
  const { P, k, ox, oz } = projection2D(w, h, { hx, hz, marge });
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = herbe; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 10; i++) { if (i % 2) continue; const [a] = P(-hx + i * hx / 5, 0); ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fillRect(a, oz - hz * k, hx / 5 * k, 2 * hz * k); }
  ctx.strokeStyle = ligne; ctx.lineWidth = 1;
  const rect = (x0, z0, x1, z1) => { const [a, b] = P(x0, z0), [c, d] = P(x1, z1); ctx.strokeRect(a, b, c - a, d - b); };
  rect(-hx, -hz, hx, hz);
  ctx.beginPath(); ctx.moveTo(...P(0, -hz)); ctx.lineTo(...P(0, hz)); ctx.stroke();
  ctx.beginPath(); ctx.arc(ox, oz, 9.15 * k, 0, 2 * Math.PI); ctx.stroke();
  for (const s of [-1, 1]) {
    rect(s * hx, -20.16, s * (hx - 16.5), 20.16); rect(s * hx, -9.16, s * (hx - 5.5), 9.16);
    const [px, pz] = P(s * (hx - 11), 0); ctx.fillStyle = ligne; ctx.fillRect(px - 1, pz - 1, 2, 2);
    ctx.beginPath(); ctx.arc(px, pz, 9.15 * k, s > 0 ? Math.PI - 0.93 : -0.93, s > 0 ? Math.PI + 0.93 : 0.93); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(...P(s * hx, -3.66)); ctx.lineTo(...P(s * hx, 3.66)); ctx.stroke(); ctx.lineWidth = 1;
  }
  return { P, k };
}

/** Le canvas net (dpr) d'une taille CSS donnée. */
function toile(w, h) {
  const c = document.createElement('canvas'), d = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(w * d); c.height = Math.round(h * d); c.style.cssText = `width:100%;max-width:${w}px;height:auto;display:block;margin:6px auto;border-radius:6px`;
  const ctx = c.getContext('2d'); ctx.scale(d, d); return { c, ctx, w, h };
}

export function statsInit(scene, { teams, nomDe, ctl = null }) {
  const st = scene.state;
  const Q = { S: makeStats(st), teams, nomDe, open: false, onglet: 'Match', per: null, joueur: null, t: -9, vue: false, carteTeam: 0 };
  if (typeof document === 'undefined') return Q;
  const q = new URLSearchParams(location.search);
  Q.pan = css(document.createElement('div'), 'position:fixed;right:12px;top:56px;z-index:42;display:none;width:min(580px,calc(100vw - 24px));max-height:calc(100vh - 140px);overflow:auto;padding:10px 12px;border-radius:10px;background:rgba(12,14,20,.92);color:#e8ebf2;font:500 13px/1.35 system-ui,sans-serif;box-sizing:border-box');
  document.body.appendChild(Q.pan);
  Q.pan.addEventListener('click', (e) => {
    const o = e.target.closest?.('[data-o]'); if (o) { Q.onglet = o.dataset.o; Q.joueur = null; Q.t = -9; return; }
    const m = e.target.closest?.('[data-per]'); if (m) { Q.per = m.dataset.per === '' ? null : +m.dataset.per; Q.t = -9; return; }
    const j = e.target.closest?.('[data-j]'); if (j) { Q.joueur = +j.dataset.j; Q.t = -9; return; }
    const c = e.target.closest?.('[data-ct]'); if (c) { Q.carteTeam = +c.dataset.ct; Q.t = -9; return; }
    if (e.target.closest?.('[data-x]')) basculer(Q);
    if (e.target.closest?.('[data-retour]')) { Q.joueur = null; Q.t = -9; }
  });
  // la vue 2D en direct
  Q.v2 = toile(340, 226); css(Q.v2.c, 'position:fixed;left:12px;bottom:64px;z-index:39;width:min(340px,calc(100vw - 24px));height:auto;display:none;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.5)');
  document.body.appendChild(Q.v2.c);
  if (ctl) {
    const b = (label, title, fn) => { const x = css(document.createElement('button'), 'min-width:34px;height:30px;padding:0 10px;border:0;border-radius:6px;background:#2a2f3a;color:#e8ebf2;font:inherit;cursor:pointer'); x.textContent = label; x.title = title; x.addEventListener('click', fn); ctl.appendChild(x); return x; };
    Q.bStats = b('Stats', 'Les statistiques du match (S)', () => basculer(Q));
    Q.b2D = b('2D', 'La vue 2D en direct (D)', () => basculer2D(Q));
  }
  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 's' || e.key === 'S') basculer(Q); else if (e.key === 'd' || e.key === 'D') basculer2D(Q);
  });
  if (q.get('stats') === '1') basculer(Q);
  if (q.get('vue2d') === '1') basculer2D(Q);
  return Q;
}

function basculer(Q) { Q.open = !Q.open; Q.pan.style.display = Q.open ? 'block' : 'none'; Q.t = -9; if (Q.bStats) Q.bStats.style.background = Q.open ? '#3f6fb0' : '#2a2f3a'; }
function basculer2D(Q) { Q.vue = !Q.vue; Q.v2.c.style.display = Q.vue ? 'block' : 'none'; if (Q.b2D) Q.b2D.style.background = Q.vue ? '#3f6fb0' : '#2a2f3a'; }

/** Un pas de sim : le moteur de stats lit ce qui vient de se passer (appelé APRÈS matchStep). */
export function statsPas(Q, st, dt) { statsStep(Q.S, st, dt); }

/** Chaque image rendue : la vue 2D ; le panneau (rafraîchi chaque seconde réelle). */
export function statsUpdate(scene, Q) {
  if (typeof document === 'undefined') return;
  if (Q.vue) vue2D(scene, Q);
  const now = performance.now() / 1000;
  if (Q.open && now - Q.t > 1) { Q.t = now; const y = Q.pan.scrollTop; rendre(scene, Q); Q.pan.scrollTop = y; }
}

// ————————————————————————————————— la vue 2D en direct —————————————————————————————————

function vue2D(scene, Q) {
  const st = scene.state, { ctx, w, h } = Q.v2, { P, k } = terrain2D(ctx, w, h, { hx: st.pitch.hx, hz: st.pitch.hz });
  const car = st.possession?.carrier;
  for (const p of st.players) {
    if (p.expulse || p._sub) continue;
    const t = Q.teams[p.team], [x, y] = P(p.p[0], p.p[2]), r = Math.max(3.2, 0.9 * k);
    ctx.fillStyle = p.keeper ? (p.team ? '#f2c230' : '#39d18a') : hex(t.primary); ctx.strokeStyle = hex(t.secondary); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    const vx = p.v[0], vz = p.v[1];   // la course (p.v est [vx, vz])
    if (Math.hypot(vx, vz) > 1) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + vx * k * 0.35, y + vz * k * 0.35); ctx.stroke(); }
    if (p.id === car) { ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, 2 * Math.PI); ctx.stroke(); }
  }
  const b = st.ball.p, [bx, by] = P(b[0], b[2]), hB = Math.max(0, b[1] - 0.11);
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.arc(bx, by, 2.5, 0, 2 * Math.PI); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(bx, by - Math.min(12, hB * k * 0.5), 2.5 + Math.min(2, hB * 0.25), 0, 2 * Math.PI); ctx.fill();
}

// ————————————————————————————————— le panneau —————————————————————————————————

const couleur = (Q, t) => hex(Q.teams[t].primary === 0xe8ecf2 ? 0x8fb4ff : Q.teams[t].primary);   // le blanc se lit mal sur fond sombre : un bleu clair
/** La minute (0-90+) d'un temps de sim, pour la courbe d'xG (la même horloge que le bandeau). */
function minuteDeT(scene, t, per) {
  const ch = scene._mcfg?.chrono, R = scene.state._chrono?.ratio ?? 1; if (!ch) return t / 60;
  const t0 = (per - 1) * (ch.duree + (ch.pause ?? 6)) + (scene.state._ceremonie?.fin ?? 0);
  return (per - 1) * 45 + Math.max(0, t - t0) * R / 60;
}

function ligneComp(Q, label, a, b, fmt = (x) => x ?? '–') {
  const na = +a || 0, nb = +b || 0, s = na + nb, pa = s ? 100 * na / s : 50;
  return `<div style="margin:5px 0"><div style="display:flex;justify-content:space-between"><b>${fmt(a)}</b><span style="opacity:.8">${label}</span><b>${fmt(b)}</b></div>`
    + `<div style="display:flex;height:4px;border-radius:2px;overflow:hidden;background:#333"><i style="width:${pa}%;background:${couleur(Q, 0)}"></i><i style="flex:1;background:${couleur(Q, 1)}"></i></div></div>`;
}

function entete(Q, R) {
  const [A, B] = Q.teams, per = Q.per;
  const ong = ONGLETS.map((o) => `<button data-o="${o}" style="border:0;border-radius:5px;padding:4px 7px;margin:2px;font:inherit;cursor:pointer;background:${o === Q.onglet ? '#3f6fb0' : '#2a2f3a'};color:#e8ebf2">${o}</button>`).join('');
  const pers = [['', 'Match'], ['1', '1re MT'], ['2', '2e MT']].map(([v, l]) => `<button data-per="${v}" style="border:0;border-radius:5px;padding:3px 7px;margin:2px;font:inherit;font-size:12px;cursor:pointer;background:${String(per ?? '') === v ? '#6b5bb0' : '#23262e'};color:#e8ebf2">${l}</button>`).join('');
  return `<div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:15px"><span style="color:${couleur(Q, 0)}">${esc(A.name)}</span> ${R.score[0]} – ${R.score[1]} <span style="color:${couleur(Q, 1)}">${esc(B.name)}</span></b>`
    + `<button data-x style="border:0;background:none;color:#aaa;font-size:18px;cursor:pointer" title="Fermer (S)">✕</button></div>`
    + `<div style="margin:4px 0">${ong}</div><div style="margin:0 0 6px">${pers}</div>`;
}

function rendre(scene, Q) {
  const st = scene.state, R = statsReport(Q.S, st, { per: Q.per }), E = R.equipes;
  let html = entete(Q, R); const canvases = [];
  const C = (a, b, lab, fmt) => ligneComp(Q, lab, a, b, fmt);
  const eq = (k, lab, fmt) => C(E[0][k], E[1][k], lab, fmt);
  if (Q.joueur != null) { const J = R.joueurs[Q.joueur]; if (J) { const r = ficheJoueur(scene, Q, R, J); html += r.html; canvases.push(...r.c); } }
  else switch (Q.onglet) {
    case 'Match':
      html += eq('possession', 'Possession', pc) + eq('xg', 'xG', f2) + eq('tirs', 'Tirs') + eq('cadres', 'Tirs cadrés') + eq('passes', 'Passes')
        + eq('reussite', 'Passes réussies', pc) + eq('dribblesReussis', 'Dribbles réussis') + eq('duelsSolGagnes', 'Duels au sol gagnés') + eq('duelsAeriensGagnes', 'Duels aériens gagnés')
        + eq('recuperations', 'Récupérations') + eq('corners', 'Corners') + eq('fautes', 'Fautes') + eq('horsJeu', 'Hors-jeu') + eq('jaunes', 'Cartons jaunes');
      html += '<div style="margin-top:8px;opacity:.8">Courbe d\'xG cumulé (● but)</div>'; canvases.push(['xg', (c) => courbeXg(scene, Q, R, c)]);
      break;
    case 'Tirs':
      html += eq('tirs', 'Tirs') + eq('cadres', 'Cadrés') + eq('horsCadre', 'Hors cadre') + eq('frole', 'Frôle le montant') + eq('contres', 'Contrés') + eq('arretes', 'Arrêtés')
        + eq('tirsSurface', 'Dans la surface') + eq('tirsHorsSurface', 'Hors de la surface') + eq('tirsSixMetres', 'Dans les 6 m') + eq('tirsPied', 'Du pied')
        + eq('tirsTete', 'De la tête') + eq('tirsVolee', 'De volée') + eq('xg', 'xG', f2) + eq('xgParTir', 'xG par tir', f2) + eq('distTir', 'Distance moyenne (m)', f1);
      html += `<div style="margin-top:8px;opacity:.8">Carte des tirs — ${esc(Q.teams[0].name)} attaque →, ${esc(Q.teams[1].name)} ← (taille = xG ; plein = cadré, ★ = but)</div>`;
      canvases.push(['tirs', (c) => carteTirs(st, Q, R, c)]);
      html += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:6px"><tr style="opacity:.7"><td>Min</td><td>Tireur</td><td>Partie</td><td>Zone</td><td>xG</td><td>Issue</td></tr>'
        + R.tirs.slice().reverse().map((t) => `<tr style="border-top:1px solid #2a2f3a"><td>${Math.floor(minuteDeT(scene, t.t, t.per))}'</td><td style="color:${couleur(Q, t.team)}">${esc(nom(Q, st, t.by))}</td><td>${PARTIES[t.partie] ?? '–'}</td><td>${t.surface ? 'Surface' : 'Hors surface'} · ${f1(t.dist)} m</td><td>${f2(t.xg)}</td><td>${t.but ? '<b>But</b>' : ISSUES[t.issue] ?? '–'}</td></tr>`).join('') + '</table>';
      break;
    case 'Passes':
      html += eq('passes', 'Passes') + eq('passesReussies', 'Réussies') + eq('reussite', 'Réussite', pc) + eq('courtes', 'Courtes (< 15 m)') + eq('moyennes', 'Moyennes (15-30 m)')
        + eq('longues', 'Longues (> 30 m)') + eq('reussiteLongues', 'Réussite des longues', pc) + eq('auSol', 'Au sol') + eq('enHauteur', 'En hauteur') + eq('uneTouche', 'En une touche')
        + eq('versAvant', 'Vers l\'avant') + eq('laterales', 'Latérales') + eq('versArriere', 'Vers l\'arrière') + eq('dernierTiers', 'Réussies dans le dernier tiers')
        + eq('passesCles', 'Passes clés') + eq('centres', 'Centres');
      html += `<div style="margin-top:8px">${choixEquipe(Q)} Réseau de passes (position moyenne, attaque →)</div>`;
      canvases.push(['reseau', (c) => reseau(st, Q, R, c)]);
      break;
    case 'Défense':
      html += eq('tacles', 'Tacles') + eq('taclesGagnes', 'Tacles gagnés') + eq('interceptions', 'Interceptions') + eq('recuperations', 'Récupérations')
        + eq('recupCampAdverse', 'Récupérations dans le camp adverse') + eq('recupContrePress', 'Récupérations au contre-pressing (< 5 s)') + eq('recupHauteur', 'Hauteur moyenne des récupérations (m)', f1)
        + eq('pressions', 'Pressions') + eq('ppda', 'PPDA (passes adverses par action défensive)', f1) + eq('degagements', 'Dégagements') + eq('contresDefensifs', 'Tirs contrés');
      break;
    case 'Duels':
      html += eq('duelsSol', 'Duels au sol') + eq('duelsSolGagnes', 'Gagnés') + eq('duelsAeriens', 'Duels aériens') + eq('duelsAeriensGagnes', 'Gagnés')
        + eq('dribbles', 'Dribbles tentés') + eq('dribblesReussis', 'Dribbles réussis') + eq('controlesRates', 'Contrôles ratés') + eq('depossedesReception', 'Dépossédés à la réception') + eq('tacles', 'Tacles') + eq('taclesGagnes', 'Tacles gagnés');
      break;
    case 'Gardiens': {
      const G = R.joueurs.filter((j) => j.keeper && j.minutes);
      html += eq('arrets', 'Arrêts') + eq('prisesGardien', 'Prises (toute intervention)') + eq('sortiesGardien', 'Sorties aériennes');
      html += G.map((g) => `<div data-j="${g.id}" style="cursor:pointer;margin-top:8px;padding:6px;border-radius:6px;background:#1b1e26"><b style="color:${couleur(Q, g.team)}">${esc(nom(Q, st, g.id))}</b> — note ${f1(g.note)}<br>`
        + `Arrêts ${g.arrets} · buts encaissés ${g.butsEncaisses} · xG cadré subi ${f2(g.xgCadreFace)} · prises ${g.prises} · sorties ${g.sorties} · relances ${g.relances} (dont ${g.relancesMain} à la main) · passes ${g.passesReussies}/${g.passes}</div>`).join('');
      break;
    }
    case 'Discipline': {
      html += eq('fautes', 'Fautes commises') + eq('fautesSubies', 'Fautes subies') + eq('jaunes', 'Cartons jaunes') + eq('rouges', 'Cartons rouges') + eq('horsJeu', 'Hors-jeu');
      const cartons = Q.S.faits.filter((f) => f.k === 'carton' && (Q.per == null || f.per === Q.per));
      html += cartons.length ? cartons.map((c) => `<div>${Math.floor(minuteDeT(scene, c.t, c.per))}' ${c.couleur === 'rouge' ? '🟥' : '🟨'} <span style="color:${couleur(Q, c.team)}">${esc(nom(Q, st, c.by))}</span></div>`).join('') : '<div style="opacity:.7;margin-top:6px">Aucun carton.</div>';
      break;
    }
    case 'Joueurs': html += tableJoueurs(Q, st, R); break;
    case 'Cartes':
      html += `<div>${choixEquipe(Q)} Heatmap de l'équipe (joueurs de champ, attaque →)</div>`;
      canvases.push(['heat', (c) => { const h = new Float32Array(21 * 14); for (const j of R.joueurs) if (j.team === Q.carteTeam && !j.keeper) j.heat.forEach((v, i) => { h[i] += v; }); heatmap(st, c, h, Q.carteTeam); }]);
      break;
  }
  Q.pan.innerHTML = html;
  for (const [, dessin] of canvases) { const T = toile(540, 350); Q.pan.appendChild(T.c); dessin(T); }
}

const nom = (Q, st, id) => (id != null && st.players[id] ? Q.nomDe(st.players[id]) : '?');
const choixEquipe = (Q) => [0, 1].map((t) => `<button data-ct="${t}" style="border:0;border-radius:5px;padding:3px 7px;margin:0 2px;font:inherit;font-size:12px;cursor:pointer;background:${Q.carteTeam === t ? couleur(Q, t) : '#23262e'};color:${Q.carteTeam === t ? '#111' : '#e8ebf2'}">${esc(Q.teams[t].name)}</button>`).join('');

function tableJoueurs(Q, st, R) {
  const cols = [['Note', (j) => f1(j.note)], ['Min', (j) => Math.round(j.minutes ?? 0)], ['B', (j) => j.buts], ['PD', (j) => j.passesDecisives], ['Tirs', (j) => `${j.tirs}/${j.cadres}`],
    ['xG', (j) => f2(j.xg)], ['Passes', (j) => `${j.passesReussies}/${j.passes}`], ['Clés', (j) => j.passesCles], ['Drib.', (j) => `${j.dribblesReussis}/${j.dribbles}`],
    ['Tac.', (j) => `${j.taclesGagnes}/${j.tacles}`], ['Int.', (j) => j.interceptions], ['Aér.', (j) => `${j.aeriensGagnes}/${j.aeriens}`], ['km', (j) => f1(j.distance / 1000)]];
  let h = '<div style="opacity:.75;font-size:12px">Clic sur un joueur : sa fiche (heatmap, schéma de passes, détail).</div>';
  for (const t of [0, 1]) {
    const L = R.joueurs.filter((j) => j.team === t && j.minutes).sort((a, b) => (b.note ?? 0) - (a.note ?? 0));
    h += `<div style="margin-top:8px;font-weight:700;color:${couleur(Q, t)}">${esc(Q.teams[t].name)}</div><div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;white-space:nowrap">`
      + `<tr style="opacity:.7"><td>Joueur</td>${cols.map(([c]) => `<td style="text-align:right;padding:0 3px">${c}</td>`).join('')}</tr>`
      + L.map((j) => `<tr data-j="${j.id}" style="cursor:pointer;border-top:1px solid #2a2f3a"><td>${esc(nom(Q, st, j.id))}${j.keeper ? ' <span style="opacity:.6">(G)</span>' : ''}</td>${cols.map(([, f], i) => `<td style="text-align:right;padding:0 3px;${i === 0 ? `color:${noteCouleur(j.note)};font-weight:700` : ''}">${f(j)}</td>`).join('')}</tr>`).join('')
      + '</table></div>';
  }
  return h;
}
const noteCouleur = (n) => (n == null ? '#aaa' : n >= 7.5 ? '#4fd67a' : n >= 6.5 ? '#b6d84f' : n >= 5.8 ? '#e8ebf2' : '#e36a5a');

function ficheJoueur(scene, Q, R, J) {
  const st = scene.state, schema = Object.entries(J.schema).sort((a, b) => b[1] - a[1]);
  const L = (lab, v) => `<div style="display:flex;justify-content:space-between;border-top:1px solid #23262e;padding:2px 0"><span style="opacity:.8">${lab}</span><b>${v}</b></div>`;
  let html = `<button data-retour style="border:0;border-radius:5px;padding:3px 8px;background:#2a2f3a;color:#e8ebf2;cursor:pointer;font:inherit">← Retour</button>`
    + `<div style="margin:6px 0;font-size:15px"><b style="color:${couleur(Q, J.team)}">${esc(nom(Q, st, J.id))}</b> ${J.keeper ? '<span style="opacity:.7">(gardien)</span> ' : ''}— note <b style="color:${noteCouleur(J.note)}">${f1(J.note)}</b></div>`;
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:0 14px">'
    + '<div>' + L('Minutes', Math.round(J.minutes ?? 0)) + L('Distance', `${f1(J.distance / 1000)} km`) + L('Sprints', J.sprints) + L('Vitesse max', `${f1(J.vMax)} km/h`) + L('Touches de balle (conduite comprise)', J.touches)
    + L('Buts / passes décisives', `${J.buts} / ${J.passesDecisives}`) + L('Tirs (cadrés)', `${J.tirs} (${J.cadres})`) + L('xG', f2(J.xg)) + L('Dribbles réussis', `${J.dribblesReussis}/${J.dribbles}`)
    + L('Dépossédé', J.depossede) + L('Contrôles ratés / dépossédé à la réception', `${J.controlesRates} / ${J.depossedeReception ?? 0}`) + L('Hors-jeu', J.horsJeu) + '</div>'
    + '<div>' + L('Passes réussies', `${J.passesReussies}/${J.passes} (${pc(J.reussite)})`) + L('Courtes / moyennes / longues', `${J.courtes} / ${J.moyennes} / ${J.longues}`)
    + L('Au sol / en hauteur', `${J.passes - J.enHauteur} / ${J.enHauteur}`) + L('Vers l\'avant', J.versAvant) + L('Passes clés', J.passesCles) + L('Centres', J.centres)
    + L('Tacles gagnés', `${J.taclesGagnes}/${J.tacles}`) + L('Interceptions / récupérations', `${J.interceptions} / ${J.recuperations}`) + L('Duels aériens gagnés', `${J.aeriensGagnes}/${J.aeriens}`)
    + L('Dribbles subis (stoppés)', `${J.dribblesSubis} (${J.dribblesStoppes})`) + L('Dégagements / contres', `${J.degagements} / ${J.contres}`) + L('Fautes commises / subies', `${J.fautes} / ${J.fautesSubies}`)
    + L('Cartons', `${J.jaunes ? '🟨'.repeat(J.jaunes) : ''}${J.rouges ? '🟥' : ''}` || '–')
    + (J.keeper ? L('Arrêts / prises', `${J.arrets} / ${J.prises}`) + L('Buts encaissés / xG cadré subi', `${J.butsEncaisses} / ${f2(J.xgCadreFace)}`) + L('Relances (main)', `${J.relances} (${J.relancesMain})`) : '') + '</div></div>';
  html += `<div style="margin-top:8px"><b>Schéma de passes</b> <span style="opacity:.7">(passes réussies, vers qui)</span></div>`
    + (schema.length ? schema.map(([to, n]) => `<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="width:140px">${esc(nom(Q, st, +to))}</span><i style="height:8px;width:${Math.min(100, n * 8)}%;background:${couleur(Q, J.team)};border-radius:2px"></i><b>${n}</b></div>`).join('') : '<div style="opacity:.7">Aucune passe réussie.</div>');
  html += `<div style="margin-top:8px;opacity:.8">Heatmap (attaque →) et passes réussies vers ses coéquipiers</div>`;
  return { html, c: [['hj', (c) => { heatmap(st, c, J.heat, J.team); fleches(st, Q, R, c, J); }]] };
}

// ————————————————————————————————— les dessins —————————————————————————————————

/** Le centre (x, z) de la grille de heatmap (coordonnées de l'équipe : attaque vers +x). */
function centreCase(st, i) { const hx = st.pitch.hx, hz = st.pitch.hz, ix = i % 21, iz = Math.floor(i / 21); return [-hx + (ix + 0.5) * 2 * hx / 21, -hz + (iz + 0.5) * 2 * hz / 14]; }
function moyennePos(st, heat) { let s = 0, x = 0, z = 0; heat.forEach((v, i) => { if (!v) return; const [a, b] = centreCase(st, i); s += v; x += v * a; z += v * b; }); return s ? [x / s, z / s, s] : null; }

function heatmap(st, { ctx, w, h }, heat, team) {
  const { P, k } = terrain2D(ctx, w, h, { hx: st.pitch.hx, hz: st.pitch.hz, herbe: '#173a26' });
  const m = Math.max(1e-6, ...heat), cw = 2 * st.pitch.hx / 21 * k, chh = 2 * st.pitch.hz / 14 * k;
  heat.forEach((v, i) => {
    if (!v) return; const a = Math.sqrt(v / m), [x, z] = centreCase(st, i), [px, pz] = P(x, z);
    ctx.fillStyle = `rgba(${Math.round(255 * Math.min(1, a * 1.6))},${Math.round(220 * (1 - a * 0.8))},40,${0.15 + 0.6 * a})`;
    ctx.fillRect(px - cw / 2, pz - chh / 2, cw, chh);
  });
  terrainLignes(st, ctx, w, h);
}
/** Les lignes redessinées par-dessus la heatmap (lisibilité). */
function terrainLignes(st, ctx, w, h) { const c2 = document.createElement('canvas'); c2.width = ctx.canvas.width; c2.height = ctx.canvas.height; const x = c2.getContext('2d'), d = ctx.canvas.width / w; x.scale(d, d); terrain2D(x, w, h, { hx: st.pitch.hx, hz: st.pitch.hz, herbe: 'rgba(0,0,0,0)', ligne: 'rgba(255,255,255,.6)' }); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(c2, 0, 0); ctx.restore(); }

function fleches(st, Q, R, { ctx, w, h }, J) {
  const { P } = projection2D(w, h, { hx: st.pitch.hx, hz: st.pitch.hz });
  const o = moyennePos(st, J.heat); if (!o) return; const [ax, ay] = P(o[0], o[1]);
  for (const [to, n] of Object.entries(J.schema)) {
    const T = R.joueurs[+to]; const d = T && moyennePos(st, T.heat); if (!d) continue; const [bx, by] = P(d[0], d[1]);
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = Math.min(6, 0.8 + n * 0.6); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '600 10px system-ui'; ctx.fillText(`${n}`, (ax + bx) / 2 + 3, (ay + by) / 2 - 3);
  }
  ctx.fillStyle = couleur(Q, J.team); ctx.beginPath(); ctx.arc(ax, ay, 7, 0, 2 * Math.PI); ctx.fill();
}

function reseau(st, Q, R, { ctx, w, h }) {
  const { P } = terrain2D(ctx, w, h, { hx: st.pitch.hx, hz: st.pitch.hz }), t = Q.carteTeam;
  const J = R.joueurs.filter((j) => j.team === t && j.minutes), pos = new Map(J.map((j) => [j.id, moyennePos(st, j.heat)]));
  let mx = 1; for (const j of J) for (const n of Object.values(j.schema)) mx = Math.max(mx, n);
  for (const j of J) for (const [to, n] of Object.entries(j.schema)) {
    const a = pos.get(j.id), b = pos.get(+to); if (!a || !b || n < 2) continue;
    const [ax, ay] = P(a[0], a[1]), [bx, by] = P(b[0], b[1]);
    ctx.strokeStyle = `rgba(255,255,255,${0.2 + 0.7 * n / mx})`; ctx.lineWidth = 0.6 + 5 * n / mx; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  }
  let mp = 1; for (const j of J) mp = Math.max(mp, j.passesReussies);
  for (const j of J) {
    const a = pos.get(j.id); if (!a) continue; const [x, y] = P(a[0], a[1]), r = 5 + 7 * Math.sqrt(j.passesReussies / mp);
    ctx.fillStyle = couleur(Q, t); ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '600 10px system-ui'; ctx.fillText(String(nom(Q, st, j.id)).split(' ').pop().slice(0, 10), x + r + 2, y + 3);
  }
}

function carteTirs(st, Q, R, { ctx, w, h }) {
  const { P } = terrain2D(ctx, w, h, { hx: st.pitch.hx, hz: st.pitch.hz });
  for (const t of R.tirs) {
    if (t.x == null) continue; const s = t.team === 0 ? 1 : -1, [x, y] = P(s * t.x, s * t.z), r = 2.5 + 16 * Math.sqrt(t.xg ?? 0.02);
    ctx.strokeStyle = couleur(Q, t.team); ctx.fillStyle = couleur(Q, t.team); ctx.lineWidth = 1.5; ctx.globalAlpha = t.but || t.issue === 'arrete' || t.issue === 'cadre' ? 0.85 : 0.35;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
    if (t.but) { ctx.fillStyle = '#ffe14d'; ctx.font = '700 14px system-ui'; ctx.fillText('★', x - 5, y + 5); }
    if (t.partie === 'tete') { ctx.fillStyle = '#fff'; ctx.font = '600 9px system-ui'; ctx.fillText('T', x - 3, y + 3); }
  }
}

function courbeXg(scene, Q, R, { ctx, w, h }) {
  ctx.fillStyle = '#15181f'; ctx.fillRect(0, 0, w, h);
  const ml = 34, mb = 22, W = w - ml - 10, H = h - mb - 10, pts = R.xgCourbe.map((p, i) => ({ ...p, m: minuteDeT(scene, p.t, R.tirs[i]?.per ?? 1) }));
  const mMax = Math.max(90, ...pts.map((p) => p.m)), cum = [0, 0]; let yMax = 1;
  const S = [[{ m: 0, v: 0 }], [{ m: 0, v: 0 }]];
  for (const p of pts) { cum[p.team] += p.xg; S[p.team].push({ m: p.m, v: cum[p.team], but: p.but }); yMax = Math.max(yMax, cum[p.team]); }
  const cur = Math.min(mMax, minuteDeT(scene, scene.state.t, Math.min(2, Math.max(1, scene.state._chrono?.periode ?? 1))));
  for (const t of [0, 1]) S[t].push({ m: cur, v: cum[t] });
  const X = (m) => ml + W * m / mMax, Y = (v) => 10 + H * (1 - v / (Math.ceil(yMax * 2) / 2));
  ctx.strokeStyle = '#333'; ctx.fillStyle = '#999'; ctx.font = '10px system-ui'; ctx.lineWidth = 1;
  for (const m of [0, 15, 30, 45, 60, 75, 90]) { ctx.beginPath(); ctx.moveTo(X(m), 10); ctx.lineTo(X(m), 10 + H); ctx.stroke(); ctx.fillText(`${m}'`, X(m) - 6, h - 6); }
  const top = Math.ceil(yMax * 2) / 2; for (let v = 0; v <= top + 1e-9; v += 0.5) { ctx.fillText(v.toFixed(1), 4, Y(v) + 3); }
  for (const t of [0, 1]) {
    ctx.strokeStyle = couleur(Q, t); ctx.lineWidth = 2; ctx.beginPath(); let prev = null;
    for (const p of S[t]) { if (!prev) ctx.moveTo(X(p.m), Y(p.v)); else { ctx.lineTo(X(p.m), Y(prev.v)); ctx.lineTo(X(p.m), Y(p.v)); } prev = p; }
    ctx.stroke();
    for (const p of S[t]) if (p.but) { ctx.fillStyle = couleur(Q, t); ctx.beginPath(); ctx.arc(X(p.m), Y(p.v), 4.5, 0, 2 * Math.PI); ctx.fill(); }
  }
}
