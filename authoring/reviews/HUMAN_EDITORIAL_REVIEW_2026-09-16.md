# Human editorial review — first curated lessons

**Review state:** Open. Neither CoursePack is approved for publishing or a
Spotlight build.

**Review scope:** the original immutable `0.1.0` packages, rejected `0.1.1`
camera revisions, manually corrected `0.1.2` revisions, and parity-safe `0.1.3`
revisions. The revisions reuse the same Xiaohe audio bytes and leave raw
candidates untouched. Publication still requires a final review of `0.1.3`.

## Review artifacts

| Pack | Packaged raw source | Learner / duration | Narrated beats | Initial disposition |
| --- | --- | --- | ---: | --- |
| `rectangle-area-from-tiles@0.1.3` | `candidate-005` + explicit camera plan | ages 8–9 / 141.6 s | 13 | Materialization parity verified; final visual review pending |
| `slope-and-intercept@0.1.3` | `candidate-004` + explicit camera plan | ages 12–14 / 101.2 s | 13 | Materialization parity verified; final visual review pending |

All 26 Xiaohe MP3 files decoded in browser playback. This is not a subjective
voice or pacing approval; the editor must listen to the actual narration.

## Evidence already accepted

- Each lesson has four distinct teaching sections rather than one generated
  monologue.
- Desktop HTTPS and Android-mode HTTPS automated playback passed: all 13 audio
  segments ended, cached reopening worked, and learner ink survived return and
  reload.
- The real controls mutate the displayed mathematical visual. This is not a
  decorative-slider implementation.
- Host controls and task cards were included in collision layout after the
  standalone-pack attachment fix; the current completion captures show no host
  card covering a lesson card.

## Editorial findings requiring a decision

### 0. Camera oscillation during narrated playback — `P1`

**Human observation.** The teaching focus repeatedly jumps while a curated
lesson plays. This blocks editorial approval even though the earlier end-to-end
checks passed: those checks only verified completion, audio, ink persistence,
and final card collisions, not camera stability between operations.

**Initial, incomplete diagnosis.** The rectangle package declared 11 explicit
`board.focus` operations; 10 pointed back to the first Geometry card. One Beat
created the area-formula Math card and immediately focused the old Geometry
card while claiming to “focus the formula.” At playback boundaries the OLL
camera can also reuse the last teaching target, so these repeated declarations
explain the return to the opening composition. The slope package had similar
Plot/Math target conflicts.

**`0.1.1` failed human review.** Explicit focus in the rectangle package was reduced
from 11 to 2 intentional changes; conflicting focus in the slope package was
removed or retargeted. This produced no visible improvement. The diagnosis was
incomplete: OLL also derived camera targets from ordinary Beat content, reused
the last target at `beat.end` / `step.commit`, and focused create/point/animation
operations even after authored focus actions were removed.

**`0.1.2` local revision.** CoursePack playback now selects an explicit camera
policy. Under that policy, only canonical `board.focus` actions can move the
teaching camera; Beat boundaries, generated composition targets, ordinary card
operations, and variable animations do not synthesize camera moves. Realtime
generated lessons retain the automatic policy. The rectangle pack has three
reviewed multi-card camera scenes instead of 11 single-card returns; the slope
pack has three. All 26 audio segments remain byte-for-byte identical to
`0.1.0`. Package validation, focus-plan verification, OLL camera tests, frontend
camera-policy tests, integration tests, and TypeScript checks pass.

**`0.1.3` parity-safe revision.** The reviewed focus plan is now applied to the
Authoring lesson rather than by modifying packaged Canonical events. The course
library invokes the exact materializer exported by `octos-learn`; each package
contains that reviewed Authoring source, an explicit camera-policy declaration,
and a portable course-region declaration. At load time, the player rematerializes
the source and rejects any package whose complete Canonical event stream differs.
Both archives pass that byte-for-byte parity gate, retain three reviewed focus
scenes, and reuse all 13 original audio segments unchanged.

**Evidence still needed.** Automated checks do not establish visual stability.
Replay the recommended `0.1.3` versions from the beginning in the dedicated
review window, checking opening framing, every Beat gap, and section changes.
Editorial sign-off remains blocked until that human check passes.

### 1. Rectangle area and perimeter — `P1`

