import {
  probeHttp,
  resolvePreflightApplicationUid,
  resolvePreflightCredentials,
  type HttpProbeResult,
  type PreflightApplicationUid,
  type PreflightCredentials,
} from 'zephyr-agent';
import {
  ZE_API_ENDPOINT,
  ZEPHYR_API_ENDPOINT,
  ze_api_gateway,
} from 'zephyr-edge-contract';
import { finalizeReport } from './analyze';
import { DEFAULT_ONLINE_TIMEOUT_MS } from './online-limits';
import {
  DOCTOR_ONLINE_SCHEMA_VERSION,
  DoctorExitCode,
  DoctorFindingCode,
  type DoctorFinding,
  type DoctorNextAction,
  type DoctorOnlineCheck,
  type DoctorOnlineCheckId,
  type DoctorReport,
  type DoctorSeverity,
} from './schema';

export interface OnlineChecksDependencies {
  probe: (
    url: URL,
    options: { headers?: Record<string, string>; timeoutMs: number }
  ) => Promise<HttpProbeResult>;
  resolveCredentials: () => Promise<PreflightCredentials>;
  resolveApplicationUid: (directory: string) => Promise<PreflightApplicationUid>;
}

export interface OnlineChecksOptions {
  /** The limit for each check. */
  timeoutMs?: number;
  deps?: Partial<OnlineChecksDependencies>;
}

const defaultDependencies: OnlineChecksDependencies = {
  probe: probeHttp,
  resolveCredentials: resolvePreflightCredentials,
  resolveApplicationUid: resolvePreflightApplicationUid,
};

type Code = DoctorFindingCode;

interface Verdict {
  check: DoctorOnlineCheck;
  finding?: DoctorFinding;
}

/**
 * Adds the online checks to an offline report: API, gateway, token, application
 * configuration and edge URL. Each check has its own timeout and its own finding codes.
 * The checks only read. They do not log in, exchange tokens or change stored state.
 */
export async function addOnlineChecks(
  report: DoctorReport,
  options: OnlineChecksOptions = {}
): Promise<DoctorReport> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_ONLINE_TIMEOUT_MS;
  const deps = { ...defaultDependencies, ...options.deps };
  const verdicts: Verdict[] = [];

  try {
    const apiUrl = parseEndpoint(ZEPHYR_API_ENDPOINT());
    const gatewayUrl = parseEndpoint(ZE_API_ENDPOINT());

    const api = apiUrl
      ? await checkOrigin('api', apiUrl, deps, timeoutMs, {
          unreachable: DoctorFindingCode.ApiUnreachable,
          unavailable: DoctorFindingCode.ApiUnavailable,
        })
      : invalidEndpoint('api', 'ZE_API');
    const gateway = gatewayUrl
      ? await checkOrigin('gateway', gatewayUrl, deps, timeoutMs, {
          unreachable: DoctorFindingCode.GatewayUnreachable,
          unavailable: DoctorFindingCode.GatewayUnavailable,
        })
      : invalidEndpoint('gateway', 'ZE_API_GATE');
    verdicts.push(api, gateway);

    const token = await checkToken(gateway, gatewayUrl, deps, timeoutMs);
    verdicts.push(token.verdict);

    const application = await checkApplication(
      report,
      token.credentials,
      token.verdict,
      gatewayUrl,
      deps,
      timeoutMs
    );
    verdicts.push(application.verdict);

    verdicts.push(
      await checkEdge(application.verdict, application.edgeUrl, deps, timeoutMs)
    );
  } catch {
    return withToolFailure(report, verdicts, timeoutMs);
  }

  return merge(report, verdicts, timeoutMs);
}

/** `ZE_API` and `ZE_API_GATE` must be http or https URLs, or no request can be made. */
function parseEndpoint(value: string): URL | undefined {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : undefined;
  } catch {
    return undefined;
  }
}

function invalidEndpoint(id: 'api' | 'gateway', variable: string): Verdict {
  return failed(
    id,
    null,
    DoctorFindingCode.EndpointInvalid,
    'error',
    `${variable} is not a valid address.`,
    'It must be a full http or https URL.',
    `Set ${variable} to a full URL such as https://example.com, or remove it to use the default.`,
    'correct_request'
  );
}

async function checkOrigin(
  id: 'api' | 'gateway',
  url: URL,
  deps: OnlineChecksDependencies,
  timeoutMs: number,
  codes: { unreachable: Code; unavailable: Code }
): Promise<Verdict> {
  const label = id === 'api' ? 'The Zephyr API' : 'The Zephyr gateway';
  const result = await deps.probe(url, { timeoutMs });
  return reachability(id, label, url.origin, result, timeoutMs, codes);
}

