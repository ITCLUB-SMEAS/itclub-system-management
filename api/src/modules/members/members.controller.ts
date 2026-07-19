import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { MemberStatus, RoleName } from '@prisma/client';
import { MembersService } from './members.service';
import { UpdateMemberDto } from './dto/update-member.dto';
import { AssignDivisionDto } from './dto/assign-division.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload';
import { PENGURUS_ROLES } from '../../common/constants/roles';

@Controller('members')
@UseGuards(RolesGuard)
export class MembersController {
  constructor(private members: MembersService) {}

  @Get()
  findAll(
    @Query('status') status?: MemberStatus,
    @Query('divisionId') divisionId?: string,
    @Query('periodId') periodId?: string,
  ) {
    // all authenticated — peer review / assign need directory
    return this.members.findAll({ status, divisionId, periodId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.members.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.members.update(id, dto, user);
  }

  @Post(':id/approve')
  @Roles(RoleName.KETUA, RoleName.SEKRETARIS)
  approve(@Param('id') id: string) {
    return this.members.approve(id);
  }

  @Post(':id/reject')
  @Roles(RoleName.KETUA, RoleName.SEKRETARIS)
  reject(@Param('id') id: string) {
    return this.members.reject(id);
  }

  @Post(':id/assign-division')
  @Roles(RoleName.KETUA, RoleName.KEPALA_DIVISI)
  assignDivision(@Param('id') id: string, @Body() dto: AssignDivisionDto) {
    return this.members.assignDivision(id, dto);
  }

  @Post(':id/badges')
  @Roles(...PENGURUS_ROLES)
  awardBadge(@Param('id') id: string, @Body('badgeId') badgeId: string) {
    return this.members.awardBadge(id, badgeId);
  }

  @Get(':id/certificates')
  listCertificates(@Param('id') id: string) {
    return this.members.listCertificates(id);
  }
}
