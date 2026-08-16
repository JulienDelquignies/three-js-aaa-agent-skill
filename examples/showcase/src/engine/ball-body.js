import { BALL, stepBall, kick } from './ball.js';

// ball-body — LE BALLON APPARTIENT À QUELQU'UN, ET SA POSITION NE S'ÉCRIT PAS.
//
// « Quand je vois un ballon se téléporter, pour moi ça veut dire qu'on a une physique horrible. »
// C'était exact, et la mesure est pire que l'impression : 285 sauts de plus de 5 cm en 4 parties de
// 90 s, jusqu'à 2,56 m en une image — soit 121 m/s de vitesse apparente pour un objet qui en fait 35
// au maximum quand un professionnel le frappe de toutes ses forces.
//
// LA CAUSE N'EST PAS « QUATRE LIGNES À CORRIGER ». Le ballon n'appartenait à personne : `st.ball`
// était un objet nu `{p, v, w}` et n'importe quel appelant pouvait écrire `ball.p = [...]`. Quatre le
// faisaient, une cinquième (que j'ai ajoutée moi-même la session précédente pour que « le ballon
// voyage avec le porteur ») déplaçait le ballon de `p.v·dt` sans jamais lui donner cette vitesse :
// 936 images d'advection fantôme à 2,9 m/s. Corriger les cinq sans changer la primitive laisse la
// sixième arriver au prochain commit. Ce module rend l'écriture IMPOSSIBLE plutôt qu'incorrecte.
//
// ET LE CONTRAT QUI DEVAIT RATTRAPER ÇA ÉTAIT STRUCTURELLEMENT AVEUGLE. `ball-no-teleport` lisait une
// trace échantillonnée 1 image sur 6 : un saut de 1,70 m étalé sur 0,1 s ressemble à 17 m/s et passe
// sous le seuil de 42. Même partie, même règle, même seuil, trois échantillonnages :
//     1/6 → 0 violation sur 3 596 (pire vitesse apparente 38,1 m/s)
//     1/3 → 22 sur 7 196 (77,2 m/s)
//     1/1 → 230 sur 21 596 (337,7 m/s)
// L'audit est donc DANS L'INTÉGRATEUR, à chaque sous-pas, et pas dans une trace.
//
// LA SEULE DISCONTINUITÉ LÉGITIME est une remise en jeu, et elle exige une CAUSE NOMMÉE — le même
// contrat que `abortGesture()` : ce qui est exceptionnel doit se déclarer, sinon ça redevient la règle.

/**
 * Combien un pas d'intégration peut déplacer le ballon, en multiples de `max(|v₀|,|v₁|)·h`.
 * CE N'EST PAS UN RÉGLAGE. Mesuré sur ~1,6 M de sous-pas (4 000 tirs : 0,2–32 m/s, élévation −0,2 à
 * 0,8 rad, spin 0–12 rev/s, 400 images chacun) : le rapport vaut exactement 1,000000 hors contact —
 * ball.js est en Euler semi-implicite, il met à jour v PUIS fait p += v·h — et 1,274 au pire à la
 * résolution d'un rebond, où le ballon est remonté de sa pénétration dans le sol. D'où 1,35 : au-delà,
 * ce n'est plus de l'intégration. Une position écrite dépasse ce budget de plusieurs ordres de
 * grandeur (le pire contrôle mesuré : 1,70 m contre un budget de 0,006 m).
 */
export const CONTINUITY_SLACK = 1.35;

/** Les seules raisons pour lesquelles un ballon peut apparaître ailleurs. Le jeu en a une ; en ajouter
 *  demande d'y penser, ce qui est exactement le point. */
export const RESTARTS = new Set(['sortie-de-but', 'coup-franc', 'touche', 'corner', 'engagement', 'penalty']);

/** Les seules façons de PERDRE le ballon quand on le porte. Même loi que RESTARTS et que les
 *  interruptions de geste : une sortie de possession se NOMME, sinon la perte silencieuse redevient
 *  le chemin normal — c'est la possession-étiquette qu'on vient d'enterrer. */
export const RELEASES = new Set(['frappe', 'touche', 'conduite', 'contesté', 'perte', 'sortie', 'arrêt-de-jeu', 'porte-dos']);

/**
 * L'AUDIT, en fonction PURE — donc sabotable directement, ce qui est la seule façon de prouver qu'il
 * mord. Un sabotage qui injecte une ligne dans le registre prouve que le vérificateur sait lire un
 * tableau, pas que l'audit sait le remplir : on peut remplacer CONTINUITY_SLACK par 10⁹ et un tel
 * sabotage reste vert. Celui-ci teste l'arithmétique elle-même.
 * @returns le rapport |Δp| / (max(|v₀|,|v₁|)·h) — au-delà de CONTINUITY_SLACK, c'est un téléport.
 */
