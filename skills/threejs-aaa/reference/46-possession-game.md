# A 5 v 5 possession game that plays itself well

The scene: a *passe à dix* on the centre circle of the Grand Bol under floodlights. Ten AI players,
a real ball, and one rule — string passes, and when you lose it, win it back. It is the smallest
complete football game, which makes it the right thing to build first: everything a full match
needs (carry, pass, press, cover, mark, intercept, turnover) is in it, and nothing else is.

## The architecture that makes it work

**The game is decided headless; the scene only dresses it.** `rondo-sim` runs the whole match with
no renderer, so all 20 contract checks (shape, beehive, passes, turnovers, correct foot) are proved
in node before a triangle is drawn. `Rondo.js` then takes the simulation's positions as the single
source of truth and drives the `CharacterController`s *to follow them* — feeding `setMoveWorld` so
locomotion state, cadence and foot-lock come out right, then snapping to the proven position. One
truth, two consumers. Letting the controllers integrate their own motion would create a second,
disagreeing simulation, and the AI you tested would not be the AI you shipped.

The stadium places pitch centre at the world origin (grass Y = 0, long axis X), so the grid's own
coordinates are already world coordinates. No frame conversion anywhere — the cheapest bug class
eliminated by choosing the origin well.

## The AI: jobs, not urges

The beehive comes from every player reacting to the ball. The cure is that nobody reacts to the
ball — they do a **job**:

| job | what it does |
|---|---|
| `carry` | dribbles (real touches, `dribble.js`), drifts off the presser's shoulder into space |
| `support` | holds **its own angle** of the rondo, scored for lane clearance, distance from its marker, spread from team-mates |
| `press` | closes the carrier down, arriving on the touch-line side |
| `cover` | stands in the single most dangerous lane |
| `mark` | a step goal-side of its man — *not* a walk to the ball |
| `intercept` | the only player who attacks a travelling ball, chosen by `interceptPoint` |

Passing is scored, not guessed: `laneClearance` measures real corridor geometry, and the ball is
only played into a lane that is open — a lofted ball is what beats a closed one, at the cost of
being slower. And every pass is solved with **inverse ballistics**, so it arrives on the man at a
playable pace instead of dying at his feet or burning past him.

## Six bugs that only a contract finds

Each of these produced a *plausible-looking* game, and each was invisible without a measurement.

1. **`NaN` made the whole team stand on one spot.** `supportSpot` held player *objects* where
   positions were needed, so every distance was `NaN`. Since `NaN > NaN` is false, the "best
   candidate" never updated and every supporter silently kept the **first** candidate in the list —
   the same point. Measured spread: 0.6 m for a whole team. There was no error, no warning, and the
   scene would have looked like a scrum. The fix is one `.map(p => p.p)`; the lesson is the guard
   that now throws on a non-finite score.
2. **The passer intercepted his own pass**, 0.02 s after striking it — the ball is still at his
   feet, so he is the closest player to it. Every single pass ended in an instant "turnover". The
   ball must clear the striker before anyone can take it.
3. **A team-mate taking the ball was scored as losing it.** Only the *intended* receiver completes
   a pass; anyone else in the same shirt keeps possession without scoring it.
4. **Sectors handed out by shirt number** made players criss-cross the middle to reach their slot —
   and the middle is exactly where the ball is. Assigning sectors **by current angle** (sort the
   ring, rotate it onto the team as it stands) means nobody ever crosses.
5. **The beehive was measured wrong.** A peak count of defenders near the ball cannot tell a real
   beehive from four players converging for the instant a pass arrives — which is correct football.
   Measured in **time** instead: a true beehive sits at 100%, this game at 5.9%.

6. **The night match rendered as a bright afternoon, with every contract green.** The engine's boot
   lighting (`Lighting.js`) adds an analytic `DirectionalLight(0xfff2e0, 2.4)` straight to the scene.
   `setupStadiumNight` swapped `scene.background` and `scene.environment` — which does *nothing* to an
   analytic light — and its contract only ever traversed **its own group**, so the sun that was
   out-lighting the entire floodlight rig was outside the contract's field of view. A rig that claims
   to own the lighting must own the *scene's* lighting: douse every light it did not add (restoring
   them on `dispose`), and **assert on the scene, not on the group**. And the fix was still not
   enough: with the day sun off, the night key was itself at 2.0 against a daytime sun of 2.4, so the
   frame still measured 0.433 mean luminance. **Night is not the colour of the sky, it is the ratio
   between the key and everything else** — a floodlit pitch is ~1 500 lux, open daylight ~100 000. The
   contract now asserts the budget itself (key ≤ 1.4, `environmentIntensity` ≤ 0.3, fill ≤ 35 % of the
   key, and mast irradiance `I/d²` at the aim point ≥ the key), which is what turns "it looks like
   daytime" from a matter of taste into a number a harness can fail on.

   Measured on one frame with only the lighting changing between renders (`frame-stats.mjs`):

   | balance | mean | p05 | contrast (p95−p05) | clipped black |
   |---|---|---|---|---|
   | as shipped (key 2.0, day sun still on) | 0.433 | 0.047 | 0.490 | 0.1 % |
   | day sun doused, nothing else changed | 0.306 | 0.035 | 0.379 | 0.4 % |
   | **night budget (key 0.95, pools 1.6)** | **0.269** | **0.021** | **0.375** | **4.7 %** |
   | masts dominant (key 0.7, pools 2.2) | 0.279 | 0.020 | 0.398 | 5.3 % |
   | masts dominant (key 0.55, pools 2.8) | 0.295 | 0.019 | 0.424 | 5.6 % |

   Which corrects the assumption behind the metric: **mean luminance alone is the wrong criterion.**
   Pushing light from the key into the masts *raises* the mean (the pitch fills most of the frame and
   gets brighter) while the frame gets *more* night-like on every other axis — darker darks, more
   contrast, more clipped black. A floodlit night is a bright pitch inside a dark bowl, which lives in
   the shape of the histogram, not its average. Both are reported; judge on p05 and contrast, and use
   the mean only to catch the gross failure (an afternoon at 0.43).

