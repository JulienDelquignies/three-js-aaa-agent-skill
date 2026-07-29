// approach — LES MÈTRES : un geste se joue DEPUIS une position, et c'est elle qu'on prépare.
//
// L'audit membre par membre l'a montré au chiffre près : à l'instant du contact, le pied de frappe
// était à 1,00 m du ballon et le pied d'appui à 1,35 m — le geste jouait en pantomime à côté du ballon,
// parce que rien ne liait spatialement le corps au ballon. Le clip jouait où le joueur se trouvait ;
// la simulation frappait le ballon où LUI se trouvait ; personne n'alignait les deux.
//
// La technique de l'industrie a un nom chez tout le monde : Precision Movement chez FIFA 14 (« player
// locomotion is made on a step by step basis »), Distance Matching + Motion Warping chez Unreal. L'idée
// tient en trois morceaux, et les deux premiers sont de la géométrie pure :
//   1. LA STANCE — pour chaque technique, OÙ doit être le ballon relativement au corps à l'instant du
//      contact. C'est un fait biomécanique, pas un réglage : le pied d'appui se plante à 27–37 cm
//      latéralement du ballon (littérature de l'instep kick), donc le centre du corps est à ~0,55 m du
//      ballon, ouvert de ~25° côté pied frappeur pour une passe de l'intérieur.
//   2. L'ANCRE — la position + l'orientation du corps qui réalisent cette stance pour CE ballon et
//      CETTE direction de passe. anchorFor() la calcule ; elle est atteignable ou elle ne l'est pas,
//      et un engagement sur une ancre inatteignable est REFUSÉ (le joueur continue de s'approcher —
//      c'est du football : on ne frappe pas un ballon qu'on n'a pas rejoint).
//   3. LE GLISSEMENT — pendant l'anticipation du geste, le corps est amené de sa position d'engagement
//      à l'ancre, en douceur (ease in-out), à vitesse humaine bornée. C'est le « step adjustment » :
//      les derniers décimètres se règlent pendant l'armé, comme un vrai joueur ajuste ses derniers
//      appuis. Au contact, la stance est vraie par construction — le pied arrive SUR le ballon.
//
// Dépendance : aucune. Tout se prouve dans node (verify-approach.mjs), la simulation ne fait qu'appeler.

/**
 * LA TABLE DES STANCES — par clip de geste : où est le ballon, relativement au corps, au contact.
 *   dist    — m du centre du corps au ballon
 *   bearing — ° depuis le regard, POSITIF CÔTÉ PIED FRAPPEUR (le miroir change le signe, pas la table)
 * Sources : pied d'appui à 27–37 cm latéral du ballon (revue instep kick) → corps à ~0,5–0,65 m ;
 * la talonnade a le ballon DERRIÈRE (c'est sa définition) ; le pivot l'a plus ouvert.
 */
export const STANCES = {
  passe: { dist: 0.55, bearing: 24 },
  frappe: { dist: 0.62, bearing: 14 },
  passeExterieur: { dist: 0.50, bearing: 32 },
  passePivot: { dist: 0.60, bearing: 38 },
  deviation: { dist: 0.45, bearing: 28 },
  talonnade: { dist: 0.38, bearing: 168 },
};

const D2R = Math.PI / 180;
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/**
 * L'ANCRE : où le CORPS doit être (position + lacet) pour que `stance` soit vraie sur ce ballon avec
 * cette direction de sortie. Convention du module rondo : le regard est [cos(yaw), sin(yaw)].
 * @param ball   [x, z] du ballon (au sol — la stance est une géométrie plane)
 * @param outYaw le lacet de la direction de PASSE voulue
 * @param foot   'right' | 'left' — le miroir change le CÔTÉ du relèvement, jamais la distance
 */
