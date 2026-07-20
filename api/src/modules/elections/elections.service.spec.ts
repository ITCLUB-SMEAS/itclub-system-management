import { BadRequestException, ConflictException } from '@nestjs/common';
import { ElectionStatus } from '@prisma/client';
import { ElectionsService } from './elections.service';

describe('ElectionsService', () => {
  const prisma = {
    election: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    electionCandidate: { findFirst: jest.fn(), create: jest.fn() },
    vote: { create: jest.fn(), findUnique: jest.fn() },
    poll: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    pollOption: { findFirst: jest.fn(), update: jest.fn() },
    pollVote: { create: jest.fn() },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
      fn({
        pollVote: { create: jest.fn() },
        pollOption: {
          update: jest.fn().mockResolvedValue({ id: 'o1', votesCount: 1 }),
        },
      }),
    ),
  };
  const audit = { log: jest.fn().mockResolvedValue(null) };
  const service = new ElectionsService(prisma as never, audit as never);

  beforeEach(() => jest.clearAllMocks());

  it('vote rejects non-OPEN', async () => {
    prisma.election.findUnique.mockResolvedValue({
      id: 'e1',
      status: ElectionStatus.DRAFT,
    });
    await expect(
      service.vote('e1', 'm1', { candidateId: 'c1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('results blocked when not CLOSED for public', async () => {
    prisma.election.findUnique.mockResolvedValue({
      id: 'e1',
      status: ElectionStatus.OPEN,
      candidates: [],
      _count: { votes: 0 },
    });
    await expect(service.results('e1', false)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('pollVote rejects closed', async () => {
    prisma.poll.findUnique.mockResolvedValue({
      id: 'p1',
      closed: true,
    });
    await expect(
      service.pollVote('p1', 'm1', { optionId: 'o1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('vote conflict on double', async () => {
    prisma.election.findUnique.mockResolvedValue({
      id: 'e1',
      status: ElectionStatus.OPEN,
      endsAt: null,
    });
    prisma.electionCandidate.findFirst.mockResolvedValue({ id: 'c1' });
    prisma.vote.create.mockRejectedValue(new Error('unique'));
    await expect(
      service.vote('e1', 'm1', { candidateId: 'c1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
