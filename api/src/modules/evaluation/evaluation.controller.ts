import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { EvaluationService } from './evaluation.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { CreatePeerReviewDto } from './dto/create-peer-review.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload';

@Controller()
@UseGuards(RolesGuard)
export class EvaluationController {
  constructor(private evaluation: EvaluationService) {}

  @Post('evaluations')
  createEvaluation(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateEvaluationDto,
  ) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.evaluation.createEvaluation(user.memberId, dto);
  }

  @Get('evaluations/summary')
  @Roles(RoleName.KETUA)
  summary(@Query('periodId') periodId: string) {
    if (!periodId) throw new BadRequestException('periodId required');
    return this.evaluation.summary(periodId);
  }

  @Post('peer-reviews')
  createPeerReview(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePeerReviewDto,
  ) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.evaluation.createPeerReview(user.memberId, dto);
  }

  @Get('peer-reviews/:memberId')
  listPeerReviews(@Param('memberId') memberId: string) {
    return this.evaluation.listPeerReviews(memberId);
  }
}
