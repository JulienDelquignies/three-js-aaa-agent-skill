import * as THREE from 'three/webgpu';
import { sphere, displace, transform } from './meshkit.js';
import { toGeometry } from './meshkit-builder.js';

// beach-builder — turn a beach model (engine/beach.js) into the resort: the sand strip, the SEA
// (a wide animated-feel water plane + a foam line at the waterline), procedural palm trees (leaning
// trunk, drooping fronds, coconuts), sun loungers and parasols. LOCAL resort space — place the group
// at the resort's world offset and feed the returned colliders (palms/loungers/parasols) to physics.
// The villa itself is built by place-builder from beach.villa; seats returns the sittable loungers
// (local pos/yaw, seatH) so the scene can wire the sit interactions.
export function buildBeach(beach, { theme = null } = {}) {
  const group = new THREE.Group();
  const disposables = [], colliders = [], seats = [];
  const mat = (o) => { const m = new THREE.MeshStandardNodeMaterial(o); disposables.push(m); return m; };
  const S = beach.sand, SEA = beach.sea;

  // the SAND: a warm strip barely above the ground plane, plus a wet-sand band at the waterline
  const sandM = mat({ color: 0xbfa26b, roughness: 1 });          // warm but not blinding (bloom!)
  const sand = new THREE.Mesh(new THREE.BoxGeometry(S[2] - S[0], 0.08, S[3] - S[1]), sandM);
  disposables.push(sand.geometry);
  sand.position.set((S[0] + S[2]) / 2, 0.02, (S[1] + S[3]) / 2); sand.receiveShadow = true;
  group.add(sand);
  const wetM = mat({ color: 0xa8905f, roughness: 0.65 });
  const wet = new THREE.Mesh(new THREE.BoxGeometry(S[2] - S[0], 0.07, 2.4), wetM);
  disposables.push(wet.geometry);
  wet.position.set((S[0] + S[2]) / 2, 0.02, S[3] - 1.0); wet.receiveShadow = true;
  group.add(wet);

  // the SEA: a deep plane sloping nowhere (flat, slightly below the sand lip) + a foam line — the
  // VISUAL plane runs far wider/deeper than the data rect so the horizon reads as open water
  // ...but only AWAY from the mainland (east/south): a symmetric extension floods the city next door
  const seaM = mat({ color: 0x1a6d8f, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.92 });
  const seaW = SEA[2] - SEA[0] + 240, seaD = SEA[3] - SEA[1] + 220;
  const sea = new THREE.Mesh(new THREE.BoxGeometry(seaW, 0.06, seaD), seaM);
  disposables.push(sea.geometry);
  sea.position.set(SEA[0] + seaW / 2, -0.015, SEA[1] + seaD / 2);
  group.add(sea);
  const foamM = mat({ color: 0xf4fbff, roughness: 0.5, emissive: 0xdff2ff, emissiveIntensity: 0.25 });
  const foam = new THREE.Mesh(new THREE.BoxGeometry(S[2] - S[0], 0.05, 0.5), foamM);
  disposables.push(foam.geometry);
  foam.position.set((S[0] + S[2]) / 2, 0.012, S[3] + 0.2);
  group.add(foam);

  // PALMS: a leaning segmented trunk + a crown of drooping fronds + coconuts (shared geometries)
  const trunkM = mat({ color: 0x8a6a48, roughness: 0.95 });
  const frondM = mat({ color: 0x2f7a3a, roughness: 0.85 });
  const cocoM = mat({ color: 0x5d4a2e, roughness: 0.9 });
  const segGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.9, 7);
  const frondGeo = new THREE.BoxGeometry(0.34, 0.03, 1.9);
  frondGeo.translate(0, 0, 0.95);                                  // pivot at the trunk end
  const cocoGeo = new THREE.SphereGeometry(0.09, 8, 6);
  disposables.push(segGeo, frondGeo, cocoGeo);
  let pi = 0;
  for (const [x, z, s] of beach.palms) {
    const palm = new THREE.Group(); palm.position.set(x, 0, z);
    const lean = 0.10 + (pi % 3) * 0.04, leanDir = (pi * 2.399) % (Math.PI * 2);   // varied, deterministic
    const nSeg = 4;
    let px = 0, py = 0, pz = 0;
    for (let i = 0; i < nSeg; i++) {
      const seg = new THREE.Mesh(segGeo, trunkM); seg.castShadow = true;
      seg.scale.setScalar(s * (1 - i * 0.06));
      seg.position.set(px, py + 0.45 * s, pz);
      seg.rotation.set(Math.cos(leanDir) * lean * i, 0, Math.sin(leanDir) * lean * i);
      palm.add(seg);
      py += 0.86 * s; px += Math.sin(leanDir) * lean * i * 0.5; pz += Math.cos(leanDir) * lean * i * 0.5;
    }
    const crown = new THREE.Group(); crown.position.set(px, py + 0.1 * s, pz);
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(frondGeo, frondM); f.castShadow = true;
      f.scale.setScalar(s);
      f.rotation.y = (i / 7) * Math.PI * 2 + pi * 0.7;
      f.rotation.x = -0.5 - (i % 2) * 0.25;                        // droop
      crown.add(f);
    }
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(cocoGeo, cocoM);
      c.position.set(Math.cos(i * 2.1) * 0.16 * s, -0.06 * s, Math.sin(i * 2.1) * 0.16 * s);
      crown.add(c);
    }
    palm.add(crown);
    group.add(palm);
    colliders.push({ pos: [x, py / 2, z], half: [0.14 * s, py / 2, 0.14 * s] });
    pi++;
  }

  // TRANSATS (sun loungers): slatted seat + reclined back + feet — facing the sea by contract
  const slatM = mat({ color: theme?.primary ?? 0x2e6db4, roughness: 0.8 });
  const frameM = mat({ color: 0xf0ede6, roughness: 0.6, metalness: 0.2 });
  for (const t of beach.transats) {
    const g = new THREE.Group(); g.position.set(t.x, 0, t.z); g.rotation.y = t.yaw;
    const add = (w, h, d, x, y, z, m, rx = 0) => {
      const bg = new THREE.BoxGeometry(w, h, d); disposables.push(bg);
      const mm = new THREE.Mesh(bg, m); mm.position.set(x, y, z); mm.rotation.x = rx; mm.castShadow = true; g.add(mm);
    };
    add(0.62, 0.05, 1.15, 0, 0.32, 0.22, slatM);                   // seat deck (feet toward +z = the sea)
    add(0.62, 0.05, 0.72, 0, 0.52, -0.62, slatM, 0.85);            // backrest hinged at the deck head, reclined away from the sea
    for (const [lx, lz] of [[-0.26, 0.7], [0.26, 0.7], [-0.26, -0.3], [0.26, -0.3]]) add(0.05, 0.32, 0.05, lx, 0.16, lz, frameM);
    group.add(g);
    colliders.push({ pos: [t.x, 0.3, t.z], half: [0.34, 0.3, 0.85], yaw: t.yaw });
    seats.push({ pos: [t.x, 0, t.z], yaw: t.yaw, seatH: 0.38 });
  }

  // ROCKS at the waterline corners — meshkit displaced spheres (organic, seeded), not boxes
  const rockM = mat({ color: 0x6f6a63, roughness: 0.95 });
  const mul = (seed) => { let t = seed >>> 0; return () => { t += 0x6D2B79F5; let x = Math.imul(t ^ (t >>> 15), 1 | t); x ^= x + Math.imul(x ^ (x >>> 7), 61 | x); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };
  [[S[0] + 1.6, S[3] - 1.2, 0.7], [S[0] + 3.1, S[3] - 0.6, 0.45], [S[2] - 1.8, S[3] - 1.0, 0.8], [S[2] - 3.4, S[3] - 0.5, 0.4]].forEach(([rx, rz, rs], ri) => {
    const rnd = mul(97 + ri * 31);
    const f = [rnd() * 4 + 2, rnd() * 4 + 2, rnd() * 4 + 2], ph = [rnd() * 7, rnd() * 7, rnd() * 7];
    const rmesh = transform(
      displace(sphere(0.5, { segments: 22, rings: 14 }), (x, y, z) => 0.1 * Math.sin(x * f[0] + ph[0]) * Math.sin(y * f[1] + ph[1]) + 0.06 * Math.sin(z * f[2] + ph[2])),
      { at: [rx, rs * 0.3, rz], scale: [rs, rs * 0.7, rs] });
    const rock = new THREE.Mesh(toGeometry(rmesh), rockM); rock.castShadow = rock.receiveShadow = true;
    group.add(rock); disposables.push(rock.geometry);
    colliders.push({ pos: [rx, rs * 0.3, rz], half: [rs * 0.5, rs * 0.35, rs * 0.5] });
  });

  // PARASOLS: pole + a low cone canopy over every other lounger
  const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 2.1, 8);
  const canopyGeo = new THREE.ConeGeometry(1.15, 0.42, 10, 1, true);
  disposables.push(poleGeo, canopyGeo);
  const poleM = mat({ color: 0xb9b2a4, roughness: 0.6 });
  const canM = mat({ color: 0xd8543e, roughness: 0.9, side: THREE.DoubleSide });   // terracotta — white blows out
  for (const [x, z] of beach.parasols) {
    const pole = new THREE.Mesh(poleGeo, poleM); pole.position.set(x, 1.05, z); group.add(pole);
    const can = new THREE.Mesh(canopyGeo, canM); can.position.set(x, 2.0, z); can.castShadow = true; group.add(can);
    colliders.push({ pos: [x, 1.05, z], half: [0.05, 1.05, 0.05] });
  }

  return { group, colliders, seats, dispose: () => disposables.forEach((d) => d.dispose?.()) };
}
