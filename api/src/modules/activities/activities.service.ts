import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  AttendanceMethod,
  MemberStatus,
  NotificationType,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { CheckInDto } from './dto/check-in.dto';
import { withinGeofence } from './geo';

const EARLY_MS = 30 * 60_000; // allow check-in 30m before start
const DEFAULT_GEOFENCE_M = 100;
const DEFAULT_QR_TTL_MIN = 15;

@Injectable()
export class ActivitiesService {
  private readonly log = new Logger(ActivitiesService.name);

  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.activity.findMany({
      orderBy: { startTime: 'desc' },
      include: { _count: { select: { attendances: true } } },
    });
  }

  findOne(id: string) {
    return this.prisma.activity.findUnique({
      where: { id },
      include: { _count: { select: { attendances: true } } },
    });
  }

  create(dto: CreateActivityDto) {
    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);
    if (end <= start) {
      throw new BadRequestException('endTime must be after startTime');
    }

    const hasGeo =
      dto.latitude != null &&
      dto.longitude != null &&
      !Number.isNaN(dto.latitude) &&
      !Number.isNaN(dto.longitude);

    const qrToken = this.newQrToken();
    const qrTokenExpiresAt = new Date(
      Date.now() + DEFAULT_QR_TTL_MIN * 60_000,
    );

    return this.prisma.activity.create({
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        latitude: hasGeo ? dto.latitude : undefined,
        longitude: hasGeo ? dto.longitude : undefined,
        geofenceRadiusM: hasGeo
          ? (dto.geofenceRadiusM ?? DEFAULT_GEOFENCE_M)
          : dto.geofenceRadiusM,
        startTime: start,
        endTime: end,
        qrToken,
        qrTokenExpiresAt,
      },
    });
  }

  async rotateQr(activityId: string, ttlMinutes = DEFAULT_QR_TTL_MIN) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: activityId },
    });
    if (!activity) throw new NotFoundException('Activity not found');

    const qrToken = this.newQrToken();
    const qrTokenExpiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    return this.prisma.activity.update({
      where: { id: activityId },
      data: { qrToken, qrTokenExpiresAt },
    });
  }

  async checkIn(memberId: string, dto: CheckInDto) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: dto.activityId },
    });
    if (!activity) throw new NotFoundException('Activity not found');

    const now = Date.now();
    const windowStart = activity.startTime.getTime() - EARLY_MS;
    const windowEnd = activity.endTime.getTime();
    if (now < windowStart) {
      throw new BadRequestException('Check-in belum dibuka');
    }
    if (now > windowEnd) {
      throw new BadRequestException('Kegiatan sudah selesai');
    }

    const method = dto.method ?? (dto.qrToken ? AttendanceMethod.QR : AttendanceMethod.MANUAL);

    if (method === AttendanceMethod.QR) {
      if (!dto.qrToken || dto.qrToken !== activity.qrToken) {
        throw new BadRequestException('Invalid QR token');
      }
      if (
        activity.qrTokenExpiresAt &&
        activity.qrTokenExpiresAt.getTime() < now
      ) {
        throw new BadRequestException('QR token expired — minta pengurus rotate');
      }
    }

    // geofence when activity has center + radius
    if (
      activity.latitude != null &&
      activity.longitude != null &&
      activity.geofenceRadiusM != null &&
      activity.geofenceRadiusM > 0
    ) {
      if (dto.latitude == null || dto.longitude == null) {
        throw new BadRequestException(
          'Lokasi GPS wajib untuk kegiatan ber-geofence',
        );
      }
      const ok = withinGeofence(
        activity.latitude,
        activity.longitude,
        activity.geofenceRadiusM,
        dto.latitude,
        dto.longitude,
      );
      if (!ok) {
        throw new BadRequestException(
          `Di luar area kegiatan (radius ${activity.geofenceRadiusM}m)`,
        );
      }
    }

    try {
      return await this.prisma.attendance.create({
        data: {
          activityId: dto.activityId,
          memberId,
          method,
          latitude: dto.latitude,
          longitude: dto.longitude,
        },
      });
    } catch {
      throw new ConflictException('Already checked in');
    }
  }

  myAttendances(memberId: string) {
    return this.prisma.attendance.findMany({
      where: { memberId },
      include: { activity: true },
      orderBy: { checkedInAt: 'desc' },
    });
  }

  activityAttendances(activityId: string) {
    return this.prisma.attendance.findMany({
      where: { activityId },
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
      orderBy: { checkedInAt: 'asc' },
    });
  }

  /** Rekap kehadiran per anggota (filter optional period via activity dates). */
  async memberReport(memberId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, fullName: true, className: true },
    });
    if (!member) throw new NotFoundException('Member not found');

    const [totalActivities, attendances] = await Promise.all([
      this.prisma.activity.count({
        where: { endTime: { lte: new Date() } },
      }),
      this.prisma.attendance.findMany({
        where: { memberId },
        include: {
          activity: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
              location: true,
            },
          },
        },
        orderBy: { checkedInAt: 'desc' },
      }),
    ]);

    const present = attendances.length;
    const rate =
      totalActivities > 0
        ? Math.round((present / totalActivities) * 1000) / 10
        : 0;

    return {
      member,
      totalPastActivities: totalActivities,
      present,
      absent: Math.max(0, totalActivities - present),
      attendanceRatePercent: rate,
      attendances,
    };
  }

  /** H-1 reminder: activities starting in 20–28h window, not yet reminded. */
  async sendUpcomingReminders() {
    const now = new Date();
    const from = new Date(now.getTime() + 20 * 3_600_000);
    const to = new Date(now.getTime() + 28 * 3_600_000);

    const activities = await this.prisma.activity.findMany({
      where: {
        startTime: { gte: from, lte: to },
        reminderSentAt: null,
      },
    });

    if (!activities.length) {
      return { sent: 0, activities: 0 };
    }

    const users = await this.prisma.user.findMany({
      where: {
        member: {
          approvalStatus: ApprovalStatus.APPROVED,
          status: MemberStatus.ACTIVE,
        },
      },
      select: { id: true },
    });

    let notifCount = 0;
    for (const act of activities) {
      if (users.length) {
        await this.prisma.notification.createMany({
          data: users.map((u) => ({
            userId: u.id,
            type: NotificationType.EVENT_REMINDER,
            title: `Besok: ${act.title}`,
            body: [
              act.title,
              act.location ? `@ ${act.location}` : null,
              `Mulai ${act.startTime.toLocaleString('id-ID')}`,
            ]
              .filter(Boolean)
              .join(' · ')
              .slice(0, 280),
          })),
        });
        notifCount += users.length;
      }
      await this.prisma.activity.update({
        where: { id: act.id },
        data: { reminderSentAt: now },
      });
      this.log.log(`H-1 reminder sent for activity ${act.id} (${act.title})`);
    }

    return {
      sent: notifCount,
      activities: activities.length,
    };
  }

  private newQrToken() {
    return createHash('sha256')
      .update(randomBytes(32))
      .digest('hex')
      .slice(0, 32);
  }
}
