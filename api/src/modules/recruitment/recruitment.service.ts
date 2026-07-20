import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApprovalStatus,
  Prisma,
  RecruitmentStage,
  RoleName,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TurnstileService } from '../../common/turnstile/turnstile.service';
import { MailService } from '../../common/mail/mail.service';
import { AuditService } from '../../common/audit/audit.service';
import { ApplyDto } from './dto/apply.dto';

const DEFAULT_ONBOARDING: Record<string, boolean> = {
  akun_dibuat: false,
  join_grup: false,
  perkenalan: false,
  akses_materi: false,
  divisi_ditetapkan: false,
};

const STAGE_ORDER: RecruitmentStage[] = [
  RecruitmentStage.FORM,
  RecruitmentStage.TEST,
  RecruitmentStage.INTERVIEW,
  RecruitmentStage.ANNOUNCEMENT,
];

@Injectable()
export class RecruitmentService {
  constructor(
    private prisma: PrismaService,
    private turnstile: TurnstileService,
    private mail: MailService,
    private audit: AuditService,
    private config: ConfigService,
  ) {}

  async apply(dto: ApplyDto, ip?: string) {
    await this.turnstile.verify(dto.turnstileToken, ip);
    const existing = await this.prisma.recruitmentApplication.findFirst({
      where: {
        email: dto.email,
        status: ApprovalStatus.PENDING,
      },
    });
    if (existing) {
      throw new ConflictException('Aplikasi pending untuk email ini sudah ada');
    }

    const app = await this.prisma.recruitmentApplication.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        className: dto.className,
        interestNotes: dto.interestNotes,
        divisionPreference: dto.divisionPreference,
        stage: RecruitmentStage.FORM,
        status: ApprovalStatus.PENDING,
        onboarding: DEFAULT_ONBOARDING,
      },
    });
    await this.audit.log({
      action: 'recruitment.apply',
      entityType: 'RecruitmentApplication',
      entityId: app.id,
      ip,
      meta: { email: app.email },
    });
    return app;
  }

  findAll(filters?: { status?: ApprovalStatus; stage?: RecruitmentStage }) {
    return this.prisma.recruitmentApplication.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.stage && { stage: filters.stage }),
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const app = await this.prisma.recruitmentApplication.findUnique({
      where: { id },
    });
    if (!app) throw new NotFoundException('Application not found');
    return app;
  }

  async setStage(
    id: string,
    stage: RecruitmentStage,
    notes?: string,
    actorId?: string,
  ) {
    const app = await this.findOne(id);
    if (app.status !== ApprovalStatus.PENDING) {
      throw new ConflictException('Application already finalized');
    }

    const updated = await this.prisma.recruitmentApplication.update({
      where: { id },
      data: {
        stage,
        ...(notes !== undefined ? { notes } : {}),
      },
    });
    await this.audit.log({
      actorId,
      action: 'recruitment.stage',
      entityType: 'RecruitmentApplication',
      entityId: id,
      meta: { stage, from: app.stage },
    });
    return updated;
  }

  async advanceStage(id: string, actorId?: string) {
    const app = await this.findOne(id);
    const i = STAGE_ORDER.indexOf(app.stage);
    if (i < 0 || i >= STAGE_ORDER.length - 1) {
      throw new ConflictException('Already at final stage');
    }
    return this.setStage(id, STAGE_ORDER[i + 1], undefined, actorId);
  }

  async updateOnboarding(
    id: string,
    checklist: Record<string, boolean>,
    actorId?: string,
  ) {
    const app = await this.findOne(id);
    const prev =
      app.onboarding && typeof app.onboarding === 'object'
        ? (app.onboarding as Record<string, boolean>)
        : { ...DEFAULT_ONBOARDING };

    const merged = { ...prev, ...checklist };
    const updated = await this.prisma.recruitmentApplication.update({
      where: { id },
      data: { onboarding: merged as Prisma.InputJsonValue },
    });
    await this.audit.log({
      actorId,
      action: 'recruitment.onboarding',
      entityType: 'RecruitmentApplication',
      entityId: id,
      meta: { keys: Object.keys(checklist) },
    });
    return updated;
  }

  async approve(id: string, actorId?: string) {
    const app = await this.prisma.recruitmentApplication.findUnique({
      where: { id },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (app.status !== ApprovalStatus.PENDING) {
      throw new ConflictException('Already processed');
    }

    const tempPassword = randomBytes(12).toString('hex');
    const username =
      app.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') +
      randomBytes(2).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const activePeriod = await this.prisma.membershipPeriod.findFirst({
      where: { isActive: true },
    });

    const onboarding = {
      ...DEFAULT_ONBOARDING,
      ...(app.onboarding && typeof app.onboarding === 'object'
        ? (app.onboarding as Record<string, boolean>)
        : {}),
      akun_dibuat: true,
    };

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.recruitmentApplication.update({
        where: { id },
        data: {
          status: ApprovalStatus.APPROVED,
          stage: RecruitmentStage.ANNOUNCEMENT,
          onboarding: onboarding as Prisma.InputJsonValue,
        },
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
              interests: app.divisionPreference
                ? [app.divisionPreference]
                : [],
              approvalStatus: ApprovalStatus.APPROVED,
              status: 'ACTIVE',
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

    try {
      await this.mail.sendWelcomeCredentials(
        result.email,
        result.username,
        tempPassword,
      );
    } catch {
      /* mail service logs */
    }

    await this.audit.log({
      actorId,
      action: 'recruitment.approve',
      entityType: 'RecruitmentApplication',
      entityId: id,
      meta: { userId: result.id },
    });

    const isDev = this.config.get('NODE_ENV') !== 'production';
    return {
      applicationId: id,
      user: {
        id: result.id,
        email: result.email,
        username: result.username,
        memberId: result.member?.id,
      },
      onboarding,
      ...(isDev && !this.mail.isConfigured()
        ? { temporaryPassword: tempPassword }
        : {}),
      message: this.mail.isConfigured()
        ? 'Account created; credentials emailed to applicant'
        : 'Account created; temp password returned (dev, no SMTP)',
    };
  }

  async reject(id: string, actorId?: string, notes?: string) {
    const app = await this.prisma.recruitmentApplication.findUnique({
      where: { id },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (app.status !== ApprovalStatus.PENDING) {
      throw new ConflictException('Already processed');
    }
    const updated = await this.prisma.recruitmentApplication.update({
      where: { id },
      data: {
        status: ApprovalStatus.REJECTED,
        stage: RecruitmentStage.ANNOUNCEMENT,
        ...(notes ? { notes } : {}),
      },
    });
    await this.audit.log({
      actorId,
      action: 'recruitment.reject',
      entityType: 'RecruitmentApplication',
      entityId: id,
    });
    return updated;
  }

  stats() {
    return this.prisma.recruitmentApplication
      .groupBy({
        by: ['status', 'stage'],
        _count: true,
      })
      .then((rows) =>
        rows.map((r) => ({
          status: r.status,
          stage: r.stage,
          count: r._count,
        })),
      );
  }
}
