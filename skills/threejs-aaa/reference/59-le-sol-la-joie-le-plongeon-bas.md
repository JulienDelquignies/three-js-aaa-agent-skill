# 59 — Le sol, la joie, le plongeon bas (lots A10 bis, A11, retours du balayage)

> Le balayage d'un match complet en page (graine 3) après le lot A12 : « tu as d'autres animations à refaire ? ».
> Quatre choses vues : le buteur qui court au coin les bras à l'horizontale (le dernier clip du donneur joué en
> match), le fauché debout une seconde après sa chute avec le tacleur planté dans son corps, le vainqueur du tacle
> debout les bras en croix, le bras du dessus du plongeon bas qui monte vers la barre. Même méthode que les lots
> précédents : chaque loi de sim sous clé (clé absente = hier au bit, jumeau d'empreinte), chaque geste généré
> sous contrat sans rig, une clause de flux, une capture en jeu.

## A10 bis — Le sol

**Mesuré en page (graine 3, t = 250,18, chute avant par tacle debout).** La chute durait 1,6 s de sim
(`cfg.contact.chute`) pour un clip qui met 0,66 s à se coucher et 0,7 s à se relever : 0,2 s de tenue au sol. À
t + 0,54 s, la sim donnait au fauché un acte « frappe » (down encore 1,03 s) : le porteur couché restait le porteur,
la couche de geste remplaçait la chute par l'armé et le bassin remontait à 0,93 m. Le tacleur se tenait à 0,50 m du
fauché — `minGap`, la distance de deux corps DEBOUT — c'est-à-dire dans son corps couché.

**La clé `cfg.sol` (`{ tenue: 0.9, corps: 0.9 }`, null = hier au bit — empreinte jumelle sur 3 graines).**
- `duel.chuter` : le fauché reste à terre `chute + tenue × (0,7 + 0,6 × min(1, v/6))` s (2,2-2,8 s : p50 2,5 s au
  banc contre 1,6) ; il LÂCHE le ballon (phase loose, plus de porteur couché, `release('perte')`), son armé meurt
  (`abortGesture 'au-sol'`), son intention aussi.
- `movement.separatePlayers` : personne ne marche dans un corps couché — un corps à terre (down, ni expulsé ni
  remplacé) tient les debout à ≥ `corps` m, le debout seul recule, en marchant (≤ 0,04 m/image) : 1,5 % des images
  au sol avec un debout à < 0,6 m contre 10,9 % sans la clé.
- A/B 12 × 300 s : passes +1 %, pertes −4 %, tirs égaux — la loi ne touche que les chutes.

**La pose tenue VIT (motion-contact).** Entre `lying` et `rise`, les trois chutes portent un cycle FERMÉ (0 → 1 → 0,
`vie`) : à plat ventre la main droite revient vers la tête, la tête se pose et se relève, la jambe gauche plie
(talon qui monte) ; sur le côté la main du dessus va à la hanche, la jambe du dessus se replie ; sur le dos la main
droite vient au visage, le genou remonte. À mi-tenue 35 / 15 / 34 cm de mouvement ; à `rise` la pose est celle de
`lying` à 0 cm — la scène peut repartir de là.

**L'horloge de la scène (rondo-contact.contactClock).** Tant que la sim a plus de temps à terre que le clip n'en
demande pour finir (`down > T − t`), l'horloge fait des allers-retours dans [lying, rise[ au ralenti (`VIE` = 0,6) ;
puis elle AVANCE au rythme qui finit debout quand la sim relève (`(T − t)/down`, borné ×1-2,5 : jamais de saut de
pose). Hier : gel de la pose couchée puis un saut à l'heure sim. Le monde sans clé (down 1,6) reste juste : le clip
avance à ×1,3 et finit debout à l'heure. Prouvé en pur (le banc simule la sim qui décompte).

**Les garde-fous de la scène.** Un corps couché ne joue rien d'autre que sa chute (`_playTech` refuse tout sauf
'chute' tant que `_fallOwns`). La prise du TACLEUR n'est pas une réception : son 'control' pendant l'acte
`tacle-debout` ne joue rien (le tacle possède la jambe) — hier l'« amorti » (poitrine, bras à 49°) recouvrait le
tacle à mi-course : c'était les « bras en croix » du vainqueur. Et un contrôle ou une réception SANS technique
nommée se joue DU PIED (controleInterieur, du côté du ballon) quand le ballon est au sol — l'amorti n'est que pour
le ballon haut (> 0,55 m) : mesuré, l'amorti se jouait sur chaque réception basse (79 amortis en deux matchs).

