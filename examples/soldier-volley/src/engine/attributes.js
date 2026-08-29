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
  dribbling:   'longueur de touche → lead × [1,08 ; 0,94] ; engagement/vente des gestes × [0,55 ; 1,10] ; l\'ESQUIVE du duel ± [−0,08 ; +0,08] m (152)',
  finishing:   'placement du tir         → bruit du point visé [0,55 m ; 0,10 m] (σ)',
  longShots:   'frappe de loin           → audace lointaine × [0,75 ; 1,25] (cfg.audace, lot 107)',
  tackling:    'fenêtre du tacle debout  → portée du duel ± [−0,10 ; +0,10] m + l\'horloge du pique (tacleTempoF, 157)',
  teamwork:    'la cohésion du pressing   → teamF [0,8 ; 1,2] : la pénalité de zone à l\'élection du presseur (160)',
  anticipation: 'la lecture du bloc        → anticipF [0,85 ; 1,15] : la fenêtre du pressing collectif (161)',
  // LE TRIO GARDIEN (163) — la clôture de l'inventaire du consommateur carrière :
  aerialReach: 'la portée aérienne (GK)   → aerialF [0,85 ; 1,15] : hauteur et rayon de la prise haute',
  oneOnOnes:   'le un-contre-un (GK)      → oooF [0,85 ; 1,15] : la profondeur de sortie face au porteur seul',
  command:     'le commandement (GK)      → commandF [0,85 ; 1,15] : × le rayon du marquage de surface de SES défenseurs — le seul levier qui agit sur les AUTRES',
  reactions:   'latence de perception    → réaction [0,30 s ; 0,14 s] (remplace l\'axe persona)',
  composure:   'sang-froid sous pression → l\'erreur de passe pressée × [1,30 ; 0,85]',
  keeping:     'métier de gardien        → envergure [1,8 ; 2,5] m, réflexe [0,16 ; 0,09] s',
  agility:     'souplesse du corps       → durée du relevé après plongeon × [1,28 ; 0,72] (lot 91)',
  stamina:     'réserve d\'endurance      → drain de fatigue × [1,25 ; 0,75] (cfg.fatigue, lot 31)',
  strength:    'force dans le duel       → charge d\'épaule × [0,85 ; 1,15] (cfg.charge, lot 32)',
  jumping:     'détente verticale        → hauteur de saut de tête × [0,75 ; 1,25] (cfg.tete.saut, lot 112)',
  // LE LOT 147 (l'inventaire du consommateur carrière) — six notes de plus, mêmes contrats :
  vision:      'la passe VUE             → visionF [0,85 ; 1,15] (élection/aiguille de la tranchante, lot 140) ; absente : passing la porte',
  technique:   'savoir FAIRE le geste    → gesteF [0,55 ; 1,10] (l\'exécution/vente) ; absente : dribbling la porte — flair (persona) décide de TENTER',
  handling:    'l\'ISSUE de l\'arrêt      → handF [0,85 ; 1,15] : capter jusqu\'à priseV × handF, sécuriser en corner dès claqueV / handF',
  heading:     'la qualité de la tête    → headF [0,8 ; 1,2] : la puissance de la tête au but, et le cadre tenu même gêné (distinct de jumping, la détente)',
  crossing:    'la précision du centre   → crossF [1,25 ; 0,75] : × sur le σ du centre (compose la patte du lot 100)',
  weakFoot:    'le pied faible           → weakF [1,5 ; 0,5] : × sur l\'ÉCART au neutre des malus mauvais pied (100 ≈ ambidextre, 0 mono-pied)',
  kicking:     'la relance au pied (GK)  → kickF [0,85 ; 1,15] : la portée de la longue et du punt (keeper.relancerGardien, lot 150)',
  throwing:    'la relance à la main (GK)→ throwF [0,85 ; 1,15] : la portée de la main vive (cpa.sortieBut court — le déclencheur de transition)',
  // LE LOT 151 — les sept MENTALES, mêmes contrats (le no-op à 50 est LA règle) :
  decisions:   'le choix sous contrainte  → decF [0,85 ; 1,15] : le seuil de panique du contesté (le bon garde la tête, le mauvais joue tôt)',
  offTheBall:  'les appels sans ballon    → otbF [0,85 ; 1,15] : ÷ sur le cooldown personnel des appels profonds (le bon rejaillit)',
  positioning: 'le placement au repos     → posF [0,85 ; 1,15] : la zone morte du slot × (2 − posF) — le mauvais dérive avant de se recaler',
  workRate:    'le volume de course       → workF [0,85 ; 1,15] : × sur la fenêtre de contre-press personnelle (le travailleur chasse plus longtemps)',
  aggression:  'l\'engagement au duel     → aggrF [0,8 ; 1,2] : × sur la proba d\'accrochage (et donc les fautes — le hargneux paie)',
  concentration:'la tenue de l\'attention → concF [0,7 ; 1,3] : l\'erreur d\'exécution gonfle avec la FATIGUE × max(0, 1 − concF) — la faute de fin de match',
  marking:     'suivre et contenir        → markF [0,85 ; 1,15] : l\'offset du marqueur × (2 − markF) — le bon colle, goal-side tenu',
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
  const r2 = (k, fb) => t01(ratings[k] ?? ratings[fb]);   // la note dédiée, sinon sa porteuse historique — l'identité des mondes déjà notés
  return Object.freeze({
    topF: lerp(0.90, 1.10, r('pace')),
    accelF: lerp(0.88, 1.12, r('acceleration')),
    passSigma: lerp(6.0, 0.5, r('passing')) * (Math.PI / 180),   // rad — σ d'angle (à 30 : ~1 m d'écart
                                                                  // à 10 m — mesuré : 3,5° ne mordait pas les couloirs)
    visionF: lerp(0.85, 1.15, r2('vision', 'passing')),           // × sur la TRANCHANTE (lot 140) : l'élection et
                                                                  // l'aiguille (1 exact à 50) ; la note VISION dédiée
                                                                  // (lot 147), passing la porte si absente
    controlF: lerp(0.7, 1.6, r('control')),
    dribbleLeadF: lerp(1.08, 0.94, r('dribbling')),
    esquiveF: lerp(-0.08, 0.08, r('dribbling')),                  // m — le DUEL est tackling VS dribbling (152) :
                                                                  // le dribbleur rétrécit la fenêtre du tacleur
                                                                  // (0 exact à 50 — le 3e levier de la note)
    gesteF: lerp(0.55, 1.10, r2('technique', 'dribbling')),       // × sur l'ENGAGEMENT et la VENTE (la note
                                                                  // TECHNIQUE dédiée au lot 147 — savoir FAIRE ;
                                                                  // persona.flair décide de TENTER)
                                                                  // des gestes (un 35 tente peu et
                                                                  // vend mal — la note joue l'exécution)
    shotSigma: lerp(0.55, 0.10, r('finishing')),                  // m — sur le point visé dans le but
    longF: lerp(0.75, 1.25, r('longShots')),                      // × sur l'AUDACE lointaine (le 50 vaut 1 exact — l'identité du monde moyen)
    tackleReach: lerp(-0.10, 0.10, r('tackling')),                // m — sur la fenêtre du duel
    tacleTempoF: lerp(0.85, 1.15, r('tackling')),                 // × l'horloge du pique (157) : le bon tacleur
                                                                  // engage plus tôt (÷ via 2−F) — 1 exact à 50
    teamF: lerp(0.8, 1.2, r('teamwork')),                         // × la pénalité de zone à l'élection du presseur
                                                                  // (160) : le cohésif élit juste, le brouillon traverse
    anticipF: lerp(0.85, 1.15, r('anticipation')),                // × la fenêtre du pressing d'équipe, ÷ son cooldown
                                                                  // (161, en MOYENNE de bloc) — 1 exact à 50
    aerialF: lerp(0.85, 1.15, r('aerialReach')),                  // × hauteur/rayon de la prise haute du gardien (163)
    oooF: lerp(0.85, 1.15, r('oneOnOnes')),                       // × la profondeur de sortie au 1v1 (163)
    commandF: lerp(0.85, 1.15, r('command')),                     // × le rayon du marquage de surface des SIENS (163)
    reaction: lerp(0.30, 0.14, r('reactions')),                   // s
    composureF: lerp(1.30, 0.85, r('composure')),                 // × sur l'erreur pressée
    keeperReach: lerp(2.55, 3.25, r('keeping')),                  // m — autour de l'envergure livrée (2,95)
    keeperReflex: lerp(0.16, 0.09, r('keeping')),                 // s
    posMixF: Math.min(1, lerp(0.4, 1.6, r('keeping'))),           // le PLACEMENT (lot 94) : 1 = bissectrice
                                                                  // tenue (dès 50 — no-op), < 1 = dérive vers
                                                                  // la ligne du centre (l'erreur du faible)
    depthKF: lerp(0.85, 1.15, r('keeping')),                      // × sur la profondeur max (le bon gardien
                                                                  // ose sortir — no-op exact à 50)
    getupF: lerp(1.28, 0.72, r('agility')),                       // × sur le relevé (keeper.keeperRise —
                                                                  // le félin en 0,9 s, le raide en 1,6)
    stamF: lerp(1.25, 0.75, r('stamina')),                        // × sur le drain de fatigue (l'endurant tient)
    chargeF: lerp(0.85, 1.15, r('strength')),                     // × dans la charge d'épaule (les deux côtés du duel)
    sautF: lerp(0.75, 1.25, r('jumping')),                        // × sur la DÉTENTE de tête (le 50 vaut 1 exact
                                                                  // — et l'autre moitié du duel aérien, lot 112)
    handF: lerp(0.85, 1.15, r('handling')),                       // l'ISSUE de l'arrêt (147) : prise/claquette
    headF: lerp(0.8, 1.2, r('heading')),                          // la QUALITÉ de la tête (147) — puissance + cadre gêné
    crossF: lerp(1.25, 0.75, r('crossing')),                      // × sur le σ du centre (147) — compose la patte
    weakF: lerp(1.5, 0.5, r('weakFoot')),                         // × sur l'écart au neutre du mauvais pied (147)
    kickF: lerp(0.85, 1.15, r('kicking')),                        // la relance au pied du gardien (150)
    throwF: lerp(0.85, 1.15, r('throwing')),                      // la relance à la main du gardien (150)
    decF: lerp(0.85, 1.15, r('decisions')),                       // le seuil de panique (151)
    otbF: lerp(0.85, 1.15, r('offTheBall')),                      // la cadence d'appel (151)
    posF: lerp(0.85, 1.15, r('positioning')),                     // la zone morte du slot (151)
    workF: lerp(0.85, 1.15, r('workRate')),                       // la fenêtre de contre-press (151)
    aggrF: lerp(0.8, 1.2, r('aggression')),                       // la proba d'accrochage (151)
    concF: lerp(0.7, 1.3, r('concentration')),                    // l'attention sous fatigue (151)
    markF: lerp(0.85, 1.15, r('marking')),                        // l'offset du marqueur (151)
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
  if (!(hi.tacleTempoF > mid.tacleTempoF && mid.tacleTempoF > lo.tacleTempoF) || Math.abs(mid.tacleTempoF - 1) > 1e-9) issues.push('tacleTempoF non monotone ou no-op violé');
  if (!(hi.teamF > mid.teamF && mid.teamF > lo.teamF) || Math.abs(mid.teamF - 1) > 1e-9) issues.push('teamwork non monotone ou no-op violé');
  if (!(hi.anticipF > mid.anticipF && mid.anticipF > lo.anticipF) || Math.abs(mid.anticipF - 1) > 1e-9) issues.push('anticipation non monotone ou no-op violé');
  for (const [k, f] of [['aerialReach', 'aerialF'], ['oneOnOnes', 'oooF'], ['command', 'commandF']])
    if (!(hi[f] > mid[f] && mid[f] > lo[f]) || Math.abs(mid[f] - 1) > 1e-9) issues.push(k + ' non monotone ou no-op violé');
  if (!(hi.longF > mid.longF && mid.longF > lo.longF)) issues.push('longShots non monotone');
  if (Math.abs(mid.longF - 1) > 1e-9) issues.push('longF au 50 doit valoir 1 exact (l\'identité du monde moyen)');
  if (!(hi.sautF > mid.sautF && mid.sautF > lo.sautF)) issues.push('jumping non monotone');
  if (Math.abs(mid.sautF - 1) > 1e-9) issues.push('sautF au 50 doit valoir 1 exact (l\'identité du monde moyen)');
  if (!(hi.getupF < mid.getupF && mid.getupF < lo.getupF)) issues.push('agility non monotone (le souple doit se relever plus vite)');
  if (hi.getupF < 0.72 - 1e-9 || lo.getupF > 1.28 + 1e-9) issues.push('getupF hors bande [0,72 ; 1,28]');
  if (Math.abs(mid.getupF - 1) > 1e-9) issues.push('agility 50 ne vaut pas 1,0 — le no-op du relevé est violé');
  // …le PLACEMENT du gardien (lot 94) : à 50 la bissectrice est TENUE (no-op), le faible dérive
  if (Math.abs(mid.posMixF - 1) > 1e-9 || Math.abs(mid.depthKF - 1) > 1e-9) issues.push('keeping 50 ne tient pas la bissectrice/profondeur (no-op violé)');
  if (!(lo.posMixF < mid.posMixF - 1e-9 && lo.posMixF >= 0.4 - 1e-9 && Math.abs(hi.posMixF - 1) < 1e-9)) issues.push('posMixF hors contrat [0,4 ; 1], saturé à 1 dès 50');
  if (!(hi.depthKF > mid.depthKF && mid.depthKF > lo.depthKF)) issues.push('depthKF non monotone');
  // 3. le joueur moyen = le moteur d'aujourd'hui (le no-op numérique)
  if (Math.abs(mid.topF - 1) > 1e-9 || Math.abs(mid.accelF - 1) > 1e-9) issues.push('le 50 partout ne vaut pas 1,0 — le no-op est violé');
  if (Math.abs(mid.composureF - 1.075) > 1e-9) issues.push('composure 50 hors centre');
  // …les six du lot 147 : monotones, no-op à 50, fallbacks identiques
  if (!(hi.handF > mid.handF && mid.handF > lo.handF) || Math.abs(mid.handF - 1) > 1e-9) issues.push('handling non monotone ou no-op violé');
  if (!(hi.headF > mid.headF && mid.headF > lo.headF) || Math.abs(mid.headF - 1) > 1e-9) issues.push('heading non monotone ou no-op violé');
  if (!(hi.crossF < mid.crossF && mid.crossF < lo.crossF) || Math.abs(mid.crossF - 1) > 1e-9) issues.push('crossing non monotone (σ) ou no-op violé');
  if (!(hi.weakF < mid.weakF && mid.weakF < lo.weakF) || Math.abs(mid.weakF - 1) > 1e-9) issues.push('weakFoot non monotone ou no-op violé');
  if (!(hi.visionF > mid.visionF && mid.visionF > lo.visionF) || Math.abs(mid.visionF - 1) > 1e-9) issues.push('vision non monotone ou no-op violé');
  const fbA = makeProfile({ passing: 80, dribbling: 70 });
  const fbB = makeProfile({ passing: 80, dribbling: 70, vision: 80, technique: 70 });
  if (Math.abs(fbA.visionF - fbB.visionF) > 1e-9 || Math.abs(fbA.gesteF - fbB.gesteF) > 1e-9) issues.push('les fallbacks vision→passing / technique→dribbling divergent');
  if (!(hi.kickF > mid.kickF && mid.kickF > lo.kickF) || Math.abs(mid.kickF - 1) > 1e-9) issues.push('kicking non monotone ou no-op violé');
  if (!(hi.throwF > mid.throwF && mid.throwF > lo.throwF) || Math.abs(mid.throwF - 1) > 1e-9) issues.push('throwing non monotone ou no-op violé');
  for (const [k, nom] of [['decF','decisions'],['otbF','offTheBall'],['posF','positioning'],['workF','workRate'],['aggrF','aggression'],['concF','concentration'],['markF','marking']])
    if (!(hi[k] > mid[k] && mid[k] > lo[k]) || Math.abs(mid[k] - 1) > 1e-9) issues.push(`${nom} non monotone ou no-op violé`);
  if (!(hi.esquiveF > mid.esquiveF && mid.esquiveF > lo.esquiveF) || Math.abs(mid.esquiveF) > 1e-9) issues.push('esquive (dribbling) non monotone ou no-op violé');
  // 4. les clés inconnues sont ignorées, pas fatales
  try { makeProfile({ chapeau: 99, pace: 60 }); } catch { issues.push('une clé inconnue fait planter makeProfile'); }
  return { ok: issues.length === 0, issues };
}
