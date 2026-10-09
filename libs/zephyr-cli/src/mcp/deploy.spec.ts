import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import * as actualAgent from 'zephyr-agent' with { rstest: 'importActual' };
import type { ZeBuildAssetsMap } from 'zephyr-edge-contract';
import { deployCommand } from '../commands/deploy';
import {
  contractFixtures,
  makeTemporaryDirectory,
  materializeFixture,
  readContractJson,
  removeTemporaryDirectories,
  writeFile,
} from './__fixtures__/materialize';
import { assertNotMcpOutput } from './deploy';

const mocks = rs.hoisted(() => ({
  create: rs.fn(),
  uploadAssets: rs.fn(),
  extractAssetsFromDirectory: rs.fn(),
  logFn: rs.fn(),
}));

rs.mock('zephyr-agent', () => ({
  ...actualAgent,
  ZephyrEngine: { create: mocks.create },
  logFn: mocks.logFn,
}));
rs.mock('../lib/upload', () => ({ uploadAssets: mocks.uploadAssets }));
rs.mock('../lib/extract-assets', () => ({
  extractAssetsFromDirectory: mocks.extractAssetsFromDirectory,
}));

const temporaryDirectories: string[] = [];
const engine = {
  applicationProperties: { name: 'skills-basic' },
  hasActiveBuild: true,
  build_failed: rs.fn(),
};

function uploadedPaths(): string[] {
  const assetsMap = mocks.uploadAssets.mock.calls[0]?.[0]?.assetsMap as ZeBuildAssetsMap;
  return Object.values(assetsMap)
    .map((asset) => asset.path)
    .sort();
}

beforeEach(() => {
  rs.clearAllMocks();
  rs.spyOn(console, 'error').mockImplementation(() => undefined);
  mocks.create.mockResolvedValue(engine);
  mocks.uploadAssets.mockResolvedValue(undefined);
  mocks.extractAssetsFromDirectory.mockResolvedValue({});
});

afterEach(async () => {
  rs.restoreAllMocks();
  await removeTemporaryDirectories(temporaryDirectories);
});

