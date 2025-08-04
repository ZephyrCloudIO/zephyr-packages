// OpenTelemetry Telemetry Setup for Zephyr Agent
// Best practices: explicit async init, idempotency, auto-instrumentation, resource attributes, shutdown, config flexibility

import { trace, type Tracer } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;
let initialized = false;
const OTLP_ENDPOINT =
  process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] || 'http://localhost:4318';
const OTEL_EXPORTER_OTLP_HEADERS = process.env['OTEL_EXPORTER_OTLP_HEADERS'];

// this is to parse the headers from the environment variable
function parseHeaders(headers: string): Record<string, string> {
  return headers.split(',').reduce(
    (acc, header) => {
      const [key, value] = header.split('=');
      acc[key] = value;
      return acc;
    },
    {} as Record<string, string>
  );
}
export async function initTelemetry(): Promise<void> {
  if (initialized) return;

  // Trace exporters
  const otlpExporter = new OTLPTraceExporter({
    url: `${OTLP_ENDPOINT}/v1/traces`,
    headers: parseHeaders(OTEL_EXPORTER_OTLP_HEADERS || 'Not found environemnt headers'),
  });

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'zephyr-packages',
    [ATTR_SERVICE_VERSION]: '0.0.1',
  });

  // Configure span processors for tracing
  const spanProcessors = [new SimpleSpanProcessor(otlpExporter)];

  sdk = new NodeSDK({
    spanProcessors: spanProcessors,
    resource: resource,
  });

  await sdk.start();
  // NOTE: OpenTelemetry NodeSDK currently only supports one metricReader directly.
  // To add more, you must set up a custom MeterProvider and register multiple readers.
  // See: https://github.com/open-telemetry/opentelemetry-js/issues/3892

  initialized = true;
}

export function getTracer(name: string): Tracer {
  return trace.getTracer(name);
}

// TODO: Add logging
