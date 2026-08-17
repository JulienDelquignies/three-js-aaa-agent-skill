// roles.js — LES RÔLES PAR POSTE : le poste dit OÙ (formation.js), le rôle dit QUOI (les biais
// de comportement), l'attribut dit COMMENT ça réussit (attributes.js) — trois couches qui se
// COMPOSENT sans se confondre. Même grammaire que la tactique (lot 15) : des axes à identité
// par défaut, un catalogue de points nommés par la culture football, et un projet aval qui pose
// les siens sans toucher au moteur.
//
// Un rôle est un PETIT objet de biais, consommé par des lois DÉJÀ prouvées :
//   profondeur [0..1] — le poste se tient plus haut (le 9 sur la ligne) ou décroche (le 10
//                        entre les lignes) : ±2,5 m sur la cible de poste (le calage Loi 11
//                        GARDE le dernier mot — un 9 haut reste calé sur la ligne)
//   largeurR   [0..1] — le poste se tient plus large (l'ailier qui craie la ligne) ou rentre
//                        (l'ailier repiqueur) : ×0,9…1,1 sur le z de poste, COMPOSE avec la
//                        largeur d'équipe (tactics)
//   appel      [0..1] — la cadence des appels profonds PERSONNELS (cooldown 14…6 s — le 9
//                        vit de ses courses, le meneur vit du ballon)
//   arbitre            — les poids {tir, centre, passe, conduite} du joueur (±15 %), composés
//                        avec le style d'ÉQUIPE dans menace.js : un 9 direct dans une équipe
//                        possession reste un 9 — nuancé, pas écrasé
//
// LE DÉFAUT EST L'IDENTITÉ : polyvalent = 0,5 / ×1 partout — aucun rôle posé, pas un bit ne
// bouge (la batterie le prouve). Dettes nommées : les rôles de PRESSING (qui déclenche, qui
// couvre) et le catalogue de formations 4-4-2 / 3-5-2 (généraliser « postes ≥ 7 » en lignes).

export const ROLES = {
  polyvalent:          { profondeur: 0.5, largeurR: 0.5, appel: 0.5, press: 0.5, arbitre: { tir: 1, centre: 1, passe: 1, conduite: 1 } },
  neufDeSurface:       { profondeur: 0.9, largeurR: 0.4, appel: 0.9, press: 0.65, arbitre: { tir: 1.15, centre: 0.95, passe: 0.9, conduite: 0.95 } },
  ailierDePercussion:  { profondeur: 0.55, largeurR: 0.9, appel: 0.6, press: 0.6, arbitre: { tir: 0.95, centre: 1.12, passe: 0.9, conduite: 1.15 } },
  meneur:              { profondeur: 0.15, largeurR: 0.45, appel: 0.2, press: 0.25, arbitre: { tir: 0.9, centre: 0.95, passe: 1.15, conduite: 1 } },
  piston:              { profondeur: 0.75, largeurR: 0.95, appel: 0.75, press: 0.7, arbitre: { tir: 0.9, centre: 1.15, passe: 1, conduite: 1.05 } },
  // le 6 — le métier DÉFENSIF de la couche rôles (lot 19) : il colle son marquage, il saute
  // en second presseur, il ne dérape pas en appels profonds
  recuperateur:        { profondeur: 0.35, largeurR: 0.45, appel: 0.25, press: 0.95, arbitre: { tir: 0.85, centre: 0.9, passe: 1.08, conduite: 0.92 } },
};

/** Résout un nom ou un objet partiel en rôle complet (absent = polyvalent, l'identité). */
export function resoudreRole(r) {
  const base = typeof r === 'string' ? (ROLES[r] ?? ROLES.polyvalent) : (r ?? {});
  return {
    profondeur: base.profondeur ?? 0.5, largeurR: base.largeurR ?? 0.5, appel: base.appel ?? 0.5, press: base.press ?? 0.5,
    arbitre: { tir: 1, centre: 1, passe: 1, conduite: 1, ...(base.arbitre ?? {}) },
    nom: typeof r === 'string' ? r : (base.nom ?? 'personnalisé'),
  };
}

/** Le rôle d'un joueur — TOUJOURS résolu (aucun rôle posé : polyvalent). */
export function role(p) { return p?.role ?? ROLES.polyvalent; }

/** Le contrat : catalogue borné, polyvalent identitaire, résolution honnête. */
export function checkRoles() {
  const issues = [];
  for (const [nom, r] of Object.entries(ROLES)) {
    for (const k of ['profondeur', 'largeurR', 'appel', 'press']) {
      if (r[k] < 0 || r[k] > 1) issues.push(`${nom}.${k} hors [0;1]`);
    }
    for (const [o, v] of Object.entries(r.arbitre)) if (v < 0.7 || v > 1.3) issues.push(`${nom}.arbitre.${o} = ${v} hors [0,7;1,3] — un rôle nuance, il n'écrase pas`);
  }
  const p = ROLES.polyvalent;
  if (p.profondeur !== 0.5 || p.largeurR !== 0.5 || p.appel !== 0.5 || p.press !== 0.5
    || Object.values(p.arbitre).some((v) => v !== 1)) issues.push('polyvalent n\'est pas l\'identité');
  const d = resoudreRole(undefined);
  if (d.profondeur !== 0.5 || d.arbitre.tir !== 1) issues.push('un rôle absent ne résout pas en identité');
  if (resoudreRole('meneur').arbitre.passe !== 1.15) issues.push('resoudreRole ne résout pas un nom');
  return { ok: issues.length === 0, issues };
}

/** LE DÉDOUBLEMENT (lot 88, cfg.deborde — la course de rôle du couloir) : porteur LARGE et
 *  offensif → son LATÉRAL (posts 0/3, même côté) dépasse par l'extérieur, par le canal des
 *  appels (_pace 'deborde' : le porteur voit les coureurs). La cadence est le RÔLE (piston
 *  souvent, récupérateur presque jamais) ; l'ailier INVERSÉ (lot 87) qui repique LIBÈRE ce
 *  couloir. Retourne la cible de course ou null. false : le latéral qui reste chez lui. */
export function deborde(st, p, carrier, pitch, atk, cfg, axe) {
  if (!st.full || cfg.deborde === false || !carrier || carrier.keeper) return null;
  if (p.post !== 0 && p.post !== 3) return null;
  const sg = -pitch.ownGoal(atk).sign;
  if ((p._ovT ?? -1) <= st.t
    && Math.abs(carrier.p[2]) > pitch.hz * 0.42
    && Math.sign(p.p[2] || 1) === Math.sign(carrier.p[2] || 1)
    && carrier.p[0] * sg > pitch.hx * 0.1) {
    p._ovT = st.t + 8 / Math.max(0.3, axe(role(p).appel, 0.4, 1.6));
    p._ovUntil = st.t + 1.6;
    p._pace = { until: st.t + 1.5, kind: 'deborde', next: p._pace?.next ?? st.t + 8 };
    st.events.push({ t: +st.t.toFixed(2), type: 'burst', kind: 'deborde', by: p.id });
  }
  if ((p._ovUntil ?? -1) > st.t) return [
    Math.max(-pitch.hx + 1.5, Math.min(pitch.hx - 1.5, carrier.p[0] + sg * 9)),
    Math.sign(carrier.p[2] || 1) * Math.min(pitch.hz - 1.5, Math.abs(carrier.p[2]) + 4)];
  return null;
}
