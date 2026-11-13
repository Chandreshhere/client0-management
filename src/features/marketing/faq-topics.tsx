"use client";

import { ArrowDown } from "@phosphor-icons/react";
import { AnchorLink } from "./anchor-link";

/**
 * Topic index beside the FAQ list: each row jumps to the first question of its topic and opens
 * it (a scripted jump skips the browser's own auto-expand of a closed <details>).
 */
export function FaqTopics({ topics }: { topics: readonly { label: string; ids: readonly string[] }[] }) {
  return (
    <nav aria-label="FAQ topics" className="mt-10 hidden lg:block">
      <p className="text-xs text-muted">Questions by topic</p>
      <ul className="mt-3 flex flex-col">
        {topics.map((t) => {
          const target = `faq-${t.ids[0]}`;
          return (
            <li key={t.label} className="border-t border-line last:border-b">
              <AnchorLink
                href={`#${target}`}
                onClick={() => {
                  const el = document.getElementById(target);
                  if (el instanceof HTMLDetailsElement) el.open = true;
                }}
                className="group flex h-12 items-center justify-between gap-4 text-sm text-ink-2 transition-colors hover:text-ink"
              >
                <span>{t.label}</span>
                <span className="flex items-center gap-3 text-muted">
                  <span className="tabular-nums" aria-label={`${t.ids.length} ${t.ids.length === 1 ? "question" : "questions"}`}>
                    {t.ids.length}
                  </span>
                  <ArrowDown size={14} aria-hidden="true" className="transition-transform duration-300 [transition-timing-function:var(--ease-spring-pop)] group-hover:translate-y-0.5" />
                </span>
              </AnchorLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
