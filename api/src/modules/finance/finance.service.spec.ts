import { BadRequestException } from '@nestjs/common';
import { FinanceService } from './finance.service';

describe('FinanceService', () => {
  const prisma = {
    transaction: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    membershipPeriod: {
      findUnique: jest.fn(),
    },
    financialReport: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const audit = { log: jest.fn().mockResolvedValue(null) };
  const service = new FinanceService(prisma as never, audit as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('report aggregates income expense balance', async () => {
    prisma.transaction.findMany.mockResolvedValue([
      {
        type: 'INCOME',
        amount: 100000,
        occurredAt: new Date(),
        description: 'iuran',
        voidedAt: null,
        category: null,
      },
      {
        type: 'INCOME',
        amount: 50000,
        occurredAt: new Date(),
        description: 'donasi',
        voidedAt: null,
        category: 'Donasi',
      },
      {
        type: 'EXPENSE',
        amount: 30000,
        occurredAt: new Date(),
        description: 'snack',
        voidedAt: null,
        category: null,
      },
      {
        type: 'EXPENSE',
        amount: 99999,
        occurredAt: new Date(),
        description: 'voided',
        voidedAt: new Date(),
        category: null,
      },
    ]);
    prisma.membershipPeriod.findUnique.mockResolvedValue({ name: '2025/2026' });

    const report = await service.report('period-1');
    expect(report.income).toBe(150000);
    expect(report.expense).toBe(30000);
    expect(report.balance).toBe(120000);
    expect(report.count).toBe(3);
    expect(report.voidedCount).toBe(1);
    expect(report.periodName).toBe('2025/2026');
    expect(report.byCategory.length).toBeGreaterThan(0);
  });

  it('create records transaction', async () => {
    prisma.transaction.create.mockResolvedValue({ id: 't1' });
    await service.create('member-1', {
      type: 'INCOME' as never,
      amount: 10_000,
      description: 'test',
      periodId: 'p1',
      category: 'Iuran',
    });
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 10_000,
        recordedById: 'member-1',
        description: 'test',
        category: 'Iuran',
      }),
    });
  });

  it('void marks transaction', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 't1',
      voidedAt: null,
    });
    prisma.transaction.update.mockResolvedValue({
      id: 't1',
      voidedAt: new Date(),
    });
    await service.voidTx('t1', 'user-1');
    expect(prisma.transaction.update).toHaveBeenCalled();
  });

  it('void rejects already voided', async () => {
    prisma.transaction.findUnique.mockResolvedValue({
      id: 't1',
      voidedAt: new Date(),
    });
    await expect(service.voidTx('t1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('reportPdf returns PDF buffer', async () => {
    prisma.transaction.findMany.mockResolvedValue([
      {
        type: 'INCOME',
        amount: 1000,
        occurredAt: new Date('2026-01-01'),
        description: 'iuran',
        voidedAt: null,
        category: null,
      },
    ]);
    prisma.membershipPeriod.findUnique.mockResolvedValue({ name: '2025/2026' });

    const buf = await service.reportPdf('period-1');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    expect(buf.length).toBeGreaterThan(500);
  });

  it('reportCsv includes totals', async () => {
    prisma.transaction.findMany.mockResolvedValue([
      {
        type: 'INCOME',
        amount: 1000,
        occurredAt: new Date('2026-01-01'),
        description: 'iuran',
        voidedAt: null,
        category: 'Iuran',
        recordedBy: { fullName: 'Bendahara' },
      },
    ]);
    const csv = await service.reportCsv();
    expect(csv).toContain('total_income,1000');
    expect(csv).toContain('Iuran');
  });
});
