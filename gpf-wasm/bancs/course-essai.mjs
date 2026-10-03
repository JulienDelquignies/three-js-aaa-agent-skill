// course-essai.mjs — LES GESTES EN COURSE DANS LE CORPS : un geste du répertoire en course (gestes/course/*.anim, outils/foulee-gpf.mjs),
// demandé en match à des porteurs LANCÉS — part-il, ses touches tombent-elles au pied (le ballon à l'attendu), le porteur garde-t-il le
// ballon, et dans quelle direction sort-il ?
//   node bancs/course-essai.mjs [geste=crochet|tous] [minutes=10] [graine=7]
// Notre cerveau joue le match (ses gestes à lui sont muets : options.gestes false). À chaque porteur de l'équipe 0 qui conduit entre 2,5 et
// 6,5 m/s, au plus une fois toutes les 4 s, on demande le geste (intention GESTE, la variante de son allure : 3,5 sous 4,2 m/s, 5 au-delà),
// sortie d'un côté au hasard ; tenu jusqu'à sa première touche (le corps coupe un contrôle dont la touche n'a pas eu lieu si l'intention
// change), puis la conduite de sortie. Les animations sont dans le paquet du corps (data.sh : gestes/course/).
import { chargerLeCorps, INTENTION, EV } from '../corps.mjs';
import { creerCerveau } from '../cerveau.mjs';
import { readFileSync } from 'node:fs';
import { NUMEROS, COURSE } from '../outils/foulee-gpf.mjs';
import { COURSE as TABLE } from '../gestes-course.mjs';
// LA TABLE DU CERVEAU (gestes-course.mjs, COURSE) reproduit le répertoire cuit (gestes/course/repertoire.json) : n°, durées, sorties
{ const R = JSON.parse(readFileSync(new URL('../gestes/course/repertoire.json', import.meta.url), 'utf8')), ecarts = [];
  for (const [nom, r] of Object.entries(R)) { const T = TABLE[nom]; if (!T) { ecarts.push(`${nom} absent`); continue; }
    for (const v of Object.keys(r.n)) if (T.n[v] !== r.n[v] || Math.abs((T.duree[v] ?? 0) - r.duree[v]) > 0.005) ecarts.push(`${nom}@${v}`);
    if (T.sortie !== r.sortie) ecarts.push(`${nom} sortie`); }
  if (ecarts.length) { console.log(`LA TABLE DE gestes-course.mjs NE REPRODUIT PAS LE RÉPERTOIRE CUIT : ${ecarts.join(', ')}`); process.exit(1); } }
