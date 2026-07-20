import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  MemberStatus,
  RoleName,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PENGURUS_ROLES } from '../../common/constants/roles';
import { AuditService } from '../../common/audit/audit.service';
import { UpdateMemberDto } from './dto/update-member.dto';
import { AssignDivisionDto } from './dto/assign-division.dto';
import { JwtPayload } from '../auth/types/jwt-payload';

const PUBLIC_MEMBER_SELECT = {
  id: true,
  fullName: true,
  className: true,
  batchYear: true,
  interests: true,
  status: true,
  approvalStatus: true,
  periods: {
    select: {
      id: true,
      role: true,
      periodId: true,
      divisionId: true,
      division: { select: { id: true, name: true } },
      period: { select: { id: true, name: true, isActive: true } },
    },
  },
} as const;

@Injectable()
export class MembersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async findAll(
    filters: {
      status?: MemberStatus;
      divisionId?: string;
      periodId?: string;
    },
    viewer: JwtPayload,
  ) {
    const isPengurus = viewer.role && PENGURUS_ROLES.includes(viewer.role);
    const where = {
      ...(filters.status && { status: filters.status }),
      // non-pengurus: directory only approved active peers
      ...(!isPengurus
        ? {
            approvalStatus: ApprovalStatus.APPROVED,
            status: MemberStatus.ACTIVE,
          }
        : {}),
      ...(filters.periodId || filters.divisionId
        ? {
            periods: {
              some: {
                ...(filters.periodId && { periodId: filters.periodId }),
                ...(filters.divisionId && { divisionId: filters.divisionId }),
              },
            },
          }
        : {}),
    };

    if (isPengurus) {
      return this.prisma.member.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, username: true } },
          periods: {
            include: { division: true, period: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.member.findMany({
      where,
      select: PUBLIC_MEMBER_SELECT,
      orderBy: { fullName: 'asc' },
    });
  }

  async findOne(id: string, viewer?: JwtPayload) {
    const isPengurus =
      viewer?.role && PENGURUS_ROLES.includes(viewer.role);
    const isSelf = viewer?.memberId === id;

    if (isPengurus || isSelf) {
      const member = await this.prisma.member.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, email: true, username: true } },
          periods: { include: { division: true, period: true } },
          badges: { include: { badge: true } },
          certificates: true,
        },
      });
      if (!member) throw new NotFoundException('Member not found');
      return member;
    }

    const member = await this.prisma.member.findFirst({
      where: {
        id,
        approvalStatus: ApprovalStatus.APPROVED,
        status: MemberStatus.ACTIVE,
      },
      select: {
        ...PUBLIC_MEMBER_SELECT,
        badges: {
          select: {
            id: true,
            awardedAt: true,
            badge: { select: { id: true, name: true, iconUrl: true } },
          },
        },
        certificates: {
          select: { id: true, title: true, fileUrl: true, issuedAt: true },
        },
      },
    });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  async update(id: string, dto: UpdateMemberDto, user: JwtPayload) {
    const isSelf = user.memberId === id;
    const isPengurus = user.role && PENGURUS_ROLES.includes(user.role);
    if (!isSelf && !isPengurus) throw new ForbiddenException();

    const updated = await this.prisma.member.update({
      where: { id },
      data: dto,
    });
    await this.audit.log({
      actorId: user.sub,
      action: 'member.update',
      entityType: 'Member',
      entityId: id,
      meta: { fields: Object.keys(dto) },
    });
    return updated;
  }

  async approve(id: string, actorId?: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Member not found');

    const activePeriod = await this.prisma.membershipPeriod.findFirst({
      where: { isActive: true },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const m = await tx.member.update({
        where: { id },
        data: {
          approvalStatus: ApprovalStatus.APPROVED,
          status: MemberStatus.ACTIVE,
        },
      });

      if (activePeriod) {
        await tx.memberPeriod.upsert({
          where: {
            memberId_periodId: { memberId: id, periodId: activePeriod.id },
          },
          create: {
            memberId: id,
            periodId: activePeriod.id,
            role: RoleName.ANGGOTA,
          },
          update: {},
        });
      }

      return m;
    });

    await this.audit.log({
      actorId,
      action: 'member.approve',
      entityType: 'Member',
      entityId: id,
    });
    return updated;
  }

  async reject(id: string, actorId?: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Member not found');
    const updated = await this.prisma.member.update({
      where: { id },
      data: {
        approvalStatus: ApprovalStatus.REJECTED,
        status: MemberStatus.INACTIVE,
      },
    });
    await this.audit.log({
      actorId,
      action: 'member.reject',
      entityType: 'Member',
      entityId: id,
    });
    return updated;
  }

  async assignDivision(id: string, dto: AssignDivisionDto, actorId?: string) {
    await this.findOne(id);
    const row = await this.prisma.memberPeriod.upsert({
      where: {
        memberId_periodId: { memberId: id, periodId: dto.periodId },
      },
      create: {
        memberId: id,
        periodId: dto.periodId,
        divisionId: dto.divisionId,
        role: dto.role,
      },
      update: {
        divisionId: dto.divisionId,
        role: dto.role,
      },
      include: { division: true, period: true },
    });
    await this.audit.log({
      actorId,
      action: 'member.assign_division',
      entityType: 'Member',
      entityId: id,
      meta: { periodId: dto.periodId, divisionId: dto.divisionId, role: dto.role },
    });
    return row;
  }

  async awardBadge(memberId: string, badgeId: string, actorId?: string) {
    await this.findOne(memberId);
    const row = await this.prisma.memberBadge.create({
      data: { memberId, badgeId },
      include: { badge: true },
    });
    await this.audit.log({
      actorId,
      action: 'member.award_badge',
      entityType: 'Member',
      entityId: memberId,
      meta: { badgeId },
    });
    return row;
  }

  async listCertificates(memberId: string) {
    await this.findOne(memberId);
    return this.prisma.certificate.findMany({
      where: { memberId },
      orderBy: { issuedAt: 'desc' },
    });
  }
}
