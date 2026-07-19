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
import { UpdateMemberDto } from './dto/update-member.dto';
import { AssignDivisionDto } from './dto/assign-division.dto';
import { JwtPayload } from '../auth/types/jwt-payload';

@Injectable()
export class MembersService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: {
    status?: MemberStatus;
    divisionId?: string;
    periodId?: string;
  }) {
    return this.prisma.member.findMany({
      where: {
        ...(filters.status && { status: filters.status }),
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
      },
      include: {
        user: { select: { id: true, email: true, username: true } },
        periods: {
          include: { division: true, period: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
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

  async update(id: string, dto: UpdateMemberDto, user: JwtPayload) {
    const isSelf = user.memberId === id;
    const isPengurus = user.role && PENGURUS_ROLES.includes(user.role);
    if (!isSelf && !isPengurus) throw new ForbiddenException();

    return this.prisma.member.update({
      where: { id },
      data: dto,
    });
  }

  async approve(id: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Member not found');

    const activePeriod = await this.prisma.membershipPeriod.findFirst({
      where: { isActive: true },
    });

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.member.update({
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

      return updated;
    });
  }

  async reject(id: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) throw new NotFoundException('Member not found');
    return this.prisma.member.update({
      where: { id },
      data: {
        approvalStatus: ApprovalStatus.REJECTED,
        status: MemberStatus.INACTIVE,
      },
    });
  }

  async assignDivision(id: string, dto: AssignDivisionDto) {
    await this.findOne(id);
    return this.prisma.memberPeriod.upsert({
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
  }

  async awardBadge(memberId: string, badgeId: string) {
    await this.findOne(memberId);
    return this.prisma.memberBadge.create({
      data: { memberId, badgeId },
      include: { badge: true },
    });
  }

  async listCertificates(memberId: string) {
    await this.findOne(memberId);
    return this.prisma.certificate.findMany({
      where: { memberId },
      orderBy: { issuedAt: 'desc' },
    });
  }
}
