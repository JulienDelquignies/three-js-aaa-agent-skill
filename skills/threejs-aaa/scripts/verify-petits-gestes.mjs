// verify-petits-gestes.mjs — LES PETITS GESTES DU MATCH (Animations_A_Faire § 10 ; cfg.petitsGestes ; engine/petits-gestes.js ; note 384).
// Cinq gestes que le match montrait sans les jouer : la SEMELLE du preneur à la sortie de but (la remise attend), le gardien qui REPLACE
// SON MUR (designer, le regard tenu), la tête armée d'un défenseur en DÉGAGEMENT (teteDefensive — même heure que tete), le CONTRÔLE
// ORIENTÉ (scène : le receveur que la sim tourne de ≥ angle ° ouvre les hanches), la FEINTE D'APPEL du soutien posé (une par cadence s).
// Trois gestes générés de plus (teteDefensive, controleOriente, feinteAppel) sous leur contrat de famille et checkClip. null : l'hier au bit.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { GENERATORS } from '../assets/starter/src/engine/motion-cast.js';
import { SHANON_PROFILE } from '../assets/starter/src/engine/motion-profile-shanon.js';
import { checkClip, resolveTracks, MOVES } from '../assets/starter/src/engine/animkit.js';
import { styleFromSeed } from '../assets/starter/src/engine/motion-strike.js';
import { predictPath, crossesHeight } from '../assets/starter/src/engine/ball-predict.js';
const MES_1609 = { blocPercu: null, enveloppe: null, visee: null, ellipse: null, repertoire: null, arretControle: null, ligneAccrochee: null };   // MES CLÉS D'HIER — DATÉ fusion 16/09 : les sept clés de 275-280 nulles = le monde de la branche animations 5f8870f au bit (bb530de469f21cbc / d5ba9ca701a880fa) sur l'état fusionné e798b47

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const hyp = Math.hypot, P = SHANON_PROFILE, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const K = matchCfg({}).petitsGestes;
const PINS = { ouverture: null /* ouverture null DATÉ 288 : vert à HEAD~ (worktree d90101b), 7 applaudissements en 300 s, trois en une seconde dans ce monde (0 ✗ au 287) — la clause mesure sa loi, pas le receveur qui s'ouvre au ballon */, layoff: null /* layoff null DATÉ 287 : vert à HEAD~ (worktree 4535d0f), les salves d'applaudissement 1 sur 8 arrêts (attendu 3-8 ; 0 ✗ au 286) — la clause mesure sa loi, pas la une-touche jugée par son angle */, ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null };   // (DATÉ 17/09) les quatre clés de la relecture du match nulles : ce banc mesure les petits gestes seuls
const monde = (over, secs = 1) => { const st = makeMatch({ full: true, seed: 3 }); const cfg = matchCfg({ ...PINS, ...over }); for (let i = 0; i < 60 * secs; i++) matchStep(st, 1 / 60, cfg); return { st, cfg }; };

console.log('— (a) trois gestes générés de plus, sous contrat et checkClip —');
{
  for (const kind of ['teteDefensive', 'controleOriente', 'feinteAppel']) {
    const spec = GENERATORS[kind].generate(P, {}), r = GENERATORS[kind].check(spec, P, {}), c = checkClip(resolveTracks(spec));
    let bad = 0, first = null;
    for (let s = 1; s <= 40; s++) { const sp = GENERATORS[kind].generate(P, { style: styleFromSeed(s) }); const rr = GENERATORS[kind].check(sp, P, {}), cc = checkClip(resolveTracks(sp)); if (!rr.ok || !cc.ok) { bad++; first ??= `graine ${s} : ${[...rr.issues, ...cc.issues].join(' ; ')}`; } }
    ok(`${kind} (${spec.keys.length} clés, ${spec.duration} s, contact ${spec.contact}) sous contrat et checkClip, 40 styles (${bad} refus)${MOVES[kind] ? ', dans MOVES' : ', ABSENT de MOVES'}`, r.ok && c.ok && bad === 0 && !!MOVES[kind], [...r.issues, ...c.issues, first].filter(Boolean).join(' ; '));
  }
  const tD = GENERATORS.teteDefensive.check(GENERATORS.teteDefensive.generate(P, {}), P, {}).portrait, tO = GENERATORS.tete.check(GENERATORS.tete.generate(P, {}), P, {}).portrait;
  ok(`teteDefensive s'ARME davantage que tete (tête ${tD.headBackMin.toFixed(1)}° c. ${tO.headBackMin.toFixed(1)} avant le contact) à la même heure (${MOVES.teteDefensive.duration} / ${MOVES.teteDefensive.contact} = ${MOVES.tete.duration} / ${MOVES.tete.contact} : le flux d'hier)`,
    tD.headBackMin < tO.headBackMin - 5 && MOVES.teteDefensive.duration === MOVES.tete.duration && MOVES.teteDefensive.contact === MOVES.tete.contact);
  const f = MOVES.feinteAppel;
  ok(`feinteAppel est du HAUT DU CORPS seul (upperOnly ${!!f.upperOnly}, ${f.keys.some((k) => k.pose.LeftUpLeg || k.pose.RightUpLeg) ? 'des' : 'aucune'} clé de jambe, ${f.duration} s)`, !!f.upperOnly && !f.keys.some((k) => k.pose.LeftUpLeg || k.pose.RightUpLeg) && f.duration <= 0.6);
}

