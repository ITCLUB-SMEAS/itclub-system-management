import { FinanceService } from './finance.service';

describe('FinanceService', () => {
  const prisma = {
    transaction: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    membershipPeriod: {
      findUnique: jest.fn(),
    },
  };

  const service = new FinanceService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('report aggregates income expense balance', async () => {
    prisma.transaction.findMany.mockResolvedValue([
      { type: 'INCOME', amount: 100000, occurredAt: new Date(), description: 'iuran' },
      { type: 'INCOME', amount: 50000, occurredAt: new Date(), description: 'donasi' },
      { type: 'EXPENSE', amount: 30000, occurredAt: new Date(), description: 'snack' },
    ]);
    prisma.membershipPeriod.findUnique.mockResolvedValue({ name: '2025/2026' });

    const report = await service.report('period-1');
    expect(report.income).toBe(150000);
    expect(report.expense).toBe(30000);
    expect(report.balance).toBe(120000);
    expect(report.count).toBe(3);
    expect(report.periodName).toBe('2025/2026');
  });

  it('create records transaction', async () => {
    prisma.transaction.create.mockResolvedValue({ id: 't1' });
    await service.create('member-1', {
      type: 'INCOME' as never,
      amount: 10_000,
      description: 'test',
      periodId: 'p1',
    });
    expect(prisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 10_000,
        recordedById: 'member-1',
        description: 'test',
      }),
    });
  });

  it('reportPdf returns PDF buffer', async () => {
    prisma.transaction.findMany.mockResolvedValue([
      {
        type: 'INCOME',
        amount: 1000,
        occurredAt: new Date('2026-01-01'),
        description: 'iuran',
      },
    ]);
    prisma.membershipPeriod.findUnique.mockResolvedValue({ name: '2025/2026' });

    const buf = await service.reportPdf('period-1');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    expect(buf.length).toBeGreaterThan(500);
  });
});
