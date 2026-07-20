import {
  parseDurationMs,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
} from './auth-cookies';

describe('auth-cookies', () => {
  it('exports cookie names', () => {
    expect(ACCESS_COOKIE).toBe('clubit_access');
    expect(REFRESH_COOKIE).toBe('clubit_refresh');
  });

  it('parses duration strings', () => {
    expect(parseDurationMs('15m', 0)).toBe(15 * 60_000);
    expect(parseDurationMs('7d', 0)).toBe(7 * 86_400_000);
    expect(parseDurationMs('30s', 0)).toBe(30_000);
    expect(parseDurationMs('bad', 999)).toBe(999);
  });
});
