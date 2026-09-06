# Table des rôles re-échelonnée (lot 244e)

Réponse au retour du projet aval sur le 244c : les 34 rôles sont dans le moteur (roles.js) avec leurs onze axes à la valeur près, et les multiplicateurs d'arbitre re-échelonnés linéairement dans la bande du moteur [0,7 ; 1,3] — tir 0,5-1,4, centre 0,75-1,35, passe 0,75-1,4, conduite 0,8-1,3 → 0,7-1,3, arrondi au centième. Vérifié : zéro couple de rôles fondu, zéro ordre inversé, zéro valeur hors bande. L'axe dribble est reporté par la résolution (rappel 219). Un rôle qui ne pose pas d'arbitre résout à l'identité ×1.

| rôle | libellé | tir | centre | passe | conduite |
|---|---|---|---|---|---|
| goalkeeper | Gardien | — | — | — | — |
| keeper_libero | Gardien libero | — | — | ×1.07 | — |
| centre_back | Défenseur central | — | — | — | — |
| stopper | Stoppeur | — | — | — | — |
| cover | Couvreur | — | — | — | — |
| playmaker_defender | Défenseur constructeur | ×0.83 | — | ×1.21 | ×1.06 |
| libero | Libero | — | — | ×1.16 | ×1.18 |
| full_back | Latéral | — | ×1.1 | — | — |
| wing_back | Piston | — | ×1.25 | — | ×1.06 |
| inverted_fullback | Latéral inversé | — | ×0.7 | ×1.12 | — |
| modern_wingback | Piston moderne | — | ×1.2 | — | ×1.12 |
| anchor | Sentinelle | ×0.77 | — | ×1.02 | — |
| half_back | Décrocheur | ×0.73 | — | ×1.12 | — |
| regista | Regista | ×0.83 | — | ×1.3 | ×0.82 |
| destroyer | Destructeur | ×0.7 | — | ×0.79 | ×0.7 |
| box_to_box | Box-to-box | ×1.1 | — | — | — |
| deep_lying_playmaker | Meneur reculé | ×0.87 | — | ×1.25 | — |
| mezzala | Mezzala | ×1.1 | — | — | ×1.18 |
| carrilero | Carrilero (navette) | ×0.9 | — | ×1.02 | — |
| free_role_creator | Créateur libre | ×1.1 | — | ×1.21 | ×1.24 |
| attacking_midfielder | Milieu offensif | ×1.13 | — | ×1.12 | — |
| trequartista | Trequartista | ×1.1 | — | ×1.21 | ×1.3 |
| shadow_striker | Attaquant fantôme | ×1.23 | — | ×0.84 | — |
| winger | Ailier | ×0.97 | ×1.3 | — | ×1.18 |
| inside_forward | Inside forward | ×1.27 | ×0.7 | — | ×1.24 |
| wide_creator | Créateur côté | — | ×1.15 | ×1.21 | ×1.12 |
| raumdeuter | Raumdeuter | ×1.23 | ×0.8 | — | ×0.7 |
| tracking_winger | Ailier défensif | — | ×1.1 | — | ×0.88 |
| forward | Attaquant | ×1.2 | — | — | — |
| target_man | Pivot | ×1.17 | — | ×1.02 | ×0.7 |
| poacher | Renard des surfaces | ×1.3 | — | ×0.7 | ×0.7 |
| all_around_striker | Attaquant complet | ×1.17 | — | ×1.07 | ×1.06 |
| pressing_striker | Attaquant pressing | ×1.13 | — | — | — |
| false_9 | Faux 9 | ×1.1 | — | ×1.21 | ×1.18 |

Les onze axes (profondeur, largeurR, appel, press, garde, ancrage, tenue, duel, marqueSerre, ressort, orienteFaible) sont ceux de la table aval, inchangés.
