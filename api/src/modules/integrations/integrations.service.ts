import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IntegrationsService {
  private readonly log = new Logger(IntegrationsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  verifyGithubSignature(rawBody: Buffer | string | undefined, signature?: string) {
    const secret = this.config.get<string>('GITHUB_WEBHOOK_SECRET');
    if (!secret) {
      if (this.config.get('NODE_ENV') === 'production') {
        throw new UnauthorizedException(
          'GITHUB_WEBHOOK_SECRET required in production',
        );
      }
      this.log.warn('GITHUB_WEBHOOK_SECRET not set — skip signature check (dev only)');
      return true;
    }
    if (!signature?.startsWith('sha256=') || !rawBody) {
      throw new UnauthorizedException('Invalid GitHub signature');
    }
    const expected = createHmac('sha256', secret)
      .update(typeof rawBody === 'string' ? rawBody : rawBody)
      .digest('hex');
    const received = signature.slice('sha256='.length);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(received, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid GitHub signature');
    }
    return true;
  }

  async githubWebhook(
    payload: {
      repository?: { html_url?: string; full_name?: string };
      commits?: unknown[];
    },
    rawBody?: Buffer,
    signature?: string,
  ) {
    this.verifyGithubSignature(rawBody, signature);

    const repoUrl =
      payload.repository?.html_url ??
      (payload.repository?.full_name
        ? `https://github.com/${payload.repository.full_name}`
        : undefined);
    const commitCount = payload.commits?.length ?? 0;
    if (!repoUrl || !commitCount) {
      return { updated: 0, commitCount: 0 };
    }

    const needle = repoUrl
      .replace('https://github.com/', '')
      .replace(/\.git$/, '');
    const submissions = await this.prisma.submission.findMany({
      where: { repoUrl: { contains: needle } },
      select: { id: true, githubCommitCount: true },
    });

    await Promise.all(
      submissions.map((s) =>
        this.prisma.submission.update({
          where: { id: s.id },
          data: { githubCommitCount: (s.githubCommitCount ?? 0) + commitCount },
        }),
      ),
    );

    return { updated: submissions.length, commitCount, repo: needle };
  }

  async discordNotify(body: {
    message: string;
    title?: string;
    channel?: string;
  }) {
    if (!body.message?.trim()) {
      throw new BadRequestException('message required');
    }

    const url =
      this.config.get<string>('DISCORD_WEBHOOK_URL') ||
      (body.channel
        ? this.config.get<string>(`DISCORD_WEBHOOK_${body.channel.toUpperCase()}`)
        : undefined);

    if (!url) {
      this.log.log(`[discord:stub] ${body.title ?? ''} ${body.message}`);
      return {
        queued: false,
        stub: true as const,
        channel: body.channel ?? 'default',
        message: body.message,
      };
    }

    const payload = {
      content: body.title ? `**${body.title}**\n${body.message}` : body.message,
      embeds: body.title
        ? [
            {
              title: body.title,
              description: body.message.slice(0, 2000),
              color: 0x3b93f6,
              timestamp: new Date().toISOString(),
              footer: { text: 'ITCLUB' },
            },
          ]
        : undefined,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        body.title
          ? {
              embeds: payload.embeds,
            }
          : { content: body.message.slice(0, 2000) },
      ),
    });

    if (!res.ok) {
      const text = await res.text();
      this.log.error(`Discord webhook failed ${res.status}: ${text}`);
      throw new BadRequestException('Discord notify failed');
    }

    return {
      queued: true,
      stub: false as const,
      channel: body.channel ?? 'default',
    };
  }

  status() {
    const github = !!this.config.get<string>('GITHUB_WEBHOOK_SECRET');
    const discord = !!this.config.get<string>('DISCORD_WEBHOOK_URL');
    return {
      github: {
        configured: github,
        webhookPath: '/api/v1/integrations/github/webhook',
        requiredInProduction: true,
      },
      discord: {
        configured: discord,
        stubWhenMissing: true,
      },
      calendar: {
        icsPath: '/api/v1/integrations/calendar/sync.ics',
        googleCalendar: {
          // ponytail: OAuth sync when Google Calendar credentials added
          supported: false,
          note: 'Gunakan import .ics ke Google Calendar / Apple Calendar',
        },
      },
      whatsapp: {
        // ponytail: WA Business API when needed
        supported: false,
        note: 'Gunakan Discord webhook sebagai channel notifikasi',
      },
    };
  }

  async calendarIcs() {
    const now = new Date();
    const from = new Date(now.getTime() - 30 * 86_400_000);
    const activities = await this.prisma.activity.findMany({
      where: { startTime: { gte: from } },
      orderBy: { startTime: 'asc' },
    });
    const events = await this.prisma.event.findMany({
      where: { startDate: { gte: from } },
      orderBy: { startDate: 'asc' },
    });

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ITCLUB//Ekskul Management//ID',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:ITCLUB Kegiatan',
      'X-WR-TIMEZONE:Asia/Jakarta',
    ];

    for (const a of activities) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:activity-${a.id}@clubit.local`,
        `DTSTAMP:${this.toIcsDate(now)}`,
        `DTSTART:${this.toIcsDate(a.startTime)}`,
        `DTEND:${this.toIcsDate(a.endTime)}`,
        `SUMMARY:${this.escape(a.title)}`,
      );
      if (a.description) lines.push(`DESCRIPTION:${this.escape(a.description)}`);
      if (a.location) lines.push(`LOCATION:${this.escape(a.location)}`);
      lines.push(
        'BEGIN:VALARM',
        'TRIGGER:-PT24H',
        'ACTION:DISPLAY',
        `DESCRIPTION:Reminder: ${this.escape(a.title)}`,
        'END:VALARM',
        'END:VEVENT',
      );
    }

    for (const e of events) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:event-${e.id}@clubit.local`,
        `DTSTAMP:${this.toIcsDate(now)}`,
        `DTSTART:${this.toIcsDate(e.startDate)}`,
      );
      if (e.endDate) lines.push(`DTEND:${this.toIcsDate(e.endDate)}`);
      lines.push(`SUMMARY:${this.escape(`[${e.type}] ${e.title}`)}`);
      if (e.description) lines.push(`DESCRIPTION:${this.escape(e.description)}`);
      if (e.location) lines.push(`LOCATION:${this.escape(e.location)}`);
      lines.push(
        'BEGIN:VALARM',
        'TRIGGER:-PT24H',
        'ACTION:DISPLAY',
        `DESCRIPTION:Reminder: ${this.escape(e.title)}`,
        'END:VALARM',
        'END:VEVENT',
      );
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }

  /** UTC form YYYYMMDDTHHMMSSZ */
  private toIcsDate(d: Date) {
    return d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  }

  private escape(s: string) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }
}
