import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDivisionDto } from './dto/create-division.dto';

@Injectable()
export class DivisionsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.division.findMany({ orderBy: { name: 'asc' } });
  }

  create(dto: CreateDivisionDto) {
    return this.prisma.division.create({ data: dto });
  }
}
