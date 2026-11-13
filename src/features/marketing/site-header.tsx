"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLenis } from "lenis/react";
import { LayoutGroup, motion } from "motion/react";
import { useEffect, useState, type MouseEvent } from "react";
import { ArrowUpRight, List } from "@phosphor-icons/react";
import { Logo } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, SheetContent } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";
import { snappy } from "@/lib/motion";
import { CtaLink } from "./cta";

/**
 * Public site header. Sticky; at the top it is a transparent bar, once the page scrolls it
 * contracts into a blurred white capsule. On "/" the charcoal pill follows the section in view
 * (scroll-spy); on /pricing it marks Pricing. Mobile gets a Radix sheet.
 */
const NAV = [
  { id: "product", label: "Product" },
  { id: "workflows", label: "Workflows" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
] as const;
type NavId = (typeof NAV)[number]["id"];

const isNavId = (v: string | undefined): v is NavId => NAV.some((n) => n.id === v);

export function SiteHeader() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const lenis = useLenis();
  const [compact, setCompact] = useState(false);
  const [spy, setSpy] = useState<NavId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setCompact(window.scrollY > 24));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Scroll-spy: the section crossing a band just above the middle of the viewport wins.
  useEffect(() => {
    if (!isHome) return;
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-nav]"));
    if (!sections.length) return;
    const inBand = new Set<HTMLElement>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) inBand.add(e.target as HTMLElement);
          else inBand.delete(e.target as HTMLElement);
        }
        const current = sections.filter((s) => inBand.has(s)).pop();
        const id = current?.dataset.nav;
        setSpy(isNavId(id) ? id : null);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [isHome]);

  const active: NavId | null = isHome ? spy : pathname.startsWith("/pricing") ? "pricing" : null;
  const hrefFor = (id: NavId) => (isHome ? `#${id}` : id === "pricing" ? "/pricing" : `/#${id}`);

  // Same-page anchors: Lenis' anchor handler does the smooth scroll; stop the native jump and keep
  // the URL in sync. Without Lenis the browser's own jump is left alone.
  const onAnchor = (e: MouseEvent<HTMLAnchorElement>, id: NavId) => {
    if (!lenis) return;
    e.preventDefault();
    lenis.scrollTo(`#${id}`, { offset: -96 });
    window.history.replaceState(null, "", `#${id}`);
  };

  const onMobileItem = (e: MouseEvent<HTMLAnchorElement>, id: NavId) => {
    setMenuOpen(false);
    if (!isHome) return;
    e.preventDefault();
    window.history.replaceState(null, "", `#${id}`);
    // Wait for the sheet to release the scroll lock (Lenis restarts when it does).
    window.setTimeout(() => {
      const el = document.getElementById(id);
      if (lenis) lenis.scrollTo(`#${id}`, { offset: -88 });
      else el?.scrollIntoView();
    }, 280);
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 px-4 transition-[padding] duration-500 [transition-timing-function:var(--ease-spring)] sm:px-6 md:px-8 lg:px-12 xl:px-16",
        compact ? "pt-2" : "pt-4",
      )}
    >
      <div
        className={cn(
          "mx-auto flex items-center gap-2 rounded-full pl-4 pr-2 transition-[max-width,height,background-color,box-shadow] duration-500 [transition-timing-function:var(--ease-spring)] md:pl-6",
          compact
            ? "h-14 max-w-[1104px] bg-surface/80 shadow-[inset_0_0_0_1px_var(--color-line),0_16px_40px_-28px_rgb(33_38_34/0.35)] backdrop-blur-xl backdrop-saturate-150"
            : "h-16 max-w-[1312px] bg-transparent",
        )}
      >
        <Logo href="/" className="shrink-0" />

        <LayoutGroup id="site-nav">
          <nav aria-label="Main" className="mx-auto hidden items-center gap-1 lg:flex">
            {NAV.map((item) => {
              const on = active === item.id;
              const cls = cn(
                "relative inline-flex h-10 items-center rounded-full px-4 text-sm transition-colors duration-200",
                on ? "text-white" : "text-ink-2 hover:bg-sunken hover:text-ink",
              );
              const inner = (
                <>
                  {on ? <motion.span layoutId="site-nav-pill" transition={snappy} className="absolute inset-0 rounded-full bg-charcoal" /> : null}
                  <span className="relative z-[1]">{item.label}</span>
                </>
              );
              return isHome ? (
                <a key={item.id} href={hrefFor(item.id)} onClick={(e) => onAnchor(e, item.id)} aria-current={on ? "location" : undefined} className={cls}>
                  {inner}
                </a>
              ) : (
                <Link key={item.id} href={hrefFor(item.id)} aria-current={on ? "page" : undefined} className={cls}>
                  {inner}
                </Link>
              );
            })}
          </nav>
        </LayoutGroup>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Button asChild variant="ghost" className="hidden lg:inline-flex">
            <Link href="/login">Log in</Link>
          </Button>
          <CtaLink href="/demo" size="md" className="hidden sm:inline-flex">
            Try live demo
          </CtaLink>
          <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
            <DialogTrigger asChild>
              <IconButton label="Open menu" variant="white" className="lg:hidden">
                <List />
              </IconButton>
            </DialogTrigger>
            <SheetContent
              title="Menu"
              description="Carelane — clinic management software"
              footer={
                <div className="flex w-full flex-col gap-2">
                  <CtaLink href="/demo" className="w-full justify-between" onClick={() => setMenuOpen(false)}>
                    Try the live demo
                  </CtaLink>
                  <Button asChild variant="secondary" size="lg" className="w-full">
                    <Link href="/login" onClick={() => setMenuOpen(false)}>
                      Log in
                    </Link>
                  </Button>
                </div>
              }
            >
              <nav aria-label="Main">
                <ul className="flex flex-col">
                  {NAV.map((item) => {
                    const cls =
                      "group flex h-16 items-center justify-between rounded-inner px-2 text-[24px] font-light tracking-[-0.02em] text-ink transition-colors hover:bg-canvas";
                    const inner = (
                      <>
                        {item.label}
                        <span className="flex size-10 items-center justify-center rounded-full bg-sunken text-ink transition-transform duration-500 [transition-timing-function:var(--ease-spring-pop)] group-hover:rotate-45">
                          <ArrowUpRight size={18} aria-hidden="true" />
                        </span>
                      </>
                    );
                    return (
                      <li key={item.id}>
                        {isHome ? (
                          <a href={hrefFor(item.id)} onClick={(e) => onMobileItem(e, item.id)} className={cls}>
                            {inner}
                          </a>
                        ) : (
                          <Link href={hrefFor(item.id)} onClick={() => setMenuOpen(false)} className={cls}>
                            {inner}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <p className="mt-6 px-2 text-xs text-muted">Prototype · synthetic data. Nothing you do in the demo leaves your browser session.</p>
            </SheetContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
