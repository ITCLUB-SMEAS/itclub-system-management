import { TaskStatus } from '@prisma/client';
import { canTransition } from './task-status';

describe('canTransition', () => {
  it('assignee only ±1 step', () => {
    expect(
      canTransition(TaskStatus.TODO, TaskStatus.IN_PROGRESS, {
        isPengurus: false,
      }),
    ).toBe(true);
    expect(
      canTransition(TaskStatus.TODO, TaskStatus.DONE, { isPengurus: false }),
    ).toBe(false);
  });

  it('pengurus may jump', () => {
    expect(
      canTransition(TaskStatus.TODO, TaskStatus.DONE, { isPengurus: true }),
    ).toBe(true);
  });
});
