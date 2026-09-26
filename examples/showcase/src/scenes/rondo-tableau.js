// rondo-tableau.js — LE TABLEAU DE SCORE TÉLÉ (retour du 26/09 : « un vrai scoreboard type Bundesliga ou Ligue des champions, iconique »).
// Notre propre habillage, dans la grammaire des grandes régies : un bloc compact en haut à gauche, segments en biais (le geste graphique
// qu'on reconnaît de loin), l'horloge mm:ss qui court, les codes d'équipe à 3 lettres et leur pastille bicolore (les couleurs des maillots),
// le score sur plaque claire, la languette du temps additionnel (+3) qui sort de l'horloge, les cartons rouges sous le code, et les temps forts :
// le BUT (le bandeau aux couleurs du buteur glisse sous le tableau, le chiffre du score claque) ; la mi-temps et la fin (le bandeau des stats :
// possession, tirs, cadrés). Lecture seule : l'état et les événements de la sim, rien n'est écrit dans le monde.

const FONT = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&display=swap';
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const lum = (c) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return 0.299 * r + 0.587 * g + 0.114 * b; };

/** Le code 3 lettres d'une équipe : team.code, sinon les initiales (« Grand Bol » → GBO), sinon les 3 premières lettres. */
export function codeDe(t) {
  if (t.code) return t.code.toUpperCase();
  const m = (t.name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  return (m.length > 1 ? m[0][0] + m[1].slice(0, 2) : (m[0] ?? '???').slice(0, 3)).padEnd(3, 'X');
}

const CSS = `
.tb{position:fixed;top:14px;left:16px;z-index:40;pointer-events:none;font-family:'Barlow Condensed','Roboto Condensed','Arial Narrow','DejaVu Sans Condensed',system-ui,sans-serif;color:#fff;filter:drop-shadow(0 6px 14px rgba(0,0,0,.55))}
.tb-row{display:flex;height:38px;align-items:stretch}
.tb-s{transform:skewX(-14deg);display:flex;align-items:center;justify-content:center;margin-right:-1px}
.tb-s>*{transform:skewX(14deg)}
.tb-live{width:10px;background:var(--acc)}
.tb-clk{background:#07090f;min-width:78px;padding:0 12px;font-weight:700;font-size:23px;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:.02em}
.tb-add{background:var(--acc);color:#07090f;font-weight:800;font-size:19px;line-height:1;width:0;overflow:hidden;transition:width .45s cubic-bezier(.2,.9,.2,1)}
.tb-add.on{width:44px}
.tb-tm{background:linear-gradient(180deg,#232b3d,#141a28);padding:0 13px;gap:9px;min-width:86px}
.tb-tm .in{display:flex;align-items:center;gap:9px}
.tb-code{font-weight:700;font-size:24px;line-height:1;letter-spacing:.08em}
.tb-chip{width:7px;height:24px;border-radius:1px;box-shadow:0 0 0 1px rgba(255,255,255,.25)}
.tb-sc{background:#f3f5fa;color:#07090f;min-width:84px;padding:0 10px;font-weight:800;font-size:28px;line-height:1;font-variant-numeric:tabular-nums}
.tb-sc .in{display:flex;gap:7px;align-items:center}
.tb-sc b{display:inline-block;transition:transform .25s}
.tb-sc b.clac{animation:tbclac .9s cubic-bezier(.2,1.6,.3,1)}
@keyframes tbclac{0%{transform:scale(2.2);color:var(--acc)}60%{transform:scale(.9)}100%{transform:scale(1)}}
.tb-sep{opacity:.35;font-weight:600}
.tb-reds{position:absolute;display:flex;gap:3px;top:40px}
.tb-reds i{width:7px;height:10px;background:#e0202f;border-radius:1px;box-shadow:0 0 0 1px #0006}
.tb-band{margin:5px 0 0 26px;height:0;overflow:hidden;transition:height .4s cubic-bezier(.2,.9,.2,1)}
.tb-band.on{height:44px}
.tb-band .in{display:flex;height:44px;align-items:stretch}
.tb-bt{font-weight:800;font-size:30px;line-height:1;letter-spacing:.14em;padding:0 20px;transform:skewX(-14deg);display:flex;align-items:center}
.tb-bt>span,.tb-bn>span{transform:skewX(14deg)}
.tb-bn{background:#07090f;font-weight:600;font-size:22px;line-height:1;padding:0 18px;transform:skewX(-14deg);display:flex;align-items:center;letter-spacing:.03em}
.tb-bn em{font-style:normal;opacity:.6;margin-left:10px}
.tb-sweep{position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 70%);transform:translateX(-120%)}
.tb-band.on .tb-sweep{animation:tbsweep 1.1s .25s ease-out}
@keyframes tbsweep{to{transform:translateX(120%)}}
.tb-stats{margin:5px 0 0 26px;background:rgba(7,9,15,.92);border-left:4px solid var(--acc);padding:0 14px;height:0;overflow:hidden;transition:height .45s;font-weight:600;font-size:17px;line-height:1.5}
.tb-stats.on{height:118px;padding:8px 14px}
.tb-stats .h{font-weight:800;font-size:16px;line-height:1.4;letter-spacing:.16em;color:var(--acc)}
.tb-stats .l{display:grid;grid-template-columns:44px 1fr 44px;gap:8px;align-items:center}
.tb-stats .l span:first-child{text-align:right}
.tb-stats .l span:nth-child(2){text-align:center;opacity:.7;font-weight:500}
@media (max-width:700px){.tb{left:50%;top:8px;transform:translateX(-50%) scale(.8);transform-origin:top center}}
`;

export function tableauInit(teams, acc = '#d7ff3c') {
  if (typeof document === 'undefined') return null;
  if (!document.querySelector(`link[href="${FONT}"]`)) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONT; document.head.appendChild(l); }
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const el = document.createElement('div'); el.className = 'tb'; el.style.setProperty('--acc', acc);
  const tm = (t, i) => `<div class="tb-s tb-tm"><div class="in">${i ? '' : chip(t)}<span class="tb-code">${codeDe(t)}</span>${i ? chip(t) : ''}</div></div>`;
  const chip = (t) => `<span class="tb-chip" style="background:linear-gradient(90deg,${hex(t.primary)} 55%,${hex(t.secondary)} 55%)"></span>`;
  el.innerHTML = `<div class="tb-row"><div class="tb-s tb-live"><i></i></div><div class="tb-s tb-clk"><span>00:00</span></div><div class="tb-s tb-add"><span>+0</span></div>${tm(teams[0], 0)}<div class="tb-s tb-sc"><div class="in"><b>0</b><span class="tb-sep">–</span><b>0</b></div></div>${tm(teams[1], 1)}</div>
    <div class="tb-reds" data-t="0"></div><div class="tb-reds" data-t="1"></div>
    <div class="tb-band"><div class="in" style="position:relative"><div class="tb-bt"><span>BUT</span></div><div class="tb-bn"><span></span></div><div class="tb-sweep"></div></div></div>
    <div class="tb-stats"></div>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s);
  const T = { el, teams, clk: $('.tb-clk span'), add: $('.tb-add'), addT: $('.tb-add span'), sc: el.querySelectorAll('.tb-sc b'), reds: el.querySelectorAll('.tb-reds'), band: $('.tb-band'), bt: $('.tb-bt'), bn: $('.tb-bn span'), stats: $('.tb-stats'), live: $('.tb-live'),
    score: [0, 0], rouges: [0, 0], tirs: [0, 0], cadres: [0, 0], bandFin: 0, _clk: '' };
  // les cartons rouges se posent sous le code de leur équipe (mesuré après la pose des polices)
  const placer = () => { const segs = el.querySelectorAll('.tb-tm'); T.reds.forEach((r, i) => { r.style.left = `${segs[i].offsetLeft + 16}px`; }); };
  placer(); document.fonts?.ready?.then(placer);
  return T;
}

/** Un but : le chiffre claque, le bandeau aux couleurs de l'équipe glisse (6 s). */
export function tableauBut(T, team, texte) {
  if (!T) return;
  const t = T.teams[team] ?? T.teams[0], fg = lum(t.primary) > 150 ? '#07090f' : '#fff';
  T.bt.style.background = `linear-gradient(90deg,${hex(t.primary)},${hex(t.primary)} 70%,${hex(t.secondary)})`; T.bt.style.color = fg;
  T.bn.innerHTML = texte; T.band.classList.add('on'); T.bandFin = performance.now() + 6000;
  const b = T.sc[team === 1 ? 1 : 0]; b.classList.remove('clac'); void b.offsetWidth; b.classList.add('clac');
}

export function tableauEvent(T, st, e) {
  if (!T) return;
  const tm = e.by != null ? st.players[e.by]?.team : null;
  if (e.type === 'temps-additionnel') T.addSec = e.sec ?? 60;
  else if (e.type === 'mi-temps') { T.mt = true; T.addSec = null; }
  else if (e.type === 'shot' && tm != null) T.tirs[tm]++;
  else if (e.type === 'arrêt' && tm != null) T.cadres[1 - tm]++;   // l'arrêt du gardien : un tir cadré de l'adversaire
  else if (e.type === 'but') { const k = e.team ?? tm; if (k != null) T.cadres[k]++; }
  else if (e.type === 'carton' && e.couleur === 'rouge' && tm != null) { T.rouges[tm]++; T.reds[tm].innerHTML = '<i></i>'.repeat(T.rouges[tm]); }
}

/** Chaque image : l'horloge (mm:ss, la languette +N), le score, le bandeau des stats à la mi-temps et à la fin. */
export function tableauUpdate(T, scene) {
  if (!T) return;
  const st = scene.state, ch = scene._mcfg?.chrono, C = st._chrono;
  let txt = '00:00', add = null, stats = null;
  if (T.mt && !st.restart) T.mt = false;   // le coup d'envoi de la 2e période efface la mi-temps
  if (ch && C) {
    const pause = ch.pause ?? 6, dP = ch.duree, deb = (C.periode - 1) * (dP + pause) + (st._ceremonie?.fin ?? 0), tR = st.t - deb, R = C.ratio ?? 1;
    const s = Math.max(0, tR) * R + (C.periode - 1) * 45 * 60, mm = Math.floor(s / 60), ss = Math.floor(s % 60);
    txt = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    if (C.annonce && T.addSec != null) add = `+${Math.max(1, Math.round(T.addSec * R / 60))}`;
    if (st.fini) { txt = 'FIN'; stats = 'FIN DU MATCH'; add = null; }
    else if (T.mt) { txt = 'MT'; stats = 'MI-TEMPS'; add = null; }
    else if (st._ceremonie?.actif) txt = '00:00';
  }
  if (txt !== T._clk) { T._clk = txt; T.clk.textContent = txt; }
  if (add) { if (T.addT.textContent !== add) T.addT.textContent = add; T.add.classList.add('on'); } else T.add.classList.remove('on');
  for (const i of [0, 1]) if (st.score[i] !== T.score[i]) { T.score[i] = st.score[i]; T.sc[i].textContent = String(st.score[i]); }
  T.live.style.opacity = st.fini ? '0.3' : String(0.65 + 0.35 * Math.abs(Math.sin(performance.now() / 700)));
  if (T.band.classList.contains('on') && performance.now() > T.bandFin) T.band.classList.remove('on');
  if (!stats && T.infoN > 0) { T.infoN--; if (T.infoN === 0) T.stats.classList.remove('on'); return; }   // le bandeau d'information (les compositions) tient ses images
  if (stats && !T.stats.classList.contains('on')) {
    const p = C.poss, tot = (p[0] + p[1]) || 1, pc = (k) => Math.round(100 * p[k] / tot);
    const L = (a, n, b) => `<div class="l"><span>${a}</span><span>${n}</span><span>${b}</span></div>`;
    T.stats.innerHTML = `<div class="h">${stats}</div>${L(pc(0) + '%', 'Possession', pc(1) + '%')}${L(T.tirs[0], 'Tirs', T.tirs[1])}${L(T.cadres[0], 'Cadrés', T.cadres[1])}`;
    T.stats.classList.add('on');
  } else if (!stats && T.stats.classList.contains('on')) T.stats.classList.remove('on');
}

/** Un bandeau d'information sous le tableau (ms) : le titre et des lignes [gauche, milieu, droite] — les compositions d'avant-match. */
export function tableauInfo(T, titre, lignes, ms = 8000) {
  if (!T) return;
  const L = (a, n, b) => `<div class="l" style="grid-template-columns:1fr auto 1fr"><span>${a}</span><span>${n}</span><span style="text-align:left">${b}</span></div>`;
  T.stats.innerHTML = `<div class="h">${titre}</div>` + lignes.map((l) => L(...l)).join('');
  T.stats.classList.add('on'); T.infoN = Math.round(ms / 1000 * 60);   // compté en IMAGES rendues (un chargement lent ne le mange pas)
}