export function anchorFor(ball, outYaw, foot, stance) {
  // le corps regarde la sortie, tourné de peu : la stance dit où est le ballon DANS ce regard.
  // LE CÔTÉ SUIT LA CONVENTION DE situation() (technique.js) : cross = fx·uz − fz·ux, POSITIF =
  // ballon à GAUCHE, et un ballon à l'angle yaw+β a cross = sin(β). Donc pied gauche ⇒ β > 0.
  // La première version avait le signe inverse — stance réalisée au degré près… du mauvais côté du
  // corps, un gaucher avec le ballon à droite. Attrapé par la mesure (écart uniforme de 76°), et
  // c'est désormais une clause avec ce sabotage précis.
  const side = foot === 'left' ? 1 : -1;
  const yaw = outYaw;                                        // le regard au contact = la direction de passe
  const b = stance.bearing * side * D2R;
  // ballon = corps + R(yaw + b) · dist  ⇒  corps = ballon − R(yaw + b) · dist
  const a = yaw + b;
  return {
    p: [ball[0] - Math.cos(a) * stance.dist, ball[1] - Math.sin(a) * stance.dist],
    yaw,
  };
}

/** La stance RÉALISÉE par une géométrie donnée — pour la juger, pas la produire. */
export function stanceOf(playerP, playerYaw, ball, foot) {
  const dx = ball[0] - playerP[0], dz = ball[1] - playerP[1];
  const dist = Math.hypot(dx, dz) || 1e-9;
  const fx = Math.cos(playerYaw), fz = Math.sin(playerYaw);
  const ux = dx / dist, uz = dz / dist;
  const cross = fx * uz - fz * ux;                          // > 0 : ballon à GAUCHE (convention situation())
  const abs = (Math.acos(Math.max(-1, Math.min(1, fx * ux + fz * uz))) / D2R);
  const onStrikingSide = (cross > 0) === (foot === 'left');
  return { dist, bearing: onStrikingSide ? abs : -abs };    // positif = côté pied frappeur
}

/**
 * ATTEIGNABLE ? Les derniers décimètres se règlent pendant l'armé, pas les derniers mètres. La borne
 * est une vitesse d'ajustement humaine (des petits pas, pas un sprint) × la durée d'anticipation,
 * plafonnée : au-delà, l'engagement est un téléport déguisé et il est REFUSÉ.
 */
export function reachable(from, anchor, antic, { adjustSpeed = 3.0, hardMax = 0.9 } = {}) {
  const d = Math.hypot(anchor.p[0] - from[0], anchor.p[1] - from[1]);
  return d <= Math.min(hardMax, adjustSpeed * Math.max(0.05, antic));
}

/** L'assiette du glissement : ease in-out (départ et arrivée doux — un pas, pas un rail). */
export const glideEase = (t) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };

/**
 * LE GLISSEMENT : position et lacet du corps à la fraction `t01` de l'anticipation. Pure — la
 * simulation l'échantillonne, elle ne tient aucun état. Le lacet tourne par le plus court chemin.
 */
export function glide(from, fromYaw, anchor, t01) {
  const e = glideEase(t01);
  return {
    p: [from[0] + (anchor.p[0] - from[0]) * e, from[1] + (anchor.p[1] - from[1]) * e],
    yaw: fromYaw + wrap(anchor.yaw - fromYaw) * e,
  };
}

