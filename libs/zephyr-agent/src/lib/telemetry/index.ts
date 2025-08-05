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

// Global state management for telemetry initialization
let sdk: NodeSDK | undefined;
let initialized = false;

// Configuration from environment variables
// OTLP_ENDPOINT: Where to send telemetry data (defaults to localhost for development)
const OTLP_ENDPOINT =
  process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] || 'http://localhost:4318';
// OTEL_EXPORTER_OTLP_HEADERS: Authentication headers for the telemetry endpoint
const OTEL_EXPORTER_OTLP_HEADERS = process.env['OTEL_EXPORTER_OTLP_HEADERS'];

/**
 * Parses OTLP headers from environment variable Expected format:
 * "key1=value1,key2=value2" This is used for authentication with the telemetry endpoint
 */
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

/**
 * Initializes the OpenTelemetry telemetry system
 *
 * This function sets up:
 *
 * - OTLP HTTP exporter for sending trace data
 * - Resource attributes for service identification
 * - Span processors for handling trace data
 * - NodeSDK with proper configuration
 *
 * The function is idempotent - calling it multiple times is safe
 */
export async function initTelemetry(): Promise<void> {
  if (initialized) return;

  // Create OTLP HTTP exporter for sending trace data to the configured endpoint
  const otlpExporter = new OTLPTraceExporter({
    url: `${OTLP_ENDPOINT}/v1/traces`,
    headers: parseHeaders(OTEL_EXPORTER_OTLP_HEADERS || 'Not found environemnt headers'),
  });

  // Define resource attributes for service identification in telemetry data
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'zephyr-packages',
    [ATTR_SERVICE_VERSION]: '0.0.1',
  });

  // Configure span processors for handling trace data
  const spanProcessors = [new SimpleSpanProcessor(otlpExporter)];

  // Initialize NodeSDK with our telemetry configuration
  sdk = new NodeSDK({
    spanProcessors: spanProcessors,
    resource: resource,
  });

  // Start the SDK to begin collecting telemetry data
  await sdk.start();
  // NOTE: OpenTelemetry NodeSDK currently only supports one metricReader directly.
  // To add more, you must set up a custom MeterProvider and register multiple readers.
  // See: https://github.com/open-telemetry/opentelemetry-js/issues/3892

  initialized = true;
}

/**
 * Gets a tracer instance for creating spans
 *
 * @param name - The name of the tracer (usually the component/module name)
 * @returns Tracer instance that can be used to create spans
 */
export function getTracer(name: string): Tracer {
  return trace.getTracer(name);
}

// TODO: Add logging functionality for telemetry events
