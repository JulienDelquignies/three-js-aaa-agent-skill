// elan.js — LA COURSE D'ÉLAN DES REMISES (lot A9 bis, cfg.remisesPied.elan) et ses suites (lot A9 ter) : la sortie de but
// LONGUE prise au bout d'une course (elan.sortieBut), la touche LONGUE lancée au bout d'une course (elan.toucheLongue), et LE MUR
// QUI SAUTE au coup franc (remisesPied.mur). Sorti de referee.js (plafond de lignes) — referee.js ré-exporte.
import { hyp } from './hyp.js';
import { tirage } from './rng.js';
import { startGesture, abortGesture } from './gesture.js';
import { MOVE_TIMING } from './skills-sim.js';
import { byId } from './technique.js';
import { relancerGardien, styleSortieBut } from './keeper.js';
import { beginPass } from './strike-sim.js';
import { choosePass } from './rondo.js';   // (B2) le tir immédiat du preneur à son contact d'élan : le choix du porteur, dans l'image
const deny = (st, cause) => { (st.deny ??= {})[cause] = (st.deny[cause] ?? 0) + 1; return false; };

// ---------------------------------------------------------------- LA COURSE D'ÉLAN (lot A9 bis, cfg.remisesPied)

/**
 * LA COURSE D'ÉLAN (cfg.remisesPied.elan && st.full) : le coup franc et le corner se frappaient À L'INSTANT de la prise, du
 * point où le preneur venait de poser le ballon — aucun geste, aucune course (mesuré graine 7 : 'restart-pris' et 'corner-joué'
 * à la même image, le corps planté). Ici, le ballon posé, le preneur RECULE à son point de départ (recul m derrière le ballon
 * sur la ligne ballon-cible, lat m du côté de son pied faible — le droitier vient de la gauche, le tablier borne le départ :
 * le corner part de derrière le poteau), ATTEND face au ballon l'heure de la reprise, puis COURT (≤ vitesse m/s, movement.js
 * laisse le corps courir sous l'armé 'elan') : le geste 'frappe' s'arme sur la durée de la course et la remise se prend AU
 * CONTACT du geste, à l'arrivée au ballon (elanNow → canTake → receive → onTake : la frappe d'hier, du point d'arrivée). Un
 * preneur en retard étire son armé (le contact se rejoue à l'arrivée, jamais dans le vide) ; passé patience s sans partir,
 * ou 1,5 s de course sans arriver, la prise d'hier. Clé absente : la frappe instantanée d'hier, au bit.
 */
