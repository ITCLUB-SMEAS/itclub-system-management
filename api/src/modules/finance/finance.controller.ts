import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
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
  findAll(@Query('periodId') periodId?: string) {
    return this.finance.findAll(periodId);
  }

  @Post()
  @Roles(RoleName.BENDAHARA, RoleName.KETUA)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTransactionDto) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.finance.create(user.memberId, dto);
  }

  @Get('report')
  @Roles(RoleName.BENDAHARA, RoleName.KETUA)
  report(@Query('periodId') periodId?: string) {
    return this.finance.report(periodId);
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
}
