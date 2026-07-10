# Production build benchmarks

The build benchmark exercises four distinct bundler lifecycles against Zephyr's real
production upload endpoints:

- Rspack CSR
- Vite 8 CSR
- TanStack Start client and SSR subcompilers
- Vinext RSC, SSR, and client subcompilers

It builds the local packages once outside the timed region, removes each scenario's output
before its first sample, then records one cold-output build and repeated builds. Every timed
build uploads to production with `ZE_FAIL_BUILD=true`; authentication failures and upload
failures fail the benchmark instead of silently producing local-only numbers.

Run the complete matrix from a named Git branch with an authenticated Zephyr session:

```bash
pnpm benchmark:builds -- --iterations 3
```

Select scenarios or save a machine-readable report:

```bash
pnpm benchmark:builds -- --scenario vite,tanstack --iterations 5
pnpm benchmark:builds -- --output docs/performance-benchmark-results.json
```

Wall time includes bundling, asset discovery, network upload, snapshot publication, and
deployment result persistence. Peak RSS is reported on macOS and Linux when
`/usr/bin/time` is available. Compare repeated runs on the same machine and network; the
numbers intentionally reflect production latency rather than a mocked upload path.

## Baseline: 2026-07-10

Node 24.15.0, pnpm 10.33.1, macOS arm64. All twelve builds published successfully to the
production service as snapshots #15755 through #15766. Local package preparation is not
included in these samples.

| Scenario                    |  Samples (seconds) |   Peak RSS |
| --------------------------- | -----------------: | ---------: |
| Rspack CSR                  | 4.60 / 2.70 / 2.21 | 165.08 MiB |
| Vite 8 CSR                  | 5.94 / 4.90 / 4.08 | 330.28 MiB |
| TanStack Start client + SSR | 7.78 / 6.84 / 6.82 | 928.64 MiB |
| Vinext RSC + SSR + client   | 7.69 / 4.46 / 3.27 | 931.66 MiB |

The complete samples and runtime metadata are in
[`performance-benchmark-results.json`](./performance-benchmark-results.json).
