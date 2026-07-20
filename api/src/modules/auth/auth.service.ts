import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ApprovalStatus, MemberStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import { TurnstileService } from '../../common/turnstile/turnstile.service';
import { AuditService } from '../../common/audit/audit.service';
import { randomToken, sha256 } from '../../common/utils/hash';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './types/jwt-payload';

type UserWithMember = {
  id: string;
  email: string;
  username: string;
  passwordHash?: string;
  member: {
    id: string;
    approvalStatus: ApprovalStatus;
    status: MemberStatus;
    periods: Array<{ role: JwtPayload['role']; periodId: string }>;
  } | null;
};

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mail: MailService,
    private turnstile: TurnstileService,
    private audit: AuditService,
  ) {}

  async register(dto: RegisterDto, ip?: string) {
    await this.turnstile.verify(dto.turnstileToken, ip);
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (exists) throw new ConflictException('Email or username already used');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        member: {
          create: {
            fullName: dto.fullName,
            className: dto.className,
            batchYear: dto.batchYear,
            interests: dto.interests ?? [],
          },
        },
      },
      include: { member: true },
    });

    await this.audit.log({
      actorId: user.id,
      action: 'auth.register',
      entityType: 'User',
      entityId: user.id,
      ip,
    });

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      member: user.member,
      message: 'Registration submitted, awaiting approval',
    };
  }

  async login(dto: LoginDto, ip?: string) {
    await this.turnstile.verify(dto.turnstileToken, ip);
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { username: dto.identifier }],
      },
      include: {
        member: {
          include: {
            periods: {
              where: { period: { isActive: true } },
              take: 1,
            },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    this.assertMemberCanAuth(user);

    const tokens = await this.issueTokens(this.toPayload(user));
    await this.audit.log({
      actorId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
      ip,
    });
    return tokens;
  }

  async refresh(refreshToken: string, ip?: string) {
    const tokenHash = sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            member: {
              include: {
                periods: {
                  where: { period: { isActive: true } },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    this.assertMemberCanAuth(stored.user);

    const tokens = await this.issueTokens(this.toPayload(stored.user));
    await this.audit.log({
      actorId: stored.user.id,
      action: 'auth.refresh',
      entityType: 'User',
      entityId: stored.user.id,
      ip,
    });
    return tokens;
  }

  async logout(userId: string, refreshToken?: string, ip?: string) {
    if (refreshToken) {
      const tokenHash = sha256(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { userId, tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.log({
      actorId: userId,
      action: 'auth.logout',
      entityType: 'User',
      entityId: userId,
      ip,
    });
    return { success: true };
  }

  async logoutByRefreshToken(refreshToken: string, ip?: string) {
    const tokenHash = sha256(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!stored || stored.revokedAt) return { success: true };
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({
      actorId: stored.userId,
      action: 'auth.logout',
      entityType: 'User',
      entityId: stored.userId,
      ip,
    });
    return { success: true };
  }

  async registerDeviceToken(
    userId: string,
    token: string,
    platform: string,
    biometricKey?: string,
  ) {
    const biometricKeyHash = biometricKey ? sha256(biometricKey) : undefined;
    return this.prisma.deviceToken.upsert({
      where: { token },
      create: {
        userId,
        token,
        platform,
        biometricKeyHash,
      },
      update: {
        userId,
        platform,
        ...(biometricKeyHash !== undefined ? { biometricKeyHash } : {}),
      },
    });
  }

  /**
   * Challenge-style biometric: client proves possession of secret by sending
   * the raw key once; we store only SHA-256. Lookup by hash, never raw.
   */
  async biometricLogin(biometricKey: string, ip?: string) {
    if (!biometricKey || biometricKey.length < 32) {
      throw new UnauthorizedException('Invalid biometric key');
    }
    const biometricKeyHash = sha256(biometricKey);
    const device = await this.prisma.deviceToken.findFirst({
      where: { biometricKeyHash },
      include: {
        user: {
          include: {
            member: {
              include: {
                periods: {
                  where: { period: { isActive: true } },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    if (!device) throw new UnauthorizedException('Invalid biometric key');

    this.assertMemberCanAuth(device.user);
    const tokens = await this.issueTokens(this.toPayload(device.user));
    await this.audit.log({
      actorId: device.user.id,
      action: 'auth.biometric_login',
      entityType: 'User',
      entityId: device.user.id,
      ip,
    });
    return tokens;
  }

  async forgotPassword(email: string, turnstileToken?: string, ip?: string) {
    await this.turnstile.verify(turnstileToken, ip);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const base = {
      message: 'If the email exists, a reset code was sent',
    };
    if (!user) return base;

    const code = String(randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        codeHash: sha256(code),
        expiresAt,
      },
    });

    try {
      await this.mail.sendPasswordReset(user.email, code);
    } catch {
      // don't leak mail failures
    }

    const isDev = this.config.get('NODE_ENV') !== 'production';
    return {
      ...base,
      ...(isDev && !this.mail.isConfigured() ? { devCode: code } : {}),
    };
  }

  async verifyResetCode(email: string, code: string) {
    await this.findValidReset(email, code);
    return { valid: true };
  }

  async resetPassword(
    email: string,
    code: string,
    password: string,
    turnstileToken?: string,
    ip?: string,
  ) {
    await this.turnstile.verify(turnstileToken, ip);
    const reset = await this.findValidReset(email, code);
    const passwordHash = await bcrypt.hash(password, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: reset.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.log({
      actorId: reset.userId,
      action: 'auth.reset_password',
      entityType: 'User',
      entityId: reset.userId,
      ip,
    });

    return { success: true };
  }

  /** Fresh role/period from DB — used by JwtStrategy so claims never go stale. */
  async resolvePayload(userId: string): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        member: {
          include: {
            periods: {
              where: { period: { isActive: true } },
              take: 1,
            },
          },
        },
      },
    });
    if (!user) throw new UnauthorizedException();
    this.assertMemberCanAuth(user);
    return this.toPayload(user);
  }

  private assertMemberCanAuth(user: UserWithMember) {
    if (!user.member) {
      throw new ForbiddenException('Member profile required');
    }
    if (user.member.approvalStatus === ApprovalStatus.PENDING) {
      throw new ForbiddenException('Account pending approval');
    }
    if (user.member.approvalStatus === ApprovalStatus.REJECTED) {
      throw new ForbiddenException('Account registration was rejected');
    }
    if (user.member.status === MemberStatus.INACTIVE) {
      throw new ForbiddenException('Account is inactive');
    }
  }

  private toPayload(user: UserWithMember): JwtPayload {
    const activePeriod = user.member?.periods[0];
    return {
      sub: user.id,
      email: user.email,
      username: user.username,
      memberId: user.member?.id,
      role: activePeriod?.role,
      periodId: activePeriod?.periodId,
    };
  }

  private async findValidReset(email: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Invalid or expired code');

    const reset = await this.prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
        codeHash: sha256(code),
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!reset) throw new BadRequestException('Invalid or expired code');
    return reset;
  }

  private async issueTokens(payload: JwtPayload) {
    const accessToken = await this.jwt.signAsync(
      { sub: payload.sub },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
      },
    );

    const refreshToken = randomToken(48);
    const days = Number(
      String(this.config.get('JWT_REFRESH_EXPIRES_IN', '7d')).replace(
        /[^0-9]/g,
        '',
      ) || 7,
    );
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash: sha256(refreshToken),
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
      user: {
        id: payload.sub,
        email: payload.email,
        username: payload.username,
        memberId: payload.memberId,
        role: payload.role,
        periodId: payload.periodId,
      },
    };
  }
}