describe('ze-cli deploy for MCP providers', () => {
  it('builds a skills repo in memory with an isolated identity and uploads only served files', async () => {
    const dir = await materializeFixture(
      'repos/skills-basic',
      'skills-basic',
      temporaryDirectories
    );

    await deployCommand({
      directory: dir,
      cwd: contractFixtures,
      evalResultsPath: 'eval-results.json',
    });

    expect(mocks.create).toHaveBeenCalledWith({
      builder: 'unknown',
      context: dir,
      identity: { fromGitProject: true, isolated: true },
    });
    expect(mocks.extractAssetsFromDirectory).not.toHaveBeenCalled();
    expect(uploadedPaths()).toEqual([
      'catalog.json',
      'mcp-provider.json',
      'skills/quote-a-deal/SKILL.md',
      'skills/quote-a-deal/assets/logo.bin',
      'skills/quote-a-deal/references/Zebra.md',
      'skills/quote-a-deal/references/apple.md',
      'skills/quote-a-deal/references/price-book.md',
      'skills/quote-a-deal/scripts/check.ts',
      'skills/release-a-frontend/SKILL.md',
    ]);
    const props = mocks.uploadAssets.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(props['mcpEvalResults']).toEqual(readContractJson('eval-results.json'));

    const assetsMap = props['assetsMap'] as ZeBuildAssetsMap;
    const descriptor = Object.values(assetsMap).find(
      (asset) => asset.path === 'mcp-provider.json'
    );
    expect(JSON.parse(String(descriptor?.buffer))).toMatchObject({
      name: 'skills-basic',
      generator: { name: 'zephyr-cli' },
    });
  });

  it('uploads exactly the artifact set from a provider artifact with fail-on-error reads', async () => {
    const dir = await materializeFixture(
      'artifacts/tools-basic',
      'dist',
      temporaryDirectories
    );
    await writeFile(dir, 'stats.json', '{}');

    await deployCommand({ directory: dir, cwd: dir });

    expect(mocks.create).toHaveBeenCalledWith({ builder: 'unknown', context: dir });
    expect(uploadedPaths()).toHaveLength(10);
    expect(uploadedPaths()).not.toContain('stats.json');
    expect(mocks.logFn).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('stats.json')
    );
  });

  it('attaches eval results to a provider artifact deploy', async () => {
    const dir = await materializeFixture(
      'artifacts/tools-basic',
      'dist',
      temporaryDirectories
    );

    await deployCommand({
      directory: dir,
      cwd: contractFixtures,
      evalResultsPath: 'eval-results.json',
    });

    const props = mocks.uploadAssets.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(props['mcpEvalResults']).toEqual(readContractJson('eval-results.json'));
  });

  it('fails the build when the artifact named by the engine does not pass its checks', async () => {
    const dir = await materializeFixture(
      'repos/skills-basic',
      'skills-basic',
      temporaryDirectories
    );
    mocks.create.mockResolvedValueOnce({
      ...engine,
      applicationProperties: { name: 'Not A Skill Name' },
    });

    await expect(deployCommand({ directory: dir, cwd: dir })).rejects.toThrow(
      'MCP provider checks failed'
    );
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('ZD0740'));
    expect(engine.build_failed).toHaveBeenCalledTimes(1);
    expect(mocks.uploadAssets).not.toHaveBeenCalled();
  });

  it('aborts on findings before ZephyrEngine.create', async () => {
    const dir = await materializeFixture(
      'repos/skills-broken',
      'skills-broken',
      temporaryDirectories
    );

    await expect(deployCommand({ directory: dir, cwd: dir })).rejects.toThrow(
      'MCP provider checks failed'
    );
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.uploadAssets).not.toHaveBeenCalled();
  });

  it('validates eval results before ZephyrEngine.create', async () => {
    const dir = await materializeFixture(
      'repos/skills-basic',
      'skills-basic',
      temporaryDirectories
    );

    await expect(
      deployCommand({
        directory: dir,
        cwd: contractFixtures,
        evalResultsPath: 'eval-results-invalid-totals.json',
      })
    ).rejects.toThrow('Invalid --eval-results');
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ target: 'tap-app' as const }, '--target tap-app'],
    [{ metadataPath: 'meta.json' }, '--metadata'],
    [{ ssr: true }, '--ssr'],
  ])('rejects unsupported option %o', async (option, message) => {
    const dir = await materializeFixture(
      'repos/skills-basic',
      'skills-basic',
      temporaryDirectories
    );

    await expect(deployCommand({ directory: dir, cwd: dir, ...option })).rejects.toThrow(
      message
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('accepts --target web', async () => {
    const dir = await materializeFixture(
      'repos/skills-basic',
      'skills-basic',
      temporaryDirectories
    );
    await deployCommand({ directory: dir, cwd: dir, target: 'web' });
    expect(mocks.uploadAssets).toHaveBeenCalledTimes(1);
  });

  it('validates the in-memory artifact before ZephyrEngine.create', async () => {
    const dir = await makeTemporaryDirectory('big-catalog', temporaryDirectories);
    // Loose frontmatter keys are preserved in the catalog, so one huge key passes every
    // skill rule but pushes catalog.json over its 524,288-byte limit.
    await writeFile(
      dir,
      'skills/big/SKILL.md',
      [
        '---',
        'name: big',
        'description: A skill with a very large frontmatter value.',
        `x-notes: ${'n'.repeat(600_000)}`,
        'metadata:',
        '  owner: platform',
        '  contact: platform@example.com',
        '---',
        '# Big',
        '',
      ].join('\n')
    );

    await expect(deployCommand({ directory: dir, cwd: dir })).rejects.toThrow(
      'MCP provider checks failed'
    );
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('ZD0741'));
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.uploadAssets).not.toHaveBeenCalled();
  });

  it('never falls through for tool sources: ZD0732', async () => {
    const dir = await makeTemporaryDirectory('tools', temporaryDirectories);
    await writeFile(dir, 'tools/quote_price.ts', 'export default {};');

    await expect(deployCommand({ directory: dir, cwd: dir })).rejects.toThrow(
      'ZD0732 tools:'
    );
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.extractAssetsFromDirectory).not.toHaveBeenCalled();
  });

  it('points ZD0732 at dist/mcp-provider.json for an opted-in package (amendment 13.3)', async () => {
    const dir = await makeTemporaryDirectory('tools-repo', temporaryDirectories);
    await writeFile(
      dir,
      'package.json',
      JSON.stringify({
        name: 'tools-repo',
        dependencies: { '@module-federation/mcp': '0.2.0' },
      })
    );
    await writeFile(dir, 'tools/quote_price.ts', 'export default {};');

    await expect(deployCommand({ directory: dir, cwd: dir })).rejects.toThrow(
      'ZD0732 dist/mcp-provider.json:'
    );
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.extractAssetsFromDirectory).not.toHaveBeenCalled();
  });

  it('warns that a legacy skills/ folder is public and rejects --eval-results there', async () => {
    const dir = await makeTemporaryDirectory('web-app', temporaryDirectories);
    await writeFile(dir, 'package.json', JSON.stringify({ name: 'web-app' }));
    await writeFile(dir, 'skills/a/SKILL.md', '---\nname: a\n---\n');

    await expect(
      deployCommand({ directory: dir, cwd: dir, evalResultsPath: 'x.json' })
    ).rejects.toThrow('--eval-results is only supported');

    await deployCommand({ directory: dir, cwd: dir });
    expect(mocks.logFn).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('will be published publicly')
    );
    expect(mocks.extractAssetsFromDirectory).toHaveBeenCalledTimes(1);
  });

  it('takes the private MCP path for any zephyr.config that resolves to mcp: true', async () => {
    const dir = await makeTemporaryDirectory('team-skills', temporaryDirectories);
    await writeFile(dir, 'package.json', JSON.stringify({ name: 'team-skills' }));
    await writeFile(
      dir,
      'zephyr.config.ts',
      "const shared = { mcp: Boolean('on') };\nexport default { ...shared };\n"
    );
    await writeFile(
      dir,
      'skills/a/SKILL.md',
      '---\nname: a\ndescription: Does a.\nmetadata:\n  owner: team\n  contact: team@example.com\n---\n# a\n'
    );
    mocks.create.mockResolvedValueOnce({
      ...engine,
      applicationProperties: { name: 'team-skills' },
    });

    await deployCommand({ directory: dir, cwd: dir });

    expect(mocks.extractAssetsFromDirectory).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ identity: { fromGitProject: true, isolated: true } })
    );
    expect(uploadedPaths()).toEqual([
      'catalog.json',
      'mcp-provider.json',
      'skills/a/SKILL.md',
    ]);
    expect(mocks.logFn).not.toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('will be published publicly')
    );
  });
});

