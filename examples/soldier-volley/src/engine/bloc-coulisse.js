// bloc-coulisse.js — LE BLOC QUI SE RESSERRE VERS LE BALLON (lot 368, cfg.blocCoulisse — T1 du chantier tactique, B10 du livre).
// La loi vit dans formation.formationSpots (bloc.coulisse : la largeur et le gain de coulissement PAR LIGNE, bornés par la touche) ;
// ce module la greffe sur le bloc de l'équipe défendante, modulée par SA tactique : la COMPACITÉ resserre les lignes (× 1,15 relâché
// … × 0,85 serré — 0,5 : × 1, l'identité de la clé). Absente : le bloc d'hier au bit.
const ax = (v, lo, hi) => lo + Math.max(0, Math.min(1, v ?? 0.5)) * (hi - lo);
export function blocCoulisse(bloc, C, tq) {
  if (!bloc || !C) return bloc;
  return { ...bloc, coulisse: { ...C, f: ax(tq?.compacite, 1.15, 0.85) } };
}
