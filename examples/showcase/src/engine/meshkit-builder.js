import * as THREE from 'three/webgpu';

// meshkit-builder — wrap meshkit data ({positions, normals, indices}) into three.js. The data side
// (engine/meshkit.js) is dep-free and node-tested; this is the only file that touches the renderer.
export function toGeometry(mesh) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
  g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  g.computeBoundingSphere();
  return g;
}

/** parts: [{ mesh, color?, roughness?, metalness?, emissive?, at?, rotY?, scale? }] → one Group. */
export function buildParts(parts) {
  const group = new THREE.Group();
  const disposables = [];
  for (const p of parts) {
    const g = toGeometry(p.mesh);
    const m = new THREE.MeshStandardNodeMaterial({
      color: p.color ?? 0xb8b2a6, roughness: p.roughness ?? 0.7, metalness: p.metalness ?? 0,
      ...(p.emissive ? { emissive: p.emissive, emissiveIntensity: p.emissiveIntensity ?? 1 } : {}),
    });
    const mesh = new THREE.Mesh(g, m);
    if (p.at) mesh.position.set(...p.at);
    if (p.rotY) mesh.rotation.y = p.rotY;
    if (p.scale) mesh.scale.setScalar(p.scale);
    mesh.castShadow = true;
    group.add(mesh);
    disposables.push(g, m);
  }
  return { group, dispose: () => disposables.forEach((d) => d.dispose?.()) };
}
