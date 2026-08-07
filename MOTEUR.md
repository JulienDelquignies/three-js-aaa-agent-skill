# Le moteur de football Three.js — guide d'architecture et de greffe

Ce dépôt est un **moteur de football pour Three.js/WebGPU** : simulation prouvée en node (sans
navigateur), habillage 3D qui la copie, et une pyramide de vérification qui rend chaque loi
mesurable et chaque régression bruyante. Il est fait pour être **repris par un autre projet** —
ce guide dit quoi prendre, comment c'est architecturé, et où se greffe un moteur de match 11c11.

Démos vivantes : https://showcase-pi-mocha.vercel.app (rondo = `rondo.html`, match réduit =
`match.html`, **11 contre 11 plein format = `match11.html`**).

## Ce qu'il y a dans la boîte

- **La sim** (`src/engine/`, ~80 modules sans dépendance three pour le cœur) : ballon physique
  (traînée, Magnus, rebond), balistique inverse des passes, duels (tacle debout/glissé), gestes
  à trois temps (armé/contact/accompagnement), gestes techniques (râteau, feinte de passe, semelle,
  passement de jambes — simple/double, sorties fixer/contre-pied/temporiser —, crochet — court,
  standard, chaloupé —, feinte de frappe ; l'engagement et la vente lisent la note dribbling), tir,
  gardien (plongeon, sortie dans les pieds, un-contre-un, prise à deux mains), remises selon la
  règle, personas (identité de mouvement par joueur), latence de
  perception, terrain-donnée (réduit ET Loi 1).
- **L'habillage** : couche de geste absolue (pose = rest ⊗ spec), Motion Warping de contact
  générique — QUATRE consommateurs d'une même capacité : le pied de frappe (planaire, calibré en
  ligne), le gant du plongeon (planWarp3, IK deux os, time-warp du clip vers l'heure du ballon),
  la racine (le bassin complète la détente, borné) et le pied de conduite (chaque événement
  'touche' de la sim tend le pied vers le ballon — le contact invisible était lu « il ne touche
  jamais le ballon ») —, verrou de pieds IK, regard
  (saccades/poursuite), inclinaison dans l'accélération,
  cadence de jambes asservie à la vitesse sol, stade paramétrique (tribunes, pelouse peinte,
  cages — tout suit `{pitch, goal}`).
- **La preuve** : 44 bancs node (`skills/threejs-aaa/scripts/verify-*.mjs`), deux audits
  composés en navigateur headless (`audit-membres.mjs` — les membres pendant les gestes,
  `audit-gants.mjs` — le gant sur le ballon à l'instant de l'arrêt), des sabotages nommés
  partout.

## La copie à consommer

Le produit importable est `skills/threejs-aaa/assets/starter/` (mêmes fichiers que
`examples/showcase/src/engine/`, synchronisés au md5 près — c'est une CLAUSE, `verify-sync.mjs`).
Prendre le dossier `src/engine/` entier ; les modules cœur n'importent ni three ni le DOM, les
modules visuels (`gesture-layer`, `foot-lock`, `strike-warp`, `gaze`…) importent `three/webgpu`.

## L'architecture en une loi

**Il n'y a QU'UN game-loop** : `rondo-sim.js#rondoStep(st, dt, cfg)`. Tout jeu de football est
une **configuration** de ce loop, jamais un fork. La preuve par l'exemple est `match-sim.js`
(~450 lignes) : le match réduit — deux buts, gardiens, tirs, remises, score — n'est QUE des
hooks passés dans `cfg` :

| hook `cfg.*` | signature | ce qu'il décide |
|---|---|---|
| `assignJobs(st, cfg)` | remplace l'attribution de rôles | qui presse, qui couvre, qui se démarque, où — c'est ICI qu'une **formation** vivra |
| `tryShot(st, c, cfg)` | avant l'intention de passe | tenter un tir (retourne true si un geste est engagé) |
| `onOut(st, cfg)` | le ballon a quitté l'aire | quelle remise (but/touche/corner/sortie — `pitch.outRule`) |
| `onDive(st, gk, cfg)` | chaque image d'un plongeon | le toucher du gant (prise/claquette), true quand résolu |
| `canTake(st, id)` | un joueur veut ramasser | l'ayant droit et l'heure d'une remise (et son POSÉ — remise portée) |
| `ballFetch(st, dt)` | le pas du ballon LIBRE | la remise portée : le preneur ramasse, porte au pied, pose (true = « j'ai fait avancer le ballon ») |
| `tryCross(st, c, cfg)` | avant l'intention de passe | le CENTRE de l'aile (lofted vers la surface, cible = coureur de boîte) |
| `tryClear(st, c, cfg)` | avant l'intention de passe | le dégagement de l'étau (botté lointain, cooldown d'équipe) |
| `passBias(st, c, o)` | terme du score de passe | le SENS du jeu (progression vers un but) |
| `leadTime(d, rec)` | la mène d'une passe | ballon dans la course d'un coureur |
| `appelBonus` | nombre | récompense du coureur en rupture |

Clés de `cfg` posées par le match (chacune neutre absente — le rondo ne les porte pas) :
`restartCarried` (la remise se PORTE, jamais snappée — sabotage nommé), `chaseLoose` (le ballon
libre est chassé par les deux camps — sabotage nommé), `apron` (tablier des corps : enjamber la
ligne pour chercher un ballon sorti ; 0 = les murs du rondo), `settleMin` (le ballon récupéré se
dompte avant de repartir), `speeds.walk` (le pas de remise — une remise est une respiration),
`carryLawLoose` (la bascule carry→libre lit la LOI DE TOUCHE — jamais sur une touche légale),
`shotVariety` (le répertoire du tir : l'espèce voyage dans `choice.shotKind`, exécutée par
strikeNow — vitesse ET hauteur), `keeperClaim` (la sortie dans les pieds : un ballon au sol à
portée de gants se ramasse, même « porté » — le label de conduite n'est pas un bouclier),
`carrySurge` (le porteur COURT sur sa touche poussée : au-delà du rayon collé, la pointe se
libère — le trottinement à 4 m/s derrière un ballon à 3 m était le « ballon loin des joueurs »),
`carryTight` (la CONDUITE SERRÉE par défaut : la touche pleine est l'acte nommé d'un burst —
posé sur le porteur en touchF, consommé par dribble.js),
`meetBall`/`meetZone`/`meetStep` (le receveur ATTAQUE son ballon d'un pas sur l'AXE de la
livraison dans les derniers mètres — pas un correcteur balistique : l'erreur latérale échappe),
`meetWalk` (LE RECEVEUR VIVANT, st.full : sur une passe dans les pieds ≥ 7 m il VIENT AU-DEVANT
sur l'axe NOMINAL à allure de marche, plafond 1,1 m — mesuré avant : p25 de vitesse 0,00 m/s,
14 % des vols FIGÉS > 60 % du temps, la statue au point de chute ; après : 0-1 % et la prise
dans le pas. Geste de CONSTRUCTION : à < `hold` m du but il tient son point de fixation — sans
la porte l'attaque redescendait, tirs 27 → 16 ; sabotage nommé « pose figée »),
`execSigma` (le déchet technique du joueur MOYEN, ≈ 2,5° — les notes le raffinent, l'urgence
l'aggrave ; sans lui le monde non noté exécutait parfaitement),
`carryViaBall` (le porteur PASSE PAR SON BALLON : au-delà de la portée de contrôle, la cible de
locomotion est le ballon réel, pas la poussée projetée — le corps ne court jamais en laissant
son ballon derrière),
`gkRelease` (LA RÈGLE DES SIX SECONDES à l'échelle : le gardien porteur se porte sur son spot
de distribution — jamais vers l'avant — et passé le délai la distribution est FORCÉE, meilleure
rampe sinon punt ; sans elle le gardien-porteur dribblait 87 m — sabotage nommé),
`lossReact` (LE DÉPOSSÉDÉ SE RETOURNE : pendant la fenêtre après sa perte, l'ex-porteur chasse
son ballon au lieu de repartir en coureur de slot dos au jeu — le contre-press du métier ;
sabotage nommé « course aveugle »),
`prepTouch`/`prepTouchF`/`prepDamp` (LA TOUCHE DE PRÉPARATION : quand le couloir de tir est
ouvert et le ballon de course hors de portée d'armement, la touche suivante SERRE et AMORTIT —
le canal vitesse `touchDamp` de dribble.js cale le ballon sous l'allure du corps, la pointe
s'arme plus tôt, la cible traverse le point de touche ; sans elle, le tir se refusait
'technique' en boucle jusqu'à l'empalement sur le gardien — sabotage nommé),
`pokeReach` (LE PIQUE : un ballon de conduite LIBRE est libre aussi pour l'adversaire — le pied
qui le bat au point le dévie, événement nommé, 50/50 réel ; sabotage « défenseur-spectateur »).

Chaque hook est un no-op absent — le rondo d'origine est inchangé au bit près quand `cfg` ne les
porte pas (mesuré : verrou de balance identique).

## Les invariants à respecter (la charte, `skills/threejs-aaa/reference/50`)

1. **Une autorité par corps et par phase.** Position/lacet d'un joueur : la sim. Pendant un
   geste : l'horloge du geste (`ownsBody`). Le visuel COPIE, il ne ré-invente pas.
2. **Le ballon ne se téléporte pas.** `ball-body.js` refuse l'écriture de position ; on passe
   par `impulse/strike/carry/escort/restart(cause)` — et toute remise a une cause nommée.
3. **Un refus se nomme** (`deny(st, cause)`) : quand le jeu s'étrangle, on lit le registre
   `st.deny`, pas des hypothèses.
4. **Les événements portent leur géométrie** (`st.events`) : chaque passe/tir/duel/geste inscrit
   les nombres sur lesquels il s'est décidé — les contrats jugent ces nombres, jamais une
   re-mesure d'après coup.
5. **Le hasard de partie est seedé** (`st.rnd`) : même graine, même match. Les identités
   (persona) sont des fonctions pures de (id, graine). Ne jamais consommer `st.rnd` dans du code
   optionnel sans y penser : chaque tirage re-distribue la partie.
6. **Toute loi nouvelle arrive avec sa mesure avant/après et sa clause** (un banc `verify-*.mjs`
   ou une clause dans un contrat existant), plus un sabotage qui prouve que la clause mord.

## Le 11c11 (le chemin balisé — ET PROUVÉ : `match11.html`)

Depuis le lot 9, le plein format est une CONFIGURATION livrée : `makeMatch({ full: true })` —
terrain Loi 1 (105 × 68), 10 + gardien par équipe, formation 4-3-3 (`formation.js` : postes en
fractions du terrain, bloc qui COULISSE avec le ballon et respire avec la possession). Les
couloirs dynamiques du réduit sont réservés au soutien rapproché (4 corps près de l'ancre) et au
marquage (4 marqueurs + press + cover) ; tout le reste tient SON poste — c'est ce qui fait qu'un
22-corps reste un bloc lisible, pas un essaim (sabotage nommé : sans les postes, la dispersion
du bloc s'effondre de 15,2 à 9,4 m). Mesuré : sim 22 joueurs 0,38-0,44 ms/step ; scène complète
(couches de gestes + IK + warps × 22) 3,65 ms/image CPU ; fps 22 corps = 75 % du fps 12 corps en
rasterisation CPU pure — l'architecture scale, le rendu n'a AUCUNE tuyauterie de plus que le
réduit (même scène, même entrée à un paramètre près). Banc : `verify-match11.mjs` (17 clauses).
Dette nommée : l'ÉQUILIBRE de jeu du plein format (tempo, portée de tir — `shotRange: 20` posé
en override —, conversion : les bandes fines du réduit restent à calibrer pour le 105 m).

Depuis le lot 10, le plein format vit sous **la Loi 11** (`offside.js` — pure, `checkOffside`) :
UNE ligne (l'avant-dernier adversaire, tenue par le ballon, jamais dans sa moitié), UN instant
(le DÉPART du ballon — `strikeNow`), et quatre consommateurs gardés par `cfg.offside && st.full`
(le réduit reste futsal, le rondo au bit près) : le CERVEAU n'y sert personne (`choosePass`
écarte, `beginPass` refuse — refus nommé `hors-jeu`), la PHOTO se prend à la frappe
(`st.pass.off` — dégagements et tirs compris : le renvoi qui trouve un attaquant resté aux six
mètres est LE hors-jeu classique), le premier toucher SIFFLE (`receive` → `st._whistle` →
coup franc adverse administré par le match, même cérémonie portée qu'une sortie), et les
POINTES SE CALENT sur la ligne (postes 7-9 bornés à ligne − 0,8, relus chaque image). L'appel
timé en jaillit : pointe À PORTÉE DE PASSE et devant le ballon, porteur posé, couloir profond
ouvert → dart de 7 m vers la ligne (jamais au-delà), servi par `appelBonus` + `appelRange`
(l'appel ÉTIRE l'enveloppe de passe : un ballon dans la course est plus long qu'une passe de
circulation — sans lui, mesuré : 11 appels, 1 servi, la décoration). Mesuré : 2-5 appels/180 s,
~27 % servis, pointes en position illicite ≤ 0,4 % du temps de possession (pire graine).

Depuis le lot 11, la défense du plein format **presse SUR SIGNAL** (`pressTriggers`) : deux
déclencheurs de l'école du pressing, lisibles dans l'état sans oracle — la PRISE DOS AU BUT
(porteur qui reçoit tourné vers son but, dans son camp) et la PASSE EN RETRAIT de la relance
basse (origine à 4 m dans leur camp, ballon qui recule de 3 m). La fenêtre est bornée (4,5 s,
cooldown 6 s — le patron du contre-press `lossReact` à l'échelle de l'équipe) : second presseur
sur le pivot (la couverture est LE pari perdu du pressing — assumé), marquages au demi-pas
(1,4 → 0,95 m, cadence 0,35 s), bloc posté qui monte de 3,5 m. L'OMBRE DE COUVERTURE
(`coverShadow`) fait arriver le presseur PAR le couloir du soutien le plus profond — son corps
vit dans la ligne de passe pendant l'approche (`laneClearance` mesure des corps réels : l'ombre
est du positionnement, pas une règle de plus) ; à portée de duel elle cède au tacle. Mesuré :
6-11 fenêtres/180 s (~2-4/min), la LIGNE de hors-jeu adverse descend de 9 à 18 m pendant les
fenêtres (23-27 m sous press contre 35-41 au calme — le bloc qui monte fait exister la Loi 11),
régains en fenêtre 1-5 ; la compression moyenne des 10 corps, elle, ne bouge pas (diluée —
mesuré et assumé : l'instrument du pressing est la ligne). Le pressing a aussi EXPOSÉ un trou
latent du moteur : une passe trop molle mourait au sol avant son receveur et la phase `flight`
n'avait plus de sortie (gel de 145 s, graine 3) — deux lois le ferment, `deadFlight` (un vol
mort est un ballon LIBRE ; la photo de la Loi 11 survit au vol mort) et `releaseTtl` (la garde
anti-auto-interception a une horloge : une protection pensée pour l'instant du départ ne
verrouille pas l'éternité). Le gel est ressuscité en sabotage nommé au banc. Sabotages : « press
sourd », « press en ligne droite », « gel ».

### Les quatre moments du jeu (`phases.js` — lot 14, le socle tactique)

`momentDuJeu(st, team)` → attaque-placée / transition-off / défense-placée / transition-def /
arrêt — pur, dérivé de la possession et de l'horloge du regain (cfg.moments, événements
'moment' mesurables). Les transitions sont les 5 s où le bloc adverse est déformé : le moteur
y branche le CONTRE-PRESS d'équipe (perte jeune et haute → fenêtre de pressing, le
Gegenpressing) et la verticalité du regain (appels profonds au cooldown relâché). Mesuré :
48-54 % du jeu ouvert en transitions (réel ~40-50). C'est le « quand » que la tactique
(`tactics.js`, à venir) et les rôles consommeront — un projet aval peut déjà lire le moment
pour ses caméras, son commentaire, son HUD. Banc : `verify-moments.mjs` (8 clauses, sabotage
« jeu sans moments »).

### Le catalogue de formations (`formation.js` — lot 17)

Trois systèmes livrés — 4-3-3, 4-4-2, 3-5-2 — et surtout la GÉNÉRALISATION : les lignes sont
une donnée (`LIGNES`), `premierOffensif(name)` remplace le « postes ≥ 7 » câblé (le calage
Loi 11 et les appels s'adressent aux pointes de N'IMPORTE quelle formation), `checkFormation`
juge tout le catalogue (lignes ordonnées par groupes, largeur à l'échelle — calibrée contre le
réel : un trois arrière est étroit PAR CHOIX, les pistons donnent la largeur). La formation vit
dans la tactique : `makeMatch({ tactics: [{ formation: '442' }, { formation: '352' }] })` —
deux systèmes, un seul moteur ; inconnue → repli 433 prouvé octet pour octet (sabotage
« formation fantôme »). Ajouter un système = ajouter DEUX tableaux (postes + lignes).

### La tactique d'équipe est un CONTRAT (`tactics.js` — lot 15)

Cinq axes [0..1] génèrent l'espace des styles — `hauteurBloc`, `largeur`, `pressing`,
`style` (possession↔direct), `transition` (conservation↔contre) — chacun branché sur des lois
prouvées (formation, fenêtres du lot 11, arbitre de menace par équipe, relaxation du lot 14).
`makeMatch({ tactics: ['gegenpressing', 'blocBas'] })`, presets dans `TACTIQUES`, objets
partiels acceptés, `checkTactics` au banc. LE DÉFAUT (0,5 partout) EST L'IDENTITÉ : le milieu
de chaque paire est l'ancienne constante mesurée, exact au bit (`axe(0,5)` rend le milieu sans
ulp). Mesuré : la hauteur déplace la ligne de +8,3 m, la largeur le trio de +4,2 m, l'école de
la chasse presse 5,8 s toutes les 7,8 s (contre 3,2/13,2 au bloc doux), et le style fait
basculer les choix serrés de l'arbitre (possession → passe, direct → tir sur le même monde).
Banc : `verify-tactics.mjs` (8 clauses, sabotage « tactique placebo »). Dettes nommées :
instruments de flux pressing/style/transition, catalogue 4-4-2/3-5-2 (couche rôles).

### Les rôles par poste (`roles.js` — lot 16b)

Le poste dit OÙ, le rôle dit QUOI, l'attribut dit COMMENT ça réussit — trois couches composées.
`makeMatch({ roles: [{ 8: 'neufDeSurface', 5: 'meneur' }, {…}] })` — catalogue (polyvalent,
neufDeSurface, ailierDePercussion, meneur, piston) ou objets partiels ; chaque rôle = biais à
identité par défaut : profondeur de poste ±2,5 m (le calage Loi 11 garde le dernier mot),
largeur personnelle ×0,9…1,1, cadence d'appels 14…6 s, poids d'arbitre ±15 % composés avec le
style d'équipe (un 9 direct dans une équipe possession reste un 9 — nuancé, pas écrasé : dans
une équipe directe, le rôle ne renverse pas le style, c'est mesuré et c'est le contrat).
Banc : `verify-roles.mjs` (6 clauses — mécanismes sur fixtures au chiffre près, sabotage
« rôles placebo »). Dettes nommées : rôles de pressing, formations 4-4-2/3-5-2, presets
tactiques portant leurs rôles.

### Le cerveau on-ball est un CONTRAT (`menace.js` — lot 12)

Le patron Unity/Unreal au sens strict : **le moteur possède l'EXÉCUTION, le projet peut
remplacer la POLITIQUE.** Avant, le porteur vivait un ordre figé (tir, puis centre, puis passe,
sinon conduite — trois heuristiques qui s'ignoraient) ; depuis le lot 12, les quatre options
sont notées sur UNE échelle de menace (`arbitre(st, c, cfg)` → `{ tir, centre, passe,
conduite, meilleure }`, chaque note portant son `pourquoi`) et l'ordre devient un choix.
PAS DE SECONDE VÉRITÉ : chaque note se calcule avec les MÊMES primitives que son exécuteur
(`laneClearance`, le vrai `choosePass`, les seuils de position de `tryShot`/`tryCross`) — et
les exécuteurs GARDENT leurs portes nommées : l'arbitre propose, la loi dispose.

**L'injection** (la réutilisabilité demandée) — un projet aval remplace la politique entière
sans toucher une ligne du moteur :

```js
const cfg = matchCfg({
  decide: (st, c, cfg) => {
    // votre cerveau (arbre de comportement, ML, script de match…) — le moteur exécute
    return maCoachIA.choisir(st, c) ?? { meilleure: 'conduite' };
  },
});
```

Le contrat de retour : `{ meilleure: 'tir'|'centre'|'passe'|'conduite' }` (les notes sont
optionnelles — l'événement `arbitre` les logge si présentes). Les poids `cfg.menace`
(`{ tir, centre, passe, conduite }`, multiplicateurs) sont le réglage d'équipe léger — une
équipe directe monte `tir`, une joueuse monte `passe` — sans écrire de décideur. Gardé
`cfg.menace && st.full` : le réduit et le rondo vivent l'ancien ordre au bit près. Mémoïsé
0,25 s (un arbitrage est une lecture du monde, pas un tremblement à 60 Hz). Mesuré : les refus
« angle-fermé » passent de 18-171 par match à ZÉRO (l'ailier ne canonne plus dans un mur — il
sert ou il porte), prépare-frappe −30 %, tirs stables, les quatre options gagnent chacune en
flux. Banc : `verify-menace.mjs` (11 clauses — quatre fixtures de gagnant, pureté, sabotage
« cerveau d'un seul geste », contrat d'injection prouvé par contraste : un `decide` aval qui
force la conduite ÉTEINT la machinerie de tir devant le but ouvert).

### Le cycle de match est un produit (`cfg.chrono` + `feuilleDeMatch` — lot 13)

`matchCfg({ chrono: { periodes: 2, duree: 180, pause: 6 } })` : mi-temps sifflée à l'heure,
l'autre équipe engage (Loi 8, alternance), sifflet final → `st.fini` + monde calme, et
`feuilleDeMatch(st)` rend score, buts à la minute, tirs/arrêts/passes/centres/hors-jeu/coups
francs/pressing par équipe et la possession — tout depuis les événements, déterministe octet
pour octet. Clé absente : les mondes sans fin d'aujourd'hui, au bit près. Un projet aval
démarre un match, le joue, le finit, lit le résultat — c'est l'étape 3 du chemin balisé,
LIVRÉE. Les dettes du lot ont été payées au lot 24 : `pitch.echangerCamps()` (une bascule en
closure, tout le moteur suit par `ownGoal`/`attackGoal`) et le TEMPS ADDITIONNEL (les arrêts
s'accumulent, l'arbitre rend ×0,35 plafonné 12 %, annonce `'temps-additionnel'`, HUD « MT2
2:58 +2 »). Banc : `verify-chrono.mjs` (14 clauses, sabotages « match sans fin » et « montre
truquée »). Et la chasse aux buts fantômes du même lot (NOTES 47) a rendu les scores
humains : ≈ 2 buts/match — l'échappée pense (gachetteNear), personne ne fuit dans son
propre filet, le gardien distribue depuis le coin des six mètres.

### La Loi 12 — fautes, avantage, penalty, mur (lot 25)

`matchCfg` porte `loi12: { avantage: 1.8, contact: 0.9, mur: 9.15 }` (défaut ON comme la
Loi 11, gardé `st.full` — le réduit et le rondo vivent sans arbitre de fautes, au bit près).
Trois étages, trois modules, une seule vérité :

- **La détection vit au DUEL** (`rondo-sim.js#standTackleNow`) : la fente qui rate le ballon
  et trouve le corps du porteur (< `contact` m) POSE le fait — `st._faute` {t, par, sur,
  team, p} + événement `'faute'`. Une faute à la fois : l'arbitre aussi.
- **L'adjudication est un module d'arbitrage** (`referee.js#adjugeFaute`, appelé par
  `matchStep`) : l'AVANTAGE d'abord (Loi 5 — fenêtre `avantage` s : l'équipe lésée qui porte
  encore le ballon à la fin de la fenêtre JOUE, événement `'avantage'`, pas de sifflet ; le
  fautif qui récupère siffle AVANT la fin) ; le sifflet ensuite — coup franc au LIEU de la
  faute (clampé au terrain), PENALTY au point (`dims.spot`, 11 m) si la faute vit dans la
  surface du fautif (`pitch.inBox`, camps échangés compris) ; cérémonie complète (ballon
  lâché, monde en loose, preneur du camp lésé, armés annulés).
- **Le MUR est la Loi 13 à la remise** (`match-sim.js`, bloc remise) : coup franc et penalty
  du plein format tiennent 9,15 m (pas le rayon réduit), et à moins de 30 m du but propre les
  DEUX défenseurs les plus proches du but se POSENT sur la ligne ballon→but à 9,15 m, épaule
  contre épaule (±0,35 m) — un coup franc sans mur est un penalty déguisé.

La feuille compte les fautes par fautif (`fautes: paire('faute')`). Le ticker de la scène lit
`'faute'` (rouge brique) et `'avantage'` (vert). Banc : `verify-loi12.mjs` — 13 clauses SUR
FIXTURES (doctrine lot 8 : `st._faute` crafté à la main — avantage gardé/perdu/fenêtre
ouverte, penalty au point vs coup franc un mètre hors surface, mur mesuré 8,9 m avec meute
posée à 2,6 m) + sabotages nommés « arbitre aveugle » (`loi12:false` → fait inerte),
« avantage myope » (`avantage:0` → sifflet immédiat), « penalty déguisé » (sans mur, la
meute reste à 2,8 m). LA DISCIPLINE (lot 27) : chaque adjudication compte la faute à son
HOMME ; la récidive (`loi12.jaune` fautes du même joueur, défaut 2) vaut carton JAUNE, le
second jaune vaut ROUGE — deux événements `'carton'` (les deux gestes de l'arbitre), et le
carton SURVIT à l'avantage. La feuille compte `cartons: { jaunes, rouges }` par équipe, le
ticker les montre dans les couleurs de l'objet. Banc : `verify-cartons.mjs` (6 clauses —
récidive, second-jaune-rouge, survie à l'avantage, feuille, sabotage « arbitre sans poches »
`jaune:0`). L'EXPULSION PHYSIQUE (lot 28) : le rouge SORT le corps. Le levier est natif —
`q.expulse` + un down GÉANT : les ~30 filtres `down <= 0` du moteur (passes, press, preneurs,
mur, appels…) oublient l'expulsé sans être touchés ; movement le laisse MARCHER vers sa
sortie (il n'est pas un corps au sol) ; quatre sites le sautent NOMMÉMENT — la boucle de jobs
(`field`, remises comprises), la Loi 11 (`offsideLine` : un rouge posté hors terrain ne fait
pas la ligne), `placeKickoff`/`kickoffSpots` (les vestiaires ne le ramènent pas), et la scène
(il marche, il n'est pas couché). L'équipe joue à 10 et le monde continue. Banc :
`verify-expulsion.mjs` (8 clauses — le corps sort et reste, à 10, hors du monde, Loi 11,
vestiaires, sabotage « arbitre sans poches »). Dettes nommées : gardien expulsé (pas de
remplaçant aux gants), fautes hors tacle (charge, obstruction, main), DOGSO, et le FLUX mince
du 11c11 (~1 duel tenté / 9 min — enrichir les sources de duels est une dette de qualité
football, pas de loi). La cérémonie stricte du penalty, dette du lot, est payée au lot 26
(Loi 14, ci-dessous).

### La Loi 14 — la cérémonie du penalty (lot 26)

`matchCfg` porte `loi14: true` (défaut ON, gardé `st.full && r.type === 'penalty'`). À la
remise penalty : tous les corps sauf le preneur et le gardien de la ligne se tiennent HORS
surface, HORS de l'arc (rayon `loi12.mur` autour du POINT — pas du ballon porté) et DERRIÈRE
le ballon — un clamp en UNE passe dans le bloc remise (pour un z donné, le x légal est le
plus contraignant de la surface +0,8 et de l'arc +0,35, toujours côté champ du plan du
ballon) qui vaut pour les DEUX camps (la remise générique faisait MARCHER les coéquipiers
vers le point). Le gardien défenseur TIENT SA LIGNE (0,15 m, entre les poteaux — keeperSpot
le posait à 1,81 m devant : sa loi de position ne connaît pas la cérémonie). La frappe est le
cerveau NORMAL du preneur (canal shot standard, +1,7 s après la prise — le plongeon existant
répond ; aucun script de tir). Mesuré avant/après : gardien 1,81 → 0,32 m ; violations de
cérémonie à la prise 3 → 0. Banc : `verify-loi14.mjs` (8 clauses — cérémonie, ligne, le
penalty SE JOUE, sabotage « cérémonie foraine » `loi14:false`, et la Loi 14 ne mange pas le
mur Loi 13 du coup franc). Dettes nommées : l'empiètement APRÈS la prise (les corps
re-rentrent pendant l'élan — un re-sifflet d'empiètement), le preneur identifié avant le
sifflet, la conversion penalty à calibrer (2/2 sur fixtures — qualité, pas loi).

### La Loi 15 — la rentrée de touche à la main (lot 29)

`matchCfg` porte `loi15: { range: 18 }` (défaut ON, gardé `st.full` — le réduit joue sa
touche au pied, loi du futsal, au bit près). Le mécanisme est un NOUVEAU POINT D'EXTENSION
du loop : **`cfg.onTake(st, takerId, type, cfg)`** — la prise d'une remise a un métier, et
un projet aval peut scripter les siennes (clé absente : au bit près). Le match y branche
`referee.js#remiseEnTouche` : à la prise d'une 'touche', le lanceur sert le coéquipier le
plus démarqué à portée de bras (`range` m) et le ballon part EN CLOCHE (~32°, apex mesuré
2,6 m — `release('touche')` au grand livre du ballon, puis strike balistique). Et
l'exemption de la Loi 11 est **STRUCTURELLE** : `st.pass` sans photo `.off`, aucun veto de
cerveau — « il n'y a pas de hors-jeu sur une rentrée de touche » n'est pas un cas spécial
du sifflet, c'est une photo qui n'a jamais été prise. L'événement est `'rentrée'` (le mot
'touche' appartient au TOUCHER de balle — un même mot, deux faits, le registre les sépare).
Banc : `verify-loi15.mjs` (6 clauses — la cloche, la reprise, l'appelé posté hors-jeu servi
SANS sifflet avec `isOffside` vrai au lancer, sabotage « touche au pied » `loi15:false`).
Mesure de flux consignée : 0 sortie latérale en 3 × 180 s (le jeu vit central) — la loi vit
par fixtures. Dettes nommées : le geste des deux mains (clip d'animation), le double-toucher
du lanceur, la touche foireuse (foul throw).

### La Loi 3 — les remplacements (lot 30)

`matchCfg` porte `loi3: { changements: 5 }` (gardé `st.full`). LA LOI EST LE MÉCANISME, LA
POLITIQUE EST AU PROJET : le moteur ne décide jamais QUI sort — un manager, une UI, une IA
de banc appellent **`referee.remplacer(st, cfg, team, outId, inSpec)`** (comme Unity ne
substitue pas à votre place). La file s'exécute À L'ARRÊT DE JEU (on ne change pas pendant
que le ballon roule) : le sortant marche vers la touche par le levier de l'expulsion (down
géant — les cerveaux l'oublient), à la ligne **l'identité change** (`inSpec` au format des
squads : `{ ratings, name, number, look, role }` → `makeProfile`/`resoudreRole` — l'ardoise
disciplinaire PART AVEC L'HOMME : le carton appartient à l'homme, pas au maillot), et le
corps revient prendre ses postes. Limite `changements`, expulsé irremplaçable (l'équipe
reste à 10), feuille `remplacements: [n0, n1]`, événement `'remplacement'` à la minute.
Banc : `verify-loi3.mjs` (9 clauses — la file pendant le jeu, l'exécution à l'arrêt,
l'identité, le retour, l'ardoise vierge — jaune → sub → 2 fautes → JAUNE pas rouge —, la
limite, l'expulsé, sabotage « porte tournante fermée »). Dettes nommées : le banc INCARNÉ
(des corps assis qui s'échauffent — aujourd'hui l'entrant naît à la ligne), les fenêtres
comptées (3 + mi-temps), la fatigue (le déclencheur naturel de la politique — le moteur ne
la modélise pas encore).

### La fatigue — l'endurance, un état du corps à l'échelle du format (lot 31)

`matchCfg` porte `fatigue: { horizon: null, cap: 0.15, pause: 0.25 }` (gardé `st.full`).
`q.stam ∈ [0;1]` est drainé dans movement par l'effort (au carré + un socle, récup légère
sous 1,5 m/s) sur l'**horizon du format** — `periodes × duree` du chrono configuré, 360 s à
défaut : un moteur réutilisable ne code pas « 90 minutes » en dur, l'échelle suit le match
demandé. **Un seul effet v1, une seule autorité** : la pointe plie (plafond de vitesse
× 1 − cap·(1 − stam) — p95 des courses mesuré ×0,92 à essence vide). La note `stamina`
(attributes.js) module le drain ×[1,25 ; 0,75] ; les vestiaires rendent `pause` d'essence ;
l'entrant de la Loi 3 naît frais (et son trot d'entrée se paie, comme tout effort) ;
événement `'fatigue'` au franchissement de 0,35, une fois par homme. **`q.stam` est l'API du
projet** : la politique de banc le lit (`stam < 0,4 → remplacer(...)`) — le moteur ne décide
toujours pas qui sort. Banc : `verify-fatigue.mjs` (8 clauses — frais au coup d'envoi, le
drain corrèle au travail (gardiens ≥ 0,9, champ 0,79), la pointe plie, les vestiaires au
chiffre sur 22 corps, la note module, le pont Loi 3, sabotage « moteur infatigable »).
Dettes nommées : la précision fatiguée (sigma d'exécution), le pressing plié, la récupération
active (marcher rend plus que sprinter ne coûte). Leçon de banc consignée : la fatigue par
défaut DIVERGE le flux (papillon dès la première image) — deux clauses de flux d'anciens lots
re-fondées sur des graines re-mesurées (le mécanisme des axes était intact : +6,1/+6,4/+8,5
sur 3 graines).

### Le duel de corps — la charge d'épaule (lot 32, l'ère qualité)

`matchCfg` porte `charge: { dist: 0.85, time: 0.4, cd: 3.0 }` (gardé `st.full`). Diagnostic
fondateur (probe-contact) : l'adversaire vivait à **1,28 m médian** du porteur mais la
pression ballon ne mordait que **2,4 % du portage** — le bouclier protège le ballon, c'est
son métier — d'où 1 duel / 9 min : un jeu sans contact. La charge est le duel de CORPS,
distinct du tacle (qui joue le ballon) : un défenseur au corps du porteur mûrit une horloge ;
pleine, la charge se joue. **De côté : duel loyal** (nouvel attribut `strength` → chargeF
×[0,85 ; 1,15], l'élan du chargeur pèse, tirage `st.rnd` seedé, base 40 % — gagné : le
ballon JAILLIT en bousculade courte (1,4 m/s — pas une passe à l'adversaire), perdu : le
chargeur rebondit (levier natif `_bite` 0,45 s)). **Derrière : la filature est un métier**
(aucun événement — l'horloge se ré-arme) et seul le **percutage** est une faute (contact
< 0,5 m ET vitesse d'entrée > fuite + 0,8) qui alimente l'arbitre de la Loi 12 (avantage,
coups francs, cartons — le flux disciplinaire naturel du football). Jamais sur le gardien
porteur. Équilibre livré (4 × 180 s) : **6,0 épaules/match** (était 0,3 duel), **0,8
faute/match** (bande réelle), scores humains. Deux géométries payées en mesure : la première
criminalisait l'ombre de poursuite (33 fautes / 9 min, des 0-0 au sifflet), la seconde
survitesse brute en laissait 16 — la vitesse d'ENTRÉE projetée est la bonne serrure. Banc :
`verify-charge.mjs` (8 clauses — fort/faible déterministes à rnd fixé, percutage vs
filature, anti-mitraillette, gardien, flux en bande, sabotage « jeu sans contact »).
Dettes nommées : l'animation du contact (les corps se poussent sans clip d'épaule),
l'obstruction. Le tacle glissé, dette du lot, est payé au lot 33 (ci-dessous).

### Le tacle glissé sur porteur (lot 33) — et la naissance de `duel.js`

`matchCfg` porte `slideTackle: { at: [1.35, 2.5], body: 1.1, speed: 4.4, carrySpeed: 4.4,
trip: 0.7 }` (gardé `st.full`). Le glissé sur ballon LIBRE existait (« un ballon qui
traîne ») ; le glissé SUR PORTEUR est le pari du DERNIER RECOURS : un poursuivant lancé
(≥ `speed`) sur un porteur LANCÉ (≥ `carrySpeed` — une construction lente se défend debout :
sans cette porte, 20,8 glissés/match mesurés, la fête du tacle) se couche pour le ballon.
La TABLE TECHNIQUE juge la géométrie réelle de l'instant, PUIS le JET (accuracy 0,6 ± la
note tackling — sans lui, 83 glissés sur 83 prenaient le ballon : glisser était strictement
optimal ; le RATÉ est ce qui produit fautes et vides). Trois issues : **PRIS** (dégagé fort
dans la course — et le tacleur est AU SOL, gagné ou perdu : ce coût EST la décision) ;
**FAUTE** (les jambes avant le ballon : la victime TOMBE, et par DERRIÈRE c'est GRAVE — la
récidive compte DOUBLE dans `adjugeFaute`, un seul glissé par derrière vaut le jaune) ;
**le VIDE** (le porteur file, refus nommé). Anti-spam : `slideCooldown` partagé + un corps
au sol par ballon et par équipe (6 s). Équilibre livré (6 × 180 s) : 1,8 glissé/match,
0,7 faute-tot/match (bande réelle), 3,0 tirs, 1,2 but. Et la volumétrie a mordu (rondo-sim
1 263 > 1 250) : la famille des duels de corps (charge + glissé sur porteur — aucun appel à
receive, pas de cycle) vit désormais dans **`duel.js`** (150 l.), le candidat nommé du
backlog. Banc : `verify-slide.mjs` (8 clauses — pris/faute-grave-jaune/vide/pari
déterministes par géométrie et jet fixé, dernier recours, flux en bande, sabotage
« personne ne se couche »).

### Le jeu de tête — le ciel du match (lot 34, `tete.js`)

`matchCfg` porte `tete: { min: 1.5, max: 2.2, reach: 1.0, but: 12 }` (gardé `st.full`).
Mesuré avant : le jeu aérien manquait ENTIER — 0 centre entré en surface sur 4 matchs (vols
tendus mangés par le premier rideau), 0,8 s/match de fenêtre de tête avec un corps dessous.
Livré, QUATRE serrures ouvertes dans la chaîne du ciel :

- **Le contact de tête** (`tete.js`) : un vol à hauteur de tête au-dessus d'un corps se
  reprend — au BUT si attaquant en surface (< 12 m — canal shot standard `kind: 'tête'`, le
  plongeon du gardien répond à la physique), en DÉGAGEMENT près de son but (loin, vers
  l'avant et le flanc), en REMISE courte sinon (le coéquipier proche, cloche raccourcie). À
  deux corps dans la fenêtre : le **duel aérien** tranche (note `strength` — le même levier
  que l'épaule —, jet seedé, événement `'duel'` kind aérien). La tête se joue DEBOUT (le
  saut authoré est une dette de scène).
- **La cloche du centre** (strike-sim) : un centre est un ARC par-dessus le premier rideau —
  la balistique de la rentrée (θ 26°, portée → vitesse, temps de vol re-solvé).
- **La gâchette du centre** (rondo-sim) : l'ailier au couloir vit à ~21 m du but —
  `gachetteNear` ne s'ouvrait jamais pour lui, `tryCross` n'était JAMAIS appelé en course
  (la serrure du lot 13, encore).
- **La touche de préparation du centre** (shooting) : `beginPass` refusait 169 centres sur
  170 — le ballon d'aile vit à 1,2-1,4 m en course ; le centreur SERRE sa touche (le patron
  du tir, lot 6a) et le centre arme au pas suivant.

Flux : 0 → 3-5 têtes / 12 min, centres 0,3 → 0,5/match — l'EXISTENCE ; l'abondance des
centres est la dette nommée « approche pilotée » (l'ailier qui porte jusqu'à la ligne et
lève la tête). Banc : `verify-tete.mjs` (7 clauses — fixtures balistiques : de VRAIS arcs
lancés par `strike` redescendent sur des corps posés, aucune écriture de ballon ; reprise
au but, dégagement, remise, duel aérien en appel DIRECT une image, fenêtre de hauteur,
sabotage « jeu au sol », flux). Trois leçons de banc : la mène du vol doit pointer LE CORPS
(lead [0,0,0] faisait fuir le receveur vers le rond central), la fenêtre de course d'une
fixture se mesure (la tête tombe à t+1,05 — courir 0,9 s la ratait), et les corps DÉRIVENT
pendant un vol (le duel à deux se juge en appel direct, pas en mise en scène de flux).

### L'orientation du jeu — le renversement d'aile (lot 35)

`matchCfg` porte `renversement: { dense: 5, rayon: 12, dz: 18, portee: 38, bonus: 1.5 }`
(gardé `st.full`). Diagnostic UTILISATEUR (« la densité du jeu axial — l'intelligence
on-ball ne change pas d'aile ») chiffré sans appel : **76 % du jeu vivait à |z| < 8** (réel
~45), la passe la plus longue du VOCABULAIRE faisait 21,9 m (`passRange [2.5, 13]` + appel),
1 renversement / 4 matchs (réel 3-8/match), 5-6 adversaires compressés à 12 m du ballon. Le
cerveau ne peut pas choisir ce qu'il ne peut pas dire. La bascule entre au vocabulaire de
`choosePass` **sous condition de densité** (bloc ≥ `dense` corps à `rayon` m du ballon) : le
candidat du flanc OPPOSÉ (Δz > 18, flanc à flanc) se juge par SA loi — portée étendue à
38 m, point doux des 10 m neutralisé, le lofted est sa NATURE (pas une pénalité) — pendant
que le reste du barème (pression à l'arrivée, sens du jeu) continue de parler. La diagonale
**vole en cloche par-dessus le bloc** (strike-sim, le patron de la rentrée — le couloir 2D
bouché n'existe pas à 5 m du sol : c'est la raison d'être du geste). Événement
`'renversement' {by, to, dz}`. Mesuré après, transformation nette : **axial 76 → 49 %**
(réel ~45), **ailes 9 → 29 %**, **~5 renversements/match** (bande réelle), portée max 38 m —
et la **densité côté ballon p50 passe de 6 à 2 corps** : le bloc adverse doit couvrir la
largeur, l'étau se desserre — l'effet SYSTÉMIQUE du renversement au vrai football. Banc :
`verify-renversement.mjs` (5 clauses — l'étau choisit l'aile opposée, pas de forçage sans
densité, la cloche vole et arrive, sabotage « jeu axial », flux). Effets systémiques
assumés et re-bordés : moins de duels d'épaule (l'étau choisi diminue), transitions plus
rares (la possession se stabilise), l'axe LARGEUR se prouve désormais en isolation
(`renversement:false` — chaque couche sur son axe), et le service des appels profonds
s'éteint (la bascule, option sûre, le surclasse — dette d'équilibrage NOMMÉE : appelBonus
contre bonus de bascule). Leçon de fixture : LE BALLON est l'origine du cerveau — téléporter
le porteur sans son ballon vise tout le crafting à côté (release → restart → possess, la
séquence légale).

### Les circuits par style — l'axe tactique pilote le vocabulaire de passe (lot 36)

Deux chantiers liés. **(1) L'appel servi retrouvé** : la bascule (lot 35), option sûre, avait
tué le service du coureur profond. Diagnostic en trois étages, chacun mesuré : 79 % des
fenêtres de course HORS PORTÉE (le dart sort de l'enveloppe en 0,6 s) ; quand il est
évaluable, le coureur GAGNE 37 % des choix (la loi du coureur au barème — point doux
neutralisé, comme la bascule) ; et pourtant 0 passe partait — les portes d'ENGAGEMENT
(technique 932 / ballon-vif 865 / ancre 642 refus) mangeaient la fenêtre entière. Le remède
natif du tir (lot 6a) et du centre (lot 34) : la **touche de préparation** quand l'intention
vise un coureur vivant — armée UNE fois par intention, et **l'intention meurt AVEC la
course** (les intentions échouées occupaient le porteur TTL plein : tirs 18 → 10 sur 10
graines mesurés, restaurés à 16 par ces deux gardes ; A/B git-stash contre le monde du
lot 35 — 9 buts = 9 buts). **(2) Le style écrit les circuits** : l'axe `style` [0..1] de la
tactique (0 possession ↔ 1 direct) module le vocabulaire de `choosePass` — densité de
bascule ±1 corps, bonus ±0,5, service ×[0,7 ; 1,3] — à 0,5 EXACTEMENT les valeurs
d'aujourd'hui (axe() au milieu exact, prouvé octet pour octet : équilibre explicite ≡
défaut). **Signature mesurée : possession 20 renversements / direct 7** sur 3 graines — les
styles produisent des circuits mesurablement différents. Banc : `verify-circuits.mjs`
(5 clauses). Et une DOCTRINE DE BANC consolidée après la 5ᵉ série de re-fondations : les
clauses de flux se jugent par BALAYAGE-jusqu'à-trouvé (loi12) ou par AGRÉGAT large, chaque
banc juge SA métrique seule (les buts-respiration vivent à UN endroit — match11/chrono), et
le service de l'appel a UNE vérité (verify-circuits). Dettes : le renversement porté, les
poids de bascule par preset affinés, la portée de service du dart (79 % hors enveloppe).

### La conduite au pied — le ballon près du corps (lot 37)

Retour UTILISATEUR (« le ballon paraît loin du pied — de la magie »), chiffré avant de
toucher : sur 12 min de portage (4 × 180 s), p50 = 0,33 m — la conduite ordinaire est
saine — mais 12 épisodes au-delà de 1,8 m jusqu'à 2,91 m, presque tous en CROISIÈRE. Le
coupable n'est pas la poussée : c'est la **fenêtre de perte en mouvement** (`looseAt =
1.15 + touchDistance(v) + 0.5`) qui tolérait ~3,6 m d'écart à 4 m/s — l'étiquette
« porté » mentait, le corps courait derrière un ballon de fait libre. Remède d'une ligne,
gardé `st.full` : **la fenêtre est PLAFONNÉE à 2,2 m** — au-delà le ballon est LIBRE
(phase loose), et la chasse existante (`carrySurge`, `carryViaBall`, le pique adverse)
reprend ses droits. Mesuré après : pic 2,91 → 2,19 m, p99 1,63 m — et un effet de flux
bienvenu, **16 → 27 tirs sur 10 graines à buts constants** (9 = 9, A/B git-stash) : les
ballons trop poussés se DISPUTENT près de la surface au lieu de mourir en conduites
fantômes. Clause §8b de `verify-match11` (p99 ≤ 1,9, max ≤ 2,3 sur 2 × 120 s) ; sabotage
nommé = retirer le plafond. Le réduit et le rondo gardent la fenêtre d'origine au bit près.

### Le répertoire exhaustif des frappes (lot 39)

Retour UTILISATEUR (« flottante, enroulée, puissante, ras de terre, etc — liste à compléter
pour être exhaustif »). Le ballon savait déjà tout (`ball.js` : Magnus complet, spin en rev/s)
— le répertoire ne l'exploitait pas. DIX ESPÈCES sous `cfg.shotVariety`, choisies sur la
SITUATION (`shooting.js`), exécutées avec leur physique (`strike-sim` : vitesse, hauteur,
spin) : les cinq finisseurs d'hier (placé, croisé, puissance, mi-hauteur, lucarne — bandes
préservées : mesuré, des bandes trop généreuses aux nouveautés coûtaient la moitié des buts),
l'**enroulée** (Magnus signé rev ±8, mène décalée vers le centre que la courbe RAMÈNE au
poteau — calibrée 1,44·(d/16)² au ballon réel ; le gardien projette LINÉAIREMENT via
`shotCross` : la courbe le bat de ~1 m, l'avantage du curler au vrai football), le
**ras-de-terre** (le rasant sous le plongeon), la **flottante** (rapide et SANS axe de
rotation : `keeper.js#floatRead` étire le réflexe ×2,4 — rien à lire, il part tard ; le fil
du spin est gardé par la clé, le monde saboté lit comme hier), le **pointu** (petits espaces,
rotation quasi nulle — lue tard aussi, vrai du bout du pied), le **piqué** (le UN-CONTRE-UN
seulement : gardien sorti ≥ 4,2 m ET à ≤ 8 m du tireur — un piqué sur gardien lointain se
fait rattraper, prise mesurée à 1,65 m ; élévation RÉSOLUE du duel — dégager 2,45 m au
passage du corps, traînée ×1,25 — portée compensée ×1,18, vitesse exacte hors planchers).
Banc : `verify-frappes.mjs` (6 clauses — la courbe contre la lecture linéaire, le piqué du
un-contre-un en but, le rasant, la lecture tardive à trois mondes, sabotage « pied unique »,
le flux ≥ 4 espèces). Flux prouvé 20 × 300 s : 59 tirs / 26 buts (hier 64 / 30 — dans le
bruit), conversions 32-67 % par espèce. Dettes nommées : la volée/demi-volée (frapper un
ballon EN VOL au pied — le canal tête existe, le pied non), la trivela, le
pointu-sans-préparation (les portes d'armement n'ont pas la portée du geste), le wobble
visuel de la flottante (scène).

### La volée et le centre bas — le ciel du bas (lot 40)

Le canal tête (lot 34) laissait un trou MESURÉ : 4,4 s/12 min de fenêtres de vol à hauteur
de PIED sur un corps, zéro geste — et 0,0 s en surface face au but, la chaîne du centre ne
produisant que des cloches. Deux greffes liées, gardées `st.full`. **`voleeStep`**
(`tete.js` — même famille, cooldown partagé, `cfg.volee`) : fenêtre 0,25-1,15 m, deux
métiers SEULEMENT — la REPRISE au but en surface (< 14 m : shot kind `'volée'`, ou
`'demi-volée'` si le ballon REMONTE de son rebond — vy > 0) et le DÉGAGEMENT d'urgence à
moins de 24 m de son but ; hors de ces urgences on ne volleye pas, le contrôle au sol est
le vrai geste (l'asymétrie avec la remise de tête est football-vraie). Fenêtre morte
1,15-1,5 m : la POITRINE, dette nommée. Sabotage « les pieds au sol » (`volee:false`).
**Le CENTRE BAS** (`cfg.centreBas`, tryCross → strike-sim) : au ras de la ligne (9 derniers
mètres), le centre part FORT AU SOL (θ 0,14, apogée ~0,3 m, le rebond en route est sa
nature) vers le point de penalty — SI le couloir existe (`laneClearance` 0,45 : un ballon
à ras se fait couper, contrairement à la cloche qui ignore les corps). Sabotage « que des
cloches ». LA CHAÎNE prouvée au banc (`verify-frappes`, 13 clauses) : centre bas t 0,23 →
un rebond → demi-volée t 1,08 à 11 m → but. Flux 20 × 300 s : 71 tirs / 22 buts — le ciel
du bas ajoute ~12 tirs, les buts restent en bande ; 3 reprises + 17 dégagements de volée
par 50 min (le défensif domine, comme au réel). Dettes : la poitrine, l'abondance du
centre bas (l'approche pilotée), la volée hors surface.

### Le service du coureur profond — la foulée est servie (lot 41)

Dette du lot 36, RE-MESURÉE avant d'être payée (le monde avait bougé : 32 % des appels déjà
servis — l'ère lot 36 était à ~0). Le vrai déficit restant : la LATENCE — burst → passe p50
1,43 s, le ballon partait quand la course FINISSAIT ; le coureur recevait à l'arrêt. Deux
lois composées, chacune sa clé et son sabotage : **`appelUrgent`** (rondo-sim) — le service
d'un coureur vivant s'exécute en RÉGIME URGENT (les portes courtes du contesté et du centre,
armé prompt, et le déchet d'urgence ×1,25 qui va avec : une passe pressée se rate plus) ;
**`appelPret`** (match-sim, la porte `posé` du dart) — on appelle quand le passeur PEUT
donner, le ballon au pied (≤ 1 m) : le coureur lit les APPUIS du passeur avant de partir.
Mesuré (ablation propre) : urgence seule p50 0,63 / p90 1,50 ; composé **p50 0,60 / p90
1,08** — la porte du passeur tient la queue — et service 32 → **48 %**, respiration tenue
(67 tirs / 27 buts sur 20 × 300 s, bande). La vérité du service vit dans
`verify-circuits` (clauses 3b : latences poolées des trois mondes tactiques, sabotage
« service nonchalant » par séparation des moyennes). Leçon de méthode : toujours RE-MESURER
une dette avant de la payer — trois lots avaient déjà bougé le terrain.

### Le bloc compact — les distances entre lignes sont la tactique (lot 42)

Retour UTILISATEUR (« les lignes sont trop espacées, les matchs ne sont pas réalistes »),
confirmé au chiffre : bloc défendant p50 43 m / p90 58 (réel 25-40), 25,5 m entre défense et
milieu (réel 10-15), et ZÉRO asymétrie attaque/défense — `formationSpots` coulissait mais la
ligne vivait à ses postes ABSOLUS (11 m de son but, ballon au rond central). La loi
(formation.js, paramètre `bloc` — pur, testable au banc ; consommé par le bloc posté de
match-sim sous `cfg.bloc`, st.full) : **l'équipe sans ballon est CHAÎNÉE AU BALLON** — sa
ligne défensive tient `ligne` m (27) derrière lui, elle MONTE quand le ballon recule
(plafond au rond central), et le bloc entier tient en `long` m (30) — les lignes s'empilent
depuis la ligne basse, interlignes comprimées d'un même facteur. L'équipe qui ATTAQUE garde
la respiration étirée : **l'asymétrie est le réalisme** (mesuré après : défense 30,3 m /
attaque 42,0). `hauteurBloc` (tactics, ±6 m) et le cran de pressing composent par-dessus ;
la Loi 11 suit toute seule (la ligne réelle FAIT la ligne de hors-jeu — un bloc qui monte
pousse les pointes adverses). Flux prouvé tenu : 70 tirs / 29 buts (20 × 300 s), service
des coureurs intact. Clauses §3b de `verify-match11` (loi pure au rond central, bandes en
match, sabotage « bloc élastique »). Dette nommée : le resserrement LATÉRAL côté ballon
(largeur défensive 36,8 mesurée, réel 40-44 — v2). Leçon d'instrument (deux clauses
re-fondées) : un axe qui gouverne des POSTES se juge en SCÈNE CONTRÔLÉE sur les cibles
posées (`p.target`), pas au flux — trois couches successives (renversement, slots, darts)
avaient noyé la clause largeur.

### Le prix du premier toucher et le bloc par équipe (lot 43)

Deux retours utilisateur. **L'effet aimant des longs ballons** : `turnover` (rondo.js)
possédait instantanément à toute vitesse — un dégagement de 26,5 m/s aspiré au pied sans
geste. `cfg.touchePrix` (st.full) applique au RÉCUPÉRATEUR le contrat du contrôle attaquant :
au-delà de `seuil` m/s, la touche peut FUIR (taux/m/s, plafond, modulé `controlF`) — le
ballon reste LIBRE avec son résiduel, le récupérateur va le chercher. Un bon défenseur
contrôle un long ballon LA PLUPART du temps : c'est un tirage seedé, pas une loterie
visuelle. Effet de flux assumé : conversion 49 → 29 % (les buts de chaos de surface
meurent — on se rapproche du réel). Sabotage « l'aimant ». **Le bloc par équipe** :
`blocFor(bloc, tactique)` (formation.js — pur, UNE vérité moteur/banc) module la base
moteur par LA TACTIQUE DE CHAQUE ÉQUIPE : `compacite` (nouvel axe, ±4 m de longueur) et
`hauteurBloc` (±4 m de distance ligne-ballon) ; presets différenciés (gegenpressing serré
26 m mesuré, blocBas 0,8, possession relâchée) ; 0,5 = l'identité de la base. Leçon
d'instrument majeure (verify-circuits) : le sabotage d'une loi d'URGENCE se juge au NOMBRE
de services, jamais à la latence des survivants — sans urgence, seuls les services
instantanés aboutissent, et le biais du survivant rend le monde saboté « plus rapide »
alors qu'il sert moitié moins.

### La première intention et le rattrapage (lot 44)

Trois retours utilisateur avec captures. **Le contrôle raté tue la passe** : un long ballon
raté laissait `st.pass` vivant — le receveur restait PLANTÉ sur son ancien point de chute
pendant que l'adversaire prenait sa touche fuyante. Désormais (st.full) : passe morte, ballon
LIBRE, et le fautif CHASSE sa touche (le réflexe `lossReact`, réutilisé tel quel — une
autorité). **La passe en une touche** (`cfg.uneTouche`) : sous pression, un ballon jouable
repart en PREMIÈRE INTENTION vers une ligne courte et ouverte — sans être possédé (le patron
de la remise de tête), déchet ×1,6, tirage seedé modulé `controlF`. 6,5 % des passes en flux
(porte pression-seulement — la une-touche au calme est un axe de style, dette nommée ; photo
Loi 11 : même dette que la remise de tête). Sabotage « le monde à deux touches ».
**La cage éclairée** (`stadium-night`) : visée des nappes 0,30 → 0,36 L, cône 0,68, DEUX
LAVAGES DE CAGE (rig 4 → 6 — l'uniformité UEFA, modestes pour que la nuit reste une nuit),
key à 50° (l'ombre de tribune ne couche plus son coin noir sur la surface). Prouvé par
capture avant/après (playmode) : le gardien se lit dans sa cage. Leçon de fixture : un
presseur posé près d'une trajectoire de passe la PREND ou l'INTERCEPTE (receiveRadius, la
course de press) — le marquage de fixture se pose dans le DOS du receveur, sur l'axe.

### Le chemin d'origine (toujours valable pour VOTRE greffe)

Le terrain Loi 1 existe déjà : `pitch.js#FULL` (105 × 68, surfaces 16,50, but 7,32 × 2,44) et le
stade paramétrique le construit (`generateStadium({ pitch, goal })` — défaut = plein format).

1. **Formations** : écrire `formation.js` (postes par rôle, bloc qui coulisse avec le ballon,
   largeur/hauteur d'équipe) et le consommer dans VOTRE `assignJobs` — remplacez les 5 couloirs
   de `match-sim.js#assignMatchJobs` par vos postes. Tout le reste (duels, gestes, gardien,
   remises) est déjà branché.
2. **Hors-jeu (Loi 11)** : LIVRÉ (lot 10 — `offside.js`, voir plus haut). Pour VOTRE variante
   (ligne haute, piège du hors-jeu) : tout passe par `offsideLine(st, team)` — le calage des
   pointes et le déclencheur d'appel (`assignMatchJobs`, bloc des postés) sont les deux sites
   à personnaliser ; la porte, la photo et le sifflet n'ont pas de raison de changer.
3. **Chrono, mi-temps, score final** : envelopper `matchStep` (le patron : `playMatch`) — état
   de période, `placeKickoff(st, team)` existe pour l'engagement de seconde période.
4. **Sorties du gardien** : `keeper.js#KEEPER.depthMax` borne la sortie ; le un-contre-un est
   une extension de `keeperDecide` (nouveau mode), le plongeon/la prise sont déjà là.
5. **22 corps à l'écran** : la scène (`Rondo.js`) est count-agnostique, mais mesurez le rendu —
   prévoir LOD/instancing si nécessaire.

## Les attributs joueurs — le contrat d'injection (`attributes.js`)

Les projets amont amènent des joueurs NOTÉS (0-100, type FM) qui changent les mécaniques de
réussite et le rendu. Le contrat tient en trois lois, chacune une clause de `verify-attributes` :

1. **Une note module dans la bande humaine** — chaque mapping est une interpolation bornée
   (pace 100 = ×1,10, pas un surhomme ; le plafond absolu du monde reste souverain, et une note
   de 400 est écrasée à la bande).
2. **Sans notes, rien ne change, au bit près** — un joueur sans `ratings` ne tire aucun aléa ;
   le monde d'aujourd'hui est le monde non noté (même règle que les hooks).
3. **La note agit sur l'EXÉCUTION, pas sur la physique** — la balistique et les lois de
   mouvement sont le monde ; les notes jouent l'erreur de LA frappe, la fermeté de LA touche,
   la fenêtre DU tacle, le réflexe DU gant.

Injection : `makeMatch({ squads: [[{ ratings, look, name, number }, …équipe 0], [...équipe 1]] })`
(le dernier joueur de chaque équipe est le gardien). `look.scale` et `look.shirt` touchent déjà le
rendu ; numéros/carnations par joueur sont une dette documentée (texture atlas partagée).
Vocabulaire consommé aujourd'hui (la table `ATTRIBUTES` liste chaque note → son mécanisme → sa
bande) : pace, acceleration, passing, control, dribbling, finishing, tackling, reactions,
composure, keeping. Les clés inconnues sont ignorées — le projet amont peut en porter plus.
Mesuré (3 × 120 s, élite 80-88 contre faible 30-35) : 3:0 au score cumulé, 86 % contre 80 % de
passes arrivées — un ACCENT d'équipe, pas une arcade.

La persona (`persona.js`) reste la couche ESTHÉTIQUE (silhouette, phase de cycle, tempérament
seedés) ; quand les deux parlent du même levier (vitesse, réaction), la note fait foi.

## Vérifier ce qu'on touche

```bash
# la suite complète (44 bancs, ~3 min)
for f in skills/threejs-aaa/scripts/verify-*.mjs; do node "$f" || echo "ÉCHEC $f"; done
# le monde composé (navigateur headless, build requis)
cd examples/showcase && npm run build && cd ../.. && node skills/threejs-aaa/scripts/audit-membres.mjs
```

`NOTES.md` est le journal de bord (chaque lot : mesures avant/après, morts d'instruments,
compromis) ; `skills/threejs-aaa/reference/` contient les 53 notes de conception — commencez par
50 (la charte), 53 (terrain/gardien/match), 51 (geste et warp).
