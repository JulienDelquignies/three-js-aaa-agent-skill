# Carte du C++ de Gameplay Football : quatre correctifs pour le cerveau externe (lot L2)

> Lecture seule, 2 octobre 2026. Sources lues : `~/DelkIT/skill-l2/gpf-wasm/upstream/src` (arbre déjà patché par `patch.py`), `api/`, `build.sh`, `patch.py`, les `.anim`, et pour le contexte `cerveau.mjs`, `README.md` et les sondes de `scratchpad/l2`. Je n'ai rien compilé ni exécuté.
> Les numéros de ligne sont ceux de l'arbre patché. Les chemins sans préfixe sont relatifs à `upstream/src`.
> Je marque **« estimé »** les chiffres que j'ai calculés à la main depuis les constantes du code, et **« non vérifié »** ce qu'il faut confirmer par une sonde.

---

## 0. Ce que les quatre correctifs ont en commun

### Le trajet d'une commande

1. **Construction de la file.** `ElizaController::RequestCommand` (`onthepitch/player/controller/elizacontroller.cpp:40-534`) bâtit une file **neuve** à chaque appel. L'ordre est le suivant : l'action (passe ou tir), puis `_BallControlCommand`, `_TrapCommand`, `_InterfereCommand`, `_SlidingCommand` (401-416), et enfin le mouvement (419-533).
2. **Moment où la file est demandée.** `Humanoid::Process` (`onthepitch/player/humanoid/humanoid.cpp:216-264`) ne la demande qu'à une interruption :
   - la fin d'une animation (`Switch`, 116-120) ;
   - un créneau de re-file (`ReQueue`, 144-214). Ce créneau revient toutes les 20 ms pour le porteur désigné à moins de 3 m du ballon (153-154), et toutes les 30, 40, 50 ou 80 ms pour les autres.
3. **Choix de la commande.** Process essaie les commandes dans l'ordre. La première pour laquelle `SelectAnim` (1110-1637) trouve une animation l'emporte.
4. **Le contact.** Au `touchFrame`, le geste frappe le ballon (359-622) : la passe en 430-515, le tir en 517-547.

### Les canaux libres, sans toucher aux en-têtes du moteur

**Pourquoi ces canaux.** `build.sh:16` ne recompile un `.cpp` que s'il est plus récent que son `.o` ; il ne suit pas les en-têtes. Ajouter un champ à `TouchInfo` ou à `PlayerCommand` (`gamedefines.hpp:134-238`, inclus partout) changerait leur disposition mémoire sans recompiler les 109 objets de `build/obj`. Le résultat serait une corruption silencieuse.

La variante « propre » (un champ dédié) impose donc `rm -rf build/obj` et une reconstruction complète. Ce rapport s'en passe : il passe par trois canaux déjà présents.

- **`PlayerCommand::modifier`** (`gamedefines.hpp:216`).
  - Le moteur n'en lit que le bit 1 (`KnockOn`), et seulement aux touches d'amorti ou de contrôle (`humanoid.cpp:344, 397, 416`).
  - Il ne le pose jamais sur une passe ou un tir (`playercontroller.cpp:377, 452`).
  - Les bits 8 et suivants sont donc libres pour les commandes du cerveau.
- **`touchInfo.autoPowerBias` pour un tir.**
  - Il n'est jamais lu : ni par `GetShotVector`, ni par la branche tir (`humanoid.cpp:517-547`).
  - Il vaut 0 dans tous les tirs du moteur : `elizacontroller.cpp:1021-1037` (IA), 146-158 (penalty), 1082 (dégagement de panique, posé à 0), et `humancontroller.cpp:219-230`.
- **`touchInfo.inputPower` pour une passe à destinataire imposé.**
  - Il est sans effet : `AI_GetPass` force les deux biais à 1 quand `forcedTargetPlayer` est posé (`AIfunctions.cpp:1121-1124`).
  - `inputDirection` est nul dans `_AddPass` (`elizacontroller.cpp:1056`).

Les déclarations de fonctions **non virtuelles** ajoutées à `elizacontroller.hpp`, comme les `_Gf*` actuels, ne changent ni la disposition ni la vtable : le risque pratique est nul. Je propose malgré tout des **fonctions libres** déclarées dans `api/intents.hpp`, notre en-tête.

### La garde au bit près

- **Le principe.** Chaque comportement neuf est conditionné par un bit ou par une table que seuls `_GfOnBall`, ou une nouvelle API, peuvent remplir. Avec le moteur seul, ou avec les intentions actives mais sans intention posée, ces marques n'existent pas. Aucun tirage `boostrandom` n'est ajouté ni retiré sur le chemin par défaut.
- **L'exception.** `HumanoidBase::ResetPosition` tire au sort (`humanoidbase.cpp:852-853`). On ne l'appelle donc que sur demande explicite.
- **Le piège côté cerveau.** Le cerveau actuel pose une intention pour **chaque** joueur de champ à chaque tick, y compris pendant les arrêts (`cerveau.mjs:258-296`). Les crochets de coups de pied arrêtés doivent donc être **armés par un drapeau explicite**, sinon les bancs actuels changeraient de comportement.

### Les repères de coordonnées

| Contexte | Repère |
|---|---|
| Traitement d'une équipe (`RequestCommand`, `Humanoid::Process`) | l'équipe 2 est en miroir (`intents.cpp:72-76`, `match.cpp:887-891`) |
| Arbitre (`Referee::Process`, donc `PrepareSetPiece` et `TeamAIController::PrepareSetPiece`) | `Mirror(reverse, !reverse, reverse)` (`match.cpp:853, 863`) : **le monde** si `reverse_team_processing` est faux (graine paire, `gf_api.cpp:78`), **tout en miroir** sinon. Non vérifié par une sonde. |
| Au repos, depuis l'API (`gf_frame`) | l'équipe 2 est stockée en miroir (`gf_api.cpp:112`), le ballon est dans le repère du monde |

---

## 1. La hauteur du tir

### Où

- `humanoid.cpp:517-547` : la branche « tir » du contact. Elle appelle `GetShotVector` en 540.
- `onthepitch/player/humanoid/humanoid_utils.cpp:377-530` : `GetShotVector`.
  - 426-441 : la puissance.
  - 447-466 : la difficulté.
  - **470-471 : le tir idéal.**
  - 475-493 : le pire cas.
  - 497-502 : le mélange des deux.
  - 511-525 : les rotations.
- `onthepitch/ball.cpp` :
  - 29-35 : les constantes ;
  - 184-192 : la gravité et la traînée ;
  - 504-522 : l'effet Magnus.
- `api/intents.cpp:112-130` : notre `GF_SHOOT`. Il pose seulement `desiredDirection` (2D), `inputDirection`, `autoDirectionBias = 1` et `desiredPower` (bornée à 0,3-1).

### Comment ça marche aujourd'hui

**La direction recalculée au contact ne sert à rien.** La branche tir recalcule `ballDirection` via `AI_GetShotDirection` (`humanoid.cpp:521-535`), mais ne l'utilise plus ensuite. `GetShotVector` lit directement `currentAnim.originatingCommand.touchInfo.desiredDirection`.

**La vitesse de la frappe.**
- La puissance demandée devient `45·(0,7 + 0,3·√desiredPower)`, soit 31,5 à 45 m/s.
- Elle est multipliée par un `powerFactor` inférieur ou égal à 1. Ce facteur dépend de l'angle de la touche, de la vitesse du tireur et du décalage de position.
- Elle est ensuite plafonnée à `(32 + 13·physical_shotpower)·(0,2 + 0,8·touch_maxpowerfactor)`.
- Enfin, elle est multipliée par `1 + 0,2·|mouvement du joueur − ballon|/10` (426-441).

