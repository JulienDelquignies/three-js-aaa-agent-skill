// repli-passe.js — LE REPLI SUR LA PASSE (318, cfg.repliPasse && st.full — le chantier des échappées, notes 443-445).
// Sondé (sonde-genese, monde 316) : la moitié des échappées naît d'une passe de 15-23 m (MID_GROUND, THROUGH) vers un receveur EN JEU
// (1-4 défenseurs plus près du but que lui au départ, 5 m devant le dernier) qui court à 4,3 m/s pendant le vol — et la ligne, elle,
// marche (1,3 m/s, régime d'entretien : sa cible suit le ballon, pas sa destination) : il reçoit seul. Au réel, le départ de la passe
// est un signal : la ligne se RETOURNE et court vers son but. La loi, post-passe d'autorité (après la ligne) : pendant le vol d'une
// passe adverse dont la destination (lead) est plus près de mon but que moi (à marge m près) et à moins de portee m, les n défenseurs
// de champ libres qui arrivent le plus tôt au point goal-side de la destination (lead + recul m vers le but) y courent, en rupture
// 'repli' jusqu'à l'arrivée (+ tenue s) — après leur latence de lecture reaction × (2 − anticipF) × (2 − concF) : le lecteur
// concentré se retourne au départ du ballon, le distrait le regarde partir. n = axe transition (1-3). Absente : hier.
import { hyp } from './hyp.js';
import { etaCourse } from './ball-predict.js';

export function repliPasseStep(st, cfg, { tac, axe, busy }) {
  const K = st.full ? cfg.repliPasse : null, P = st.pass;
  if (!K || st.restart || !P || !(P.to >= 0) || !P.lead || st.possession?.carrier >= 0) return;
  const from = st.players[P.from]; if (!from) return;
  const def = 1 - from.team, og = st.pitch.ownGoal(def), L = P.lead;
  const dL = hyp(og.x - L[0], L[2]), gl = dL || 1, rec = K.recul ?? 2;
  const G = [L[0] + (og.x - L[0]) / gl * rec, 0, L[2] - L[2] / gl * rec];
  const fin = P.t + (P.flight ?? 1) + (K.tenue ?? 0.4);
  const n = Math.round(axe(tac(st, def).transition, K.nMin ?? 1, K.nMax ?? 3));
  const C = [];
  for (const q of st.players) {
    if (q.team !== def || q.keeper || q.down > 0 || q.expulse || q._sub || busy(q) || q.job === 'intercept') continue;
    if (dL > hyp(og.x - q.p[0], q.p[2]) + (K.marge ?? 2) || hyp(q.p[0] - L[0], q.p[2] - L[2]) > (K.portee ?? 30)) continue;
    if (st.t - P.t < (q.skill?.reaction ?? 0.18) * (2 - (q.skill?.anticipF ?? 1)) * (2 - (q.skill?.concF ?? 1))) continue;
    C.push({ q, e: etaCourse(q.p, q.v, G, { accel: (cfg.accel ?? 7.5) * (q.skill?.accelF ?? 1), top: (cfg.speeds?.chase ?? 6.4) * (q.skill?.topF ?? 1) }) });
  }
  C.sort((a, b) => a.e - b.e);
  for (const { q } of C.slice(0, n)) {
    q.target = [...G]; q._repliPasse = P.t;
    if (!((q._pace?.until ?? -1) > st.t)) q._pace = { until: fin, kind: 'repli-passe', next: q._pace?.next ?? st.t + 8 };
  }
}
