// contrat.mjs — LE CONTRAT ENTRE LE CORPS (le module WebAssembly de Gameplay Football) ET CEUX QUI LE LISENT : les constantes
// des intentions et des événements, la lecture de l'état et du journal, la pose d'une intention. Sans aucune dépendance : le
// cerveau empaqueté (`out/cerveau.mjs`) et la page l'importent sans tirer le module WebAssembly.
// Coordonnées du MONDE (x le long du terrain ±55 m, y en travers ±36 m) ; l'équipe 0 défend le but x = −55 et attaque +x.

export const INTENTION = { IA: 0, ALLER: 1, PRESSER: 2, PASSER: 3, TIRER: 4, CONDUIRE: 5, GESTE: 6 };
export const PASSE = { COURTE: 0, LONGUE: 1, HAUTE: 2 };
export const EV = { TOUCHE: 1, BUT: 2, FAUTE: 3, HORS_JEU: 4, CPA: 5, PASSE: 6, GESTE: 7, SERIE: 8 };
/** e_FunctionType du moteur — le geste d'une touche. */
export const GESTE = { MOUVEMENT: 1, CONTROLE: 2, AMORTI: 3, PASSE_COURTE: 4, PASSE_LONGUE: 5, PASSE_HAUTE: 6, TETE: 7, TIR: 8, DEVIATION: 9, PRISE: 10, INTERVENTION: 11, CROCHE_PIED: 12, TACLE: 13, SPECIAL: 14 };

/** L'état (`gf_frame`) : temps, score, ballon, possession, et les 22 joueurs {equipe, role, x, y, dir, vitesse, id (stable),
 *  actif, v, geste en cours, possede, designe (pour le ballon, match), designeEquipe, enMain (le gardien tient le ballon)}. */
export function lireEtat(M, HEAD = M._gf_frame_head(), PER = M._gf_frame_per()) {
  const F = new Float32Array(M.HEAPF32.buffer, M._gf_frame(), HEAD + 22 * PER);
  const joueurs = [];
  for (let k = 0; k < F[12]; k++) {
    const o = HEAD + k * PER;
    joueurs.push({ equipe: F[o], role: F[o + 1], x: F[o + 2], y: F[o + 3], dir: [F[o + 5], F[o + 6]], vitesse: F[o + 9],
      id: F[o + 10], actif: F[o + 11] > 0, v: [F[o + 12], F[o + 13]],
      geste: F[o + 14], possede: F[o + 15] > 0, designe: F[o + 16] > 0, designeEquipe: F[o + 17] > 0, enMain: F[o + 18] > 0 });
  }
  return { t: F[0], enJeu: F[1] > 0, cpa: F[2] > 0, mode: F[3], score: [F[4], F[5]], ballon: [F[6], F[7], F[8]],
    ballonV: [F[13], F[14], F[15]], possession: { equipe: F[9], joueur: F[10] }, joueurs };
}

/** Le journal depuis la dernière lecture (`gf_events`, la lecture le vide) : [{type, t, equipe, joueur, a, b, c, d}]. */
export function lireJournal(M) {
  const p = M._gf_events(), n = M._gf_events_n();
  const E = new Float32Array(M.HEAPF32.buffer, p, n * 8);
  const out = [];
  for (let i = 0; i < n; i++) out.push({ type: E[i * 8], t: E[i * 8 + 1], equipe: E[i * 8 + 2], joueur: E[i * 8 + 3], a: E[i * 8 + 4], b: E[i * 8 + 5], c: E[i * 8 + 6], d: E[i * 8 + 7] });
  return out;
}

/** LA DURÉE RÉELLE D'UNE REMISE EN JEU (temps mort total, en secondes ; ordres de grandeur du football d'élite, calés sur un
 *  temps de jeu effectif ≈ 58 min sur 90). Le corps en simule ≈ 4 s (≈ 1 s pour l'engagement après un but) : l'horloge du
 *  match avance du reste, sans le simuler — l'écran coupe le temps mort comme une retransmission. */
