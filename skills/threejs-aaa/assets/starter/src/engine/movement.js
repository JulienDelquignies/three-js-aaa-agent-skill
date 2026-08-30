// movement.js — LE PAS DES CORPS : allures par métier, inertie, ruptures de rythme (appels,
// chasses), séparation des corps. Sorti de rondo.js au lot 22 (volumétrie) — au bit près, la
// batterie est la preuve. Une famille par fichier : le cerveau décide, le mouvement PORTE.
import { winding } from './gesture.js';
import { momentDuJeu } from './phases.js';
import { dansCone } from './dribble.js';

const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Move every player toward their target with real acceleration limits. */
export function movePlayers(st, dt, cfg) {
  for (const p of st.players) {
    // a player on the ground after a slide does not run — mais l'EXPULSÉ (Loi 12) et le
    // REMPLACÉ en chemin (Loi 3) ne sont pas des corps au sol : leur down géant est un
    // drapeau d'inexistence pour les cerveaux (les filtres down<=0 les couvrent sans être
    // touchés), et EUX marchent vers leur sortie (referee)
    if (p.down > 0 && !p.expulse && !p._sub) {
      p.down -= dt;
      if (p.down <= 0 && p.keeper && st.full) p._upAt = st.t;   // le relevé DATÉ (lot 106 — lu sous cfg.releveTrot seulement)
      // …ET LA GLISSADE PORTE LE CORPS (lot 51, match — p._glisse posé au lancement du tacle) :
      // un corps cloué SUR PLACE à 1,3-2,6 m du ballon rendait le contact impossible (1 pris/9
      // mesurés) — et le monde d'hier masquait l'absence de glisse en téléportant la déviation
      // pendant que le corps restait derrière (« le ballon part tout seul »). Lancé à sa vitesse
      // de déclenchement, freiné exponentiellement (~1,4-1,8 m parcourus) — le pied ARRIVE.
      const g = p._glisse;
      if (g && st.full) {
        const k = Math.exp(-2.5 * dt);
        g.v[0] *= k; g.v[1] *= k;
        p.p[0] = Math.max(-st.area[0] / 2, Math.min(st.area[0] / 2, p.p[0] + g.v[0] * dt));
        p.p[2] = Math.max(-st.area[1] / 2, Math.min(st.area[1] / 2, p.p[2] + g.v[1] * dt));
        p.v[0] = g.v[0]; p.v[1] = g.v[1]; p.speed = Math.hypot(g.v[0], g.v[1]);
        if (p.speed < 0.4) p._glisse = null;
        continue;
      }
      p.v[0] = 0; p.v[1] = 0; p.speed = 0; continue;
    }
    // UNE AUTORITÉ PAR CORPS. Pendant l'ARMÉ, c'est l'horloge de geste qui possède la POSITION
    // (le glissement sur l'ancre, stepGestures) ; `p.v` n'est alors qu'un RAPPORT du mouvement réel
    // (pour l'animation et l'inertie), pas un état à intégrer. L'intégrer quand même, c'est DEUX
    // écrivains sur le même corps : position posée + vitesse ré-intégrée = double pas, et l'erreur
    // se referme en oscillateur (v[n+1] = Δg/dt − v[n]) qui s'amplifie contre les bornes du carré —
    // mesuré à 15,7 m/s sur un glissement de 28 cm, contre le mur, l'ancre 27 cm dehors. Le
    // follow-through (après contact), lui, reste au modèle de course : l'élan se dissipe, il ne
    // se fige pas. (Le lacet a la même loi depuis toujours : « A SWING OWNS THE BODY ».)
    // …et un geste technique possède le corps AU-DELÀ du contact : le râteau tourne le lacet
    // pendant l'accompagnement, la semelle tient le corps immobile sur son ballon — stepGestures
    // écrit, movePlayers se tait (ownsBody : même loi, fenêtre élargie).
    if (winding(p) || p.act?.payload?.ownsBody) { p.speed = Math.hypot(p.v[0], p.v[1]); continue; }
    // LA COURSE S'ENGAGE ET SE FINIT (lot 135, cfg.engagement && st.full — mesuré : 52 % des
    // courses off-ball meurent < 1,2 s, 26 % des sauts de cible > 5 m (p90 15 m), 24 % de
    // piétinement : le cerveau re-cible à 60 Hz, les corps FRÉMISSENT — « pas un vrai match »).
    // Les jobs de POSTURE (support/cover/walk) adoptent une COURSE ENGAGÉE : la cible ne se
    // réécrit que si la voulue s'en écarte de > drift ET que la tenue est écoulée — en dessous
    // la même course s'affine (couche morte). Press/receive/intercept/carry, les bursts et le
    // marquage (sa propre hystérésis, lot 96) restent à la frame. false : le frémissement d'hier.
    if (st.full && cfg.engagement !== false && p.target && !p.keeper
      && (p.job === 'support' || p.job === 'cover' || p.job === 'walk')
      && !((p._pace?.until ?? -1) > st.t)) {
      const E = cfg.engagement === true || cfg.engagement == null ? {} : cfg.engagement;
      const R = p._runT;
      const drift = R ? Math.hypot(p.target[0] - R[0], p.target[2] - R[2]) : Infinity;
      if (!R || (drift > (E.drift ?? 2.5) && st.t >= (p._runUntil ?? 0))) {
        p._runT = [p.target[0], 0, p.target[2]];
        p._runUntil = st.t + (E.tenue ?? 1.4);
      }
      p.target = p._runT;
    }
    let top = (cfg.speeds[p.job === 'press' || p.job === 'intercept' || p.job === 'receive' ? 'chase'
      : p.job === 'carry' ? 'carry' : p.job === 'cover' ? 'press'
      : p.job === 'mark' ? (cfg.speeds.mark != null ? 'mark' : 'support')
      : p.job === 'walk' ? (cfg.speeds.walk != null ? 'walk' : 'support')
      : p.job === 'keeper' ? (cfg.speeds.keeper != null ? 'keeper' : 'press') : 'support'] ?? cfg.speeds.support)
      * (p.skill?.topF ?? p.persona?.paceBias ?? 1) * (p.job === 'walk' ? (p._walkF ?? 1) : 1);   // le retour pressé/flâné (183, cfg.retourTrot — posé par le match)   // la NOTE de vitesse fait foi ; sinon l'accent persona
    // LE PORTEUR COURT SUR SA TOUCHE (cfg.carrySurge, match — absent : le rondo au bit près).
    // L'allure de conduite (4,2) est celle du ballon COLLÉ ; une touche poussée devant se
    // rattrape EN POINTE. Mesuré avant : 6,4 % des images de conduite à > 2 m avec un porteur
    // plafonné à 4,0 m/s, 0,77-1,28 s pour revenir dessus — « des ballons loin des joueurs
    // pendant les conduites de balle » (retour utilisateur, troisième passe).
    // …mais JAMAIS le gardien : sa touche poussée se distribue, elle ne se sprinte pas (le
    // gardien-attaquant à 87 m vivait aussi de cette pointe ; champ absent au rondo — neutre)
    // …et pendant la TOUCHE DE PRÉPARATION (p._prepShot, posé par tryShot), la pointe s'arme
    // plus tôt (0,95 au lieu de 1,25) : la bande morte entre la portée de touche (1,15) et le
    // seuil de pointe laissait le porteur plafonné à l'allure de conduite face à un ballon qui
    // décélérait vers la même allure — bd cloué à 1,2-1,3 pendant TOUTE l'approche (mesuré),
    // la touche serrée ne mordait jamais, le tir jamais armé.
    if (cfg.carrySurge && p.job === 'carry' && !p.keeper && st.possession.carrier === p.id
      && d2(p.p, st.ball.p) > ((p._prepShot ?? -1) > st.t ? 0.95 : cfg.carrySurge.at)) {
      top = Math.max(top, cfg.carrySurge.top * (p.skill?.topF ?? p.persona?.paceBias ?? 1));
    }
    // LA FATIGUE PLIE LA POINTE (cfg.fatigue && st.full, lot 31) — UN effet v1, une autorité :
    // le plafond de vitesse perd jusqu'à `cap` (15 %) quand l'essence est à zéro. Le drain vit
    // en fin de pas (après l'intégration), l'attribut stamina le module, la précision fatiguée
    // est une dette nommée. Clé absente : le rondo et le réduit d'hier, au bit près.
    if (cfg.fatigue && st.full) top *= 1 - (cfg.fatigue.cap ?? 0.15) * (1 - (p.stam ?? 1));
    // LE BACKPEDAL DU LIBÉRO (lot 120, cfg.libero && st.full) : le gardien AVANCÉ qui rentre
    // revient FACE AU JEU — en reculant (retour m/s), pas en sprint dos au ballon. C'est LE
    // prix du gardien-libéro : sans lui, le retour à ~7 m/s effaçait la fenêtre du lob
    // (mesuré : 0 frame de gardien ≥ 3 m avec un porteur adverse à 18-38 m) — et un geste de JEU
    // COURANT : sur coup de pied arrêté le jeu est mort, il se retourne et COURT à son poste
    // (banc 94 : 2,2 s de pose ne suffisaient pas au recul de 10 m). Clé absente : hier.
    if (st.full && cfg.libero && p.keeper && st.pitch && p.target && !st.restart) {
      const gL = st.pitch.ownGoal(p.team);
      const offNow = Math.abs(p.p[0] - gL.x), offTgt = Math.abs(p.target[0] - gL.x);
      if (offNow > 3 && offTgt < offNow - 0.5) top = Math.min(top, cfg.libero.retour ?? 3.5);
    }
    // LE MORDU D'UNE FEINTE S'ASSOIT SUR SA LIGNE MORTE : il a lancé son appui vers la fausse
    // passe — accélération ET pointe au ralenti le temps de la morsure (skill.biteSlow). C'est le
    // POURQUOI de la feinte : sans coût pour le défenseur, elle ne serait qu'une pantomime.
    const bitten = (p._bite ?? -1) > st.t;
    if (bitten) top *= cfg.skill?.biteSlow ?? 0.35;
    // LES RUPTURES DE RYTHME. Le calme de la refonte tempo a tué la panique — et avec elle le
    // CONTRASTE : un rondo réel vit en marche… coupée d'APPELS (un soutien qui claque 3 m pour
    // ouvrir une ligne) et de CHASSES (le presseur qui jaillit sur la touche de passe). Cadence
    // tirée du rnd SEEDÉ, fréquence par persona.burstiness — chaque rupture est un ÉVÉNEMENT
    // nommé, donc mesurable (clauses de bandes d'allure dans verify-rondo).
    if (!p._pace) p._pace = { until: -1, next: 2 + (st.rnd ? st.rnd() : 0.5) * 5 };
    const settled = st.phase === 'carry' && st.hold > 0.6;
    if (st.t >= p._pace.next && p._pace.until < st.t) {
      const bz = p.persona?.burstiness ?? 1;
      if (p.job === 'support' && settled) {
        p._pace.until = st.t + 0.7 + (st.rnd ? st.rnd() : 0.5) * 0.4;
        p._pace.kind = 'appel';
        st.events.push({ type: 'burst', kind: 'appel', by: p.id, t: +st.t.toFixed(2) });
      }
      p._pace.next = st.t + (6 + (st.rnd ? st.rnd() : 0.5) * 6) / Math.max(0.4, bz);
    }
    // …la chasse est l'affaire du PLUS PROCHE : première version, chaque presseur ET chaque
    // intercepteur jaillissait sur chaque passe — 155 chasses en 120 s, 94 ruptures/min, la frénésie
    // que la refonte tempo venait d'éteindre. Un seul défenseur claque sur la touche de passe.
    // …APRÈS SA RÉACTION (lot 81, même clé que la loi du receveur — l'équité de lecture EST la
    // loi) : la gâchette instantanée donnait au voleur 2 m d'avance sur le receveur qui, lui,
    // paie sa latence ; les deux corps lisent le départ du ballon au prix du même attribut.
    const chR = st.full && cfg.attaquePasse !== false ? (p.skill?.reaction ?? 0.18) : 0;
    if ((p.job === 'press' || p.job === 'intercept') && st.pass
      && st.t - st.pass.t > chR && st.t - st.pass.t < 0.5 + chR
      && p._pace.until < st.t && !st.pass._chased) {
      const dMe = Math.hypot(p.p[0] - st.ball.p[0], p.p[2] - st.ball.p[2]);
      const nearest = st.players.every((q) => q === p || q.team === p.team || q.down > 0
        || (q.job !== 'press' && q.job !== 'intercept')
        || Math.hypot(q.p[0] - st.ball.p[0], q.p[2] - st.ball.p[2]) >= dMe - 1e-9);
      if (nearest) {
        st.pass._chased = true;
        p._pace.until = st.t + 0.9;
        p._pace.kind = 'chasse';
        st.events.push({ type: 'burst', kind: 'chasse', by: p.id, t: +st.t.toFixed(2) });
      }
    }
    // LE LECTEUR DE TRAJECTOIRE (168, cfg.lectureCourse && st.full) : sur un PIQUÉ
    // (st.pass.through), le défenseur de champ le plus proche de la trajectoire restante part
    // au point de COUPE — s'il y arrive avant le ballon — après sa latence de LECTURE :
    // reaction × (2 − anticipF). Le lecteur (anticipation 90) jaillit à ~0,12 s, l'aveugle à
    // ~0,35 s : la note DÉFENSIVE répond à la note du passeur — le duel de la passe en
    // profondeur a ses deux camps. Un seul lecteur par piqué. Clé absente : hier au bit.
    if (st.full && cfg.lectureCourse && st.pass?.through && !st.pass._lu && !p.keeper
      && p.team !== st.players[st.pass.from]?.team && p.down <= 0 && p._pace.until < st.t
      && st.t - st.pass.t > (p.skill?.reaction ?? 0.18) * (2 - (p.skill?.anticipF ?? 1))) {
      const L = st.pass.lead, bX = st.ball.p[0], bZ = st.ball.p[2];
      const ux = L[0] - bX, uz = L[2] - bZ, len = Math.hypot(ux, uz) || 1;
      const along = ((p.p[0] - bX) * ux + (p.p[2] - bZ) * uz) / len;
      if (along > 1 && along < len - 1) {
        const cX = bX + (ux / len) * along, cZ = bZ + (uz / len) * along;
        const dMoi = Math.hypot(p.p[0] - cX, p.p[2] - cZ);
        const vB = Math.max(3, Math.hypot(st.ball.v[0], st.ball.v[2]));
        if (dMoi < (cfg.lectureCourse.porte ?? 4) && dMoi / 6.4 < along / vB - 0.05
          && st.players.every((q) => q === p || q.team === p.team || q.keeper || q.down > 0
            || Math.hypot(q.p[0] - cX, q.p[2] - cZ) >= dMoi - 1e-9)) {
          st.pass._lu = true;
          p.job = 'intercept'; p.target = [cX, 0, cZ];
          p._pace = { until: st.t + 0.9, kind: 'lecture', next: p._pace?.next ?? st.t + 8 };
          st.events.push({ type: 'burst', kind: 'lecture', by: p.id, t: +st.t.toFixed(2) });
        }
      }
    }
    // LE PREMIER PAS AU 50/50 (lot 153, cfg.premierPas — l'égalisateur nommé au 152 : les
    // seconds ballons se gagnaient au PLUS PROCHE, jamais au plus VIF). Le chasseur NOTÉ
    // LENT paie l'excédent de sa réaction sur le joueur moyen (0,22 s) : il TROTTE avant de
    // sprinter — ±0,16 s d'écart = ~1 m par duel, LE différentiel du foot réel. No-op exact
    // à 50 (excédent 0) et au monde nu (pas de skill) ; le vif est déjà au plancher.
    if (st.full && cfg.premierPas !== false && p.skill && st._looseAt2 != null
      && (p.job === 'press' || p.job === 'receive' || p.job === 'intercept')
      && st.t - st._looseAt2 < (p.skill.reaction - 0.22) * 2.5) top *= 0.1;   // …PLANTÉ pendant son délai (×0,55 ne mordait pas : l'accélération vit sous le plafond)
    const bursting = p._pace.until > st.t;
    // …la SORTIE DE GESTE explose plus fort que la rupture ordinaire (122, sortieBurst.top —
    // l'élimination réussie ouvre l'espace : le corps le PREND ; clé absente : le ×1,28 d'hier)
    if (bursting) top = Math.min(top * (p._pace.kind === 'sortie-geste' ? (cfg.skill?.sortieBurst?.top ?? 1.28) : 1.28), cfg.sprintMax ?? 8.0);
    // …et entre les ruptures, un soutien posé MARCHE — QUAND IL EST À SON POSTE (lot 82,
    // clé settledNear, défaut Infinity = marche d'hier au bit : mesuré 10,7 m p50 du slot,
    // le soutien vivait à mi-chemin près du ballon — activer 5 le fait trotter au poste).
    else if (p.job === 'support' && settled
      && (!st.full || !p.target || d2(p.p, p.target) < (cfg.settledNear ?? Infinity))) top = Math.min(top, cfg.settledWalkCap ?? 1.35);
    // UN SOUTIEN PRÈS DE SA STATION AJUSTE PAR PETITS PAS. Mesuré (sonde tempo-espaces) : les
    // non-porteurs vivaient à p50 3,0-3,5 m/s, sprint > 4,5 m/s un quart du temps, dans un carré de
    // 16 × 14 m — la panique, pas du soutien. À moins de 3 m de sa station, la vitesse d'un soutien
    // est celle d'un ajustement (supportNearCap), pas d'une course.
    if (p.job === 'support' && p.target) {
      const dS = Math.hypot(p.target[0] - p.p[0], p.target[2] - p.p[2]);
      if (dS < 3) top = Math.min(top, cfg.supportNearCap);
    }
    // LE RELEVÉ REPART AU TROT (lot 106, cfg.releveTrot && st.full — « la vitesse du relevé
    // pas réaliste ») : le gardien qui vient de se relever TROTTE (dur s), sauf ballon vivant
    // dans SA surface (l'urgence reste l'urgence). Mesuré avant : p90 4,1 m/s dans la seconde
    // suivant le relevé — le sprint de replacement. Absente : la course d'hier au bit.
    if (st.full && cfg.releveTrot && p.keeper && p._upAt != null && st.t - p._upAt < (cfg.releveTrot.dur ?? 2)) {
      const ogR = st.pitch?.ownGoal?.(p.team);
      // l'urgence = le ballon LIBRE dans sa surface (le ballon qu'il TIENT n'en est pas une)
      const urg = ogR && st.ball.owner !== p.id && st.pitch.inBox(st.ball.p[0], st.ball.p[2], Math.sign(ogR.x));
      if (!urg) top = Math.min(top, cfg.releveTrot.cap ?? 3.2);
    }
    // LE PIVOT DE REPRISE (lot 104, cfg.pivotReprise && st.full — « la balle échappe au porteur
    // sans être gêné ») : le ballon de conduite passé DANS LE DOS ne se reprend pas en ORBITE
    // (mesuré : 2 s à tourner autour à 2-3 m/s, cône 150-170°, l'adversaire cueille) — le vrai
    // corps FREINE, pivote face au ballon (le slew gagne dès que le drift cesse), reprend.
    // Clé absente/false : l'orbite d'hier au bit.
    if (st.full && cfg.pivotReprise && p.job === 'carry' && st.ball.owner == null && !p.keeper) {
      const dB = Math.hypot(st.ball.p[0] - p.p[0], st.ball.p[2] - p.p[2]);
      if (dB < (cfg.pivotReprise.d ?? 1.9)
        && !dansCone(p.yaw, p.p[0], p.p[2], st.ball.p[0], st.ball.p[2], cfg.pivotReprise.cone ?? 110))
        top = Math.min(top, cfg.pivotReprise.cap ?? 0.8);
    }
    // LES APPUIS DU DÉFENSEUR (lot 95, cfg.jockey && st.full — le même patron côté duel) : un
    // presseur PRÈS d'un porteur POSSÉDÉ arrive SOUS CONTRÔLE (appuis courts — 70 % des entrées
    // en duel mesurées lancées > 3,5 m/s : le crochet offert, « la défense se jette »). L'AGILITÉ
    // est le facteur (le souple ajuste plus vite en restant posé) ; le ballon LIBRE se gagne
    // plein fer, et le mordu d'une feinte paie DÉJÀ sa morsure (biteSlow — les lois se composent).
    if (st.full && cfg.jockey !== false && p.job === 'press' && !p.keeper) {
      const cJ = st.players[st.possession.carrier];
      if (cJ && cJ.team !== p.team && st.ball.owner === cJ.id
        && d2(p.p, cJ.p) < ((cfg.jockey === true ? null : cfg.jockey)?.at ?? 3.0)) {
        top = Math.min(top, (((cfg.jockey === true ? null : cfg.jockey)?.cap ?? 2.9)) * (2 - (p.skill?.getupF ?? 1)));
      }
    }
    // L'ÉCONOMIE DE COURSE (cfg.allure && st.full — lot 57, retour utilisateur « fourmilière ») :
    // l'allure est une DÉCISION TACTIQUE, pas un plafond. La loi tient en une phrase : EN JEU
    // PLACÉ, ON SUIT LE JEU À LA VITESSE DU JEU — un suiveur (marqueur, poste qui coulisse,
    // couverture) est plafonné par la vitesse de SA CIBLE, et la COURSE reste entière pour tout
    // ce qui est nommé : les TRANSITIONS (phases.js, 5 s — le contre et le contre-press SONT des
    // courses), la FENÊTRE DE PRESSING de mon équipe (l'acte est collectif : tout le bloc monte),
    // les BURSTS (appel/chasse), le porteur, le receveur, le gardien, et l'URGENCE locale — mon
    // territoire attaqué (ballon à < chaud, vol qui retombe chez moi) ou mon homme qui claque
    // (> manRun ; le coulissement d'urgence du renversement passe par là : les spots sautent).
    // Un corps à cible posée + ballon loin (> calme) MARCHE. Mesuré avant : 32 % du off-ball en
    // course > 4,5 m/s, 11/20 corps lancés simultanés p50 (p90 18). Doc : match-config.
    if (st.full && cfg.allure !== false && !p.keeper && p.down <= 0
      && p.job !== 'carry' && p.job !== 'receive' && p.job !== 'walk'
      && !((p._pace?.until ?? -1) > st.t)) {
      const A = cfg.allure === true || cfg.allure == null ? {} : cfg.allure;
      const enPress = st._press && st._press.until > st.t && st._press.team === p.team;
      const moment = momentDuJeu(st, p.team, A.fenetre ?? 5);
      if (!enPress && (moment === 'attaque-placée' || moment === 'défense-placée')) {
        const dB = d2(p.p, st.ball.p);
        let tSpd = 0;
        if (p.target) {
          const pv = p._tgtPrev;
          if (pv && pv.t < st.t) tSpd = Math.hypot(p.target[0] - pv.x, p.target[2] - pv.z) / Math.max(1e-3, st.t - pv.t);
          p._tgtPrev = { x: p.target[0], z: p.target[2], t: st.t };
          if (tSpd > 9) tSpd = 0;   // un saut de cible est une RÉAFFECTATION, pas le jeu qui bouge : on y va au trot
        }
        const volVersMoi = st.pass && st.pass.lead
          && Math.hypot(p.p[0] - st.pass.lead[0], p.p[2] - st.pass.lead[2]) < (A.chaud ?? 14);
        if (!(dB < (A.chaud ?? 14) || volVersMoi || tSpd > (A.manRun ?? 3.5))) {
          // …à la vitesse du jeu, LITTÉRALEMENT : le plafond suit la cible (+15 % et 0,4 m/s de
          // convergence), borné [marche, trot] — un bloc qui coulisse sur une circulation lente
          // se déplace en marchant, pas au trot réglementaire (mesuré : p50 8 corps > 2,5 m/s
          // en placé calme avec le trot fixe — le pas suivait le plafond, pas le jeu).
          // …ET LOIN DE SON POSTE, ON TROTTE (rattrape 12 m ≈ p75 de l'équilibre mesuré — un
          // suiveur de spot qui coulisse VIT à 6-11 m de sa cible, ce n'est pas du retard) : le
          // DÉPLACÉ structurel (queue p90 20 m : l'étirement offensif, la montée de ligne,
          // l'occupation des postes — 3 clauses tactiques rouges à 6 m près) rejoint au trot.
          // …et l'économie est ASYMÉTRIQUE comme le bloc : en ATTAQUE placée on OCCUPE vite la
          // largeur et la profondeur (trotAtk — se démarquer est une intention), en défense on
          // économise (le bloc compact n'a pas 12 m à faire). Mesuré sans : l'étirement offensif
          // fondait (asymétrie attaque 30,9 < défense + 4, la clause du bloc court).
          const trotB = moment === 'attaque-placée' ? (A.trotAtk ?? 3.9) : (A.trot ?? 3.4);
          const dTgt = p.target ? Math.hypot(p.target[0] - p.p[0], p.target[2] - p.p[2]) : 0;
          // …ET LE RATTRAPAGE OFFENSIF EST UN LEVIER, PAS UNE LOI DU DÉFAUT (lot 68,
          // A.rattrapeAtk — résultat négatif CONSIGNÉ) : pour guérir « le latéral opposé des
          // dizaines de mètres derrière », on a d'abord raccourci le rattrapage d'attaque
          // (6, puis 8 — le latéral trottait vers son poste au lieu d'y marcher)… et la MARÉE
          // (tout le bloc posté au trot) a suralimenté le siège : décomposé sur 20 graines ×
          // 300 s, rattrapeAtk seul = 33 buts, avec rentre = 37-39 (bande 17-33 crevée), rentre
          // SEUL = 22 (l'innocent). La vraie guérison du transit était l'ANCRE LENTE du tuck :
          // un poste STABLE se rejoint même au pas (2,1 m/s × 5 s = 10 m), et le latéral qui
          // referme GLISSE, il ne sprinte pas. Défaut 12 = symétrique de la défense (neutre) ;
          // la clé reste injectable pour un style d'occupation agressif aval.
          const ratt = moment === 'attaque-placée' ? (A.rattrapeAtk ?? A.rattrape ?? 12) : (A.rattrape ?? 12);
          const suivre = dTgt > ratt ? trotB
            : clamp(tSpd * 1.15 + 0.4, A.marche ?? 2.1, trotB);
          top = Math.min(top, tSpd < 1.0 && dTgt <= ratt && dB > (A.calme ?? 24) ? (A.marche ?? 2.1) : suivre);
        }
      } else if (p.target) p._tgtPrev = { x: p.target[0], z: p.target[2], t: st.t };
    }
    let wx = 0, wz = 0;
    if (p.target) {
      const dx = p.target[0] - p.p[0], dz = p.target[2] - p.p[2];
      const d = Math.hypot(dx, dz);
      if (d > 0.18) { const s = Math.min(top, d * 2.6); wx = (dx / d) * s; wz = (dz / d) * s; }
    }
    // LA DEMANDE DES RÔLES CALMES EST LISSÉE (τ = wantTau). La cible de marche des soutiens sautait
    // de plusieurs mètres en une image (churn mesuré 18-19 m/s) et la locomotion vivait en
    // bang-bang : 59 % des images joueur pile à la saturation du cap (sonde allures-inclinaison).
    // Les rôles de course (press/intercept/receive/carry) gardent la demande vive — la course
    // d'interception est le miroir exact du modèle que flightRace fait courir. (Résultat négatif
    // consigné : exempter AUSSI le marqueur pour vider la zone du ballon n'a presque rien rendu sur
    // l'essaim — both<2,5 m 58 → 49-61 % — et a durci la défense au point de faire tomber la
    // balance : record moyen 8,4 → 6,8, frappes 43,9 → 40,3. Le marqueur reste lissé.)
    if ((p.job === 'support' || p.job === 'mark') && !bursting) {
      const aW = 1 - Math.exp(-dt / Math.max(1e-3, cfg.wantTau ?? 0.12));
      p._wx = (p._wx ?? wx) + (wx - (p._wx ?? wx)) * aW;
      p._wz = (p._wz ?? wz) + (wz - (p._wz ?? wz)) * aW;
      wx = p._wx; wz = p._wz;
    } else { p._wx = wx; p._wz = wz; }
    // TURNING COSTS, AND THE FASTER YOU GO THE WIDER YOU TURN. Acceleration used to be isotropic:
    // 9.5 m/s² in any direction, so a defender at a full 6.6 m/s sprint could reverse as sharply as a
    // man standing still. With no momentum to beat, a feint cannot pay — which is why scoring the
    // carrier's escape direction changed nothing on its own (separation 1.67 → 1.64 m). Splitting the
    // demand into ALONG the current velocity (drive/brake) and PERPENDICULAR to it (turn), and capping
    // the perpendicular part, gives an angular rate of turnAccel/v for free: at 6.6 m/s that is 52°/s,
    // at 3 m/s it is 115°/s. The slower carrier out-turns the quicker presser — which is the actual
    // advantage a dribbler has over a defender, and now it exists in the model instead of in the prose.
    const dvx = wx - p.v[0], dvz = wz - p.v[1];
    const sp0 = Math.hypot(p.v[0], p.v[1]);
    // le mordu paie AUSSI en actionneurs : son appui est parti du mauvais côté — freiner comme
    // tourner lui coûtent le facteur de morsure, en plus de la pointe (le modèle d'inertie fait le
    // reste : c'est lui que la feinte bat, exactement comme le commentaire ci-dessus l'annonçait)
    const kBite = (bitten ? (cfg.skill?.biteSlow ?? 0.35) : 1) * (p.skill?.accelF ?? 1);   // …et le DÉMARRAGE aussi
    if (sp0 > 0.4) {
      const ux = p.v[0] / sp0, uz = p.v[1] / sp0;
      const along = clamp(dvx * ux + dvz * uz, -cfg.accel * kBite * dt, cfg.accel * kBite * dt);
      let latx = dvx - (dvx * ux + dvz * uz) * ux, latz = dvz - (dvx * ux + dvz * uz) * uz;
      const lat = Math.hypot(latx, latz), cap = cfg.turnAccel * kBite * dt;
      if (lat > cap) { latx *= cap / lat; latz *= cap / lat; }
      p.v[0] += along * ux + latx; p.v[1] += along * uz + latz;
    } else {                                     // at a standstill there is no momentum to fight
      p.v[0] += clamp(dvx, -cfg.accel * kBite * dt, cfg.accel * kBite * dt);
      p.v[1] += clamp(dvz, -cfg.accel * kBite * dt, cfg.accel * kBite * dt);
    }
    p.p[0] += p.v[0] * dt; p.p[2] += p.v[1] * dt;
    // LE TABLIER (cfg.apron, 0 par défaut — le rondo garde ses murs au bit près) : en match, un
    // corps peut ENJAMBER la ligne — le preneur d'une remise va chercher un ballon sorti, le
    // tireur de touche se poste dehors. Sans ça, le ballon freiné à 1 m derrière la ligne était
    // INATTEIGNABLE (le preneur pédalait contre la borne, remise jamais posée, jeu gelé — mesuré :
    // en-jeu 63 %, une graine sans une seule visite d'un camp).
    const apron = cfg.apron ?? 0;
    p.p[0] = clamp(p.p[0], -st.area[0] / 2 - apron, st.area[0] / 2 + apron);
    p.p[2] = clamp(p.p[2], -st.area[1] / 2 - apron, st.area[1] / 2 + apron);
    p.speed = Math.hypot(p.v[0], p.v[1]);
    // LE DRAIN DE FATIGUE (cfg.fatigue && st.full, lot 31) : l'effort au carré + un socle,
    // une récup légère sous 1,5 m/s — le tout À L'ÉCHELLE DU FORMAT (horizon = durée
    // nominale du match configuré : un moteur réutilisable ne code pas « 90 minutes » en
    // dur) ; l'endurance NOTÉE module (skill.stamF). L'état q.stam ∈ [0;1] est l'API du
    // projet — la politique de banc (Loi 3) le lit, le moteur ne décide pas qui sort.
    if (cfg.fatigue && st.full) {
      const H = cfg.fatigue.horizon ?? ((cfg.chrono?.periodes ?? 2) * (cfg.chrono?.duree ?? 180));
      p.stam ??= 1;
      const eff = Math.min(1, p.speed / 6.5);
      if (p.speed > 1.5) p.stam -= (2.2 * eff * eff + 0.35) * (dt / H) * (p.skill?.stamF ?? 1);
      else p.stam += 0.15 * (dt / H);
      p.stam = Math.max(0, Math.min(1, p.stam));
      if (p.stam < 0.35 && !p._fatEv) { p._fatEv = 1; st.events.push({ t: +st.t.toFixed(2), type: 'fatigue', by: p.id, stam: +p.stam.toFixed(2) }); }
    }
    // A SWING OWNS THE BODY. Once he has started it, his facing is locked: he does not re-aim with his
    // drift and he does not keep turning onto a new target. Without this, the gesture gated the strike
    // on the geometry at COMMIT and then let the body rotate for the whole 0.4 s of the windup, so the
    // ball could be dead behind him by the time the boot arrived — `ball-ahead-at-strike` 16.7 %. You
    // commit your body when you commit your gesture; that IS what committing means.
    if (p.act) continue;
    // …pendant la PRÉSENTATION (lot 70, plus bas), l'autorité du cap est le BALLON, pas la
    // dérive : le piétinement de la statue vivante (> 0,25 m/s) re-collait le yaw à chaque
    // frame et le slew ne gagnait jamais — mesuré : 24 % des réceptions encore dos APRÈS la
    // v1 de la loi (p90 156° au contact).
    const sePres = st.full && cfg.sePresente !== false && st.phase === 'flight' && st.pass?.to === p.id && p.speed < 2.2;
    // LE GARDIEN NE QUITTE PAS LE BALLON DES YEUX (lot 132, cfg.regardGardien && st.full —
    // mesuré : 3/20 plongeons déclenchés sur un regard > 60° du ballon, p90 107° — le côté
    // du clip se calculait sur la dérive de COURSE, le corps « se retournait ») : le yaw du
    // gardien suit son yawWant (posé vers le ballon chaque frame), le pas devient chassé —
    // le patron du backpedal libéro (120) généralisé. false : le regard de course d'hier.
    const regardGk = st.full && p.keeper && cfg.regardGardien !== false;
    if (p.speed > 0.25 && !sePres && !regardGk) {
      // LE YAW NE SE TÉLÉPORTE JAMAIS (lot 139, cfg.yawSlew && st.full — mesuré : pic p50
      // 807°/s, p90 6 168°/s autour des prises, 31 % des contrôles retournent > 90° en une
      // frame : quand p.v s'inverse à la prise, le cap la suivait INSTANTANÉMENT ; réel
      // 200-400°/s). Le cap de dérive passe par un SLEW borné — rate × accelF (l'explosivité
      // du joueur pivote son corps). false (et rondo/réduit) : le claquement d'hier au bit.
      const wantY = Math.atan2(p.v[1], p.v[0]);
      if (st.full && cfg.yawSlew !== false) {
        let dY = wantY - p.yaw;
        while (dY > Math.PI) dY -= 2 * Math.PI; while (dY < -Math.PI) dY += 2 * Math.PI;
        const capY = (cfg.yawSlew?.rate ?? 9.4) * (p.skill?.accelF ?? 1) * dt;
        p.yaw += Math.abs(dY) <= capY ? dY : Math.sign(dY) * capY;
      } else p.yaw = wantY;
    }
    // A MAN CARRYING THE BALL FACES HIS BALL — not his drift. For everyone else, facing = direction of
    // travel is right; for the carrier it is wrong, and wrong in the one place it shows. He stands
    // `carryStandoff` BEHIND the ball, so his velocity points at a spot behind it while the ball is in
    // front: derive his facing from the drift and his body ends up square to, or turned away from, the
    // thing at his feet. Measured as the share of passes struck with the ball more than 75° off his
    // shoulders — i.e. behind him — which the catalogue calls `ball-ahead-at-strike`.
    // The slew is the same law as the momentum model above (rate = turnAccel / speed), so pace still
    // costs agility: a man sprinting cannot snap his shoulders round onto the ball.
    if (p.job === 'carry') {
      // (172 — le « moonwalk » du gardien-porteur : DEUX canaux TENTÉS ET RÉFUTÉS à la mesure
      // (yaw-suit-v : 13,7 ≈ 14,7 % épinglé ; + hystérésis du target : 19,5 % — PIRE) — le
      // désalignement vient d'ailleurs (dette nommée : tracer un épisode, regarder le CLIP de
      // rendu). Le chemin d'hier, au bit :
      p.yawWant = p.push ? Math.atan2(p.push[1], p.push[0])
        : Math.atan2(st.ball.p[2] - p.p[2], st.ball.p[0] - p.p[0]);
    } else if (sePres) {
      // …ET UN RECEVEUR SE PRÉSENTE (lot 70) : le corps s'OUVRE au ballon qui arrive — un
      // statique gardait son cap fossile (yaw ne bouge qu'au-dessus de 0,25 m/s) : mesuré,
      // 23 % des vols arrivaient DANS LE DOS du receveur, 51/80 sur des immobiles — puis la
      // touche fantôme « le réoriente avec la balle sans le toucher » (retour utilisateur).
      // Même slew borné qu'en dessous (un demi-tour prend son temps), st.full — le rondo au
      // bit près. false : le dos fossile d'hier (sabotage nommé).
      const versB = Math.atan2(st.ball.p[2] - p.p[2], st.ball.p[0] - p.p[0]);
      // …EN DEMI-POSITION (170, cfg.corpsOuvert — retour utilisateur : « du mal à récupérer »,
      // mesuré : pivot post-réception 75° médian / 151° p90 — il recevait FACE au passeur,
      // dos au jeu, puis se retournait). Le vrai receveur ouvre son corps : une fraction du
      // chemin vers le JEU (le but adverse), capée, × visionF — celui qui SCANNE s'ouvre,
      // le faible regarde le ballon. Clé absente : la face pleine d'hier au bit.
      if (st.full && cfg.corpsOuvert && !p.keeper) {
        const gCO = st.pitch.attackGoal(p.team);
        const versJeu = Math.atan2(-p.p[2] * 0.3, gCO.x - p.p[0]);
        let dA = versJeu - versB;
        while (dA > Math.PI) dA -= 2 * Math.PI;
        while (dA < -Math.PI) dA += 2 * Math.PI;
        p.yawWant = versB + Math.sign(dA) * Math.min(Math.abs(dA), cfg.corpsOuvert.max ?? 1.2)
          * (cfg.corpsOuvert.part ?? 0.55) * Math.min(1.15, p.skill?.visionF ?? 1);
      } else p.yawWant = versB;
    } else if (regardGk && p.yawWant == null) {
      // …et quand rien d'autre ne pilote son regard (marche de relance), le gardien le pose
      // LUI-MÊME sur le ballon — le pas chassé a toujours une cible de regard.
      p.yawWant = Math.atan2(st.ball.p[2] - p.p[2], st.ball.p[0] - p.p[0]);
    }
    // A TURN TAKES TIME — this is the ONE place a facing may change, and it can only change at a
    // bounded rate. A first touch used to write `p.yaw = atan2(...)` directly: the man was simply
    // pointing somewhere else on the next frame, 180° in zero seconds. Nothing in the animation can
    // rescue that, because there is no interval to animate. Now the touch asks for a facing and he
    // turns ONTO it — which is also why he arrives at it a beat after the ball, like a real player.
    if (p.yawWant != null) {
      let d = p.yawWant - p.yaw;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      const rate = Math.max(cfg.turnRateMin, cfg.turnAccel / Math.max(1, p.speed));
      if (Math.abs(d) <= rate * dt) { p.yaw = p.yawWant; p.yawWant = null; }
      else p.yaw += Math.sign(d) * rate * dt;
    }
  }
}

