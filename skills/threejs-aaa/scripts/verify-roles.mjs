#!/usr/bin/env node
// verify-roles.mjs — LE RÔLE DIT QUOI, ET ÇA SE PROUVE. Le poste dit où (formation), le rôle
// nuance (biais à identité par défaut), l'attribut dit comment ça réussit — trois couches
// composées. Les signatures de FLUX par joueur sont noyées par l'effet papillon (un rôle
// re-distribue tout le match — mesuré : six mondes, six récits) : le mécanisme se prouve sur
// FIXTURES (doctrine lot 8) — même monde, seul le rôle change, delta de cible exact.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { checkRoles, ROLES } from '../assets/starter/src/engine/roles.js';
import { arbitre } from '../assets/starter/src/engine/menace.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- 1. le contrat pur
{
  const c = checkRoles();
  ok(`le contrat des rôles tient (checkRoles : catalogue borné ±30 %, polyvalent identitaire, résolution honnête)`, c.ok, c.issues.join(' ; '));
}

// ---------- 2. l'IDENTITÉ : aucun rôle === polyvalent partout, octet pour octet
{
  const run = (roles) => {
    const st = makeMatch({ full: true, seed: 3, roles });
    const cfg = matchCfg({ shotRange: 20 });
    for (let i = 0; i < 60 * 60; i++) matchStep(st, 1 / 60, cfg);
    return JSON.stringify(st.events);
  };
  const tous = {}; for (let i = 0; i <= 9; i++) tous[i] = 'polyvalent';
  ok(`le DÉFAUT est l'identité (aucun rôle === dix polyvalents explicites, 60 s d'événements identiques — et la batterie des lots 10-15 reste verte au bit près)`,
    run(null) === run([tous, tous]));
}

