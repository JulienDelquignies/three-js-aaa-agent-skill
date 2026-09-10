// LE PIÈGE DU HORS-JEU, LA LIGNE SYNCHRONE (255, cfg.piege && st.full — la carte du book, Bible 03 T3/T3b, Bible 10
// §10.2 : « un facteur ≈ 3 entre le réglage bas (1,5-2,5 hors-jeu provoqués) et le réglage extrême (4,8) … par le seul
// déplacement de ses paramètres » ; le T3b : ce n'est pas la HAUTEUR qui provoque le hors-jeu, c'est la SYNCHRONIE —
// le Real 2024-25 joue plus haut que le Barça et provoque 46 hors-jeu de moins). L'axe tactique `piege` n'était qu'un
// décalage de +3 m sur la ligne postée (149), dilué par les lois de couverture. Ici il devient une DÉCISION de ligne :
// quand le porteur ADVERSE arme une passe (le geste en anticipation), à ≤ portee m du but défendu, la ligne arrière —
// les corps de champ à ≤ bande m de la ligne de hors-jeu — MONTE ENSEMBLE (le même `until` pour tous : la synchronie)
// de pas × axe(piege, 0, 1) m pendant duree s ; la photo de la Loi 11 au départ du ballon fait le reste (259). Un
// tirage par armé (P = p × axe(piege, 0, 1)), au flux seedé. Le prix est dans le même mécanisme : la ligne qui monte
// laisse l'espace derrière elle — la passe qui bat le piège vaut une course seule. null : la ligne d'hier au bit.
import { axe as axeTac, tac as tacDe } from './tactics.js';
import { etaDe, sigmaSync } from './familiarite.js';
import { gauss } from './attributes.js';

export function piegeStep(st, cfg) {
  const K = st.full ? cfg.piege : null;
  if (!K) return;
  const c = st.possession.carrier >= 0 && st.phase === 'carry' ? st.players[st.possession.carrier] : null;
  if (!c || c.keeper || !c.act || c.act.payload?.kind !== 'pass' || c.act.phase !== 'anticipation') return;
  const T = 1 - c.team;
  if ((st._piegeArme ??= {})[T] === c.act) return;
  st._piegeArme[T] = c.act;
  const own = st.pitch.ownGoal(T), sgn = -own.sign;   // sgn : vers le but ADVERSE de T (la ligne de T recule vers own)
  const dBut = Math.abs(c.p[0] - own.x);
  if (dBut > (K.portee ?? 45) || dBut < (K.min ?? 14)) return;
  const agress = axeTac(tacDe(st, T).piege, 0, 1);
  if (agress <= 0) return;
  const rnd = st.rnd2 ?? st.rnd ?? (() => 0.5);
  if (rnd() >= (K.p ?? 0.8) * agress) return;
  // la ligne de T : l'avant-dernier corps de T vers son but (le gardien compris, comme la Loi 11)
  let last = Infinity, second = Infinity;
  for (const q of st.players) { if (q.team !== T || q.expulse) continue; const v = (q.p[0] - own.x) * (-own.sign || 1); if (v < last) { second = last; last = v; } else if (v < second) second = v; }
  const until = st.t + (K.duree ?? 0.6), pas = (K.pas ?? 2.5) * agress;
  const F = st.full && cfg.familiarite ? cfg.familiarite : null, sig = F ? sigmaSync(etaDe(st, T, cfg), F) : 0;   // (254) LA SYNCHRONIE EST UNE FAMILIARITÉ : chaque corps part avec son retard |gauss| × σ_sync — la ligne brisée devient un événement statistique
  let n = 0, desync = 0;
  for (const q of st.players) {
    if (q.team !== T || q.keeper || q.down > 0 || q.expulse) continue;
    const v = (q.p[0] - own.x) * (-own.sign || 1);
    if (v - second > (K.bande ?? 4)) continue;
    const delai = sig > 0 ? Math.abs(gauss(rnd)) * sig : 0; desync = Math.max(desync, delai);
    q._piege = { at: st.t + delai, until: until + delai, pas }; n++;
  }
  if (n) st.events.push({ t: +st.t.toFixed(2), type: 'piege', team: T, n, pas: +pas.toFixed(2), sur: c.id, ...(sig > 0 ? { sigma: +sig.toFixed(2), desync: +desync.toFixed(2) } : {}) });
}

/** Le décalage de ligne d'un corps (m, vers le but adverse) — lu par le bloc posté de match-sim. */
export function piegeOffset(st, p) {
  const P = p._piege;
  return P && P.until > st.t ? P.pas : 0;
}

/** APRÈS l'attribution des cibles, AVANT le mouvement (match-sim, fin d'assignJobs) : la ligne marquée avance sa cible
 *  ENSEMBLE — le même pas pour chaque corps de la bande, vers le but adverse ; c'est ici que la synchronie s'exécute. */
export function piegeApply(st, cfg) {
  if (!st.full || !cfg.piege) return;
  for (const q of st.players) {
    const P = q._piege; if (!P || P.until <= st.t || (P.at ?? 0) > st.t || !q.target) continue;   // (254) pas avant SON départ
    const sgn = -st.pitch.ownGoal(q.team).sign;
    if (q.job === 'press' || q.job === 'gkBall') continue;   // le presseur va au ballon : il n'est pas de la ligne
    q.target = [Math.max(-st.pitch.hx + 1.2, Math.min(st.pitch.hx - 1.2, q.p[0] + sgn * P.pas)), q.target[1] ?? 0, q.target[2]];   // depuis la position COURANTE (le slot posté est plus profond que la ligne vécue : un pas relatif au slot s'annulait)
  }
}
