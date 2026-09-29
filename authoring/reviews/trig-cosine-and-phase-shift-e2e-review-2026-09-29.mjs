// 2026-09-29 E2E review. Step 4 wrote three cards, so it opened its own
// column at the far end of an already long row and the finished course could
// only be shown at a small scale. Its first card, x = cos θ, repeats the first
// line of the note written with it ("单位圆上动点 P 的横坐标等于 cos θ").
// Without it step 4 has two cards and continues under step 3's column.
export const packId = "trig-cosine-and-phase-shift";
export const summary = "4-1 drops the x = cos θ card that its note repeats, so step 4 fits under step 3";
export function apply(authoring, { beat, action }) {
  const formula = action("section-04/moment-01", (a) => a.do === "write" && a.as === "section-04-moment-01-item-01", "x = cos θ formula");
  const note = action("section-04/moment-01", (a) => a.do === "write" && a.as === "section-04-moment-01-item-02", "geometric meaning note");
  if (!note.content.items.some((item) => item.includes("横坐标等于 cos θ"))) throw new Error("the note no longer states x = cos θ");
  const actions = beat("section-04/moment-01").actions;
  actions.splice(actions.indexOf(formula), 1);
  note.place = { ...note.place, anchor: "section-03-moment-04-item-01" };
  const focus = action("section-04/moment-01", (a) => a.do === "focus", "focus");
  focus.targets = focus.targets.map((target) => target === formula.as ? note.as : target);
  return [
    "4-1: remove the x = cos θ card (the note's first line states it)",
    "4-1: the note is placed below the step 3 formulas and joins the focus with the unit circle",
  ];
}
