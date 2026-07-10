import * as THREE from 'three/webgpu';

// debug-gizmos — the SCENE VIEW of the agent editor, for humans AND agents: add `?debug=1` to any
// scene URL (works on the deployed site too) and see what the engine sees — physics colliders as
// wireframes (static amber, kinematic cyan — doors move), interactable radii as green rings, the
// city's drivable routes as sky-blue lines, plus a live DOM panel (position, site, nearest
// interactables with distances, draw calls / triangles). One InstancedMesh per gizmo family — the
// overlay itself must not wreck the perf it helps diagnose. Same rules as everywhere: depthTest off
// so nothing hides a collider, dispose() removes everything.
export class DebugGizmos {
  /** opts: { phys?, sys?, city?, getState? } — pass what the scene has; missing parts are skipped. */
  constructor(scene, { phys = null, sys = null, city = null, getState = null } = {}) {
    this.scene = scene; this.phys = phys; this.sys = sys; this.city = city; this.getState = getState;
    this.group = new THREE.Group(); this.group.renderOrder = 99;
    this.disposables = []; this._kin = [];
    scene.add(this.group);
    if (phys?.boxes?.length) this._buildColliders();
    if (sys?.items?.length) this._buildRings();
    if (city?.paths) this._buildPaths();
    this._buildPanel();
  }

  _mat(color, opacity) {
    const m = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity, depthTest: false });
    this.disposables.push(m); return m;
  }

  _buildColliders() {
    const bg = new THREE.BoxGeometry(1, 1, 1); this.disposables.push(bg);
    const groups = { static: { color: 0xffb020, list: [] }, kinematic: { color: 0x35d8ff, list: [] } };
    for (const b of this.phys.boxes) groups[b.kind]?.list.push(b);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (const kind of Object.keys(groups)) {
      const { color, list } = groups[kind]; if (!list.length) continue;
      const im = new THREE.InstancedMesh(bg, this._mat(color, kind === 'static' ? 0.16 : 0.5), list.length);
      list.forEach((b, k) => {
        q.set(...(b.rot || [0, 0, 0, 1]));
        m4.compose(p.set(...b.pos), q, s.set(b.half[0] * 2, b.half[1] * 2, b.half[2] * 2));
        im.setMatrixAt(k, m4);
        if (b.kind === 'kinematic' && b.body) this._kin.push({ b, im, k });
      });
      im.instanceMatrix.needsUpdate = true; im.frustumCulled = false;
      this.group.add(im); this.disposables.push(im);
    }
  }

  _buildRings() {
    const rg = new THREE.RingGeometry(0.92, 1, 28); rg.rotateX(-Math.PI / 2); this.disposables.push(rg);
    const im = new THREE.InstancedMesh(rg, this._mat(0x3ae06e, 0.85), this.sys.items.length);
    const m4 = new THREE.Matrix4();
    this.sys.items.forEach((it, k) => {
      const [x, y, z] = typeof it.pos === 'function' ? it.pos() : it.pos;
      const r = it.radius || 1;
      m4.makeScale(r, 1, r); m4.setPosition(x, y + 0.06, z);
      im.setMatrixAt(k, m4);
    });
    im.instanceMatrix.needsUpdate = true; im.frustumCulled = false;
    this.group.add(im); this.disposables.push(im);
  }

  _buildPaths() {
    const pts = [];
    for (const key of Object.keys(this.city.paths)) {
      const p = this.city.paths[key]; if (!p) continue;
      for (let i = 0; i < p.length - 1; i++) pts.push(p[i][0], 0.5, p[i][1], p[i + 1][0], 0.5, p[i + 1][1]);
    }
    if (!pts.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const m = new THREE.LineBasicMaterial({ color: 0x58b6ff, transparent: true, opacity: 0.9, depthTest: false });
    const lines = new THREE.LineSegments(g, m); lines.frustumCulled = false;
    this.group.add(lines); this.disposables.push(g, m);
  }

  _buildPanel() {
    const el = document.createElement('div'); el.id = 'gizmos';
    el.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:60;background:rgba(8,11,17,.86);color:#cfe3ff;' +
      'font:11px/1.5 ui-monospace,monospace;padding:9px 11px;border-radius:9px;border:1px solid #24334a;max-width:330px;pointer-events:none;white-space:pre';
    document.body.appendChild(el);
    this.panel = el;
  }

  /** Call each frame: tracks kinematic colliders (doors) + refreshes the panel. Cheap. */
  update(renderer = null) {
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    for (const { b, im, k } of this._kin) {
      const t = b.body.translation(), r = b.body.rotation();
      m4.compose(new THREE.Vector3(t.x, t.y, t.z), q.set(r.x, r.y, r.z, r.w), s.set(b.half[0] * 2, b.half[1] * 2, b.half[2] * 2));
      im.setMatrixAt(k, m4); im.instanceMatrix.needsUpdate = true;
    }
    if (!this.panel) return;
    const st = this.getState ? this.getState() : {};
    let txt = `🔧 debug — ${st.site ?? '?'}  pos ${st.pos ? st.pos.map((v) => v.toFixed(1)).join(' ') : '?'}`;
    if (renderer?.info) txt += `\ndraws ${renderer.info.render.calls}  tris ${(renderer.info.render.triangles / 1000).toFixed(0)}k`;
    if (this.sys && st.pos) {
      const near = this.sys.items
        .map((it) => { const p = typeof it.pos === 'function' ? it.pos() : it.pos; const l = typeof it.label === 'function' ? it.label() : it.label; return { l, d: Math.hypot(p[0] - st.pos[0], p[2] - st.pos[2]) }; })
        .sort((a, b) => a.d - b.d).slice(0, 4);
      for (const n of near) txt += `\n${n.d.toFixed(1).padStart(5)} m  ${String(n.l).slice(0, 40)}`;
    }
    if (this.panel.textContent !== txt) this.panel.textContent = txt;
  }

  dispose() {
    this.scene.remove(this.group);
    this.panel?.remove();
    for (const d of this.disposables) d.dispose?.();
  }
}
