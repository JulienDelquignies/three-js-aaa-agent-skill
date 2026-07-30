#!/usr/bin/env node
// verify-ball-body.mjs — UN BALLON DONT LA POSITION NE S'ÉCRIT PAS (engine/ball-body.js).
//
// Deux choses à prouver, et la seconde est celle qu'on rate toujours :
//   1. l'INTERDICTION tient — écrire une position lève, vraiment, par tous les chemins ;
//   2. l'AUDIT mord — il détecte un déplacement qui dépasse ce que la vitesse permet.
//
// Le (2) est piégeux. Un sabotage qui pousse une ligne dans `ledger.breaches` prouve que le
// vérificateur sait lire un tableau, PAS que l'audit sait le remplir : on peut mettre
// CONTINUITY_SLACK à 10⁹ et ce sabotage-là reste vert. On teste donc l'arithmétique de l'audit
// directement (`stepRatio` est pure exprès), et on prouve séparément qu'elle est BRANCHÉE.
import { BALL } from '../assets/starter/src/engine/ball.js';
import { BallBody, checkBallBody, stepRatio, CONTINUITY_SLACK, RESTARTS } from '../assets/starter/src/engine/ball-body.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const has = (r, n) => !r.ok && r.issues.some((i) => i.toLowerCase().includes(n.toLowerCase()));
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

console.log('— l\'interdiction : une position ne s\'écrit pas —');
{
  const b = new BallBody([0, BALL.radius, 0], [4, 0, 0]);
  ok('écrire une coordonnée lève (b.p[0] = 5)', throws(() => { b.p[0] = 5; }));
  ok('remplacer le vecteur lève (b.p = [...])', throws(() => { b.p = [5, 0, 0]; }));
  ok('supprimer une coordonnée lève', throws(() => { delete b.p[0]; }));
  ok('redéfinir une coordonnée lève', throws(() => { Object.defineProperty(b.p, '0', { value: 9 }); }));
  ok('la vitesse et le spin sont protégés de la même façon',
    throws(() => { b.v[1] = 9; }) && throws(() => { b.w[2] = 9; }));
  // …ET LA LECTURE DOIT RESTER INTACTE, sinon la protection est un mur que personne n'adopte et le
  // code contourne en gardant un tableau nu à côté — ce qui ramène exactement le problème.
  ok('lire marche encore (b.p[0], hypot(...b.p), [...b.p], Array.isArray)',
    typeof b.p[0] === 'number' && Number.isFinite(Math.hypot(...b.p)) && [...b.p].length === 3 && Array.isArray(b.p));
  ok('snapshot() rend une copie MUTABLE pour les prédicteurs', (() => {
    const s = b.snapshot(); s.p[0] = 99; return s.p[0] === 99 && b.p[0] !== 99;
  })());
}

console.log('\n— l\'audit : l\'arithmétique elle-même —');
{
  const h = 1 / 60, v = [6, 0, 0];
  // un pas honnête : ball.js est en Euler semi-implicite, donc |Δp| = |v|·h exactement
  ok('un pas honnête vaut 1,00', Math.abs(stepRatio([0, 0, 0], [6 * h, 0, 0], v, v, h) - 1) < 1e-9);
  // le pire cas physique réel : la résolution d'un rebond remonte le ballon de sa pénétration
  ok(`le pire rebond réel (1,274) passe sous la marge (${CONTINUITY_SLACK})`, 1.274 <= CONTINUITY_SLACK);
  // LE saut réel : le pire contrôle mesuré, 1,70 m en une image à 6 m/s
  const r = stepRatio([0, 0, 0], [1.70, 0, 0], v, v, h);
  ok(`le pire contrôle mesuré est vu comme un téléport (1,70 m à 6 m/s → ${r.toFixed(0)}×)`, r > CONTINUITY_SLACK, `${r.toFixed(0)}× la marge`);
  // la marge est DISCRIMINANTE : juste en dessous passe, juste au-dessus casse. Sans ça, la constante
  // pourrait valoir 10⁹ sans qu'aucun test ne bronche — c'est le défaut classique d'un seuil non testé.
  const at = (k) => stepRatio([0, 0, 0], [6 * h * k, 0, 0], v, v, h);
  ok('la marge discrimine (0,99× passe, 1,01× casse)',
    at(CONTINUITY_SLACK * 0.99) <= CONTINUITY_SLACK && at(CONTINUITY_SLACK * 1.01) > CONTINUITY_SLACK);
  // un ballon immobile qui bouge est un téléport, quel que soit le seuil (division par zéro gérée)
  ok('un ballon immobile qui se déplace est un téléport', stepRatio([0, 0, 0], [0.5, 0, 0], [0, 0, 0], [0, 0, 0], h) === Infinity);
}

