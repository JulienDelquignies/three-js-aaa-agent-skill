# 58 — Les signes visibles du rôle (lot A12) — le scan du receveur en vol (A12a)

> Campagne V (Recherche_Tactique_Individuelle.md → moteur) : les lois sont au moteur (lots 248-255, scellés), les
> SIGNES VISIBLES sont à l'animation. Interfaces gelées : `docs/Interface_Campagne_V.md`. Règle du lot : aucune loi
> de sim ne bouge — la scène LIT la sim, l'empreinte reste au bit ; chaque signe = un mécanisme prouvé sans rig,
> une clause de flux sur un match, une capture en jeu.

## A12a — Le scan du receveur pendant le vol (Jordet)

**Le signe.** Le document (§1.1, §3.5 A) : le receveur regarde autour de lui PENDANT le vol de la passe — 0,4 à
0,6 scan par seconde chez les professionnels (Jordet), jamais pendant la frappe du passeur ni pendant la prise —
et ajuste ses appuis de trois-quarts avant l'impact. Le lot 250 du moteur a mis l'horloge dans la SIM (`scan.js`,
`p.scan { at, until, vers, cible, n, vol }`, déterministe par acteur, aucun bit de jeu) ; personne ne la lisait.

**Avant.** `gaze.js` collait les yeux du receveur au ballon du départ de la passe à l'amorti (« LE geste de regard
le plus universel du football » — vrai pour la prise, faux pour le vol), et tenait sa propre horloge locale de scans
hors ballon (LCG par acteur, 1,5-4 s). Deux horloges, dont une aveugle à la sim.

**La politique (gaze.js, `pickGazeTarget`).** L'horloge de la sim a le dernier mot quand elle existe :
- saccade en cours (`scan.until > t`, cible posée) → les yeux vont à `scan.cible`, à hauteur de tête pour un
  corps (`GAZE.scanEyeHead` 1,6 m), d'horizon pour un espace (`scanEyeSpace` 1,0 m) — le receveur en vol compris ;
- receveur à portée de prise (ballon < `GAZE.prise` 1,5 m) → le ballon MÊME en saccade (la sim n'en ouvre pas à
  cette distance, celle en cours se coupe ici : les yeux retombent sur le ballon pour la prise) ;
- hors saccade → la politique d'hier, sauf le scan local hors ballon qui SE TAIT quand la sim porte `p.scan` : une
  seule horloge ;
- `cfg.scan` null → `p.scan` absent → littéralement le code d'hier.

La scène (`Rondo.js`) passe `scan: s.scan` et `pos: s.p` dans la vue du regard — une ligne. Le mécanisme (`Gaze`)
ne change pas : saccade 600°/s, poursuite 200°/s, clamp ±70°, la clause vestibulaire.

**Contrat (verify-gaze, 12 → 22 clauses).** Mécanisme : cible suivie, espace à l'horizon, saccade finie → ballon,
prise → ballon ; une seule horloge (0 cible locale en 10 s, aucune horloge locale armée) ; la tête suit (lacet 53°
vers un presseur à 53°, 0° à la prise) et le sabotage « saccade sans fin, sans garde de prise » est attrapé (53° à
la prise). Flux, graine 3 × 240 s, la politique appelée comme la scène l'appelle :

| Grandeur | Avec p.scan | Clé absente |
|---|---|---|
| Images de vol les yeux hors ballon | 29 % (≥ 15 %) | 0 % |
| Saccades par seconde de vol | 0,89 (Jordet ≥ 0,4 ; la sim mesure 0,73 — sa cadence, pas la mienne) | 0 |
| Yeux sur le ballon à la prise | 42/43 (≥ 95 %) | 43/43 |

**Captures (playmode, graine 3, t = 12,9 s, receveur 9, saccade vers le presseur à 53°, lacet de tête −49°) :**
`playmode-shots/a12a-scan-receveur-face.png`, `playmode-shots/a12a-scan-receveur-plan.png` — le ballon roule vers
lui, sa tête est tournée vers le presseur qui vient.

