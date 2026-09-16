// petits-gestes.js — LES PETITS GESTES DU MATCH (Animations_A_Faire § 10 ; cfg.petitsGestes ; note 384). Cinq gestes que le match
// montrait sans les jouer, chacun un déclencheur sim sous SA sous-clé et un événement nommé `geste` que la scène joue (_playTech) :
//   semelle        la sortie de but : le preneur arrivé au ballon y pose la SEMELLE (arretSemelle) et la remise attend `tenue` s ;
//   mur            le coup franc adverse : le gardien REPLACE SON MUR — le bras qui désigne (designer), le regard tenu vers le mur ;
//   teteDefensive  la tête armée d'un défenseur près de son but s'arme en `teteDefensive` (le dégagement : le buste cambré davantage) ;
//   controleOriente (scène seule) le premier contact qui emmène le ballon dans la course : yawWant ≠ yaw de plus de `angle` ° ;
//   feinteAppel    l'appel d'un soutien posé : un crochet du buste avant le départ (feinteAppel, haut du corps seul), une fois par `cadence` s.
// Clé absente : l'hier au bit (aucun événement, aucune attente, aucun regard).
import { hyp } from './hyp.js'; import { tirage } from './rng.js';

/** La sortie de but attend la semelle du preneur : vrai tant que la remise doit attendre (canTake). */
export function semelleAvant(st, p, cfg) {
  const r = st.restart, S = cfg.petitsGestes?.semelle;
  if (!S || !st.full || !r || r.type !== 'sortie-de-but') return false;
  if (r._semelle == null) {
    if (hyp(p.v[0], p.v[1]) > (S.vMax ?? 0.8)) return true;                  // il finit d'arriver : la semelle se pose à l'arrêt
    r._semelle = st.t; st.events.push({ t: +st.t.toFixed(2), type: 'geste', by: p.id, move: 'arretSemelle', remise: r.type });
    return true;
  }
  return st.t < r._semelle + (S.tenue ?? 0.7);
}

