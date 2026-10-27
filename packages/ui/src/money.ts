/** Money is integer paise end-to-end; these are the only places it meets rupees. */
export const formatPaise = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: p % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

/** "802", "802.5", "₹1,049.00" → paise; null when not a positive amount with ≤2 decimals. */
export function parseRupees(input: string): number | null {
  const s = input.replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const paise = Math.round(parseFloat(s) * 100);
  return paise > 0 ? paise : null;
}
