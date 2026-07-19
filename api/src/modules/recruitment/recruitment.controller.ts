import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { RecruitmentService } from './recruitment.service';
import { ApplyDto } from './dto/apply.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PENGURUS_ROLES } from '../../common/constants/roles';

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
  findAll() {
    return this.recruitment.findAll();
  }

  @Post(':id/approve')
  @Roles(...PENGURUS_ROLES)
  approve(@Param('id') id: string) {
    return this.recruitment.approve(id);
  }

  @Post(':id/reject')
  @Roles(...PENGURUS_ROLES)
  reject(@Param('id') id: string) {
    return this.recruitment.reject(id);
  }
}
