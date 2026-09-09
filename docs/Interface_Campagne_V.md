# Interfaces gelées — Campagne V (moteur ↔ animation)

Gelées le 7/09 par l'agent moteur pour que l'agent animation démarre A12 sans attendre les lots. Les NOMS
ne bougent plus ; les valeurs par défaut restent à mesurer par chaque lot. Tout est optionnel : un champ
absent = l'hier au bit.

## 1. Le scan (lot 250 → A12a)

L'horloge de scan vit dans la SIM (`scan.js`, appelée depuis `movement.js`), jamais dans `gaze.js`.
`gaze.js` la LIT. Déterministe par acteur : LCG seedé par `p.id`, aucun `st.rnd` consommé.

```js
// sur chaque joueur de champ (et le gardien), mis à jour à chaque pas :
p.scan = {
  at:    number,            // s — début de la saccade en cours (ou de la dernière)
  until: number,            // s — fin de la saccade en cours ; until <= st.t : les yeux sont au ballon / au jeu courant
  vers:  'presseur' | 'espace' | 'ballon' | 'coequipier',   // où vont les yeux pendant la saccade
  cible: [x, z] | null,     // le point regardé (monde) — null si 'ballon'
  n:     number,            // saccades depuis l'adoption de la passe qui arrive (0 hors vol) — c'est le compteur que 250c lit
  vol:   boolean,           // true pendant le vol d'une passe qui LUI arrive (fenêtre Jordet)
};
// la clé de sim :
cfg.scan = { vol: [0.4, 0.6], horsBallon: [1.5, 4], dur: 0.45 };   // scans/s en vol ; intervalle (s) hors ballon ; durée d'une saccade (s). null : pas d'horloge, gaze.js garde son horloge locale d'hier
// l'attribut :
ratings.scanning → skill.scanF ∈ [0,85 ; 1,15], identité 1 à 50 — multiplie la cadence en vol.
```

Règle Jordet codée : jamais de saccade pendant la frappe du passeur ni pendant la prise ; les saccades
vivent PENDANT le vol. `gaze.js` : si `p.scan.until > st.t`, regarder `p.scan.cible` ; sinon sa politique
d'hier. Clause A12a : receveur ≥ 0,4 scan/s en vol (`p.scan.n / durée du vol`).

## 2. La pausa (lot 253 → A12c)

```js
startGesture(p, { id: 'pausa', duration: dur }, { payload: { kind: 'pausa', dur } });   // le ballon sous la semelle : ball-body `hold`
st.events.push({ t, type: 'pausa', by: p.id, dur, attires });   // attires : adversaires entrés à < 3 m pendant l'arrêt
cfg.pausa = { tenue: 0.7, dur: [0.6, 1.4], presseur: 3, p: 0.4 };   // null : aucune pausa décidée (les gestes arret-semelle d'hier restent)
```

## 3. La passation du marqueur (lot 252)

```js
st.events.push({ t, type: 'passation', de: idMarqueur, a: idReleveur, cause: 'decrochage' | 'zone' | 'homme' });
cfg.passation = { suit: 8, remet: 2.5, zone: 6, portee: 10 };   // 252 : zone (m sous le pivot) et portee (m du pivot) ajoutées — le pivot ne prend que ce qu'il peut atteindre, entre les lignes
```

## 4. Le signal du tireur (A12f, une ligne côté cpa.js)

```js
payload.mains = 'signal';   // le tireur de corner / coup franc lève le bras pendant la cérémonie — sous cfg.remise.signal (true), absent : rien
```

## 5. Les interdits et refus (lot 248)

```js
ROLES.x.interdits = ['deborde', 'tete', 'tirLoin', 'dribbleElimination', …];   // binaire, lu par la loi concernée AVANT d'agir — hors de la bande d'arbitre [0,7 ; 1,3]
squads[i].refus = ['tirLoin', 'tete'];                                           // le joueur, même vocabulaire ; composé au rôle à la résolution (resoudreRole → role.interdits ∪ refus)
```
Vocabulaire des interdits (gelé, extensible par ajout seulement) : `deborde`, `tete`, `tirLoin`, `dribbleElimination`,
`centre`, `passeLongue`, `decrochage`, `repli`, `pressHaut`, `tacleGlisse`.

## 6. Journal

NOTES.md est à 322 sur le tronc. La branche animations numérote à partir de 323 ; en cas de collision à la
fusion, le tronc renumérote et le dit (comme aux 308, 311, 319).
