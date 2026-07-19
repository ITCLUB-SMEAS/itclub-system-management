import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, RoleName } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TurnstileService } from '../../common/turnstile/turnstile.service';
import { ApplyDto } from './dto/apply.dto';

@Injectable()
export class RecruitmentService {
  constructor(
    private prisma: PrismaService,
    private turnstile: TurnstileService,
  ) {}

  async apply(dto: ApplyDto, ip?: string) {
    await this.turnstile.verify(dto.turnstileToken, ip);
    const { turnstileToken: _t, ...data } = dto;
    return this.prisma.recruitmentApplication.create({ data });
  }

  findAll() {
    return this.prisma.recruitmentApplication.findMany({
      orderBy: { appliedAt: 'desc' },
    });
  }

  async approve(id: string) {
    const app = await this.prisma.recruitmentApplication.findUnique({
      where: { id },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (app.status !== ApprovalStatus.PENDING) {
      throw new ConflictException('Already processed');
    }

    const tempPassword = randomBytes(8).toString('hex');
    const username =
      app.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') +
      randomBytes(2).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const activePeriod = await this.prisma.membershipPeriod.findFirst({
      where: { isActive: true },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.recruitmentApplication.update({
        where: { id },
        data: { status: ApprovalStatus.APPROVED },
      });

      const user = await tx.user.create({
        data: {
          email: app.email,
          username,
          passwordHash,
          member: {
            create: {
              fullName: app.fullName,
              className: app.className,
              approvalStatus: ApprovalStatus.APPROVED,
            },
          },
        },
        include: { member: true },
      });

      if (activePeriod && user.member) {
        await tx.memberPeriod.create({
          data: {
            memberId: user.member.id,
            periodId: activePeriod.id,
            role: RoleName.ANGGOTA,
          },
        });
      }

      return user;
    });

    return {
      applicationId: id,
      user: {
        id: result.id,
        email: result.email,
        username: result.username,
        memberId: result.member?.id,
      },
      temporaryPassword: tempPassword,
    };
  }

  async reject(id: string) {
    const app = await this.prisma.recruitmentApplication.findUnique({
      where: { id },
    });
    if (!app) throw new NotFoundException('Application not found');
    return this.prisma.recruitmentApplication.update({
      where: { id },
      data: { status: ApprovalStatus.REJECTED },
    });
  }
}
