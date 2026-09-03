// LA PASSE AVANT LE CONTACT (227, cfg.avantContact && st.full — déporté de rondo-sim). La racine du tourbillon
// des pertes : 61 % des pertes étaient des frappes avec le presseur à 1,4 m, 25 % des touches de conduite volées
// à 2,4 m ; le jeté (144) ne lisait que le presseur LANCÉ à ≥ 4 m/s. Le porteur lit l'ETA du presseur le plus
// proche (distance moins le contact, sur sa vitesse de fermeture) : sous seuil × (2 − anticipF) × composureF —
// l'anticipation voit venir, le sang-froid attend un peu plus — la tenue est dispensée et la barre abaissée :
// la meilleure passe part AVANT la pression. Mesuré : pertes 360 → 291/90 min, passes 77 → 84 %. Absente :
// la tenue jusqu'au contact d'hier, au bit.
import { hyp } from './hyp.js';

export function presseurArrive(st, c, AC) {
  for (const q of st.players) {
    if (q.team === c.team || q.keeper || q.down > 0) continue;
    const dx = c.p[0] - q.p[0], dz = c.p[2] - q.p[2], d = hyp(dx, dz);
    if (d > (AC.rayon ?? 6)) continue;
    const ferme = Math.max(0.3, (q.v[0] * dx + q.v[1] * dz) / (d || 1));   // la vitesse de fermeture (m/s vers moi)
    const tc = Math.max(0, d - (AC.contact ?? 1.0)) / ferme;
    if (tc <= (AC.seuil ?? 0.9) * (2 - (c.skill?.anticipF ?? 1)) * (c.skill?.composureF ?? 1)) return true;
  }
  return false;
}
