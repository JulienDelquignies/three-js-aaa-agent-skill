// phone — the DS's phone as a real one: a HOME SCREEN of apps (wallpaper, status bar, badges, dock,
// home bar) and full-screen app pages with a back header. Self-contained DOM (injects its own CSS,
// dispose() removes everything) — no three.js. The scene passes the APPS: each is
//   { id, name, icon, badge?: () => number, render?: (page, phone) => void, launch?: () => void }
// `launch` (instead of `render`) makes the icon an ACTION — e.g. the Plan app closes the phone and
// opens the Top-Eleven-style city view. Data comes from game-state.js (reference/35).
const CSS = `
#phone { position: fixed; right: 18px; bottom: 18px; width: 300px; height: 596px; z-index: 40;
  background: #05070b; border: 1px solid #262e3e; border-radius: 34px; box-shadow: 0 24px 60px -18px rgba(0,0,0,.85), inset 0 0 0 3px #10141d;
  font: 500 13px/1.45 system-ui, sans-serif; color: #eef1f7; display: none; flex-direction: column; overflow: hidden; }
#phone.open { display: flex; }
#phone .screen { position: absolute; inset: 6px; border-radius: 28px; overflow: hidden; display: flex; flex-direction: column;
  background: linear-gradient(160deg, #14233f 0%, #0e1830 34%, #251b3e 72%, #0c1020 100%); }
#phone .status { height: 34px; display: flex; align-items: center; justify-content: space-between; padding: 8px 20px 0;
  font: 700 12px system-ui; color: #fff; }
#phone .status .notch { position: absolute; left: 50%; top: 7px; transform: translateX(-50%); width: 96px; height: 20px;
  border-radius: 999px; background: #05070b; }
#phone .apps { flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); align-content: start;
  gap: 16px 6px; padding: 22px 14px; }
#phone .app { display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; border: 0; background: none; color: #e6ebf5; font: 600 10.5px system-ui; }
#phone .app .ic { position: relative; width: 56px; height: 56px; border-radius: 14px; display: grid; place-items: center; font-size: 27px;
  background: linear-gradient(150deg, rgba(255,255,255,.16), rgba(255,255,255,.05)); border: 1px solid rgba(255,255,255,.14);
  box-shadow: 0 6px 14px -6px rgba(0,0,0,.6); }
#phone .app .ic .badge { position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; border-radius: 999px;
  background: #e5484d; color: #fff; font: 800 11px/18px system-ui; text-align: center; padding: 0 4px; }
#phone .page { position: absolute; inset: 0; display: none; flex-direction: column; background: #0b0f17; }
#phone .page.on { display: flex; }
#phone .page .head { display: flex; align-items: center; gap: 8px; padding: 40px 12px 10px; border-bottom: 1px solid #1c2432; }
#phone .page .head button { border: 0; background: none; color: #6ea8ff; font: 600 14px system-ui; cursor: pointer; }
#phone .page .head b { font-size: 15px; }
#phone .page .body { flex: 1; overflow: auto; padding: 12px; }
#phone .row { display: flex; justify-content: space-between; gap: 8px; padding: 7px 9px; border-radius: 9px; }
#phone .row:nth-child(odd) { background: #10151f; }
#phone .kpi { font-size: 21px; font-weight: 800; color: #fff; }
#phone .msg { padding: 10px 11px; border-radius: 13px; background: #121826; border: 1px solid #202a3c; margin-bottom: 8px; }
#phone .msg b { color: #8fc1ff; }
#phone .placeholder { color: #6b7487; text-align: center; margin-top: 40px; }
#phone .homebar { height: 26px; display: grid; place-items: center; cursor: pointer; }
#phone .homebar i { width: 96px; height: 4.5px; border-radius: 999px; background: rgba(255,255,255,.35); }`;

export class Phone {
  constructor({ state, apps }) {
    this.state = state; this.apps = apps;
    this._open = false;
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    const root = document.createElement('div'); root.id = 'phone';
    root.innerHTML = `
      <div class="screen">
        <div class="status"><span>9:41</span><div class="notch"></div><span>𝄙 ▮▮▮</span></div>
        <div class="apps"></div>
        <div class="page"><div class="head"><button>‹ Accueil</button><b></b></div><div class="body"></div></div>
        <div class="homebar"><i></i></div>
      </div>`;
    document.body.appendChild(root);
    this.root = root; this._style = style;
    this.grid = root.querySelector('.apps'); this.page = root.querySelector('.page');
    this.pageTitle = this.page.querySelector('b'); this.pageBody = this.page.querySelector('.body');
    this.page.querySelector('.head button').addEventListener('click', () => this.homeScreen());
    root.querySelector('.homebar').addEventListener('click', () => this.homeScreen());
    this._buildHome();
  }
  get isOpen() { return this._open; }
  toggle() { this._open ? this.close() : this.open(); }
  open() { this._open = true; this.root.classList.add('open'); this.homeScreen(); }
  close() { this._open = false; this.root.classList.remove('open'); }
  homeScreen() { this.page.classList.remove('on'); this._refreshBadges(); }
  /** call each frame (cheap) — keeps app badges live */
  update() { if (this._open && !this.page.classList.contains('on')) this._refreshBadges(); }

