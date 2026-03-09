#!/usr/bin/env node

/**
 * Version Bump Script
 *
 * This script automates the process of bumping versions across the monorepo:
 *
 * 1. Checks if working directory is clean (exits if not)
 * 2. Gets current git branch and package version
 * 3. If on main/master branch, creates a new feature branch (chore/bump-version-X.X.X)
 * 4. Increments version (major/minor/patch) in root package.json and all
 *    libs/`*`/package.json files
 * 5. Stages all changes and creates a commit with conventional commit message
 * 6. Creates a git tag with the new version (vX.X.X)
 * 7. Pushes the branch and tag to origin
 * 8. If a new branch was created, opens a PR using gh CLI
 *
 * Usage: pnpm bump-patch OR node scripts/bump-patch-version.js pnpm bump-minor OR node
 * scripts/bump-patch-version.js minor pnpm bump-major OR node
 * scripts/bump-patch-version.js major
 *
 * Requirements:
 *
 * - Clean working directory
 * - Gh CLI installed and authenticated (for PR creation)
 * - Git configured with push access to origin
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/** Executes a shell command and returns the output */
function exec(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
    return result ? result.trim() : '';
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    console.error(error.message);
    process.exit(1);
  }
}

/** Gets the current git branch */
function getCurrentBranch() {
  return exec('git rev-parse --abbrev-ref HEAD', { silent: true });
}

/** Checks if the working directory is clean */
function isWorkingDirectoryClean() {
  const status = exec('git status --porcelain', { silent: true });
  return status.length === 0;
}

/** Increments version based on bump type */
function incrementVersion(version, bumpType = 'patch') {
  const [major, minor, patch] = version.split('.').map(Number);

  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

/** Updates package.json version */
function updatePackageVersion(packagePath, newVersion) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const oldVersion = packageJson.version;
  packageJson.version = newVersion;
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`Updated ${packagePath}: ${oldVersion} → ${newVersion}`);
  return oldVersion;
}

/** Gets all lib package.json paths */
function getLibPackagePaths() {
  const libsDir = path.join(__dirname, '..', 'libs');
  const dirs = fs
    .readdirSync(libsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  return dirs
    .map((dir) => path.join(libsDir, dir, 'package.json'))
    .filter((pkgPath) => fs.existsSync(pkgPath));
}

/** Main function */
function main() {
  const bumpType = process.argv[2] || 'patch';

  if (!['major', 'minor', 'patch'].includes(bumpType)) {
    console.error('❌ Invalid bump type. Use: major, minor, or patch');
    process.exit(1);
  }

  console.log(`🚀 Starting ${bumpType} version bump...`);

  // Check if working directory is clean
  if (!isWorkingDirectoryClean()) {
    console.error(
      '❌ Working directory is not clean. Please commit or stash your changes.'
    );
    process.exit(1);
  }

  const currentBranch = getCurrentBranch();
  console.log(`📍 Current branch: ${currentBranch}`);

  // Read root package.json
  const rootPackagePath = path.join(__dirname, '..', 'package.json');
  const rootPackageJson = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
  const currentVersion = rootPackageJson.version;
  const newVersion = incrementVersion(currentVersion, bumpType);

  console.log(`📦 Version bump: ${currentVersion} → ${newVersion}`);

  let branchName = currentBranch;
  let shouldCreatePR = false;

  // Create new branch if on main/master
  if (currentBranch === 'main' || currentBranch === 'master') {
    branchName = `chore/bump-version-${newVersion}`;
    console.log(`🔀 Creating new branch: ${branchName}`);
    exec(`git checkout -b ${branchName}`);
    shouldCreatePR = true;
  }

  // Update root package.json
  updatePackageVersion(rootPackagePath, newVersion);

  // Update all lib package.json files
  const libPackagePaths = getLibPackagePaths();
  console.log(`📚 Found ${libPackagePaths.length} lib packages to update`);

  libPackagePaths.forEach((pkgPath) => {
    updatePackageVersion(pkgPath, newVersion);
  });

  // Stage all changes
  console.log('📝 Staging changes...');
  exec('git add .');

  // Commit changes
  const commitMessage = `chore: bump ${bumpType} version to ${newVersion}

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>`;

  console.log('💾 Creating commit...');
  exec(`git commit -m "${commitMessage}"`);

  // Push branch
  console.log('⬆️  Pushing changes...');
  exec(`git push origin ${branchName}`);

  // Create PR if we created a new branch
  if (shouldCreatePR) {
    console.log('🔀 Creating pull request...');
    const prTitle = `chore: bump ${bumpType} version to ${newVersion}`;
    const prBody = `## Summary
• Bump ${bumpType} version from ${currentVersion} to ${newVersion}
• Update root package.json and all lib package.json files
## Test plan
- [ ] Verify all package.json files have correct version
- [ ] Verify no breaking changes

🤖 Generated with [Claude Code](https://claude.ai/code)`;

    try {
      const prUrl = exec(`gh pr create --title "${prTitle}" --body "${prBody}"`, {
        silent: true,
      });
      console.log(`✅ Pull request created: ${prUrl}`);
    } catch (error) {
      console.warn(
        '⚠️  Could not create PR automatically. You may need to install gh CLI or authenticate.'
      );
      console.log(`Please create a PR manually for branch: ${branchName}`);
    }
  }

  console.log('🎉 Version bump completed successfully!');
  console.log(`📦 New version: ${newVersion}`);
  console.log(`🌿 Branch: ${branchName}`);
}

if (require.main === module) {
  main();
}

module.exports = { main, incrementVersion };
