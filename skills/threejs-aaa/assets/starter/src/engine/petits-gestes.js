// petits-gestes.js — LES PETITS GESTES DU MATCH (Animations_A_Faire § 10 ; cfg.petitsGestes ; note 384). Cinq gestes que le match
// montrait sans les jouer, chacun un déclencheur sim sous SA sous-clé et un événement nommé `geste` que la scène joue (_playTech) :
//   semelle        la sortie de but : le preneur arrivé au ballon y pose la SEMELLE (arretSemelle) et la remise attend `tenue` s ;
//   mur            le coup franc adverse : le gardien REPLACE SON MUR — le bras qui désigne (designer), le regard tenu vers le mur ;
//   teteDefensive  la tête armée d'un défenseur près de son but s'arme en `teteDefensive` (le dégagement : le buste cambré davantage) ;
//   controleOriente (scène seule) le premier contact qui emmène le ballon dans la course : yawWant ≠ yaw de plus de `angle` ° ;
//   feinteAppel    l'appel d'un soutien posé : un crochet du buste avant le départ (feinteAppel, haut du corps seul), une fois par `cadence` s.
// Clé absente : l'hier au bit (aucun événement, aucune attente, aucun regard).
import { hyp } from './hyp.js';

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
