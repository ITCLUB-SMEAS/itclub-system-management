-- AlterTable
ALTER TABLE "Event" ADD COLUMN "location" TEXT;
ALTER TABLE "Event" ADD COLUMN "capacity" INTEGER;
ALTER TABLE "Event" ADD COLUMN "registrationOpen" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Event" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
