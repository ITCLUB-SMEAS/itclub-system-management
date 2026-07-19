import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { CreatePeerReviewDto } from './dto/create-peer-review.dto';

@Injectable()
export class EvaluationService {
  constructor(private prisma: PrismaService) {}

  createEvaluation(giverId: string, dto: CreateEvaluationDto) {
    return this.prisma.evaluation.create({
      data: {
        periodId: dto.periodId,
        giverId,
        targetRole: dto.targetRole,
        score: dto.score,
        comment: dto.comment,
      },
    });
  }

  async summary(periodId: string) {
    const evaluations = await this.prisma.evaluation.findMany({
      where: { periodId },
    });

    const byRole = new Map<string, { total: number; count: number }>();
    for (const e of evaluations) {
      const cur = byRole.get(e.targetRole) ?? { total: 0, count: 0 };
      cur.total += e.score;
      cur.count += 1;
      byRole.set(e.targetRole, cur);
    }

    return {
      periodId,
      totalResponses: evaluations.length,
      byRole: [...byRole.entries()].map(([role, v]) => ({
        role,
        average: v.count ? v.total / v.count : 0,
        count: v.count,
      })),
    };
  }

  createPeerReview(reviewerId: string, dto: CreatePeerReviewDto) {
    return this.prisma.peerReview.create({
      data: {
        reviewerId,
        revieweeId: dto.revieweeId,
        projectId: dto.projectId,
        score: dto.score,
        comment: dto.comment,
      },
    });
  }

  listPeerReviews(memberId: string) {
    return this.prisma.peerReview.findMany({
      where: { revieweeId: memberId },
      include: {
        reviewer: { select: { id: true, fullName: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
