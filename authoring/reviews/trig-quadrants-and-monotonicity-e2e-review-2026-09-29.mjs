// 2026-09-29 E2E review. The formula y = sin θ, θ ∈ [3π/2, 2π]↑ is what the
// 3-2 narration explains, but it was written after the 3-3 narration and only
// shown during the silent pause before step 4. Write it while 3-2 speaks.
export const packId = "trig-quadrants-and-monotonicity";
export const summary = "the fourth-quadrant interval formula is written during the 3-2 narration that explains it";
export function apply(authoring, { beat, action }) {
  const formula = action("section-03/moment-03", (a) => a.do === "write" && a.as === "section-03-moment-03-item-01", "fourth-quadrant formula");
  const from = beat("section-03/moment-03").actions;
  from.splice(from.indexOf(formula), 1);
  if (!from.length) throw new Error("3-3 would have no action left");
  formula.when = "during_speech";
  beat("section-03/moment-02").actions.push(formula);
  return ["3-2: write the fourth-quadrant increasing-interval formula during the narration (moved from 3-3 after speech)"];
}