**La composante verticale** vient de cinq sources :

```cpp
float desiredHeight = 0.05f;                                                    // humanoid_utils.cpp:470
Vector3 desiredShot = (…desiredDirection.Get2D() + Vector3(0, 0, desiredHeight)).GetNormalized() * power;
…
worstCaseDirection = worstCaseDirection + (Vector3(boostrandom(-1, 1), boostrandom(-1, 1), boostrandom(-1, 1)) * 0.5f * difficultyFactor);
float worstCaseHeight = curve(std::pow(difficultyFactor, 0.7f), 0.7f) * 0.7f;   // :488
…
float worstCaseFactor = boostrandom(0.0f, 1.0f);
worstCaseFactor = std::pow(worstCaseFactor, player->GetStat(technical_shot) * 0.7f);
Vector3 shot = desiredShot * (1.0f - worstCaseFactor) + worstCaseShot * worstCaseFactor;   // :501
```

1. **Le tir idéal monte à atan(0,05) = 2,9°, toujours.** Ni la puissance, ni l'animation, ni les stats n'y changent rien.
2. **Le « pire cas » monte jusqu'à atan(0,7) = 35°**, avec en plus un bruit vertical de ±0,5 × la difficulté dans la direction. La difficulté (447-466) dépend :
   - de l'écart entre la touche et la visée (l'idéal est à 36°) ;
   - de la vitesse du tireur comparée à 3,5 m/s ;
   - du décalage de position ;
   - du mouvement relatif entre le ballon et le joueur, pondéré par `technical_volley` ;
   - de la puissance au-delà de 30 m/s.
3. **Le mélange pèse w = U^(0,7·technical_shot)** (U tiré uniformément entre 0 et 1). En moyenne, w vaut 1/(1 + 0,7·shot) : **0,59 pour un tireur noté 1,0, 0,83 pour un tireur noté 0,3**. La hauteur réelle vient donc surtout de l'erreur.
4. **L'effet Magnus.** Le tir impose une rotation `xRot`/`yRot = −dir·20 ± bruit` (511-516), appliquée à 70 % (`SetRotation(…, 0.7)`, `ball.cpp:120-130`). Cette rotation autour d'un axe horizontal donne une force verticale pendant le vol (`ball.cpp:504-522`, `swerve = vitesse × (−rotation)`).
   - Estimé : une portance (un effet rétro) de 0 à environ 7 m/s² à 30-45 m/s, selon la rotation que le ballon avait déjà et selon le bruit.
   - Le signe est déduit de la formule ; il n'est pas vérifié (convention de `GetAngles`).
5. **Le contact imparfait.** `bumpyRideBias` (`humanoid.cpp:376-379, 542`) mélange le tir avec le vecteur du ballon entrant, hauteur comprise, quand le contact n'est pas parfait.

**Conséquence.** C'est ce que dit `README.md:266` : « Le corps ne pilote pas la hauteur ». Le cerveau tire pourtant déjà une hauteur à la ligne de but, `yArr` (`cerveau.mjs:498-502` : ras de terre 0,35 m, mi-hauteur 1,0 m, lucarne 1,95 m).

### Le correctif minimal

**Le choix.** Demander la **hauteur à la ligne de but**, c'est-à-dire ce que le cerveau calcule déjà. Le corps la résout **au contact**, avec sa vraie `power` (calculée juste au-dessus, en 435-441) et la physique du ballon de `ball.cpp` (gravité −9,81 ; traînée 0,015·v² ; pas de 10 ms). Le Magnus n'est pas modélisé. L'erreur du corps, le pire cas, reste intacte.

**Le contrat.** Dans `GF_SHOOT`, `speed` porte la hauteur visée à la ligne, en mètres ; 0 laisse faire le moteur. Ce champ est ignoré aujourd'hui pour un tir, et le cerveau l'envoie à 0.

```python
# patch.py — 10. LA HAUTEUR DU TIR : la hauteur visée par le cerveau remplace les 0,05 (2,9°) du tir idéal ; le pire cas
#    du corps reste le sien. Sans la marque GF_MOD_HAUTEUR (posée par _GfOnBall seulement), desiredHeight vaut 0,05 : au bit près.
ensure_top('onthepitch/player/humanoid/humanoid_utils.cpp', '#include "intents.hpp"')
sub('onthepitch/player/humanoid/humanoid_utils.cpp',
    '  float desiredHeight = 0.05f;\n',
    '  float desiredHeight = gf_hauteur_tir(match, player, currentAnim.originatingCommand, power, 0.05f);  // [gf-intent] la hauteur visée\n')
```

```cpp
// api/intents.hpp
namespace blunted { class Vector3; }  class Match; class Player; class Team; class AnimCollection; struct PlayerCommand;
enum { GF_MOD_SANS_TALON = 1 << 8, GF_MOD_AU_PIED = 1 << 9, GF_MOD_HAUTEUR = 1 << 10 };   // PlayerCommand::modifier
float gf_hauteur_tir(Match *m, Player *tireur, const PlayerCommand &c, float power, float defaut);

// api/intents.cpp — dans _GfOnBall, branche GF_SHOOT, avant le push_back :
if (gi->speed > 0.0f) { command.modifier |= GF_MOD_HAUTEUR; command.touchInfo.autoPowerBias = gi->speed; }

// la hauteur à la ligne pour une tangente d'élévation, avec la physique de ball.cpp (sans Magnus ni rebond)
static float hauteurALaLigne(float v0, float t, float d, float z0) {
  float n = sqrtf(1 + t * t), vx = v0 / n, vz = v0 * t / n, x = 0, z = z0;
  for (int i = 0; i < 300 && x < d; i++) {
    vz -= 9.81f * 0.01f;
    float v = sqrtf(vx * vx + vz * vz), k = v > 0 ? 1 - 0.015f * v * 0.01f : 1;
    vx *= k; vz *= k; x += vx * 0.01f; z += vz * 0.01f;
    if (z < 0.11f) return 0.11f;                       // retombé avant la ligne
  }
  return z;
}
float gf_hauteur_tir(Match *m, Player *p, const PlayerCommand &c, float power, float defaut) {
  if (!(c.modifier & GF_MOD_HAUTEUR)) return defaut;
  Vector3 b = m->GetBall()->Predict(0), dir = c.touchInfo.desiredDirection.Get2D().GetNormalized(0);
  float butX = -p->GetTeam()->GetDynamicSide() * pitchHalfW;              // repère de l'équipe (traitement en cours)
  if (fabsf(dir.coords[0]) < 0.1f) return defaut;
  float d = (butX - b.coords[0]) / dir.coords[0];  if (d < 1.0f) return defaut;
  float lo = -0.1f, hi = 0.8f;                                            // −6° … 39°
  for (int i = 0; i < 16; i++) { float t = 0.5f * (lo + hi); (hauteurALaLigne(power, t, d, b.coords[2]) < c.touchInfo.autoPowerBias ? lo : hi) = t; }
  return 0.5f * (lo + hi);
}
```

Variante plus courte : passer directement la tangente d'élévation (`desiredHeight = autoPowerBias`), sans solveur. Ce sont deux lignes de moteur, mais le cerveau devra alors estimer lui-même la vitesse de frappe du corps.

### Risques

