import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateLearningPathDto } from './dto/create-learning-path.dto';
import { CreateLearningResourceDto } from './dto/create-learning-resource.dto';

@Injectable()
export class LearningService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  listPaths(divisionId?: string) {
    return this.prisma.learningPath.findMany({
      where: divisionId ? { divisionId } : undefined,
      include: {
        division: true,
        resources: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { resources: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getPath(id: string, memberId?: string) {
    const path = await this.prisma.learningPath.findUnique({
      where: { id },
      include: {
        division: true,
        resources: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!path) throw new NotFoundException('Learning path not found');

    let completedIds = new Set<string>();
    if (memberId) {
      const progress = await this.prisma.learningProgress.findMany({
        where: {
          memberId,
          resourceId: { in: path.resources.map((r) => r.id) },
          completed: true,
        },
        select: { resourceId: true },
      });
      completedIds = new Set(progress.map((p) => p.resourceId));
    }

    const resources = path.resources.map((r) => ({
      ...r,
      completed: completedIds.has(r.id),
    }));
    const total = resources.length;
    const done = resources.filter((r) => r.completed).length;

    return {
      ...path,
      resources,
      progress: {
        total,
        completed: done,
        percent: total ? Math.round((done / total) * 100) : 0,
      },
    };
  }

  createPath(dto: CreateLearningPathDto, actorId?: string) {
    return this.prisma.learningPath
      .create({
        data: {
          name: dto.name,
          level: dto.level,
          description: dto.description,
          divisionId: dto.divisionId,
          sortOrder: dto.sortOrder ?? 0,
        },
      })
      .then(async (p) => {
        await this.audit.log({
          actorId,
          action: 'learning.path_create',
          entityType: 'LearningPath',
          entityId: p.id,
        });
        return p;
      });
  }

  listResources(filters: { divisionId?: string; pathId?: string }) {
    return this.prisma.learningResource.findMany({
      where: {
        ...(filters.divisionId && { divisionId: filters.divisionId }),
        ...(filters.pathId && { learningPathId: filters.pathId }),
      },
      include: { division: true, learningPath: true },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
  }

  createResource(dto: CreateLearningResourceDto, actorId?: string) {
    return this.prisma.learningResource
      .create({
        data: {
          title: dto.title,
          type: dto.type,
          url: dto.url,
          description: dto.description,
          divisionId: dto.divisionId,
          learningPathId: dto.learningPathId,
          sortOrder: dto.sortOrder ?? 0,
        },
      })
      .then(async (r) => {
        await this.audit.log({
          actorId,
          action: 'learning.resource_create',
          entityType: 'LearningResource',
          entityId: r.id,
        });
        return r;
      });
  }

  async downloadUrl(id: string) {
    const resource = await this.prisma.learningResource.findUnique({
      where: { id },
    });
    if (!resource) throw new NotFoundException('Resource not found');
    // ponytail: signed URL when object storage added
    return {
      url: resource.url,
      title: resource.title,
      type: resource.type,
      expiresIn: 3600,
    };
  }

  async markComplete(resourceId: string, memberId: string) {
    const resource = await this.prisma.learningResource.findUnique({
      where: { id: resourceId },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    return this.prisma.learningProgress.upsert({
      where: {
        memberId_resourceId: { memberId, resourceId },
      },
      create: {
        memberId,
        resourceId,
        completed: true,
        completedAt: new Date(),
      },
      update: {
        completed: true,
        completedAt: new Date(),
      },
      include: {
        resource: { select: { id: true, title: true, learningPathId: true } },
      },
    });
  }

  async uncomplete(resourceId: string, memberId: string) {
    await this.prisma.learningProgress.deleteMany({
      where: { memberId, resourceId },
    });
    return { success: true };
  }

  myProgress(memberId: string) {
    return this.prisma.learningProgress.findMany({
      where: { memberId, completed: true },
      include: {
        resource: {
          include: {
            learningPath: { select: { id: true, name: true, level: true } },
          },
        },
      },
      orderBy: { completedAt: 'desc' },
    });
  }

  async pathProgressSummary(memberId: string) {
    const paths = await this.prisma.learningPath.findMany({
      include: {
        resources: { select: { id: true } },
      },
      orderBy: { sortOrder: 'asc' },
    });
    const progress = await this.prisma.learningProgress.findMany({
      where: { memberId, completed: true },
      select: { resourceId: true },
    });
    const done = new Set(progress.map((p) => p.resourceId));

    return paths.map((p) => {
      const total = p.resources.length;
      const completed = p.resources.filter((r) => done.has(r.id)).length;
      return {
        pathId: p.id,
        name: p.name,
        level: p.level,
        total,
        completed,
        percent: total ? Math.round((completed / total) * 100) : 0,
      };
    });
  }

  assertOwner(memberId: string | undefined, target: string) {
    if (memberId !== target) throw new ForbiddenException();
  }
}
