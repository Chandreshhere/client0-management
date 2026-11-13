"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/cn";

/**
 * Kit `Input` with a show/hide toggle. The 32px toggle sits 4px inside the 40px field, so the
 * field's 14px corner and the button's round edge stay concentric.
 */
export function PasswordInput({ className, id, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} id={id} type={visible ? "text" : "password"} className={cn("pr-12", className)} spellCheck={false} autoCapitalize="none" />
      <IconButton
        label={visible ? "Hide password" : "Show password"}
        variant="ghost"
        size="sm"
        aria-controls={id}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1 top-1 text-muted"
        data-testid="toggle-password"
      >
        {visible ? <EyeSlash /> : <Eye />}
      </IconButton>
    </div>
  );
}
