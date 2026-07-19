import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LoanStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  listItems() {
    return this.prisma.inventoryItem.findMany({
      include: {
        loans: {
          where: {
            status: {
              in: [
                LoanStatus.REQUESTED,
                LoanStatus.APPROVED,
                LoanStatus.BORROWED,
              ],
            },
          },
          include: {
            member: { select: { id: true, fullName: true } },
          },
          orderBy: { id: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  listLoans(status?: LoanStatus) {
    return this.prisma.inventoryLoan.findMany({
      where: status ? { status } : undefined,
      include: {
        item: true,
        member: { select: { id: true, fullName: true } },
      },
      orderBy: { id: 'desc' },
    });
  }

  myLoans(memberId: string) {
    return this.prisma.inventoryLoan.findMany({
      where: { memberId },
      include: { item: true },
      orderBy: { id: 'desc' },
    });
  }

  createItem(dto: CreateItemDto) {
    return this.prisma.inventoryItem.create({ data: dto });
  }

  async loanRequest(itemId: string, memberId: string) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Item not found');

    const active = await this.prisma.inventoryLoan.findFirst({
      where: {
        itemId,
        status: {
          in: [LoanStatus.REQUESTED, LoanStatus.APPROVED, LoanStatus.BORROWED],
        },
      },
    });
    if (active) throw new BadRequestException('Item currently unavailable');

    return this.prisma.inventoryLoan.create({
      data: { itemId, memberId },
      include: {
        item: true,
        member: { select: { id: true, fullName: true } },
      },
    });
  }

  async approveLoan(loanId: string) {
    const loan = await this.prisma.inventoryLoan.findUnique({
      where: { id: loanId },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.status !== LoanStatus.REQUESTED) {
      throw new BadRequestException('Loan not in requested state');
    }
    return this.prisma.inventoryLoan.update({
      where: { id: loanId },
      data: {
        status: LoanStatus.BORROWED,
        borrowedAt: new Date(),
      },
      include: {
        item: true,
        member: { select: { id: true, fullName: true } },
      },
    });
  }

  async rejectLoan(loanId: string) {
    const loan = await this.prisma.inventoryLoan.findUnique({
      where: { id: loanId },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.status !== LoanStatus.REQUESTED) {
      throw new BadRequestException('Loan not in requested state');
    }
    return this.prisma.inventoryLoan.update({
      where: { id: loanId },
      data: { status: LoanStatus.REJECTED },
      include: {
        item: true,
        member: { select: { id: true, fullName: true } },
      },
    });
  }

  async returnLoan(loanId: string) {
    const loan = await this.prisma.inventoryLoan.findUnique({
      where: { id: loanId },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    if (
      loan.status !== LoanStatus.BORROWED &&
      loan.status !== LoanStatus.APPROVED
    ) {
      throw new BadRequestException('Loan not active');
    }
    return this.prisma.inventoryLoan.update({
      where: { id: loanId },
      data: {
        status: LoanStatus.RETURNED,
        returnedAt: new Date(),
      },
      include: {
        item: true,
        member: { select: { id: true, fullName: true } },
      },
    });
  }
}
