// 2026-09-28 E2E review. 4-1 writes the two interval formulas the narration
// summarises, but its focus named only the unit-circle group, so on a TV the
// formulas stayed off screen and the silent writing looked like a stall.
export const packId = "trig-quadrants-and-monotonicity";
export const summary = "4-1 focuses the interval formulas it writes";
export function apply(authoring, { action }) {
  const first = action("section-04/moment-01", (a) => a.do === "write" && a.as === "section-04-moment-01-item-01", "increasing interval formula");
  const second = action("section-04/moment-01", (a) => a.do === "write" && a.as === "section-04-moment-01-item-02", "monotonicity formula");
  const focus = action("section-04/moment-01", (a) => a.do === "focus", "focus");
  if (JSON.stringify(focus.targets) !== JSON.stringify(["section-01-moment-01-item-01"])) throw new Error("unexpected 4-1 focus");
  focus.targets = [first.as, second.as];
  focus.intent = "总结正弦函数在全实数域上的单调区间";
  return ["4-1: focus the two interval formulas instead of the unit-circle group"];
}
