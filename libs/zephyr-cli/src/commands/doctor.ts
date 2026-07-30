import { analyzeProject } from '../doctor/analyze';
import { formatDoctorReport } from '../doctor/format';
import type { DoctorExitCode } from '../doctor/schema';

export interface DoctorCommandOptions {
  directory: string;
  format: 'json' | 'text';
  cwd: string;
}

export async function doctorCommand(
  options: DoctorCommandOptions
): Promise<DoctorExitCode> {
  const report = await analyzeProject(options.directory, { cwd: options.cwd });
  console.log(formatDoctorReport(report, options.format));
  return report.exitCode;
}
