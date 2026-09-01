// match-check.js — LE VALIDATEUR DU MATCH (déporté de match-sim au lot 202, plafond de
// volumétrie — la séparation moteur/contrat est l'architecture voulue : le moteur JOUE,
// le contrat JUGE ; même loi que rondo-check).
import { matchCfg } from './match-sim.js';
import { hyp } from './hyp.js';

/** CONTRAT DU MATCH — par-dessus checkRondo (téléports/essaims) : personne ne tire, score ≠ buts,
 *  sorties sans remise nommée, gardien errant, remises volées, un jeu qui ne progresse jamais. */
export function checkMatch(st, trace, cfg = matchCfg()) {
  const issues = [];
  const evs = st.events ?? [];
  const shots = evs.filter((e) => e.type === 'shot');
  const buts = evs.filter((e) => e.type === 'but');
  const sorties = evs.filter((e) => e.type === 'sortie');
  const prises = evs.filter((e) => e.type === 'restart-pris');
  if (st.score[0] !== buts.filter((b) => b.team === 0).length || st.score[1] !== buts.filter((b) => b.team === 1).length) { issues.push(`score [${st.score}] ≠ événements de but (${buts.map((b) => b.team).join(',')})`); }
  // un 0 tir sur une tranche courte est du VRAI football — le défaut, ce sont des OCCASIONS sans tir ; l'occasion = le ballon dans la zone QUE JE VISE pendant que JE l'ai (ni chez soi, ni les remises).
  const thirdVisits = trace.filter((s) => !s.restart && s.team >= 0
    && s.ball[0] * (s.team === 0 ? 1 : -1) > st.pitch.hx - st.pitch.dims.box.depth - 1).length;
  // …et l'attaquant MURÉ n'est pas l'attaquant MUET : celui qui DEMANDE le tir et se voit refuser le couloir (refus nommé au registre) a appuyé — c'est le silence sans demande qu'on interdit
  const denied = (st.deny?.['tir-couloir-fermé'] ?? 0) > 0;
  if (!shots.length && !denied && thirdVisits > 25) issues.push(`PERSONNE NE TIRE malgré ${thirdVisits} passages dans le dernier tiers — un rondo décoré`);
  for (const s of shots) {
    const okLob = st.full && cfg.lob && s.kind === 'lob' && s.range <= (cfg.lob.max ?? 38) + 0.6;   // le lob du gardien avancé (120) vit AU-DELÀ de la grise
    const okCF = st.full && cfg.cfDirect !== false && s.kind === 'coup-franc-direct' && s.range <= 34.6;   // le CF direct (97/148) a SA borne balistique (dMax 34 au 'direct' tactique) — la clause connaît la même loi que le tireur
    if (!okLob && !okCF && s.range > cfg.shotRange * (st.full && cfg.menace?.grise ? cfg.menace.grise : 1) + 0.6) issues.push(`tir hors de portée déclarée (${s.range} m > ${cfg.shotRange})`);
    // la clause connaît LA MÊME loi que le déclencheur : à bout portant (< 9 m) on tire dans le trafic (0,25 m) — juger tous les tirs au couloir de loin re-créerait l'attaquant muet
    const need = (s.range ?? 99) < 9 ? 0.25 : cfg.shotClear - 0.05;
    if (s.clear != null && s.clear < need) issues.push(`tir à travers un mur (couloir ${s.clear} m < ${need})`);
  }
  // chaque sortie SUIVIE d'une reprise (6 s) ; coupée par la fin ≠ perdue (inFlight — sinon le contrat dépend du chrono).
  const lastT = trace.length ? trace[trace.length - 1].t : 0;
  // …la fenêtre suit L'ÉCHELLE DU TERRAIN : 6 s au réduit ; un corner du 105 m se PORTE sur ~27 m (7,4 s mesurés, graine 7) — la borne plate accusait un porté légal de gel
  const winR = Math.max(6, (st.pitch?.hx ?? 0) * 0.27);   // ×0,19 → ×0,27 ≈ 14 s (171) : la sortie qui FUIT le long de la bordure + le portage = 10,5 s légitimes mesurés (graine 7 t=46,5) — le garde-fou vise le GEL (20 s+), pas la remise lente
  for (const o of sorties) {
    if (o.t > lastT - winR) continue;
    const pr = prises.find((p) => p.t >= o.t && p.t <= o.t + winR);
    if (!pr) { issues.push(`sortie « ${o.out} » à t=${o.t} jamais reprise (fenêtre ${winR.toFixed(0)} s)`); continue; }
    const taker = st.players[pr.by];
    if (taker && taker.team !== o.team) issues.push(`remise « ${o.out} » prise par l'équipe ${taker.team} (droit : ${o.team})`);
  }
  // le gardien HABITE son but (médiane de distance à sa ligne ≤ profondeur max + marge)
  for (const team of [0, 1]) {
    const gk = st.players.find((p) => p.keeper && p.team === team);
    const g = st.pitch.ownGoal(team);
    const ds = trace.map((s) => s.players.find((q) => q.id === gk.id)).filter(Boolean)
      .map((q) => hyp(q.p[0] - g.x, q.p[1] - 0)).sort((a, b) => a - b);
    const med = ds[Math.floor(ds.length / 2)] ?? 0;
    const bLib = st.full && cfg.libero ? (cfg.libero.max ?? 10) + 2 : 6;   // le libéro (120) POSSÈDE sa hauteur — la clause borne au plafond de la loi
    if (med > bLib) issues.push(`le gardien ${team} erre (médiane à ${med.toFixed(1)} m de son but)`);
  }
  // le jeu PROGRESSE : les deux tiers offensifs se visitent — vise le rond-central-perpétuel, pas l'équilibre (0-0 dominé légal) ; seuil au TIERS.
  const third = st.pitch.hx / 3;
  const visits = [trace.some((s) => s.ball[0] > third), trace.some((s) => s.ball[0] < -third)];
  if (!visits[0] || !visits[1]) issues.push(`le ballon ne visite pas les deux camps (au-delà de ±${third.toFixed(0)} m : +x ${visits[0]}, −x ${visits[1]})`);
  // LE BALLON NE SE TÉLÉPORTE JAMAIS EN MATCH : toute remise est PORTÉE (ballFetch) — le registre ne contient que LA pose du coup d'envoi. Mesuré avant : 12 sauts de 4,7-23 m / 4 matchs.
  const led = st.ball.ledger;
  if (cfg.restartCarried !== false && led && led.restarts && led.restarts.length > 1) { issues.push(`${led.restarts.length - 1} remise(s) posée(s) par écriture — la remise se PORTE (ballFetch), elle ne se téléporte pas`); }
  // …ET LES CORPS NON PLUS : à l'échantillon de trace (0,1 s), aucun joueur ne franchit 1,6 m (16 m/s apparents — le sprint plafonne à 8). placeKickoff écrivait les douze corps à chaque but.
  for (let i = 1; i < trace.length; i++) {
    const a = trace[i - 1], b = trace[i];
    if (b.t - a.t > 0.19) continue;
    const jump = b.players.find((q) => {
      const qa = a.players.find((x) => x.id === q.id);
      return qa && hyp(q.p[0] - qa.p[0], q.p[1] - qa.p[1]) > 1.6;
    });
    if (jump) { issues.push(`téléport de corps : le joueur ${jump.id} saute > 1,6 m entre t=${a.t} et t=${b.t}`); break; }
  }
  return { ok: issues.length === 0, issues, stats: { shots: shots.length, buts: buts.length, arrets: evs.filter((e) => e.type === 'arrêt').length, sorties: sorties.length, score: [...st.score] } };
}

