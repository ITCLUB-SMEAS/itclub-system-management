import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LoanStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateItemDto } from './dto/create-item.dto';
import { LoanRequestDto } from './dto/loan-request.dto';

const ACTIVE: LoanStatus[] = [
  LoanStatus.REQUESTED,
  LoanStatus.APPROVED,
  LoanStatus.BORROWED,
];

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  listItems() {
    return this.prisma.inventoryItem.findMany({
      include: {
        loans: {
          where: { status: { in: ACTIVE } },
          include: {
            member: { select: { id: true, fullName: true } },
          },
          orderBy: { id: 'desc' },
        },
        _count: {
          select: {
            loans: { where: { status: { in: ACTIVE } } },
          },
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

  createItem(dto: CreateItemDto, actorId?: string) {
    return this.prisma.inventoryItem
      .create({
        data: {
          name: dto.name,
          condition: dto.condition,
          quantity: dto.quantity ?? 1,
          serialNumber: dto.serialNumber,
          notes: dto.notes,
        },
      })
      .then(async (item) => {
        await this.audit.log({
          actorId,
          action: 'inventory.create',
          entityType: 'InventoryItem',
          entityId: item.id,
        });
        return item;
      });
  }

  async loanRequest(
    itemId: string,
    memberId: string,
    dto?: LoanRequestDto,
  ) {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { id: itemId },
    });
    if (!item) throw new NotFoundException('Item not found');

    const activeCount = await this.prisma.inventoryLoan.count({
      where: { itemId, status: { in: ACTIVE } },
    });
    if (activeCount >= item.quantity) {
      throw new BadRequestException('Item currently unavailable (kuota penuh)');
    }

    const myActive = await this.prisma.inventoryLoan.findFirst({
      where: {
        itemId,
        memberId,
        status: { in: ACTIVE },
      },
    });
    if (myActive) {
      throw new BadRequestException('Kamu sudah punya peminjaman aktif untuk item ini');
    }

    return this.prisma.inventoryLoan.create({
      data: {
        itemId,
        memberId,
        notes: dto?.notes,
        dueDate: dto?.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: {
        item: true,
        member: { select: { id: true, fullName: true } },
      },
    });
  }

  async approveLoan(loanId: string, actorId?: string) {
    const loan = await this.prisma.inventoryLoan.findUnique({
      where: { id: loanId },
      include: { member: { select: { userId: true } }, item: true },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.status !== LoanStatus.REQUESTED) {
      throw new BadRequestException('Loan not in requested state');
    }

    const updated = await this.prisma.inventoryLoan.update({
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

    await this.prisma.notification.create({
      data: {
        userId: loan.member.userId,
        type: NotificationType.APPROVAL_RESULT,
        title: `Peminjaman disetujui: ${loan.item.name}`,
        body: loan.dueDate
          ? `Kembalikan sebelum ${loan.dueDate.toLocaleDateString('id-ID')}`
          : 'Jaga barang dengan baik',
      },
    });
    await this.audit.log({
      actorId,
      action: 'inventory.approve',
      entityType: 'InventoryLoan',
      entityId: loanId,
    });
    return updated;
  }

  async rejectLoan(loanId: string, actorId?: string) {
    const loan = await this.prisma.inventoryLoan.findUnique({
      where: { id: loanId },
      include: { member: { select: { userId: true } }, item: true },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.status !== LoanStatus.REQUESTED) {
      throw new BadRequestException('Loan not in requested state');
    }
    const updated = await this.prisma.inventoryLoan.update({
      where: { id: loanId },
      data: { status: LoanStatus.REJECTED },
      include: {
        item: true,
        member: { select: { id: true, fullName: true } },
      },
    });
    await this.prisma.notification.create({
      data: {
        userId: loan.member.userId,
        type: NotificationType.APPROVAL_RESULT,
        title: `Peminjaman ditolak: ${loan.item.name}`,
        body: 'Hubungi pengurus untuk info lebih lanjut',
      },
    });
    await this.audit.log({
      actorId,
      action: 'inventory.reject',
      entityType: 'InventoryLoan',
      entityId: loanId,
    });
    return updated;
  }

  async returnLoan(loanId: string, actorId?: string) {
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
    const updated = await this.prisma.inventoryLoan.update({
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
    await this.audit.log({
      actorId,
      action: 'inventory.return',
      entityType: 'InventoryLoan',
      entityId: loanId,
    });
    return updated;
  }

  /** Overdue = BORROWED with dueDate < now */
  overdueLoans() {
    return this.prisma.inventoryLoan.findMany({
      where: {
        status: LoanStatus.BORROWED,
        dueDate: { lt: new Date() },
      },
      include: {
        item: true,
        member: { select: { id: true, fullName: true } },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async notifyOverdue() {
    const loans = await this.overdueLoans();
    let sent = 0;
    for (const loan of loans) {
      const member = await this.prisma.member.findUnique({
        where: { id: loan.memberId },
        select: { userId: true },
      });
      if (!member) continue;
      await this.prisma.notification.create({
        data: {
          userId: member.userId,
          type: NotificationType.DEADLINE,
          title: `Terlambat kembalikan: ${loan.item.name}`,
          body: `Jatuh tempo ${loan.dueDate?.toLocaleDateString('id-ID') ?? '—'}`,
        },
      });
      sent += 1;
    }
    return { sent, overdue: loans.length };
  }
}
