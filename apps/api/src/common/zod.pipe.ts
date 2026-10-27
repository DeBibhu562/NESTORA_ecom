import { BadRequestException, PipeTransform } from "@nestjs/common";
import type { ZodTypeAny, z } from "zod";

export class ZodPipe<T extends ZodTypeAny> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const r = this.schema.safeParse(value);
    if (!r.success) throw new BadRequestException({ title: "Validation failed", errors: r.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
    return r.data;
  }
}
