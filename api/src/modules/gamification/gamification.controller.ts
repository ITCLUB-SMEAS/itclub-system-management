import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { RoleName } from '@prisma/client';
import { GamificationService } from './gamification.service';
import { CreateBadgeDto } from './dto/create-badge.dto';
import { GenerateCertificateDto } from './dto/generate-certificate.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload';
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
  createBadge(
    @Body() dto: CreateBadgeDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.gamification.createBadge(dto, user.sub);
  }

  @Get('leaderboard')
  leaderboard(@Query('limit') limit?: string) {
    return this.gamification.leaderboard(limit ? Number(limit) : 50);
  }

  @Get('gamification/me')
  myStats(@CurrentUser() user: JwtPayload) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.gamification.myStats(user.memberId);
  }

  @Post('gamification/evaluate/me')
  evaluateMe(@CurrentUser() user: JwtPayload) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.gamification.evaluateMilestones(user.memberId);
  }

  @Post('gamification/evaluate/:memberId')
  @Roles(...PENGURUS_ROLES)
  evaluate(@Param('memberId') memberId: string) {
    return this.gamification.evaluateMilestones(memberId);
  }

  @Post('certificates/generate')
  @Roles(...PENGURUS_ROLES)
  generateCertificate(
    @Body() dto: GenerateCertificateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.gamification.generateCertificate(dto, user.sub);
  }

  @Get('certificates/:id/pdf')
  @Header('Content-Type', 'application/pdf')
  async certificatePdf(@Param('id') id: string, @Res() res: Response) {
    const pdf = await this.gamification.certificatePdf(id);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sertifikat-${id.slice(0, 8)}.pdf"`,
    );
    res.send(pdf);
  }
}
