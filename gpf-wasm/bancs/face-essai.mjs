// face-essai.mjs — LA SÉQUENCE DU FACE-À-FACE JOUÉE PAR LE CORPS : sur de vrais porteurs, en match, le corps enchaîne-t-il nos gestes ?
//   node bancs/face-essai.mjs [minutes=12] [graine=7] [occasions=10]
// Notre cerveau joue le match. Au premier porteur de l'équipe 0 (joueur de champ, hors surface) qui a un adversaire de champ devant lui
// (côté but, à 1,5-4 m), on prend la main sur lui seul et on joue la séquence : s'arrêter, l'arrêt de semelle, le roulé de semelle, la
// feinte de corps, le passement, la croqueta, puis la conduite lancée. Pour chaque étape : le geste est-il joué (le relevé du C++), en
// combien de temps, où va le ballon, le porteur le garde-t-il.
import { chargerLeCorps, INTENTION } from '../corps.mjs';
import { creerCerveau } from '../cerveau.mjs';
import { REPERTOIRE } from '../outils/vers-gpf.mjs';
const MIN = +(process.argv[2] ?? 12), GRAINE = +(process.argv[3] ?? 7), OCC = +(process.argv[4] ?? 10);
const corps = await chargerLeCorps(); corps.lancer({ graine: GRAINE, intentions: true });
const M = corps.M, cerveau = creerCerveau({ graine: GRAINE });
const n = M._gf_anims_n(), nom = (i) => { const p = M._gf_anim_nom(i); let f = p; while (M.HEAPU8[f]) f++; return new TextDecoder().decode(M.HEAPU8.subarray(p, f)); };
const idsDe = {}; for (let i = 0; i < n; i++) { const m = nom(i).match(/\/gestes\/(\w+)\.anim/); if (m) (idsDe[m[1]] ??= []).push(i); }
const joues = (g) => { const R = new Int32Array(M.HEAP32.buffer, M._gf_anim_releve(2), n); return (idsDe[g] ?? []).reduce((s, i) => s + R[i], 0); };
// la séquence : [geste ou 'arret' / 'sortie', durée max (s)]
const SEQ = [['arret', 1.0], ['arretSemelle', 1.2], ['semelleRoule', 0.9], ['feinte', 1.0], ['passementFace', 1.0], ['doubleContact', 0.8], ['sortie', 1.0]];
const occasions = []; let pris = null;
const versCerveauDir = (j) => [j.dir[0], j.dir[1]];
for (let tick = 0; corps.etat().t < MIN * 60000 && occasions.length < OCC; tick++) {
  const e = corps.etat();
  if (!e.enJeu || e.cpa) { if (pris) { pris.fin = 'arrêt de jeu'; occasions.push(pris); pris = null; } corps.avancer(10); cerveau.observer(corps.journal()); continue; }
  const d = cerveau.decider(e);
  const { equipe, joueur } = e.possession;
  const porteur = equipe === 0 && joueur >= 0 ? e.joueurs.filter((j) => j.equipe === 0)[joueur] : null;
  if (!pris && porteur && porteur.role !== 0 && porteur.x < 30) {
    const def = e.joueurs.filter((j) => j.equipe === 1 && j.role !== 0 && j.actif).map((j) => ({ j, d: Math.hypot(j.x - porteur.x, j.y - porteur.y) })).filter((o) => o.d > 1.5 && o.d < 4 && o.j.x > porteur.x).sort((a, b) => a.d - b.d)[0];
    if (def) pris = { id: porteur.id, def: def.j.id, t0: e.t, etape: 0, tEtape: e.t, avant: null, log: [] };
  }
  if (pris) {
    const c = e.joueurs.find((j) => j.id === pris.id), dq = e.joueurs.find((j) => j.id === pris.def);
    const aBallon = porteur && porteur.id === pris.id;
    const [nomE, dmax] = SEQ[pris.etape];
    const ecoule = (e.t - pris.tEtape) / 1000;
    // l'étape est-elle faite ?
    let fini = false;
    if (nomE === 'arret') fini = c.vitesse < 0.3 || ecoule > dmax;
    else if (nomE === 'sortie') fini = ecoule > dmax;
    else { const g = nomE === 'feinte' ? (pris.feinte ??= 'feinteSemelle') : nomE; if (pris.avant == null) pris.avant = joues(g); fini = joues(g) > pris.avant && ecoule > 0.3 || ecoule > dmax; }
    if (fini) {
      const g = nomE === 'feinte' ? pris.feinte : nomE, b = e.ballon;
      pris.log.push({ etape: g, joue: ['arret', 'sortie'].includes(nomE) ? null : joues(g) > pris.avant, duree: +ecoule.toFixed(2), garde: aBallon, ballon: c ? +Math.hypot(b[0] - c.x, b[1] - c.y).toFixed(2) : null, vitesse: +c.vitesse.toFixed(1) });
      pris.etape++; pris.tEtape = e.t; pris.avant = null;
      if (pris.etape >= SEQ.length || (!aBallon && nomE !== 'arret')) { occasions.push(pris); pris = null; }
    }
    if (pris) {
      const [nomE2] = SEQ[pris.etape];
      let it;
      if (nomE2 === 'arret') it = { genre: INTENTION.CONDUIRE, x: dq?.x ?? c.x + 1, y: dq?.y ?? c.y, vitesse: 0 };
      else if (nomE2 === 'sortie') it = { genre: INTENTION.CONDUIRE, x: c.x + 10, y: c.y + (pris.sortieY ??= (dq && dq.y > c.y ? -6 : 6)), vitesse: 7 };
      else it = { genre: INTENTION.GESTE, x: c.x + (dq ? (dq.x - c.x) : 1), y: c.y + (dq ? (dq.y - c.y) : 0), vitesse: 0, cible: REPERTOIRE[nomE2 === 'feinte' ? pris.feinte : nomE2], drapeaux: /^passement/.test(nomE2) ? 1 : 0 };
      for (const i of d) corps.intention(i.id, i.id === pris.id ? it : i);
    } else for (const i of d) corps.intention(i.id, i);
  } else for (const i of d) corps.intention(i.id, i);
  corps.fautes(d.fautes);
  corps.avancer(10);
  cerveau.observer(corps.journal());
}
console.log(`LA SÉQUENCE DU FACE-À-FACE — ${occasions.length} occasions, graine ${GRAINE}`);
for (const o of occasions) console.log(`  joueur ${o.id} contre ${o.def} : ${o.log.map((l) => `${l.etape}${l.joue === true ? ' ✓' : l.joue === false ? ' ✗' : ''} (${l.duree} s, ballon à ${l.ballon} m${l.garde ? '' : ', PERDU'})`).join(' → ')}${o.fin ? ` [${o.fin}]` : ''}`);
const tous = occasions.flatMap((o) => o.log.filter((l) => l.joue != null));
const parGeste = {}; for (const l of tous) { const g = (parGeste[l.etape] ??= { n: 0, j: 0 }); g.n++; if (l.joue) g.j++; }
console.log(`  joués / demandés : ${Object.entries(parGeste).map(([g, v]) => `${g} ${v.j}/${v.n}`).join(' · ')}`);
