import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PENGURUS_ROLES } from '../../common/constants/roles';
import { AuditService } from '../../common/audit/audit.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { MentorAssignmentDto } from './dto/mentor-assignment.dto';
import { JwtPayload } from '../auth/types/jwt-payload';
import { canTransition } from './task-status';

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.project.findMany({
      include: {
        _count: { select: { tasks: true } },
        tasks: {
          select: { status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const p = await this.prisma.project.findUnique({
      where: { id },
      include: {
        _count: { select: { tasks: true } },
        tasks: {
          include: {
            assignee: { select: { id: true, fullName: true } },
            _count: { select: { submissions: true } },
          },
          orderBy: { title: 'asc' },
        },
      },
    });
    if (!p) throw new NotFoundException('Project not found');
    return p;
  }

  create(dto: CreateProjectDto, actorId?: string) {
    return this.prisma.project
      .create({ data: dto })
      .then(async (p) => {
        await this.audit.log({
          actorId,
          action: 'project.create',
          entityType: 'Project',
          entityId: p.id,
        });
        return p;
      });
  }

  listTasks(projectId: string, filter?: { assigneeId?: string; status?: TaskStatus }) {
    return this.prisma.task.findMany({
      where: {
        projectId,
        ...(filter?.assigneeId && { assigneeId: filter.assigneeId }),
        ...(filter?.status && { status: filter.status }),
      },
      include: {
        assignee: { select: { id: true, fullName: true } },
        division: true,
        submissions: {
          orderBy: { submittedAt: 'desc' },
          take: 3,
          include: {
            _count: { select: { feedback: true } },
          },
        },
        _count: { select: { submissions: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { title: 'asc' }],
    });
  }

  myTasks(memberId: string) {
    return this.prisma.task.findMany({
      where: { assigneeId: memberId },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, fullName: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { title: 'asc' }],
    });
  }

  async createTask(dto: CreateTaskDto, actorId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    if (dto.assigneeId) {
      const m = await this.prisma.member.findUnique({
        where: { id: dto.assigneeId },
      });
      if (!m) throw new BadRequestException('Assignee not found');
    }

    const task = await this.prisma.task.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        divisionId: dto.divisionId,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: {
        assignee: { select: { id: true, fullName: true } },
      },
    });

    if (dto.assigneeId) {
      await this.notifyAssignee(dto.assigneeId, task.title, project.name);
    }

    await this.audit.log({
      actorId,
      action: 'task.create',
      entityType: 'Task',
      entityId: task.id,
      meta: { projectId: dto.projectId },
    });

    return task;
  }

  async updateStatus(
    taskId: string,
    dto: UpdateTaskStatusDto,
    user: JwtPayload,
  ) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    const isAssignee = task.assigneeId === user.memberId;
    const isPengurus = !!(user.role && PENGURUS_ROLES.includes(user.role));
    if (!isAssignee && !isPengurus) throw new ForbiddenException();

    if (
      !canTransition(task.status, dto.status, { isPengurus })
    ) {
      throw new BadRequestException(
        `Invalid status transition ${task.status} → ${dto.status}`,
      );
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: { status: dto.status },
      include: {
        assignee: { select: { id: true, fullName: true } },
      },
    });
  }

  async assign(taskId: string, dto: AssignTaskDto, actorId?: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) throw new NotFoundException('Task not found');

    const member = await this.prisma.member.findUnique({
      where: { id: dto.assigneeId },
    });
    if (!member) throw new BadRequestException('Assignee not found');

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: { assigneeId: dto.assigneeId },
      include: {
        assignee: { select: { id: true, fullName: true } },
      },
    });

    await this.notifyAssignee(
      dto.assigneeId,
      task.title,
      task.project.name,
    );
    await this.audit.log({
      actorId,
      action: 'task.assign',
      entityType: 'Task',
      entityId: taskId,
      meta: { assigneeId: dto.assigneeId },
    });

    return updated;
  }

  async submit(taskId: string, memberId: string, dto: CreateSubmissionDto) {
    if (!dto.repoUrl && !dto.fileUrl && !dto.demoUrl) {
      throw new BadRequestException('Minimal satu: repoUrl, fileUrl, atau demoUrl');
    }

    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.assigneeId && task.assigneeId !== memberId) {
      throw new ForbiddenException('Not assignee');
    }
    // unassigned: claim on first submit
    if (!task.assigneeId) {
      await this.prisma.task.update({
        where: { id: taskId },
        data: { assigneeId: memberId },
      });
    }

    const sub = await this.prisma.submission.create({
      data: {
        taskId,
        memberId,
        repoUrl: dto.repoUrl,
        fileUrl: dto.fileUrl,
        demoUrl: dto.demoUrl,
      },
      include: {
        member: { select: { id: true, fullName: true } },
      },
    });

    // auto move to REVIEW if not already DONE
    if (task.status !== TaskStatus.DONE && task.status !== TaskStatus.REVIEW) {
      await this.prisma.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.REVIEW },
      });
    }

    // notify pengurus lightly via in-app to all users with active pengurus role — skip bulk; notify mentors of submitter
    await this.notifyMentorsOfMentee(
      memberId,
      `Submission: ${task.title}`,
      `Tugas di project ${task.project.name} disubmit.`,
    );

    return sub;
  }

  async getSubmission(id: string) {
    const sub = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        task: { include: { project: true } },
        member: { select: { id: true, fullName: true } },
        feedback: {
          include: { reviewer: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!sub) throw new NotFoundException('Submission not found');
    return sub;
  }

  async listTaskSubmissions(taskId: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');
    return this.prisma.submission.findMany({
      where: { taskId },
      include: {
        member: { select: { id: true, fullName: true } },
        feedback: {
          include: { reviewer: { select: { id: true, fullName: true } } },
        },
        _count: { select: { feedback: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async addFeedback(
    submissionId: string,
    reviewerId: string,
    dto: CreateFeedbackDto,
    user: JwtPayload,
  ) {
    const sub = await this.getSubmission(submissionId);
    const isPengurus = !!(user.role && PENGURUS_ROLES.includes(user.role));
    const isMentor = await this.prisma.mentorAssignment.findFirst({
      where: { mentorId: reviewerId, menteeId: sub.memberId },
    });
    if (!isPengurus && !isMentor) {
      throw new ForbiddenException('Only pengurus or mentor of submitter');
    }

    const fb = await this.prisma.feedback.create({
      data: { submissionId, reviewerId, content: dto.content },
      include: { reviewer: { select: { id: true, fullName: true } } },
    });

    // notify submitter
    const member = await this.prisma.member.findUnique({
      where: { id: sub.memberId },
      select: { userId: true },
    });
    if (member) {
      await this.prisma.notification.create({
        data: {
          userId: member.userId,
          type: NotificationType.FEEDBACK,
          title: 'Feedback tugas',
          body: dto.content.slice(0, 280),
        },
      });
    }

    return fb;
  }

  async assignMentor(dto: MentorAssignmentDto, actorId?: string) {
    if (dto.mentorId === dto.menteeId) {
      throw new BadRequestException('Mentor dan mentee harus berbeda');
    }
    try {
      const row = await this.prisma.mentorAssignment.create({
        data: { mentorId: dto.mentorId, menteeId: dto.menteeId },
        include: {
          mentor: { select: { id: true, fullName: true } },
          mentee: { select: { id: true, fullName: true } },
        },
      });
      await this.audit.log({
        actorId,
        action: 'mentor.assign',
        entityType: 'MentorAssignment',
        entityId: row.id,
        meta: { mentorId: dto.mentorId, menteeId: dto.menteeId },
      });
      return row;
    } catch {
      throw new ConflictException('Pairing sudah ada');
    }
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

  /** Tasks due in next 24h without DONE — notify assignees */
  async sendDeadlineReminders() {
    const now = new Date();
    const until = new Date(now.getTime() + 24 * 3_600_000);
    const tasks = await this.prisma.task.findMany({
      where: {
        dueDate: { gte: now, lte: until },
        status: { not: TaskStatus.DONE },
        assigneeId: { not: null },
      },
      include: {
        project: { select: { name: true } },
        assignee: { select: { userId: true, fullName: true } },
      },
    });

    let sent = 0;
    for (const t of tasks) {
      if (!t.assignee) continue;
      await this.prisma.notification.create({
        data: {
          userId: t.assignee.userId,
          type: NotificationType.DEADLINE,
          title: `Deadline: ${t.title}`,
          body: `${t.project.name} · jatuh tempo ${t.dueDate!.toLocaleString('id-ID')}`.slice(
            0,
            280,
          ),
        },
      });
      sent += 1;
    }
    return { sent, tasks: tasks.length };
  }

  private async notifyAssignee(
    memberId: string,
    taskTitle: string,
    projectName: string,
  ) {
    const m = await this.prisma.member.findUnique({
      where: { id: memberId },
      select: { userId: true },
    });
    if (!m) return;
    await this.prisma.notification.create({
      data: {
        userId: m.userId,
        type: NotificationType.DEADLINE,
        title: `Tugas baru: ${taskTitle}`,
        body: `Di-assign di project ${projectName}`.slice(0, 280),
      },
    });
  }

  private async notifyMentorsOfMentee(
    menteeId: string,
    title: string,
    body: string,
  ) {
    const pairs = await this.prisma.mentorAssignment.findMany({
      where: { menteeId },
      include: { mentor: { select: { userId: true } } },
    });
    if (!pairs.length) return;
    await this.prisma.notification.createMany({
      data: pairs.map((p) => ({
        userId: p.mentor.userId,
        type: NotificationType.FEEDBACK,
        title,
        body: body.slice(0, 280),
      })),
    });
  }
}
