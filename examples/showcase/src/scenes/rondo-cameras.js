// rondo-cameras.js — LES CAMÉRAS DU MATCH (la liste du 17/09 : « le zoom trop tard, une caméra rapprochée » ; la référence Football Manager).
// Quatre plans, V / le bouton « Caméra » les font tourner, ?cam= au boot :
//   tv         — la régie d'hier (le rail haut au-dessus de la tribune, tout le terrain, zoom dans le dernier tiers) : Rondo._broadcast ;
//   rapprochee — la caméra FM « Broadcast » : une grue à ~13 m, 22 m derrière le ballon côté tribune principale, focale serrée — les
//                corps font 3-4× la taille du plan tv, le jeu reste lisible (le ballon et ses 2-3 voisins) ;
//   tactique   — la plongée haute, le bloc des 22 (le plan « tactique » de FM : lire les lignes) ;
//   joueur     — derrière le porteur, dans le sens de l'attaque (jamais sur le lacet du corps : il tremblerait à chaque appui).
// Lecture de l'état sim, écriture de la seule caméra. Tout lissé (une grue ne saute pas) ; le lissage suit le temps de LECTURE (dt).
import * as THREE from 'three/webgpu';

export const PLANS = ['rapprochee', 'tv', 'tactique', 'joueur'];
export const NOMS_PLANS = { rapprochee: 'Rapprochée', tv: 'Télé', tactique: 'Tactique', joueur: 'Joueur' };

const _p = new THREE.Vector3(), _l = new THREE.Vector3();

export function planDe(q, produit) { const c = q.get('cam'); return PLANS.includes(c) ? c : produit ? 'rapprochee' : 'tv'; }

/** Le plan suivant (V) ; rend son nom. */
export function planSuivant(scene) {
  scene._plan = PLANS[(PLANS.indexOf(scene._plan) + 1) % PLANS.length];
  scene._planT = 0; return NOMS_PLANS[scene._plan];
}

/** LES TOITS QUI BOUCHENT (26/09 : le bandeau noir du plan télé) : la régie filme depuis AU-DESSUS du toit de la tribune principale —
 *  son dessus, sans lumière, mangeait le bas du cadre. Un toit est masqué tant que la caméra est plus haute que lui et de son côté. */
export function toitsUpdate(scene) {
  const cam = scene.cam; if (!cam) return;
  const T = (scene._toits ??= (() => { const a = []; scene.scene?.traverse((o) => { if (o.isMesh && o.name === 'toit') a.push(o); }); return a; })());
  for (const o of T) { const p = o.position, s = o.parent?.position ?? { x: 0, z: 0 }; const memeCote = Math.abs(p.z) > Math.abs(p.x) ? Math.sign(p.z + s.z) === Math.sign(cam.position.z) : Math.sign(p.x + s.x) === Math.sign(cam.position.x); o.visible = !(memeCote && cam.position.y > p.y - 0.5); }
}

/** Chaque image, pour les plans autres que tv : place la caméra ; rend false pour laisser la régie d'hier (tv). */
export function camerasUpdate(scene, dt) {
  const P = scene._plan; if (!P || P === 'tv' || scene.free || !scene.cam) return false;
  const st = scene.state, b = st.ball.p, cam = scene.cam, hx = st.pitch.hx, hz = st.pitch.hz ?? 34;
  scene._planT = (scene._planT ?? 0) + dt;
  const k = (r) => Math.min(1, dt * r), neuf = scene._planT < 0.05;   // le premier instant d'un plan : la coupe franche (un vrai réalisateur coupe, il ne glisse pas)
  if (!scene._look) scene._look = new THREE.Vector3(b[0], 1, b[2]);
  const L = scene._look;
  let fov = 50;
  if (P === 'rapprochee') {
    // le regard : le ballon, un peu en avant dans le sens du jeu (on voit où il va), borné au terrain
    const tm = st.possession?.team, sg = tm >= 0 ? Math.sign(st.pitch.attackGoal(tm).x || 1) : 0;
    _l.set(THREE.MathUtils.clamp(b[0] + sg * 4, -hx - 2, hx + 2), 0.8, THREE.MathUtils.clamp(b[2], -hz, hz));
    L.lerp(_l, neuf ? 1 : k(2.2));
    // la grue : 22 m côté tribune principale (−z), 13 m de haut ; jamais dans la tribune (z ≥ −hz − 8)
    _p.set(L.x - sg * 3, 13, Math.max(-hz - 8, L.z - 22));
    fov = 40;
  } else if (P === 'tactique') {
    _l.set(THREE.MathUtils.clamp(b[0], -hx * 0.45, hx * 0.45), 0, 0);
    L.lerp(_l, neuf ? 1 : k(1.2));
    _p.set(L.x, 62, -34);
    fov = 52;
  } else {   // joueur
    const id = st.possession?.carrier, c = id >= 0 ? st.players[id] : null, tm = c ? c.team : st.possession?.team;
    const sg = tm >= 0 ? Math.sign(st.pitch.attackGoal(tm).x || 1) : 1, o = c ? c.p : b;
    _l.set(o[0] + sg * 10, 1.2, o[2] * 0.85);
    L.lerp(_l, neuf ? 1 : k(2.5));
    _p.set(o[0] - sg * 10, 5, o[2] - 4);
    fov = 55;
  }
  if (neuf) cam.position.copy(_p); else cam.position.lerp(_p, k(P === 'joueur' ? 2.5 : 1.8));
  if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = neuf ? fov : cam.fov + (fov - cam.fov) * k(2); cam.updateProjectionMatrix(); }
  cam.lookAt(L);
  return true;
}
