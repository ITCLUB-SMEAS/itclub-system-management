import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PortfolioService {
  constructor(private prisma: PrismaService) {}

  async memberPortfolio(memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        fullName: true,
        className: true,
        batchYear: true,
        interests: true,
        status: true,
        submissions: {
          include: { task: { include: { project: true } } },
        },
        achievements: true,
        badges: { include: { badge: true } },
        certificates: true,
      },
    });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  async showcase() {
    const [members, achievements, events] = await Promise.all([
      this.prisma.member.findMany({
        where: { approvalStatus: 'APPROVED', status: 'ACTIVE' },
        select: {
          id: true,
          fullName: true,
          interests: true,
          badges: { include: { badge: true }, take: 3 },
        },
        take: 20,
      }),
      this.prisma.achievement.findMany({
        take: 10,
        orderBy: { title: 'asc' },
        include: { event: { select: { id: true, title: true } } },
      }),
      this.prisma.event.findMany({
        take: 5,
        orderBy: { startDate: 'desc' },
      }),
    ]);
    return { members, achievements, events };
  }
}
