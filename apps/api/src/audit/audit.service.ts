import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";

@Injectable()
export class AuditService {
  constructor(private readonly db: PrismaService) {}

  log(staffId: string | undefined, action: string, entityType: string, entityId: string, diff?: unknown, ip?: string) {
    return this.db.auditLog.create({
      data: { staffId, action, entityType, entityId, ip, diff: diff === undefined ? undefined : (diff as Prisma.InputJsonValue) },
    });
  }
}
