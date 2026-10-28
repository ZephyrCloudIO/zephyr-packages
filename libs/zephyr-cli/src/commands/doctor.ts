import { analyzeProject } from '../doctor/analyze';
import { addOnlineChecks } from '../doctor/online';
import { formatDoctorReport } from '../doctor/format';
import type { DoctorExitCode } from '../doctor/schema';

export interface DoctorCommandOptions {
  directory: string;
  format: 'json' | 'text';
  /** Also check that Zephyr can be reached and that the token and application work. */
  online?: boolean;
  /** The limit for each online check, in milliseconds. */
  timeoutMs?: number;
  cwd: string;
}

export async function doctorCommand(
  options: DoctorCommandOptions
): Promise<DoctorExitCode> {
  const offlineReport = await analyzeProject(options.directory, { cwd: options.cwd });
  const report = options.online
    ? await addOnlineChecks(offlineReport, { timeoutMs: options.timeoutMs })
    : offlineReport;
  console.log(formatDoctorReport(report, options.format));
  return report.exitCode;
}
