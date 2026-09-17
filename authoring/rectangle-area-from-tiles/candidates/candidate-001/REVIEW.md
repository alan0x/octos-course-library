# Candidate 001 Review

## Verdict

This raw production-pipeline candidate is **not publishable**.

Classifications:

- `blocked_by_missing_visual_capability`
- `regenerate_after_compiler_or_validator_fix`
- `rejected_for_mathematical_or_pedagogical_quality`

The four-section instructional structure and most narration are usable as a
baseline. The central visual proof and the learner interaction are not.

## What the production pipeline did well

- It separated the four requested learning outcomes into four independently
  testable sections instead of compressing the lesson into one section.
- The verbal progression is coherent: define area, count rows and columns,
  derive `area = length × width`, then contrast area with perimeter.
- The numerical statements `5 × 3 = 15`, `(5 + 3) × 2 = 16 cm`, and
  `5 × 3 = 15 cm²` are mathematically correct.
- The final authoring document passed the current Lesson Plan and OLL
  compilation path.

## Blocking defect: the requested unit-square visual does not exist

The learner request requires a rectangle visibly tiled by equal unit squares.
The current capability registry has no such visual. The outline therefore
selected `geometric_rearrangement`, whose supported constructions are
polygon-proof templates (`right_triangle_square`, `square_area_identity`, and
`triangle_to_rectangle`).

The compiled section-two visual is consequently a collection of triangle
pieces and a target polygon, even though the narration claims that the learner
is looking at five unit squares per row and three rows. Section four repeats
the same mismatch and even produces a square/triangle construction carrying a
Pythagorean-style edge label. The visible mathematics contradicts the spoken
lesson.

The section-one `process_diagram` is only a textual flow chart. It describes
tiling but cannot demonstrate it, so it does not satisfy the required visual
grounding either.

This must be fixed as a shared `learning-coach` capability. It must not be
hand-authored only inside this CoursePack.

## Blocking defect: the interaction promises two controls but exposes one

The third section asks the learner to set length to 6 cm and width to 4 cm.
The generated activity contains only one numeric control (`number_01`) and its
completion condition checks only that number. `number_02`, the width, has no
control. A learner can therefore complete the task without doing what the
prompt requires.

The current validator accepts this disagreement between the prompt, hints,
success message, allowed operations, and completion expression. This is a
shared compiler/validator defect, not an editorial issue.

## Generation-path evidence

- Provider/model: local development profile, `gemini-3.6-flash`.
- Generation time: 46.0 seconds.
- Model calls: 8.
- The combined bootstrap response was rejected for duplicating a course visual.
- The first repaired outline was rejected for another duplicate visual.
- Section four required a second attempt because its first comparison visual
  differed only cosmetically.
- The deterministic sanitizer removed one exact duplicate note.

These repairs demonstrate that the production validation path is active, but
they also show that passing the existing validator is insufficient to prove
instructional or visual correctness.

## Required shared implementation before regeneration

1. Add a production visual capability for a rectangular array of equal unit
   squares with independent integer row and column counts.
2. Expose stable semantic parts for the whole rectangle, one row, one column,
   an individual unit square, the interior, and the boundary so narration can
   point and focus accurately.
3. Bind length and width to integer-valued controls and derive the visible
   square count from their product.
4. Support a two-number learner target, or reject an activity whose prompt
   requires two changed quantities while its executable contract controls only
   one.
5. Make capability selection return `unsupported` instead of substituting an
   unrelated geometric proof when a tiled-array lesson cannot be represented.
6. Add production-generation, compilation, validation, and playback tests for
   the `5 × 3` baseline and a learner change to `6 × 4`.

After these shared changes, regenerate this candidate from the unchanged
`generation-input.json` and compare the result with this preserved raw
baseline.
