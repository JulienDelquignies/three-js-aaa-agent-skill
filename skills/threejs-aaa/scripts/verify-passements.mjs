// verify-passements.mjs — LES PASSEMENTS DE JAMBES NOURRIS (cfg.passements ; note 385). Diagnostic du 16/09 : le cercle du générateur est
// bon (la cheville passe à 25-30 cm au-dessus du ballon) mais le geste était AFFAMÉ (1 en 15 min de match : le porteur reçoit hors du
// presseur et conduit ballon devant, les défenseurs chargent plus qu'ils ne jockeyent) et le ballon était calé là où il traînait au
// contact, pas au point que le clip attend (le pied d'appui finissait dans le ballon). Sous la clé : le jockey jusqu'à foe m, le porteur
// posé qui FIXE un vis-à-vis au demi-front large, une charge jusqu'à charge m/s, le ballon jusqu'à ballon m ramené au point du clip
// (spot devant, lat de côté) dès l'entrée, l'envie × envie sur un plancher d'appétit. null : l'hier au bit.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const hyp = Math.hypot, wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const KP = matchCfg({}).passements;
const PINS = { ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null };
const monde = (over) => { const st = makeMatch({ full: true, seed: 3 }); const cfg = matchCfg({ ...PINS, ...over }); for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg); return { st, cfg }; };

// LA FIXTURE : tout le monde parqué, le porteur A posé face à +x avec le ballon au pied, le jockey F posté devant à `d` m, au relèvement `bear` °
const faceAFace = (over, { d = 1.7, bear = 0, secs = 12 } = {}) => {
  const { st, cfg } = monde(over);
  if (st.ball.owner != null) st.ball.release('perte');
  for (const q of st.players) { q.p[0] = -40 - (q.id % 11) * 1.5; q.p[2] = q.team ? 28 : -28; q.v = [0, 0]; q.act = null; q.job = 'walk'; q.target = [q.p[0], 0, q.p[2]]; if (q._skillCd) q._skillCd.passement = -1; }
  const A = st.players.filter((q) => q.team === 0 && !q.keeper).sort((a, b) => ((b.persona?.flair ?? 0.5) * (b.skill?.gesteF ?? 1)) - ((a.persona?.flair ?? 0.5) * (a.skill?.gesteF ?? 1)))[0];
  const F = st.players.find((q) => q.team === 1 && !q.keeper);
  const a = bear * Math.PI / 180;
  A.p[0] = 5; A.p[2] = 0; A.yaw = 0; A.yawWant = 0; A.v = [0, 0]; A.job = 'carry'; A.target = [5.4, 0, 0]; A.intent = null;
  F.p[0] = 5 + Math.cos(a) * d; F.p[2] = Math.sin(a) * d; F.yaw = Math.PI + a; F.yawWant = F.yaw; F.v = [0, 0]; F.job = 'walk'; F.target = [F.p[0], 0, F.p[2]];
  st.ball.restart([5.35, 0.11, 0], { cause: 'engagement' }); st.restart = null; st.ball.possess(A.id); st.possession = { team: 0, carrier: A.id }; st.phase = 'carry'; st.hold = 1;
  const n0 = st.events.length; let ev = null, windup = null, regard = null, regardAt = null, pinAtStart = null, ballAtContact = null, ApAtContact = null, yawAtStart = null, contact = null;
  for (let i = 0; i < 60 * secs; i++) {
    for (const q of st.players) if (q !== A && q !== F) { q.p[0] = -40 - (q.id % 11) * 1.5; q.p[2] = q.team ? 28 : -28; q.v = [0, 0]; q.act = null; }   // parqués CHAQUE image : un coéquipier qui arrive au ballon casse la fixture
    if (!A.act) { A.p[0] = 5; A.p[2] = 0; A.v = [0, 0]; if (A._regard == null) A.yaw = 0; if (st.ball.owner !== A.id) { if (st.ball.owner != null) st.ball.release('perte'); st.ball.possess(A.id); } }
    F.p[0] = 5 + Math.cos(a) * d; F.p[2] = Math.sin(a) * d; F.v = [0, 0]; F.yaw = Math.PI + a;
    matchStep(st, 1 / 60, cfg);
    if (regard == null && A._regard != null) { regard = A._regard; regardAt = st.t; }
    if (!ev) { ev = st.events.slice(n0).find((e) => e.type === 'skill' && e.kind === 'passement'); if (ev) { windup = st.events.slice(n0).find((e) => e.type === 'windup' && e.skill === 'passement'); pinAtStart = A.act?.payload?.pin ? [...A.act.payload.pin] : null; yawAtStart = A.yaw; } }
    else if (!contact) { contact = st.events.slice(n0).find((e) => e.type === 'skill' && e.kind === 'passement-vendu'); if (contact) { ballAtContact = [st.ball.p[0], st.ball.p[2]]; ApAtContact = [A.p[0], A.p[2]]; } }
    if (contact && st.t > contact.t + 0.8) break;
  }
  // le ballon au contact, dans le repère du porteur (devant, à droite)
  const rel = ballAtContact && yawAtStart != null ? (() => { const dx = ballAtContact[0] - ApAtContact[0], dz = ballAtContact[1] - ApAtContact[1]; return { devant: dx * Math.cos(yawAtStart) + dz * Math.sin(yawAtStart), droite: -dx * Math.sin(yawAtStart) + dz * Math.cos(yawAtStart), auPin: pinAtStart ? hyp(ballAtContact[0] - pinAtStart[0], ballAtContact[1] - pinAtStart[1]) : null }; })() : null;
  return { A, F, ev, foot: windup?.foot, regard, regardAt, pinAtStart, ballAtContact, rel, contact, tStart: ev?.t };
};

