import type { HTMLAttributes } from "react";
import { cx } from "./cx";

const tones = { discount: "bg-navy text-white", sale: "bg-brand text-white", success: "bg-success text-white", neutral: "bg-soft-hover text-ink" };

export function Badge({ tone = "neutral", className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone], className)} {...rest} />;
}
