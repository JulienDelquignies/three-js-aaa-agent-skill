import { adaptBip01, prepareRocketboxMaterials } from '../engine/rig-bip01.js';

// LE CASTING DU DUEL — deux personnages Rocketbox (tidewater, MIT : public/rocketbox) : joe contre marta, un par
// camp (squad.spawn(team)). Ils jouent dans LEURS vêtements — un city stade, pas un club : pas de maillot peint
// (ownKit), et ce sont deux corps qu'on distingue avant toute couleur. Taille NATIVE (le fichier est en mètres
// réels — la normalisation à 1,80 m ferait de marta la plus grande). Le rig Biped se présente comme la
// référence (engine/rig-bip01.js) : tous les gestes générés du moteur tombent juste sur lui. ?rig=shanon rend la
// distribution d'avant.
const rocketbox = (name) => ({
  url: `rocketbox/${name}.glb`, faces: '+Z', name, height: 'natif', ownKit: true,
  prepare: (root) => ({ ...adaptBip01(root, { faces: '+Z' }), materiaux: prepareRocketboxMaterials(root) }),
});

export const DUEL_CAST = [rocketbox('joe'), rocketbox('marta')];
