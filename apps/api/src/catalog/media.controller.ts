import { BadRequestException, Body, Controller, Delete, HttpCode, NotFoundException, Param, Patch, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { imageSize } from "image-size";
import { memoryStorage } from "multer";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { Perm, Staff, type StaffClaims } from "../auth/auth.types";
import { ZodPipe } from "../common/zod.pipe";
import { env } from "../env";
import { PrismaService } from "../prisma.service";

const EXT: Record<string, string> = { jpg: "jpg", png: "png", webp: "webp", avif: "avif" };
const orderDto = z.object({ ids: z.array(z.string()).min(1) });
const metaDto = z.object({ alt: z.string().trim().min(3).max(200), optionValueId: z.string().optional(), variantId: z.string().optional() });

@Controller("admin")
export class MediaController {
  constructor(private readonly db: PrismaService, private readonly audit: AuditService) {}

  // shortcut: files go to local disk (served at /uploads); swap this method's write/unlink for S3 puts when object storage is wired (hardening/deploy)
  @Post("products/:id/media") @Perm("media:write")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  async upload(@Param("id") id: string, @UploadedFile() file: Express.Multer.File | undefined, @Body() raw: unknown, @Staff() s: StaffClaims) {
    if (!file) throw new BadRequestException("file is required");
    const meta = new ZodPipe(metaDto).transform(raw);
    const product = await this.db.product.findFirst({ where: { id, deletedAt: null }, include: { _count: { select: { media: true } } } });
    if (!product) throw new NotFoundException();
    if (meta.optionValueId && !(await this.db.optionValue.findFirst({ where: { id: meta.optionValueId, option: { productId: id } } }))) throw new BadRequestException("optionValueId does not belong to this product");
    if (meta.variantId && !(await this.db.variant.findFirst({ where: { id: meta.variantId, productId: id } }))) throw new BadRequestException("variantId does not belong to this product");

    // trust the bytes, not the client-declared mimetype or filename
    let dims: { width: number; height: number; type?: string };
    try { dims = imageSize(file.buffer) as typeof dims; } catch { throw new BadRequestException("Not a valid image"); }
    const ext = dims.type && EXT[dims.type];
    if (!ext || !dims.width || !dims.height) throw new BadRequestException("Only JPEG, PNG, WebP or AVIF images are allowed");

    const name = `${randomBytes(12).toString("hex")}.${ext}`;
    await mkdir(env.UPLOAD_DIR, { recursive: true });
    await writeFile(join(env.UPLOAD_DIR, name), file.buffer);
    const m = await this.db.productMedia.create({
      data: { productId: id, url: `${env.PUBLIC_API_URL}/uploads/${name}`, alt: meta.alt, width: dims.width, height: dims.height, position: product._count.media, optionValueId: meta.optionValueId, variantId: meta.variantId },
    });
    await this.audit.log(s.id, "media.upload", "Product", id, { mediaId: m.id });
    return m;
  }

  @Patch("products/:id/media/order") @Perm("media:write") @HttpCode(200)
  async reorder(@Param("id") id: string, @Body(new ZodPipe(orderDto)) b: z.infer<typeof orderDto>) {
    const own = await this.db.productMedia.count({ where: { productId: id, id: { in: b.ids } } });
    if (own !== b.ids.length) throw new BadRequestException("Unknown media id");
    await this.db.$transaction(b.ids.map((mid, position) => this.db.productMedia.update({ where: { id: mid }, data: { position } })));
    return { ok: true };
  }

  @Delete("media/:mediaId") @Perm("media:write") @HttpCode(204)
  async remove(@Param("mediaId") mediaId: string, @Staff() s: StaffClaims) {
    const m = await this.db.productMedia.delete({ where: { id: mediaId } });
    await unlink(join(env.UPLOAD_DIR, m.url.split("/").pop()!)).catch(() => undefined);
    await this.audit.log(s.id, "media.delete", "Product", m.productId, { mediaId });
  }
}
