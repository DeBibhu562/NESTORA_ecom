ALTER TABLE "Order" ADD COLUMN "deliveredAt" TIMESTAMP(3), ADD COLUMN "internalNote" TEXT;
ALTER TABLE "Refund" ADD COLUMN "returnId" TEXT, ADD COLUMN "method" TEXT NOT NULL DEFAULT 'ORIGINAL', ADD COLUMN "utr" TEXT, ADD COLUMN "paidAt" TIMESTAMP(3);

CREATE SEQUENCE IF NOT EXISTS return_seq START 100001;
-- existing ReturnRequest table is empty (feature unused), so adding NOT NULL columns is safe
ALTER TABLE "ReturnRequest" ADD COLUMN "returnNumber" TEXT NOT NULL, ADD COLUMN "details" TEXT, ADD COLUMN "refundMethod" TEXT, ADD COLUMN "refundDetails" TEXT, ADD COLUMN "pickupAwb" TEXT, ADD COLUMN "rejectReason" TEXT, ADD COLUMN "decidedBy" TEXT, ADD COLUMN "decidedAt" TIMESTAMP(3), ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "ReturnRequest_returnNumber_key" ON "ReturnRequest"("returnNumber");
CREATE INDEX "ReturnRequest_status_idx" ON "ReturnRequest"("status");

CREATE TABLE "ReturnEvent" (
  "id" TEXT NOT NULL, "returnId" TEXT NOT NULL, "type" TEXT NOT NULL, "message" TEXT, "actor" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReturnEvent_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ReturnEvent_returnId_createdAt_idx" ON "ReturnEvent"("returnId", "createdAt");

CREATE TABLE "OrderMessage" (
  "id" TEXT NOT NULL, "orderId" TEXT NOT NULL, "template" TEXT NOT NULL, "channel" TEXT NOT NULL, "toAddress" TEXT NOT NULL, "ok" BOOLEAN NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "OrderMessage_orderId_createdAt_idx" ON "OrderMessage"("orderId", "createdAt");
