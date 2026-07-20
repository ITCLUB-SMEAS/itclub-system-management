import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateBadgeDto } from './dto/create-badge.dto';
import { GenerateCertificateDto } from './dto/generate-certificate.dto';

export type PointsBreakdown = {
  memberId: string;
  fullName: string;
  points: number;
  badges: number;
  attendances: number;
  submissions: number;
  achievements: number;
};

const WEIGHT = {
  badge: 10,
  attendance: 2,
  submission: 5,
  achievement: 15,
} as const;

@Injectable()
export class GamificationService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  listBadges() {
    return this.prisma.badge.findMany({
      include: { _count: { select: { members: true } } },
      orderBy: { name: 'asc' },
    });
  }

  createBadge(dto: CreateBadgeDto, actorId?: string) {
    return this.prisma.badge.create({ data: dto }).then(async (b) => {
      await this.audit.log({
        actorId,
        action: 'badge.create',
        entityType: 'Badge',
        entityId: b.id,
      });
      return b;
    });
  }

  private score(m: {
    id: string;
    fullName: string;
    badges: unknown[];
    attendances: unknown[];
    submissions: unknown[];
    achievements: unknown[];
  }): PointsBreakdown {
    return {
      memberId: m.id,
      fullName: m.fullName,
      points:
        m.badges.length * WEIGHT.badge +
        m.attendances.length * WEIGHT.attendance +
        m.submissions.length * WEIGHT.submission +
        m.achievements.length * WEIGHT.achievement,
      badges: m.badges.length,
      attendances: m.attendances.length,
      submissions: m.submissions.length,
      achievements: m.achievements.length,
    };
  }

  async leaderboard(limit = 50) {
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
      .map((m) => this.score(m))
      .sort((a, b) => b.points - a.points)
      .slice(0, Math.min(200, Math.max(1, limit)));
  }

  async myStats(memberId: string) {
    const m = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: {
        badges: { include: { badge: true } },
        attendances: true,
        submissions: true,
        achievements: true,
        certificates: { orderBy: { issuedAt: 'desc' } },
      },
    });
    if (!m) throw new NotFoundException('Member not found');

    const points = this.score(m);
    const board = await this.leaderboard(200);
    const rank = board.findIndex((r) => r.memberId === memberId) + 1;

    return {
      ...points,
      rank: rank || null,
      totalOnBoard: board.length,
      badgesDetail: m.badges.map((b) => ({
        id: b.badge.id,
        name: b.badge.name,
        awardedAt: b.awardedAt,
      })),
      certificates: m.certificates,
      weights: WEIGHT,
    };
  }

  async awardBadge(memberId: string, badgeId: string, actorId?: string) {
    const [member, badge] = await Promise.all([
      this.prisma.member.findUnique({ where: { id: memberId } }),
      this.prisma.badge.findUnique({ where: { id: badgeId } }),
    ]);
    if (!member) throw new NotFoundException('Member not found');
    if (!badge) throw new NotFoundException('Badge not found');

    try {
      const row = await this.prisma.memberBadge.create({
        data: { memberId, badgeId },
        include: { badge: true },
      });
      await this.audit.log({
        actorId,
        action: 'badge.award',
        entityType: 'MemberBadge',
        entityId: row.id,
        meta: { memberId, badgeId },
      });
      return row;
    } catch {
      throw new ConflictException('Badge already awarded');
    }
  }

  /**
   * Auto-award simple milestone badges if they exist by name:
   * "Hadir 5x", "Kontributor", "Juara"
   */
  async evaluateMilestones(memberId: string) {
    const m = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: {
        badges: { include: { badge: true } },
        attendances: true,
        submissions: true,
        achievements: true,
      },
    });
    if (!m) throw new NotFoundException('Member not found');

    const owned = new Set(m.badges.map((b) => b.badge.name.toLowerCase()));
    const rules: Array<{ name: string; ok: boolean }> = [
      { name: 'Hadir 5x', ok: m.attendances.length >= 5 },
      { name: 'Kontributor', ok: m.submissions.length >= 3 },
      { name: 'Juara', ok: m.achievements.length >= 1 },
    ];

    const awarded: string[] = [];
    for (const rule of rules) {
      if (!rule.ok || owned.has(rule.name.toLowerCase())) continue;
      let badge = await this.prisma.badge.findFirst({
        where: { name: { equals: rule.name, mode: 'insensitive' } },
      });
      if (!badge) {
        badge = await this.prisma.badge.create({
          data: {
            name: rule.name,
            description: `Auto milestone: ${rule.name}`,
          },
        });
      }
      try {
        await this.prisma.memberBadge.create({
          data: { memberId, badgeId: badge.id },
        });
        awarded.push(badge.name);
      } catch {
        /* already has */
      }
    }
    return { awarded, stats: this.score(m) };
  }

  async generateCertificate(
    dto: GenerateCertificateDto,
    actorId?: string,
  ) {
    const member = await this.prisma.member.findUnique({
      where: { id: dto.memberId },
    });
    if (!member) throw new NotFoundException('Member not found');

    const cert = await this.prisma.certificate.create({
      data: {
        memberId: dto.memberId,
        title: dto.title,
        fileUrl: dto.fileUrl,
      },
    });
    await this.audit.log({
      actorId,
      action: 'certificate.generate',
      entityType: 'Certificate',
      entityId: cert.id,
      meta: { memberId: dto.memberId },
    });
    return cert;
  }

  async certificatePdf(certificateId: string): Promise<Buffer> {
    const cert = await this.prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        member: { select: { fullName: true, className: true } },
      },
    });
    if (!cert) throw new NotFoundException('Certificate not found');

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        layout: 'landscape',
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const w = doc.page.width;
      const h = doc.page.height;

      doc
        .rect(30, 30, w - 60, h - 60)
        .lineWidth(2)
        .strokeColor('#1d5ed8')
        .stroke();
      doc
        .rect(40, 40, w - 80, h - 80)
        .lineWidth(0.5)
        .strokeColor('#93c5fd')
        .stroke();

      doc
        .fontSize(14)
        .fillColor('#64748b')
        .text('ITCLUB', 0, 80, { align: 'center' });
      doc
        .fontSize(28)
        .fillColor('#0f172a')
        .text('Sertifikat', 0, 110, { align: 'center' });
      doc
        .fontSize(12)
        .fillColor('#64748b')
        .text('Diberikan kepada', 0, 160, { align: 'center' });
      doc
        .fontSize(26)
        .fillColor('#1d5ed8')
        .text(cert.member.fullName, 0, 185, { align: 'center' });
      if (cert.member.className) {
        doc
          .fontSize(11)
          .fillColor('#94a3b8')
          .text(cert.member.className, 0, 220, { align: 'center' });
      }
      doc
        .fontSize(14)
        .fillColor('#0f172a')
        .text(cert.title, 80, 260, {
          align: 'center',
          width: w - 160,
        });
      doc
        .fontSize(10)
        .fillColor('#94a3b8')
        .text(
          `Diterbitkan ${cert.issuedAt.toLocaleDateString('id-ID')}`,
          0,
          h - 90,
          { align: 'center' },
        );

      doc.end();
    });
  }

  async listCertificates(memberId: string) {
    const m = await this.prisma.member.findUnique({ where: { id: memberId } });
    if (!m) throw new NotFoundException('Member not found');
    return this.prisma.certificate.findMany({
      where: { memberId },
      orderBy: { issuedAt: 'desc' },
    });
  }
}
