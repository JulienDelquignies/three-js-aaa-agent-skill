// serre.js — LA CONDUITE SE SERRE SOUS PRESSION (290, cfg.conduiteSerree && st.full — la suite de la demande « ultra réaliste sur les
// passes » : le 289 a mesuré ~50 pertes par équipe et par match sur des piques et des touches qui s'échappent vers un défenseur).
// Sondé (sonde-290, 4 × 90 min, ~1 100 touches de conduite par équipe) : l'écart pied-ballon MAXIMAL entre deux touches vaut ~1 m p50
// que le presseur soit loin (P < 0,3 : 1,04-1,10 m) ou qu'il arrive (P ≥ 0,75 : 0,96-0,98 m) — la touche ne se serre pas ; le ballon
// est poussé à 3,8-4,3 m/s pour un porteur à 3,1-3,3 m/s ; 3-4 % des touches sous pression finissent en pique ou en perte. La loi
// d'hier (kSpace, lot 55) ne lit que la DISTANCE du plus proche (≥ 0,5 de la touche au-delà de 2 m) ; le vrai porteur pressé garde le
// ballon sous le pied. LA LOI : la pression lue au temps d'arrivée (P du 289, pressionDe du 265) SERRE la touche — (1) la mène est
// multipliée par k = 1 − kP × (P − p0)/(1 − p0) au-delà de p0, bornée à min ; (2) le ballon n'est pas poussé plus vite que le corps de
// plus de dv m/s (au-delà de p0 seulement). Attribut : dribbling (dribbleLeadF, déjà dans la mène — le bon dribbleur serre plus) ;
// rôles et tactiques : rien (le geste est technique). Clé absente : la touche d'hier au bit.
// RÉFUTÉE À LA MESURE (sonde-290, sonde-289c, 4 × 90 min) : au réglage doux l'écart sous forte pression passe de 0,97 à 0,80-0,88 m
// mais les tacles piqués MONTENT (33 → 44 par équipe) ; au réglage franc (min 0,25, kP 1,2, dv 0,2) l'écart tombe à 0,54-0,60 m et
// les pertes par touche pressée baissent de moitié, mais les touches se multiplient (1 150 → 1 430-1 600 par équipe) et les piques
// restent à 39 : les porteurs piqués ont encore le ballon à 0,97 m — les piques tombent sur des touches prises AVANT que le presseur
// n'arrive (P faible à la touche). La clé est nulle par défaut ; le levier nommé est le pique lui-même (Modèle 11, le duel).
import { pressionDe } from './reception.js';

/** Le serrage de la touche pour une pression P : { k (facteur de mène), dv (écart de vitesse max, null = libre) }. Pure. */
export function serreDe(P, K) {
  const p0 = K.p0 ?? 0.3;
  if (!(P > p0)) return { k: 1, dv: null };
  return { k: Math.max(K.min ?? 0.45, 1 - (K.kP ?? 0.9) * (P - p0) / (1 - p0)), dv: K.dv ?? 0.6 };
}

/** Le serrage du porteur c maintenant (la pression au temps d'arrivée, sans tirage). */
export function serrePorteurDe(st, c, K, cfg) { return serreDe(pressionDe(st, c, { pressT: 1.5 * (c.skill?.anticipF ?? 1) }, cfg).P, K); }
