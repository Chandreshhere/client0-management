"use client";

import { Checkbox as C, Select as S, Switch as Sw } from "radix-ui";
import { useId, type ComponentProps, type ReactNode } from "react";
import { CaretDown, Check, MagnifyingGlass, Minus } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

/** Form controls. 40px tall (8px grid), 14px radius; search is a full pill like the reference. */

const field =
  "w-full rounded-control bg-surface px-4 text-sm text-ink shadow-[inset_0_0_0_1px_var(--color-line)] outline-none transition-shadow duration-150 " +
  "hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] focus:shadow-[inset_0_0_0_2px_var(--color-primary)] aria-[invalid=true]:shadow-[inset_0_0_0_1.5px_var(--color-danger)] disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(field, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(field, "min-h-24 resize-y py-3 leading-relaxed", className)} {...props} />;
}

export function SearchInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <label className={cn("relative flex h-10 items-center", className)}>
      <MagnifyingGlass size={18} className="pointer-events-none absolute left-4 text-muted" aria-hidden="true" />
      <input
        type="search"
        className="h-full w-full rounded-full bg-surface pl-11 pr-4 text-sm text-ink shadow-[inset_0_0_0_1px_var(--color-line)] outline-none transition-shadow placeholder:text-faint hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)] focus:shadow-[inset_0_0_0_2px_var(--color-primary)]"
        {...props}
      />
    </label>
  );
}

/** Label + control + hint/error. Pass a render function to receive the generated id. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
  optional,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  optional?: boolean;
  className?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="flex items-baseline justify-between text-sm text-ink">
        <span>{label}</span>
        {optional ? <span className="text-xs text-muted">Optional</span> : null}
      </label>
      {children({ id, "aria-describedby": hint || error ? hintId : undefined, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={hintId} className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  id,
  ariaLabel,
  size = "md",
  disabled,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: {
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  options: { value: string; label: ReactNode; description?: ReactNode }[];
  placeholder?: string;
  className?: string;
  id?: string;
  ariaLabel?: string;
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  return (
    <S.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <S.Trigger
        id={id}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid || undefined}
        aria-describedby={ariaDescribedBy}
        className={cn(
          field,
          "inline-flex items-center justify-between gap-2 text-left data-[placeholder]:text-faint",
          size === "sm" ? "h-8 rounded-full px-3 text-xs" : "h-10",
          className,
        )}
      >
        <S.Value placeholder={placeholder} />
        <S.Icon>
          <CaretDown size={14} className="text-muted" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content position="popper" sideOffset={6} collisionPadding={16} className="anim-pop z-[75] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[20px] bg-surface p-2 shadow-pop ring-1 ring-line">
          <S.Viewport data-lenis-prevent>
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                className="relative flex min-h-10 cursor-pointer select-none items-center rounded-[12px] py-2 pl-3 pr-9 text-sm outline-none data-[highlighted]:bg-sunken data-[state=checked]:font-medium"
              >
                <div className="min-w-0">
                  <S.ItemText>{o.label}</S.ItemText>
                  {o.description ? <div className="text-xs font-normal text-muted">{o.description}</div> : null}
                </div>
                <S.ItemIndicator className="absolute right-3">
                  <Check size={16} weight="bold" className="text-primary" />
                </S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}

export function Switch({ className, ...props }: ComponentProps<typeof Sw.Root>) {
  return (
    <Sw.Root
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full bg-line-strong transition-colors duration-200 data-[state=checked]:bg-primary disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <Sw.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.2)] transition-transform duration-300 [transition-timing-function:var(--ease-spring-pop)] data-[state=checked]:translate-x-[18px]" />
    </Sw.Root>
  );
}

export function Checkbox({ className, ...props }: ComponentProps<typeof C.Root>) {
  return (
    <C.Root
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-[6px] bg-surface shadow-[inset_0_0_0_1.5px_var(--color-line-strong)] transition-colors data-[state=checked]:bg-charcoal data-[state=checked]:shadow-none data-[state=indeterminate]:bg-charcoal",
        className,
      )}
      {...props}
    >
      <C.Indicator className="group/cb text-white">
        {props.checked === "indeterminate" ? <Minus size={13} weight="bold" /> : <Check size={13} weight="bold" />}
      </C.Indicator>
    </C.Root>
  );
}
