import * as THREE from 'three/webgpu';

// Interactables — the runtime side of character↔world interaction (the validators in interaction.js/
// scene-validate.js check it; THIS makes it playable): a proximity system with prompts ("E — Ouvrir"),
// DOORS that really open (hinged panel + kinematic Rapier collider, so the doorway blocks until opened),
// and helpers to attach a carried object to a hand bone. Sitting lives in CharacterController.sitAt()
// (procedural pose); scenes register seats/doors/carryables here. See reference/30.

/** Nearest-in-range interactable picker. Items: { label: string|()=>string, pos: ()=>[x,y,z], radius,
 *  onInteract() }. Call update(playerPos) each frame, show .promptText, call interact() on the key. */
export class InteractableSystem {
  constructor() { this.items = []; this.current = null; }
  add(item) { this.items.push(item); return item; }
  update(p) {
    let best = null, bd = Infinity;
    for (const it of this.items) {
      const q = it.pos();
      const d = Math.hypot(q[0] - p.x, q[2] - p.z);
      if (d <= it.radius && d < bd) { best = it; bd = d; }
    }
    this.current = best;
    this.promptText = best ? (typeof best.label === 'function' ? best.label() : best.label) : '';
    return best;
  }
  interact() { if (this.current) this.current.onInteract(); }
}

const _v = new THREE.Vector3();

/**
 * A hinged door built from a floorplan wall opening: visual panel + KINEMATIC Rapier collider that
 * swings with it — closed, the character controller can't pass; open, the doorway is free.
 *   new Door(scene, phys, { hinge:[x,z], baseYaw, width, height, at })   // baseYaw = wall direction
 * update(dt) eases the angle (damped); toggle() opens/closes (90° into +normal side).
 */
export class Door {
  constructor(scene, phys, { hinge, baseYaw = 0, width, height, y = 0, at = [0, 0, 0], color = 0x7a5a3a }) {
    this.hinge = hinge; this.baseYaw = baseYaw; this.w = width; this.h = height; this.y = y; this.at = at;
    this.angle = 0; this.target = 0; this.open = false;
    this.group = new THREE.Group();
    this.group.position.set(at[0] + hinge[0], at[1] + y, at[2] + hinge[1]);
    this.group.rotation.y = baseYaw;
    const geo = new THREE.BoxGeometry(width - 0.04, height - 0.04, 0.055);
    const mat = new THREE.MeshStandardNodeMaterial({ color, roughness: 0.7 });
    this.panel = new THREE.Mesh(geo, mat); this.panel.castShadow = true;
    this.panel.position.set(width / 2, height / 2, 0);                    // hinged at local x=0
    this.group.add(this.panel);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardNodeMaterial({ color: 0xc9b26a, metalness: 0.7, roughness: 0.35 }));
    knob.position.set(width - 0.12, height / 2, 0.05); this.group.add(knob);
    scene.add(this.group);
    this._dispose = [geo, mat, knob.geometry, knob.material];
    this.body = phys ? phys.addKinematicBox([at[0] + hinge[0] + Math.cos(baseYaw) * width / 2, at[1] + y + height / 2, at[2] + hinge[1] - Math.sin(baseYaw) * width / 2], [width / 2, height / 2, 0.04]) : null;
    this._sync();
  }
  toggle() { this.open = !this.open; this.target = this.open ? Math.PI * 0.52 : 0; }
  centre() { const yw = this.baseYaw; return [this.at[0] + this.hinge[0] + Math.cos(yw) * this.w / 2, this.at[1] + this.y + 1, this.at[2] + this.hinge[1] - Math.sin(yw) * this.w / 2]; }
  update(dt) {
    const k = 1 - Math.exp(-8 * dt);
    this.angle += (this.target - this.angle) * k;
    this.group.rotation.y = this.baseYaw + this.angle;
    this._sync();
  }
  _sync() {
    if (!this.body) return;
    const yw = this.baseYaw + this.angle;
    const cx = this.at[0] + this.hinge[0] + Math.cos(yw) * this.w / 2;
    const cz = this.at[2] + this.hinge[1] - Math.sin(yw) * this.w / 2;
    this.body.setNextKinematicTranslation({ x: cx, y: this.at[1] + this.y + this.h / 2, z: cz });
    this.body.setNextKinematicRotation({ x: 0, y: Math.sin(yw / 2), z: 0, w: Math.cos(yw / 2) });
  }
  dispose() { for (const d of this._dispose) d.dispose?.(); }
}

/** Build a Door for every door opening of a floorplan floor (interior + entrance). */
export function doorsFromFloorplan(scene, phys, model, floorIndex = 0, { at = [0, 0, 0] } = {}) {
  const doors = [];
  const f = model.floors[floorIndex];
  for (const w of f.walls) for (const o of w.openings) {
    if (o.type !== 'door') continue;
    const ux = Math.sign(w.b[0] - w.a[0]), uz = Math.sign(w.b[1] - w.a[1]);
    const hinge = [w.a[0] + ux * (o.at - o.w / 2), w.a[1] + uz * (o.at - o.w / 2)];
    const baseYaw = ux ? (ux > 0 ? 0 : Math.PI) : (uz > 0 ? -Math.PI / 2 : Math.PI / 2);
    doors.push(new Door(scene, phys, { hinge, baseYaw, width: o.w, height: o.h, y: f.y, at }));
  }
  return doors;
}

/** Follow a hand bone with a carried object (call each frame while carried). */
export function carryFollow(handBone, mesh, body = null, offset = [0, -0.12, 0.06]) {
  handBone.getWorldPosition(_v);
  mesh.position.set(_v.x + offset[0], _v.y + offset[1], _v.z + offset[2]);
  if (body) body.setTranslation({ x: mesh.position.x, y: mesh.position.y, z: mesh.position.z }, false);
}
