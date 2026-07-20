import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { RoleName } from '@prisma/client';
import { FinanceService } from './finance.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload';

@Controller('transactions')
@UseGuards(RolesGuard)
export class FinanceController {
  constructor(private finance: FinanceService) {}

  @Get()
  @Roles(RoleName.BENDAHARA, RoleName.KETUA)
  findAll(
    @Query('periodId') periodId?: string,
    @Query('includeVoided') includeVoided?: string,
  ) {
    return this.finance.findAll(periodId, includeVoided === 'true');
  }

  @Post()
  @Roles(RoleName.BENDAHARA, RoleName.KETUA)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTransactionDto) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.finance.create(user.memberId, dto, user.sub);
  }

  @Get('report')
  @Roles(RoleName.BENDAHARA, RoleName.KETUA)
  report(
    @Query('periodId') periodId?: string,
    @Query('includeVoided') includeVoided?: string,
  ) {
    return this.finance.report(periodId, includeVoided === 'true');
  }

  @Post('report/snapshot')
  @Roles(RoleName.BENDAHARA, RoleName.KETUA)
  snapshot(
    @CurrentUser() user: JwtPayload,
    @Query('periodId') periodId?: string,
    @Body('note') note?: string,
  ) {
    return this.finance.snapshot(periodId, user.sub, note);
  }

  @Get('report/snapshots')
  @Roles(RoleName.BENDAHARA, RoleName.KETUA)
  snapshots(@Query('periodId') periodId?: string) {
    return this.finance.listSnapshots(periodId);
  }

  @Get('report.csv')
  @Roles(RoleName.BENDAHARA, RoleName.KETUA)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async reportCsv(
    @Query('periodId') periodId: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.finance.reportCsv(periodId);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="laporan-keuangan-${stamp}.csv"`,
    );
    res.send(csv);
  }

  @Get('report.pdf')
  @Roles(RoleName.BENDAHARA, RoleName.KETUA)
  @Header('Content-Type', 'application/pdf')
  async reportPdf(
    @Query('periodId') periodId: string | undefined,
    @Res() res: Response,
  ) {
    const pdf = await this.finance.reportPdf(periodId);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="laporan-keuangan-${stamp}.pdf"`,
    );
    res.send(pdf);
  }

  @Post(':id/void')
  @Roles(RoleName.BENDAHARA, RoleName.KETUA)
  voidTx(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.finance.voidTx(id, user.sub);
  }
}
