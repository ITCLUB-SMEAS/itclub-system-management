import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

jest.mock('bcrypt');

function makeService(overrides?: {
  prisma?: Partial<Record<string, unknown>>;
  turnstile?: { verify: jest.Mock };
}) {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    passwordReset: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    deviceToken: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((ops: unknown) =>
      Promise.all(ops as Promise<unknown>[]),
    ),
    ...overrides?.prisma,
  };

  const jwt = {
    signAsync: jest.fn().mockResolvedValue('access.jwt'),
  } as unknown as JwtService;

  const config = {
    get: jest.fn((k: string, def?: string) => {
      if (k === 'JWT_EXPIRES_IN') return '15m';
      if (k === 'JWT_REFRESH_EXPIRES_IN') return '7d';
      if (k === 'NODE_ENV') return 'test';
      return def;
    }),
    getOrThrow: jest.fn((k: string) => {
      if (k === 'JWT_SECRET') return 'secret';
      throw new Error(`missing ${k}`);
    }),
  } as unknown as ConfigService;

  const mail = {
    sendPasswordReset: jest.fn().mockResolvedValue({ stub: true }),
    isConfigured: jest.fn().mockReturnValue(false),
  };

  const turnstile = overrides?.turnstile ?? {
    verify: jest.fn().mockResolvedValue(true),
  };

  const audit = {
    log: jest.fn().mockResolvedValue(null),
  };

  const service = new AuthService(
    prisma as never,
    jwt,
    config,
    mail as never,
    turnstile as never,
    audit as never,
  );

  return { service, prisma, jwt, turnstile, mail, audit };
}

describe('AuthService', () => {
  describe('register', () => {
    it('rejects duplicate email/username', async () => {
      const { service, prisma } = makeService();
      prisma.user.findFirst.mockResolvedValue({ id: 'u1' });
      await expect(
        service.register({
          email: 'a@b.c',
          username: 'a',
          password: 'password123',
          fullName: 'A',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates user + member', async () => {
      const { service, prisma, turnstile } = makeService();
      prisma.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');
      prisma.user.create.mockResolvedValue({
        id: 'u1',
        email: 'a@b.c',
        username: 'a',
        member: { id: 'm1', fullName: 'A' },
      });

      const res = await service.register({
        email: 'a@b.c',
        username: 'a',
        password: 'password123',
        fullName: 'A',
      });

      expect(turnstile.verify).toHaveBeenCalled();
      expect(res.email).toBe('a@b.c');
      expect(res.member).toBeTruthy();
    });
  });

  describe('login', () => {
    it('rejects bad credentials', async () => {
      const { service, prisma } = makeService();
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.login({ identifier: 'x', password: 'password123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects pending approval', async () => {
      const { service, prisma } = makeService();
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'p@x.com',
        username: 'p',
        passwordHash: 'hash',
        member: {
          id: 'm1',
          approvalStatus: 'PENDING',
          status: 'ACTIVE',
          periods: [],
        },
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({ identifier: 'p', password: 'password123' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns tokens on success', async () => {
      const { service, prisma, jwt } = makeService();
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        email: 'ketua@clubit.local',
        username: 'ketua',
        passwordHash: 'hash',
        member: {
          id: 'm1',
          approvalStatus: 'APPROVED',
          status: 'ACTIVE',
          periods: [{ role: 'KETUA', periodId: 'p1' }],
        },
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.refreshToken.create.mockResolvedValue({});

      const res = await service.login({
        identifier: 'ketua',
        password: 'password123',
      });

      expect(jwt.signAsync).toHaveBeenCalled();
      expect(res.accessToken).toBe('access.jwt');
      expect(res.refreshToken).toHaveLength(96);
      expect(res.user.role).toBe('KETUA');
    });
  });
});
