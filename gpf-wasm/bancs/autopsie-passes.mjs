// autopsie-passes.mjs — CHAQUE PASSE, DE LA FRAPPE À LA TOUCHE SUIVANTE : pourquoi nos passes se perdent-elles plus que les
// leurs ? Deux causes possibles, à séparer avant de toucher à quoi que ce soit :
//   · LE CHOIX — le cerveau choisit des passes plus risquées (une ligne de passe moins dégagée, un receveur plus serré) ;
//   · L'EXÉCUTION — à risque égal, la passe réussit moins (le ballon part moins vite, le receveur ne vient pas au ballon…).
// La mesure : au contact (l'événement PASSE du corps, au pas de 10 ms), la ligne de passe — du ballon au point où le corps vise
// le receveur (sa position + sa vitesse × la durée de passe du moteur, AI_GetPass) — et son DÉGAGEMENT (la distance du plus
// proche adversaire à ce segment) ; la pression sur le passeur et sur le receveur ; la vitesse du ballon. À la touche
// suivante d'un autre joueur : au receveur visé, à un autre coéquipier, à l'adversaire — ou sortie. Puis la réussite PAR
// TRANCHE DE DÉGAGEMENT, dans les deux modes : si les courbes se superposent, c'est le choix ; sinon, l'exécution.
//   node bancs/autopsie-passes.mjs [minutes=15] [graine=7] [mode=cerveau|ia] [sortie.jsonl]
import { writeFileSync } from 'node:fs';
import { chargerLeCorps, EV, GESTE } from '../corps.mjs';
import { creerCerveau } from '../cerveau.mjs';
const MIN = +(process.argv[2] ?? 15), GRAINE = +(process.argv[3] ?? 7), MODE = process.argv[4] ?? 'cerveau';
const SORTIE = process.argv[5] ?? null;
const corps = await chargerLeCorps();
corps.lancer({ graine: GRAINE, intentions: true });
const cerveau = MODE === 'cerveau' ? creerCerveau({ graine: GRAINE }) : null;

const dureeDePasse = (d) => Math.pow(Math.min(1, Math.max(0, 0.3 + d * 0.05)), 0.7) * 0.7;   // AI_GetPass
const auSegment = (px, py, ax, ay, bx, by) => {
  const ux = bx - ax, uy = by - ay, L2 = ux * ux + uy * uy || 1e-9;
  const s = Math.max(0, Math.min(1, ((px - ax) * ux + (py - ay) * uy) / L2));
  return { d: Math.hypot(px - (ax + s * ux), py - (ay + s * uy)), s };
};

const passes = [];
let enVol = null;                       // la passe en vol : jusqu'à la touche suivante d'un autre joueur
const derniereIntention = new Map(), intentionsEnVol = [], decisions = new Map();
let butsJournal = [0, 0], dernierToucheur = null;
const t0 = performance.now();

