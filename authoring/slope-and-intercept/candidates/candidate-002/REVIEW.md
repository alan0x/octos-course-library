# Candidate 002 Review

## Verdict

This candidate is structurally valid but is **not publishable**.

Classification:

- `regenerate_after_shared_prompt_fix`

`candidate-001` contains only the preserved local-network transport failure;
this is the first completed production-pipeline candidate.

## Passed review

- The production generator created four focused sections and 13 narrated beats.
- One shared function plot binds both slope `m` and y-intercept `b` to the same
  live line.
- The lesson correctly describes positive, zero, and negative slopes, and
  distinguishes sign from absolute-value steepness.
- Numeric target activities expose their target values and operate the actual
  plot controls.

## Blocking defect: later sections do not know the executable numeric state

Section 2 ends by animating `m` to `-2` and then asks the learner to complete a
task at `m = 3`. Section 3 nevertheless begins by saying that `m` remains `1`.
After section 3 changes `b` and its activity ends at `b = 3`, section 4 speaks
as though the current graph were `y = x`.

The existing generation instruction said that values persist, but the formal
request for a later section contained only the outline and previous section
purposes. It did not contain the values actually produced by earlier section
animations and completed activities. The model therefore had no authoritative
starting state to follow.

This is a shared production-path defect, not a course-specific editorial issue.
The section prompt must include a program-derived `number_state_at_start`, with
completed activity targets taking precedence over earlier animations. Later
sections must treat that state as authoritative and animate explicitly before
describing another value.

Regenerate from the unchanged `generation-input.json` after that shared fix.
