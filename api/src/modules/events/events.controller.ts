import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApprovalStatus, RoleName } from '@prisma/client';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { RegistrationStatusDto } from './dto/registration-status.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload';
import { PENGURUS_ROLES } from '../../common/constants/roles';

@Controller()
@UseGuards(RolesGuard)
export class EventsController {
  constructor(private events: EventsService) {}

  @Get('events')
  findAll(
    @Query('type') type?: string,
    @Query('upcoming') upcoming?: string,
  ) {
    return this.events.findAll({
      type,
      upcoming:
        upcoming === 'true' ? true : upcoming === 'false' ? false : undefined,
    });
  }

  @Post('events/reminders/run')
  @Roles(RoleName.KETUA, RoleName.SEKRETARIS, RoleName.WAKIL_KETUA)
  runReminders() {
    return this.events.sendUpcomingReminders();
  }

  @Post('events')
  @Roles(...PENGURUS_ROLES)
  create(@Body() dto: CreateEventDto, @CurrentUser() user: JwtPayload) {
    return this.events.create(dto, user.sub);
  }

  @Get('events/me/registrations')
  myRegistrations(@CurrentUser() user: JwtPayload) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.events.myRegistrations(user.memberId);
  }

  @Get('events/:id')
  findOne(@Param('id') id: string) {
    return this.events.findOne(id);
  }

  @Post('events/:id/register')
  register(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.events.register(id, user.memberId);
  }

  @Delete('events/:id/register')
  cancelRegister(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.events.cancelRegistration(id, user.memberId);
  }

  @Get('events/:id/registrations')
  @Roles(...PENGURUS_ROLES)
  registrations(@Param('id') id: string) {
    return this.events.registrations(id);
  }

  @Patch('events/:eventId/registrations/:regId')
  @Roles(...PENGURUS_ROLES)
  setRegStatus(
    @Param('eventId') eventId: string,
    @Param('regId') regId: string,
    @Body() dto: RegistrationStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.events.setRegistrationStatus(
      eventId,
      regId,
      dto.status,
      user.sub,
    );
  }

  @Post('events/:id/achievements')
  @Roles(...PENGURUS_ROLES)
  achievements(
    @Param('id') id: string,
    @Body() dto: CreateAchievementDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.events.addAchievement(id, dto, user.sub);
  }

  @Get('achievements')
  listAchievements(
    @Query('memberId') memberId?: string,
    @Query('eventId') eventId?: string,
  ) {
    return this.events.listAchievements({ memberId, eventId });
  }

  @Post('events/:id/gallery')
  @Roles(...PENGURUS_ROLES)
  gallery(
    @Param('id') id: string,
    @Body() dto: CreateGalleryDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.events.addGallery(id, dto, user.sub);
  }

  @Get('gallery')
  listGallery(@Query('eventId') eventId?: string) {
    return this.events.listGallery(eventId);
  }
}
