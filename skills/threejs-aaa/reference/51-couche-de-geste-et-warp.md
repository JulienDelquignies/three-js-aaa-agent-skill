# 51 — La couche de geste et le warp de frappe : la rencontre du pied et du ballon

Deux modules nés d'une seule chasse : `engine/gesture-layer.js` (la pose authorée, posée absolue)
et `engine/strike-warp.js` (l'alignement composé du pied sur le ballon porté — l'équivalent moteur
du Motion Warping d'Unreal, avec des lois écrites et un registre de refus). Ils ferment la chaîne
banc → monde : le banc de swing prouve le clip, le porté prouve le ballon, ces deux couches
prouvent leur RENCONTRE.

## La chasse (résumé mesuré — chaque étape a son chiffre)

1. **L'audit composé** donnait pied→frappe 0,19–0,56 m selon l'épisode : personne ne possédait la
   jambe frappeuse pendant l'armé (foot-lock se retire sur `gestureHold`).
2. **Le warp v1** (probe statique du point de contact) a été condamné par sa propre mesure : le
   probe composait une autre pile que le jeu — l'instrument mesurait une ombre (charte, loi 8).
   Remplacé par la **calibration en ligne** : le jeu se mesure lui-même au passage du contact
   (le mixer ré-écrit la pose chaque image, donc le pied lu avant IK est déjà non-warpé ; deux
   images encadrent l'instant exact, interpolation, moyenne mobile par rig × clip × pied).
3. **Le lacet** : le modèle restait jusqu'à 110° du yaw sim AU CONTACT — le contrôleur dérive son
   facing de l'intention de vitesse, nulle pendant un armé en pivot. Le yaw visuel est désormais
   SNAPPÉ au yaw sim, comme la position (un corps, une autorité ; le lissage est l'inertie prouvée
   de la sim). Sans ce fix, la surface « réalisée » variait de 22° à 133° d'un épisode à l'autre
   du même clip.
4. **Les deltas additifs** : l'algèbre de three est celle du banc (lu dans les sources : delta =
   q_ref⁻¹ ⊗ q_t, appliqué base ⊗ delta) — mais la BASE différait. Le banc compose sur le REST du
   rig ; le jeu composait sur l'idle RETARGETÉ, dont les locals portent 20° (cuisse), 32° (tibia),
   ~43° (bassin) d'écart au rest. Un delta est une grande rotation valable près de son repère
   d'authoring : conjugué à 43° de là, le plan du balayage pivote. D'où la **couche de geste**.
5. **La direction** : une fois le repère propre, la vérité est apparue — TOUTES les frappes
   balayaient vers l'arrière (passe : −0,46 m d'avant au contact) et la talonnade faisait 0,00.
   La sonde articulaire (FK nue, une rotation à la fois) a tranché : sur ce rig, flexion de
   hanche = **+x** (pied +0,56 m devant à +45°), flexion de genou = **−x** (talon vers la fesse à
   −90°), dorsiflexion = +x. Les specs croyaient l'inverse pour la hanche ET le genou. Flip
   mécanique des 170 clés, bornes de charnière re-signées, clauses de DIRECTION au banc.
   « Beaucoup de talonnade », disait l'utilisateur : chaque passe en dessinait une.
6. **La stance se dérive du clip** : la table écrite à la main divergeait de 0,10 à 0,45 m de là
   où les clips frappent réellement. Mesurée par FK (S = pied_contact + standoff · direction du
   pied), écart résiduel composé 0,45 → 0,23 m, warp de 0,05 m au lieu d'écrêtages permanents.
   Clause de concordance au banc : ré-authorer un clip sans re-mesurer sa stance fait refuser.

Résultat composé (audit-membres 16/0) : frappe à **17,0 m/s** au contact (fourchette réelle
15–25), pied→frappe 0,19–0,30 m, surface concordante. Balance de jeu inchangée (final8 : 8,1).

## La couche de geste (gesture-layer.js)

**Loi : un geste ne se joue pas en delta — il possède ses os, absolument.**

    pose(os, t) = slerp( base_sous-jacente , q_rest(os) ⊗ q_spec(0)⁻¹ ⊗ q_spec(t) , poids(membre) )

- À poids 1, la pose affichée est PAR CONSTRUCTION celle que le banc FK valide — la clause reine
  du contrat : quatre bases très différentes (repos, rest, retarget tordu, course) donnent la
  même pose au contact, écart 0,0000°.
- Le rest vient du TEMPLATE de squad.js — jamais animé, donc jamais contaminé. Un rest pris sur
  un squelette posé est un sabotage nommé du banc.
- L'horloge est `act.t` (la sim) : un seul instant, un seul contrat — le clip n'a plus d'horloge
  qui puisse dériver. Les poids restent les lois de composition existantes (bras tout de suite,
  jambes fondues par l'arrivée mesurée) : la couche ne décide pas QUAND le geste a les membres,
  seulement CE QUE les membres montrent.
- Ordre du rendu (charte, loi 2) : mixer (locomotion) → gaitLayer → **couche de geste** →
  **warp de frappe** → verrous. Les contraintes du monde se projettent en dernier.

## Le warp de frappe (strike-warp.js)

Quatre lois, chacune avec sa clause et son sabotage :

1. **Le contact appartient au clip.** L'enveloppe vaut 1 pile au contact avec pente NULLE des
   deux côtés (smoothstep C¹) : le warp corrige la position, jamais la vitesse — la vitesse au
   contact est celle que le banc a prouvée. Vérifié composé : 11,95 / 12,08 m/s pour un clip à
   12 exactement.
2. **Borné, refus nommés.** Offset ≤ warpMax (0,4 m) ; au-delà : écrêté ET versé au registre
   (`warp-hors-borne`). Le registre plein signale un bug EN AMONT (stance, clip, lacet) — c'est
   ainsi que les étapes 3–6 de la chasse ont été trouvées.
3. **La surface s'arrête à la surface.** La cible est au standoff (0,18 m) du centre du ballon,
   du côté d'où le pied arrive — un pied warpe VERS le ballon, pas dedans. Planaire : la hauteur
   reste au clip.
4. **Après le tir, on rend la jambe.** Offset GELÉ à l'instant du tir (on ne chasse pas un ballon
   en vol), descente C¹ vers l'accompagnement authoré.

L'application IK réutilise les primitives de foot-lock (`twoBoneIK` + `aimChildAt` exporté) — une
seule façon de poser une jambe dans ce moteur.

## Les leçons portables (n'importe quel jeu de foot, n'importe quel rig)

- **Les signes articulaires se sondent, jamais ne se croient** : une rotation à la fois, FK nue,
  lire le déplacement. Dix minutes qui auraient économisé quatre sessions.
- **Toute clause en amplitude est aveugle à la direction.** Vitesse, hauteur, excursion, angle de
  surface : tout était vert pendant que les passes partaient à l'envers. Il faut au moins une
  clause SIGNÉE par geste (v_avant ≥ 60 % de v_contact ; la talonnade ≤ −60 %).
- **Une table écrite à la main ment tôt ou tard** : stance, point de contact, repère — tout ce qui
  peut se dériver du clip ou se mesurer en ligne doit l'être, avec une clause de concordance.
- **Le visuel copie la sim, il ne la ré-invente pas** : position ET lacet. Deux autorités sur un
  même degré de liberté divergent toujours, et la divergence choisit le pire moment.
