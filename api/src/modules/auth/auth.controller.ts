import {
  Body,
  Controller,
  Get,
  Ip,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { DeviceTokenDto } from './dto/device-token.dto';
import { BiometricLoginDto } from './dto/biometric-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from './types/jwt-payload';
import {
  clearAuthCookies,
  readRefreshCookie,
  setAuthCookies,
} from '../../common/auth/auth-cookies';

function clientIp(req: Request, fallback?: string) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return fallback ?? req.ip;
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request, @Ip() ip: string) {
    return this.auth.register(dto, clientIp(req, ip));
  }

  @Public()
  @Throttle({ auth: { limit: 15, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const tokens = await this.auth.login(dto, clientIp(req, ip));
    setAuthCookies(res, tokens);
    return tokens;
  }

  @Public()
  @Throttle({ auth: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const refreshToken = dto.refreshToken ?? readRefreshCookie(req) ?? '';
    const tokens = await this.auth.refresh(refreshToken, clientIp(req, ip));
    setAuthCookies(res, tokens);
    return tokens;
  }

  @Public()
  @Throttle({ auth: { limit: 8, ttl: 60_000 } })
  @Post('forgot-password')
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.auth.forgotPassword(
      dto.email,
      dto.turnstileToken,
      clientIp(req, ip),
    );
  }

  @Public()
  @Throttle({ auth: { limit: 15, ttl: 60_000 } })
  @Post('verify-code')
  verifyCode(@Body() dto: VerifyCodeDto) {
    return this.auth.verifyResetCode(dto.email, dto.code);
  }

  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const result = await this.auth.resetPassword(
      dto.email,
      dto.code,
      dto.password,
      dto.turnstileToken,
      clientIp(req, ip),
    );
    clearAuthCookies(res);
    return result;
  }

  /** Session bootstrap — cookies only, no token in JS */
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return {
      id: user.sub,
      email: user.email,
      username: user.username,
      memberId: user.memberId,
      role: user.role,
      periodId: user.periodId,
    };
  }

  @Post('logout')
  async logout(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const refreshToken = dto.refreshToken ?? readRefreshCookie(req) ?? undefined;
    const result = await this.auth.logout(
      user.sub,
      refreshToken,
      clientIp(req, ip),
    );
    clearAuthCookies(res);
    return result;
  }

  /** Clear cookies even if access JWT already expired */
  @Public()
  @Post('logout-cookie')
  async logoutCookie(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const refreshToken = readRefreshCookie(req);
    if (refreshToken) {
      try {
        await this.auth.logoutByRefreshToken(refreshToken, clientIp(req, ip));
      } catch {
        /* ignore */
      }
    }
    clearAuthCookies(res);
    return { success: true };
  }

  @Post('device-token')
  deviceToken(@CurrentUser() user: JwtPayload, @Body() dto: DeviceTokenDto) {
    return this.auth.registerDeviceToken(
      user.sub,
      dto.token,
      dto.platform,
      dto.biometricKey,
    );
  }

  @Public()
  @Throttle({ auth: { limit: 15, ttl: 60_000 } })
  @Post('biometric-login')
  async biometricLogin(
    @Body() dto: BiometricLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const tokens = await this.auth.biometricLogin(
      dto.biometricKey,
      clientIp(req, ip),
    );
    setAuthCookies(res, tokens);
    return tokens;
  }
}