console.log('— (b) la semelle du preneur : la sortie de but attend —');
const sortie = (over, secs = 30) => {
  const { st, cfg } = monde(over); const own = st.pitch.ownGoal(0), sg = own.sign ?? Math.sign(own.x || 1); const p = [own.x - sg * 5.5, 2];
  if (st.ball.owner != null) st.ball.release('perte'); for (const q of st.players) { q.act = null; }
  st.ball.restart([p[0], 0.11, p[1]], { cause: 'sortie-de-but' }); st.restart = { type: 'sortie-de-but', p, team: 0, at: st.t + 3, placed: false }; st.possession = { team: 0, carrier: -1 }; st.phase = 'loose';
  const n0 = st.events.length, t0 = st.t; let geste = null, vAt = null, pris = null;
  for (let i = 0; i < 60 * secs && !pris; i++) {
    matchStep(st, 1 / 60, cfg);
    for (const e of st.events.slice(n0)) { if (!geste && e.type === 'geste' && e.move === 'arretSemelle') { geste = e; const q = st.players[e.by]; vAt = hyp(q.v[0], q.v[1]); } if (!pris && e.type === 'restart-pris') pris = e; }
  }
  return { t0, geste, vAt, pris, taker: st.events.slice(n0).find((e) => e.type === 'restart-pris')?.by };
};
{
  const r = sortie({});
  ok(`LA SEMELLE (petitsGestes.semelle) : le preneur arrivé au ballon (${r.vAt != null ? r.vAt.toFixed(2) + ' m/s' : '—'} ≤ ${K.semelle.vMax}) pose la semelle (geste arretSemelle par ${r.geste?.by ?? '—'} à ${r.geste ? (r.geste.t - r.t0).toFixed(1) : '—'} s) et la sortie de but PART ${r.geste && r.pris ? (r.pris.t - r.geste.t).toFixed(2) : '—'} s après (≥ tenue ${K.semelle.tenue} − 1 tick, le même preneur ${r.pris?.by ?? '—'})`,
    !!r.geste && !!r.pris && r.pris.by === r.geste.by && r.pris.t - r.geste.t >= K.semelle.tenue - 0.02 && r.vAt <= K.semelle.vMax + 0.05);
  const n = sortie({ petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null });
  ok(`semelle:null — aucune semelle (${n.geste ? 'geste' : 'rien'}), la sortie de but part (${n.pris ? (n.pris.t - n.t0).toFixed(1) + ' s' : 'jamais'}) ; avec la clé : ${r.pris ? (r.pris.t - r.t0).toFixed(1) : '—'} s`, !n.geste && !!n.pris);
}

