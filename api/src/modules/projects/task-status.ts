import { TaskStatus } from '@prisma/client';

const ORDER: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.REVIEW,
  TaskStatus.DONE,
];

export function canTransition(
  from: TaskStatus,
  to: TaskStatus,
  opts: { isPengurus: boolean },
): boolean {
  if (from === to) return true;
  // pengurus may jump freely
  if (opts.isPengurus) return true;
  const i = ORDER.indexOf(from);
  const j = ORDER.indexOf(to);
  if (i < 0 || j < 0) return false;
  // assignee: only ±1 column
  return Math.abs(i - j) === 1;
}

export function nextStatus(from: TaskStatus): TaskStatus | null {
  const i = ORDER.indexOf(from);
  if (i < 0 || i >= ORDER.length - 1) return null;
  return ORDER[i + 1];
}
