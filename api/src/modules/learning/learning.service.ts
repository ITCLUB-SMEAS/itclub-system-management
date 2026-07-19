import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLearningPathDto } from './dto/create-learning-path.dto';
import { CreateLearningResourceDto } from './dto/create-learning-resource.dto';

@Injectable()
export class LearningService {
  constructor(private prisma: PrismaService) {}

  listPaths() {
    return this.prisma.learningPath.findMany({
      include: { division: true, resources: true },
      orderBy: { name: 'asc' },
    });
  }

  createPath(dto: CreateLearningPathDto) {
    return this.prisma.learningPath.create({ data: dto });
  }

  listResources(filters: { divisionId?: string; pathId?: string }) {
    return this.prisma.learningResource.findMany({
      where: {
        ...(filters.divisionId && { divisionId: filters.divisionId }),
        ...(filters.pathId && { learningPathId: filters.pathId }),
      },
      include: { division: true, learningPath: true },
    });
  }

  createResource(dto: CreateLearningResourceDto) {
    return this.prisma.learningResource.create({ data: dto });
  }

  async downloadUrl(id: string) {
    const resource = await this.prisma.learningResource.findUnique({
      where: { id },
    });
    if (!resource) throw new NotFoundException('Resource not found');
    // ponytail: signed URL when object storage added
    return { url: resource.url, expiresIn: 3600 };
  }
}
