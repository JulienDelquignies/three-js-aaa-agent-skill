#!/usr/bin/env node
// verify-approach.mjs — LES MÈTRES (engine/approach.js) : un geste se joue DEPUIS une position.
//
// Ce qu'on prouve : que chaque technique a une STANCE (où est le ballon relativement au corps au
// contact) ; que l'ANCRE la réalise exactement, du bon CÔTÉ du corps ; que le GLISSEMENT part d'où
// on est et arrive dessus, en douceur et à vitesse humaine ; que le PLAN choisit la stance propre
// quand elle est atteignable et n'improvise que quand le temps manque ; et que tout cela reste vrai
// dans une PARTIE RÉELLE, mesuré sur les événements de frappe eux-mêmes (stanceD / stanceB).
//
// Les sabotages sont les bugs RÉELS de la construction, pas des pailles : le côté inversé
// d'anchorFor (stance réalisée au degré près… du mauvais côté du corps — attrapé par un écart
// uniforme de 76°), le monde d'avant (aucune ancre : pied à 1,00 m du ballon, le chiffre de
// l'audit), et l'OSCILLATEUR (re-choisir la technique sur la géométrie transitoire de l'approche —
// le porteur qui contourne son ballon l'a « derrière lui », la table bascule sur talonnade, l'ancre
// saute de l'autre côté du corps, et le plan ne converge jamais : pertes par tacle 67 → 192).
import { STANCES, anchorFor, stanceOf, reachable, glide, glideEase, planStrike, checkApproach }
  from '../assets/starter/src/engine/approach.js';
import { TECHNIQUES } from '../assets/starter/src/engine/technique.js';
import { MOVES } from '../assets/starter/src/engine/animkit.js';
import { makeRondo } from '../assets/starter/src/engine/rondo.js';
import { rondoStep } from '../assets/starter/src/engine/rondo-sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const has = (r, n) => !r.ok && r.issues.some((i) => i.toLowerCase().includes(n.toLowerCase()));
const D2R = Math.PI / 180;
const wrapD = (a) => { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };

console.log('— le contrat (checkApproach) —');
{
  const r = checkApproach();
  ok('la table des stances et la géométrie passent leur propre contrat', r.ok, r.issues.join(' | '));
  ok('sabotage « stance dans le corps (0,1 m) » attrapé',
    has(checkApproach({ stances: { ...STANCES, passe: { dist: 0.1, bearing: 24 } } }), 'hors [0,3'));
  ok('sabotage « geste avant sur ballon derrière (relèvement 120°) » attrapé',
    has(checkApproach({ stances: { ...STANCES, passe: { dist: 0.55, bearing: 120 } } }), 'ne se joue pas'));
  ok('sabotage « talonnade avec le ballon devant » attrapé',
    has(checkApproach({ stances: { ...STANCES, talonnade: { dist: 0.38, bearing: 20 } } }), 'DERRIÈRE'));
}

console.log('\n— l’ancre réalise la stance, DU BON CÔTÉ —');
{
  // aller-retour exact sur toutes les stances × les deux pieds, ballon et sortie quelconques
  let worstD = 0, worstB = 0;
  for (const [id, s] of Object.entries(STANCES)) {
    for (const foot of ['right', 'left']) {
      for (const [bx, bz, yaw] of [[3.2, -1.7, 0.8], [-5, 2, -2.4], [0, 0, 3.0]]) {
        const a = anchorFor([bx, bz], yaw, foot, s);
        const got = stanceOf(a.p, a.yaw, [bx, bz], foot);
        worstD = Math.max(worstD, Math.abs(got.dist - s.dist));
        worstB = Math.max(worstB, Math.abs(wrapD(got.bearing - s.bearing)));
      }
    }
  }
  ok(`anchorFor ∘ stanceOf = identité (pire écart ${worstD.toExponential(1)} m / ${worstB.toExponential(1)}°)`, worstD < 1e-9 && worstB < 1e-9);
  // LE SABOTAGE FONDATEUR DU MODULE : le signe du côté. La première version avait side inversé —
  // stance réalisée au degré près… sur le MAUVAIS côté du corps (un gaucher avec le ballon à
  // droite), attrapée par la mesure (écart UNIFORME de ~2×bearing). On le rejoue tel quel.
  const s = STANCES.passe;
  const badAnchor = (ball, outYaw, foot) => {
    const side = foot === 'left' ? -1 : 1;              // ← le signe inversé du bug
    const a = outYaw + s.bearing * side * D2R;
    return { p: [ball[0] - Math.cos(a) * s.dist, ball[1] - Math.sin(a) * s.dist], yaw: outYaw };
  };
  const bad = badAnchor([3.2, -1.7], 0.8, 'left');
  const got = stanceOf(bad.p, bad.yaw, [3.2, -1.7], 'left');
  ok(`sabotage « côté inversé d'anchorFor » attrapé par stanceOf (relèvement ${got.bearing.toFixed(0)}° au lieu de +${s.bearing}°)`,
    Math.abs(wrapD(got.bearing - s.bearing)) > 40);
}

