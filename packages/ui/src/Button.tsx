import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" };

const styles = {
  primary: "bg-navy text-white hover:bg-navy/90",
  secondary: "bg-brand text-white hover:bg-brand-hover",
  ghost: "bg-transparent text-ink underline-offset-4 hover:underline",
};

export function Button({ variant = "primary", className, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-semibold transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className,
      )}
      {...rest}
    />
  );
}
