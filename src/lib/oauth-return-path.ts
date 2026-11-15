export function oauthReturnPath(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(value)
  )
    return "/";
  try {
    const u = new URL(value, "https://app.invalid");
    return u.origin === "https://app.invalid" && !u.pathname.startsWith("//")
      ? u.pathname + u.search + u.hash
      : "/";
  } catch {
    return "/";
  }
}
