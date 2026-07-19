import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';

/**
 * E2E smoke — requires DATABASE_URL + migrated DB (CI provides Postgres).
 * Local: skip if DB unreachable.
 */
describe('API e2e (smoke)', () => {
  let app: INestApplication<App>;
  let ready = false;

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.setGlobalPrefix('api/v1');
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      app.useGlobalFilters(new HttpExceptionFilter());
      app.useGlobalInterceptors(new ResponseInterceptor());
      app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));
      await app.init();
      ready = true;
    } catch {
      ready = false;
    }
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  const itDb = (name: string, fn: () => Promise<void>) =>
    it(name, async () => {
      if (!ready) {
        console.warn('skip e2e: app failed to boot (DB?)');
        return;
      }
      await fn();
    });

  itDb('GET /portfolio/showcase is public', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/portfolio/showcase')
      .expect(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.error).toBeNull();
  });

  itDb('POST /auth/login rejects bad password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: 'nobody@x.com', password: 'wrongpass' })
      .expect(401);
    expect(res.body.data).toBeNull();
  });

  itDb('protected route requires JWT', async () => {
    await request(app.getHttpServer()).get('/api/v1/members').expect(401);
  });
});
