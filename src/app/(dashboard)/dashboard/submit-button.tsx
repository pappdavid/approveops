"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

interface SubmitButtonProps {
  children: ReactNode;
  pendingLabel: string;
  name?: string;
  value?: string;
  variant?: "primary" | "secondary";
}

export function SubmitButton({
  children,
  pendingLabel,
  name,
  value,
  variant = "primary",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const className =
    variant === "primary"
      ? "rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
      : "rounded-md border bg-background px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <button type="submit" name={name} value={value} disabled={pending} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