- **Garde.** La marque n'est posée que par `_GfOnBall`, quand `speed > 0`. Les autres tirs gardent 0,05, y compris le dégagement de panique, qui passe aussi par `GetShotVector` (`elizacontroller.cpp:1089-1092`). Aucun tirage n'est ajouté. **Sûr.**
- **La hauteur réelle reste bruitée.** Le mélange avec le pire cas (point 3) et le bruit vertical demeurent. C'est voulu : c'est l'erreur du corps. Il faut un **banc d'étalonnage** qui compare la hauteur demandée à la hauteur relevée au franchissement de la ligne (z du ballon dans `gf_frame`), avec des graines fixes.
- **Le Magnus n'est pas modélisé.** Il introduit un biais probable vers le haut ; un terme correctif pourra être ajusté sur le banc.
- **Le plancher de vitesse** (31,5 m/s × facteurs) interdit le lob. Une grande hauteur donne une frappe puissante au-dessus de la barre, jamais une balle piquée. Le lob demanderait un second canal de vitesse ; il est hors du correctif minimal.
- **Coup franc direct.** Passer le mur exige une contrainte à 9,15 m en plus de celle de la ligne ; ce correctif ne la gère pas.

### Effort

- **Moteur :** une substitution dans `patch.py` (l'inclusion, puis une ligne).
- **Notre code :** environ 35 lignes dans `intents.cpp`, environ 4 dans `intents.hpp`, plus la documentation du contrat (`contrat.mjs` : TIRER.vitesse = hauteur à la ligne).
- **Recompilation incrémentale :** `humanoid_utils.cpp` et `intents.cpp`, puis l'édition de liens.

---

## 2. La passe en retrait au gardien

### Où

**La passe**
- `elizacontroller.cpp:1047-1062` : `_AddPass`, appelée par notre `_GfOnBall` (`intents.cpp:105-111`).
- `onthepitch/AIsupport/AIfunctions.cpp` :
  - 1001-1017 : `AI_GetAutoPass` ;
  - 1019-1171 : `AI_GetPass`. Le destinataire imposé est traité en 1068-1079.
- `humanoid.cpp` :
  - 430-515 : la passe au contact. L'affinage par `AI_GetPass` est en 449-473, `touchVec` en 480, `GetBestPossibleTouch` en 486.
  - 2233-2303 : `GetBestPossibleTouch`.
- `humanoid_utils.cpp:154-218` : `GetDifficultyFactors`.
- Les variables des animations `pass/**` (`touch_maxpowerfactor`, `touch_difficultyfactor`).

**Le gardien**
- `elizacontroller.cpp:354-379` : la branche « gardien ». Son mouvement est en 419 puis 522-533.
- `onthepitch/player/controller/strategies/offtheball/goalie_default.cpp` :
  - 25-235 : `RequestInput`, dont l'interception en 190-229 ;
  - 237-300 : `CalculateIfBallIsBoundForGoal`.
- `onthepitch/player/controller/playercontroller.cpp` :
  - 299-323 : `_KeeperDeflectCommand`, qui porte **la règle de la passe en retrait** en 306-307 ;
  - 343-411 : `_BallControlCommand` ;
  - 413-460 : `_TrapCommand`, avec son cas gardien en 437-442.
- `elizacontroller.cpp:947-974` : la panique (le gardien en 968-972).
- `humanoid.cpp:232-246` et 2014-2019 : `preferPassAndShot`.

**L'arbitre.** `referee.cpp`, lu en entier, n'a **aucune** règle de passe en retrait : pas de coup franc indirect. La règle n'existe qu'en `playercontroller.cpp:306-307`.

### Comment ça marche aujourd'hui

#### (a) Pourquoi la passe part à 29 m/s et décolle

**La formule de puissance.**

```cpp
float heightOffset = 0.11f; float powerFactor = 1.8f; float distanceExp = 1.4f;        // AIfunctions.cpp:1004-1006
resultingDirection = (vector.GetNormalized(0) + Vector3(0, 0, heightOffset)).GetNormalized(0);
resultingPower = std::pow(NormalizedClamp(vector.GetLength(), 0.0f, 60.0f), distanceExp) * powerFactor;
…
Vector3 touchVec = ballDirection * 36 * (ballPower + 0.3f);                              // humanoid.cpp:480
```

- À 24 m, la puissance vaut (24/60)^1,4 × 1,8 = **0,499**. La passe part donc à 36 × 0,8 = **28,8 m/s**, inclinée de **6,3°**. La vitesse verticale est de 3,15 m/s et le sommet du vol est à environ 0,6 m (centre du ballon).
- Ce n'est pas propre au gardien : **toute passe courte de 24 m du moteur part à 29 m/s**. Le terme `+0,3` impose un plancher de 10,8 m/s.
- **C'est la logique du moteur.** Au sol, le ballon freine selon dv/dt = −(0,055·v² + 1,6) (traînée 0,015·v² plus frottement 0,04·v² + 1,6 ; `ball.cpp:189-192, 219-237`). La passe vole donc les 15-16 premiers mètres, où seule la traînée de l'air agit. Elle arrive ensuite **chaude**, autour de 18-20 m/s au gardien (estimé), en rebondissant.

**`GetBestPossibleTouch` ajoute encore de la hauteur.** Extrait condensé de `humanoid.cpp:2236-2300`, que j'ai réécrit en pseudo-C++ :

```cpp
float maxPower = maxPowerBase * maxPowerFactor * (1 - clamp(offset * 2.5, 0, 0.25));   // 30 × (0,3 + 0,7·touch_maxpowerfactor)
maxPower += ball->GetMovement().GetLength() * 0.5f;                                      // le ballon entrant relève le plafond
if (|touch| > maxPower) { touch = touch.Normalized * maxPower; touch.z += clamp(manque, 0, 10) * 0.25f; }   // le trop part en l'air
…
resultTouch.coords[2] += distanceFactor * 1.5f;                                          // ballon loin du corps
resultTouch.coords[2] += ball.vz * heightFactor * 0.5f + heightFactor * 1.0f;            // ballon rapide, poussé, adversaire
resultTouch.coords[2] += difficultyFactor * 5.0f * boostrandom(0.2f, 1.0f);              // touch_difficultyfactor × (1 − 0,5·shortpass)
```

Les gestes de passe vers l'arrière sont faibles et difficiles :

| Geste | Départ du ballon | Plafond (30 × (0,3 + 0,7·f)) | `touch_difficultyfactor` |
|---|---|---|---|
| `pass/idle/180` (talonnade) | 180° ± 45° | 17,4 m/s | 0,4 |
| `pass/sprint/180` (talonnade) | 180° ± 45° | 15,3 m/s | 0,7 |
| `pass/dribble/180_turn` | 180° ± 23° | 19,5 m/s | 0,6 |
| `pass/walk/135` | 135° ± 23° | 21,6 m/s | 0,4 |
| `pass/walk/000`, `pass/sprint/000` | 22,5° ± 23° | 30 m/s | 0,0 |

**Ce qui fait monter la passe à 2 m.** Il faut une vitesse verticale de 6 à 7 m/s (estimé, en tenant compte de la traînée). L'inclinaison de 0,11 n'en donne que 3,2. Deux scénarios ajoutent le reste :

- **Geste vers l'arrière.** Le plafond déborde (jusqu'à +2,5 m/s vers le haut) et la difficulté s'ajoute (jusqu'à +2 à +3,5 m/s). Mais la passe partirait alors à moins de 22 m/s, sauf si **un ballon entrant rapide relève le plafond** (+0,5 × sa vitesse).
- **Geste vers l'avant** avec des facteurs de difficulté au maximum : ballon reçu vite et loin du corps.

Les deux scénarios désignent la **passe en retrait jouée en une touche**, que le cerveau pratique (`uneTouche`). Ce point n'est pas vérifié : `GF_EV_PASS` journalise la norme du vecteur, mais ni sa composante verticale ni le geste joué.

#### (b) Le gardien

