import { createHash } from "node:crypto";
import { posix } from "node:path";

export function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isSafeCoursePackPath(value: string): boolean {
  if (!value || value.length > 512 || value.includes("\\") || value.includes("\0")) {
    return false;
  }
  if (value.startsWith("/") || /^[A-Za-z]:/u.test(value)) return false;
  if (value.split("/").some((part) => part === "" || part === "." || part === "..")) {
    return false;
  }
  return posix.normalize(value) === value;
}
