#!/usr/bin/env node
// verify-match.mjs — LE MATCH RÉDUIT (pitch.js + keeper.js + match-sim.js), prouvé sans navigateur.
// Le pas d'« agrandir le terrain » : deux buts, des gardiens, des tirs, des remises EN RÈGLE, un
// score — par le MÊME game-loop que le rondo (match-sim est une configuration, pas un fork).
//
// Quatre moitiés : le TERRAIN (géométrie des sorties, Lois 9/15/16/17 au point de franchissement
// interpolé), le GARDIEN (position qui coupe l'angle, plongeon sans oracle), le MATCH JOUÉ
// (contrat complet sur graines, bandes de réalisme : conversion, arrêts, remises reprises), et
// les SABOTAGES (match sans tir attrapé, score trafiqué attrapé, remise volée attrapée).
import { makePitch, outRule, checkPitch, FULL, REDUIT } from '../assets/starter/src/engine/pitch.js';
import { KEEPER, keeperSpot, keeperDecide, shotCross, checkKeeper } from '../assets/starter/src/engine/keeper.js';
import { makeMatch, matchCfg, playMatch, checkMatch, MATCH } from '../assets/starter/src/engine/match-sim.js';
import { touchDistance } from '../assets/starter/src/engine/dribble.js';

let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { (cond ? pass++ : fail++); console.log(`${cond ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`); };

// ---------- 1. le terrain
{
  const p = makePitch();
  const r = checkPitch(p);
  ok('terrain RÉDUIT au contrat (surfaces, buts, éventail de sorties)', r.ok, r.issues.join(' | '));
  const rf = checkPitch(makePitch(FULL));
  ok('terrain PLEIN FORMAT (105 × 68, Loi 1) au contrat — le 11c11 a déjà son sol', rf.ok, rf.issues.join(' | '));
  // sabotage : une surface plus profonde que la moitié — attrapé
  const bad = checkPitch(makePitch({ ...REDUIT, box: { depth: 30, width: 15 } }));
  ok('sabotage « surface plus profonde que la moitié » attrapé', !bad.ok);
  // le point de franchissement est INTERPOLÉ : un tir qui traverse le coin croise la ligne de BUT
  // d'abord — juger sur l'image d'arrivée aurait dit « touche »
  const g = outRule(p, [p.hx - 0.5, 0.1, p.hz - 0.5], [p.hx + 1.5, 0.1, p.hz + 0.4], 0);
  ok(`le franchissement en coin suit la PREMIÈRE ligne croisée (${g.type})`, g.type === 'sortie-de-but');
}

// ---------- 2. le gardien
{
  const p = makePitch();
  const r = checkKeeper(p);
  ok('gardien au contrat (ligne ballon-but, profondeur, réflexe, pas d\'aimant)', r.ok, r.issues.join(' | '));
  // symétrie : le même tir à gauche et à droite plonge des deux côtés
  const me = [p.ownGoal(0).x + 0.6, 0, 0];
  const L = keeperDecide(p, 0, me, [me[0] + 9, 0.11, 1.5], [-14, 1.5, -0.9], 0.3);
  const R = keeperDecide(p, 0, me, [me[0] + 9, 0.11, -1.5], [-14, 1.5, 0.9], 0.3);
  ok(`le plongeon est symétrique (gauche ${L.mode}/${L.side ?? '-'}, droite ${R.mode}/${R.side ?? '-'})`,
    L.mode === 'dive' && R.mode === 'dive' && L.side === -R.side);
  // la profondeur COUPE L'ANGLE : à 12 m il est sorti plus qu'à 24 m
  const far = keeperSpot(p, 0, [p.ownGoal(0).x + 24, 0, 0]).depth;
  const near = keeperSpot(p, 0, [p.ownGoal(0).x + 12, 0, 0]).depth;
  ok(`la sortie coupe l'angle (24 m → ${far.toFixed(2)} m, 12 m → ${near.toFixed(2)} m)`, near > far + 0.3);
  // un vol qui s'éloigne du but ne croise jamais le plan
  ok('un ballon qui s\'éloigne ne « croise » pas le plan du but', shotCross(p, 0, [0, 0.11, 0], [+8, 0, 0]) === null);
}

