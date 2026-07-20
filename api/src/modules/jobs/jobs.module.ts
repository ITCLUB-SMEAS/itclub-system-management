import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ActivitiesModule } from '../activities/activities.module';
import { EventsModule } from '../events/events.module';
import { ProjectsModule } from '../projects/projects.module';
import { InventoryModule } from '../inventory/inventory.module';
import { RemindersJob } from './reminders.job';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ActivitiesModule,
    EventsModule,
    ProjectsModule,
    InventoryModule,
  ],
  providers: [RemindersJob],
})
export class JobsModule {}
