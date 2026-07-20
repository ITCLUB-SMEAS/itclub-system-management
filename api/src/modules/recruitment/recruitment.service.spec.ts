import { ConflictException, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, RecruitmentStage } from '@prisma/client';
import { RecruitmentService } from './recruitment.service';

describe('RecruitmentService', () => {
  const prisma = {
    recruitmentApplication: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    membershipPeriod: { findFirst: jest.fn() },
    user: { create: jest.fn() },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
      fn({
        recruitmentApplication: {
          update: jest.fn().mockResolvedValue({}),
        },
        user: {
          create: jest.fn().mockResolvedValue({
            id: 'u1',
            email: 'a@b.c',
            username: 'ab',
            member: { id: 'm1' },
          }),
        },
        memberPeriod: { create: jest.fn() },
      }),
    ),
  };
  const turnstile = { verify: jest.fn().mockResolvedValue(true) };
  const mail = {
    sendWelcomeCredentials: jest.fn().mockResolvedValue({ stub: true }),
    isConfigured: jest.fn().mockReturnValue(false),
  };
  const audit = { log: jest.fn().mockResolvedValue(null) };
  const config = {
    get: jest.fn((k: string) => (k === 'NODE_ENV' ? 'test' : undefined)),
  };

  const service = new RecruitmentService(
    prisma as never,
    turnstile as never,
    mail as never,
    audit as never,
    config as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('apply rejects duplicate pending email', async () => {
    prisma.recruitmentApplication.findFirst.mockResolvedValue({ id: 'x' });
    await expect(
      service.apply({ fullName: 'A', email: 'a@b.c' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('setStage 404', async () => {
    prisma.recruitmentApplication.findUnique.mockResolvedValue(null);
    await expect(
      service.setStage('x', RecruitmentStage.TEST),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('advanceStage moves FORM → TEST', async () => {
    prisma.recruitmentApplication.findUnique.mockResolvedValue({
      id: 'a1',
      status: ApprovalStatus.PENDING,
      stage: RecruitmentStage.FORM,
    });
    prisma.recruitmentApplication.update.mockResolvedValue({
      id: 'a1',
      stage: RecruitmentStage.TEST,
    });
    const res = await service.advanceStage('a1');
    expect(res.stage).toBe(RecruitmentStage.TEST);
  });

  it('reject finalized fails', async () => {
    prisma.recruitmentApplication.findUnique.mockResolvedValue({
      id: 'a1',
      status: ApprovalStatus.APPROVED,
    });
    await expect(service.reject('a1')).rejects.toBeInstanceOf(ConflictException);
  });
});
