import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { CreatePeerReviewDto } from './dto/create-peer-review.dto';

@Injectable()
export class EvaluationService {
  constructor(private prisma: PrismaService) {}

  async createEvaluation(giverId: string, dto: CreateEvaluationDto) {
    const period = await this.prisma.membershipPeriod.findUnique({
      where: { id: dto.periodId },
    });
    if (!period) throw new NotFoundException('Period not found');
    if (dto.score < 1 || dto.score > 5) {
      throw new BadRequestException('score must be 1–5');
    }

    try {
      return await this.prisma.evaluation.create({
        data: {
          periodId: dto.periodId,
          giverId,
          targetRole: dto.targetRole,
          score: dto.score,
          comment: dto.comment,
        },
      });
    } catch {
      throw new ConflictException(
        'Sudah menilai role ini di periode tersebut',
      );
    }
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
      byRole: [...byRole.entries()]
        .map(([role, v]) => ({
          role,
          average: v.count
            ? Math.round((v.total / v.count) * 10) / 10
            : 0,
          count: v.count,
        }))
        .sort((a, b) => a.role.localeCompare(b.role)),
    };
  }

  async createPeerReview(reviewerId: string, dto: CreatePeerReviewDto) {
    if (reviewerId === dto.revieweeId) {
      throw new BadRequestException('Tidak bisa review diri sendiri');
    }
    if (dto.score < 1 || dto.score > 5) {
      throw new BadRequestException('score must be 1–5');
    }

    const reviewee = await this.prisma.member.findUnique({
      where: { id: dto.revieweeId },
    });
    if (!reviewee) throw new NotFoundException('Reviewee not found');

    if (dto.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: dto.projectId },
      });
      if (!project) throw new NotFoundException('Project not found');
    }

    return this.prisma.peerReview.create({
      data: {
        reviewerId,
        revieweeId: dto.revieweeId,
        projectId: dto.projectId,
        score: dto.score,
        comment: dto.comment,
      },
      include: {
        reviewer: { select: { id: true, fullName: true } },
        reviewee: { select: { id: true, fullName: true } },
        project: { select: { id: true, name: true } },
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

  myGivenReviews(reviewerId: string) {
    return this.prisma.peerReview.findMany({
      where: { reviewerId },
      include: {
        reviewee: { select: { id: true, fullName: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  assertCanViewPeer(
    targetMemberId: string,
    viewerMemberId?: string,
    isPengurus?: boolean,
  ) {
    if (isPengurus || targetMemberId === viewerMemberId) return;
    throw new ForbiddenException('Cannot view other peer reviews');
  }
}
