// releve-course.mjs — Où le corps perd-il nos gestes en course ? Le relevé de ses choix (patch.py, étape 10) : étage 0 candidate (après le tri grossier),
// 1 gardée (meilleures directions), 2 jouée — pour chacune de nos animations en course, après un banc de demandes.
//   node bancs/releve-course.mjs [geste=passement] [minutes=10] [graine=7]   (des porteurs lancés à 2,5-4,2 m/s, la variante à 3,5 m/s)
// Mesuré le 3 octobre : le passement à 3,5 m/s candidat 204 fois, gardé 85 + 119 (le fichier et son miroir), joué 57 fois en 10 min.
const G = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const { chargerLeCorps, INTENTION, EV } = await import(`${G}/corps.mjs`);
const { creerCerveau } = await import(`${G}/cerveau.mjs`);
const { NUMEROS, COURSE } = await import(`${G}/outils/foulee-gpf.mjs`);
const [QUOI = 'passement', MIN_ = '10', GR_ = '7'] = process.argv.slice(2);
const corps = await chargerLeCorps(); corps.lancer({ graine: +GR_, intentions: true });
const M = corps.M, cerveau = creerCerveau({ graine: +GR_, options: { gestes: false } });
M._gf_anim_raz();
const sortie = COURSE[QUOI](3.5).beats.filter((b) => b.dir != null).at(-1)?.dir ?? 0;
let demande = null, k = 0, n = 0; const deja = new Map();
while (corps.etat().t < +MIN_ * 60000) {
  const e = corps.etat();
  if (e.enJeu && !e.cpa) {
    const d = cerveau.decider(e);
    const { equipe, joueur } = e.possession;
    const p = equipe === 0 && joueur >= 0 ? e.joueurs.filter((j) => j.equipe === 0)[joueur] : null;
    if (!demande && p && p.role !== 0 && p.vitesse >= 2.5 && p.vitesse < 4.2 && (deja.get(p.id) ?? -1e9) < e.t - 4000) {
      const u = [p.v[0] / p.vitesse, p.v[1] / p.vitesse], cote = k++ % 2 ? 1 : -1, a = sortie * cote, c = Math.cos(-a), s = Math.sin(-a);
      deja.set(p.id, e.t); n++;
      demande = { id: p.id, t: e.t, x: p.x + (u[0] * c - u[1] * s) * 6, y: p.y + (u[0] * s + u[1] * c) * 6 };
    }
    if (demande && e.t - demande.t > 700) demande = null;
    for (const i of d) corps.intention(i.id, demande && i.id === demande.id ? { genre: INTENTION.GESTE, x: demande.x, y: demande.y, vitesse: 3.5, cible: NUMEROS[`${QUOI}@3.5`], drapeaux: 0 } : i);
    corps.fautes(d.fautes);
  }
  for (let s = 0; s < 10; s++) { corps.avancer(1); const j = corps.journal(); cerveau.observer(j); for (const ev of j) if (ev.type === EV.GESTE && demande && ev.joueur === demande.id) demande = null; }
}
const N = M._gf_anims_n(), lire = (et) => new Int32Array(M.HEAP32.buffer, M._gf_anim_releve(et), N).slice();
const R0 = lire(0), R1 = lire(1), R2 = lire(2);
console.log(`${QUOI} — ${n} demandes (porteurs à 2,5-4,2 m/s), ${MIN_} min`);
for (let id = 0; id < N; id++) {
  const nom = M.UTF8ToString ? M.UTF8ToString(M._gf_anim_nom(id)) : null;
  const ptr = M._gf_anim_nom(id); let s = ''; for (let i = ptr; M.HEAPU8[i]; i++) s += String.fromCharCode(M.HEAPU8[i]);
  if (/gestes\/course\//.test(s)) console.log(`  ${s.replace(/.*animations\//, '').padEnd(46)} candidate ${String(R0[id]).padStart(5)} · gardée ${String(R1[id]).padStart(5)} · jouée ${R2[id]}`);
}