console.log('— (c) le gardien replace son mur —');
const coupFranc = (over, secs = 8) => {
  const { st, cfg } = monde(over); const g = st.pitch.attackGoal(0), sg = Math.sign(g.x || 1); const p = [g.x - sg * 22, 3];
  if (st.ball.owner != null) st.ball.release('perte'); for (const q of st.players) { q.act = null; }
  st.ball.restart([p[0], 0.11, p[1]], { cause: 'coup-franc' }); st.restart = { type: 'coup-franc', p, team: 0, at: st.t + 4, placed: false }; st.possession = { team: 0, carrier: -1 }; st.phase = 'loose';
  const gk = st.players.find((q) => q.keeper && q.team === 1); const n0 = st.events.length, t0 = st.t; let geste = null, regardAt = null, regardOff = null, murAt = null;
  for (let i = 0; i < 60 * secs; i++) {
    matchStep(st, 1 / 60, cfg);
    if (murAt == null && st.restart?._mur?.length) murAt = st.t;
    if (!geste) { geste = st.events.slice(n0).find((e) => e.type === 'geste' && e.move === 'designer'); if (geste) regardAt = gk._regard; }
    else if (regardOff == null && gk._regard == null) regardOff = st.t;
  }
  return { t0, gk, geste, regardAt, regardOff, murAt, pris: st.events.slice(n0).find((e) => e.type === 'restart-pris') };
};
{
  const r = coupFranc({});
  const vers = r.geste && r.regardAt != null ? Math.abs(wrap(r.regardAt - Math.atan2(r.geste.mur[1] - r.gk.p[2], r.geste.mur[0] - r.gk.p[0]))) : null;
  ok(`LE MUR REPLACÉ (petitsGestes.mur) : le mur élu à ${r.murAt != null ? (r.murAt - r.t0).toFixed(2) : '—'} s, le gardien ${r.gk.id} DÉSIGNE (geste designer, pied ${r.geste?.foot ?? '—'}) à ${r.geste ? (r.geste.t - r.t0).toFixed(2) : '—'} s (≥ élu + delai ${K.mur.delai}), le regard tenu vers le mur (${vers != null ? (vers * 180 / Math.PI).toFixed(0) + '°' : '—'} d'écart au point ${r.geste?.mur ?? '—'})`,
    !!r.geste && r.geste.by === r.gk.id && r.murAt != null && r.geste.t >= r.murAt + K.mur.delai - 0.02 && r.regardAt != null && vers < 0.15);   // le gardien a bougé d'ici la fin de la course : ± 8°
  ok(`…et le relâche à l'heure (regard nul à ${r.regardOff != null ? (r.regardOff - r.geste.t).toFixed(2) : '—'} s du geste ≈ duree ${K.mur.duree}, ou à la reprise ${r.pris ? (r.pris.t - r.t0).toFixed(1) + ' s' : '—'})`,
    r.regardOff != null && (Math.abs(r.regardOff - r.geste.t - K.mur.duree) <= 0.06 || (r.pris && Math.abs(r.regardOff - r.pris.t) <= 0.06)));
  const n = coupFranc({ petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null });
  ok(`mur:null — aucun geste (${n.geste ? 'geste' : 'rien'}), aucun regard tenu (${n.regardAt ?? 'nul'}), le mur d'hier élu (${n.murAt != null ? 'oui' : 'non'})`, !n.geste && n.regardAt == null && n.murAt != null);
}

