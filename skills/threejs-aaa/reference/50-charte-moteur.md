# 50 — La charte moteur : les lois qui uniformisent tout le reste

L'objectif du projet n'est pas de finir un jeu : c'est un **moteur de football réutilisable**, où
chaque bonne pratique arrachée à un bug devient une **loi native** que le module suivant reçoit
gratuitement. Ce document est cette uniformisation : dix lois, chacune payée par un effondrement
mesuré, chacune tenue par un contrat node et au moins un sabotage nommé. Un moteur n'est pas un tas
de correctifs — c'est un petit nombre de lois qui rendent les correctifs inutiles.

Tout ce qui suit a été mesuré dans ce dépôt (les chiffres sont dans les modules cités et dans
`NOTES.md`). Rien n'est un principe d'école : chaque loi est la forme générale d'un accident précis.

---

## 1. Une autorité par corps, par phase

À tout instant, UN SEUL système écrit la position d'un corps. Les autres peuvent la lire, jamais
l'écrire.

- **Le ballon** a une chaîne d'autorité explicite et exclusive (rondo-sim) :
  livraison d'un contrôle (`st._settling`) → personne d'autre n'y touche ;
  intention de frappe fraîche → l'assise (`escort` vers zéro) ;
  sinon → la conduite (`dribbleStep`). Le vol (`integrate`) et la frappe (`strike`) sont les
  autorités des autres phases (ball-body).