**Il est planté.**
- Une passe adressée à un gardien placé devant son but coupe la ligne de but entre les poteaux. `CalculateIfBallIsBoundForGoal` y voit alors un tir (`goalie_default.cpp:248-298`), d'où `manualMovement = true` (`elizacontroller.cpp:360`).
- La stratégie passe en **mode interception** (190-229). La cible est le point de la droite ballon-but le plus proche du gardien. Il y est déjà, donc **il ne bouge pas vers le ballon**.
- Si le ballon passe à plus de 2,5 m à sa hauteur, il recule vers sa ligne (208-224).

**Il ne peut pas utiliser les mains.**

```cpp
// can't use hands if teammate intentionally kicked ball to us                         playercontroller.cpp:306-307
if (match->GetLastTouchTeamID() == team->GetID() && match->GetLastTouchPlayer() != CastPlayer() && match->GetLastTouchTeamID(e_TouchType_Intentional_Kicked) == team->GetID()) return;
```

Aucune commande `Deflect` (plongeon, prise) n'est donc émise.

**Il ne peut jouer que du pied, avec les animations génériques.**
- `_TrapCommand` : pour le gardien, la direction visée est le but adverse, à l'arrêt (437-442). L'amorti doit trouver une animation `trap/**` à ±0,22 m de la hauteur du ballon (`humanoid.cpp:1938-1950`). Les « highballs » s'arrêtent à la poitrine, vers 1,3 m. **Un ballon à 2 m n'a aucun geste.**
- `_BallControlCommand` est exclu si la vitesse relative ballon-joueur dépasse 15 m/s (`playercontroller.cpp:352-357`). C'est le cas d'une passe chaude.
- `_InterfereCommand` est exclu, puisque l'équipe du gardien a la meilleure possession (468).

**Il panique avant d'avoir le ballon.**
- Désigné et à moins d'1 s du ballon, il appelle `GetOnTheBallCommands` **avant** de le posséder (`elizacontroller.cpp:374-378`).
- Son état d'esprit vaut 0, donc dès que `possessionAmount < 3`, `_AddPanicPass` place en tête de file [passe haute, tir, passe longue] (968-972).
- Ces commandes mettent `preferPassAndShot = true` (`humanoid.cpp:238-245`). Le rayon de triche de l'**amorti** placé derrière elles tombe alors **×0,3** (2014-2019).
- **Hypothèse forte, non vérifiée.** La sonde `scratchpad/l2/sonde-retrait.mjs` trace déjà le geste du gardien toutes les 30 ms :
  - s'il n'affiche jamais AMORTI ni CTRL avant le but, l'hypothèse est confirmée ;
  - s'il affiche P.HAUTE ou TIR, le gardien a tenté un dégagement en une touche.

