// 2026-09-28 E2E review. 3-1 pointed at the P = (cos θ, sin θ) formula and
// then focused the unit-circle group, so the camera visited the formula for a
// moment and came straight back. The narration is about P's height on the
// circle, so the pointer now targets the group as well.
export const packId = "trig-unit-circle-to-sine";
export const summary = "3-1 points at the unit-circle group instead of detouring to the formula";
export function apply(authoring, { action }) {
  const pointer = action("section-03/moment-01", (a) => a.do === "point", "pointer");
  if (pointer.target !== "section-01-moment-02-item-01") throw new Error("unexpected 3-1 pointer");
  pointer.target = "section-01-moment-01-item-01";
  return ["3-1: point at the unit-circle group that the narration describes"];
}
