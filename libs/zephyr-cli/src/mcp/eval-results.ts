import * as fs from 'node:fs';
import path from 'node:path';
import {
  ZeErrors,
  ZephyrError,
  formatEvalResultsIssues,
  validateEvalResults,
} from 'zephyr-agent';
import type { EvalResults } from 'zephyr-edge-contract';

const MAX_EVAL_RESULTS_BYTES = 2 * 1024 * 1024;

/**
 * Read and validate `--eval-results <file>` (contract section 3.1) against the skills
 * that will be published. Runs before ZephyrEngine.create; any problem aborts the
 * deploy.
 */
export async function loadEvalResults(options: {
  evalResultsPath: string;
  cwd: string;
  skills: ReadonlySet<string>;
}): Promise<EvalResults> {
  const absolutePath = path.resolve(options.cwd, options.evalResultsPath);
  let value: unknown;
  try {
    const stats = await fs.promises.stat(absolutePath);
    if (!stats.isFile()) throw new Error('not a file');
    if (stats.size > MAX_EVAL_RESULTS_BYTES) {
      throw invalid(`the file is larger than ${MAX_EVAL_RESULTS_BYTES} bytes`);
    }
    value = JSON.parse(await fs.promises.readFile(absolutePath, 'utf8')) as unknown;
  } catch (error) {
    if (ZephyrError.is(error)) throw error;
    throw invalid(
      error instanceof SyntaxError
        ? 'the file is not valid JSON'
        : 'the file cannot be read'
    );
  }

  const { evalResults, issues } = validateEvalResults(value, options.skills);
  if (!evalResults) {
    throw invalid(`\n${formatEvalResultsIssues(issues)}`);
  }
  return evalResults;
}

function invalid(reason: string): ZephyrError<'ERR_DEPLOY_LOCAL_BUILD'> {
  return new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
    message: `Invalid --eval-results: ${reason}`,
  });
}
