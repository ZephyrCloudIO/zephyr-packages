# @nx/rspack + Module Federation Enhanced + Zephyr

## Build:

> npx nx run rspack_mf_remote:build --skip-nx-cache  
> npx nx run rspack_mf_host:build --skip-nx-cache

Or to run both:

> npx nx run-many -t build --parallel=1 --skip-nx-cache -p rspack_mf_remote rspack_mf_host

## Serve:

> npx nx run rspack_mf_remote:serve --skip-nx-cache  
> npx nx run rspack_mf_host:serve --skip-nx-cache

Or to run both:

> npx nx run-many -t serve --parallel=2 -p rspack_mf_remote rspack_mf_host
