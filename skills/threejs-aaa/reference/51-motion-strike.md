# 51 — Les gestes générés : un geste calculé, pas dessiné (`motion-rig`, `motion-strike`, `motion-control`, `motion-aerial`, `motion-skill`, `motion-ground`, `motion-keeper`, `motion-cast`)

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

**`motion-skill.js` — les gestes techniques (lot A4).** Un dribble n'est pas un fouet : c'est un
CHEMIN DU PIED autour d'un ballon qui ne part pas (intent `carry`, le corps tourné par la sim —
loi 12). Le pied libre suit une courbe écrite dans le repère personnage et l'IK deux os en déduit
cuisse et tibia ; l'orientation du pied est absolue (`emitSpec` accepte `{ p, foot, pole }` — la
semelle qui épouse le ballon, l'intérieur tourné vers la coupe, le plan du genou). Trois vérités de
l'IK apprises en chemin : (1) près de l'EXTENSION, la dérivée genou/cheville est infinie — un
chemin de cheville en ligne droite fait claquer le genou (38 rad/s mesurés sur la roulette, qui n'a
que 0,1 s) : les approches et les retours se font EN JOINT SPACE (la pose de contact est résolue
une fois, la jambe y va par la fraction q^a de chaque rotation, `solveLeg`/`applyLeg`) et le petit
pont, qui passe par l'extension complète, est tout entier en joint space ; (2) un pied planté qui
part n'est pas au repos (le bassin est descendu) : la croqueta interpole entre la solution PLANTÉE
du moment et la cible (`applyLegBetween`) ; (3) une cible hors de portée sature l'IK sans le dire —
chaque point est vérifié atteignable avec le bassin de l'instant. Neuf espèces (quinze avec les
tours) : `rateau` (la semelle se pose SUR le ballon — cheville à 29 cm, 10 cm du centre, pointe
descendue — puis le TIRE sous le corps jusqu'à z = +4 cm, le buste s'enroule, le lacet reste à la
sim), `arretSemelle` (la semelle se pose et TIENT à 0 cm pendant 0,38 s ; la tête se LÈVE, 14° →
−5°, le regard au jeu), `roulette` (la pointe coiffe le ballon en 0,1 s, genou 75°, le corps pivote
bas (−10 cm) bras ouverts à 74° d'élévation, le tour est sim), `passementJambes` (la jambe décrit
un CERCLE par-dessus le ballon : hors, devant, dedans (contact), derrière — 33 cm au plus haut,
50 cm de balayage, jamais à moins de 17 cm du ballon ; le buste plonge 12° côté feinte, le bassin
pivote, le centre de gravité s'abaisse ; les tours 2-6 RÉPÈTENT le cercle os pour os — tout ce qui
bouge pendant un tour n'est fonction que de l'instant du tour), `crochet` / `crochetCourt` /
`crochetChaloupe` (l'intérieur va au côté droit du ballon et le BALAIE vers la gauche à travers lui,
pic de vitesse sur le contact — 3,4 / 3,7 / 5,9 m/s — croise la ligne médiane, le corps s'abaisse
dans la coupe ; le chaloupé MENT d'abord : épaules 16° à droite, bassin déporté de 6 cm, puis la
coupe à gauche ; le court n'a pas le temps de mentir), `doubleContact` (la croqueta : l'intérieur
droit balaie le ballon 26 cm vers la gauche, le poids transfère, le gauche le pousse 23 cm devant —
deux touches, deux appuis, rasant), `petitPont` (armé genou 54°, extension SÈCHE à 2° au contact,
pied à 3,5 m/s, le corps déjà bas et penché, aucune clé de bras — la locomotion les garde).

