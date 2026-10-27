import { cx } from "./cx";

type Props = { value: number; onChange: (v: number) => void; min?: number; max?: number; className?: string };

export function Stepper({ value, onChange, min = 1, max = 99, className }: Props) {
  const btn = "grid size-11 place-items-center text-lg hover:bg-soft-hover disabled:opacity-40";
  return (
    <div role="group" aria-label="Quantity" className={cx("inline-flex items-center overflow-hidden rounded-full border border-line", className)}>
      <button type="button" className={btn} aria-label="Decrease quantity" disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <output aria-live="polite" className="min-w-8 text-center text-sm font-semibold">{value}</output>
      <button type="button" className={btn} aria-label="Increase quantity" disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}
