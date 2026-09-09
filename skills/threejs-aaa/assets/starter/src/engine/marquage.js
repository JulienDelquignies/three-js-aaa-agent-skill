// L'AFFECTATION HOMME PAR HOMME (225, cfg.marquageSurface — déporté de match-sim, volumétrie). Audit aval,
// constat 3 : « un attaquant sur dix seul dans la surface ». Sondé : 59 % des attaquants dans la surface à
// > 3 m du premier défenseur avec 8 marqueurs actifs — le tri PERSONNEL de chaque marqueur (le (i−2)-ième
// attaquant le plus proche DE LUI) mettait deux marqueurs sur le même homme et laissait un orphelin.
// Une affectation, une fois par image : le DANGER d'abord (l'attaquant le plus près de mon but), pour
// chacun le marqueur libre le plus proche × (2 − markF) — le bon marqueur « est plus près » ; chaque
// homme une fois, chaque marqueur une fois. Absente : le tri d'hier au bit. Mesuré : libres 59 → 34 %,
// distance au premier défenseur p50 3,5 → 2,2 m (réel 1-2).
import { hyp } from './hyp.js';

// …ET L'AFFECTATION SE TIENT (238, cfg.marquageTenue — mesuré : une affectation vivait 0,27 s p50, le marqueur était
// pris parmi les proches du BALLON à 11,6 m de son homme et n'arrivait jamais, corps à 4,4 m de l'homme pour une cible
// à 0,64) : le marqueur d'hier garde son homme tant que l'homme est marqué et que nul marqueur libre n'est nettement
// plus près (coût < gain × le sien, 0,8 — à 0,6 le marqueur hors peloton privait le bloc de sa couverture : 53 tirs/90,
// tirs libres en surface × 3) ; il reste éligible même sorti du peloton du ballon (jamais les deux presseurs ;
// T.horsPeloton false : au peloton seulement, marque 2,8 m). Absente : le tirage d'hier au bit.
export function affecterMarquage(st, byDist, marks, defGoal, d2, cfg = null) {
  if (st._bAssignT === st.t) return;
  st._bAssignT = st.t; const A = st._bAssign ??= new Map();
  const T = cfg && st.full ? cfg.marquageTenue : null, prev = T ? new Map(A) : null; A.clear();
  const markers = byDist.slice(2, 2 + Math.max(0, marks.length)).filter((q) => !q.keeper);
  if (prev && T.horsPeloton !== false) { const deux = new Set(byDist.slice(0, 2).map((q) => q.id)); for (const q of byDist) if (prev.has(q.id) && !deux.has(q.id) && !q.keeper && q.down <= 0 && !markers.includes(q)) markers.push(q); }
  const danger = [...marks].sort((x, y) => hyp(x.p[0] - defGoal.x, x.p[2]) - hyp(y.p[0] - defGoal.x, y.p[2]));
  const pris = new Set();
  for (const a of danger) {
    let best = null, bc = Infinity, tenu = null, tc = Infinity;
    for (const q of markers) { if (pris.has(q.id)) continue; const c = d2(a.p, q.p) * (2 - (q.skill?.markF ?? 1)); if (c < bc) { bc = c; best = q; } if (prev && prev.get(q.id)?.id === a.id) { tenu = q; tc = c; } }
    if (tenu && bc >= (T.gain ?? 0.6) * tc) best = tenu;
    if (best) { pris.add(best.id); A.set(best.id, a); }
  }
}

