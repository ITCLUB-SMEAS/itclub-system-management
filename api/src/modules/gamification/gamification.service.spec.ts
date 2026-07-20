import { NotFoundException } from '@nestjs/common';
import { GamificationService } from './gamification.service';

describe('GamificationService', () => {
  const prisma = {
    badge: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    member: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    memberBadge: { create: jest.fn() },
    certificate: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const audit = { log: jest.fn().mockResolvedValue(null) };
  const service = new GamificationService(prisma as never, audit as never);

  beforeEach(() => jest.clearAllMocks());

  it('leaderboard sorts by points', async () => {
    prisma.member.findMany.mockResolvedValue([
      {
        id: 'm1',
        fullName: 'A',
        badges: [{}],
        attendances: [],
        submissions: [],
        achievements: [],
      },
      {
        id: 'm2',
        fullName: 'B',
        badges: [{}, {}],
        attendances: [{}, {}, {}],
        submissions: [{}],
        achievements: [{}],
      },
    ]);
    const board = await service.leaderboard();
    expect(board[0].memberId).toBe('m2');
    // 2*10 + 3*2 + 1*5 + 1*15 = 20+6+5+15 = 46
    expect(board[0].points).toBe(46);
  });

  it('myStats 404', async () => {
    prisma.member.findUnique.mockResolvedValue(null);
    await expect(service.myStats('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('certificatePdf returns PDF', async () => {
    prisma.certificate.findUnique.mockResolvedValue({
      id: 'c1',
      title: 'Peserta Aktif',
      issuedAt: new Date('2026-01-01'),
      member: { fullName: 'Ketua ITCLUB', className: 'XII' },
    });
    const buf = await service.certificatePdf('c1');
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
  });
});
