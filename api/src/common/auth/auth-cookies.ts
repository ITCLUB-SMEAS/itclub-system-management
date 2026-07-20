import type { Request, Response } from 'express';
import { isProduction } from '../config/security.config';

export const ACCESS_COOKIE = 'clubit_access';
export const REFRESH_COOKIE = 'clubit_refresh';

function baseOpts() {
  const prod = isProduction();
  return {
    httpOnly: true as const,
    secure: prod,
    sameSite: 'lax' as const,
    path: '/',
  };
}

/** Parse JWT_EXPIRES_IN like 15m / 1h / 7d → ms */
export function parseDurationMs(raw: string | undefined, fallbackMs: number) {
  if (!raw) return fallbackMs;
  const m = String(raw).trim().match(/^(\d+)(ms|s|m|h|d)?$/i);
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  const u = (m[2] ?? 's').toLowerCase();
  const mult =
    u === 'ms' ? 1 : u === 's' ? 1000 : u === 'm' ? 60_000 : u === 'h' ? 3_600_000 : 86_400_000;
  return n * mult;
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  opts?: { accessMs?: number; refreshMs?: number },
) {
  const accessMs = opts?.accessMs ?? parseDurationMs(process.env.JWT_EXPIRES_IN, 15 * 60_000);
  const refreshMs =
    opts?.refreshMs ?? parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN, 7 * 86_400_000);

  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOpts(),
    maxAge: accessMs,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOpts(),
    maxAge: refreshMs,
  });
}

export function clearAuthCookies(res: Response) {
  const o = baseOpts();
  res.clearCookie(ACCESS_COOKIE, o);
  res.clearCookie(REFRESH_COOKIE, o);
}

export function readAccessCookie(req: Request): string | null {
  const v = req.cookies?.[ACCESS_COOKIE];
  return typeof v === 'string' && v.length ? v : null;
}

export function readRefreshCookie(req: Request): string | null {
  const v = req.cookies?.[REFRESH_COOKIE];
  return typeof v === 'string' && v.length ? v : null;
}
