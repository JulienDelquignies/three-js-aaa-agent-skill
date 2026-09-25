// LE RENDEZ-VOUS DANS LA FOULÉE (220) — déporté de match-sim (volumétrie). Doc : match-config.foulee.
import { hyp } from './hyp.js';
import { predictPath, rendezVous, etaCourse } from './ball-predict.js';

  // LE RENDEZ-VOUS DANS LA FOULÉE (220, cfg.foulee && st.full — retour utilisateur : « il essaye de
  // la récupérer trop tôt, passe complètement à côté et doit refaire un effort »). Tracé : sur une
  // profonde de 34 m, le receveur EN COURSE prenait pour cible le ballon lui-même 20 m en amont
  // (« menace → on court au ballon », une loi de passe courte contestée), faisait demi-tour à 3 m/s,
  // puis la cible sautait 10 m au-delà du lead (rattrapage), revenait au lead, repartait 13 m plus
  // loin (retombée) : 9 changements de cible par vol, 29 % de ballons DÉPASSÉS, 43 % de prises.
  // La loi : un receveur LANCÉ (through, ou pointe d'appel avec le lead ≥ avance m devant lui)
  // n'a qu'UNE cible — le premier point JOUABLE du vol prédit, DANS le terrain, qu'il rejoint avec
  // sa cinématique réelle (élan, accélération × accelF, pointe × topF) et une MARGE
  // (marge × (2 − anticipF) : l'anticipation est une note) ; elle TIENT tant qu'elle reste
  // atteignable (hystérésis — plus de cible qui glisse), et les lois de passe courte se taisent.
export function cibleFoulee(st, cfg, r, pitch) {
{
    const F = cfg.foulee;
    const vR = hyp(r.v[0], r.v[1]);
    const kind = (r._pace?.until ?? -1) > st.t ? r._pace.kind : null;
    const lance = !!st.pass.through || kind === 'appel' || kind === 'un-deux' || kind === 'deborde' || kind === 'contre-appel' || kind === 'troisieme';
    const gA = pitch.attackGoal(r.team), sgA = Math.sign(gA.x || 1);
    const ux = vR > 1.5 ? r.v[0] / vR : sgA, uz = vR > 1.5 ? r.v[1] / vR : 0;
    const devant = (st.pass.lead[0] - r.p[0]) * ux + (st.pass.lead[2] - r.p[2]) * uz;
    // …ET LE BALLON QUI FRÔLE LA LIGNE SE COUPE EN AMONT (220 — retour utilisateur : « il court en
    // dehors du terrain pour la récupérer alors qu'il pourrait l'avoir dedans ») : lead à moins de
    // bord m d'une ligne → le rendez-vous DANS le terrain, le premier faisable, jamais la craie
    const bord = Math.min(pitch.hx - Math.abs(st.pass.lead[0]), pitch.hz - Math.abs(st.pass.lead[2])) < (F.bord ?? 4);
    if ((lance && devant >= (F.avance ?? 6)) || bord) {
      const cache = st._rdv;
      const refresh = !cache || cache.pass !== st.pass || st.t - cache.at > (F.cadence ?? 0.15);
      if (refresh) {
        const restant = Math.max(0.6, (st.pass.flight ?? 2) - (st.t - st.pass.t) + 1.2);
        const path = predictPath(st.ball, { dt: 1 / 30, maxT: Math.min(4, restant) });
        const opts = { accel: (cfg.accel ?? 7.5) * (r.skill?.accelF ?? 1), top: cfg.speeds.chase * (r.skill?.topF ?? 1), reach: cfg.receiveRadius ?? 0.85, reaction: 0,
          marge: (F.marge ?? 0.2) * (2 - (r.skill?.anticipF ?? 1)), maxHeight: 1.2, inside: [pitch.hx, pitch.hz],
          vPrise: Math.max(F.vPrise ?? 6.5, vR * (F.vPriseCourse ?? 1.1)) * (r.skill?.controlF ?? 1) };   // la prise dans la foulée : un sprinteur accepte un ballon à sa vitesse (× 1,1), le bon toucher prend plus vif
        let keep = null;
        if (cache && cache.pass === st.pass && cache.p && F.hyst !== false) {
          // l'hystérésis : le point tenu reste la cible tant que le vol y passe encore et qu'il y arrive à temps
          let near = null, nd = Infinity;
          for (const s of path) { const dd = hyp(s.p[0] - cache.p[0], s.p[2] - cache.p[2]); if (dd < nd) { nd = dd; near = s; } }
          if (near && nd < (F.div ?? 2.5) && near.t - opts.reaction - etaCourse(r.p, r.v, near.p, opts) >= 0) keep = { t: near.t, p: [near.p[0], near.p[1], near.p[2]], slack: 0 };
        }
        const rv = keep ?? rendezVous(path, r.p, r.v, opts);
        st._rdv = { pass: st.pass, at: st.t, p: rv ? [rv.p[0], rv.p[2]] : null, t: rv ? st.t + rv.t : null };
      }
      if (st._rdv?.p) return [st._rdv.p[0], 0, st._rdv.p[1]];
    }
}
return null;
}