export const ARRETS_REELS = { engagement: 60, sixMetres: 20, coupFranc: 25, corner: 28, touche: 10, penalty: 60 };
const SIMULE = { engagement: 1, sixMetres: 4, coupFranc: 4, corner: 4, touche: 4, penalty: 4 };
/** Poser les durées des remises (gf_set_arrets) ; null : le corps seul (≈ 4 s par remise). */
export function poserLesArrets(M, arrets = ARRETS_REELS) {
  const ms = (k) => (arrets ? Math.max(0, (arrets[k] - SIMULE[k]) * 1000) : 0);
  M._gf_set_arrets(ms('engagement'), ms('sixMetres'), ms('coupFranc'), ms('corner'), ms('touche'), ms('penalty'));
}
/** LA DURÉE DU CHRONO qui fait coller l'horloge du match au temps simulé — et qui donne au corps la fatigue d'un vrai match
 *  (player.cpp : la fatigue s'accumule ÷ ce facteur ; 0,027, le réglage de GRF, l'accélère 18 fois). */
export const CHRONO_REEL = 4.75;

/** LES FAUTES DU CERVEAU (decider(...).fautes) : le sifflet part à l'arbitre du corps — { fautif, victime, gravite, x, y }
 *  (gf_faute : coup franc ou penalty au LIEU de la faute (monde), 1 faute, 2 jaune, 3 rouge) —, ou le carton seul quand l'avantage a été joué —
 *  { carton, couleur } (gf_carton). */
export function poserFautes(M, fautes = []) {
  for (const f of fautes) f.carton != null ? M._gf_carton(f.carton, f.couleur) : M._gf_faute(f.fautif, f.victime, f.gravite, f.x, f.y);
}

/**
 * LA MORPHOLOGIE (lot L3, EX-26) : la taille (cm) et le poids (kg) de chaque joueur du corps, selon la LOI DE LA CARRIÈRE (foot :
 * src/data/gabarit.ts et players.ts) en attendant ses fiches — la taille en cloche autour de la moyenne du poste (quatre tirages uniformes
 * sommés, bornée à 1,58-2,05 m ; l'écart-type du poste : le gardien et le central choisis pour leur taille), le poids qui suit la taille
 * (0,75 kg par cm au-delà de la moyenne du poste, ± 5 kg de corpulence). Tirée par la graine et l'id stable : le même match, les mêmes corps.
 * Le corps n'en prend que la TAILLE (gf_set_hauteur : la hauteur de ses touches de balle) ; la page dessine les deux.
 */
export const GABARIT_PAR_POSTE = { GK: { cm: 188, kg: 83 }, CB: { cm: 186, kg: 81 }, LB: { cm: 178, kg: 73 }, RB: { cm: 178, kg: 73 }, CM: { cm: 179, kg: 74 }, LW: { cm: 175, kg: 70 }, RW: { cm: 175, kg: 70 }, ST: { cm: 183, kg: 78 } };
export const ECART_TYPE_DE_TAILLE = { GK: 4, CB: 4.5, LB: 5.5, RB: 5.5, CM: 6, LW: 6, RW: 6, ST: 6 };
/** Le poste de la carrière d'un rôle du corps (e_PlayerRole : 0 G, 1 DC, 2 DG, 3 DD, 4 MDC, 5 MC, 6 MG, 7 MD, 8 MOC, 9 BU). */
export const POSTE_DU_ROLE = ['GK', 'CB', 'LB', 'RB', 'CM', 'CM', 'LW', 'RW', 'CM', 'ST'];
export function morphologiesDe(graine, etat) {
  return etat.joueurs.map((j) => {
    const poste = POSTE_DU_ROLE[j.role] ?? 'CM', G = GABARIT_PAR_POSTE[poste];
    let s = ((graine * 15485863 + (j.id + 1) * 2027 + 11) >>> 0) || 1; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    r(); r();
    const z = (r() + r() + r() + r() - 2) / Math.sqrt(4 / 12);
    const taille = Math.max(158, Math.min(205, Math.round(G.cm + ECART_TYPE_DE_TAILLE[poste] * z)));
    return { id: j.id, poste, taille, poids: Math.round(G.kg + (taille - G.cm) * 0.75 + (r() - 0.5) * 10) };
  });
}
/** Poser les tailles dans le corps (gf_set_hauteur, en mètres) ; un module d'avant la porte (étape 15) les ignore. Rend le nombre posé. */
export function poserLesTailles(M, morphologies = []) {
  if (!M._gf_set_hauteur) return 0;
  let n = 0; for (const m of morphologies) n += M._gf_set_hauteur(m.id, m.taille / 100);
  return n;
}

/** Poser l'intention TENUE d'un joueur (id stable). */
export function poserIntention(M, id, { genre = 0, x = 0, y = 0, vitesse = 0, cible = -1, puissance = 0, drapeaux = 0 } = {}) {
  M._gf_set_intent(id, genre, x, y, vitesse, cible, puissance, drapeaux);
}
