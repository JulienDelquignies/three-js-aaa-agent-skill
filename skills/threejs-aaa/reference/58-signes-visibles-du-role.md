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

## À venir dans ce lot
A12b la réception de trois-quarts et le pied arrière (lit `pick.foot`) ; A12c la pausa (kind/événement du 253) ;
A12d le recul-frein du central ; A12e la marche des rôles marchants ; A12f les petits gestes signés (bras du tireur
`payload.mains = 'signal'`, la passe sans regarder, le pas de recul du renard) ; une planche « sans les noms » par
rôle du 249.
