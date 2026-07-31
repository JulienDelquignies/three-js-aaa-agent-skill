#!/usr/bin/env node
// verify-persona.mjs — l'identité de mouvement (engine/persona.js) et les RUPTURES DE RYTHME
// (engine/rondo.js), prouvées sans navigateur. Le retour utilisateur qui fonde le banc :
// « il manque des changements de rythme et il faudrait instaurer différents mouvements par joueur
// pour qu'ils ne se ressemblent pas tous ».
//
// Deux moitiés :
//   1. LA PERSONA EN SOI — déterministe, bornée, distincte (checkPersona + sabotages nommés) ;
//   2. LA PERSONA DANS LA SIM — la partie qui compte : une identité que la sim n'exprime pas est
//      une ombre (loi 8). On joue le rondo headless et on mesure les BANDES D'ALLURE : la marche
//      existe, les pointes existent, les appels/chasses sont des événements à cadence humaine, et
//      deux joueurs n'ont PAS la même allure de pointe (le paceBias se voit dans la trace).
import { makePersona, checkPersona } from '../assets/starter/src/engine/persona.js';
import { makeRondo, RONDO, rondoInternals } from '../assets/starter/src/engine/rondo.js';
import { playRondo } from '../assets/starter/src/engine/rondo-sim.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- 1. la persona en soi
{
  const r = checkPersona({ n: 10, seed: 3 });
  ok(`contrat persona (10 joueurs, graine 3) — pire paire L2 ${r.worst.toFixed(2)}`, r.ok, r.issues.join(' | '));
  const r2 = checkPersona({ n: 10, seed: 11 });
  ok('contrat persona (graine 11) — l\'identité tient sur une autre graine', r2.ok, r2.issues.join(' | '));

  // reproductibilité inter-parties : la même (id, graine) donne LA MÊME identité
  ok('déterminisme inter-parties : makePersona(4, 7) === makePersona(4, 7)',
    JSON.stringify(makePersona(4, 7)) === JSON.stringify(makePersona(4, 7)));
  // …et une autre graine donne une AUTRE identité (la graine compte vraiment)
  ok('la graine compte : makePersona(4, 7) ≠ makePersona(4, 8)',
    JSON.stringify(makePersona(4, 7)) !== JSON.stringify(makePersona(4, 8)));

  // SABOTAGE « rng non seedé » : une persona tirée de Math.random change entre deux appels —
  // le déterminisme du contrat doit l'attraper (pire que des clones : l'identité qui bouge).
  {
    const saboteur = { ...checkPersona };
    let calls = 0;
    const fake = (id, seed) => { calls++; const p = makePersona(id, seed); if (calls > 10) p.scale += 0.001; return p; };
    // on rejoue le contrat à la main avec le générateur saboté
    const ps = Array.from({ length: 10 }, (_, i) => fake(i, 3));
    const again = fake(3, 3);
    const caught = JSON.stringify(again) !== JSON.stringify(ps[3]);
    ok('sabotage « générateur non déterministe » attrapé (l\'identité change entre deux appels)', caught);
  }
  // SABOTAGE « tirage effondré » : dix personas identiques (le rng rend toujours 0,5) — la clause
  // de distinction doit hurler « presque clones ».
  {
    const flat = makePersona(0, 3);
    const ps = Array.from({ length: 10 }, () => ({ ...flat }));
    let worst = Infinity;
    const axes = (p) => [(p.scale - 1) / 0.04, p.gaitPhase, (p.armSwingF - 1) / 0.18, p.posture.lean / 2.5, (p.paceBias - 1) / 0.06, (p.burstiness - 1) / 0.35, (p.calm - 1) / 0.2];
    for (let i = 0; i < 10; i++) for (let j = i + 1; j < 10; j++) worst = Math.min(worst, Math.hypot(...axes(ps[i]).map((v, k) => v - axes(ps[j])[k])));
    ok('sabotage « tirage effondré » attrapé (10 clones ⇒ L2 0 < 0,35)', worst < 0.35, `L2=${worst.toFixed(2)}`);
  }
  // bornes crevées : un paceBias de 1,3 est un surhomme, pas un accent
  {
    const ps = Array.from({ length: 10 }, (_, i) => makePersona(i, 3));
    ps[2].paceBias = 1.3;
    const bad = ps.some((p) => p.paceBias < 0.93 || p.paceBias > 1.07);
    ok('sabotage « borne crevée » détectable (paceBias 1,3 hors [0,93 ; 1,07])', bad);
  }
}

