import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceMethod } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { CheckInDto } from './dto/check-in.dto';

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.activity.findMany({ orderBy: { startTime: 'desc' } });
  }

  create(dto: CreateActivityDto) {
    return this.prisma.activity.create({
      data: {
        title: dto.title,
        description: dto.description,
        location: dto.location,
        latitude: dto.latitude,
        longitude: dto.longitude,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
      },
    });
  }

  async checkIn(memberId: string, dto: CheckInDto) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: dto.activityId },
    });
    if (!activity) throw new NotFoundException('Activity not found');

    if (dto.method === AttendanceMethod.QR || dto.qrToken) {
      if (!dto.qrToken || dto.qrToken !== activity.qrToken) {
        throw new BadRequestException('Invalid QR token');
      }
    }

    try {
      return await this.prisma.attendance.create({
        data: {
          activityId: dto.activityId,
          memberId,
          method: dto.method ?? AttendanceMethod.MANUAL,
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
          include: {
            user: { select: { id: true, email: true, username: true } },
          },
        },
      },
      orderBy: { checkedInAt: 'asc' },
    });
  }
}
