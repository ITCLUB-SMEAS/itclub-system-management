-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_periodId_giverId_targetRole_key" ON "Evaluation"("periodId", "giverId", "targetRole");

-- CreateIndex
CREATE INDEX "PeerReview_reviewerId_idx" ON "PeerReview"("reviewerId");
