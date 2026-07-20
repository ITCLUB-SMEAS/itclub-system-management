import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type AuditInput = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
  ip?: string | null;
};

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(input: AuditInput) {
    try {
      return await this.prisma.auditLog.create({
        data: {
          actorId: input.actorId ?? undefined,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? undefined,
          meta: input.meta ?? undefined,
          ip: input.ip ?? undefined,
        },
      });
    } catch {
      // audit must never break business flow
      return null;
    }
  }
}
