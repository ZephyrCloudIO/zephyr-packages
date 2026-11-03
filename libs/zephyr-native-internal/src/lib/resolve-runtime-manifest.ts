import {
  applyTargetPlaceholder,
  assertZephyrBuildTarget,
  create_dependency_build_context,
  logFn,
  parseZeDependency,
  resolve_remote_dependency,
  ZEPHYR_MANIFEST_FILENAME,
  ZeErrors,
  ZephyrError,
  type ZephyrEngine,
} from 'zephyr-agent';
import { createApplicationUid } from 'zephyr-edge-contract';

type RuntimeManifestEngine = Pick<
  ZephyrEngine,
  | 'application_uid'
  | 'application_configuration'
  | 'env'
  | 'gitProperties'
  | 'zephyrConfig'
>;

/**
 * Resolves a `runtimeManifest` selector to the `zephyr-manifest.json` URL of a tag or
 * environment alias. The selector uses `zephyr:dependencies` syntax: `@label` selects the
 * building application's label, `app@label` another application's, and `${target}` is
 * replaced with the build target. Selector URLs are always requested, whatever
 * `dependencyUrlMode` says: a version URL would freeze what the runtime reads.
 */
export async function resolveRuntimeManifestUrl(
  engine: RuntimeManifestEngine,
  selector: string
): Promise<string> {
  const platform = engine.env.target ?? 'web';
  assertZephyrBuildTarget(platform, 'ZephyrEngine.env.target');
  const { app_uid, version } = parseZeDependency('', selector);
  const label = applyTargetPlaceholder(version, platform);
  const invalid = (reason: string) =>
    new ZephyrError(ZeErrors.ERR_ZEPHYR_CONFIG_NOT_VALID, {
      message: `runtimeManifest "${selector}" ${reason}`,
    });
  if (!label) throw invalid('must name a tag or environment, e.g. "@production"');

  let application_uid = engine.application_uid;
  if (app_uid) {
    const [name, project, org] = app_uid.split('.', 3);
    application_uid = createApplicationUid({
      org: org ?? engine.gitProperties.app.org,
      project: project ?? engine.gitProperties.app.project,
      name,
    });
  }

  const resolved = await resolve_remote_dependency({
    application_uid,
    version: label,
    platform,
    build_context: await create_dependency_build_context(engine, platform),
    dependencyUrlMode: 'selector',
  });

  if (resolved.entity_type === 'version') {
    throw invalid(
      `resolved to a version of ${application_uid}; select a tag or environment`
    );
  }
  if (typeof resolved.entity_name === 'string' && resolved.entity_name !== label) {
    throw invalid(
      `resolved to ${resolved.entity_type ?? 'label'} "${resolved.entity_name}" of ${application_uid}; no ${platform} tag or environment is named "${label}"`
    );
  }
  if (
    typeof resolved.resolved_platform === 'string' &&
    resolved.resolved_platform !== platform
  ) {
    throw invalid(
      `resolved to a ${resolved.resolved_platform} deployment of ${application_uid}; use a ${platform} tag or environment, e.g. "@${version}-\${target}"`
    );
  }
  if (!resolved.default_url) {
    throw invalid(`resolved to "${label}" of ${application_uid}, which has no URL`);
  }
  if (
    resolved.entity_type === undefined ||
    resolved.entity_name === undefined ||
    resolved.resolved_platform === undefined
  ) {
    logFn(
      'warn',
      `runtimeManifest "${selector}": the Zephyr API did not report the matched label and platform; check that "${label}" is a ${platform} tag or environment of ${application_uid}`
    );
  }
  if (engine.zephyrConfig.dependencyUrlMode === 'version') {
    logFn(
      'warn',
      'runtimeManifest with dependencyUrlMode "version": the manifest lists pinned version URLs, so only dashboard remote overrides change the loaded remotes'
    );
  }

  const base = resolved.default_url.endsWith('/')
    ? resolved.default_url
    : `${resolved.default_url}/`;
  const url = new URL(ZEPHYR_MANIFEST_FILENAME, base).toString();
  logFn('info', `Runtime manifest: ${url}`);
  return url;
}
