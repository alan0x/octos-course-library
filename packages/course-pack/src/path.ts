/**
 * Return true only for normalized, relative POSIX paths.
 *
 * This helper intentionally has no Node dependency so archive readers can use
 * the exact same traversal protection in browsers and native WebViews.
 */
export function isSafeCoursePackPath(value: string): boolean {
  if (
    !value
    || value.length > 512
    || value.includes("\\")
    || value.includes("\0")
    || value.startsWith("/")
    || /^[A-Za-z]:/u.test(value)
  ) {
    return false;
  }
  const parts = value.split("/");
  return !parts.some((part) => part === "" || part === "." || part === "..");
}
