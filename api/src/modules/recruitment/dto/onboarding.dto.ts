import { IsObject } from 'class-validator';

export class OnboardingDto {
  /** checklist keys → boolean */
  @IsObject()
  checklist!: Record<string, boolean>;
}
