// 2026-09-29 E2E review. Step 3 repeated step 2 almost sentence by sentence
// (3-1≈2-1, 3-2≈2-2, 3-3≈2-3); only 3-3 added the y = sin θ formula. Write
// that formula in 2-3, which narrates the same unfolding, and keep step 3 as
// the summary. Remaining narration is unchanged, so its audio is reused.
export const packId = "trig-unit-circle-to-sine";
export const summary = "remove the repeated 3-1 to 3-3; y = sin θ is written in 2-3; step 3 keeps the summary";
export function apply(authoring, { beat, action, removeBeat }) {
  const formula = action("section-03/moment-03", (a) => a.do === "write" && a.as === "section-03-moment-03-item-01", "y = sin θ formula");
  formula.when = "during_speech";
  beat("section-02/moment-03").actions.push(formula);
  for (const key of ["section-03/moment-01", "section-03/moment-02", "section-03/moment-03"]) removeBeat(key);
  return [
    "2-3: write y = sin θ while the narration unfolds P's height into the sine curve",
    "remove 3-1, 3-2 and 3-3, which repeated 2-1, 2-2 and 2-3",
  ];
}
