import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { CreateGalleryDto } from './dto/create-gallery.dto';

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.event.findMany({ orderBy: { startDate: 'desc' } });
  }

  create(dto: CreateEventDto) {
    return this.prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async register(eventId: string, memberId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    try {
      return await this.prisma.eventRegistration.create({
        data: { eventId, memberId },
      });
    } catch {
      throw new ConflictException('Already registered');
    }
  }

  registrations(eventId: string) {
    return this.prisma.eventRegistration.findMany({
      where: { eventId },
      include: {
        member: {
          include: {
            user: { select: { id: true, email: true, username: true } },
          },
        },
      },
    });
  }

  async addAchievement(eventId: string, dto: CreateAchievementDto) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.achievement.create({
      data: { eventId, ...dto },
    });
  }

  async addGallery(eventId: string, dto: CreateGalleryDto) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return this.prisma.galleryItem.create({
      data: { eventId, ...dto },
    });
  }

  listGallery() {
    return this.prisma.galleryItem.findMany({
      include: { event: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
