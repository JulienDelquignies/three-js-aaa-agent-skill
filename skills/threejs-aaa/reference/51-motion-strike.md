# 51 — Les gestes générés : un geste calculé, pas dessiné (`motion-rig`, `motion-strike`, `motion-control`, `motion-aerial`, `motion-cast`)

> « Mixamo on avait essayé mais l'IA n'arrivait pas à les utiliser correctement dans le moteur. Je
> pense que si tu crées les animations toi-même ce sera plus conforme à ce qui est attendu, non ?
> Comment tu pourrais faire ? » — puis : « différents types de geste pour le même geste, pour avoir
> des animations différentes par joueur, sans que ça change énormément, quelques détails. »

## Le diagnostic, mesuré avant d'écrire

Le projet n'avait que TROIS clips capturés (idle, marche, course du Soldier de three.js). Les 47
gestes de football étaient des POSES écrites à la main en degrés par os (animkit-data) : six clés
pour une frappe, la cuisse qui tourne de 92° en ligne droite entre deux d'entre elles, des bras posés
à l'aveugle, aucune clé qui sache où est le ballon ni où est le poids du corps. L'audit du dépôt le
résumait déjà (reference/49, post-scriptum) : pied au contact entre 1 et 1,8 m/s, réel 15-25.

Un clip Mixamo est du mouvement SANS signification : il ne sait ni quand le pied touche, ni avec quel
pied, ni quelle surface, ni où est le ballon — le moteur exige tout cela (le ballon part au contact,
la stance est dérivée du geste, le pied est corrigé vers le ballon). D'où l'échec. Un geste généré
par le moteur inverse le problème : le pied, la surface, la puissance, le contact sont les ENTRÉES.

## L'architecture (trois modules, purs, node-testables)

**`motion-rig.js` — le profil du rig.** Un générateur pense en ARTICULATIONS anatomiques dans le
repère personnage (droite +X, haut +Y, avant −Z) : flexion de hanche = rotation autour de l'axe
latéral, abduction = autour de l'axe avant, rotation axiale = autour du long de l'os. La conjugaison
par l'orientation bind de l'os transporte cela dans le local du rig, exactement :

    q_spec(os) = bindQ(os)⁻¹ ⊗ R ⊗ bindQ(os)      ⇒      W(os) = R_parent ⊗ R ⊗ bindQ(os)

Les rotations d'articulation se composent parent → enfant comme des angles anatomiques — l'axe du
genou est emporté par la cuisse, sans que personne n'ait à savoir quel axe local c'est. Plus de
« sur ce rig c'est X qui abaisse le bras » appris par sondage (reference/42) : la SONDE DES SIGNES
(`checkProfile`) le mesure sur n'importe quel rig au chargement (17 articulations, chacune doit
déplacer l'extrémité dans le sens promis). Le profil se construit du glTF brut (banc) ou des os du
template de squad.js (jeu, échelle du squad comprise) ; `motion-profile-shanon.js` bake le rig de
référence pour les MOVES par défaut.

**`motion-strike.js` — le générateur.** Chaque courbe d'angle est une somme de RAMPES C¹
(l'intégrale d'une cloche en cosinus surélevé, asymétrique) : le pic de vitesse d'une articulation
est un PARAMÈTRE placé à l'instant voulu, pas une conséquence de l'interpolation entre deux poses.
La biomécanique publiée du coup de pied y est écrite en clair :

- la SÉQUENCE PROXIMO-DISTALE (Kellis & Katis 2007, Nunome et al. 2002) : la cuisse repart la
  première, son pic ~65 ms avant le contact ; le genou fléchit encore quand la cuisse repart,
  culmine à ~110° puis s'étend avec le pic SUR le contact (1 100-1 600°/s chez l'élite, Petrolo et al.
  2023 — le plafond de 30 rad/s d'animkit est une loi : une amplitude plus grande ALLONGE la fenêtre,
  elle n'accélère pas le genou) ; au contact le genou reste fléchi ~45°, la cheville verrouillée ;
- le POIDS SUR L'APPUI : le bassin s'assied derrière l'appui à l'armé (canal hanches), descend, puis
  passe au-dessus ; la jambe d'appui est résolue par IK deux os, pied planté à plat, genou qui
  absorbe (20-30°) puis s'étend au contact ;
