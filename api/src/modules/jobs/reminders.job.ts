import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ActivitiesService } from '../activities/activities.service';
import { EventsService } from '../events/events.service';
import { ProjectsService } from '../projects/projects.service';
import { InventoryService } from '../inventory/inventory.service';

/**
 * Daily H-1 / deadline sweeps. Manual endpoints remain for pengurus override.
 * Disable with REMINDERS_CRON=false
 */
@Injectable()
export class RemindersJob {
  private readonly log = new Logger(RemindersJob.name);

  constructor(
    private activities: ActivitiesService,
    private events: EventsService,
    private projects: ProjectsService,
    private inventory: InventoryService,
  ) {}

  private enabled() {
    return process.env.REMINDERS_CRON !== 'false';
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async morningReminders() {
    if (!this.enabled()) return;
    this.log.log('Running morning reminder sweep…');
    try {
      const [act, ev, tasks, inv] = await Promise.all([
        this.activities.sendUpcomingReminders(),
        this.events.sendUpcomingReminders(),
        this.projects.sendDeadlineReminders(),
        this.inventory.notifyOverdue(),
      ]);
      this.log.log(
        `Reminders done: activities=${act.activities}/${act.sent} events=${ev.events}/${ev.sent} tasks=${tasks.tasks}/${tasks.sent} overdue=${inv.overdue}/${inv.sent}`,
      );
    } catch (err) {
      this.log.error(
        'Reminder sweep failed',
        err instanceof Error ? err.stack : err,
      );
    }
  }
}
