// Step 4 narrates a new pair of parallel lines (y = x + 1, y = x - 2), but the
// plot kept showing the intersecting pair. Bind both plotted lines to the
// declared (control-free) variables k1, b1, k2, b2 and animate line 2 to
// y = x - 2 while the narration introduces the parallel pair.
export const packId = "linear-simultaneous-intersections";
export const summary = "step 4 plot shows the narrated parallel lines";
export function apply(authoring, { action }) {
  const plot = action("section-01/moment-01", (a) => a.do === "write" && a.kind === "plot", "plot");
  const [first, second] = plot.content.curves;
  if (first.expression !== "(x)+(1)" || second.expression !== "(-(x))+(3)") throw new Error("unexpected source curves");
  first.expression = "((number_01)*(x))+(number_02)";
  first.label = "直线 ①";
  second.expression = "((number_03)*(x))+(number_04)";
  second.label = "直线 ②";
  const beat = authoring.steps.find((s) => s.key === "section-04").beats.find((b) => b.key === "moment-01");
  beat.actions.push(
    { do: "animate", variable: "number_03", value: 1, easing: "linear", duration_intent: "normal", when: "during_speech" },
    { do: "animate", variable: "number_04", value: -2, easing: "linear", duration_intent: "normal", when: "during_speech" },
  );
  return [
    "plot lines bound to k1/b1 and k2/b2 (labels 直线 ①/②; initial values unchanged)",
    "4-1: animate k2 -1 -> 1 and b2 3 -> -2 so line ② becomes y = x - 2, parallel to y = x + 1",
  ];
}