console.log('\n— l\'audit est BRANCHÉ sur le vrai intégrateur —');
{
  const b = new BallBody([0, 1.5, 0], [12, 3, 2], [0, 20, 0]);
  b.integrate(1.5);
  ok(`intégrer remplit le registre (${b.ledger.steps} pas)`, b.ledger.steps > 50, `${b.ledger.steps}`);
  ok('un vol normal ne produit AUCUNE infraction', b.ledger.breaches.length === 0, JSON.stringify(b.ledger.breaches[0] || {}));
  ok(`le pire rapport observé reste sous la marge (${b.ledger.worst.toFixed(3)})`, b.ledger.worst <= CONTINUITY_SLACK);
  // un vol complet avec rebonds, spin et roulement : c'est là que le pire rapport apparaît
  const c = new BallBody([0, 0.4, 0], [22, 6, 4], [0, 60, 0]);
  for (let i = 0; i < 300; i++) c.integrate(1 / 60);
  ok(`un vol avec rebonds et roulement reste continu (${c.ledger.steps} pas, pire ${c.ledger.worst.toFixed(3)})`,
    c.ledger.breaches.length === 0 && c.ledger.worst <= CONTINUITY_SLACK);
  ok('contrat vert sur un ballon qui a vécu', checkBallBody(c).ok, checkBallBody(c).issues.join(' | '));
}

console.log('\n— les opérations continues font ce qu\'elles disent —');
{
  const b = new BallBody([0, BALL.radius, 0], [0, 0, 0]);
  b.strike({ speed: 18, dirYaw: 0, elevation: 0.25, spinRev: 4 });
  ok('frapper ne DÉPLACE pas le ballon (le 4ᵉ site de téléport, purement vertical)',
    b.p[0] === 0 && b.p[2] === 0 && Math.abs(b.p[1] - BALL.radius) < 1e-12);
  ok('  …mais lui donne une vitesse et un effet', Math.hypot(...b.v) > 15 && Math.hypot(...b.w) > 1);

  // frapper un ballon EN L'AIR ne doit pas le plaquer au sol (13 fois mesuré, jusqu'à 1,36 m)
  const air = new BallBody([0, 1.4, 0], [2, 0, 0]);
  air.strike({ speed: 12, dirYaw: 1, elevation: 0.1 });
  ok('frapper un ballon en l\'air le laisse en l\'air', Math.abs(air.p[1] - 1.4) < 1e-12, `y=${air.p[1]}`);

  const e = new BallBody([0, BALL.radius, 0], [0, 0, 0]);
  e.escort([4, 0], 0.3);
  ok('escorter donne une VITESSE (pas un déplacement)', e.v[0] > 3 && e.p[0] === 0);
  e.integrate(0.1);
  ok('  …et c\'est l\'intégrateur qui déplace, donc continûment', e.p[0] > 0 && e.ledger.breaches.length === 0);
}

