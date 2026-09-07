// scan.js — L'HORLOGE DE SCAN (250, Campagne V — interface gelée docs/Interface_Campagne_V.md §1, lue par gaze.js au A12a).
// Jordet : le receveur qui regarde autour de lui PENDANT LE VOL de la passe (0,4-0,6 scan/s chez les pros) reçoit
// mieux ; jamais de saccade pendant la frappe du passeur ni pendant la prise. L'horloge vit dans la SIM, jamais dans
// le rendu : déterministe par acteur (LCG seedé par p.id, aucun st.rnd consommé — l'empreinte au bit), et c'est un
// TEMPS (leçon 246) : la note scanning (skill.scanF) multiplie la CADENCE en vol, donc QUAND le premier regard tombe
// — et le corps ne s'ouvre qu'après avoir regardé (movement.corpsOuvert sous cfg.scan.corps). Absente : hier au bit.
// Le patron Unity/Unreal : la loi ici, les nombres dans cfg.scan, la note dans l'attribut, la posture dans le rôle.
const lerp = (a, b, u) => a + (b - a) * u;
export function scanStep(st, p, cfg) {
  const K = st.full ? cfg.scan : null; if (!K) return;
  const S = p.scan ??= { at: -1, until: -1, vers: 'ballon', cible: null, n: 0, vol: false, _next: 0, _lcg: ((p.id + 1) * 2654435761 + 12345) >>> 0 };
  const rnd = () => { S._lcg = (S._lcg * 1664525 + 1013904223) >>> 0; return S._lcg / 4294967296; };
  const vol = st.phase === 'flight' && st.pass?.to === p.id && p.down <= 0;
  if (vol && !S.vol) { S.n = 0; S._next = st.t + (0.25 + 0.5 * rnd()) / (p.skill?.scanF ?? 1); }   // l'adoption : le premier regard tombe à 0,25-0,75 s de vol ÷ scanF (mesuré à 0,12-0,37 : 0,84 scan/s, au-dessus de Jordet)
  if (!vol && S.vol) S.n = 0;
  S.vol = vol;
  if (S.until > st.t) return;   // la saccade en cours vit
  if (S.until === st.t || (S.until > 0 && S.until <= st.t && S.cible)) { S.cible = null; S.vers = 'ballon'; }   // retour au ballon
  // JORDET : ni pendant la frappe du passeur (la passe adoptée, pas encore en vol), ni pendant la prise (ballon à portée)
  if (st.pass?.to === p.id && st.phase !== 'flight') return;
  if (vol && Math.hypot(st.ball.p[0] - p.p[0], st.ball.p[2] - p.p[2]) < (K.prise ?? 1.5)) return;
  if (st.t < S._next || p.down > 0 || (st.restart && st.t < st.restart.at)) return;
  // la saccade : où vont les yeux — le presseur le plus proche (en vol : celui qui vient sur le point de chute), sinon l'espace côté jeu, sinon un coéquipier
  const foes = st.players.filter((q) => q.team !== p.team && q.down <= 0 && !q.keeper);
  let best = null, bd = K.presseur ?? 10;
  for (const q of foes) { const d = Math.hypot(q.p[0] - p.p[0], q.p[2] - p.p[2]); if (d < bd) { bd = d; best = q; } }
  const g = st.pitch?.attackGoal?.(p.team);
  if (best) { S.vers = 'presseur'; S.cible = [best.p[0], best.p[2]]; }
  else if (g && rnd() < 0.6) { S.vers = 'espace'; S.cible = [p.p[0] + Math.sign(g.x - p.p[0] || 1) * 8, p.p[2] * 0.7]; }
  else { const m = st.players.filter((q) => q.team === p.team && q.id !== p.id && q.down <= 0); const q = m.length ? m[Math.floor(rnd() * m.length) % m.length] : null; if (q) { S.vers = 'coequipier'; S.cible = [q.p[0], q.p[2]]; } else { S.vers = 'espace'; S.cible = [p.p[0], p.p[2] * 0.7]; } }
  const dur = K.dur ?? 0.45;
  S.at = st.t; S.until = st.t + dur; if (vol) S.n++;
  const cad = vol ? lerp(K.vol?.[0] ?? 0.4, K.vol?.[1] ?? 0.6, rnd()) * (p.skill?.scanF ?? 1) : null;
  S._next = vol ? S.until + Math.max(0.05, 1 / Math.max(0.05, cad) - dur) : S.until + lerp(K.horsBallon?.[0] ?? 1.5, K.horsBallon?.[1] ?? 4, rnd());
}
/** Le receveur a-t-il regardé pendant ce vol ? (lu par movement.corpsOuvert sous cfg.scan.corps) */
export function aScanne(p) { return (p.scan?.n ?? 0) >= 1; }
