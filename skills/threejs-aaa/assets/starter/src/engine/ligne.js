// ligne.js — LA LIGNE EST UNE LIGNE (273, cfg.ligne — Bible 03 §2.3 et T8, Bible 10 §10.1 et le tick d'unité 4 Hz,
// ch. 01 : « une grandeur calculée une fois par unité et lue par tous coûte moins cher et produit plus de cohérence »).
// Mesuré avant : lineDesync p50 7,5 m (réel 0,8-1,8, pic ≤ 3,5), la ligne arrière n'était pas une ligne — chaque corps
// tenait son homme ou son slot, le latéral monté remettait l'attaquant en jeu, le central chassait (14 km). Ici la ligne
// arrière est une UNITÉ : à hz (4 Hz) elle relit sa référence x_ligne (le 2ᵉ plus reculé de ses cibles — la définition
// FIFA du hors-jeu, Bible 10 §10.1), et chaque corps de l'unité tient sa cible dans la bande [x_ligne − arriere ;
// x_ligne + avant − retard_i] : `avant` est la bande commune (les latéraux aussi — Bible 03 lot 1), `retard_i` le
// déphasage PROPRE du corps (la seule source de désynchronisation en régime établi : K.retard × (2 − anticipF) ×
// (2 − posF), 0,9-1,7 m au monde noté, 1,3 exact au 50), `arriere` l'allongement du couvreur (dLong −3 à −6 m). Le
// presseur n'est pas de la ligne (« un qui sort, trois qui couvrent » — 228), le marqueur au contact garde son homme
// côté but (192) : la bande ne le retient que vers l'avant. Et « ON RETIENT LES AVANCÉS » (§10.1) : quand la ligne
// vécue est cassée (desync > seuil) et que la passe en profondeur est possible (ballon non couvert), le plus avancé
// FREINE (frein × sa pointe pendant dureeFrein s) — on ne fait pas monter le retardataire, il ne peut pas. Le hors-jeu
// n'est jamais déclenché : il émerge de la géométrie (259). Événement 'ligne' kind 'frein' au journal. Attributs en
// facteurs, tactique et rôle par la bande d'hier (bandeDuCentral), la clé absente : la ligne d'hier au bit.

/** Le retard propre d'un corps (m, derrière la ligne d'unité) — l'anticipation lit, le placement tient. Pure. */
export function retardDe(p, K) { return (K.retard ?? 1.3) * (2 - (p.skill?.anticipF ?? 1)) * (2 - (p.skill?.posF ?? 1)); }

/** La référence de l'unité : le 2ᵉ plus reculé des avancements a (m depuis la ligne de but propre). Pure. */
export function referenceDe(avs) {
  let lo = Infinity, second = Infinity;
  for (const a of avs) { if (a < lo) { second = lo; lo = a; } else if (a < second) second = a; }
  return avs.length >= 2 ? second : (avs.length ? lo : null);
}

/** L'unité tient sa ligne : relit la référence à hz, borne les cibles à la bande, retient les avancés. Après les cibles,
 *  avant le mouvement. membres : les corps de la ligne arrière (postes de la ligne OFF), debout ; ownX : la ligne de but
 *  propre ; sgnDef : le signe de ownX ; couvert : l'état du ballon (couvertStep). */
export function ligneStep(st, cfg, { defTeam, membres, ownX, sgnDef, couvert }) {
  const K = cfg.ligne; if (!K || membres.length < 2) return null;
  const av = (x) => (ownX - x) * sgnDef;                   // + = vers le but adverse
  const U = ((st._ligne ??= {})[defTeam] ??= { t: -Infinity, ref: null, desync: 0 });
  const unite = membres.filter((m) => m.job !== 'press' && m.job !== 'gkBall');
  if (unite.length < 2) return null;
  if (st.t - U.t >= 1 / (K.hz ?? 4) - 1e-9) {
    U.t = st.t; U.ref = referenceDe(unite.map((m) => av(m.target ? m.target[0] : m.p[0])));
    let lo = Infinity, hi = -Infinity, plusAvance = null;
    for (const m of membres) { const a = av(m.p[0]); if (a < lo) lo = a; if (a > hi) { hi = a; plusAvance = m; } }
    U.desync = hi - lo; U.lo = lo; U.avance = plusAvance;
  }
  if (U.ref == null) return U;
  for (const m of unite) {
    if (!m.target) continue;
    const homme = !!(m._markT && Math.abs(m.target[0] - m._markT[0]) < 1e-9);   // le marqueur au contact garde son homme côté but
    const a = av(m.target[0]), lim = U.ref + (K.avant ?? 2) - retardDe(m, K), fond = U.ref - (K.arriere ?? 5);
    if (a > lim) m.target[0] = ownX - sgnDef * lim;
    else if (!homme && a < fond) m.target[0] = ownX - sgnDef * fond;
    // LA HAUTEUR EST UN RÉGIME LOCOMOTEUR (Bible 10 §3.4, test 17) : le corps hors de sa bande (à plus de tol m de sa cible en
    // profondeur) rejoint la ligne en course avant (montee, 4-5,5 m/s) ou en recul organisé (recul, 3,5-4,4 — 0,55 × l'avant),
    // pas au trot d'entretien ; le régime d'effort (261) le lit (p._efLigne). L'attribut pace est le facteur (topF).
    const ecart = av(m.target[0]) - av(m.p[0]);
    if (Math.abs(ecart) > (K.tol ?? 2)) m._efLigne = { until: st.t + (K.tenue ?? 0.5), v: (ecart > 0 ? (K.montee ?? 4.8) : (K.recul ?? 3.9)) * (m.skill?.topF ?? 1), sens: ecart > 0 ? 'montée' : 'recul' };
  }
  // « on retient les avancés » : la ligne vécue cassée et la passe en profondeur possible → le plus avancé freine
  // …et seulement quand il MONTE ou tient (sa cible devant lui) : en recul, le plus avancé est le retardataire de la ligne qui descend
  if (U.desync > (K.seuil ?? 3) && couvert !== 'couvert' && U.avance && U.avance.job !== 'press' && U.avance.target && av(U.avance.target[0]) >= av(U.avance.p[0]) - (K.tol ?? 2) && !(U.avance._frein && U.avance._frein.until > st.t)) {
    U.avance._frein = { until: st.t + (K.dureeFrein ?? 0.4), f: K.frein ?? 0.75 };
    st.events.push({ t: +st.t.toFixed(2), type: 'ligne', kind: 'frein', team: defTeam, by: U.avance.id, desync: +U.desync.toFixed(2) });
  }
  return U;
}
