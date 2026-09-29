// 2026-09-29 E2E review. 4-4 poses the self-check question and 4-5 answered
// it at once. The lesson now ends on the question; the answer opens after the
// lesson in a collapsed thinking-question card under the question note.
// Removing 4-5 needs no new narration audio.
export const packId = "surface-saddle-point-analysis";
export const summary = "4-4's self-check question is answered in a collapsed card after the lesson instead of in 4-5";
export function apply(authoring, { action, removeBeat }) {
  const question = action("section-04/moment-04", (a) => a.do === "write" && a.as === "section-04-moment-04-item-01", "question note");
  removeBeat("section-04/moment-05");
  authoring.lesson.reflections = [...(authoring.lesson.reflections ?? []), {
    as: "section-04-reflection-01",
    prompt: "如果一个曲面在某点沿 x 轴和 y 轴两个方向都达到局部极小，能否断言该点就是局部极小值点？为什么？",
    answer: "不能。坐标轴只是两个特定方向：即使沿 x 轴和 y 轴函数值都增加，沿其他斜向路径仍可能减小。例如 f(x,y) = x² + y² − 3xy 在原点沿两条坐标轴都是 t² ≥ 0，沿 y = x 却是 −t² < 0。判断局部极小必须保证该点的整个邻域内都有 f(x,y) ≥ f(p₀)。",
    anchor: question.as,
    availability: { kind: "after_lesson" },
  }];
  return [
    "remove 4-5, which answered the question immediately (and its conclusion formula)",
    "add a thinking-question card under the 4-4 question note with the answer collapsed",
  ];
}
