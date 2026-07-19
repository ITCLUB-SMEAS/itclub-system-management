import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class CommunicationService {
  constructor(private prisma: PrismaService) {}

  listAnnouncements() {
    return this.prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createAnnouncement(dto: CreateAnnouncementDto) {
    const announcement = await this.prisma.announcement.create({ data: dto });
    const users = await this.prisma.user.findMany({ select: { id: true } });
    if (users.length) {
      await this.prisma.notification.createMany({
        data: users.map((u) => ({
          userId: u.id,
          type: 'ANNOUNCEMENT' as const,
          title: dto.title,
          body: dto.content.slice(0, 280),
        })),
      });
    }
    return announcement;
  }

  myNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRead(id: string, userId: string) {
    const n = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!n) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }
}
