// interligne.js — L'INTERLIGNE DÉRIVÉ ET SON POINT DE RUPTURE (274, cfg.interligne — Bible 10 §3.1-3.3, tests 2 et 20 ;
// lot 4 de la fiche). Gourcuff : « certains joueurs peuvent intervenir sur quinze mètres, parce qu'ils ont la puissance ;
// pour des joueurs plus limités, autour de dix mètres ; en bloc bas, du six mètres ». L'interligne n'est donc pas une
// constante de système (le bloc d'hier : une compression uniforme de la formation à `long` 30 m) : c'est une fonction DES
// ATTRIBUTS de la ligne qui doit intervenir — la portée d'intervention reach = base + gain × (0,5 pace + 0,3 anticipation
// + 0,2 stamina), 10,5 m au monde moyen, 10 au limité, 15 au puissant — × le mode de bloc (l'AXE hauteurBloc : bas 0,55,
// médian 1, haut 1,15 ; 0,5 = 1, l'identité), la cible [reach·k·0,8 ; reach·k] bornée [5 ; 14] / [6 ; 18]. Le tick d'équipe
// (1 Hz) relit la cible ; la ligne du milieu tient ses cibles à [réf + lo ; réf + hi] au-dessus de la RÉFÉRENCE de l'unité
// arrière (273) — c'est ainsi que le milieu SUIT la ligne tenue (mesuré au 273 : l'interligne 10,9 → 13,8 m, le milieu ne
// suivait pas). Le point de rupture n'est pas postulé, il est dérivé (§3.2 : le presseur arrive après la médiane de la
// possession individuelle à 19,4 m) : au-delà de `rupture` (19 m) pendant dureeRupture s l'unité publie blockIntegrity
// BROKEN (événement 'bloc' kind 'rupture'), `alarme` (16 m) le WARN. Les milieux presseurs, les marqueurs au contact et le
// pivot en passation (252) ne sont pas retenus. Clé absente, ou sans l'unité 273 : le bloc d'hier au bit.

const r = (F, lo, hi) => F == null ? 0.5 : Math.max(0, Math.min(1, (F - lo) / (hi - lo)));

/** La portée d'intervention d'un corps (m) : base + gain × (0,5 pace + 0,3 anticipation + 0,2 stamina), lue des facteurs
 *  (topF [0,9 ; 1,1], anticipF [0,85 ; 1,15], stamF [1,25 ; 0,75] — 10,5 exact au 50 / sans note). Pure. */
export function porteeDe(p, K) {
  const s = p.skill;
  return (K.base ?? 6) + (K.gain ?? 9) * (0.5 * r(s?.topF, 0.9, 1.1) + 0.3 * r(s?.anticipF, 0.85, 1.15) + 0.2 * r(s?.stamF, 1.25, 0.75));
}

/** La cible d'interligne [lo, hi] d'une ligne (m) : la portée moyenne × le mode de bloc (hauteur ∈ [0 ; 1] : bas kBas, médian 1,
 *  haut kHaut), bornée. Pure. */
export function cibleDe(membres, hauteur, K) {
  const reach = membres.length ? membres.reduce((a, m) => a + porteeDe(m, K), 0) / membres.length : (K.base ?? 6) + (K.gain ?? 9) * 0.5;
  const h = Math.max(0, Math.min(1, hauteur ?? 0.5));
  const k = h < 0.5 ? (K.kBas ?? 0.55) + (1 - (K.kBas ?? 0.55)) * (h / 0.5) : 1 + ((K.kHaut ?? 1.15) - 1) * ((h - 0.5) / 0.5);
  const lo = Math.max(K.loMin ?? 5, Math.min(K.loMax ?? 14, reach * k * 0.8)), hi = Math.max(K.hiMin ?? 6, Math.min(K.hiMax ?? 18, reach * k));
  return { reach, k, lo, hi: Math.max(lo, hi) };
}

/** L'intégrité du bloc d'après l'écart mesuré (m) : OK / WARN (≥ alarme) / BROKEN (≥ rupture). Pure. */
export function integriteDe(gap, K) { return gap >= (K.rupture ?? 19) ? 'BROKEN' : gap >= (K.alarme ?? 16) ? 'WARN' : 'OK'; }

/** Le milieu suit la ligne : après ligneStep (ref = la référence de l'unité arrière, en avancement depuis la ligne de but
 *  propre), avant le mouvement. milieux : les corps de la ligne du milieu debout ; arriere : les corps de l'unité arrière. */
export function interligneStep(st, cfg, { defTeam, milieux, arriere, ref, ownX, sgnDef, hauteur }) {
  const K = cfg.interligne; if (!K || ref == null || !milieux.length) return null;
  const av = (x) => (ownX - x) * sgnDef;
  const U = ((st._interligne ??= {})[defTeam] ??= { t: -Infinity, lo: null, hi: null, integrity: 'OK', since: null, compte: false, ruptures: 0, gap: 0 });
  if (st.t - U.t >= 1 / (K.hz ?? 1) - 1e-9) { const c = cibleDe(milieux, hauteur, K); U.t = st.t; U.lo = c.lo; U.hi = c.hi; U.reach = c.reach; }
  for (const m of milieux) {
    if (!m.target || m.job === 'press' || m.job === 'gkBall') continue;
    if (m._markT && Math.abs(m.target[0] - m._markT[0]) < 1e-9) continue;   // le marqueur au contact garde son homme
    if (m._remisAt === st.t) continue;   // le pivot qui marque l'homme remis par le central (252) garde sa passation
    const a = av(m.target[0]), lo = ref + U.lo, hi = ref + U.hi;
    if (a < lo) m.target[0] = ownX - sgnDef * lo; else if (a > hi) m.target[0] = ownX - sgnDef * hi;
  }
  // l'intégrité : l'écart des barycentres (milieu − arrière), publié ; la rupture tenue dureeRupture s se compte une fois
  if (arriere.length) {
    const bar = (a) => a.reduce((s2, m) => s2 + av(m.p[0]), 0) / a.length;
    U.gap = bar(milieux) - bar(arriere);
    const etat = integriteDe(U.gap, K);
    if (etat === 'BROKEN') { if (U.since == null) { U.since = st.t; U.compte = false; } if (!U.compte && st.t - U.since >= (K.dureeRupture ?? 2)) { U.compte = true; U.ruptures++; st.events.push({ t: +st.t.toFixed(2), type: 'bloc', kind: 'rupture', team: defTeam, gap: +U.gap.toFixed(1) }); } }
    else U.since = null;
    U.integrity = etat;
  }
  return U;
}
