# Référentiel 16 — Données et ressources, contre le moteur

*Fiche du 9/09, moteur bc35ebb (SCEAU 256). Le chapitre est un plan d'acquisition ; la fiche dit ce que le dépôt possède et ce qu'il lui manque pour calibrer.*

| Famille de cibles | Source recommandée (book) | Ce que le dépôt a | Statut |
|---|---|---|---|
| Buts, tirs, conversion (01, 03) | Wyscout Big-5 2017-18 ; Opta / FBref | les cibles recopiées dans les fiches R01-R03 ; aucune donnée brute | étape 1 à faire |
| Passes, réussite, progression (02) | Wyscout ; StatsBomb | idem | étape 1 |
| Séquences, direct speed (01, 14) | Wyscout recalcul ; Opta PL | idem | étape 1 |
| Duels, take-ons (04) | Wyscout à 3 issues ; StatsBomb | idem | étape 1 |
| CPA (06) | Wyscout + StatsBomb | idem | étape 1-2 |
| Fautes, cartons, temps additionnel (09, 10) | Wyscout + football-data | idem | étape 1 |
| Dyades (13) | Wyscout | le journal peut les produire ; pas de réel | étape 1 |
| Styles (14) | Opta / FBref | presets sans mesure | étape 1 (B) |
| Domicile, biais arbitral (09) | football-data | absent | étape 1 |
| Pressions (Bible 12, Modèle 07) | StatsBomb `Pressure` ; SkillCorner | absent | étape 2 (B) |
| Liberté du receveur, lignes cassées (Bible 03) | StatsBomb 360 | absent | étape 2 (B) |
| Tracking (Modèles 02, 05, 13) | Metrica, SkillCorner open | absent — le seul moyen de juger la locomotion, l'espace, la chorégraphie autrement que par des cibles agrégées | étape 3 |

## Ce que la fiche appelle

1. **L'étape 1** (§8) : un dossier `data/` avec Wyscout Big-5 2017-18 (public), football-data, les agrégats Opta /
   FBref recopiés — et les cibles des fiches R01-R10 **recalculées** depuis la source, pas recopiées du book.
2. **Le format** (§3 ; Modèle 16 lot 1) : SPADL comme pivot, `socceraction` pour VAEP — le journal du moteur
   exporté dans ce format est ce qui rend la comparaison directe.
3. **Le tracking** (§4-§5) : Metrica / SkillCorner open pour les tests des Modèles 02, 05 et de la Bible 13 (les
   autocorrélations, les zones atteignables, les couches convexes) — sans lui, ces fiches restent à « à confronter ».
