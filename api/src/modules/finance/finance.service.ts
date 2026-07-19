import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class FinanceService {
  constructor(private prisma: PrismaService) {}

  findAll(periodId?: string) {
    return this.prisma.transaction.findMany({
      where: periodId ? { periodId } : undefined,
      include: {
        recordedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { occurredAt: 'desc' },
    });
  }

  create(recordedById: string, dto: CreateTransactionDto) {
    return this.prisma.transaction.create({
      data: {
        type: dto.type,
        amount: dto.amount,
        description: dto.description,
        periodId: dto.periodId,
        recordedById,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
      },
    });
  }

  async report(periodId?: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: periodId ? { periodId } : undefined,
      include: {
        recordedBy: { select: { id: true, fullName: true } },
        period: { select: { id: true, name: true } },
      },
      orderBy: { occurredAt: 'desc' },
    });
    const income = transactions
      .filter((t) => t.type === 'INCOME')
      .reduce((s, t) => s + Number(t.amount), 0);
    const expense = transactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((s, t) => s + Number(t.amount), 0);

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
      count: transactions.length,
      transactions,
      generatedAt: new Date().toISOString(),
    };
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
      for (const t of report.transactions) {
        if (doc.y > 750) {
          doc.addPage();
        }
        const y = doc.y;
        const date = new Date(t.occurredAt).toLocaleDateString('id-ID');
        const amt = Number(t.amount);
        const signed = t.type === 'EXPENSE' ? -amt : amt;
        doc.fontSize(9);
        doc.text(date, cols[0], y, { width: 65 });
        doc.text(t.type, cols[1], y, { width: 55 });
        doc.text(t.description, cols[2], y, { width: 190 });
        doc.text(idr(signed), cols[3], y, { width: 120, align: 'right' });
        doc.moveDown(0.8);
      }

      if (!report.transactions.length) {
        doc.fillColor('#94a3b8').text('Belum ada transaksi.');
      }

      doc.moveDown(1.5);
      doc
        .fontSize(8)
        .fillColor('#94a3b8')
        .text('Dokumen ini digenerate otomatis oleh ITCLUB Ekskul Management.', {
          align: 'center',
        });

      doc.end();
    });
  }
}
