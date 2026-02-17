export default function demoRoutesHandler() {
  return {
    ok: true,
    routes: [
      { method: 'GET', path: '/', description: 'Root payload + endpoint list' },
      { method: 'GET', path: '/health', description: 'Simple health response' },
      { method: 'GET', path: '/time', description: 'UTC timestamp and epoch' },
      { method: 'GET', path: '/echo?message=hi', description: 'Echo query value' },
      { method: 'GET', path: '/demo/routes', description: 'This route catalog' },
    ],
  };
}
