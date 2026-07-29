// gesture — UNE ACTION A UN DÉBUT ET UNE FIN.
//
// C'est la pièce qui manquait pour que ça ressemble à du jeu plutôt qu'à une simulation illustrée.
// Jusqu'ici la simulation frappait le ballon, PUIS demandait une pose au personnage : l'animation
// commentait le ballon au lieu de le produire. Deux conséquences visibles à la caméra basse, et les
// deux ont été signalées à l'œil nu avant d'être trouvées dans le code —
//   • « ça se voit même pas le mouvement » : le clip démarrait À la frame de contact, donc tout l'armé
//     était sauté. Le joueur passait de « debout » à « jambe déjà passée ». Il n'y avait pas de geste,
//     il y avait la fin d'un geste.
//   • « les mouvements ne s'arrêtent pas quand le ballon part » : exact, et c'est l'autre moitié. Un
//     geste se termine à SA fin, pas à l'instant du contact.
//
// Le modèle est une ligne de temps en trois temps, qui est la façon dont toute action animée est
// construite dans un moteur (anticipation / contact / accompagnement) :
//
//     début ─── ANTICIPATION ───▶ CONTACT ─── ACCOMPAGNEMENT ───▶ fin
//     (il s'engage)              (le ballon part)                (il finit son geste)
//
// Trois règles que le reste du moteur doit respecter, et que le contrat vérifie :
//   1. LE BALLON PART AU CONTACT, pas à la décision. C'est l'inversion.
//   2. L'ACTEUR EST ENGAGÉ dès le début : il ne redécide pas, il ne conduit pas le ballon, il plante
//      son appui. On peut lui prendre le ballon pendant l'armé — c'est précisément ce qui rend le
//      pressing dangereux, et ça n'existait pas.
//   3. LE GESTE VA À SON TERME. S'il est interrompu, l'interruption a un NOM et elle est tracée. Un
//      geste qui disparaît sans fin ni cause est le défaut que ce module existe pour rendre impossible.
//
// Sans three.js et sans DOM : la ligne de temps se prouve dans node (verify-gesture), l'animation
// n'a plus qu'à la suivre. Voir reference/48.

/**
 * Découpe un mouvement (au sens animkit : une durée + une frame de contact) en une ligne de temps.
 * `contact` est en SECONDES depuis le début du clip, comme `clip.userData.contact`.
 */
export function gestureTiming(move) {
  const total = move.duration ?? move.total ?? 0;
  const contact = move.contact ?? 0;
  return { anticipation: contact, follow: Math.max(0, total - contact), total };
}

/**
 * Engager `actor` dans un geste. Rien ne se produit sur le ballon ici : c'est tout l'intérêt.
 * @param actor    l'objet joueur (on lui pose `.act`)
 * @param move     { id, duration, contact }
 * @param payload  ce que le contact devra exécuter (la passe choisie, le contrôle…)
 */
export function startGesture(actor, move, { payload = null, log = null } = {}) {
  const { anticipation, follow, total } = gestureTiming(move);
  actor.act = {
    id: move.id, t: 0, anticipation, follow, total,
    phase: anticipation > 0 ? 'anticipation' : 'follow',
    fired: anticipation <= 0, payload,
  };
  if (anticipation <= 0) log?.push({ type: 'contact', id: move.id, actor: actor.id, t: 0 });
  log?.push({ type: 'start', id: move.id, actor: actor.id, anticipation, follow });
  return actor.act;
}

/**
 * Avancer le geste. Renvoie l'ÉVÉNEMENT franchi pendant ce pas, jamais un état :
 *   'contact' — c'est maintenant que le ballon part
 *   'end'     — le geste est fini, l'acteur est rendu à lui-même
 * Un pas assez long pour franchir les deux renvoie 'contact' et garde 'end' pour le pas suivant :
 * on ne peut pas frapper et avoir fini dans le même instant, et confondre les deux est exactement
 * comment on perd le geste.
 */
export function stepGesture(actor, dt, { log = null } = {}) {
  const a = actor.act;
  if (!a) return null;
  a.t += dt;
  if (!a.fired && a.t >= a.anticipation) {
    a.fired = true; a.phase = 'follow';
    log?.push({ type: 'contact', id: a.id, actor: actor.id, t: +a.t.toFixed(3) });
    return 'contact';
  }
  if (a.t >= a.total) {
    log?.push({ type: 'end', id: a.id, actor: actor.id, t: +a.t.toFixed(3) });
    actor.act = null;
    return 'end';
  }
  return null;
}

