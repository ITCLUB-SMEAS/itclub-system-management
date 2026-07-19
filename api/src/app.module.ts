import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './common/mail/mail.module';
import { TurnstileModule } from './common/turnstile/turnstile.module';
import { AuthModule } from './modules/auth/auth.module';
import { MembersModule } from './modules/members/members.module';
import { DivisionsModule } from './modules/divisions/divisions.module';
import { PeriodsModule } from './modules/periods/periods.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { EventsModule } from './modules/events/events.module';
import { FinanceModule } from './modules/finance/finance.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { LearningModule } from './modules/learning/learning.module';
import { RecruitmentModule } from './modules/recruitment/recruitment.module';
import { ElectionsModule } from './modules/elections/elections.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { EvaluationModule } from './modules/evaluation/evaluation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: Number(config.get('THROTTLE_TTL') ?? 60_000),
          limit: Number(config.get('THROTTLE_LIMIT') ?? 100),
        },
        {
          name: 'auth',
          ttl: Number(config.get('THROTTLE_AUTH_TTL') ?? 60_000),
          limit: Number(config.get('THROTTLE_AUTH_LIMIT') ?? 20),
        },
      ],
    }),
    PrismaModule,
    MailModule,
    TurnstileModule,
    AuthModule,
    MembersModule,
    DivisionsModule,
    PeriodsModule,
    ActivitiesModule,
    ProjectsModule,
    EventsModule,
    FinanceModule,
    CommunicationModule,
    GamificationModule,
    LearningModule,
    RecruitmentModule,
    ElectionsModule,
    InventoryModule,
    PortfolioModule,
    IntegrationsModule,
    EvaluationModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
