// The last practice accepts any angle in the second-quadrant interval
// (π/2, π), but its completion only accepted 2.1038 ± 0.0157. 4-2 asks
// learners to try it themselves while the teacher animated θ to the answer.
// The slider's step (6.28 / 200, stored as 0.031400000000000004) makes the
// browser's largest legal value 6.2486, so the 2π practice (6.28 ± 0.0157)
// could not be completed with the slider.
export const packId = "trig-quadrants-and-monotonicity";
export const summary = "practices reachable as stated; teacher no longer answers the last one";
export function apply(authoring, { beat, action, task }) {
  const practice = task("section-04-task-01");
  if (practice.completion.value !== 2.1038) throw new Error("unexpected practice target");
  // Centre of (π/2, π) with a tolerance just inside π/4 keeps both endpoints excluded.
  practice.completion = { ...practice.completion, value: 2.3562, tolerance: 0.78 };
  const fullTurn = task("section-03-task-01");
  if (fullTurn.completion.value !== 6.28) throw new Error("unexpected 2π target");
  fullTurn.completion = { ...fullTurn.completion, tolerance: 0.035 };
  const answer = action("section-04/moment-02", (a) => a.do === "animate", "animation");
  if (answer.value !== 2.09) throw new Error("unexpected animation");
  const actions = beat("section-04/moment-02").actions;
  actions.splice(actions.indexOf(answer), 1, { do: "point", target: "section-01-moment-01-item-01-circle", when: "during_speech" });
  return [
    "section-04 practice completion: 2.3562 ± 0.78, i.e. (π/2, π) as the prompt states",
    "section-03 practice tolerance 0.035 so the slider's largest value (6.2486) reaches 2π",
    "4-2: point at the unit circle instead of animating θ to the practice answer",
  ];
}