export function poserElan(st, r, cfg) {
  const E = st.full && cfg?.remisesPied?.elan;
  if (!E || r.elan) return;
  const tk = st.players[r.taker ?? -1]; if (!tk) return;
  if (r.type === 'sortie-de-but') {                                  // (A9 ter, elan.sortieBut) LA SORTIE DE BUT LONGUE a sa course : le gardien recule derrière le ballon
    const SB = E.sortieBut; if (!SB || styleSortieBut(st, tk, cfg) !== 'long') return;   // …quand le style (tactique ou pression, keeper.styleSortieBut) dit LONG ; court : la pose d'hier
    const g = st.pitch.attackGoal(tk.team);
    let ux = g.x - r.p[0], uz = 0 - r.p[1]; const L = hyp(ux, uz) || 1; ux /= L; uz /= L;
    const lat = (tk.foot === 'left' ? -1 : 1) * (SB.lat ?? 1.2), recul = SB.recul ?? 3;
    r.elan = { spot: [r.p[0] - ux * recul + uz * lat, r.p[1] - uz * recul - ux * lat], phase: 'recule', at: st.t, sortieBut: true };
    return;
  }
  if (r.type === 'touche') {                                          // (A9 ter, elan.toucheLongue) LA TOUCHE LONGUE se lance au bout d'une course perpendiculaire à la ligne
    const TL = E.toucheLongue, gT = st.pitch.attackGoal(tk.team), sgT = Math.sign(gT.x || 1);
    if (!TL || !(st.tactics?.[tk.team]?.cpa?.touche === 'longue' && r.p[0] * sgT > st.pitch.hx / 3)) return;   // la même porte que remiseEnTouche
    const sz = Math.sign(r.p[1] || 1), ap = Math.max(0.5, (cfg.apron ?? 2) - 0.3);
    const recul = Math.min(TL.recul ?? 4, ap - (cfg.remisesPied.touche?.recul ?? 0.25));   // le tablier borne le départ (2 m de gazon derrière la ligne)
    r.elan = { spot: [r.p[0], Math.min(st.pitch.hz + ap, Math.abs(r.p[1]) + Math.max(0.6, recul)) * sz], phase: 'recule', at: st.t, touche: true };
    return;
  }
  if (r.type !== 'coup-franc' && r.type !== 'corner') return;
  const g = st.pitch.attackGoal(tk.team), sg = Math.sign(g.x || 1);
  let aim = r.type === 'corner' ? [g.x - sg * 11, 0] : [g.x, 0], plan = null;         // la cible provisoire : le point de penalty, le but
  // (B2, elan.tirImmediat) LE COUP FRANC LOIN SE JOUE COURT, ET LE PLAN SE PREND À LA POSE : au-delà de la portée du lancement (55 m
  // du but, coupFrancLance), la prise ne fera pas partir le ballon — le preneur d'hier courait vers le but, gardait le ballon au pied
  // et passait 0,4-1,5 s plus tard (mesuré : 9 doubles gestes sur 20 remises en 12 matchs, TOUS des coups francs à 56-101 m). Ici
  // il choisit son coéquipier avant de reculer — le plus libre du demi-plan avant (4-30 m) — et sa course s'oriente vers lui.
  let court = false;
  if (r.type === 'coup-franc' && E.tirImmediat && hyp(g.x - r.p[0], r.p[1]) > 55) {
    court = true; const m = planCourt(st, tk, r.p, g);
    if (m) { aim = [m.p[0], m.p[2]]; plan = m.id; }
  }
  // …et LE CORNER DE POSSESSION aussi (le CORT du style, referee.cornerTrav : 35 % − 0,30 × style) : le tirage se prend À LA POSE
  // (même tirage, même flux 'cpa' du preneur, une fois — cornerTrav ne le rejoue pas : tk._cornerCort), le plan court avec lui.
  if (r.type === 'corner' && E.tirImmediat && cfg.corner && Math.abs(Math.abs(r.p[0]) - st.pitch.hx) <= 4) {
    const rnd = tirage(st, 'cpa', tk.id, st.rnd2 ?? st.rnd ?? (() => 0.5)), sty = st.tactics ? (st.tactics[tk.team]?.style ?? 0.5) : 0.5;
    court = rnd() < 0.35 - Math.max(0, Math.min(1, sty)) * 0.30;
    tk._cornerCort = court ? 'court' : 'centre';                                     // les deux issues : cornerTrav ne retire pas un second tirage
    if (court) { const m = planCourt(st, tk, r.p, g); if (m) { aim = [m.p[0], m.p[2]]; plan = m.id; } }
  }
  let ux = aim[0] - r.p[0], uz = aim[1] - r.p[1]; const L = hyp(ux, uz) || 1; ux /= L; uz /= L;
  const lat = (tk.foot === 'left' ? -1 : 1) * (E.lat ?? 1.5), recul = plan != null ? Math.min(E.recul ?? 3.5, 2.5) : (E.recul ?? 3.5);   // la GAUCHE de la ligne = [uz, -ux] : le droitier vient de la gauche ; la passe courte a sa course courte
  let sx = r.p[0] - ux * recul + uz * lat, sz = r.p[1] - uz * recul - ux * lat;
  const ap = Math.max(0.5, (cfg.apron ?? 2) - 0.3), hx = st.pitch.hx + ap, hz = st.pitch.hz + ap;
  sx = Math.max(-hx, Math.min(hx, sx)); sz = Math.max(-hz, Math.min(hz, sz));
  r.elan = { spot: [sx, sz], phase: 'recule', at: st.t, ...(court ? { court: true, plan } : {}) };   // court : la prise sera une passe courte — la course attend son coéquipier (plan)
}

