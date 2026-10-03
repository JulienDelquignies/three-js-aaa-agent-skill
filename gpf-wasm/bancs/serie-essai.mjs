// serie-essai.mjs — UN GESTE EN SÉRIE DE NOTRE RÉPERTOIRE (plusieurs touches : la roulette, la croqueta, le râteau), DEMANDÉ AU CORPS EN
// MATCH : ses touches tombent-elles à leur image, le pied au ballon, et le ballon reste-t-il au porteur ?
//   node bancs/serie-essai.mjs [numéro=114] [minutes=10] [graine=7]
// Notre cerveau joue le match. À chaque porteur de l'équipe 0 presque arrêté (< 1,5 m/s : nos gestes partent de l'arrêt), on demande le
// geste (intention GESTE, tenue jusqu'à son départ), au plus une fois par porteur toutes les 5 s. Pour chaque geste joué : ses touches
// (le journal GF_EV_SERIE : le rang, l'image, l'écart du ballon à l'attendu ; le journal des touches, lui, ne répète pas le même toucheur
// au même geste), la cheville la plus proche du ballon à chaque touche (FK de la pose), la touche d'un autre joueur pendant le geste, la
// série arrêtée (le ballon n'était plus là), et le ballon à la fin (sa distance au porteur, sa vitesse).
import { readFileSync } from 'node:fs';
import { chargerLeCorps, INTENTION, EV } from '../corps.mjs';
import { creerCerveau } from '../cerveau.mjs';
import { fkGpf, GPF_NODES, REPERTOIRE } from '../outils/vers-gpf.mjs';
const N = +(process.argv[2] ?? 114), MIN = +(process.argv[3] ?? 10), GRAINE = +(process.argv[4] ?? 7);
const nomGeste = Object.keys(REPERTOIRE).find((k) => REPERTOIRE[k] === N);
// les touches attendues : la ligne football du geste (toutes les entrées sauf la dernière, la destination)
const ligne = readFileSync(new URL(`../gestes/${nomGeste}.anim`, import.meta.url), 'utf8').split('\n').find((l) => l.startsWith('extension,football'));
const tok = ligne.split(',').slice(2).map(Number), entrees = [];
for (let i = 0; i + 3 < tok.length; i += 4) entrees.push(tok[i]);
const attendues = entrees.slice(0, -1), duree = entrees.at(-1);
const corps = await chargerLeCorps(); corps.lancer({ graine: GRAINE, intentions: true });
const M = corps.M, cerveau = creerCerveau({ graine: GRAINE, options: { face: false } });
const PER = M._gf_pose_per();
const pose = (rang) => { const F = new Float32Array(M.HEAPF32.buffer, M._gf_pose(), 22 * PER), o = rang * PER; const q = {}; GPF_NODES.forEach((nd, k) => { q[nd] = [F[o + 3 + 4 * k], F[o + 4 + 4 * k], F[o + 5 + 4 * k], F[o + 6 + 4 * k]]; }); return { p: [F[o], F[o + 1], F[o + 2]], q }; };
const cheville = (rang, b) => { const W = fkGpf(pose(rang)); return ['left_ankle', 'right_ankle'].map((c) => Math.hypot(W[c].p[0] - b[0], W[c].p[1] - b[1], W[c].p[2] - b[2])); };
const vus = [], deja = new Map();
let demande = null, joue = null;
for (let tick = 0; corps.etat().t < MIN * 60000; tick++) {
  const e = corps.etat();
  if (e.enJeu && !e.cpa) {
    const d = cerveau.decider(e);
    const { equipe, joueur } = e.possession;
    const porteur = equipe === 0 && joueur >= 0 ? e.joueurs.filter((j) => j.equipe === 0)[joueur] : null;
    if (!demande && !joue && porteur && porteur.role !== 0 && porteur.vitesse < 1.5 && (deja.get(porteur.id) ?? -1e9) < e.t - 5000) {
      deja.set(porteur.id, e.t);
      demande = { id: porteur.id, rang: e.joueurs.indexOf(porteur), t: e.t, x: porteur.x + porteur.dir[0] * 3, y: porteur.y + porteur.dir[1] * 3 };
    }
    if (demande && e.t - demande.t > 600) demande = null;   // le corps ne l'a pas lancé
    // le geste tenu de la demande jusqu'à sa dernière touche (le corps coupe un contrôle dont la touche n'a pas eu lieu, si l'intention change)
    const tenu = demande ?? (joue && e.t - joue.t0 < attendues.at(-1) * 10 + 10 ? joue : null);
    for (const i of d) {
      if (tenu && i.id === tenu.id) corps.intention(i.id, { genre: INTENTION.GESTE, x: tenu.x, y: tenu.y, vitesse: N === 115 ? 0 : 3.5, cible: N, drapeaux: 0 });
      else corps.intention(i.id, i);
    }
    corps.fautes(d.fautes);
  }
  for (let s = 0; s < 10; s++) {
    corps.avancer(1);
    const j = corps.journal(); cerveau.observer(j);
    const E = corps.etat();
    for (const ev of j) {
      if (ev.type === EV.GESTE && demande && ev.joueur === demande.id && ev.a === N) { joue = { ...demande, t0: ev.t, touches: [], autres: [] }; demande = null; }
      else if (ev.type === EV.SERIE && joue && ev.joueur === joue.id) {
        if (ev.a >= 0) joue.touches.push({ rang: ev.a, f: ev.b, ecart: ev.c, v: ev.d, d: Math.min(...cheville(joue.rang, E.ballon)) });
        else joue.arret = { f: ev.b, ecart: ev.c };
      } else if (ev.type === EV.TOUCHE && joue && ev.joueur !== joue.id) joue.autres.push(Math.round((ev.t - joue.t0) / 10));
    }
    if (joue && E.t - joue.t0 >= duree * 10) {
      const c = E.joueurs[joue.rang], b = E.ballon;
      joue.fin = { d: Math.hypot(b[0] - c.x, b[1] - c.y), v: Math.hypot(E.ballonV[0], E.ballonV[1]), vCorps: c.vitesse };
      vus.push(joue); joue = null;
    }
  }
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
console.log(`GESTE EN SÉRIE ${N} (${nomGeste}) — ${MIN} min, graine ${GRAINE} : ${vus.length} joués · touches attendues aux images ${attendues.join(', ')}, destination ${duree}`);
for (const v of vus) console.log(`  ${(v.t0 / 1000).toFixed(1)} s · touches ${v.touches.map((t) => `${t.f} (écart ${(t.ecart * 100).toFixed(0)} cm, cheville ${(t.d * 100).toFixed(0)} cm, ${t.v.toFixed(1)} m/s)`).join(', ') || 'aucune'}${v.arret ? ` · ARRÊT image ${v.arret.f} (ballon à ${(v.arret.ecart * 100).toFixed(0)} cm de l'attendu)` : ''}${v.autres.length ? ` · AUTRE joueur aux images ${v.autres.join(', ')}` : ''} · fin : ballon à ${v.fin.d.toFixed(2)} m, ${v.fin.v.toFixed(1)} m/s (porteur ${v.fin.vCorps.toFixed(1)} m/s)`);
const toutes = vus.filter((v) => v.touches.length === attendues.length && !v.autres.length);
const suivantes = vus.flatMap((v) => v.touches.filter((t) => t.rang > 0));
console.log(`  séries complètes ${toutes.length}/${vus.length} · écart du ballon à l'attendu aux touches suivantes : médiane ${(med(suivantes.map((t) => t.ecart)) * 100).toFixed(1)} cm · cheville au ballon : médiane ${(med(vus.flatMap((v) => v.touches.map((t) => t.d))) * 100).toFixed(1)} cm · ballon à la fin : médiane ${med(vus.map((v) => v.fin.d)).toFixed(2)} m`);
