// couloirs.js — LES CINQ COULOIRS (241, cfg.couloirs — précepte 1.4, Guardiola : « jamais plus de deux joueurs dans le
// même couloir vertical ») : un REGISTRE d'occupation des CIBLES de la structure d'attaque, ouvert à chaque image par le
// porteur (son couloir compte en premier), rempli par les postés puis les soutiens dans l'ordre où le match les pose. Une
// cible qui tombe dans un couloir plein (≥ max) se DÉPLACE au couloir voisin le plus proche qui a de la place — à égalité,
// le CÔTÉ DU BALLON (surcharger un côté, isoler l'autre : contre le ballon, la fixation du 98 mourait) — en gardant sa position relative dans le couloir ; la réaffectation TIENT
// tenue s (hystérésis — la v4 promise au lot 84 : jamais un post-traitement par image, trois échecs consignés). Mesuré avant
// (6 × 300 s, attaque placée, corps devant le ballon − 10 m) : un couloir à ≥ 3 corps sur 50 % des images, deux demi-espaces
// occupés 34 %. Clé absente : aucune cible ne bouge, l'hier au bit.
export const couloirDe = (z, hz) => Math.max(0, Math.min(4, Math.floor((z + hz) / (hz * 2 / 5))));

export function ouvrirRegistre(st, atk, pitch, carrier) {
  const mk = () => ({ n: [0, 0, 0, 0, 0], prev: [0, 0, 0, 0, 0], av: [0, 0, 0, 0, 0], prevAv: [0, 0, 0, 0, 0], lig: new Map(), t: -1 });
  const R = (st._bCoul ??= [mk(), mk()])[atk];
  if (R.t !== st.t) {
    for (let c = 0; c < 5; c++) { R.prev[c] = R.n[c]; R.n[c] = 0; R.prevAv[c] = R.av[c]; R.av[c] = 0; } R.lig.clear();   // prev : l'image d'avant (REMPLIR et le RELAIS lisent ce qui est resté vide)
    R.t = st.t; if (carrier && !carrier.keeper) R.n[couloirDe(carrier.p[2], pitch.hz)]++;
  }
  return R;
}

/** L'INTÉRIEUR TIENT SON DEMI-ESPACE (241, C.relais — précepte 1.4 : « un relais dans chaque demi-espace ≥ 80 % du temps de
 *  possession » ; mesuré 32 % : le coulissement latéral de la formation (68) ramenait l'intérieur OPPOSÉ vers le ballon et vidait son
 *  demi-espace). Un poste de la ligne des milieux dont le spot DE BASE (formation sans coulissement) tombe dans un demi-espace y reste
 *  borné en possession (marge m du bord) — pas de poursuite, pas d'élection : le poste tient. L'élection d'un relais à ballon + 6 m
 *  a été ESSAYÉE ET REJETÉE (44 % mais réussite 74 → 71 : une cible mobile poursuivie). */
export function tenirDemiEspace(tz, baseZ, hz, marge = 1.5) {
  const c = couloirDe(baseZ, hz); if (c !== 1 && c !== 3) return tz;
  const W = hz * 2 / 5, zc = -hz + (c + 0.5) * W;
  return Math.max(zc - W / 2 + marge, Math.min(zc + W / 2 - marge, tz));
}

