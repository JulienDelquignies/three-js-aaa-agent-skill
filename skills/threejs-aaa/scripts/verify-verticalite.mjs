// verify-verticalite.mjs — LA VERTICALITÉ (cfg.verticalite ; note 396). Retour utilisateur du 17/09 : « jamais de passes en profondeur quand il
// y a de l'espace, beaucoup de longues passes en retrait ». Mesuré (4 × 300 s) : 76 occasions de profondeur (un coéquipier EN JEU à ≥ 8 m
// devant, dans les 14 m avant la ligne, libre à 4 m, rien devant lui), 7 prises ; les occasions vivaient à 27-64 m — HORS du vocabulaire
// (passRange 13 m) ; le point doux 10 m du rondo (−0,32/m) enterrait la passe qui avance ; 29 % de BACK_SAFE. La loi (rondo.choosePass) :
// (a) la passe qui AVANCE rend le point doux jusqu'à plafond m ; (b) L'ESPACE DEVANT vaut espace et a SA portée (portee m) ; (c) le RETRAIT
// du porteur LIBRE (personne à libre m) se paie ; (d) le LONG retrait (> dosLong m) se paie même pressé — jamais la sortie au gardien, le
// relais du une-deux, la bascule ni la course servie. null : le barème d'hier au bit.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { choosePass } from '../assets/starter/src/engine/rondo.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const hyp = Math.hypot;
const PINS = { decalage: null, toucheOrientee: null };   // les clés sœurs du 17/09, nulles ; orientationPasse reste (elle vit avec)

// LE MATCH : les passes longues qui avancent (≥ 15 m, ≥ 8 m de gain), les longs retraits (≥ 12 m de recul), les pertes
const match = (over, seeds = [3, 7, 11, 15], secs = 300) => {   // 4 graines : à 2 la variance des pertes noyait la clause du monde
  const R = { passes: 0, longuesAvant: 0, retraitLong: 0, pertes: 0, tirs: 0 };
  for (const seed of seeds) {
    const st = makeMatch({ full: true, seed }), cfg = matchCfg({ ...PINS, ...over });
    for (let i = 0; i < 60 * secs; i++) {
      const n0 = st.events.length; matchStep(st, 1 / 60, cfg);
      for (const e of st.events.slice(n0)) if (e.type === 'pass' && e.to >= 0) {   // la géométrie se lit à la passe : l'événement porte la classe, pas la longueur
        R.passes++; const p = st.players[e.by], to = st.players[e.to]; const sg = Math.sign(st.pitch.attackGoal(p.team).x || 1);
        const gain = (to.p[0] - p.p[0]) * sg, d = hyp(to.p[0] - p.p[0], to.p[2] - p.p[2]);
        if (d >= 15 && gain >= 8) R.longuesAvant++;
        if (gain < -12) R.retraitLong++;
      }
    }
    R.pertes += st.turnovers ?? 0; R.tirs += st.events.filter((e) => e.type === 'shot').length;
  }
  return R;
};

console.log('— (a) le match : la passe qui avance existe, le long retrait recule —');
const A = match({}), N = match({ verticalite: null });
ok(`LES PASSES LONGUES QUI AVANCENT (≥ 15 m, ≥ 8 m de gain) : ${A.longuesAvant} avec la clé (4 × 300 s, graines 3-15) contre ${N.longuesAvant} hier — au moins 1,2 × hier`, A.longuesAvant >= N.longuesAvant * 1.2);
ok(`LES LONGS RETRAITS (≥ 12 m de recul) : ${A.retraitLong} avec la clé contre ${N.retraitLong} hier — pas plus qu'hier`, A.retraitLong <= N.retraitLong);
ok(`LE MONDE ÉCHANGE DES PASSES CONTRE DES TIRS : ${A.tirs} tirs, ${A.pertes} pertes pour ${A.passes} passes (${(A.pertes / A.passes).toFixed(2)} par passe) avec la clé contre ${N.tirs} tirs, ${N.pertes} pour ${N.passes} hier (${(N.pertes / N.passes).toFixed(2)}) — au moins autant de tirs qu'hier + 3, au plus 1,7 × + 0,02 pertes par passe (mesuré dans ce monde : 1 → 13 tirs, 0,34 → 0,53 ; avec toutes les clés du 17/09 le rapport retombe à 0,44 c. 0,42)`, A.tirs >= N.tirs + 3 && A.pertes / A.passes <= N.pertes / N.passes * 1.7 + 0.02);

