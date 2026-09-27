// rondo-appui-geste.js — LE PIED D'APPUI RESTE PLANTÉ PENDANT UN GESTE QUI AVANCE (340 ter, 27/09 : « vérifie si le pied d'appui glisse »).
// MESURÉ en page : pendant un passement double en course (cfg.passementLance, le corps glisse à 0,45 × v0 et porte le ballon), le pied d'appui
// du clip — écrit dans le repère du corps — PATINAIT : 130 cm de glisse pour 1,40 m de corps (61 images au sol, jusqu'à 7,7 cm d'une image).
// Ici, après la couche de geste : le pied d'appui est ANCRÉ au sol où il s'est posé (IK deux os, le genou vers l'avant du corps) ; quand le pied
// du clip (qui suit le corps) s'en écarte de plus de pas m, ou que la hanche sort de la portée de la jambe, le joueur PIÉTINE — un petit pas rasant (haut m, dur s) vers le pied du clip
// mené de avance s. Les gestes qui n'avancent pas (payload.porte absent) ne sont pas touchés. ?appui-geste-libre : hier.
import { twoBoneIK } from '../engine/strike-warp.js';
import { aimChildAt } from '../engine/foot-lock.js';

const K = { pas: 0.24, dur: 0.12, haut: 0.06, avance: 0.12, yMax: 0.11, leve: 0.15, tau: 0.06, sortie: 0.12 };
// (340 sexies, 27/09 : « fais pareil pour les autres gestes dans l'atelier ») — MESURÉ à l'atelier (?atelier=dribble&geste=…) : le râteau,
// le crochet, la roulette… patinaient aussi (râteau : l'appui glissait de 28-74 cm pour 0,5-1,5 m de corps). Tous les gestes techniques
// (payload.kind 'skill') et les gestes de virage (rondo-virage) ont l'ancre ; mais leur clip, lui, DÉPLACE parfois l'appui (la roulette
// enjambe, le râteau se replace) : quand le pied du clip MONTE (> leve m), l'ancre le SUIT (τ tau s) et se repose où il se pose — le pas du
// clip est gardé, seul le patin disparaît. Le passement (payload.porte) garde sa loi d'hier. ?appui-geste-porte : les autres, hier.

/** Chaque image, après la couche de geste et les warps, avant le garde-fou des os. */
export function appuiGeste(scene, pl, dt) {
  if (scene._appuiGesteLibre) return;
  const s = pl.sim, A = s.act?.payload;
  const virage = scene._t < (pl._lisseJusqua ?? -9) && scene._t - (pl._virT ?? -9) < 1.2;
  // …et la TRAÎNE du clip : l'acte de la sim fini, la couche joue encore sa fin (~0,5 s) pendant que le corps repart — mesuré au râteau : ancré
  // pendant l'acte (0 cm), puis 30-60 cm de patin dans la traîne
  const traine = !!pl._ag && pl._ag.nm === pl.gestureLayer?.spec?.name && !scene._appuiGestePorte;   // le MÊME clip (un contrôle qui s'enchaîne a sa loi : le verrou)
  if (!(pl.gestureLayer?.active && ((A?.kind === 'skill' && (A.porte || !scene._appuiGestePorte)) || (virage && !scene._appuiGestePorte) || traine))) {
    // LA SORTIE FONDUE : lâché d'un coup, le pied sautait de l'ancre à la pose du clip / du verrou (mesuré à la semelle : 3-8 cm en une image)
    if (pl._ag && !scene._appuiGestePorte) pl._agOut = { side: pl._ag.side, c: pl._ag.c, u: 0 };
    pl._ag = null; sortie(scene, pl, dt); return;
  }
  pl._agOut = null;
  const suit = !A?.porte;   // le pied du clip qui monte reprend la main (hors passement)
  const side = /gauche/.test(pl.gestureLayer.spec?.name ?? '') ? 'right' : 'left';   // le miroir (« -gauche ») joue du pied gauche : l'appui est le droit
  const leg = pl.legs?.[side], lens = pl.legLens?.[side];
  if (!leg?.foot || !leg.up || !leg.knee || !lens) return;
  const wf = scene._wf; leg.foot.getWorldPosition(wf); leg.up.getWorldPosition(scene._wh);
  // l'ancre porte SA hauteur (la cheville au sol, ≤ yMax) : le pied du clip monte avec le geste (mesuré : le « planté » flottait à 12-22 cm)
  const G = (pl._ag && pl._ag.side === side && pl._ag.nm === pl.gestureLayer.spec?.name) ? pl._ag : (pl._ag = { side, a: [wf.x, wf.z], y: Math.min(wf.y, K.yMax), pas: null, n: 0, libre: false, c: [wf.x, wf.y, wf.z], nm: pl.gestureLayer.spec?.name });
  if (suit && !G.pas && (G.libre || wf.y > K.leve)) {   // le clip lève l'appui : on le suit, lissé, jusqu'à ce qu'il se repose
    const k = 1 - Math.exp(-Math.max(0, dt) / K.tau); G.c = G.c ?? [G.a[0], G.y, G.a[1]];
    G.c = [G.c[0] + (wf.x - G.c[0]) * k, G.c[1] + (wf.y - G.c[1]) * k, G.c[2] + (wf.z - G.c[2]) * k];
    G.libre = wf.y > K.leve - 0.02;   // redescendu : l'ancre se pose LÀ OÙ EST le pied rendu (pas de saut) — attendre qu'il rejoigne le clip le laissait patiner avec le corps (mesuré : roulette, 55-81 % des images « suivies »)
    if (!G.libre) { G.a = [G.c[0], G.c[2]]; G.y = Math.min(wf.y, K.yMax); }
    else { scene._wt.set(G.c[0], G.c[1], G.c[2]); poser(scene, pl, leg, lens, s); return; }
  }
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
  scene._wt.set(x, G.y + lift, z); G.c = [x, G.y + lift, z];
  poser(scene, pl, leg, lens, s);
}

