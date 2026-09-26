// 2-2 narrates the y = 0 section but focused the x = 0 figure, and it wrote the
// summary "z(t,0) … 极小, z(0,t) … 极大" before 2-3 derives the x = 0 case.
export const packId = "surface-saddle-point-analysis";
export const summary = "section focus matches narration; summary card follows both derivations";
export function apply(authoring, { beat, action }) {
  const both = action("section-02/moment-01", (a) => a.do === "focus", "focus");
  both.targets = ["section-01-moment-02-item-01", "section-01-moment-02-item-02"];
  const yZero = action("section-02/moment-02", (a) => a.do === "focus", "focus");
  if (JSON.stringify(yZero.targets) !== JSON.stringify(["section-01-moment-02-item-02"])) throw new Error("unexpected focus");
  yZero.targets = ["section-01-moment-02-item-01"];
  const summaryCard = action("section-02/moment-02", (a) => a.do === "write" && a.as === "section-02-moment-02-item-02", "summary card");
  const from = beat("section-02/moment-02").actions;
  from.splice(from.indexOf(summaryCard), 1);
  const to = beat("section-02/moment-04").actions;
  const plot = to.findIndex((a) => a.do === "write" && a.as === "section-02-moment-04-item-01");
  if (plot < 0) throw new Error("comparison plot not found");
  to.splice(plot + 1, 0, { ...summaryCard, when: "during_speech" });
  return [
    "2-1: focus both section figures (narration cuts along both axes)",
    "2-2: focus the y = 0 section figure the narration describes (was x = 0)",
    "summary card z(t,0) / z(0,t) moved from 2-2 to 2-4, after both derivations and with the comparison plot",
  ];
}