/**
 * LE PLAN DE FRAPPE — quelle technique, quel pied, quelle ancre : décidé par L'ATTEIGNABILITÉ,
 * pas par la géométrie transitoire.
 *
 * La leçon est chèrement mesurée. Tant que la technique était re-choisie à chaque image sur la
 * géométrie DU MOMENT (situation courante du ballon dans le regard), l'approche se dissolvait
 * elle-même : en marchant autour de son ballon vers l'ancre d'une passe, le porteur a
 * transitoirement le ballon DERRIÈRE lui — la table basculait sur talonnade/déviation, dont les
 * anticipations courtes serrent la borne d'atteignabilité, l'ancre sautait de l'autre côté du
 * corps, et le plan repartait de zéro : refus d'ancre à 0,54 m SOUS la borne de la passe, pertes
 * par tacle 67 → 192. La géométrie transitoire d'une approche n'est pas une situation de frappe :
 * c'est le chemin vers elle.
 *
 * Or une fois l'approche construite, le corps ARRIVE TOURNÉ VERS LA PASSE (l'ancre réalise la
 * stance : relèvement de sortie ≈ 0 par construction). La question « quelle surface est légale
 * pour ce relèvement » se dissout — c'est l'approche qui la rend légale. La vraie question du
 * choix devient celle du footballeur : QUELLE STANCE PUIS-JE REJOINDRE DANS LE TEMPS QUE J'AI ?
 * Le temps qu'il faut : la stance PROPRE (intérieur du pied — pref la plus haute). Pas le temps :
 * la surface qui improvise (extérieur, talon), dont l'ancre est plus proche de là où on est déjà.
 *
 * Pure et sans dépendance : candidats (clip + préférence + anticipation) injectés par l'appelant.
 * @param candidates [{clip, pref, antic, data?}] — pref 0..1 (l'accuracy de la table des techniques)
 * @returns {{best, steer}} best = le meilleur candidat ATTEIGNABLE (fit ≤ 1) ou null ;
 *          steer = le meilleur candidat tout court — son ancre est OÙ MARCHER quand rien n'est
 *          encore atteignable (un refus pilote l'approche, il ne laisse pas le corps sans cap).
 */
export function planStrike(playerP, ball, outYaw, candidates, {
  stances = STANCES, adjustSpeed = 3.6, hardMax = 0.9,
  rushed = false, rushedSlack = 0.25, farCost = 0.35, extraReach = 0,
} = {}) {
  const all = [];
  for (const cand of candidates) {
    const s = stances[cand.clip];
    if (!s) continue;
    for (const foot of ['right', 'left']) {
      const anchor = anchorFor(ball, outYaw, foot, s);
      const d = Math.hypot(anchor.p[0] - playerP[0], anchor.p[1] - playerP[1]);
      // `extraReach` : mètres de MARCHE déjà acquis avant que le glissement ne commence — le cas de
      // la livraison en route (le corps se place PENDANT que le ballon voyage). La borne du
      // glissement (hardMax) ne bouge pas : seule la marche d'avant s'ajoute au chemin permis.
      const budget = Math.min(hardMax, adjustSpeed * Math.max(0.05, cand.antic)) + Math.max(0, extraReach);
      const fit = d / Math.max(1e-6, budget);
      // une stance atteignable vaut sa préférence pleine ; une stance hors d'atteinte paie sa
      // distance — c'est ce qui fait marcher vers la stance PROPRE quand on a le temps, et
      // basculer sur la surface improvisée seulement quand la propre est trop loin pour le temps.
      const score = cand.pref - farCost * Math.max(0, fit - 1);
      all.push({ clip: cand.clip, foot, pref: cand.pref, antic: cand.antic, data: cand.data, anchor, d, fit, score });
    }
  }
  all.sort((a, b) => b.score - a.score);
  const steer = all[0] ?? null;
  // ON S'ENGAGE QUAND *SON* PLAN EST ATTEIGNABLE — pas quand n'importe quel plan inférieur l'est.
  // La première version prenait « le mieux noté PARMI les atteignables » : debout devant son
  // ballon, la talonnade est toujours sous le pied (fit ≈ 0) et elle s'engageait AVANT le pas qui
  // rejoint la stance propre — le harnais l'a attrapée telle quelle. Le plan, c'est le mieux noté
  // tout court ; tant qu'il n'est pas à portée, on MARCHE (steer) au lieu de frapper au rabais.
  // (Le talon ne gagne le score que si la stance propre est à plus de ~2 m — pref 0,55 contre
  // 1 − 0,35·(fit−1) — c'est-à-dire une vraie géométrie d'urgence, sinon holdMax improvise déjà.)
  // PRESSÉ, la règle s'assouplit d'un cran EXACT : on s'engage sur la meilleure option DÉJÀ
  // atteignable si elle vaut presque le plan (rushedSlack, sur l'échelle des préférences 0–1 —
  // 0,25 garde l'extérieur et le coup de patte, exclut talon et pivot tant que la passe domine),
  // la plus prompte d'entre elles. Attendre son plan parfait sous pression a été mesuré : le
  // record est retombé de 8,8 à 6,9 — un joueur pressé joue la plus simple de ses VRAIES options.
  let best = null;
  if (steer && steer.fit <= 1) best = steer;
  if (rushed && steer) {
    const near = all.filter((c) => c.fit <= 1 && c.score >= steer.score - rushedSlack);
    if (near.length) best = near.reduce((b, c) => (c.antic < b.antic ? c : b), near[0]);
  }
  return { best, steer };
}

