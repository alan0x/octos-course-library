# Candidate 003 Review

## Verdict

This raw production-pipeline candidate is **not publishable yet**.

Classifications:

- `regenerate_after_shared_prompt_fix`
- `rejected_for_mathematical_or_pedagogical_quality`

The missing visual capability found in candidate 001 is resolved. The lesson
now uses a real rectangular array of unit squares with independent integer row
and column controls. One remaining state-continuity error makes the final
section visibly and mathematically inconsistent.

## Improvements over candidate 001

- The outline selects `rectangle_unit_square_array`; it no longer substitutes
  polygon or triangle rearrangement for a tiled rectangle.
- The compiled geometry contains rows, columns, a highlighted unit square, the
  covered interior, and bindings for both length and width.
- Both controls are normalized to integers in the supported range `1..8`.
- The four requested learning outcomes remain separated into four sections.
- The candidate compiled in four model calls with no rejected model parts.

## Blocking defect: narration ignores persistent numeric state

Section three animates the length from 4 to 5 and correctly states that the
rectangle then contains 15 unit squares. Numeric state persists across
sections. Section four nevertheless introduces the same visual as a 4 by 3
rectangle, states an area of 12 square centimetres and a perimeter of 14
centimetres, while the visible rectangle is still 5 by 3. Its only animation
sets the length to 5 again, so it cannot restore the stated 4 by 3 example.

This is not an editorial wording issue. Live-generated lessons can make the
same mistake whenever a later section assumes that a shared variable has reset
to its initial value. The production generation contract must explicitly state
that number state persists between sections and that narration using concrete
values must agree with the executable state.

## Non-blocking observations

- The visual range is intentionally limited to eight rows and eight columns.
  This keeps dynamic geometry bindings below the OLL maximum and is sufficient
  for the intended primary-school examples.
- The generated tasks each change exactly one variable and their executable
  completion checks agree with that variable. This fixes the candidate 001
  mismatch where one task claimed to change two dimensions but controlled only
  one.
- The lesson changes only length during its guided interaction. Width remains
  available to the learner after the lesson, but no guided task currently asks
  the learner to change it. This is acceptable for the approved fixed-height
  vertical slice, though a later curated target-area challenge may use both
  dimensions.

## Required shared change before regeneration

1. Tell section generation that number values persist across sections.
2. Require every concrete numeric description of an existing visual to agree
   with the most recent animation or the initial value if it has never changed.
3. Require an explicit animation back to a desired value before narration
   presents that value as the current state.
4. Reject decorative animations that set a variable to its current value
   without a teaching purpose.

After this shared prompt change, regenerate from the unchanged
`generation-input.json` and verify the full numeric timeline again.
