# Making a football match feel real — what actually moves the needle

The usual diagnosis ("my match looks bad, I need better graphics") is almost always wrong. A match
reads as fake for **simulation** reasons long before it reads as fake for rendering reasons, and
the two biggest offenders are nearly universal in hobby football games:

1. **The ball is animated, not simulated.** A hand-authored parabola (`p.y += 4·apex·u·(1−u)`) or a
   bare rigid sphere in a physics engine. Neither is a football.
2. **The ball is welded to the dribbler** (`ballPos = playerPos + heading·0.85`). No touches, no
   lag, no runaway, nothing for a defender to win.

Fix those two and the same renderer suddenly looks like football. Add crowd and floodlights first
and it still looks like table hockey with nice lighting.

## Layer 1 — ball flight (`engine/ball.js`, contract `checkBallFlight`)

A football's trajectory is dominated by aerodynamics, not gravity alone. The four terms, in order
of how much they change the picture:

| term | why it matters | measured in `verify-ball` |
|---|---|---|
| **Drag** ½ρ·Cd·A·v² | ≈9.5 m/s² at 30 m/s — *comparable to gravity*. A struck ball flattens and dies. | 30 m/s shot lands at **54 m**, not the 92 m of a vacuum parabola |
| **Drag crisis** | Cd collapses 0.47 → 0.17 around 13 m/s (boundary layer trips turbulent). A hard shot holds a flat line, then falls off a cliff as it slows back through it. | Cd(5)=0.47 → Cd(30)=0.19 |
| **Magnus** F ∝ ω × v, Cl = 1/(2 + v/(ω·r)) | **THE curve.** Without it nothing bends, ever — every ball feels like a stone. | 25 m/s + 9 rev/s ⇒ **1.2 m of bend**; backspin carries +9 m, topspin dips −6 m |
| **Spin at contact** | the contact point moves at v + ω × r, so friction trades spin for velocity | backspin bounce Δvₓ = **−5.0 m/s** (checks up and back), topspin **−0.9** (skids on) |

Two implementation details that are not optional:

- **Sub-step the integration.** A 30 m/s shot covers 0.5 m per 60 Hz frame — 4.5 ball radii. Without
  sub-steps it tunnels through the net, the keeper and the pitch. `stepBall` caps travel at half a
  radius per sub-step.
- **Rolling needs the air too.** Rolling resistance alone (Crr·g) let a 15 m/s pass roll **153 m**.
  At 15 m/s aerodynamic drag is ~2.6 m/s², *more* than the grass contributes. With both, the pass
  dies at 39 m — a believable ball across the far half.

`checkBallFlight` rejects the physically inadmissible: energy increasing (a non-physical force),
the ball under the pitch, per-frame teleports, absurd speeds.

## Layer 2 — dribbling (`engine/dribble.js`, contract `checkDribble`)

A dribble is a sequence of **touches**, not an offset. Once per stride the plant foot nudges the
ball; between touches the ball is **free** and rolls under `ball.js` while the player runs to catch
it. Everything that makes dribbling a mechanic falls out of that loop: the ball–player distance
breathes, pace costs control, and a heavy touch loses possession.

Three modelling mistakes cost a rebuild each, and all three are worth knowing:

- **Trigger on REACH, not on distance travelled.** "Touch after N metres of running" means that
  once the ball escapes the trigger window it is never touched again — on a curved run the ball
  simply left, 26 m away. You touch the ball when your foot can reach it (< ~1.15 m), stride-paced
  so it is not re-kicked every frame.
- **Derive the push, don't guess a multiplier.** The ball decelerates at *a* (grass + air), so to
  gain `lead` metres it needs v₀ = v + √(2·a·lead). A guessed ×1.62 sent the ball 3 m ahead at
  every pace. Deriving it makes the dribble self-correcting from walking to sprinting.
- **Lead the turn by the real interval.** In a sustained curve the touch must aim *inside* the arc,
  by half the rotation the player completes before catching it — `turnRate · touchInterval / 2`.
  An eyeballed "fraction of a stride" was **13× too small** and left the ball drifting to the
  outside of every curve. Also shorten the touch itself while turning: you cannot push a ball 3 m
  ahead through a 40° change of direction.

Plus `dribbleSteer()`: a dribbler bends their path **to their ball**. A player who runs their
intended line and ignores where the ball went is not dribbling.

`checkDribble` is written against the failure modes, not the implementation — a **constant**
ball–player distance is rejected as "ballon COLLÉ" (the welded-ball signature), as are a runaway
ball, a trailing ball, and a foot that machine-guns it every frame.

## Layer 3 — what is still missing for a real match (in priority order)

1. **Kick model** — shot/pass/cross as (speed, elevation, spin) chosen by intent, with error that
   scales with pressure, body shape and weak foot. `kick()` already takes exactly those parameters.
2. **Player locomotion limits** — acceleration ≈ 4–6 m/s², top speed 7–9 m/s, and a **turn radius
   that depends on speed** (nobody turns 180° at full sprint). Instant direction changes are the
   second-biggest tell after the welded ball. Pair with the existing `locomotion.js` cadence match
   and `foot-lock.js` so the feet stop skating.
3. **Keeper** — dive decision from ball trajectory + reach volume. `ball.js` gives an exact
   predicted path to test against; the animkit `plongeon` move already exists.
4. **11v11 team AI** — the classic failure is the *beehive*: 22 players chasing the ball. What you
   need instead: formation with per-role home positions, a team shape that **slides with the ball**
   (defensive line + compactness), and only 1–2 pressers while everyone else holds shape. Then a
   decision layer scoring pass / shoot / dribble / clear, and an offside line.
5. **Set pieces** — throw-ins, corners, free kicks. Cheap once 1–4 exist, and they showcase Magnus.

## Layer 4 — the graphics, once the simulation is honest

Ordered by visible return, not by effort:

- **Pitch**: mowing stripes, wear patches in the goalmouth and centre circle, correct FIFA
  dimensions (105 × 68 m), markings as geometry not a blurry texture. A flat green plane is the
  single most damaging asset in a football scene.
- **Grass**: shell/instanced blades near the camera, a good anisotropic shader further out.
- **Crowd**: instanced, animated, tiered — an empty stadium reads as a prototype no matter the
  lighting.
- **Floodlights + night mode**: four towers, correct exposure, contact shadows. Night flatters
  everything and hides LOD seams.
- **Broadcast camera**: a real match is *watched* through a specific lens — long lens, low, tracking
  with lag and slight overshoot. Copying the broadcast camera buys more perceived realism than any
  shader.
- **LODs and skinned instancing** for 22 players, or the frame budget is gone before the ball moves.

The order matters: every item in Layer 4 multiplies what Layers 1–3 produce. Applied to a welded
ball on a scripted parabola, it multiplies zero.