**Ce que le lot ne fait pas.** Il ne décide pas QUAND ni VERS QUOI le joueur regarde : c'est la sim (250, `cfg.scan`
et la note `scanning`). Il ne change aucun bit de jeu (verify-sync 9/0, empreintes du 250 inchangées).

## A12b — La réception de trois-quarts : la posture du receveur

**Le signe.** Le document (§1.2-1.3, §3.5 A) : le receveur « ajuste ses appuis de trois-quarts avant l'impact »
et contrôle du pied arrière. Le trois-quarts du CORPS est déjà à la sim (170, `cfg.corpsOuvert` : le lacet
s'ouvre vers le jeu pendant le vol) ; le pied est à la table des techniques (`pick.foot`, `footFor` : intérieur =
pied côté ballon, extérieur = l'autre). Ce qui manquait, c'est la POSTURE : le receveur attendait en `repos` (bras
le long du corps) ou trottait avec la foulée de tout le monde.

**Sonde AVANT (3 graines × 240 s, 62 réceptions).** Angle corps → origine de la passe à la prise : p25 14°, p50 30°,
p75 49° — de face 42 %, trois-quarts [25°, 110°) 53 %, dos 5 % ; techniques : contrôle intérieur 43, jambe tendue 9,
amortis 6, semelle 1 ; pied côté ballon 32, pied éloigné 12 ; vitesse à la prise p50 1,97 m/s. Et le constat qui
décide du lot : **le receveur ne s'arrête jamais** — 0 % des images de vol sous 0,6 m/s, 6 % des vols avec un seul
instant d'attente (126 vols). La posture doit donc vivre dans la FOULÉE lente, pas seulement dans l'attente.

**Deux mécanismes, aucun bit de sim.**
- `motion-idle` : l'espèce `reception` (pieds à 0,17 m, genou 16°, buste 9°, appuis vifs, bras en équilibre devant :
  élévation 26°, avancée 20°, coude 74°, tête haute — le regard scanne, A12a). Politique : `ctx.receveur` (le ballon
  vole vers moi) → `reception`, avant la garde, quel que soit le tempérament. Contrat : genou [8, 32]°, mains à ≥ 0,42 m
  l'une de l'autre et devant la poitrine ; sabotage « bras le long du corps » attrapé.
- `motion-gait` : `opts.receveur` — le receveur qui va au-devant du ballon garde les bras en équilibre : +12° d'élévation,
  +16° de coude, balancier × 0,55 (à 2 m/s : écart des mains 64 cm c. 52, course de la main 14 cm c. 28) ; la foulée
  reste sous `checkGaitGen` ; drapeau absent = la foulée d'hier au bit. Le contrôleur pose le drapeau depuis
  `idleCtx.receveur`, la scène le lit sur `st.pass.to` et `st.phase === 'flight'`.

**Contrat.** verify-attente 44 → 46 (l'espèce sous contrat sur 24 styles, la politique, le sabotage) ; verify-foulee
45 → 48 (les bras du receveur, le contrat tenu, le drapeau absent au bit). verify-gait 23/0, verify-locomotion 6/0.

**Retour utilisateur (15/09) : « les bras écartés à la réception, c'est pas terrible ».** Corrigé : la posture
`reception` garde les bras calmes le long du corps (élévation 12°, avancée 12°, coude 52° — au lieu de 26/20/74) et la
foulée du receveur n'ouvre plus les bras d'un écart uniforme (+4° et +8° par défaut au lieu de +12/+16, balancier
× 0,7). L'amplitude vient désormais du PORT DE BRAS de la persona (`persona.bras` ∈ [0,15 ; 0,9], tiré en dernier pour
ne pas déplacer les autres champs) : bras 0,15 → écart des mains 55 cm en marche, 0,9 → 61 cm, sans le drapeau 52 — le
jockey le lit aussi. Et le projet aval peut le POSER par joueur, avec la persona et les trois styles :
`docs/Interface_Style_Joueur.md`. Aucun bit de sim (empreinte du monde servi inchangée, 43b14c0f24b0bb37).

