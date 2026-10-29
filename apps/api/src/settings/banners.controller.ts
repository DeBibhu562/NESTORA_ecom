import { BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { imageSize } from "image-size";
import { memoryStorage } from "multer";
import { z } from "zod";
import { AuditService } from "../audit/audit.service";
import { Perm, Public, Staff, type StaffClaims } from "../auth/auth.types";
import { ZodPipe } from "../common/zod.pipe";
import { env } from "../env";
import { PrismaService } from "../prisma.service";

const SLOT = "home-hero";
const dto = z.object({
  title: z.string().trim().min(1).max(80), subtitle: z.string().trim().max(160).nullable(), ctaLabel: z.string().trim().max(30).nullable(),
  imageUrl: z.string().url().max(500), link: z.string().regex(/^\/[^/\s]/, "Use a path on this store, like /c/bottles").max(200).nullable(),
  position: z.number().int().min(1).max(50), isActive: z.boolean(),
});

@Controller()
export class BannersController {
  constructor(private readonly db: PrismaService, private readonly audit: AuditService) {}

  /** Live slides for the storefront home page. */
  @Public() @Get("catalog/banners")
  live() {
    const now = new Date();
    return this.db.banner.findMany({
      where: { slot: SLOT, isActive: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] },
      orderBy: { position: "asc" }, select: { id: true, title: true, subtitle: true, ctaLabel: true, imageUrl: true, link: true },
    });
  }

  @Get("admin/banners") @Perm("banner:read")
  list() { return this.db.banner.findMany({ where: { slot: SLOT }, orderBy: { position: "asc" } }); }

  @Post("admin/banners") @Perm("banner:write")
  async create(@Body(new ZodPipe(dto)) b: z.infer<typeof dto>, @Staff() s: StaffClaims) {
    const r = await this.db.banner.create({ data: { ...b, slot: SLOT } });
    await this.audit.log(s.id, "banner.create", "Banner", r.id, { title: b.title });
    return r;
  }

  @Put("admin/banners/:id") @Perm("banner:write")
  async update(@Param("id") id: string, @Body(new ZodPipe(dto)) b: z.infer<typeof dto>, @Staff() s: StaffClaims) {
    if (!(await this.db.banner.findUnique({ where: { id } }))) throw new NotFoundException();
    const r = await this.db.banner.update({ where: { id }, data: b });
    await this.audit.log(s.id, "banner.update", "Banner", id, { title: b.title });
    return r;
  }

  @Delete("admin/banners/:id") @Perm("banner:write") @HttpCode(204)
  async remove(@Param("id") id: string, @Staff() s: StaffClaims) {
    await this.db.banner.delete({ where: { id } }).catch(() => { throw new NotFoundException(); });
    await this.audit.log(s.id, "banner.delete", "Banner", id, {});
  }

  /** Returns a URL to put in the slide's imageUrl. Same byte-sniffing rules as product media. */
  @Post("admin/banners/image") @Perm("banner:write")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  async upload(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException("file is required");
    let t: string | undefined;
    try { t = (imageSize(file.buffer) as { type?: string }).type; } catch { throw new BadRequestException("Not a valid image"); }
    if (!t || !["jpg", "png", "webp", "avif"].includes(t)) throw new BadRequestException("Only JPEG, PNG, WebP or AVIF images are allowed");
    const name = `${randomBytes(12).toString("hex")}.${t}`;
    await mkdir(env.UPLOAD_DIR, { recursive: true });
    await writeFile(join(env.UPLOAD_DIR, name), file.buffer);
    return { url: `${env.PUBLIC_API_URL}/uploads/${name}` };
  }
}