**Observation.** The only student task is "set the length to 5 cm". Its check
accepts the length slider target and asks the learner merely to observe coverage.
It does not require the learner to state or verify the resulting area, nor to
distinguish it from perimeter.

**Why it matters.** The lesson's stated outcomes include deriving the area rule
and distinguishing area from perimeter. A slider-only completion shows that the
interactive visual responds, but is a weak check of those outcomes.

**Editorial decision needed.** Either accept this CoursePack as a guided first
exposure with a deliberately light interaction, or replace it with one task
that asks the learner to set a specified rectangle and identify its area with
square units. Do not add an unverified natural-language answer check merely to
make the task appear richer.

### 2. Rectangle pacing and no-op state reset — `P2`

**Observation.** Section 3 animates the dimensions back to 4 by 3 even though
the recorded playback has not changed either value since the initial state.
The narration also repeats the 4-by-3 worked example across the row/column,
formula, and comparison sections.

**Editorial decision needed.** During playback, decide whether the reset and
one repeated sentence improve recall for ages 8–9. If not, remove the no-op
actions and tighten one sentence in a curated copy; preserve `candidate-005`
unchanged.

### 3. Slope and intercept task design — `P1`

**Observation.** All three tasks become available after the lesson: set
`m = -3`, set `b = -2`, then set `m = 2`. The lesson narration itself also says
"try" while it is still playing, but there is no explicit pause/hand-off that
explains whether the learner should interact immediately or wait until the end.

**Why it matters.** The three targets are individually valid, but together they
read like three independent slider checks. They may distract from the intended
conceptual contrast of slope versus intercept.

**Editorial decision needed.** Play this course with a learner. Choose either:

1. retain the three small checks and add a clear hand-off between narration and
   post-lesson practice; or
2. curate them into one combined, visible target-line challenge that requires
   both `m` and `b`.

The choice must retain deterministic validation using the two actual variables;
do not add a model-judged task.

### 4. Slope wording and animation review — `P2`

**Observation.** The content is mathematically consistent: `m` controls signed
direction and `|m|` controls steepness; `b` changes a vertical translation; the
intercept is `(0, b)`; and the final slope expression agrees with the displayed
reference points. The human editor still needs to confirm that the successive
`m = 1 → 3 → 0 → -2` and `b = 3 → -2` changes are perceptually clear and that
the word "try" is not misleading while autonomous playback continues.

## Editor playback checklist

Run each item once from **Preview** and once from **Start interacting**.

- Listen to every narrated beat. Mark any unnatural pronunciation, rushed
  transition, awkward pause, or mismatch between spoken words and the visible
  state.
- Verify the stated numerical values directly on the visual when the narrator
  says them.
- Observe camera framing at every new visual and variable animation. The main
  graph/array, formula, controls, and task must be readable without obscuring
  a teaching target.
- For the rectangle pack: set length to 5; confirm the tiled array visibly
  changes and the completion feedback appears. Decide whether that task proves
  sufficient for the intended age and outcomes.
- For the slope pack: set `m = -3`, `b = -2`, then `m = 2`; confirm the line,
  y-intercept, reference points, and task feedback remain consistent. Decide
  whether to keep three tasks or curate one combined task.
- Return to the launcher, reopen the same pack, and confirm the selected
  interaction instance keeps the learner's ink and variable state.
- Repeat the visual and touch checks on the physical 4K meeting display before
  any Android release candidate is produced.

## Local review environment

Run the dedicated Android-presentation review frontend at
`https://127.0.0.1:5175/`. Keep it separate from the operator's frontend on
port 5173 and stop it from the same terminal that started it.

The normal preview route deliberately requires an Octos account. The local
Octos Server authentication endpoint was unavailable when this review opened,
so a human playback session cannot start until the operator starts their normal
local server. Do not change the production authentication policy to bypass this
for the standard edition. A later locked Spotlight edition can have its own,
explicitly reviewed no-login policy.

## Approval record

| Pack | Content | Voice/pacing | Interaction | Meeting display | Decision | Editor / date |
| --- | --- | --- | --- | --- | --- | --- |
| Rectangle area and perimeter | Pending | Pending | Pending | Pending | Pending | |
| Slope and intercept | Pending | Pending | Pending | Pending | Pending | |