**`motion-ground.js` — le corps qui se couche (lot A5, repris au retour utilisateur).** Le tacle
glissé a quatre temps que la scène et la sim exploitent tels quels : le LANCEMENT (une foulée, le
corps bas et penché), la CHUTE ASSISE (le bassin descend à 19 cm et BASCULE en arrière de 46° — le
tacleur glisse pieds devant, assis sur la hanche gauche, roulis de 30°, buste redressé —, la jambe
droite s'ALLONGE au ras du sol vers le ballon, 93 cm devant au contact, pointe relevée ; la gauche
est la jambe du HURDLER : cuisse sortie à gauche au ras du sol, tibia replié derrière, pied derrière
la fesse — par IK depuis la hanche de l'instant, genou vers l'extérieur ; la main gauche se pose au
sol derrière, le bras droit fait balancier), la POSE
COUCHÉE atteinte à 55 % (la scène y gèle le clip tant que la sim garde le corps au sol, `down`),
le RELEVÉ sur les 30 derniers % (rejoué quand la sim relève ; debout à la fin). Le corps est
TRANSPORTÉ par la sim (la glissade porte 2,5-3 m, freinée — movement.js) : le clip ne porte qu'un
petit root motion devant, pas la distance (l'authoré en portait 1,2 m par-dessus le transport). En
chemin, un bug de l'IK deux os : la normale du plan de la jambe était cuisse × pole — quand la
cuisse s'aligne sur le pole (jambe très pliée vers lui), elle s'annulait et la cuisse VRILLAIT de
177° sur son axe en une image, positions FK inchangées (invisible à tout contrat de position,
attrapé par checkClip). Elle est désormais tibia × cuisse, le plan RÉEL de la flexion. La retournée
n'est pas générée : aucune loi de la sim ne la déclenche (une espèce pour le jour où le moteur la
jouera).

