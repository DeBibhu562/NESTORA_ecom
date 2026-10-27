import { Module } from "@nestjs/common";
import { CategoriesController } from "./categories.controller";
import { InventoryController } from "./inventory.controller";
import { MediaController } from "./media.controller";
import { ProductsController } from "./products.controller";
import { PublicCatalogController } from "./public/public.controller";
import { PublicCatalogService } from "./public/public.service";
import { StockAlertsController } from "./public/stock-alerts.controller";
import { ProductsService } from "./products.service";

@Module({ controllers: [CategoriesController, ProductsController, InventoryController, MediaController, PublicCatalogController, StockAlertsController], providers: [ProductsService, PublicCatalogService] })
export class CatalogModule {}