**Captures (playmode, graine 3).** `a12b-reception-approche.png` / `-face.png` (t = 4,3 s, receveur 1 à 1 m/s,
corps à 67° du ballon qui roule vers lui : appuis larges, genoux fléchis, bras ouverts) ; `a12b-reception-attente-
face.png` / `-plan.png` (t = 69,8 s, receveur 9 sous 0,5 m/s, corps à 38° d'un ballon en cloche à 13 m : la posture
tenue, les yeux en l'air). Planche : `planches/attente-reception-apres.png`.

**Dette nommée au tronc.** Le receveur ne reçoit jamais sur place (0 % des images de vol sous 0,6 m/s) : en vrai, une
partie des réceptions se fait à l'arrêt, le corps ouvert, le ballon qui vient au pied — c'est une loi de course
(approche du receveur, 134/198), pas d'animation. Le pied arrière comme DÉCISION (contrôle intérieur du pied éloigné
quand le ballon traverse) n'existe pas dans la table des techniques : idem, une loi sous clé, au tronc.

## A12c — La pausa : la semelle sur le ballon

**Le signe.** Le document (§3.5 A Pedri, §3.6 A Isco) : « s'arrête net, met la semelle sur le cuir, attend le geste du
milieu adverse, repart par une passe courte déguisée ». Le lot 253 du moteur a fait de la pausa une DÉCISION
(`pausa.js`, `cfg.pausa`) : le porteur au calme, dans le tiers adverse, deux adversaires lancés, une course partenaire
pas encore servable — il tient (`p._pausa`, la conduite figée : cible = soi, touche 0,25), l'événement `pausa` porte
durée, issue et gain à la sortie. L'interface gelée annonçait un geste (`kind: 'pausa'`) ; le moteur a livré un état
(`p._pausa`) — la scène lit l'état, tel quel.

**Le mécanisme (motion-idle, aucun bit de sim).** L'espèce `pausa` : le poids sur la jambe d'appui (le bassin décalé de
5 cm), l'autre pied LEVÉ sur le ballon — la cheville à 0,21 m au-dessus de la semelle à plat, l'orteil baissé de 8°, la
semelle qui épouse le dessus du ballon (rayon 0,11) —, les mains sur les hanches, la tête haute. Le pied levé vise le
ballon RÉEL de la sim : la scène passe chaque image `override.raise = { side, at: [x, z] }` en repère personnage
(`idleOpts`, nouveau passage du contrôleur), côté choisi par le côté du ballon, cible bornée à la portée (x ± 0,25 m,
z ∈ [−0,42 ; −0,12]) ; au-delà de 0,55 m, aucun pied levé — l'attente mains sur les hanches, les deux pieds au sol.
Contrat : cheville levée à 24-36 cm, devant ; pied d'appui au sol ; bassin sur la jambe d'appui ; genou [0, 80]°.

**La sonde qui décide.** Douze graines × 366 s (le format du match servi) : 11 pausas ; le porteur s'arrête vraiment
(v = 0) dans 4 d'entre elles, mais LE BALLON N'EST PAS AU PIED : à 1,6-2,0 m ; une seule pausa à l'arrêt avec le ballon
à 0,36 m (graine 11 en node) ; dans la page (graine 11) : 3 pausas, celle à l'arrêt a le ballon à 1,76 m. La « touche
0,25 » du 253 fige la conduite mais ne ramène pas le ballon : le corps freine, le ballon continue (mesuré 0,77 → 0,96 m
en 0,3 s sur la graine 3). Le signe « semelle sur le ballon » n'est donc PAS visible en match aujourd'hui ; ce qui se
voit, c'est l'attente mains sur les hanches à côté d'un ballon posé 1,7 m plus loin — le ballon oublié (note 317),
version arrêtée.

