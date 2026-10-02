// autopsie-tirs.mjs — CHAQUE TIR, DE LA FRAPPE À SON ISSUE : pourquoi 40 % de nos tirs entrent-ils (réel ≈ 11 %) ?
// Trois causes possibles, à séparer avant de toucher à quoi que ce soit :
//   · LES OCCASIONS — le cerveau tire de trop près, trop seul (la défense laisse des occasions trop belles) : l'xG DE
//     RÉFÉRENCE de la skill (`xgRef`, une logistique distance + angle ajustée sur les repères publics, indépendante des deux
//     moteurs) le dit ;
//   · LA FRAPPE — le tir part trop fort, trop bien placé (cadrage, hauteur, vitesse) ;
//   · LE GARDIEN — à tir cadré égal, il arrête moins qu'un vrai (réel : ≈ 70 % des tirs cadrés arrêtés).
// La mesure, au pas de 10 ms : à la touche « tir » du journal, la position (distance à la ligne, décalage, xG de référence),
// la pression (adversaire le plus proche), les défenseurs dans le triangle ballon-poteaux, le gardien (sa sortie, son
// décalage à la ligne de tir) ; le ballon juste après (vitesse, point où il croise la ligne de but s'il file droit). L'issue,
// à la première chose qui arrive : but, touche du gardien (arrêt), touche d'un autre défenseur (contré), d'un coéquipier,
// ballon sorti.
//   node bancs/autopsie-tirs.mjs [minutes=15] [graine=7] [mode=cerveau|ia] [sortie.jsonl]
import { writeFileSync } from 'node:fs';
import { chargerLeCorps, EV, GESTE } from '../corps.mjs';
import { creerCerveau } from '../cerveau.mjs';
import { xgRef } from '../../skills/threejs-aaa/assets/starter/src/engine/stats.js';
const MIN = +(process.argv[2] ?? 15), GRAINE = +(process.argv[3] ?? 7), MODE = process.argv[4] ?? 'cerveau';
const SORTIE = process.argv[5] ?? null;
const corps = await chargerLeCorps();
corps.lancer({ graine: GRAINE, intentions: true });
const cerveau = MODE === 'cerveau' ? creerCerveau({ graine: GRAINE }) : null;
// STATS_TIREURS='{"frappe":0.6,"puissance":0.8}' : les attributs des joueurs de champ (des deux équipes) multipliés — la
// frappe (technical_shot, 14), la puissance (physical_shotpower, 6), la volée (technical_volley, 15). Le gardien reste.
const TIREURS = process.env.STATS_TIREURS ? JSON.parse(process.env.STATS_TIREURS) : null;
if (TIREURS) {
  const ATTR = { frappe: 14, puissance: 6, volee: 15 };
  for (const j of corps.etat().joueurs) if (j.role !== 0)
    for (const [nom, k] of Object.entries(TIREURS)) corps.M._gf_set_stat(j.id, ATTR[nom], Math.min(1, corps.M._gf_get_stat(j.id, ATTR[nom]) * k));
}
const HX = 55, POTEAU = 3.7, BARRE = 2.5;

const tirs = [];
let enCours = null, dernierToucheur = null;
const derniereIntention = new Map();
const t0 = performance.now();

