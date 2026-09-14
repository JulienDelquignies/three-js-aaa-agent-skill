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

**Captures (playmode, graine 3).** `a12b-reception-approche.png` / `-face.png` (t = 4,3 s, receveur 1 à 1 m/s,
corps à 67° du ballon qui roule vers lui : appuis larges, genoux fléchis, bras ouverts) ; `a12b-reception-attente-
face.png` / `-plan.png` (t = 69,8 s, receveur 9 sous 0,5 m/s, corps à 38° d'un ballon en cloche à 13 m : la posture
tenue, les yeux en l'air). Planche : `planches/attente-reception-apres.png`.

**Dette nommée au tronc.** Le receveur ne reçoit jamais sur place (0 % des images de vol sous 0,6 m/s) : en vrai, une
partie des réceptions se fait à l'arrêt, le corps ouvert, le ballon qui vient au pied — c'est une loi de course
(approche du receveur, 134/198), pas d'animation. Le pied arrière comme DÉCISION (contrôle intérieur du pied éloigné
quand le ballon traverse) n'existe pas dans la table des techniques : idem, une loi sous clé, au tronc.

## À venir dans ce lot
A12c la pausa (kind/événement du 253) ;
A12d le recul-frein du central ; A12e la marche des rôles marchants ; A12f les petits gestes signés (bras du tireur
`payload.mains = 'signal'`, la passe sans regarder, le pas de recul du renard) ; une planche « sans les noms » par
rôle du 249.