// SEPARATION — une CONTRAINTE DU MONDE, pas un détail de la locomotion. Deux joueurs n'avaient
// rien qui les empêche d'occuper le même point : 28 % des images avec une paire sous 45 cm. Une
// passe de relaxation, chacun poussé de la moitié du chevauchement. ELLE SE PROJETTE EN DERNIER :
// tant qu'elle vivait DANS movePlayers, le glissement d'armé (stepGestures, autorité de position
// pendant le geste) réécrivait la position APRÈS elle et la défaisait — mesuré, le budget
// players-not-overlapping crevait (2,6 % > 2). L'ordre est une loi de charte : les autorités
// écrivent, puis le monde projette ses contraintes, une fois, à la fin.
export function separatePlayers(st, cfg) {
  // …ET LA DISTANCE SOCIALE DES COÉQUIPIERS (lot 86, cfg.social && st.full — mesuré : 1584
  // paires même équipe < 1,2 m / 15 min dont 52 % mark+mark, épisodes jusqu'à 11,5 s — « ils
  // se marchent dessus »). Deux coéquipiers DEBOUT, hors remise (le mur de la Loi 13 se serre),
  // hors geste, tiennent une distance de JEU — poussée DOUCE (≤ 0,04 m/frame : on s'écarte en
  // marchant, pas en téléportant). Le duel ADVERSE garde son contact (minGap physique seul).
  // false : les grappes d'hier (sabotage nommé).
  const social = st.full && cfg.social !== false && cfg.social != null ? cfg.social : 0;
  for (let i = 0; i < st.players.length; i++) {
    for (let j = i + 1; j < st.players.length; j++) {
      const a = st.players[i], b = st.players[j];
      const dx = b.p[0] - a.p[0], dz = b.p[2] - a.p[2];
      const d = Math.hypot(dx, dz);
      const gap = social && a.team === b.team && !st.restart && a.down <= 0 && b.down <= 0
        && !a.act && !b.act ? social : cfg.minGap;
      if (d >= gap || d < 1e-6) continue;
      const push = gap > cfg.minGap ? Math.min((gap - d) / 2, 0.04) : (gap - d) / 2;
      const ux = dx / d, uz = dz / d;
      a.p[0] -= ux * push; a.p[2] -= uz * push;
      b.p[0] += ux * push; b.p[2] += uz * push;
    }
  }
}
