// L'AFFECTATION HOMME PAR HOMME (225, cfg.marquageSurface — déporté de match-sim, volumétrie). Audit aval,
// constat 3 : « un attaquant sur dix seul dans la surface ». Sondé : 59 % des attaquants dans la surface à
// > 3 m du premier défenseur avec 8 marqueurs actifs — le tri PERSONNEL de chaque marqueur (le (i−2)-ième
// attaquant le plus proche DE LUI) mettait deux marqueurs sur le même homme et laissait un orphelin.
// Une affectation, une fois par image : le DANGER d'abord (l'attaquant le plus près de mon but), pour
// chacun le marqueur libre le plus proche × (2 − markF) — le bon marqueur « est plus près » ; chaque
// homme une fois, chaque marqueur une fois. Absente : le tri d'hier au bit. Mesuré : libres 59 → 34 %,
// distance au premier défenseur p50 3,5 → 2,2 m (réel 1-2).
import { hyp } from './hyp.js';

export function affecterMarquage(st, byDist, marks, defGoal, d2) {
  if (st._bAssignT === st.t) return;
  st._bAssignT = st.t; const A = st._bAssign ??= new Map(); A.clear();
  const markers = byDist.slice(2, 2 + Math.max(0, marks.length)).filter((q) => !q.keeper);
  const danger = [...marks].sort((x, y) => hyp(x.p[0] - defGoal.x, x.p[2]) - hyp(y.p[0] - defGoal.x, y.p[2]));
  const pris = new Set();
  for (const a of danger) {
    let best = null, bc = Infinity;
    for (const q of markers) { if (pris.has(q.id)) continue; const c = d2(a.p, q.p) * (2 - (q.skill?.markF ?? 1)); if (c < bc) { bc = c; best = q; } }
    if (best) { pris.add(best.id); A.set(best.id, a); }
  }
}

// LA LIGNE SE REFERME (228, cfg.referme — la bibliothèque : « un qui sort de la ligne, trois qui couvrent »,
// Gourcuff ; sondé : quand un défenseur de ligne sort presser (20 % des instants), l'écart maximal entre ses voisins
// monte à 13,6 m p50 et 24,5 p90 — la ligne d'hier ne bougeait pas). Le spot VACANT du sorti attire ses voisins de
// ligne : le plus proche glisse part du trou, le suivant second ; × posF (le placement est une note) × axe
// tactique marquage (zone 1,2 → homme 0,6 : la zone couvre l'espace, l'homme reste sur le sien). Les spots du bloc
// sont mutés pour l'image (ils se recalculent à chaque image). Absente : le trou d'hier au bit.
export function refermerLigne(st, spotsBloc, mapD, nDefD, presseur, defenders, cfg, tacDef, axe) {
  const R = cfg.referme; if (st._bRefermeDz) st._bRefermeDz.clear(); if (!R || !spotsBloc || !presseur) return;
  const pp = mapD[presseur.post ?? 99] ?? 99; if (pp >= nDefD) return;   // seul un défenseur de LIGNE laisse un trou
  const vac = spotsBloc[pp]; if (!vac) return;
  const ligne = [];
  for (const q of defenders) { const k = mapD[q.post ?? 99] ?? 99; if (k < nDefD && q.id !== presseur.id && spotsBloc[k]) ligne.push({ k, q, z: spotsBloc[k][1] }); }
  ligne.sort((a, b) => Math.abs(a.z - vac[1]) - Math.abs(b.z - vac[1]));
  const tacF = axe(tacDef.marquage ?? 0.5, 1.2, 0.6);
  // le décalage par poste vit dans st._bRefermeDz — les spots du bloc ne sont PAS mutés (les muter changeait la
  // HAUTEUR de la ligne par un consommateur invisible : hauteurBloc 0 → 35 m au lieu de 13 — mesuré) ; seuls les
  // postés de la ligne l'appliquent (match-sim, spot wM)
  const dz = st._bRefermeDz ??= new Map(); dz.clear();
  ligne.slice(0, 2).forEach((e, i) => {
    const part = (i === 0 ? (R.part ?? 0.5) : (R.second ?? 0.25)) * (e.q.skill?.posF ?? 1) * tacF;
    dz.set(e.k, (vac[1] - e.z) * Math.min(0.9, part));
  });
}
