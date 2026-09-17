// verify-conduite.mjs — LA CONDUITE NOMMÉE (cfg.conduiteNommee ; note 388 ; retour « les touches de conduite pour gérer pied droit pied
// gauche extérieur intérieur »). Hier chaque touche de conduite était un événement 'touche' muet (dev, spd) : la scène tendait le pied le
// plus proche vers le ballon, et jouait « passe extérieur » sur toute cassure ≥ 60°, quel que soit le pied ou la surface. Ici la sim
// NOMME chaque touche sur la géométrie de sa propre poussée : le pied (le côté du ballon dans le regard), la surface (vers le dehors du
// pied = extérieur, vers le dedans = intérieur, droit devant = cou-de-pied en course / intérieur au trot, presque arrêté = semelle) —
// quatre techniques 'conduite-*' de la table, quatre clips générés (motion-control conduite*) que la scène joue par technique et pied.
// Clé absente : la touche muette d'hier, au bit (champs additifs).
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { GENERATORS } from '../assets/starter/src/engine/motion-cast.js';
import { SHANON_PROFILE } from '../assets/starter/src/engine/motion-profile-shanon.js';
import { checkClip, resolveTracks, MOVES } from '../assets/starter/src/engine/animkit.js';
import { styleFromSeed } from '../assets/starter/src/engine/motion-strike.js';
import { byId } from '../assets/starter/src/engine/technique.js';
import { conduiteNommee } from '../assets/starter/src/engine/skills-sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const P = SHANON_PROFILE, K = matchCfg({}).conduiteNommee;
const PINS = { ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, receveurOuvert: null };

console.log('— (a) quatre touches de conduite générées, sous contrat —');
for (const kind of ['conduiteInterieur', 'conduiteExterieur', 'conduiteLaces', 'conduiteSemelle']) {
  const spec = GENERATORS[kind].generate(P, {}), r = GENERATORS[kind].check(spec, P, {}), c = checkClip(resolveTracks(spec));
  let bad = 0, first = null;
  for (let s = 1; s <= 40; s++) { const sp = GENERATORS[kind].generate(P, { style: styleFromSeed(s) }); const rr = GENERATORS[kind].check(sp, P, {}), cc = checkClip(resolveTracks(sp)); if (!rr.ok || !cc.ok) { bad++; first ??= `graine ${s} : ${[...rr.issues, ...cc.issues].join(' ; ')}`; } }
  const tech = Object.values(byId).find((t) => t.clip === kind);
  ok(`${kind} (${spec.keys.length} clés, ${spec.duration} s, contact ${spec.contact}${r.portrait.excMax != null ? `, pied à ${(100 * r.portrait.excC).toFixed(0)} cm au contact, +${(100 * (r.portrait.excMax - r.portrait.excC)).toFixed(0)} cm après` : ''}) sous contrat et checkClip, 40 styles (${bad} refus), technique '${tech?.id ?? '—'}' (${tech?.surface ?? '—'}), dans MOVES`,
    r.ok && c.ok && bad === 0 && !!tech && !!MOVES[kind], [...r.issues, ...c.issues, first].filter(Boolean).join(' ; '));
}

console.log('— (b) la convention du nom : le pied et la surface sur une poussée connue —');
{
  const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg(PINS); const c = st.players.find((q) => q.team === 0 && !q.keeper);
  const cas = (yaw, latBall, vx, vz, speed) => { c.yaw = yaw; c.p[0] = 0; c.p[2] = 0; c.speed = speed; if (st.ball.owner != null) st.ball.release('perte'); st.ball.restart([Math.cos(yaw) * 0.4 + Math.sin(yaw) * latBall, 0.11, Math.sin(yaw) * 0.4 - Math.cos(yaw) * latBall], { cause: 'engagement' }); st.ball.impulse([vx - st.ball.v[0], -st.ball.v[1], vz - st.ball.v[2]]); return conduiteNommee(st, c, cfg); };   // latBall > 0 : le ballon à GAUCHE (la convention de la scène : lat = dx·sin − dz·cos > 0)
  // face à +x : la droite est +z ; le ballon 10 cm à droite (latBall −0,1) ; poussée vers +z (à droite) = le dehors du pied droit
  const d1 = cas(0, -0.1, 3, 1.5, 4), d2 = cas(0, -0.1, 3, -1.5, 4), d3 = cas(0, -0.1, 4, 0, 4), d4 = cas(0, -0.1, 2, 0, 2), d5 = cas(0, -0.1, 0.8, 0, 0.5), g1 = cas(0, 0.1, 3, -1.5, 4), g2 = cas(0, 0.1, 3, 1.5, 4);
  ok(`PIED DROIT (ballon à droite) : poussée à droite → ${d1.tech} (virage ${d1.virage}°), à gauche → ${d2.tech} (${d2.virage}°), droit devant en course → ${d3.tech}, au trot → ${d4.tech}, presque arrêté → ${d5.tech}`,
    d1.foot === 'right' && d1.surface === 'outside' && d2.surface === 'inside' && d3.surface === 'laces' && d4.surface === 'inside' && d5.surface === 'sole');
  ok(`PIED GAUCHE (ballon à gauche) : poussée à gauche → ${g1.tech} (le dehors du pied gauche), à droite → ${g2.tech}`, g1.foot === 'left' && g1.surface === 'outside' && g2.surface === 'inside');
  const n = conduiteNommee(st, c, matchCfg({ ...PINS, conduiteNommee: null }));
  ok(`conduiteNommee:null — aucun champ (${JSON.stringify(n)})`, Object.keys(n).length === 0);
}

console.log('— (c) le match : chaque touche nommée, cohérente, les quatre surfaces —');
{
  const joue = (over) => { const st = makeMatch({ full: true, seed: 3 }), cfg = matchCfg({ ...PINS, ...over }); const S = { n: 0, sans: 0, surf: {}, foot: {}, coh: 0, virages: [] };
    for (let i = 0; i < 60 * 300; i++) { const n0 = st.events.length; matchStep(st, 1 / 60, cfg); for (const e of st.events.slice(n0)) if (e.type === 'touche') { S.n++; if (!e.tech) { S.sans++; continue; } S.surf[e.surface] = (S.surf[e.surface] ?? 0) + 1; S.foot[e.foot] = (S.foot[e.foot] ?? 0) + 1; S.virages.push(Math.abs(e.virage)); const q = st.players[e.by], b = st.ball.p, lat = (b[0] - q.p[0]) * Math.sin(q.yaw) - (b[2] - q.p[2]) * Math.cos(q.yaw); if ((lat > 0) === (e.foot === 'left')) S.coh++; } }
    return S; };
  const S = joue({});
  ok(`LE MATCH (300 s) : ${S.n} touches, toutes nommées (${S.sans} muettes), le pied cohérent avec le côté du ballon ${S.coh}/${S.n - S.sans}, surfaces ${JSON.stringify(S.surf)} (la semelle est informative : le porteur presque arrêté est rare), pieds ${JSON.stringify(S.foot)}`,
    S.n >= 60 && S.sans === 0 && S.coh >= (S.n - S.sans) * 0.98 && (S.surf.inside ?? 0) >= S.n * 0.1 && (S.surf.laces ?? 0) >= S.n * 0.1 && (S.surf.outside ?? 0) >= 1 && (S.foot.left ?? 0) >= S.n * 0.2 && (S.foot.right ?? 0) >= S.n * 0.2);
  const N = joue({ conduiteNommee: null });
  ok(`conduiteNommee:null — ${N.n} touches, toutes muettes (${N.sans}) : l'hier`, N.n === S.n && N.sans === N.n);
}
console.log(`conduite : ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
