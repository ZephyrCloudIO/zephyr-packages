/**
 * Zephyr Next.js Adapter
 * 
 * Main entry point for the Zephyr Next.js Adapter library.
 * Provides both the default adapter and utilities for creating custom adapters.
 */

export { default } from './lib/zephyr-nextjs-adapter'
export { createZephyrAdapter } from './lib/adapter-factory'
export * from './lib/types'
export * from './lib/utils'