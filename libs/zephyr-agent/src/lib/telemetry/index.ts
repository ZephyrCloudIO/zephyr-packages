// IMPORTANT: Import this module at the top of your entrypoint to ensure OpenTelemetry is initialized before any spans are created.
//
// This file sets up OpenTelemetry for manual tracing only (no auto-instrumentation).
// Resource attributes (service.name, etc.) should be set via environment variables.
//
// Example environment variables for Grafana Cloud:
// OTEL_EXPORTER_OTLP_ENDPOINT="https://otlp-gateway-prod-us-west-0.grafana.net/otlp/v1/traces"
// OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic <your-api-key>"
// OTEL_RESOURCE_ATTRIBUTES="service.name=zephyr-agent,service.namespace=zephyr,deployment.environment=dev"
//
// Only manual spans created with getTracer() will be sent to Grafana Cloud.
import { metrics, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace root
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const otlpEndpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
const otlpHeaders = process.env['OTEL_EXPORTER_OTLP_HEADERS'];

// Parse headers: "Authorization=Basic xyz" -> { Authorization: "Basic xyz" }
function parseHeaders(headersString: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!headersString) return headers;

  const pairs = headersString.split(',');
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split('=');
    if (key && valueParts.length > 0) {
      headers[key.trim()] = valueParts.join('=').trim();
    }
  }
  return headers;
}

// Only initialize if we have the required environment variables
if (otlpEndpoint && otlpHeaders) {
  console.log('[Telemetry] Initializing OpenTelemetry...');

  const traceExporter = new OTLPTraceExporter({
    url: otlpEndpoint,
    headers: parseHeaders(otlpHeaders),
  });

  // Set up basic metrics provider
  const meterProvider = new MeterProvider();
  metrics.setGlobalMeterProvider(meterProvider);

  const sdk = new NodeSDK({
    spanProcessor: new BatchSpanProcessor(traceExporter),
  });

  sdk.start();
  console.log('[Telemetry] ✅ OpenTelemetry started with traces and metrics');
} else {
  console.warn(
    '[Telemetry] Missing OTEL_EXPORTER_OTLP_ENDPOINT or OTEL_EXPORTER_OTLP_HEADERS - telemetry disabled'
  );
}

export function getTracer(name: string) {
  return trace.getTracer(name);
}

export function getMeter(name: string) {
  return metrics.getMeter(name);
}

// Pre-create common meters for easy access
export const buildMetrics = {
  meter: getMeter('zephyr.build'),
  buildIdGeneration: {
    counter: getMeter('zephyr.build').createCounter('build_id_generation_total', {
      description: 'Total number of build ID generation attempts',
    }),
    duration: getMeter('zephyr.build').createHistogram(
      'build_id_generation_duration_seconds',
      {
        description: 'Duration of build ID generation in seconds',
        unit: 's',
      }
    ),
  },
  engineInitialization: {
    counter: getMeter('zephyr.engine').createCounter('engine_initialization_total', {
      description: 'Total number of engine initialization attempts',
    }),
    duration: getMeter('zephyr.engine').createHistogram(
      'engine_initialization_duration_seconds',
      {
        description: 'Duration of engine initialization in seconds',
        unit: 's',
      }
    ),
  },
};