function reachability(
  id: DoctorOnlineCheckId,
  label: string,
  target: string,
  result: HttpProbeResult,
  timeoutMs: number,
  codes: { unreachable: Code; unavailable: Code }
): Verdict {
  if (result.outcome !== 'response') {
    return failed(
      id,
      target,
      codes.unreachable,
      'error',
      `${label} cannot be reached.`,
      result.outcome === 'timeout'
        ? `No answer within ${timeoutMs} ms.`
        : `Network error: ${result.reason}.`,
      'Check the network, proxy and DNS settings and the ZE_API and ZE_API_GATE values. If the settings are correct, Zephyr may be down: retry later. The bundle can still be built with ZE_DISABLED=true.',
      'retry_later'
    );
  }
  if (result.status >= 500) {
    return failed(
      id,
      target,
      codes.unavailable,
      'error',
      `${label} is not available.`,
      `The server answered with HTTP ${result.status}.`,
      'Retry later. The bundle can still be built with ZE_DISABLED=true.',
      'retry_later',
      result.status
    );
  }
  return passed(id, target, result.status);
}

async function checkToken(
  gateway: Verdict,
  gatewayUrl: URL | undefined,
  deps: OnlineChecksDependencies,
  timeoutMs: number
): Promise<{ verdict: Verdict; credentials: PreflightCredentials }> {
  const credentials = await deps.resolveCredentials();

  if (credentials.source === 'none') {
    return {
      credentials,
      verdict: failed(
        'token',
        null,
        DoctorFindingCode.TokenMissing,
        'error',
        'No Zephyr token was found.',
        'ZE_SECRET_TOKEN is not set and there is no stored login.',
        'Set ZE_SECRET_TOKEN, or run a build in a terminal to log in.',
        'refresh_credentials'
      ),
    };
  }

  if (credentials.source === 'exchange') {
    return {
      credentials,
      verdict: skipped(
        'token',
        null,
        DoctorFindingCode.TokenNotChecked,
        'info',
        'The token was not checked.',
        'ZE_CI_TOKEN and ZE_SERVER_TOKEN are exchanged for an access token during a build. Doctor does not exchange tokens.',
        'Set ZE_SECRET_TOKEN to check a token here, or run the build to test the exchange.',
        'none'
      ),
    };
  }

  if (gateway.check.status !== 'passed' || !gatewayUrl) {
    return { credentials, verdict: skippedAfter('token', gateway) };
  }
  const base = gatewayUrl;

  const result = await deps.probe(new URL(ze_api_gateway.user_info, base), {
    headers: { Authorization: `Bearer ${credentials.token}` },
    timeoutMs,
  });
  const target = base.origin;

  if (result.outcome !== 'response') {
    return {
      credentials,
      verdict: skipped(
        'token',
        target,
        DoctorFindingCode.TokenNotChecked,
        'warning',
        'The token was not checked.',
        result.outcome === 'timeout'
          ? `No answer within ${timeoutMs} ms.`
          : `Network error: ${result.reason}.`,
        'Fix the connection problem, then run doctor again.',
        'retry_later'
      ),
    };
  }

  if (result.status === 401) {
    return {
      credentials,
      verdict: failed(
        'token',
        target,
        DoctorFindingCode.TokenInvalid,
        'error',
        'The Zephyr token is not valid.',
        `The gateway answered with HTTP 401. Token source: ${credentials.source}.`,
        'Create a new token in Zephyr Cloud and set it in ZE_SECRET_TOKEN, or log in again.',
        'refresh_credentials',
        result.status
      ),
    };
  }
  if (result.status === 403) {
    return {
      credentials,
      verdict: failed(
        'token',
        target,
        DoctorFindingCode.TokenForbidden,
        'error',
        'The Zephyr token is not allowed to do this.',
        'The gateway answered with HTTP 403.',
        'Use a token from an account that belongs to the organization.',
        'check_permissions',
        result.status
      ),
    };
  }
  if (result.status >= 200 && result.status < 300) {
    return { credentials, verdict: passed('token', target, result.status) };
  }
  return {
    credentials,
    verdict: skipped(
      'token',
      target,
      DoctorFindingCode.TokenNotChecked,
      'warning',
      'The token was not checked.',
      `The gateway answered with HTTP ${result.status}.`,
      result.status >= 500
        ? 'Retry later.'
        : 'Update the Zephyr packages, then run doctor again.',
      result.status >= 500 ? 'retry_later' : 'correct_request',
      result.status
    ),
  };
}

