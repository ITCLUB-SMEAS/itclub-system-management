import { IsString } from 'class-validator';

export class AddCandidateDto {
  @IsString()
  memberId!: string;
}
