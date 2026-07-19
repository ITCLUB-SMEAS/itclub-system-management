import { IsString } from 'class-validator';

export class MentorAssignmentDto {
  @IsString()
  mentorId!: string;

  @IsString()
  menteeId!: string;
}
