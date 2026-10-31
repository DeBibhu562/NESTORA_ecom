import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Limiter } from "./common/limiter.service";
import { AuditService } from "./audit/audit.service";
import { AuthController } from "./auth/auth.controller";
import { AuthGuard } from "./auth/auth.guard";
import { AuthService } from "./auth/auth.service";
import { CartController } from "./cart/cart.controller";
import { CartService } from "./cart/cart.service";
import { CustomerAuthController } from "./customer/customer-auth.controller";
import { CustomerAuthService } from "./customer/customer-auth.service";
import { Notifier } from "./notify/notifier.service";
import { CheckoutController } from "./checkout/checkout.controller";
import { CheckoutService } from "./checkout/checkout.service";
import { CustomersAdminController } from "./customer/customers-admin.controller";
import { BannersController } from "./settings/banners.controller";
import { CatalogExtrasController } from "./catalog/extras.controller";
import { OrderJobs } from "./orders/jobs.service";
import { OrderMessenger } from "./orders/messenger.service";
import { ShippingController, ShippingService } from "./shipping/shipping.service";
import { ReturnsController } from "./returns/returns.controller";
import { ReturnsService } from "./returns/returns.service";
import { StatsController } from "./stats/stats.controller";
import { OrdersAdminController } from "./checkout/orders-admin.controller";
import { CatalogModule } from "./catalog/catalog.module";
import { HealthController } from "./health/health.controller";
import { OffersController } from "./settings/offers.controller";
import { SettingsController } from "./settings/settings.controller";
import { SettingsService } from "./settings/settings.service";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  imports: [CatalogModule],
  controllers: [HealthController, AuthController, CartController, SettingsController, OffersController, CheckoutController, OrdersAdminController, CustomerAuthController, StatsController, CustomersAdminController, BannersController, CatalogExtrasController, ShippingController, ReturnsController],
  providers: [PrismaService, AuditService, Limiter, AuthService, CartService, CheckoutService, CustomerAuthService, Notifier, OrderMessenger, OrderJobs, ShippingService, ReturnsService, SettingsService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [PrismaService, AuditService, Limiter, Notifier],
})
export class AppModule {}
