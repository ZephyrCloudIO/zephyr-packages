import type { DoctorReport } from './schema';

export function formatDoctorReport(
  report: DoctorReport,
  format: 'json' | 'text'
): string {
  return format === 'json' ? JSON.stringify(report, null, 2) : formatDoctorText(report);
}

function formatDoctorText(report: DoctorReport): string {
  const lines = [
    `Zephyr Doctor (schema ${report.schemaVersion})`,
    `Project: ${report.projectDirectory}`,
    `Status: ${report.status}`,
    `Exit code: ${report.exitCode}`,
    `Package manager: ${report.packageManager}`,
    `Lockfile: ${report.lockfile ?? 'not found'}`,
    `Bundlers: ${report.bundlers.map(({ name }) => name).join(', ') || 'not detected'}`,
    `Findings: ${report.summary.errors} error(s), ${report.summary.warnings} warning(s), ${report.summary.info} info`,
  ];

  if (report.findings.length === 0) {
    lines.push('', 'No actionable findings.');
  } else {
    lines.push('', 'Findings:');
    for (const finding of report.findings) {
      lines.push(
        `[${finding.severity.toUpperCase()}] ${finding.code} ${finding.message}`
      );
      for (const evidence of finding.evidence) {
        lines.push(
          `  Evidence: ${evidence.path}${evidence.line ? `:${evidence.line}` : ''}${evidence.detail ? ` — ${evidence.detail}` : ''}`
        );
      }
      if (finding.target) lines.push(`  Target: ${finding.target}`);
      lines.push(`  Remediation: ${finding.remediation}`);
      if (finding.nextAction) lines.push(`  Next action: ${finding.nextAction}`);
    }
  }

  lines.push(
    '',
    `Watch mode: ${report.watch.mode}`,
    `Recommended watch command: ${report.watch.recommendedCommand ?? 'not available'}`,
    `DTS logs: ${report.dts.logs.join(', ') || 'none found'}`,
    `DTS temporary artifacts: ${report.dts.temporaryArtifacts.join(', ') || 'none found'}`,
    `DTS diagnostic commands: ${report.dts.diagnosticCommands.join(' | ')}`
  );
  if (report.online) {
    lines.push('', `Online checks (limit ${report.online.timeoutMs} ms each):`);
    for (const check of report.online.checks) {
      lines.push(
        `  ${check.id}: ${check.status}${check.findingCode ? ` ${check.findingCode}` : ''}${check.target ? ` ${check.target}` : ''}${check.httpStatus ? ` HTTP ${check.httpStatus}` : ''}`
      );
    }
  }
  return lines.join('\n');
}
