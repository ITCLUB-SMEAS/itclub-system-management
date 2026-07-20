import { NotFoundException } from '@nestjs/common';
import { LearningService } from './learning.service';

describe('LearningService', () => {
  const prisma = {
    learningPath: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    learningResource: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    learningProgress: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  const audit = { log: jest.fn().mockResolvedValue(null) };
  const service = new LearningService(prisma as never, audit as never);

  beforeEach(() => jest.clearAllMocks());

  it('getPath 404', async () => {
    prisma.learningPath.findUnique.mockResolvedValue(null);
    await expect(service.getPath('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getPath attaches progress', async () => {
    prisma.learningPath.findUnique.mockResolvedValue({
      id: 'p1',
      name: 'Web',
      level: 'JUNIOR',
      resources: [
        { id: 'r1', title: 'HTML' },
        { id: 'r2', title: 'CSS' },
      ],
    });
    prisma.learningProgress.findMany.mockResolvedValue([{ resourceId: 'r1' }]);
    const res = await service.getPath('p1', 'm1');
    expect(res.progress.completed).toBe(1);
    expect(res.progress.total).toBe(2);
    expect(res.resources[0].completed).toBe(true);
    expect(res.resources[1].completed).toBe(false);
  });

  it('markComplete upserts', async () => {
    prisma.learningResource.findUnique.mockResolvedValue({ id: 'r1' });
    prisma.learningProgress.upsert.mockResolvedValue({ id: 'prog' });
    await service.markComplete('r1', 'm1');
    expect(prisma.learningProgress.upsert).toHaveBeenCalled();
  });
});
