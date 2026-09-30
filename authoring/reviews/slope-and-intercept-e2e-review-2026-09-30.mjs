// 2026-09-30 E2E review. The point at x = 0 is the y-intercept that the b
// slider moves, but it was labelled "P(0, …)", so the plot never showed b.
export const packId = "slope-and-intercept";
export const summary = "the x = 0 point is labelled as the intercept b";
export function apply(authoring, { action }) {
  const plot = action("section-01/moment-01", (a) => a.do === "write" && a.kind === "plot", "linear function plot");
  const point = plot.content.points.find((candidate) => candidate.as === "reference-p");
  if (!point || point.x !== 0 || point.label !== "P(0, {y})") throw new Error("unexpected intercept point");
  point.label = "b：(0, {y})";
  return ["plot: label the point at x = 0 as the intercept b, with its live value"];
}
