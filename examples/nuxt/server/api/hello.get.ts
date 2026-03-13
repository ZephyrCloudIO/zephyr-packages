import { getRequestHeader } from 'h3';

function makeRequestId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export default defineEventHandler((event) => {
  const requestId = getRequestHeader(event, 'x-request-id') ?? makeRequestId();

  return {
    ok: true,
    time: new Date().toISOString(),
    requestId,
  };
});
