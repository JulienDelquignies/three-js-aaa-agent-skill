# 55 — Le contact (motion-contact, lot A10)

La sim couchait le fauté (`p.down`) mais la scène ne dessinait rien : un joueur fauché restait DEBOUT,
figé dans son clip d'attente pendant 0,7 s, puis repartait. Le duel d'épaule n'avait pas de corps.
Le porteur pressé dans le dos ne protégeait rien. Et la course arrière du lot A7 n'avait aucun
déclencheur : le cap d'un défenseur suivait toujours sa dérive, jamais le porteur.

`engine/motion-contact.js` génère six gestes — des fonctions pures du temps, du rig et du style —,
`duel.chuter` nomme la chute, `movement.js` donne au presseur qui recule une consigne de face, et
`scenes/rondo-contact.js` habille tout ça en lisant la sim, jamais en l'inventant.

## Les espèces (CONTACT_KINDS)

| espèce | situation | corps | contact / couché / relevé |
|---|---|---|---|
| `chuteAvant` | jambes prises (tacle glissé, fente), percuté dans le dos | trébuche, part en avant, les mains cherchent le sol, la poitrine se pose ; couché à plat ventre (bassin 0,23 m, tête relevée de 22°) ; relevé : les mains poussent (à quatre pattes, bassin 0,55 m), les genoux, un pied sous le corps, debout | 0,50 / 0,66 / 1,20 → 1,9 s |
| `chuteCote` | bousculé de côté (charge, épaule) | sur la hanche DROITE puis l'épaule (bassin 0,23 m, tête 57 cm à droite), le bras droit amortit, la main gauche devant ; relevé par la main et le genou | 0,48 / 0,64 / 1,15 → 1,8 s |
| `chuteArriere` | accroché, tiré en arrière | s'assied, part sur le dos (bassin 0,19 m, tête 61 cm derrière, elle REPOSE à 0,13 m), les mains derrière ; relevé par la flexion | 0,50 / 0,66 / 1,15 → 1,8 s |
| `trebuche` | la course cassée sans chute (épaule perdue, accrochage) | le buste plonge (19 cm devant le bassin), deux appuis courts le rattrapent, les bras s'ouvrent | 0,30 → 0,85 s |
| `epaule` | le duel d'épaule (épaule DROITE dans l'adversaire) | l'épaule sort de 17 cm et descend de 15, l'appui droit s'écarte de 20 cm, le bassin se décale de 10 cm vers l'adversaire, coude rentré | 0,25 → 0,6 s |
| `protection` | adversaire à DROITE-derrière du porteur | le bras droit TENDU vers lui (main à 45 cm à droite, 44 cm derrière), le tronc tourné de 20° à l'opposé, la main gauche devant ; un plateau TENU (hold 0,45 s) | 0,25 / hold 0,45 → 0,7 s |

Côté DROIT ; le miroir d'animkit fait la gauche. Les chutes n'ont PAS de style de corps (le sol est
où il est — dix styles rouges à 1 cm près avant de le retirer) ; le trébuchement, l'épaule et le
bouclier gardent le penché et le port de bras du joueur (bornés [0,85 ; 1,2]).

## Ce qui a été mesuré en construisant

- **Le pôle du genou suit la jambe.** Un pôle fixe devant-haut était ANTI-parallèle à hanche→pied une
  fois couché (composante ⟂ nulle : la vrille sautait de 180°, genou à 62 cm du sien, 174 rad/s) ; un
  pôle qui tourne « par derrière » passe par l'axe de la jambe (le solveur retombait sur son axe x,
  genou à 15 cm sur le côté). La loi : le pôle est la direction hanche→pied tournée de 90° dans le
  plan sagittal — debout devant, couché bas, en flexion devant-bas — toujours ⟂ à la jambe.
- **La normale du plan du genou vient du pôle**, pas de la géométrie (`legIK2` : tibia × cuisse a le même
  signe qu'elle sur toute jambe pliée et s'annule sur une jambe tendue).
- **Le relevé passe par les genoux** : un pied encore loin derrière sous un bassin bas mettait le genou
  dans la pelouse ; le bassin remonte d'abord (les mains poussent, à quatre pattes à 0,55 m), les
  tibias à plat derrière, puis un pied sous le corps.