// LA FIXTURE : le porteur libre au milieu, un avant LIBRE dans l'espace à 22 m devant (en jeu : la ligne défensive est 4 m devant lui), un défenseur libre 12 m derrière, une ligne adverse
const fixture = (over) => {
  const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg({ ...PINS, ...over });
  for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
  if (st.ball.owner != null) st.ball.release('perte');
  for (const q of st.players) { q.p[0] = -40 - (q.id % 11) * 1.5; q.p[2] = q.team ? 28 : -28; q.v = [0, 0]; q.act = null; q.job = 'walk'; q.target = [q.p[0], 0, q.p[2]]; q.intent = null; q._pace = null; }
  const sg = Math.sign(st.pitch.attackGoal(0).x || 1), yaw0 = sg > 0 ? 0 : Math.PI;
  const mates = st.players.filter((q) => q.team === 0 && !q.keeper), A = mates[0], AV = mates[1], DEF = mates[2], LAT = mates[3];
  A.p[0] = -5 * sg; A.p[2] = 0; A.yaw = yaw0; A.v = [0, 0]; A.speed = 0; A.job = 'carry';
  AV.p[0] = A.p[0] + 22 * sg; AV.p[2] = 2; AV.yaw = yaw0; AV.v = [0, 0];            // l'avant libre dans l'espace
  DEF.p[0] = A.p[0] - 12 * sg; DEF.p[2] = -3; DEF.yaw = yaw0; DEF.v = [0, 0];       // le défenseur libre derrière
  LAT.p[0] = A.p[0] + 1 * sg; LAT.p[2] = 9; LAT.yaw = yaw0; LAT.v = [0, 0];         // la latérale courte
  const foes = st.players.filter((q) => q.team === 1 && !q.keeper); const lP = [[A.p[0] + 30 * sg, -12], [A.p[0] + 30 * sg, -4], [A.p[0] + 30 * sg, 4], [A.p[0] + 30 * sg, 12], [A.p[0] + 8 * sg, -9], [A.p[0] + 8 * sg, 9]];   // la ligne 8 m devant l'avant (devant 6), deux milieux loin du couloir
  lP.forEach((pt, k) => { const q = foes[k]; q.p[0] = pt[0]; q.p[2] = pt[1]; q.yaw = yaw0 + Math.PI; q.v = [0, 0]; });
  st.ball.restart([A.p[0] + 0.35 * sg, 0.11, 0], { cause: 'engagement' }); st.restart = null; st.ball.possess(A.id); st.possession = { team: 0, carrier: A.id }; st.phase = 'carry'; st.hold = 1.5; st.lastTouch = 0;
  const ch = choosePass(st, cfg);
  return { ch, AV, DEF, LAT, to: ch ? (ch.to.id === AV.id ? 'avant' : ch.to.id === DEF.id ? 'défenseur' : ch.to.id === LAT.id ? 'latéral' : 'autre ' + ch.to.id) : 'rien', d: ch ? ch.dist.toFixed(1) : null, cls: ch?.cls };
};

console.log('— (b) la fixture : l\'avant libre dans l\'espace est l\'élu —');
{
  const r = fixture({});
  ok(`LE PORTEUR LIBRE, un avant libre à 22 m devant (en jeu, 8 m devant la ligne), un défenseur libre à 12 m derrière, une latérale à 9 m : l'élu est ${r.to} (${r.d} m, ${r.cls ?? '—'}) — l'avant`, r.to === 'avant');
  const n = fixture({ verticalite: null });
  ok(`verticalite:null — le même monde : l'élu est ${n.to} (${n.d} m, ${n.cls ?? '—'}) — jamais l'avant (22 m > passRange 13 : hors du vocabulaire d'hier)`, n.to !== 'avant');
}

