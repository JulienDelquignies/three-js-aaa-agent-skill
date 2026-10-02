// corps.mjs — LE CORPS DE GAMEPLAY FOOTBALL, piloté par intentions (lot L2). Une mince couche JavaScript sur le module
// WebAssembly (`out/gpf.mjs`) : charger, lancer un 11 contre 11, poser les intentions, avancer, lire l'état et le journal.
// Le contrat (constantes, lectures) vit dans `contrat.mjs`, sans dépendance : la page et le cerveau empaqueté le partagent.
import GpfModule from './out/gpf.mjs';
import { lireEtat, lireJournal, poserIntention } from './contrat.mjs';
export { INTENTION, PASSE, EV, GESTE } from './contrat.mjs';

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
    /** L'état (contrat.lireEtat). */
    etat() { return lireEtat(M, this.HEAD, this.PER); },
    /** Poser l'intention TENUE d'un joueur (id stable). */
    intention(id, i) { poserIntention(M, id, i); },
    /** Le journal depuis la dernière lecture (contrat.lireJournal). */
    journal() { return lireJournal(M); },
  };
}
