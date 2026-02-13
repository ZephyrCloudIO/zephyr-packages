import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Span,
} from '@opentelemetry/api';
import {
  ATTR_ERROR_TYPE,
  ATTR_ZEPHYR_APPLICATION_UID,
  ATTR_ZEPHYR_APPLICATION_VERSION,
  ATTR_ZEPHYR_BUILD_BUILDER,
  ATTR_ZEPHYR_GIT_BRANCH,
  ATTR_ZEPHYR_GIT_COMMIT,
  ATTR_ZEPHYR_GIT_REMOTE,
  ATTR_ZEPHYR_IS_CI,
  ATTR_ZEPHYR_SERVICE_PLATFORM,
  ATTR_ZEPHYR_SERVICE_TYPE,
  ServicePlatform,
  ServiceType,
  TelemetryProvider,
  type Logger,
} from '@zephyrcloud/telemetry';

interface TelemetryGitMetadata {
  branch?: string;
  commit_sha?: string;
  remote_url?: string;
}

export interface InitTelemetryOptions {
  applicationUid: string;
  applicationVersion?: string;
  builder: string;
  authToken?: string;
  collectorEndpoint?: string;
  serviceVersion?: string;
  environment?: string;
  ci?: boolean;
  git?: TelemetryGitMetadata;
  tracesEnabled?: boolean;
  metricsEnabled?: boolean;
  logsEnabled?: boolean;
  debug?: boolean;
}

export interface ActiveTraceContext {
  traceId: string;
  spanId: string;
}

export interface TelemetryLogRecord {
  level?: string;
  body: string;
  attributes?: Attributes;
}

let telemetryProvider: TelemetryProvider | null = null;
let telemetryLogger: Logger | null = null;

function headersInitToRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => {
      record[key] = value;
    });
    return record;
  }

  if (Array.isArray(headers)) {
    return headers.reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  }

  return Object.entries(headers).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = Array.isArray(value) ? value.join(', ') : String(value);
    return acc;
  }, {});
}

export async function initTelemetry(options: InitTelemetryOptions): Promise<void> {
  if (telemetryProvider?.isReady()) {
    return;
  }

  if (!options.collectorEndpoint || !options.authToken) {
    return;
  }

  try {
    telemetryProvider = new TelemetryProvider({
      service: {
        name: 'zephyr-agent',
        version: options.serviceVersion ?? 'unknown',
        environment: options.environment ?? 'unknown',
        attributes: {
          [ATTR_ZEPHYR_APPLICATION_UID]: options.applicationUid,
          ...(options.applicationVersion
            ? { [ATTR_ZEPHYR_APPLICATION_VERSION]: options.applicationVersion }
            : {}),
          [ATTR_ZEPHYR_BUILD_BUILDER]: options.builder,
          [ATTR_ZEPHYR_IS_CI]: Boolean(options.ci),
          [ATTR_ZEPHYR_SERVICE_TYPE]: ServiceType.PLUGIN,
          [ATTR_ZEPHYR_SERVICE_PLATFORM]: ServicePlatform.NODE,
          ...(options.git?.branch
            ? { [ATTR_ZEPHYR_GIT_BRANCH]: options.git.branch }
            : {}),
          ...(options.git?.commit_sha
            ? { [ATTR_ZEPHYR_GIT_COMMIT]: options.git.commit_sha }
            : {}),
          ...(options.git?.remote_url
            ? { [ATTR_ZEPHYR_GIT_REMOTE]: options.git.remote_url }
            : {}),
        },
      },
      collectorEndpoint: options.collectorEndpoint,
      auth: {
        bearerToken: options.authToken,
      },
      traces: { enabled: options.tracesEnabled ?? true },
      metrics: { enabled: options.metricsEnabled ?? false },
      logs: { enabled: options.logsEnabled ?? false },
      debug: Boolean(options.debug),
    });

    telemetryProvider.initialize();
    telemetryLogger =
      options.logsEnabled && telemetryProvider.isReady()
        ? telemetryProvider.getLogger('zephyr-agent.logs')
        : null;
  } catch {
    telemetryProvider = null;
    telemetryLogger = null;
  }
}

export function injectTraceHeaders(headers?: HeadersInit): Record<string, string> {
  const carrier = headersInitToRecord(headers);
  propagation.inject(context.active(), carrier);
  return carrier;
}

export function getActiveTraceContext(): ActiveTraceContext | undefined {
  const activeSpan = trace.getActiveSpan();
  if (!activeSpan) {
    return undefined;
  }

  const spanContext = activeSpan.spanContext();

  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}

type SpanWork<T> = (span: Span | undefined) => Promise<T> | T;

export async function withTelemetrySpan<T>(
  name: string,
  work: SpanWork<T>,
  attributes?: Attributes,
  kind: SpanKind = SpanKind.INTERNAL
): Promise<T> {
  if (!telemetryProvider?.isReady()) {
    return work(undefined);
  }

  const tracer = telemetryProvider.getTracer('zephyr-agent');

  return tracer.startActiveSpan(
    name,
    {
      attributes,
      kind,
    },
    async (span: Span) => {
      try {
        const result = await work(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        if (error instanceof Error) {
          span.recordException(error);
          span.setAttribute(ATTR_ERROR_TYPE, error.name);
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        } else {
          span.setAttribute(ATTR_ERROR_TYPE, 'Error');
          span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
        }
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

export async function flushTelemetry(): Promise<void> {
  if (!telemetryProvider?.isReady()) {
    return;
  }

  await telemetryProvider.forceFlush();
}

function normalizeSeverity(level: string): string {
  const level_normalized = level.toLowerCase();

  switch (level_normalized) {
    case 'fatal':
      return 'FATAL';
    case 'error':
      return 'ERROR';
    case 'warn':
    case 'warning':
      return 'WARN';
    case 'debug':
      return 'DEBUG';
    case 'trace':
      return 'TRACE';
    case 'info':
    default:
      return 'INFO';
  }
}

export function emitTelemetryLog(record: TelemetryLogRecord): void {
  if (!telemetryProvider?.isReady() || !telemetryLogger) {
    return;
  }

  telemetryLogger.emit({
    severityText: normalizeSeverity(record.level ?? 'info'),
    body: record.body,
    attributes: record.attributes,
    context: context.active(),
  });
}

export function isTelemetryEnabled(): boolean {
  return telemetryProvider?.isReady() ?? false;
}
