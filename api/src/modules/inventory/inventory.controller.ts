import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LoanStatus, RoleName } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { CreateItemDto } from './dto/create-item.dto';
import { LoanRequestDto } from './dto/loan-request.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload';
import { PENGURUS_ROLES } from '../../common/constants/roles';

@Controller()
@UseGuards(RolesGuard)
export class InventoryController {
  constructor(private inventory: InventoryService) {}

  @Get('inventory')
  listItems() {
    return this.inventory.listItems();
  }

  @Post('inventory')
  @Roles(...PENGURUS_ROLES)
  createItem(
    @Body() dto: CreateItemDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inventory.createItem(dto, user.sub);
  }

  @Post('inventory/:id/loan-request')
  loanRequest(
    @Param('id') id: string,
    @Body() dto: LoanRequestDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.inventory.loanRequest(id, user.memberId, dto);
  }

  @Get('inventory-loans')
  @Roles(...PENGURUS_ROLES)
  listLoans(@Query('status') status?: LoanStatus) {
    return this.inventory.listLoans(status);
  }

  @Get('inventory-loans/me')
  myLoans(@CurrentUser() user: JwtPayload) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.inventory.myLoans(user.memberId);
  }

  @Get('inventory-loans/overdue')
  @Roles(...PENGURUS_ROLES)
  overdue() {
    return this.inventory.overdueLoans();
  }

  @Post('inventory-loans/overdue/notify')
  @Roles(RoleName.KETUA, RoleName.SEKRETARIS, RoleName.WAKIL_KETUA)
  notifyOverdue() {
    return this.inventory.notifyOverdue();
  }

  @Post('inventory-loans/:id/approve')
  @Roles(...PENGURUS_ROLES)
  approveLoan(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.inventory.approveLoan(id, user.sub);
  }

  @Post('inventory-loans/:id/reject')
  @Roles(...PENGURUS_ROLES)
  rejectLoan(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.inventory.rejectLoan(id, user.sub);
  }

  @Post('inventory-loans/:id/return')
  @Roles(...PENGURUS_ROLES)
  returnLoan(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.inventory.returnLoan(id, user.sub);
  }
}