// ---------- 3. le match joué (les bandes du réel, mesurées sur graines)
{
  let shots = 0, buts = 0, arrets = 0, dives = 0, gestes = 0, degagements = 0, contratsOk = 0, sorties = 0;
  const types = new Set();
  const SEEDS = [3, 7, 11, 1];
  for (const seed of SEEDS) {
    const st = makeMatch({ perTeam: 5, seed });
    const { st: s2, trace } = playMatch(st, 120);
    const r = checkMatch(s2, trace);
    if (r.ok) contratsOk++;
    else console.log(`  (graine ${seed} : ${r.issues[0]})`);
    shots += r.stats.shots; buts += r.stats.buts; arrets += r.stats.arrets;
    dives += s2.events.filter((e) => e.type === 'dive').length;
    gestes += s2.events.filter((e) => e.type === 'skill').length;
    degagements += s2.events.filter((e) => e.type === 'clearance').length;
    for (const o of s2.events.filter((e) => e.type === 'sortie')) { types.add(o.out); sorties++; }
  }
  ok(`${SEEDS.length} matchs de 120 s : contrat complet sur chaque graine (${contratsOk}/${SEEDS.length})`, contratsOk === SEEDS.length);
  ok(`ça TIRE (${shots} tirs — ≥ 3 par match en moyenne)`, shots >= SEEDS.length * 3);
  ok(`ça MARQUE, dans la bande du réel (${buts} buts pour ${shots} tirs : conversion ${(100 * buts / Math.max(1, shots)).toFixed(0)} % ∈ [8, 55])`,
    buts >= 1 && buts / Math.max(1, shots) >= 0.08 && buts / Math.max(1, shots) <= 0.55);
  ok(`le gardien ARRÊTE (${arrets} arrêts sur ${dives} plongeons)`, arrets >= SEEDS.length);
  // la VARIÉTÉ des remises est prouvée par les fixtures de outRule (checkPitch — les 4 espèces
  // par géométrie) ; en jeu, les espèces tirées dépendent de l'histoire — on exige l'EXISTENCE
  ok(`des remises EXISTENT en jeu (${sorties} — espèces vues : ${[...types].join(', ') || 'aucune'})`, sorties >= 3);
  ok(`le vocabulaire du rondo a survécu au match (${gestes} gestes techniques — râteaux/feintes/semelles en match)`, gestes >= 4);
  // l'équipe épinglée sait BOOTER (mesuré graine 11 avant le hook : 391 images de possession
  // dans son tiers sans jamais franchir la médiane — le dégagement de la table n'était jamais
  // déclenché)
  ok(`le DÉGAGEMENT existe (${degagements} sur ${SEEDS.length} matchs — l'équipe épinglée sort de l'étau)`, degagements >= 2);
}