// ---------- 3. le MÉCANISME sur fixture : même monde, seul le rôle change, delta de CIBLE exact
{
  const cible = (roleName, post = 8) => {
    const st = makeMatch({ full: true, seed: 5, roles: roleName ? [{ [post]: roleName }, null] : null });
    const cfg = matchCfg({ shotRange: 20 });
    const sgn = -st.pitch.ownGoal(0).sign;
    // une attaque POSÉE : porteur + 3 soutiens à l'ancre (les slotters), le joueur observé LOIN
    // (posté), la défense au large — le calage Loi 11 hors de portée (ligne haute)
    for (const q of st.players.filter((q) => q.team === 1)) q.p[0] = sgn * (q.keeper ? 51 : 44);
    const c0 = st.players.find((p) => p.team === 0 && p.post === 5);
    const near = st.players.filter((p) => p.team === 0 && !p.keeper && ![5, post].includes(p.post)).slice(0, 3);
    c0.p[0] = 0; c0.p[2] = 0;
    near.forEach((q, i) => { q.p[0] = 2; q.p[2] = (i - 1) * 3; });
    const obs = st.players.find((p) => p.team === 0 && p.post === post);
    obs.p[0] = sgn * 20; obs.p[2] = post === 7 ? 20 : 5;
    st.ball.restart([0.3, 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c0.id);
    st.possession = { team: 0, carrier: c0.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
    st._possChangeAt = st.t - 9; st._possTeam = 0;                 // attaque PLACÉE (pas une transition)
    matchStep(st, 1 / 60, cfg);
    return { x: obs.target[0] * sgn, z: Math.abs(obs.target[2]), job: obs.job };
  };
  const poly = cible(null), neuf = cible('neufDeSurface'), men = cible('meneur');
  ok(`la PROFONDEUR est un rôle (cible du 9 : polyvalent x ${poly.x.toFixed(1)}, neufDeSurface ${neuf.x.toFixed(1)} (+2 attendu), meneur ${men.x.toFixed(1)} (−1,75) — le 9 se tient haut, le 10 décroche, MÊME monde)`,
    neuf.x - poly.x >= 1.5 && poly.x - men.x >= 1.2, `jobs ${poly.job}/${neuf.job}/${men.job}`);
  const polyA = cible(null, 7), ailier = cible('ailierDePercussion', 7);
  ok(`la LARGEUR est un rôle (aile : polyvalent |z| ${polyA.z.toFixed(1)}, percussion ${ailier.z.toFixed(1)} — l'ailier craie la ligne, ×1,08)`,
    ailier.z - polyA.z >= 1);
}

// ---------- 4. l'ARBITRE lit le RÔLE : équipe neutre, monde serré — le rôle seul départage
// (dans une équipe DIRECTE (±35 %), le rôle (±15 %) ne renverse PAS le style : mesuré, et c'est
// le contrat — « un rôle nuance, il n'écrase pas » ; la composition équipe×rôle est prouvée par
// l'identité + le banc tactics)
{
  const monde = (roleName) => {
    const st = makeMatch({ full: true, seed: 5, roles: [{ 8: roleName }, null] });
    const sgn = -st.pitch.ownGoal(0).sign;
    const goal = st.pitch.attackGoal(0);
    for (const q of st.players.filter((q) => q.team === 1)) { q.p[0] = sgn * 20; q.p[2] = -25; }
    for (const q of st.players.filter((q) => q.team === 0 && !q.keeper)) { q.p[0] = -sgn * 20; q.p[2] = 25; }
    const gk1 = st.players.find((q) => q.team === 1 && q.keeper); gk1.p[0] = goal.x; gk1.p[2] = 0;
    const c = st.players.find((p) => p.team === 0 && p.post === 8);
    c.p[0] = goal.x - sgn * 11; c.p[2] = 0;
    const wall = st.players.filter((p) => p.team === 1 && !p.keeper).slice(0, 3);
    wall[0].p[0] = goal.x - sgn * 5.5; wall[0].p[2] = 2.4;   // P/T mesuré 1,03 — la fenêtre (1 ; 1,28) où ±15 % départagent
    wall[1].p[0] = goal.x - sgn * 5.5; wall[1].p[2] = -2.4;
    wall[2].p[0] = goal.x - sgn * 5.5; wall[2].p[2] = 0;
    const mate = st.players.find((p) => p.team === 0 && p.post === 9);
    mate.p[0] = goal.x - sgn * 7; mate.p[2] = 7;
    st.ball.restart([c.p[0] + 0.3, 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c.id);
    st.possession = { team: 0, carrier: c.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
    return arbitre(st, c, matchCfg({ shotRange: 20 }));
  };
  const men = monde('meneur'), neuf = monde('neufDeSurface');
  ok(`le RÔLE départage un monde serré (équipe neutre : le meneur → « ${men.meilleure} », le 9 → « ${neuf.meilleure} » — deux joueurs, deux footballs dans le MÊME système)`,
    men.meilleure === 'passe' && neuf.meilleure === 'tir');
}

// ---------- 5. sabotage nommé « rôles placebo » : trio de 9 contre trio de meneurs ⇒ deux récits
{
  const recit = (r) => {
    const st = makeMatch({ full: true, seed: 4, roles: [r, null] });
    const cfg = matchCfg({ shotRange: 20 });
    for (let i = 0; i < 90 * 60; i++) matchStep(st, 1 / 60, cfg);
    return JSON.stringify(st.events);
  };
  ok(`sabotage « rôles placebo » attrapé (trio de neufs ≠ trio de meneurs — le rôle ÉCRIT le match)`,
    recit({ 7: 'neufDeSurface', 8: 'neufDeSurface', 9: 'neufDeSurface' }) !== recit({ 7: 'meneur', 8: 'meneur', 9: 'meneur' }));
}

// ---------- lot 196 : LES CONSIGNES DÉFENSIVES PAR JOUEUR (demande projet aval — l'attribut
// est la capacité, la consigne est le CHOIX ; quatre axes de rôle, identité 0,5 au bit prouvée
// par l'empreinte du monde 195 inchangée : a7ddbca0bcb0ca12 / ecf57b2c043db08f).
{
  const { resoudreRole } = await import('../assets/starter/src/engine/roles.js');
  const d = resoudreRole(undefined);
  const c = resoudreRole({ on: { appel: 0.9 }, off: { duel: 0.9, marqueSerre: 0.1, ressort: 0.8, orienteFaible: 1 } });
  ok(`les 4 axes se résolvent (défauts ${d.duel}/${d.marqueSerre}/${d.ressort}/${d.orienteFaible} = 0,5) et COMPOSENT par phase (off : duel ${c.duel} = 0,9, marqueSerre ${c.marqueSerre} = 0,1, ressort ${c.ressort} = 0,8, orienteFaible ${c.orienteFaible} = 1 — les consignes sont DÉFENSIVES, elles voyagent avec le rôle off ; l'axe duel est BRANCHÉ à ses deux sites — retenue de surface et imprudence du glissé — mais son théâtre est trop rare pour une preuve de flux : la dette de preuve est NOMMÉE)`,
    d.duel === 0.5 && d.marqueSerre === 0.5 && d.ressort === 0.5 && d.orienteFaible === 0.5
    && c.duel === 0.9 && c.marqueSerre === 0.1 && c.ressort === 0.8 && c.orienteFaible === 1 && c.appel === 0.9);
}
{
  // RESSORT au MÉCANISME DIRECT (re-fondée au 203 — le juge de flux du 196 est mort au monde
  // 202 : les clears ont fondu à ~2/graine, 16 c. 18 sur 10 graines = bruit ; et la fixture
  // par matchStep refusait au timing de l'armé. L'appel DIRECT de tryClear contourne les deux) :
  // l'étau se lit aux corps dans un rayon × axe(ressort, 1,25, 0,75) — deux adversaires posés
  // à 2,6 m tombent DANS le rayon du « dégage » (2,6 × 1,225 = 3,19) et HORS du rayon du
  // « ressors » (2,6 × 0,775 = 2,02) : la décision flippe à la consigne seule, même monde.
  const { matchCfg: mC } = await import('../assets/starter/src/engine/match-sim.js');
  const { tryClear } = await import('../assets/starter/src/engine/shooting.js');
  const { resoudreRole } = await import('../assets/starter/src/engine/roles.js');
  const clearAvec = (v) => {
    const st = makeMatch({ full: true, seed: 5 });
    const cfg = mC({ shotRange: 20 });
    const c = st.players.find((p) => p.team === 0 && p.post === 1);
    c.role = resoudreRole({ ressort: v });
    const own = st.pitch.ownGoal(0);
    c.p[0] = own.x - own.sign * 14; c.p[2] = 3;
    const foes = st.players.filter((p) => p.team === 1 && !p.keeper).slice(0, 2);
    foes[0].p[0] = c.p[0] + 2.6; foes[0].p[2] = c.p[2];
    foes[1].p[0] = c.p[0] - 2.6; foes[1].p[2] = c.p[2];
    for (const q of st.players) if (q.team === 1 && !q.keeper && !foes.includes(q)) { q.p[0] = -own.x; q.p[2] = 20; }
    st.ball.restart([c.p[0] + 0.3, 0.11, c.p[2]], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c.id);
    st.possession = { team: 0, carrier: c.id }; st.phase = 'carry'; st.hold = 1; st.lastTouch = 0;
    return !!tryClear(st, c, cfg);
  };
  const degage = clearAvec(0.05), ressors = clearAvec(0.95);
  ok(`lot 196 — le RESSORT est une consigne (tryClear DIRECT, même monde : « dégage » déblaie (${degage}) là où « ressors » garde le ballon (dégage ${ressors}) — l'étau × axe(1,25/0,75), deux corps à 2,6 m dans la bande de départage ; le flux au monde 202 : 16 c. 18/10 graines, informatif)`,
    degage === true && ressors === false);
}

{
  // MARQUESERRE au MÉCANISME (re-fondée au 200 — l'ancien juge « d(marqueur) aux réceptions »
  // portait un BIAIS DU SURVIVANT : bien marqué, le receveur ne reçoit jamais, seuls les
  // marquages battus entraient dans l'échantillon ; le re-datage 199 l'a exposé en inversant
  // le flux, 8 graines confirmées confondues. Le juge honnête : la CIBLE du marqueur — sa
  // distance à l'homme EST l'offset consigné, ×1,35 respire / ×0,65 colle) : fixture posée,
  // horizon court (1 s, avant divergence), receveur adverse planté en zone.
  const dCibleDe = (v, seed) => {
    const roles = {}; for (let i = 0; i < 10; i++) roles[i] = { marqueSerre: v };
    const st = makeMatch({ full: true, seed, roles: [roles, null] });
    const cfg = matchCfg({ shotRange: 20 });
    const sgn = Math.sign(st.pitch.attackGoal(1).x || 1);
    const c1 = st.players.find((p) => p.team === 1 && p.post === 5);
    c1.p[0] = 0; c1.p[2] = 0;
    const recv = st.players.find((p) => p.team === 1 && p.post === 8);
    recv.p[0] = sgn * 30; recv.p[2] = 6;
    st.ball.restart([0.3, 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c1.id);
    st.possession = { team: 1, carrier: c1.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 1;
    st._possChangeAt = st.t - 9; st._possTeam = 1;
    for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg);
    let dT = 99;
    for (const f of st.players) if (f.team === 0 && !f.keeper && f.job === 'mark') dT = Math.min(dT, Math.hypot(f.target[0] - recv.p[0], f.target[2] - recv.p[2]));
    return dT;
  };
  let okAll = true, txt = [];
  for (const seed of [3, 5, 7]) { const c = dCibleDe(0.95, seed), r = dCibleDe(0.05, seed); okAll = okAll && r >= c * 1.5; txt.push(`s${seed} ${c.toFixed(2)}/${r.toFixed(2)}`); }
  ok(`lot 196 — MARQUESERRE est une consigne (cible du marqueur, colle/respire : ${txt.join(' ')} — ×1,5+ attendu, le même joueur, deux ordres ; mesuré ×1,85)`,
    okAll);
}
{
  // ORIENTEFAIBLE à LA FIXTURE DU JOCKEY (re-fondée 208 — le biais moyen de flux est mort au
  // monde 207 : 0,105 c. 0,109, le chaos re-roulé a mangé le directionnel ; 5e victime des
  // re-datages en juge de flux). Le mécanisme : l'épaule du jockey se décale de oF × 1,1 m
  // côté pied FORT — porteur posé pied droit, axe x pur : le biais vit en z, delta binaire.
  const cibleJockey = (v) => {
    const roles = {}; for (let i = 0; i < 10; i++) roles[i] = { orienteFaible: v };
    const st = makeMatch({ full: true, seed: 5, roles: [roles, null] });
    const cfg = matchCfg({ shotRange: 20 });
    const sgn = Math.sign(st.pitch.attackGoal(1).x || 1);
    const c1 = st.players.find((p) => p.team === 1 && p.post === 5);
    c1.p[0] = 0; c1.p[2] = 0; c1.strongFoot = 'right';
    const pr = st.players.find((p) => p.team === 0 && p.post === 4);
    for (const q of st.players) if (q.team === 0 && !q.keeper && q !== pr) { q.p[0] = -sgn * 40; q.p[2] = 20; }   // l'isolement (leçon : un corps du spawn à 1,26 m MORDAIT — cible ballon, jamais le jockey)
    pr.p[0] = -sgn * 2.5; pr.p[2] = 0;
    st.ball.restart([0.3, 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c1.id);
    st.possession = { team: 1, carrier: c1.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 1;
    st._possChangeAt = st.t - 9; st._possTeam = 1;
    matchStep(st, 1 / 60, cfg);
    const press = st.players.find((p) => p.team === 0 && p.job === 'press');
    return press ? +press.target[2].toFixed(2) : null;
  };
  const zC = cibleJockey(1), zN = cibleJockey(0.5);
  ok(`lot 196 — ORIENTEFAIBLE est une consigne (fixture jockey, porteur pied droit posé : cible z du presseur consigné ${zC} c. neutre ${zN} — le décalage d'épaule ≥ 0,4 m côté pied fort, même monde ; le flux du biais moyen mort au 207, informatif)`,
    zC != null && zN != null && Math.abs(zC - zN) >= 0.4);
}


// ---------- lot 200 : LE RÔLE AGIT SUR LA STRUCTURE (demande projet aval)
{
  // (a) L'ANCRAGE au flux — la statistique invariante suggérée par le projet aval : l'excursion
  // RELATIVE AU CENTRE DE GRAVITÉ des coéquipiers (annule le déplacement du bloc, survit au
  // chaos). Le cloué (0) tient son poste, le libre (1) vagabonde — mesuré 8,16 / 8,91 / 10,59.
  const excDe = (anc) => {
    const rel = [];
    for (const seed of [3, 7]) {
      const st = makeMatch({ full: true, seed, roles: [{ 5: { ancrage: anc } }, null] });
      const cfg = matchCfg({ shotRange: 20 });
      const p5 = st.players.find((p) => p.team === 0 && p.post === 5);
      for (let i = 0; i < 300 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        if (i % 10) continue;
        let cx = 0, cz = 0, m = 0;
        for (const q of st.players) if (q.team === 0 && !q.keeper && q.id !== p5.id) { cx += q.p[0]; cz += q.p[2]; m++; }
        rel.push([p5.p[0] - cx / m, p5.p[2] - cz / m]);
      }
    }
    const mx = rel.reduce((a, r) => a + r[0], 0) / rel.length, mz = rel.reduce((a, r) => a + r[1], 0) / rel.length;
    return Math.sqrt(rel.reduce((a, r) => a + (r[0] - mx) ** 2 + (r[1] - mz) ** 2, 0) / rel.length);
  };
  const colle = excDe(0), libre = excDe(1);
  ok(`lot 200 — l'ANCRAGE est un axe (excursion au centroïde du même milieu : cloué ${colle.toFixed(2)} m < libre ${libre.toFixed(2)} − 1 — le meneur libre et le carrilero ne sont plus ancrés à force égale)`,
    libre - colle >= 1);
  // (b) LE DEMI-CENTRE sur fixture (doctrine lot 8 : le flux est noyé par le chaos — mesuré,
  // deux mondes divergés) : profondeurM 16 fait DESCENDRE le pivot dans la ligne arrière et le
  // stoppeur posté S'ÉCARTE de ecarte × (1 − dz/portee) — le delta de cible exact.
  const fix = (structOn) => {
    const st = makeMatch({ full: true, seed: 5, roles: [{ 5: { profondeur: 0 } }, null] });
    const cfg = matchCfg({ shotRange: 20, role: { profondeurM: 16 }, ...(structOn ? {} : { roleStructure: false }) });
    const sgn = -st.pitch.ownGoal(0).sign;
    for (const q of st.players.filter((q) => q.team === 1)) q.p[0] = sgn * (q.keeper ? 51 : 44);
    const c0 = st.players.find((p) => p.team === 0 && p.post === 8);
    c0.p[0] = 0; c0.p[2] = 0;
    st.ball.restart([0.3, 0.11, 0], { cause: 'coup-franc' });
    st.restart = null; st.ball.possess(c0.id);
    st.possession = { team: 0, carrier: c0.id }; st.phase = 'carry'; st.hold = 1.0; st.lastTouch = 0;
    st._possChangeAt = st.t - 9; st._possTeam = 0;
    matchStep(st, 1 / 60, cfg);
    const cb = st.players.find((p) => p.team === 0 && p.post === 2);
    const p5 = st.players.find((p) => p.team === 0 && p.post === 5);
    return { cbZ: Math.abs(cb.target[2]), p5x: p5.target[0] * sgn };
  };
  const sans = fix(false), avec = fix(true);
  ok(`lot 200 — l'INTRUS DÉFORME LA LIGNE (fixture : pivot profondeur 0 × profondeurM 16 descend à x ${avec.p5x.toFixed(1)} ; le stoppeur posté s'écarte |z| ${sans.cbZ.toFixed(1)} → ${avec.cbZ.toFixed(1)}, +1,7 attendu — le demi-centre et l'anchor ne sont plus le même joueur)`,
    avec.cbZ - sans.cbZ >= 1.2 && avec.p5x < -12);
  // (c) L'IDENTITÉ : les clés ACTIVES avec des rôles neutres = pas un bit (60 s d'événements)
  const evs = (over) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20, ...over });
    for (let i = 0; i < 60 * 60; i++) matchStep(st, 1 / 60, cfg);
    return JSON.stringify(st.events);
  };
  ok(`lot 200 — l'identité tient (ancrage/roleStructure ACTIFS sans rôle qui les réclame === clés coupées, 60 s au bit — « aucune déformation sans rôle qui la réclame »)`,
    evs({}) === evs({ ancrage: false, roleStructure: false }));
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
