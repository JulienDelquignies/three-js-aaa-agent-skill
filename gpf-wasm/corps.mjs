// corps.mjs — LE CORPS DE GAMEPLAY FOOTBALL, piloté par intentions (lot L2). Une mince couche JavaScript sur le module
// WebAssembly (`out/gpf.mjs`) : charger, lancer un 11 contre 11, poser les intentions, avancer, lire l'état et le journal.
// Le contrat (constantes, lectures) vit dans `contrat.mjs`, sans dépendance : la page et le cerveau empaqueté le partagent.
import GpfModule from './out/gpf.mjs';
import { lireEtat, lireJournal, poserIntention, poserLesArrets, poserFautes, morphologiesDe, poserLesTailles, ARRETS_REELS, CHRONO_REEL } from './contrat.mjs';
export { INTENTION, PASSE, EV, GESTE, ARRETS_REELS, CHRONO_REEL } from './contrat.mjs';


export async function chargerLeCorps(dossier = new URL('./out/', import.meta.url).pathname) {
  const M = await GpfModule({ print: () => {}, printErr: () => {}, locateFile: (p) => dossier + p });
  return {
    M,
    /** Un match : graine, durée du chrono, intentions actives ou non, remises en jeu à leur durée réelle (null : celles du
     *  corps seul, ≈ 4 s). LA DURÉE DU CHRONO règle aussi la FATIGUE du corps (player.cpp : elle s'accumule ÷ ce facteur) :
     *  4,75 = l'horloge du match colle au temps simulé, la fatigue est celle d'un vrai match (un joueur qui court 10,5 km finit
     *  à ≈ 60 % de fraîcheur) ; 0,027 (le réglage de GRF) l'accélère 18 fois — épuisé vers la 12e minute. */
    lancer({ graine = 7, matchDuration = CHRONO_REEL, intentions = true, arrets = ARRETS_REELS, morphologies = 'loi' } = {}) {
      if (!this.pret) { M._gf_init(1, matchDuration); this.pret = true; }
      M._gf_reset(graine, 1.0, 1.0, 1e9);
      M._gf_intents(intentions ? 1 : 0);
      if (arrets) poserLesArrets(M, arrets);
      this.HEAD = M._gf_frame_head(); this.PER = M._gf_frame_per();
      // LES TAILLES (contrat.morphologiesDe : la loi de la carrière) — la page pose les mêmes ; null : les 11 profils de la version Google
      this.morphologies = morphologies === 'loi' ? morphologiesDe(graine, this.etat()) : morphologies;
      if (this.morphologies) poserLesTailles(M, this.morphologies);
    },
    avancer(n = 1) { M._gf_step(n); },
    /** La mi-temps, sifflée à la prochaine action en jeu (l'engagement de la seconde période à l'autre équipe). */
    miTemps() { M._gf_mi_temps(); },
    /** L'état (contrat.lireEtat). */
    etat() { return lireEtat(M, this.HEAD, this.PER); },
    /** Poser l'intention TENUE d'un joueur (id stable). */
    intention(id, i) { poserIntention(M, id, i); },
    /** Les fautes décidées par le cerveau (decider(...).fautes) : l'arbitre du corps les siffle ou montre le carton. */
    fautes(liste) { poserFautes(M, liste); },
    /** Le journal depuis la dernière lecture (contrat.lireJournal). */
    journal() { return lireJournal(M); },
  };
}
