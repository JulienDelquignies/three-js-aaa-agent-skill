// pitch — LE TERRAIN COMME DONNÉES : dimensions, surfaces, buts, et la géométrie des sorties.
//
// Le carré du rondo était un rectangle abstrait ; un match se joue sur un TERRAIN — lignes, buts,
// surfaces — et chaque sortie de balle a un NOM qui dépend d'où elle sort et de qui l'a touchée
// en dernier (Lois 9/15/16/17 ; en format réduit, la remise de touche se joue au pied, comme au
// futsal — c'est une loi du FORMAT, pas une simplification honteuse, et elle est écrite ici).
//
// Deux jeux de dimensions vivent côte à côte : le TERRAIN RÉDUIT (5c5+gardiens, celui du match
// actuel) et le PLEIN FORMAT (Loi 1 — 105 × 68, surfaces 16,50 m, but 7,32 × 2,44) déjà défini
// pour le 11c11 à venir. Un pitch est une VALEUR (makePitch) : la sim et la scène lisent la même.
//
// CONVENTION : x = longueur (les buts sont à x = ±L/2), z = largeur. L'équipe 0 ATTAQUE +x,
// l'équipe 1 attaque −x (attackSign). Tout est en mètres.

/** Plein format (Loi 1 + Loi 1 annexes). Pour le 11c11 à venir — déjà des données, pas du futur. */
export const FULL = {
  length: 105, width: 68,
  goal: { width: 7.32, height: 2.44 },
  box: { depth: 16.5, width: 40.32 },       // surface de réparation
  six: { depth: 5.5, width: 18.32 },        // surface de but
  spot: 11, circle: 9.15,
};

/** Format réduit (5c5 + gardiens, type fut7/futsal agrandi) — le terrain du match actuel. */
export const REDUIT = {
  length: 46, width: 30,
  goal: { width: 5.0, height: 2.0 },
  box: { depth: 8.0, width: 15.0 },
  six: { depth: 3.0, width: 9.0 },
  spot: 7.5, circle: 4.0,
};

/**
 * Un terrain jouable. `dims` est REDUIT par défaut ; passer FULL (ou des dims custom) plus tard.
 * Renvoie une valeur figée : demi-longueurs, rectangles des surfaces, centres de buts, et les
 * helpers géométriques que sim et bancs partagent.
 */
export function makePitch(dims = REDUIT) {
  const hx = dims.length / 2, hz = dims.width / 2;
  const p = {
    dims, hx, hz,
    // les buts : centre du montant à x = ±hx, ouverture en z
    goalHalf: dims.goal.width / 2, goalH: dims.goal.height,
    goals: [ { x: +hx, sign: +1 }, { x: -hx, sign: -1 } ],   // goals[0] = celui que l'équipe 0 attaque
    inPitch: (x, z, m = 0) => Math.abs(x) <= hx - m && Math.abs(z) <= hz - m,
    /** la surface de réparation du côté `sign` (+1 = but à +hx) contient-elle (x, z) ? */
    inBox: (x, z, sign) => (sign > 0 ? x >= hx - dims.box.depth : x <= -hx + dims.box.depth)
      && Math.abs(x) <= hx && Math.abs(z) <= dims.box.width / 2,
    /** le but que l'équipe `team` ATTAQUE (0 attaque +x, 1 attaque −x). */
    attackGoal: (team) => (team === 0 ? { x: +hx, sign: +1 } : { x: -hx, sign: -1 }),
    /** le but que l'équipe `team` DÉFEND. */
    ownGoal: (team) => (team === 0 ? { x: -hx, sign: -1 } : { x: +hx, sign: +1 }),
  };
  return Object.freeze(p);
}

/**
 * LA GÉOMÉTRIE D'UNE SORTIE — le cœur de règle. Le ballon a quitté le terrain entre deux images
 * (p0 → p1) : quelle remise ? La réponse ne dépend que de la GÉOMÉTRIE du franchissement et de la
 * DERNIÈRE ÉQUIPE au contact (`lastTeam`) et se calcule au point de franchissement INTERPOLÉ —
 * juger sur p1 déclarait « touche » un ballon sorti en coin, un tir dans le petit filet devenait
 * corner selon l'image d'échantillonnage.
 *
 * Renvoie { type, x, z, y, team } : type ∈ 'but' | 'touche' | 'corner' | 'sortie-de-but',
 * (x, z) le point de remise, team l'équipe qui remet (pour 'but' : l'équipe qui ENCAISSE engage).
 */
