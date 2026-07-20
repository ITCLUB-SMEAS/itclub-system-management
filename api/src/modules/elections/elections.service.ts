import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ElectionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CreateElectionDto } from './dto/create-election.dto';
import { AddCandidateDto } from './dto/add-candidate.dto';
import { VoteDto } from './dto/vote.dto';
import { CreatePollDto } from './dto/create-poll.dto';
import { PollVoteDto } from './dto/poll-vote.dto';

@Injectable()
export class ElectionsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  listElections() {
    return this.prisma.election.findMany({
      include: {
        candidates: {
          include: {
            member: { select: { id: true, fullName: true } },
            _count: { select: { votes: true } },
          },
        },
        period: true,
        _count: { select: { votes: true, candidates: true } },
      },
      orderBy: { title: 'asc' },
    });
  }

  async getElection(id: string, includeCounts = false) {
    const election = await this.prisma.election.findUnique({
      where: { id },
      include: {
        candidates: {
          include: {
            member: { select: { id: true, fullName: true } },
            ...(includeCounts
              ? { _count: { select: { votes: true } } }
              : {}),
          },
        },
        period: true,
        _count: { select: { votes: true } },
      },
    });
    if (!election) throw new NotFoundException('Election not found');
    return election;
  }

  createElection(dto: CreateElectionDto, actorId?: string) {
    return this.prisma.election
      .create({
        data: {
          periodId: dto.periodId,
          title: dto.title,
          description: dto.description,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
        },
        include: { candidates: true, period: true },
      })
      .then(async (e) => {
        await this.audit.log({
          actorId,
          action: 'election.create',
          entityType: 'Election',
          entityId: e.id,
        });
        return e;
      });
  }

  async setStatus(id: string, status: ElectionStatus, actorId?: string) {
    const election = await this.prisma.election.findUnique({ where: { id } });
    if (!election) throw new NotFoundException('Election not found');
    const updated = await this.prisma.election.update({
      where: { id },
      data: { status },
      include: {
        candidates: {
          include: { member: { select: { id: true, fullName: true } } },
        },
        period: true,
      },
    });
    await this.audit.log({
      actorId,
      action: 'election.status',
      entityType: 'Election',
      entityId: id,
      meta: { status },
    });
    return updated;
  }

  async addCandidate(electionId: string, dto: AddCandidateDto) {
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
    });
    if (!election) throw new NotFoundException('Election not found');
    if (election.status === ElectionStatus.CLOSED) {
      throw new BadRequestException('Election closed');
    }
    try {
      return await this.prisma.electionCandidate.create({
        data: { electionId, memberId: dto.memberId },
        include: { member: { select: { id: true, fullName: true } } },
      });
    } catch {
      throw new ConflictException('Candidate already added');
    }
  }

  async vote(electionId: string, voterId: string, dto: VoteDto) {
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
    });
    if (!election) throw new NotFoundException('Election not found');
    if (election.status !== ElectionStatus.OPEN) {
      throw new BadRequestException('Election not open');
    }
    if (election.endsAt && election.endsAt.getTime() < Date.now()) {
      throw new BadRequestException('Election voting period ended');
    }

    const candidate = await this.prisma.electionCandidate.findFirst({
      where: { id: dto.candidateId, electionId },
    });
    if (!candidate) throw new BadRequestException('Invalid candidate');

    try {
      const vote = await this.prisma.vote.create({
        data: {
          electionId,
          candidateId: dto.candidateId,
          voterId,
        },
      });
      await this.audit.log({
        action: 'election.vote',
        entityType: 'Election',
        entityId: electionId,
        meta: { voterId },
      });
      return { id: vote.id, electionId, votedAt: vote.votedAt };
    } catch {
      throw new ConflictException('Already voted');
    }
  }

  async hasVoted(electionId: string, voterId: string) {
    const v = await this.prisma.vote.findUnique({
      where: { electionId_voterId: { electionId, voterId } },
    });
    return { voted: !!v };
  }

  /** Results only when CLOSED (or pengurus — controller decides) */
  async results(electionId: string, allowOpen = false) {
    const election = await this.prisma.election.findUnique({
      where: { id: electionId },
      include: {
        candidates: {
          include: {
            member: { select: { id: true, fullName: true } },
            _count: { select: { votes: true } },
          },
        },
        period: true,
        _count: { select: { votes: true } },
      },
    });
    if (!election) throw new NotFoundException('Election not found');
    if (!allowOpen && election.status !== ElectionStatus.CLOSED) {
      throw new BadRequestException('Results available when election CLOSED');
    }

    const ranked = [...election.candidates].sort(
      (a, b) => b._count.votes - a._count.votes,
    );

    return {
      ...election,
      candidates: ranked,
      totalVotes: election._count.votes,
    };
  }

  listPolls() {
    return this.prisma.poll.findMany({
      include: {
        options: true,
        _count: { select: { votes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  createPoll(dto: CreatePollDto, actorId?: string) {
    return this.prisma.poll
      .create({
        data: {
          question: dto.question,
          endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
          options: {
            create: dto.options.map((label) => ({ label })),
          },
        },
        include: { options: true },
      })
      .then(async (p) => {
        await this.audit.log({
          actorId,
          action: 'poll.create',
          entityType: 'Poll',
          entityId: p.id,
        });
        return p;
      });
  }

  async closePoll(id: string, actorId?: string) {
    const poll = await this.prisma.poll.findUnique({ where: { id } });
    if (!poll) throw new NotFoundException('Poll not found');
    const updated = await this.prisma.poll.update({
      where: { id },
      data: { closed: true },
      include: { options: true },
    });
    await this.audit.log({
      actorId,
      action: 'poll.close',
      entityType: 'Poll',
      entityId: id,
    });
    return updated;
  }

  async pollVote(pollId: string, voterId: string, dto: PollVoteDto) {
    const poll = await this.prisma.poll.findUnique({ where: { id: pollId } });
    if (!poll) throw new NotFoundException('Poll not found');
    if (poll.closed) throw new BadRequestException('Poll closed');
    if (poll.endsAt && poll.endsAt.getTime() < Date.now()) {
      throw new BadRequestException('Poll ended');
    }

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

  async pollResults(pollId: string) {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: { orderBy: { votesCount: 'desc' } },
        _count: { select: { votes: true } },
      },
    });
    if (!poll) throw new NotFoundException('Poll not found');
    return poll;
  }
}
