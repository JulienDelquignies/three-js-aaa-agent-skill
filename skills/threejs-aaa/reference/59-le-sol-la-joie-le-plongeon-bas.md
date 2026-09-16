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

## Bancs

verify-contact 25 → 34 (la pose tenue vit et se ferme ×3, l'horloge en pur ×2, la sim sous cfg.sol ×3, sabotage
vie 0), verify-emotion 33/0 (nouveau, dans bancs.mjs), verify-motion 206/0, verify-attente 54/0 ('abattu'),
verify-foulee 55/0, verify-persona 25/0, verify-gesture 28/0, verify-animkit 136/136, verify-sync 9/0. Banc complet : 742/1
(le rouge : 246d, hérité) — les deux nouvelles clés par défaut (sol, fete) ont déplacé quinze clauses de flux qui mesurent le
monde de leur jour ; elles sont épinglées à null aux sites datés (`sol: null, fete: null /* DATÉ 15/09 */`), l'empreinte jumelle
prouvant que clés nulles = hier au bit.
