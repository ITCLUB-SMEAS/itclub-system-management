import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LoanStatus } from '@prisma/client';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  const prisma = {
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
      count: jest.fn(),
    },
    member: { findUnique: jest.fn() },
    notification: { create: jest.fn() },
  };
  const audit = { log: jest.fn().mockResolvedValue(null) };
  const service = new InventoryService(prisma as never, audit as never);

  beforeEach(() => jest.clearAllMocks());

  it('createItem', async () => {
    prisma.inventoryItem.create.mockResolvedValue({ id: '1', name: 'Laptop' });
    await service.createItem({ name: 'Laptop', condition: 'baik' });
    expect(prisma.inventoryItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Laptop',
        condition: 'baik',
        quantity: 1,
      }),
    });
  });

  it('loanRequest 404', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue(null);
    await expect(service.loanRequest('x', 'm1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('loanRequest full qty', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue({
      id: 'i1',
      quantity: 1,
    });
    prisma.inventoryLoan.count.mockResolvedValue(1);
    await expect(service.loanRequest('i1', 'm1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('loanRequest creates', async () => {
    prisma.inventoryItem.findUnique.mockResolvedValue({
      id: 'i1',
      quantity: 2,
    });
    prisma.inventoryLoan.count.mockResolvedValue(0);
    prisma.inventoryLoan.findFirst.mockResolvedValue(null);
    prisma.inventoryLoan.create.mockResolvedValue({ id: 'l1' });
    await service.loanRequest('i1', 'm1', {
      dueDate: new Date().toISOString(),
    });
    expect(prisma.inventoryLoan.create).toHaveBeenCalled();
  });

  it('approveLoan only REQUESTED', async () => {
    prisma.inventoryLoan.findUnique.mockResolvedValue({
      id: 'l1',
      status: LoanStatus.BORROWED,
    });
    await expect(service.approveLoan('l1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returnLoan sets returnedAt', async () => {
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
        data: expect.objectContaining({ status: LoanStatus.RETURNED }),
      }),
    );
  });
});
