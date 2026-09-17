// verify-bouclier.mjs — LA TENUE DE BALLE DOS AU BUT (Animations_A_Faire § 9 = A10 ter, cfg.bouclier ; bouclier.js, note 379).
// Le porteur pressé dans le dos (un adversaire côté but à ≤ pression m, derrière son regard), posé, sans appui, TIENT : il
// s'arrête, met son corps entre le ballon et le presseur, le ballon porté au pied — jusqu'à l'appui (une passe passe la barre,
// après min s), la POUSSÉE dans le dos (le presseur collé < contact m plus de pousse s, un tirage), le relâcher, l'expiration.
// Contrat : la distance adversaire-ballon ne descend pas sous 0,6 m pendant la tenue. Hier : la conduite ou le retournement,
// le ballon libre entre les touches à portée du presseur. null : l'hier au bit.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const hyp = Math.hypot;

// LA FIXTURE : le monde vidé (les siens parqués à 60 m derrière : aucun appui ; la défense adverse posée sur sa ligne de but), le
// porteur (équipe 0) à 22 m du but adverse, dos au but (le regard vers son camp), le ballon au pied ; le presseur (équipe 1) à dP m dans son dos,
// côté but, au pressing. On joue secs s ; appuiAt : un coéquipier libre téléporté sur son flanc (5 m de côté, 1,9 m en retrait — pas une remise arrière) à cette seconde ; lacheAt : le
// presseur retiré. On rend la tenue vécue et sa mesure (distance mini adversaire-ballon, vitesse du porteur, le presseur dans le dos).
const tenue = (over, { dP = 0.9, secs = 4, appuiAt = null, lacheAt = null, seed = 3 } = {}) => {
  const st = makeMatch({ full: true, seed }); const cfg = matchCfg({ ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, receveurOuvert: null,  repli: false, ...over });
  for (let i = 0; i < 120; i++) matchStep(st, 1 / 60, cfg);
  st.ball.release('arrêt-de-jeu');
  const g = st.pitch.attackGoal(0), sg = Math.sign(g.x || 1);
  for (const q of st.players) { q.p[0] = q.team ? g.x - sg * 3 : -30 - (q.id % 10) * 2; q.p[2] = q.team ? -30 + (q.id % 10) * 6 : -25; q.v[0] = 0; q.v[1] = 0; q.act = null; q.intent = null; }   // les siens loin derrière (aucun appui), la défense adverse sur sa ligne de but (le porteur n'est pas « lancé » derrière la dernière ligne : la passe arrière reste permise)
  st.ball.impulse([-st.ball.v[0], -st.ball.v[1], -st.ball.v[2]]);
  const C = st.players.find((q) => q.team === 0 && !q.keeper), D = st.players.find((q) => q.team === 1 && !q.keeper);
  C.p[0] = g.x - sg * 22; C.p[2] = 0; C.yaw = Math.atan2(0, -sg); C.v[0] = 0; C.v[1] = 0; C.yawWant = null;
  st.ball.restart([C.p[0] - sg * 0.35, 0.11, 0], { cause: 'engagement' }); st.ball.possess(C.id);
  st.restart = null; st.phase = 'carry'; st.possession = { team: 0, carrier: C.id }; st.hold = 0; st.lastTouch = 0; st.pass = null;
  D.p[0] = C.p[0] + sg * dP; D.p[2] = 0; D.v[0] = 0; D.v[1] = 0; D.job = 'press'; D.target = [st.ball.p[0], 0, st.ball.p[2]];
  const n0 = st.events.length, t0 = st.t; let B0 = null, B1 = null, dMin = Infinity, dAll = Infinity, vMax = 0, dosMin = Infinity, appui = null; const dD = [];
  const dAdv = () => Math.min(...st.players.filter((q) => q.team === 1 && q.down <= 0).map((q) => hyp(q.p[0] - st.ball.p[0], q.p[2] - st.ball.p[2])));
  for (let i = 0; i < 60 * secs; i++) {
    if (appuiAt != null && st.t - t0 >= appuiAt && !appui) { appui = st.players.find((q) => q.team === 0 && !q.keeper && q.id !== C.id); appui.p[0] = C.p[0] - sg * 1.9; appui.p[2] = 5; appui.v[0] = 0; appui.v[1] = 0; appui.job = 'support'; }
    if (lacheAt != null && st.t - t0 >= lacheAt) { D.p[0] = -40; D.p[2] = 25; D.v[0] = 0; D.v[1] = 0; }
    matchStep(st, 1 / 60, cfg);
    if (st.t - t0 <= 2) dAll = Math.min(dAll, dAdv());
    if (C._bouclier) {
      if (B0 == null) B0 = st.t; B1 = st.t;
      dMin = Math.min(dMin, dAdv()); if (st.t - B0 > 0.3) vMax = Math.max(vMax, hyp(C.v[0], C.v[1]));
      const dx = D.p[0] - C.p[0], dz = D.p[2] - C.p[2], d = hyp(dx, dz) || 1; dosMin = Math.min(dosMin, -(Math.cos(C.yaw) * dx + Math.sin(C.yaw) * dz) / d); dD.push(d);
    }
  }
  const E = st.events.slice(n0), ev = (t, f = () => true) => E.find((e) => e.type === t && f(e)) ?? null;
  return { C, D, sg, t0, B0: B0 != null ? +(B0 - t0).toFixed(2) : null, B1: B1 != null ? +(B1 - t0).toFixed(2) : null, dMin: +dMin.toFixed(2), dAll: +dAll.toFixed(2), vMax: +vMax.toFixed(2), dosMin: +dosMin.toFixed(2), dDmed: dD.length ? +dD.sort((a, b) => a - b)[dD.length >> 1].toFixed(2) : null,
    owner: st.ball.owner, restart: st.restart ? JSON.stringify(st.restart).slice(0, 60) : null, bouclier: ev('bouclier'), faute: ev('faute', (e) => e.sur === C.id), avantage: ev('avantage') ?? ev('restart-pris'), passe: ev('pass', (e) => e.by === C.id && e.t >= (B0 ?? 0)) ?? ev('passe', (e) => e.by === C.id && e.t >= (B0 ?? 0)), duel: ev('duel', (e) => e.sur === C.id && B1 != null && e.t <= B1 + 1e-6),
    types: E.filter((e) => e.by === C.id || e.by === D.id || /bouclier|faute|siffl|coup|carton|avantage|remise|restart/.test(e.type)).map((e) => `${e.t}:${e.type}${e.by != null ? '@' + e.by : ''}${e.kind ? '/' + e.kind : ''}${e.issue ? '/' + e.issue : ''}${e.tech ? '/' + e.tech : ''}`).join(' ') };
};
const cfg = matchCfg({ ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, receveurOuvert: null, }), K = cfg.bouclier;

