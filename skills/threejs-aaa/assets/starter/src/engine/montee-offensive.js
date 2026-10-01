// montee-offensive.js — L'ÉQUIPE SUIT L'ACTION (lot 369, cfg.monteeOffensive — T2/T3 du chantier tactique ; 01/10 : « une équipe avec un
// jeu direct doit avoir une équipe qui suit beaucoup plus les actions rapidement non ? »). Mesuré (30 min) : l'avant-centre en soutien
// vivait à 14,6 m de son poste offensif (médiane) et y remontait à 2,9 m/s — l'allure du soutien posé (ε 0,55-0,75, la marche de
// l'économie de course) ; la ligne adverse bougeait plus vite que lui, il n'arrivait jamais : les défenseurs sans personne dans leur
// zone, la surface vide. La loi : EN POSSESSION, le soutien à plus de `loin` m de son poste offensif COURT le rejoindre — la vitesse et
// l'effort sont des CONSIGNES : la transition (conserver ↔ contre) et le style (possession ↔ direct) — le contre direct sprinte, la
// possession remonte au trot ; le rôle (profondeur) et la note workRate modulent. Absente : l'allure d'hier, au bit.
const ax = (v, lo, hi) => lo + Math.max(0, Math.min(1, v ?? 0.5)) * (hi - lo);
const hyp = Math.hypot;
/** La vitesse plancher (m/s) et l'effort ε du soutien en montée, ou null. tq : la tactique de son équipe ; R : son rôle. */
export function monteeDe(st, p, K, tq, R) {
  if (!p.target || p.keeper || p.job !== 'support' || st.restart || st.possession?.team !== p.team) return null;
  const d = hyp(p.target[0] - p.p[0], p.target[2] - p.p[2]); if (d < (K.loin ?? 8)) return null;
  const sg = -st.pitch.ownGoal(p.team).sign; if ((p.target[0] - p.p[0]) * sg < (K.devant ?? 3)) return null;   // la MONTÉE : la cible est devant
  const t = 0.5 * ax(tq?.transition, 0, 1) + 0.5 * ax(tq?.style, 0, 1);   // 0 : la possession qui conserve · 1 : le contre direct
  const v = ax(t, K.vPose ?? 4.2, K.vDirect ?? 6.6) * ax(R?.profondeur, 0.92, 1.08) * (p.skill?.workF ?? 1);
  return { v, eps: ax(t, K.epsPose ?? 0.7, K.epsDirect ?? 1) };
}
