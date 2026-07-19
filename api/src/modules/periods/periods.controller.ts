import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { PeriodsService } from './periods.service';
import { CreatePeriodDto } from './dto/create-period.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PENGURUS_ROLES } from '../../common/constants/roles';

@Controller('periods')
@UseGuards(RolesGuard)
export class PeriodsController {
  constructor(private periods: PeriodsService) {}

  @Get()
  findAll() {
    return this.periods.findAll();
  }

  @Post()
  @Roles(RoleName.KETUA)
  create(@Body() dto: CreatePeriodDto) {
    return this.periods.create(dto);
  }

  @Get(':id/members')
  @Roles(...PENGURUS_ROLES)
  members(@Param('id') id: string) {
    return this.periods.members(id);
  }

  @Get(':id/report')
  @Roles(...PENGURUS_ROLES)
  report(@Param('id') id: string) {
    return this.periods.report(id);
  }
}
