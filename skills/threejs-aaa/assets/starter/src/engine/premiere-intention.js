// premiere-intention.js — JOUER LE BALLON SANS LE POSSÉDER : la famille de la première
// intention. La remise de tête et la volée vivent dans tete.js (le répertoire aérien) ; ICI
// vit la passe en UNE TOUCHE au sol (lot 44) — extraite de rondo-sim au bit près quand la
// volumétrie a touché son plafond (1250), et étendue au CALME par l'axe de style (lot 49).
//
// La une-touche a deux portes, une seule mécanique :
//   — SOUS PRESSION (lot 44) : un presseur dans les jambes FORCE la première intention —
//     c'est un réflexe de survie, ouvert à toutes les équipes.
//   — AU CALME PAR STYLE (lot 49, UT.calme × l'axe tactics.style) : le tiki-taka joue en
//     première intention par CHOIX — la porte s'ouvre sans presseur, proportionnelle à
//     (0,5 − style) × 2 : possession (style 0,1) → 80 % de la clé, direct (style ≥ 0,5) →
//     JAMAIS. À style 0,5 (le défaut) pCalme = 0 et AUCUN tirage n'est consommé : l'identité
//     au défaut, au bit près (le court-circuit est la preuve).
// Le vrai geste garde ses conditions : ballon jouable (≤ vmax, au sol), une ligne courte et
// OUVERTE (couloir), et le déchet MAJORÉ — ×1,6 pressé (le geste le plus dur du football),
// ×1,3 au calme (choisi, préparé — mais toujours une première intention). Tirage seedé, la
// note de contrôle module. Refusée ou pas d'option : le contrôle normal reprend, rien n'est
// dû. Dette nommée : la photo Loi 11 (comme la remise de tête).
// false : le monde à deux touches d'hier (sabotage nommé) ; calme:0 : le réflexe seul.

import { laneClearance, solvePass } from './ball-predict.js';
import { gauss } from './attributes.js';
import { tac, axe } from './tactics.js';

const d2 = (a, b) => hyp(a[0] - b[0], a[2] - b[2]);

/** La passe en une touche du receveur `p` — true si le ballon est REPARTI (le patron de la
 *  remise de tête : sans possession) ; false : le contrôle normal reprend. */