- **Les marges du sol** : le genou posé (son centre à 2 cm du plan des semelles), le poignet d'une paume
  posée (3 cm), le bassin et la poitrine couchés (8 et 10 cm) ; les orteils au sol SONT le plan du sol.

## La sim (sous la clé `cfg.contact`)

`cfg.contact = { chute: 1.6, glisse: 0.5, jockey: { d: 4.5, vMax: 3.5 } }`, allumée. Absente, le
tronc au bit (mêmes 430 passes, 581 armés, 140 pertes, 10 041 refus timing sur 6 graines × 300 s ×
deux mondes).

- `duel.chuter(st, c, foe, cfg, cause)` — appelé où la sim fauche : tacle glissé subi (`S.trip` 0,7 s
  hier), accrochage qui fauche (0,6 s hier), et deux fautes qui ne couchaient personne : la charge
  dans le dos et la fente qui trouve le corps. `down = chute` s, le corps GLISSE de `glisse` × sa
  vitesse (`movement._glisse`, le transport du tacleur), et la chute est NOMMÉE : `p._chute = { kind,
  side, by, cause }` + événement `chute`. Les jambes prises et le percuté partent EN AVANT (l'élan est
  devant — mesuré : un « arrière » sur une fente de face glissait vers l'avant sur le dos), de côté sur
  la hanche (le côté du coup, +1 = de la droite), retenu en arrière.
- `movement.js` — LE JOCKEY FAIT FACE : le presseur (`job` press) à ≤ `d` m du porteur adverse, qui
  recule ou se décale (il ne court pas sur lui, ≤ `vMax`), garde le regard sur lui (`yawWant`, le slew
  borné) : la course arrière et le pas chassé du lot A7 se déclenchent.

Mesuré (3 × 300 s, cfg de la scène) : 5 chutes nommées pour 8 fautes (côté, avant ; tacle debout,
tacle glissé), le fauché à terre p50 1,62 s ; presseurs à ≤ 4,5 m en mouvement : face au porteur
76 % des images (60 sans la clé), course arrière 3 % + pas chassé 9 % (0 + 2 sans).

## La scène (rondo-contact.js)

- `contactEvent` : l'événement `chute` joue la chute de son espèce (miroir au côté du coup : poussé de
  droite, on tombe à gauche) ; le `duel` d'épaule joue `epaule` sur le chargeur (miroir au côté de
  l'adversaire) et `trebuche` sur le perdant ; l'accrochage qui casse la course sans faucher joue
  `trebuche`.
- `contactClock` : le clip TIENT à la pose couchée tant que `down` dépasse la durée du relevé (gel
  vrai : l'horloge s'arrête), puis le relevé se rejoue pour finir quand la sim relève (down 0 ↔ clé
  finale) — le patron du tacleur et du gardien ; la chute POSSÈDE les jambes tant que le corps est au
  sol (la glissade ferait lire « il court » : poids des jambes 0,79 mesuré avant). Le bouclier tient
  son plateau tant que la pression dure.
- `contactShield` : le porteur, un adversaire à ≤ 1,4 m sur le flanc ou dans le dos, prend le bouclier
  (haut du corps seul, `_wLegs` 0). Mesuré : 232 images d'occasion en 110 s de jeu, toutes sous 0,35 s
  — le porteur pressé de si près agit (passe, contrôle, frappe) avant que le plateau ne s'installe ;
  la pose est là, la sim ne tient pas le ballon assez longtemps pour la montrer.

## Le contrat (verify-contact.mjs — 25 clauses)

Six gestes sous `checkContactGen` et `checkClip` ; 20 styles × 6 ; ce qui est propre (les trois sens
de chute, une main au sol avant la pose couchée, le relevé par le genou puis la flexion, la tête jamais
dans la pelouse, le trébuchement qui se rattrape, l'épaule qui s'appuie, le bouclier qui met le corps
entre) ; le registre ; la sim (le fauté tombe nommé, ≥ 1,3 s à terre, le presseur fait face, la clé
absente rend l'hier) ; six sabotages (chute qui ne se couche pas, sans direction, qui s'enfonce,
trébuchement qui ne plonge pas, épaule qui ne sort pas, bras ballant).

