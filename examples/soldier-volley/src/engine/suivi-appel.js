// suivi-appel.js — L'APPEL EN PROFONDEUR EST PRIS (317, cfg.suiviAppel && st.full — le chantier du bloc défensif, notes 443-444).
// Sondé (sonde-traverse, monde 316, 50 échappées = porteur à < 25 m du but sans défenseur de champ plus près) : le futur porteur n'avait
// PAS le ballon 3 s avant (46 / 50) — un APPEL : il courait vers le but à 4 m/s et traversait 2 défenseurs p50 (des marqueurs d'AUTRES
// hommes, 85 / 122, qui reculaient à 1,3 m/s) ; il n'était marqué (une cible de marqueur à < 3,5 m de lui) que 18 fois sur 50, et même
// alors son marqueur était à 12,5 m. Le côté faible n'a pas de marqueur (ballsideTrim, 96 : « la zone le couvre »), les hommes loin du
// ballon sortent de la liste — et la zone ne suit pas la course dans le dos. La loi, post-passe d'autorité (après les jobs) : tout
// attaquant de champ SANS ballon qui court vers MON but (≥ v m/s, à < portee m de ma ligne) avec au plus N défenseurs de champ plus près
// du but que lui est PRIS — le défenseur libre (ni presseur, ni en geste, ni déjà suiveur) qui arrive le plus tôt au point goal-side
// (etaCourse × (2 − anticipF) : le lecteur part plus tôt ; la pointe × topF) quitte son job : 'mark', cible goal-side DEVANT le coureur
// (sa position + avance s de sa vitesse + recul m vers le but), la course entière (le régime de rupture 'suivi' : ni entretien ni
// fermeture). N = seuil + (axe compacité > 0,6 ? 1 : 0) — le bloc compact ne laisse pas un homme seul sur la dernière ligne. Absente : hier.
import { hyp } from './hyp.js';
import { etaCourse } from './ball-predict.js';

export function suiviAppelStep(st, cfg, { tac, axe, busy }) {
  const K = st.full ? cfg.suiviAppel : null;
  if (!K || st.restart || !(st.possession?.team >= 0)) return;
  const atk = st.possession.team, def = 1 - atk, og = st.pitch.ownGoal(def);
  const defs = st.players.filter((q) => q.team === def && !q.keeper && q.down <= 0 && !q.expulse && !q._sub);
  const N = (K.seuil ?? 1) + (axe(tac(st, def).compacite, 0, 1) > 0.6 ? 1 : 0);
  const pris = new Set();
  for (const a of st.players) {
    if (a.team !== atk || a.keeper || a.down > 0 || a.id === st.possession.carrier) continue;
    const gx = og.x - a.p[0], gz = -a.p[2], gl = hyp(gx, gz) || 1, vA = (a.v[0] * gx + a.v[1] * gz) / gl;
    if (vA < (K.v ?? 3.5) || Math.abs(og.x - a.p[0]) > (K.portee ?? 40)) continue;
    let devant = 0; for (const q of defs) if (hyp(og.x - q.p[0], q.p[2]) < gl) devant++;
    if (devant > N) continue;
    const t = K.avance ?? 0.5, rec = K.recul ?? 1.5;
    const px = a.p[0] + a.v[0] * t + (gx / gl) * rec, pz = a.p[2] + a.v[1] * t + (gz / gl) * rec;
    let best = null, be = Infinity;
    for (const q of defs) {
      if (pris.has(q.id) || q.job === 'press' || q.job === 'contre' || q.job === 'intercept' || busy(q)) continue;
      const e = etaCourse(q.p, q.v, [px, 0, pz], { accel: (cfg.accel ?? 7.5) * (q.skill?.accelF ?? 1), top: (cfg.speeds?.chase ?? 6.4) * (q.skill?.topF ?? 1) }) * (2 - (q.skill?.anticipF ?? 1));
      if (e < be) { be = e; best = q; }
    }
    if (!best || be > (K.horizon ?? 4)) continue;
    pris.add(best.id);
    best.job = 'mark'; best.target = [px, 0, pz]; best._suivi = { id: a.id, t: st.t };
    best._pace ??= { until: -1, next: 0 };
    if (!((best._pace.until ?? -1) > st.t)) { best._pace.until = st.t + 0.3; best._pace.kind = 'suivi'; }
  }
}
