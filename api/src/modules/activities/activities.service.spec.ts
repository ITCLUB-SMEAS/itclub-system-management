import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ActivitiesService } from './activities.service';

describe('ActivitiesService', () => {
  const prisma = {
    activity: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    attendance: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    member: { findUnique: jest.fn() },
    user: { findMany: jest.fn() },
    notification: { createMany: jest.fn() },
  };

  const service = new ActivitiesService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  const baseActivity = {
    id: 'a1',
    title: 'Rapat',
    latitude: -6.2,
    longitude: 106.8,
    geofenceRadiusM: 100,
    qrToken: 'tok123',
    qrTokenExpiresAt: new Date(Date.now() + 60_000),
    startTime: new Date(Date.now() - 10 * 60_000),
    endTime: new Date(Date.now() + 60 * 60_000),
  };

  describe('checkIn', () => {
    it('rejects missing activity', async () => {
      prisma.activity.findUnique.mockResolvedValue(null);
      await expect(
        service.checkIn('m1', { activityId: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects expired QR', async () => {
      prisma.activity.findUnique.mockResolvedValue({
        ...baseActivity,
        qrTokenExpiresAt: new Date(Date.now() - 1000),
      });
      await expect(
        service.checkIn('m1', {
          activityId: 'a1',
          qrToken: 'tok123',
          method: 'QR' as never,
          latitude: -6.2,
          longitude: 106.8,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects outside geofence', async () => {
      prisma.activity.findUnique.mockResolvedValue(baseActivity);
      await expect(
        service.checkIn('m1', {
          activityId: 'a1',
          qrToken: 'tok123',
          method: 'QR' as never,
          latitude: -6.3,
          longitude: 106.8,
        }),
      ).rejects.toThrow(/geofence|area/i);
    });

    it('creates attendance inside fence with valid QR', async () => {
      prisma.activity.findUnique.mockResolvedValue(baseActivity);
      prisma.attendance.create.mockResolvedValue({ id: 'att1' });
      const res = await service.checkIn('m1', {
        activityId: 'a1',
        qrToken: 'tok123',
        method: 'QR' as never,
        latitude: -6.2,
        longitude: 106.8,
      });
      expect(res).toEqual({ id: 'att1' });
      expect(prisma.attendance.create).toHaveBeenCalled();
    });

    it('maps unique violation to already checked in', async () => {
      prisma.activity.findUnique.mockResolvedValue({
        ...baseActivity,
        latitude: null,
        longitude: null,
        geofenceRadiusM: null,
      });
      prisma.attendance.create.mockRejectedValue(new Error('unique'));
      await expect(
        service.checkIn('m1', { activityId: 'a1', method: 'MANUAL' as never }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('create', () => {
    it('rejects end before start', () => {
      expect(() =>
        service.create({
          title: 'X',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() - 1000).toISOString(),
        }),
      ).toThrow(BadRequestException);
    });
  });
});
