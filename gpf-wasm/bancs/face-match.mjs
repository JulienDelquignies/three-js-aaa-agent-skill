// face-match.mjs — LE FACE-À-FACE EN MATCH : combien, combien de feintes, de morsures, de fentes, quelle issue, le corps joue-t-il les gestes,
// et LA SUITE — 2 s après la fin, le ballon est-il toujours à l'équipe du porteur, le défenseur est-il battu (derrière le ballon) ?
//   node bancs/face-match.mjs [minutes=20] [graine=7]
// Notre cerveau des deux côtés, l'option face (face.mjs). La référence : Taarabt et Headrick (un face-à-face de 3,3 à 5 s, 2 à 4 feintes).
import { chargerLeCorps } from '../corps.mjs';
import { creerCerveau } from '../cerveau.mjs';
import { EV } from '../contrat.mjs';
const MIN = +(process.argv[2] ?? 20), GRAINE = +(process.argv[3] ?? 7), SUITE = 2;
const corps = await chargerLeCorps(); corps.lancer({ graine: GRAINE, intentions: true });
const cerveau = creerCerveau({ graine: GRAINE, options: { face: true, ...(process.env.CERVEAU_OPTIONS ? JSON.parse(process.env.CERVEAU_OPTIONS) : {}) } });
const FIN = MIN * 60000, t0 = performance.now(); let mi = false, enFace = 0, ticks = 0;
let avant = null, derniereVue = null, dernierEq = null;
const suites = [], parIssue = {};
while (corps.etat().t < FIN) {
  const e = corps.etat(), t = e.t / 1000;
  if (!mi && e.t >= FIN / 2) { corps.miTemps(); mi = true; }
  if (e.enJeu && !e.cpa) { const d = cerveau.decider(e); for (const i of d) corps.intention(i.id, i); corps.fautes(d.fautes); ticks++; if (cerveau.face) enFace++; }
  // la fin d'un face-à-face, puis la suite à 2 s ; son issue arrive avec cerveau.faceDerniere (un ballon disputé se juge à la touche suivante)
  const F = cerveau.face;
  if (avant && !F) {
    const c = e.joueurs.find((j) => j.id === avant.porteur);
    suites.push({ issue: null, fin: t, eq: c.equipe, q: avant.defenseur, juge: t + SUITE, duree: t - avant.depuis, feintes: avant.feintes });
  }
  avant = F;
  const D = cerveau.faceDerniere;
  if (D && D !== derniereVue) { derniereVue = D; const s = suites.find((x) => x.issue == null && Math.abs(x.fin - D.t) < 0.15); if (s) s.issue = D.issue; }
  for (const s of suites) if (!s.fait && t >= s.juge) {
    s.fait = true; s.issue ??= '?';
    const q = e.joueurs.find((j) => j.id === s.q), sens = s.eq === 0 ? 1 : -1;   // l'équipe 0 attaque +x
    s.garde = dernierEq === s.eq; s.battu = s.garde && (q.x - e.ballon[0]) * sens < -0.5;
    const P = parIssue[s.issue] ??= { n: 0, garde: 0, battu: 0, duree: 0, feintes: 0 };
    P.n++; P.garde += s.garde; P.battu += s.battu; P.duree += s.duree; P.feintes += s.feintes;
  }
  corps.avancer(10); const j = corps.journal(); cerveau.observer(j);
  for (const ev of j) if (ev.type === EV.TOUCHE) dernierEq = ev.equipe;
}
const S = cerveau.stats().face, k = 90 / MIN, fin = corps.etat();
console.log(`FACE-À-FACE — ${MIN} min, graine ${GRAINE} (${((performance.now() - t0) / 1000).toFixed(0)} s) · score ${fin.score.join('-')}`);
console.log(`  entrées ${S.entrees} (par 90 min ${(S.entrees * k).toFixed(1)}) · refus à l'envie ${S.refus} · durée moyenne ${(S.duree / Math.max(1, S.entrees)).toFixed(2)} s (réel 3,3-5) · ${(100 * enFace / Math.max(1, ticks)).toFixed(1)} % du jeu`);
console.log(`  feintes ${S.feintes} (${(S.feintes / Math.max(1, S.entrees)).toFixed(1)} par face-à-face ; réel 2-4) · morsures ${S.morsures} · fentes ${S.fentes} (lues ${S.lues})`);
console.log(`  gestes demandés ${S.demandes}, joués ${S.joues} (${(100 * S.joues / Math.max(1, S.demandes)).toFixed(0)} %) : ${Object.entries(S.parGeste).map(([n, g]) => `${n} ${g.joues}/${g.demandes}`).join(' · ')}`);
const tous = Object.values(parIssue).reduce((a, P) => ({ n: a.n + P.n, garde: a.garde + P.garde, battu: a.battu + P.battu }), { n: 0, garde: 0, battu: 0 });
console.log(`  LA SUITE à ${SUITE} s : ballon gardé ${tous.garde}/${tous.n}, défenseur battu ${tous.battu}/${tous.n}`);
for (const [issue, P] of Object.entries(parIssue).sort((a, b) => b[1].n - a[1].n))
  console.log(`    ${issue.padEnd(22)} ${String(P.n).padStart(3)} · ${(P.duree / P.n).toFixed(1)} s, ${(P.feintes / P.n).toFixed(1)} feintes · gardé ${P.garde}, battu ${P.battu}`);
