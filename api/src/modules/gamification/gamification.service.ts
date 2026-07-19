import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBadgeDto } from './dto/create-badge.dto';
import { GenerateCertificateDto } from './dto/generate-certificate.dto';

@Injectable()
export class GamificationService {
  constructor(private prisma: PrismaService) {}

  listBadges() {
    return this.prisma.badge.findMany({ orderBy: { name: 'asc' } });
  }

  createBadge(dto: CreateBadgeDto) {
    return this.prisma.badge.create({ data: dto });
  }

  async leaderboard() {
    const members = await this.prisma.member.findMany({
      where: { approvalStatus: 'APPROVED' },
      include: {
        badges: true,
        attendances: true,
        submissions: true,
        achievements: true,
      },
    });

    return members
      .map((m) => ({
        memberId: m.id,
        fullName: m.fullName,
        points:
          m.badges.length * 10 +
          m.attendances.length * 2 +
          m.submissions.length * 5 +
          m.achievements.length * 15,
        badges: m.badges.length,
        attendances: m.attendances.length,
        submissions: m.submissions.length,
        achievements: m.achievements.length,
      }))
      .sort((a, b) => b.points - a.points);
  }

  generateCertificate(dto: GenerateCertificateDto) {
    return this.prisma.certificate.create({
      data: {
        memberId: dto.memberId,
        title: dto.title,
        fileUrl: dto.fileUrl,
      },
    });
  }
}