  _buildHome() {
    this.grid.innerHTML = '';
    for (const app of this.apps) {
      const b = document.createElement('button'); b.className = 'app'; b.dataset.app = app.id;
      b.innerHTML = `<span class="ic">${app.icon}<span class="badge" style="display:none"></span></span><span>${app.name}</span>`;
      b.addEventListener('click', () => this._openApp(app.id));
      this.grid.appendChild(b);
    }
    this._refreshBadges();
  }
  _refreshBadges() {
    for (const app of this.apps) {
      const el = this.grid.querySelector(`[data-app="${app.id}"] .badge`); if (!el) continue;
      const n = app.badge ? app.badge() : 0;
      el.style.display = n ? 'block' : 'none'; el.textContent = n;
    }
  }
  _openApp(id) {
    const app = this.apps.find((a) => a.id === id); if (!app) return;
    if (app.launch) { app.launch(); return; }                     // action app (e.g. Plan → city view)
    this.pageTitle.textContent = `${app.icon} ${app.name}`;
    this.pageBody.innerHTML = '';
    app.render?.(this.pageBody, this);
    this.page.classList.add('on');
    this._refreshBadges();
  }
  dispose() { this.root.remove(); this._style.remove(); }
}

/** Ready-made app pages over game-state (the scene composes its own app list). */
export const PhoneApps = {
  messages: (state) => ({
    id: 'messages', name: 'Messages', icon: '💬', badge: () => state.unread,
    render: (body) => {
      state.markRead();
      body.innerHTML = state.messages.map((m) => `<div class="msg"><b>${m.from}</b><br>${m.text}</div>`).join('') || '<div class="placeholder">Aucun message.</div>';
    },
  }),
  effectif: (state) => ({
    id: 'effectif', name: 'Effectif', icon: '👥',
    render: (body) => {
      body.innerHTML = state.players.map((p) => `<div class="row"><span><b style="color:#8fc1ff">${p.poste}</b>&nbsp; ${p.name} <span style="color:#5b6577">(${p.age})</span></span><span style="font-weight:800;color:${p.note >= 70 ? '#57c07a' : p.note >= 60 ? '#e0b54c' : '#9fb0ca'}">${p.note}</span></div>`).join('');
    },
  }),
  finances: (state) => ({
    id: 'finances', name: 'Finances', icon: '💶',
    render: (body) => {
      body.innerHTML = `<div class="row"><span>Budget transferts</span><span class="kpi">${state.budget} M€</span></div>
        <div class="row"><span>Masse salariale</span><span style="font-weight:700">${Math.round(state.budget * 0.6 * 10) / 10} M€/an</span></div>
        <div class="row"><span>Compte perso</span><span class="kpi">${state.cash} k€</span></div>
        <div class="row"><span>Votre voiture</span><span style="font-weight:700">${state.car?.name || '—'}</span></div>
        <div class="placeholder">Offres & clauses — bientôt.</div>`;
    },
  }),
  transferts: (state) => ({
    id: 'transferts', name: 'Transferts', icon: '🔁',
    render: (body) => {
      body.innerHTML = '<div class="row"><span style="font-weight:700">Shortlist scouting</span><span style="color:#5b6577">rapports</span></div>' +
        (state.shortlist.length
          ? state.shortlist.map((p) => `<div class="row"><span><b style="color:#8fc1ff">${p.poste}</b>&nbsp; ${p.name} <span style="color:#5b6577">· ${p.ville} ${p.mode === 'jet' ? '✈️' : '🚆'}</span></span><span style="font-weight:800;color:${p.note >= 75 ? '#57c07a' : '#e0b54c'}">${p.note}</span></div>`).join('')
          : '<div class="placeholder">Aucun rapport — partez en voyage de scouting (gare / aéroport).</div>');
    },
  }),
  placeholder: (id, name, icon, note = 'Bientôt.') => ({
    id, name, icon, render: (body) => { body.innerHTML = `<div class="placeholder">${note}</div>`; },
  }),
};
