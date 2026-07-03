// phone — the DS's diegetic phone: a self-contained DOM overlay (no three.js) with three tabs:
//   • Carte    — renders THE SAME city data (engine/city.js) as a 2D map: streets, sites, stops, you,
//                your car. Tapping a destination triggers the SAME travel as the pads (onTravel) —
//                one source of truth, two presentations, they can never disagree.
//   • Club     — the FM side read from game-state (budget, roster with positions/ratings).
//   • Messages — pushed by the 3D world (e.g. finishing the restaurant meeting) — unread badge.
// Open/close with a key or the HUD button; the scene pauses movement while it's open. reference/35.
const CSS = `
#phone { position: fixed; right: 18px; bottom: 18px; width: 320px; height: 560px; z-index: 40;
  background: #0d1016; border: 1px solid #2a3242; border-radius: 26px; box-shadow: 0 24px 60px -20px rgba(0,0,0,.8);
  font: 500 13px/1.45 system-ui, sans-serif; color: #dde3ee; display: none; flex-direction: column; overflow: hidden; }
#phone.open { display: flex; }
#phone .notch { height: 24px; display: grid; place-items: center; font-size: 10px; color: #5b6577; letter-spacing: .1em; }
#phone .tabs { display: flex; gap: 4px; padding: 6px 10px; }
#phone .tabs button { flex: 1; padding: 7px 0; border-radius: 10px; border: 1px solid #2a3242; background: #131824;
  color: #9fb0ca; font: 600 12px system-ui; cursor: pointer; position: relative; }
#phone .tabs button.on { background: #1c2536; color: #fff; border-color: #3d4d68; }
#phone .tabs .badge { position: absolute; top: -5px; right: -3px; min-width: 16px; height: 16px; border-radius: 999px;
  background: #e5484d; color: #fff; font-size: 10px; font-weight: 800; display: grid; place-items: center; padding: 0 4px; }
#phone .page { flex: 1; overflow: auto; padding: 10px 12px 14px; }
#phone canvas { width: 100%; border-radius: 12px; background: #0a0d13; display: block; }
#phone .dests { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }
#phone .dests button { padding: 8px 6px; border-radius: 10px; border: 1px solid #2a3242; background: #131824;
  color: #cfe0ff; font: 600 11.5px system-ui; cursor: pointer; }
#phone .dests button:hover { background: #1c2536; }
#phone .row { display: flex; justify-content: space-between; gap: 8px; padding: 6px 8px; border-radius: 8px; }
#phone .row:nth-child(odd) { background: #11151f; }
#phone .kpi { font-size: 22px; font-weight: 800; color: #fff; }
#phone .msg { padding: 9px 10px; border-radius: 12px; background: #131824; border: 1px solid #232c3d; margin-bottom: 8px; }
#phone .msg b { color: #8fc1ff; }
#phone .home { height: 26px; display: grid; place-items: center; }
#phone .home i { width: 90px; height: 4.5px; border-radius: 999px; background: #2a3242; }`;

const SITE_COLORS = { home: '#e0b54c', club: '#4ca7e0', resto: '#c76bd6', stadium: '#57c07a' };
const SITE_SHORT = { home: 'Maison', club: 'Club', resto: 'Restaurant', stadium: 'Stade' };

export class Phone {
  constructor({ city, career, state, getPlayer, getCar, onTravel }) {
    this.city = city; this.career = career; this.state = state;
    this.getPlayer = getPlayer; this.getCar = getCar; this.onTravel = onTravel;
    this._open = false; this._tab = 'carte'; this._last = 0;
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    const root = document.createElement('div'); root.id = 'phone';
    root.innerHTML = `
      <div class="notch">●&nbsp;&nbsp;DS PHONE</div>
      <div class="tabs">
        <button data-t="carte">Carte</button>
        <button data-t="club">Club</button>
        <button data-t="msg">Messages<span class="badge" style="display:none">0</span></button>
      </div>
      <div class="page"></div>
      <div class="home"><i></i></div>`;
    document.body.appendChild(root);
    this.root = root; this.page = root.querySelector('.page'); this.badge = root.querySelector('.badge');
    for (const b of root.querySelectorAll('.tabs button')) b.addEventListener('click', () => { this._tab = b.dataset.t; this._render(); });
    this._style = style;
  }
  get isOpen() { return this._open; }
  toggle() { this._open ? this.close() : this.open(); }
  open() { this._open = true; this.root.classList.add('open'); this._render(); }
  close() { this._open = false; this.root.classList.remove('open'); }
  /** call each frame — repaints the live map markers at ~5 Hz while open */
  update(t) { if (this._open && this._tab === 'carte' && t - this._last > 0.2) { this._last = t; this._drawMap(); } this._badge(); }