/** Le gardien replace son mur (coup franc adverse, le mur élu par match-sim r._mur) ; le regard tenu se relâche à l'heure ou à la reprise. */
export function petitsGestesStep(st, dt, cfg) {
  const G = st.full ? cfg.petitsGestes : null, r = st.restart;
  if (G?.mur && r?.type === 'coup-franc' && r._mur?.length && !r._murGeste) {
    r._murT0 ??= st.t;
    if (st.t >= r._murT0 + (G.mur.delai ?? 0.6)) {
      r._murGeste = st.t;
      const gk = st.players.find((q) => q.keeper && q.team !== r.team && !q._sub && q.down <= 0);
      if (gk) {
        const og = st.pitch.ownGoal(gk.team), mur = cfg.loi12?.mur ?? 9.15, gx = og.x - r.p[0], gz = -r.p[1], gl = hyp(gx, gz) || 1;
        const mx = r.p[0] + (gx / gl) * mur, mz = r.p[1] + (gz / gl) * mur;
        gk._regard = Math.atan2(mz - gk.p[2], mx - gk.p[0]); st._murRegard = { id: gk.id, until: st.t + (G.mur.duree ?? 1.6) };
        st.events.push({ t: +st.t.toFixed(2), type: 'geste', by: gk.id, move: 'designer', foot: mz > 0 ? 'left' : 'right', mur: [+mx.toFixed(1), +mz.toFixed(1)] });
      }
    }
  }
  if (st._murRegard && (st.t > st._murRegard.until || !st.restart)) { const gk = st.players[st._murRegard.id]; if (gk && gk._regard != null) gk._regard = null; st._murRegard = null; }
  // (notes 387, 389) L'APPLAUDISSEMENT D'ENCOURAGEMENT, occasionnel et SANS CHORÉGRAPHIE : sur une occasion (l'arrêt du gardien, le tir
  // manqué d'un coéquipier, le duel ou le glissé gagné), une probabilité par occasion ; un ou deux coéquipiers libres et posés à rayon
  // m (l'interception, le tacle et la récupération comptent aussi : turnover.why), TIRÉS AU SORT (pas les plus proches), partent DÉCALÉS de decal s chacun ; une salve par équipe par cadence s, un même corps pas
  // deux fois en cadenceJoueur s. Le tirage est seedé (rng 'geste'). Clé absente : rien.
  const i0 = st._pgIdx ?? st.events.length; st._pgIdx = st.events.length;
  const A = G?.applaudir; const rnd = (id) => tirage(st, 'geste', id, st.rnd ?? (() => 0.5))();
  if (A) for (let i = i0; i < st.events.length; i++) {
    const e = st.events[i];
    const occasion = e.type === 'arrêt' ? 'arret' : e.type === 'shot' && !e.but ? 'tir' : (e.type === 'duel' && e.won && e.kind !== 'aérien') ? 'duel' : (e.type === 'slide' && e.won) ? 'glisse' : e.type === 'turnover' && e.why === 'interception' ? 'interception' : e.type === 'turnover' && e.why === 'tackle' ? 'tacle' : e.type === 'turnover' && e.why === 'récupération' ? 'recuperation' : null;   // les occasions : l'arrêt, le tir, le duel et le glissé gagnés, la récupération (turnover.why)
    if (!occasion) continue;
    const acteur = st.players[e.by]; if (!acteur) continue; const team = acteur.team;
    if (st.t < ((st._applaudiAt ??= {})[team] ?? -99) + (A.cadence ?? 10)) continue;
    if (rnd(acteur.id) >= (A.p?.[occasion] ?? 0.3)) continue;
    const cands = st.players.filter((q) => q.team === team && q.id !== acteur.id && q.down <= 0 && !q.act && !q._sub && (q.speed ?? 0) <= (A.vMax ?? 2.5) && hyp(q.p[0] - acteur.p[0], q.p[2] - acteur.p[2]) <= (A.rayon ?? 18) && st.t >= (q._applaudiAt ?? -99) + (A.cadenceJoueur ?? 20));
    if (!cands.length) continue;
    const n = Math.min(cands.length, rnd(acteur.id + 1) < 0.6 ? 1 : (A.n ?? 2));
    st._applaudiAt[team] = st.t; const [d0, d1] = A.decal ?? [0.15, 0.8];
    let at = st.t + d0 + rnd(acteur.id + 9) * (d1 - d0);
    for (let k = 0; k < n; k++) { const q = cands.splice(Math.floor(rnd(acteur.id + 2 + k) * cands.length), 1)[0]; q._applaudiAt = st.t; (st._applausPend ??= []).push({ id: q.id, at, pour: acteur.id, occasion }); at += 0.25 + rnd(q.id) * 0.35; }   // le second part au moins 0,25 s après le premier : deux corps, deux départs
  }
  if (st._applausPend?.length) st._applausPend = st._applausPend.filter((w) => { if (st.t < w.at) return true; const q = st.players[w.id]; if (q && q.down <= 0 && !q.act) st.events.push({ t: +st.t.toFixed(2), type: 'geste', by: q.id, move: 'applaudir', pour: w.pour, occasion: w.occasion }); return false; });
}

/** La tête armée d'un défenseur près de son but (< 24 m, hors la tête au but) s'arme en dégagement : le geste par mode (teteStep décide de même). */
export function modeTeteDefensive(st, q, at, cfg) {
  if (!st.full || !cfg.petitsGestes?.teteDefensive) return false;
  const goal = st.pitch.attackGoal(q.team), own = st.pitch.ownGoal(q.team), sgn = Math.sign(goal.x || 1);
  if (hyp(goal.x - at[0], at[2]) < (cfg.tete?.but ?? 12) && st.pitch.inBox(at[0], at[2], sgn)) return false;
  return hyp(own.x - at[0], at[2]) < 24;
}

/** La feinte d'appel : au départ d'un appel, un soutien posé vend un crochet du buste — une fois par `cadence` s. */
export function feinteAppelAt(st, p, cfg) {
  const F = st.full ? cfg.petitsGestes?.feinteAppel : null;
  if (!F || (p.speed ?? 0) > (F.vMax ?? 1.5) || st.t < (p._feinteAt ?? -99) + (F.cadence ?? 20)) return;
  p._feinteAt = st.t;
  st.events.push({ t: +st.t.toFixed(2), type: 'geste', by: p.id, move: 'feinteAppel', foot: (p.id + Math.floor(st.t)) % 2 ? 'left' : 'right' });
}
