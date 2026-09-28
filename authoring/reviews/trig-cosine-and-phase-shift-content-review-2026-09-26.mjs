// 4-2 wrote cos θ = sin(θ + π/2) a second time. The practice asks learners to
// drag θ to π/2, but the 3-3 animation already left θ at π/2. The 3-3
// narration says the cosine peak sits at x = 0, so animate θ to 0 there; this
// also leaves the practice meaningful without a newer player's start rule.
export const packId = "trig-cosine-and-phase-shift";
export const summary = "remove duplicated induction formula; 3-3 animates to the narrated cosine peak";
export function apply(authoring, { beat, action, task }) {
  const duplicate = action("section-04/moment-02", (a) => a.do === "write" && a.as === "section-04-moment-02-item-01", "duplicate formula");
  if (!String(duplicate.content?.latex).includes("\\sin\\left(\\theta + \\frac{\\pi}{2}\\right)")) throw new Error("unexpected duplicate content");
  const actions = beat("section-04/moment-02").actions;
  actions.splice(actions.indexOf(duplicate), 1);
  const note = action("section-04/moment-02", (a) => a.do === "write" && a.as === "section-04-moment-02-item-02", "key points note");
  note.place = { ...note.place, anchor: "section-04-moment-01-item-02" };
  const practice = task("section-03-task-01");
  if (practice.completion.value !== 1.57) throw new Error("unexpected practice target");
  const peak = action("section-03/moment-03", (a) => a.do === "animate", "animation");
  if (peak.value !== 1.57) throw new Error("unexpected animation target");
  peak.value = 0;
  return [
    "4-2: remove the duplicated cos θ = sin(θ + π/2) card (already written in 3-4)",
    "4-2: key points note re-anchored below the previous note",
    "3-3: animate θ to 0, the cosine peak the narration names (was π/2, the practice answer)",
  ];
}