export function stepRatio(p0, p1, v0, v1, h) {
  const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  const s0 = Math.hypot(v0[0], v0[1], v0[2]), s1 = Math.hypot(v1[0], v1[1], v1[2]);
  const budget = Math.max(s0, s1) * h;
  if (budget <= 1e-12) return d <= 1e-9 ? 0 : Infinity;   // immobile : tout déplacement est un saut
  return d / budget;
}

const frozen = (arr, name) => new Proxy(arr, {
  set(t, k) { throw new Error(`ballon : ${name}[${String(k)}] est en LECTURE SEULE. Un ballon ne se déplace pas en écrivant sa position — utilise impulse/strike/escort/integrate, ou restart(to, {cause}) si c'est vraiment une remise en jeu (ball-body.js).`); },
  defineProperty() { throw new Error(`ballon : ${name} est en lecture seule`); },
  deleteProperty() { throw new Error(`ballon : ${name} est en lecture seule`); },
});

export class BallBody {
  #s;
  #view;
  #owner;
  constructor(p = [0, BALL.radius, 0], v = [0, 0, 0], w = [0, 0, 0]) {
    this.#s = { p: [...p], v: [...v], w: [...w] };
    this.#view = { p: frozen(this.#s.p, 'p'), v: frozen(this.#s.v, 'v'), w: frozen(this.#s.w, 'w') };
    this.#owner = null;
    // LE REGISTRE. Ce que le corps a vécu, pour que le contrat lise des faits et non un échantillon.
    this.ledger = { steps: 0, breaches: [], restarts: [], worst: 0, possessions: 0, releases: [] };
  }

