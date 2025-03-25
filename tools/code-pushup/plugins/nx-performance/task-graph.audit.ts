import type { Audit, AuditOutputs } from '@code-pushup/models';
import { formatDuration, slugify } from '@code-pushup/utils';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

export const DEFAULT_MAX_TASK_GRAPH_TIME = 1000;
export const TASK_GRAPH_TIME_AUDIT_POSTFIX = 'graph-time-task';

export function getTaskGraphTimeAuditSlug(task: string): string {
  return `${slugify(task)}-${TASK_GRAPH_TIME_AUDIT_POSTFIX}`;
}

export const getTaskGraphTimeAudits = (tasks: string[]): Audit[] =>
  tasks.map((task) => ({
    slug: getTaskGraphTimeAuditSlug(task), // Unique slug for each task
    title: '[Graph Time] task graph',
    description: 'An audit to check performance of the Nx task graph',
  }));

export type TaskGraphAuditOptions = {
  taskGraphTasks: string[];
  maxTaskGraphTime?: number;
};

export async function taskGraphAudits(
  options?: TaskGraphAuditOptions
): Promise<AuditOutputs> {
  const { maxTaskGraphTime = DEFAULT_MAX_TASK_GRAPH_TIME, taskGraphTasks } = options ?? {
    taskGraphTasks: [],
  };
  const results = await taskGraphTiming(taskGraphTasks);

  return results.map(({ duration, task }) => ({
    slug: getTaskGraphTimeAuditSlug(task),
    score: scoreTaskGraphDuration(duration, maxTaskGraphTime),
    value: duration,
    displayValue: formatDuration(duration, 2),
    details: {},
  }));
}

export function scoreTaskGraphDuration(duration: number, maxDuration: number): number {
  // Ensure duration is capped at maxDuration for the scoring
  if (duration >= maxDuration) {
    return 0;
  }
  // A simple linear score where a lower duration gives a higher score.
  // When duration == 0, score is 1 (perfect). When duration == maxDuration, score is 0 (poor).
  return 1 - duration / maxDuration;
}

export async function taskGraphTiming(
  tasks: string[]
): Promise<{ duration: number; task: string }[]> {
  const results: { duration: number; task: string }[] = [];
  const isWindows = process.platform === 'win32';
  for (const task of tasks) {
    const start = performance.now();
    await promisify(execFile)(
      'npx',
      [
        'nx',
        'run-many',
        '-t',
        task,
        '--graph',
        join('tmp', 'nx-performance', 'task-graph', task, 'graph.json'),
      ],
      {
        shell: isWindows,
        env: {
          ...process.env,
          NX_CACHE_PROJECT_GRAPH: 'false',
          NX_ISOLATE_PLUGINS: 'true',
          NX_DAEMON: 'false',
        },
      }
    );
    const execFileDuration = Number((performance.now() - start).toFixed(3));
    results.push({
      task,
      duration: Number(execFileDuration.toFixed(3)),
    });
  }
  return results;
}