async function checkApplication(
  report: DoctorReport,
  credentials: PreflightCredentials,
  token: Verdict,
  gatewayUrl: URL | undefined,
  deps: OnlineChecksDependencies,
  timeoutMs: number
): Promise<{ verdict: Verdict; edgeUrl?: string }> {
  if (token.check.status !== 'passed' || !credentials.token || !gatewayUrl) {
    return { verdict: skippedAfter('application', token) };
  }
  const base = gatewayUrl;
  if (report.exitCode === DoctorExitCode.InvalidProject) {
    return {
      verdict: skipped(
        'application',
        null,
        DoctorFindingCode.ApplicationUnresolved,
        'info',
        'The application configuration was not checked.',
        'The project directory is not valid.',
        'Fix the project errors above, then run doctor again.',
        'correct_request'
      ),
    };
  }

  const resolved = await deps.resolveApplicationUid(report.projectDirectory);
  if (resolved.uid === undefined) {
    return {
      verdict:
        resolved.reason === 'config-file'
          ? skipped(
              'application',
              null,
              DoctorFindingCode.ApplicationUnresolved,
              'info',
              'The application configuration was not checked.',
              'A zephyr.config file may set the application name, and doctor does not run project files.',
              'Run a build to check the application, or deploy once with the Zephyr plugin.',
              'none'
            )
          : skipped(
              'application',
              null,
              DoctorFindingCode.ApplicationUnresolved,
              'warning',
              'The application name could not be found, so its configuration was not checked.',
              'The project has no name in package.json or no git remote named origin.',
              'Add a name to package.json and a git remote named origin, or set org and project in zephyr.config.',
              'correct_request'
            ),
    };
  }
  const applicationUid = resolved.uid;

  const target = base.origin;
  const result = await deps.probe(
    new URL(`${ze_api_gateway.application_config}/${applicationUid}`, base),
    { headers: { Authorization: `Bearer ${credentials.token}` }, timeoutMs }
  );

  if (result.outcome !== 'response') {
    return {
      verdict: failed(
        'application',
        target,
        DoctorFindingCode.ApplicationConfigUnavailable,
        'error',
        'The application configuration could not be loaded.',
        result.outcome === 'timeout'
          ? `No answer within ${timeoutMs} ms.`
          : `Network error: ${result.reason}.`,
        'Retry later.',
        'retry_later'
      ),
    };
  }
  if (result.status >= 500) {
    return {
      verdict: failed(
        'application',
        target,
        DoctorFindingCode.ApplicationConfigUnavailable,
        'error',
        'The application configuration could not be loaded.',
        `The gateway answered with HTTP ${result.status}.`,
        'Retry later.',
        'retry_later',
        result.status
      ),
    };
  }
  if (result.status === 401) {
    return {
      verdict: failed(
        'application',
        target,
        DoctorFindingCode.TokenInvalid,
        'error',
        'The Zephyr token is not valid.',
        'The gateway answered with HTTP 401.',
        'Create a new token in Zephyr Cloud and set it in ZE_SECRET_TOKEN, or log in again.',
        'refresh_credentials',
        result.status
      ),
    };
  }
  if (result.status === 403) {
    return {
      verdict: failed(
        'application',
        target,
        DoctorFindingCode.ApplicationConfigRejected,
        'error',
        'This token cannot read the application configuration.',
        `The gateway answered with HTTP 403 for application ${applicationUid}.`,
        'Use a token from an account that belongs to the organization of this application.',
        'check_permissions',
        result.status
      ),
    };
  }
  if (result.status === 404) {
    return {
      verdict: failed(
        'application',
        target,
        DoctorFindingCode.ApplicationConfigNotFound,
        'error',
        'Zephyr has no configuration for this application.',
        `The gateway answered with HTTP 404 for application ${applicationUid}.`,
        'Check the application name, organization and project. The organization and project come from the git remote origin or zephyr.config.',
        'correct_request',
        result.status
      ),
    };
  }

  const edgeUrl = readEdgeUrl(result, applicationUid);
  if (!edgeUrl) {
    return {
      verdict: failed(
        'application',
        target,
        DoctorFindingCode.ApplicationConfigInvalid,
        'error',
        'The application configuration is not correct.',
        `The gateway answered with HTTP ${result.status} for application ${applicationUid}, but the answer has no usable edge URL.`,
        'Check the application settings in Zephyr Cloud, then run doctor again.',
        'correct_request',
        result.status
      ),
    };
  }
  return { verdict: passed('application', target, result.status), edgeUrl };
}

