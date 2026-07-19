import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LoanStatus } from '@prisma/client';
import { InventoryService } from './inventory.service';

function mockPrisma() {
  return {
    inventoryItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    inventoryLoan: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('InventoryService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let service: InventoryService;

  beforeEach(() => {
    prisma = mockPrisma();
    service = new InventoryService(prisma as never);
  });

  describe('createItem', () => {
    it('creates inventory item', async () => {
      const item = { id: '1', name: 'Laptop', condition: 'baik' };
      prisma.inventoryItem.create.mockResolvedValue(item);
      await expect(
        service.createItem({ name: 'Laptop', condition: 'baik' }),
      ).resolves.toEqual(item);
      expect(prisma.inventoryItem.create).toHaveBeenCalledWith({
        data: { name: 'Laptop', condition: 'baik' },
      });
    });
  });

  describe('loanRequest', () => {
    it('throws if item missing', async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue(null);
      await expect(service.loanRequest('x', 'm1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws if item already loaned/requested', async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue({ id: 'i1' });
      prisma.inventoryLoan.findFirst.mockResolvedValue({ id: 'l1' });
      await expect(service.loanRequest('i1', 'm1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('creates REQUESTED loan', async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue({ id: 'i1' });
      prisma.inventoryLoan.findFirst.mockResolvedValue(null);
      const loan = { id: 'l1', status: LoanStatus.REQUESTED };
      prisma.inventoryLoan.create.mockResolvedValue(loan);
      await expect(service.loanRequest('i1', 'm1')).resolves.toEqual(loan);
    });
  });

  describe('approveLoan', () => {
    it('throws if not REQUESTED', async () => {
      prisma.inventoryLoan.findUnique.mockResolvedValue({
        id: 'l1',
        status: LoanStatus.BORROWED,
      });
      await expect(service.approveLoan('l1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('sets BORROWED + borrowedAt', async () => {
      prisma.inventoryLoan.findUnique.mockResolvedValue({
        id: 'l1',
        status: LoanStatus.REQUESTED,
      });
      prisma.inventoryLoan.update.mockResolvedValue({
        id: 'l1',
        status: LoanStatus.BORROWED,
      });
      await service.approveLoan('l1');
      expect(prisma.inventoryLoan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'l1' },
          data: expect.objectContaining({
            status: LoanStatus.BORROWED,
            borrowedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('rejectLoan', () => {
    it('rejects REQUESTED loan', async () => {
      prisma.inventoryLoan.findUnique.mockResolvedValue({
        id: 'l1',
        status: LoanStatus.REQUESTED,
      });
      prisma.inventoryLoan.update.mockResolvedValue({
        id: 'l1',
        status: LoanStatus.REJECTED,
      });
      await expect(service.rejectLoan('l1')).resolves.toMatchObject({
        status: LoanStatus.REJECTED,
      });
    });
  });

  describe('returnLoan', () => {
    it('throws if not active', async () => {
      prisma.inventoryLoan.findUnique.mockResolvedValue({
        id: 'l1',
        status: LoanStatus.RETURNED,
      });
      await expect(service.returnLoan('l1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('marks RETURNED', async () => {
      prisma.inventoryLoan.findUnique.mockResolvedValue({
        id: 'l1',
        status: LoanStatus.BORROWED,
      });
      prisma.inventoryLoan.update.mockResolvedValue({
        id: 'l1',
        status: LoanStatus.RETURNED,
      });
      await service.returnLoan('l1');
      expect(prisma.inventoryLoan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: LoanStatus.RETURNED,
            returnedAt: expect.any(Date),
          }),
        }),
      );
    });
  });
});
