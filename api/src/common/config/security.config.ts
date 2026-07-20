import { Logger } from '@nestjs/common';

const PLACEHOLDER_SECRETS = [
  'change-me',
  'change-me-in-production',
  'change-me-in-production-clubit-jwt-secret-key',
  'change-me-in-production-clubit-refresh-secret',
  'change-me-long-random-string',
  'change-me-another-long-random',
  'clubit-jwt',
  'your-secret',
  'jwt-secret',
];

export function assertJwtSecrets(env: NodeJS.ProcessEnv = process.env) {
  const log = new Logger('SecurityConfig');
  const isProd = env.NODE_ENV === 'production';
  const secret = env.JWT_SECRET ?? '';
  const refresh = env.JWT_REFRESH_SECRET ?? '';

  if (!secret || secret.length < 32) {
    const msg =
      'JWT_SECRET missing or shorter than 32 chars. Set a long random secret.';
    if (isProd) throw new Error(msg);
    log.warn(msg);
  }

  if (!refresh || refresh.length < 32) {
    const msg =
      'JWT_REFRESH_SECRET missing or shorter than 32 chars. Set a long random secret.';
    if (isProd) throw new Error(msg);
    log.warn(msg);
  }

  const looksPlaceholder = (v: string) =>
    PLACEHOLDER_SECRETS.some(
      (p) => v.toLowerCase() === p || v.toLowerCase().includes(p),
    );

  if (looksPlaceholder(secret) || looksPlaceholder(refresh)) {
    const msg =
      'JWT_SECRET / JWT_REFRESH_SECRET looks like a placeholder. Refuse weak secrets in production.';
    if (isProd) throw new Error(msg);
    log.warn(msg);
  }
}

export function isProduction(env: NodeJS.ProcessEnv = process.env) {
  return env.NODE_ENV === 'production';
}