- le TRONC ET LES BRAS par la physique : bassin en antéversion puis rétroversion, lacet côté
  frappeur puis retour ; buste en arrière à l'armé (10-17°) puis en avant, contre-rotation, latéral
  loin de la jambe ; le bras opposé monte devant-latéral, coude plié, le bras côté frappeur recule
  bas ; la tête SUR le ballon jusqu'au contact (quiet eye), puis vers la cible ;
- le DÉGAGEMENT DU SOL : la pointe frôle la pelouse sans la traverser — mesuré en FK sur une
  première passe, le corps se hausse sur l'appui de ce qu'il faut (ce que fait un vrai frappeur).

La sortie est un spec animkit ordinaire (Euler XYZ par os, canal hanches, une clé par 1/60 s plus la
clé de contact) : contrats, couche de geste, stance dérivée, horloge de la sim, miroir — tout reste.

**Douze espèces** partagent la loi : `frappe`, `frappePuissante`, `frappeEnroulee` (cou-de-pied),
`passe`, `passeRapide` (intérieur, hanche en rotation externe), `feintePasse`, `feinteFrappe` (le
même armé, la jambe qui se retient) — lot A1 ; puis, lot A3, `passeExterieur` (le pied INVERSÉ,
cheville rentrée, hanche en rotation interne, une petite touche dont le retour de jambe n'est pas
une frappe), `deviation` (le fouetté court d'une touche libre en direction, pic de vitesse tôt),
`frappePointu` (la pointe 30° vers le sol, le genou qui fait tout), `passePivot` (le corps tourne
de 34° sur l'appui pendant l'armé, hanche en abduction, la passe part de côté), `talonnade` (la
jambe part DEVANT puis fouette en arrière, pointe relevée, la tête ne regarde pas le ballon — un
talon se joue sans regarder, le lacet du bassin reste sage). Durée et contact sont ceux de la
table : la sim ne voit rien changer. `solveStrike` règle l'amplitude par bissection pour atteindre
la vitesse de pied visée ; les amplitudes sont BAKÉES (le jeu génère sans bissection, verify-motion
prouve qu'elles tiennent) ; les feintes portent l'armé (hanche, genou) du geste re-baké qu'elles
imitent.

**`motion-control.js` — les contrôles.** Un contrôle a trois temps que le générateur écrit en
clair : la jambe VA AU DEVANT du ballon (reach : hanche fléchie, genou ouvert, la surface de
contact orientée — intérieur tourné vers le ballon, extérieur éversé, semelle pointe relevée de
22°), elle AMORTIT (cushion : dès le contact la jambe recule et se replie, 16-25 % de la durée —
c'est le retrait qui absorbe, la surface s'ouvre après), puis elle REVIENT sous le corps (settle :
la pose finale est la pose initiale, le pied de nouveau planté). Six espèces : `controleInterieur`,
`controleExterieur`, `controleSemelle` (le pied par-dessus le ballon, 12-34 cm), `amortiCuisse`
(cuisse à 82° de flexion, genou à hauteur de hanche, buste en arrière), `amorti` (la POITRINE :
buste cambré, tête en arrière, bassin qui descend de 6 cm, les deux pieds plantés — tenu modéré,
parce que la sim y renvoie tout contrôle sans technique nommée), `tacleDebout` (la FENTE : bassin
qui descend de 11 cm et avance, buste en avant de 24°, la jambe tendue au ballon). L'appui est
résolu par IK deux os, le style par joueur est le même (amplitude d'armé, affaissement, bras).

**`motion-aerial.js` — la tête.** Un saut est une balistique : le corps PLIE (bassin −14 cm,
genoux ~48°), se détend, et le bassin suit une PARABOLE (apex +38 cm au contact, retombée
symétrique) ; les jambes restent des jambes — en IK sur des cibles qui montent avec le corps, les
pieds qui traînent derrière, replantés à l'atterrissage qui absorbe ; le coup de tête S'ARME en
montant (buste cambré, cou en extension, bras au-dessus de l'horizontale) et FRAPPE à l'apex (cou
et buste fouettent, ≥ 18° sur l'os Head au contact — c'est le cou qui joue le ballon, pas le saut).
`teteDebout` est le même fouetté sans le saut, haut du corps seul (la locomotion garde les jambes,
verify-gestes l'exige).

**`motion-cast.js` — le registre et le casting.** `GENERATORS` associe chaque espèce à sa
famille (`generate(P, opts)`, `check(spec, P, opts)`) ; `GENERATED_KINDS` en compte vingt ;
animkit-data génère les MOVES par défaut à l'import (les specs authorées restent lisibles dans
`AUTHORED`, pour la planche « avant »). À la spawn, la scène accroche au joueur `{ profile, style,
moves }` : le profil du rig VIVANT (une fois par template), un STYLE tiré de son identité, et des
gestes générés à la première demande (quelques ms) puis gardés. `strikeSpec(pl, move)` remplace
`MOVES[move]` dans `_playTech` pour toute espèce générée — trois lignes dans la scène, qui vit AU
plafond de volumétrie.

## Le style : un détail par joueur, jamais un autre geste

Quinze paramètres bornés (`STYLE_RANGES`) : amplitude d'armé ×0,86-1,14, inclinaison du tronc, ouverture
à l'accompagnement, hauteur et avancée du bras d'équilibre, flexion du coude 30-64°, recul du bras
côté frappeur, tête baissée, accompagnement, cheville, affaissement du bassin, décalage du pic du
genou ±12 ms, inclinaison latérale, écart d'appui, hausse de hanche. Deux tirages moyennés par
paramètre (les extrêmes rares). Le contrat balaye 40 graines × 20 espèces (800 gestes) : tout reste sous contrat ET
sous checkClip ; le même joueur re-tire le même geste ; deux graines diffèrent de ≥ 5° et ≤ 40° sur
l'os le plus écarté (reconnaissable, pas caricatural).

## Le contrat (`checkStrikeGen`, `checkControlGen`, `checkAerialGen` — `verify-motion.mjs`, 165 clauses)

Par espèce et par pied (le miroir est exact : FK gauche = miroir de la FK droite à 4 mm) : vitesse
du pied au contact dans la fenêtre du réel (cou-de-pied 13,5-27, intérieur 9,5-16, extérieur
7,5-14, pointe 9-18, talon 5,5-12 m/s) ; pic de vitesse à ±35 ms du contact, cherché sur le SWING
(jusqu'à la fin de l'accompagnement — le retour d'une petite touche peut aller plus vite que la
touche) ; le pied traverse dans la direction de l'espèce (avant, arrière pour le talon, libre pour
la déviation) ; le pied TRAVERSE vers l'avant ; cheville à 5-30 cm du sol ; orientation
du pied écrite ; appui planté (dérive ≤ 3 cm) et à plat ; mains sous le cou ; coude vivant ; pointe
au-dessus de la pelouse ; séquence proximo-distale (pic cuisse < pic genou, genou ≥ 690°/s et sur le
contact) ; hanche dans [−40°, 100°] ; pose finale = pose initiale (le fondu vers la locomotion ne
saute pas). Les sabotages nommés : la frappe authorée d'hier (5 clauses), une main au ciel, un appui
qui glisse, un style hors bornes, un armé étouffé, un wrapper oublié (le rig regarde +Z).

Les contrôles (`checkControlGen`) : excursion du pied ≥ 18-40 cm selon l'espèce, contact dans la
fenêtre de hauteur de la surface (intérieur 2-22 cm, semelle 12-34, cuisse : genou ≥ 62 cm), la
surface orientée (axe de la pointe ≥ 8 cm), retour ≤ 60 % de l'excursion à la fin, tête en arrière
pour la poitrine, fente qui descend (≤ −9 cm) et avance (≥ 5 cm) pour le tacle debout — plus le
corps commun (appui planté, mains sous le cou, coude vivant, pelouse). La tête (`checkAerialGen`) :
Head ≥ 18° au contact, armé ≤ −8° avant, apex ≥ 30 cm, impulsion ≤ −10 cm avec genoux ≤ −40°,
pieds immobiles au sol avant le décollage et après l'atterrissage (≤ 3 cm) ; la tête debout n'écrit
pas les jambes et ne saute pas.

Mesuré sur le rig de référence : `frappe` 14,5 m/s au contact, genou 1 590°/s ; `frappePuissante`
15,4 m/s, 1 630°/s ; `frappeEnroulee` 14,3 ; `passe` 11,4 m/s ; `passeRapide` 10,4 ; `passeExterieur`
9,5 ; `deviation` 9,5 ; `frappePointu` 12 ; `passePivot` 9 ; `talonnade` 7,9 (vers l'arrière).
Avant : 1 à 13 m/s selon le banc, sans séquence, sans poids. Dans le monde composé (audit-membres) :
le pied passe à 0,02-0,06 m du point de frappe (0,42 m avant le lot A1).

## Les instruments

- `scripts/contact-sheet.mjs --move <espèce> [--variant before|after|both] [--seed N]` : la
  PLANCHE-CONTACT — un joueur de la scène Rondo posé par la couche de geste (la sémantique du jeu),
  le ballon à la stance dérivée (une frappe), au pied (un contrôle), en l'air (une tête) — 3 caméras
  × 6 phases relatives au contact dans une PNG, caméras haussées pour une tête ou une poitrine. Le
  même instrument pour les vingt espèces, pour l'agent et pour l'humain ; « avant » lit `AUTHORED`
  (les specs remplacés restent lisibles).
- `scripts/verify-motion.mjs` : le banc (profil, conjugaison, contrat, style, amplitudes, stances,
  miroir, sabotages) — imprime la table des stances à recopier dans `approach.STANCES`.

## Ce que ce lot a corrigé en chemin

- `verify-animkit` (silhouette) REMPLAÇAIT la rotation de repos par le spec : vrai par accident sur
  les poses authorées, faux de 51 cm sur des angles d'articulation. Il compose désormais rest ⊗ q_spec
  comme la couche de geste et le banc de swing.
- `verify-swing` ignorait le CANAL HANCHES et mesurait depuis l'os des hanches : il mesurait la
  stance d'un corps qui n'est pas là. Il lit le canal et mesure depuis l'ORIGINE du modèle (la
  convention de `anchorFor`) ; la table `STANCES` est re-dérivée (frappe {0,36 m, 24°}, passe
  {0,45 m, 18°} — le contact devant l'appui, le genou encore fléchi). Une table plus près du corps
  ({0,26, 43°}) était plus vraie encore et cassait trois bandes de la sim : la géométrie corps-ballon
  est une entrée du moteur, à trancher avec le chantier moteur (match 82/84 avec cette table, 84/84
  avec celle d'hier ; rondo 40/40).
- Les feintes sont générées par la même loi que la frappe qu'elles imitent (« la feinte RESSEMBLE à
  la passe » se lit sur les extrêmes des pistes, plus sur une clé d'index).
- Un module qui exporte `then` devient un thenable pour `import()` — la composition s'appelle `chain`.
- (lot A3) La clé de contact insérée à 3 ms d'une clé de grille faisait lire 30 rad/s à l'IK : la clé
  de contact REMPLACE toute clé de grille à moins de 5 ms. Le portrait d'un contrôle lit l'échantillon
  le plus proche du contact (une grille à 120 Hz ne tombe pas sur 0,20 s). La hausse du corps pour
  dégager la pointe est bornée par le jeu de l'affaissement (elle faisait décoller l'appui du talon).
  Le pic de vitesse se cherche sur le swing. Les feintes suivent les amplitudes re-bakées.

## Résultats négatifs et dettes nommées

- Dans la composition en jeu, le poids des jambes suit l'arrivée (byArrive) : le monde composé mesure
  5,9-8,3 m/s au contact sur une passe rapide en course (le clip seul : 10,3). Le re-calage des poids
  d'arrivée (audit-membres) est le prochain chantier.
- Restent authorés : le tacle glissé, les râteaux et le ballon sous la semelle, les plongeons et
  parades du gardien, les relevés. Chacun est une espèce de plus du générateur (une famille pour le
  sol, une pour les mains), pas un autre outil.
- La table `STANCES` re-dérivée du lot A3 (passe 0,44 m, déviation 0,32, pivot {0,50, 64°}, talon
  {0,34, 163°}…) laisse verify-match à 83/84 : la clause de RÉGIME (excursion serrée < pleine − 0,3)
  tombe à 2,03 contre 2,02 — une frontière de 1 cm sur une fixture de conduite, déjà à 1 cm au lot A1,
  à trancher avec le chantier moteur.
- La locomotion est toujours celle du Soldier ; le corps accordé (gait.js) attend sa couche
  d'inclinaison à l'accélération et de balancier des bras selon la vitesse.
