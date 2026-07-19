import {
  Body,
  Controller,
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
import { PENGURUS_ROLES } from '../../common/constants/roles';

@Controller()
@UseGuards(RolesGuard)
export class LearningController {
  constructor(private learning: LearningService) {}

  @Get('learning-paths')
  listPaths() {
    return this.learning.listPaths();
  }

  @Post('learning-paths')
  @Roles(...PENGURUS_ROLES, RoleName.KEPALA_DIVISI)
  createPath(@Body() dto: CreateLearningPathDto) {
    return this.learning.createPath(dto);
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
  createResource(@Body() dto: CreateLearningResourceDto) {
    return this.learning.createResource(dto);
  }

  @Get('learning-resources/:id/download')
  download(@Param('id') id: string) {
    return this.learning.downloadUrl(id);
  }
}
