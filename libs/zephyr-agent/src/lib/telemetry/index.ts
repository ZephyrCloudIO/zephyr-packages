// IMPORTANT: Import this module at the top of your entrypoint to ensure OpenTelemetry is initialized before any spans are created.
//
// This file sets up OpenTelemetry for manual tracing only (no auto-instrumentation).
// Resource attributes (service.name, etc.) should be set via environment variables.
//
// Example environment variables for Grafana Cloud:
// OTEL_TRACES_EXPORTER="otlp"
// OTEL_EXPORTER_OTLP_ENDPOINT="https://otlp-gateway-prod-us-west-0.grafana.net/otlp"
// OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic <your-api-key>"
// OTEL_RESOURCE_ATTRIBUTES="service.name=zephyr-agent,service.namespace=zephyr,deployment.environment=dev"
//
// Only manual spans created with getTracer() will be sent to Grafana Cloud.

import { trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

const otlpEndpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
const otlpHeaders = process.env['OTEL_EXPORTER_OTLP_HEADERS'];

function parseHeaders(headerStr?: string): Record<string, string> {
  if (!headerStr) return {};
  const headers: Record<string, string> = {};
  for (const pair of headerStr.split(',')) {
    const [k, v] = pair.split('=');
    if (k && v) headers[k.trim()] = v.trim();
  }
  return headers;
}

const traceExporter = new OTLPTraceExporter({
  url: otlpEndpoint,
  headers: parseHeaders(otlpHeaders),
});

const sdk = new NodeSDK({
  traceExporter,
  // No resource, no instrumentations: manual tracing only
});

sdk.start();

export function getTracer(name: string) {
  return trace.getTracer(name);
}
