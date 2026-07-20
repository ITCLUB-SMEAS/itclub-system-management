import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { CheckInDto } from './dto/check-in.dto';
import { RotateQrDto } from './dto/rotate-qr.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload';
import { PENGURUS_ROLES } from '../../common/constants/roles';

@Controller()
@UseGuards(RolesGuard)
export class ActivitiesController {
  constructor(private activities: ActivitiesService) {}

  @Get('activities')
  findAll() {
    return this.activities.findAll();
  }

  /** H-1 reminders — before :id routes */
  @Post('activities/reminders/run')
  @Roles(RoleName.KETUA, RoleName.SEKRETARIS, RoleName.WAKIL_KETUA)
  runReminders() {
    return this.activities.sendUpcomingReminders();
  }

  @Post('activities')
  @Roles(...PENGURUS_ROLES)
  create(@Body() dto: CreateActivityDto) {
    return this.activities.create(dto);
  }

  @Post('activities/:id/rotate-qr')
  @Roles(...PENGURUS_ROLES)
  rotateQr(@Param('id') id: string, @Body() dto: RotateQrDto) {
    return this.activities.rotateQr(id, dto.ttlMinutes);
  }

  @Get('activities/:id/attendances')
  @Roles(...PENGURUS_ROLES)
  activityAttendances(@Param('id') id: string) {
    return this.activities.activityAttendances(id);
  }

  @Get('activities/:id')
  async findOne(@Param('id') id: string) {
    const a = await this.activities.findOne(id);
    if (!a) throw new NotFoundException('Activity not found');
    return a;
  }

  @Post('attendances/check-in')
  checkIn(@CurrentUser() user: JwtPayload, @Body() dto: CheckInDto) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.activities.checkIn(user.memberId, dto);
  }

  @Get('attendances/me')
  myAttendances(@CurrentUser() user: JwtPayload) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.activities.myAttendances(user.memberId);
  }

  @Get('attendances/report')
  report(
    @CurrentUser() user: JwtPayload,
    @Query('memberId') memberId?: string,
  ) {
    const target = memberId ?? user.memberId;
    if (!target) throw new BadRequestException('Member profile required');
    const isPengurus = user.role && PENGURUS_ROLES.includes(user.role);
    if (memberId && memberId !== user.memberId && !isPengurus) {
      throw new ForbiddenException('Cannot view other member report');
    }
    return this.activities.memberReport(target);
  }
}
