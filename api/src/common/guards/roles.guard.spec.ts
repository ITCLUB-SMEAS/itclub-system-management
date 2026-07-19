import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleName } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function ctx(user?: { role?: string }) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows when no roles required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(ctx({ role: RoleName.ANGGOTA }))).toBe(true);
  });

  it('allows matching role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([RoleName.KETUA]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(ctx({ role: RoleName.KETUA }))).toBe(true);
  });

  it('forbids missing role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([RoleName.KETUA]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(ctx({}))).toThrow(ForbiddenException);
  });

  it('forbids wrong role', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([RoleName.BENDAHARA]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() =>
      guard.canActivate(ctx({ role: RoleName.ANGGOTA })),
    ).toThrow(ForbiddenException);
  });
});
