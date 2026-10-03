// gestes-course.mjs — LES GESTES DU PORTEUR EN COURSE, JOUÉS PAR LE CORPS (retour du 3 octobre : « je serais déçu si on ne peut pas voir
// un Dani Olmo dans la 3D… des mouvements smooth qui suivent les joueurs, peu importe le contexte, peu importe la zone — mais on ne demande
// pas à un central de déclencher un 1v1 »).
//
// LE PARTAGE DU TRAVAIL :
//   · LE CERVEAU DÉCIDE (cerveau.mjs, gesteDuCerveau) : ses fenêtres — le défenseur qui se jette, la course fermée, le jockey posté… — et
//     ses attributs — dribM (le rôle, le lieu, la cadence, la nature du spécialiste, la lucidité), le flair, la technique. Un central ne
//     tente presque rien (sa nature 0,4-0,7, son tiers ×0,5, devant son but ×0,1) ; le technicien varie ; l'anomalie en fait cinq fois plus ;
//   · CE MODULE FAIT JOUER la décision au corps : il choisit l'animation du répertoire en course (gestes/course/*.anim, cuites par
//     outils/foulee-gpf.mjs : la foulée générée du duel et ses temps — touche, arc, vente) — l'espèce, et la variante de l'allure du
//     porteur (2,5 m/s sous 3, 3,5 sous 4,2, 5 au-delà ; le passement planté sous 1,8) ; le CÔTÉ, c'est le corps qui le prend (le fichier
//     et son miroir : la sortie demandée) ;
//   · LE CORPS JOUE : l'animation part quand sa première touche atteint le ballon (sa triche), ses touches suivantes sont jouées en série
//     (patch.py, étape 14), sa racine est suivie telle quelle.
//
// LA VIE D'UN GESTE (mesurée par bancs/course-essai.mjs) :
//   DEMANDE  l'intention GESTE (la sortie, l'allure, le n°) tenue au plus ATTENTE s — le corps le lance quand la touche est à sa portée
//            (10-850 ms) ; sinon la demande tombe (le porteur conduit, le cerveau retentera à sa prochaine fenêtre) ;
//   TOUCHE   l'intention tenue jusqu'à sa première touche (le journal : GF_EV_SERIE de rang 0) — un contrôle dont la touche n'a pas eu
//            lieu est coupé par une intention qui change (corps.md § 5.6) ;
//   SORTIE   la conduite vers la sortie du geste, à son allure, jusqu'à sa fin (+ 0,2 s) — le corps finit le geste, puis court ;
//   FIN      un autre joueur touche le ballon, le porteur le passe, ou le geste est fini.
// LA MORSURE : au contact (la première touche), le défenseur visé est jugé par le NOYAU DE DUEL du cerveau (noyau.js, noyauAuContact :
// les attributs du porteur contre ceux du défenseur, la géométrie, huit issues) — franchi, il MORD : le temps de sa morsure (la loi du
// cerveau par geste, × la technique du porteur), il part sur la ligne que le porteur a quittée, sans réflexes de duel.
import { INTENTION } from './contrat.mjs';

/** LE RÉPERTOIRE EN COURSE (outils/foulee-gpf.mjs, NUMEROS : la même numérotation) : pour chaque geste du cerveau, l'animation du corps —
 *  son n° et sa durée (s) par allure, sa sortie (°, + à droite, côté du fichier : le corps prend le miroir). Une décision du cerveau sans
 *  animation est comptée (« pas encore dans le corps ») : le porteur conduit. */
