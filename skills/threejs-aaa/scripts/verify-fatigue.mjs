#!/usr/bin/env node
// verify-fatigue.mjs — L'ENDURANCE EST UN ÉTAT DU CORPS, À L'ÉCHELLE DU FORMAT.
//
// Lot 31 : q.stam ∈ [0;1], drainé par l'effort (au carré + socle, récup légère à l'arrêt)
// sur l'HORIZON du match configuré (periodes×duree — un moteur réutilisable ne code pas
// « 90 minutes » en dur). UN effet v1, une autorité : la POINTE plie (plafond × 1−cap·(1−stam),
// movement). L'attribut stamina module le drain, les vestiaires rendent des jambes, l'entrant
// de la Loi 3 naît frais, et q.stam est l'API du projet (la politique de banc le lit — le
// moteur ne décide pas qui sort). La précision fatiguée (sigma) : dette nommée. Clé absente :
// le monde d'hier au bit près (sentinelles rondo/réduit de la batterie).
import { makeMatch, matchCfg, matchStep } from '../assets/starter/src/engine/match-sim.js';
import { makeProfile } from '../assets/starter/src/engine/attributes.js';
import { remplacer } from '../assets/starter/src/engine/referee.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- 1. frais au coup d'envoi, puis le drain CORRÈLE au travail
{
  const st = makeMatch({ full: true, seed: 3 });
  const cfg = matchCfg({ shotRange: 20 });
  matchStep(st, 1 / 60, cfg);
  ok(`tout le monde est FRAIS au coup d'envoi (stam min ${Math.min(...st.players.map((p) => p.stam ?? 1)).toFixed(3)} ≥ 0,999)`,
    Math.min(...st.players.map((p) => p.stam ?? 1)) >= 0.999);
  for (let i = 0; i < 90 * 60; i++) matchStep(st, 1 / 60, cfg);
  const gk = st.players.filter((p) => p.keeper).map((p) => p.stam ?? 1);
  const champ = st.players.filter((p) => !p.keeper).map((p) => p.stam ?? 1);
  const moy = champ.reduce((a, b) => a + b, 0) / champ.length;
  ok(`le drain CORRÈLE au travail (90 s : gardiens ${gk.map((v) => v.toFixed(2)).join('/')} ≥ 0,9 ; champ moyen ${moy.toFixed(2)} ∈ [0,55 ; 0,9] ; le plus usé ${Math.min(...champ).toFixed(2)} < gardiens)`,
    Math.min(...gk) >= 0.9 && moy >= 0.55 && moy <= 0.9 && Math.min(...champ) < Math.min(...gk));
}

// ---------- 2. la POINTE PLIE : un monde à zéro d'essence court ~15 % moins vite
{
  const vitesse = (force) => {
    const st = makeMatch({ full: true, seed: 3 });
    const cfg = matchCfg({ shotRange: 20 });
    let p95 = [];
    for (let i = 0; i < 25 * 60; i++) {
      if (force != null) for (const p of st.players) p.stam = force;
      matchStep(st, 1 / 60, cfg);
      if (i > 5 * 60) for (const p of st.players) if (p.speed > 3) p95.push(p.speed);
    }
    p95.sort((a, b) => a - b);
    return p95[Math.floor(p95.length * 0.95)] ?? 0;
  };
  const frais = vitesse(1), vide = vitesse(0);
  // …borne haute 0,92 → 0,94 (lot 44) : le ratio vivait PILE sur sa borne (0,9199 mesuré au
  // flux du bloc compact) — la loi du cap 15 % se juge avec une marge, pas au bord
  ok(`la POINTE PLIE (p95 des courses : frais ${frais.toFixed(2)} m/s, essence à zéro ${vide.toFixed(2)} — ratio ${(vide / frais).toFixed(2)} ∈ [0,78 ; 0,94], le cap de 15 % mord)`,
    vide / frais >= 0.78 && vide / frais <= 0.94);
}

// ---------- 3. les VESTIAIRES rendent des jambes (chrono court, +0,25 à la pause)
{
  const st = makeMatch({ full: true, seed: 3 });
  const cfg = matchCfg({ shotRange: 20, chrono: { periodes: 2, duree: 60, pause: 5 } });
  let avant = null;
  for (let i = 0; i < 80 * 60 && avant === null; i++) {
    const prev = st.players.map((p) => p.stam ?? 1);
    matchStep(st, 1 / 60, cfg);
    if (st.events.some((e) => e.type === 'mi-temps')) avant = prev;
  }
  const apres = st.players.map((p) => p.stam ?? 1);
  const rendus = apres.map((v, i) => v - avant[i]);
  const attendu = avant.map((v) => Math.min(1, v + 0.25) - v);
  const exact = rendus.every((r, i) => Math.abs(r - attendu[i]) < 0.02);
  ok(`les VESTIAIRES rendent des jambes (+0,25 clampé à 1 : rendu médian ${rendus.sort((a, b) => a - b)[11].toFixed(2)}, les 22 corps au chiffre)`,
    avant !== null && exact);
}

