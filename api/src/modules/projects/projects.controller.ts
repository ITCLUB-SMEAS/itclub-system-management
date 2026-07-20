import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoleName, TaskStatus } from '@prisma/client';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { MentorAssignmentDto } from './dto/mentor-assignment.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload';
import { PENGURUS_ROLES } from '../../common/constants/roles';

@Controller()
@UseGuards(RolesGuard)
export class ProjectsController {
  constructor(private projects: ProjectsService) {}

  @Get('projects')
  findAll() {
    return this.projects.findAll();
  }

  @Post('projects')
  @Roles(...PENGURUS_ROLES, RoleName.KEPALA_DIVISI)
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: JwtPayload) {
    return this.projects.create(dto, user.sub);
  }

  @Get('projects/:id')
  findOne(@Param('id') id: string) {
    return this.projects.findOne(id);
  }

  @Get('projects/:id/tasks')
  listTasks(
    @Param('id') id: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('status') status?: TaskStatus,
  ) {
    return this.projects.listTasks(id, { assigneeId, status });
  }

  @Get('tasks/me')
  myTasks(@CurrentUser() user: JwtPayload) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.projects.myTasks(user.memberId);
  }

  @Post('tasks')
  @Roles(...PENGURUS_ROLES, RoleName.KEPALA_DIVISI)
  createTask(@Body() dto: CreateTaskDto, @CurrentUser() user: JwtPayload) {
    return this.projects.createTask(dto, user.sub);
  }

  @Get('tasks/:id/submissions')
  listTaskSubmissions(@Param('id') id: string) {
    return this.projects.listTaskSubmissions(id);
  }

  @Patch('tasks/:id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projects.updateStatus(id, dto, user);
  }

  @Post('tasks/:id/assign')
  @Roles(...PENGURUS_ROLES, RoleName.KEPALA_DIVISI)
  assign(
    @Param('id') id: string,
    @Body() dto: AssignTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projects.assign(id, dto, user.sub);
  }

  @Post('tasks/:id/submissions')
  submit(
    @Param('id') id: string,
    @Body() dto: CreateSubmissionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.projects.submit(id, user.memberId, dto);
  }

  @Get('submissions/:id')
  getSubmission(@Param('id') id: string) {
    return this.projects.getSubmission(id);
  }

  @Post('submissions/:id/feedback')
  feedback(
    @Param('id') id: string,
    @Body() dto: CreateFeedbackDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.projects.addFeedback(id, user.memberId, dto, user);
  }

  @Post('mentor-assignments')
  @Roles(...PENGURUS_ROLES, RoleName.KEPALA_DIVISI)
  assignMentor(
    @Body() dto: MentorAssignmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projects.assignMentor(dto, user.sub);
  }

  @Get('mentor-assignments/me')
  myMentors(@CurrentUser() user: JwtPayload) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.projects.myMentorAssignments(user.memberId);
  }

  @Post('tasks/reminders/deadlines')
  @Roles(RoleName.KETUA, RoleName.SEKRETARIS, RoleName.WAKIL_KETUA)
  deadlineReminders() {
    return this.projects.sendDeadlineReminders();
  }
}