**Reste.** Le relevé aidé (la main tendue d'un coéquipier) n'est pas fait : deux corps à coordonner, un lot à part.

## A11 — L'émotion générée

**Mesuré.** Le buteur courait au coin avec les bras à l'horizontale une seconde (le clip 'celebration' du donneur),
seul, personne ne venait ; l'adversaire n'avait pas d'humeur ; le fautif ne protestait jamais. Les clips salut,
poignée, applaudir, consulter n'étaient jamais joués.

**La famille `motion-emotion` (huit espèces, GENERATORS 'emotion').** Sept gestes du HAUT (`spec.upperOnly` : la
scène laisse les jambes à la foulée — poids des jambes 0) : `poing` (deux pompes du poing devant l'épaule droite,
+25 cm), `brasLeves` (le V au ciel, mains +28 cm au-dessus de la tête, tenu), `oreille` (la main en cornet à 15 cm
de l'oreille droite, la gauche sur la hanche, le tronc tourné de 22° vers la tribune), `calme` (les mains levées
paumes devant à hauteur d'épaule, la tête basse), `accolade` (les deux bras qui enveloppent devant, 21 cm entre les
mains), `applaudir` (trois claquements, mains à 10 cm, écartées de 63 cm entre deux), `sautMur` (A9 ter, reference/56 : le
saut du mur — accroupi, pieds décollés de 58 cm au sommet, mains croisées devant le bas-ventre, réception ; possède les jambes), `proteste` (les avant-bras
qui s'ouvrent, les épaules qui montent de 9°, la tête qui dit non ±8°). Et la `glissade` sur les genoux
(`spec.ownsLegs`, `lying` 0,55 / `rise` 1,35) : le corps descend sur les genoux (bassin à la hauteur de la cuisse,
genoux à 3 cm du sol, pieds 50 cm derrière, pointes au sol, legIK2 en repères alignés — pas de vrille), le buste
droit cambré, les bras ouverts (131 cm) qui montent en V pendant la tenue (+42 cm) et reviennent (cycle fermé),
puis le relevé : un pied devant, debout. L'amplitude des bras suit `armElev` — donc le port de bras de la persona
(motion-cast : `armElev × (0,8 + 0,35 × persona.bras)` pour TOUTES les familles générées).

**La sim (`cfg.fete`, null = hier au bit : l'événement 'celebration' sans geste, pas de glissade).** Le
tempérament de la joie (referee.js) : flair ≥ 0,7 → glissade ; calm ≥ 1,15 → calme (il marche, `_walkF` 0,75) ;
flair ≥ 0,45 et posé (calm ≥ 1,02) → oreille ; burstiness ≥ 1,05 → poing ; sinon bras levés. L'événement porte
`geste`. La glissade se planifie : après `elan` s (1,4) de course, si le buteur va à > 2,5 m/s, `down = glisse`
(1,9 s) et le corps est porté par `movement._glisse` (`portee` × sa vitesse : 2,1 m mesurés) — événement
'glissade'. Les compagnons courent au buteur comme hier (`avec`).

**La scène (rondo-fete.js).** Le poing, les bras levés et le calme se jouent tout de suite en courant ; l'oreille
attend l'arrivée au coin (vitesse < 0,8 m/s) ; la glissade attend l'événement, tient et se relève par
`contactClock` (famille 'emotion' avec lying/rise) ; l'accolade se joue quand un compagnon est à ≤ 1,6 m au pas ou
au trot (des deux côtés) ; l'adversaire abattu (`idleCtx.abattu` pendant `st._celeb`) marche mains sur les hanches
tête basse (attente 'abattu', foulée `mainsHanches` + `headDown` 16° au pas, 8° au trot du retour) ; le fautif
dont la persona n'est pas calme (calm < 1,08) proteste, le carton fait protester tout le monde.

**Captures (graine 3).** But à 232,58 s par le 0 (flair 0,94) : glissade lancée à 233,98 à 2,9 m/s, bassin à
0,44 m, relevé à l'heure sim (a11-glissade.png) ; l'accolade du 3 à 236,3 s (a11-accolade.png) ; les adversaires
abattus à l'engagement (a11-abattu.png). Planches : glissade, oreille, poing, proteste, brasLeves, accolade.

**Reste.** L'accolade lève un peu haut les mains (vers la tête) ; le sifflet et les cartons de l'arbitre n'ont pas
de corps ; le salut et la poignée d'avant-match restent des clips du donneur jamais joués.

## A11 bis — L'arbitre a un corps

**Mesuré.** Le central courait la diagonale et accourait aux fautes (lot 185), mais il sifflait et sortait les cartons
sans un geste. `motion-arbitre` (famille 'arbitre', quatre espèces du haut du corps) : `siffler` (la main droite au
sifflet, 17 cm de la bouche, coude haut, tenu 0,4 s), `carton` (le bras tendu au-dessus de la tête, +36 cm, tenu 1,1 s,
la CARTE jaune ou rouge attachée au bone de la main droite et visible pendant le geste), `designer` (le bras à
l'horizontale devant, 47 cm, le tronc tourné vers la direction), `avantage` (les deux bras devant qui balaient deux fois,
en courant). Contrats, 20 styles, checkClip : verify-arbitre.

**La sim (`cfg.arbitreGestes`, null = hier au bit — le central court sans gestes ; l'empreinte des joueurs est la même
dans les deux mondes, l'arbitre n'est pas dans le flux).** Une file sur `st.arbitre` (`referee.poserGeste`) : le sifflet
passe devant. `adjugeFaute` pose le sifflet puis le bras vers le but attaqué par l'équipe du coup franc (ou vers le
point de penalty) ; le carton, posé juste avant, s'intercale (sifflet → carton → bras) ; `administerWhistle` (le hors-jeu)
pareil ; l'avantage se pose « en courant ». `arbitreStep` dépile un geste à la fois (`st.arbitre.geste { kind, at, until,
dir, couleur }`), arrête le corps pour le sifflet, le carton et le bras, et le tourne vers la direction du geste.

**La scène (arbitre.js).** Une couche de geste sur le central (le même rig que les joueurs, `castStrikes` sur le squad),
le haut du corps seul (les jambes restent à la locomotion), entrée et sortie en 0,15 s, la carte montrée au carton.

**Mesuré en page (graine 3).** Au coup franc de 354,4 s le central freine de 4 à 0,3 m/s en 0,6 s la main à la bouche,
puis désigne le but attaqué (a11bis-sifflet.png, a11bis-designer.png) ; une faute forcée avec carton enchaîne sifflet →
carton (carte visible) → bras (a11bis-carton.png).

**Reste.** La carte est à sa taille réelle, donc petite à l'écran ; le bras qui désigne monte un peu haut sur le rig du
squad ; le salut et la poignée d'avant-match restent des clips du donneur.

## Le plongeon bas (retour du balayage)

**Mesuré.** À 0,43 s du plongeon bas, la main du dessus (gauche) était à 1,21 m de haut pour un ballon à 0,20 m
(elle montait vers la barre) ; et à ×0,8 (la borne basse du time-warp) le gardien était à plat 0,13 s avant le
ballon. Générateur : `rollC` 70 → 100 (la poitrine se tourne vers le sol dans la détente basse) et `topL` 156 (le
bras du dessus suit l'axe) : main du dessus à 0,33 m au contact (contrat et vingt styles verts, verify-motion
206/0). Scène : le ballon LENT se prend en attendant, pas au ralenti — `rate ≥ 1`, le surplus `cross.t − antic`
(≤ 0,6 s) est un DÉLAI de décollage pendant lequel le gardien reste posé (poids 0), puis plonge à ×1 : mesuré en
page, délai 0,19 s, la détente tombe à l'heure du ballon.

## Le relevé aidé (A10 quater — `engine/aide.js`, `cfg.sol.aide`)

Le jeu arrêté (un coup franc posé, ou le ballon à plus de `loin` m), le coéquipier le plus proche du fauché
— ni le fauteur, ni le porteur, ni le preneur, ni un gardien — est élu s'il peut arriver avant le relevé
(`d / trot < down − avant + 0,4`) ; il trotte de loin, marche les derniers pas, se poste à `dist` m du
corps couché (hors de `sol.corps`), face à lui, et quand le relevé approche (`down ≤ avant`) il arme
`mainTendue` (motion-emotion, le haut seul : le buste se penche, le bras droit se tend devant et bas,
la main offerte à ~1 m ; acte qui possède le corps). Événements `aide { by, pour, d }` et `windup`
(skill `aide`). Le fauché se relève comme hier : la main est un corps de plus, pas une physique (la
traction et la main saisie sont la dette nommée). Mesuré (chutes forcées) : élu à 3-6 m, la main tendue
1,93 s après la chute pour un relevé à 2,62 s, à 0,9-1,4 m. `aide: null` = le relevé solitaire d'hier.

## La main saisie (C2 — Animations_A_Faire § 4 ; `motion-emotion` mainTendue.pull, `Rondo._applyAideWarp`)

Le relevé aidé (A10 quater) posait l'aidant à 1 m du fauché et lui tendait la main 0,7 s avant le relevé — puis la main
revenait toute seule et le fauché se relevait sans la prendre : deux gestes côte à côte, pas un contact. Ici :

- **Le geste** : `mainTendue` gagne une phase qui TIRE — tendue devant (contact 0,5), tenue (`hold` 0,65), puis le bras
  REVIENT (`fwd` 64 → `fwdPull` 10, le coude plie 8 → `elbowPull` 62) et le buste se redresse (lean × 0,2) sur `pull` 0,5 s,
  le retour au neutre ensuite (1,4 s). Mesuré au contrat (verify-emotion, `checkEmotionGen`) : la main revient de 14 cm vers
  la poitrine entre la tenue et la fin du tir (≥ 12), la tête recule de 12 cm (≥ 5) ; sabotage `fwdPull 64 / elbowPull 8`
  attrapé (« la main ne revient pas en tirant »). `pull` absent : le retour d'hier.
- **La scène** (`_applyAideWarp`, dans la chaîne des warps après le gant) : pour un fauché dont la sim porte `_aide` et dont
  l'aidant joue `mainTendue`, les DEUX mains vont au POINT MÉDIAN de leurs positions de clip — le bras du fauché (le côté de
  l'aidant) dès le relevé du clip couché (`_sol.t ≥ rise`, monte en 0,3 s) et tant que la poigne dure debout ; le bras droit
  de l'aidant de l'arrivée de sa main (contact − 0,15 s) à la fin du tir (hold + pull). Deux IK deux os (`_armTo`, le noyau
  extrait du gant/ballon tenu), la portée bornée à l'épaule. `pl._aideGrip` porte l'écart des mains avant l'IK, pour les sondes.
- **Rien dans la sim** : le point de rencontre se lit des deux horloges de clip (le relevé rejoué à l'heure de la sim, la main
  tendue à son windup) ; la synchronisation est celle d'A10 quater (la main arrive quand le fauché a fait deux tiers de son relevé,
  le tir couvre la fin du relevé et le premier pas debout).

## Les assistants et les ramasseurs (Animations_A_Faire § 5 ; `motion-arbitre` drapeau*, `referee.assistantsStep`, `engine/ramasseurs.js`, note 382)

- **Les gestes de l'assistant** (motion-arbitre, générés, la hampe dans la main droite — la scène l'attache au bone, elle suit le
  bras) : `drapeauLeve` (le hors-jeu : le bras tendu droit au-dessus de la tête, main à +37 cm de la tête — TENU tant que la sim
  garde le drapeau : la scène clampe le geste à sa tenue), `drapeauIncline` (la touche vers sa droite : le bras levé de côté à
  118°, main à 62 cm à droite de l'épaule et 22 cm plus haut), `drapeauInclineG` (vers sa gauche : le bras croise devant, elev −60 /
  fwd 90 — main à 42 cm à gauche de l'épaule, à sa hauteur), `drapeauHorizontal` (le remplacement : les deux mains à 25 cm au-dessus
  de la tête, 72 cm l'une de l'autre quel que soit le style (la hampe fixe l'écart : les bras ne prennent pas l'amplitude de style), le poignet couche la hampe). Règles dans `checkArbitreGen`.
- **La sim** (`assistantsStep`, sous `cfg.arbitreGestes`) : au hors-jeu l'assistant de la moitié porte `drapeauLeve` (`tenu`,
  rafraîchi tant que `a.drapeau` vit — le drapeau d'hier reste la source) ; à la touche de SA ligne (`sortie` out 'touche', le côté
  par z) la hampe inclinée du côté que l'équipe attaque — vers sa droite ou sa gauche, il fait face au terrain ; au `remplacement`
  l'assistant 1 (côté banc) `drapeauHorizontal` 3 s. La scène (arbitre.js) donne aux assistants la couche de geste du central ; le
  basculement de la hampe d'hier ne vaut plus que sans geste. `arbitreGestes:null` : la hampe qui bascule seule, au bit.
- **Les ramasseurs de balle** (`cfg.ramasseurs`, `ramasseurs.js`) : quatre corps assis aux quarts des touches (2,4 m dehors, face au
  terrain, chasuble jaune dans la scène), hors st.players ; au ballon hors d'atteinte (le 225b le rendait au point en une image :
  l'événement `ramasseur`), le plus proche TROTTE au ballon (3,6 m/s), le RAMASSE (`ramassage`, le ballon dans ses mains dès le
  contact du geste, le corps qui se tourne vers le point), le ROULE (`rouleMain` : au contact le ballon part à la vitesse qui l'arrête
  au point — le frottement du moteur mesuré, d = 0,667·v^1,56 : 2 m/s → 1,6 m, 4 → 5,8, 8 → 17,1) et revient s'asseoir ; le roulé
  arrêté à ≤ 2,5 m du point s'y pose ; la remise attend (`r.at`) ; `patience` 12 s : le point d'hier. Contrat (verify-ramasseurs,
  5 clauses) : la touche hors d'atteinte — le ramasseur part au premier pas (18,9 m), ramasse à 5,2 s, roule à 6,4 s (2,9 m/s pour 4 m,
  arrêt à 0,29 m du point, posé), la remise prise à 12,5 s, le ramasseur assis à 12,8 s ; null → le point en une image ; sabotage
  vitesse 0,2 → 'patience-ramasseur'. Dettes : le ballon dans les mains est posé par la sim (35 cm devant, à 0,95 m), pas par la
  scène ; les ramasseurs derrière les buts n'existent pas ; le quatrième arbitre non plus.

## L'avant-match et les gestes sociaux (A11 ter — Animations_A_Faire § 7 ; `engine/ceremonie.js`, `cfg.ceremonie`, note 381)

- **La file des poignées** (`cfg.ceremonie.poignee`, `ceremonieStep` — appelé en tête du bloc de remise de match-sim, il POSSÈDE la
  remise tant qu'il rend vrai) : au premier pas du match (l'engagement posé à la construction), l'équipe qui n'engage pas est POSÉE en
  rangée le long de la médiane dans sa moitié (`rang` 0,42 m de la ligne, `pas` 0,8 m entre les hommes, décalée de `decale` 2,6 m du
  point central pour laisser le ballon dégagé, le regard vers l'adversaire —
  yawWant chaque image), l'équipe qui engage en file de l'autre côté (`espace` 0,75 m) ; chaque homme de la file défile DE CÔTÉ face à
  la rangée (le regard tenu `p._regard`, movement.js : le cap suit le regard même en marche — le pas devient chassé) et serre la main
  de l'homme d'en face À L'ARRIVÉE (≤ `arrive` 0,3 m : événement `poignee` {by : la file, avec : la rangée}, `tenue` 0,35 s), sans
  doubler celui de devant (il attend un homme derrière lui) ; au bout de la rangée il trotte (`trot` 2,4 × marche) à sa place
  d'engagement (la position de construction) ; la rangée part quand le dernier de la file est passé. L'engagement (`r.at`) attend
  que tous soient à ≤ `marge` 1,2 m de leur place (ou `patience` 60 s), puis `avant` 1,2 s. L'HORLOGE (referee.chronoStep) : la
  période part au coup d'envoi (`st._ceremonie.fin` s'ajoute à la fin nominale) et la cérémonie n'est pas un arrêt de jeu (les
  arrêts ne s'accumulent pas tant que `actif`) ; le fil (ticker.js) date à partir du même coup d'envoi.
- **Les gestes** (motion-emotion, générés) : `serrerMain` (1,2 s, contact 0,3, tenue 0,85 : le bras droit tendu devant à hauteur de
  ceinture-poitrine, la gauche en balancier — le clip authored `poignee` LEVAIT le bras à 1,7 m sur ce rig) et `saluer` (2,4 s : le bras
  droit levé haut, l'avant-bras qui balance à 2,5 Hz, la gauche calme — le clip authored `salut` sortait la main à 1 m) ; leurs règles
  dans `checkEmotionGen` (la main devant ≥ 22 cm entre bassin et épaule ; la main au-dessus de la tête ≥ 8 cm et ≥ 3 changements de sens).
- **La scène** (rondo-fete.js) : l'événement `poignee` joue `serrerMain` sur les DEUX corps et `poigneeWarp` tire la main droite de
  chacun vers la main de l'autre (à 15 % de l'écart — le point médian recalculé à chaque passage de la boucle laissait 17 cm), deux IK
  deux os (`_armTo`, le patron de la main saisie C2), de 0,15 à 0,85 s du clip, MUTUELLEMENT (la rangée serre un nouvel homme toutes
  les ~0,9 s : on ne tire que vers celui qui nous tient). Mesuré en page : l'écart des mains p50 5,6 cm, p90 7,4, à 1,15 m de haut.
- **Le salut au public** (`cfg.ceremonie.salut`, `salutStep` au sifflet final — la remise 'fin') : chacun se tourne vers la tribune
  (`tribune` +1 : z > 0, le regard tenu) et salue (`salut` échelonné de `pas` 0,15 s après `attente` 0,6 s) ; la scène joue `saluer`
  `duree` 2,8 s puis rend le corps.
- **La carte** (motion-arbitre `carton`) : tenue 0,3 s de plus (2,3 s, hold 1,85), face au fautif (le regard du central suit `dir`
  — la loi d'A11 bis) ; la plaque de la scène aux dimensions réelles (8,6 × 12 cm) tenue au bout des doigts (arbitre.js). Dette : la
  plaque reste dans le plan de la main (vue de face elle se lit de biais).
- **Les épingles** : la cérémonie change les 40 premières secondes de TOUT match — 33 bancs qui jouent un match épinglent
  `ceremonie: null` (chaque clause mesure le monde de son jour) ; verify-ceremonie seul la joue.
- **Contrat** (verify-ceremonie, 8 clauses ; une période de 40 s, le temps additionnel minimum épinglé à 0) : 121 poignées (11 × 11),
  les places rejointes après 37,5 s, l'engagement pris à 38,5 s (hier 0,4) ; 0,4 s après chaque poignée les deux hommes à ≤ 1,1 m et
  face à face (100 %) ; à la prise chacun à ≤ 2,5 m de sa place ; les arrêts comptés à la prise 1,0 s et la fin de match à
  fin + 40 s ; 22 saluts en 3,8 s, tournés vers la tribune (100 %) ; la carte 2,3 / 1,85 ; ceremonie:null → aucune cérémonie,
  l'engagement à 0,65 s, l'hier ; sabotage rang:3 attrapé (aucune main ne se joint).

## Le remplacement : l'entrant trotte (Animations_A_Faire § 8 ; `cfg.entrant.trot`, `match-sim`, note 383)

`referee.remplacer` (Loi 3) fait sortir le remplacé en marchant à un arrêt de jeu et fait naître l'entrant à la ligne (phases out
→ longe → in). Sous `cfg.entrant { trot 1.6 }` et `st.full`, l'entrant en phase `in` porte `p._walkF = trot` : il rejoint son poste
au trot (marche × 1,6) au lieu du pas d'hier — mesuré : l'entrant naît à la ligne à 3,8 s et marche × 1,6 (hier × 1 ;
verify-boiterie « L'ENTRANT TROTTE »). `entrant: null` = hier au bit. Dettes : la poignée de main à la ligne entre le sortant et
l'entrant (le geste `serrerMain` existe, § 7 ; il faudrait les deux corps au même point de la touche), le quatrième arbitre
(un corps de plus, § 5) et le panneau ; un seul corps par remplacement.

## Les petits gestes du match (Animations_A_Faire § 10 ; `cfg.petitsGestes`, `engine/petits-gestes.js`, note 384)

Cinq gestes que le match montrait sans les jouer, chacun sous SA sous-clé, un événement nommé `geste { by, move, foot }` que la scène
joue sur un corps libre (`_playTech`) ; trois gestes générés de plus (`teteDefensive`, `controleOriente`, `feinteAppel`, dans MOVES et
sous contrat). `petitsGestes: null` = hier au bit (aucun événement, aucune attente, aucun regard).

- **La semelle du preneur** (`semelle { tenue 0,7, vMax 0,8 }`, `canTake` → `semelleAvant`) : à la sortie de but, le preneur arrivé au
  ballon (≤ vMax m/s) y pose la semelle (`arretSemelle`, la tenue de 0,62 s du geste) et la remise ATTEND `tenue` s. Mesuré : le
  preneur à 0,78 m/s pose à 3,2 s, la sortie part 0,72 s après (3,9 s c. 2,8 sans la clé). La scène met la semelle SUR le
  ballon (`rondo-fete.semelleWarp` : pendant la tenue, le pied le plus proche va au-dessus du ballon par l'IK de la touche — le clip
  posait la semelle 30 cm devant un corps arrêté à 10-18 cm du ballon).
- **Le gardien replace son mur** (`mur { delai 0,6, duree 1,6 }`, `petitsGestesStep` au pas de l'arbitre) : au coup franc adverse, le
  mur élu (match-sim `r._mur`) depuis `delai` s, le gardien DÉSIGNE (`designer`, le pied par le côté du mur : z > 0 = miroir) et tient
  le regard vers le point du mur (`p._regard`, la voie du § 7) pendant `duree` s ou jusqu'à la reprise. Mesuré : le mur élu à 0,02 s,
  le geste à 0,63 s, 4° d'écart au point, le regard relâché à 1,64 s.
- **Le dégagement armé** (`teteDefensive: true`, `teteArmerStep` → `modeTeteDefensive`) : la tête SAUTÉE d'un corps à < 24 m de son
  but (hors la tête au but : < `tete.but` m dans la surface adverse — l'ordre de `teteStep`) s'arme en `teteDefensive` : même durée,
  même contact que `tete` (0,9 / 0,42 — le flux d'hier au bit : le windup et la tête à la même heure, 1,27 / 1,70 s dans la fixture
  de B3 posée sur un défenseur), le buste et le cou armés davantage (tête −19,5° avant le contact c. −12,0), le buste qui frappe moins
  loin devant (le front passe sous le ballon), les bras plus hauts. La scène joue aussi `teteDefensive` sur une tête réactive sautée
  en mode `dégagement`.
- **Le contrôle orienté** (`controleOriente { angle 45 }`, scène seule — rondo-sim est au plafond et tourne déjà le receveur hors du
  presseur par `yawWant`) : au `control` d'un receveur que la sim tourne de ≥ `angle` ° (yawWant − yaw, lu à l'événement), la scène
  joue `controleOriente` — l'intérieur reçoit (turn 40°) pendant que les hanches (+12° au contact) et le regard s'ouvrent vers la
  course, l'amorti pousse devant — le pied par le sens du virage (à droite = le miroir). Matière : 8 des 17 contrôles de 90 s.
- **La feinte d'appel** (`feinteAppel { cadence 20, vMax 2,2 }`, `movement` au départ d'un appel) : le soutien posé (≤ vMax m/s) vend un
  crochet du buste (`feinteAppel`, haut du corps seul — la foulée garde les jambes, le démarrage est celui de la sim : la vente à 0,15 s
  penche et tourne le buste du côté vendu, le bras s'ouvre ; au contact 0,3 s le buste repart de l'autre côté ×0,6), une fois par
  `cadence` s. Rare par construction (1 en 90 s : l'appel se tire en jeu posé, hold > 0,6 s).
- **Banc** : verify-petits-gestes 15/0 (les trois gestes × 40 styles sous contrat et checkClip ; la semelle, le mur, le dégagement, la
  feinte, les clés nulles) ; le jumeau d'empreinte avec `petitsGestes: null` = base au bit.
- **L'applaudissement d'encouragement** (notes 387, 389 ; `applaudir { n 2, rayon 22, vMax 3,5, cadence 10, cadenceJoueur 20, decal
  [0,15 ; 0,8], p { arret 0,7, tir 0,35, duel 0,4, glisse 0,4, interception 0,4, tacle 0,4, recuperation 0,15 } }`) : sur une occasion
  (l'arrêt, le tir, le duel ou le glissé gagné, l'interception, le tacle, la récupération — `turnover.why`), une probabilité par occasion ;
  un ou deux coéquipiers libres et posés à `rayon` m, TIRÉS AU SORT (pas les plus proches), partent décalés (`decal`, le second ≥ 0,25 s
  après) ; une salve par équipe par `cadence` s, un corps pas deux fois en `cadenceJoueur` s — occasionnel et sans chorégraphie (8-10
  par 300 s sur 6-8 corps). Au salut final une part tirée au sort (`ceremonie.salut.applaudir` 0,4) applaudit la tribune au lieu de
  saluer (l'événement `salut` porte `geste`). C'était le seul geste généré
  sans déclencheur : l'inventaire complet est dans `docs/Inventaire_Gestes.md` (75 sur 75 après ce lot, 74 avant — généré).
- **Dettes** : la tête défensive DEBOUT reste `teteDebout` ; le contrôle orienté n'a pas d'événement sim (la scène le lit sur yawWant) ;
  le râteau à la relance n'est que la semelle (le preneur ne ramène pas le ballon) ; le gardien désigne sans crier ni avancer.

## L'enchaînement contrôle poitrine → reprise de volée / retournée acrobatique (`cfg.enchainement`, note 386 — verify-enchainement 8/0)

Retour : « un enchaînement contrôle poitrine reprise de volée c'est possible ? ou contrôle poitrine et retournée ? ». Oui, et les pièces
existaient : la poitrine (182a, `chestStep`) prenait le vol à 1,15-1,55 m mais le TUAIT devant le corps et son cooldown de 0,8 s fermait
toute reprise ; la volée (lot 40, `voleeStep`) et la retournée armée (C1, `retourneeArmerStep`) vivent dans le même bloc aérien de
`rondo-sim` (phase `flight`, ballon libre) ; la prise à portée (< 1,9 m de haut) ramassait le ballon tombé. L'enchaînement est une loi de
la poitrine, dans la surface (`but` 16 m) :

- **face au but** (|dA| ≤ `volee.face` 1,0 rad) : la poitrine POSE le ballon — la vitesse se déduit du ballon réel pour qu'il soit
  `devant` 0,6 m dans le regard à `hauteur` 0,7 m en `delai` 0,45 s (la poitrine le prend jusqu'à 0,9 m du corps : un pop fixe laissait
  la reprise hors portée) — et `voleeStep` l'enchaîne : mesuré, la volée 0,42 s après la poitrine, ballon à 0,80 m et 0,48 m du corps ;
- **dos au but** (|dA| ≥ `retournee.dos` 2,0 rad) et libre (aucun adversaire à `libre` 1,5 m) : la poitrine le REMONTE au-dessus de
  la tête (`hauteur` 1,75 m à l'heure du contact du clip, 0,15 m derrière lui, vers le but) et la retournée s'arme au pas d'après :
  mesuré, windup 3 images après la poitrine, le ciseau à 1,70 m, le tir « retournée » ;
- **le ballon remonté reste du ciel** jusqu'à sa reprise (`st._enchaine { id, mode, until }`) : le bloc aérien tourne même hors phase
  `flight`, la tête armée et la tête réactive le laissent, la prise basse attend (`prise` 0,45 m)  ; un ballon à hauteur de poitrine dans la surface adverse n'est pas pris au pied (la prise volait la poitrine, mesuré en page); les événements se nomment
  (`control poitrine { enchaine }`, `volée { enchaine: 'poitrine' }`, `windup retournee { enchaine }`, `retournée { enchaine }`) ;
- **et le tireur ne se re-prend pas sa volée** (`apres` 0,35 s) : mesuré, la volée ORDINAIRE d'hier était ramassée par son tireur
  0,05 s après le tir (« amorti-poursuite », le ballon encore à portée) — une dette du tronc, ici sous clé.

La scène ne change pas : `amorti` (la poitrine) puis `frappe` au contact (la volée) ou le clip `retournee` au windup — les gestes
existaient, seul le moteur les enchaîne. `enchainement: null` = hier au bit (épinglé sur les bancs datés). Dettes : la poitrine reste
rare en match (1 par dix minutes, les passes sont au sol) ; la retournée n'est enchaînée que dos au but ET libre.

## Bancs

verify-contact 25 → 34 (la pose tenue vit et se ferme ×3, l'horloge en pur ×2, la sim sous cfg.sol ×3, sabotage
vie 0), verify-emotion 33/0 (nouveau, dans bancs.mjs), verify-motion 206/0, verify-attente 54/0 ('abattu'),
verify-foulee 55/0, verify-persona 25/0, verify-gesture 28/0, verify-animkit 136/136, verify-sync 9/0. Banc complet : 742/1
(le rouge : 246d, hérité) — les deux nouvelles clés par défaut (sol, fete) ont déplacé quinze clauses de flux qui mesurent le
monde de leur jour ; elles sont épinglées à null aux sites datés (`sol: null, fete: null /* DATÉ 15/09 */`), l'empreinte jumelle
prouvant que clés nulles = hier au bit.
