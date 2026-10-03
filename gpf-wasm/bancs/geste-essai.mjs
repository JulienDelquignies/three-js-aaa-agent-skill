// geste-essai.mjs — UN GESTE DE NOTRE RÉPERTOIRE, DEMANDÉ AU CORPS EN MATCH : est-il joué, et le pied va-t-il au ballon ?
//   node bancs/geste-essai.mjs [numéro=101] [minutes=10] [graine=7] [vitesseMax=2.5]
// Notre cerveau joue le match. À chaque porteur de l'équipe 0 qui va à moins de vitesseMax m/s, on demande le geste (intention
// GESTE, tenue 1 s), une fois par porteur et par possession. On relève : le geste candidat, gardé, joué (le relevé du C++) ;
// et, pendant qu'il est joué, la distance la plus courte entre les chevilles du corps (FK de sa pose) et le ballon.
import { chargerLeCorps, INTENTION } from '../corps.mjs';
import { creerCerveau } from '../cerveau.mjs';
import { fkGpf, GPF_NODES } from '../outils/vers-gpf.mjs';
const N = +(process.argv[2] ?? 101), MIN = +(process.argv[3] ?? 10), GRAINE = +(process.argv[4] ?? 7), VMAX = +(process.argv[5] ?? 2.5);
const corps = await chargerLeCorps(); corps.lancer({ graine: GRAINE, intentions: true });
const M = corps.M, cerveau = creerCerveau({ graine: GRAINE });
const n = M._gf_anims_n(), nom = (i) => { const p = M._gf_anim_nom(i); let f = p; while (M.HEAPU8[f]) f++; return new TextDecoder().decode(M.HEAPU8.subarray(p, f)); };
const ids = []; for (let i = 0; i < n; i++) if (nom(i).includes('/gestes/')) ids.push(i);
const releve = () => [0, 1, 2].map((k) => { const R = new Int32Array(M.HEAP32.buffer, M._gf_anim_releve(k), n); return ids.reduce((s, i) => s + R[i], 0); });
const PER = M._gf_pose_per();
const pose = (rang) => { const F = new Float32Array(M.HEAPF32.buffer, M._gf_pose(), 22 * PER), o = rang * PER; const q = {}; GPF_NODES.forEach((nd, k) => { q[nd] = [F[o + 3 + 4 * k], F[o + 4 + 4 * k], F[o + 5 + 4 * k], F[o + 6 + 4 * k]]; }); return { p: [F[o], F[o + 1], F[o + 2]], q }; };
M._gf_anim_raz();
const demandes = []; let enCours = null; const dejaDemande = new Set();
for (let tick = 0; corps.etat().t < MIN * 60000; tick++) {
  const e = corps.etat();
  if (e.enJeu && !e.cpa) {
    const d = cerveau.decider(e);
    const { equipe, joueur } = e.possession;
    const porteur = equipe === 0 && joueur >= 0 ? e.joueurs.filter((j) => j.equipe === 0)[joueur] : null;
    if (!enCours && porteur && porteur.role !== 0 && porteur.vitesse < VMAX && !dejaDemande.has(`${porteur.id}-${Math.floor(e.t / 5000)}`)) {
      dejaDemande.add(`${porteur.id}-${Math.floor(e.t / 5000)}`);
      enCours = { id: porteur.id, rang: e.joueurs.indexOf(porteur), t0: e.t, avant: releve(), dmin: Infinity, vitesse: porteur.vitesse };
    }
    for (const i of d) {
      if (enCours && i.id === enCours.id) corps.intention(i.id, { genre: INTENTION.GESTE, x: porteur?.x ?? 0, y: porteur?.y ?? 0, vitesse: 0, cible: N, drapeaux: 0 });
      else corps.intention(i.id, i);
    }
    corps.fautes(d.fautes);
  }
  for (let s = 0; s < 10; s++) {
    corps.avancer(1);
    if (enCours) {
      const E = corps.etat(), j = E.joueurs[enCours.rang];
      if (j && (E.joueurs[enCours.rang].geste === 2)) {   // ballcontrol en cours : mesurer le pied au ballon
        const W = fkGpf(pose(enCours.rang)), b = E.ballon;
        for (const c of ['left_ankle', 'right_ankle']) enCours.dmin = Math.min(enCours.dmin, Math.hypot(W[c].p[0] - b[0], W[c].p[1] - b[1], W[c].p[2] - b[2]));
      }
    }
  }
  cerveau.observer(corps.journal());
  if (enCours && corps.etat().t - enCours.t0 > 1000) {
    const apres = releve(); enCours.jouee = apres[2] - enCours.avant[2] > 0; enCours.candidate = apres[0] - enCours.avant[0];
    demandes.push(enCours); enCours = null;
  }
}
const jouees = demandes.filter((d) => d.jouee);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
console.log(`GESTE ${N} (${ids.map(nom).join(', ')}) — ${MIN} min, graine ${GRAINE} : ${demandes.length} demandes, ${jouees.length} jouées · relevé total ${JSON.stringify(releve())} (candidat, gardé, joué)`);
console.log(`  la cheville la plus proche du ballon pendant le geste joué : médiane ${(med(jouees.map((d) => d.dmin)) * 100).toFixed(1)} cm (${jouees.map((d) => (d.dmin * 100).toFixed(0)).join(', ')} cm)`);
console.log(`  demandes refusées : vitesse du porteur ${demandes.filter((d) => !d.jouee).map((d) => d.vitesse.toFixed(1)).join(', ')} m/s ; candidates ${demandes.filter((d) => !d.jouee).map((d) => d.candidate).join(', ')}`);