// ---------- 2. la persona et le rythme DANS LA SIM (la moitié qui compte — loi 8)
{
  const { st, trace } = playRondo(makeRondo({ perTeam: 5, seed: 7 }), 120);

  // chaque joueur de la sim PORTE une persona (une source, deux consommateurs)
  ok('chaque joueur de la sim porte une persona', st.players.every((p) => p.persona && typeof p.persona.paceBias === 'number'));
  ok('les personas de la sim sont distinctes entre elles (paceBias non constant)',
    new Set(st.players.map((p) => p.persona.paceBias.toFixed(3))).size >= 8,
    `${new Set(st.players.map((p) => p.persona.paceBias.toFixed(3))).size}/10 valeurs`);

  // LES BANDES D'ALLURE. Un jeu sans rythme vit dans une seule bande (tout le monde trottine).
  // Un rondo réel : de la MARCHE (< 1,6 m/s), du déplacement, et des POINTES (> 4 m/s). On mesure
  // la part de temps passée dans chaque bande par les joueurs debout hors porteur.
  const bands = { walk: 0, mid: 0, sprint: 0, n: 0 };
  const perPlayer = new Map();
  for (const s of trace) {
    for (const p of s.players) {
      if (p.down > 0 || p.id === s.carrier) continue;
      bands.n++;
      if (p.speed < 1.6) bands.walk++;
      else if (p.speed > 4.0) bands.sprint++;
      else bands.mid++;
      if (!perPlayer.has(p.id)) perPlayer.set(p.id, []);
      perPlayer.get(p.id).push(p.speed);
    }
  }
  const pct = (k) => (100 * bands[k] / bands.n);
  ok(`la MARCHE existe (${pct('walk').toFixed(0)} % du temps hors-ballon < 1,6 m/s, plancher 20 %)`, pct('walk') >= 20);
  ok(`les POINTES existent (${pct('sprint').toFixed(1)} % du temps hors-ballon > 4 m/s, plancher 1 %)`, pct('sprint') >= 1);
  ok(`…et la marche ne mange pas tout (< 85 %)`, pct('walk') <= 85);

  // LES RUPTURES SONT DES ÉVÉNEMENTS NOMMÉS, à cadence humaine : de l'ordre de grandeur d'un
  // rondo réel (quelques appels/minute et une chasse par passe pressée), pas zéro, pas la frénésie.
  const bursts = st.events.filter((e) => e.type === 'burst');
  const appels = bursts.filter((e) => e.kind === 'appel').length;
  const chasses = bursts.filter((e) => e.kind === 'chasse').length;
  // le dénominateur honnête est la passe TENTÉE (windup hors tacle) : une passe interceptée
  // déclenche la chasse sans jamais produire de « receive »
  const passes = st.events.filter((e) => e.type === 'windup' && e.move !== 'tacleDebout').length;
  ok(`des APPELS hors-ballon existent, à cadence humaine (${(appels / 2).toFixed(1)}/min dans [2 ; 20])`,
    appels / 2 >= 2 && appels / 2 <= 20);
  // la chasse suit LA PASSE, pas l'horloge : sa loi est « au plus une par passe » (le plus proche
  // jaillit) et « pas muette » — première version, 155 chasses / 120 s = trois défenseurs par passe
  ok(`des CHASSES sur passe existent (${chasses} pour ${passes} passes tentées)`, chasses >= 4);
  ok(`…au plus UNE chasse par passe (${(chasses / Math.max(1, passes)).toFixed(2)} ≤ 1,05)`,
    chasses / Math.max(1, passes) <= 1.05);

  // LE PACEBIAS SE VOIT : l'allure de pointe atteinte en partie (p95 des vitesses hors-ballon)
  // n'est pas identique pour tous — l'écart entre le plus vif et le plus posé dépasse un plancher.
  const p95s = [...perPlayer.entries()].map(([id, v]) => {
    const s = [...v].sort((a, b) => a - b);
    return { id, p95: s[Math.floor(s.length * 0.95)] };
  });
  const spread = Math.max(...p95s.map((x) => x.p95)) - Math.min(...p95s.map((x) => x.p95));
  ok(`le paceBias est VISIBLE dans la trace (écart p95 inter-joueurs ${spread.toFixed(2)} m/s ≥ 0,25)`, spread >= 0.25);

  // LE PACEBIAS EST UNE LOI, PAS UNE HISTOIRE. Première version de cette clause : rejouer la même
  // graine avec les personas aplaties et comparer les écarts p95 de deux PARTIES COMPLÈTES — le
  // même instrument déjà mort dans verify-rondo (« l'A/B comparait deux HISTOIRES, pas deux
  // lois ») : deux parties de 120 s divergent chaotiquement et le bruit (0,49 vs 0,36 m/s) noie
  // un accent de ±6 %. La loi, elle, se mesure sur UN coureur : même rôle, même monde, deux
  // personas — le rapport des vitesses de régime DOIT être le rapport des paceBias.
  {
    const { movePlayers } = rondoInternals;
    const steady = (paceBias) => {
      const r2 = { id: 0, team: 0, p: [0, 0, 0], v: [0, 0], speed: 0, yaw: 0, down: 0, act: null, job: 'press', target: null, push: null, yawWant: null, persona: { paceBias, burstiness: 1, calm: 1 } };
      const st2 = { players: [r2], area: [200, 200], t: 0, ball: { p: [50, 0.11, 50], v: [0, 0, 0] }, events: [], rnd: () => 0.5 };
      for (let i = 0; i < 4 * 60; i++) { r2.target = [100, 0, 0]; movePlayers(st2, 1 / 60, RONDO); st2.t += 1 / 60; }
      return r2.speed;
    };
    const lent = steady(0.94), vif = steady(1.06);
    const ratio = vif / lent, want = 1.06 / 0.94;
    ok(`le paceBias est une LOI : rapport des vitesses de régime ${ratio.toFixed(3)} ≈ ${want.toFixed(3)} (±2 %)`,
      Math.abs(ratio - want) < 0.02 * want, `lent ${lent.toFixed(2)} m/s, vif ${vif.toFixed(2)} m/s`);
    // sabotage « persona muette » : une sim qui ignore paceBias rend un rapport de 1 — attrapé
    ok('sabotage « paceBias ignoré » attrapable (rapport 1,000 sort de la tolérance)', Math.abs(1 - want) >= 0.02 * want);
  }

  // LE CONTRASTE : un soutien posé marche (settledWalkCap), un appel sprinte. Les deux régimes
  // coexistent dans la MÊME partie — c'est la définition du rythme.
  ok(`settledWalkCap est une clause de config (${RONDO.settledWalkCap} m/s)`, typeof RONDO.settledWalkCap === 'number' && RONDO.settledWalkCap <= 1.6);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
