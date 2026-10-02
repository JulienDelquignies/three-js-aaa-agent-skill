// paquet.mjs — L'ENTRÉE DU CERVEAU EMPAQUETÉ (out/cerveau.mjs, voir empaqueter.sh) : le cerveau et le contrat du corps, tout ce
// qu'il faut à une page qui charge elle-même le module WebAssembly (out/gpf.mjs).
export { creerCerveau } from './cerveau.mjs';
export { INTENTION, PASSE, EV, GESTE, lireEtat, lireJournal, poserIntention } from './contrat.mjs';
