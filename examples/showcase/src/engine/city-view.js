import * as THREE from 'three/webgpu';

// city-view — the Top-Eleven-style CITY VIEW: press M (or the 🗺️ button, or the phone's Plan app) and
// the camera glides up to a fixed, framed panorama of the 3D city; clickable PINS hover over the
// sites (DOM chips projected every frame); picking one exits the view and starts the drive. No
// SimCity: no free camera, no building — a management-game overview of the world you actually walk.
const CSS = `
.cv-pin { position: fixed; transform: translate(-50%, -100%); z-index: 30; cursor: pointer;
  display: flex; align-items: center; gap: 7px; padding: 8px 14px 8px 10px; border-radius: 999px;
  font: 700 13px system-ui, sans-serif; color: #fff; border: 1px solid rgba(255,255,255,.25);
  background: rgba(12,15,22,.82); backdrop-filter: blur(8px); box-shadow: 0 10px 24px -10px rgba(0,0,0,.7);
  transition: transform .12s ease; }
.cv-pin:hover { transform: translate(-50%, -112%) scale(1.06); }
.cv-pin .ico { width: 26px; height: 26px; border-radius: 999px; display: grid; place-items: center; font-size: 14px; }
.cv-pin::after { content: ''; position: absolute; left: 50%; bottom: -7px; transform: translateX(-50%);
  border: 7px solid transparent; border-bottom: 0; border-top-color: rgba(12,15,22,.82); }
.cv-exit { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); z-index: 30; cursor: pointer;
  padding: 9px 16px; border-radius: 999px; border: 1px solid rgba(255,255,255,.2); color: #e8ebf2;
  background: rgba(12,15,22,.8); backdrop-filter: blur(8px); font: 600 13px system-ui; }`;

const PINS = {
  home: { icon: '🏠', color: '#e0b54c' },
  club: { icon: '🏋️', color: '#4ca7e0' },
  resto: { icon: '🍽️', color: '#c76bd6' },
  dealer: { icon: '🚗', color: '#e5484d' },
  stadium: { icon: '🏟️', color: '#57c07a' },
};
const PIN_H = { home: 5, club: 5, resto: 5, dealer: 5, stadium: 16 };

export class CityView {
  constructor({ city, career, onPick, onExit }) {
    this.city = city; this.career = career; this.onPick = onPick; this.onExit = onExit;
    this.active = false;
    const [x0, z0, x1, z1] = city.bounds;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, span = Math.max(x1 - x0, z1 - z0);
    this.camPos = new THREE.Vector3(cx - span * 0.3, span * 0.52, cz - span * 0.46);
    this.camLook = new THREE.Vector3(cx, 0, cz + span * 0.02);
    this._style = document.createElement('style'); this._style.textContent = CSS; document.head.appendChild(this._style);
    this._pins = []; this._v = new THREE.Vector3();
  }
  enter() {
    if (this.active) return;
    this.active = true;
    for (const key of Object.keys(this.career.sites)) {
      const s = this.career.sites[key], p = PINS[key] || { icon: '📍', color: '#9aa2b1' };
      const el = document.createElement('button'); el.className = 'cv-pin';
      el.innerHTML = `<span class="ico" style="background:${p.color}">${p.icon}</span>${s.label}`;
      el.addEventListener('click', () => { const k = key; this.exit(); this.onPick?.(k); });
      document.body.appendChild(el);
      const r = this.city.rects[key];
      this._pins.push({ el, anchor: new THREE.Vector3((r[0] + r[2]) / 2, PIN_H[key] ?? 6, (r[1] + r[3]) / 2) });
    }
    this._exit = document.createElement('button'); this._exit.className = 'cv-exit';
    this._exit.textContent = '✕ Revenir au personnage (M)';
    this._exit.addEventListener('click', () => { this.exit(); this.onExit?.(); });
    document.body.appendChild(this._exit);
  }
  exit() {
    if (!this.active) return;
    this.active = false;
    for (const p of this._pins) p.el.remove(); this._pins = [];
    this._exit?.remove(); this._exit = null;
  }
  /** drive the camera + reproject the pins — call every frame while active */
  update(camera, dt) {
    const k = 1 - Math.exp(-3 * dt);
    camera.position.lerp(this.camPos, k);
    camera.lookAt(this.camLook);
    for (const p of this._pins) {
      this._v.copy(p.anchor).project(camera);
      const x = (this._v.x * 0.5 + 0.5) * innerWidth, y = (-this._v.y * 0.5 + 0.5) * innerHeight;
      p.el.style.left = `${x.toFixed(1)}px`; p.el.style.top = `${y.toFixed(1)}px`;
      p.el.style.display = this._v.z < 1 ? 'flex' : 'none';
    }
  }
  dispose() { this.exit(); this._style.remove(); }
}
