import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  MemberStatus,
  NotificationType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { CreateGalleryDto } from './dto/create-gallery.dto';

@Injectable()
export class EventsService {
  private readonly log = new Logger(EventsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  findAll(filter?: { type?: string; upcoming?: boolean }) {
    const now = new Date();
    return this.prisma.event.findMany({
      where: {
        ...(filter?.type && { type: filter.type }),
        ...(filter?.upcoming === true && { startDate: { gte: now } }),
        ...(filter?.upcoming === false && { startDate: { lt: now } }),
      },
      include: {
        _count: {
          select: {
            registrations: true,
            achievements: true,
            galleries: true,
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(id: string) {
    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            registrations: true,
            achievements: true,
            galleries: true,
          },
        },
        achievements: {
          include: {
            member: { select: { id: true, fullName: true } },
          },
          orderBy: { title: 'asc' },
        },
        galleries: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  create(dto: CreateEventDto, actorId?: string) {
    const start = new Date(dto.startDate);
    const end = dto.endDate ? new Date(dto.endDate) : undefined;
    if (end && end < start) {
      throw new BadRequestException('endDate must be after startDate');
    }

    return this.prisma.event
      .create({
        data: {
          title: dto.title,
          description: dto.description,
          type: dto.type,
          location: dto.location,
          capacity: dto.capacity,
          registrationOpen: dto.registrationOpen ?? true,
          startDate: start,
          endDate: end,
        },
      })
      .then(async (e) => {
        await this.audit.log({
          actorId,
          action: 'event.create',
          entityType: 'Event',
          entityId: e.id,
        });
        return e;
      });
  }

  async register(eventId: string, memberId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { _count: { select: { registrations: true } } },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (!event.registrationOpen) {
      throw new BadRequestException('Pendaftaran ditutup');
    }
    if (event.capacity != null && event._count.registrations >= event.capacity) {
      throw new BadRequestException('Kuota event penuh');
    }

    try {
      const reg = await this.prisma.eventRegistration.create({
        data: {
          eventId,
          memberId,
          status: ApprovalStatus.PENDING,
        },
      });
      return reg;
    } catch {
      throw new ConflictException('Already registered');
    }
  }

  async cancelRegistration(eventId: string, memberId: string) {
    const reg = await this.prisma.eventRegistration.findUnique({
      where: { eventId_memberId: { eventId, memberId } },
    });
    if (!reg) throw new NotFoundException('Registration not found');
    await this.prisma.eventRegistration.delete({ where: { id: reg.id } });
    return { success: true };
  }

  myRegistrations(memberId: string) {
    return this.prisma.eventRegistration.findMany({
      where: { memberId },
      include: {
        event: true,
      },
      orderBy: { event: { startDate: 'desc' } },
    });
  }

  registrations(eventId: string) {
    return this.prisma.eventRegistration.findMany({
      where: { eventId },
      include: {
        member: {
          select: {
            id: true,
            fullName: true,
            className: true,
            user: { select: { id: true, email: true, username: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async setRegistrationStatus(
    eventId: string,
    registrationId: string,
    status: ApprovalStatus,
    actorId?: string,
  ) {
    if (
      status !== ApprovalStatus.APPROVED &&
      status !== ApprovalStatus.REJECTED
    ) {
      throw new BadRequestException('status must be APPROVED or REJECTED');
    }

    const reg = await this.prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
      include: {
        event: true,
        member: { select: { userId: true, fullName: true } },
      },
    });
    if (!reg) throw new NotFoundException('Registration not found');

    if (status === ApprovalStatus.APPROVED && reg.event.capacity != null) {
      const approved = await this.prisma.eventRegistration.count({
        where: { eventId, status: ApprovalStatus.APPROVED },
      });
      if (approved >= reg.event.capacity && reg.status !== ApprovalStatus.APPROVED) {
        throw new BadRequestException('Kuota event penuh');
      }
    }

    const updated = await this.prisma.eventRegistration.update({
      where: { id: registrationId },
      data: { status },
    });

    await this.prisma.notification.create({
      data: {
        userId: reg.member.userId,
        type: NotificationType.APPROVAL_RESULT,
        title:
          status === ApprovalStatus.APPROVED
            ? `Diterima: ${reg.event.title}`
            : `Ditolak: ${reg.event.title}`,
        body: `Pendaftaran event ${reg.event.title}: ${status}`,
      },
    });

    await this.audit.log({
      actorId,
      action: 'event.registration_status',
      entityType: 'EventRegistration',
      entityId: registrationId,
      meta: { eventId, status },
    });

    return updated;
  }

  async addAchievement(
    eventId: string,
    dto: CreateAchievementDto,
    actorId?: string,
  ) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (dto.memberId) {
      const m = await this.prisma.member.findUnique({
        where: { id: dto.memberId },
      });
      if (!m) throw new BadRequestException('Member not found');
    }

    const ach = await this.prisma.achievement.create({
      data: {
        eventId,
        title: dto.title,
        rank: dto.rank,
        description: dto.description,
        memberId: dto.memberId,
      },
      include: {
        member: { select: { id: true, fullName: true } },
        event: { select: { id: true, title: true } },
      },
    });

    if (dto.memberId) {
      const m = await this.prisma.member.findUnique({
        where: { id: dto.memberId },
        select: { userId: true },
      });
      if (m) {
        await this.prisma.notification.create({
          data: {
            userId: m.userId,
            type: NotificationType.ANNOUNCEMENT,
            title: `Prestasi: ${dto.title}`,
            body: [
              event.title,
              dto.rank ? `Rank ${dto.rank}` : null,
            ]
              .filter(Boolean)
              .join(' · ')
              .slice(0, 280),
          },
        });
      }
    }

    await this.audit.log({
      actorId,
      action: 'event.achievement',
      entityType: 'Achievement',
      entityId: ach.id,
      meta: { eventId },
    });

    return ach;
  }

  listAchievements(filter?: { memberId?: string; eventId?: string }) {
    return this.prisma.achievement.findMany({
      where: {
        ...(filter?.memberId && { memberId: filter.memberId }),
        ...(filter?.eventId && { eventId: filter.eventId }),
      },
      include: {
        member: { select: { id: true, fullName: true } },
        event: { select: { id: true, title: true, type: true } },
      },
      orderBy: { title: 'asc' },
    });
  }

  async addGallery(eventId: string, dto: CreateGalleryDto, actorId?: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const item = await this.prisma.galleryItem.create({
      data: { eventId, imageUrl: dto.imageUrl, caption: dto.caption },
      include: { event: { select: { id: true, title: true } } },
    });
    await this.audit.log({
      actorId,
      action: 'event.gallery',
      entityType: 'GalleryItem',
      entityId: item.id,
      meta: { eventId },
    });
    return item;
  }

  listGallery(eventId?: string) {
    return this.prisma.galleryItem.findMany({
      where: eventId ? { eventId } : undefined,
      include: { event: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** H-1 event reminders (20–28h window) */
  async sendUpcomingReminders() {
    const now = new Date();
    const from = new Date(now.getTime() + 20 * 3_600_000);
    const to = new Date(now.getTime() + 28 * 3_600_000);

    const events = await this.prisma.event.findMany({
      where: {
        startDate: { gte: from, lte: to },
        reminderSentAt: null,
      },
      include: {
        registrations: {
          where: { status: ApprovalStatus.APPROVED },
          include: { member: { select: { userId: true } } },
        },
      },
    });

    let sent = 0;
    for (const ev of events) {
      const targets =
        ev.registrations.length > 0
          ? ev.registrations.map((r) => r.member.userId)
          : (
              await this.prisma.user.findMany({
                where: {
                  member: {
                    approvalStatus: ApprovalStatus.APPROVED,
                    status: MemberStatus.ACTIVE,
                  },
                },
                select: { id: true },
              })
            ).map((u) => u.id);

      if (targets.length) {
        await this.prisma.notification.createMany({
          data: targets.map((userId) => ({
            userId,
            type: NotificationType.EVENT_REMINDER,
            title: `Besok: ${ev.title}`,
            body: [
              ev.type,
              ev.location ? `@ ${ev.location}` : null,
              `Mulai ${ev.startDate.toLocaleString('id-ID')}`,
            ]
              .filter(Boolean)
              .join(' · ')
              .slice(0, 280),
          })),
        });
        sent += targets.length;
      }

      await this.prisma.event.update({
        where: { id: ev.id },
        data: { reminderSentAt: now },
      });
      this.log.log(`H-1 event reminder ${ev.id} (${ev.title})`);
    }

    return { sent, events: events.length };
  }

  assertCanViewRegistration(
    regMemberId: string,
    userMemberId?: string,
    isPengurus?: boolean,
  ) {
    if (isPengurus || regMemberId === userMemberId) return;
    throw new ForbiddenException();
  }
}
