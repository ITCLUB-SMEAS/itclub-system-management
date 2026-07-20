-- AlterTable Activity
ALTER TABLE "Activity" ADD COLUMN "geofenceRadiusM" INTEGER;
ALTER TABLE "Activity" ADD COLUMN "qrTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "Activity" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- AlterTable Attendance
ALTER TABLE "Attendance" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Attendance" ADD COLUMN "longitude" DOUBLE PRECISION;