/** La cible (tz) d'un joueur passe au registre : rendue telle quelle si son couloir a de la place, déplacée sinon. */
export function placerCouloir(st, cfg, p, tz, { atk, pitch, ballZ, devant, remplir = true }) {
  const C = cfg.couloirs, R = ouvrirRegistre(st, atk, pitch, null), hz = pitch.hz, W = hz * 2 / 5, max = C.max ?? 2;
  const c0 = couloirDe(tz, hz); const compte = (c) => { R.n[c]++; if (devant) R.av[c]++; };
  if (p._coul && p._coul.until > st.t) {   // l'hystérésis : la réaffectation tient
    if (R.n[p._coul.c] < max) { compte(p._coul.c); return Math.max(-hz + 1.5, Math.min(hz - 1.5, -hz + (p._coul.c + 0.5) * W + p._coul.off)); }
    p._coul = null;
  }
  const cb = couloirDe(ballZ ?? 0, hz);
  // REMPLIR (C.remplir) : un DEMI-ESPACE voisin resté VIDE l'image d'avant attire le second corps d'un couloir déjà occupé — le relais dans chaque demi-espace (précepte 1.4 : ≥ 80 % du temps de possession ; mesuré 33 % sans). Le registre dort pendant la fenêtre d'engagement (match-sim, couloirs.engagement) : REMPLIR arrachait le soutien du coup d'envoi à 13 m (délai prise → passe 1,0 → 5,7 s)
  if (remplir && C.remplir !== false && R.n[c0] >= 1) for (const c of [c0 - 1, c0 + 1]) if ((c === 1 || c === 3) && R.prev[c] === 0 && R.n[c] === 0) { const off = Math.max(-W * 0.4, Math.min(W * 0.4, tz - (-hz + (c0 + 0.5) * W))); compte(c); p._coul = { c, off, until: st.t + (C.tenue ?? 2) }; return Math.max(-hz + 1.5, Math.min(hz - 1.5, -hz + (c + 0.5) * W + off)); }
  if (R.n[c0] < max) { compte(c0); return tz; }
  let best = -1, bd = 99;
  for (let c = 0; c < 5; c++) {
    if (R.n[c] >= max) continue;
    const d = Math.abs(c - c0) + (Math.abs(c - cb) > Math.abs(c0 - cb) ? 0.1 : 0) - ((c === 1 || c === 3) && R.n[c] === 0 ? (C.demi ?? 0.6) : 0);   // à égalité, le CÔTÉ DU BALLON (Guardiola surcharge un côté et isole l'autre — contre le ballon, le passeur changeait de côté et la fixation du 98 ne montait jamais : 0 bascule) ; un DEMI-ESPACE VIDE attire (demi)
    if (d < bd) { bd = d; best = c; }
  }
  if (best < 0) { compte(c0); return tz; }   // tout est plein : la cible reste (le monde le dira)
  const off = Math.max(-W * 0.4, Math.min(W * 0.4, tz - (-hz + (c0 + 0.5) * W)));   // la position relative dans le couloir
  compte(best); p._coul = { c: best, off, until: st.t + (C.tenue ?? 2) };
  return Math.max(-hz + 1.5, Math.min(hz - 1.5, -hz + (best + 0.5) * W + off));
}

/** L'OMBRE (241b, cfg.offre) : un défenseur entre le porteur et le point, à moins de cone degrés de la ligne — le point est
 *  dans son cône d'ombre (la passe se lit, s'intercepte) ; le soutien s'en décale (seMontrer, match-sim). */
export function dansOmbre(cx, cz, wx, wz, foes, coneDeg) {
  const dx = wx - cx, dz = wz - cz, L = Math.hypot(dx, dz) || 1, a0 = Math.atan2(dz, dx), cone = coneDeg * Math.PI / 180;
  for (const f of foes) {
    const rx = f.p[0] - cx, rz = f.p[2] - cz, d = Math.hypot(rx, rz);
    if (d < 1 || d >= L) continue;
    let a = Math.atan2(rz, rx) - a0; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
    if (Math.abs(a) < cone) return true;
  }
  return false;
}

/** LES LIGNES (241, C.ligne — « pas plus de trois sur la même ligne horizontale ») : bandes de bande m sur l'axe d'attaque ; une cible
 *  qui tombe dans une bande pleine (≥ ligne) recule d'une bande vers le ballon (l'échelonnement : le soutien derrière, pas à côté)
 *  ou avance si la bande arrière est pleine aussi — bornée par la ligne de hors-jeu (offAdv, côté attaque). Hystérésis tenue s. */
export function placerLigne(st, cfg, p, tx, { atk, pitch, offAdv }) {
  const C = cfg.couloirs, max = C.ligne ?? 3; if (!max) return tx;
  const R = ouvrirRegistre(st, atk, pitch, null), sg = -pitch.ownGoal(atk).sign, B = C.bande ?? 8, k0 = Math.floor(tx * sg / B);
  const n = (k) => R.lig.get(k) ?? 0, prend = (k) => { R.lig.set(k, n(k) + 1); };
  if (p._lig && p._lig.until > st.t) { if (n(p._lig.k) < max) { prend(p._lig.k); return sg * ((p._lig.k + 0.5) * B + p._lig.off); } p._lig = null; }
  if (n(k0) < max) { prend(k0); return tx; }
  const off = Math.max(-B * 0.4, Math.min(B * 0.4, tx * sg - (k0 + 0.5) * B));
  for (const k of [k0 - 1, k0 + 1, k0 - 2]) {
    if (n(k) >= max) continue;
    const x = (k + 0.5) * B + off; if (offAdv != null && x > offAdv - 0.8) continue; if (Math.abs(x) > pitch.hx - 1.5) continue;
    prend(k); p._lig = { k, off, until: st.t + (C.tenue ?? 2) }; return sg * x;
  }
  prend(k0); return tx;
}
