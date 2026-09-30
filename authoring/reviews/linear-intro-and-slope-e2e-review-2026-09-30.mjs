// 2026-09-30 E2E review. The last narration asks learners to set k to -1.5,
// but practice opened with the step 2 task (k = 2). The task the narration
// hands over to now comes first.
export const packId = "linear-intro-and-slope";
export const summary = "practice opens with the k = -1.5 task the closing narration asks for";
export function apply(authoring, { task }) {
  const handedOver = task("section-03-task-01");
  if (handedOver.completion.value !== -1.5) throw new Error("unexpected closing task");
  const tasks = authoring.lesson.tasks;
  tasks.splice(tasks.indexOf(handedOver), 1);
  tasks.unshift(handedOver);
  return ["practice: the k = -1.5 task is listed first, matching the closing narration"];
}
