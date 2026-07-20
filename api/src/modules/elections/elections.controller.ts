import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { RoleName } from '@prisma/client';
import { ElectionsService } from './elections.service';
import { CreateElectionDto } from './dto/create-election.dto';
import { AddCandidateDto } from './dto/add-candidate.dto';
import { VoteDto } from './dto/vote.dto';
import { CreatePollDto } from './dto/create-poll.dto';
import { PollVoteDto } from './dto/poll-vote.dto';
import { SetElectionStatusDto } from './dto/set-status.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/types/jwt-payload';
import { PENGURUS_ROLES } from '../../common/constants/roles';

@Controller()
@UseGuards(RolesGuard)
export class ElectionsController {
  constructor(private elections: ElectionsService) {}

  @Get('elections')
  listElections() {
    return this.elections.listElections();
  }

  @Post('elections')
  @Roles(RoleName.KETUA)
  createElection(
    @Body() dto: CreateElectionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.elections.createElection(dto, user.sub);
  }

  @Get('elections/:id')
  getElection(@Param('id') id: string) {
    return this.elections.getElection(id, false);
  }

  @Get('elections/:id/voted')
  hasVoted(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.elections.hasVoted(id, user.memberId);
  }

  @Patch('elections/:id/status')
  @Roles(RoleName.KETUA)
  setStatus(
    @Param('id') id: string,
    @Body() dto: SetElectionStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.elections.setStatus(id, dto.status, user.sub);
  }

  @Post('elections/:id/candidates')
  @Roles(RoleName.KETUA)
  addCandidate(@Param('id') id: string, @Body() dto: AddCandidateDto) {
    return this.elections.addCandidate(id, dto);
  }

  @Post('elections/:id/vote')
  vote(
    @Param('id') id: string,
    @Body() dto: VoteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.elections.vote(id, user.memberId, dto);
  }

  @Get('elections/:id/results')
  results(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const isPengurus = !!(user.role && PENGURUS_ROLES.includes(user.role));
    return this.elections.results(id, isPengurus);
  }

  @Get('polls')
  listPolls() {
    return this.elections.listPolls();
  }

  @Post('polls')
  @Roles(...PENGURUS_ROLES)
  createPoll(@Body() dto: CreatePollDto, @CurrentUser() user: JwtPayload) {
    return this.elections.createPoll(dto, user.sub);
  }

  @Post('polls/:id/close')
  @Roles(...PENGURUS_ROLES)
  closePoll(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.elections.closePoll(id, user.sub);
  }

  @Get('polls/:id')
  pollResults(@Param('id') id: string) {
    return this.elections.pollResults(id);
  }

  @Post('polls/:id/vote')
  pollVote(
    @Param('id') id: string,
    @Body() dto: PollVoteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.memberId) throw new BadRequestException('Member profile required');
    return this.elections.pollVote(id, user.memberId, dto);
  }
}