**Jouer le ballon ensuite.** Une fois le ballon au pied (`AI_HasPossession` : à moins d'1 m, hauteur au plus 0,5 m, vitesse relative au plus 6 m/s, `AIfunctions.cpp:843-864`), la même branche gardien appelle `GetOnTheBallCommands`. Selon la situation, il dégage s'il est pressé, sert le meilleur partenaire ou conduit. `_GfOnBall` n'est pas appelé pour un gardien.

### Le correctif minimal

**Étape 0, avant tout : mesurer.**
- Ajouter un événement au contact de la passe (`humanoid.cpp:510`, à côté de `GF_EV_PASS`) : `GF_EV_PASSE2 = 7`, avec a = `touchVec.coords[2]`, b = `currentAnim.id`, c = `bumpyRideBias`.
- Ajouter un accesseur `gf_anim_nom(id)` dans `gf_api.cpp` : `GetContext().anims->GetAnim(id)->GetName()`.
- Lancer `sonde-retrait.mjs`. On saura quel geste fait décoller la passe et ce que tente le gardien. C'est environ 10 lignes, et cela sert aussi au point 3.

**(a) La passe « au pied ».** Elle part au sol, dosée par le cerveau et jouée face au gardien. Le contrat de `GF_PASS` devient :
- bits 0-1 : le genre (0 courte, 1 longue, 2 haute) ;
- **bit 3 (valeur 8) : « au pied »** ;
- `speed` : la vitesse de départ en m/s (0 garde la vitesse horizontale du moteur).

```cpp
// intents.cpp, _GfOnBall branche GF_PASS, après _AddPass(...) :
if (gi->flags & 8) { commandQueue.back().modifier |= GF_MOD_AU_PIED; commandQueue.back().touchInfo.inputPower = gi->speed; }
```

```python
# patch.py — 11. LA PASSE AU PIED (après le calcul de touchVec, avant GetBestPossibleTouch : le plafond et l'erreur du corps restent)
sub('onthepitch/player/humanoid/humanoid.cpp',
    '        float zcurve = 0.0f;\n        Vector3 touchVec = ballDirection * 36 * (ballPower + 0.3f);\n',
    '        float zcurve = 0.0f;\n        Vector3 touchVec = ballDirection * 36 * (ballPower + 0.3f);\n'
    '        gf_passe_au_pied(CastPlayer(), currentAnim.originatingCommand, targetPlayer, touchVec);  // [gf-intent] la passe au sol, dosée\n')
```

```cpp
// intents.cpp
static struct { int gardien = -1, passeur = -1; unsigned long t = 0; } g_auPied;   // la passe au pied en vol vers un gardien
void gf_passe_au_pied(Player *passeur, const PlayerCommand &c, Player *cible, Vector3 &touchVec) {
  if (!(c.modifier & GF_MOD_AU_PIED)) return;
  Vector3 h = touchVec.Get2D();
  touchVec = h.GetNormalized(0) * (c.touchInfo.inputPower > 0 ? c.touchInfo.inputPower : h.GetLength());   // sans les 6,3°
  if (cible && cible->GetFormationEntry().role == e_PlayerRole_GK)
    g_auPied = { cible->GetStableID(), passeur->GetStableID(), GetGameTask()->GetMatch()->GetActualTime_ms() };
}
```

Les passes « au pied » doivent aussi **exclure les gestes vers l'arrière**, quand le ballon part à plus de 90°, c'est-à-dire `balldirection.y > 0` dans le repère de l'animation. Le passeur se tourne alors d'abord, puis joue un geste fort (plafond de 24 à 30 m/s), sans débordement vers le haut. Le crochet est celui du point 3, au même endroit.

Vitesses d'arrivée d'une passe au sol, **estimées** depuis dv/dt = −(0,055·v² + 1,6), sans le couplage rotation-sol de `ball.cpp:429-502` :

| Départ | Arrivée |
|---|---|
| 20 m/s | ≈ 7 m/s à 15 m |
| 30 m/s | ≈ 8,6 m/s à 20 m |
| 28,8 m/s | ≈ 5,7 m/s à 24 m, en ≈ 1,9 s |
| 30 m/s | ≈ 2,3 m/s à 30 m |

Le sol tue les ballons rapides. Les passes au pied ont donc du sens jusqu'à environ 20-22 m. **À mesurer** avant de fixer une table v0(distance) dans le cerveau.

**(b) Le gardien va au ballon et contrôle avant de décider.** Le comportement n'est armé que par une passe marquée « au pied » en vol vers lui, et seulement tant que personne d'autre n'a touché le ballon.

```cpp
// intents.cpp
bool gf_gardien_recoit(Player *g) {
  if (g_auPied.gardien != g->GetStableID() || g->HasPossession()) return false;
  Match *m = GetGameTask()->GetMatch(); Player *dernier = m->GetLastTouchPlayer();
  return dernier && dernier->GetStableID() == g_auPied.passeur && m->GetActualTime_ms() - g_auPied.t < 5000;
}
```

```python
# patch.py — 12. LE GARDIEN QUI REÇOIT LA PASSE AU PIED : il va au ballon (aimant), et ne décide qu'après l'avoir contrôlé
sub('onthepitch/player/controller/elizacontroller.cpp',
    '    if (CastPlayer() != match->GetDesignatedPossessionPlayer()) manualMovement = true;\n',
    '    if (CastPlayer() != match->GetDesignatedPossessionPlayer()) manualMovement = true;\n'
    '    if (gf_gardien_recoit(CastPlayer())) manualMovement = false;  // [gf-intent] pas d\'interception : aller au ballon\n')
sub('onthepitch/player/controller/elizacontroller.cpp',
    '    if (CastPlayer()->GetTimeNeededToGetToBall_ms() < 1000 &&\n        match->GetDesignatedPossessionPlayer() == player) {',
    '    if (CastPlayer()->GetTimeNeededToGetToBall_ms() < 1000 &&\n        match->GetDesignatedPossessionPlayer() == player &&\n'
    '        (hasPossession || !gf_gardien_recoit(CastPlayer()))) {  // [gf-intent] contrôler avant de décider (pas de panique, pas de rayon ×0,3)')
sub('onthepitch/player/controller/elizacontroller.cpp',
    '  _SetInput(rawInputDirection, rawInputVelocityFloat);\n',
    '  if (gf_gardien_recoit(CastPlayer())) forceMagnet = true;  // [gf-intent] le gardien va au ballon\n'
    '  _SetInput(rawInputDirection, rawInputVelocityFloat);\n')
```

Les trois ancres sont uniques dans le fichier (`elizacontroller.cpp:361, 374-375, 396`).

L'effet attendu :
- `manualMovement = false` mène à `_MovementCommand`, et `forceMagnet` à `AI_GetToBallMovement` avec hâte : le gardien sort au-devant du ballon.
- L'amorti (`_TrapCommand`, face au but adverse) et le contrôle n'ont plus de commande de passe ou de tir devant eux, donc `preferPassAndShot` reste faux.
- Une fois en possession, `GetOnTheBallCommands` joue le ballon comme aujourd'hui.

### Risques

- **Garde.** La marque et la mémoire de la passe en vol ne naissent que d'une passe du cerveau marquée « au pied ». Sans elle, `gf_gardien_recoit` est toujours faux. Pas de tirage. **Sûr.**
- **Une passe au sol est plus lente** (environ 1,9 s pour 24 m, contre 1,05 s pour la passe en l'air), donc plus facile à intercepter. En sortant, le gardien quitte son but.
- **`GetBestPossibleTouch` agit toujours.** Si v0 dépasse le plafond du geste, le surplus monte à raison de 0,25 m/s vers le haut par m/s de trop. Il ajoute aussi la hauteur liée à la difficulté. Une passe en une touche reste donc dangereuse, et le cerveau doit **contrôler avant** une passe au gardien.
- **Hypothèses à lever par l'étape 0** : l'effet de `preferPassAndShot`, le geste qui fait décoller la passe, et le comportement du ballon au sol (couplage de la rotation).
- **Côté cerveau.** La ligne vers les gardiens est fermée (`st.laneVeto`). Il ne faut la rouvrir qu'avec le drapeau 8, après mesure.

### Effort

- **(a)** : une substitution dans `humanoid.cpp`, plus le filtre partagé avec le point 3 ; environ 30 lignes dans `intents.cpp`.
- **(b)** : trois substitutions dans `elizacontroller.cpp` ; environ 15 lignes dans `intents.cpp`.
- **Étape 0** : une substitution et une fonction d'API.
- **Recompilation incrémentale :** `humanoid.cpp`, `elizacontroller.cpp`, `intents.cpp`, `gf_api.cpp`, puis l'édition de liens. `humanoid.cpp` (2 300 lignes en `-O3`) est le plus long à compiler ; durée non mesurée.

---

## 3. Les talonnades

### Où

- `humanoid.cpp:1110-1637` : `SelectAnim`.
  - 1229-1344 : la requête, dont **1243-1247 la direction de départ du ballon** et 1249-1279 les vitesses.
  - **1346-1355** : `CrudeSelection`, puis l'échec si le résultat est vide.
  - 1466-1507 : les tris.
  - 1548-1554 : la recherche de l'animation qui atteint le ballon.
  - 1636 : l'échec.
- `onthepitch/player/humanoid/animcollection.cpp:503-848` : `CrudeSelection`.
  - 526-574 : la vitesse d'entrée ;
  - 636-642 : les gestes « dernière chance » (`lastditch`) ;
  - 646-743 : l'orientation du corps à l'entrée ;
  - **783-799 : la direction de départ du ballon** ;
  - 44-45 : la tolérance par défaut, 0,25π.
- `humanoid.cpp:1796-2153` : `GetBestCheatableAnimID`.
- `utils/animation.cpp` :
  - 1040 : le nom de l'animation est le chemin du fichier ;
  - 1155 : les animations en miroir reçoivent le suffixe `_mirror` ;
  - 1208-1213 : `balldirection` est mise en miroir.
- `humanoid.cpp:216-264` (la boucle des commandes) et 144-214 (la re-file).

### Comment ça marche aujourd'hui

**La requête** (`SelectAnim`).
- Elle filtre le type de geste. La passe longue utilise les gestes de la passe courte (1241).
- Si `desiredPower ≠ 0`, elle filtre aussi la direction de départ du ballon :
  `query.outgoingBallDirection = command.touchInfo.desiredDirection.GetRotated2D(-spatialState.angle)` (1246).
- Cette direction est relative à **`spatialState.angle`** : la **direction de course** du joueur, ou son corps s'il est à l'arrêt (`humanoidbase.cpp:1369-1378`). **Ce n'est pas le regard** quand il court.

**Les catégories de vitesse** (`RangeVelocity`, `animcollection.hpp:42-48`) :

| Catégorie | Vitesse |
|---|---|
| arrêt | moins de 1,8 m/s |
| conduite | 1,8 à 4,2 m/s |
| marche | 4,2 à 6 m/s |
| sprint | 6 m/s et plus |

Pour une passe, la conduite est traitée comme la marche (1252). Les règles souples (`animcollection.cpp:531-563`) donnent :
- un joueur **à l'arrêt** n'a droit qu'aux gestes partant de l'arrêt ;
- un joueur en marche ou en sprint a droit à tous les gestes en mouvement, sprint compris.

**Le filtre de direction** (`animcollection.cpp:783-799`) garde un geste si l'angle entre la direction voulue et sa `balldirection` ne dépasse pas `outgoingballdirection_maxdeviation·π` (par défaut π/4).

**La couverture qui en résulte**, d'après les variables des fichiers `.anim` (les miroirs couvrent l'autre côté) :

| Vitesse d'entrée | Gestes disponibles | Plage couverte (depuis la direction de course) |
|---|---|---|
| arrêt | `idle/000`, `idle/090`, **`idle/180` (talonnade)** | 0-46°, 45-135°, **135-180° : la talonnade seule** |
| marche ou conduite | `walk/000`, `045`, `090`, `135`, `dribble/180_turn` et les gestes de sprint | jusqu'à 158° avec `135`, 157-180° avec `180_turn` **ou** `sprint/180` (talonnade) |
| sprint | `sprint/000`, `045`, `090`, **`sprint/180` (talonnade)**, puis les gestes de marche | `sprint/180` est **classé en premier** pour 135-180° |

**Le classement des candidats.** `SelectAnim` enchaîne des `stable_sort` ; le dernier tri est la clé principale. L'ordre est donc :
1. animation de base : aucune passe ne l'est ;
2. **vitesse d'entrée proche de la vitesse réelle** (1486) ;
3. orientation du corps à l'entrée ;
4. pied d'appui ;
5. niveau d'attente ;
6. priorité.

`GetBestCheatableAnimID` prend ensuite la **première** animation, dans cet ordre, qui atteint le ballon : dans le rayon de triche (×1,3 et +0,15 m pour une passe, 1993-2007) et à ±0,22 m en hauteur (1950). Il n'y a pas de score global.

**La mesure existante** (`scratchpad/l2/talon-*.txt`) : 6 % des passes du cerveau et 7-8 % des passes de l'IA du moteur partent à plus de 150° de la direction de course.

**Ce que fait le moteur quand aucun geste ne passe le filtre.**
1. `CrudeSelection` rend un ensemble vide, et `SelectAnim` renvoie `false` (1348-1355). Le même retour se produit quand des candidats existent mais qu'aucun n'atteint le ballon (1636).
2. La boucle de `Humanoid::Process` (233-247) passe à la **commande suivante de la même file**, ici `BallControl` puis `Movement`.
3. Pendant une re-file sans aucune animation trouvée, l'animation en cours continue.
4. À la fin d'une animation, le mouvement trouve toujours un geste (repli sur l'attente, 1350-1352). Le `exit(1)` des lignes 249-264 n'est donc pas atteignable.
5. **La commande de passe n'est pas mémorisée.** Elle est perdue pour cette interruption et **redemandée à la suivante** : le prochain créneau de re-file (20 ms pour le porteur, sous les conditions 186-206 et 1160-1220) ou la fin du geste en cours. Cela dure tant que l'intention `GF_PASS` est tenue. Il n'y a **ni geste de repli dans la catégorie « passe », ni abandon définitif**.
6. **Effet de bord à connaître.** `_GfOnBall` laisse `rawInputDirection` sur la direction du joueur et `rawInputVelocityFloat` à l'arrêt (`elizacontroller.cpp:59-60, 396`). En attendant la passe, le `BallControl` **freine le porteur jusqu'à l'arrêt** (`playercontroller.cpp:365-369`). Arrêté, il ne dispose plus que des gestes d'arrêt.

