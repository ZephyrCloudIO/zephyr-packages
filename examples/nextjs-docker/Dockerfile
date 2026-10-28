# Runtime image. Build on the host first (`pnpm build`): Next.js writes its server to
# .next/standalone, and zephyr-nextjs-plugin writes the Zephyr front door, public/, and
# the deployment record to .next/zephyr, laid out to match. Client assets stay on
# Zephyr, so the image only holds the server for one build, pinned to that build's
# Zephyr deployment.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY .next/standalone/ ./
COPY .next/zephyr/ ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "zephyr-server.mjs"]
