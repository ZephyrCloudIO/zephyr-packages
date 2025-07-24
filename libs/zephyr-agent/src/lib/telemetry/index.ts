// OpenTelemetry Telemetry Setup for Zephyr Agent
// Best practices: explicit async init, idempotency, auto-instrumentation, resource attributes, shutdown, config flexibility, metrics-ready

import { trace, type Tracer } from '@opentelemetry/api';
//import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPTraceExporter as OTLPTraceExporterGrpc } from '@opentelemetry/exporter-trace-otlp-grpc';
import { NodeSDK } from '@opentelemetry/sdk-node';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

let sdk: NodeSDK | undefined;
let initialized = false;
const OTLP_ENDPOINT = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
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

  // starting the otlp exporter this is ONLY for the traces
  const otlpExporter = new OTLPTraceExporterGrpc({
    url: `${OTLP_ENDPOINT}/v1/traces`,
    headers: parseHeaders(OTEL_EXPORTER_OTLP_HEADERS || 'Not found environemnt headers'),
  });
  const consoleExporter = new ConsoleSpanExporter();

  // TODO: Add metrics exporter

  // TODO: Add logging exporter

  sdk = new NodeSDK({
    spanProcessors: [
      new SimpleSpanProcessor(otlpExporter),
      new SimpleSpanProcessor(consoleExporter), // TODO: Remove this once we have a proper logging system
    ] as SpanProcessor[],
    // No auto-instrumentations might add later if we need it
  });

  await sdk.start();
  initialized = true;
}

export function getTracer(name: string): Tracer {
  return trace.getTracer(name);
}

// TODO: Add metrics
// TODO: Add logging
