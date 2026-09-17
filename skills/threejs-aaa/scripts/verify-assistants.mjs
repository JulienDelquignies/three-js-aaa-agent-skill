// verify-assistants.mjs — LES GESTES DES ASSISTANTS (Animations_A_Faire § 5 ; motion-arbitre drapeauLeve / drapeauIncline(G) /
// drapeauHorizontal, referee.assistantsStep sous cfg.arbitreGestes, scène arbitre.js : la hampe dans la main suit le bras).
// Le hors-jeu = la hampe dressée TENUE tant que le drapeau est levé ; la touche de SA ligne = la hampe inclinée du côté que l'équipe
// attaque ; le remplacement = la hampe à l'horizontale à deux mains (l'assistant 1). Hier : la hampe basculait seule dans une main
// immobile (le drapeau du 187). arbitreGestes:null : l'hier au bit.
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { SHANON_PROFILE } from '../assets/starter/src/engine/motion-profile-shanon.js';
import { generateArbitre, checkArbitreGen, arbitrePortrait, ARBITRE_KINDS } from '../assets/starter/src/engine/motion-arbitre.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };
const P = SHANON_PROFILE, cm = (m) => (100 * m).toFixed(0);

console.log('— (a) les quatre gestes du drapeau sous contrat —');
for (const k of ['drapeauLeve', 'drapeauIncline', 'drapeauInclineG', 'drapeauHorizontal']) {
  const spec = generateArbitre(k, P), r = checkArbitreGen(spec, P, k), s = arbitrePortrait(spec, P).pick((spec.contact + ARBITRE_KINDS[k].hold) / 2);
  ok(`${k} (${spec.keys.length} clés, ${spec.duration} s) : main droite à (${s.rh.map((x) => x.toFixed(2)).join(', ')}) — tête ${s.head[1].toFixed(2)} m, épaule ${((s.ls[1] + s.rs[1]) / 2).toFixed(2)}`, r.ok, r.issues.join(' ; '));
}
{ const spec = generateArbitre('drapeauLeve', P); const K0 = { ...ARBITRE_KINDS.drapeauLeve }; Object.assign(ARBITRE_KINDS.drapeauLeve, { elev: 100 }); const s = generateArbitre('drapeauLeve', P); const r = checkArbitreGen(s, P, 'drapeauLeve'); Object.assign(ARBITRE_KINDS.drapeauLeve, K0);
  ok(`sabotage « la hampe à l'horizontale » attrapé (elev 100 : ${r.issues[0]?.slice(0, 70) ?? 'rien'})`, !r.ok && spec.keys.length > 0); }

