# Bible 14 — Les micro-comportements, contre le moteur

*Fiche du 9/09, moteur 5b10d6b (SCEAU 256). Mesures : 2 matchs de 90 min (graines 3, 7), 4-3-3 contre 4-3-3.*

## 1. Ce que le chapitre demande

- **Le scanning** comme grandeur physique (`HeadState` : lacet, vitesse, confort ± 55°, butée ± 80°), trois
  opérationnalisations à ne pas mélanger (Jordet 0,44 /s ; HTF 1,0-1,4 /s), ce que l'on voit (1-3 entités par
  balayage, distance de reconnaissance à trois niveaux), la **table par poste et contexte** (MC > DC > latéraux >
  ailiers > attaquants, d = 0,55 ; 0,27 avant tir / 0,45 avant passe ; chute d = 0,57 au contact ; < 0,30 près des
  touches, → 0 près des surfaces ; maximum ballon au pied), la **fenêtre de verrouillage**, et le désaccord : le
  scan n'est **pas** un attribut de talent ; la pression pèse 4 × plus que le scan sur la passe (OR 1,64 c. 1,13).
- **La mémoire spatiale** : croyance datée, extrapolée, rappelée vers un a priori de rôle ; σ 3-4 m à 2 s ; le
  joueur ne suit pas 21 cibles.
- **L'orientation corporelle** : `OPEN / HALF_TURN / CLOSED / BACK`, coût de rotation (demi-tour 0,6 s à l'arrêt,
  2 s lancé), 35-55 % de `BACK` sous pression forte ; le pied de réception prédit par le dernier balayage.
- **La première touche** : huit types, arbre ordonné (`LAYOFF` prioritaire dos au jeu et croyance périmée), bruit
  d'exécution par type.
- **Feintes et leurres** : signal honnête contre trompeur, un défenseur qui ne peut pas être trompé casse le
  football ; le défenseur d'élite s'engage **plus tard** (268 c. 193 ms) ; l'adaptation (feinter toujours ne marche
  plus) ; la feinte n'agit que sur ceux qui la voient ; take-ons 41-54 % pour les spécialistes, ≥ 5 × plus de
  tentatives que le joueur médian.
