-- Applied after the Prisma migration; Prisma cannot express these.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "InventoryLevel"
  ADD CONSTRAINT inv_non_negative CHECK ("onHand" >= 0 AND "reserved" >= 0 AND "reserved" <= "onHand");
ALTER TABLE "Review"
  ADD CONSTRAINT review_rating CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "OrderItem"
  ADD CONSTRAINT oi_qty CHECK ("qty" > 0);
ALTER TABLE "Variant"
  ADD CONSTRAINT variant_price CHECK ("pricePaise" > 0 AND "mrpPaise" >= "pricePaise");

CREATE SEQUENCE IF NOT EXISTS order_seq START 100001;

CREATE INDEX product_attrs_gin  ON "Product" USING GIN ("attributes" jsonb_path_ops);
CREATE INDEX product_fts_gin    ON "Product" USING GIN ("searchVector");
CREATE INDEX product_title_trgm ON "Product" USING GIN ("title" gin_trgm_ops);

CREATE FUNCTION product_tsv() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('simple', coalesce(NEW."title",'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW."tagline",'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW."attributes"::text,'')), 'C');
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER product_tsv_trg BEFORE INSERT OR UPDATE ON "Product"
  FOR EACH ROW EXECUTE FUNCTION product_tsv();

-- one default address per user
CREATE UNIQUE INDEX address_one_default ON "Address" ("userId") WHERE "isDefault";
-- exactly one session owner
ALTER TABLE "Session"
  ADD CONSTRAINT session_one_owner CHECK (("userId" IS NULL) <> ("staffId" IS NULL));

-- append-only tables (run as the app role's owner; app role gets INSERT/SELECT only)
REVOKE UPDATE, DELETE ON "AuditLog", "StockMovement" FROM PUBLIC;