// ---------- 3 bis. LA CIRCULATION (le retour utilisateur, verrouillé en clauses)
// « Trop de conduite et des passes imprécises ou qui ne suivent pas l'appel » — mesuré tel quel :
// 21 % de passes reçues (le receveur trottait vers son couloir pendant que le ballon passait),
// mène figée 0,28 s (4 m derrière un coureur), tenue p90 3,6 s, 5 appels servis sur 74. Après le
// job 'receive' en vol + la mène de course + l'appel récompensé : 85 % / 1,7 s / 15 sur 82.
// Ces clauses tiennent le gain.
{
  let total = 0, recu = 0, appels = 0, servis = 0;
  const holds = [];
  for (const seed of [3, 7]) {
    const st = makeMatch({ perTeam: 5, seed });
    const { st: s2, trace } = playMatch(st, 120);
    const evs = s2.events;
    for (const p of evs.filter((e) => e.type === 'pass' && e.to >= 0)) {
      total++;
      if (evs.some((e) => e.type === 'receive' && e.by === p.to && e.t >= p.t && e.t < p.t + 3.5)) recu++;
    }
    for (const b of evs.filter((e) => e.type === 'burst' && e.kind === 'appel')) {
      appels++;
      // la fenêtre de service SUIT LA TENUE (1,7 s datait des tenues de 0,8 s ; au tempo FM le
      // porteur fixe 1-2 s avant de servir la course)
      if (evs.some((e) => e.type === 'pass' && e.to === b.by && e.t >= b.t && e.t <= b.t + 2.8)) servis++;
    }
    let h0 = -1, c0 = -1, x0 = 0, team0 = 0;
    for (const s of trace) {
      const pl = c0 >= 0 ? s.players.find((q) => q.id === c0) : null;
      if (s.phase === 'carry' && c0 < 0 && s.carrier >= 0) {
        const q = s.players.find((w) => w.id === s.carrier);
        h0 = s.t; c0 = s.carrier; x0 = q?.p[0] ?? 0; team0 = q?.team ?? 0;
      }
      if ((s.phase !== 'carry' || s.carrier !== c0) && c0 >= 0) {
        // UNE TENUE QUI ACHÈTE DES MÈTRES N'EST PAS UNE STATUE (loi 8) : l'ailier refusé du tir
        // (angle fermé) CONDUIT vers la ligne en attendant que la surface se remplisse — la
        // patience à terrain gagné est le football voulu ; la clause chasse le porteur PLANTÉ
        const gain = pl ? (pl.p[0] - x0) * (team0 === 0 ? 1 : -1) : 0;
        if (gain < 3.5) holds.push(s.t - h0);
        c0 = -1;
      }
    }
  }
  holds.sort((a, b) => a - b);
  const p90 = holds[Math.floor(holds.length * 0.9)] ?? 0;
  ok(`les passes ARRIVENT (${recu}/${total} reçues = ${(100 * recu / Math.max(1, total)).toFixed(0)} % ≥ 60 — avant le receveur-en-vol : 21 %)`,
    recu / Math.max(1, total) >= 0.6);
  ok(`l'appel est SERVI (${servis}/${appels} = ${(100 * servis / Math.max(1, appels)).toFixed(0)} % ≥ 10 — avant : 7 %)`,
    servis / Math.max(1, appels) >= 0.10);
  // le plafond suit le TEMPO VOULU (holdCalm 2,2 + armé ≈ 3,0) — la pathologie visée reste 3,6
  ok(`on ne PORTE pas le ballon des heures (tenue p90 ${p90.toFixed(2)} s ≤ 3,3 — la pathologie d'origine : 3,6)`, p90 <= 3.3);
}

