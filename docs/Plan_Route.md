# Plan de route — comment on se sert de ce dépôt pour avancer

*Rédigé le 9/09 sur 8168051 (SCEAU 256). C'est le plan que le PLAN_DOCTRINE ne dit pas : non pas « quel est le
prochain lot », mais « à quoi sert ce dépôt, pour qui, et dans quel ordre on le fait grandir ». Le PLAN_DOCTRINE reste
le journal des lots ; NOTES.md reste la mémoire ; ce document est la carte.*

## 1. Ce que ce dépôt est devenu, et ce qu'il n'est pas encore

**Ce qu'il est.** Un moteur de football en JavaScript (127 modules, ~30 000 lignes) qui possède les LOIS du jeu et
se paramètre par des DONNÉES : 37 notes joueur (`attributes.js`, des facteurs, identité 1 à 50), 48 rôles sur onze
axes (`roles.js`, identité 0,5, interdits binaires), 31 formations (`formation.js`), des tactiques en axes
(`tactics.js`), et une configuration de lois (`match-config.js`) où toute clé absente rend l'hier au bit. Autour :
un banc de 151 blocs et 72 annexes (~17 000 lignes) qui PROUVE chaque loi sur fixture et mesure son flux ; 126
entrées de journal ; un mode de fabrication (sonde avant → loi à clé → jumeau au bit → clause → banc complet →
sceau) qui a tenu 256 lots sans casser l'identité au bit. Trois consommateurs le lisent déjà : la scène Three.js
(Rondo, showcase), l'agent animation (branche A1-A12), et un jeu aval de gestion (le « directeur sportif ») qui
injecte ses effectifs, ses tactiques et ses rôles et lit `st.events`.

**Ce qu'il n'est pas encore.** Un PRODUIT. Le moteur vit en trois photocopies synchronisées par `cp` ; il n'a ni
version, ni paquet, ni schéma public du journal ; le banc tourne à la main (62 minutes) ; le contrat de données
existe (catalogues) mais s'est déjà troué une fois (`scanning` lue sans être déclarée). Et le jeu qu'il produit,
laissé à lui-même, est du vrai football (3,0 buts par match) — mais nourri de vraies données il en fait 10, parce
que son échelle de finition tient dans 7,5 % de la largeur du but, que son carton est un compteur, et que personne
ne joue sur l'épaule du dernier défenseur (retour aval du 7/09).

## 2. Le produit qu'on vise : « Unity/Unreal du football »

Un moteur réutilisable, ça veut dire quatre choses concrètes, et chacune est un chantier :

1. **Un contrat d'entrée** : `makeMatch({ squads, tactics, roles })`, `matchStep`, `matchCfg` — trois portes, et
   des catalogues où « si une note n'y est pas, elle n'existe pas ».
2. **Un contrat de sortie** : le journal `st.events` avec un vocabulaire documenté et stable (un seul nom d'auteur,
   un seul événement de frappe, le lieu sur les événements de lieu), et les états lisibles par le rendu (`p.scan`,
   `pick.foot`, `payload`) — gelés dans `docs/Interface_Campagne_V.md` et `MOTEUR.md`.
3. **Une garantie** : le banc, qui dit ce que le moteur exprime (le test d'identification 249) et ce qu'il garantit
   (les clauses), et les empreintes qui datent chaque monde.
4. **Un vrai football** : les nombres du réel comme cibles publiques — ~25 tirs, ~33 % cadrées, ~11 % de
   conversion, ~2,7 buts, ~22 fautes, ~4 cartons, 4-8 hors-jeu, 40-50 touches, ~10 corners — mesurés à chaque
   sceau, sans les forcer.

## 3. Les cinq chantiers, et pourquoi dans cet ordre

### Chantier A — Le vrai score (Campagne VI, d'abord)

C'est le retour aval qui l'impose : tout le reste se mesure sur un monde où chaque perte devient une frappe cadrée
à 63 %. Trois lots, chacun avec sonde, jumeau, banc complet, épingles datées :

- **258 — l'échelle de finition.** `shotSigma` de 0,10-0,55 m à un ordre de grandeur comparable à la cage (grand
  buteur ~0,4 m, maladroit 1,5-2 m), le terme de pression du 145 gardé. Derrière : cadrées, conversion, arrêts,
  buts re-mesurés ; les sept notes défensives et les sept leviers de gardien re-mesurés (leur t de 2,02 sur
  `command`) ; les clauses du banc qui vivent sur ces nombres re-datées. Le plus lourd et le plus rentable.
- **257 — le carton juge la nature.** `prometteur`, le tacle par derrière, l'arraché → jaune ; le tally à 4-5 ; et
  d'abord faire exister la faute d'anti-jeu (prometteur vrai une fois en trois matchs).
- **259 — l'épaule du dernier défenseur.** Quand part l'appel et d'où ; 0 hors-jeu en 270 minutes, la profondeur
  reçue 18 m derrière la ligne — c'est la même dette que l'appel muet du 249.