### Le correctif minimal

Le cerveau ne permet la talonnade qu'avec un drapeau. Le filtre retire les quatre animations, les deux talonnades et leurs miroirs, juste après `CrudeSelection`. Les passes du moteur ne sont pas touchées.

```cpp
// intents.cpp, _GfOnBall branche GF_PASS, après _AddPass(...) :
if (!(gi->flags & 4)) commandQueue.back().modifier |= GF_MOD_SANS_TALON;     // GF_PASS bit 2 (4) : talonnade permise
```

```python
# patch.py — 13. LE TALON SUR DEMANDE (et les gestes vers l'arrière refusés à la passe au pied, point 2)
sub('onthepitch/player/humanoid/humanoid.cpp',
    '  anims->CrudeSelection(dataSet, query);\n  if (dataSet.size() == 0) {',
    '  anims->CrudeSelection(dataSet, query);\n'
    '  gf_filtrer_passe(command, anims.get(), dataSet);  // [gf-intent] la talonnade et le geste vers l\'arrière, sur demande\n'
    '  if (dataSet.size() == 0) {')
```

L'ancre est unique : la même ligne `CrudeSelection` de `SelectRetainAnim` (1071) est suivie d'un `assert`, pas d'un `if`.

```cpp
// intents.cpp
static std::vector<char> g_talon;                        // par id d'animation : 1 pour pass/idle/180 et pass/sprint/180 (+ _mirror)
void gf_filtrer_passe(const PlayerCommand &c, AnimCollection *a, std::vector<int> &ds) {
  if (!(c.modifier & (GF_MOD_SANS_TALON | GF_MOD_AU_PIED))) return;
  if (g_talon.empty()) {
    g_talon.resize(a->GetAnimations().size());
    for (size_t i = 0; i < g_talon.size(); i++) { const std::string &n = a->GetAnim(i)->GetName();
      g_talon[i] = n.find("/pass/idle/180.anim") != std::string::npos || n.find("/pass/sprint/180.anim") != std::string::npos; }
  }
  ds.erase(std::remove_if(ds.begin(), ds.end(), [&](int id) {
    if ((c.modifier & GF_MOD_SANS_TALON) && g_talon[id]) return true;
    return (c.modifier & GF_MOD_AU_PIED) && GetVectorFromString(a->GetAnim(id)->GetVariable("balldirection")).coords[1] > 0.0f;  // > 90°
  }), ds.end());
}
```

Le `/` en tête du motif évite de toucher `highpass/…`. Le filtre se fonde sur le nom des fichiers et ne dépend pas de la géométrie des animations.

**Filet optionnel.** Si la talonnade est refusée, que le porteur est à l'arrêt et que la cible est à plus de 135°, `_GfOnBall` peut orienter `rawInputDirection` vers la cible à 3,5 m/s (vitesse de conduite). Le porteur se tourne alors avec le ballon au lieu de rester bloqué. Le cerveau le fait déjà au-delà de 100° du regard (`seTourner`, `cerveau.mjs:447-460, 526`).

### Risques

- **Garde.** La marque n'est posée que par `_GfOnBall`. **Sûr.**
- **Changement voulu pour les bancs actuels.** Les talonnades du cerveau disparaissent, sauf si `talonPermis` (`cerveau.mjs:521-523`) pose le bit 4 : il faut l'ajouter au contrat (`PASSE.TALON = 4`).
- **Porteur à l'arrêt, cible entre 135° et 180° :** aucun geste n'est possible, et le porteur attend jusqu'à ce que le cerveau le fasse tourner. Le filet optionnel lève ce blocage.
- **Porteur en sprint :** sans `sprint/180`, il doit passer par `walk/135` ou `dribble/180_turn`, moins bien classés et qui atteignent peut-être moins souvent le ballon. La passe peut donc être retardée.
- **À vérifier une fois :** compter les identifiants marqués. On en attend 4, avec le chemin `/data/media/animations/…` produit par `GetFiles` et `updatePath` (`cmake/file.cpp:62-66`).

### Effort

- **Moteur :** une substitution dans `humanoid.cpp`.
- **Notre code :** environ 25 lignes dans `intents.cpp`, 2 dans `_GfOnBall`, plus le contrat.
- **Recompilation incrémentale :** `humanoid.cpp` et `intents.cpp`. Le filtre est partagé avec le point 2(a).

---

## 4. Les coups de pied arrêtés

### Où

- `onthepitch/referee.cpp` :
  - 94-276 : `Process`. Les arrêts de jeu sont en 129-222. La préparation (avec `randomize(seed)` en 240) et le coup de sifflet sont en 228-251. La fin du coup de pied arrêté est en 254-273.
  - 278-304 : `PrepareSetPiece`, qui choisit le tireur et émet `GF_EV_SETPIECE` en 300-301.
- `onthepitch/teamAIcontroller.cpp:739-1176` : `TeamAIController::PrepareSetPiece`.
  - 750-767 : le gardien sur sa ligne ;
  - 780-819 et 1104-1130 : l'engagement ;
  - 821-841 : le six-mètres ;
  - 843-882 : le corner ;
  - 884-927 : la touche ;
  - 929-1028 : le coup franc, dont le mur en 1004-1026 ;
  - 1030-1088 : le penalty ;
  - **1132-1175 : le tireur**.
- `elizacontroller.cpp` :
  - 103-135 : rester planté pendant l'arrêt ;
  - **137-304 : le tireur et le gardien qui tient le ballon** ;
  - 309-352 : nos crochets A et B, qui exigent `!IsInSetPiece()` ;
  - 522-533 : les autres joueurs, immobiles.
- `onthepitch/match.cpp:848-868` : l'arbitre est traité **avant** les équipes (860 contre 888-890), puis le jeu est gelé en 864-868.
- `AIfunctions.cpp:895-927` : `AI_GetClosestPlayers`. Le tireur est le joueur le plus proche du ballon, gardien compris.

### Comment ça marche aujourd'hui