// ---------- 3 ter. LA CONDUITE — présente ET précise (le retour utilisateur, deuxième passe :
// « pas trop de conduite : trop de conduite IMPRÉCISE — c'est important qu'il y ait de la
// conduite et des dribbles »). Mesuré avant : 11,4 % du temps de conduite avec le ballon échappé
// au-delà de 2,2 m (le porteur courait après son ballon), poussée qui zigzague à 60 Hz. Après la
// touche qui lit l'espace + la touche qui corrige + l'intention lissée : 5,4 % / p90 1,89 m /
// touches à 1-10° du cap. Ces clauses tiennent LES DEUX : la précision ET la présence.
{
  const dists = [], touch = [];
  let carryF = 0, freeF = 0;
  const vLaunch = new Map();                                       // l'allure de LANCEMENT de la touche (max récent, décroissance de freinage)
  for (const seed of [3, 7]) {
    const st = makeMatch({ perTeam: 5, seed });
    const cfg = matchCfg();
    // le saut de vitesse se lit ENTRE DEUX FINS DE PAS (pv = v post-pas précédent) — la première
    // version comparait à travers deux pas et mesurait 97° là où l'instant de touche donne 10
    let pv = [0, 0];
    const { matchStep } = await import('../assets/starter/src/engine/match-sim.js');
    for (let i = 0; i < 120 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      const bv = [st.ball.v[0], st.ball.v[2]];
      const dv = Math.hypot(bv[0] - pv[0], bv[1] - pv[1]);
      const inCarry = st.phase === 'carry' && st.possession.carrier >= 0;
      if (inCarry) {
        const c = st.players[st.possession.carrier];
        // …et le GARDIEN-DISTRIBUTEUR n'est pas une conduite : son porté modélise le ballon EN
        // MAINS (prise → sortie de surface) — ses distances ne sont pas des touches de pied
        if (!c.act && !c.keeper) {
          carryF++;
          if (st.ball.owner == null) {
            freeF++;
            const dNow = Math.hypot(c.p[0] - st.ball.p[0], c.p[2] - st.ball.p[2]);
            // …hors CUEILLETTE (hold < 0,8 s) : un duel gagné laisse le ballon filer sur son élan
            // — le courser est une récupération, pas une conduite imprécise (épisode mesuré :
            // 1,6 s à 4 m/s de ballon contre 1,9 m/s de porteur, juste après un turnover)
            if (st.hold < 0.8) { pv = [st.ball.v[0], st.ball.v[2]]; continue; }
            // le plafond lit l'allure de LANCEMENT : une touche prise à 6 m/s reste légitime à 3 m
            // pendant que le porteur freine dessus (mesuré : 4 épisodes/120 s, tous vC 4+ vers un
            // ballon mourant — la touche d'avant, pas une perte)
            const vL = Math.max(c.speed ?? 0, (vLaunch.get(c.id) ?? 0) - 6 / 60);
            vLaunch.set(c.id, vL);
            // « échappé » SUIT LA LOI DE TOUCHE : une poussée de sprint met LÉGITIMEMENT le ballon
            // à 2,4-3 m (touchDistance à 6,9 m/s) — la compter perdue condamnait les contre-attaques
            // post-dégagement (mesuré : 2,6 à 12,6 % selon la graine, le spike = les contres)
            // le plafond est LA SOMME DE LA LOI : portée du pied (reach 1,15) + poussée de touche
            // (touchDistance à l'allure de lancement) + marge — l'oubli de la portée comptait
            // perdues des touches réglementaires (pic naturel ≈ 3,0 m à 4 m/s)
            dists.push({ d: dNow, cap: 1.15 + touchDistance(vL) + 0.5 });
            if (dv > 1.5 && dNow < 1.3 && c.push) {
              const l = Math.hypot(bv[0], bv[1]);
              if (l > 1) touch.push(Math.acos(Math.max(-1, Math.min(1, (bv[0] * c.push[0] + bv[1] * c.push[1]) / l))) * 180 / Math.PI);
            }
          }
        }
      }
      pv = bv;
    }
  }
  const dVals = dists.map((x) => x.d).sort((a, b) => a - b);
  touch.sort((a, b) => a - b);
  const q = (arr, p) => arr[Math.floor(arr.length * p)] ?? 0;
  const esc = dists.filter((x) => x.d > x.cap).length / Math.max(1, dists.length);
  ok(`la conduite est PRÉSENTE (${(100 * freeF / Math.max(1, carryF)).toFixed(0)} % du porté en touches libres ≥ 40 — le dribble fait partie du jeu)`,
    freeF / Math.max(1, carryF) >= 0.4);
  ok(`…et PRÉCISE : le ballon ne s'échappe pas AU-DELÀ de sa loi de touche (${(100 * esc).toFixed(1)} % ≤ 6)`, esc <= 0.06);
  ok(`…le ballon reste conduit (dist p90 ${q(dVals, 0.9).toFixed(2)} m ≤ 2,4)`, q(dVals, 0.9) <= 2.4);
  ok(`…et la touche part OÙ LE PIED VEUT (p90 ${q(touch, 0.9).toFixed(0)}° ≤ 20 sur ${touch.length} touches)`, q(touch, 0.9) <= 20);
}

// ---------- 3 sexies. LE TEMPO x1 (la question utilisateur : « FM est plus lent en x1 ? »)
// Mesuré AVANT le réglage : 25 passes/min (réel 11c11 : 9-11, futsal : 14-18), corps à 10 km/h
// (réel 7,2), 195 m/min/joueur (réel 110-120), ballon en jeu 94 % (réel 55-65), tenue 0,83 s.
// APRÈS (remises 4 s, tenue au marquage léger, économie du soutien, bucket marquage dédié) :
// bande futsal assumée — le 46 × 30 est intrinsèquement plus vif qu'un 11c11. Ces clauses
// tiennent le tempo dans sa bande de format.
{
  const { matchStep } = await import('../assets/starter/src/engine/match-sim.js');
  let passes = 0, secs = 0, speeds = [], inPlay = 0, frames = 0;
  for (const seed of [3, 7]) {
    const st = makeMatch({ perTeam: 5, seed });
    const cfg = matchCfg();
    for (let i = 0; i < 120 * 60; i++) {
      matchStep(st, 1 / 60, cfg);
      frames++;
      if (!st.restart) inPlay++;
      if (i % 6 === 0) for (const p of st.players) speeds.push(p.speed);
    }
    secs += 120;
    passes += st.events.filter((e) => e.type === 'pass').length;
  }
  const kmh = (speeds.reduce((a, b) => a + b, 0) / Math.max(1, speeds.length)) * 3.6;
  const ppm = 60 * passes / secs;
  const play = 100 * inPlay / frames;
  ok(`le tempo est dans la bande du format (${ppm.toFixed(1)} passes/min ∈ [11 ; 20] — avant réglage : 25)`, ppm >= 11 && ppm <= 20);
  // borne haute 9,6 : servir les appels coûte des sprints (mesuré +0,4 après le déclencheur de
  // course) — la pathologie d'origine reste 10,0
  ok(`les corps travaillent à hauteur d'homme (${kmh.toFixed(1)} km/h ∈ [5,8 ; 9,6] — avant : 10,0)`, kmh >= 5.8 && kmh <= 9.6);
  ok(`le jeu RESPIRE (ballon en jeu ${play.toFixed(0)} % ∈ [70 ; 95] — avant : 94, remises d'une seconde)`, play >= 70 && play <= 95);
}

