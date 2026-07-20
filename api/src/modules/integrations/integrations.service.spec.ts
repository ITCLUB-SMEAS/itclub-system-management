import { UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { IntegrationsService } from './integrations.service';

describe('IntegrationsService', () => {
  const prisma = {
    submission: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    activity: { findMany: jest.fn() },
    event: { findMany: jest.fn() },
  };

  function svc(env: Record<string, string | undefined> = {}) {
    const config = {
      get: jest.fn((k: string) => env[k]),
    } as unknown as ConfigService;
    return new IntegrationsService(prisma as never, config);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyGithubSignature', () => {
    it('skips when secret not configured (non-production)', () => {
      expect(
        svc({ NODE_ENV: 'test' }).verifyGithubSignature(
          Buffer.from('{}'),
          undefined,
        ),
      ).toBe(true);
    });

    it('rejects missing secret in production', () => {
      expect(() =>
        svc({ NODE_ENV: 'production' }).verifyGithubSignature(
          Buffer.from('{}'),
          undefined,
        ),
      ).toThrow(UnauthorizedException);
    });

    it('accepts valid hmac', () => {
      const body = '{"ok":true}';
      const secret = 'whsec';
      const sig =
        'sha256=' +
        createHmac('sha256', secret).update(body).digest('hex');
      expect(
        svc({ GITHUB_WEBHOOK_SECRET: secret }).verifyGithubSignature(
          Buffer.from(body),
          sig,
        ),
      ).toBe(true);
    });

    it('rejects invalid hmac', () => {
      expect(() =>
        svc({ GITHUB_WEBHOOK_SECRET: 'sec' }).verifyGithubSignature(
          Buffer.from('{}'),
          'sha256=deadbeef',
        ),
      ).toThrow(UnauthorizedException);
    });
  });

  describe('discordNotify', () => {
    const originalFetch = global.fetch;
    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('stubs when no webhook url', async () => {
      const res = await svc().discordNotify({ message: 'hello' });
      expect(res.stub).toBe(true);
    });

    it('posts to webhook when configured', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: async () => '',
      }) as unknown as typeof fetch;

      const res = await svc({
        DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/x',
      }).discordNotify({ message: 'hi', title: 'ITCLUB' });

      expect(res.queued).toBe(true);
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('calendarIcs', () => {
    it('builds valid VCALENDAR', async () => {
      prisma.activity.findMany.mockResolvedValue([
        {
          id: 'a1',
          title: 'Rapat',
          description: 'desk',
          location: 'Lab',
          startTime: new Date('2026-08-01T10:00:00Z'),
          endTime: new Date('2026-08-01T12:00:00Z'),
        },
      ]);
      prisma.event.findMany.mockResolvedValue([]);
      const ics = await svc().calendarIcs();
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('SUMMARY:Rapat');
      expect(ics).toContain('X-WR-CALNAME');
      expect(ics).toContain('BEGIN:VALARM');
      expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    });
  });
});