**La chronologie.**
1. **Arrêt.** `StopPlay` est appelé et le tampon de l'arbitre est rempli. `prepareTime` = maintenant + 2 s, plus le bonus de l'horloge (`gf_arret_ms`). Avec `animations = true` (`gf_api.cpp:82`), le saut de 1 900 ms n'a pas lieu.
2. **Deux secondes simulées.** Les joueurs restent plantés, regardent l'arbitre ou célèbrent.
3. **`prepareTime`.** `randomize(seed)`, puis `PrepareSetPiece` : **tous les joueurs sont téléportés** par `ResetPosition`, le tireur est choisi, et `GF_EV_SETPIECE` est émis.
4. **Deux secondes gelées.** `Match::Process` sort tout de suite, sans aucune simulation ; l'horloge avance de 10 ms par pas.
5. **`startTime`.** `StartPlay` puis `StartSetPiece`. Le tireur marche jusqu'au ballon (`AI_GetBallControlMovement` à la vitesse de marche, 279-285) et joue sa commande.
6. **Fin.** Elle survient quand `buffer.taker->TouchAnim() && !TouchPending()` (257-258). Les deux équipes reçoivent alors `PrepareSetPiece(e_GameMode_Normal)` et le jeu reprend normalement.

**L'exception de l'engagement.**

```cpp
if (buffer.desiredSetPiece == e_GameMode_KickOff || (buffer.taker->TouchAnim() && !buffer.taker->TouchPending())) {  // referee.cpp:257-258
  buffer.active = false; match->StopSetPiece(); …
```

Le drapeau de coup de pied arrêté est levé et baissé **dans le même appel de l'arbitre**, avant que les équipes ne soient traitées. Les contrôleurs ne le voient donc jamais. **L'engagement se joue en jeu courant, et `_GfOnBall` y est atteint** pour le joueur qui engage. La branche « engagement » de l'IA (`elizacontroller.cpp:189-193`) est du code mort.

**Ce que décide le tireur** (`elizacontroller.cpp:137-268`). Toutes les passes passent par `AI_GetPass`, avec pour destinataire imposé le joueur le plus proche du point visé.

| Coup de pied arrêté | Décision |
|---|---|
| penalty | tir vers (but, U(−5, 5)), puissance U(0,4 ; 1) |
| six-mètres | 60 % de passes hautes vers le joueur le plus proche de (20 % de la longueur adverse, y au hasard), sinon une passe courte |
| coup franc | 50 % de passes hautes vers la bouche du but (y ±10), sinon une passe courte 10 m devant |
| corner | 70 % de passes hautes dans la surface, sinon une passe courte vers l'entrée |
| touche | une passe courte au joueur le plus proche |
| gardien ballon en main | une passe haute au joueur le plus proche d'un point tiré au sort sur sa propre ligne de but (`pitchHalfW × GetDynamicSide()`, corrigé le 3 octobre d'après `docs/corps.md` § 8), s'il est à plus de 10 m de tout adversaire ou après 4 s de possession ; sinon il attend |

**Notre crochet `_GfOnBall` n'est pas atteint** pendant un coup de pied arrêté. La branche 137-141 attrape d'abord le tireur, `(IsInSetPiece() && GetPieceTaker() == player) || GetBallRetainer() == player`, puis rend la main en 286 ou 301. La branche B (340-344) exige `!IsInSetPiece()`. `_GfOnBall` n'est pas atteint non plus pour le gardien (354-379), ni pour un joueur qui tient le ballon en main.

**Le placement des autres.**
- Tout se passe dans `TeamAIController::PrepareSetPiece`. Les bornes de `AI_GetAdaptedFormationPosition` dépendent du type et du camp ; s'y ajoutent les 9,15 m, le mur des trois joueurs les plus proches, et la position hors de la surface et de l'arc pour le penalty.
- Pendant le coup de pied arrêté, les non-tireurs restent **immobiles** : la commande de mouvement à l'arrêt de 522-533.
- Le crochet A (309) n'est jamais atteint.

**Le tireur choisi** est le plus proche du ballon (1136-1138). Il est ensuite replacé : à 2,3 m derrière le ballon (coup franc, corner, six-mètres), à 3 m (penalty), ou à 0,3 m avec le ballon en main (touche, `SelectRetainAnim`). Les lancers (`pass|highpass/*/special/*_throw`) ne couvrent que ±90° autour du regard. **Aucun tir n'est possible depuis les mains.**

### Le correctif minimal

Il tient en quatre crochets, tous armés par le drapeau **`GF_CPA = 16`**, pour ne pas activer les intentions que le cerveau pose déjà pendant les arrêts.

**D0. Lire l'arrêt en cours** (`gf_api.cpp` seulement, sans toucher au moteur).

```cpp
static float g_cpa[8];
/** L'ARRÊT EN COURS : [actif, e_GameMode, équipe qui reprend, lieu x, y (monde), prepareTime, startTime, tireur (id stable)]. */
EMSCRIPTEN_KEEPALIVE float *gf_cpa() {
  const RefereeBuffer &b = GetGameTask()->GetMatch()->GetReferee()->GetBuffer();
  float v[8] = {(float)b.active, (float)b.desiredSetPiece, (float)b.teamID, b.restartPos.coords[0], b.restartPos.coords[1],
                (float)b.prepareTime, (float)b.startTime, b.taker ? (float)b.taker->GetStableID() : -1.f};
  std::copy(v, v + 8, g_cpa); return g_cpa;
}
```

- Il faut ajouter la fonction dans `EXPORTED_FUNCTIONS` (`build.sh:26`).
- `restartPos` est dans le repère du monde (`referee.cpp:122-125`, `ResetSituation(reverse ? -restartPos : restartPos)` en 287-289). Ce n'est pas vérifié pour les graines impaires.
- `taker` n'est valable qu'après `prepareTime`.

**D1. L'action du tireur, et du gardien ballon en main si le cerveau lui pose une intention.**

```python
# patch.py — 14. LE TIREUR DU CERVEAU : son intention PASSER/TIRER marquée CPA remplace le tirage de l'IA ; le reste de la
#    branche (aller au ballon, se tourner ballon en main vers desiredDirection) est inchangé
sub('onthepitch/player/controller/elizacontroller.cpp',
    '    PlayerCommand actionCommand;\n\n    if (team->GetController()->GetSetPieceType() == e_GameMode_Penalty) {',
    '    PlayerCommand actionCommand;\n\n'
    '    if (gf_cpa_commande(CastPlayer(), actionCommand)) {  // [gf-intent] D1 : le coup de pied arrêté du cerveau\n'
    '      commandQueue.push_back(actionCommand);\n'
    '    } else if (team->GetController()->GetSetPieceType() == e_GameMode_Penalty) {')
```

```cpp
// intents.cpp — repère de l'équipe (on est dans RequestCommand) : versLeRepereDe comme _GfOnBall
bool gf_cpa_commande(Player *t, PlayerCommand &c) {
  const GfIntent *gi = gf_intent(t);
  if (!gi || !(gi->flags & GF_CPA)) return false;
  bool enMain = GetGameTask()->GetMatch()->GetBallRetainer() == t;          // touche, gardien : des lancers seulement
  if (gi->kind == GF_PASS) {
    Player *cible = gf_player_by_stable(t->GetTeam(), gi->target);  if (!cible || cible == t) return false;
    int g = gi->flags & 3;
    c.desiredFunctionType = g == 2 ? e_FunctionType_HighPass : g == 1 ? e_FunctionType_LongPass : e_FunctionType_ShortPass;
    c.useDesiredMovement = false; c.useDesiredLookAt = false;
    c.touchInfo.forcedTargetPlayer = cible; c.touchInfo.autoDirectionBias = 1; c.touchInfo.autoPowerBias = 1;
    AI_GetPass(t, c.desiredFunctionType, c.touchInfo.inputDirection, 0, 1, 1, c.touchInfo.desiredDirection,
               c.touchInfo.desiredPower, c.touchInfo.targetPlayer, cible);
    return true;
  }
  if (gi->kind == GF_SHOOT && !enMain) { /* le même tir que _GfOnBall (+ GF_MOD_HAUTEUR du point 1) */ return true; }
  return false;                                                             // sinon : l'IA du tireur
}
```

