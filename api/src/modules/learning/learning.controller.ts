import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { LearningService } from './learning.service';
import { CreateLearningPathDto } from './dto/create-learning-path.dto';
import { CreateLearningResourceDto } from './dto/create-learning-resource.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload';
import { PENGURUS_ROLES } from '../../common/constants/roles';

@Controller()
@UseGuards(RolesGuard)
export class LearningController {
  constructor(private learning: LearningService) {}

  @Get('learning-paths')
  listPaths(@Query('divisionId') divisionId?: string) {
    return this.learning.listPaths(divisionId);
  }

  @Get('learning-paths/:id')
  getPath(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.learning.getPath(id, user.memberId);
  }

  @Post('learning-paths')
  @Roles(...PENGURUS_ROLES, RoleName.KEPALA_DIVISI)
  createPath(
    @Body() dto: CreateLearningPathDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.learning.createPath(dto, user.sub);
  }

  @Get('learning-resources')
  listResources(
    @Query('divisionId') divisionId?: string,
    @Query('pathId') pathId?: string,
  ) {
    return this.learning.listResources({ divisionId, pathId });
  }

  @Post('learning-resources')
  @Roles(...PENGURUS_ROLES, RoleName.KEPALA_DIVISI)
  createResource(
    @Body() dto: CreateLearningResourceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.learning.createResource(dto, user.sub);
  }

  @Get('learning-resources/:id/download')
  download(@Param('id') id: string) {
    return this.learning.downloadUrl(id);
  }

  @Post('learning-resources/:id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.learning.markComplete(id, user.memberId);
  }

  @Delete('learning-resources/:id/complete')
  uncomplete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.learning.uncomplete(id, user.memberId);
  }

  @Get('learning/progress/me')
  myProgress(@CurrentUser() user: JwtPayload) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.learning.myProgress(user.memberId);
  }

  @Get('learning/progress/summary')
  progressSummary(@CurrentUser() user: JwtPayload) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.learning.pathProgressSummary(user.memberId);
  }
}