// LA LIGNE SE REFERME (228, cfg.referme — la bibliothèque : « un qui sort de la ligne, trois qui couvrent »,
// Gourcuff ; sondé : quand un défenseur de ligne sort presser (20 % des instants), l'écart maximal entre ses voisins
// monte à 13,6 m p50 et 24,5 p90 — la ligne d'hier ne bougeait pas). Le spot VACANT du sorti attire ses voisins de
// ligne : le plus proche glisse part du trou, le suivant second ; × posF (le placement est une note) × axe
// tactique marquage (zone 1,2 → homme 0,6 : la zone couvre l'espace, l'homme reste sur le sien). Les spots du bloc
// sont mutés pour l'image (ils se recalculent à chaque image). Absente : le trou d'hier au bit.
export function refermerLigne(st, spotsBloc, mapD, nDefD, presseur, defenders, cfg, tacDef, axe, sgnAtk = 0) {
  const R = cfg.referme; if (st._bRefermeDz) st._bRefermeDz.clear(); if (st._bRefermeDx) st._bRefermeDx.clear(); if (!R || !spotsBloc || !presseur) return;
  const pp = mapD[presseur.post ?? 99] ?? 99; if (pp >= nDefD) return;   // seul un défenseur de LIGNE laisse un trou
  const vac = spotsBloc[pp]; if (!vac) return;
  const ligne = [];
  for (const q of defenders) { const k = mapD[q.post ?? 99] ?? 99; if (k < nDefD && q.id !== presseur.id && spotsBloc[k]) ligne.push({ k, q, z: spotsBloc[k][1] }); }
  ligne.sort((a, b) => Math.abs(a.z - vac[1]) - Math.abs(b.z - vac[1]));
  const tacF = axe(tacDef.marquage ?? 0.5, 1.4, 0.6);   // (237) bornes 1,4/0,6 : l’identité EXACTE au milieu (1,2/0,6 donnait × 0,9 à 0,5 — un axe absent doit valoir 1)
  // le décalage par poste vit dans st._bRefermeDz — les spots du bloc ne sont PAS mutés (les muter changeait la
  // HAUTEUR de la ligne par un consommateur invisible : hauteurBloc 0 → 35 m au lieu de 13 — mesuré) ; seuls les
  // postés de la ligne l'appliquent (match-sim, spot wM)
  const dz = st._bRefermeDz ??= new Map(); dz.clear();
  // L'OBLIQUE 1+3 (237, R.recul / R.reculSecond — Sacchi, Gourcuff : « une ligne de quatre ne monte jamais de front » ; le
  // sortant cadre, les trois reculent en diagonale pour couvrir son dos) : le voisin recule de recul m, le second de
  // reculSecond, × posF × axe marquage, vers SON but (sgnAtk : vers le but défendu) — st._bRefermeDx, même patron. Mesuré
  // (référence le troisième, 6 × 300 s) : recul du voisin 2,50 → 2,65 m, du second 2,22 → 2,51. Clés absentes : 0, l’hier au bit.
  const dx = st._bRefermeDx ??= new Map(); dx.clear();
  // LA VRAIE SORTIE (245, R.sortie / R.zone — le rouge hérité de la gradation 152/158, bissecté jusqu'au 237) : l'oblique se
  // déclenchait dès qu'un défenseur de ligne était LE PLUS PROCHE du ballon — à 40 m du but 89 % du temps chez l'équipe
  // notée 90 (qui presse haut), et sans sortie réelle (le « sortant » derrière ou au niveau de la ligne) un tiers du temps.
  // Chaque pression en milieu de terrain reculait la ligne de 1,5 m : la domination du fort s'effaçait (composite 90 :
  // 504 sans la loi → 94 avec). L'oblique de Sacchi couvre le DOS d'un sortant quand le dos est le but : le sortant doit
  // être DEVANT la ligne de sortie m, et le ballon à moins de zone m du but défendu. Clés absentes : le 237 au bit.
  let sortieOk = true, glisseOk = true;
  if (sgnAtk && (R.sortie != null || R.zone != null)) {
    const prof = (q) => q.p[0] * sgnAtk;   // grand = près du but défendu
    const lig = Math.min(...ligne.map((e) => prof(e.q)));
    if (R.sortie != null && !(lig - prof(presseur) >= R.sortie)) { sortieOk = false; if (R.glisseSortie) glisseOk = false; }   // glisseSortie : la glissade latérale (228) exige aussi la vraie sortie
    if (sortieOk && R.zone != null) { const g = st.pitch?.ownGoal?.(presseur.team); if (g && Math.hypot(st.ball.p[0] - g.x, st.ball.p[2]) > R.zone) sortieOk = false; }
  }
  ligne.slice(0, 2).forEach((e, i) => {
    const posF = Math.pow(e.q.skill?.posF ?? 1, R.note ?? 1), part = (i === 0 ? (R.part ?? 0.5) : (R.second ?? 0.25)) * posF * tacF;   // (246) R.note : l'exposant de la note de placement sur l'AMPLITUDE du glissement et du recul — mesuré à 12 graines, × posF INVERSAIT le levier (placement 90 : possession 47,5 c. 52,1 à 10) : le bon placeur ne recule pas PLUS, il se recale plus serré (zoneMorte). 0 = la note ne touche pas l'amplitude ; absent : l'hier
    if (glisseOk) dz.set(e.k, (vac[1] - e.z) * Math.min(0.9, part));
    const rec = sortieOk ? (i === 0 ? (R.recul ?? 0) : (R.reculSecond ?? 0)) * posF * tacF : 0;
    if (rec && sgnAtk) dx.set(e.k, rec * sgnAtk);
  });
}

