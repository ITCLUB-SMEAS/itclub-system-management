import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';
import { TurnstileService } from '../../common/turnstile/turnstile.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './types/jwt-payload';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mail: MailService,
    private turnstile: TurnstileService,
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
              include: { period: true },
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

    const activePeriod = user.member?.periods[0];
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      memberId: user.member?.id,
      role: activePeriod?.role,
      periodId: activePeriod?.periodId,
    };

    return this.issueTokens(payload);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            member: {
              include: {
                periods: {
                  include: { period: true },
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

    const user = stored.user;
    const activePeriod = user.member?.periods[0];
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      memberId: user.member?.id,
      role: activePeriod?.role,
      periodId: activePeriod?.periodId,
    };

    return this.issueTokens(payload);
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
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
    return { success: true };
  }

  async registerDeviceToken(
    userId: string,
    token: string,
    platform: string,
    biometricKey?: string,
  ) {
    return this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform, biometricKey },
      update: { userId, platform, biometricKey },
    });
  }

  async biometricLogin(biometricKey: string) {
    const device = await this.prisma.deviceToken.findFirst({
      where: { biometricKey },
      include: {
        user: {
          include: {
            member: {
              include: {
                periods: {
                  include: { period: true },
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

    const user = device.user;
    const activePeriod = user.member?.periods[0];
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      memberId: user.member?.id,
      role: activePeriod?.role,
      periodId: activePeriod?.periodId,
    };
    return this.issueTokens(payload);
  }

  async forgotPassword(email: string, turnstileToken?: string, ip?: string) {
    await this.turnstile.verify(turnstileToken, ip);
    const user = await this.prisma.user.findUnique({ where: { email } });
    // always same response — no email enumeration
    const base = {
      message: 'If the email exists, a reset code was sent',
    };
    if (!user) return base;

    const code = String(randomInt(100000, 999999));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        codeHash: this.hashToken(code),
        expiresAt,
      },
    });

    try {
      await this.mail.sendPasswordReset(user.email, code);
    } catch {
      // don't leak mail failures; still return generic message
    }

    const isDev = this.config.get('NODE_ENV') !== 'production';
    return {
      ...base,
      // expose code only when SMTP not configured (local dev)
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

    return { success: true };
  }

  private async findValidReset(email: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Invalid or expired code');

    const reset = await this.prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
        codeHash: this.hashToken(code),
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!reset) throw new BadRequestException('Invalid or expired code');
    return reset;
  }

  private async issueTokens(payload: JwtPayload) {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
    });

    const refreshToken = randomBytes(48).toString('hex');
    const days = 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash: this.hashToken(refreshToken),
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

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