console.log('— (a) pressé dans le dos, sans appui : il TIENT, le corps entre le ballon et le presseur —');
{
  const r = tenue({ bouclier: { ...K, pFaute: 0 } });
  ok(`LA TENUE (cfg.bouclier) : la tenue s'engage à ${r.B0 ?? '—'} s, issue « ${r.bouclier?.issue ?? '—'} » après ${r.bouclier?.duree ?? '—'} s (max ${K.max}) ; pendant la tenue : le presseur dans son dos (cos mini ${r.dosMin}), à ${r.dDmed} m (médiane), la distance adversaire-ballon mini ${r.dMin} m (contrat ≥ 0,6), le porteur posé (v max ${r.vMax} m/s après 0,3 s), aucun duel d'épaule (${r.duel ? r.duel.kind : 'aucun'})`,
    r.B0 != null && r.B0 <= 0.6 && r.bouclier?.issue === 'expiree' && r.bouclier.duree >= K.max - 0.15 && r.dMin >= 0.6 && r.vMax <= 1.2 && r.dosMin > 0 && !r.duel, r.types.slice(0, 260));
}
console.log('\n— (b) l\'appui qui vient : la tenue rend le ballon —');
{
  const r = tenue({ bouclier: { ...K, pFaute: 0 } }, { appuiAt: 1.0 });
  ok(`L'APPUI : un coéquipier libre sur son flanc (5 m, 1,9 m en retrait) à 1,0 s — la tenue finit « ${r.bouclier?.issue ?? '—'} » à ${r.bouclier ? (r.bouclier.t - r.t0).toFixed(2) : '—'} s (durée ${r.bouclier?.duree ?? '—'} ≥ min ${K.min}), puis la passe part (${r.passe ? 'à ' + (r.passe.t - r.t0).toFixed(2) + ' s' : 'aucune'})`,
    r.bouclier?.issue === 'appui' && r.bouclier.duree >= K.min - 0.05 && r.bouclier.duree <= 1.8 && !!r.passe && r.passe.t - r.bouclier.t <= 1.2, r.types.slice(0, 260));
}
console.log('\n— (c) la poussée dans le dos : la faute —');
{
  const r = tenue({ bouclier: { ...K, pFaute: 1 } });
  ok(`LA POUSSÉE : le presseur collé plus de ${K.pousse} s — 'faute' poussée par le presseur (${r.faute ? r.faute.kind + ' à ' + (r.faute.t - r.t0).toFixed(2) + ' s' : 'aucune'}), la tenue finit « ${r.bouclier?.issue ?? '—'} », l'arbitre l'adjuge (${r.avantage ? 'avantage joué à ' + (r.avantage.t - r.t0).toFixed(2) + ' s' : r.restart ? 'coup franc posé' : 'RIEN'})`,
    r.faute?.kind === 'poussée' && r.faute.by === r.D.id && r.bouclier?.issue === 'faute' && r.faute.t - r.t0 >= (r.B0 ?? 0) + K.pousse - 0.05 && (!!r.restart || !!r.avantage), r.types.slice(0, 260));
}
console.log('\n— (d) le presseur qui lâche : la tenue se relâche —');
{
  const r = tenue({ bouclier: { ...K, pFaute: 0 } }, { lacheAt: 0.8 });
  ok(`LE RELÂCHER : le presseur retiré à 0,8 s — issue « ${r.bouclier?.issue ?? '—'} » après ${r.bouclier?.duree ?? '—'} s`,
    r.bouclier?.issue === 'relache' && r.bouclier.duree >= 0.5 && r.bouclier.duree <= 1.2, r.types.slice(0, 200));
}
console.log('\n— (e) la clé absente rend l\'hier ; les sabotages sont attrapés —');
{
  const r = tenue({ bouclier: null });
  ok(`LA CLÉ ABSENTE : bouclier:null — aucune tenue (${r.B0 == null && !r.bouclier ? 'aucune' : 'UNE'}) ; hier : distance adversaire-ballon mini ${r.dAll} m sur 2 s, ballon à ${r.owner === r.C.id ? 'lui' : r.owner == null ? 'personne' : 'l\'adversaire'} à 4 s`,
    r.B0 == null && !r.bouclier, r.types.slice(0, 200));
  const s = tenue({ bouclier: { ...K, pression: 0 } });
  ok(`sabotage « la pression à 0 m » attrapé (le presseur n'est jamais dans le dos : ${s.B0 == null ? 'aucune tenue' : 'tenue à ' + s.B0 + ' s'})`, s.B0 == null && !s.bouclier);
  const u = tenue({ bouclier: { ...K, pFaute: 1, contact: 0 } });
  ok(`sabotage « le contact à 0 m » attrapé (pFaute 1 : la tenue vit « ${u.bouclier?.issue ?? '—'} » mais aucune poussée n'est jugée : ${u.faute ? u.faute.kind : 'aucune faute'})`, !!u.bouclier && !u.faute);
}
console.log(`\nbouclier : ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
