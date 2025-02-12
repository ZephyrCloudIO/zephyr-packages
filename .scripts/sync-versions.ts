import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

type VersionType = 'patch' | 'minor' | 'major';

function getCurrentVersion(): string {
  // Get version from any lib as they're all synced
  const libsDir = path.join(__dirname, '../libs');
  const firstLib = fs.readdirSync(libsDir)[0];
  const pkgPath = path.join(libsDir, firstLib, 'package.json');
  const pkg = require(pkgPath);
  return pkg.version;
}

function commitChanges(version: string) {
  try {
    execSync('git add **/package.json', { stdio: 'inherit' });
    execSync(`git commit -m "deps: bump packages to ${version}"`, { stdio: 'inherit' });
    console.log(`\nCommitted version bump to ${version}`);
  } catch (error) {
    console.error('Failed to commit changes:', error);
    process.exit(1);
  }
}

function bumpVersions(type: VersionType) {
  const libsDir = path.join(__dirname, '../libs');
  const libs = fs.readdirSync(libsDir);

  // Execute version bump for each library
  libs.forEach((lib) => {
    const pkgPath = path.join(libsDir, lib, 'package.json');
    if (fs.existsSync(pkgPath)) {
      console.log(`Bumping ${type} version for ${lib}...`);
      execSync(`pnpm version ${type}`, {
        cwd: path.join(libsDir, lib),
        stdio: 'inherit',
      });
    }
  });

  // Sync workspace dependencies after version bumps
  syncDependencies();

  // Commit changes
  const newVersion = getCurrentVersion();
  commitChanges(newVersion);
}

function syncDependencies() {
  const libsDir = path.join(__dirname, '../libs');
  const libs = fs.readdirSync(libsDir);

  libs.forEach((lib) => {
    const pkgPath = path.join(libsDir, lib, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = require(pkgPath);
      let updated = false;

      // Update workspace dependencies
      if (pkg.dependencies) {
        Object.keys(pkg.dependencies).forEach((dep) => {
          if (pkg.dependencies[dep] === 'workspace:*') {
            // Find the referenced package's new version
            const depPath = path.join(libsDir, dep, 'package.json');
            if (fs.existsSync(depPath)) {
              const depPkg = require(depPath);
              pkg.dependencies[dep] = `workspace:^${depPkg.version}`;
              updated = true;
            }
          }
        });
      }

      // Write back if changes were made
      if (updated) {
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
      }
    }
  });
}

const versionType = process.argv[2] as VersionType;
if (!versionType || !['patch', 'minor', 'major'].includes(versionType)) {
  console.error('Please specify version type: patch, minor, or major');
  process.exit(1);
}

bumpVersions(versionType);