/** (B2) Le coéquipier du plan court : le plus libre (l'adversaire le plus proche, le plus loin) à 4-45 m, hors l'arrière strict. */
function planCourt(st, tk, bp, g) {
  const gx = g.x - bp[0], gz = 0 - bp[1], gl = hyp(gx, gz) || 1;
  const libre = (m) => Math.min(99, ...st.players.filter((q) => q.team !== tk.team && q.down <= 0).map((q) => hyp(q.p[0] - m.p[0], q.p[2] - m.p[2])));
  return st.players.filter((q) => q.team === tk.team && q.id !== tk.id && !q.keeper && q.down <= 0 && !q._sub)
    .map((q) => ({ q, d: hyp(q.p[0] - bp[0], q.p[2] - bp[1]) }))
    .filter((x) => x.d >= 4 && x.d <= 45 && ((x.q.p[0] - bp[0]) * gx + (x.q.p[2] - bp[1]) * gz) / (x.d * gl) >= -0.5)   // ≤ 120° de la ligne du but, jusqu'à 45 m (le coup franc loin se relance aussi sur un défenseur de côté — mesuré : à 4-30 m devant, personne, la course d'hier sautait)
    .map((x) => ({ ...x, score: libre(x.q) - 0.05 * x.d })).sort((a, b) => b.score - a.score)[0]?.q ?? null;
}

/** Le métier du preneur pendant la course (assignMatchJobs) : recule → attend face au ballon ; court : le métier d'hier. */
export function elanJob(st, r, tk, cfg) {
  const RP = st.full && cfg?.remisesPied;
  if (!r.elan && r.placed === true && RP?.elan && (r.type === 'touche' || r.type === 'sortie-de-but' || RP.elan.attente)) poserElan(st, r, cfg);   // (B4, elan.attente) …le coup franc et le corner aussi : posés sans preneur connu (la pose tardive d'un porté à 9 s, le ramasseur), ils partaient sans course — mesuré au banc, la prise dans l'image de la pose   // (A9 ter) une pose venue d'ailleurs (le ramasseur) n'avait pas de preneur : la course se pose dès qu'il est connu
  if (RP?.touche && r.type === 'touche' && r.placed === true && !(r.elan?.touche && RP.elan)) {   // (A9 ter) …sauf la touche longue, qui a sa course   // LE LANCEUR DERRIÈRE LA LIGNE (Loi 15) : il se tient recul m dehors, le ballon sur la ligne à portée de main
    r.placedAt ??= st.t;                                          // une pose venue d'ailleurs (le ramasseur, une remise déjà posée) date sa patience ici
    tk.job = 'receive'; tk.target = [r.p[0], 0, r.p[1] + Math.sign(r.p[1] || 1) * (RP.touche.recul ?? 0.4)]; return true;
  }
  const el = r.elan;
  if (!el || !RP?.elan) return false;
  if (el.phase === 'court') {                                     // il court À TRAVERS le ballon (la cible au-delà : l'amorti d'arrivée ne le freine pas sur le point de contact)
    if (el.touche) { tk.job = 'receive'; tk.target = [st.ball.p[0], 0, st.ball.p[2] - Math.sign(st.ball.p[2] || 1) * 0.3]; return true; }   // (A9 ter) la touche longue court AU ballon, sans geste : le lancer s'arme à l'arrivée (canTake → remiseEnTouche)
    if (!tk.act) return false;
    const dx = st.ball.p[0] - el.spot[0], dz = st.ball.p[2] - el.spot[1], L = hyp(dx, dz) || 1;
    tk.job = 'receive'; tk.target = [st.ball.p[0] + dx / L * 1.5, 0, st.ball.p[2] + dz / L * 1.5]; return true;
  }
  tk.job = 'walk';
  if (el.phase === 'recule') tk.target = [el.spot[0], 0, el.spot[1]];
  else { tk.target = [tk.p[0], 0, tk.p[2]]; if (hyp(tk.v[0], tk.v[1]) < 0.3) tk.yawWant = Math.atan2(st.ball.p[2] - tk.p[2], st.ball.p[0] - tk.p[0]); }
  return true;
}

