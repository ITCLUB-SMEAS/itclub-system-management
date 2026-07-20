import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';
import { EventsService } from './events.service';

describe('EventsService', () => {
  const prisma = {
    event: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    eventRegistration: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    achievement: { create: jest.fn(), findMany: jest.fn() },
    galleryItem: { create: jest.fn(), findMany: jest.fn() },
    member: { findUnique: jest.fn() },
    notification: { create: jest.fn(), createMany: jest.fn() },
    user: { findMany: jest.fn() },
  };
  const audit = { log: jest.fn().mockResolvedValue(null) };
  const service = new EventsService(prisma as never, audit as never);

  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('rejects end before start', () => {
      expect(() =>
        service.create({
          title: 'X',
          type: 'LOMBA',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() - 1000).toISOString(),
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('register', () => {
    it('404 missing event', async () => {
      prisma.event.findUnique.mockResolvedValue(null);
      await expect(service.register('e1', 'm1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects closed registration', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'e1',
        registrationOpen: false,
        capacity: null,
        _count: { registrations: 0 },
      });
      await expect(service.register('e1', 'm1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects full capacity', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'e1',
        registrationOpen: true,
        capacity: 2,
        _count: { registrations: 2 },
      });
      await expect(service.register('e1', 'm1')).rejects.toThrow(/penuh/i);
    });

    it('maps unique to conflict', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'e1',
        registrationOpen: true,
        capacity: null,
        _count: { registrations: 0 },
      });
      prisma.eventRegistration.create.mockRejectedValue(new Error('unique'));
      await expect(service.register('e1', 'm1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('setRegistrationStatus', () => {
    it('approves and notifies', async () => {
      prisma.eventRegistration.findFirst.mockResolvedValue({
        id: 'r1',
        status: ApprovalStatus.PENDING,
        event: { title: 'Hack', capacity: null },
        member: { userId: 'u1', fullName: 'A' },
      });
      prisma.eventRegistration.update.mockResolvedValue({
        id: 'r1',
        status: ApprovalStatus.APPROVED,
      });
      const res = await service.setRegistrationStatus(
        'e1',
        'r1',
        ApprovalStatus.APPROVED,
        'actor',
      );
      expect(res.status).toBe(ApprovalStatus.APPROVED);
      expect(prisma.notification.create).toHaveBeenCalled();
    });
  });
});