## Mesuré en jeu (match11, graines 7 et 3)

- Graine 7, t = 283 s : fente qui trouve les jambes → `chuteAvant`, le fauché à plat ventre, mains sous
  la poitrine, le tacleur qui passe (capture `a10-chute-avant-couche`) ; le relevé à quatre pattes puis
  en flexion (`a10-chute-avant-releve`).
- Graine 3, t = 117 s : duel d'épaule gagné → `epaule-gauche` sur le chargeur, `trebuche` sur le battu
  (`a10-epaule`) ; t = 126 s : bouclier 0,3 s avant une frappe (`a10-protection`).

## Le banc du match (bancs.mjs, 8 shards)

532 ✓ / 10 ✗ sur le moteur A10 (A9 bis : 536 / 6). Les dix rouges, relus clé allumée contre clé absente :

- le budget 1,61 ms/step ≤ 1,6 : la contention des 8 shards (seul : 0,53 allumée, 0,52 absente) ;
- le FLUX 24 × 300 s « troisième homme » : rouge sur les trois bancs (A9 bis plat, lob, A10), pré-existant ;
- « PERSONNE NE TIRE » à la graine 7 : la graine sèche du lot 17 (0 tir à 480 s, 2 à 600 s avec la clé, 3
  sans) ; cette graine n'a ni faute ni chute avec la clé — seul le cap des presseurs re-tire la trajectoire ;
- le FLUX des contres (lot 242), rejoué : le monde SANS contreZones a bougé (zéro zone 61 → 35 %, 14/23 →
  7/20 contres), le monde avec la clé est resté (35 → 41 %, 7/20 → 9/22) — vingt contres par monde, un
  écart exigé de 15 points ;
- six lames de couteau datées par leurs propres commentaires (recule 8 ≤ 7, petit pont 2 ≥ 3, bélier 568 ≥
  593, surface 60 ≥ 67 sur 12 × 300 s, gradation rung 30 déjà rouge aux bancs A9 bis, traversées 10,3 ≤ 8).

L'équilibre, mesuré à 36 graines × 600 s (six heures de jeu par monde) :

| monde | tirs | dans la surface | passes | pertes | buts |
|---|---|---|---|---|---|
| clé allumée | 111 | 70 % | 5 439 | 1 602 | 17 |
| clé absente (le tronc) | 123 | 56 % | 5 480 | 1 617 | 16 |
| jockey seul (les chutes d'hier) | 133 | 68 % | 5 260 | 1 612 | 17 |

L'écart-type d'une graine est de 2 tirs : les sommes tiennent dans une sigma. Un effet systématique, nommé :
les refus « contrôle-dos » 3 550 c. 4 194 (−15 % sur 24 graines) — le presseur qui fait face a moins de
ballons dans le dos, la loi du cône de prise (lot 70) le lit. Le jockey est une loi de la sim (le cap entre
dans les cônes de `duel.js` et de la prise), pas un habillage ; l'alternative — un canal de face visuel
(`p.yawFace`) dessiné par la scène sans que la sim le lise, monde au bit hors fautes — est nommée pour le
tronc s'il préfère ses cônes d'hier. Verdict : la clé re-tire les trajectoires comme A9 (« le tirage, pas la
clé »), l'équilibre tient, l'hier au bit sans la clé.

## Les dettes nommées

- Le bouclier n'a pas de durée en jeu (la sim relâche le ballon sous 0,35 s quand on est collé) ; une
  tenue de balle dos au but serait une loi du moteur (à proposer : un `hold` de protection sous presse).
- Le duel d'épaule est rare (1 en 360 s sur la graine 3) : `chargeStep` demande 0,4 s à ≤ 0,85 m.
- La chute ne lit pas encore l'adversaire au sol (deux corps se traversent) ; pas de relevé « aidé ».
- Le fauché glisse dans le sens de sa vitesse, quelle que soit la chute (le retenu glisse peu : 0,25 ×).
- Ni protestation ni douleur : c'est le lot A11 (l'émotion).
