// Container health check (Docker HEALTHCHECK, ECS, Kubernetes probes).
export const dynamic = 'force-dynamic';

export function GET() {
  return new Response('ok');
}