const QUOI = process.argv[2] ?? 'tous', MIN = +(process.argv[3] ?? 10), GRAINE = +(process.argv[4] ?? 7);
const corps = await chargerLeCorps();
corps.lancer({ graine: GRAINE, intentions: true });
const cerveau = creerCerveau({ graine: GRAINE, options: { gestes: false } });
const noms = QUOI === 'tous' ? Object.keys(COURSE).filter((g) => g !== 'course') : [QUOI];
// la sortie de chaque geste (sa direction, rad, + à droite) : celle de son dernier temps qui touche
const sortieDe = Object.fromEntries(noms.map((g) => [g, COURSE[g](3.5).beats.filter((b) => b.dir != null).at(-1)?.dir ?? 0]));
const vus = [], deja = new Map(); let demande = null, joue = null, k = 0, demandes = 0;
const FIN = MIN * 60000;
while (corps.etat().t < FIN) {
  const e = corps.etat();
  if (e.enJeu && !e.cpa) {
    const d = cerveau.decider(e);
    const { equipe, joueur } = e.possession;
    const porteur = equipe === 0 && joueur >= 0 ? e.joueurs.filter((j) => j.equipe === 0)[joueur] : null;
    if (!demande && !joue && porteur && porteur.role !== 0 && porteur.vitesse >= 2.5 && porteur.vitesse <= 6.5 && (deja.get(porteur.id) ?? -1e9) < e.t - 4000) {
      const nom = noms[k++ % noms.length], v0 = porteur.vitesse < 3 ? 2.5 : porteur.vitesse < 4.2 ? 3.5 : 5.0, n = NUMEROS[`${nom}@${v0}`];
      const u = [porteur.v[0] / porteur.vitesse, porteur.v[1] / porteur.vitesse], cote = (k * 7919 + GRAINE) % 2 ? 1 : -1;
      // la sortie demandée : le côté du fichier (cote 1) ou son miroir — repère du corps : y vers la gauche du porteur ? on tourne u de ±dir
      const a = sortieDe[nom] * cote, c = Math.cos(-a), s = Math.sin(-a), dx = u[0] * c - u[1] * s, dy = u[0] * s + u[1] * c;
      deja.set(porteur.id, e.t); demandes++;
      // le ballon à la demande, dans le repère de la course du porteur : devant (m), de côté (m, + à gauche), sa vitesse le long de la course ;
      // et le geste en cours du corps (un contrôle après sa touche va au bout : le nôtre attend sa fin)
      const bx = e.ballon[0] - porteur.x, by = e.ballon[1] - porteur.y;
      const ballon = { av: bx * u[0] + by * u[1], lat: -bx * u[1] + by * u[0], v: e.ballonV[0] * u[0] + e.ballonV[1] * u[1], geste: porteur.geste };
      demande = { nom, n, v0, cote, id: porteur.id, rang: e.joueurs.indexOf(porteur), t: e.t, vDem: porteur.vitesse, x: porteur.x + dx * 6, y: porteur.y + dy * 6, u, ballon };
    }
    if (demande && e.t - demande.t > 700) { vus.push({ ...demande, rate: true }); demande = null; }
    const tenu = demande ?? (joue && !joue.touche1 ? joue : null), sortie = joue && joue.touche1 ? joue : null;
    for (const i of d) {
      if (tenu && i.id === tenu.id) corps.intention(i.id, { genre: INTENTION.GESTE, x: tenu.x, y: tenu.y, vitesse: tenu.v0, cible: tenu.n, drapeaux: 0 });
      else if (sortie && i.id === sortie.id) corps.intention(i.id, { genre: INTENTION.CONDUIRE, x: sortie.x, y: sortie.y, vitesse: Math.max(4, sortie.v0) });
      else corps.intention(i.id, i);
    }
    corps.fautes(d.fautes);
  }
  for (let st = 0; st < 10; st++) {
    corps.avancer(1);
    const j = corps.journal(); cerveau.observer(j);
    const E = corps.etat();
    for (const ev of j) {
      if (ev.type === EV.GESTE && demande && ev.joueur === demande.id && ev.a === demande.n) { joue = { ...demande, t0: ev.t, attente: ev.t - demande.t, serie: [], autres: [], arret: null }; demande = null; }
      else if (ev.type === EV.SERIE && joue && ev.joueur === joue.id) { if (ev.a >= 0) { joue.serie.push({ rang: ev.a, f: ev.b, ecart: ev.c }); joue.touche1 ??= ev.t; } else joue.arret = { f: ev.b, ecart: ev.c }; }
      else if (ev.type === EV.TOUCHE && joue && ev.joueur !== joue.id) joue.autres.push(ev.t - joue.t0);
    }
    if (joue && E.t - joue.t0 >= 1500) {
      const c = E.joueurs[joue.rang], b = E.ballon, dv = Math.hypot(c.v[0], c.v[1]) || 1;
      // la direction prise : la course du porteur 1,5 s après le départ, contre son entrée (°, + à droite du porteur)
      const cr = joue.u[0] * c.v[1] - joue.u[1] * c.v[0], dt = joue.u[0] * c.v[0] + joue.u[1] * c.v[1];
      joue.fin = { d: Math.hypot(b[0] - c.x, b[1] - c.y), v: c.vitesse, poss: E.possession.equipe === 0, dirPrise: -Math.atan2(cr, dt) * 180 / Math.PI * (dv > 0.5 ? 1 : NaN) };
      vus.push(joue); joue = null;
    }
  }
}
const med = (a) => { const s = a.filter((x) => !isNaN(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
console.log(`GESTES EN COURSE DANS LE CORPS — ${MIN} min, graine ${GRAINE} : ${demandes} demandés, ${vus.filter((v) => !v.rate).length} joués`);
for (const nom of noms) {
  const V = vus.filter((v) => v.nom === nom), J = V.filter((v) => !v.rate);
  if (!V.length) continue;
  const attendues = COURSE[nom](3.5).beats.filter((b) => b.type === 'touche').length;
  const completes = J.filter((v) => v.serie.length === attendues && !v.arret && !v.autres.length).length;
  const ecarts = J.flatMap((v) => v.serie.filter((x) => x.rang > 0).map((x) => x.ecart));
  console.log(`  ${nom.padEnd(16)} joués ${J.length}/${V.length} (attente médiane ${med(J.map((v) => v.attente))} ms) · touches toutes jouées ${completes}/${J.length}${ecarts.length ? ` (écart des suivantes ${(med(ecarts) * 100).toFixed(1)} cm)` : ''} · arrêtées ${J.filter((v) => v.arret).length} · autre joueur au ballon ${J.filter((v) => v.autres.length).length} · gardé à +1,5 s ${J.filter((v) => v.fin.poss).length}/${J.length} · ballon à ${med(J.map((v) => v.fin.d)).toFixed(2)} m, porteur ${med(J.map((v) => v.fin.v)).toFixed(1)} m/s`);
}
const R = vus.filter((v) => v.rate); if (R.length) console.log(`  non partis en 0,7 s : ${R.length} (allure à la demande ${R.map((v) => v.vDem.toFixed(1)).join(', ')})`);
// POURQUOI ÇA NE PART PAS : le départ selon le ballon à la demande (devant le porteur, en m) et le geste en cours du corps
const bac = (v) => (v.ballon.av < 0.3 ? '< 0,3' : v.ballon.av < 0.6 ? '0,3-0,6' : v.ballon.av < 1.0 ? '0,6-1,0' : v.ballon.av < 1.5 ? '1,0-1,5' : '≥ 1,5');
const parBac = {}; for (const v of vus) { const b = parBac[bac(v)] ??= { n: 0, ok: 0 }; b.n++; if (!v.rate) b.ok++; }
console.log(`  le départ selon le ballon devant le porteur à la demande : ${['< 0,3', '0,3-0,6', '0,6-1,0', '1,0-1,5', '≥ 1,5'].filter((k) => parBac[k]).map((k) => `${k} m : ${parBac[k].ok}/${parBac[k].n}`).join(' · ')}`);
const parG = {}; for (const v of vus) { const g = parG[v.ballon.geste] ??= { n: 0, ok: 0 }; g.n++; if (!v.rate) g.ok++; }
console.log(`  …selon le geste en cours du corps : ${Object.entries(parG).map(([g, x]) => `${g} ${x.ok}/${x.n}`).join(' · ')}`);
const parV = {}; for (const v of vus) { const k = v.vDem < 4.2 ? 'conduite' : v.vDem < 6 ? 'marche' : 'sprint'; const x = parV[k] ??= { n: 0, ok: 0 }; x.n++; if (!v.rate) x.ok++; }
console.log(`  …selon la classe d'allure : ${Object.entries(parV).map(([k, x]) => `${k} ${x.ok}/${x.n}`).join(' · ')}`);
