<script setup lang="ts">
const { data, pending, error } = await useFetch('/api/hello', { server: true });

const ssrMeta = useState('ssrMeta', () => ({
  renderedAt: new Date().toISOString(),
  renderedOn: import.meta.server ? 'server' : 'client',
}));
</script>

<template>
  <div class="page">
    <main class="hero">
      <div class="hero-copy">
        <span class="chip">Zephyr + Nuxt</span>
        <h1>Nuxt on Zephyr</h1>
        <h3 class="subhead">SSR enabled</h3>
        <p>
          This page is rendered on the server and calls <code>/api/hello</code>
          during SSR.
        </p>
        <p class="ssr-note">
          Rendered on <strong>{{ ssrMeta.renderedOn }}</strong> at
          <strong>{{ ssrMeta.renderedAt }}</strong
          >.
        </p>
      </div>

      <section class="ssr-card">
        <header class="ssr-header">
          <span class="ssr-badge">SSR</span>
          <div>
            <h2>Server response</h2>
            <p>from /api/hello</p>
          </div>
        </header>

        <div class="ssr-body">
          <p v-if="pending">Loading...</p>
          <p v-else-if="error">Error loading server data.</p>
          <dl v-else class="ssr-meta">
            <div>
              <dt>time</dt>
              <dd>{{ data?.time }}</dd>
            </div>
            <div>
              <dt>requestId</dt>
              <dd>{{ data?.requestId }}</dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

:root {
  color-scheme: dark;
}

:global(html, body) {
  margin: 0;
  padding: 0;
  background: #050615;
}

.page,
:global(#__nuxt) {
  min-height: 100vh;
}

.page {
  min-height: 100vh;
  padding: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family:
    'Inter',
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  background:
    radial-gradient(1200px circle at 10% 10%, #101244 0%, transparent 55%),
    radial-gradient(900px circle at 85% 15%, #0b2a4d 0%, transparent 55%),
    #050615;
  color: #e2e8f0;
}

.hero {
  width: min(960px, 100%);
  display: grid;
  gap: 2rem;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  align-items: center;
}

.hero-copy h1 {
  margin: 0.6rem 0 0.8rem;
  font-size: clamp(2.2rem, 4vw, 3.4rem);
}

.subhead {
  margin: 0 0 1.1rem;
  font-size: 1.1rem;
  font-weight: 600;
  color: #00dc82;
}

.hero-copy p {
  margin: 0 0 1rem;
  color: #cbd5f5;
  line-height: 1.5;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: rgba(0, 220, 130, 0.15);
  color: #00dc82;
  font-weight: 600;
  font-size: 0.85rem;
  letter-spacing: 0.04em;
}

.ssr-note {
  font-size: 0.95rem;
  color: #94a3b8;
}

.ssr-note strong {
  color: #00dc82;
}

.ssr-card {
  border: 1px solid rgba(148, 163, 184, 0.06);
  border-radius: 18px;
  padding: 1.5rem;
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(10px);
  box-shadow: 0 20px 40px -30px rgba(0, 0, 0, 0.6);
}

.ssr-header {
  display: flex;
  gap: 0.9rem;
  align-items: center;
}

.ssr-header h2 {
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
  color: #f8fafc;
}

.ssr-header p {
  margin: 0;
  color: #94a3b8;
}

.ssr-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  background: #00dc82;
  color: #06281c;
}

.ssr-body {
  border-top: 1px dashed rgba(148, 163, 184, 0.25);
  padding-top: 1rem;
  margin-top: 1rem;
}

.ssr-meta {
  display: grid;
  gap: 0.75rem;
  margin: 0.75rem 0 0;
}

.ssr-meta div {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 0.75rem;
}

dt {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.72rem;
  color: #94a3b8;
}

dd {
  margin: 0;
  font-family:
    'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    'Liberation Mono', 'Courier New', monospace;
  font-size: 0.9rem;
  color: #f8fafc;
  word-break: break-all;
  overflow-wrap: anywhere;
}

code {
  background: rgba(148, 163, 184, 0.2);
  padding: 0.1rem 0.35rem;
  border-radius: 6px;
  font-size: 0.85rem;
  color: #e2e8f0;
}

@media (max-width: 720px) {
  .page {
    padding: 1.75rem;
  }
}
</style>