console.log('— (d) la tête armée du défenseur : le dégagement —');
const centre = (over, { h = 2.6 } = {}) => {   // la fixture de verify-tete-armee (B3), le corps posé étant un DÉFENSEUR de l'équipe 1 dans sa surface
  const { st, cfg } = monde({ repli: false, retournee: null, bouclier: null, sortieAerienne: null, ...over }, 2);
  st.ball.release('arrêt-de-jeu');
  for (const q of st.players) { q.p[0] = -30 - (q.id % 10) * 2; q.p[2] = -25; q.v[0] = 0; q.v[1] = 0; q.act = null; }
  st.ball.impulse([-st.ball.v[0], -st.ball.v[1], -st.ball.v[2]]);
  const g = st.pitch.attackGoal(0), sg = Math.sign(g.x || 1);
  const theta = 0.6, v = Math.sqrt(2 * 9.81 * 5.8) / Math.sin(theta), Rv = v * v * Math.sin(2 * theta) / 9.81;
  const to = [g.x - sg * 8, 0, 2], dir = Math.atan2(2 - 22, (g.x - sg * 8) - (g.x - sg * 30));
  const from = [to[0] - Math.cos(dir) * (Rv - 4), 0.11, to[2] - Math.sin(dir) * (Rv - 4)];
  st.ball.restart([from[0], from[1], from[2]], { cause: 'engagement' });
  st.ball.strike({ speed: v, dirYaw: dir, elevation: theta, spinAxis: [0, 1, 0], spinRev: 0 });
  st.restart = null;
  const X = crossesHeight(predictPath(st.ball, { maxT: 4 }), h).find((c) => !c.rising);
  const A = st.players.find((q) => q.team === 1 && !q.keeper);
  A.p[0] = X.p[0]; A.p[2] = X.p[2]; A.v = [0, 0]; A.job = 'intercept'; A.target = [X.p[0], 0, X.p[2]]; A.intent = null;
  st.phase = 'flight'; st.possession = { team: 0, carrier: -1 };
  st.pass = { from: 0, to: 9, lead: [X.p[0], 0, X.p[2]], style: 'lofted', t: st.t, flight: X.t, origin: [from[0], from[2]], cross: true };
  const n0 = st.events.length, t0 = st.t; let tete = null, windup = null;
  for (let i = 0; i < 60 * 4 && !tete; i++) {
    if (!A.act) { A.p[0] = X.p[0]; A.p[2] = X.p[2]; A.v = [0, 0]; }
    matchStep(st, 1 / 60, cfg);
    for (const e of st.events.slice(n0)) { if (!windup && e.type === 'windup' && e.skill === 'tete' && e.by === A.id) windup = e; if (e.type === 'tête' && e.by === A.id) tete = e; }
  }
  return { A, t0, tete, windup, own: hyp(st.pitch.ownGoal(1).x - A.p[0], A.p[2]) };
};
{
  const r = centre({}), n = centre({ petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null });
  ok(`LE DÉGAGEMENT ARMÉ (petitsGestes.teteDefensive) : le défenseur ${r.A.id} à ${r.own.toFixed(0)} m de son but arme la tête sautée en '${r.windup?.move ?? '—'}' (windup à ${r.windup ? (r.windup.t - r.t0).toFixed(2) : '—'} s) et la joue en '${r.tete?.mode ?? '—'}'${r.tete?.saut ? ' sautée' : ''}`,
    !!r.windup && r.windup.move === 'teteDefensive' && !!r.tete && r.tete.mode === 'dégagement' && !!r.tete.saut);
  ok(`teteDefensive:null — le même armé se nomme '${n.windup?.move ?? '—'}' à la même heure (${n.windup ? (n.windup.t - n.t0).toFixed(2) : '—'} s c. ${r.windup ? (r.windup.t - r.t0).toFixed(2) : '—'}), la tête à la même heure (${n.tete ? (n.tete.t - n.t0).toFixed(2) : '—'} c. ${r.tete ? (r.tete.t - r.t0).toFixed(2) : '—'})`,
    !!n.windup && n.windup.move === 'tete' && n.windup.t === r.windup?.t && n.tete?.t === r.tete?.t);
}

console.log('— (e) la feinte d\'appel et le contrôle orienté (90 s de match) —');
const match = (over, secs = 90) => {
  const { st, cfg } = monde(over); const n0 = st.events.length; const feintes = [], vitesses = []; let controles = 0, orientes = 0; const seen = new Set();
  for (let i = 0; i < 60 * secs; i++) {
    matchStep(st, 1 / 60, cfg);
    for (let k = Math.max(n0, st.events.length - 12); k < st.events.length; k++) {
      const e = st.events[k]; if (seen.has(e)) continue; seen.add(e);
      if (e.type === 'geste' && e.move === 'feinteAppel') { feintes.push(e); vitesses.push(st.players[e.by].speed ?? 0); }
      if (e.type === 'control' && !e.miss && e.tech !== 'prise-gardien') { controles++; const q = st.players[e.by]; if (q.yawWant != null && Math.abs(wrap(q.yawWant - q.yaw)) * 180 / Math.PI >= (K?.controleOriente?.angle ?? 45)) orientes++; }
    }
  }
  const gestes = st.events.slice(n0).filter((e) => e.type === 'geste');
  return { feintes, vitesses, controles, orientes, gestes };
};
{
  const r = match({});
  const parJoueur = new Map(); let serre = 0; for (const e of r.feintes) { const l = parJoueur.get(e.by) ?? []; if (l.length && e.t - l[l.length - 1] < K.feinteAppel.cadence - 0.02) serre++; l.push(e.t); parJoueur.set(e.by, l); }
  ok(`LA FEINTE D'APPEL (petitsGestes.feinteAppel) : ${r.feintes.length} feintes en 90 s par ${parJoueur.size} soutiens posés (vitesse au geste ≤ ${K.feinteAppel.vMax} : max ${r.vitesses.length ? Math.max(...r.vitesses).toFixed(2) : '—'}), jamais deux à moins de ${K.feinteAppel.cadence} s pour un même corps (${serre} serrées)`,
    r.feintes.length >= 1 && serre === 0 && Math.max(...r.vitesses) <= K.feinteAppel.vMax + 0.05);
  ok(`LE CONTRÔLE ORIENTÉ (scène, petitsGestes.controleOriente.angle ${K.controleOriente.angle}°) a matière : ${r.orientes} des ${r.controles} contrôles de 90 s tournent le receveur de ≥ ${K.controleOriente.angle}° (yawWant − yaw) — informatif`, r.orientes >= 1);
  const n = match({ petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, toucheOrientee: null }, 60);
  ok(`petitsGestes:null — aucun événement 'geste' en 60 s (${n.gestes.length})`, n.gestes.length === 0);
}

