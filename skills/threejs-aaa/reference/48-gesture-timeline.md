# 48 — Une action a un début et une fin (`engine/gesture.js`)

> « Ok le ballon est plus proche. Mais après, la façon du joueur de se retourner, c'est réaliste ?
> Et ensuite sa passe ? Ça se voit même pas le mouvement. En réalité les mouvements ont un début et
> une fin, ça ne s'arrête pas quand le ballon part. »

Trois reproches, une seule cause, et elle est architecturale — pas un réglage.

## Le défaut : l'animation commentait le ballon au lieu de le produire

La boucle était : **la simulation frappe le ballon, puis demande une pose au personnage.** L'événement
`pass` signifie « le ballon vient de partir » ; à cet instant, démarrer le clip à t=0 mettrait la jambe
en armé alors que le ballon est déjà loin. La parade était de démarrer le clip **à sa frame de
contact** — ce qui synchronise le pied et le ballon en supprimant tout ce qui précède.

On regardait donc la seconde moitié d'un geste dont la première moitié avait été effacée. D'où
« ça se voit même pas le mouvement » : il n'y avait pas de mouvement, il y avait une fin de mouvement.

Et le retournement, lui, était littéralement instantané : `p.yaw = Math.atan2(tz, tx)` dans le
contrôle. 180° en zéro seconde. Aucune animation ne peut rattraper ça — il n'y a pas d'intervalle à
animer.

## L'inversion

```
début ─── ANTICIPATION ───▶ CONTACT ─── ACCOMPAGNEMENT ───▶ fin
(il s'engage)              (le ballon part)               (il finit son geste)
```

Trois règles, chacune vérifiée par `checkGestures` avec son sabotage :

1. **Le ballon part au CONTACT**, pas à la décision. La simulation attend la jambe.
2. **L'acteur est ENGAGÉ** dès la première image : il ne redécide pas, il ne conduit plus, son corps
   et ses appuis sont verrouillés — et **on peut lui prendre le ballon pendant l'armé**, ce qui est
   précisément ce qui rend le pressing dangereux et n'existait pas quand la passe était instantanée.
3. **Le geste va à son terme**, ou il est interrompu avec une **cause nommée**. Un geste qui disparaît
   sans fin ni cause est le défaut que ce module rend impossible.

Les timings ne sont pas ré-écrits à la main : ils sont lus dans `animkit` (`duration`, `contact`).
Ré-énoncer ces nombres ailleurs, c'est comment un ballon se met à partir avant que la jambe ne bouge.

## Ce qu'il a fallu mesurer pour que ce soit jouable

Un armé, c'est du temps offert à l'adversaire. Une première tentative (session précédente) l'avait
simplement **ajouté** : record 6, récupérations 25 → 103. Quatre corrections, toutes mesurées :

| | record | récupérations | séparation du porteur |
|---|---|---|---|
| avant les gestes (référence, 8 graines × 60 s) | 11,1 | 22,0 | 2,09 m |
| armé ajouté, budget forfaitaire | 5,5 | 37,8 | 1,42 m |
| + armé **taillé dans** le temps qu'il avait déjà | 7,6 | 34,6 | 1,48 m |
| + le tacle pendant l'armé devient un **contre** | 7,8 | 28,8 | 1,53 m |
| + le ballon **voyage avec lui** pendant le geste | **8,4** | **27,9** | **1,59 m** |

1. **L'armé est taillé dans le temps qu'il avait, pas ajouté après.** Il s'engage une anticipation plus
   tôt, donc le ballon part toujours à `holdMin`. Même football, mouvement visible.
2. **Et c'est l'anticipation du geste CHOISI**, pas une moyenne : `passe` frappe à 0,38 s,
   `passePivot` à 0,52. Un forfait se trompait du simple au double et laissait le pivot exposé un quart
   de seconde qu'il n'avait pas — 8 armés sur 21 taclés.
3. **Prendre le ballon à un homme en plein geste est un CONTRE, pas un tacle** : le défenseur doit
   avoir atteint le **ballon**, pas seulement se tenir près du corps. Sans ça l'armé était fatal, la
   pression ayant déjà été accumulée pendant la conduite.
4. **Le ballon voyage avec lui.** Personne ne s'arrête net pour passer.

Reste un écart assumé avec la référence (8,4 contre 11,1) : c'est le **prix réel** d'un geste engagé de
0,4 s sur chaque passe. L'affaiblir pour revenir à parité annulerait ce qu'on vient de construire.

## Deux fausses pistes, gardées parce qu'elles instruisent

**« Sous pression, joue le geste le plus rapide. »** Vrai en football, faux tel quel : le geste le plus
rapide qui soit légal est presque toujours une déviation ou une **talonnade**. Résultat, 19 passes sur
32 en une touche et 9 talonnades frappées à 175°. Un rondo ne se joue pas entièrement du talon. La
vitesse départage désormais des gestes **déjà bons** (à `rushedSlack` du meilleur score).

**Verrouiller le regard sans verrouiller les appuis.** `assignJobs` continuait à le replacer derrière
un ballon dont la direction de poussée tournait encore : il contournait physiquement son propre ballon
en gardant les épaules engagées, et le ballon finissait à côté ou derrière lui. Si le corps est engagé,
sa destination l'est aussi.

## Et un bug de règle que tout ceci a révélé

`ball-ahead-at-strike` exemptait la talonnade par `e.style === 'talonnade'`. Or `style` porte le style
**balistique** de la passe — `ground` ou `lofted` — et n'a jamais contenu cette chaîne. L'exemption
était du code mort depuis le premier jour : **chaque talonnade du jeu comptait comme une frappe
illégale.** Pire, le test du harnais construisait sa donnée avec `style: 'talonnade'` et passait donc —
un test écrit contre l'implémentation au lieu d'être écrit contre le football. Le geste, c'est `tech`.
Corrigé, le taux tombe de 41 % à 7,2 %.

## Ce qui reste

Le geste existe maintenant, avec un début et une fin. Ce qui limite encore le rendu, c'est
l'**amplitude des poses** d'`animkit` : les moves sont lisibles mais discrets, et à cette distance de
caméra un armé plus ample (épaule qui s'ouvre, bras d'équilibre, appui qui pivote) se verrait
davantage. C'est un travail d'auteur sur les clés, pas de moteur — et le catalogue ne l'attrapera pas :
il juge la géométrie, pas la beauté du mouvement.
