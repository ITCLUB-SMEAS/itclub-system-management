import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { CheckInDto } from './dto/check-in.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload';
import { PENGURUS_ROLES } from '../../common/constants/roles';
import { BadRequestException } from '@nestjs/common';

@Controller()
@UseGuards(RolesGuard)
export class ActivitiesController {
  constructor(private activities: ActivitiesService) {}

  @Get('activities')
  findAll() {
    return this.activities.findAll();
  }

  @Post('activities')
  @Roles(...PENGURUS_ROLES)
  create(@Body() dto: CreateActivityDto) {
    return this.activities.create(dto);
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

  @Get('activities/:id/attendances')
  @Roles(...PENGURUS_ROLES)
  activityAttendances(@Param('id') id: string) {
    return this.activities.activityAttendances(id);
  }
}