/** L'horloge de la course (chaque image, depuis ballFetch) : arrivé au départ → attend ; l'heure venue → part (le geste s'arme
 *  sur la durée de la course) ; en retard au contact → l'armé s'étire d'une image ; sans arrivée → la prise d'hier. */
export function elanStep(st, dt, cfg) {
  const r = st.restart, E = st.full && cfg?.remisesPied?.elan;
  if (r?.type === 'coup-franc' && r._mur?.length && cfg?.remisesPied?.mur) st._murPending = { ids: [...r._mur], team: r.team };   // (A9 ter) le mur d'avant la prise, mémorisé (st.restart meurt à la prise, quelle que soit sa voie)
  if (!r || !E || !r.elan || r.placed !== true) return;
  const el = r.elan, tk = st.players[r.taker ?? -1];
  if (!tk || tk.down > 0) return;
  const bp = st.ball.p, d = hyp(bp[0] - tk.p[0], bp[2] - tk.p[2]);
  // (B2) LE PLAN COURT SE RELIT PENDANT L'ATTENTE (toutes les 0,5 s, avant la course) : les coéquipiers se replacent pendant
  // la remise — le coéquipier choisi à la pose avait couru 10-20 m et la course d'élan pointait dans le vide (mesuré : 8 coups
  // francs loin sur 8 refusés au cône). Le point de départ suit : le preneur se replace de quelques mètres, comme sur le terrain.
  // …et TANT QU'IL N'A PERSONNE, LA COURSE ATTEND (mesuré graine 1 : la faute rassemble les corps — la protestation, A11 —, les neuf
  // coéquipiers à 0-2 m du preneur à l'heure de la remise ; le plan n'existe pas, la course partait quand même et le cône restait vide,
  // 8 coups francs loin sur 8). Il attend que quelqu'un se soit écarté (≥ 4 m) — la patience (E.patience) garde le garde-fou.
  if (el.court && el.phase !== 'court' && st.t >= (el.planAt ?? -9) + 0.5 && (st.t < r.at - 1.0 || el.plan == null) && !tk.act) {   // …jusqu'à 1 s de l'heure quand il a son homme : le temps de se replacer
    el.planAt = st.t;
    const g = st.pitch.attackGoal(tk.team), m = planCourt(st, tk, [bp[0], bp[2]], g);
    if (!m) el.plan = null;
    else {
      el.plan = m.id;
      let ux = m.p[0] - bp[0], uz = m.p[2] - bp[2]; const L = hyp(ux, uz) || 1; ux /= L; uz /= L;
      const lat = (tk.foot === 'left' ? -1 : 1) * (E.lat ?? 1.5), recul = Math.min(E.recul ?? 3.5, 2.5);
      const ap = Math.max(0.5, (cfg.apron ?? 2) - 0.3), hx = st.pitch.hx + ap, hz = st.pitch.hz + ap;
      const spot = [Math.max(-hx, Math.min(hx, bp[0] - ux * recul + uz * lat)), Math.max(-hz, Math.min(hz, bp[2] - uz * recul - ux * lat))];
      if (hyp(spot[0] - el.spot[0], spot[1] - el.spot[1]) > 0.3) { el.spot = spot; el.phase = 'recule'; }   // le point a bougé : il y RETOURNE (en 'attend' il ne marche pas — mesuré : la course partait du vieux point, 6 refus au cône sur 6)
    }
  }
  if (el.phase === 'recule' && hyp(tk.p[0] - el.spot[0], tk.p[2] - el.spot[1]) < (el.touche ? 0.7 : 0.4) && hyp(tk.v[0], tk.v[1]) < (el.touche ? 2 : 0.9)) { el.phase = 'attend'; el.attendAt = st.t; }   // (A9 ter) le lanceur arrive de loin, en marchant vite : il tourne autour de son point sans jamais y être « posé »
  if (el.near == null && d < 6) el.near = st.t;                                          // la patience court depuis que le preneur est AU ballon (le ramasseur pose parfois avant lui)
  const refP = !E.attente ? -Infinity : el.phase === 'attend' ? (el.attendAt ?? st.t) : (el.at ?? st.t) + (E.attente.marche ?? 4);   // (B4, elan.attente — null : la patience d'hier) la patience court depuis l'ARRIVÉE au point (ou 4 s de marche après une pose tardive : le porté à 9 s du point) — mesuré : le coup franc du banc pris sans course, la patience consommée pendant la marche
  if (el.phase !== 'court' && st.t > Math.max(r.at, refP, el.near ?? st.t) + (E.patience ?? 4)) { el.phase = 'court'; el.rate = 'patience'; el.t0 ??= st.t; return; }   // le garde-fou anti-gel : sans course, la prise d'hier
  if (el.phase === 'attend' && st.t >= r.at - 0.2 && !tk.act && !(el.court && el.plan == null)) {   // (B2) la passe courte attend son coéquipier
    if (el.touche) { el.phase = 'court'; el.t0 = st.t; return; }                        // (A9 ter) la touche longue : la course sans geste
    const v = (el.sortieBut ? E.sortieBut?.vitesse : null) ?? E.vitesse ?? 4, T = Math.max(0.6, d / v + 0.35);
    const mv = MOVE_TIMING.frappe || { duration: 1.0, contact: 0.45 };
    startGesture(tk, { id: 'frappe', duration: T + (mv.duration - mv.contact), contact: T },
      { payload: { kind: 'elan', type: r.type, elan: v, T0: T, pick: { tech: byId['passe-laces'] ?? { id: 'elan', clip: 'frappe' }, foot: tk.foot ?? 'right' } }, log: st.gestures });
    st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: tk.id, tech: 'elan', move: 'frappe', foot: tk.foot ?? 'right', anticipation: +T.toFixed(2), remise: r.type, depart: +d.toFixed(2) });
    el.phase = 'court'; el.t0 = st.t;
  }
  if (el.touche && el.phase === 'court' && el.arrive == null && d < (cfg.receiveRadius ?? 0.85) + 0.05) {   // (A9 ter) arrivé au ballon : l'événement 'élan' ; la prise d'hier (canTake) lance
    el.arrive = st.t; st.events.push({ t: +st.t.toFixed(2), type: 'élan', by: tk.id, remise: 'touche', vitesse: +hyp(tk.v[0], tk.v[1]).toFixed(2), course: +(st.t - (el.t0 ?? st.t)).toFixed(2), d: +d.toFixed(2) });
  }
  const A = tk.act;
  if (A && A.payload?.kind === 'elan' && !A.fired && d < 0.4 && A.t + dt < A.anticipation) { A.total -= A.anticipation - (A.t + dt); A.anticipation = A.t + dt; }   // en avance : le contact vient À l'arrivée (il court à travers le ballon)
  if (A && A.payload?.kind === 'elan' && !A.fired && A.t + dt >= A.anticipation && d > (cfg.receiveRadius ?? 0.85)) {   // en retard : le contact ATTEND l'arrivée
    if (st.t - el.t0 > A.payload.T0 + 1.5) { abortGesture(tk, 'élan-sans-ballon', { log: st.gestures }); deny(st, 'élan-sans-ballon'); el.rate = 'sans-ballon'; return; }
    A.anticipation += dt; A.total += dt;
  }
}