/** LA PASSATION DU MARQUEUR (252, cfg.passation — interface gelée §3 ; débat du document : le central SUIT le 9 qui
 *  décroche, ou le REMET au 6). Sondé (6 × 300 s) : la pointe décroche à plus de 6 m sous la ligne des D 77 % des
 *  images ; alors personne à moins de 5 m d'elle 67 % du temps, le central jamais (la bande du 96 l'arrête), le pivot
 *  5 %. La loi : le central suit jusqu'à suit m sous sa ligne — LA TACTIQUE dit jusqu'où (axe marquage : zone 0,6 ×,
 *  homme 1,4 ×), LE RÔLE nuance (marqueSerre 0,8-1,2 ×) — puis REMET au pivot de sa formation (pivotDe) s'il est
 *  disponible (ni presseur ni couverture) : le pivot marque l'homme tant qu'il vit entre les lignes (à moins de zone m
 *  sous la bande), le rend au central quand il remonte à remet m de la bande (cause 'homme'), le lâche s'il s'enfonce
 *  au-delà (cause 'zone'). Un événement 'passation' { de, a, cause } par changement de main. Absente : hier au bit.
 *  Rend la bande (m) que le central ne dépasse pas. */
export function bandeDuCentral(cfg, tacDef, role, axe, p) {
  const PA = cfg.passation; if (!PA) return 6;
  return (PA.suit ?? 8) * axe(tacDef?.marquage ?? 0.5, 0.6, 1.4) * ((role(p).marqueSerre ?? 0.5) !== 0.5 ? axe(role(p).marqueSerre, 0.8, 1.2) : 1);
}
export function remettreAuPivot(st, cfg, p, m, pivot, sL, sgnDef, bande) {
  const PA = cfg.passation; if (!PA || !pivot || pivot.id === p.id || pivot._libre === false) return;   // le pivot qui presse ou couvre (byDist 0/1) ne prend pas — mesuré sans : le pivot était presseur ou couverture 36 % des images de remise
  const H = st._passation ??= {}; const prof = sL - m.p[0] * sgnDef;   // la profondeur de l'homme sous la ligne du central
  if (prof <= bande) return;
  const cur = H[m.id];
  if ((!cur || cur.a !== pivot.id) && (Math.hypot(m.p[0] - pivot.p[0], m.p[2] - pivot.p[2]) > (PA.portee ?? 10) || prof - (sL - pivot.p[0] * sgnDef) > (PA.zone ?? 6))) return;   // …et ENTRE LES LIGNES : pas plus de zone m sous le pivot (sinon c'est un homme du milieu, le bloc)   // le pivot ne prend que ce qu'il peut atteindre — sinon la bande tient et personne ne suit (le bloc), comme hier ; mesuré sans : l'homme à 23 m sous la ligne, le pivot à 17 m de lui, 4 remises par seconde rendues aussitôt
  if (!cur || cur.a !== pivot.id) { H[m.id] = { de: p.id, a: pivot.id, until: st.t + 0.6, sL, sgnDef, bande }; st.events.push({ t: +st.t.toFixed(2), type: 'passation', de: p.id, a: pivot.id, cause: 'decrochage' }); }
  else { cur.until = st.t + 0.6; cur.de = p.id; cur.sL = sL; cur.bande = bande; }
}
/** Le pivot a-t-il un homme remis à marquer ? Rend l'homme, ou null — et clôt la passation (rendu / lâché) en nommant la cause.
 *  La ligne et la bande sont CELLES DU CENTRAL au moment de la remise (mémorisées : deux lectures de la ligne flappaient à 4 Hz). */
export function hommeRemis(st, cfg, pivot) {
  const PA = cfg.passation, H = st._passation; if (!PA || !H) return null;
  for (const [id, h] of Object.entries(H)) {
    if (h.a !== pivot.id) continue;
    const m = st.players[+id]; const prof = m ? h.sL - m.p[0] * h.sgnDef : -99;
    if (!m || m.down > 0 || h.until < st.t || prof < h.bande - (PA.remet ?? 2.5)) { delete H[id]; if (m) st.events.push({ t: +st.t.toFixed(2), type: 'passation', de: pivot.id, a: h.de, cause: 'homme' }); continue; }
    if (prof - (h.sL - pivot.p[0] * h.sgnDef) > (PA.zone ?? 6) || Math.hypot(m.p[0] - pivot.p[0], m.p[2] - pivot.p[2]) > (PA.portee ?? 10) + 4) { delete H[id]; st.events.push({ t: +st.t.toFixed(2), type: 'passation', de: pivot.id, a: -1, cause: 'zone' }); continue; }   // zone : l'homme s'enfonce à plus de zone m SOUS LE PIVOT lui-même (la ligne-spot des D vit 24 m au-dessus du pivot : une zone lue depuis elle lâchait tout)
    return m;
  }
  return null;
}
/** La purge : une remise ne survit ni à la perte du ballon par l'attaque ni à un arrêt de jeu (mesuré : 3 images de remise sur 4 vivaient en soutien ou en marche de cérémonie). */
export function purgerPassation(st, atk) {
  const H = st._passation; if (!H) return;
  for (const [id, h] of Object.entries(H)) { const m = st.players[+id]; if (!m || m.team !== atk || st.restart) delete H[id]; }
}
