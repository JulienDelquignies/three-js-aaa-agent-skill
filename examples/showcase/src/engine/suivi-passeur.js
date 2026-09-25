// suivi-passeur.js — LE PASSEUR QUI PART EST SUIVI (322, cfg.suiviPasseur && st.full — le chantier des échappées, note 447).
// Sondé (sonde-passe-esc, monde 318) : 5 des 8 échappées nées d'une passe sont des UN-DEUX — le passeur donne, part, reçoit en retour
// derrière la ligne ; son marqueur REGARDE LE BALLON (à 3 m de lui à la passe, il recule à −0,7 m/s pendant que l'autre file au but à
// 3-4 m/s). Au réel, « suis ton homme quand il a donné » est la première consigne du marquage. La loi, post-passe d'autorité : au départ
// d'une passe adverse, le marqueur du passeur (la cible de marquage à < prise m de lui, sinon le défenseur de champ libre le plus proche à
// < prise m) le SUIT pendant duree × concF s (le concentré tient, le distrait lâche) après sa lecture reaction × (2 − concF) : tant que le
// passeur court vers mon but (≥ v m/s), cible goal-side (sa position + avance s de sa vitesse + recul × (2 − markF) vers le but, le bon
// colle), en rupture 'suivi' — c'est SON homme : aucune zone n'est quittée (la leçon du 317). Absente : hier.
import { hyp } from './hyp.js';

export function suiviPasseurStep(st, cfg, { busy }) {
  const K = st.full ? cfg.suiviPasseur : null;
  if (!K) return;
  const S = (st._suiviP ??= new Map());
  if (st.restart) { S.clear(); return; }
  const P = st.pass;
  if (P && P.t !== st._suiviPT && P.from >= 0 && P.to >= 0) {   // une passe NOUVELLE : on nomme le marqueur du passeur
    st._suiviPT = P.t;
    const a = st.players[P.from];
    if (a && !a.keeper) {
      const prise = K.prise ?? 4;
      let best = null, bd = prise;
      for (const q of st.players) {
        if (q.team === a.team || q.keeper || q.down > 0 || q.expulse || q._sub) continue;
        const dT = q.job === 'mark' && q.target ? hyp(q.target[0] - a.p[0], q.target[2] - a.p[2]) : Infinity;
        const d = Math.min(dT, hyp(q.p[0] - a.p[0], q.p[2] - a.p[2]) + (K.penaliteLibre ?? 1));
        if (d < bd && q.job !== 'press' && q.job !== 'intercept') { bd = d; best = q; }
      }
      if (best) S.set(best.id, { id: a.id, t0: P.t + (best.skill?.reaction ?? 0.18) * (2 - (best.skill?.concF ?? 1)), fin: P.t + (K.duree ?? 2.5) * (best.skill?.concF ?? 1), team: a.team });
    }
  }
  for (const [qid, s] of S) {
    const q = st.players[qid], a = st.players[s.id];
    if (!q || !a || st.t > s.fin || st.possession?.team !== s.team || q.down > 0) { S.delete(qid); continue; }
    if (st.t < s.t0 || busy(q) || q.job === 'press' || q.job === 'intercept' || st.possession.carrier === a.id) continue;
    const og = st.pitch.ownGoal(q.team), gx = og.x - a.p[0], gz = -a.p[2], gl = hyp(gx, gz) || 1;
    if ((a.v[0] * gx + a.v[1] * gz) / gl < (K.v ?? 1.5)) continue;   // il ne part pas vers mon but : le marquage d'hier
    const t = K.avance ?? 0.4, rec = (K.recul ?? 1.5) * (2 - (q.skill?.markF ?? 1));
    q.job = 'mark'; q.target = [a.p[0] + a.v[0] * t + gx / gl * rec, 0, a.p[2] + a.v[1] * t + gz / gl * rec];
    if (!((q._pace?.until ?? -1) > st.t) || q._pace.kind === 'suivi') q._pace = { until: st.t + 0.3, kind: 'suivi', next: q._pace?.next ?? st.t + 8 };
  }
}