// ---------- 3 septies. LE BALLON N'EST JAMAIS SEUL (le retour utilisateur : « des ballons se
// déplacent sans joueur à proximité »). Mesuré avant les lois : 12 téléports de 4,7-23 m en une
// image (remises snappées, engagement du filet au rond central) et 18 roulements orphelins
// ≥ 0,7 s (dégagements et claquettes ORBITÉS par la formation, personne n'allait AU ballon).
// Les lois : la remise se PORTE (ballFetch — freiné à la lisse, ramassé, porté, posé) et le
// ballon libre est CHASSÉ par les deux camps (mène de poursuite). Chacune a son sabotage nommé.
{
  // L'INSTRUMENT MESURE LA RÉSOLUTION, PAS LA PROXIMITÉ (loi 8, encore) : la première clause
  // comptait « ballon à > 3 m de tout corps » — et le SABOTAGE la battait, parce que l'orbiteur
  // qui suit le ballon À LA TRACE reste près de lui, pendant que le chasseur de la loi coupe vers
  // son FUTUR (mène) et s'en éloigne géométriquement. La grandeur honnête : combien de temps un
  // ballon libre reste SANS MAÎTRE (hors remise administrée).
  const { matchStep } = await import('../assets/starter/src/engine/match-sim.js');
  const mesure = (overrides) => {
    let jumps = 0, prises = 0;
    const gaps = [];
    for (const seed of [3, 7]) {
      const st = makeMatch({ perTeam: 5, seed });
      const cfg = matchCfg(overrides);
      let g = 0;
      for (let i = 0; i < 120 * 60; i++) {
        const prev = [st.ball.p[0], st.ball.p[2]];
        matchStep(st, 1 / 60, cfg);
        if (Math.hypot(st.ball.p[0] - prev[0], st.ball.p[2] - prev[1]) > 1.2) jumps++;
        if (st.possession.carrier < 0 && !st.restart) g++;
        else { if (g > 0) gaps.push(g / 60); g = 0; }
      }
      prises += st.events.filter((e) => e.type === 'restart-pris').length;
    }
    gaps.sort((a, b) => a - b);
    return { jumps, prises, p90: gaps[Math.floor(gaps.length * 0.9)] ?? 0 };
  };
  const m = mesure({});
  ok(`le ballon ne se TÉLÉPORTE jamais (${m.jumps} saut(s) > 1,2 m/image sur 2 × 120 s — avant : 12)`, m.jumps === 0);
  ok(`le ballon libre TROUVE UN MAÎTRE (p90 sans possession ${m.p90.toFixed(2)} s ≤ 1,5 — la chasse des deux camps)`, m.p90 <= 1.5);
  ok(`…et les remises VIVENT toujours (${m.prises} prises — le porté n'a pas cassé la reprise)`, m.prises >= 6);
  const sansPorte = mesure({ restartCarried: false });
  ok(`sabotage « remise snappée » attrapé (${sansPorte.jumps} téléport(s) sans le porté)`, sansPorte.jumps > 0);
  const sansChasse = mesure({ chaseLoose: false });
  ok(`sabotage « formation qui orbite » attrapé (p90 ${sansChasse.p90.toFixed(2)} s sans la chasse > ${(m.p90 * 1.15).toFixed(2)} — la mène mord)`,
    sansChasse.p90 > m.p90 * 1.15);
}

