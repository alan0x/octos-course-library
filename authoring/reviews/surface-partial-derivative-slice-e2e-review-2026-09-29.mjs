// 2026-09-29 E2E review. 4-2 asked which variable to fix for ∂z/∂y and gave
// the answer in the same sentence and on the note. The answer now opens after
// the lesson in a collapsed thinking-question card under that note; the
// narration change is in the paired review JSON.
export const packId = "surface-partial-derivative-slice";
export const summary = "4-2's question is answered in a collapsed card after the lesson instead of on the note";
export function apply(authoring, { action }) {
  const note = action("section-04/moment-02", (a) => a.do === "write" && a.as === "section-04-moment-02-item-01", "summary note");
  // Both the answer line and the "after class: keep x = 1" line give the
  // answer away during the lesson; the practice panel states it afterwards.
  const items = note.content.items;
  for (const prefix of ["答：", "课后应用："]) {
    const index = items.findIndex((item) => item.startsWith(prefix));
    if (index < 0) throw new Error(`the note no longer has its '${prefix}' line`);
    items.splice(index, 1);
  }
  authoring.lesson.reflections = [...(authoring.lesson.reflections ?? []), {
    as: "section-04-reflection-01",
    prompt: "在点 P(1,1,2) 处求 ∂z/∂y，应该固定哪一个变量？",
    answer: "应固定 x = 1，沿 y 方向截取曲面，得到截线 z = 1 + y²；它在 y = 1 处的切线斜率就是 ∂z/∂y = 2y = 2。",
    anchor: note.as,
    availability: { kind: "after_lesson" },
  }];
  return [
    "4-2: remove the answer line and the line naming x = 1 from the note",
    "add a thinking-question card under the 4-2 note with the answer collapsed",
  ];
}
