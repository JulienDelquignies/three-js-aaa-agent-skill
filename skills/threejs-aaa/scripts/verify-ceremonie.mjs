// verify-ceremonie.mjs — L'AVANT-MATCH ET LES GESTES SOCIAUX (Animations_A_Faire § 7 = A11 ter, cfg.ceremonie ; ceremonie.js, note 381).
// La file des poignées avant le premier engagement (l'équipe qui n'engage pas en rangée le long de la médiane, l'autre qui défile et
// serre chaque main — événement 'poignee', les deux se regardent), l'engagement qui attend les places, l'horloge qui part au coup
// d'envoi (la cérémonie n'est pas un arrêt de jeu) ; le salut au public au sifflet final ('salut', chacun tourné vers la tribune) ;
// la carte tenue 0,3 s de plus. Hier : l'engagement à 0,4 s, sans un geste. null : l'hier au bit.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { ARBITRE_KINDS } from '../assets/starter/src/engine/motion-arbitre.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const hyp = Math.hypot;

// LA FIXTURE : un match plein, une période de 40 s ; on note les événements, le regard des deux hommes 0,3 s après chaque poignée,
// la distance de chacun à sa place d'engagement à la prise, l'orientation 0,6 s après chaque salut.
const T0 = matchCfg({}).temps;   // le temps additionnel MINIMUM de 60 s du match plein (cfg.temps.additionnel.min) ferait durer la période de 40 s plus de 100 s : épinglé à 0 dans la fixture (la loi d'ajout ×0,35 reste)
const joue = (over, secs, seed = 3) => {
  const st = makeMatch({ full: true, seed }); const cfg = matchCfg({ chrono: { periodes: 1, duree: 40, pause: 4 }, temps: { ...T0, additionnel: { ...T0.additionnel, min: 0 } }, petitsGestes: null, passements: null, enchainement: null /* DATÉ 16/09 (§ 10) */, ...over });
  const spots0 = st.players.map((q) => [q.p[0], q.p[2]]);
  const E = { poignees: [], pris: [], saluts: [], cere: [], fin: null, add: null }, pend = [], regards = [], salutSin = []; let seen = 0, prisPos = null, arretsPris = null, tPris = null;
  for (let i = 0; i < secs * 60; i++) {
    matchStep(st, 1 / 60, cfg);
    for (; seen < st.events.length; seen++) { const e = st.events[seen];
      if (e.type === 'poignee') { E.poignees.push(e); pend.push({ a: e.by, b: e.avec, at: st.t + 0.4 }); }
      else if (e.type === 'restart-pris') { E.pris.push(e); if (E.pris.length === 1) { prisPos = st.players.map((q) => hyp(q.p[0] - spots0[q.id][0], q.p[2] - spots0[q.id][1])); arretsPris = st._chrono?.arrets ?? 0; tPris = st.t; } }
      else if (e.type === 'salut') { E.saluts.push(e); pend.push({ salut: e.by, at: st.t + 0.6 }); }
      else if (e.type === 'ceremonie') E.cere.push(e);
      else if (e.type === 'fin-de-match') E.fin = e; else if (e.type === 'temps-additionnel') E.add = e; }
    for (let k = pend.length - 1; k >= 0; k--) { const p = pend[k]; if (st.t < p.at) continue; pend.splice(k, 1);
      if (p.salut != null) { salutSin.push(Math.sin(st.players[p.salut].yaw)); continue; }
      const A = st.players[p.a], B = st.players[p.b], dx = B.p[0] - A.p[0], dz = B.p[2] - A.p[2], d = hyp(dx, dz) || 1;
      regards.push({ d, cosA: (Math.cos(A.yaw) * dx + Math.sin(A.yaw) * dz) / d, cosB: -(Math.cos(B.yaw) * dx + Math.sin(B.yaw) * dz) / d }); }
  }
  return { st, E, regards, prisPos, arretsPris, tPris, salutSin, C: st._ceremonie ?? null };
};
const K = matchCfg({}).ceremonie;
const part = (arr, f) => arr.length ? arr.filter(f).length / arr.length : 0;

