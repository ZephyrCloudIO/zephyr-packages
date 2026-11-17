import type { ZephyrBuildTarget } from 'zephyr-edge-contract';
import { isLabelSelector } from '../lib/build-context/ze-util-is-label-selector';
import { parseZeDependency } from '../lib/build-context/ze-util-parse-ze-dependencies';
import type { ZeResolvedDependency } from './resolve_remote_dependency';

/**
 * Describes a label selector (tag/environment name) that the resolver answered with a
 * different entity, e.g. the app's default environment when no `DEMO` tag or environment
 * exists. Returns `undefined` when the selector is not a label, the label matched, or the
 * resolver is too old to report what it matched (no `entity_name`).
 */
export function describeLabelFallback(params: {
  dependency: string;
  selector: string;
  target: ZephyrBuildTarget;
  resolved: Pick<ZeResolvedDependency, 'entity_type' | 'entity_name'>;
}): string | undefined {
  const { dependency, selector, target, resolved } = params;
  // Selectors may still carry the `zephyr:app@label` prefix; the resolver strips it too.
  const label = parseZeDependency(dependency, selector).version;
  if (!isLabelSelector(label)) return undefined;
  if (!resolved.entity_name || resolved.entity_name === label) return undefined;

  const matched = `${resolved.entity_type ?? 'entity'} "${resolved.entity_name}"`;
  return (
    `Remote dependency "${dependency}" requested "${label}" for target "${target}", ` +
    `but no tag or environment named "${label}" matched; it resolved to ${matched} instead. ` +
    `This build uses that ${resolved.entity_type ?? 'entity'}'s URL. ` +
    `Create the "${label}" tag or environment for "${target}" and rebuild, or fix the selector.`
  );
}