// ---------- 3 octies. LE RÉPERTOIRE OFFENSIF (le retour utilisateur : « les frappes manquent de
// peps et de diversité, ça manque de centres, la conduite perd le ballon anormalement »).
// Mesuré avant : 100 % des tirs = rase-mottes 17 m/s ; 0 centre (l'aile canonnait à angle fermé,
// tryShot passait toujours avant) ; 41 bascules carry→libre sans événement dont 20 volées ; et
// 8 buts SANS TIR — des roulements « portés » qui traversaient un gardien sans droit de prise.
{
  const { matchStep } = await import('../assets/starter/src/engine/match-sim.js');
  const joue = (overrides, seeds = [3, 7]) => {
    const out = { kinds: new Set(), speeds: [], eleves: 0, centres: 0, centresTir: 0, pieds: 0, butsSansTir: 0, flips: 0 };
    for (const seed of seeds) {
      const st = makeMatch({ perTeam: 5, seed });
      const cfg = matchCfg(overrides);
      let prevPhase = st.phase, prevCarrier = st.possession.carrier, prevEv = 0;
      for (let i = 0; i < 120 * 60; i++) {
        matchStep(st, 1 / 60, cfg);
        // bascule carry→libre sans événement du jeu (la touche « volée » par l'étiquette)
        if (prevPhase === 'carry' && prevCarrier >= 0 && st.phase === 'loose' && st.possession.carrier < 0) {
          const nv = st.events.slice(prevEv).map((e) => e.type);
          if (!nv.some((t) => ['duel', 'sortie', 'but', 'pass', 'shot', 'centre'].includes(t))) out.flips++;
        }
        prevPhase = st.phase; prevCarrier = st.possession.carrier; prevEv = st.events.length;
      }
      for (const e of st.events) {
        if (e.type === 'shot') { out.kinds.add(e.kind ?? 'tendu'); out.speeds.push(e.speed); if ((e.elev ?? 0) >= 0.12) out.eleves++; }
        if (e.type === 'centre') {
          out.centres++;
          if (st.events.some((x) => x.type === 'shot' && x.t > e.t && x.t < e.t + 4)) out.centresTir++;
        }
        if (e.type === 'arrêt' && e.mode === 'pieds') out.pieds++;
        if (e.type === 'but' && !st.events.some((x) => x.type === 'shot' && x.t <= e.t && x.t > e.t - 1.5)) out.butsSansTir++;
      }
    }
    out.speeds.sort((a, b) => a - b);
    out.p90 = out.speeds[Math.floor(out.speeds.length * 0.9)] ?? 0;
    return out;
  };
  const loi = joue({}, [3, 7, 11, 1]);
  ok(`les frappes ont un RÉPERTOIRE (${[...loi.kinds].join(', ')} — ≥ 3 espèces, avant : le rase-mottes unique)`, loi.kinds.size >= 3);
  ok(`…et du PEPS (p90 ${loi.p90} m/s ≥ 19 — avant : plancher plat 17)`, loi.p90 >= 19);
  ok(`…et de la HAUTEUR (${loi.eleves} frappes levées ≥ 0,12 rad — mi-hauteur/lucarne existent)`, loi.eleves >= 2);
  ok(`l'aile SERT (${loi.centres} centres sur 4 matchs, dont ${loi.centresTir} suivis d'un tir < 4 s)`, loi.centres >= 3 && loi.centresTir >= 1);
  ok(`la sortie DANS LES PIEDS existe (${loi.pieds} — le label de conduite n'est pas un bouclier)`, loi.pieds >= 1);
  ok(`le but sans tir est l'EXCEPTION (${loi.butsSansTir} sur 4 matchs ≤ 4 — avant la sortie dans les pieds : 8)`, loi.butsSansTir <= 4);
  const sansVar = joue({ shotVariety: false });
  ok(`sabotage « rase-mottes unique » attrapé (${sansVar.kinds.size} espèce(s), p90 ${sansVar.p90} sans le répertoire)`,
    sansVar.kinds.size <= 1 && sansVar.p90 <= 18.5);
  const sansCentre = joue({ tryCross: null });
  ok(`sabotage « aile muette » attrapé (${sansCentre.centres} centre(s) sans tryCross)`, sansCentre.centres === 0);
  const sansClaim = joue({ keeperClaim: false });
  ok(`sabotage « label-bouclier » attrapé (${sansClaim.butsSansTir} but(s) sans tir sans la sortie dans les pieds > ${loi.butsSansTir} × il en faut plus)`,
    sansClaim.butsSansTir > Math.max(1, joue({}).butsSansTir));
  const sansLoi = joue({ carryLawLoose: false });
  const loiFlips = joue({}).flips;
  ok(`la touche légale GARDE son étiquette (${loiFlips} bascules sans événement / 2 matchs, contre ${sansLoi.flips} au rayon plat — la loi mord)`,
    loiFlips < sansLoi.flips);
}

