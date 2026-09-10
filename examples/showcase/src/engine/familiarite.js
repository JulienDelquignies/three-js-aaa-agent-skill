// LA FAMILIARITÉ, LE MÉCANISME RELATIONNEL (254, cfg.familiarite && st.full — la carte du book, Modèle 14 §7 :
// « une consigne neuve n'est pas un automatisme » ; Référentiel 13 : la relation familiarité → coordination est en U et
// son effet propre sur les points est indissociable de zéro — donc AUCUN canal ne déplace la réussite moyenne d'une
// action : le bruit d'exécution n'est PAS indexé sur η). Deux grandeurs : η (l'installation collective, par équipe —
// l'état st.fam[team], choqué par un changement de posture du coach et rétabli sur DEUX échelles de temps : la branche
// rapide du réalignement, 90 s, et la branche lente de l'automatisme, 25 min) et Φij (l'affinité de la PAIRE, qui
// conditionne les motifs à deux ou trois : un-deux, troisième homme — P × Φ^0,7). Les canaux autorisés : la
// synchronie de la ligne (σ_sync = 0,12 + 0,40 (1 − η) s : à η 0,4 c'est 0,36 s, ≈ 2,5 m de désalignement à 7 m/s —
// « la ligne brisée devient un événement statistique, pas un script »), le temps de réaction (× 1 + 0,45 (1 − η)),
// l'ancre (+1,5 (1 − η) m) — les deux derniers restent des dettes nommées. Le consommateur injecte la familiarité par
// joueur (squads[team][i].familiarite ∈ [0 ; 1], défaut 1 : l'équipe rodée) ; η0 = la moyenne, Φij = √(fi fj).
// Clé absente : la ligne parfaitement synchrone et les motifs à P pleine d'hier, au bit.
import { gauss } from './attributes.js';

const A = 0.55, T_FAST = 90, T_SLOW = 1500;

/** η(t) après un choc η0 à t0 : deux échelles (Modèle 14 §7). Pur. */
export function etaApres(eta0, dt, K = {}) {
  const a = K.a ?? A, tf = K.tFast ?? T_FAST, ts = K.tSlow ?? T_SLOW;
  return 1 - (1 - eta0) * (a * Math.exp(-dt / tf) + (1 - a) * Math.exp(-dt / ts));
}

/** σ de synchronie de la ligne (s) à η. Pur. */
export function sigmaSync(eta, K = {}) { return (K.sync0 ?? 0.12) + (K.sync1 ?? 0.40) * (1 - eta); }

/** P(motif à deux ou trois disponible) : Φ^0,7. Pur. */
export function affiniteMotif(phi, K = {}) { return Math.pow(Math.max(0, Math.min(1, phi)), K.motif ?? 0.7); }

function famDe(st, team) {
  if (!st.fam) st.fam = [null, null];
  if (!st.fam[team]) {
    const mine = st.players.filter((q) => q.team === team);
    const eta0 = mine.length ? mine.reduce((s, q) => s + (q.fam ?? 1), 0) / mine.length : 1;
    st.fam[team] = { eta0, t0: 0, eta: eta0, base: eta0 };
  }
  return st.fam[team];
}

export function etaDe(st, team, cfg) {
  const K = st.full ? cfg?.familiarite : null;
  if (!K) return 1;
  const F = famDe(st, team);
  return F.eta;
}

/** Le CHOC (un changement de consigne hors mi-temps : η ← chocPosture ; l'appel vient du coach). */
export function chocFamiliarite(st, team, eta, cause, cfg) {
  const K = st.full ? cfg?.familiarite : null;
  if (!K) return;
  const F = famDe(st, team);
  F.eta0 = Math.min(F.eta, eta); F.t0 = st.t; F.eta = F.eta0;
  st.events.push({ t: +st.t.toFixed(2), type: 'familiarite', team, eta: +F.eta.toFixed(2), cause });
}

/** À chaque image : η remonte sur ses deux branches, jamais au-dessus de la base rodée (la moyenne des joueurs). */
export function familiariteStep(st, cfg) {
  const K = st.full ? cfg.familiarite : null;
  if (!K) return;
  for (const team of [0, 1]) {
    const F = famDe(st, team);
    if (F.eta0 >= F.base) { F.eta = F.base; continue; }
    F.eta = Math.min(F.base, etaApres(F.eta0, st.t - F.t0, K) * F.base + (1 - F.base) * 0);   // la remontée vise la base rodée (F.base ≤ 1)
  }
}

/** Φij de deux coéquipiers : √(fi fj) — l'affinité de la paire par la familiarité de chacun. */
export function affinite(st, i, j, cfg) {
  const K = st.full ? cfg?.familiarite : null;
  if (!K) return 1;
  const a = st.players[i], b = st.players[j];
  if (!a || !b) return 1;
  return Math.sqrt((a.fam ?? 1) * (b.fam ?? 1)) * (etaDe(st, a.team, cfg) ** (K.etaMotif ?? 0.5));
}
