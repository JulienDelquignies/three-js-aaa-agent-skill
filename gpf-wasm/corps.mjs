// corps.mjs — LE CORPS DE GAMEPLAY FOOTBALL, piloté par intentions (lot L2). Une mince couche JavaScript sur le module
// WebAssembly (`out/gpf.mjs`) : charger, lancer un 11 contre 11, poser les intentions, avancer, lire l'état et le journal.
// Coordonnées du MONDE (x le long du terrain ±55 m, y en travers ±36 m) ; l'équipe 0 défend le but x = −55 et attaque +x.
import GpfModule from './out/gpf.mjs';

export const INTENTION = { IA: 0, ALLER: 1, PRESSER: 2, PASSER: 3, TIRER: 4, CONDUIRE: 5 };
export const PASSE = { COURTE: 0, LONGUE: 1, HAUTE: 2 };
export const EV = { TOUCHE: 1, BUT: 2, FAUTE: 3, HORS_JEU: 4, CPA: 5, PASSE: 6 };
/** e_FunctionType du moteur — le geste d'une touche. */
export const GESTE = { MOUVEMENT: 1, CONTROLE: 2, AMORTI: 3, PASSE_COURTE: 4, PASSE_LONGUE: 5, PASSE_HAUTE: 6, TETE: 7, TIR: 8, DEVIATION: 9, PRISE: 10, INTERVENTION: 11, CROCHE_PIED: 12, TACLE: 13, SPECIAL: 14 };

export async function chargerLeCorps(dossier = new URL('./out/', import.meta.url).pathname) {
  const M = await GpfModule({ print: () => {}, printErr: () => {}, locateFile: (p) => dossier + p });
  return {
    M,
    /** Un match : graine, durée du chrono (0,027 = ×18 de GRF ; 4,75 = 90 vraies minutes), intentions actives ou non. */
    lancer({ graine = 7, matchDuration = 0.027, intentions = true } = {}) {
      if (!this.pret) { M._gf_init(1, matchDuration); this.pret = true; }
      M._gf_reset(graine, 1.0, 1.0, 1e9);
      M._gf_intents(intentions ? 1 : 0);
      this.HEAD = M._gf_frame_head(); this.PER = M._gf_frame_per();
    },
    avancer(n = 1) { M._gf_step(n); },
    /** L'état : temps, score, ballon, possession, et les 22 joueurs {equipe, role, x, y, vitesse, id (stable), actif}. */
    etat() {
      const F = new Float32Array(M.HEAPF32.buffer, M._gf_frame(), this.HEAD + 22 * this.PER);
      const joueurs = [];
      for (let k = 0; k < F[12]; k++) {
        const o = this.HEAD + k * this.PER;
        joueurs.push({ equipe: F[o], role: F[o + 1], x: F[o + 2], y: F[o + 3], dir: [F[o + 5], F[o + 6]], vitesse: F[o + 9],
          id: F[o + 10], actif: F[o + 11] > 0, v: [F[o + 12], F[o + 13]] });
      }
      return { t: F[0], enJeu: F[1] > 0, cpa: F[2] > 0, mode: F[3], score: [F[4], F[5]], ballon: [F[6], F[7], F[8]],
        ballonV: [F[13], F[14], F[15]], possession: { equipe: F[9], joueur: F[10] }, joueurs };
    },
    /** Poser l'intention TENUE d'un joueur (id stable). */
    intention(id, { genre = 0, x = 0, y = 0, vitesse = 0, cible = -1, puissance = 0, drapeaux = 0 } = {}) {
      M._gf_set_intent(id, genre, x, y, vitesse, cible, puissance, drapeaux);
    },
    /** Le journal depuis la dernière lecture : [{type, t, equipe, joueur, a, b, c, d}]. */
    journal() {
      const p = M._gf_events(), n = M._gf_events_n();
      const E = new Float32Array(M.HEAPF32.buffer, p, n * 8);
      const out = [];
      for (let i = 0; i < n; i++) out.push({ type: E[i * 8], t: E[i * 8 + 1], equipe: E[i * 8 + 2], joueur: E[i * 8 + 3], a: E[i * 8 + 4], b: E[i * 8 + 5], c: E[i * 8 + 6], d: E[i * 8 + 7] });
      return out;
    },
  };
}