**D2. Le placement des autres, et le choix du tireur.** Le cerveau remplit une table pendant les 2 s simulées qui suivent l'arrêt (il les repère avec D0). La table est consommée **dans** `TeamAIController::PrepareSetPiece`, juste avant le choix du tireur : celui que le cerveau place le plus près du ballon devient le tireur, et le moteur le replace à sa marque habituelle.

```python
ensure_top('onthepitch/teamAIcontroller.cpp', '#include "intents.hpp"')
sub('onthepitch/teamAIcontroller.cpp',
    '              if (isTakerTeam) {\n                DO_VALIDATION;\n                auto ball_pos = match->GetBall()->Predict(0).Get2D();',
    '              gf_cpa_placer(team);  // [gf-intent] D2 : le placement du cerveau (le tireur : le plus proche du ballon)\n'
    '              if (isTakerTeam) {\n                DO_VALIDATION;\n                auto ball_pos = match->GetBall()->Predict(0).Get2D();')
```

```cpp
// intents.cpp — repère de l'ARBITRE : le monde si reverse_team_processing est faux, tout en miroir sinon (match.cpp:853)
static std::unordered_map<int, Vector3> g_placements;           // id stable → (x, y) monde ; rempli par gf_cpa_place (API)
void gf_cpa_placer(Team *team) {
  if (g_placements.empty()) return;
  bool rev = GetScenarioConfig().reverse_team_processing;
  Vector3 ballon = team->GetMatch()->GetBall()->Predict(0).Get2D();
  std::vector<Player *> js; team->GetActivePlayers(js);
  for (auto p : js) { auto it = g_placements.find(p->GetStableID()); if (it == g_placements.end()) continue;
    p->ResetPosition(rev ? -it->second : it->second, ballon); g_placements.erase(it); }
}
// gf_api.cpp : EMSCRIPTEN_KEEPALIVE void gf_cpa_place(int id, float x, float y) → g_placements[id] = Vector3(x, y, 0) ; + export
```

`TeamAIController::PrepareSetPiece(e_GameMode_Normal)` sort en 746, avant le crochet : celui-ci ne joue donc qu'aux vrais arrêts.

**D3, optionnel. Bouger pendant le coup de pied arrêté.** Il s'agit, par exemple, des courses sur un corner, entre le coup de sifflet et la frappe. Une substitution en tête de la branche `else { // keeper?` (522) suffit :

```cpp
if (match->IsInSetPiece()) gf_cpa_mouvement(CastPlayer(), manualMovementDirection, manualMovementVelocityFloat);
```

La fonction lit `GF_MOVE` plus `GF_CPA`. La garde `IsInSetPiece` laisse le gardien inchangé en jeu courant.

### Risques

- **Garde.**
  - D0 ne fait que lire.
  - D1 et D3 sont armés par `GF_CPA`, que le cerveau actuel ne pose jamais. Les intentions périmées tenues pendant l'arrêt restent donc sans effet.
  - D2 n'agit que si la table a été remplie. `ResetPosition` tire au sort, mais seulement dans ce cas, et juste après le `randomize(seed)` de `referee.cpp:240`.
- **Le repère de l'arbitre** se déduit de `Mirror(reverse, !reverse, reverse)` ; il faut le vérifier. Un joueur placé en (x, y) doit apparaître en (x, y) dans `gf_frame`, sur une graine paire comme sur une graine impaire.
- **La légalité est à la charge du cerveau.** Le moteur ne contrôle ni les 9,15 m, ni le hors-jeu à la remise, ni la surface au six-mètres, ni le camp et le rond central à l'engagement.
- **Côté cerveau.**
  - Les bancs n'appellent `decider` qu'en jeu courant (`sonde-retrait.mjs`, `talon.mjs` : `if (e.enJeu && !e.cpa)`).
  - Pour D1, il faut poser l'intention du tireur après `GF_EV_SETPIECE`, pendant le gel de 2 s.
  - Pour D2, il faut poser le placement **avant** `prepareTime`.
- **Les intentions impossibles retombent sur l'IA.** Un tir depuis les mains (touche, gardien) est refusé et rendu à l'IA, faute de geste. Le tireur est en revanche bien orienté vers sa cible avant le lancer (`elizacontroller.cpp:291-295`).

### Effort

| Crochet | Moteur | Notre code |
|---|---|---|
| D0 | rien | environ 12 lignes dans `gf_api.cpp`, plus l'export |
| D1 | une substitution | environ 40 lignes dans `intents.cpp` |
| D2 | une substitution, plus l'inclusion | environ 25 lignes dans `intents.cpp`, environ 6 dans `gf_api.cpp`, plus l'export |
| D3 | une substitution | environ 12 lignes |

**Recompilation incrémentale :** `elizacontroller.cpp`, `teamAIcontroller.cpp`, `intents.cpp`, `gf_api.cpp`, puis l'édition de liens.

---

## Résumé classé

| Rang | Correctif | Moteur | Notre code | Valeur |
|---|---|---|---|---|
| 1 | **Hauteur du tir** | 1 ligne | environ 35 | Débloque la finition du cerveau. Aujourd'hui « un tir au-dessus devient un tir à côté » (README:266). À faire en premier. |
| 2 | **Talonnade sur demande** | 1 ligne | environ 25 | **Le moins cher.** Filet sous la règle « se tourner d'abord » du cerveau (6 % des passes concernées). Il pose aussi le filtre dont la passe au pied a besoin. |
| 3 | **Coups de pied arrêtés, D0 + D1** | 1 ligne | environ 55 | Le cerveau décide du tireur : corners, coups francs, touches, penalties. D2 vient ensuite (placement et choix du tireur), D3 en option. |
| 4 | **Passe en retrait au gardien** | 4 substitutions | environ 45 | La plus incertaine. **Étape 0 d'abord** : geste joué, hauteur de départ, hauteur et vitesse à l'arrivée, gestes du gardien (`sonde-retrait.mjs` les trace déjà). Puis (b), le gardien qui sort et contrôle, et (a), la passe au sol dosée, limitée à environ 20-22 m. Rouvrir ensuite la ligne vers le gardien dans le cerveau. |

- **Aucun en-tête du moteur n'est modifié.** Les canaux utilisés sont `modifier`, `autoPowerBias` et `inputPower`, et toute la logique vit dans `api/intents.cpp`. Toutes les recompilations restent **incrémentales** (`build.sh:16`), à lancer quand les 8 cœurs seront libres.
- **Après chaque correctif :**
  - lancer `node determinisme.mjs`, intentions coupées, pour retrouver la même empreinte ;
  - faire le même contrôle avec `gf_intents(1)` et aucune intention posée ;
  - puis lancer le banc propre au correctif (étalonnage de la hauteur, `talon.mjs`, `sonde-retrait.mjs`, puis un banc de coups de pied arrêtés).
- **Non vérifié par lecture seule :**
  - le signe et l'ordre de grandeur du Magnus ;
  - le repère de l'arbitre sur les graines impaires ;
  - la cause exacte de la montée à 2 m ;
  - le rôle de `preferPassAndShot` dans les échecs du gardien ;
  - le freinage réel d'un ballon roulant (couplage de la rotation).
