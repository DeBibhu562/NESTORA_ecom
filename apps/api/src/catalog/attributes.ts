import type { AttributeDefinition } from "@prisma/client";

/** Returns human-readable problems; empty = valid. `requireAll` enforces isRequired (used when publishing). */
export function validateAttributes(attrs: Record<string, unknown>, defs: Pick<AttributeDefinition, "key" | "type" | "enumValues" | "isRequired" | "label">[], requireAll: boolean): string[] {
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const problems: string[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    const d = byKey.get(k);
    if (!d) { problems.push(`Unknown attribute "${k}"`); continue; }
    const ok =
      d.type === "TEXT" ? typeof v === "string" && v.length > 0 && v.length <= 500
      : d.type === "NUMBER" ? typeof v === "number" && Number.isFinite(v)
      : d.type === "BOOLEAN" ? typeof v === "boolean"
      : typeof v === "string" && d.enumValues.includes(v);
    if (!ok) problems.push(`Invalid value for "${d.label}"`);
  }
  if (requireAll) for (const d of defs) if (d.isRequired && attrs[d.key] === undefined) problems.push(`"${d.label}" is required`);
  return problems;
}
