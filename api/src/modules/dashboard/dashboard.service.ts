import { Injectable } from '@nestjs/common';
import {
  ApprovalStatus,
  LoanStatus,
  MemberStatus,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async overview() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

    const [
      membersActive,
      membersPending,
      projectsCount,
      tasksOpen,
      activitiesUpcoming,
      eventsUpcoming,
      achievementsCount,
      attendancesWeek,
      loansActive,
      loansOverdue,
      recruitmentPending,
      topDivisions,
      recentAttendances,
    ] = await Promise.all([
      this.prisma.member.count({
        where: {
          status: MemberStatus.ACTIVE,
          approvalStatus: ApprovalStatus.APPROVED,
        },
      }),
      this.prisma.member.count({
        where: { approvalStatus: ApprovalStatus.PENDING },
      }),
      this.prisma.project.count(),
      this.prisma.task.count({
        where: { status: { not: TaskStatus.DONE } },
      }),
      this.prisma.activity.count({
        where: { startTime: { gte: now } },
      }),
      this.prisma.event.count({
        where: { startDate: { gte: now } },
      }),
      this.prisma.achievement.count(),
      this.prisma.attendance.count({
        where: { checkedInAt: { gte: weekAgo } },
      }),
      this.prisma.inventoryLoan.count({
        where: {
          status: {
            in: [LoanStatus.REQUESTED, LoanStatus.APPROVED, LoanStatus.BORROWED],
          },
        },
      }),
      this.prisma.inventoryLoan.count({
        where: {
          status: LoanStatus.BORROWED,
          dueDate: { lt: now },
        },
      }),
      this.prisma.recruitmentApplication.count({
        where: { status: ApprovalStatus.PENDING },
      }),
      this.divisionStats(),
      this.attendanceLast7Days(),
    ]);

    return {
      membersActive,
      membersPending,
      projectsCount,
      tasksOpen,
      activitiesUpcoming,
      eventsUpcoming,
      achievementsCount,
      attendancesWeek,
      loansActive,
      loansOverdue,
      recruitmentPending,
      topDivisions,
      attendanceSeries: recentAttendances,
      generatedAt: now.toISOString(),
    };
  }

  private async divisionStats() {
    const periods = await this.prisma.memberPeriod.groupBy({
      by: ['divisionId'],
      where: {
        period: { isActive: true },
        divisionId: { not: null },
      },
      _count: true,
    });

    const ids = periods
      .map((p) => p.divisionId)
      .filter((id): id is string => !!id);
    if (!ids.length) return [];

    const divisions = await this.prisma.division.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    const nameById = new Map(divisions.map((d) => [d.id, d.name]));

    return periods
      .map((p) => ({
        divisionId: p.divisionId!,
        name: nameById.get(p.divisionId!) ?? '—',
        members: p._count,
      }))
      .sort((a, b) => b.members - a.members)
      .slice(0, 6);
  }

  /** counts per day for last 7 days (for mini chart) */
  private async attendanceLast7Days() {
    const days: Array<{ date: string; count: number }> = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const count = await this.prisma.attendance.count({
        where: { checkedInAt: { gte: start, lt: end } },
      });
      days.push({
        date: start.toISOString().slice(0, 10),
        count,
      });
    }
    return days;
  }
}
