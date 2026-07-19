import { Body, Controller, Ip, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
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
  login(@Body() dto: LoginDto, @Req() req: Request, @Ip() ip: string) {
    return this.auth.login(dto, clientIp(req, ip));
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
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
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    return this.auth.resetPassword(
      dto.email,
      dto.code,
      dto.password,
      dto.turnstileToken,
      clientIp(req, ip),
    );
  }

  @Post('logout')
  logout(@CurrentUser() user: JwtPayload, @Body() dto: RefreshDto) {
    return this.auth.logout(user.sub, dto.refreshToken);
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
  @Post('biometric-login')
  biometricLogin(@Body() dto: BiometricLoginDto) {
    return this.auth.biometricLogin(dto.biometricKey);
  }
}
