import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { GamificationService } from './gamification.service';
import { CreateBadgeDto } from './dto/create-badge.dto';
import { GenerateCertificateDto } from './dto/generate-certificate.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PENGURUS_ROLES } from '../../common/constants/roles';

@Controller()
@UseGuards(RolesGuard)
export class GamificationController {
  constructor(private gamification: GamificationService) {}

  @Get('badges')
  listBadges() {
    return this.gamification.listBadges();
  }

  @Post('badges')
  @Roles(RoleName.KETUA)
  createBadge(@Body() dto: CreateBadgeDto) {
    return this.gamification.createBadge(dto);
  }

  @Get('leaderboard')
  leaderboard() {
    return this.gamification.leaderboard();
  }

  @Post('certificates/generate')
  @Roles(...PENGURUS_ROLES)
  generateCertificate(@Body() dto: GenerateCertificateDto) {
    return this.gamification.generateCertificate(dto);
  }
}