- **Le corps-obstacle** : machine à états de protection, l'arbitre faillible et positionné.
- **Temporisation** : trois mécanismes (pausa, ralentissement, changement de rythme), chiffrés.
- **Communication** : trois canaux (voix 25 m, geste vu, contact), qui parle (DC et MD d'abord), fiabilité de
  l'émetteur, ≥ 1 double prise par match due à un message perdu.
- **Le temps** : ballon en jeu 54-58 %, reprises 17,7 / 30,3 / 36,9 s dans une bande par équipe, `timeManagement`
  contextuel, la règle des 8 s du gardien avec escalade, la faute tactique comme pari, la simulation (3 par match,
  33 % récompensées, < 2 % sanctionnées), le crédit auprès de l'arbitre.
- **Erreur et bruit humain** : éviter le moteur trop propre.

## 2. Où en est le code

**Existant.** Le **scan** (250, scan.js) : saccades seedées de 0,45 s, premier regard en vol à 0,25-0,75 s ÷ scanF,
cadence en vol 0,4-0,6 /s, hors ballon 1,5-4 s, cible presseur / espace / coéquipier, la règle de Jordet (pas
pendant la prise), le **corps ouvert** conditionné au regard (`scan.corps`), la politique de regard de la scène
(gaze.js) ; le **corps ouvert** (`corpsOuvert`, lot 246) et l'orientation à la réception ; la **famille des gestes**
(skills-sim : râteau, semelle, passement, crochet, feinte de passe une fois par intention, feinte de frappe) et le
dribble (drive.js, `dribble.js`) ; la **protection de balle** (A10 le contact, 240 l'appui) ; les **cérémonies de
remise** (217 `tempsMort` : touche 12 s, six mètres 20, corner 22, coup franc 18 ; × tempo, × contexte : celui qui
mène traîne 0,35, celui qui court presse 0,35) ; la Loi 12 avec avantage, cartons, récidive ; le **premier pas** au
50/50 (153) ; la **passation** parlée du 252 (le seul message).

**Partiel.** Le scan est un **mécanisme de réception** (il ne vit que pendant le vol d'une passe adoptée et par
saccades espacées hors ballon) — sans mémoire, sans croyance datée, sans effet sur le monde perçu (le joueur voit
tout) ; le taux mesuré est **plat** (0,33 partout : poste, pression, zone) ; les gestes existent mais **sans
tromperie** : le défenseur n'infère rien, il ne part jamais du mauvais côté ; l'orientation `BACK` sous pression
sort à 38 % (dans la bande) par la géométrie, pas par une posture jouée ; la temporisation existe par le tempo et
le contexte de la remise, pas par la pausa (253).

**Absent.** `HeadState` (le lacet a une vitesse, une butée), la mémoire spatiale et l'oubli, la capacité (1-3
entités), la distance de reconnaissance ; la typologie de première touche et son bruit par type ; le modèle
d'émission / inférence de la feinte, l'adaptation, le cône (T19) ; l'arbitre positionné ; la communication comme
canal (voix, geste, contact) ; la règle des 8 s et son escalade ; la simulation ; le crédit arbitral ; le bruit
humain comme objet.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré (2 × 90 min) |
|---|---|---|---|
| T1 balayages / s | 0,44 ± 0,08 | mesurable (saccades du moteur) | **0,33 /s** — dans l'ordre de grandeur mais d'une autre nature (pas de fenêtre des 10 s avant réception) |
| T2 contact / large | ≈ 0,67 | mesurable, **réfuté** | **1,04** — la pression n'agit pas sur le regard |
| T3 par poste | MC > DC > LAT > AIL > ATT, d 0,55 | mesurable, **réfuté** | 0,33-0,34 partout — plat |
| T4 meilleur − pire | < 0,12 | tenu par construction (scanF 0,85-1,15 sur la cadence) |
| T5 avant tir / passe / dribble | 0,27 / 0,45 / 0,39 | à instrumenter — l'intention ne module rien |
| T6 entités rafraîchies | 1-3 | **omniscience** : le joueur lit tout l'état |
| T7-T9 reconnaissance, oubli, croyance périmée | | absents |
| T10-T11ter effet du scan c. pression | scan ≤ 3 pts ; OR 1,64 c. 1,13 | sans objet : le scan n'a d'effet que sur le corps ouvert |
| T12 `BACK` sous pression | 35-55 % | mesurable, **tenu** | **38 %** (408 réceptions à < 2,5 m) |
| T13 demi-tour lancé | 1,7-2,2 s | à instrumenter (locomotion : le yaw tourne à sa vitesse propre) |
| T15 take-ons des spécialistes | 41-54 % | mesurable, **volume faux** | **199 gestes / match** (réel ≈ 40), réussite 37 % ; T15bis meilleur / médian **2,8** (cible ≥ 5) — tout le monde dribble |
| T16-T19 mauvais sens, engagement tardif de l'élite, adaptation, cône | | absents (pas de tromperie) |
| T20-T23 communication | | absents (un seul message, la passation 252) |
| T24 ballon en jeu | 54-58 % | mesurable, **réfuté** | **84 %** (4 551 s sur 5 400 : pas de temps additionnel réel, reprises courtes) |
| T25 durées de reprise | touche 17,7 / six mètres 30,3 / corner 36,9 | mesurable, **partiel** | touche **11,8**, six mètres **18,1**, corner **19,2**, coup franc 18,6 (`tempsMort` 217 à 12 / 20 / 22 / 18) |
| T26 curseur `timeManagement` | ≥ 3 pts | le contexte existe (`traine` / `presse` 0,35) — à mesurer |
| T27 simulations | 3 ± 1 par match | absent |

## 4. Les lots que la fiche appelle

1. **La perception non omnisciente** (T2, T3, T6-T9 ; Modèle 04 ; ch. 10 lot 1, ch. 13 lot 1) : `HeadState`, la
   croyance datée et l'oubli, 1-3 entités par balayage, le taux par poste et contexte (la pression ferme le regard),
   le scan comme **prérequis de poste**, pas un talent. C'est le lot transversal des Bibles 10, 13, 14.
2. **La tromperie** (T15-T19, ch. 08 lot dribble) : le geste comme signal, l'inférence du défenseur, l'engagement
   tardif de l'élite, l'adaptation — et le **volume** des gestes (199 → ≈ 40, le meilleur 5 × le médian).
3. **Le temps du match** (T24-T27, ch. 16) : ballon en jeu 84 → 55 %, les cérémonies dans la bande réelle (touche
   12,7-21,7, six mètres 26,2-36,7, corner 30-50), le temps additionnel qui en découle, la règle des 8 s.
4. **La communication comme canal** (T20-T23 ; ch. 10 §11.3, ch. 12 lot 2) : voix 25 m, geste vu, boîte à un
   message.
5. **La première touche typée** (T14, §4) et **la pausa** (253).
