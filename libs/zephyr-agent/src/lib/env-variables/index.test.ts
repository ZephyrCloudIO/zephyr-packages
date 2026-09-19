import { describe, expect, it } from '@rstest/core';
import { buildEnvImportMap } from './index';

describe('buildEnvImportMap', () => {
  it('maps the host env module to a document-relative manifest', () => {
    // Relative values in an inline import map resolve against the document base URL, so
    // this honours a `<base href>` when the artifact is re-served under a subpath. A
    // leading `/` would ignore it and request the manifest from the origin root.
    const imports = buildEnvImportMap('host-app', []);

    expect(imports['env:vars:host-app']).toBe('./zephyr-manifest.json');
  });

  it('maps each remote to the manifest at its own origin', () => {
    const imports = buildEnvImportMap('host-app', [
      {
        name: 'footer',
        application_uid: 'footer.acme',
        remote_entry_url: 'https://footer.example.test/remoteEntry.js',
      },
    ]);

    expect(imports['env:vars:footer.acme']).toBe(
      'https://footer.example.test/zephyr-manifest.json'
    );
  });

  it('skips remotes whose entry URL cannot be parsed', () => {
    const imports = buildEnvImportMap('host-app', [
      {
        name: 'footer',
        application_uid: 'footer.acme',
        remote_entry_url: 'not a url',
      },
    ]);

    expect(imports['env:vars:footer.acme']).toBeUndefined();
  });
});
