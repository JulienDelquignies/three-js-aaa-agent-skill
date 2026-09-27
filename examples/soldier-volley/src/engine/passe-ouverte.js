// passe-ouverte.js — LA PASSE LATÉRALE EN COURSE SE JOUE LE CORPS OUVERT (cfg.passeOuverte && st.full — retour utilisateur 27/09 :
// « contrôle, conduite, passe latérale : l'enchaînement est catastrophique »). Mesuré à l'atelier (match11.html?atelier=enchaine) : pour
// une passe à 85° de sa course, l'ancre de frappe (approach.anchorFor) voulait le CORPS FACE À LA SORTIE au contact — le porteur lancé
// à 4 m/s tournait de 85° et se replaçait DERRIÈRE son ballon pendant l'armé : un glissement latéral à 6-7,5 m/s, une rotation sur place,
// la stance ratée au contact et un second armé. Le vrai foot : le coureur garde sa ligne, OUVRE les hanches, et la jambe de frappe balaie
// en travers (l'intérieur du pied) — le corps ne tourne que de ce qui dépasse l'ouverture.
// Ici : porteur lancé (≥ vMin m/s), sortie à ≤ max ° de sa course : le corps au contact regarde cap + signe(écart) × max(0, |écart| − ouvre°) ;
// la stance se lit dans CE regard (le ballon devant lui, dans sa course), la sortie reste la sortie (le ballon part vers la mène). Au-delà
// de max (la passe en retrait) ou à l'arrêt : le corps face à la sortie, l'hier. Tir, dégagement, centre, main : l'hier.
import { hyp } from './hyp.js';

const D2R = Math.PI / 180;
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/** Le lacet du corps au contact d'une passe en course, ou null (le corps face à la sortie). Pure. */
export function corpsOuvert(st, c, outYaw, cfg, { shot = false, clear = false, mains = false, cross = false } = {}) {
  const K = st.full && cfg.passeOuverte; if (!K || shot || clear || mains || cross) return null;
  const v = hyp(c.v[0], c.v[1]); if (v < (K.vMin ?? 1.5)) return null;
  const cap = Math.atan2(c.v[1], c.v[0]), d = wrap(outYaw - cap);
  if (Math.abs(d) > (K.max ?? 110) * D2R) return null;
  return cap + Math.sign(d) * Math.max(0, Math.abs(d) - (K.ouvre ?? 50) * D2R);
}
