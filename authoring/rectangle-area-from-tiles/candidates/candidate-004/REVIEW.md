# Candidate 004 Review

## Verdict

This candidate is close to the curated-course baseline but is **not yet
publishable**.

Classification:

- `regenerate_after_shared_prompt_fix`

## Improvements over candidate 003

- All 11 beats keep executable numeric state and narration consistent.
- The final section explicitly changes the rectangle to 5 by 3 before naming
  those dimensions.
- The lesson is concise enough for the approved vertical slice: four focused
  sections and 11 narrated beats.
- The unit-square array, integer controls, formulas, units, and row-column
  reasoning agree.
- Generation completed in four model calls without a rejected part.

## Remaining defect: assigned comparison is not completed

The fourth request part asks for one nearby example that distinguishes area
from perimeter. The final section introduces a 5 by 3 rectangle and correctly
defines both ideas, but it never calculates the example's area (`15 cm²`) or
perimeter (`16 cm`). The section therefore describes the distinction without
completing its assigned worked comparison.

This is a general generation-coverage defect. A section must explicitly answer
or calculate the request part assigned to it; naming the relevant concepts is
not enough.

## Remaining defect: hidden interaction target

The generated task asks the learner to adjust the length and observe what
happens. Its executable completion condition silently expects the value 5.
Because the visible prompt never states 5, the learner cannot know what action
completes the task.

For an exact numeric target task, the visible prompt must state the same target
value as the executable completion condition. Open exploration should not have
a hidden exact-value completion condition.

## Required shared change before regeneration

1. Require every section to explicitly answer each request part assigned to it,
   including the numerical result of a requested worked example.
2. Require a numeric target activity's prompt to name its target value and
   agree with the activity value.

Regenerate from the unchanged `generation-input.json` after these production
prompt constraints are installed.
