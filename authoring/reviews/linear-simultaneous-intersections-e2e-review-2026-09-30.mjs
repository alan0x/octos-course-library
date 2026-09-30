// 2026-09-30 E2E review. The narration names the intersection (1, 2), but the
// plot drew only the two lines and its axis labels skip 1 and 2. A point bound
// to the intersection now shows its coordinates; while the lines are parallel
// (step 4) it has no position and is hidden (player 0.3.0).
export const packId = "linear-simultaneous-intersections";
export const summary = "the plot marks the lines' intersection with its coordinates";
export function apply(authoring, { action }) {
  const plot = action("section-01/moment-01", (a) => a.do === "write" && a.kind === "plot", "two-line plot");
  const expressions = plot.content.curves.map((curve) => curve.expression);
  if (JSON.stringify(expressions) !== JSON.stringify(["((number_01)*(x))+(number_02)", "((number_03)*(x))+(number_04)"])) {
    throw new Error("unexpected line expressions");
  }
  const x = "((number_04)-(number_02))/((number_01)-(number_03))";
  plot.content.points = [...(plot.content.points ?? []), { as: "intersection", x: 1, y: 2, label: "交点 ({x}, {y})" }];
  plot.content.bindings = [...(plot.content.bindings ?? []),
    { target: "intersection.x", expression: x, hide_when_undefined: true },
    { target: "intersection.y", expression: `((number_01)*(${x}))+(number_02)`, hide_when_undefined: true },
  ];
  return ["plot: mark the intersection of the two lines with live coordinates, hidden while they are parallel"];
}