/**
 * CONTRAT. Chaque clause est une façon dont « il joue depuis la bonne position » redevient faux en
 * silence ; verify-approach porte un sabotage par clause — dont l'ANCIEN monde (pas d'ancre du tout),
 * qui doit être condamné par la clause de stance avec les chiffres mêmes de l'audit (1,00 m).
 */
export function checkApproach({ stances = STANCES } = {}) {
  const issues = [];
  // 1. les stances sont des géométries jouables : à portée de jambe, jamais dans le corps
  for (const [id, s] of Object.entries(stances)) {
    if (!(s.dist >= 0.3 && s.dist <= 0.8)) issues.push(`stance « ${id} » : dist ${s.dist} m hors [0,3 ; 0,8] — hors de portée de jambe ou dans le corps`);
    if (id !== 'talonnade' && Math.abs(s.bearing) > 60) issues.push(`stance « ${id} » : relèvement ${s.bearing}° — un geste avant ne se joue pas un ballon derrière`);
  }
  if (stances.talonnade && Math.abs(stances.talonnade.bearing) < 140) issues.push('la talonnade doit avoir le ballon DERRIÈRE (c\'est sa définition)');
  // 2. anchorFor réalise exactement la stance qu'on lui demande (aller-retour exact)
  for (const foot of ['right', 'left']) {
    for (const [id, s] of Object.entries(stances)) {
      const ball = [3.2, -1.7], outYaw = 0.8;
      const a = anchorFor(ball, outYaw, foot, s);
      const got = stanceOf(a.p, a.yaw, ball, foot);
      if (Math.abs(got.dist - s.dist) > 1e-9 || Math.abs(wrap((got.bearing - s.bearing) * D2R)) > 1e-9) {
        issues.push(`anchorFor(${id}, ${foot}) ne réalise pas sa stance (dist ${got.dist.toFixed(3)}, relèvement ${got.bearing.toFixed(1)}°)`);
      }
    }
  }
  // 3. le glissement part d'où on est, arrive SUR l'ancre, et ses deux bouts sont doux
  {
    const a = anchorFor([1, 1], 0.3, 'right', stances.passe);
    const g0 = glide([0, 0], 2.0, a, 0), g1 = glide([0, 0], 2.0, a, 1);
    if (Math.hypot(g0.p[0], g0.p[1]) > 1e-9) issues.push('le glissement ne part pas de la position de départ');
    if (Math.hypot(g1.p[0] - a.p[0], g1.p[1] - a.p[1]) > 1e-9) issues.push('le glissement n\'arrive pas sur l\'ancre');
    const v0 = (glideEase(0.01) - glideEase(0)) / 0.01, v1 = (glideEase(1) - glideEase(0.99)) / 0.01;
    if (v0 > 0.1 || v1 > 0.1) issues.push('le glissement démarre ou s\'arrête en échelon (pas un pas humain)');
  }
  // 4. l'inatteignable est refusé, l'atteignable accepté — la borne est une vitesse humaine
  if (reachable([0, 0], { p: [2.0, 0] }, 0.38)) issues.push('une ancre à 2 m en 0,38 s est acceptée : c\'est un téléport déguisé');
  if (!reachable([0, 0], { p: [0.5, 0] }, 0.38)) issues.push('une ancre à 0,5 m en 0,38 s est refusée : le jeu ne peut plus frapper');
  return { ok: issues.length === 0, issues };
}