  _badge() {
    const n = this.state.unread;
    this.badge.style.display = n ? 'grid' : 'none'; this.badge.textContent = n;
  }
  _render() {
    for (const b of this.root.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.t === this._tab);
    if (this._tab === 'carte') {
      this.page.innerHTML = '<canvas></canvas><div class="dests"></div>';
      const dests = this.page.querySelector('.dests');
      for (const k of Object.keys(this.career.sites)) {
        const b = document.createElement('button');
        b.textContent = `🚗 ${SITE_SHORT[k] || k}`;
        b.addEventListener('click', () => { this.close(); this.onTravel(k); });
        dests.appendChild(b);
      }
      this._drawMap();
    } else if (this._tab === 'club') {
      const s = this.state;
      this.page.innerHTML = `<div class="row"><span>Budget transferts</span><span class="kpi">${s.budget} M€</span></div>` +
        s.players.map((p) => `<div class="row"><span><b style="color:#8fc1ff">${p.poste}</b>&nbsp; ${p.name} <span style="color:#5b6577">(${p.age})</span></span><span style="font-weight:800;color:${p.note >= 70 ? '#57c07a' : p.note >= 60 ? '#e0b54c' : '#9fb0ca'}">${p.note}</span></div>`).join('');
    } else {
      this.state.markRead(); this._badge();
      this.page.innerHTML = this.state.messages.map((m) => `<div class="msg"><b>${m.from}</b><br>${m.text}</div>`).join('') || '<div class="msg">Aucun message.</div>';
    }
  }
  _drawMap() {
    const cv = this.page.querySelector('canvas'); if (!cv) return;
    const { bounds, nx, nz, cell, road } = this.city;
    const W = 296; cv.width = W * 2;
    const kx = (W * 2) / (bounds[2] - bounds[0]);
    const H = Math.round((bounds[3] - bounds[1]) * kx); cv.height = H;
    cv.style.height = `${H / 2}px`;
    const g = cv.getContext('2d');
    const X = (x) => (x - bounds[0]) * kx, Z = (z) => (z - bounds[1]) * kx;
    g.fillStyle = '#0f1420'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#3d4657';                                        // streets = the same grid cells
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++)
      if (road[j * nx + i]) g.fillRect(X(bounds[0] + i * cell), Z(bounds[1] + j * cell), cell * kx + 0.5, cell * kx + 0.5);
    for (const k of Object.keys(this.city.rects)) {                 // sites + labels
      const r = this.city.rects[k];
      g.fillStyle = SITE_COLORS[k] + '33'; g.strokeStyle = SITE_COLORS[k]; g.lineWidth = 2;
      g.fillRect(X(r[0]), Z(r[1]), (r[2] - r[0]) * kx, (r[3] - r[1]) * kx);
      g.strokeRect(X(r[0]), Z(r[1]), (r[2] - r[0]) * kx, (r[3] - r[1]) * kx);
      g.fillStyle = SITE_COLORS[k]; g.font = '700 13px system-ui'; g.textAlign = 'center';
      g.fillText(SITE_SHORT[k] || k, X((r[0] + r[2]) / 2), Z(r[1]) - 5);
    }
    const car = this.getCar?.();                                    // live markers
    if (car) { g.fillStyle = '#e5484d'; g.beginPath(); g.arc(X(car[0]), Z(car[1]), 5, 0, 7); g.fill(); }
    const me = this.getPlayer?.();
    if (me) { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(X(me[0]), Z(me[1]), 4, 0, 7); g.fill(); g.strokeStyle = '#0d1016'; g.lineWidth = 1.5; g.stroke(); }
  }
  dispose() { this.root.remove(); this._style.remove(); }
}
