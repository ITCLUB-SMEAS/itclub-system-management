import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class FinanceService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  findAll(periodId?: string, includeVoided = false) {
    return this.prisma.transaction.findMany({
      where: {
        ...(periodId ? { periodId } : {}),
        ...(!includeVoided ? { voidedAt: null } : {}),
      },
      include: {
        recordedBy: { select: { id: true, fullName: true } },
        period: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: 'desc' },
    });
  }

  async create(
    recordedById: string,
    dto: CreateTransactionDto,
    actorUserId?: string,
  ) {
    if (dto.amount <= 0) {
      throw new BadRequestException('amount must be > 0');
    }
    const row = await this.prisma.transaction.create({
      data: {
        type: dto.type,
        amount: dto.amount,
        description: dto.description,
        category: dto.category,
        periodId: dto.periodId,
        recordedById,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      },
    });
    await this.audit.log({
      actorId: actorUserId,
      action: 'finance.create',
      entityType: 'Transaction',
      entityId: row.id,
      meta: {
        type: dto.type,
        amount: dto.amount,
        category: dto.category,
        periodId: dto.periodId,
      },
    });
    return row;
  }

  async voidTx(id: string, actorUserId?: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.voidedAt) throw new BadRequestException('Already voided');

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        voidedAt: new Date(),
        voidedById: actorUserId,
      },
    });
    await this.audit.log({
      actorId: actorUserId,
      action: 'finance.void',
      entityType: 'Transaction',
      entityId: id,
    });
    return updated;
  }

  async report(periodId?: string, includeVoided = false) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        ...(periodId ? { periodId } : {}),
        ...(!includeVoided ? { voidedAt: null } : {}),
      },
      include: {
        recordedBy: { select: { id: true, fullName: true } },
        period: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: 'desc' },
    });

    const active = transactions.filter((t) => !t.voidedAt);
    const income = active
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((s, t) => s + Number(t.amount), 0);
    const expense = active
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((s, t) => s + Number(t.amount), 0);

    const byCategory = new Map<
      string,
      { income: number; expense: number; count: number }
    >();
    for (const t of active) {
      const key = t.category?.trim() || 'Umum';
      const cur = byCategory.get(key) ?? { income: 0, expense: 0, count: 0 };
      const amt = Number(t.amount);
      if (t.type === TransactionType.INCOME) cur.income += amt;
      else cur.expense += amt;
      cur.count += 1;
      byCategory.set(key, cur);
    }

    let periodName: string | null = null;
    if (periodId) {
      const p = await this.prisma.membershipPeriod.findUnique({
        where: { id: periodId },
      });
      periodName = p?.name ?? null;
    }

    return {
      periodId: periodId ?? null,
      periodName,
      income,
      expense,
      balance: income - expense,
      count: active.length,
      voidedCount: transactions.length - active.length,
      byCategory: [...byCategory.entries()].map(([category, v]) => ({
        category,
        ...v,
        net: v.income - v.expense,
      })),
      transactions,
      generatedAt: new Date().toISOString(),
    };
  }

  async snapshot(periodId?: string, actorUserId?: string, note?: string) {
    const rep = await this.report(periodId);
    const snap = await this.prisma.financialReport.create({
      data: {
        periodId: periodId ?? null,
        income: new Prisma.Decimal(rep.income),
        expense: new Prisma.Decimal(rep.expense),
        balance: new Prisma.Decimal(rep.balance),
        txCount: rep.count,
        generatedBy: actorUserId,
        note,
      },
    });
    await this.audit.log({
      actorId: actorUserId,
      action: 'finance.snapshot',
      entityType: 'FinancialReport',
      entityId: snap.id,
      meta: { periodId, balance: rep.balance },
    });
    return snap;
  }

  listSnapshots(periodId?: string) {
    return this.prisma.financialReport.findMany({
      where: periodId ? { periodId } : undefined,
      include: { period: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async reportCsv(periodId?: string): Promise<string> {
    const report = await this.report(periodId);
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      'tanggal,tipe,kategori,keterangan,jumlah,dicatat_oleh,voided',
    ];
    for (const t of report.transactions) {
      lines.push(
        [
          new Date(t.occurredAt).toISOString().slice(0, 10),
          t.type,
          esc(t.category ?? 'Umum'),
          esc(t.description),
          String(t.amount),
          esc(t.recordedBy?.fullName ?? ''),
          t.voidedAt ? 'yes' : 'no',
        ].join(','),
      );
    }
    lines.push('');
    lines.push(`total_income,${report.income}`);
    lines.push(`total_expense,${report.expense}`);
    lines.push(`balance,${report.balance}`);
    return lines.join('\n');
  }

  async reportPdf(periodId?: string): Promise<Buffer> {
    const report = await this.report(periodId);
    const idr = (n: number) =>
      new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(n);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc
        .fontSize(18)
        .fillColor('#1d5ed8')
        .text('ITCLUB — Laporan Keuangan', { align: 'left' });
      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .fillColor('#64748b')
        .text(`Periode: ${report.periodName ?? 'Semua periode'}`);
      doc.text(
        `Dicetak: ${new Date(report.generatedAt).toLocaleString('id-ID')}`,
      );
      doc.moveDown();

      doc
        .fontSize(11)
        .fillColor('#0f172a')
        .text(`Pemasukan : ${idr(report.income)}`);
      doc.text(`Pengeluaran: ${idr(report.expense)}`);
      doc
        .fontSize(12)
        .fillColor('#2574eb')
        .text(`Saldo     : ${idr(report.balance)}`);
      doc.moveDown();

      if (report.byCategory.length) {
        doc
          .fontSize(12)
          .fillColor('#0f172a')
          .text('Per kategori', { underline: true });
        doc.moveDown(0.3);
        for (const c of report.byCategory) {
          doc
            .fontSize(9)
            .fillColor('#0f172a')
            .text(
              `${c.category}: in ${idr(c.income)} / out ${idr(c.expense)} (${c.count})`,
            );
        }
        doc.moveDown();
      }

      doc
        .fontSize(12)
        .fillColor('#0f172a')
        .text('Rincian Transaksi', { underline: true });
      doc.moveDown(0.5);

      const startX = 50;
      const cols = [50, 120, 180, 380];
      doc.fontSize(9).fillColor('#64748b');
      doc.text('Tanggal', cols[0], doc.y, { continued: false });
      const headerY = doc.y - 11;
      doc.text('Tipe', cols[1], headerY);
      doc.text('Keterangan', cols[2], headerY);
      doc.text('Jumlah', cols[3], headerY, { width: 120, align: 'right' });
      doc
        .moveTo(startX, doc.y + 4)
        .lineTo(545, doc.y + 4)
        .strokeColor('#e2e8f0')
        .stroke();
      doc.moveDown(0.6);

      doc.fillColor('#0f172a');
      for (const t of report.transactions.filter((x) => !x.voidedAt)) {
        if (doc.y > 750) doc.addPage();
        const y = doc.y;
        const date = new Date(t.occurredAt).toLocaleDateString('id-ID');
        const amt = Number(t.amount);
        const signed = t.type === 'EXPENSE' ? -amt : amt;
        doc.fontSize(9);
        doc.text(date, cols[0], y, { width: 65 });
        doc.text(t.type, cols[1], y, { width: 55 });
        doc.text(
          `${t.category ? `[${t.category}] ` : ''}${t.description}`,
          cols[2],
          y,
          { width: 190 },
        );
        doc.text(idr(signed), cols[3], y, { width: 120, align: 'right' });
        doc.moveDown(0.8);
      }

      if (!report.transactions.filter((x) => !x.voidedAt).length) {
        doc.fillColor('#94a3b8').text('Belum ada transaksi.');
      }

      doc.moveDown(1.5);
      doc
        .fontSize(8)
        .fillColor('#94a3b8')
        .text(
          'Dokumen ini digenerate otomatis oleh ITCLUB Ekskul Management.',
          { align: 'center' },
        );

      doc.end();
    });
  }
}
