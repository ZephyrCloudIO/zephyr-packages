/**
 * Zephyr Runtime Plugin for Module Federation.
 *
 * Vite uses a virtual runtime plugin module serialized into remoteEntry.js by
 * @module-federation/vite. Reuse the shared implementation from zephyr-agent.
 */

import zephyrAgentModule from 'zephyr-agent';

const { createZephyrRuntimePlugin } = zephyrAgentModule;

export default function () {
  return createZephyrRuntimePlugin();
}