/**
 * Interrompre — avec une CAUSE. Un geste ne s'évapore pas : soit il va au bout, soit quelque chose de
 * nommé l'a arrêté (un tacle pendant l'armé, une perte de balle). Le contrat refuse le reste.
 */
export function abortGesture(actor, reason, { log = null } = {}) {
  if (!actor.act) return false;
  log?.push({ type: 'abort', id: actor.act.id, actor: actor.id, reason, t: +actor.act.t.toFixed(3) });
  actor.act = null;
  return true;
}

/** Un geste est en cours : l'acteur ne décide rien d'autre. */
export const busy = (actor) => !!actor.act;
/** Il est encore dans l'armé : le ballon n'est pas parti, on peut encore le lui prendre. */
export const winding = (actor) => !!actor.act && !actor.act.fired;
/** Il accompagne : le ballon est parti, mais il n'a pas fini de bouger. */
export const following = (actor) => !!actor.act && actor.act.fired;

/**
 * CONTRAT. Chaque clause est une façon dont un geste redevient silencieusement une pose.
 * @param log     la trace produite par start/step/abort
 * @param moves   les mouvements utilisés, pour vérifier qu'ils ont vraiment un début et une fin
 * @param limits  { minAnticipation, minFollow }
 */
export function checkGestures(log, moves = [], limits = {}) {
  const { minAnticipation = 0.06, minFollow = 0.08 } = limits;
  const issues = [];

  // 1. UN MOUVEMENT SANS ARMÉ N'EST PAS UN MOUVEMENT. Contact à 0 = la pose commence déjà frappée ;
  //    contact à la fin = le geste s'arrête pile quand le ballon part, ce que la vraie vie ne fait pas.
  for (const m of moves) {
    const { anticipation, follow } = gestureTiming(m);
    if (anticipation < minAnticipation) issues.push(`« ${m.id} » n'a pas d'armé (contact à ${anticipation.toFixed(2)} s < ${minAnticipation})`);
    if (follow < minFollow) issues.push(`« ${m.id} » n'a pas d'accompagnement (${follow.toFixed(2)} s après le contact < ${minFollow})`);
  }

  // 2. TOUT GESTE COMMENCÉ SE TERMINE — par sa fin ou par une cause nommée. Un `start` orphelin est un
  //    geste qui a disparu de l'écran au milieu, ce qui est très exactement ce qu'on veut interdire.
  const open = new Map();
  for (const e of log) {
    const key = `${e.actor}`;
    if (e.type === 'start') {
      if (open.has(key)) issues.push(`geste « ${e.id} » démarré sur l'acteur ${e.actor} alors que « ${open.get(key).id} » n'était pas fini`);
      open.set(key, { id: e.id, fired: e.anticipation <= 0 });
    } else if (e.type === 'contact') {
      const o = open.get(key);
      if (!o) issues.push(`contact « ${e.id} » sans geste ouvert sur l'acteur ${e.actor}`);
      else if (o.fired) issues.push(`double contact sur « ${e.id} » (acteur ${e.actor})`);
      else o.fired = true;
    } else if (e.type === 'end') {
      const o = open.get(key);
      if (!o) issues.push(`fin « ${e.id} » sans geste ouvert sur l'acteur ${e.actor}`);
      // 3. UN GESTE QUI SE TERMINE NORMALEMENT A FRAPPÉ. S'il finit sans contact, le ballon n'est
      //    jamais parti : l'action a été jouée en pantomime.
      else if (!o.fired) issues.push(`geste « ${e.id} » terminé sans contact (acteur ${e.actor})`);
      open.delete(key);
    } else if (e.type === 'abort') {
      if (!open.has(key)) issues.push(`interruption « ${e.id} » sans geste ouvert (acteur ${e.actor})`);
      if (!e.reason) issues.push(`geste « ${e.id} » interrompu sans cause nommée (acteur ${e.actor})`);
      open.delete(key);
    }
  }
  for (const [actor, o] of open) issues.push(`geste « ${o.id} » de l'acteur ${actor} n'a jamais fini (ni fin, ni interruption)`);

  return { ok: issues.length === 0, issues };
}
