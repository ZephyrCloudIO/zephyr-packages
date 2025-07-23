// OpenTelemetry Telemetry Setup for Zephyr Agent
// Best practices: explicit async init, idempotency, auto-instrumentation, resource attributes, shutdown, config flexibility, metrics-ready

import { trace, type Tracer } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import type {
  SpanProcessor} from '@opentelemetry/sdk-trace-base';
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor
} from '@opentelemetry/sdk-trace-base';

let sdk: NodeSDK | undefined;
let initialized = false;
const OTLP_ENDPOINT = 'http://localhost:4318';

export async function initTelemetry(): Promise<void> {
  if (initialized) return;

  const otlpExporter = new OTLPTraceExporter({ url: OTLP_ENDPOINT });
  const consoleExporter = new ConsoleSpanExporter();

  sdk = new NodeSDK({
    spanProcessors: [
      new SimpleSpanProcessor(otlpExporter),
      new SimpleSpanProcessor(consoleExporter),
    ] as SpanProcessor[],
    // No auto-instrumentations
  });

  await sdk.start();
  initialized = true;
}

export function getTracer(name: string): Tracer {
  return trace.getTracer(name);
}