**Contrat.** verify-attente 46 → 48 (l'espèce sous contrat sur 24 styles, lente). Planche : `planches/attente-pausa-
apres.png` (le pied droit sur le ballon, les mains sur les hanches). Capture : `a12c-pausa-attente.png` (graine 11,
t ≈ 370 s, joueur 4 à l'arrêt en pausa, le ballon à 1,8 m : la posture, et la dette).

**Dette nommée au tronc (bloquante pour le signe).** Pendant la pausa, ramener le ballon sous le pied : la tenue du
253 doit porter le ballon au point de stance (comme `porteAnticipe` le fait pendant l'armé) — sans quoi la semelle n'a
rien sous elle. Chiffres : 4 tenues à l'arrêt sur 11, ballon à 1,6-2,0 m ; cible ≤ 0,4 m [CONVENTION].

## A12d — Le recul-frein du central

**Le signe.** Le document (§3.2 A Van Dijk, débat 1 Maldini) : « recule au tempo de l'attaquant, oriente ses hanches
pour lui fermer l'accès à son pied fort, attend le soutien — sans se jeter ». La sim a déjà tout le mouvement : le
jockey (lot 95, `cfg.jockey` : les appuis du presseur près du porteur ; lot A10, `cfg.contact.jockey` : il RECULE ou
se DÉCALE en faisant face), l'angle qui force le pied faible (`orienteFaible`), la course arrière et le pas chassé
générés (A7 : régimes `back` et `lat`, fondus par la direction). Ce qui manquait : la POSTURE du jockey — la course
arrière d'un athlète est droite et courte de bras, celle d'un défenseur qui jockeye est basse et ouverte.

**Le mécanisme (motion-gait, aucun bit de sim).** `opts.jockey` : bassin plus bas (+5 cm d'affaissement), buste penché
(+10°), pieds plus larges (+4 cm), bras ouverts (+14° d'élévation, +20° de coude), balancier × 0,5 — composé sur les
régimes de la direction, donc vrai en recul comme en pas chassé. Le contrôleur pose le drapeau depuis `idleCtx.jockey`,
que la scène calcule avec LA CONDITION DU JOCKEY DE LA SIM (presseur, porteur adverse à 0,3-4,5 m, ≤ 3,5 m/s, pas
lancé sur lui). À l'arrêt, l'espèce d'attente `pret` (A8) prend le relais — la garde existait déjà.

**Contrat.** verify-foulee 48 → 51 : en recul chassé (−1,5 m/s, 0,6 m/s latéral) le jockey est plus bas (bassin 80 c.
85 cm) et plus ouvert (mains 68 c. 61 cm), sa foulée reste sous `checkGaitGen`, drapeau absent = le recul d'hier au
bit. verify-gait 23/0, verify-locomotion 6/0.

**Capture.** `a12d-recul-frein.png` (playmode, graine 3 : le presseur en recul devant le porteur, bas, bras ouverts).

## A12e — La marche des rôles marchants : les mains sur les hanches

**Le signe.** Le document (§3.6 C l'électron libre, §3.7 D le faux ailier marchant, §3.8 C Messi) : « marche de longues
minutes les mains sur les hanches pour cartographier les failles », « marche lentement à 50 mètres du ballon ». Le rôle
est à la sim (catalogue 248 : `free_role_creator` ancrage 0,95, `wide_creator`, `raumdeuter` ancrage 0,9 ; l'axe
`repli` du 251 : 1 = dispensé) ; la marche loin du ballon aussi. Ce qui manquait : les MAINS.

**Le mécanisme (aucun bit de sim).** La scène pose `idleCtx.marcheur` : rôle à ancrage ≥ 0,8 ou repli ≥ 0,9, sans
geste, pas receveur, ballon à plus de 25 m, aucun porteur adverse à moins de 12 m. À l'arrêt, la politique d'attente
répond `mainsHanches` (après la réception, avant la garde). En marche (< 1,7 m/s), `opts.mainsHanches` de la foulée
générée remplace le balancier par la pose de bras de l'attente (`armPose`, élévation 22°, coude 45°, vrille −50° :
les mains posées, coudes dehors) ; le contrat de foulée exempte les mains posées de l'opposition bras-jambes.
Drapeau absent = la marche d'hier au bit.

**Contrat.** verify-attente 48 → 52 (la politique : loin du ballon → mains sur les hanches, sauf si le ballon vole
vers lui) ; verify-foulee 51 → 54 (en marche : main à ≤ 20 cm du bassin, course ≤ 5 cm — sans : 17 —, coude dehors,
contrat tenu, drapeau absent au bit).

**Ce que le showcase ne montre pas seul.** `match11.html` ne pose aucun rôle (22 joueurs polyvalents) : le signe vit
dans le projet aval qui pose les rôles ; la capture `a12e-marcheur.png` injecte un rôle marchant dans la page.

## A12f — Les petits gestes signés

- **Le signal du tireur de corner** (§4.3 : « bras levé = premier poteau »). L'interface gelée prévoyait
  `payload.mains = 'signal'` côté cpa.js ; la scène n'en a pas besoin : elle lit `st.restart.elan.phase === 'attend'`
  du tireur d'un corner (la course d'élan de A9 bis) et force l'espèce d'attente `signal` — le bras droit levé
  (`armR`, une pose de bras droit à part : élévation 168°), la main gauche sur la hanche. Contrat : la main droite au-
  dessus de la tête ; sabotage « bras baissé » attrapé. Planche `planches/attente-signal-apres.png`.
- **La passe sans regarder** (Busquets, Firmino : « regarde à gauche, donne à droite »). `gaze.js` : au dernier tiers
  de l'armé, le porteur regarde le POINT OPPOSÉ à sa cible, de l'autre côté de son corps, quand la scène pose
  `view.noLook` — technique haute (`gesteF` ≥ 1,05), presseur à moins de 2,5 m, passe courte (< 12 m). Il VISE d'abord
  (premier tiers : la cible, comme tout porteur). Sans le drapeau : le ballon, comme hier. Contrat verify-gaze 22 → 25
  et `checkGaze` (6). Le showcase ne pose pas d'attributs (`gesteF` absent = 1) : le signe vit dans le projet aval.
- **Le pas de recul du renard** (Lewandowski, §3.8 : « un micro-pas de recul au moment du centre ») : une DÉCISION de
  course (un déplacement de 0,8 m à l'instant du centre), pas une animation — au tronc, dette nommée.

## Les dettes reprises (15/09) — trois lois sous clé, chacune null = le monde du 14/09 au bit

Reprises à la demande de l'utilisateur (« tu veux pas prendre les dettes toi ? »). Méthode du tronc : sonde avant, loi
native sous clé, sonde après, jumeau d'empreinte (clés à null = `aa66bb8b3ad05c2f / 39612df7d7863c75 /
33c9f358530995f1` sur 3 graines × 240 s, le monde 3d72ea4 au bit), bande A/B 12 × 300 s, garde-fou anti-Goodhart
(passes ± 15 %, pertes ≤ +15 %), clause au banc (`verify-signes.mjs`, dans `bancs.mjs`). Les trois clés sont ALLUMÉES
par défaut : le match servi change.

**`cfg.pausaPied` — la pausa au pied.** Sonde avant (12 × 366 s) : 11 pausas, 4 avec le porteur à l'arrêt et le ballon à
1,6-2,0 m. Cause lue image par image (graine 12) : la pausa se décide pendant la CONDUITE — le ballon vient d'être
poussé (libre, 3 m/s, 0,9 m devant) ; la tenue du 253 fige la cible sur soi, le corps freine, le ballon roule 2 m plus
loin. Loi, trois temps : (1) à la décision, le ballon qui roule à portée (< bloque 1,6 m) est BLOQUÉ — possédé, posé
0,3 s comme la ramasse du 107, événement `control arret-semelle` (la scène joue le clip de la semelle) ; (2) pendant
toute la pausa le ballon est PORTÉ au pied, jamais poussé (`rondo-sim` : la branche du porté, sous la clé) ; (3) s'il
avait déjà filé et s'est calmé (< lent 1,6 m/s, < rayon 3,5 m), le porteur va le poser sous la semelle (la reprise du
porté, cap de vitesse). Sonde après : 7 pausas, le ballon à ≤ 0,36 m à chacune, 3 à l'arrêt complet. Le signe A12c
(la semelle sur le ballon) est maintenant visible en match.

**`cfg.recevoirSurPlace` — la réception sur place.** Sonde avant : 0 % des images de vol sous 0,6 m/s ; à la passe, le
receveur court déjà (p50 3,2 m/s) et la mène est devant lui (p50 2,3 m) — seules 15 % des passes sont « dans les
pieds sans presseur ». Loi : passe au sol qui vient encore (≥ vMin 2,5 m/s), mène à < marge 0,6 m du receveur, non
déviée, aucun adversaire à < pression 4 m → il ATTEND (le pas au-devant de meetBall se tait ; la passe mourante, la
retombée, la fuite, la menace gardent la main). A/B 12 × 300 s : vols avec un instant d'attente 14 % c. 10 %, images
sous 0,6 m/s 5,4 c. 3,1 %, passes 599 c. 672 (−11 %), pertes 163 c. 173 (−6 %), tirs 25 c. 27, duels 65 c. 64.
Essayé et jeté : marge 1,0 m avec les cloches (passes −17 %, pertes +11 %, duels +31 %) et marge 1,0 au sol (passes
−13 %, pertes +11 %) — l'attente élargie coûte le tempo et des pertes ; la version étroite est celle qui reste sous le
garde-fou. Effet modeste par construction : le moteur passe vers des coureurs.

**`cfg.pasDeRecul` — le pas de recul du renard.** La première écriture (les corps de boîte du boxCrash, rôle appel ≥
0,85) ne se déclenchait JAMAIS : sondé, 76 passages dans la branche des postes, 0 corps à fort appel — le renard est
le RECEVEUR du centre, jamais un corps de boîte. Loi finale (match-sim, le receveur d'un centre) : au départ du vol
(< fenetre 0,7 s), le receveur qui vit de ses courses (rôle appel ≥ 0,6 — le polyvalent 0,5 reste à la mène) marqué à
< marque 1,6 m recule de d 0,8 m à l'opposé de son marqueur, puis attaque le point de chute. Fixture : cible à 0,82 m
de la mène d'hier, plus loin du marqueur. Flux (6 × 300 s, renards au 9) : 8 centres, 4 images de recul — la loi vit,
rarement (les centres sont rares et le renard peu marqué). La version boxCrash reste pour les corps de boîte à rôle.

**Les rôles dans le showcase.** `match11.html?roles=grille` pose la grille des rôles du 244c (`rolesGrille`) sur les deux
équipes — les signes A12e/f et les captures d'identification deviennent visibles dans la page ; sans le paramètre,
le match servi ne change pas.

**La relecture de mes épingles datées.** `verify-contact` sans `ligne: null` : 25/0 → épingle retirée ; en revanche la
réception sur place remange sa clause du presseur (face 69 c. 65 %) → `recevoirSurPlace: null` DATÉ 15/09 dans cette
clause. `verify-porte` sans épingles : 2/2 rouges — sous la ligne tenue (273) le monde a 22 refus au contact sans la
clé (hier 63) et 9 avec : la loi tient (−59 %) mais les seuils sont ceux du monde de sa naissance → épingles gardées.
`verify-remises` sans épingles : 6 rouges — sous le profil locomoteur (260) la course d'élan part à 1,9-4,1 m au lieu
de 3,5, le corps arrive à 2,4-3,1 m/s, le bassin du lanceur à −0,10-0,57 m : A9 bis est à relire dans le monde 260,
dette nommée, épingles gardées.

**Le banc complet.** 678 ✓ / 23 ✗ les clés allumées ; 694 ✓ / 7 ✗ à clés nulles (le monde du tronc : 246d et la gradation
152/158 hérités, le reste attendu) — 21 clauses remangées par les clés, épinglées par contenu (`pausaPied /
recevoirSurPlace / pasDeRecul: null DATÉ 15/09`) sur le cfg de chaque clause, comme le tronc le fait à chaque loi qui
déplace le monde ; relance 699 ✓ / 2 ✗ (246d hérité, la roulette 117 ré-épinglée sur son vrai cfg).

## À venir dans ce lot
A12c la pausa (kind/événement du 253) ;
une planche « sans les noms » par rôle du 249 (les captures d'identification).
