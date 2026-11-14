import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import { DemoFlag } from "@/components/ui/misc";

/** Public site footer: product links, demo entry points and the prototype disclosure. */
const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#anatomy", label: "Anatomy by condition" },
      { href: "/#product", label: "Workspaces" },
      { href: "/#journey", label: "Care journey" },
      { href: "/#workflows", label: "Assignments" },
      { href: "/#modules", label: "Modules" },
      { href: "/#india", label: "India-first details" },
    ],
  },
  {
    title: "Plans",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/pricing#calculator", label: "Cost calculator" },
      { href: "/pricing#compare", label: "Compare plans" },
      { href: "/pricing#add-ons", label: "Add-ons" },
      { href: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Try it",
    links: [
      { href: "/demo", label: "Live demo" },
      { href: "/login", label: "Log in" },
      { href: "/signup", label: "Create an account" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="px-4 pb-8 pt-8 sm:px-6 md:px-8 md:pb-12 lg:px-12 xl:px-16">
      <div className="mx-auto max-w-[1312px] rounded-card bg-surface p-6 md:p-10">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <div className="col-span-2 max-w-[360px] md:col-span-1">
            <Logo href="/" />
            <p className="mt-4 text-sm text-muted">
              Clinic management software for clinics that combine medicine, nutrition and yoga — one shared patient record, seven focused workspaces.
            </p>
            <DemoFlag className="mt-6">Prototype · synthetic data</DemoFlag>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-xs text-muted">{col.title}</p>
              <ul className="mt-4 flex flex-col gap-3">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-ink-2 transition-colors hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs text-muted md:flex-row md:items-center md:justify-between">
          <p>© 2026 Carelane. A UI prototype — every patient, practitioner and clinic shown is fictional.</p>
          <p>Prices in Indian rupees (INR).</p>
        </div>
      </div>
    </footer>
  );
}