// ---------- 3 quater. LA PERCEPTION N'EST PAS UN ORACLE
// Mesuré avant : 10 % des défenseurs re-ciblaient dans l'IMAGE du départ de passe (17 ms).
// La loi : qui REGARDAIT le ballon (part de la politique de regard, hachée joueur × passe)
// anticipe l'armé visible ; qui scannait paie sa réaction persona (0,16-0,26 s) pleine.
{
  const { matchStep } = await import('../assets/starter/src/engine/match-sim.js');
  const retargets = (reactionOverride) => {
    const all = [];
    for (const seed of [3, 7]) {
      const st = makeMatch({ perTeam: 5, seed });
      if (reactionOverride != null) for (const p of st.players) p.persona = { ...p.persona, reaction: reactionOverride };
      const cfg = matchCfg();
      let passT = -9, held = null;
      for (let i = 0; i < 60 * 60; i++) {
        const evN = st.events.length;
        matchStep(st, 1 / 60, cfg);
        const pass = st.events.slice(evN).find((e) => e.type === 'pass');
        if (pass) {
          passT = st.t;
          held = st.players.filter((p) => p.team !== st.players[pass.from].team && !p.keeper && p.down <= 0)
            .map((p) => ({ p, t0: p.target ? [...p.target] : null }));
        }
        if (held && st.t - passT > 0 && st.t - passT < 0.6) {
          for (const h of held) {
            if (!h.done && h.t0 && h.p.target && Math.hypot(h.p.target[0] - h.t0[0], h.p.target[2] - h.t0[2]) > 1.2) {
              all.push(st.t - passT); h.done = true;
            }
          }
        }
      }
    }
    all.sort((a, b) => a - b);
    return { instant: all.filter((t) => t < 0.05).length / Math.max(1, all.length), p50: all[Math.floor(all.length / 2)] ?? 0, n: all.length };
  };
  const live = retargets(null);
  ok(`la défense n'est plus un oracle (${(100 * live.instant).toFixed(0)} % de re-ciblages < 50 ms ≤ 35, p50 ${live.p50.toFixed(3)} s ∈ [0,08 ; 0,3])`,
    live.instant <= 0.35 && live.p50 >= 0.08 && live.p50 <= 0.3);
  // …et la RETENUE elle-même, en LOI (l'instrument de partie est mou — le saut de cible de 1,2 m
  // met ~0,1 s à exister quel que soit le gel) : surprise injectée, ballon impulsé de côté — un
  // SCANNEUR garde sa cible d'avant pendant sa réaction pendant qu'un monde sans réaction suit.
  {
    const { matchStep: ms } = await import('../assets/starter/src/engine/match-sim.js');
    const frozenShare = (reaction) => {
      const st = makeMatch({ perTeam: 5, seed: 11 });
      const cfg = matchCfg();
      for (let i = 0; i < 120; i++) ms(st, 1 / 60, cfg);
      for (const p of st.players) p.persona = { ...p.persona, reaction };
      const defs = st.players.filter((p) => p.team !== st.possession.team && !p.keeper && p.down <= 0);
      const before = defs.map((p) => ({ p, t: p.target ? [...p.target] : null }));
      st.ball.impulse([0, 0, 6]);                                  // le monde change d'un coup
      st._surprise = { t: st.t, seen: 0, n: 777 };
      for (let i = 0; i < 8; i++) ms(st, 1 / 60, cfg);             // 0,13 s
      let frozen = 0;
      for (const b of before) {
        if (b.t && b.p.target && Math.hypot(b.p.target[0] - b.t[0], b.p.target[2] - b.t[2]) < 0.2) frozen++;
      }
      return frozen / Math.max(1, before.length);
    };
    const withR = frozenShare(0.24), without = frozenShare(0);
    ok(`la retenue de perception EXISTE en loi (${(100 * withR).toFixed(0)} % de cibles gelées à 0,13 s avec réaction, ${(100 * without).toFixed(0)} % sans — l'écart est la loi)`,
      withR > without + 0.15);
  }
}

