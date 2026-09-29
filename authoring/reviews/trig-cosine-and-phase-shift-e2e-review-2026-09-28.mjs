// 2026-09-28 E2E review (TV 960×540 and web 1984×1286).
// 3-5 asked learners to drag the slider in the middle of the lesson, although
// practice opens only after the lesson and nobody moved θ. The teacher now
// demonstrates the full turn (narration revised in the paired review JSON).
// 4-2 narrates the key points while the focus named only the comparison plot,
// so the note it writes was never framed; the focus now includes the note.
export const packId = "trig-cosine-and-phase-shift";
export const summary = "3-5 teacher demonstrates the full turn of θ; 4-2 focuses the key-points note with the comparison plot";
export function apply(authoring, { beat, action }) {
  const sweepFocus = action("section-03/moment-05", (a) => a.do === "focus", "focus");
  if (beat("section-03/moment-05").actions.some((a) => a.do === "animate")) throw new Error("3-5 already animates");
  beat("section-03/moment-05").actions.push({
    do: "animate",
    variable: "number_01",
    value: 6.28,
    easing: "linear",
    duration_intent: "extended",
    when: "during_speech",
  });
  sweepFocus.intent = "观察 θ 转过一整周时余弦值的波峰、零点与波谷";
  const note = action("section-04/moment-02", (a) => a.do === "write" && a.as === "section-04-moment-02-item-02", "key points note");
  const focus = action("section-04/moment-02", (a) => a.do === "focus", "focus");
  if (JSON.stringify(focus.targets) !== JSON.stringify(["section-03-moment-02-item-01"])) throw new Error("unexpected 4-2 focus");
  focus.targets = [note.as, "section-03-moment-02-item-01"];
  return [
    "3-5: teacher animates θ from 0 to 2π while the narration walks through peak, zero and trough",
    "4-2: focus the key-points note together with the comparison plot it describes",
  ];
}