**`motion-keeper.js` — les mains du gardien (lot A6).** Un plongeon a cinq temps que la scène et
la sim exploitent tels quels : l'IMPULSION (le corps plie, −26 à −34 cm, buste devant, bras bas), la
DÉTENTE latérale (le bassin part de côté en root motion — 1,35 m, 1,5 pour la parade à une main,
1,15 pour le plongeon bas — en montant (+28 cm) ou en rasant (−50 cm) ; le corps roule sur le flanc,
les jambes s'allongent, les BRAS S'ÉTIRENT le long de l'axe du corps vers le ballon : gants à
0,95-0,97 m du bassin au contact ; le voyage latéral commence pendant l'impulsion, parce que
checkClip borne le bassin à 6,5 m/s entre clés), la CHUTE (tapis à −68/−72 cm, roulé à 96°), le SOL
(pose tenue jusqu'à `rise` — la scène y gèle tant que la sim garde le corps au sol, gk.rise) et le
RELEVÉ, SUR PLACE (le bassin garde son décalage : la sim a transporté l'origine au même point) : les
pieds vont de leur place couchée à leur place debout au ras du sol par IK, les genoux se replient
sous le corps d'eux-mêmes pendant que le bassin remonte et déroule — le tapis et le relevé sont UNE
chaîne IK continue (le pole du genou DEVANT : un pole « en haut » devient parallèle à la jambe quand
le pied passe sous la hanche, et la cuisse vrille). Le plongeon bas garde les pieds au ras du sol
pendant la détente (cibles qui glissent, bornées à la portée de la jambe). La PRISE AÉRIENNE est une
détente verticale (+55 cm), bras au-dessus de la tête avant le contact (43 cm au-dessus), retombée
sur ses appuis. Les PARADES sont des réflexes debout : la jambe droite qui claque latérale tendue
(pied à 0,62 m), la poitrine qui encaisse (buste bombé, coudes serrés devant, le recul au contact).
Le miroir d'animkit inverse le root motion latéral (le plongeon à gauche).

**`motion-cast.js` — le registre et le casting.** `GENERATORS` associe chaque espèce à sa
famille (`generate(P, opts)`, `check(spec, P, opts)`) ; `GENERATED_KINDS` en compte quarante et une ;
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
paramètre (les extrêmes rares). Le contrat balaye 40 graines × 41 espèces (1 640 gestes) : tout reste sous contrat ET
sous checkClip ; le même joueur re-tire le même geste ; deux graines diffèrent de ≥ 5° et ≤ 40° sur
l'os le plus écarté (reconnaissable, pas caricatural).

## Le contrat (`checkStrikeGen`, `checkControlGen`, `checkAerialGen`, `checkSkillGen`, `checkGroundGen`, `checkKeeperGen` — `verify-motion.mjs`, 206 clauses)

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
pas les jambes et ne saute pas. Les gestes techniques (`checkSkillGen`) : la semelle SUR le ballon
(cheville 24-36 cm, ≤ 14 cm du centre, pointe descendue ≥ 5 cm), le râteau qui tire (≥ 40 cm vers
l'arrière), la semelle qui tient (≤ 3 cm) et lève la tête ; le cercle qui passe par-dessus (≥ 25 cm),
balaie (≥ 30 cm) et ne touche jamais le ballon (≥ 14 cm) ; la coupe qui balaie (≥ 1,2 m/s au
ballon), croise la médiane et s'abaisse ; le chaloupé qui ment (épaules ≥ 8° à droite, déport
≥ 4 cm) et le court qui ne ment pas (≤ 6°) ; la croqueta à deux touches et deux appuis, rasante ;
le pont armé (≤ −25°) puis tendu (≥ −8°), sec (≥ 3 m/s), sans bras. Les sabotages : le râteau
authoré d'hier (5 clauses, l'appui qui glisse de 5,6 cm), un passement dont le corps descend de
12 cm (la jambe frôle le ballon). `verify-gestes` lit désormais ces clips en FK (épaules, pieds,
mains) et par instant, plus par index de clé ni par convention d'Euler authorée. Le sol
(`checkGroundGen`) : pied ≥ 80 cm devant au contact et ≤ 16 cm du sol, bassin ≤ 32 cm à la pose
couchée, épaules roulées ≥ 40°, main gauche ≤ 30 cm du sol, relevé debout (bassin et pieds à leur
hauteur) ; le tacle authoré d'hier refusé (sabotage). Les mains (`checkKeeperGen`) : la détente couvre
sa distance (≥ 90 % du root motion) à sa hauteur (18-40 cm aérien, ≤ −35 bas), les gants au bout
(≥ 0,85 m du bassin, 0,95 à une main), le corps couché dans la détente (≥ 40°) et au tapis (≤ −60 cm,
≥ 65°), le relevé debout sur place, `rise` déclaré ; la prise saute (≥ 45 cm) mains au-dessus de la
tête et retombe sur ses appuis ; la parade des pieds claque (≥ 0,6 m, genou tendu) ; le buste se
bombe puis prend, coudes devant, genoux souples. Sabotages : le plongeon authoré, un plongeon bras le
long du corps. `verify-animkit` désigne désormais ses clés de sabotage par l'instant, plus par index.

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
- Restent authorés : la retournée (sans déclencheur sim) et les gestes sociaux (salut, poignée,
  célébration, applaudir, consulter). Tout le football du répertoire est généré.
- La table `STANCES` est RENDUE AU MOTEUR (note 301) : la re-dériver des clips générés (passe 0,44 m,
  déviation 0,32, pivot {0,50, 64°}…) faisait basculer 8 clauses de verify-match11 (l'engagement, le
  choix de l'espèce de tir, la conduite — 258 clauses accordées sur la géométrie d'hier). La stance
  des clips vit dans `STANCES_CLIP` (verify-motion la mesure, verify-swing la compare) ; l'écart de
  8-16 cm est porté au ballon par le warp de frappe de la scène. Une seule géométrie pour la sim et
  les clips reste à trancher avec le chantier moteur.
- La locomotion est toujours celle du Soldier ; le corps accordé (gait.js) attend sa couche
  d'inclinaison à l'accélération et de balancier des bras selon la vitesse.