// ---------- 3 quinquies. LE POIDS DE LA PASSE (garde dormante, prouvée en loi)
// Découverte mesurée : la balistique inverse livre des ballons jouables (7-10 m/s) par
// construction — les vraies fusées (dégagements, déviations) sont rares. La loi du contrôle
// manqué existe pour elles ; on la prouve sur fixture, pas sur la fréquence du match.
{
  const { simInternals } = await import('../assets/starter/src/engine/rondo-sim.js');
  const fixture = (speed, roll) => {
    const st = makeMatch({ perTeam: 5, seed: 9 });
    const cfg = matchCfg();
    const r = st.players[1];
    r.yaw = 0;                                                     // il regarde +x : le ballon arrive DE FACE
    st.restart = null; st.phase = 'flight'; st.possession.carrier = -1;
    st.pass = { from: 0, to: 1, t: st.t, origin: [0, 0], lead: [r.p[0], 0.11, r.p[2]] };
    st.ball.restart([r.p[0] + 0.45, 0.11, r.p[2] + 0.05], { cause: 'engagement' });
    st.ball.impulse([-speed, 0, 0]);                               // vers lui, pleine face
    st.rnd = () => roll;
    simInternals.receive(st, 1, cfg);
    return { missed: (st.deny?.['contrôle-manqué'] ?? 0) > 0, owned: st.ball.owner === 1 };
  };
  const rocket = fixture(15, 0.0);
  ok('une FUSÉE (15 m/s) au pire tirage ÉCHAPPE au contrôle (ballon libre, refus nommé)', rocket.missed && !rocket.owned);
  const soft = fixture(6, 0.0);
  ok('une passe DOUCE (6 m/s) ne se manque JAMAIS, même au pire tirage', !soft.missed);
  const lucky = fixture(15, 0.99);
  ok('…et la même fusée au bon tirage se dompte (le risque est un tirage, pas une fatalité)', !lucky.missed);
}

// ---------- 4. les sabotages
{
  // un match SANS tir (le hook retiré) : la clause « rondo décoré » attrape
  const st = makeMatch({ perTeam: 5, seed: 3 });
  const cfg = matchCfg({ tryShot: null });
  const { st: s2, trace } = playMatch(st, 90, { cfg });
  const r = checkMatch(s2, trace, cfg);
  ok('sabotage « match sans tir » attrapé (PERSONNE NE TIRE)', !r.ok && r.issues.some((i) => i.includes('TIRE')));

  // un score trafiqué ne colle plus aux événements
  const st2 = makeMatch({ perTeam: 5, seed: 7 });
  const { st: s3, trace: t3 } = playMatch(st2, 90);
  s3.score[0] += 1;
  const r2 = checkMatch(s3, t3);
  ok('sabotage « score trafiqué » attrapé (score ≠ événements de but)', !r2.ok && r2.issues.some((i) => i.includes('score')));

  // une remise volée par la mauvaise équipe — attrapée
  const st3 = makeMatch({ perTeam: 5, seed: 7 });
  const { st: s4, trace: t4 } = playMatch(st3, 90);
  const o = s4.events.find((e) => e.type === 'sortie');
  if (o) {
    const wrong = s4.players.find((p) => p.team !== o.team && !p.keeper);
    s4.events.push({ t: o.t + 0.5, type: 'restart-pris', by: wrong.id });
    // …et on retire la vraie prise pour que la fausse soit la première dans la fenêtre
    const real = s4.events.findIndex((e) => e.type === 'restart-pris' && e.t >= o.t && e.t <= o.t + 6 && e.by !== wrong.id);
    if (real >= 0) s4.events.splice(real, 1);
    s4.events.sort((a, b) => a.t - b.t);
    const r3 = checkMatch(s4, t4);
    ok('sabotage « remise volée » attrapé (mauvaise équipe à la reprise)', !r3.ok && r3.issues.some((i) => i.includes('prise par')));
  } else ok('sabotage « remise volée » (aucune sortie sur cette graine — sabotage sans objet)', true);
}

console.log(`\n${pass} ✓ / ${fail} ✗`);
process.exit(fail ? 1 : 0);
