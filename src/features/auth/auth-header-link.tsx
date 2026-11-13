"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS: Record<string, { prompt: string; label: string; href: string }> = {
  "/login": { prompt: "New to Carelane?", label: "Create a workspace", href: "/signup" },
  "/signup": { prompt: "Have an account?", label: "Sign in", href: "/login" },
  "/forgot-password": { prompt: "Remembered it?", label: "Sign in", href: "/login" },
};

/** Top-right cross-link of the auth screens (sign in ⇄ create workspace). */
export function AuthHeaderLink() {
  const pathname = usePathname();
  const link = LINKS[pathname];
  if (!link) return null;
  return (
    <p className="text-sm text-muted">
      <span className="hidden sm:inline">{link.prompt} </span>
      <Link href={link.href} className="rounded-full text-ink underline underline-offset-4 hover:text-primary-ink" data-testid="auth-header-link">
        {link.label}
      </Link>
    </p>
  );
}
