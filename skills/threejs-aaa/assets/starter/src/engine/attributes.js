// attributes — LES NOTES DU JOUEUR COMME ENTRÉE DU MOTEUR (le contrat avec les projets amont).
//
// Un projet type Football Manager amène des joueurs NOTÉS (0-100) : vitesse, passe, contrôle,
// finition… Ces notes doivent changer les mécaniques de réussite ET le rendu — sans jamais casser
// les lois du moteur. Ce module est LA couche de traduction, et ses trois principes sont le
// contrat :
//
//   1. UNE NOTE MODULE DANS LA BANDE HUMAINE, elle ne crée pas de surhomme. Chaque mapping est
//      une interpolation BORNÉE autour de la note moyenne (50) — un 99 de vitesse fait +10 %,
//      pas +100 ; le plafond absolu du monde (sprintMax, clauses de checkRondo) reste souverain.
//   2. SANS NOTES, RIEN NE CHANGE — au bit près. Un joueur sans `ratings` ne tire aucun aléa
//      supplémentaire et garde les lois d'aujourd'hui (même règle que les hooks de match-sim :
//      l'extension est un no-op absent). C'est ce qui rend le socle sûr à reprendre.
//   3. LA NOTE AGIT SUR L'EXÉCUTION, Pas SUR LA PHYSIQUE. Le vol du ballon, la balistique, les
//      lois de mouvement sont le MONDE — les notes jouent sur ce que le JOUEUR en fait : l'erreur
//      de sa frappe, la fermeté de sa touche, la fenêtre de son tacle, le réflexe de son gant.
//
// La persona (persona.js) reste la couche ESTHÉTIQUE (silhouette, phase de cycle, tempérament) ;
// les attributs sont la couche CAPACITÉ. Quand les deux parlent du même levier (paceBias,
// reaction), la NOTE fait foi et la persona garde ses axes purement visuels.
//
// Échelle : 0-100, 50 = le joueur moyen du moteur d'aujourd'hui. Les clés inconnues sont
// ignorées (le projet amont peut porter plus de notes que le moteur n'en consomme).

/** Le vocabulaire consommé aujourd'hui — chaque clé liste SON mécanisme et sa bande. */
export const ATTRIBUTES = {
  pace:        'vitesse de pointe        → top speed × [0,90 ; 1,10]',
  acceleration:'démarrage                → accel × [0,88 ; 1,12]',
  passing:     'erreur d\'exécution passe → bruit d\'angle [6,0° ; 0,5°] (σ), la vraie frappe dévie',
  control:     'fermeté du contrôle      → diviseur du contrôle-manqué [0,7 ; 1,6] (poids de passe)',
  dribbling:   'longueur de touche → lead × [1,08 ; 0,94] ; engagement et vente des gestes × [0,55 ; 1,10]',
  finishing:   'placement du tir         → bruit du point visé [0,55 m ; 0,10 m] (σ)',
  tackling:    'fenêtre du tacle debout  → portée du duel ± [−0,10 ; +0,10] m',
  reactions:   'latence de perception    → réaction [0,30 s ; 0,14 s] (remplace l\'axe persona)',
  composure:   'sang-froid sous pression → l\'erreur de passe pressée × [1,30 ; 0,85]',
  keeping:     'métier de gardien        → envergure [1,8 ; 2,5] m, réflexe [0,16 ; 0,09] s',
  stamina:     'réserve d\'endurance      → drain de fatigue × [1,25 ; 0,75] (cfg.fatigue, lot 31)',
};

const lerp = (a, b, t) => a + (b - a) * t;
const t01 = (r) => Math.max(0, Math.min(1, (r ?? 50) / 100));

/**
 * makeProfile — traduit des notes brutes en LEVIERS bornés que la sim consomme.
 * Pur, sans aléa (les tirages d'erreur se font en jeu, sur st.rnd — le hasard seedé de la partie).
 * `ratings` partiel : chaque clé absente vaut 50 (le joueur moyen).
 */
