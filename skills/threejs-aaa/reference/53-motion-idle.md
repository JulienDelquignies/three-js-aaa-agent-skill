# 53 — L'attente générée (motion-idle, lot A8)

À l'arrêt, tous les joueurs jouaient le clip idle du donneur Soldier : la même pose de garde-à-vous,
bras le long du corps, les mêmes secondes pour tous, le gardien compris — debout comme un piquet à
30 m du ballon, 43 % de son temps. Une remise en jeu, c'était onze statues (captures du sweep de
la note 302 bis).

`engine/motion-idle.js` remplace ce clip par une **attente calculée** — une fonction pure de
(t, espèce, style), posée par le contrôleur sous 0,6 m/s avec l'écrivain de la foulée générée
(reference/52), fondue avec elle au-dessus et d'une espèce à l'autre en 0,5 s.

## Ce qui vit dans une attente

- **Le poids qui passe d'un pied à l'autre** : le bassin balance de ±3,5 cm (période 6-9 s, propre
  à chaque joueur) et ROULE vers la jambe libre (la hanche déchargée descend) ; les pieds sont FIXES
  en repère personnage (les jambes sont résolues par IK sur le bassin qui bouge : une attente ne
  glisse pas). La jambe libre lève le talon de ce qui lui manque en portée quand le bassin s'en va.
- **La respiration** : l'inspiration lève les clavicules (rz ±1,4°) et ouvre la cage (extension
  haute), période ~4 s — 5 mm d'épaules, visible et petit.
- **Les bras qui vivent** : micro-balancier de 0,4-2,5° sur des périodes incommensurables (5,1 et
  6,7 s) — jamais de boucle qui se voit.
- **La vrille de l'humérus** (`armPose`) : la nouveauté qui manquait à `armJoints` — une main sur
  une hanche ou devant le bas-ventre, c'est le plan du coude qui tourne. Angles trouvés par
  recherche FK sur le rig (poignet à ≤ 1 cm de la cible), symétriques par le miroir (une rotation
  autour de X garde son signe d'un côté à l'autre).

## Les espèces (IDLE_KINDS)

| espèce | situation | corps |
|---|---|---|
| `repos` | le fond de l'attente | pieds à 22 cm, genoux souples, bras le long du corps, poids qui passe |
| `mainsHanches` | le temps mort, le calme (persona.calm > 1,1) | mains sur les crêtes iliaques, coudes dehors et derrière |
| `sautillement` | le temps mort, le nerveux (burstiness > 1,18) | rebond de 3,5 cm à 2,4 Hz, sur la pointe au sommet, coudes à 70° |
| `pret` | défenseur à ≤ 5,5 m du porteur adverse | pieds à 48 cm, genoux 35°, buste 18°, mains devant à hauteur de hanche |
| `pretGardien` | gardien, ballon à ≤ 32 m, jeu vivant | plus bas (genoux 43°, bassin −9 cm), plus large (60 cm), gants ouverts devant (64 cm), buste 26° |
| `mur` | défenseur à 9,5 ± 1,3 m d'un coup franc adverse | pieds serrés, mains croisées devant le bas-ventre (12 cm), menton rentré |

`idlePolicy(ctx, persona)` est pure : la scène pose `ctrl.idleCtx = { keeper, dead, wall, ballD,
carrierD, defending }` (une ligne, lue de la sim) et le contrôleur choisit. `idleStyleFromSeed`
(graine de persona + 101) : largeur, balancement, période, respiration, coude, écartement,
inclinaison, ouverture des pieds, et surtout la PHASE — dix joueurs n'inspirent jamais ensemble.

## Le contrat (verify-attente.mjs — 40 clauses)

- six espèces sous `checkIdleGen` : pieds immobiles (≤ 5 mm), rien sous la pelouse, genoux dans la
  bande de l'espèce, mains où l'espèce les met (poignet à ≤ 7 cm de la crête ; mur ≤ 16 cm entre
  les mains, devant le bas-ventre ; garde et gardien devant et sous les épaules, gants ouverts ≥ 45
  cm), respiration 2-25 mm d'épaules, balancement dans la bande, bassin jamais au-dessus du repos ;
- 24 styles × 6 espèces sous contrat, phases déphasées, deux joueurs différents (4,3°) ;
- pure, lente (≤ 4 rad/s, 12 en sautillement), cycles sous `checkClip` ;
- ce qui est propre : le poids qui passe, le bassin qui roule, le rebond sur la pointe, gardien plus
  bas que la garde plus basse que le repos, gants plus ouverts que les mains, menton rentré, coudes
  dehors ;
- la politique : gardien ≤ 32 m → position, temps mort → tempérament, mur → tout le monde, porteur
  à ≤ 5,5 m → garde ;
- huit sabotages attrapés : pieds qui suivent le balancement, orteil sous la pelouse, mains loin des
  hanches, mur bras ouverts, pas de respiration, garde jambes tendues, gants fermés, balancement de marin.

## L'intégration

- `character-controller._applyGeneratedGait` : `pose = slerp(attente, foulée, w(v))` avec w de 0,25 à
  0,6 m/s ; l'attente = `slerp(espèce précédente, espèce, blend)` en 0,5 s ; l'horloge d'attente est
  propre au joueur (dt du contrôleur, persona.phase). Le mixer ne pose plus rien sous 0,25 m/s :
  l'idle du donneur est REMPLACÉ, pas fondu. `ctrl.setIdle(kind)` force une espèce (la planche).
- Rondo : la ligne de contexte (`idleCtx`) lue de la sim ; deux déclarations compactées pour tenir
  sous le plafond de volumétrie.
- `gait.js` : sous 1,4 m/s la loi de cadence raccourcit la foulée (f = 0,93·(v/1,4)^0,25, soit
  S ∝ v^0,75 : 0,59 m à 0,4 m/s) — avec la foulée générée du lot A7, qui suit la loi à la lettre,
  le segment linéaire donnait des enjambées de 1,5 m au ralenti aux joueurs qui se replacent.
- `contact-sheet.mjs --idle <espèce> [--variant before|after|both]` : huit instants d'une période.

## Mesuré en jeu (match11, graine 7)

- Touche à t = 170 s : 17 joueurs à l'arrêt, 5 mains sur les hanches, 6 sautillements, 6 repos —
  la politique lit la persona ; le gardien calme met les mains sur les hanches.
- Le gardien en position d'attente à 27 m du ballon (t = 247 s) : pieds larges, genoux fléchis,
  buste penché, gants ouverts devant (capture).
- Le mur : pas de coup franc en deux matchs (graines 7 et 3, 12 minutes de jeu — touches, corners et
  engagements seulement) ; l'espèce est sous contrat, la géométrie du déclencheur suit `match-sim`
  (9,15 + 0,35 m du point de remise). À observer au premier coup franc.

## Les dettes nommées

- Les genoux de shanon : le bind a déjà 8° de flexion, une attente droite mesure 16° (portée 0,993).
- Les joueurs qui se REPLACENT à 1-1,5 m/s pendant un temps mort marchent de côté en pas chassés
  larges (la sim les fait regarder le jeu) : une consigne « on se retourne pour marcher » serait plus
  juste (moteur).
- Pas encore de variantes de repos (bras croisés, mains dans le dos, étirement), ni de regard qui
  cherche le ballon pendant l'attente — le regard est celui de gaze.js.
- Le mur ne saute pas et ne se serre pas au coup de sifflet ; la barrière se pose à l'instant où
  la sim la place.