console.log('\n— la remise en jeu : la seule discontinuité, et elle se déclare —');
{
  const b = new BallBody([20, BALL.radius, 5], [3, 0, 0]);
  ok('sans cause, ça lève', throws(() => b.restart([0, BALL.radius, 0])));
  ok('avec une cause inventée, ça lève', throws(() => b.restart([0, BALL.radius, 0], { cause: 'parce que' })));
  b.restart([7, BALL.radius, 0], { cause: 'sortie-de-but' });
  ok('avec une cause connue, ça passe et c\'est INSCRIT', b.ledger.restarts.length === 1 && b.ledger.restarts[0].cause === 'sortie-de-but');
  ok('  …et le ballon est arrêté', Math.hypot(...b.v) === 0);
  ok('les causes connues couvrent le football réel', ['sortie-de-but', 'corner', 'touche', 'coup-franc', 'engagement', 'penalty'].every((c) => RESTARTS.has(c)));
}

console.log('\n— rest() ne triche pas —');
{
  // La conception d'origine faisait `p[1] = rayon` : un téléport vertical réintroduit par la porte de
  // service, DANS le module écrit pour les rendre impossibles. Mesuré sur son implémentation :
  // y = 1,79 m → 0,11 m, 1,68 m de chute en zéro seconde.
  const air = new BallBody([0, 1.79, 0], [0, -2, 0]);
  ok('rest() sur un ballon en l\'air REFUSE (il doit retomber)', throws(() => air.rest()));
  ok('  …et le ballon n\'a pas bougé d\'un millimètre', Math.abs(air.p[1] - 1.79) < 1e-12);
  const down = new BallBody([0, BALL.radius, 0], [3, 0, 1]);
  down.rest();
  ok('rest() au sol arrête le ballon sans le déplacer', Math.hypot(...down.v) === 0 && down.p[0] === 0);
}

console.log('\n— sabotages du CONTRAT —');
{
  const b = new BallBody([0, 1, 0], [8, 2, 0]); b.integrate(2);
  b.ledger.breaches.push({ d: 1.70, ratio: 283, h: 0.0167 });
  ok('sabotage « déplacement inexpliqué » attrapé', has(checkBallBody(b), 'inexpliqué'));
}
{
  const b = new BallBody([0, 1, 0], [8, 2, 0]); b.integrate(2);
  b.ledger.restarts.push({ cause: 'euh', d: 1 });
  ok('sabotage « remise en jeu de cause inventée » attrapé', has(checkBallBody(b), 'cause inconnue'));
}
{
  const b = new BallBody([0, 1, 0], [8, 2, 0]); b.integrate(2);
  b.ledger.restarts.push({ cause: 'sortie-de-but', d: 40 });
  ok('sabotage « téléport avec un mot d\'excuse (40 m) » attrapé', has(checkBallBody(b), 'déménagement'));
}
{
  const b = new BallBody([0, 1, 0], [8, 2, 0]); b.integrate(2);
  for (let i = 0; i < 30; i++) b.restart([1, BALL.radius, 1], { cause: 'touche' });
  ok('sabotage « l\'exception devenue la règle (30 remises) » attrapé', has(checkBallBody(b), 'devenue la règle'));
}
{
  ok('sabotage « ballon neuf, jamais intégré » attrapé', has(checkBallBody(new BallBody()), 'n\'a pas vécu'));
}
{
  // LE sabotage qui manquait à la conception : rendre au contrat un objet nu. « Pas de registre » ne
  // doit JAMAIS valoir « pas de téléport » — c'est très exactement comment l'ancienne règle a pu
  // rester verte pendant 236 téléportations.
  ok('sabotage « je retire le corps du ballon » attrapé',
    has(checkBallBody({ p: [0, 0, 0], v: [0, 0, 0], w: [0, 0, 0] }), 'pas de registre'));
  ok('  …et null aussi', !checkBallBody(null).ok);
}