function readEdgeUrl(
  result: Extract<HttpProbeResult, { outcome: 'response' }>,
  applicationUid: string
): string | undefined {
  if (result.status < 200 || result.status >= 300) return undefined;
  try {
    const body = JSON.parse(result.body) as {
      value?: { application_uid?: unknown; EDGE_URL?: unknown };
    };
    const { application_uid, EDGE_URL } = body.value ?? {};
    if (application_uid !== applicationUid || typeof EDGE_URL !== 'string') {
      return undefined;
    }
    const url = new URL(EDGE_URL);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

async function checkEdge(
  application: Verdict,
  edgeUrl: string | undefined,
  deps: OnlineChecksDependencies,
  timeoutMs: number
): Promise<Verdict> {
  if (!edgeUrl) {
    return skippedAfter('edge', application);
  }
  const url = new URL(edgeUrl);
  const result = await deps.probe(url, { timeoutMs });
  return reachability('edge', 'The edge URL', url.origin, result, timeoutMs, {
    unreachable: DoctorFindingCode.EdgeUnreachable,
    unavailable: DoctorFindingCode.EdgeUnavailable,
  });
}

function passed(id: DoctorOnlineCheckId, target: string, httpStatus: number): Verdict {
  return { check: { id, status: 'passed', target, httpStatus } };
}

function failed(
  id: DoctorOnlineCheckId,
  target: string | null,
  code: Code,
  severity: DoctorSeverity,
  message: string,
  detail: string,
  remediation: string,
  nextAction: DoctorNextAction,
  httpStatus?: number
): Verdict {
  return verdict(
    'failed',
    id,
    target,
    code,
    severity,
    message,
    detail,
    remediation,
    nextAction,
    httpStatus
  );
}

function skipped(
  id: DoctorOnlineCheckId,
  target: string | null,
  code: Code,
  severity: DoctorSeverity,
  message: string,
  detail: string,
  remediation: string,
  nextAction: DoctorNextAction,
  httpStatus?: number
): Verdict {
  return verdict(
    'skipped',
    id,
    target,
    code,
    severity,
    message,
    detail,
    remediation,
    nextAction,
    httpStatus
  );
}

/** A check that could not run because the check it depends on already failed. */
function skippedAfter(id: DoctorOnlineCheckId, earlier: Verdict): Verdict {
  return {
    check: {
      id,
      status: 'skipped',
      target: null,
      findingCode: earlier.check.findingCode,
    },
  };
}

function verdict(
  status: 'failed' | 'skipped',
  id: DoctorOnlineCheckId,
  target: string | null,
  code: Code,
  severity: DoctorSeverity,
  message: string,
  detail: string,
  remediation: string,
  nextAction: DoctorNextAction,
  httpStatus?: number
): Verdict {
  return {
    check: {
      id,
      status,
      target,
      ...(httpStatus === undefined ? {} : { httpStatus }),
      findingCode: code,
    },
    finding: {
      code,
      severity,
      message: `${message} ${detail}`,
      evidence: [],
      remediation,
      check: id,
      ...(target === null ? {} : { target }),
      nextAction,
    },
  };
}

function merge(
  report: DoctorReport,
  verdicts: Verdict[],
  timeoutMs: number,
  extraFindings: DoctorFinding[] = []
): DoctorReport {
  const findings = [
    ...report.findings,
    ...verdicts.flatMap(({ finding }) => (finding ? [finding] : [])),
    ...extraFindings,
  ];
  const { status, exitCode } = report;

  report.schemaVersion = DOCTOR_ONLINE_SCHEMA_VERSION;
  report.online = { timeoutMs, checks: verdicts.map(({ check }) => check) };
  finalizeReport(report, findings);

  // A missing project (2) or a tool failure (3) outranks online findings.
  if (
    exitCode === DoctorExitCode.InvalidProject ||
    exitCode === DoctorExitCode.ToolFailure
  ) {
    report.status = status;
    report.exitCode = exitCode;
  }
  return report;
}

function withToolFailure(
  report: DoctorReport,
  verdicts: Verdict[],
  timeoutMs: number
): DoctorReport {
  const finding: DoctorFinding = {
    code: DoctorFindingCode.ToolFailure,
    severity: 'error',
    message: 'Zephyr Doctor could not complete the online checks.',
    evidence: [{ path: '.', detail: 'unexpected error' }],
    remediation:
      'Run doctor without --online to get the project checks, and report this failure.',
  };
  // Keep the checks that finished and list the rest as skipped, so every report names
  // all five checks. A missing project (2) keeps its exit code; anything else becomes a
  // tool failure (3).
  const done = new Set(verdicts.map(({ check }) => check.id));
  const notRun: Verdict[] = (['api', 'gateway', 'token', 'application', 'edge'] as const)
    .filter((id) => !done.has(id))
    .map((id) => ({
      check: {
        id,
        status: 'skipped',
        target: null,
        findingCode: DoctorFindingCode.ToolFailure,
      },
    }));
  const merged = merge(report, [...verdicts, ...notRun], timeoutMs, [finding]);
  if (merged.exitCode !== DoctorExitCode.InvalidProject) {
    merged.status = 'tool_failure';
    merged.exitCode = DoctorExitCode.ToolFailure;
  }
  return merged;
}