// LA FIXTURE : un match plein ; on pousse dans le journal un hors-jeu, une touche de chaque côté, un remplacement, et on lit le geste de l'assistant
const joue = (over, f) => { const st = makeMatch({ full: true, seed: 3 }); const cfg = matchCfg({ ceremonie: null, ramasseurs: null, boiterie: null, entrant: null, petitsGestes: null, passements: null, enchainement: null, orientationPasse: null, verticalite: null, decalage: null, receveurOuvert: null, ...over }); for (let i = 0; i < 60; i++) matchStep(st, 1 / 60, cfg); return f(st, cfg); };
const step = (st, cfg, n) => { for (let i = 0; i < n; i++) matchStep(st, 1 / 60, cfg); };
console.log('\n— (b) la sim pose les gestes sur l\'assistant qu\'il faut —');
joue({}, (st, cfg) => {
  const A = st.players.find((q) => q.team === 0 && !q.keeper);
  st.events.push({ t: +st.t.toFixed(2), type: 'hors-jeu', by: A.id, at: [12, 0, 3], p: [12, 3], tente: true }); step(st, cfg, 3);
  const g0 = st.assistants?.[0]?.geste;
  ok(`LE HORS-JEU (équipe 0 → l'assistant 0) : geste ${g0?.kind ?? '—'}, tenu ${g0?.tenu ? 'oui' : 'non'}, la hampe d'hier levée aussi (drapeau ${st.assistants?.[0]?.drapeau ? 'oui' : 'non'})`, g0?.kind === 'drapeauLeve' && g0.tenu === true && !!st.assistants[0].drapeau);
  step(st, cfg, 60 * 1.2); const g1 = st.assistants[0].geste;   // sans remise posée, la hampe d'hier redescend à 1,5 s : on lit à 1,2
  ok(`…TENU tant que le drapeau est levé (1,2 s après : geste ${g1?.kind ?? '—'}, until ${g1 ? (g1.until - st.t).toFixed(2) : '—'} s devant)`, g1?.kind === 'drapeauLeve' && g1.until > st.t);
  st.assistants[0].drapeau = null; step(st, cfg, 2);
  ok(`…et rendu quand le drapeau descend (geste ${st.assistants[0].geste?.kind ?? 'aucun'})`, !st.assistants[0].geste);
  const sgA = Math.sign(st.pitch.attackGoal(0).x || 1);
  st.events.push({ t: +st.t.toFixed(2), type: 'sortie', out: 'touche', team: 0, p: [10, +(st.pitch.hz).toFixed(1)] }); step(st, cfg, 2);
  const gT = st.assistants[0].geste, attendu0 = sgA < 0 ? 'drapeauIncline' : 'drapeauInclineG';
  ok(`LA TOUCHE côté z > 0 (l'assistant 0, face au terrain) pour l'équipe 0 qui attaque vers x ${sgA > 0 ? '+' : '−'} : ${gT?.kind ?? '—'} (attendu ${attendu0} — vers sa ${sgA < 0 ? 'droite' : 'gauche'})`, gT?.kind === attendu0);
  st.events.push({ t: +st.t.toFixed(2), type: 'sortie', out: 'touche', team: 1, p: [-10, -(st.pitch.hz)] }); step(st, cfg, 2);
  const gT1 = st.assistants[1].geste, sgB = Math.sign(st.pitch.attackGoal(1).x || 1), attendu1 = sgB > 0 ? 'drapeauIncline' : 'drapeauInclineG';
  ok(`LA TOUCHE côté z < 0 (l'assistant 1) pour l'équipe 1 qui attaque vers x ${sgB > 0 ? '+' : '−'} : ${gT1?.kind ?? '—'} (attendu ${attendu1})`, gT1?.kind === attendu1);
  step(st, cfg, 60 * 2.2);
  ok(`…les gestes de touche expirent (2,2 s après : ${st.assistants[0].geste?.kind ?? 'aucun'} / ${st.assistants[1].geste?.kind ?? 'aucun'})`, !st.assistants[0].geste && !st.assistants[1].geste);
  st.events.push({ t: +st.t.toFixed(2), type: 'remplacement', team: 1, id: 12, minute: 1 }); step(st, cfg, 2);
  ok(`LE REMPLACEMENT : l'assistant 1 (côté banc) ${st.assistants[1].geste?.kind ?? '—'} pendant ${st.assistants[1].geste ? (st.assistants[1].geste.until - st.t).toFixed(1) : '—'} s`, st.assistants[1].geste?.kind === 'drapeauHorizontal');
});
console.log('\n— (c) la clé absente rend l\'hier —');
joue({ arbitreGestes: null }, (st, cfg) => {
  const A = st.players.find((q) => q.team === 0 && !q.keeper);
  st.events.push({ t: +st.t.toFixed(2), type: 'hors-jeu', by: A.id, at: [12, 0, 3], p: [12, 3], tente: true }); st.events.push({ t: +st.t.toFixed(2), type: 'remplacement', team: 1, id: 12, minute: 1 }); step(st, cfg, 3);
  ok(`arbitreGestes:null — la hampe d'hier se lève (drapeau ${st.assistants?.[0]?.drapeau ? 'oui' : 'non'}) mais aucun geste (${st.assistants?.[0]?.geste?.kind ?? 'aucun'} / ${st.assistants?.[1]?.geste?.kind ?? 'aucun'})`, !!st.assistants?.[0]?.drapeau && !st.assistants[0].geste && !st.assistants[1].geste);
});
console.log(`\nassistants : ${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
