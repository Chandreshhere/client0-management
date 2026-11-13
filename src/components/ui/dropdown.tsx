"use client";

import { DropdownMenu } from "radix-ui";
import { cloneElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { Check, CaretRight } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

/**
 * Dropdown menu (Radix) with keyboard navigation, typeahead and focus return.
 * Content pops from its trigger with the spring curve (see .anim-pop in globals.css).
 */
export const Dropdown = DropdownMenu.Root;
export const DropdownTrigger = DropdownMenu.Trigger;
export const DropdownGroup = DropdownMenu.Group;
export const DropdownSub = DropdownMenu.Sub;
export const DropdownRadioGroup = DropdownMenu.RadioGroup;

const panel = "anim-pop z-[70] min-w-[220px] overflow-hidden rounded-[20px] bg-surface p-2 text-sm text-ink shadow-pop ring-1 ring-line";

export function DropdownContent({ className, sideOffset = 8, align = "end", children, ...props }: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content sideOffset={sideOffset} align={align} collisionPadding={16} className={cn(panel, className)} {...props}>
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

const item =
  "relative flex h-10 cursor-pointer select-none items-center gap-3 rounded-[12px] px-3 outline-none transition-colors duration-150 " +
  "data-[highlighted]:bg-sunken data-[disabled]:pointer-events-none data-[disabled]:opacity-45 [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:text-muted data-[highlighted]:[&_svg]:text-ink";

export function DropdownItem({
  className,
  icon,
  shortcut,
  description,
  tone,
  asChild,
  children,
  ...props
}: ComponentProps<typeof DropdownMenu.Item> & { icon?: ReactNode; shortcut?: string; description?: ReactNode; tone?: "danger" }) {
  const cls = cn(item, description && "h-auto py-2", tone === "danger" && "text-danger [&_svg]:text-danger", className);
  const inner = (label: ReactNode) => (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {description ? <span className="block text-xs text-muted">{description}</span> : null}
      </span>
      {shortcut ? <kbd className="font-mono text-[11px] text-faint">{shortcut}</kbd> : null}
    </>
  );
  // asChild: Radix Slot needs exactly one child, so render our chrome *inside* the child (e.g. a Link).
  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string; children?: ReactNode }>;
    return (
      <DropdownMenu.Item asChild {...props}>
        {cloneElement(child, { className: cn(cls, child.props.className) }, inner(child.props.children))}
      </DropdownMenu.Item>
    );
  }
  return (
    <DropdownMenu.Item className={cls} {...props}>
      {inner(children)}
    </DropdownMenu.Item>
  );
}

export function DropdownCheckboxItem({ className, children, ...props }: ComponentProps<typeof DropdownMenu.CheckboxItem>) {
  return (
    <DropdownMenu.CheckboxItem className={cn(item, "pr-9", className)} {...props}>
      <span className="flex-1 truncate">{children}</span>
      <DropdownMenu.ItemIndicator className="absolute right-3">
        <Check weight="bold" className="!text-primary" />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.CheckboxItem>
  );
}

export function DropdownRadioItem({ className, children, description, ...props }: ComponentProps<typeof DropdownMenu.RadioItem> & { description?: ReactNode }) {
  return (
    <DropdownMenu.RadioItem className={cn(item, "pr-9", description && "h-auto py-2", className)} {...props}>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{children}</span>
        {description ? <span className="block text-xs text-muted">{description}</span> : null}
      </span>
      <DropdownMenu.ItemIndicator className="absolute right-3">
        <Check weight="bold" className="!text-primary" />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  );
}

export function DropdownLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={cn("px-3 pb-1 pt-2 text-xs text-muted", className)} {...props} />;
}

export function DropdownSeparator({ className, ...props }: ComponentProps<typeof DropdownMenu.Separator>) {
  return <DropdownMenu.Separator className={cn("my-1 h-px bg-line", className)} {...props} />;
}

export function DropdownSubTrigger({ className, icon, children, ...props }: ComponentProps<typeof DropdownMenu.SubTrigger> & { icon?: ReactNode }) {
  return (
    <DropdownMenu.SubTrigger className={cn(item, "data-[state=open]:bg-sunken", className)} {...props}>
      {icon}
      <span className="flex-1 truncate">{children}</span>
      <CaretRight className="!size-4" />
    </DropdownMenu.SubTrigger>
  );
}

export function DropdownSubContent({ className, ...props }: ComponentProps<typeof DropdownMenu.SubContent>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.SubContent sideOffset={8} collisionPadding={16} className={cn(panel, className)} {...props} />
    </DropdownMenu.Portal>
  );
}
