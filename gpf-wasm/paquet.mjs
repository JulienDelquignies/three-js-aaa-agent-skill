// paquet.mjs — L'ENTRÉE DU CERVEAU EMPAQUETÉ (out/cerveau.mjs, voir empaqueter.sh) : le cerveau et le contrat du corps, tout ce
// qu'il faut à une page qui charge elle-même le module WebAssembly (out/gpf.mjs).
export { creerCerveau } from './cerveau.mjs';
export { INTENTION, PASSE, EV, GESTE, lireEtat, lireJournal, poserIntention, poserLesArrets, poserFautes, ARRETS_REELS, CHRONO_REEL } from './contrat.mjs';
// LA FEUILLE DE MATCH (lot L5) : le journal du corps traduit en faits au schéma de stats.js, le rapport, les noms fictifs
export { creerFeuille, nomsDesJoueurs, MODES, ROLES } from './feuille.mjs';
