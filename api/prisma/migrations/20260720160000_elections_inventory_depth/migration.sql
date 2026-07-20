-- Election
ALTER TABLE "Election" ADD COLUMN "description" TEXT;
ALTER TABLE "Election" ADD COLUMN "endsAt" TIMESTAMP(3);

-- Poll
ALTER TABLE "Poll" ADD COLUMN "closed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Poll" ADD COLUMN "endsAt" TIMESTAMP(3);

-- InventoryItem
ALTER TABLE "InventoryItem" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "InventoryItem" ADD COLUMN "serialNumber" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "notes" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- InventoryLoan
ALTER TABLE "InventoryLoan" ADD COLUMN "notes" TEXT;
ALTER TABLE "InventoryLoan" ADD COLUMN "dueDate" TIMESTAMP(3);
CREATE INDEX "InventoryLoan_status_idx" ON "InventoryLoan"("status");
CREATE INDEX "InventoryLoan_dueDate_idx" ON "InventoryLoan"("dueDate");
