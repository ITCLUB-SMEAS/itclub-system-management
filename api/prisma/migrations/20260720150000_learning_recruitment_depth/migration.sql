-- AlterTable LearningResource
ALTER TABLE "LearningResource" ADD COLUMN "description" TEXT;
ALTER TABLE "LearningResource" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LearningResource" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable LearningPath
ALTER TABLE "LearningPath" ADD COLUMN "description" TEXT;
ALTER TABLE "LearningPath" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "LearningResource_learningPathId_idx" ON "LearningResource"("learningPathId");
CREATE INDEX "LearningResource_divisionId_idx" ON "LearningResource"("divisionId");

-- CreateTable LearningProgress
CREATE TABLE "LearningProgress" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LearningProgress_memberId_resourceId_key" ON "LearningProgress"("memberId", "resourceId");
CREATE INDEX "LearningProgress_memberId_idx" ON "LearningProgress"("memberId");

ALTER TABLE "LearningProgress" ADD CONSTRAINT "LearningProgress_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningProgress" ADD CONSTRAINT "LearningProgress_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "LearningResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum RecruitmentStage
CREATE TYPE "RecruitmentStage" AS ENUM ('FORM', 'TEST', 'INTERVIEW', 'ANNOUNCEMENT');

-- AlterTable RecruitmentApplication
ALTER TABLE "RecruitmentApplication" ADD COLUMN "divisionPreference" TEXT;
ALTER TABLE "RecruitmentApplication" ADD COLUMN "stage" "RecruitmentStage" NOT NULL DEFAULT 'FORM';
ALTER TABLE "RecruitmentApplication" ADD COLUMN "onboarding" JSONB;
ALTER TABLE "RecruitmentApplication" ADD COLUMN "notes" TEXT;
ALTER TABLE "RecruitmentApplication" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "RecruitmentApplication_status_idx" ON "RecruitmentApplication"("status");
CREATE INDEX "RecruitmentApplication_stage_idx" ON "RecruitmentApplication"("stage");