for (let pas = 0; pas < MIN * 6000; pas++) {
  if (pas % 10 === 0) {
    const e = corps.etat();
    const dec = cerveau && e.enJeu && !e.cpa ? cerveau.decider(e) : [];
    corps.fautes(dec.fautes);
    for (const i of dec) {
      corps.intention(i.id, i);
      // L'INSTANT DE DÉCISION : la première fois que le porteur reçoit l'ordre de passer à ce receveur
      const avant = derniereIntention.get(i.id);
      if (i.genre === 3 && !(avant?.genre === 3 && avant.cible === i.cible)) {
        const j = e.joueurs.find(k => k.id === i.id);
        // l'adversaire le plus proche du ballon et sa vitesse de rapprochement
        let adv = null, ad = Infinity;
        for (const k of e.joueurs) if (k.equipe !== j.equipe && k.actif) { const d = Math.hypot(k.x - e.ballon[0], k.y - e.ballon[1]); if (d < ad) { ad = d; adv = k; } }
        const ux = (e.ballon[0] - adv.x) / (ad || 1), uy = (e.ballon[1] - adv.y) / (ad || 1);
        decisions.set(i.id, { t: e.t / 1000, cible: i.cible, adv: ad, rapproche: adv.v[0] * ux + adv.v[1] * uy, trace: i.trace });
      }
      derniereIntention.set(i.id, i);
    }
    if (enVol && cerveau) intentionsEnVol.push(derniereIntention.get(enVol.cibleCorps)?.job ?? '—');
  }
  corps.avancer(1);
  const ap = corps.etat();
  const parId = new Map(ap.joueurs.map(j => [j.id, j]));
  const evs = corps.journal(); cerveau?.observer(evs);
  for (const ev of evs) {
    if (ev.type === EV.BUT) butsJournal[ev.equipe]++;
    if (ev.type === EV.PASSE) {
      const pa = parId.get(ev.joueur), ci = parId.get(ev.b);
      const [bx, by] = ap.ballon;
      const it = derniereIntention.get(ev.joueur);
      const r = { t: ev.t, equipe: ev.equipe, passeur: ev.joueur, geste: ev.a, cibleCorps: ev.b, force: ev.c, imposee: ev.d,
        voulue: it?.genre === 3 ? it.cible : null, vBallon: Math.hypot(ap.ballonV[0], ap.ballonV[1]), zBallon: ap.ballonV[2] };
      if (ci) {
        const d = Math.hypot(ci.x - bx, ci.y - by), T = dureeDePasse(d);
        const vx = ci.x + ci.v[0] * T, vy = ci.y + ci.v[1] * T;
        r.dist = Math.hypot(vx - bx, vy - by);
        r.vRecepteur = Math.hypot(ci.v[0], ci.v[1]);
        let deg = Infinity, qui = null, pr = Infinity;
        for (const j of ap.joueurs) {
          if (j.equipe === ev.equipe || !j.actif) continue;
          const s = auSegment(j.x, j.y, bx, by, vx, vy);
          if (s.d < deg) { deg = s.d; qui = j.id; }
          pr = Math.min(pr, Math.hypot(j.x - vx, j.y - vy));
        }
        r.degagement = deg; r.pressionRecepteur = pr; r.leBouchon = qui;
        r.pressionPasseur = Math.min(...ap.joueurs.filter(j => j.equipe !== ev.equipe && j.actif).map(j => Math.hypot(j.x - pa.x, j.y - pa.y)));
        r.distMinCibleBallon = Math.hypot(ci.x - bx, ci.y - by);
      }
      const dec = decisions.get(ev.joueur);
      if (dec && r.voulue != null && dec.cible === r.voulue) {
        r.latence = ev.t / 1000 - dec.t; r.advDecision = dec.adv; r.rapprocheDecision = dec.rapproche;
        r.tenueDecision = dec.trace?.tenue; r.porteDecision = dec.trace?.porte; r.calmeDecision = dec.trace?.auCalme; r.arbAge = dec.trace?.arbAge;
      }
      decisions.delete(ev.joueur);
      enVol = r; intentionsEnVol.length = 0;
      passes.push(r);
    } else if (ev.type === EV.TOUCHE) {
      dernierToucheur = ev.equipe;
      if (enVol && ev.joueur !== enVol.passeur) {
        enVol.issue = ev.joueur === enVol.cibleCorps ? 'cible' : ev.equipe === enVol.equipe ? 'coequipier' : 'adverse';
        enVol.vol = (ev.t - enVol.t) / 1000;
        enVol.parQui = ev.joueur; enVol.gesteReception = ev.b;
        if (enVol.issue === 'adverse') enVol.interceptionAuBouchon = ev.joueur === enVol.leBouchon;
        if (cerveau) enVol.intentionsDuReceveur = [...new Set(intentionsEnVol)];
        enVol = null;
      }
    }
  }
  if (enVol) {
    const ci = parId.get(enVol.cibleCorps);
    if (ci) enVol.distMinCibleBallon = Math.min(enVol.distMinCibleBallon ?? Infinity, Math.hypot(ci.x - ap.ballon[0], ci.y - ap.ballon[1]));
    if (!ap.enJeu) { enVol.issue = 'sortie'; enVol.vol = (ap.t - enVol.t) / 1000; enVol = null; }
  }
}
const fin = corps.etat();
const empreinte = fin.joueurs.reduce((h, j) => ((h * 31 + Math.round(j.x * 1000)) * 31 + Math.round(j.y * 1000)) | 0, 0);
if (SORTIE) writeFileSync(SORTIE, passes.map(p => JSON.stringify({ mode: MODE, graine: GRAINE, ...p })).join('\n') + '\n');

