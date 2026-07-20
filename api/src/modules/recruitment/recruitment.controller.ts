import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ApprovalStatus, RecruitmentStage } from '@prisma/client';
import { RecruitmentService } from './recruitment.service';
import { ApplyDto } from './dto/apply.dto';
import { SetStageDto } from './dto/set-stage.dto';
import { OnboardingDto } from './dto/onboarding.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PENGURUS_ROLES } from '../../common/constants/roles';
import { JwtPayload } from '../auth/types/jwt-payload';

function clientIp(req: Request, fallback?: string) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length) return xf.split(',')[0].trim();
  return fallback ?? req.ip;
}

@Controller('recruitment')
@UseGuards(RolesGuard)
export class RecruitmentController {
  constructor(private recruitment: RecruitmentService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('apply')
  apply(@Body() dto: ApplyDto, @Req() req: Request, @Ip() ip: string) {
    return this.recruitment.apply(dto, clientIp(req, ip));
  }

  @Get()
  @Roles(...PENGURUS_ROLES)
  findAll(
    @Query('status') status?: ApprovalStatus,
    @Query('stage') stage?: RecruitmentStage,
  ) {
    return this.recruitment.findAll({ status, stage });
  }

  @Get('stats')
  @Roles(...PENGURUS_ROLES)
  stats() {
    return this.recruitment.stats();
  }

  @Get(':id')
  @Roles(...PENGURUS_ROLES)
  findOne(@Param('id') id: string) {
    return this.recruitment.findOne(id);
  }

  @Patch(':id/stage')
  @Roles(...PENGURUS_ROLES)
  setStage(
    @Param('id') id: string,
    @Body() dto: SetStageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.recruitment.setStage(id, dto.stage, dto.notes, user.sub);
  }

  @Post(':id/advance')
  @Roles(...PENGURUS_ROLES)
  advance(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.recruitment.advanceStage(id, user.sub);
  }

  @Patch(':id/onboarding')
  @Roles(...PENGURUS_ROLES)
  onboarding(
    @Param('id') id: string,
    @Body() dto: OnboardingDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.recruitment.updateOnboarding(id, dto.checklist, user.sub);
  }

  @Post(':id/approve')
  @Roles(...PENGURUS_ROLES)
  approve(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.recruitment.approve(id, user.sub);
  }

  @Post(':id/reject')
  @Roles(...PENGURUS_ROLES)
  reject(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body('notes') notes?: string,
  ) {
    return this.recruitment.reject(id, user.sub, notes);
  }
}
