interface MaybePathEvent {
  path?: string;
}

export default function echoRouteHandler(event?: MaybePathEvent) {
  const path = typeof event?.path === 'string' ? event.path : '';
  const url = new URL(path || '/echo', 'https://example.invalid');
  const message = url.searchParams.get('message') ?? 'hello-from-zephyr';

  return {
    ok: true,
    route: '/echo',
    message,
  };
}