console.log('\n— LE PORTÉ : la possession est un état du moteur, pas une étiquette —');
{
  const throws = (fn, needle) => { try { fn(); return false; } catch (e) { return String(e).includes(needle); } };
  const b = new BallBody([0, BALL.radius, 0]);
  ok('un ballon naît LIBRE (owner null)', b.owner === null);
  b.possess(7);
  ok('possess(7) : le porteur est déclaré', b.owner === 7);
  b.possess(7);
  ok('re-possess par le MÊME porteur : sans effet (idempotent)', b.owner === 7);
  ok('possess par un AUTRE lève — un vol de balle se déclare (release d\'abord)',
    throws(() => b.possess(3), 'se DÉCLARE'));
  ok('release() sans cause lève', throws(() => b.release(), 'se nomme'));
  ok('release(cause inventée) lève', throws(() => b.release('magie'), 'inconnue'));
  b.release('conduite');
  ok('release(\'conduite\') : le ballon est libre, la sortie est au registre',
    b.owner === null && b.ledger.releases.at(-1)?.cause === 'conduite');
  ok('carry() sur un ballon LIBRE lève — le porté appartient à un porteur',
    throws(() => b.carry([1, 0], 1 / 60), 'LIBRE'));
}
{
  // LE PORTÉ CONVERGE, EN CONTINU. C'est la promesse entière du régime : le ballon arrive au point
  // que le geste définit PAR l'intégrateur — l'audit de continuité tourne à chaque sous-pas, et le
  // plafond de vitesse rend la clause structurelle. (control-at-foot : 3-9 % de dette sur quatre
  // correctifs de « négociation » → 0,0 % mesuré sur 6 graines dès la capture branchée.)
  const b = new BallBody([0, BALL.radius, 0]);
  b.possess(1);
  let worstStep = 0;
  let prev = [...b.p];
  for (let i = 0; i < 30; i++) {
    b.carry([0.6, 0.2], 1 / 60);
    worstStep = Math.max(worstStep, Math.hypot(b.p[0] - prev[0], b.p[2] - prev[2]));
    prev = [...b.p];
  }
  const d = Math.hypot(b.p[0] - 0.6, b.p[2] - 0.2);
  ok(`le ballon porté CONVERGE (0,63 m → ${d.toFixed(3)} m en 0,5 s, ≤ 0,05)`, d <= 0.05);
  ok('…sans UNE SEULE brèche de continuité (l\'audit par sous-pas a tout vu)', b.ledger.breaches.length === 0);
  ok(`…et sans jamais dépasser le plafond (pire pas ${(worstStep * 60).toFixed(1)} m/s ≤ 9·1,35)`, worstStep * 60 <= 9 * 1.35);
}
{
  // le plafond mord : une cible à 5 m ne fait PAS voler le ballon porté — il marche à vMax
  const b = new BallBody([0, BALL.radius, 0]);
  b.possess(1);
  let vMaxSeen = 0;
  for (let i = 0; i < 30; i++) { b.carry([5, 0], 1 / 60); vMaxSeen = Math.max(vMaxSeen, Math.hypot(b.v[0], b.v[2])); }
  ok(`une cible à 5 m est poursuivie à vitesse HUMAINE (pic ${vMaxSeen.toFixed(1)} m/s ≤ 9,1)`, vMaxSeen <= 9.1);
}
{
  const b = new BallBody([0, BALL.radius, 0]);
  b.possess(4);
  b.strike({ speed: 12, dirYaw: 0.3, elevation: 0.1 });
  ok('une FRAPPE libère la possession (cause « frappe » au registre)',
    b.owner === null && b.ledger.releases.at(-1)?.cause === 'frappe');
  b.possess(4);
  b.restart([2, BALL.radius, 2], { cause: 'touche' });
  ok('une REMISE EN JEU libère la possession (« arrêt-de-jeu »)',
    b.owner === null && b.ledger.releases.at(-1)?.cause === 'arrêt-de-jeu');
}
{
  const b = new BallBody([0, 1, 0], [8, 2, 0]); b.integrate(2);
  b.ledger.releases.push({ cause: 'magie', by: 9 });
  ok('sabotage « sortie de possession de cause inventée AU REGISTRE » attrapé par le contrat',
    has(checkBallBody(b), 'sortie de possession'));
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
