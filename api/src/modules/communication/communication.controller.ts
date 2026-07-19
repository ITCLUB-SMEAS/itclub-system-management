import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommunicationService } from './communication.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload';
import { PENGURUS_ROLES } from '../../common/constants/roles';

@Controller()
@UseGuards(RolesGuard)
export class CommunicationController {
  constructor(private communication: CommunicationService) {}

  @Get('announcements')
  listAnnouncements() {
    return this.communication.listAnnouncements();
  }

  @Post('announcements')
  @Roles(...PENGURUS_ROLES)
  createAnnouncement(@Body() dto: CreateAnnouncementDto) {
    return this.communication.createAnnouncement(dto);
  }

  @Get('notifications/me')
  myNotifications(@CurrentUser() user: JwtPayload) {
    return this.communication.myNotifications(user.sub);
  }

  @Patch('notifications/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.communication.markRead(id, user.sub);
  }
}
