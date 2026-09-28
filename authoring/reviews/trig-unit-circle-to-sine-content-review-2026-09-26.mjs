// 3-1 wrote P = (cos θ, sin θ) a second time; point at the existing card
// instead. The practice prompt only asked learners to observe, while the
// narration and the completion target (θ = π/2) ask for the peak.
export const packId = "trig-unit-circle-to-sine";
export const summary = "remove duplicated P card; practice prompt matches its target";
export function apply(authoring, { beat, action, task }) {
  const duplicate = action("section-03/moment-01", (a) => a.do === "write" && a.as === "section-03-moment-01-item-01", "duplicate card");
  if (duplicate.content?.latex !== "P = (\\cos \\theta, \\sin \\theta)") throw new Error("unexpected duplicate content");
  const actions = beat("section-03/moment-01").actions;
  actions.splice(actions.indexOf(duplicate), 1, { do: "point", target: "section-01-moment-02-item-01", when: "during_speech" });
  const dependent = action("section-03/moment-03", (a) => a.do === "write" && a.as === "section-03-moment-03-item-01", "y = sin θ card");
  dependent.place = { ...dependent.place, anchor: "section-01-moment-02-item-01" };
  const practice = task("section-02-task-01");
  if (practice.completion.value !== 1.57) throw new Error("unexpected practice target");
  practice.prompt = "拖动滑块，把旋转角 θ 调到波峰位置（π/2，约 1.57），观察动点 P 的高度达到最大值 1，并与正弦曲线的最高点对应。";
  return [
    "3-1: point at the existing P = (cos θ, sin θ) card instead of writing a duplicate",
    "3-3: y = sin θ card re-anchored to the existing P card",
    "practice prompt names the peak target θ = π/2 used by its completion rule",
  ];
}