export const COURSE = {
  // LE PASSEMENT À L'ARRÊT (le répertoire du face-à-face, outils/vers-gpf.mjs : 106-109, des déplacements sans touche) : le cerveau le
  // décide surtout sur un porteur presque arrêté (le jockey posté devant) — le corps n'a que des gestes à l'arrêt sous 1,8 m/s
  passementArret: { n: { 0: 106 }, sortie: 0, duree: { 0: 0.66 }, sansTouche: true }, passementArret2: { n: { 0: 107 }, sortie: 0, duree: { 0: 1.08 }, sansTouche: true },
  passementArret3: { n: { 0: 108 }, sortie: 0, duree: { 0: 1.38 }, sansTouche: true }, passementArret4: { n: { 0: 109 }, sortie: 0, duree: { 0: 1.68 }, sansTouche: true },
  // …LA CROQUETA ET LE RÂTEAU À L'ARRÊT (115, 116 : la croqueta du face-à-face, l'intérieur droit puis le gauche ; le râteau du duel, la semelle
  // qui ramène le ballon et le corps qui se retourne)
  croquetaArret: { n: { 0: 115 }, sortie: -26, duree: { 0: 0.36 } }, rateauArret: { n: { 0: 116 }, sortie: 180, duree: { 0: 0.7 } },
  // LES GESTES EN COURSE (gestes/course/repertoire.json, écrit par outils/foulee-gpf.mjs tous — cette table le reproduit, le banc
  // course-essai le vérifie) : le n° et la durée par allure d'entrée (2,5 · 3,5 · 5 m/s), la sortie (°, + à droite, côté du fichier)
  crochetCourt: { n: { 2.5: 200, 3.5: 201, 5: 202 }, sortie: -52, duree: { 2.5: 0.63, 3.5: 0.63, 5: 0.62 } },
  crochet: { n: { 2.5: 210, 3.5: 211, 5: 212 }, sortie: -80, duree: { 2.5: 0.68, 3.5: 0.68, 5: 0.67 } },
  crochetChaloupe: { n: { 2.5: 220, 3.5: 221, 5: 222 }, sortie: -90, duree: { 2.5: 0.91, 3.5: 0.89, 5: 0.87 } },
  crochetExt: { n: { 2.5: 230, 3.5: 231, 5: 232 }, sortie: 60, duree: { 2.5: 0.63, 3.5: 0.63, 5: 0.62 } },
  croqueta: { n: { 2.5: 240, 3.5: 241, 5: 242 }, sortie: -26, duree: { 2.5: 0.98, 3.5: 0.97, 5: 0.92 } },
  feinteCorps: { n: { 2.5: 250, 3.5: 251, 5: 252 }, sortie: -40, duree: { 2.5: 0.87, 3.5: 0.85, 5: 0.82 } },
  passement: { n: { 2.5: 260, 3.5: 261, 5: 262 }, sortie: -52, duree: { 2.5: 0.87, 3.5: 0.85, 5: 0.82 } },
  grandPont: { n: { 2.5: 270, 3.5: 271, 5: 272 }, sortie: 30, duree: { 2.5: 1.18, 3.5: 1.18, 5: 1.17 } },
  petitPont: { n: { 2.5: 280, 3.5: 281, 5: 282 }, sortie: 22, duree: { 2.5: 1.03, 3.5: 1.03, 5: 1.02 } },
};
/** Le geste du cerveau → l'animation, selon l'allure du porteur au corps `v` : son espèce (le crochet court, standard, chaloupé), la
 *  croqueta, le passement à la sortie en diagonale (le contre-pied, et le « fixer » : la sortie droite n'a pas encore son animation), la
 *  feinte de corps, le grand et le petit pont ; à l'arrêt (< 1,8 m/s), le passement, la croqueta et le râteau plantés. Le râteau lancé,
 *  la roulette : pas encore dans le corps. */
export function animationPour(g, v = 3.5) {
  if (g.nom === 'crochet') return g.espece === 'crochetCourt' ? 'crochetCourt' : g.espece === 'crochetChaloupe' ? 'crochetChaloupe' : 'crochet';
  if (g.nom === 'doubleContact') return v < 1.8 ? 'croquetaArret' : 'croqueta';
  if (g.nom === 'rateau' && v < 1.8) return 'rateauArret';
  if (g.nom === 'passement' && v < 1.8) return g.tours >= 2 ? `passementArret${Math.min(4, g.tours)}` : 'passementArret';
  if (g.nom === 'passement' && g.maniere !== 'temporise') return 'passement';
  if (g.nom === 'feinteCorps') return 'feinteCorps';
  if (g.nom === 'grandPont') return 'grandPont';
  if (g.nom === 'petitPont') return 'petitPont';
  return null;
}
const APRES = 0.2, SUITE = 1.5;

/** Les gestes en course d'un match. `trace(t, quoi, détail)` : la chronique, pour les bancs. */
/** `attente` (s) : combien de temps la demande vit avant de tomber (le corps la lance quand la touche est à sa portée : mesuré, 10-850 ms
 *  après la demande ; un contrôle déjà touché va au bout, et le corps ne relit sa file qu'à sa fin). */
