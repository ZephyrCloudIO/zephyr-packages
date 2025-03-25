import { Audit, AuditOutputs, CategoryRef, PluginConfig } from '@code-pushup/models';

import {
  PROJECT_GRAPH_PERFORMANCE_AUDIT,
  PROJECT_GRAPH_PERFORMANCE_AUDIT_SLUG,
  ProjectGraphAuditOptions,
  projectGraphAudit,
} from './project-graph.audit';
import {
  TASK_GRAPH_TIME_AUDIT_POSTFIX,
  TaskGraphAuditOptions,
  getTaskGraphTimeAudits,
  taskGraphAudits,
} from './task-graph.audit';

export const PLUGIN_SLUG = 'nx-perf';

export type OnlyAudit =
  | typeof PROJECT_GRAPH_PERFORMANCE_AUDIT_SLUG
  | typeof TASK_GRAPH_TIME_AUDIT_POSTFIX;

export type NxPerfPluginConfig = {
  onlyAudits?: OnlyAudit[];
} & ProjectGraphAuditOptions &
  TaskGraphAuditOptions;

export type NxPerfRunnerOptions = NxPerfPluginConfig;

export const nxPerformanceAudits = (
  { taskGraphTasks }: NxPerfPluginConfig = {
    taskGraphTasks: [],
  }
) => [
  PROJECT_GRAPH_PERFORMANCE_AUDIT,
  ...(taskGraphTasks?.length ? getTaskGraphTimeAudits(taskGraphTasks) : []),
];

export const nxPerformanceCategoryRefs = (
  options: NxPerfRunnerOptions
): CategoryRef[] => {
  const allAudits = nxPerformanceAudits(options);
  const audits = options.onlyAudits
    ? filterOnlyAudits(allAudits, options.onlyAudits)
    : allAudits;
  return audits.map(({ slug }) => ({
    type: 'audit',
    plugin: PLUGIN_SLUG,
    slug,
    weight: 1,
  }));
};

export function nxPerformancePlugin(
  options: NxPerfPluginConfig = {
    taskGraphTasks: [],
    onlyAudits: [PROJECT_GRAPH_PERFORMANCE_AUDIT_SLUG, TASK_GRAPH_TIME_AUDIT_POSTFIX],
  }
): PluginConfig {
  const allAudits = nxPerformanceAudits(options);
  return {
    slug: PLUGIN_SLUG,
    title: 'Nx Performance Checks',
    icon: 'flash',
    description: 'A plugin to measure and assert performance of Nx workspace.',
    runner: () => runnerFunction(options),
    audits: options.onlyAudits
      ? filterOnlyAudits(allAudits, options.onlyAudits)
      : allAudits,
  };
}

export default nxPerformancePlugin;

function filterOnlyAudits(audits: Audit[], onlyAudits: OnlyAudit[]): Audit[] {
  const onlyAuditsSet = new Set(onlyAudits);
  return audits.filter(({ slug }) => {
    if (
      onlyAuditsSet.has(TASK_GRAPH_TIME_AUDIT_POSTFIX) &&
      slug.endsWith(TASK_GRAPH_TIME_AUDIT_POSTFIX)
    ) {
      return true;
    }
    return onlyAuditsSet.has(slug as OnlyAudit);
  });
}

async function runnerFunction(options: NxPerfRunnerOptions): Promise<AuditOutputs> {
  const {
    onlyAudits = [PROJECT_GRAPH_PERFORMANCE_AUDIT_SLUG, TASK_GRAPH_TIME_AUDIT_POSTFIX],
    taskGraphTasks,
    maxTaskGraphTime,
    maxProjectGraphTime,
  } = options;
  const onlyAuditsSet = new Set(onlyAudits);
  return [
    ...(onlyAuditsSet.has(PROJECT_GRAPH_PERFORMANCE_AUDIT_SLUG)
      ? [await projectGraphAudit({ maxProjectGraphTime })]
      : []),
    ...(onlyAuditsSet.has(TASK_GRAPH_TIME_AUDIT_POSTFIX)
      ? await taskGraphAudits({ maxTaskGraphTime, taskGraphTasks })
      : []),
  ];
}
