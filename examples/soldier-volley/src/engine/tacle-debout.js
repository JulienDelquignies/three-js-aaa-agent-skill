/** LE TACLE DEBOUT (lot 291, cfg.tacleDebout — Modèle 11 § 4.1-4.2). Le pique du moteur (cfg.pokeReach) jouait le ballon libre
 *  entre deux touches dès que le défenseur l'atteignait avant le porteur : sans regarder son buste, et réussi à la note seule (0,5-0,95,
 *  0,725 à l'identité). Sondé (sonde-291, 4 × 90 min) : ~42 tentatives par équipe et par match, RÉUSSIES 77,5 %, 15-17 % hors du cône
 *  du pied ; le book (tacle debout, n = 51 242) : le ballon touché une fois sur deux (récupération 21 %, déviation neutre 29 %), le
 *  défenseur BATTU 49 % — et l'issue d'une pique réussie est déjà juste (récupérée 35-40 % à 2 s).
 *
 *  La loi : (1) LE CÔNE — le pied balaie ± cone° devant le buste (le book : ± 55°) : hors du cône, pas de tentative ; (2) LA
 *  RÉUSSITE — la note d'hier × k (0,56, CALÉ SUR LE MONDE : ses défenseurs sont notés au-dessus de 50 ;
 *  × 0,70 laissait 62-66 % de tentatives réussies, × 0,56 en rend 46-58 % — le book ~50 ; 0,41 à l'identité), le dribbleur la réduit (× (1 − esq·esquiveF / 0,08), 0 exact à
 *  50 : tackling CONTRE dribbling, le 152) ; (3) LE BATTU — le pied manqué laisse le défenseur sur ses appuis (le book :
 *  staggerTimer 0,15-0,30 s) : la morsure native (_bite, pointe × biteSlow) pendant battu s.
 *  Attributs : tackling (la portée, la note), dribbling (l'esquive). Tactique, rôles : rien. Clé absente : le pique d'hier au bit. */
import { dansCone } from './dribble.js';

export function piqueTenteDe(q, ball, K) {
  return dansCone(q.yaw, q.p[0], q.p[2], ball.p[0], ball.p[2], K.cone ?? 55);
}

export function piqueReussiteDe(pokeSkill, c, K) {
  const esq = (c.skill?.esquiveF ?? 0) / 0.08;
  return Math.max(0, Math.min(1, pokeSkill * (K.k ?? 0.56) * (1 - (K.esq ?? 0.15) * esq)));
}
