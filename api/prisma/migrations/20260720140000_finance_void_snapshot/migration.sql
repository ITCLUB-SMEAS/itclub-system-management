-- AlterTable Transaction
ALTER TABLE "Transaction" ADD COLUMN "category" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "voidedAt" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN "voidedById" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_voidedAt_idx" ON "Transaction"("voidedAt");

-- CreateTable
CREATE TABLE "FinancialReport" (
    "id" TEXT NOT NULL,
    "periodId" TEXT,
    "income" DECIMAL(14,2) NOT NULL,
    "expense" DECIMAL(14,2) NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL,
    "txCount" INTEGER NOT NULL,
    "generatedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialReport_periodId_idx" ON "FinancialReport"("periodId");

-- CreateIndex
CREATE INDEX "FinancialReport_createdAt_idx" ON "FinancialReport"("createdAt");

-- AddForeignKey
ALTER TABLE "FinancialReport" ADD CONSTRAINT "FinancialReport_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "MembershipPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
