import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type TurnstileResponse = {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
};

@Injectable()
export class TurnstileService {
  private readonly log = new Logger(TurnstileService.name);
  private readonly verifyUrl =
    'https://challenges.cloudflare.com/turnstile/v0/siteverify';

  constructor(private config: ConfigService) {}

  isEnabled() {
    return !!this.config.get<string>('TURNSTILE_SECRET_KEY');
  }

  async verify(token: string | undefined, remoteip?: string) {
    const secret = this.config.get<string>('TURNSTILE_SECRET_KEY');

    // dev: no secret → skip (local without Turnstile)
    if (!secret) {
      this.log.debug('Turnstile disabled (no TURNSTILE_SECRET_KEY)');
      return true;
    }

    if (!token?.trim()) {
      throw new BadRequestException('Captcha required');
    }

    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token);
    if (remoteip) body.set('remoteip', remoteip);

    try {
      const res = await fetch(this.verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const data = (await res.json()) as TurnstileResponse;
      if (!data.success) {
        this.log.warn(`Turnstile fail: ${data['error-codes']?.join(',')}`);
        throw new BadRequestException('Captcha verification failed');
      }
      return true;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.log.error('Turnstile request error', err);
      throw new BadRequestException('Captcha verification unavailable');
    }
  }
}