console.log('— (f) l\'applaudissement d\'encouragement, occasionnel et sans chorégraphie (notes 387, 389) —');
{
  const A = K.applaudir;
  const salves = (over) => { const { st, cfg } = monde(over); const gk = st.players.find((q) => q.keeper && q.team === 1); const waves = [];
    for (let w = 0; w < 8; w++) { for (const q of st.players) { q.act = null; q.v = [0, 0]; q.speed = 0; } const n0 = st.events.length; st.events.push({ t: +st.t.toFixed(2), type: 'arrêt', by: gk.id, mode: 'claquette' });
      for (let i = 0; i < 60 * 2; i++) matchStep(st, 1 / 60, cfg); waves.push(st.events.slice(n0).filter((e) => e.type === 'geste' && e.move === 'applaudir'));
      for (let i = 0; i < 60 * 10; i++) matchStep(st, 1 / 60, cfg); }   // 12 s entre deux arrêts : la cadence (10 s) est passée
    return { gk, waves }; };
  const r = salves({ ...MES_1609 /* DATÉ fusion 16/09 : vert dans son parent 5f8870f (19/0), la combinaison (275-280 : l'arrêt au journal change les arrêts vus) remange la salve — la clause mesure sa loi sur le monde de son parent */ }); const all = r.waves.flat(), pleines = r.waves.filter((w) => w.length).length;
  const ok1 = all.every((e) => { const q = r.gk && r.waves && e.by !== r.gk.id; return q; }), gaps = r.waves.filter((w) => w.length === 2).map((w) => Math.abs(w[1].t - w[0].t));
  ok(`L'APPLAUDISSEMENT (petitsGestes.applaudir) : sur 8 arrêts du gardien ${r.gk.id}, ${pleines} salves (tirées à p ${A.p.arret}, attendu 3-8), ${all.length} applaudissements, jamais plus de ${Math.max(0, ...r.waves.map((w) => w.length))} par salve (≤ n ${A.n}), jamais le gardien (${ok1}), les deux d'une salve partent décalés (écarts ${gaps.map((g) => g.toFixed(2)).join('/') || '—'} s ≥ 0,25)`,
    pleines >= 3 && pleines <= 8 && r.waves.every((w) => w.length <= A.n) && ok1 && gaps.every((g) => g >= 0.24));
  const who = {}; for (const e of all) who[e.by] = (who[e.by] ?? 0) + 1;
  ok(`…et pas toujours les mêmes : ${Object.keys(who).length} applaudisseurs distincts pour ${all.length} applaudissements (max ${Math.max(0, ...Object.values(who))} par corps)`, Object.keys(who).length >= Math.min(3, all.length) && Math.max(0, ...Object.values(who)) <= Math.max(2, Math.ceil(all.length / 2)));
  const n = salves({ petitsGestes: null });
  ok(`applaudir:null — aucun applaudissement (${n.waves.flat().length})`, n.waves.flat().length === 0);
  // le match : occasionnel (3-20 par 300 s), jamais trois en une seconde
  const { st, cfg } = monde({}); for (let i = 0; i < 60 * 300; i++) matchStep(st, 1 / 60, cfg);
  const g = st.events.filter((e) => e.type === 'geste' && e.move === 'applaudir'); let trois = 0; for (let i = 2; i < g.length; i++) if (g[i].t - g[i - 2].t < 1) trois++;
  const occ = {}; for (const e of g) occ[e.occasion] = (occ[e.occasion] ?? 0) + 1;
  ok(`LE MATCH (300 s) : ${g.length} applaudissements (occasionnel : 3-20), occasions ${JSON.stringify(occ)}, jamais trois en une seconde (${trois})`, g.length >= 3 && g.length <= 20 && trois === 0);
}
console.log(`petits-gestes : ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
