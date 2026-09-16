# L'inventaire des gestes générés et de leurs déclencheurs

Généré le 16/09 (note 387) depuis le registre des générateurs (motion-cast.GENERATED_KINDS) croisé avec les références du moteur et de la scène : pour chaque geste, la ou les techniques de la table (technique.js) dont il est le clip, et les modules qui le nomment (sim ou scène). Un geste sans référence n'a pas de déclencheur. Les variantes construites à la volée (passementJambes2 à 6) se nomment par préfixe dans skills-sim.

## Les frappes (motion-strike)

| geste | technique(s) de la table | nommé par |
|---|---|---|
| `frappe` | `passe-laces`, `degagement` | Rondo, rondo-remises, ball-body, elan, match-config, referee, strike-sim, technique |
| `frappePuissante` | `frappe-puissante` | strike-sim, technique |
| `frappeEnroulee` | `frappe-enroulee` | strike-sim, technique |
| `passe` | `passe-interieur` | Rondo, menace, premiere-intention, rondo-sim, rondo, strike-sim, technique |
| `passeExterieur` | `passe-exterieur` | Rondo, technique |
| `deviation` | `deviation` | duel, technique |
| `frappePointu` | `frappe-pointu` | strike-sim, technique |
| `passePivot` | `passe-pivot` | rondo-config, strike-sim, technique |
| `talonnade` | `talonnade` | approach, football-rules, rondo-sim, strike-sim, technique |
| `feintePasse` | `feinte-passe` | skills-sim, technique |
| `feinteFrappe` | `feinte-frappe` | skills-sim, technique |
| `passeRapide` | `passe-rapide` | technique |

## Les contrôles (motion-control)

| geste | technique(s) de la table | nommé par |
|---|---|---|
| `controleInterieur` | `controle-interieur` | Rondo, rondo-remises, technique |
| `controleExterieur` | `controle-exterieur` | technique |
| `controleOriente` | — | Rondo |
| `controleSemelle` | `controle-semelle` | technique |
| `amortiCuisse` | `amorti-cuisse` | technique |
| `amorti` | `amorti-poitrine` | Rondo, duel, technique |
| `tacleDebout` | `tacle-debout` | rondo-sim, technique |

## Le ciel (motion-aerial)

| geste | technique(s) de la table | nommé par |
|---|---|---|
| `tete` | — | Rondo, roles, rondo-sim, tete |
| `teteDebout` | — | Rondo, tete |
| `teteDefensive` | — | Rondo, petits-gestes, tete |

## Les gestes techniques (motion-skill)

| geste | technique(s) de la table | nommé par |
|---|---|---|
| `rateau` | `rateau` | rondo-sim, skills-sim, technique |
| `arretSemelle` | `arret-semelle` | Rondo, rondo-fete, petits-gestes, skills-sim, technique |
| `roulette` | — | ticker, skills-sim |
| `passementJambes` | `passement-jambes` | skills-sim, technique |
| `crochet` | `crochet` | ticker, skills-sim, technique |
| `crochetCourt` | — | Rondo, ticker, skills-sim |
| `crochetChaloupe` | — | ticker, skills-sim |
| `doubleContact` | — | skills-sim |
| `feinteAppel` | — | petits-gestes |
| `petitPont` | — | ticker, skills-sim |
| `passementJambes2` | — | skills-sim (par préfixe, tours ≥ 2) |
| `passementJambes3` | — | skills-sim (par préfixe, tours ≥ 2) |
| `passementJambes4` | — | skills-sim (par préfixe, tours ≥ 2) |
| `passementJambes5` | — | skills-sim (par préfixe, tours ≥ 2) |
| `passementJambes6` | — | skills-sim (par préfixe, tours ≥ 2) |

## Le sol (motion-ground)

| geste | technique(s) de la table | nommé par |
|---|---|---|
| `tacle` | `tacle-glisse` | technique |

## Le gardien (motion-keeper)

| geste | technique(s) de la table | nommé par |
|---|---|---|
| `plongeon` | — | Rondo, match-sim, rondo-sim, skills-sim, sortie-aerienne |
| `plongeonBas` | — | match-sim |
| `plongeonUneMain` | — | match-sim |
| `plongeonPrise` | — | rondo-remises, match-sim, sortie-aerienne |
| `sortiePoing` | — | match-sim, sortie-aerienne |
| `paradePieds` | — | Rondo |
| `paradeBuste` | — | Rondo |

## Les remises (motion-restart)

| geste | technique(s) de la table | nommé par |
|---|---|---|
| `touche` | `touche` | Rondo, ball-body, cpa, elan, match-config, match-sim, phases, pitch, referee, rondo-sim, skills-sim, strike-sim, technique |
| `rouleMain` | `roule-main` | ramasseurs, technique |
| `ramassage` | — | Rondo, ramasseurs |
| `voleeGardien` | `volee-gardien` | match-config, technique |

## Le contact (motion-contact)

| geste | technique(s) de la table | nommé par |
|---|---|---|
| `chuteAvant` | — | rondo-contact |
| `chuteCote` | — | rondo-contact |
| `chuteArriere` | — | rondo-contact |
| `trebuche` | — | rondo-contact |
| `epaule` | — | rondo-contact |
| `protection` | — | rondo-contact, bouclier |

## L'émotion (motion-emotion)

| geste | technique(s) de la table | nommé par |
|---|---|---|
| `poing` | — | rondo-fete, match-sim, referee |
| `brasLeves` | — | rondo-fete, referee |
| `oreille` | — | rondo-fete, referee |
| `calme` | — | rondo-fete, match-sim, referee |
| `glissade` | — | Rondo, rondo-fete, match-sim, referee |
| `mainTendue` | — | Rondo, aide, match-config |
| `sautMur` | — | elan, match-config |
| `accolade` | — | rondo-fete |
| `serrerMain` | — | rondo-fete |
| `saluer` | — | rondo-fete, ceremonie |
| `applaudir` | — | rondo-fete, ceremonie, petits-gestes |
| `proteste` | — | rondo-fete |

## L'arbitre (motion-arbitre)

| geste | technique(s) de la table | nommé par |
|---|---|---|
| `siffler` | — | referee |
| `carton` | — | Rondo, arbitre, rondo-fete, ticker, referee |
| `designer` | — | petits-gestes, referee |
| `avantage` | — | ticker, referee |
| `drapeauLeve` | — | referee |
| `drapeauIncline` | — | referee |
| `drapeauInclineG` | — | referee |
| `drapeauHorizontal` | — | referee |

**Bilan** : 75 gestes branchés sur 75.

Les touches de conduite du porteur (rondo.js) se nomment `control` sans technique : la scène joue `controleInterieur` (ballon bas) ou `amorti` (ballon haut) par défaut — 23 % des contrôles d'un match ; nommer la touche de conduite (intérieur/extérieur selon le pied) est une dette.