export function creerGestesCourse({ equipes = [0, 1], trace = null, attente = 0.7 } = {}) {
  const ATTENTE = attente;
  let G = null;                 // le geste en cours : { id, nom, skill, foe, u0, n, cible [x, y] (point visé), v, t (demande), t0 (départ), touche1 }
  const mordus = [];            // LA MORSURE : les défenseurs qui ont mordu — { id, jusqua (s), cible [x, y] (la ligne quittée par le porteur) }
  let aJuger = null;            // le contact d'un geste à juger par le noyau du cerveau (la première touche vient d'avoir lieu)
  let derniere = null;          // le dernier geste fini : { nom, issue, t }
  const suites = [];            // les gestes finis dont on juge la suite (le ballon gardé à +SUITE s)
  const stats = { decides: 0, sansAnimation: {}, demandes: 0, partis: 0, touches: 0, pasPartis: 0, issues: {}, parGeste: {}, gardes: 0, juges: 0, contacts: 0, morsures: 0 };
  const parGeste = (nom) => (stats.parGeste[nom] ??= { demandes: 0, partis: 0, touches: 0, gardes: 0, juges: 0 });
  const unite = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  function fin(t, issue) {
    stats.issues[issue] = (stats.issues[issue] ?? 0) + 1;
    if (G.t0 != null) suites.push({ id: G.id, eq: G.equipe, nom: G.nom, juge: t + SUITE });
    derniere = { nom: G.nom, issue, t, porteur: G.id };
    trace?.(t, 'fin', { nom: G.nom, issue });
    G = null;
  }
  return {
    /** Le cerveau a décidé un geste pour le porteur `c` (l'état du corps) : la décision `g` (gesteDuCerveau) ; la direction de sortie au
     *  corps `dir` [x, y] (unitaire). Rend true si le corps va le jouer (une animation existe, aucun geste en cours). */
    proposer(t, c, g, dir) {
      stats.decides++;
      if (G || !equipes.includes(c.equipe)) return false;
      const nom = animationPour(g, c.vitesse);
      if (!nom || !COURSE[nom]) { stats.sansAnimation[g.espece ?? g.nom] = (stats.sansAnimation[g.espece ?? g.nom] ?? 0) + 1; return false; }
      const A = COURSE[nom];
      // LA CLASSE DE VITESSE DU CORPS : à l'arrêt (< 1,8 m/s) les gestes plantés seuls ; en conduite ou en marche (1,8-6), les variantes
      // 3,5 et 5 ; au sprint (≥ 6), aucune — le corps n'aurait pas de candidat
      // (la variante la plus proche de son allure : 2,5 sous 3 m/s — le porteur qui ralentit devant un défenseur —, 3,5 sous 4,2, 5 au-delà)
      const v = A.n[0] != null ? (c.vitesse < 1.8 ? 0 : null) : c.vitesse < 1.8 || c.vitesse >= 6 ? null : c.vitesse < 3 ? 2.5 : c.vitesse < 4.2 ? 3.5 : 5;
      if (v == null || A.n[v] == null) { const cle = `${nom}@${c.vitesse < 1.8 ? 'arret' : c.vitesse >= 6 ? 'sprint' : 'course'}`; stats.sansAnimation[cle] = (stats.sansAnimation[cle] ?? 0) + 1; return false; }
      const u0 = c.vitesse > 0.3 ? [c.v[0] / c.vitesse, c.v[1] / c.vitesse] : c.dir;
      G = { id: c.id, equipe: c.equipe, nom, skill: g.nom, foe: g.foe ?? null, u0, n: A.n[v], v, duree: A.duree[v], sansTouche: !!A.sansTouche, t, t0: null, touche1: null, cible: [c.x + dir[0] * 6, c.y + dir[1] * 6] };
      stats.demandes++; parGeste(nom).demandes++;
      trace?.(t, 'demande', { id: c.id, nom, v, n: G.n });
      return true;
    },
    /** Le journal du corps : le départ du geste (GF_EV_GESTE), ses touches en série (GF_EV_SERIE), les touches des autres. */
    observer(evenements, EV) {
      for (const ev of evenements) {
        const t = ev.t / 1000;
        if (ev.type === EV.TOUCHE) for (const s of suites) if (s.dernier == null || t > s.dernierT) { s.dernier = ev.equipe; s.dernierT = t; }
        if (!G) continue;
        if (ev.type === EV.GESTE && ev.joueur === G.id && ev.a === G.n && G.t0 == null) { G.t0 = t; stats.partis++; parGeste(G.nom).partis++; trace?.(t, 'départ', { nom: G.nom }); }
        else if (ev.type === EV.SERIE && ev.joueur === G.id && G.t0 != null) {
          if (ev.a === 0 && G.touche1 == null) { G.touche1 = t; stats.touches++; parGeste(G.nom).touches++; if (G.foe != null) aJuger = { porteur: G.id, foe: G.foe, skill: G.skill, u0: G.u0, t }; }
          if (ev.a < 0 && G.t0 != null) G.arrete = true;
        } else if (ev.type === EV.TOUCHE && ev.joueur !== G.id && G.t0 != null) G.autre = t;
        else if (ev.type === EV.PASSE && ev.joueur === G.id) G.passe = t;
      }
    },
    /** Chaque tick : la fin, puis l'intention du porteur (remplace celle du cerveau dans `out`). */
    tick(etat, out) {
      const t = etat.t / 1000;
      // LE MORDU (la loi du cerveau, jugée au contact par cerveau.mjs) : il part sur la ligne que le porteur a quittée, sans réflexes de duel
      // (ALLER au drapeau 1, la garde du face-à-face) — le temps de sa morsure ; puis le cerveau le reprend
      for (let k = mordus.length - 1; k >= 0; k--) {
        const m = mordus[k]; if (t >= m.jusqua || !etat.enJeu || etat.cpa) { mordus.splice(k, 1); continue; }
        const o = out.find((x) => x.id === m.id); if (!o) continue;
        for (const cle of Object.keys(o)) if (cle !== 'id') delete o[cle];
        Object.assign(o, { genre: INTENTION.ALLER, x: m.cible[0], y: m.cible[1], vitesse: 5, drapeaux: 1, job: 'mordu' });
      }
      for (const s of suites) if (!s.fait && t >= s.juge) { s.fait = true; stats.juges++; parGeste(s.nom).juges++; if (s.dernier === s.eq || (s.dernier == null && etat.possession.equipe === s.eq)) { stats.gardes++; parGeste(s.nom).gardes++; } }
      while (suites.length && suites[0].fait) suites.shift();
      if (!G) return;
      const c = etat.joueurs.find((j) => j.id === G.id);
      if (!c || !etat.enJeu || etat.cpa) return fin(t, 'jeu-arrete');
      if (G.t0 == null && t - G.t > ATTENTE) { stats.pasPartis++; return fin(t, 'pas-parti'); }
      if (G.autre != null) return fin(t, 'touche-adverse');
      if (G.passe != null) return fin(t, 'passe');
      if (G.t0 != null && t >= G.t0 + G.duree + APRES) return fin(t, G.arrete ? 'serie-arretee' : 'joue');
      const o = out.find((x) => x.id === G.id); if (!o) return;
      for (const k of Object.keys(o)) if (k !== 'id') delete o[k];
      // avant la première touche : le geste demandé (tenu) ; après : la conduite vers la sortie, à l'allure du geste. Un geste SANS touche
      // (le passement planté : un déplacement, que le corps coupe à tout moment) est tenu jusqu'à un tick de sa fin — au-delà, le corps
      // le rejouerait (corps.md § 5.6)
      const tenu = G.sansTouche ? G.t0 == null || t < G.t0 + G.duree - 0.1 : G.touche1 == null;
      if (tenu) Object.assign(o, { genre: INTENTION.GESTE, x: G.cible[0], y: G.cible[1], vitesse: G.v, cible: G.n, drapeaux: G.sansTouche ? 1 : 0, job: 'geste' });
      else Object.assign(o, { genre: INTENTION.CONDUIRE, x: G.cible[0], y: G.cible[1], vitesse: Math.max(4, G.v), job: 'geste-sortie' });
    },
    /** Le contact d'un geste à juger (sa première touche vient d'avoir lieu, un défenseur était visé) : { porteur, foe, skill, u0, t } —
     *  une fois ; cerveau.mjs le juge avec le noyau du cerveau, puis appelle `morsure`. */
    aJuger() { const J = aJuger; aJuger = null; if (J) stats.contacts++; return J; },
    /** Le verdict du contact : `mord` (le défenseur franchi mord), `duree` (s), et la ligne quittée par le porteur — le point à 3 m
     *  devant lui sur sa course d'entrée, où le défenseur s'engage. */
    morsure(t, J, mord, duree, etat) {
      if (!mord) return;
      const c = etat.joueurs.find((j) => j.id === J.porteur); if (!c) return;
      mordus.push({ id: J.foe, jusqua: t + duree, cible: [c.x + J.u0[0] * 3, c.y + J.u0[1] * 3] });
      stats.morsures++; trace?.(t, 'morsure', { foe: J.foe, duree });
    },
    /** Le geste en cours (porteur, nom, depuis), pour la page. */
    get actif() { return G ? { porteur: G.id, nom: G.nom, depuis: G.t0 ?? G.t, parti: G.t0 != null } : null; },
    get derniere() { return derniere; },
    stats() { return structuredClone(stats); },
  };
}
export { unite as uniteCourse };
function unite(x, y) { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; }
