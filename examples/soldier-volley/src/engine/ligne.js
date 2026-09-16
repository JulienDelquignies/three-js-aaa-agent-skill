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

/** L'ACCROCHE (280, cfg.ligneAccrochee — Bible 10 §3.4 : « k_y est une fraction, k_x est une saturation ») : la hauteur cible de la ligne
 *  arrière est x_ligne = min(consigne, x_ballon − marge) — régime LIBRE (le ballon recule dans son camp : la ligne tient sa consigne,
 *  k_x = 0) ou ACCROCHÉ (la ligne suit le porteur mètre pour mètre, k_x = 1), la marge de profondeur signée par l'état du porteur (couvert
 *  −2..+1 : le pas en avant, le hors-jeu devient actif ; entre-deux +2..+4 ; découvert +6..+12 : le recul-frein). Mesuré avant : la ligne
 *  vivait 23-25 m derrière le ballon quel que soit l'état (le bloc d'hier chaîné à 27 m du ballon) et à 6 m de son but quand le ballon
 *  était à 25 m — la surface ouverte, 70-84 touches en surface adverse par match pour 51. La consigne est l'AXE hauteurBloc (bas 22 →
 *  haut 52 m, l'échelle du Brief : 18-26 / 34-44 / 48-56) ± l'axe piege ; la marge par état est la loi ; l'anticipation est un facteur
 *  (le bloc qui lit se tient plus près : marge × (2 − anticipF)). Rend { xLigne, regime, marge, consigne }. Pure. */
export function accrocheDe(K, { xBallon, etat, hauteurBloc, piege, anticipF = 1 }) {
  const ax = (v, lo, hi) => lo + Math.max(0, Math.min(1, v ?? 0.5)) * (hi - lo);
  const consigne = ax(hauteurBloc, K.consigne?.bas ?? 22, K.consigne?.haut ?? 52) + ax(piege, -(K.piege ?? 3), K.piege ?? 3);
  const M = K.marge ?? {}, m0 = etat === 'couvert' ? (M.couvert ?? -1) : etat === 'découvert' ? (M.decouvert ?? 8) : (M.entreDeux ?? 3);
  const marge = m0 * (m0 > 0 ? (2 - anticipF) : 1);
  const accroche = xBallon - marge <= consigne;
  return { xLigne: Math.max(K.plancher ?? 6, accroche ? xBallon - marge : consigne), regime: accroche ? 'accroché' : 'libre', marge, consigne };
}

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
export function ligneStep(st, cfg, { defTeam, membres, ownX, sgnDef, couvert, accroche = null }) {
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
  // …L'ACCROCHE (280) : la ligne ne vit plus à 27 m du ballon — sa référence est x_ligne = min(consigne, x_ballon − marge) ; les cibles
  // de l'unité glissent d'un bloc (la géométrie interne tenue, le régime locomoteur du 273 fait le corps) ; U.ref devient la référence
  // accrochée (l'interligne du 274 la lit). null : la référence chaînée d'hier au bit.
  if (accroche) { const A = accrocheDe(cfg.ligneAccrochee, accroche); const shift = A.xLigne - U.ref; if (Math.abs(shift) > 1e-9) { for (const m of unite) if (m.target) m.target[0] -= sgnDef * shift; U.ref = A.xLigne; } U.regime = A.regime; U.marge = A.marge; }
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
