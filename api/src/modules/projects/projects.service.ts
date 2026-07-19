import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PENGURUS_ROLES } from '../../common/constants/roles';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { MentorAssignmentDto } from './dto/mentor-assignment.dto';
import { JwtPayload } from '../auth/types/jwt-payload';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.project.findMany({
      include: { _count: { select: { tasks: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreateProjectDto) {
    return this.prisma.project.create({ data: dto });
  }

  listTasks(projectId: string) {
    return this.prisma.task.findMany({
      where: { projectId },
      include: {
        assignee: { select: { id: true, fullName: true } },
        division: true,
        submissions: true,
      },
      orderBy: { title: 'asc' },
    });
  }

  createTask(dto: CreateTaskDto) {
    return this.prisma.task.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        divisionId: dto.divisionId,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  async updateStatus(taskId: string, dto: UpdateTaskStatusDto, user: JwtPayload) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    const isAssignee = task.assigneeId === user.memberId;
    const isPengurus = user.role && PENGURUS_ROLES.includes(user.role);
    if (!isAssignee && !isPengurus) throw new ForbiddenException();

    return this.prisma.task.update({
      where: { id: taskId },
      data: { status: dto.status },
    });
  }

  async assign(taskId: string, dto: AssignTaskDto) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    return this.prisma.task.update({
      where: { id: taskId },
      data: { assigneeId: dto.assigneeId },
    });
  }

  async submit(taskId: string, memberId: string, dto: CreateSubmissionDto) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.assigneeId && task.assigneeId !== memberId) {
      throw new ForbiddenException('Not assignee');
    }
    return this.prisma.submission.create({
      data: { taskId, memberId, ...dto },
    });
  }

  async getSubmission(id: string) {
    const sub = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        task: true,
        member: { select: { id: true, fullName: true } },
        feedback: {
          include: { reviewer: { select: { id: true, fullName: true } } },
        },
      },
    });
    if (!sub) throw new NotFoundException('Submission not found');
    return sub;
  }

  async addFeedback(submissionId: string, reviewerId: string, dto: CreateFeedbackDto) {
    await this.getSubmission(submissionId);
    return this.prisma.feedback.create({
      data: { submissionId, reviewerId, content: dto.content },
    });
  }

  assignMentor(dto: MentorAssignmentDto) {
    return this.prisma.mentorAssignment.create({
      data: { mentorId: dto.mentorId, menteeId: dto.menteeId },
      include: {
        mentor: { select: { id: true, fullName: true } },
        mentee: { select: { id: true, fullName: true } },
      },
    });
  }

  myMentorAssignments(memberId: string) {
    return this.prisma.mentorAssignment.findMany({
      where: { OR: [{ mentorId: memberId }, { menteeId: memberId }] },
      include: {
        mentor: { select: { id: true, fullName: true } },
        mentee: { select: { id: true, fullName: true } },
      },
    });
  }
}
