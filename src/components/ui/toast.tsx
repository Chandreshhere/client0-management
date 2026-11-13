"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { pop } from "@/lib/motion";

/**
 * Toasts. Honest by design: demo actions say what actually happened ("Saved in this browser
 * session") — never "Payment received" or "Message delivered" without a confirmed integration.
 */
type ToastTone = "neutral" | "success" | "warning" | "danger";
type ToastItem = { id: number; title: string; description?: string; tone: ToastTone; action?: { label: string; onClick: () => void } };

const ToastCtx = createContext<{ toast: (t: Omit<ToastItem, "id" | "tone"> & { tone?: ToastTone }) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const icons: Record<ToastTone, ReactNode> = {
  neutral: <Info size={18} />,
  success: <CheckCircle size={18} weight="fill" className="text-[#5fd08f]" />,
  warning: <WarningCircle size={18} weight="fill" className="text-[#ffc35c]" />,
  danger: <WarningCircle size={18} weight="fill" className="text-[#ff8a80]" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (t: Omit<ToastItem, "id" | "tone"> & { tone?: ToastTone }) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-2), { id, tone: "neutral", ...t }]);
      window.setTimeout(() => dismiss(id), 5200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[min(380px,calc(100vw-32px))] flex-col items-end gap-2">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              transition={pop}
              role="status"
              className={cn("pointer-events-auto flex w-full items-start gap-3 rounded-[20px] bg-charcoal px-4 py-3 text-sm text-white shadow-pop")}
            >
              <span className="mt-0.5 shrink-0">{icons[t.tone]}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t.title}</p>
                {t.description ? <p className="mt-0.5 text-xs text-white/70">{t.description}</p> : null}
              </div>
              {t.action ? (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-medium hover:bg-white/25"
                >
                  {t.action.label}
                </button>
              ) : null}
              <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="-mr-1 shrink-0 rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white">
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