export function makeProfile(ratings = {}) {
  const r = (k) => t01(ratings[k]);
  return Object.freeze({
    topF: lerp(0.90, 1.10, r('pace')),
    accelF: lerp(0.88, 1.12, r('acceleration')),
    passSigma: lerp(6.0, 0.5, r('passing')) * (Math.PI / 180),   // rad — σ d'angle (à 30 : ~1 m d'écart
                                                                  // à 10 m — mesuré : 3,5° ne mordait pas les couloirs)
    controlF: lerp(0.7, 1.6, r('control')),
    dribbleLeadF: lerp(1.08, 0.94, r('dribbling')),
    gesteF: lerp(0.55, 1.10, r('dribbling')),                     // × sur l'ENGAGEMENT et la VENTE
                                                                  // des gestes (un 35 tente peu et
                                                                  // vend mal — la note joue l'exécution)
    shotSigma: lerp(0.55, 0.10, r('finishing')),                  // m — sur le point visé dans le but
    tackleReach: lerp(-0.10, 0.10, r('tackling')),                // m — sur la fenêtre du duel
    reaction: lerp(0.30, 0.14, r('reactions')),                   // s
    composureF: lerp(1.30, 0.85, r('composure')),                 // × sur l'erreur pressée
    keeperReach: lerp(2.55, 3.25, r('keeping')),                  // m — autour de l'envergure livrée (2,95)
    keeperReflex: lerp(0.16, 0.09, r('keeping')),                 // s
    stamF: lerp(1.25, 0.75, r('stamina')),                        // × sur le drain de fatigue (l'endurant tient)
  });
}

/** Un tirage gaussien SEEDÉ (somme de 3 uniformes, centrée) — l'erreur d'exécution en jeu. */
export function gauss(rnd) {
  return ((rnd() + rnd() + rnd()) - 1.5) * 1.4142;               // ≈ N(0, 1) borné à ±2,1 σ
}

/**
 * CONTRAT. Les façons dont des notes redeviennent silencieusement de la triche : un mapping qui
 * sort de sa bande (le surhomme), une note qui casse la monotonie (90 de passe MOINS précis que
 * 40), et le no-op violé (un profil de 50 partout qui diffère du monde sans notes).
 */
export function checkAttributes() {
  const issues = [];
  const lo = makeProfile(Object.fromEntries(Object.keys(ATTRIBUTES).map((k) => [k, 0])));
  const hi = makeProfile(Object.fromEntries(Object.keys(ATTRIBUTES).map((k) => [k, 100])));
  const mid = makeProfile({});
  // 1. les bandes : jamais un surhomme
  if (hi.topF > 1.10 + 1e-9 || lo.topF < 0.90 - 1e-9) issues.push(`topF hors bande [0,90 ; 1,10] (${lo.topF}–${hi.topF})`);
  if (hi.accelF > 1.12 + 1e-9) issues.push('accelF hors bande');
  if (hi.keeperReach > 3.25 + 1e-9) issues.push('keeperReach hors bande');
  // 2. la monotonie : plus la note monte, meilleur le levier
  if (!(hi.passSigma < mid.passSigma && mid.passSigma < lo.passSigma)) issues.push('passing non monotone');
  if (!(hi.shotSigma < mid.shotSigma && mid.shotSigma < lo.shotSigma)) issues.push('finishing non monotone');
  if (!(hi.controlF > mid.controlF && mid.controlF > lo.controlF)) issues.push('control non monotone');
  if (!(hi.reaction < lo.reaction)) issues.push('reactions non monotone');
  if (!(hi.tackleReach > lo.tackleReach)) issues.push('tackling non monotone');
  // 3. le joueur moyen = le moteur d'aujourd'hui (le no-op numérique)
  if (Math.abs(mid.topF - 1) > 1e-9 || Math.abs(mid.accelF - 1) > 1e-9) issues.push('le 50 partout ne vaut pas 1,0 — le no-op est violé');
  if (Math.abs(mid.composureF - 1.075) > 1e-9) issues.push('composure 50 hors centre');
  // 4. les clés inconnues sont ignorées, pas fatales
  try { makeProfile({ chapeau: 99, pace: 60 }); } catch { issues.push('une clé inconnue fait planter makeProfile'); }
  return { ok: issues.length === 0, issues };
}
