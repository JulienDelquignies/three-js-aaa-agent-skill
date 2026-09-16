// rondo-fusion.js — LA LOI DE FUSION D'UN GESTE EN FLUX (A2) : quand les jambes appartiennent au
// geste, et À QUELLE HEURE du clip on les dessine. Trois lois pures (bancables : verify-fusion.mjs),
// Rondo.js les appelle à chaque image ; le monde composé se juge à audit-membres.
//
// L'HORLOGE D'ÉCHANTILLONNAGE. La clé t = 0 d'un clip est la pose NEUTRE : le haut se faisait tirer
// au garde-à-vous avant de s'armer, d'où l'échantillonnage EN AVANCE (lead 0,3 × anticipation à
// t = 0). Hier la convergence vers l'heure vraie se faisait AU CONTACT : tout l'armé, swing compris,
// se jouait à ×0,7 (1 − lead) — mesuré 5-6 m/s de pied au contact en jeu contre 11 au clip, la
// dette A2. La convergence se fait désormais à `conv` × anticipation (0,6) : l'armé lent (×0,5, il
// l'est aussi dans la vie), le SWING à ×1 — le pied arrive à la vitesse du clip. Les gestes qui ne
// sont pas des frappes générées (plongeons warpés, contrôles, remises authorées) gardent la loi
// d'hier (conv 1), au bit.
//
// LE TIR TENU. La sim tire au premier tick où act.t ≥ anticipation — 0 à 17 ms APRÈS la clé de
// contact (mesuré : t 0,233 pour un contact à 0,22). À 11 m/s le pied était 14 cm au-delà du ballon
// quand le ballon partait. L'heure du tir se PRÉDIT (act.t vit sur la grille des ticks : le premier
// multiple de dt ≥ antic) : le swing se re-cadence pour que la clé de contact tombe À L'IMAGE DU TIR
// (×0,87 pour une passe rapide à 60 Hz, ×0,98 pour une passe — retenir le retard d'un coup faisait
// une image figée : 2-4 m/s mesurés à l'image du tir), puis l'accompagnement à ×1 avec ce retard
// constant (≤ 1 tick) : le pied est SUR le ballon quand il part, et rien ne saute.
import { GENERATORS } from '../engine/motion-cast.js';

export const FUSION = { lead: 0.3, conv: 0.6, ramp: 0.8, apres: 0.15, arrivee: 2.5 };

/** L'heure du clip pour l'heure t de la sim : en avance de lead·antic à t = 0, à l'heure vraie dès conv·antic. */
export function sampleTime(t, antic, F = FUSION) {
  const tc = Math.max(1e-4, (F.conv ?? 1) * antic);
  return t < tc ? t + (F.lead ?? 0.3) * antic * (1 - t / tc) : t;
}

/** Le poids des jambes par L'ARRIVÉE : 1 − v/2,5 sur la vitesse sol mesurée (le corps posé possède ses jambes). */
export function legsByArrive(v, F = FUSION) { return Math.max(0, Math.min(1, 1 - v / (F.arrivee ?? 2.5))); }

/** Le poids des jambes par LE CONTACT QUI APPROCHE : (t/(antic·ramp))^1,5 — le dernier cinquième de l'armé
 *  appartient au plant, entièrement ; et le contact ne possède les jambes que jusqu'à `apres` s après lui. */
export function legsByContact(t, antic, F = FUSION) {
  return t < antic + (F.apres ?? 0.15) ? Math.min(1, Math.pow(Math.max(0, t) / Math.max(1e-4, antic * (F.ramp ?? 0.8)), 1.5)) : 0;
}

export function isStrikeSpec(spec) { return GENERATORS[(spec?.name ?? '').replace(/-gauche$/, '')]?.family === 'strike'; }

/** L'heure d'échantillonnage complète d'une image : la loi de convergence (frappe générée : conv ; sinon la loi
 *  d'hier) ; pour une frappe générée portée par un acte sim, le swing re-cadencé sur l'heure prédite du tir
 *  (`dt` : le pas de la sim), puis, une fois l'acte tiré, le retard mesuré (pl._fireOff, ≤ 1 tick) pour tout l'accompagnement. */
export function fusionSample(tG, antic, act, pl, spec, dt = 1 / 60, F = FUSION) {
  const strike = isStrikeSpec(spec);
  if (strike && act) {
    if (act.fired) {
      if (pl._fireOff == null) pl._fireOff = Math.max(0, Math.min(1 / 30, act.t - antic));
      return tG - pl._fireOff;
    }
    pl._fireOff = null;
    const tc = F.conv * antic, tFire = Math.ceil(antic / dt - 1e-6) * dt;
    if (tG >= tc && tFire > antic + 1e-9) return tc + (tG - tc) * (antic - tc) / Math.max(1e-4, tFire - tc);
  }
  return sampleTime(tG, antic, strike ? F : { ...F, conv: 1 });
}