Sortie attendue : la table du réel ci-dessus avec chaque ligne à moins de ×1,5, publiée dans MOTEUR.md, et le monde
aval sous 4 buts par match avec leurs données.

### Chantier B — Le paquet (en parallèle, sans loi)

Faire du moteur un paquet qu'un projet installe au lieu de le photocopier :

- une seule source (`packages/football-engine/`), les trois copies remplacées par un import ; `verify-sync`
  devient inutile et disparaît ;
- un `package.json` versionné (0.x tant que le journal a des alias ; 1.0 quand `pass.from` et `turnover.to`
  sont retirés — 257) ; NOTES.md est le changelog, l'empreinte de chaque version est dans la release ;
- un schéma du journal (`docs/Journal.md` : type par type, champs, unités, qui l'émet, ce qu'il n'est pas) et un
  schéma des catalogues (la table des leviers avec leurs amplitudes — celle que l'aval a calculée : passing ×12,
  finishing ×5,5, défense ×1,35) ;
- le banc en CI : `bancs.mjs` en GitHub Actions, huit shards en parallèle (62 → ~10 minutes), le tally lu après
  `final.done` (règle du 256), une empreinte vérifiée par commit — le sceau cesse d'être un rituel manuel ;
- un guide du consommateur (le MOTEUR.md recentré) : injecter un effectif, des tactiques, des rôles ; lire le
  journal ; faire tourner sans rendu ; ce qui est stable et ce qui ne l'est pas.

### Chantier C — La Campagne V finie (les rôles individuels)

253 la pausa, 255 le preset ligne haute, 254 les mécanismes relationnels — après 258 pour qu'ils se mesurent dans un
monde qui compte. Et les dettes nommées de la campagne, chacune un lot quand elle est mûre : les touches (40 c. 70,
le service de la craie), la transition du repli (8-9 sous la ligne 65 c. 90 %), le 9 qui décroche sous le pivot (le
bloc de 30 m), le teamwork sans second lecteur, les 43 signatures muettes du 249.

### Chantier D — Le banc comme garantie (continu)

- La volumétrie : chaque clause au bord de Poisson (celles qu'on épingle à chaque loi qui bouge la défense — 189,
  l'aimant du porté, la course traverse la frappe, la roulette, les contres à l'entrée) passe à 24 graines ou à
  l'ordinal par graine ; les deux rouges hérités (246d, contres à l'entrée) sont instruits, pas épinglés.
- Les épingles datées ont une durée de vie : à chaque campagne close, on relit les `DATÉ` et on retire celles dont
  le monde a rattrapé la clause.
- Le test d'identification se regèle à chaque monde scellé, et le journal nomme les pertes.

### Chantier E — Les interfaces avec les autres agents (gouvernance)

Trois agents travaillent sur ce moteur : moteur (ce dépôt), animation (branche A*), aval (le jeu et les agents du
« book »). Ce qui a marché et qu'on garde : les interfaces GELÉES avant le travail (Interface_Campagne_V), les
retours de référence datés sur une photocopie (`docs/Retour_Reference_*`), et une réponse écrite point par point
avec un verdict (exact / réfuté / mesuré) et un lot. Ce qu'on ajoute : un fichier `docs/Interfaces.md` unique qui
liste ce qui est gelé et depuis quand ; A13, le second canal d'animation (`burst`, `touche`, `control`, `windup` =
58 % du journal), instruit avec l'agent animation ; et la règle qu'un consommateur mesure sur une VERSION, jamais
sur une branche vivante.

## 4. La cadence

- **Un sceau = un lot**, jamais deux lois dans un sceau ; le banc complet avant, le tally après `final.done`, le
  déploiement vérifié par le chunk servi.
- **Une campagne = 4-8 lots et une table de nombres avant/après**, publiée dans MOTEUR.md.
- **Une version = une campagne close** : empreintes, changelog, alias retirés, interfaces relues.
- Jalons proposés : **v0.9** à la fin du chantier A (le vrai score, journal sans alias) ; **v1.0** à la fin du
  chantier B (le paquet, la CI, le schéma du journal) ; **v1.1** à la fin de la Campagne V.

## 5. Ce qui est à décider (par le propriétaire du dépôt, pas par l'agent)

1. **Le paquet ou la photocopie ?** Le chantier B suppose que le jeu aval consomme une version publiée. Si l'aval
   préfère continuer à photocopier, B se réduit au schéma du journal et à la CI.
2. **Le vrai score avant les rôles ?** L'ordre A → C est un choix : la Campagne V a été demandée avant, le retour
   aval l'a dépassée en importance. L'inverse est défendable si l'animation attend 253.
3. **Où vit le banc ?** Un banc de 62 minutes en CI coûte des minutes machine à chaque commit ; l'alternative est
   un banc court par commit (annexes, ~5 min) et le banc complet au sceau.
4. **Les cibles du réel** : la table du §2.4 devient-elle une clause (rouge si un nombre s'éloigne de ×1,5) ou reste-
   t-elle informative ? Une clause force la discipline ; elle force aussi des épingles.
