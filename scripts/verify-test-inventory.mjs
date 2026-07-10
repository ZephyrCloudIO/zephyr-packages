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

function nearestProject(testFile) {
  let directory = path.dirname(testFile);
  while (directory.startsWith(workspaceRoot)) {
    const projectFile = path.join(directory, 'project.json');
    if (fs.existsSync(projectFile)) return projectFile;
    if (directory === workspaceRoot) break;
    directory = path.dirname(directory);
  }
  return undefined;
}

const roots = ['libs', 'examples', 'e2e'].map((directory) =>
  path.join(workspaceRoot, directory)
);
const testFiles = roots.flatMap((root) =>
  walk(root, (file) => testPattern.test(file))
);
const testsByProject = new Map();

for (const testFile of testFiles) {
  const source = fs.readFileSync(testFile, 'utf8');
  const relativePath = path.relative(workspaceRoot, testFile);

  if (!/from ['"]@rstest\/core['"]/.test(source)) {
    errors.push(
      `${relativePath}: test APIs must be imported from @rstest/core`
    );
  }
  if (
    /@jest\/globals|\bjest\.|\b(?:xit|xtest|fdescribe|fit)\s*\(/.test(source)
  ) {
    errors.push(`${relativePath}: legacy Jest API found`);
  }

  const projectFile = nearestProject(testFile);
  if (!projectFile) {
    errors.push(`${relativePath}: no owning project.json found`);
    continue;
  }

  const projectTests = testsByProject.get(projectFile) ?? [];
  projectTests.push(testFile);
  testsByProject.set(projectFile, projectTests);
}

const rootConfig = fs.readFileSync(
  path.join(workspaceRoot, 'rstest.config.mts'),
  'utf8'
);
const e2eConfig = fs.readFileSync(
  path.join(workspaceRoot, 'e2e/deployment/rstest.config.mts'),
  'utf8'
);
const discoveryPattern = '**/*.{test,spec}.?(c|m)[jt]s?(x)';
const configuredProjects = new Set(
  [...rootConfig.matchAll(/project\(\s*['"]([^'"]+)['"]/g)].map(
    ([, projectName]) => projectName
  )
);

if (!rootConfig.includes(discoveryPattern)) {
  errors.push(
    'rstest.config.mts: root discovery must include test and spec files'
  );
}
if (!e2eConfig.includes(discoveryPattern)) {
  errors.push(
    'e2e/deployment/rstest.config.mts: E2E discovery must include test and spec files'
  );
}
if (!e2eConfig.includes('root: import.meta.dirname')) {
  errors.push(
    'e2e/deployment/rstest.config.mts: E2E root must be anchored to its config directory'
  );
}
const projectFiles = roots.flatMap((root) =>
  walk(root, (file) => path.basename(file) === 'project.json')
);

for (const projectFile of projectFiles) {
  const project = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
  const packageFile = path.join(path.dirname(projectFile), 'package.json');
  const packageJson = fs.existsSync(packageFile)
    ? JSON.parse(fs.readFileSync(packageFile, 'utf8'))
    : {};
  const testTargets = Object.entries(project.targets ?? {}).filter(([name]) =>
    /(?:^test$|test$)/.test(name)
  );
  const projectTests = testsByProject.get(projectFile) ?? [];
  const packageTestScripts = Object.entries(packageJson.scripts ?? {}).filter(
    ([name]) => /(?:^test$|^test:)/.test(name)
  );

  if (packageTestScripts.length > 0 && testTargets.length === 0) {
    errors.push(
      `${path.relative(workspaceRoot, packageFile)}: package test script creates an inferred Nx target without an explicit Rstest target`
    );
  }

  for (const [scriptName, command] of packageTestScripts) {
    if (/passWithNoTests|@nx\/jest|jest\.config/.test(String(command))) {
      errors.push(
        `${path.relative(workspaceRoot, packageFile)}:${scriptName}: fail-open/Jest configuration found`
      );
    }
  }

  if (projectTests.length > 0 && testTargets.length === 0) {
    errors.push(
      `${path.relative(workspaceRoot, projectFile)}: ${projectTests.length} test file(s) but no test target`
    );
  }

  for (const [targetName, target] of testTargets) {
    const serializedTarget = JSON.stringify(target);
    if (!serializedTarget.includes('rstest')) {
      errors.push(
        `${path.relative(workspaceRoot, projectFile)}:${targetName}: target does not run Rstest`
      );
    }
    if (/passWithNoTests|@nx\/jest|jest\.config/.test(serializedTarget)) {
      errors.push(
        `${path.relative(workspaceRoot, projectFile)}:${targetName}: fail-open/Jest configuration found`
      );
    }
    if (projectTests.length === 0) {
      errors.push(
        `${path.relative(workspaceRoot, projectFile)}:${targetName}: target has no discoverable tests`
      );
    }

    const command = target?.options?.command;
    const selectedProject =
      typeof command === 'string'
        ? command.match(/--project\s+([^\s]+)/)?.[1]
        : undefined;
    if (selectedProject && !configuredProjects.has(selectedProject)) {
      errors.push(
        `${path.relative(workspaceRoot, projectFile)}:${targetName}: ${selectedProject} is absent from rstest.config.mts`
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
  walk(root, (file) => /(^|\/)jest\.(?:config|preset)\.[cm]?[jt]s$/.test(file))
);
for (const config of legacyConfigs) {
  errors.push(
    `${path.relative(workspaceRoot, config)}: legacy Jest configuration found`
  );
}

if (errors.length > 0) {
  console.error(`Test inventory failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    `Test inventory verified: ${testFiles.length} files across ${testsByProject.size} projects.`
  );
}
