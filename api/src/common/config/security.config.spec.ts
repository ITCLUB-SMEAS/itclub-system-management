import { assertJwtSecrets } from './security.config';

describe('assertJwtSecrets', () => {
  const base = { ...process.env };

  afterEach(() => {
    process.env = { ...base };
  });

  it('throws in production on short secret', () => {
    expect(() =>
      assertJwtSecrets({
        NODE_ENV: 'production',
        JWT_SECRET: 'short',
        JWT_REFRESH_SECRET: 'also-short',
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('throws in production on placeholder', () => {
    expect(() =>
      assertJwtSecrets({
        NODE_ENV: 'production',
        JWT_SECRET: 'change-me-in-production-clubit-jwt-secret-key',
        JWT_REFRESH_SECRET: 'a'.repeat(40),
      }),
    ).toThrow(/placeholder/);
  });

  it('allows strong secrets in production', () => {
    expect(() =>
      assertJwtSecrets({
        NODE_ENV: 'production',
        JWT_SECRET: 'a'.repeat(40),
        JWT_REFRESH_SECRET: 'b'.repeat(40),
      }),
    ).not.toThrow();
  });
});