/** La sortie : de l'ancre lâchée vers la pose du dessous, en sortie s. */
function sortie(scene, pl, dt) {
  const O = pl._agOut; if (!O) return;
  O.u = Math.min(1, O.u + Math.max(0, dt) / K.sortie); if (O.u >= 1) { pl._agOut = null; return; }
  const leg = pl.legs?.[O.side], lens = pl.legLens?.[O.side]; if (!leg?.foot || !leg.up || !leg.knee || !lens) { pl._agOut = null; return; }
  const wf = scene._wf; leg.foot.getWorldPosition(wf); leg.up.getWorldPosition(scene._wh);
  const e = O.u * O.u * (3 - 2 * O.u);
  scene._wt.set(O.c[0] + (wf.x - O.c[0]) * e, O.c[1] + (wf.y - O.c[1]) * e, O.c[2] + (wf.z - O.c[2]) * e);
  poser(scene, pl, leg, lens, pl.sim);
}

/** La jambe d'appui posée sur scene._wt : IK deux os, bornée à la portée, le genou vers l'avant du corps. */
function poser(scene, pl, leg, lens, s) {
  const dT = scene._wh.distanceTo(scene._wt), R = (lens.A + lens.B) * 0.995;
  if (dT > R) scene._wt.set(scene._wh.x + (scene._wt.x - scene._wh.x) * (R / dT), scene._wh.y + (scene._wt.y - scene._wh.y) * (R / dT), scene._wh.z + (scene._wt.z - scene._wh.z) * (R / dT));
  // le genou pointe VERS L'AVANT DU CORPS (retour du 27/09, captures de l'atelier : « problème avec la jambe d'appui ») — mesuré : avec le genou
  // du clip pour pôle, en fin de geste le genou passait DERRIÈRE l'axe hanche-cheville (−23 cm) : la jambe pliée à l'envers
  const sol = twoBoneIK([scene._wh.x, scene._wh.y, scene._wh.z], [scene._wt.x, scene._wt.y, scene._wt.z], lens.A, lens.B,
    [Math.cos(s.yaw), 0.1, Math.sin(s.yaw)]);
  aimChildAt(leg.up, leg.knee, scene._wm.fromArray(sol.mid));
  aimChildAt(leg.knee, leg.foot, scene._wm.fromArray(sol.end));
}