  /** Qui porte le ballon — `null` : personne, il est LIBRE (physique pure). Lecture seule : la
   *  possession change par possess()/release(cause), jamais par affectation. */
  get owner() { return this.#owner; }

  /**
   * LA CAPTURE : la possession devient un ÉTAT DU MOTEUR, pas une étiquette déduite (« c'est lui le
   * plus près »). Toute la famille de bugs de la négociation — la touche de conduite qui repousse
   * une livraison arrivée, l'assise qui tue un contrôle en route, control-at-foot à 33 % — venait
   * d'un ballon qui n'appartenait jamais à personne. Un seul porteur à la fois : capturer un ballon
   * porté par un AUTRE est un vol de balle, et un vol de balle passe par release('perte'|'contesté')
   * d'abord — le duel est un événement du jeu, pas une écrasure silencieuse d'état.
   */
  possess(owner) {
    if (owner == null) throw new Error('ballon : possess() sans porteur. La possession a un propriétaire, sinon c\'est l\'étiquette d\'avant.');
    if (this.#owner != null && this.#owner !== owner) {
      throw new Error(`ballon : possess(${owner}) alors que ${this.#owner} le porte. Un vol de balle se DÉCLARE : release('perte'|'contesté') d'abord — le duel est un événement, pas une écrasure.`);
    }
    if (this.#owner == null) this.ledger.possessions++;
    this.#owner = owner;
    return this;
  }

  /** LA SORTIE DE POSSESSION — à cause nommée, comme les remises en jeu et les gestes avortés. */
  release(cause) {
    if (this.#owner == null) return this;                       // déjà libre : sans effet
    if (!cause) throw new Error('ballon : release() sans cause. Une perte de ballon se nomme — sinon la perte silencieuse redevient le chemin normal.');
    if (!RELEASES.has(cause)) throw new Error(`ballon : cause de sortie de possession inconnue « ${cause} » (connues : ${[...RELEASES].join(', ')})`);
    this.ledger.releases.push({ cause, by: this.#owner });
    this.#owner = null;
    return this;
  }

  /**
   * LE PORTÉ : le ballon converge vers le point que le geste définit (le pied du contrôle, le point
   * de stance de l'armé) — PAR l'intégrateur, jamais par écriture. C'est un servo de position :
   * la vitesse désirée vise le point ((cible − p)/tau, PLAFONNÉE — un ballon porté va à la vitesse
   * d'un pied, pas d'un vœu), la vitesse réelle s'y relaxe, et integrate() déplace. Continu par
   * construction : l'audit de continuité tourne à chaque sous-pas comme pour tout le reste, et le
   * plafond rend la clause structurelle. Réservé au porteur : porter un ballon libre est le retour
   * de l'advection fantôme, donc c'est une erreur, pas un comportement.
   */
  carry(point, dt, { tau = 0.04, vMax = 9 } = {}) {
    if (this.#owner == null) throw new Error('ballon : carry() sur un ballon LIBRE. Le porté appartient à un porteur — possess(owner) d\'abord.');
    const s = this.#s;
    let dx = (point[0] - s.p[0]) / Math.max(1e-3, tau);
    let dz = (point[1] - s.p[2]) / Math.max(1e-3, tau);
    const m = Math.hypot(dx, dz);
    if (m > vMax) { dx *= vMax / m; dz *= vMax / m; }
    const a = 1 - Math.exp(-dt / Math.max(1e-4, tau));
    s.v[0] += (dx - s.v[0]) * a;
    s.v[2] += (dz - s.v[2]) * a;
    return this.integrate(dt);
  }

  // Lectures : des vues gelées. Tout le code existant (`b.p[0]`, `Math.hypot(...b.p)`, `[...b.p]`,
  // `Array.isArray(b.p)`) continue de fonctionner — sans quoi la lecture seule serait un mur que
  // personne n'adopterait. Seule l'ÉCRITURE lève.
  get p() { return this.#view.p; }
  get v() { return this.#view.v; }
  get w() { return this.#view.w; }

  /** Copie MUTABLE pour les prédicteurs (predictPath, solvePass) : ils simulent des futurs, ils ne
   *  touchent pas au présent. */
  snapshot() { return { p: [...this.#s.p], v: [...this.#s.v], w: [...this.#s.w] }; }

  /**
   * LE SEUL DÉPLACEMENT. Découpé comme ball.js le fait (jamais plus d'un demi-rayon par sous-pas),
   * mais en appelant le VRAI intégrateur à chaque sous-pas plutôt qu'en le réécrivant : un audit posé
   * sur un second intégrateur n'audite pas le jeu, il audite sa copie.
   */
  integrate(dt, opts = {}) {
    const s = this.#s;
    let left = dt;
    let guard = 0;
    while (left > 1e-9 && guard++ < 256) {
      const speed = Math.hypot(s.v[0], s.v[1], s.v[2]);
      const n = Math.max(1, Math.min(64, Math.ceil((speed * left) / (BALL.radius * 0.5))));
      const h = left / n;
      const p0 = [...s.p], v0 = [...s.v];
      stepBall(s, h, opts);
      const r = stepRatio(p0, s.p, v0, s.v, h);
      this.ledger.steps++;
      if (r > this.ledger.worst) this.ledger.worst = r;
      if (r > CONTINUITY_SLACK) {
        this.ledger.breaches.push({
          d: +Math.hypot(s.p[0] - p0[0], s.p[1] - p0[1], s.p[2] - p0[2]).toFixed(4),
          ratio: +r.toFixed(2), h: +h.toFixed(5),
        });
      }
      left -= h;
    }
    return this;
  }

  /** Un contact qui MODIFIE la trajectoire (déviation, amorti) : on ajoute à la vitesse. */
  impulse(dv, dw = null) {
    const s = this.#s;
    s.v[0] += dv[0]; s.v[1] += dv[1]; s.v[2] += dv[2];
    if (dw) { s.w[0] += dw[0]; s.w[1] += dw[1]; s.w[2] += dw[2]; }
    return this;
  }

  /**
   * Une FRAPPE : le pied domine, il remplace la vitesse. Et il ne DÉPLACE PAS le ballon — c'était le
   * quatrième site de téléportation, et le plus sournois parce que purement vertical : l'appelant
   * construisait `from = [x, BALL.radius, z]`, ce qui plaquait au sol un ballon en l'air avant de le
   * frapper (13 fois, jusqu'à 1,36 m de chute instantanée). On frappe le ballon LÀ OÙ IL EST.
   */
  strike({ speed, dirYaw, elevation, spinAxis = [0, 1, 0], spinRev = 0 }) {
    this.release('frappe');                                     // une frappe LIBÈRE : le vol est physique
    const k = kick([...this.#s.p], { speed, dirYaw, elevation, spinAxis, spinRev });
    const s = this.#s;
    s.v[0] = k.v[0]; s.v[1] = k.v[1]; s.v[2] = k.v[2];
    s.w[0] = k.w[0]; s.w[1] = k.w[1]; s.w[2] = k.w[2];
    return this;
  }

  /**
   * LE BALLON AU PIED PENDANT UN GESTE. Personne ne s'arrête net pour passer, mais « le ballon suit le
   * joueur » ne s'écrit pas `p += v_joueur·dt` : ça fabrique un déplacement que rien ne justifie
   * (mesuré : 936 images à 2,9 m/s de vitesse fantôme). On donne au ballon LA VITESSE du porteur, en
   * relaxant vers elle — et l'intégrateur fait le reste, en restant continu par construction.
   */
  escort([vx, vz], dt, { tau = 0.08 } = {}) {
    const a = 1 - Math.exp(-dt / Math.max(1e-4, tau));
    const s = this.#s;
    s.v[0] += (vx - s.v[0]) * a;
    s.v[2] += (vz - s.v[2]) * a;
    return this;
  }

  /**
   * Le ballon s'immobilise. IL NE SE DÉPLACE PAS : la conception d'origine faisait `p[1] = rayon`, ce
   * qui remet un téléport vertical par la porte de service (mesuré sur sa propre implémentation :
   * y = 1,79 m → 0,11 m, 1,68 m de chute en zéro seconde) — dans le module écrit exprès pour rendre ça
   * impossible. Un ballon en l'air ne « s'immobilise » pas : il retombe, ce qui est le travail de
   * l'intégrateur. On refuse donc plutôt que de tricher.
   */
  rest() {
    if (this.#s.p[1] > BALL.radius + 0.02) {
      throw new Error(`ballon : rest() sur un ballon à ${this.#s.p[1].toFixed(2)} m de haut. Il doit RETOMBER (integrate), pas être plaqué au sol.`);
    }
    const s = this.#s;
    s.v[0] = 0; s.v[1] = 0; s.v[2] = 0;
    s.w[0] = 0; s.w[1] = 0; s.w[2] = 0;
    return this;
  }

  /**
   * LA discontinuité légitime, et la seule. Elle exige une cause NOMMÉE et connue : ce qui est
   * exceptionnel doit se déclarer, sinon ça redevient le chemin normal sous un autre nom.
   */
  restart(to, { cause } = {}) {
    this.release('arrêt-de-jeu');                               // un ballon remis en jeu n'est porté par personne
    if (!cause) throw new Error('ballon : restart() sans cause. Une remise en jeu se justifie — sinon c\'est un téléport.');
    if (!RESTARTS.has(cause)) throw new Error(`ballon : cause de remise en jeu inconnue « ${cause} » (connues : ${[...RESTARTS].join(', ')})`);
    const s = this.#s;
    const d = Math.hypot(to[0] - s.p[0], (to[1] ?? BALL.radius) - s.p[1], to[2] - s.p[2]);
    this.ledger.restarts.push({ cause, d: +d.toFixed(2) });
    s.p[0] = to[0]; s.p[1] = to[1] ?? BALL.radius; s.p[2] = to[2];
    s.v[0] = 0; s.v[1] = 0; s.v[2] = 0;
    s.w[0] = 0; s.w[1] = 0; s.w[2] = 0;
    return this;
  }
}

/**
 * CONTRAT. Il lit le REGISTRE — donc chaque pas d'intégration, pas un échantillon.
 * Et il ÉCHOUE si on lui donne autre chose qu'un corps : « pas de registre » ne doit jamais pouvoir
 * valoir « pas de téléport ». C'est la façon dont l'ancienne règle était verte.
 */
export function checkBallBody(body, { restartMax = 30, restartsPerMin = 6, minutes = 1.5, minSteps = 100 } = {}) {
  const issues = [];
  if (!body || !body.ledger || typeof body.integrate !== 'function') {
    return { ok: false, issues: ['ce ballon n\'est pas un BallBody — il n\'a pas de registre, donc rien ne prouve qu\'il ne s\'est pas téléporté'] };
  }
  const L = body.ledger;
  if (L.breaches.length) {
    const w = L.breaches[0];
    issues.push(`${L.breaches.length} déplacement(s) inexpliqué(s) — le pire : ${w.d} m en ${w.h} s, soit ${w.ratio}× ce que la vitesse permet`);
  }
  for (const r of L.restarts) {
    if (!RESTARTS.has(r.cause)) issues.push(`remise en jeu de cause inconnue « ${r.cause} »`);
    if (r.d > restartMax) issues.push(`remise en jeu de ${r.d} m — c'est un déménagement, pas une remise en jeu (max ${restartMax} m)`);
  }
  // la possession aussi laisse des faits : chaque sortie a une cause connue, sinon la perte
  // silencieuse est revenue par le registre (le sabotage injecte exactement ça)
  for (const r of (L.releases ?? [])) {
    if (!RELEASES.has(r.cause)) issues.push(`sortie de possession de cause inconnue « ${r.cause} »`);
  }
  const perMin = minutes > 0 ? L.restarts.length / minutes : 0;
  if (perMin > restartsPerMin) issues.push(`${perMin.toFixed(1)} remises en jeu par minute — l'exception est devenue la règle (max ${restartsPerMin})`);
  if (L.steps < minSteps) issues.push(`seulement ${L.steps} pas d'intégration : un contrat vert sur un ballon qui n'a pas vécu n'a rien vérifié`);
  return { ok: issues.length === 0, issues, stats: { steps: L.steps, breaches: L.breaches.length, worst: +L.worst.toFixed(3), restarts: L.restarts.length, possessions: L.possessions ?? 0, releases: (L.releases ?? []).length } };
}