// ── LE RÉSUMÉ ────────────────────────────────────────────────────────────────────────────────────────────────────────────
const jugees = passes.filter(p => p.issue);
const pc = (a, b) => (b ? (100 * a / b).toFixed(0) + ' %' : '—');
const ok = (p) => p.issue === 'cible' || p.issue === 'coequipier';
const q = (a, k) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(k * (s.length - 1))].toFixed(1) : '—'; };
console.log(`AUTOPSIE DES PASSES — ${MODE === 'cerveau' ? 'NOTRE CERVEAU' : 'LEUR IA'}, ${MIN} min, graine ${GRAINE} (${((performance.now() - t0) / 1000).toFixed(0)} s) · score ${fin.score.join('-')} (journal ${butsJournal.join('-')}) · empreinte finale ${empreinte}`);
console.log(`  ${passes.length} passes, ${jugees.length} jugées : réussies ${pc(jugees.filter(ok).length, jugees.length)} (au receveur visé ${pc(jugees.filter(p => p.issue === 'cible').length, jugees.length)}) · adverse ${pc(jugees.filter(p => p.issue === 'adverse').length, jugees.length)} · sortie ${pc(jugees.filter(p => p.issue === 'sortie').length, jugees.length)}`);
const tranches = [[0, 1], [1, 2], [2, 3.5], [3.5, 6], [6, Infinity]];
console.log('  réussite par DÉGAGEMENT de la ligne (m) : ' + tranches.map(([a, b]) => { const s = jugees.filter(p => p.degagement >= a && p.degagement < b); return `${a}-${b === Infinity ? '∞' : b} : ${s.length} (${pc(s.filter(ok).length, s.length)})`; }).join(' · '));
console.log(`  dégagement : p25 ${q(jugees.map(p => p.degagement), 0.25)} · médiane ${q(jugees.map(p => p.degagement), 0.5)} · p75 ${q(jugees.map(p => p.degagement), 0.75)} m · pression sur le receveur médiane ${q(jugees.map(p => p.pressionRecepteur), 0.5)} m · sur le passeur ${q(jugees.map(p => p.pressionPasseur), 0.5)} m`);
const dist = [[0, 15], [15, 30], [30, Infinity]];
console.log('  par distance : ' + dist.map(([a, b]) => { const s = jugees.filter(p => p.dist >= a && p.dist < b); return `${a}-${b === Infinity ? '∞' : b} m : ${s.length} (${pc(s.filter(ok).length, s.length)}), ballon ${q(s.map(p => p.vBallon), 0.5)} m/s, vol ${q(s.map(p => p.vol), 0.5)} s, dégagement ${q(s.map(p => p.degagement), 0.5)} m`; }).join(' · '));
const typ = { 4: 'courte', 5: 'longue', 6: 'haute' };
console.log('  par geste : ' + [4, 5, 6].map(g => { const s = jugees.filter(p => p.geste === g); return `${typ[g]} ${s.length} (${pc(s.filter(ok).length, s.length)}, dist. ${q(s.map(p => p.dist), 0.5)} m)`; }).join(' · '));
const perdues = jugees.filter(p => p.issue === 'adverse');
console.log(`  perdues : prises par « le bouchon » (l'adversaire le plus proche de la ligne) ${pc(perdues.filter(p => p.interceptionAuBouchon).length, perdues.length)} · le receveur visé s'est approché du ballon à ${q(perdues.map(p => p.distMinCibleBallon), 0.5)} m (médiane ; réussies ${q(jugees.filter(ok).map(p => p.distMinCibleBallon), 0.5)} m)`);
if (cerveau) {
  const voulues = passes.filter(p => p.voulue != null);
  console.log(`  le corps vise le receveur voulu par le cerveau : ${pc(voulues.filter(p => p.voulue === p.cibleCorps).length, voulues.length)} (${voulues.length} passes voulues sur ${passes.length})`);
  const dd = jugees.filter(p => p.latence != null);
  console.log(`  DÉCISION → FRAPPE (${dd.length} passes) : délai p25 ${q(dd.map(p => p.latence), 0.25)} · médiane ${q(dd.map(p => p.latence), 0.5)} · p75 ${q(dd.map(p => p.latence), 0.75)} s · adversaire au ballon à la décision : médiane ${q(dd.map(p => p.advDecision), 0.5)} m (il se rapproche à ${q(dd.map(p => p.rapprocheDecision), 0.5)} m/s) → à la frappe ${q(dd.map(p => p.pressionPasseur), 0.5)} m`);
  console.log(`  à la décision : au calme ${pc(dd.filter(p => p.calmeDecision).length, dd.length)} · tenue médiane ${q(dd.map(p => p.tenueDecision), 0.5)} s · porte médiane ${q(dd.map(p => p.porteDecision), 0.5)} s · âge de l'arbitrage médian ${q(dd.map(p => p.arbAge), 0.5)} s`);
  for (const [a, b] of [[0, 1.5], [1.5, 3], [3, 99]]) { const s = dd.filter(p => p.advDecision >= a && p.advDecision < b); console.log(`    adversaire à ${a}-${b} m à la décision : ${s.length} passes, réussite ${pc(s.filter(ok).length, s.length)}, délai médian ${q(s.map(p => p.latence), 0.5)} s, à la frappe ${q(s.map(p => p.pressionPasseur), 0.5)} m`); }
  const genres = {}; for (const p of jugees) for (const g of p.intentionsDuReceveur ?? []) genres[g] = (genres[g] ?? 0) + 1;
  console.log(`  métier du receveur pendant le vol (passes jugées, le cerveau) : ${JSON.stringify(genres)}`);
}
