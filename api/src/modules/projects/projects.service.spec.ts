import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  const prisma = {
    project: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    member: { findUnique: jest.fn() },
    submission: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    feedback: { create: jest.fn() },
    mentorAssignment: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    notification: { create: jest.fn(), createMany: jest.fn() },
  };
  const audit = { log: jest.fn().mockResolvedValue(null) };
  const service = new ProjectsService(prisma as never, audit as never);

  beforeEach(() => jest.clearAllMocks());

  describe('updateStatus', () => {
    it('blocks illegal assignee jump', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 't1',
        status: TaskStatus.TODO,
        assigneeId: 'm1',
      });
      await expect(
        service.updateStatus(
          't1',
          { status: TaskStatus.DONE },
          { sub: 'u', memberId: 'm1', email: 'a', username: 'a' },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows assignee +1', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 't1',
        status: TaskStatus.TODO,
        assigneeId: 'm1',
      });
      prisma.task.update.mockResolvedValue({
        id: 't1',
        status: TaskStatus.IN_PROGRESS,
      });
      const res = await service.updateStatus(
        't1',
        { status: TaskStatus.IN_PROGRESS },
        { sub: 'u', memberId: 'm1', email: 'a', username: 'a' },
      );
      expect(res.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('forbids non-assignee non-pengurus', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 't1',
        status: TaskStatus.TODO,
        assigneeId: 'other',
      });
      await expect(
        service.updateStatus(
          't1',
          { status: TaskStatus.IN_PROGRESS },
          { sub: 'u', memberId: 'm1', email: 'a', username: 'a' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('submit', () => {
    it('requires at least one url', async () => {
      await expect(
        service.submit('t1', 'm1', {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('moves task to REVIEW', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 't1',
        status: TaskStatus.IN_PROGRESS,
        assigneeId: 'm1',
        project: { name: 'P' },
      });
      prisma.submission.create.mockResolvedValue({ id: 's1' });
      prisma.task.update.mockResolvedValue({});
      prisma.mentorAssignment.findMany.mockResolvedValue([]);

      await service.submit('t1', 'm1', { repoUrl: 'https://github.com/a/b' });
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: TaskStatus.REVIEW },
        }),
      );
    });

    it('404 missing task', async () => {
      prisma.task.findUnique.mockResolvedValue(null);
      await expect(
        service.submit('x', 'm1', { demoUrl: 'https://x.com' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