// LE RECEVEUR S'ALIGNE AVANT LA PRISE (309, cfg.aligneRecev && st.full — retour du 26/09 « receveur toujours KO, pas bien placé ou
// passe imprécise »). Mesuré (sonde-309, graines 3 et 7) : la passe au sol est PRÉCISE (ligne du ballon à 0,24 m du point visé p50),
// le receveur NON — sa cible (le lead, la mène au ballon réel, l'avancée) est sur la ligne, lui pas : 0,15 s avant la prise, 17 % des
// receveurs (23 % au sol) sont encore à plus d'1 m de la trajectoire, en travers à 2,6 m/s — la prise jambe tendue, le corps en retard.
// Le vrai receveur lit le départ (réaction) et se met SUR la trajectoire avec de l'avance, puis attend le ballon posé. La loi : après
// sa réaction, la cible est le point du vol prédit (au sol) qu'il rejoint le plus VITE parmi ceux où il arrive avec une avance
// ≥ marge × (2 − anticipF) — le plus court chemin vers la ligne, pas le premier point (qui ferait remonter tout le vol) ; aucun :
// le rendez-vous d'hier (le premier atteignable). Rafraîchi à cadence. Clé absente : hier au bit.
export function cibleAlignee(st, cfg, r, pitch) {
  const K = cfg.aligneRecev, cache = st._alg;
  if (st.ball.p[1] >= (K.h ?? 0.9) || st.t - st.pass.t < (r.skill?.reaction ?? 0.18)) return null;
  if (!cache || cache.pass !== st.pass || st.t - cache.at > (K.cadence ?? 0.1)) {
    const restant = Math.max(0.6, (st.pass.flight ?? 2) - (st.t - st.pass.t) + 0.8);
    const path = predictPath(st.ball, { dt: 1 / 30, maxT: Math.min(3, restant) });
    const opts = { accel: (cfg.accel ?? 7.5) * (r.skill?.accelF ?? 1), top: cfg.speeds.chase * (r.skill?.topF ?? 1), reach: K.reach ?? 0.35 };
    const marge = (K.marge ?? 0.3) * (2 - (r.skill?.anticipF ?? 1)), inside = [pitch.hx - 0.5, pitch.hz - 0.5];
    // …JAMAIS AU-DELÀ DU POINT VISÉ s'il peut y être à temps (309b, filmé à l'atelier : passe de 6 m, receveur à 1,4 m du point visé,
    // aucun point proche jouable avec 0,3 s d'avance — la cible sautait 4 m EN AVAL, il fuyait le ballon le long de la ligne). Les
    // candidats s'arrêtent au passage du ballon au point visé (+ aval s) ; parmi eux, le plus rapide avec la marge, sinon la plus
    // grande avance ≥ 0 ; l'aval seulement si rien n'est jouable avant.
    const L = st.pass.lead; let tL = Infinity, dL = Infinity;
    if (K.aval != null) for (const s of path) { const d = Math.hypot(s.p[0] - L[0], s.p[2] - L[2]); if (d < dL) { dL = d; tL = s.t; } }
    let best = null, be = Infinity, repli = null, rs = -Infinity;
    for (const s of path) {
      if (s.p[1] > (K.h ?? 0.9) || Math.abs(s.p[0]) > inside[0] || Math.abs(s.p[2]) > inside[1]) continue;
      if (K.aval != null && s.t > tL + K.aval) break;
      const eta = etaCourse(r.p, r.v, s.p, opts), sl = s.t - eta;
      if (sl >= marge && eta < be) { be = eta; best = s; }
      if (K.aval != null && sl >= 0 && sl > rs) { rs = sl; repli = s; }
    }
    best ??= repli;
    const rv = best ? { p: best.p } : rendezVous(path, r.p, r.v, { ...opts, reaction: 0, marge: 0, maxHeight: K.h ?? 0.9, inside: [pitch.hx, pitch.hz] });
    st._alg = { pass: st.pass, at: st.t, p: rv ? [rv.p[0], rv.p[2]] : null };
  }
  return st._alg.p ? [st._alg.p[0], 0, st._alg.p[1]] : null;
}