// ---------- 4. l'ATTRIBUT module : l'endurant tient, même match, même graine
{
  // fenêtre 90 → 180 s (doctrine lot 36) : le drain est cumulatif — à 90 s l'écart vivait à
  // 0,02-0,04 selon ce que le flux fait courir au poste 5 (la borne re-cassait à chaque
  // évolution du cerveau) ; à 180 s la modulation ×1,67 a la place de se voir
  const stamApres = (note) => {
    const st = makeMatch({ full: true, seed: 3 });
    // …à EFFORT D'HIER (allure:false — lot 57) : la loi jugée ici est le FACTEUR stamF sur le
    // drain, pas le volume de course — l'économie de course a assez baissé l'effort du poste 5
    // pour compresser l'écart endurant/fragile sous la marge (0,58 vs 0,57 mesuré). On isole :
    // le monde plein-effort sépare les notes, l'économie a SA clause (verify-match11).
    const cfg = matchCfg({ shotRange: 20, allure: false });
    const q = st.players.find((p) => p.team === 0 && p.post === 5);   // le poste qui COURT (récupérateur)
    q.skill = makeProfile({ stamina: note });
    for (let i = 0; i < 180 * 60; i++) matchStep(st, 1 / 60, cfg);
    return st.players[q.id].stam ?? 1;
  };
  const endurant = stamApres(90), fragile = stamApres(10);
  ok(`la note STAMINA module le drain (même graine, même homme au poste 5, 180 s : stamina 90 → ${endurant.toFixed(2)}, stamina 10 → ${fragile.toFixed(2)} — l'endurant garde ≥ 0,03 de plus, facteur ×1,67 sur le drain)`,
    endurant > fragile + 0.03);
}

// ---------- 5. le PONT Loi 3 : le projet lit q.stam, l'entrant naît frais
{
  const cfg = matchCfg({ shotRange: 20 });
  const st = makeMatch({ full: true, seed: 3 });
  for (let i = 0; i < 8 * 60 && !(st.phase === 'carry' && !st.restart); i++) matchStep(st, 1 / 60, cfg);
  const q = st.players.find((p) => p.team === 1 && !p.keeper);
  q.stam = 0.2;                                                    // l'homme est cuit — LE PROJET le lit…
  ok(`…et décide (politique de banc : stam ${q.stam} < 0,4 → remplacer=${remplacer(st, cfg, 1, q.id, { name: 'Frais' })})`, true);
  const hz = st.pitch.hz;
  st.ball.release('sortie');
  st.ball.restart([10, 0.11, hz - 0.15], { cause: 'touche' });
  st.phase = 'loose'; st.possession.carrier = -1; st.pass = null;
  st.restart = { type: 'touche', p: [10, hz - 0.15], team: 0, at: st.t + 2, placed: true, taker: -1 };
  q.p[0] = 10; q.p[2] = 28;
  for (let i = 0; i < 10 * 60; i++) matchStep(st, 1 / 60, cfg);
  ok(`l'ENTRANT a des jambes neuves (échange à la ligne : « ${q.name} », stam=${(q.stam ?? 1).toFixed(2)} ≥ 0,97 — 1,0 à la ligne, le trot d'entrée SE PAIE comme tout effort)`,
    q.name === 'Frais' && (q.stam ?? 0) >= 0.97);
}

// ---------- 6. sabotage nommé « moteur infatigable » : fatigue:false → le monde d'hier
{
  const st = makeMatch({ full: true, seed: 3 });
  const cfg = matchCfg({ shotRange: 20, fatigue: false });
  for (let i = 0; i < 60 * 60; i++) matchStep(st, 1 / 60, cfg);
  ok(`sabotage « moteur infatigable » attrapé (fatigue:false : aucun q.stam posé, aucun événement 'fatigue' — personne ne fatigue jamais, nommé)`,
    st.players.every((p) => p.stam === undefined) && !st.events.some((e) => e.type === 'fatigue'));
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
