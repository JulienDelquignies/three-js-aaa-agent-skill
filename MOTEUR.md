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
