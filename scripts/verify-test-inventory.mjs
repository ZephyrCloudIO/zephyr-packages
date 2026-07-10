import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const testPattern = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const ignoredDirectories = new Set(['node_modules', 'dist', 'coverage', 'tmp']);
const errors = [];

function walk(directory, predicate) {
  const matches = [];
  if (!fs.existsSync(directory)) return matches;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...walk(absolutePath, predicate));
    } else if (predicate(absolutePath)) {
      matches.push(absolutePath);
    }
  }

  return matches;
}

function nearestPackage(testFile) {
  let directory = path.dirname(testFile);
  while (directory.startsWith(workspaceRoot)) {
    const packageFile = path.join(directory, 'package.json');
    if (fs.existsSync(packageFile)) return packageFile;
    if (directory === workspaceRoot) break;
    directory = path.dirname(directory);
  }
  return undefined;
}

const roots = ['libs', 'examples', 'e2e', 'scripts'].map((directory) =>
  path.join(workspaceRoot, directory)
);
const testFiles = roots.flatMap((root) => walk(root, (file) => testPattern.test(file)));
const testsByPackage = new Map();

for (const testFile of testFiles) {
  const source = fs.readFileSync(testFile, 'utf8');
  const relativePath = path.relative(workspaceRoot, testFile);

  if (!/from ['"]@rstest\/core['"]/.test(source)) {
    errors.push(`${relativePath}: test APIs must be imported from @rstest/core`);
  }
  if (/@jest\/globals|\bjest\.|\b(?:xit|xtest|fdescribe|fit)\s*\(/.test(source)) {
    errors.push(`${relativePath}: legacy Jest API found`);
  }

  const packageFile = nearestPackage(testFile);
  if (!packageFile) {
    errors.push(`${relativePath}: no owning package.json found`);
    continue;
  }

  const packageTests = testsByPackage.get(packageFile) ?? [];
  packageTests.push(testFile);
  testsByPackage.set(packageFile, packageTests);
}

const rootConfig = fs.readFileSync(path.join(workspaceRoot, 'rstest.config.mts'), 'utf8');
const e2eConfig = fs.readFileSync(
  path.join(workspaceRoot, 'e2e/deployment/rstest.config.mts'),
  'utf8'
);
const discoveryPattern = '**/*.{test,spec}.?(c|m)[jt]s?(x)';
const configuredProjects = new Set(
  [...rootConfig.matchAll(/project\(\s*['"]([^'"]+)['"]/g)].map(([, projectName]) => projectName)
);

if (!rootConfig.includes(discoveryPattern)) {
  errors.push('rstest.config.mts: root discovery must include test and spec files');
}
if (!e2eConfig.includes(discoveryPattern)) {
  errors.push('e2e/deployment/rstest.config.mts: E2E discovery must include test and spec files');
}
if (!e2eConfig.includes('root: import.meta.dirname')) {
  errors.push(
    'e2e/deployment/rstest.config.mts: E2E root must be anchored to its config directory'
  );
}
const packageFiles = [
  path.join(workspaceRoot, 'package.json'),
  ...roots.flatMap((root) => walk(root, (file) => path.basename(file) === 'package.json')),
];

for (const packageFile of packageFiles) {
  const packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  const packageTests = testsByPackage.get(packageFile) ?? [];
  const testCommand = packageJson.scripts?.test ?? packageJson.scripts?.['e2e-test'];
  const packageTestScripts = Object.entries(packageJson.scripts ?? {}).filter(([name]) =>
    /(?:^test$|^test:|e2e-test$)/.test(name)
  );

  for (const [scriptName, command] of packageTestScripts) {
    if (/passWithNoTests|@nx\/jest|jest\.config/.test(String(command))) {
      errors.push(
        `${path.relative(workspaceRoot, packageFile)}:${scriptName}: fail-open/Jest configuration found`
      );
    }
  }

  if (packageTests.length > 0 && typeof testCommand !== 'string') {
    errors.push(
      `${path.relative(workspaceRoot, packageFile)}: ${packageTests.length} test file(s) but no Rstest script`
    );
  }

  if (typeof testCommand === 'string') {
    if (!testCommand.includes('rstest')) {
      errors.push(
        `${path.relative(workspaceRoot, packageFile)}: primary test script does not run Rstest`
      );
    }
    if (packageTests.length === 0) {
      errors.push(
        `${path.relative(workspaceRoot, packageFile)}: primary test script has no discoverable tests`
      );
    }

    const selectedProject = testCommand.match(/--project\s+([^\s]+)/)?.[1];
    if (selectedProject && !configuredProjects.has(selectedProject)) {
      errors.push(
        `${path.relative(workspaceRoot, packageFile)}: ${selectedProject} is absent from rstest.config.mts`
      );
    }
  }
}

const workflowRoot = path.join(workspaceRoot, '.github', 'workflows');
const workflowFiles = walk(workflowRoot, (file) => /\.ya?ml$/.test(file));
for (const workflowFile of workflowFiles) {
  if (/passWithNoTests/.test(fs.readFileSync(workflowFile, 'utf8'))) {
    errors.push(
      `${path.relative(workspaceRoot, workflowFile)}: fail-open passWithNoTests flag found`
    );
  }
}

const legacyConfigs = [workspaceRoot, ...roots].flatMap((root) =>
  walk(root, (file) => /^jest\.(?:config|preset)\.[cm]?[jt]s$/.test(path.basename(file)))
);
for (const config of legacyConfigs) {
  errors.push(`${path.relative(workspaceRoot, config)}: legacy Jest configuration found`);
}

if (errors.length > 0) {
  console.error(`Test inventory failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Test inventory verified: ${testFiles.length} files across ${testsByPackage.size} packages.`
  );
}