for (let pas = 0; pas < MIN * 6000; pas++) {
  if (pas % 10 === 0) {
    const e = corps.etat();
    if (cerveau && e.enJeu && !e.cpa) { const d = cerveau.decider(e); for (const i of d) { corps.intention(i.id, i); derniereIntention.set(i.id, i); } corps.fautes(d.fautes); }
  }
  corps.avancer(1);
  const ap = corps.etat();
  const parId = new Map(ap.joueurs.map(j => [j.id, j]));
  // le ballon juste après la frappe : sa vitesse et l'endroit où il croise la ligne de but (vol droit, sans gravité ni
  // courbe — un indicateur de cadrage, pas une trajectoire)
  if (enCours && enCours.vBallon == null) {
    const [vx, vy, vz] = ap.ballonV, [bx, by, bz] = ap.ballon;
    enCours.vBallon = Math.hypot(vx, vy, vz);
    const sens = enCours.equipe === 0 ? 1 : -1;
    if (vx * sens > 0.5) {
      const tl = (sens * HX - bx) / vx;
      enCours.yLigne = by + vy * tl; enCours.zLigne = bz + vz * tl - 4.9 * tl * tl;
      enCours.cadreDroit = Math.abs(enCours.yLigne) < POTEAU && enCours.zLigne < BARRE && enCours.zLigne > -0.5;
    } else enCours.cadreDroit = false;
  }
  const evs = corps.journal(); cerveau?.observer(evs);
  for (const ev of evs) {
    if (ev.type === EV.BUT && enCours && !enCours.issue) {
      enCours.issue = ev.equipe === enCours.equipe ? 'but' : 'csc'; enCours.duree = (ev.t - enCours.t) / 1000;
      enCours = null;
    } else if (ev.type === EV.TOUCHE) {
      dernierToucheur = ev.equipe;
      if (enCours && ev.joueur !== enCours.tireur && !enCours.issue) {
        const j = parId.get(ev.joueur);
        enCours.issue = ev.equipe === enCours.equipe ? 'coequipier' : j?.role === 0 ? 'gardien' : 'contre';
        enCours.gesteGardien = j?.role === 0 ? ev.b : null;
        enCours.duree = (ev.t - enCours.t) / 1000;
        enCours = null;
      }
      if (ev.b === GESTE.TIR && (!enCours || enCours.tireur !== ev.joueur)) {
        const ti = parId.get(ev.joueur);
        const sens = ev.equipe === 0 ? 1 : -1;
        const [bx, by] = ap.ballon;
        const dx = HX - bx * sens, z = by * sens;
        const adv = ap.joueurs.filter(j => j.equipe !== ev.equipe && j.actif);
        const gk = adv.find(j => j.role === 0);
        // les défenseurs dans le triangle ballon - poteau - poteau (le gardien à part)
        const dans = (j) => {
          const ax = sens * HX, P = [[bx, by], [ax, POTEAU], [ax, -POTEAU]];
          const s = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
          const d1 = s(P[0], P[1], [j.x, j.y]), d2 = s(P[1], P[2], [j.x, j.y]), d3 = s(P[2], P[0], [j.x, j.y]);
          return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
        };
        const it = derniereIntention.get(ev.joueur);
        // le gardien : sa sortie (distance au centre du but) et son décalage à la ligne ballon → centre du but
        let gkSortie = null, gkDecalage = null;
        if (gk) {
          gkSortie = Math.hypot(gk.x - sens * HX, gk.y);
          const ux = sens * HX - bx, uy = -by, L = Math.hypot(ux, uy) || 1;
          gkDecalage = Math.abs(((gk.x - bx) * uy - (gk.y - by) * ux) / L);
        }
        enCours = { t: ev.t, equipe: ev.equipe, tireur: ev.joueur, dx, z, dist: Math.hypot(dx, z), xg: xgRef(dx, z),
          hauteur: ap.ballon[2], pression: Math.min(...adv.filter(j => j.role !== 0).map(j => Math.hypot(j.x - bx, j.y - by))),
          defDansTriangle: adv.filter(j => j.role !== 0 && dans(j)).length, gkSortie, gkDecalage,
          voulu: it?.genre === 4 ? { x: it.x, y: it.y, puissance: it.puissance } : null,
          vitesseTireur: ti?.vitesse ?? null };
        tirs.push(enCours);
      }
    }
  }
  if (enCours && !enCours.issue && !ap.enJeu) { enCours.issue = 'sorti'; enCours.duree = (ap.t - enCours.t) / 1000; enCours = null; }
}
const fin = corps.etat();
const empreinte = fin.joueurs.reduce((h, j) => ((h * 31 + Math.round(j.x * 1000)) * 31 + Math.round(j.y * 1000)) | 0, 0);
if (SORTIE) writeFileSync(SORTIE, tirs.map(p => JSON.stringify({ mode: MODE, graine: GRAINE, ...p })).join('\n') + '\n');

const pc = (a, b) => (b ? (100 * a / b).toFixed(0) + ' %' : '—');
const q = (a, k, d = 1) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(k * (s.length - 1))].toFixed(d) : '—'; };
const somme = (a) => a.reduce((s, x) => s + x, 0);
const T = tirs.filter(p => p.issue);
const buts = T.filter(p => p.issue === 'but');
console.log(`AUTOPSIE DES TIRS — ${MODE === 'cerveau' ? 'NOTRE CERVEAU' : 'LEUR IA'}${TIREURS ? ` · tireurs ${JSON.stringify(TIREURS)}` : ''}, ${MIN} min, graine ${GRAINE} (${((performance.now() - t0) / 1000).toFixed(0)} s) · score ${fin.score.join('-')} · empreinte finale ${empreinte}`);
console.log(`  ${tirs.length} tirs : buts ${buts.length} (${pc(buts.length, T.length)}) · xG de référence ${somme(T.map(p => p.xg)).toFixed(2)} (moyen ${q(T.map(p => p.xg), 0.5, 3)} médian) · issues ${JSON.stringify(T.reduce((o, p) => (o[p.issue] = (o[p.issue] ?? 0) + 1, o), {}))}`);
console.log(`  d'où : distance médiane ${q(T.map(p => p.dist), 0.5)} m (p25 ${q(T.map(p => p.dist), 0.25)}, p75 ${q(T.map(p => p.dist), 0.75)}) · pression ${q(T.map(p => p.pression), 0.5)} m · défenseurs dans le triangle ${q(T.map(p => p.defDansTriangle), 0.5, 0)} (médiane ; 0 dans ${pc(T.filter(p => p.defDansTriangle === 0).length, T.length)})`);
console.log(`  la frappe : ballon ${q(T.map(p => p.vBallon), 0.5)} m/s · cadrée (vol droit) ${pc(T.filter(p => p.cadreDroit).length, T.length)} · le gardien : sorti à ${q(T.map(p => p.gkSortie), 0.5)} m du centre du but, décalé de ${q(T.map(p => p.gkDecalage), 0.5)} m de la ligne de tir`);
const cadres = T.filter(p => p.cadreDroit);
console.log(`  tirs cadrés : ${cadres.length} → buts ${pc(cadres.filter(p => p.issue === 'but').length, cadres.length)} · gardien ${pc(cadres.filter(p => p.issue === 'gardien').length, cadres.length)} · contrés ${pc(cadres.filter(p => p.issue === 'contre').length, cadres.length)}`);
for (const [a, b] of [[0, 0.05], [0.05, 0.15], [0.15, 0.35], [0.35, 1.01]]) {
  const s = T.filter(p => p.xg >= a && p.xg < b);
  console.log(`    xG ${a}-${b} : ${s.length} tirs, ${s.filter(p => p.issue === 'but').length} buts (${pc(s.filter(p => p.issue === 'but').length, s.length)} ; attendu ${somme(s.map(p => p.xg)).toFixed(1)})`);
}
