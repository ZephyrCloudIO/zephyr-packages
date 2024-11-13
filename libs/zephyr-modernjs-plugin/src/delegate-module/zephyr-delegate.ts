import {
  createApplicationUID,
  getToken,
  ZE_API_ENDPOINT,
  ze_api_gateway,
  ZeErrors,
  ZephyrError,
  ZephyrPluginOptions,
  ZeUtils,
} from 'zephyr-edge-contract';
import { DelegateConfig } from '../lib/dependency-resolution/replace-remotes-with-delegates';

declare const __webpack_require__: {
  l: (url: string, fn: () => void, name: string, name2: string) => void;
};

// todo: in order to become federation impl agnostic, we should parse and provide
// already processed federation config instead of mfConfig

async function resolve_remote_dependency({
  application_uid,
  version,
}: {
  application_uid: string;
  version: string;
}): Promise<ResolvedDependency> {
  const resolveDependency = new URL(
    `${ze_api_gateway.resolve}/${encodeURIComponent(application_uid)}/${encodeURIComponent(version)}`,
    ZE_API_ENDPOINT()
  );

  const [appName, projectName, orgName] = application_uid.split('.');

  try {
    const token = await getToken();

    const res = await fetch(resolveDependency, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new ZephyrError(ZeErrors.ERR_RESOLVE_REMOTES, {
        appUid: application_uid,
        appName,
        projectName,
        orgName,
        data: {
          url: resolveDependency.toString(),
          version,
          error: await res.json().catch(() => res.text()),
        },
      });
    }

    const response = await res.json();

    if (response.value) {
      return response.value;
    }

    throw new ZephyrError(ZeErrors.ERR_RESOLVE_REMOTES, {
      appUid: application_uid,
      appName,
      projectName,
      orgName,
      data: { version, response },
    });
  } catch (cause) {
    throw new ZephyrError(ZeErrors.ERR_CANNOT_RESOLVE_APP_NAME_WITH_VERSION, {
      data: { version },
      cause,
    });
  }
}

export async function replace_remote_in_mf_config(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mfConfig: ZephyrPluginOptions['mfConfig'],
  config: DelegateConfig
): Promise<unknown> {
  if (!mfConfig?.remotes) {
    return;
  }

  // Replace remotes with delegate function
  return Promise.all(
    Object.keys(mfConfig.remotes ?? {}).map(async (key) => {
      const [app_name, project_name, org_name] = key.split('.', 3);

      // Key might be only the app name
      const application_uid = createApplicationUID({
        org: org_name ?? config.org,
        project: project_name ?? config.project,
        name: app_name,
      });
      // if default url is url - set as default, if not use app remote_host as default
      // if default url is not url - send it as a semver to deps resolution
      const [ok, error, resolvedDependency] = await ZeUtils.PromiseTuple(
        resolve_remote_dependency({
          application_uid: application_uid,
          version: mfConfig.remotes![key],
        })
      );

      // If couldn't resolve remote dependency, skip replacing it
      if (!ok || error) {
        return;
      }

      const [v_app] = mfConfig.remotes![key]?.split('@') ?? [];

      if (v_app) {
        resolvedDependency.remote_entry_url = [
          v_app,
          resolvedDependency.remote_entry_url,
        ].join('@');
      }

      resolvedDependency.remote_name = key;
      mfConfig.remotes![key] = replace_remote_with_delegate(resolvedDependency);
    })
  );
}

interface ResolvedDependency {
  remote_name: string;
  default_url: string;
  application_uid: string;
  remote_entry_url: string;
  library_type: string;
}

export function replace_remote_with_delegate(deps: ResolvedDependency): string {
  // prepare delegate function string template
  const fnReplace = delegate_module_template.toString();
  const strStart = new RegExp(/^function[\W\S]+return new Promise/);
  const strNewStart = `promise new Promise`;
  const strEnd = new RegExp(/;[^)}]+}$/);
  const promiseNewPromise = fnReplace.replace(strStart, strNewStart).replace(strEnd, '');

  const { application_uid, remote_entry_url, default_url, remote_name, library_type } =
    deps;

  return promiseNewPromise
    .replace('__APPLICATION_UID__', application_uid)
    .replace('__REMOTE_ENTRY_URL__', remote_entry_url)
    .replace('__REMOTE_NAME__', remote_name)
    .replace('__DEFAULT_URL__', default_url)
    .replace('__LIBRARY_TYPE__', library_type);
}

function delegate_module_template(): unknown {
  return new Promise((resolve, reject) => {
    const remote_entry_url = '__REMOTE_ENTRY_URL__';
    const library_type = '__LIBRARY_TYPE__';
    const _window = typeof window !== 'undefined' ? window : globalThis;
    const sessionEdgeURL = _window.sessionStorage?.getItem('__APPLICATION_UID__');
    let edgeUrl = sessionEdgeURL ?? remote_entry_url;
    let remote_name = '__REMOTE_NAME__';

    if (edgeUrl.indexOf('@') !== -1) {
      [remote_name, edgeUrl] = edgeUrl.split('@') as [string, string];
    }

    const resolve_entry = [
      fetch(edgeUrl, { method: 'HEAD' })
        .then(() => edgeUrl)
        .catch(() => false),
    ];

    Promise.race(resolve_entry)
      .then((remoteUrl) => {
        if (typeof remoteUrl !== 'string') return;
        const _win = _window as unknown as Record<string, unknown>;

        if (typeof _win[remote_name] !== 'undefined') {
          return resolve(_win[remote_name]);
        }

        if (
          typeof __webpack_require__ !== 'undefined' &&
          typeof __webpack_require__.l === 'function' &&
          // @ts-expect-error - library_type is inherited enum type instead of string
          library_type !== 'module'
        ) {
          __webpack_require__.l(
            remoteUrl,
            () => {
              resolve(_win[remote_name]);
            },
            remote_name,
            remote_name
          );
          return;
        }

        return new Function(`return import("${remoteUrl}")`)()
          .then((mod: unknown) => {
            if (typeof _win[remote_name] !== 'undefined') {
              return resolve(_win[remote_name]);
            }

            return resolve(mod);
          })
          .catch((err: unknown) => reject(err));
      })
      .catch((err) => {
        console.error(`Zephyr: error loading remote entry ${remote_entry_url}`, err);
      });
  });
}
