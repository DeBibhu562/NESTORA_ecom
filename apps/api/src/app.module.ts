import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuditService } from "./audit/audit.service";
import { AuthController } from "./auth/auth.controller";
import { AuthGuard } from "./auth/auth.guard";
import { AuthService } from "./auth/auth.service";
import { CartController } from "./cart/cart.controller";
import { CartService } from "./cart/cart.service";
import { CatalogModule } from "./catalog/catalog.module";
import { HealthController } from "./health/health.controller";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  imports: [CatalogModule],
  controllers: [HealthController, AuthController, CartController],
  providers: [PrismaService, AuditService, AuthService, CartService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [PrismaService, AuditService],
})
export class AppModule {}