/** Le contact du geste d'élan (hook elanNow du loop) : la remise se PREND ici — canTake, receive, onTake : la frappe d'hier,
 *  depuis le point d'arrivée. Arrivé trop court, ou la reprise encore fermée (Loi 16, moitiés) : refus nommé, la prise d'hier
 *  prendra au ballon. */
export function elanNow(st, p, cfg, receive) {
  const r = st.restart;
  if (!r || !r.elan || r.taker !== p.id) return;
  const d = hyp(st.ball.p[0] - p.p[0], st.ball.p[2] - p.p[2]);
  if (d > (cfg.receiveRadius ?? 0.85) + 0.15) { deny(st, 'élan-loin'); return; }
  const type = r.type, course = +(st.t - (r.elan.t0 ?? st.t)).toFixed(2), vitesse = +hyp(p.v[0], p.v[1]).toFixed(2);
  if (cfg.canTake && !cfg.canTake(st, p.id, cfg)) { deny(st, 'élan-attend'); return; }
  st.events.push({ t: +st.t.toFixed(2), type: 'élan', by: p.id, remise: type, vitesse, course, d: +d.toFixed(2) });
  receive(st, p.id, cfg);
  if (!st.restart && cfg.onTake) cfg.onTake(st, p.id, type, cfg);
  // (A9 ter) LA SORTIE DE BUT LONGUE se dégage DANS L'IMAGE du contact : la relance du gardien (keeper.relancerGardien, style long forcé
  // par la course) arme sa passe — l'armé est déjà joué par la course, le tir se prend au tick suivant (la scène tient le clip d'élan)
  if (type === 'sortie-de-but' && r.elan.sortieBut && !st.restart && st.possession.carrier === p.id) {
    if (p.act?.payload?.kind !== 'pass') {                                     // la porte de timing de beginPass (holdMin − contact × carve) compte le porté : la course d'élan EST le porté
      st.hold = Math.max(st.hold, (st._holdMin ?? cfg.holdMin ?? 0.6) + 0.1); p._elanLong = true;
      try { relancerGardien(st, p, cfg, { beginPass }); } finally { p._elanLong = false; }
    }
    const A = p.act; if (A?.payload?.kind === 'pass' && !A.fired && A.t < A.anticipation) { A.total -= A.anticipation - A.t; A.anticipation = A.t; }
  }
  // (B2, cfg.remisesPied.elan.tirImmediat) LE COUP FRANC LANCÉ ET LE CORNER SE JOUENT DANS L'IMAGE DU CONTACT D'ÉLAN AUSSI : quand la
  // prise n'a pas fait partir le ballon (coupFrancDirect/coupFrancLance/cornerTrav rendus false — trop loin, le CORT du style, pas de
  // cible), le preneur restait porteur et le cerveau rejouait une passe 0,4-1,5 s plus tard (porte de timing : hold ≈ 0 → 'timing'
  // × 5 mesuré) — le clip d'élan frappait un ballon qui ne partait pas, puis un clip de passe le faisait partir (le double geste).
  // Ici : la course compte comme porté, le choix du porteur se prend MAINTENANT en urgence (un corps lancé n'a pas de stance à
  // rejoindre), l'armé est déjà joué par la course : le tir se prend au tick suivant. null : le double geste d'hier, au bit.
  if ((type === 'coup-franc' || type === 'corner') && cfg.remisesPied?.elan?.tirImmediat && !st.restart && st.possession.carrier === p.id
    && p.act?.payload?.kind !== 'pass' && (p.down ?? 0) <= 0) {
    st.hold = Math.max(st.hold, (st._holdMin ?? cfg.holdMin ?? 0.6) + 0.1);
    // …dans le CÔNE de la course seulement (E.tirImmediat.cone °, défaut 40) : le clip d'élan frappe le long de la course — un ballon
    // qui partirait à 90° de la jambe serait pire que le double geste. Le choix du cerveau s'il est dans le cône ; sinon LE COURT DE
    // LA COURSE : le coéquipier le plus libre dans le cône (4-30 m, rayon libre = l'adversaire le plus proche), au sol / tendu /
    // en cloche selon la distance — la porte de course de beginPass (flightRace) garde son mot ; hors de tout, le cerveau d'hier.
    const cone = (cfg.remisesPied.elan.tirImmediat.cone ?? 40) * Math.PI / 180;
    const runYaw = hyp(p.v[0], p.v[1]) > 0.5 ? Math.atan2(p.v[1], p.v[0]) : p.yaw;
    const bearingTo = (x, z) => Math.abs(((Math.atan2(z - p.p[2], x - p.p[0]) - runYaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    const court = (m) => (m ? { to: { id: m.q.id }, lead: [m.q.p[0] + m.q.v[0] * 0.3, 0, m.q.p[2] + m.q.v[1] * 0.3], style: m.d > 18 ? 'lofted' : m.d > 10 ? 'driven' : 'ground', lane: { margin: 4 }, court: true } : null);
    const mp = r.elan.plan != null ? st.players[r.elan.plan] : null;                    // le plan de la pose (le coup franc loin) : le coéquipier choisi avant la course, relu ici
    const dp = mp ? hyp(mp.p[0] - p.p[0], mp.p[2] - p.p[2]) : 0;
    let choice = mp && mp.team === p.team && mp.down <= 0 && dp >= 3 && dp <= 48 && bearingTo(mp.p[0], mp.p[2]) <= cone * 1.5 ? court({ q: mp, d: dp }) : choosePass(st, cfg);
    let bearing = choice?.lead ? bearingTo(choice.lead[0], choice.lead[2]) : null;
    if (!(choice && bearing <= (choice.court ? cone * 1.5 : cone))) {
      const libre = (m) => Math.min(...st.players.filter((q) => q.team !== p.team && q.down <= 0).map((q) => hyp(q.p[0] - m.p[0], q.p[2] - m.p[2])), 99);
      const m = st.players.filter((q) => q.team === p.team && q.id !== p.id && !q.keeper && q.down <= 0 && !q._sub)
        .map((q) => ({ q, d: hyp(q.p[0] - p.p[0], q.p[2] - p.p[2]) })).filter((x) => x.d >= 4 && x.d <= 30 && bearingTo(x.q.p[0], x.q.p[2]) <= cone)
        .map((x) => ({ ...x, libre: libre(x.q) })).sort((a, b) => b.libre - a.libre || a.d - b.d)[0];
      choice = court(m);
      bearing = choice ? bearingTo(choice.lead[0], choice.lead[2]) : null;
    }
    if (choice && beginPass(st, choice, cfg, { forceUrgent: true, elan: true })) {   // elan : pas de porte d'ancre — le corps est au ballon
      const A = p.act;
      if (A?.payload?.kind === 'pass' && !A.fired && A.t < A.anticipation) { A.total -= A.anticipation - A.t; A.anticipation = A.t; A.payload.tirImmediat = true; st.events.push({ t: +st.t.toFixed(2), type: 'tir-immédiat', by: p.id, remise: type, to: choice.to?.id, bearing: +(bearing * 180 / Math.PI).toFixed(0), ...(choice.court ? { court: true } : {}) }); }
    } else deny(st, choice ? 'tir-immédiat-armé' : 'tir-immédiat-cône');
  }
}

/** (B4, cfg.remisesPied.mur.corps) LE BALLON CONTRE LE MUR : hier le vol TRAVERSAIT le mur qui saute (aucune loi de corps pour un
 *  ballon vif — mesuré en page, un homme sauté à 1 m d'un ballon qui passe). Pendant la fenêtre ouverte au départ du ballon (1 s), un
 *  ballon libre et vif (≥ 3 m/s) qui passe à ≤ rayon m d'un homme du mur SOUS sa hauteur — corps m quand la détente du clip le porte
 *  (sautMur : en l'air de 0,19 à 0,52 s après le retard), debout m sinon — est DÉVIÉ : il repart vers le tireur, ralenti (× frein) et
 *  relevé ; le vol meurt (phase loose, pass null), le toucher est au mur (lastTouch : le corner ou la touche suivent). Le tireur vise
 *  déjà ≥ 2,35 m au-dessus du mur (referee) : seuls les tirs bas et les lancés tendus paient. corps null : le mur traversé d'hier. */
function murCorps(st, cfg) {
  const C = st._murCorps; if (!C || C.done) return;                                     // done : le mur a dévié — la fenêtre reste (canTake : l'homme du mur ne contrôle pas le rebond)
  const K = cfg.remisesPied?.mur, H = K?.corps;
  if (!H || st.t > C.until || st.ball.owner != null) { st._murCorps = null; return; }
  const b = st.ball.p, v = st.ball.v, sp = hyp(v[0], v[2]); if (sp < 3) return;
  for (const id of C.ids) {
    const q = st.players[id]; if (!q || q.down > 0) continue;
    if (hyp(b[0] - q.p[0], b[2] - q.p[2]) > (K.rayon ?? 0.35)) continue;
    const A = q.act, tA = A && A.payload?.kind === 'saut' ? A.t - (A.payload.retard ?? 0) : -1, air = tA >= 0.19 && tA <= 0.52;
    if (b[1] > (air ? H : (K.debout ?? 1.85)) || (air && b[1] < (K.pieds ?? 0.25))) continue;   // le rasant passe SOUS les pieds du mur qui saute
    const k = K.frein ?? 0.4;
    st.ball.impulse([-v[0] * (1 + k), Math.max(2.5, sp * 0.25) - v[1], -v[2] * (1 + k)]);
    st.phase = 'loose'; st.pass = null; st.lastTouch = q.team; st.lastPasser = q.id;
    st.events.push({ t: +st.t.toFixed(2), type: 'dévié-mur', by: q.id, h: +b[1].toFixed(2), air, vitesse: +sp.toFixed(1) });
    C.done = true; return;
  }
}

/** (A9 ter) LE MUR S'ARME À LA PRISE du coup franc (referee.onTakeMatch — la voie de l'élan comme la prise d'hier) : il part quand le
 *  ballon QUITTE le preneur (murStep — direct : cette image ; lancé : au contact de la passe). */
export function armerMur(st, id, cfg) {
  const P = st._murPending; st._murPending = null;
  if (!P || !(st.full && cfg?.remisesPied?.mur)) return;
  st._murSaut = { ids: P.ids, by: id, armedAt: st.t };
}

/** (A9 ter, cfg.remisesPied.mur) LE MUR SAUTE : posé au contact du coup franc (elanNow), il part après le retard de réaction —
 *  chaque homme du mur arme 'sautMur' (motion-emotion : accroupi, détente, pieds décollés, mains croisées devant, réception),
 *  un acte qui possède le corps (planté) ; l'événement 'saut' pour les bancs. Clé absente : le mur d'hier, planté. */
export function murStep(st, cfg) {
  murCorps(st, cfg);                                                                      // (B4) le ballon contre le mur, chaque image tant que la fenêtre dure
  const M = st._murSaut; if (!M) return;
  {                                                                                       // le mur lit le DÉPART du ballon, pas le contact du geste
    if (st.t - M.armedAt > 3) { st._murSaut = null; return; }
    if (!(st.ball.owner !== M.by && hyp(st.ball.v[0], st.ball.v[2]) > 3)) return;
  }
  st._murSaut = null;
  if (cfg.remisesPied?.mur?.corps) st._murCorps = { ids: M.ids, until: st.t + 1.0 };      // (B4) la fenêtre du corps : le vol jusqu'au mur (9,15 m à 15-25 m/s : 0,4-0,6 s), retard et détente compris
  // l'acte part À LA SECONDE du départ (le mur se plante au lieu de se lancer à la poursuite) ; le retard de réaction est DANS l'acte
  // (payload.retard : la scène décale l'horloge du clip d'autant — remiseClock —, le corps tient sa pose pendant le retard)
  const mv = MOVE_TIMING.sautMur || { duration: 0.78, contact: 0.34 }, retard = cfg.remisesPied?.mur?.retard ?? 0.12;
  for (const id of M.ids) {
    const q = st.players[id]; if (!q || q.down > 0 || q.act) continue;
    if (hyp(q.p[0] - st.ball.p[0], q.p[2] - st.ball.p[2]) > 13) continue;   // un homme du mur qui n'y est pas (parti marquer en boîte : cfSpots passe avant le mur) ne saute pas à 30 m du ballon
    startGesture(q, { id: 'sautMur', duration: mv.duration + retard, contact: mv.contact + retard }, { payload: { kind: 'saut', ownsBody: true, retard }, log: st.gestures });
    st.events.push({ t: +st.t.toFixed(2), type: 'windup', by: q.id, move: 'sautMur', skill: 'saut', anticipation: +(mv.contact + retard).toFixed(2), retard });
    st.events.push({ t: +st.t.toFixed(2), type: 'saut', by: q.id, remise: 'coup-franc' });
  }
}
