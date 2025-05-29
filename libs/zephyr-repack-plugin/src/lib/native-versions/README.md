roposal: Native Dependency Change Detection & Version Enforcement

Based on your current implementation, here's a comprehensive approach to enforce native version updates when dependencies
change:

1. Dependency Hash Tracking

Add dependency hash tracking to your zephyr-repack-plugin:

// In ze-util-native-versions.ts - new function
export async function getDependencyHashes(projectRoot: string, platform: NativePlatform): Promise<{
lockfileHash: string;
nativeConfigHash: string;
}> {
const hashes: any = {};

    if (platform === 'ios') {
      // Hash Podfile.lock
      const podfileLockPath = path.join(projectRoot, 'ios', 'Podfile.lock');
      if (fs.existsSync(podfileLockPath)) {
        const content = fs.readFileSync(podfileLockPath, 'utf8');
        hashes.lockfileHash = crypto.createHash('sha256').update(content).digest('hex');
      }

      // Hash Podfile for configuration changes
      const podfilePath = path.join(projectRoot, 'ios', 'Podfile');
      if (fs.existsSync(podfilePath)) {
        const content = fs.readFileSync(podfilePath, 'utf8');
        hashes.nativeConfigHash = crypto.createHash('sha256').update(content).digest('hex');
      }
    }

    if (platform === 'android') {
      // Hash build.gradle files
      const buildGradlePath = path.join(projectRoot, 'android', 'app', 'build.gradle');
      if (fs.existsSync(buildGradlePath)) {
        const content = fs.readFileSync(buildGradlePath, 'utf8');
        hashes.lockfileHash = crypto.createHash('sha256').update(content).digest('hex');
      }
    }

    return hashes;

}

2. Version Enforcement Strategy

Create a new service in builder-packages-api:

// dependency-version-enforcement.service.ts
@Injectable()
export class DependencyVersionEnforcementService {

    async checkAndEnforceNativeVersion(
      applicationUid: string,
      platform: string,
      currentHashes: { lockfileHash: string; nativeConfigHash: string },
      currentNativeVersion: string
    ): Promise<{
      shouldIncrementVersion: boolean;
      suggestedVersion: string;
      reason: 'major' | 'minor' | 'patch' | 'none';
    }> {

      // Get last known hashes from database
      const lastBuild = await this.db.applicationVersion.findFirst({
        where: {
          application_uid: applicationUid,
          platform: platform,
          status: 'deployed'
        },
        orderBy: { created_at: 'desc' },
        select: {
          native_version: true,
          dependency_lockfile_hash: true,
          native_config_hash: true
        }
      });

      if (!lastBuild) {
        return { shouldIncrementVersion: false, suggestedVersion: currentNativeVersion, reason: 'none' };
      }

      const lockfileChanged = lastBuild.dependency_lockfile_hash !== currentHashes.lockfileHash;
      const configChanged = lastBuild.native_config_hash !== currentHashes.nativeConfigHash;

      if (lockfileChanged || configChanged) {
        const incrementType = this.determineIncrementType(lastBuild, currentHashes);
        const suggestedVersion = this.incrementVersion(lastBuild.native_version, incrementType);

        return {
          shouldIncrementVersion: true,
          suggestedVersion,
          reason: incrementType
        };
      }

      return { shouldIncrementVersion: false, suggestedVersion: currentNativeVersion, reason: 'none' };
    }

    private determineIncrementType(
      lastBuild: any,
      currentHashes: any
    ): 'major' | 'minor' | 'patch' {
      // You can implement more sophisticated logic here
      // For now, any dependency change = minor bump
      return 'minor';
    }

    private incrementVersion(version: string, type: 'major' | 'minor' | 'patch'): string {
      const parts = version.split('.').map(Number);

      switch (type) {
        case 'major':
          return `${parts[0] + 1}.0.0`;
        case 'minor':
          return `${parts[0]}.${parts[1] + 1}.0`;
        case 'patch':
          return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
      }
    }

}

3. Integration with Build Process

Modify your with-zephyr.ts to include dependency checking:

// In \_zephyr_configuration function, after getting nativeVersionInfo
const dependencyHashes = await getDependencyHashes(
config.context || process.cwd(),
\_zephyrOptions.target
);

// Check if version needs to be incremented
const versionCheck = await zephyr_engine.checkNativeVersionRequirements(
dependencyHashes,
nativeVersionInfo.native_version
);

if (versionCheck.shouldIncrementVersion) {
throw new ZephyrError(ZeErrors.ERR_NATIVE_VERSION_OUTDATED, {
current_version: nativeVersionInfo.native_version,
suggested_version: versionCheck.suggestedVersion,
reason: versionCheck.reason,
message: `Native dependencies changed. Please update ${_zephyrOptions.target} version from
  ${nativeVersionInfo.native_version} to ${versionCheck.suggestedVersion}`
});
}

4. Database Schema Extension

Add dependency tracking fields to your application_version table:

ALTER TABLE application_version ADD COLUMN dependency_lockfile_hash VARCHAR(64);
ALTER TABLE application_version ADD COLUMN native_config_hash VARCHAR(64);
ALTER TABLE application_version ADD COLUMN dependency_change_reason VARCHAR(20);

5. CLI Integration & User Experience

Create a helper command in your CLI tools:

// In zephyr CLI
export async function updateNativeVersion(options: {
platform: 'ios' | 'android';
incrementType?: 'major' | 'minor' | 'patch';
auto?: boolean;
}) {
const projectRoot = process.cwd();
const currentVersion = await getNativeVersionInfoAsync(options.platform, projectRoot);
const dependencyHashes = await getDependencyHashes(projectRoot, options.platform);

    // Check with server what version should be used
    const versionCheck = await api.checkNativeVersionRequirements({
      platform: options.platform,
      currentVersion: currentVersion.native_version,
      dependencyHashes
    });

    if (versionCheck.shouldIncrementVersion) {
      if (options.auto) {
        await updateNativeVersionFiles(options.platform, versionCheck.suggestedVersion);
        console.log(`✅ Updated ${options.platform} version to ${versionCheck.suggestedVersion}`);
      } else {
        console.log(`⚠️  Native dependencies changed. Update required:`);
        console.log(`   Current: ${currentVersion.native_version}`);
        console.log(`   Suggested: ${versionCheck.suggestedVersion}`);
        console.log(`   Reason: ${versionCheck.reason} - ${versionCheck.reason}`);
        console.log(`\nRun: zephyr update-native-version --auto`);
      }
    }

}

6. CI/CD Integration

Add a pre-build check in your CI pipeline:

# In GitHub Actions or similar

- name: Check Native Version Requirements
  run: |
  npx zephyr check-native-version --platform=ios
  npx zephyr check-native-version --platform=android

Implementation Priority:

1. Phase 1: Add dependency hash generation to your plugin
2. Phase 2: Implement version checking service in builder-packages-api
3. Phase 3: Add CLI commands for manual version updates
4. Phase 4: Integrate automatic enforcement in build process
5. Phase 5: Add CI/CD automation

This approach gives you:

- Automatic detection of native dependency changes
- Flexible versioning strategy (configurable increment rules)
- Developer-friendly warnings and suggestions
- CI/CD integration for automated enforcement
- Backward compatibility with existing projects