export function uneTouche(st, p, cfg) {
  const UT = st.full && !p.keeper && st.pass && st.pass.to === p.id ? cfg.uneTouche : null;
  if (!UT) return false;
  const arrU = hyp(st.ball.v[0], st.ball.v[2]);
  const foeU = st.players.filter((q) => q.team !== p.team && q.down <= 0)
    .reduce((b, q) => (!b || d2(q.p, p.p) < d2(b.p, p.p) ? q : b), null);
  // LA PREMIÈRE INTENTION VIT (216, UT.vive — retour utilisateur « améliorer les passes » : 4,3 % de une-touche pour un réel 15-25 ; le gate pressé < 2,6 m ne s'ouvrait que pour un quart des réceptions, p25 = 2,7). Le réel joue en première intention dès qu'un défenseur ARRIVE (vive.press) et bien plus souvent au calme (vive.base). Absente : les seuils d'hier au bit.
  const V = (st.full && cfg.uneToucheVive) || null;   // la clé de PREMIER niveau (épinglable : uneToucheVive: false = l'hier au bit)
  const refus = (k) => { (st.deny ??= {})[k] = (st.deny[k] ?? 0) + 1; };   // les refus NOMMÉS (216 — l'entonnoir se lit)
  const pressOk = foeU && d2(foeU.p, p.p) < (V ? (V.press ?? 3.4) : (UT.press ?? 2.6));
  // …LE SOCLE (lot 111, UT.base — « ça manque de une-deux » : 7 % de une-touche mesuré, tout
  // au pressé ; la pente 1−2×style s'annulait au défaut 0,5). Le une-touche calme du VRAI
  // football existe à tout style (~15-25 % des passes) : base = le plancher, la pente du
  // possession-style monte AU-DESSUS. base absente : 0, la pente seule d'hier au bit.
  // …et LE RELAIS DU TROISIÈME HOMME (lot 111) force presque la tentative : un C en course.
  const relais3 = st.players.some((q) => q.team === p.team && (q._troisT ?? -1) > st.t);
  const pCalme = (UT.calme ?? 0.5) * Math.max(V ? (V.base ?? 0.45) : (UT.base ?? 0), 1 - 2 * (tac(st, p.team).style ?? 0.5)) * (relais3 ? (UT.relais ?? 2.2) : 1) * (V ? (p.skill?.visionF ?? 1) : 1);   // …ET LA VISION JOUE VITE AU CALME (216 : celui qui voit le jeu n'a pas besoin de contrôler)
  const veut = pressOk || (pCalme > 0 && (st.rnd ? st.rnd() : 0.5) < pCalme);
  if (!veut) refus('ut-envie'); else if (arrU > (UT.vmax ?? 9.5)) refus('ut-vitesse'); else if (st.ball.p[1] >= 0.5) refus('ut-haut');
  if (veut && arrU <= (UT.vmax ?? 9.5)
    && st.ball.p[1] < 0.5
    && (st.rnd ? st.rnd() : 0.5) < (UT.p ?? 0.65) * (st.full && cfg.tempoAxe !== false ? axe(tac(st, p.team).tempo, 0.6, 1.4) : 1) * Math.min(1.2, p.skill?.controlF ?? 1) * (relais3 ? (UT.murF ?? 1) : 1) * (V && (p.role?.tenue ?? 0.5) !== 0.5 ? axe(p.role.tenue, 1.4, 0.6) : 1)) {   // …ET LE RÔLE TENUE DONNE LA CADENCE (216 : le relayeur (0) joue vite, le meneur (1) garde — identité 0,5)   // …ET LE MUR REND (209, UT.murF — dette 196 : le lanceur d'un une-deux COURT, son mur se posait ; 5 retours/22. Le relais chaud pousse la une-touche au tirage FINAL, pas seulement au calme. Clé absente : ×1, l'hier)
    const blockers = st.players.filter((q) => q.team !== p.team && !q.keeper && q.down <= 0).map((q) => q.p);
    // LA UNE-TOUCHE SE GAGNE, ELLE NE S'ESPÈRE PAS (lot 131, UT.dose — mesuré avant : 116 s
    // d'errance / 1200 s après les une-touche, p50 2,7 s ; le cap de layoff (4-6 m/s à
    // contre-courant) sur une passe de 10-14 m fait MOURIR le ballon en route, rollResist).
    // Le dosage se RÉSOUT sur la physique exacte (solvePass, l'outil du lot 128 : arrivée
    // prenable UT.dose.arr) et le cap de déviation devient un FILTRE de faisabilité : la
    // remise que la physique ne peut pas porter jusqu'au pied n'est plus tentée — le
    // contrôle normal reprend ses droits. dose:false : les ballons morts d'hier, au bit.
    const dose = st.full && UT.dose !== false ? (UT.dose === true || UT.dose == null ? {} : UT.dose) : null;
    const bvl0 = hyp(st.ball.v[0], st.ball.v[2]) || 1;
    // LE RELAIS CHAUD SE SERT DANS SA COURSE (218, V.mene / bonus3 / capRelais — TENTÉE ET REJETÉE à la mesure : la fixture élit le relais dans les 3 géométries, mais au flux 1 retour/16 et la une-touche 79 → 73 % ; les situations sont rares et le lanceur ne sprinte pas (1-5 m/s) — le levier est le LANCEUR. Défauts = l'hier au bit ; les clés restent des boutons. l'entonnoir du mur d'un une-deux : 6/16 « pas de candidat », la ligne mur → PIEDS du coureur traverse le presseur contourné ; le vrai retour va DEVANT lui) : la cible du candidat au relais est m.p + v × mene, le couloir et le dosage se jugent sur ELLE. Absente : les pieds d'hier.
    const cibleDe = (m) => (V && (m._troisT ?? -1) > st.t && (V.mene ?? 0) > 0) ? [m.p[0] + m.v[0] * (V.mene ?? 0), m.p[2] + m.v[1] * (V.mene ?? 0)] : [m.p[0], m.p[2]];
    // …ET LE MUR DOIT VOIR SON COUREUR (218d, V.relaisLecture — le mantra) : la priorité au relais chaud
    // se perd parfois chez le mur mal noté VISION — probabilité (1 − visionF) × relaisLecture (visionF
    // 0,85 → 30 %) ; à 50 et au-dessus aucun tirage : l'identité au bit.
    const misV = V?.relaisPrio ? Math.max(0, 1 - (p.skill?.visionF ?? 1)) * (V.relaisLecture ?? 2) : 0;
    const prioV = !!V?.relaisPrio && !(misV > 0 && (st.rnd ? st.rnd() : 0.5) < misV);
    const mate = st.players
      .filter((m) => m.team === p.team && m.id !== p.id && !m.keeper && m.down <= 0)
      .map((m) => { const c = cibleDe(m); return { m, c, d: hyp(c[0] - p.p[0], c[1] - p.p[2]) }; })
      .filter((x) => x.d > (V ? (V.dMin ?? 2.5) : 3) && x.d < (UT.portee ?? 14))   // (216) la remise très courte est un candidat
      .map((x) => ({ ...x, marge: laneClearance([p.p[0], 0, p.p[2]], [x.c[0], 0, x.c[1]], blockers).margin ?? 0 }))
      .filter((x) => x.marge >= (V ? (V.couloir ?? 0.9) : (UT.couloir ?? 0.5)) * ((x.m._troisT ?? -1) > st.t ? (V ? (V.chas ?? 0.22) : (UT.chas ?? 1)) : 1))   // …ET LA UNE-TOUCHE ORDINAIRE VEUT UN COULOIR (216 : à 0,5 m la remise rapide se faisait intercepter — 73 % ; à 0,9 : 77 %, les passes de jeu retrouvent 78 %) ; le relais chaud garde ses 0,2 m absolus (0,9 × 0,22)   // …ET LE RETOUR ACCEPTE LE CHAS (209, dette 196 : les refus mesurés à marge 0,05-0,35 — le donne-et-va rend PAR NATURE dans le couloir étroit du presseur contourné ; le une-deux réel ose la remise rasante). Relais froid : le 0,5 d'hier.
      .map((x) => {
        if (!dose) return x;
        const cosD = ((x.c[0] - p.p[0]) * st.ball.v[0] + (x.c[1] - p.p[2]) * st.ball.v[2]) / (x.d * bvl0);
        const cap = 4 + 8 * (0.5 + 0.5 * cosD);
        const sol = solvePass([p.p[0], 0, p.p[2]], [x.c[0], 0, x.c[1]], { style: 'ground', arrival: dose.arr ?? 5.0 });
        // …ET LA REMISE COURTE EST FAISABLE (216 : 93 refus « pas de candidat » mesurés — le cap de layoff à contre-courant (4-6 m/s, lot 131) refusait la remise en RETRAIT de 3-6 m, LA une-touche la plus courante du football, qui ne peut pas mourir en route)
        const capV = V && (x.m._troisT ?? -1) > st.t ? Math.max(cap, V.capRelais ?? 6, 6) : V && x.d < (V.court ?? 7) ? Math.max(cap, 6, V.capCourt ?? 8.5) : Math.max(cap, 6);   // …ET LE RELAIS CHAUD A SON CAP (218 : le retour du une-deux repart d'où venait le ballon — le cap à contre-courant du 131 le déclarait infaisable (7,6-8,7 m/s requis pour 4-6 permis) alors que le coureur vient À LA RENCONTRE)
        return { ...x, sol, faisable: !!sol && sol.speed <= Math.min(12, capV) };
      })
      .filter((x) => !dose || x.faisable)
      .sort((a, b) => ((prioV ? (((b.m._troisT ?? -1) > st.t) - ((a.m._troisT ?? -1) > st.t)) : 0)   // (218c, V.relaisPrio) LE RELAIS CHAUD FAISABLE PASSE DEVANT : sans bloqueur la marge d'un appui vaut 99 et écrasait le coureur (marge 1-3 + bonus) — 11 murs en une touche, 1 retour ; absente : le barème d'hier
        || ((b.marge + ((b.m._troisT ?? -1) > st.t ? (V ? (V.bonus3 ?? 1.5) : (UT.bonus3 ?? 1.5)) : 0))
        - (a.marge + ((a.m._troisT ?? -1) > st.t ? (V ? (V.bonus3 ?? 1.5) : (UT.bonus3 ?? 1.5)) : 0)))))[0];   // le coureur du relais d'abord (lot 111)
    if (!mate) refus('ut-candidat');
    if (mate) {
      st.passes++; st.best = Math.max(st.best, st.passes);
      st.events.push({ t: +st.t.toFixed(2), type: 'receive', by: p.id, count: st.passes });
      st.lastTouch = p.team;
      const sigU = (p.skill?.passSigma ?? cfg.execSigma ?? 0.044) * (pressOk ? 1.6 : 1.3);
      const yawU = Math.atan2(mate.c[1] - p.p[2], mate.c[0] - p.p[0]) + gauss(st.rnd ?? (() => 0.5)) * sigU;   // (218) vers la cible (la course du relais)
      // …ET LE RENVOI S'AMORTIT (lot 51 — « des contrôles pas beaux ») : une première intention
      // DÉVIE le flux, elle ne le renverse pas pleine vitesse (mesuré : un vol de 7 m/s renvoyé
      // à ~180° instantanément — physiquement absurde, visuellement du ping-pong). La vitesse
      // sortante se borne à l'angle de déviation : dans le flux → pleine (12), perpendiculaire
      // → 8, à contre-courant → 4 (le LAYOFF du vrai football : la remise en retrait est douce).
      const bvl = hyp(st.ball.v[0], st.ball.v[2]) || 1;
      const cosDev = ((mate.c[0] - p.p[0]) * st.ball.v[0] + (mate.c[1] - p.p[2]) * st.ball.v[2]) / (mate.d * bvl);
      // …dosée : la vitesse RÉSOLUE qui arrive prenable (le filtre de faisabilité a déjà
      // garanti qu'elle tient sous le cap de déviation — le layoff reste doux ET arrive)
      const spdU = mate.sol ? mate.sol.speed
        : Math.min(Math.min(12, Math.max(6, mate.d * 0.85)), 4 + 8 * (0.5 + 0.5 * cosDev));
      st.ball.strike({ speed: spdU, dirYaw: yawU, elevation: 0.03, spinAxis: [0, 1, 0], spinRev: 0 });
      // LA PERCEPTION A UNE HORLOGE (le contrat de strikeNow, complété lot 50) : une première
      // intention n'a PAS d'armé — seen 0, TOUT LE MONDE paie sa réaction pleine. Mesuré avant :
      // 0/39 fenêtres posées — la passe la moins lisible du football était la seule que la
      // défense lisait instantanément (armée : 135/135, l'armé vu remboursait les regardeurs).
      // …le CALME SE LIT (lot 111 — l'isolation A/B : le socle à seen 0 dopait de +11 buts/
      // 20 matchs) : la une-touche CHOISIE s'oriente avant — elle se lit comme une passe armée
      // (seenCalme ≥ la réaction max = lecture pleine) ; SEUL le réflexe pressé surprend.
      st._surprise = { t: st.t, seen: pressOk ? 0 : (UT.seenCalme ?? 0.3), n: (st._surprise?.n ?? 0) + 1 };
      st.pass = { from: p.id, to: mate.m.id, lead: [mate.c[0], 0, mate.c[1]], style: 'une-touche', t: st.t, flight: mate.sol ? mate.sol.flightTime : mate.d / (spdU * 0.97), origin: [p.p[0], p.p[2]] };
      // …la une-touche NOURRIT LA FIXATION aussi (lot 98 — le même registre que beginPass) :
      // c'est même LA passe qui fixe le mieux (le une-deux côté ballon du vrai football)
      if (cfg.renversement && st.full) {
        const zS = Math.abs(p.p[2]) < 4 ? 0 : Math.sign(p.p[2]);
        const F = st._fix;
        st._fix = F && F.team === p.team && (zS === 0 || F.side === 0 || F.side === zS)
          ? { team: p.team, side: zS || F.side, n: F.n + 1 } : { team: p.team, side: zS, n: 1 };
      }
      st.phase = 'flight'; st.possession.carrier = -1; st.hold = 0;
      st.events.push({ t: +st.t.toFixed(2), type: 'pass', style: 'une-touche', by: p.id, to: mate.m.id, d: +mate.d.toFixed(1), ...(pressOk ? {} : { calme: true }) });
      return true;
    }
  }
  return false;
}
import { hyp } from './hyp.js';
