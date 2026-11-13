/**
 * Client-side validators for the auth forms. These shape the UX only — a real deployment
 * validates again on the server. Messages say what to do, not just what is wrong.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;

export function emailError(value: string): string | undefined {
  const v = value.trim();
  if (!v) return "Enter your email address.";
  if (!EMAIL_RE.test(v)) return "Enter an email like name@clinic.in.";
  return undefined;
}

export function requiredError(value: string, message: string): string | undefined {
  return value.trim() ? undefined : message;
}

/** Indian mobile numbers: 10 digits starting 6–9. Spaces and dashes are ignored. */
export function mobileError(value: string): string | undefined {
  const digits = value.replace(/[\s-]/g, "");
  if (!digits) return "Enter a mobile number.";
  if (!/^\d+$/.test(digits)) return "Use digits only — +91 is added for you.";
  if (digits.length !== 10) return "Mobile numbers have 10 digits.";
  if (!/^[6-9]/.test(digits)) return "Indian mobile numbers start with 6, 7, 8 or 9.";
  return undefined;
}

export type StrengthScore = 0 | 1 | 2 | 3 | 4;

export interface Strength {
  score: StrengthScore;
  label: string;
  /** Plain-language next step, read out with the score. */
  advice: string;
  checks: { id: "length" | "case" | "number" | "symbol"; label: string; met: boolean }[];
}

/** Length + character variety. Score ≥ 2 is required to create an account. */
export function passwordStrength(pw: string): Strength {
  const lower = /[a-z]/.test(pw);
  const upper = /[A-Z]/.test(pw);
  const digit = /\d/.test(pw);
  const symbol = /[^A-Za-z0-9]/.test(pw);
  const variety = [lower, upper, digit, symbol].filter(Boolean).length;
  const checks: Strength["checks"] = [
    { id: "length", label: "8 or more characters", met: pw.length >= 8 },
    { id: "case", label: "Upper and lower case", met: lower && upper },
    { id: "number", label: "A number", met: digit },
    { id: "symbol", label: "A symbol", met: symbol },
  ];

  if (!pw) return { score: 0, label: "Not set", advice: "Use 8 or more characters.", checks };
  if (pw.length < 8) return { score: 1, label: "Too short", advice: `Add ${8 - pw.length} more character${8 - pw.length === 1 ? "" : "s"}.`, checks };
  if (variety <= 1) return { score: 1, label: "Weak", advice: "Mix in numbers, symbols or capitals.", checks };
  if (variety === 2) return { score: 2, label: "Fair", advice: "Add a symbol or a capital to make it stronger.", checks };
  if (variety === 3 && pw.length < 12) return { score: 3, label: "Good", advice: "Longer passwords are harder to guess.", checks };
  return { score: 4, label: "Strong", advice: "Good to go.", checks };
}

export function passwordError(pw: string): string | undefined {
  if (!pw) return "Create a password.";
  if (passwordStrength(pw).score < 2) return "Use at least 8 characters with a mix of letters and numbers or symbols.";
  return undefined;
}

/** "Starter, Team and Clinic" */
export function joinList(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
