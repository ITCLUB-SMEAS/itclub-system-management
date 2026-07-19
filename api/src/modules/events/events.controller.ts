import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { CreateGalleryDto } from './dto/create-gallery.dto';
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
  findAll() {
    return this.events.findAll();
  }

  @Post('events')
  @Roles(...PENGURUS_ROLES)
  create(@Body() dto: CreateEventDto) {
    return this.events.create(dto);
  }

  @Post('events/:id/register')
  register(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.events.register(id, user.memberId);
  }

  @Get('events/:id/registrations')
  @Roles(...PENGURUS_ROLES)
  registrations(@Param('id') id: string) {
    return this.events.registrations(id);
  }

  @Post('events/:id/achievements')
  @Roles(...PENGURUS_ROLES)
  achievements(@Param('id') id: string, @Body() dto: CreateAchievementDto) {
    return this.events.addAchievement(id, dto);
  }

  @Post('events/:id/gallery')
  @Roles(...PENGURUS_ROLES)
  gallery(@Param('id') id: string, @Body() dto: CreateGalleryDto) {
    return this.events.addGallery(id, dto);
  }

  @Get('gallery')
  listGallery() {
    return this.events.listGallery();
  }
}
