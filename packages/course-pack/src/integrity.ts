import { createHash } from "node:crypto";
export { isSafeCoursePackPath } from "./path.js";

export function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}
