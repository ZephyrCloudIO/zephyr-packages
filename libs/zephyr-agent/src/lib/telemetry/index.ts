// OpenTelemetry Telemetry Setup for Zephyr Agent
// Best practices: explicit async init, idempotency, auto-instrumentation, resource attributes, shutdown, config flexibility, metrics-ready

import type { Meter, Tracer } from '@opentelemetry/api';
import { metrics, trace } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from workspace root
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

// Types for config
export interface TelemetryOptions {
  otlpEndpoint?: string;
  otlpHeaders?: string;
  serviceName?: string;
  serviceNamespace?: string;
  environment?: string;
  autoInstrument?: boolean;
  logger?: typeof console;
}

let sdk: NodeSDK | undefined;
let initialized = false;
let initializing: Promise<void> | null = null;

/**
 * Initialize OpenTelemetry for tracing and (future) metrics. Idempotent: safe to call
 * multiple times.
 */
export async function initTelemetry(options: TelemetryOptions = {}): Promise<void> {
  if (initialized) return;
  if (initializing) return initializing;

  const logger = options.logger || console;

  // Debug: Log relevant environment variables
  logger.debug?.(
    '[Telemetry][Debug] OTEL_RESOURCE_ATTRIBUTES:',
    process.env['OTEL_RESOURCE_ATTRIBUTES']
  );
  logger.debug?.(
    '[Telemetry][Debug] OTEL_EXPORTER_OTLP_ENDPOINT:',
    process.env['OTEL_EXPORTER_OTLP_ENDPOINT']
  );

  // Parse resource attributes from env
  const envResourceAttrs = parseKeyValueString(process.env['OTEL_RESOURCE_ATTRIBUTES']);
  logger.debug?.('[Telemetry][Debug] Parsed envResourceAttrs:', envResourceAttrs);

  // Merge resource attributes: options take precedence over env
  const serviceName = options.serviceName || envResourceAttrs['service.name'];
  const serviceNamespace =
    options.serviceNamespace || envResourceAttrs['service.namespace'];
  const environment = options.environment || envResourceAttrs['deployment.environment'];

  // Compose all resource attributes
  const resourceAttributes: Record<string, string> = {
    ...envResourceAttrs,
    ...(serviceName ? { 'service.name': serviceName } : {}),
    ...(serviceNamespace ? { 'service.namespace': serviceNamespace } : {}),
    ...(environment ? { 'deployment.environment': environment } : {}),
  };
  logger.debug?.('[Telemetry][Debug] Final resourceAttributes:', resourceAttributes);

  // Ensure service.name is set
  if (!resourceAttributes['service.name']) {
    logger.warn(
      '[Telemetry] service.name is not set in OTEL_RESOURCE_ATTRIBUTES or options. Defaulting to "zephyr-agent".'
    );
    resourceAttributes['service.name'] = 'zephyr-agent';
  }

  const otlpEndpoint = options.otlpEndpoint || process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
  const autoInstrument = options.autoInstrument !== false; // default true

  logger.debug?.('[Telemetry][Debug] otlpEndpoint:', otlpEndpoint);
  logger.debug?.('[Telemetry][Debug] autoInstrument:', autoInstrument);

  if (!otlpEndpoint) {
    logger.warn('[Telemetry] Missing OTEL_EXPORTER_OTLP_ENDPOINT - telemetry disabled');
    initialized = true;
    return;
  }

  logger.info('[Telemetry] Initializing OpenTelemetry...');

  const traceExporter = new OTLPTraceExporter({
    url: otlpEndpoint,
    // No headers needed for local Alloy
  });
  logger.debug?.('[Telemetry][Debug] traceExporter config:', { url: otlpEndpoint });

  const resource = resourceFromAttributes(resourceAttributes);
  logger.debug?.('[Telemetry][Debug] resource:', resource);

  sdk = new NodeSDK({
    spanProcessor: undefined, // NodeSDK will use BatchSpanProcessor by default
    traceExporter,
    resource,
    instrumentations: autoInstrument ? [getNodeAutoInstrumentations()] : [],
    // metricsExporter: ... (add metrics exporter here in future)
  });
  logger.debug?.('[Telemetry][Debug] NodeSDK initialized');

  initializing = (async () => {
    try {
      logger.debug?.('[Telemetry][Debug] Starting NodeSDK...');
      if (sdk) {
        await sdk.start();
      }
      logger.info('[Telemetry] OpenTelemetry initialized');
      initialized = true;
    } catch (err: unknown) {
      logger.error('[Telemetry] Failed to initialize OpenTelemetry:', err);
      initialized = true;
    }
  })();
}

/** Gracefully shutdown OpenTelemetry (flushes and closes exporters). */
export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = undefined;
    initialized = false;
    initializing = null;
  }
}

/** Get a tracer for manual spans. */
export function getTracer(name: string): Tracer {
  return trace.getTracer(name);
}

/** (Stub) Get a meter for metrics (future support). */
export function getMeter(name: string): Meter {
  return metrics.getMeter(name);
}

// Helper: Parse comma-separated key=value pairs (for resource attributes and headers)
function parseKeyValueString(str: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!str) return result;
  for (const pair of str.split(',')) {
    const [key, ...valueParts] = pair.split('=');
    if (key && valueParts.length > 0) {
      result[key.trim()] = valueParts.join('=').trim();
    }
  }
  return result;
}
