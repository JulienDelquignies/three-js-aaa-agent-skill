import { adaptBip01, prepareRocketboxMaterials } from '../engine/rig-bip01.js';

// LE CASTING DU DUEL — deux footballeurs Rocketbox (MIT : public/rocketbox, SOURCE.md) : le n° 18 dans la tenue d'origine
// (rayée noir et blanc), le n° 10 dans la même tenue passée en BLEU CIEL (tools/rocketbox-textures.py --ciel) — un par camp
// (squad.spawn(team)). Leur tenue est leur texture : pas de maillot peint par-dessus (ownKit). Taille NATIVE (le fichier est
// en mètres réels). Le rig Biped se présente comme la référence (engine/rig-bip01.js) : tous les gestes générés du moteur
// tombent juste sur lui. ?rig=ville rend joe et marta (vêtements de ville), ?rig=shanon la distribution d'avant.
const rocketbox = (file, name = file) => ({
  url: `rocketbox/${file}.glb`, faces: '+Z', name, height: 'natif', ownKit: true,
  prepare: (root) => ({ ...adaptBip01(root, { faces: '+Z' }), materiaux: prepareRocketboxMaterials(root) }),
});

export const DUEL_CAST = [rocketbox('foot-18', 'n18'), rocketbox('foot-10-ciel', 'n10')];
export const DUEL_CAST_VILLE = [rocketbox('joe'), rocketbox('marta')];