- **Le corps** : pendant l'armé, l'horloge de geste (glissement sur l'ancre) possède la position ;
  `movePlayers` ne l'intègre plus (`winding(p)` ⇒ skip). Le lacet a la même loi depuis toujours
  (« a swing owns the body »).

**Accidents fondateurs** : le glissement écrivait position **et** vitesse, movePlayers ré-intégrait
la vitesse → double pas, oscillateur `v[n+1] = Δg/dt − v[n]`, **15,7 m/s** contre le mur du carré.
La touche de conduite (want = évasion) renvoyait une livraison ARRIVÉE (d = 0,30 m) repartir à
l'opposé du corps → `control-at-foot` 1 % → 33 %. L'assise freinait une livraison en route et la
tuait à 1 m du pied (17,6 %).

**Corollaire** : quand une autorité rapporte sa vitesse (pour l'animation, l'inertie), c'est un
RAPPORT, pas un état à intégrer.

## 2. Les contraintes du monde se projettent en dernier

Séparation des corps, murs du terrain, non-pénétration : ce sont des projections appliquées UNE
FOIS, APRÈS que toutes les autorités ont écrit. Projetées avant, le dernier écrivain les défait.

**Accident** : la séparation vivait dans `movePlayers`, le glissement d'armé écrivait après elle —
`players-not-overlapping` crevait son budget pendant les armés. Ordre de la boucle (rondoStep) :
`assignJobs → movePlayers → stepGestures → separatePlayers` — décision, locomotion, gestes,
projections. Cet ordre EST une loi, pas un hasard d'implémentation.

## 3. Les actionneurs sont bornés

Toute demande de mouvement passe par une borne de taux physique : le glissement est plafonné
(`glideMax` 7,5 m/s), le lacet a un taux borné (`turnAccel / v` — la vitesse coûte l'agilité,
mesuré 1,67× plus lent à 6,9 m/s qu'à 4,2), l'ajustement d'ancre est refusé au-delà d'une vitesse
humaine (`reachable`). La borne rend STRUCTURELLES les clauses de vitesse (« aucun joueur au-dessus
de 8,4 m/s ») : sans elle, elles sont statistiques — vraies jusqu'au jour où non.

## 4. Un refus a une cause nommée — et il pilote l'approche

Chaque porte (`beginPass`) compte ses refus par cause (`st.deny` : balistique, technique, timing,
ancre, course, livraison, ballon-vif, contesté). Quand le jeu s'effondre, le premier chiffre à lire
est « qui dit non, combien de fois » — c'est ce registre qui a localisé chaque étranglement de la
fournée approche (1 573 refus d'ancre, 4 503 ballon-vif, 14 073 contesté : trois maladies
différentes, trois remèdes différents).

Et un refus n'est pas un mur : il dit OÙ ALLER (`plan.steer` → `anchorHint` → destination du
porteur). Refuser sans cap, mesuré : le corps reste à p50 = 1,07 m de l'ancre, image après image,
jusqu'au tacle (122 tacles, médiane de possession 0 passe).

## 5. Décider → préparer → s'engager — et la décision colle

Une intention (receveur + plan) est adoptée UNE FOIS, pilote l'approche, et ne meurt que de sa mort
propre (course perdue, balistique nulle, contesté, ou son TTL). Re-décider à chaque image pendant
que les portes disent non est un oscillateur : le veto bascule le receveur, l'ancre saute de
l'autre côté du ballon, le corps piloté à 60 Hz n'arrive jamais (mesuré : aucun progrès sur 1 971
refus, tacles 67 → 192).

**Corollaire (la géométrie transitoire)** : le chemin vers une position de frappe n'est PAS une
situation de frappe. Le choix de technique se fait par ATTEIGNABILITÉ des stances (`planStrike` :
la stance propre quand on peut la rejoindre dans l'anticipation, la surface improvisée quand son
ancre est la seule à portée, l'improvisation-du-réel seulement à holdMax) — jamais sur le
relèvement momentané d'un corps qui contourne son ballon.

**Corollaire (l'engagement)** : on s'engage quand SON plan est atteignable, pas quand n'importe
quel plan inférieur l'est (le talon « toujours sous le pied » s'engageait avant le pas qui rejoint
la stance propre). Pressé, la règle s'assouplit d'un cran EXACT : la plus prompte des options
atteignables qui valent presque le plan.

## 6. Le temps, pas la photo

Toute question d'interception est une COURSE en secondes, jamais une distance en mètres :

- le couloir de passe se juge en faisant courir la défense sur le VRAI vol résolu (`flightRace` :
  fantôme intégré par ball.js + `interceptPoint` par coureur) — la photo statique laissait
  intercepter des passes à 2,59 m de marge médiane (jusqu'à 7 m) ;
- la liberté du receveur se mesure À L'ARRIVÉE (défenseurs projetés de l'armé + du vol) — la
  pression « maintenant » notait libre un homme dont le marqueur arrivait avec le ballon (la
  possession médiane tacklée mourait 0,76 s après la réception) ;
- et le modèle de course est le MIROIR EXACT de ce que la défense fait (assignJobs : réaction au
  départ, positions projetées) — ni une défense d'oracles (têtes de course pendant l'armé : 1 passe
  par partie), ni une défense aveugle.

## 7. Un instant, un contrat

Chaque instant du jeu est jugé par UNE règle, celle du geste qui possède cet instant. La
préparation une-touche (l'armé possède le corps quand la livraison arrive) est exemptée de
`control-at-foot` et jugée par `strike-stance` au contact. Juger deux fois avec deux géométries,
c'est condamner l'un des deux gestes quoi qu'il fasse. Et toute exemption est BORNÉE dans le
harnais (≤ 40 % des contrôles) — une exemption sans borne devient la norme en silence.

## 8. Une clause qui ne regarde pas le monde composé mesure une ombre

Six fois dans ce dépôt, c'est LA MÉTRIQUE qui était fausse, pas le système : la règle de téléport
échantillonnée à 1/6 (0 violation ; à 1/1 : 230), le `settleMax` calibré sur un modèle qui
téléportait, la clause d'expressivité qui mesurait des degrés au lieu de la silhouette, la
comparaison de quaternions par composante, le signe de `stanceB`, le point d'échantillonnage d'un
sabotage. La discipline : les clauses finales mesurent le RÉSULTAT MONDE (positions d'articulations
FK, événements portant leur propre géométrie, registres de refus) — et l'instrument de vérité est
l'audit membre par membre (`audit.mjs`) sur la scène réelle. C'est lui qui a montré que la
simulation était finie (corps 0,58 m, appui 0,30 m au contact ✓) et que le défaut restant vit dans
le CLIP (pied de frappe à 0,97 m du point de frappe à l'instant déclaré du contact, passage avant
~0,3 s trop tard — chantier suivant).

## 9. Un budget est une dette mesurée, jamais une absolution

Quand une règle n'est pas encore tenable à 0, son budget est : (a) mesuré multi-graines, (b)
statistique (à ~90 événements par partie, un processus à 2,9 % fluctue de ±1,8 % — le seuil est
p95, pas un vœu), (c) accompagné du NOM du chantier qui le fera baisser (duel/protection du ballon,
trou 90–120° de la table). Un budget sans chantier nommé est une absolution.

## 10. Les résultats négatifs se consignent

Ce qui a été essayé et mesuré FAUX vaut autant que ce qui marche — c'est lui qui empêche de
re-payer : l'A/B de parties entières pour une loi locale (chaotique : compare deux histoires, pas
deux lois) ; le duel en poursuite pour la borne de virage (la courbe de poursuite lisse la demande,
la borne ne mord jamais — ratio 1,00) ; la défense d'oracles ; « exiger un ballon posé » comme
condition d'une assise qui est justement ce qui pose le ballon ; le matching de mouvement sans
banque de mocap (500–900 clips) ; les modèles texte-vers-mouvement. Chaque entrée dit le POURQUOI
mesuré, pas juste « ça n'a pas marché ».

---

## L'ordre d'évaluation canonique (une image)

```
simulation :  assignJobs (décisions) → movePlayers (locomotion, sauf corps possédés par un geste)
              → stepGestures (horloges de geste : glissement borné, contact, frappe)
              → separatePlayers (projections du monde)  → phases du ballon (autorité exclusive)
visuel    :  gait clock (φ unique, vitesse SOL MESURÉE — jamais un zéro forcé) → mixer (clips
              asservis à φ) → couches corps-entier (gaitLayer) → gestes additifs SCINDÉS
              haut/jambes (le haut s'arme tout de suite ; les jambes fondues par max(arrivée,
              approche du contact) — les bras s'arment pendant les pas, le plant émerge de la
              mesure) → verrous (footLock hors geste) → rendu
```

Le visuel LIT la simulation, ne la corrige jamais ; la simulation ne sait pas que le visuel existe.
Les nombres du contact (`MOVES[clip].contact`, stances) sont partagés par les deux — c'est le seul
pont, et il est en DONNÉES, pas en code.

## Où c'est prouvé

| Loi | Module | Harnais |
| --- | --- | --- |
| 1-2 (autorités, projections) | rondo-sim.js, rondo.js, ball-body.js | verify-rondo (8,4 m/s structurel), verify-ball-body |
| 3 (actionneurs bornés) | rondo.js (movePlayers), rondo-sim.js (glide cap) | verify-rondo (lois d'inertie ×2) |
| 4-5 (refus, intention, plan) | approach.js (planStrike), rondo-sim.js (deny/intent) | verify-approach (21 clauses, oscillateur rejoué) |
| 6 (courses) | ball-predict.js (flightRace), rondo.js (choosePass) | verify-ball-predict, verify-football-rules |
| 7-9 (contrats, budgets) | football-rules.js (strike-stance, exemption bornée) | verify-football-rules (60 clauses, 2 sabotages neufs) |
| 8 (monde composé) | scripts/audit-membres.mjs (l'instrument OFFICIEL, verdicts + INFO clips) | 13 clauses vertes |
