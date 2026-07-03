// Input — one abstraction over keyboard, gamepad, mouse-look and TOUCH (an on-screen joystick + action
// buttons), so a game reads intent, not devices. Native/reusable (reference/22).
//   move()          → {x,z} desired move on the unit disk (keys / left stick / touch stick)
//   consumeLook()   → {dx,dy} look delta since last frame (mouse drag / right stick / right-side touch)
//   consumeZoom()   → wheel/pinch zoom delta
//   down(a)/pressed(a) → held / edge-triggered actions: 'shoot' 'cross' 'sprint' 'jump'
// Actions map to: keyboard (Space/E/Shift/J), gamepad (A/X/RB/B), and touch buttons. Auto-sprint when the
// touch stick is pushed to the rim. Call update() once per frame (polls the gamepad) then read.
const KEY_MOVE = { w: [0, 1], z: [0, 1], arrowup: [0, 1], s: [0, -1], arrowdown: [0, -1], a: [-1, 0], q: [-1, 0], arrowleft: [-1, 0], d: [1, 0], arrowright: [1, 0] };
const KEY_ACTION = { ' ': 'shoot', e: 'cross', shift: 'sprint', j: 'jump' };

export class Input {
  constructor(el = document.body, { lookSensitivity = 0.005, keymap = {}, padmap = {} } = {}) {
    this.el = el; this.sens = lookSensitivity;
    this.keyAction = { ...KEY_ACTION, ...keymap };
    this.padAction = { 0: 'shoot', 2: 'cross', 1: 'jump', ...padmap };
    this.keys = new Set(); this._look = { dx: 0, dy: 0 }; this._zoom = 0;
    this._held = new Set(); this._edge = new Set(); this._touchMove = { x: 0, z: 0 };
    this._dragId = null; this._lastPointer = null;

    this._onKey = (e) => {
      const k = e.key.toLowerCase(); const d = e.type === 'keydown';
      if (KEY_MOVE[k] || k === ' ') e.preventDefault();
      if (d) this.keys.add(k); else this.keys.delete(k);
      const a = this.keyAction[k]; if (a) { if (d) { if (!this._held.has('k:' + a)) this._edge.add(a); this._held.add('k:' + a); } else this._held.delete('k:' + a); }
    };
    addEventListener('keydown', this._onKey); addEventListener('keyup', this._onKey);

    // mouse / stylus look: drag anywhere not on a touch control
    this._onDown = (e) => { if (e.target?.dataset?.ctl) return; this._dragId = e.pointerId; this._lastPointer = { x: e.clientX, y: e.clientY }; };
    this._onMove = (e) => { if (e.pointerId !== this._dragId || !this._lastPointer) return; this._look.dx += (e.clientX - this._lastPointer.x) * this.sens; this._look.dy += (e.clientY - this._lastPointer.y) * this.sens; this._lastPointer = { x: e.clientX, y: e.clientY }; };
    this._onUp = (e) => { if (e.pointerId === this._dragId) { this._dragId = null; this._lastPointer = null; } };
    el.addEventListener('pointerdown', this._onDown); addEventListener('pointermove', this._onMove); addEventListener('pointerup', this._onUp);
    this._onWheel = (e) => { this._zoom += e.deltaY * 0.01; e.preventDefault(); };
    el.addEventListener('wheel', this._onWheel, { passive: false });

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) this._buildTouch(el);
    this._prevBtns = [];
  }

  update() {
    // gamepad
    const gp = navigator.getGamepads?.().find(Boolean);
    this._gpMove = null; this._gpSprint = false;
    if (gp) {
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      this._gpMove = { x: dz(gp.axes[0] || 0), z: -dz(gp.axes[1] || 0) };
      this._look.dx += dz(gp.axes[2] || 0) * 0.05; this._look.dy += dz(gp.axes[3] || 0) * 0.05;
      const btn = (i) => !!gp.buttons[i]?.pressed; const was = this._prevBtns;
      for (const i of [0, 1, 2]) if (btn(i) && !was[i] && this.padAction[i]) this._edge.add(this.padAction[i]);
      this._gpSprint = btn(5) || btn(7);
      this._prevBtns = gp.buttons.map((b) => b.pressed);
    }
  }

  move() {
    let x = 0, z = 0;
    for (const k of this.keys) { const m = KEY_MOVE[k]; if (m) { x += m[0]; z += m[1]; } }
    if (this._gpMove) { x += this._gpMove.x; z += this._gpMove.z; }
    x += this._touchMove.x; z += this._touchMove.z;
    const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; }
    return { x, z };
  }
  consumeLook() { const l = { dx: this._look.dx, dy: this._look.dy }; this._look.dx = 0; this._look.dy = 0; return l; }
  consumeZoom() { const z = this._zoom; this._zoom = 0; return z; }
  down(a) { return this._held.has('k:' + a) || (a === 'sprint' && (this._gpSprint || Math.hypot(this._touchMove.x, this._touchMove.z) > 0.92)) || this._held.has('t:' + a); }
  pressed(a) { const p = this._edge.has(a); return p; }
  endFrame() { this._edge.clear(); }

  _buildTouch(el) {
    const style = 'position:fixed;z-index:30;touch-action:none;user-select:none;-webkit-user-select:none;';
    // left joystick
    const base = document.createElement('div'); base.dataset.ctl = 'stick';
    base.style.cssText = style + 'left:22px;bottom:22px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.25);';
    const knob = document.createElement('div'); knob.dataset.ctl = 'stick';
    knob.style.cssText = style + 'left:60px;bottom:60px;width:54px;height:54px;margin:-27px;border-radius:50%;background:rgba(255,255,255,.35);border:1px solid rgba(255,255,255,.5);';
    base.appendChild(knob); el.appendChild(base);
    const R = 52; let id = null, cx = 0, cy = 0;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px,${-dy}px)`; };
    base.addEventListener('pointerdown', (e) => { id = e.pointerId; const r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; base.setPointerCapture(id); });
    base.addEventListener('pointermove', (e) => { if (e.pointerId !== id) return; let dx = e.clientX - cx, dy = cy - e.clientY; const l = Math.hypot(dx, dy) || 1; const c = Math.min(1, l / R); dx = dx / l * c * R; dy = dy / l * c * R; setKnob(dx, dy); this._touchMove = { x: (dx / R), z: (dy / R) }; });
    const rel = (e) => { if (e.pointerId === id) { id = null; this._touchMove = { x: 0, z: 0 }; setKnob(0, 0); } };
    base.addEventListener('pointerup', rel); base.addEventListener('pointercancel', rel);
    // right action buttons
    const mkBtn = (label, action, right, bottom) => {
      const b = document.createElement('div'); b.dataset.ctl = action; b.textContent = label;
      b.style.cssText = style + `right:${right}px;bottom:${bottom}px;width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 12px system-ui;color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);`;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); this._edge.add(action); this._held.add('t:' + action); });
      const up = () => this._held.delete('t:' + action); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      el.appendChild(b);
    };
    mkBtn('TIR', 'shoot', 26, 40); mkBtn('CTR', 'cross', 100, 90);
  }

  dispose() {
    removeEventListener('keydown', this._onKey); removeEventListener('keyup', this._onKey);
    this.el.removeEventListener('pointerdown', this._onDown); removeEventListener('pointermove', this._onMove); removeEventListener('pointerup', this._onUp);
    this.el.removeEventListener('wheel', this._onWheel);
    this.el.querySelectorAll('[data-ctl]').forEach((e) => e.remove());
  }
}
