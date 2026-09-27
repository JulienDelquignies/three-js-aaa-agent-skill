// rondo-appui-geste.js — LE PIED D'APPUI RESTE PLANTÉ PENDANT UN GESTE QUI AVANCE (340 ter, 27/09 : « vérifie si le pied d'appui glisse »).
// MESURÉ en page : pendant un passement double en course (cfg.passementLance, le corps glisse à 0,45 × v0 et porte le ballon), le pied d'appui
// du clip — écrit dans le repère du corps — PATINAIT : 130 cm de glisse pour 1,40 m de corps (61 images au sol, jusqu'à 7,7 cm d'une image).
// Ici, après la couche de geste : le pied d'appui est ANCRÉ au sol où il s'est posé (IK deux os, le genou du clip pour pôle) ; quand le pied
// du clip (qui suit le corps) s'en écarte de plus de pas m, ou que la hanche sort de la portée de la jambe, le joueur PIÉTINE — un petit pas rasant (haut m, dur s) vers le pied du clip
// mené de avance s. Les gestes qui n'avancent pas (payload.porte absent) ne sont pas touchés. ?appui-geste-libre : hier.
import { twoBoneIK } from '../engine/strike-warp.js';
import { aimChildAt } from '../engine/foot-lock.js';

const K = { pas: 0.24, dur: 0.12, haut: 0.06, avance: 0.12, yMax: 0.11 };

/** Chaque image, après la couche de geste et les warps, avant le garde-fou des os. */
export function appuiGeste(scene, pl, dt) {
  if (scene._appuiGesteLibre) return;
  const s = pl.sim, A = s.act?.payload;
  if (!(pl.gestureLayer?.active && A?.kind === 'skill' && A.porte)) { pl._ag = null; return; }
  const side = /gauche/.test(pl.gestureLayer.spec?.name ?? '') ? 'right' : 'left';   // le miroir (« -gauche ») joue du pied gauche : l'appui est le droit
  const leg = pl.legs?.[side], lens = pl.legLens?.[side];
  if (!leg?.foot || !leg.up || !leg.knee || !lens) return;
  const wf = scene._wf; leg.foot.getWorldPosition(wf); leg.up.getWorldPosition(scene._wh);
  // l'ancre porte SA hauteur (la cheville au sol, ≤ yMax) : le pied du clip monte avec le geste (mesuré : le « planté » flottait à 12-22 cm)
  const G = (pl._ag && pl._ag.side === side) ? pl._ag : (pl._ag = { side, a: [wf.x, wf.z], y: Math.min(wf.y, K.yMax), pas: null, n: 0 });
  // le pas vise SOUS LA HANCHE, un peu devant (avance s × la vitesse) : des pas courts et fréquents — hier vers le pied du clip mené, 40-80 cm, hors de portée
  const hx = scene._wh.x, hz = scene._wh.z;
  if (!G.pas && Math.hypot(hx - G.a[0], hz - G.a[1]) > K.pas) G.pas = { de: [...G.a], vers: [hx + s.v[0] * K.avance, hz + s.v[1] * K.avance], u: 0 };
  let x = G.a[0], z = G.a[1], lift = 0;
  if (G.pas) {
    G.pas.u = Math.min(1, G.pas.u + Math.max(0, dt) / K.dur);
    const u = G.pas.u, e = u * u * (3 - 2 * u);
    x = G.pas.de[0] + (G.pas.vers[0] - G.pas.de[0]) * e; z = G.pas.de[1] + (G.pas.vers[1] - G.pas.de[1]) * e; lift = K.haut * Math.sin(Math.PI * u);
    if (u >= 1) { G.a = [...G.pas.vers]; G.pas = null; G.n++; }
  }
  scene._wt.set(x, G.y + lift, z);
  leg.knee.getWorldPosition(scene._wk);
  const dT = scene._wh.distanceTo(scene._wt), R = (lens.A + lens.B) * 0.995;
  if (dT > R) scene._wt.set(scene._wh.x + (scene._wt.x - scene._wh.x) * (R / dT), scene._wh.y + (scene._wt.y - scene._wh.y) * (R / dT), scene._wh.z + (scene._wt.z - scene._wh.z) * (R / dT));
  const sol = twoBoneIK([scene._wh.x, scene._wh.y, scene._wh.z], [scene._wt.x, scene._wt.y, scene._wt.z], lens.A, lens.B,
    [scene._wk.x - scene._wh.x, scene._wk.y - scene._wh.y, scene._wk.z - scene._wh.z]);
  aimChildAt(leg.up, leg.knee, scene._wm.fromArray(sol.mid));
  aimChildAt(leg.knee, leg.foot, scene._wm.fromArray(sol.end));
}
