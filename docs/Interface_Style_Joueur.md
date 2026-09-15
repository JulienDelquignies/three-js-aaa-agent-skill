# Le style par joueur — ce que le moteur dérive, ce qu'un projet peut poser

> Pour les projets qui consomment le match engine (le jeu aval, le directeur sportif). Écrit le 15/09 à la demande de
> l'utilisateur (« tu avais mis en place quelque chose pour avoir des postures différentes par joueur ? que je le
> donne aux projets »). Tout ce qui suit est déterministe : la même graine de match et le même joueur donnent la même
> identité à chaque partie — une source, deux consommateurs (la sim et le visuel lisent la même persona).

## 1. Ce que le moteur dérive tout seul (rien à poser)

Quatre signatures, toutes fonctions pures de `(id du joueur, graine du match)`, bornées serré : une identité est un
accent, jamais un déséquilibre.

| Signature | Module | Champs (bornes) | Qui la lit |
|---|---|---|---|
| **Persona** | `persona.js` `makePersona(id, seed)` | `scale` ±4 % de taille · `gaitPhase` [0,1) déphasage du cycle de jambes · `armSwingF` [0,85 ; 1,2] amplitude du balancier · `posture.lean` [−1,5 ; 2,5]° et `posture.shoulder` [−1,5 ; 1,5]° (la silhouette) · `paceBias` [0,94 ; 1,06] allure de pointe · `burstiness` [0,7 ; 1,4] ruptures de rythme · `calm` [0,85 ; 1,25] tenues délibérées · `flair` [0,15 ; 1] goût du geste · `reaction` [0,16 ; 0,26] s latence sur une balle surprise · **`bras`** [0,15 ; 0,9] le port de bras (0 : bas et calmes, 1 : ouverts en équilibre) | la SIM : paceBias, burstiness, calm, flair, reaction · le VISUEL : scale, gaitPhase, armSwingF, posture, bras |
| **Style de foulée** | `motion-gait.js` `gaitStyleFromSeed(seed)` | `elbow` ±12° · `armSwing` [0,85 ; 1,15] · `armElev` [−3 ; 4]° · `lean` [0,75 ; 1,25] · `lift` [0,85 ; 1,15] · `turnout` [3 ; 14]° · `width` [0,85 ; 1,2] · `bob` [0,8 ; 1,2] · `pelvis` [0,8 ; 1,2] · `bias` ±0,03 · `toeOff` [0,85 ; 1,15] · `drop` [0,8 ; 1,25] | le visuel (la foulée générée, toutes allures) |
| **Style d'attente** | `motion-idle.js` `idleStyleFromSeed(seed)` | `width` [0,85 ; 1,2] · `sway` [0,7 ; 1,3] · `swayT` [0,8 ; 1,25] · `breath` [0,8 ; 1,25] · `elbow` ±8° · `armElev` [−3 ; 4]° · `lean` [−1,5 ; 2,5]° · `turnout` [4 ; 16]° · `phase` [0 ; 1] | le visuel (repos, mains sur les hanches, sautillement, garde, réception, pausa…) |
| **Style de frappe** | `motion-strike.js` `styleFromSeed(seed)` | `backswing`, `lean`, `open`, `armElev`, `armFwd`, `elbow` [30 ; 64]°, `swingArm` [14 ; 40]°, `headDown`, `follow`, `toe`, `dip`, `snap` ±0,012 s | le visuel (frappes, passes, contrôles générés par joueur) |

La graine des styles est `id × 7919 + graine du match` (attente : + 101). Le tempérament de la persona choisit aussi
l'ESPÈCE d'attente (calme → mains sur les hanches au temps mort, nerveux → sautillement) et module les postures de
situation : le receveur qui attend une passe, le défenseur qui jockeye, le rôle marchant loin du ballon.

## 2. Ce qu'un projet peut poser (`squads`)

`makeMatch({ squads: [equipe0, equipe1] })` — `squads[team][i]` dans l'ordre des postes, le dernier est le gardien.
Chaque entrée peut porter, en plus de `ratings`, `look`, `name`, `number`, `postes`, `familiarite`, `refus` :

```js
{
  name: 'Pedri', number: 8,
  ratings: { passing: 88, control: 91, composure: 85, flair: 70, /* … */ },
  look: { scale: 0.98, shirt: 0x1a3d8f },
  persona: {                       // PARTIEL : chaque champ posé remplace le tirage, le reste reste seedé
    bras: 0.2,                     // bras bas et calmes à la réception, au jockey
    calm: 1.2,                     // des tenues plus longues (lu par la sim : le tempo du porteur)
    posture: { lean: 2 },          // le buste un peu avancé (la silhouette)
  },
  style: {                         // PARTIEL aussi ; absent : la graine décide
    gait:   { armElev: -3, elbow: -10, drop: 1.15 },   // bras collés, coudes fermés, coureur assis
    idle:   { elbow: -6, sway: 0.8 },
    frappe: { elbow: 40, lean: 1.3 },
  },
}
```

Règles : les champs de `persona` lus par la sim (`paceBias`, `burstiness`, `calm`, `flair`, `reaction`) changent le
jeu — les poser, c'est de la donnée, comme une note ; restez dans les bornes du tableau (le contrat `checkPersona` les
tient). Les styles ne touchent aucun bit de sim. `flair` peut aussi venir de `ratings.flair` (0-100), comme avant.
Un joueur sans `persona` ni `style` est exactement celui d'hier, bit pour bit (clause `verify-persona`).

## 3. Où ça se voit

- `reference/52-motion-gait.md`, `53-motion-idle.md`, `51-*` (frappes) : les générateurs et leurs contrats.
- `reference/58-signes-visibles-du-role.md` : les postures de situation (réception, jockey, pausa, rôles marchants)
  et comment le port de bras les module.
- Planches : `node skills/threejs-aaa/scripts/contact-sheet.mjs --idle reception --seed N` (l'attente au style de la
  graine N), `--gait 2 0` (la foulée), `--move frappe --seed N` (la frappe).