console.log('— (c) l\'espace devant casse la tenue (400, verticalite.appel) —');
{
  // la même fixture, la tenue calme d'origine (1,2-3 s) : l'élu dans l'espace part au holdMin, pas au bout de la tenue
  const KV = matchCfg({}).verticalite;
  const delai = (over) => {
    const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg({ ...PINS, croyance: null, ...over });   // croyance nulle : la fixture TÉLÉPORTE la défense — la couche de croyance du porteur mettait 1,5 s à la voir (la course refusait la passe sur des fantômes à 1 m) ; on mesure la tenue, pas la perception
    for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
    if (st.ball.owner != null) st.ball.release('perte');
    for (const q of st.players) { q.p[0] = -40 - (q.id % 11) * 1.5; q.p[2] = q.team ? 28 : -28; q.v = [0, 0]; q.act = null; q.job = 'walk'; q.target = [q.p[0], 0, q.p[2]]; q.intent = null; q._pace = null; }
    const sg = Math.sign(st.pitch.attackGoal(0).x || 1), yaw0 = sg > 0 ? 0 : Math.PI;
    const mates = st.players.filter((q) => q.team === 0 && !q.keeper), A = mates[0], AV = mates[1], DEF = mates[2], LAT = mates[3];
    A.p[0] = -5 * sg; A.p[2] = 0; A.yaw = yaw0; A.v = [0, 0]; A.speed = 0; A.job = 'carry';
    const pts = [[AV, A.p[0] + 16 * sg, 2], [DEF, A.p[0] - 12 * sg, -3], [LAT, A.p[0] + 1 * sg, 9]]; for (const [q, x, z] of pts) { q.p[0] = x; q.p[2] = z; q.yaw = yaw0; q.v = [0, 0]; }   // l'avant à 16 m (> passRange 13 : il n'existe que par la portée de l'espace)
    const foes = st.players.filter((q) => q.team === 1 && !q.keeper); const lP = [[A.p[0] + 28 * sg, -12], [A.p[0] + 28 * sg, -4], [A.p[0] + 28 * sg, 4], [A.p[0] + 28 * sg, 12], [A.p[0] + 6 * sg, -14], [A.p[0] + 6 * sg, 14]];   // la ligne 12 m derrière l'avant (dans zone 14, hors de la course des défenseurs), les milieux loin du couloir
    lP.forEach((pt, k) => { const q = foes[k]; q.p[0] = pt[0]; q.p[2] = pt[1]; q.yaw = yaw0 + Math.PI; q.v = [0, 0]; });
    st.ball.restart([A.p[0] + 0.35 * sg, 0.11, 0], { cause: 'engagement' }); st.restart = null; st.ball.possess(A.id); st.possession = { team: 0, carrier: A.id }; st.phase = 'carry'; st.hold = 0; st.lastTouch = 0;
    const n0 = st.events.length, t0 = st.t; let ev = null;
    for (let i = 0; i < 60 * 5; i++) { for (const [q, x, z] of pts) { q.p[0] = x; q.p[2] = z; q.v = [0, 0]; } lP.forEach((pt, k) => { const q = foes[k]; q.p[0] = pt[0]; q.p[2] = pt[1]; q.v = [0, 0]; q.act = null; }); matchStep(st, 1 / 60, cfg); ev = st.events.slice(n0).find((e) => e.type === 'pass' && e.by === A.id); if (ev) break; }
    return ev ? { delai: +(ev.t - t0).toFixed(2), to: ev.to === AV.id ? 'avant' : 'autre', esp: !!ev.esp } : null;
  };
  const a = delai({}), n = delai({ verticalite: { ...KV, appel: false } });
  ok(`L'AVANT LIBRE DANS L'ESPACE À 16 m, la tenue calme d'origine : la passe part en ${a ? a.delai + ' s vers l\'' + a.to : 'jamais en 5 s'} avec la clé contre ${n ? n.delai + ' s vers l\'' + n.to : 'jamais en 5 s'} sans appel — en ≤ 0,9 s vers l'avant, et plus tard sans (la tenue calme retenait l'armé)`,
    !!a && a.to === 'avant' && a.delai <= 0.9 && (!n || n.delai > a.delai + 0.3));
}

console.log(`verticalite : ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
