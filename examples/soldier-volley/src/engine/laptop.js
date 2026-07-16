// laptop — the DS's COMPUTER as diegetic UI (the second screen of reference/35): a laptop-styled
// window (menu bar, dock, wide content) over the SAME game-state and the SAME app renderers as the
// phone — one data layer, two presentations, they can never disagree. Self-contained DOM like
// phone.js (injects its CSS, dispose() removes everything). The 3D half (the folded prop in the
// hand, the hinge) lives in laptop-prop.js; the scene opens this UI once the lid is up.
const CSS = `
#laptop { position: fixed; left: 50%; bottom: 26px; transform: translateX(-50%); width: min(720px, 92vw); height: min(460px, 74vh);
  z-index: 40; background: #0c0f15; border: 1px solid #2a3346; border-radius: 14px 14px 4px 4px;
  box-shadow: 0 30px 80px -24px rgba(0,0,0,.9), inset 0 0 0 2px #141a26; font: 500 13px/1.5 system-ui, sans-serif;
  color: #e8edf6; display: none; flex-direction: column; overflow: hidden; }
#laptop.open { display: flex; }
#laptop .bar { height: 30px; display: flex; align-items: center; gap: 10px; padding: 0 12px; background: #121826;
  border-bottom: 1px solid #1d2536; font: 600 12px system-ui; color: #aab6cc; }
#laptop .bar .dot { width: 10px; height: 10px; border-radius: 50%; }
#laptop .bar .title { flex: 1; text-align: center; color: #7c8aa5; }
#laptop .main { flex: 1; display: flex; min-height: 0; }
#laptop .dock { width: 168px; border-right: 1px solid #1d2536; padding: 10px 8px; display: flex; flex-direction: column; gap: 4px; background: #0e1320; }
#laptop .dock button { display: flex; align-items: center; gap: 9px; border: 0; background: none; color: #dbe3f2;
  font: 600 12.5px system-ui; padding: 8px 10px; border-radius: 8px; cursor: pointer; text-align: left; }
#laptop .dock button:hover { background: #17203377; }
#laptop .dock button.on { background: #1b2740; color: #fff; }
#laptop .dock .badge { margin-left: auto; min-width: 18px; height: 18px; border-radius: 999px; background: #e5484d;
  color: #fff; font: 800 11px/18px system-ui; text-align: center; padding: 0 4px; }
#laptop .content { flex: 1; overflow: auto; padding: 14px 16px; }
#laptop .content .row { display: flex; justify-content: space-between; gap: 8px; padding: 7px 9px; border-radius: 9px; }
#laptop .content .row:nth-child(odd) { background: #10151f; }
#laptop .content .kpi { font-size: 21px; font-weight: 800; color: #fff; }
#laptop .content .msg { padding: 10px 11px; border-radius: 13px; background: #121826; border: 1px solid #202a3c; margin-bottom: 8px; }
#laptop .content .msg b { color: #8fc1ff; }
#laptop .content .placeholder { color: #6b7487; text-align: center; margin-top: 40px; }`;

export class Laptop {
  constructor({ state, apps }) {
    this.state = state; this.apps = apps;
    this._open = false;
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    const root = document.createElement('div'); root.id = 'laptop';
    root.innerHTML = `
      <div class="bar">
        <span class="dot" style="background:#e5484d"></span><span class="dot" style="background:#e0b54c"></span><span class="dot" style="background:#57c07a"></span>
        <span class="title">DS OS — bureau du directeur sportif</span><span>🔋 100 %</span>
      </div>
      <div class="main"><div class="dock"></div><div class="content"></div></div>`;
    document.body.appendChild(root);
    this.root = root; this._style = style;
    this.dock = root.querySelector('.dock'); this.content = root.querySelector('.content');
    root.querySelector('.dot').addEventListener('click', () => this.close());
    this._buildDock();
  }
  get isOpen() { return this._open; }
  toggle() { this._open ? this.close() : this.open(); }
  open(appId = null) { this._open = true; this.root.classList.add('open'); this._show(appId || this.apps[0].id); }
  close() { this._open = false; this.root.classList.remove('open'); }
  update() { if (this._open) this._refreshBadges(); }

  _buildDock() {
    this.dock.innerHTML = '';
    for (const app of this.apps) {
      const b = document.createElement('button'); b.dataset.app = app.id;
      b.innerHTML = `<span>${app.icon}</span><span>${app.name}</span><span class="badge" style="display:none"></span>`;
      b.addEventListener('click', () => this._show(app.id));
      this.dock.appendChild(b);
    }
  }
  _refreshBadges() {
    for (const app of this.apps) {
      const el = this.dock.querySelector(`[data-app="${app.id}"] .badge`); if (!el) continue;
      const n = app.badge ? app.badge() : 0;
      el.style.display = n ? 'block' : 'none'; el.textContent = n;
    }
  }
  _show(id) {
    const app = this.apps.find((a) => a.id === id); if (!app) return;
    this.dock.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.app === id));
    this.content.innerHTML = '';
    app.render?.(this.content, this);
    this._refreshBadges();
  }
  dispose() { this.root.remove(); this._style.remove(); }
}
