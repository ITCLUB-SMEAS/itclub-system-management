import { IsString } from 'class-validator';

export class PollVoteDto {
  @IsString()
  optionId!: string;
}
