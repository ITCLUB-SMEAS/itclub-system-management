import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePeriodDto } from './dto/create-period.dto';

@Injectable()
export class PeriodsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.membershipPeriod.findMany({
      orderBy: { startDate: 'desc' },
    });
  }

  async create(dto: CreatePeriodDto) {
    if (dto.isActive) {
      await this.prisma.membershipPeriod.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }
    return this.prisma.membershipPeriod.create({
      data: {
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        isActive: dto.isActive ?? false,
      },
    });
  }

  async members(periodId: string) {
    const period = await this.prisma.membershipPeriod.findUnique({
      where: { id: periodId },
    });
    if (!period) throw new NotFoundException('Period not found');

    return this.prisma.memberPeriod.findMany({
      where: { periodId },
      include: {
        member: {
          include: {
            user: { select: { id: true, email: true, username: true } },
          },
        },
        division: true,
      },
    });
  }

  async report(periodId: string) {
    const period = await this.prisma.membershipPeriod.findUnique({
      where: { id: periodId },
    });
    if (!period) throw new NotFoundException('Period not found');

    const [memberCount, achievementCount, attendanceCount, transactions] =
      await Promise.all([
        this.prisma.memberPeriod.count({ where: { periodId } }),
        this.prisma.achievement.count(),
        this.prisma.attendance.count({
          where: {
            checkedInAt: { gte: period.startDate, lte: period.endDate },
          },
        }),
        this.prisma.transaction.findMany({ where: { periodId } }),
      ]);

    const income = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((s, t) => s + Number(t.amount), 0);
    const expense = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((s, t) => s + Number(t.amount), 0);

    return {
      period,
      memberCount,
      achievementCount,
      attendanceCount,
      finance: { income, expense, balance: income - expense },
    };
  }
}
