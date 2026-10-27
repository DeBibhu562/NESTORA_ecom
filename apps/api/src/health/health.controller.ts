import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { Public } from "../auth/auth.types";
import { PrismaService } from "../prisma.service";

@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly db: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.db.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: "down", db: false });
    }
    return { status: "ok", db: true };
  }
}
