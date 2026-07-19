import { RoleName } from '@prisma/client';

export class JwtPayload {
  sub!: string;
  email!: string;
  username!: string;
  memberId?: string;
  role?: RoleName;
  periodId?: string;
}
