import { PrismaClient, RoleName } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

type SeedUser = {
  email: string;
  username: string;
  fullName: string;
  className: string;
  role: RoleName;
  divisionId?: string;
};

async function upsertMember(
  passwordHash: string,
  periodId: string,
  u: SeedUser,
) {
  const user = await prisma.user.upsert({
    where: { email: u.email },
    update: {},
    create: {
      email: u.email,
      username: u.username,
      passwordHash,
      member: {
        create: {
          fullName: u.fullName,
          className: u.className,
          batchYear: 2025,
          interests: ['itclub'],
          approvalStatus: 'APPROVED',
          status: 'ACTIVE',
        },
      },
    },
    include: { member: true },
  });

  if (user.member) {
    await prisma.memberPeriod.upsert({
      where: {
        memberId_periodId: {
          memberId: user.member.id,
          periodId,
        },
      },
      create: {
        memberId: user.member.id,
        periodId,
        divisionId: u.divisionId,
        role: u.role,
      },
      update: { role: u.role, divisionId: u.divisionId },
    });
  }
  return user;
}

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);

  const period = await prisma.membershipPeriod.upsert({
    where: { id: 'seed-period-1' },
    update: { isActive: true },
    create: {
      id: 'seed-period-1',
      name: '2025/2026',
      startDate: new Date('2025-07-01'),
      endDate: new Date('2026-06-30'),
      isActive: true,
    },
  });

  const web = await prisma.division.upsert({
    where: { id: 'seed-div-web' },
    update: {},
    create: {
      id: 'seed-div-web',
      name: 'Web Development',
      description: 'Frontend & backend web',
    },
  });

  const mobile = await prisma.division.upsert({
    where: { id: 'seed-div-mobile' },
    update: {},
    create: {
      id: 'seed-div-mobile',
      name: 'Mobile',
      description: 'Flutter / Android',
    },
  });

  const users: SeedUser[] = [
    {
      email: 'ketua@clubit.local',
      username: 'ketua',
      fullName: 'Ketua ITCLUB',
      className: 'XII RPL 1',
      role: RoleName.KETUA,
      divisionId: web.id,
    },
    {
      email: 'wakil@clubit.local',
      username: 'wakil',
      fullName: 'Wakil Ketua',
      className: 'XII RPL 2',
      role: RoleName.WAKIL_KETUA,
      divisionId: web.id,
    },
    {
      email: 'sekretaris@clubit.local',
      username: 'sekretaris',
      fullName: 'Sekretaris ITCLUB',
      className: 'XI RPL 1',
      role: RoleName.SEKRETARIS,
      divisionId: web.id,
    },
    {
      email: 'bendahara@clubit.local',
      username: 'bendahara',
      fullName: 'Bendahara ITCLUB',
      className: 'XI RPL 2',
      role: RoleName.BENDAHARA,
      divisionId: web.id,
    },
    {
      email: 'kadiv@clubit.local',
      username: 'kadiv',
      fullName: 'Kepala Divisi Mobile',
      className: 'XII TKJ 1',
      role: RoleName.KEPALA_DIVISI,
      divisionId: mobile.id,
    },
    {
      email: 'anggota@clubit.local',
      username: 'anggota',
      fullName: 'Anggota Biasa',
      className: 'X RPL 1',
      role: RoleName.ANGGOTA,
      divisionId: web.id,
    },
  ];

  for (const u of users) {
    await upsertMember(passwordHash, period.id, u);
  }

  await prisma.announcement.createMany({
    data: [
      {
        title: 'Welcome ITCLUB 2025/2026',
        content: 'Periode baru dimulai. Cek dashboard untuk jadwal kegiatan.',
      },
    ],
    skipDuplicates: true,
  });

  console.log('Seed OK — password semua: password123');
  for (const u of users) {
    console.log(`  ${u.role.padEnd(14)} ${u.email}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
