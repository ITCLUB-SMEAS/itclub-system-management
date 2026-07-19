import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function serviceWithSecret(secret?: string) {
    const config = {
      get: jest.fn((key: string) =>
        key === 'TURNSTILE_SECRET_KEY' ? secret : undefined,
      ),
    } as unknown as ConfigService;
    return new TurnstileService(config);
  }

  it('isEnabled false without secret', () => {
    expect(serviceWithSecret().isEnabled()).toBe(false);
  });

  it('skips verify when secret not set', async () => {
    await expect(serviceWithSecret().verify(undefined)).resolves.toBe(true);
  });

  it('requires token when secret set', async () => {
    await expect(serviceWithSecret('sec').verify('')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepts successful siteverify', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: true }),
    }) as unknown as typeof fetch;

    await expect(
      serviceWithSecret('sec').verify('tok', '1.2.3.4'),
    ).resolves.toBe(true);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rejects failed siteverify', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    }) as unknown as typeof fetch;

    await expect(serviceWithSecret('sec').verify('bad')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
