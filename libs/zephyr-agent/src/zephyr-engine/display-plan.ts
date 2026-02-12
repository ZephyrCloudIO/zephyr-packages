import { logFn } from '../lib/logging/ze-log-event';

export interface DeployPlanResult {
  impactedTags: Array<{ name: string; currentVersion?: string; newVersion: string }>;
  impactedEnvs: Array<{ name: string; protected: boolean; requiresApproval: boolean }>;
  impactedCnames: string[];
  permissions: { canDeploy: boolean; blockedEnvs: string[] };
}

export function displayPlan(applicationUid: string, plan: DeployPlanResult): void {
  const log = (msg: string) => logFn('info', msg, 'deploy:plan');

  log('');
  log('=== Zephyr Deploy Plan ===');
  log('');
  log(`Application: ${applicationUid}`);
  log('');

  if (plan.impactedTags.length > 0) {
    log('Tags to be updated:');
    for (const tag of plan.impactedTags) {
      const change = tag.currentVersion
        ? `${tag.currentVersion} -> ${tag.newVersion}`
        : '(new)';
      log(`  ${tag.name.padEnd(20)} ${change}`);
    }
    log('');
  }

  if (plan.impactedEnvs.length > 0) {
    log('Environments affected:');
    for (const env of plan.impactedEnvs) {
      const protection = env.protected ? '(protected)' : '(unprotected)';
      const approval = env.requiresApproval ? ' -- requires approval' : ' -- will deploy';
      log(`  ${env.name.padEnd(20)} -> ${protection}${approval}`);
    }
    log('');
  }

  if (plan.impactedCnames.length > 0) {
    log('Custom domains affected:');
    for (const cname of plan.impactedCnames) {
      log(`  ${cname}`);
    }
    log('');
  }

  if (plan.permissions.blockedEnvs.length > 0) {
    log(`Blocked environments: ${plan.permissions.blockedEnvs.join(', ')}`);
    log('');
  }

  log('No changes were made. Remove --plan or ZE_PLAN to deploy.');
  log('');
}