export function outRule(pitch, p0, p1, lastTeam) {
  const { hx, hz, goalHalf, goalH } = pitch;
  // franchissement de chaque ligne : t d'intersection sur le segment p0→p1
  const hits = [];
  const seg = (axis, at) => {
    const a = axis === 'x' ? p0[0] : p0[2], b = axis === 'x' ? p1[0] : p1[2];
    if ((a - at) * (b - at) > 0 || a === b) return null;
    return (at - a) / (b - a);
  };
  for (const [axis, at, id] of [['x', +hx, 'gl+'], ['x', -hx, 'gl-'], ['z', +hz, 'tl+'], ['z', -hz, 'tl-']]) {
    const t = seg(axis, at);
    if (t != null && t >= 0 && t <= 1) hits.push({ t, axis, at, id });
  }
  if (!hits.length) return null;                                   // pas de franchissement : en jeu
  const h = hits.sort((a, b) => a.t - b.t)[0];                     // la PREMIÈRE ligne franchie fait foi
  const X = p0[0] + (p1[0] - p0[0]) * h.t;
  const Y = (p0[1] ?? 0) + ((p1[1] ?? 0) - (p0[1] ?? 0)) * h.t;
  const Z = p0[2] + (p1[2] - p0[2]) * h.t;
  if (h.axis === 'z') {
    // TOUCHE (Loi 15 ; format réduit : remise au pied, sur la ligne, à l'équipe adverse)
    // posée 15 cm DANS le terrain : posée PILE sur la ligne, la remise re-déclenchait une sortie
    // au pas suivant avec un segment dégénéré (p0 = p1 sur la craie) — mesuré en match
    return { type: 'touche', x: Math.max(-hx + 0.5, Math.min(hx - 0.5, X)), z: Math.sign(h.at) * (hz - 0.15), y: 0, team: 1 - lastTeam };
  }
  // ligne de but : BUT si entre les montants et sous la barre
  const sign = h.at > 0 ? +1 : -1;
  if (Math.abs(Z) <= goalHalf && Y <= goalH) {
    // l'équipe qui attaque ce côté marque ; celle qui encaisse engage (Loi 8)
    const scorer = sign > 0 ? 0 : 1;
    return { type: 'but', x: 0, z: 0, y: 0, team: 1 - scorer, scorer };
  }
  // hors des montants : CORNER si le dernier contact est au DÉFENSEUR de ce but, SORTIE DE BUT sinon
  const defender = sign > 0 ? 1 : 0;                               // l'équipe 1 défend le but +x
  if (lastTeam === defender) {
    return { type: 'corner', x: sign * (hx - 0.4), z: Math.sign(Z || 1) * (hz - 0.4), y: 0, team: 1 - defender };
  }
  // sortie de but : posée au bord de la surface de but (Loi 16 — n'importe où dans la surface)
  return { type: 'sortie-de-but', x: sign * (hx - pitch.dims.six.depth), z: 0, y: 0, team: defender };
}

/**
 * CONTRAT. Les façons dont un terrain redevient silencieusement un rectangle abstrait : des
 * surfaces qui débordent des lignes, un but plus large que la surface de but, des sorties mal
 * nommées (le tir cadré compté corner, la touche en coin comptée sortie de but).
 */
export function checkPitch(pitch = makePitch()) {
  const issues = [];
  const d = pitch.dims;
  if (d.box.depth >= pitch.hx) issues.push('surface de réparation plus profonde que la moitié de terrain');
  if (d.box.width > d.width) issues.push('surface de réparation plus large que le terrain');
  if (d.six.depth >= d.box.depth) issues.push('surface de but plus profonde que la surface de réparation');
  if (d.goal.width >= d.six.width) issues.push('but plus large que la surface de but');
  if (d.spot >= d.box.depth === false && d.spot <= 0) issues.push('point de penalty hors sol');
  // l'exhaustivité des sorties, par construction : un éventail de franchissements dont on connaît
  // la réponse de règle — chaque cas est un mini-fixture, pas un espoir
  const cases = [
    { p0: [pitch.hx - 1, 0.1, 0], p1: [pitch.hx + 1, 0.1, 0], last: 0, want: 'but' },                    // cadré au centre, sous la barre
    { p0: [pitch.hx - 1, 3.0, 0], p1: [pitch.hx + 1, 3.2, 0], last: 0, want: 'sortie-de-but' },          // au-dessus de la barre
    { p0: [pitch.hx - 1, 0.1, pitch.goalHalf + 2], p1: [pitch.hx + 1, 0.1, pitch.goalHalf + 2], last: 0, want: 'sortie-de-but' }, // à côté, touché par l'attaque
    { p0: [pitch.hx - 1, 0.1, pitch.goalHalf + 2], p1: [pitch.hx + 1, 0.1, pitch.goalHalf + 2], last: 1, want: 'corner' },        // à côté, dévié par la défense
    { p0: [0, 0.1, pitch.hz - 1], p1: [0, 0.1, pitch.hz + 1], last: 0, want: 'touche' },                 // pleine touche
    { p0: [pitch.hx - 0.5, 0.1, pitch.hz - 0.5], p1: [pitch.hx + 1.5, 0.1, pitch.hz + 0.4], last: 0, want: 'sortie-de-but' },     // sorti en coin : la ligne de BUT d'abord
  ];
  for (const c of cases) {
    const r = outRule(pitch, c.p0, c.p1, c.last);
    if (!r || r.type !== c.want) issues.push(`sortie mal nommée : ${JSON.stringify(c.p0)}→${JSON.stringify(c.p1)} (dernier contact équipe ${c.last}) donne « ${r?.type} », la règle dit « ${c.want} »`);
  }
  // le BUT désigne le bon marqueur et le bon engageur
  const g = outRule(pitch, [pitch.hx - 1, 0.1, 0], [pitch.hx + 1, 0.1, 0], 0);
  if (g?.scorer !== 0 || g?.team !== 1) issues.push('le but à +x doit être marqué par l\'équipe 0 et engagé par la 1');
  const g2 = outRule(pitch, [-pitch.hx + 1, 0.1, 0], [-pitch.hx - 1, 0.1, 0], 1);
  if (g2?.scorer !== 1 || g2?.team !== 0) issues.push('le but à −x doit être marqué par l\'équipe 1 et engagé par la 0');
  // un ballon qui ne sort pas ne déclenche RIEN
  if (outRule(pitch, [0, 0.1, 0], [1, 0.1, 1], 0) !== null) issues.push('un ballon en jeu déclenche une remise');
  return { ok: issues.length === 0, issues };
}
