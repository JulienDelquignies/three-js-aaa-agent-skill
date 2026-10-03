// gestes-match.mjs — QUI DRIBBLE, COMMENT, OÙ : les gestes en course que le cerveau décide en match (cerveau.mjs, gesteDuCerveau — ses
// fenêtres, ses attributs), par joueur (son poste, son flair, sa nature de dribbleur), par geste, par tiers du terrain.
//   node bancs/gestes-match.mjs [minutes=20] [graine=7]        (CERVEAU_OPTIONS='{json}' : les options du cerveau, A/B)
// La référence (retour du 3 octobre) : le central ne dribble presque jamais ; le technicien (Olmo) varie ses gestes partout ; les
// anomalies (Taarabt, Ben Arfa, Saint-Maximin) en font beaucoup plus que les autres.
import { chargerLeCorps } from '../corps.mjs';
import { creerCerveau } from '../cerveau.mjs';
const MIN = +(process.argv[2] ?? 20), GRAINE = +(process.argv[3] ?? 7);
const corps = await chargerLeCorps(); corps.lancer({ graine: GRAINE, intentions: true });
const cerveau = creerCerveau({ graine: GRAINE, options: { ...(process.env.CERVEAU_OPTIONS ? JSON.parse(process.env.CERVEAU_OPTIONS) : {}) } });
const FIN = MIN * 60000, t0 = performance.now(); let mi = false;
const conduite = new Map();   // id → ticks en possession (pour la fréquence par minute de ballon)
while (corps.etat().t < FIN) {
  const e = corps.etat();
  if (!mi && e.t >= FIN / 2) { corps.miTemps(); mi = true; }
  if (e.enJeu && !e.cpa) {
    const d = cerveau.decider(e); for (const i of d) corps.intention(i.id, i); corps.fautes(d.fautes);
    const { equipe, joueur } = e.possession;
    if (equipe >= 0 && joueur >= 0) { const p = e.joueurs.filter((j) => j.equipe === equipe)[joueur]; conduite.set(p.id, (conduite.get(p.id) ?? 0) + 1); }
  }
  corps.avancer(10); cerveau.observer(corps.journal());
}
const S = cerveau.stats(), G = S.gestes, k = 90 / MIN, fin = corps.etat();
const total = Object.values(G.decides).reduce((a, b) => a + b, 0);
console.log(`GESTES EN COURSE (décidés par le cerveau) — ${MIN} min, graine ${GRAINE} (${((performance.now() - t0) / 1000).toFixed(0)} s) · score ${fin.score.join('-')} · effectifs ${cerveau.effectifs ? 'notés' : 'aucun'}`);
console.log(`  ${total} décidés (par 90 min ${(total * k).toFixed(0)}) : ${Object.entries(G.decides).sort((a, b) => b[1] - a[1]).map(([n, v]) => `${n} ${v}`).join(' · ')}`);
// par joueur : poste, flair, nature, ballon tenu (s), gestes
const lignes = [];
for (const j of fin.joueurs) {
  const P = cerveau.profil(j.id); if (!P || P.poste === 'GK') continue;
  const g = G.parJoueur[j.id] ?? {}, n = Object.values(g).reduce((a, b) => a + b, 0), tenu = (conduite.get(j.id) ?? 0) * 0.1;
  lignes.push({ P, n, tenu, g });
}
lignes.sort((a, b) => b.P.nature - a.P.nature);
for (const { P, n, tenu, g } of lignes)
  console.log(`  ${String(P.equipe)}/${P.poste.padEnd(6)}${P.archetype ? ` [${P.archetype}]` : ''} flair ${P.flair.toFixed(2)} nature ${P.nature.toFixed(1).padStart(4)} · ballon ${tenu.toFixed(0).padStart(3)} s · ${String(n).padStart(2)} gestes${tenu > 0 ? ` (${(60 * n / tenu).toFixed(1)}/min de ballon)` : ''}${n ? ' : ' + Object.entries(g).map(([e, v]) => `${e} ${v}`).join(', ') : ''}`);
// par famille de poste
const fam = (p) => p.startsWith('D(C') ? 'centraux' : p.startsWith('D(') ? 'latéraux' : p.startsWith('M(') ? 'milieux' : p.startsWith('AM') ? 'ailiers/10' : p.startsWith('ST') ? 'avant-centre' : 'autre';
const F = {}; for (const l of lignes) { const f = F[fam(l.P.poste)] ??= { n: 0, tenu: 0, j: 0 }; f.n += l.n; f.tenu += l.tenu; f.j++; }
console.log(`  par poste : ${Object.entries(F).map(([f, v]) => `${f} ${v.n} (${v.tenu > 0 ? (60 * v.n / v.tenu).toFixed(1) : '-'}/min de ballon)`).join(' · ')}`);
// LE CORPS LES JOUE-T-IL (gestes-course.mjs) : demandés (une animation existe), partis, touchés, la suite à 1,5 s (ballon gardé)
const C = S.course;
if (C) {
  console.log(`  joués par le corps : ${C.demandes} demandés, ${C.partis} partis, ${C.touches} touches · ballon gardé à +1,5 s ${C.gardes}/${C.juges} · issues ${Object.entries(C.issues).map(([n, v]) => `${n} ${v}`).join(', ')}`);
  console.log(`    au contact (le noyau du cerveau) : ${C.contacts} jugés, ${G.franchis ?? 0} franchis — ${C.morsures} morsures`);
  console.log(`    par geste : ${Object.entries(C.parGeste).map(([n, g]) => `${n} ${g.partis}/${g.demandes} (gardé ${g.gardes}/${g.juges})`).join(' · ')}`);
  console.log(`    pas encore dans le corps : ${Object.entries(C.sansAnimation).map(([n, v]) => `${n} ${v}`).join(' · ') || 'rien'}`);
}
console.log(`  refus nommés du cerveau : ${Object.entries(S.refus).filter(([n]) => /crochet|double|rateau|passement|pont|roulette/.test(n)).map(([n, v]) => `${n} ${v}`).join(' · ') || 'aucun'}`);
