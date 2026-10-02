// obeissance.mjs — LE CORPS OBÉIT-IL ? Quatre intentions, chacune contre le même match sans intention (même graine).
//   node bancs/obeissance.mjs [secondes=60] [graine=7]
// ALLER : l'équipe 0 se range sur une grille ; PASSER : chaque joueur de l'équipe 0 a un destinataire imposé (un anneau) ;
// TIRER : l'équipe 0 tire dès qu'elle a le ballon ; PRESSER : l'équipe 1 presse le porteur.
import { chargerLeCorps, INTENTION, PASSE, EV, GESTE } from '../corps.mjs';
const SEC = +(process.argv[2] ?? 60), GRAINE = +(process.argv[3] ?? 7);
const corps = await chargerLeCorps();
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

/** Un match de SEC secondes ; `poser(etat)` pose les intentions toutes les 100 ms ; `mesure(etat, evs)` à chaque pas de 100 ms. */
function jouer(poser, mesure) {
  corps.lancer({ graine: GRAINE, intentions: true });
  for (let i = 0; i < SEC * 10; i++) {
    const e = corps.etat();
    if (poser) poser(e);
    corps.avancer(10);
    mesure(corps.etat(), corps.journal());
  }
}
const champ = (e, eq) => e.joueurs.filter(j => j.equipe === eq && j.role !== 0);   // role 0 = gardien

// ── ALLER ──
const grille = (k) => [-35 + (k % 4) * 8, -24 + Math.floor(k / 4) * 16];
function aller(avec) {
  const dist = [];
  jouer(avec ? (e) => champ(e, 0).forEach((j, k) => corps.intention(j.id, { genre: INTENTION.ALLER, x: grille(k)[0], y: grille(k)[1], vitesse: 6 })) : null,
    (e) => { if (e.t > (SEC - 20) * 1000) champ(e, 0).forEach((j, k) => dist.push(Math.hypot(j.x - grille(k)[0], j.y - grille(k)[1]))); });
  return med(dist);
}
// ── PASSER ──
function passer(avec) {
  let ids = null, bonnes = 0, recues = 0, tentees = 0, dernier = null;
  jouer((e) => {
    ids ??= champ(e, 0).map(j => j.id);
    if (avec) ids.forEach((id, k) => corps.intention(id, { genre: INTENTION.PASSER, cible: ids[(k + 1) % ids.length], drapeaux: PASSE.COURTE }));
  }, (e, evs) => {
    for (const ev of evs) {
      if (ev.type !== EV.TOUCHE) continue;
      const passe = (x) => x && x.equipe === 0 && [GESTE.PASSE_COURTE, GESTE.PASSE_LONGUE, GESTE.PASSE_HAUTE].includes(x.b);
      if (passe(ev)) tentees++;
      if (passe(dernier) && ev.joueur !== dernier.joueur && ev.equipe === 0) {
        recues++; if (ev.joueur === ids[(ids.indexOf(dernier.joueur) + 1) % ids.length]) bonnes++;
      }
      dernier = ev;
    }
  });
  return { tentees, recues, bonnes, taux: recues ? bonnes / recues : NaN };
}
// ── TIRER ──
function tirer(avec) {
  let tirs = 0;
  jouer(avec ? (e) => champ(e, 0).forEach(j => corps.intention(j.id, { genre: INTENTION.TIRER, x: 55, y: 0, puissance: 0.8 })) : null,
    (e, evs) => { for (const ev of evs) if (ev.type === EV.TOUCHE && ev.equipe === 0 && ev.b === GESTE.TIR) tirs++; });
  return tirs;
}
// ── PRESSER ── le porteur : le dernier toucheur de l'équipe 0, à moins de 1,5 m du ballon (il le porte encore)
function presser(avec) {
  const proche = [], deux = []; let porteur = null, interventions = 0, recuperations = 0;
  jouer(avec ? (e) => champ(e, 1).forEach(j => corps.intention(j.id, { genre: INTENTION.PRESSER, x: e.ballon[0], y: e.ballon[1], vitesse: 7 })) : null,
    (e, evs) => {
      for (const ev of evs) if (ev.type === EV.TOUCHE) {
        if (ev.equipe === 1 && [GESTE.INTERVENTION, GESTE.TACLE].includes(ev.b)) interventions++;
        if (ev.equipe === 1 && porteur?.equipe === 0) recuperations++;
        porteur = ev;
      }
      if (!porteur || porteur.equipe !== 0 || !e.enJeu) return;
      const p = e.joueurs.find(j => j.id === porteur.joueur);
      if (!p || Math.hypot(p.x - e.ballon[0], p.y - e.ballon[1]) > 1.5) return;
      const d = champ(e, 1).map(j => Math.hypot(j.x - p.x, j.y - p.y)).sort((a, b) => a - b);
      proche.push(d[0]); deux.push((d[0] + d[1]) / 2);
    });
  return { proche: med(proche), deux: med(deux), interventions, recuperations };
}

const t0 = performance.now();
const r = {
  aller: { sans: aller(false), avec: aller(true) },
  passer: { sans: passer(false), avec: passer(true) },
  tirer: { sans: tirer(false), avec: tirer(true) },
  presser: { sans: presser(false), avec: presser(true) },
};
console.log(`OBÉISSANCE DU CORPS — ${SEC} s de jeu, graine ${GRAINE} (${((performance.now() - t0) / 1000).toFixed(1)} s de calcul)`);
console.log(`  ALLER   : distance médiane à la cible (20 dernières s) — sans ${r.aller.sans.toFixed(1)} m · avec ${r.aller.avec.toFixed(1)} m`);
console.log(`  PASSER  : passes tentées / reçues par un coéquipier / par le destinataire imposé — sans ${r.passer.sans.tentees}/${r.passer.sans.recues}/${r.passer.sans.bonnes} · avec ${r.passer.avec.tentees}/${r.passer.avec.recues}/${r.passer.avec.bonnes} (${(100 * r.passer.avec.taux).toFixed(0)} % des reçues)`);
console.log(`  TIRER   : tirs de l'équipe 0 — sans ${r.tirer.sans} · avec ${r.tirer.avec}`);
console.log(`  PRESSER : porteur — le plus proche / les deux plus proches (médianes) — sans ${r.presser.sans.proche.toFixed(1)} / ${r.presser.sans.deux.toFixed(1)} m · avec ${r.presser.avec.proche.toFixed(1)} / ${r.presser.avec.deux.toFixed(1)} m ; interventions ${r.presser.sans.interventions} → ${r.presser.avec.interventions} ; récupérations ${r.presser.sans.recuperations} → ${r.presser.avec.recuperations}`);
