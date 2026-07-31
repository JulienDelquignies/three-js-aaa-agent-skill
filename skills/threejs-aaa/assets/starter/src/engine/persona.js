// LA PERSONA — l'identité de mouvement d'un joueur, dérivée, bornée, déterministe.
//
// Le retour utilisateur qui fonde le module : « il faudrait différents mouvements par joueur pour
// qu'ils ne se ressemblent pas tous ». Dix clones parfaits — même taille, même cycle de jambes EN
// PHASE, même balancier, même allure de pointe, mêmes tenues — lisent comme une animation, pas
// comme une équipe. Le vrai foot : chaque joueur a SA foulée, SA posture, SON tempérament d'allure.
//
// Une persona est une FONCTION PURE de (id, graine) — pas un état, pas un tirage au chargement :
// le même joueur a la même identité à chaque partie de la même graine (reproductibilité), et la
// sim comme le visuel lisent LA MÊME persona (une source, deux consommateurs — la loi du dépôt).
// Chaque paramètre est BORNÉ serré : l'identité est un accent, jamais un déséquilibre — le
// paceBias de ±6 % ne crée pas un surhomme, il crée un joueur reconnaissable.
//
// Qui consomme quoi :
//   SIM (rondo.js)     : paceBias (allure de pointe), burstiness (fréquence des ruptures de
//                        rythme), calm (longueur des tenues délibérées)
//   VISUEL (scène)     : scale (taille du corps), gaitPhase (déphasage du cycle — dix joueurs qui
//                        posent le pied gauche à la même milliseconde, c'est un ballet militaire),
//                        armSwingF (amplitude du balancier), posture (inclinaison propre du buste
//                        et asymétrie d'épaules, 1-3° — ce qui fait qu'on reconnaît une silhouette)

const lcg = (seed) => { let s = (seed * 2654435761 + 1013904223) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const span = (r, a, b) => a + r() * (b - a);

export function makePersona(id, seed = 0) {
  const r = lcg((id + 1) * 7919 + seed * 104729);
  return {
    id,
    scale: span(r, 0.965, 1.045),        // ±4 % de taille — visible côte à côte, innocent en jeu
    gaitPhase: r(),                      // déphasage du cycle de jambes [0,1)
    armSwingF: span(r, 0.85, 1.2),       // amplitude du balancier de bras
    posture: {                           // la signature de silhouette, en degrés (constante douce)
      lean: span(r, -1.5, 2.5),          // buste : légère avancée/retenue propre
      shoulder: span(r, -1.5, 1.5),      // asymétrie d'épaules
    },
    paceBias: span(r, 0.94, 1.06),       // allure de pointe personnelle
    burstiness: span(r, 0.7, 1.4),       // fréquence des ruptures de rythme (appels, chasses)
    calm: span(r, 0.85, 1.25),           // multiplicateur des tenues délibérées (le posé vs le vif)
    flair: span(r, 0.15, 1.0),           // goût du geste technique (râteau, feinte, semelle) — le
                                         // joueur à flair 1,0 tente ; celui à 0,15 joue simple
    reaction: span(r, 0.16, 0.26),       // s — latence de perception sur une balle SURPRISE (un
                                         // armé visible s'anticipe ; une déviation se subit)
  };
}

/**
 * CONTRAT. Trois façons dont « ils ne se ressemblent plus » redevient faux en silence :
 * une persona NON déterministe (l'identité change à chaque partie — pire que des clones),
 * des bornes crevées (l'identité devient un déséquilibre de sim), et des personas trop PROCHES
 * (le tirage s'effondre sur la moyenne — dix presque-clones). La distinction se mesure en L2
 * normalisé sur les axes de mouvement, par PAIRE.
 */
export function checkPersona({ n = 10, seed = 3 } = {}) {
  const issues = [];
  const axes = (p) => [
    (p.scale - 1) / 0.04, p.gaitPhase, (p.armSwingF - 1) / 0.18,
    p.posture.lean / 2.5, (p.paceBias - 1) / 0.06, (p.burstiness - 1) / 0.35, (p.calm - 1) / 0.2,
    ((p.flair ?? 0.575) - 0.575) / 0.425, ((p.reaction ?? 0.21) - 0.21) / 0.05,
  ];
  const ps = Array.from({ length: n }, (_, i) => makePersona(i, seed));
  // déterminisme : la même identité, image après image, partie après partie
  const again = makePersona(3, seed);
  if (JSON.stringify(again) !== JSON.stringify(ps[3])) issues.push('persona non déterministe — l\'identité change entre deux appels');
  // bornes : l'identité est un accent, pas un déséquilibre
  for (const p of ps) {
    if (p.scale < 0.96 || p.scale > 1.05) issues.push(`scale hors borne (${p.scale.toFixed(3)})`);
    if (p.paceBias < 0.93 || p.paceBias > 1.07) issues.push(`paceBias hors borne (${p.paceBias.toFixed(3)})`);
    if (Math.abs(p.posture.lean) > 3 || Math.abs(p.posture.shoulder) > 2) issues.push('posture hors borne (une signature, pas une scoliose)');
  }
  // distinction : chaque paire est discernable (écart L2 normalisé plancher)
  let worst = Infinity, pair = null;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = axes(ps[i]), b = axes(ps[j]);
    const d = Math.hypot(...a.map((v, k) => v - b[k]));
    if (d < worst) { worst = d; pair = [i, j]; }
  }
  if (worst < 0.35) issues.push(`personas ${pair} presque clones (L2 ${worst.toFixed(2)} < 0,35)`);
  return { ok: issues.length === 0, issues, worst };
}