console.log('\n— le glissement : d’où on est, SUR l’ancre, en douceur —');
{
  const a = anchorFor([1, 1], 0.3, 'right', STANCES.passe);
  const g0 = glide([0, 0], 2.0, a, 0), g1 = glide([0, 0], 2.0, a, 1);
  ok('t=0 → la position de départ ; t=1 → l’ancre, exactement',
    Math.hypot(g0.p[0], g0.p[1]) < 1e-9 && Math.hypot(g1.p[0] - a.p[0], g1.p[1] - a.p[1]) < 1e-9);
  const v0 = (glideEase(0.01) - glideEase(0)) / 0.01, v1 = (glideEase(1) - glideEase(0.99)) / 0.01;
  ok(`les deux bouts sont doux (pentes ${v0.toFixed(2)} / ${v1.toFixed(2)} ≤ 0,1 — un pas, pas un rail)`, v0 <= 0.1 && v1 <= 0.1);
  // le lacet tourne par le plus court chemin — pas un tour complet pour 10°
  const gy = glide([0, 0], Math.PI - 0.05, { p: [1, 0], yaw: -Math.PI + 0.05 }, 0.5);
  ok('le lacet prend le plus court chemin (±π est un voisinage, pas un demi-tour)', Math.abs(gy.yaw) > Math.PI - 0.1);
}

console.log('\n— atteignable : une borne de vitesse humaine, pas un vœu —');
{
  ok('une ancre à 2 m en 0,38 s est REFUSÉE (téléport déguisé)', !reachable([0, 0], { p: [2.0, 0] }, 0.38));
  ok('une ancre à 0,5 m en 0,38 s est ACCEPTÉE (le jeu peut frapper)', reachable([0, 0], { p: [0.5, 0] }, 0.38));
  ok('l’anticipation compte : la même ancre passe avec plus de temps',
    !reachable([0, 0], { p: [0.45, 0] }, 0.1) && reachable([0, 0], { p: [0.45, 0] }, 0.38));
  ok('le glissement ne couvre JAMAIS plus que les derniers décimètres (hardMax ≤ 0,6 : à 0,8 m on marche d’abord)',
    !reachable([0, 0], { p: [0.8, 0] }, 9));
}

