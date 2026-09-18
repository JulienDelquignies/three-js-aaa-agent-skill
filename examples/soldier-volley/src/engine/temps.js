// LE TEMPS DU MATCH (270, cfg.temps && st.full — Bible 14 lot 3 : T24 ballon en jeu 54-58 %, T25 les durées de reprise
// 17,7 / 30,3 / 36,9 s ; Bible 16 lot 4 : T10 le jeu effectif 66 → 56 %, T23 le temps additionnel ≥ +60 s si l'écart ≤ 1 ;
// Modèle 12 test 11 ; la Loi 12.2 des huit secondes, IFAB 2025-26). Hier les cérémonies vivaient à 12 / 20 / 22 / 18 s
// (217, tempsMort : touche 11,8 mesurée, six mètres 18,1, corner 19,2 — réel 17,7 / 30,3 / 36,9), le temps additionnel était
// une fraction plate des arrêts (0,35, plafonnée à 12 % — 161 s / 157 s quel que soit l'écart), et le gardien n'avait pas
// de limite de huit secondes (la règle des six secondes à l'échelle, jamais sifflée). LA LOI : (1) LES CÉRÉMONIES DANS LA
// BANDE — chaque espèce de remise a sa bande [rapide ; lent] d'Opta PL 2025-26 (touche 12,7-21,7, six mètres 26,2-36,7,
// corner 30-50, coup franc 25,8-41,6) et l'axe d'équipe gestionTemps (0,5 = le milieu de la bande, l'identité) y interpole
// « à l'intérieur de la bande, pas au-delà » ; le tempo tactique, le contexte (mener tard traîne, courir après presse) et
// l'aléa du 217 restent ; (2) LE TEMPS ADDITIONNEL QUI LIT LE MATCH — part × les arrêts de la période + serre s à la
// dernière période si |écart| ≤ 1 (Maia et al. : « plus d'une minute de plus » — 60 s est un plancher), borné [min ;
// maxPart × la période] ; l'effet Garicano (refereeBias, domicile) reste nul par défaut ; (3) LES HUIT SECONDES — le
// gardien relâche à relache s au plus (le décompte visible le presse), et passé limite s l'arbitre siffle : corner pour
// l'adversaire du côté où il tenait le ballon (événement huit-secondes). Clé absente : l'horloge d'hier au bit. Ce que
// le lot nomme : le ballon qui sort (les arrêts 49-56 / match, réel 85-105 — le 271), les simulations (T27), la
// dispersion inter-équipes de l'axe (une consigne d'entraîneur, Modèle 15), refereeBias et le public (Bible 16).
import { BALL } from './ball.js';
import { tac, axe } from './tactics.js';

export const BANDES_OPTA = { touche: [12.7, 21.7], 'sortie-de-but': [26.2, 36.7], corner: [30, 50], 'coup-franc': [25.8, 41.6] };

/** La durée de base d'une cérémonie : la bande de l'espèce interpolée par l'axe gestionTemps (0,5 = le milieu). Pure. Rend null si l'espèce n'a pas de bande. */
export function bandeDe(type, K, gestion = 0.5) {
  const b = (K.bandes ?? BANDES_OPTA)[type]; if (!b) return null;
  return b[0] + (b[1] - b[0]) * Math.max(0, Math.min(1, gestion));
}

/** Le temps additionnel d'une période : part × arrêts + serre (dernière période, |écart| ≤ 1), borné. Pure. */
export function addDe(arrets, duree, K, ecart, derniere) {
  const brut = (K.part ?? 0.2) * arrets + (derniere && Math.abs(ecart) <= (K.ecartSerre ?? 1) ? (K.serre ?? 60) : 0);
  return Math.max(K.min ?? 60, Math.min((K.maxPart ?? 0.15) * duree, brut));
}

/** Les huit secondes : le gardien tient depuis `tenu` s ; passé la limite, corner pour l'adversaire (le côté du ballon). Rend true si sifflé. */
export function huitSecondes(st, gk, cfg, tenu, tempoWait) {
  const K = cfg.temps.gk; if (!K || tenu <= (K.limite ?? 8) || st.restart) return false;
  const { pitch } = st, own = pitch.ownGoal(gk.team), sx = Math.sign(own.x || 1), sz = Math.sign(st.ball.p[2] || 1), team = 1 - gk.team;
  const x = sx * (pitch.hx - 0.3), z = sz * (pitch.hz - 0.3);
  st.events.push({ t: +st.t.toFixed(2), type: 'huit-secondes', by: gk.id, tenu: +tenu.toFixed(1) });
  st.events.push({ t: +st.t.toFixed(2), type: 'sortie', out: 'corner', team, p: [+x.toFixed(1), +z.toFixed(1)] });
  if (st.ball.owner != null) st.ball.release('sortie');
  st.restart = { type: 'corner', p: [x, z], team, at: st.t + Math.max(cfg.corner?.pose ?? 10, tempoWait(st, cfg, team, 'corner')) };
  st.ball.restart([x, BALL.radius, z], { cause: 'corner' });
  st.lastTouch = gk.team; st.phase = 'loose'; st.possession.carrier = -1; st.pass = null; st.hold = 0; st.pressure = 0;
  return true;
}

/** L'axe gestionTemps de l'équipe (0,5 = l'identité). Pure. */
export function gestionDe(st, team) { return team >= 0 ? (tac(st, team).gestionTemps ?? 0.5) : 0.5; }

/** LA TOUCHE RAPIDE (284, cfg.toucheRapide — retour du 17/09 « les touches sont trop longues, le foot en joue vite ») : la bande Opta
 *  du 270 est une MOYENNE, pas une durée — le réel a une queue basse (la touche jouée en 3-8 s quand le ballon est là, un coéquipier
 *  libre et rien à gérer) et une queue haute. Rend { wait, rapide, p } : avec la probabilité p (K.p × decF du preneur × l'axe tempo,
 *  nulle si la situation ne s'y prête pas — x.ok) l'attente est tirée dans [min ; max] ; sinon la bande, RELEVÉE du facteur qui garde
 *  la moyenne ((bande − p × milieu) / ((1 − p) × bande)) : la loi déplace la forme, pas le total du temps mort. Pure. */
export function attenteToucheDe(bande, K, x = {}) {
  const p = x.ok ? Math.max(0, Math.min(0.9, (K.p ?? 0.45) * (x.decF ?? 1) * (x.tempoF ?? 1))) : 0;
  const lo = K.min ?? 5, hi = K.max ?? 9, rapide = lo + (hi - lo) * (x.u2 ?? 0.5);
  if (p > 0 && (x.u ?? 1) < p) return { wait: rapide, rapide: true, p };
  const c = p > 0 && p < 1 && bande > 0 ? (bande - p * (lo + hi) / 2) / ((1 - p) * bande) : 1;
  return { wait: bande * Math.max(1, c), rapide: false, p };
}