describe('run and watch refuse MCP providers', () => {
  it('fails for an MCP-classified output and passes ordinary output', async () => {
    const skills = await materializeFixture(
      'repos/skills-basic',
      'skills-basic',
      temporaryDirectories
    );
    await expect(assertNotMcpOutput(skills, 'run')).rejects.toThrow('use ze-cli deploy');

    const artifact = await materializeFixture(
      'artifacts/tools-basic',
      'dist',
      temporaryDirectories
    );
    await expect(assertNotMcpOutput(artifact, 'watch')).rejects.toThrow(
      'npx zephyr-cli deploy'
    );

    const web = await makeTemporaryDirectory('web', temporaryDirectories);
    await writeFile(web, 'index.html', '<html></html>');
    await expect(assertNotMcpOutput(web, 'run')).resolves.toBeUndefined();
    expect(mocks.logFn).not.toHaveBeenCalled();
  });

  it('warns that a legacy skills/ folder in the output will be public', async () => {
    const web = await makeTemporaryDirectory('web', temporaryDirectories);
    await writeFile(web, 'package.json', JSON.stringify({ name: 'web' }));
    await writeFile(web, 'skills/a/SKILL.md', '---\nname: a\n---\n');

    await expect(assertNotMcpOutput(web, 'watch')).resolves.toBeUndefined();
    expect(mocks.logFn).toHaveBeenCalledWith(
      'warn',
      expect.stringContaining('will be published publicly')
    );
  });
});
