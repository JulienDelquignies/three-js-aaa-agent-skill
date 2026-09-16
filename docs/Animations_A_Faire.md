# Les animations à faire, et les branchements qu'elles exigeront

Document de travail (16/09). Le jumeau de `docs/Branchements_Moteur_Animations.md` : ici, ce qui
n'existe pas encore comme geste, avec pour chacun le générateur à écrire, le déclencheur sim
qu'il faudra brancher, la lecture par la scène, le contrat, la dépendance. La recette commune est
au § 0 du jumeau. L'ordre est celui de la valeur visuelle, pondérée par le coût.

## 1. La tête ARMÉE (le geste existe, le déclencheur non) — dépend du jumeau § 2

- **Geste.** `tete` (avec saut) et `teteDebout` existent (motion-aerial, A3) ; un `teteDefensive`
  (dégagement : le buste s'arme davantage en arrière, le regard au ballon) et une `tetePlongee`
  (tête plongeante sur un centre bas) sont à générer.
- **Déclencheur.** L'acte armé de `tete.js` (jumeau § 2) : windup skill `tete` `antic` s avant le
  contact, mode (but/dégagement/remise) dans le payload → le geste par mode.
- **Scène.** `_playTech` sur le windup (plus « from contact ») ; le time-warp du saut sur l'heure
  du ballon (le patron du plongeon : `rate`, `_diveStart`).
- **Contrat.** Le sommet du saut au contact, la tête au ballon (≤ 0,25 m à l'image de l'événement),
  les bras en balancier, la réception ; verify-aerial + une clause composée en page.

## 2. La retournée (le geste existe, aucun déclencheur) — LIVRÉ (16/09, lot C1, note 376, reference/51-motion-strike § C1)

- **Livré** : `cfg.retournee { hMin 1.5, hMax 2.1, reach 0.7, dos 2.0, libre 1.5, but 16, vitesse 16, elevation 0.05 }` (tete.js
  retourneeArmerStep/retourneeContact, la porte du ciel de rondo-sim) : le ballon prédit au contact du clip au-dessus de la tête d'un
  attaquant dos au but, seul, dans la surface → l'acte armé, la frappe au but au contact (espèce 'retournée'). verify-retournee 6/0.
  Le clip est authored (animkit-data), pas généré ; il retombe et se relève seul : pas de `p.down`.
- *(le plan d'origine, gardé pour mémoire)*

- **Geste.** `retournee` (animkit-data, authored ; le doc disait motion-ground/A5 à tort) : sous contrat, jamais jouée.
- **Déclencheur.** Dans `tete.js`/`voleeStep` : un ballon en vol qui arrive entre 1,2 et 1,7 m sur
  un attaquant DOS AU BUT dans la surface, sans adversaire à < 1,5 m, avec une note de volée
  (`skill.voleeF`) → acte `retournee` (anticipation = contact du clip, `ownsBody`, le corps tombe :
  `p.down` court après, comme le tacle glissé). Clé `cfg.retournee` `{ hMin, hMax, proba }`.
- **Scène.** Le clip possède le corps et les hanches (canal hips), la chute et le relevé à l'heure
  sim (`contactClock`, patron du tacle).
- **Contrat.** verify-ground existant + la clause sim (forcée : un centre à 1,5 m sur un dos au but).

## 3. La sortie aérienne du gardien : la prise et le poing — LIVRÉ (B10 la sortie, C3 le poing — 16/09, note 378, reference/53 § C3)

- **État.** La loi de sortie vit (`cfg.sortieAerienne`) et la prise en l'air joue `plongeonPrise` ; le POING est généré
  (`sortiePoing`, motion-keeper : saut, genou levé, poings serrés, le coup à travers) et armé quand l'attaquant arrive avec le
  ballon (sortie-aerienne.js `poing`), le ballon dégagé du poing (onDive, 'arrêt' poing). Reste `prisePlanante`.
- **Geste.** `plongeonPrise` existe (A6) ; à générer : `sortiePoing` (les deux poings au ballon,
  saut à un pied, genou levé) et `prisePlanante` (prise à deux mains en l'air, sur un pied).
- **Déclencheur.** La loi de sortie sur centre (jumeau § 10) : le gardien élit la sortie quand le
  vol passe dans la surface de but à ≥ 1,6 m et qu'il y arrive avant l'attaquant ; poing si un
  adversaire est à < 1,2 m du point, prise sinon. Clé `cfg.sortieAerienne`.
- **Scène.** Le ballon aux gants tenu (`remiseHands`, A9 bis) ou dévié du poing (un `release('poing')`).

## 4. Le fauché saisit la main (A10 quinquies) — LIVRÉ (16/09, lot C2, note 377, reference/59 § C2)

- **Livré** : `mainTendue` tire (hold 0,65 puis pull 0,5 : le bras revient de 14 cm, le buste se redresse — verify-emotion 47/0)
  et la scène rejoint les deux mains au point médian pendant le relevé du fauché et le tir de l'aidant (`Rondo._applyAideWarp`,
  deux IK deux os) ; pas de clip `releveAide` : le bras du fauché est une IK vers la main, le clip couché garde son relevé.
- *(le plan d'origine, gardé pour mémoire)*

- **Geste.** Une variante du relevé (motion-contact, segment `rise`) : `releveAide` — le bras
  tendu vers le haut pendant le relevé, le corps remonte plus droit, et pour l'aidant une fin de
  `mainTendue` qui TIRE (le bras revient, le buste se redresse) ; les deux synchronisés par
  l'horloge sim du relevé (`p.down`, `contactClock`).
- **Déclencheur.** `aide.js` sait tout : `f._aide.geste` posé = la main est là ; la scène choisit la
  variante du relevé quand `f._aide?.geste` et que l'aidant est à ≤ 1,3 m.
- **Contrat.** Les deux mains à ≤ 0,15 m l'une de l'autre pendant 0,3 s (composé, en page) ; le
  fauché debout à l'heure de la sim comme aujourd'hui.

## 5. Les assistants et le ramasseur (des corps de plus)

- **Assistants.** Deux corps sur les lignes de touche, à la hauteur de la ligne de hors-jeu
  (`offsideLine`) ; gestes : drapeau levé (hors-jeu : l'événement `hors-jeu` existe), drapeau
  incliné (sens de la touche : `sortie` avec `out`), drapeau à l'horizontale (remplacement).
  Générateur `motion-arbitre` (famille arbitre, le drapeau comme la carte : une prop attachée à la
  main). Sim : `referee.js` (au plafond → `assistants.js` : positions et gestes dans `st.assistants`),
  clé `cfg.assistants`. Scène : `arbitre.js` `spawnOfficiel` × 2.
- **Ramasseur.** L'événement `ramasseur` existe (le ballon revient au point) : un corps au bord qui
  trotte au ballon, le ramasse (`ramassage`, A9) et le roule (`rouleMain`). Scène seulement, plus
  une position dans la sim (`st.ramasseurs`).

## 6. La foulée : le pas croisé, le port des bras, le verrou de pieds (A7 ter) — LIVRÉ (16/09, note 380, reference/52 § A7 ter, verify-foulee 81/0)

- **Pas croisé.** Dans `gaitPose`, `opts.turn` > 7 m/s² à v > 3 : la jambe extérieure croise
  devant (chemin de pied latéral alterné sur un cycle), le bassin tourne. Contrat : pas de
  croisement en chassés (existant), croisement borné en virage.
- **Port des bras.** `GAIT_REGIMES` : coude 85° → 90-100° et mains à hauteur de poitrine en
  course (les planches montrent un bras bas) ; `persona.bras` module déjà.
- **Verrou de pieds.** `foot-lock.js` calibré sur la foulée générée (plancher, bande) : le
  tressaillement de 5 cm au pelage mesuré (reference/52 § dettes).

## 7. L'avant-match et les gestes sociaux (A11 ter) — LIVRÉ (16/09, note 381, reference/59 § A11 ter, verify-ceremonie 8/0)

- **Gestes.** `salut` (la main levée au public), `poignee` (deux joueurs, les mains droites qui se
  joignent : un geste APPARIÉ comme l'accolade — la scène aligne les deux corps), `applaudir` et
  `accolade` existent (accolade : les mains plus basses, retour utilisateur).
- **Déclencheur.** La cérémonie d'engagement (`referee` : `a.job = 'ceremonie'` existe pour le
  central) : une file de poignées entre les deux équipes avant le premier engagement, clé
  `cfg.ceremonie.poignee` ; le salut à la fin du match (`chrono` fin de période).
- **La carte plus lisible.** `arbitre.js` : la plaque 7,5 × 10,5 cm → une plaque tenue plus haut,
  face au fautif, 0,3 s de plus.

## 8. Le remplacement et la boiterie

- **Remplacement.** `referee.remplacer` existe (le remplacé marche vers sa sortie, l'entrant naît à
  la ligne) : à animer la poignée de main à la ligne (§ 7 `poignee`) et l'entrant qui TROTTE
  (`_walkF`), le quatrième arbitre (un corps de plus, § 5).
- **Boiterie.** Après une faute grave (`carton`/`faute` kind grave), une foulée asymétrique pendant
  N s : `gaitPose` `opts.boite` (le pas du côté touché raccourci, l'appui plus court, le bassin
  qui plonge de ce côté) ; sim : `p._boite = { until }` posé par `adjugeFaute`, clé
  `cfg.sol.boiterie`.

## 9. La tenue de balle dos au but (A10 ter) — LIVRÉ (16/09, note 379, reference/55 § A10 ter, `engine/bouclier.js`, cfg.bouclier)

- **Geste.** Le bouclier existe (`contactShield`, A10 : le porteur protège son ballon) et a maintenant sa DURÉE : la sim TIENT
  (bouclierStep au tick de décision : arrêt, dos au presseur qui orbite, ballon porté ; issues appui / faute poussée / relache /
  deborde / expiree ; contrat adversaire-ballon ≥ 0,6 m tenu à 0,74 m ; clé null = hier au bit).
- **Déclencheur.** Une loi moteur : le porteur pressé dans le dos, sans appui devant, TIENT
  (`act` bouclier `ownsBody` 0,8-2 s, le ballon sous la semelle ou au pied, le corps entre le ballon
  et l'adversaire) jusqu'à un appui ou une faute ; clé `cfg.bouclier { duree, pression }`.
  Contrat : la distance adversaire-ballon ne descend pas sous 0,6 m pendant la tenue.

## 10. Les petits gestes qui manquent au match

- **Le râteau/la semelle sur ballon arrêté à la relance** (le gardien qui pose le ballon du pied).
- **Le gardien qui replace son mur** (le bras qui désigne : `designer` existe, à brancher sur la
  pose du coup franc adverse, clé dans `remisesPied.mur`).
- **Le dégagement de la tête défensif** (§ 1 `teteDefensive`).
- **Le contrôle orienté** (le premier contact qui emmène le ballon dans la course : motion-control
  `controleOriente`, déclencheur : `receive` avec un cap voulu ≠ le cap du ballon).
- **La feinte de corps sans ballon** (l'appel : un crochet du buste avant le départ — motion-skill
  `feinteAppel`, déclencheur : `burst` kind appel).

## L'ordre proposé

Jumeau § 1-3 d'abord (le pied, le double geste, la tête armée), puis ici 1 (tête armée, dans le
même lot que jumeau § 2) → 2 (retournée) → 4 (la main saisie) → 3 (la sortie aérienne) → 9 (la
tenue dos au but) → 6 → 7 → 5 → 8 → 10.
