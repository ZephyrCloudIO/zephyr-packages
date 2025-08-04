// OpenTelemetry Telemetry Setup for Zephyr Agent
// Best practices: explicit async init, idempotency, auto-instrumentation, resource attributes, shutdown, config flexibility, metrics-ready

import type { Meter } from '@opentelemetry/api';
import { metrics, trace, type Tracer } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
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

  // Metrics exporters
  const otlpMetricExporter = new OTLPMetricExporter({
    url: `${OTLP_ENDPOINT}/v1/metrics`,
    headers: parseHeaders(OTEL_EXPORTER_OTLP_HEADERS || 'Not found environemnt headers'),
  });
  //const consoleMetricExporter = new ConsoleMetricExporter(); // use this for debuggins only

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'zephyr-packages',
    [ATTR_SERVICE_VERSION]: '0.0.1',
  });

  // Always use the console metric exporter for now
  const metricReader = new PeriodicExportingMetricReader({
    exporter: otlpMetricExporter,
    exportIntervalMillis: 10000, // 10 seconds
    exportTimeoutMillis: 5000, // 5 seconds
  });

  // add the metric reader to the meter provider

  // Configure span processors for both local and remote telemetry
  const spanProcessors = [new SimpleSpanProcessor(otlpExporter)];

  sdk = new NodeSDK({
    spanProcessors: spanProcessors,
    metricReader: metricReader,
    resource: resource,
    // NOTE: To add more metric exporters, use a custom MeterProvider setup
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

// metrics added

export function getMetrics(name: string): Meter {
  return metrics.getMeter(name);
}

// TODO: Add logging
