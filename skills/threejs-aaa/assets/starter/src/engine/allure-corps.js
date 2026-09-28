// allure-corps.js — LE CORPS SUIT LA COURSE QUAND ELLE VA VITE (cfg.allureCorps && st.full — retour utilisateur du 28/09 :
// « il y a un joueur sous le terrain sur ta capture ? »). Mesuré (sonde bassin, 40 s) : 12 joueurs de champ sur 20 passaient le
// bassin sous 0,7 m EN COURSE — le rendu d'une course de CÔTÉ : à 5 m/s et 90° entre le corps et la course, le pas chassé descend
// le bassin de 76 cm (gait-angle : −17 cm à 3 m/s, −41 à 4,6, −76 à 5,5 ; de face −7). La loi 349 (regard-jeu) permettait 100°
// jusqu'à 5 m/s, le jockey 180° jusqu'à 5 m/s au contact. Le réel : personne ne court de côté à 5 m/s — au-delà de ~3 m/s le corps
// se ferme sur la course, seules les épaules et la tête regardent le jeu.
// Ici, joueur de champ au-delà de 2,8 m/s : l'écart cap voulu ↔ course est capé, décroissant avec la vitesse (table pts : 90° à
// 2,8 m/s, 60° à 3,5, 48° à 4,5, 40° à 6 et au-delà — chaque point garde la descente du bassin ≤ ~13 cm, celle d'une marche de côté) ;
// la course ARRIÈRE (écart ≥ recul °) reste permise jusqu'à vRecul m/s.
// Le cap capé passe par le slew borné de movement (aucune rotation instantanée). Clé absente : l'hier au bit.
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const D = Math.PI / 180;

/** Écart corps–course permis (rad) à la vitesse v, ou null (libre) — interpolé sur la table pts [[v m/s, °], …]. Pure. */
export function ecartPermis(v, K) {
  const T = K.pts ?? [[2.8, 90], [3.5, 60], [4.5, 48], [6, 40]];
  if (v <= T[0][0]) return null;
  for (let i = 1; i < T.length; i++) if (v <= T[i][0]) return (T[i - 1][1] + (T[i][1] - T[i - 1][1]) * (v - T[i - 1][0]) / (T[i][0] - T[i - 1][0])) * D;
  return T[T.length - 1][1] * D;
}

/** Le cap voulu, capé contre la course du joueur. Renvoie `want` inchangé si rien à caper. Pure. */
export function capAllure(st, p, cfg, want) {
  const K = cfg.allureCorps;
  if (!K || !st.full || p.keeper || want == null || !(p.speed > 0.25)) return want;
  const lim = ecartPermis(p.speed, K);
  if (lim == null) return want;
  const h = Math.atan2(p.v[1], p.v[0]);
  const d = wrap(want - h);
  if (Math.abs(d) <= lim) return want;
  if (Math.abs(d) >= (K.recul ?? 135) * D && p.speed <= (K.vRecul ?? 3.2)) return want;   // il recule face au jeu
  return h + Math.sign(d) * lim;
}