console.log('— (a) le ballon calé au point du clip —');
{
  const r = faceAFace({});
  const s = r.foot === 'right' ? 1 : -1;
  ok(`LE FACE-À-FACE POSÉ déclenche le passement (${r.ev ? `${r.ev.tours} tour(s), sortie ${r.ev.sortie}, pied ${r.foot}, jockey à ${r.ev.foe} m` : 'rien'}) avec le point du clip posé DÈS L'ENTRÉE (pin ${r.pinAtStart ? r.pinAtStart.map((v) => v.toFixed(2)).join(', ') : '—'})`,
    !!r.ev && !r.ev.enCourse && !!r.pinAtStart);
  ok(`…et au contact le ballon est AU POINT DU CLIP : à ${r.rel?.auPin != null ? (100 * r.rel.auPin).toFixed(1) : '—'} cm du pin (≤ 6), soit ${r.rel ? `${r.rel.devant.toFixed(2)} m devant (spot ${KP.spot}), ${r.rel.droite.toFixed(2)} m à droite (lat ${KP.lat} × ${s})` : '—'}`,
    !!r.rel && r.rel.auPin < 0.06 && Math.abs(r.rel.devant - KP.spot) < 0.08 && Math.abs(r.rel.droite - KP.lat * s) < 0.08);
  const n = faceAFace({ passements: null });
  ok(`passements:null — le même face-à-face : ${n.ev ? 'passement' : 'pas de passement'}, pin à l'entrée ${n.pinAtStart ? 'posé' : 'absent'} (hier : le ballon calé au contact là où il traîne${n.rel ? ` — ${n.rel.devant.toFixed(2)} m devant` : ''})`, !n.pinAtStart);
}

console.log('— (b) il fixe son vis-à-vis —');
{
  const r = faceAFace({}, { bear: 85, d: 1.9 });
  const vers = r.regard != null ? Math.abs(wrap(r.regard - Math.atan2(r.F.p[2] - 0, r.F.p[0] - 5))) * 180 / Math.PI : null;
  ok(`LE JOCKEY AU DEMI-FRONT LARGE (85°) : le porteur posé TOURNE LE REGARD vers lui (regard tenu ${r.regard != null ? r.regard.toFixed(2) + ' rad, ' + vers.toFixed(0) + '° du jockey' : 'absent'}) puis le passement part face (${r.ev ? `à ${(r.ev.t - r.regardAt).toFixed(2)} s du regard, relèvement ${r.ev.bearing}°` : 'jamais'})`,
    r.regard != null && vers < 5 && !!r.ev && r.ev.bearing <= 70 && r.ev.t - r.regardAt <= 1.6);
  const n = faceAFace({ passements: null }, { bear: 85, d: 1.9 });
  ok(`passements:null — au demi-front large, aucun regard tenu (${n.regard == null ? 'nul' : n.regard.toFixed(2)}), ${n.ev ? 'un passement' : 'pas de passement'} (hier : bearing > 70 refusé)`, n.regard == null && !n.ev);
}

console.log('— (c) le match nourri —');
{
  const compte = (over, seed = 3) => { const st = makeMatch({ full: true, seed }), cfg = matchCfg({ ...PINS, ...over }); for (let i = 0; i < 60 * 300; i++) matchStep(st, 1 / 60, cfg); const ev = st.events.filter((e) => e.type === 'skill' && e.kind === 'passement'); return { n: ev.length, poses: ev.filter((e) => !e.enCourse).length, tours: ev.map((e) => e.tours).join('/'), vendus: st.events.filter((e) => e.type === 'skill' && e.kind === 'passement-vendu' && e.bitten?.length).length }; };
  const a = compte({}), n = compte({ passements: null });
  ok(`LE MATCH NOURRI : ${a.n} passements en 300 s (graine 3 ; ${a.poses} posés, tours ${a.tours || '—'}, ${a.vendus} jockeys qui mordent) contre ${n.n} hier (mesuré 4 graines : 3 par match, 1 par 15 min hier)`, a.n >= 2 && a.n >= n.n);
}

console.log(`passements : ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
