/** Client-side cookie helpers for demo preferences (role, sidebar). Not used for auth. */
export function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

export const COOKIE_ROLE = "cl_role";
export const COOKIE_SIDEBAR = "cl_sidebar";
export const COOKIE_PLAN = "cl_plan";
