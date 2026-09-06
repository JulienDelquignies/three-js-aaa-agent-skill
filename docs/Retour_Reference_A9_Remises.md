# Retour au lot A9 (les remises à la main) — pourquoi il n'est pas repris sur le tronc

Fusionné à l'essai avec le tronc (sceau 245), puis retiré : A7 et A8 sont repris, A9 non. L'arbre
fusionné avec A9 a été passé au banc complet (8 shards + douze annexes). Quatre contrats cassent, et
ils ne sont ni du tirage ni épinglables, parce que A9 change la simulation **sans clé** : il n'existe
aucun jumeau au bit du moteur d'avant.

## Ce qui casse (mesuré)

| contrat | avant A9 | avec A9 |
|---|---|---|
| remise portée (match-check : « jamais posée par écriture ») | 0 pose hors coup d'envoi | 5 touches posées par écriture en 300 s de 4-3-3 (sauts de 1,7 à 5,8 m au registre), 4 formations sur 16 rompent le contrat en 90 s |
| salida 239 : pivot en relance basse sous pression, m devant les centraux (6 × 300 s) | 2,8 | 5,9 |
| gradation des notes 152/158 (12 × 240 s, composite 30 / 50 / 70 / 90) | 11 / 49 / 249 / 470 | 70 / 51 / 249 / 443 |
| 240 : pertes avec l'appui-remise c. sans (24 × 300 s) | 545 c. 522 | 575 c. 509 |

## Ce qu'il faut pour que A9 soit repris

1. **Une clé** (`cfg.remisesMain` par exemple, `null` = l'hier au bit) qui gate la touche armée et le
   roulé du gardien. Le contrat du moteur : toute clé absente rend le moteur d'hier au bit, vérifié
   par empreinte.
2. **Chaque pose légitime est nommée** par un événement que `checkMatch` accepte (le ramasseur nomme
   la sienne : `type: 'ramasseur'`), ou le ballon est porté aux mains par `ballFetch`. Aujourd'hui les
   touches sont écrites au registre sans nom.
3. **Remesurer** la salida (pivot ≤ 3 m devant les centraux sous pression) et la gradation dans le
   monde A9 : si le roulé depuis les mains change la relance, la loi de salida doit le lire.
4. **Le banc complet**, pas seulement `verify-remises` (21 ✓ ne voit pas ces quatre contrats).

Le reste (lot 189, 140, 241) bouge au tirage et se re-date en volumétrie ; ce n'est pas le sujet.
