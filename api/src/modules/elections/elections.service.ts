import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ElectionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateElectionDto } from './dto/create-election.dto';
import { AddCandidateDto } from './dto/add-candidate.dto';
import { VoteDto } from './dto/vote.dto';
import { CreatePollDto } from './dto/create-poll.dto';
import { PollVoteDto } from './dto/poll-vote.dto';

@Injectable()
export class ElectionsService {
  constructor(private prisma: PrismaService) {}

  listElections() {
    return this.prisma.election.findMany({
      include: {
        candidates: {
          include: { member: { select: { id: true, fullName: true } } },
        },
        period: true,
      },
      orderBy: { title: 'asc' },
    });
  }

  createElection(dto: CreateElectionDto) {
    return this.prisma.election.create({
      data: dto,
      include: { candidates: true, period: true },
    });
  }

  async setStatus(id: string, status: ElectionStatus) {
    const election = await this.prisma.election.findUnique({ where: { id } });
    if (!election) throw new NotFoundException('Election not found');
    return this.prisma.election.update({
      where: { id },
      data: { status },
      include: {
        candidates: {
          include: { member: { select: { id: true, fullName: true } } },
        },
        period: true,
      },
    });
  }

  async addCandidate(electionId: string, dto: AddCandidateDto) {
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
    });
    if (!election) throw new NotFoundException('Election not found');
    return this.prisma.electionCandidate.create({
      data: { electionId, memberId: dto.memberId },
      include: { member: { select: { id: true, fullName: true } } },
    });
  }

  async vote(electionId: string, voterId: string, dto: VoteDto) {
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
    });
    if (!election) throw new NotFoundException('Election not found');
    if (election.status !== ElectionStatus.OPEN) {
      throw new BadRequestException('Election not open');
    }

    const candidate = await this.prisma.electionCandidate.findFirst({
      where: { id: dto.candidateId, electionId },
    });
    if (!candidate) throw new BadRequestException('Invalid candidate');

    try {
      return await this.prisma.vote.create({
        data: {
          electionId,
          candidateId: dto.candidateId,
          voterId,
        },
      });
    } catch {
      throw new ConflictException('Already voted');
    }
  }

  async results(electionId: string) {
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
      include: {
        candidates: {
          include: {
            member: { select: { id: true, fullName: true } },
            _count: { select: { votes: true } },
          },
        },
      },
    });
    if (!election) throw new NotFoundException('Election not found');
    return election;
  }

  listPolls() {
    return this.prisma.poll.findMany({
      include: { options: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  createPoll(dto: CreatePollDto) {
    return this.prisma.poll.create({
      data: {
        question: dto.question,
        options: {
          create: dto.options.map((label) => ({ label })),
        },
      },
      include: { options: true },
    });
  }

  async pollVote(pollId: string, voterId: string, dto: PollVoteDto) {
    const option = await this.prisma.pollOption.findFirst({
      where: { id: dto.optionId, pollId },
    });
    if (!option) throw new BadRequestException('Invalid option');

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.pollVote.create({
          data: { pollId, optionId: dto.optionId, voterId },
        });
        return tx.pollOption.update({
          where: { id: dto.optionId },
          data: { votesCount: { increment: 1 } },
        });
      });
    } catch {
      throw new ConflictException('Already voted');
    }
  }
}
