# Candidate 003 Review

## Verdict

This candidate is improved but is **not publishable**.

Classification:

- `regenerate_after_shared_prompt_fix`

## Improvements over candidate 002

- Every later section received a program-derived numeric starting state.
- Section 3 correctly knows that the previous learner activity ended at
  `m = -2`.
- Section 4 explicitly resets `m` and `b` before describing `y = x`.
- The explanations of slope sign, absolute-value steepness, horizontal lines,
  vertical translation, and y-intercept are mathematically consistent.

## Blocking defect: the lesson invents controls that the plot does not expose

The outline declares four numbers: `m`, `b`, `x1`, and `x2`. The compiled plot
uses the coefficient-driven line and exposes only `m` and `b`; its two secant
reference points have fixed x-coordinates 0 and 1. The final section nevertheless
asks the learner to move point B's x-coordinate to 3. That control does not
exist in the executable visual, and the section has no executable learner task.

This mixes two mutually exclusive function-plot modes:

1. a line whose coefficients `m` and `b` are learner controls; and
2. a fixed line whose two sampled x-coordinates are learner controls.

For this lesson the first mode is authoritative. The generator must declare
only `m` and `b`, use the program-provided points `(0,b)` and `(1,m+b)` when
explaining slope, and never ask the learner to drag A or B.

Regenerate from the unchanged `generation-input.json` after that shared prompt
constraint is installed.
