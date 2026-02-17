export default function timeRouteHandler() {
  const now = new Date();
  return {
    ok: true,
    iso: now.toISOString(),
    epochMs: now.getTime(),
  };
}