The general lesson: when a metric fails, ask whether the *metric* is wrong before tuning the
system. Two of the six "failures" above were the harness measuring the wrong thing, and tuning
weights against them would have made the game worse. The sixth is the sharper version of the same
point — a contract can only catch what it looks at, and "green" over too small a scope is worse than
no contract at all, because it buys false confidence. Scope every check to the thing the user
actually sees.

## The three modules that dress it

| module | what it owns | the trap it exists to avoid |
|---|---|---|
| `stadium-night.js` | floodlit night: one shadow-casting directional + four non-shadow banks, night IBL, haze | keeping the daytime IBL underneath — the scene then reads as an overcast afternoon with lamps in it |
| `render-pipeline.js` | the post chain by tier (`low` / `high` / `ultra`) | MSAA left on under TRAA/TAAU, GTAO **and** SSGI both writing AO, a second tonemap at the end |
| `kit.js` | shirt/sleeves/shorts/socks/number generated on the rig at bind | a garment measured off the bones instead of the *skin*, which either floats or lets the body poke through |

Three decisions there are worth stealing:

- **One shadow, not four.** Four shadow-casting masts means four depth passes over a 13 000-seat bowl
  and four overlapping penumbrae under every player, which reads as mud. Broadcast football shows one
  dominant shadow; the banks wash the rest out. And `GodraysNode` throws on anything that is not a
  Directional or Point light anyway, so the light feeding the shafts *has* to be the directional.
- **Fit the shadow frustum to the pitch, in light-view space.** The obvious `left = -L/2 … top = W/2`
  is wrong for any light not arriving down an axis (corners fall out, half the players lose their
  shadow), and widening it "to be safe" is the other half of the trap: at 2048² a 113 m frustum costs
  5.5 cm/texel, the whole bowl at 300 m costs 15 cm and a boot shadow becomes three texels of grey.
- **Derive floodlight candela from the real mast distance.** Intensity is candela and decay is 2, so
  irradiance at the aim point is `I/d²`. Deriving `I` from where the mast actually is keeps a tier-1
  pylon (14.5 m, close in) and a tier-5 roof rig at the same level on the grass instead of one of
  them being a white hole.

**No DOM in an engine module.** `stadium-night` originally built its sky with a canvas gradient, which
made the whole rig unconstructible in node — so its contract could only ever be tested against a
hand-written replica of the lights, and a replica only proves the replica is right. Swapping to a
`DataTexture` (and skipping the PMREM convolution when there is no renderer, the one part that truly
needs a GPU) means `verify-matchday.mjs` runs the contract on the **real** rig, on all five tiers,
plus six named sabotages. Watch the flip: row 0 of a `DataTexture` is `v = 0`, the *bottom* of the
equirect, where a `CanvasTexture`'s row 0 is the top.

## Correct feet

Every ball-contact move in the animkit library (`frappe`, `passe`, `talonnade`, `retournee`) is
authored on the **right** side. A player asked to pass left therefore had to swivel his whole body
or strike with the wrong foot — one of the most visible tells of AI football. `mirrorMove(spec)`
produces the exact left-footed twin: swap the Left/Right bone names and negate the **Y and Z** euler
components (X is the flexion axis, shared by both sides); root motion is character-space
`[right, up, forward]`, so only the lateral component flips. It is involutive (mirroring twice
returns the original) and all 11 moves survive `checkClip` mirrored.

The brain picks the foot geometrically — `strikingFoot(yaw, from, to)` from the sign of the cross
product of facing and target — and the scene plays the matching clip.

## Debugging notes worth keeping

- **Instrument before tuning.** Three rounds of weight-tweaking moved nothing; one script that
  dumped the score components found the `NaN` in a minute.
- **Print the decision's own justification.** A harness that re-measures a lane one frame later is
  judging a different geometry (both the defenders and the ball have moved). Recording the
  clearance the decision actually saw made the check exact.
- **A change that improves realism can make the game worse.** Shifting the whole defence onto the
  incoming receiver during a pass is what real teams do — and it collapsed possession from 7 passes
  to 4. It was measured and reverted, with the reason left in the code.