console.log('\n— le PLAN : la stance propre quand on peut, l’improvisation quand il faut —');
{
  const cands = TECHNIQUES.filter((t) => t.intent === 'pass' && !t.firstTime).map((t) => ({
    clip: t.clip, pref: t.accuracy, antic: (MOVES[t.clip]?.contact) ?? 0.38, data: t,
  }));
  ok(`les candidats du plan couvrent ${cands.length} techniques de passe (≥ 4)`, cands.length >= 4);
  // le corps est déjà À l'ancre de la passe : le plan prend la stance PROPRE (passe, pref max)
  const ball = [2, 1], outYaw = 0.5;
  const aP = anchorFor(ball, outYaw, 'right', STANCES.passe);
  const easy = planStrike(aP.p, ball, outYaw, cands);
  ok(`corps sur l'ancre de « passe » → le plan choisit « passe » (pris : ${easy.best?.clip})`, easy.best?.clip === 'passe');
  // L'OSCILLATEUR, rejoué : pendant l'approche, le porteur CONTOURNE son ballon — à mi-chemin le
  // ballon est transitoirement DERRIÈRE lui. L'ancien sélecteur (situation du moment) basculait
  // alors sur la talonnade ; le plan, lui, choisit par atteignabilité de l'ancre : même position
  // transitoire, même réponse — la stance propre, et le CAP (steer) pour y aller.
  const behind = [ball[0] + Math.cos(outYaw) * 0.45, ball[1] + Math.sin(outYaw) * 0.45];   // devant le ballon = ballon « derrière »
  const mid = planStrike(behind, ball, outYaw, cands);
  ok(`sabotage « re-choix sur géométrie transitoire » : ballon momentanément derrière ⇒ le plan garde une surface AVANT (pris : ${(mid.best ?? mid.steer)?.clip})`,
    ((mid.best ?? mid.steer)?.clip) !== 'talonnade');
  ok('…et le cap (steer) est TOUJOURS donné, même sans stance atteignable — un refus pilote l’approche',
    !!planStrike([9, 9], ball, outYaw, cands).steer);
  // pressé : parmi les stances ATTEIGNABLES et bonnes, la plus prompte gagne. Le min se calcule
  // sur les ancres qu'on peut rejoindre — depuis l'ancre de la passe, celle de la talonnade
  // (antic 0,19 s, DERRIÈRE le ballon) est hors de portée : un min global sur la table mesure une
  // option qui n'existe pas dans le monde composé, pas le choix du joueur.
  const rush = planStrike(aP.p, ball, outYaw, cands, { rushed: true, rushedSlack: 99 });
  const fastest = Math.min(...cands
    .filter((c) => ['right', 'left'].some((f) =>
      reachable(aP.p, anchorFor(ball, outYaw, f, STANCES[c.clip]), c.antic, { adjustSpeed: 3.6, hardMax: 0.6 })))
    .map((c) => c.antic));
  ok(`pressé (marge infinie) : le plan prend la plus prompte DES ATTEIGNABLES (${rush.best?.antic}s = min ${fastest}s)`,
    rush.best?.antic === fastest);
  ok(`  …et la plus prompte tout court (${Math.min(...cands.map((c) => c.antic))}s, talonnade) reste HORS plan : son ancre est derrière le ballon`,
    rush.best?.clip !== 'talonnade' && Math.min(...cands.map((c) => c.antic)) < fastest);
  // la marche acquise pendant une livraison élargit l'atteignable, jamais la borne du glissement
  const far = [ball[0] - Math.cos(outYaw) * 2.0, ball[1] - Math.sin(outYaw) * 2.0];
  ok('extraReach : une ancre hors d’atteinte devient planifiable avec la marche de la livraison',
    !planStrike(far, ball, outYaw, cands).best && !!planStrike(far, ball, outYaw, cands, { extraReach: 1.5 }).best);
}

console.log('\n— la partie réelle : la stance au CONTACT, mesurée sur les événements —');
{
  const D = [], B = [];
  for (const seed of [3, 7]) {
    const st = makeRondo({ seed });
    for (let f = 0; f < 60 * 60; f++) rondoStep(st, 1 / 60);
    for (const e of st.events) if (e.type === 'pass' && e.stanceD != null) { D.push(e.stanceD); B.push(Math.abs(e.stanceB)); }
  }
  D.sort((a, b) => a - b); B.sort((a, b) => a - b);
  const q = (a, t) => a[Math.floor((a.length - 1) * t)];
  ok(`${D.length} frappes mesurées (≥ 40 : le jeu frappe vraiment)`, D.length >= 40);
  ok(`écart de stance p90 ≤ 5 cm (mesuré ${q(D, 0.9)} m — avant l'approche : 1,00 m)`, q(D, 0.9) <= 0.05);
  ok(`écart de relèvement p90 ≤ 5° (mesuré ${q(B, 0.9)}°)`, q(B, 0.9) <= 5);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
