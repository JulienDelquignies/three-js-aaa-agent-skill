// rondo-lisse.js — LE GARDE-FOU DES SAUTS D'OS, en toute fin de pile (26/09, « pour l'instant c'est pas fluide »). MESURÉ en match (sonde
// des enchaînements : la rotation maximale d'un os d'une image à l'autre dans les 3 images qui suivent un changement de geste) : même
// avec le fondu d'enchaînement de la couche de geste (gesture-layer), des GENOUX tournaient encore de 98-141° en une image — le verrou
// des pieds et les warps résolvent la jambe par IK deux os avec le genou du clip comme pôle : quand le clip change, la solution bascule.
// Ici : chaque os suivi ne tourne pas plus vite que VMAX °/s par rapport à sa pose affichée à l'image d'avant (1 800 °/s — au-dessus du
// genou de frappe réel, ~1 600 °/s au contact : aucun vrai geste n'est bridé, un saut aberrant devient une transition de 3-4 images).
// Local à l'os (la rotation relative au parent), après tous les écrivains. ?os-libres : hier.
import * as THREE from 'three/webgpu';

const VMAX = 1800 * Math.PI / 180, VVOL = 1000 * Math.PI / 180, RX = /(Hips|Spine|Spine1|Spine2|Neck|UpLeg|Leg|Foot|Arm|ForeArm)$/;
const _q = new THREE.Quaternion();

/** Après tous les écrivains du corps d'un joueur. */
export function lisseOs(scene, pl, dt) {
  if (scene._osLibres) return;
  const L = (pl._lisse ??= (() => { const b = []; pl.model.traverse((o) => { if (o.isBone && RX.test(o.name)) b.push(o); }); return { b, q: b.map((o) => o.quaternion.clone()), t: scene._t }; })());
  // …SEULEMENT dans les 0,3 s qui suivent un CHANGEMENT DE GESTE (pl._switchT, posé par _playTech) : partout ailleurs le garde-fou
  // brident aussi les sauts de la foulée (le pied au décollage / à la pose — autre chantier, le verrou des pieds) et, placé après le
  // verrou, il faisait glisser les appuis (mesuré : glisses 1,3 → 2,2 %, 89 os freinés / joueur-minute)
  // (339) …et à la FIN d'un geste (le retour à la foulée : mesuré 50-55° d'une image à la sortie du râteau) et pendant tout un geste de
  // VIRAGE (pl._lisseJusqua, rondo-virage : le balayage du Cruyff et le warp au ballon réel, 36-56° mesurés au contact) ; ?os-libres : hier
  const actG = !!pl.gestureLayer?.active; if (L.act && !actG && !scene._finLibre) pl._switchT = scene._t; L.act = actG;
  const reprise = !(dt > 0 && dt < 0.1) || scene._t - L.t > 0.1, saut = reprise || !(scene._t - (pl._switchT ?? -9) < 0.3 || scene._t < (pl._lisseJusqua ?? -9));   // hors fenêtre, une reprise : on suit sans brider
  L.t = scene._t;
  const max = VMAX * Math.max(dt, 1 / 240), maxVol = VVOL * Math.max(dt, 1 / 240);
  // (338 ter) LA JAMBE EN VOL (retour du 26/09 « la jambe est bizarre là ») : au décollage le genou sautait de 50-55° en UNE image (71 → 126°,
  // mesuré en match — la jambe quitte le verrou des pieds pour la trajectoire du générateur). Hors geste, la cuisse et le genou d'une jambe
  // EN VOL ne tournent pas plus vite que VVOL (1 000 °/s — l'ordre des pics du genou en course) ; jamais la jambe au sol (les glisses du 336).
  const vol = !reprise && !scene._volLibre && !pl.gestureLayer?.active && !pl.sim?.act ? (f) => !/^(stance|peel)$/.test(pl.ctrl?._gaitFeet?.[f]?.phase ?? 'stance') : null;
  L.cote ??= L.b.map((o) => { const m = /(Left|Right)(UpLeg|Leg)$/.exec(o.name); return m ? m[1] : null; });
  let n = 0;
  for (let i = 0; i < L.b.length; i++) {
    const q = L.b[i].quaternion, p = L.q[i];
    const lim = !saut ? max : vol && L.cote[i] && vol(L.cote[i]) ? maxVol : 0;
    if (lim) { const a = 2 * Math.acos(Math.min(1, Math.abs(p.dot(q)))); if (a > lim) { _q.copy(p).slerp(q, lim / a); q.copy(_q); n++; } }
    p.copy(q);
  }
  if (n) pl.model.updateMatrixWorld(true);
  pl._lisseN = (pl._lisseN ?? 0) + n;
}
