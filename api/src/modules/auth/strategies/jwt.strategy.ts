import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../types/jwt-payload';
import { ACCESS_COOKIE } from '../../../common/auth/auth-cookies';

type AccessTokenClaims = { sub: string };

function fromCookieOrBearer(req: Request): string | null {
  const cookie = req?.cookies?.[ACCESS_COOKIE];
  if (typeof cookie === 'string' && cookie.length) return cookie;
  return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private auth: AuthService,
  ) {
    super({
      jwtFromRequest: fromCookieOrBearer,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: AccessTokenClaims): Promise<JwtPayload> {
    if (!payload?.sub) throw new UnauthorizedException();
    return this.auth.resolvePayload(payload.sub);
  }
}
