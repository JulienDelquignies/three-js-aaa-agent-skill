# Modèle 15 — L'IA entraîneur en match, contre le moteur

*Fiche du 9/09, moteur 0735d1f (SCEAU 256). Inventaire ; mesures citées des Bibles 16 et 14.*

## 1. Ce que le chapitre demande

- **Un levier faible** : l'ajustement en cours de match vaut +2 à +4 points de victoire (test 1 : > +5 réfute) ;
  le staff **observe** des agrégats bruités (pas l'état vrai), diagnostique avec ≤ 80 % d'exactitude (test 9),
  ne réagit jamais sous le seuil d'observabilité (test 11).
- **Le cycle** : observer → diagnostiquer → choisir dans une **bibliothèque d'ajustements** → attendre (non-
  oscillation : < 5 % annulés en moins de 10 min, 2-3 ajustements structurels par match, P(n > 7) < 5 %).
- **Les remplacements** : minute N(70,6 ; 14,3²), 3,5-4,8 par équipe, direction (défensifs en menant, offensifs
  menés), endogénéité non câblée, effet fraîcheur (+2-7 % de distance, +30-43 % de sprint sur 5 min), la mi-temps
  (pénalité de sprint 3-5 min, ré-échauffement), fin de match, contre-ajustement mutuel, personnalités, l'IA trop
  bonne, conservation du temps (la perte de temps annulée ≥ 70 % par le temps additionnel).

## 2. Où en est le code

**Existant.** `coach.js` (149, 175) : politique **injectable** (`cfg.coach.decide`) et **native** à quatre postures
(pousse / gère / recule / base) selon écart × urgence du chrono et l'**orage** (≥ 3 tirs subis dans la fenêtre 60 s),
toutes les 20 s, `checkCoach` avec cas nommés (« mené avant la mi-temps : on ne panique pas ») ; la **Loi 3**
(referee `stepRemplacements`, l'entrant naît frais, fatigue `pause` à la mi-temps) ; le chrono et le temps
additionnel ; l'axe mentalité.

**Partiel.** Le coach lit **l'état vrai** (score, tirs subis) — pas des agrégats bruités ; ses postures déplacent
les axes (pressing ± 0,2, hauteur ± 0,15…) mais dans le sens mesuré **inversé** sur les tirs (Bible 16 T5-T6 : le
menant tire plus) ; les remplacements existent sans politique de minute ni de direction ; pas de bibliothèque,
pas de diagnostic, pas de personnalité.

**Absent.** L'observation bruitée et le seuil d'observabilité ; le diagnostic imparfait ; la bibliothèque
d'ajustements et l'attente ; les remplacements comme distribution (70,6 ± 14,3) et direction ; l'effet fraîcheur ;
la mi-temps comme pénalité ; le contre-ajustement ; les personnalités ; la perte de temps comme politique.

## 3. Les tests de réfutation, un par un

| # | Cible (book) | Statut | Mesuré |
|---|---|---|---|
| 1 ablation du coach | +2 à +4 pts, > +5 réfute | à mesurer (coach null c. natif, ≥ 6 graines × 90 min) |
| 2 minutes de remplacement | N(70,6 ; 14,3) ; 3,5-4,8 | à instrumenter (Loi 3 sans politique) |
| 3-4 endogénéité, direction | | absents |
| 5 hyperactivité structurelle | | à mesurer (SoccerCPD) |
| 6 non-oscillation | < 5 % annulés, 2-3 / match | à mesurer (postures toutes les 20 s) |
| 7-8 fraîcheur, seconde période | +2-7 % / +30-43 % ; pénalité 3-5 min | partiel (entrant frais ; pas de pénalité) |
| 9 imperfection du diagnostic | ≤ 0,80 | **réfuté par construction** (état vrai) |
| 10 personnalités | | absent |
| 11 absence d'omniscience | | **réfuté par construction** |
| 12 conservation du temps | ≥ 70 % annulé | Bible 16 T23 : temps additionnel constant |

## 4. Les lots que la fiche appelle

1. **Le coach qui observe des agrégats bruités** (tests 9, 11 ; Modèle 04) : seuil d'observabilité, diagnostic
   imparfait — et la posture dans le bon sens (Bible 16 lot 2).
2. **Les remplacements comme politique** (tests 2-4, 7 ; Bible 16) : distribution de minute, direction, fraîcheur.
3. **La bibliothèque et l'attente** (tests 5, 6) : ajustements nommés, non-oscillation.
4. **L'ablation au banc** (test 1) : coach null c. natif sur ≥ 6 graines — la clause qui borne le levier.
5. **La perte de temps et le temps additionnel** (test 12 ; Bible 14 lot 3, Modèle 12).
