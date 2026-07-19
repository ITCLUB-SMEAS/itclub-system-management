import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { DivisionsService } from './divisions.service';
import { CreateDivisionDto } from './dto/create-division.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('divisions')
@UseGuards(RolesGuard)
export class DivisionsController {
  constructor(private divisions: DivisionsService) {}

  @Get()
  findAll() {
    return this.divisions.findAll();
  }

  @Post()
  @Roles(RoleName.KETUA)
  create(@Body() dto: CreateDivisionDto) {
    return this.divisions.create(dto);
  }
}
