// choix.js — LE CHOIX DU PORTEUR EN VALEUR ATTENDUE (335, cfg.choix && st.full — retour au football du 26/09 : « corrige les choix des
// joueurs, sans oublier la tactique et leurs attributs » ; audit : l'arbitre de menace.js compare quatre notes sur des échelles
// HÉTÉROGÈNES — le tir en xG, la passe, la conduite et le centre en heuristiques 0,14-0,9 — puis prend l'argmax ; « decisions » ne pèse
// presque rien ; le tir se prend à 12 m p50 (réel 16-17), 84 % après une conduite). Ici UNE échelle : la probabilité que l'action
// finisse en but (le xT de Karun Singh — xt.js — est exactement cela pour une position ; le xG pour un tir) :
//   TIR       xG_dec (xg.js : ce que le tireur voit ET ce qu'il est — finishing) × tir ;
//   PASSE     p_succ × V(arrivée) − λ (1 − p_succ) V_adv(arrivée)   (p_succ de la sélection 267 : passing, vision, pression, couloir) ;
//   CONDUITE  p_garde × V(le point atteint dans l'espace libre) − λ (1 − p_garde) V_adv(ici)   (p_garde : espace, pression, dribbling) ;
//   CENTRE    p_centre × xG de la tête en surface, montant avec les cibles (crossing, heading de la surface servie) − λ (1 − p_centre) V_adv ;
// λ = le PRIX DE LA PERTE, axe tactique mentalite (prudent 1,3 ↔ audacieux 0,7). Puis la TACTIQUE et le RÔLE entrent en PRÉFÉRENCE (un
// biais de logit : style possession ↔ direct, arbitre du rôle) et les ATTRIBUTS en LUCIDITÉ : le choix est un softmax de température
// T = T0 × e^(k (1 − decF)/0,15) × (1 + P (2 − composureF)) — le joueur lucide prend presque toujours la meilleure option, le fébrile se
// trompe plus, et plus encore sous pression. Le bruit est un Gumbel FIXÉ par (porteur, option, époque de 1,2 s) — un hash, aucun tirage
// consommé : le joueur ne change pas d'avis à chaque image, et le monde reste reproductible au bit. Absent : l'argmax d'hier.
import { xtDe } from './xt.js';
import { xgDe } from './xg.js';
import { axe } from './tactics.js';
import { pressionDe } from './reception.js';

const hyp = Math.hypot;
/** Un uniforme ]0 ; 1[ déterministe de (a, b, c, d) — le bruit du choix sans consommer de flux. */
function u01(a, b, c, d) { let h = (a * 374761393 + b * 668265263 + c * 2246822519 + d * 3266489917) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; h = (h ^ (h >>> 16)) >>> 0; return (h + 0.5) / 4294967296; }

/** Les valeurs attendues des quatre options (probabilité de but, même échelle). o = les notes de l'arbitre (menace.js). Pure. */
export function valeursDe(st, c, cfg, o) {
  const K = cfg.choix, pitch = st.pitch, goal = pitch.attackGoal(c.team), gAdv = pitch.attackGoal(1 - c.team), T = st.tactics?.[c.team], S = c.skill ?? {};
  const V = (p) => xtDe(pitch, goal, p), Va = (p) => xtDe(pitch, gAdv, p);
  const lam = (K.perte ?? 1) * axe(T?.mentalite ?? 0.5, 1.3, 0.7);
  const P = pressionDe(st, c, { pressT: cfg.xg?.pressT ?? 1.5 }, cfg).P;
  const ev = {};
  // LE TIR : ses portes restent celles de menaceTir (hors portée, angle fermé, pré-filtre) — le score nul ferme l'option
  if (o.tir?.score > 0 && cfg.xg) ev.tir = xgDe(st, c, cfg, false).dec * (K.tir ?? 1);
  // LA PASSE : l'élue de choosePass (le cerveau de passe garde ses candidats, sa vision, ses couloirs)
  if (o.passe?.lead) { const p = o.passe.pSucc ?? (0.6 + 0.35 * Math.min(1, (o.passe.marge ?? 1) / 3)); ev.passe = p * V(o.passe.lead) - lam * (1 - p) * Va(o.passe.lead); }
  // LA CONDUITE : le point atteint dans l'espace libre du cône vers le but ; la garde du ballon lit l'espace, la pression, le dribble
  { const esp = o.conduite?.espace ?? 0, gx = goal.x - c.p[0], gz = -c.p[2], gl = hyp(gx, gz) || 1, L = Math.min(esp, K.conduiteMax ?? 6) * 0.8;
    const pt = [c.p[0] + gx / gl * L, 0, c.p[2] + gz / gl * L];
    const dribF = c.ratings?.dribbling != null ? 0.85 + 0.3 * c.ratings.dribbling / 100 : 1;   // la note brute (50 → 1, l'identité)
    const pK = Math.max(0.3, Math.min(0.97, ((K.garde0 ?? 0.62) + 0.035 * esp) * (1 - (K.garderP ?? 0.35) * P) * dribF));
    ev.conduite = pK * V(pt) - lam * (1 - pK) * Va(c.p) - (o.conduite?.pourquoi === 'conduite-muette' ? (K.muette ?? 0.004) : 0); }
  // LE CENTRE : la surface servie (menaceCentre) — p_centre monte avec le centreur (crossF : × sur le σ, < 1 = meilleur)
  if (o.centre?.cibles) { const pc = Math.min(0.6, (K.centreP ?? 0.22) * (1 + 0.25 * (Math.min(2, o.centre.cibles) - 1)) / (S.crossF ?? 1));
    ev.centre = pc * (K.centreXg ?? 0.11) - lam * (1 - pc) * Va([goal.x - Math.sign(goal.x) * 14, 0, 0]) * 0.5; }
  return { ev, P, lam };
}

/** LE CHOIX : softmax (Gumbel fixé) sur EV / T + ln(préférences tactique × rôle × cfg.menace). Rend { meilleure, ev, T, prefs }. */
export function choixEV(st, c, cfg, o, prefs) {
  const K = cfg.choix, S = c.skill ?? {};
  const { ev, P } = valeursDe(st, c, cfg, o);
  const decF = S.decF ?? 1, compF = S.composureF ?? 1.075;
  const T = (K.T0 ?? 0.008) * Math.exp((K.lucidite ?? 0.7) * (1 - decF) / 0.15) * (1 + P * Math.max(0, 2 - compF) * (K.pressionT ?? 0.8));
  const epoque = Math.floor((st.t ?? 0) / (K.epoque ?? 1.2)), seed = (st.seed ?? 1) >>> 0;
  let meilleure = 'conduite', best = -Infinity; const L = {};
  for (const [i, k] of ['tir', 'centre', 'passe', 'conduite'].entries()) {
    if (ev[k] == null) continue;
    const g = -Math.log(-Math.log(u01(seed, c.id + 1, epoque, i + 1)));
    L[k] = ev[k] / T + Math.log(Math.max(1e-3, prefs[k])) * (K.pref ?? 1) + g;
    if (L[k] > best) { best = L[k]; meilleure = k; }
  }
  return { meilleure, ev, T, logits: L };
}