console.log('— (a) la file des poignées avant le premier engagement —');
const r = joue({}, 100);
{
  const n = r.E.cere[0]?.n ?? 0, places = r.E.cere.find((e) => e.kind === 'places');
  ok(`LA FILE (cfg.ceremonie.poignee) : la cérémonie s'ouvre au premier pas (${r.E.cere[0] ? r.E.cere[0].t + ' s, ' + r.E.cere[0].kind : 'jamais'}), ${r.E.poignees.length} poignées (${n} × ${n}), les places rejointes après ${places?.duree ?? '—'} s, le premier engagement pris à ${r.tPris?.toFixed(1) ?? '—'} s (hier : 0,4 s)`,
    r.E.cere[0]?.kind === 'file' && r.E.cere[0].t < 0.1 && n >= 11 && r.E.poignees.length === n * n && !!places && r.tPris != null && r.tPris > 12 && r.tPris < 45);
  ok(`LES DEUX SE REGARDENT : 0,4 s après chaque poignée, les deux hommes à ≤ 1,1 m (${(100 * part(r.regards, (g) => g.d <= 1.1)).toFixed(0)} %), face à face (cos ≥ 0,6 : ${(100 * part(r.regards, (g) => g.cosA >= 0.6 && g.cosB >= 0.6)).toFixed(0)} % des ${r.regards.length} paires — la file ${(100 * part(r.regards, (g) => g.cosA >= 0.6)).toFixed(0)} %, la rangée ${(100 * part(r.regards, (g) => g.cosB >= 0.6)).toFixed(0)} %)`,
    r.regards.length === r.E.poignees.length && part(r.regards, (g) => g.d <= 1.1) >= 0.9 && part(r.regards, (g) => g.cosA >= 0.6 && g.cosB >= 0.6) >= 0.9);
  const loin = r.prisPos ? r.prisPos.filter((d) => d > 2.5).length : 99;
  ok(`À LA PRISE, chacun à sa place d'engagement (${loin} homme(s) à plus de 2,5 m de sa place de construction — le preneur et le second homme du rond ont leur place propre ; le plus loin ${r.prisPos ? Math.max(...r.prisPos).toFixed(1) : '—'} m)`, loin === 0);
  ok(`L'HORLOGE : la cérémonie n'est pas un arrêt de jeu (arrêts comptés à la prise : ${r.arretsPris?.toFixed(1) ?? '—'} s), la période de 40 s part au coup d'envoi (fin de match à ${r.E.fin?.t ?? '—'} s ≥ ${r.C ? (r.C.fin + 40).toFixed(1) : '—'})`,
    r.arretsPris != null && r.arretsPris < 2.5 && !!r.E.fin && r.C && r.E.fin.t >= r.C.fin + 40 - 0.05);
}
console.log('\n— (b) le salut au public au sifflet final —');
{
  const n = r.st.players.filter((q) => !q.expulse && !q._sub).length, dernier = r.E.saluts.length ? Math.max(...r.E.saluts.map((e) => e.t)) : null;
  ok(`LE SALUT (cfg.ceremonie.salut) : ${r.E.saluts.length} saluts pour ${n} joueurs après le sifflet final (${r.E.fin?.t ?? '—'} s), le dernier ${dernier != null && r.E.fin ? (dernier - r.E.fin.t).toFixed(1) : '—'} s après ; tournés vers la tribune 0,6 s après (sin(yaw) ≥ 0,7 : ${(100 * part(r.salutSin, (s) => s >= 0.7)).toFixed(0)} %)`,
    r.E.saluts.length === n && dernier != null && dernier - r.E.fin.t < 6 && part(r.salutSin, (s) => s >= 0.7) >= 0.9);
  ok(`LA CARTE est tenue 0,3 s de plus (carton : ${ARBITRE_KINDS.carton.duration} s, tenue ${ARBITRE_KINDS.carton.hold} — hier 2,0 / 1,55), le bras tendu au-dessus de la tête inchangé (elev ${ARBITRE_KINDS.carton.elev})`, ARBITRE_KINDS.carton.duration === 2.3 && ARBITRE_KINDS.carton.hold === 1.85 && ARBITRE_KINDS.carton.elev === 176);
}
console.log('\n— (c) la clé absente rend l\'hier ; le sabotage est attrapé —');
{
  const h = joue({ ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null }, 50);
  ok(`LA CLÉ ABSENTE : ceremonie:null — aucune cérémonie, aucune poignée, aucun salut (${h.E.cere.length} / ${h.E.poignees.length} / ${h.E.saluts.length}), l'engagement pris à ${h.tPris?.toFixed(2) ?? '—'} s (hier), la fin de match à ${h.E.fin?.t ?? '—'} s`,
    h.E.cere.length === 0 && h.E.poignees.length === 0 && h.E.saluts.length === 0 && h.tPris != null && h.tPris < 3 && !!h.E.fin && h.E.fin.t < 50);
  const s = joue({ ceremonie: { ...K, poignee: { ...K.poignee, rang: 3 } } }, 40);
  ok(`sabotage « la rangée à 3 m de la médiane » attrapé (les deux files à 6 m : à ≤ 1,1 m ${(100 * part(s.regards, (g) => g.d <= 1.1)).toFixed(0)} % des ${s.regards.length} paires — aucune main ne se joint)`, s.regards.length > 0 && part(s.regards, (g) => g.d <= 1.1) < 0.5);
}
{ // (note 387) le salut final mélange saluer et applaudir : un joueur sur deux applaudit (S.applaudir)
  const r = joue({}, 100); const E = r.E; const sal = (E.saluts ?? []).filter((e) => e && e.type === 'salut'), app = sal.filter((e) => e.geste === 'applaudir');
  ok(`LE SALUT MÊLÉ (ceremonie.salut.applaudir) : ${sal.length} saluts, dont ${app.length} applaudissent (attendu ~la moitié : ${Math.floor(sal.length / 2)})`, sal.length >= 10 && app.length === Math.floor(sal.length / 2));
}
console.log(`\ncérémonie : ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
