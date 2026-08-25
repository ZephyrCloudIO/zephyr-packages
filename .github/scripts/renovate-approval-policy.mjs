import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RENOVATE_AUTHORS = new Set(['renovate[bot]', 'app/renovate']);
const RENOVATE_TITLE = /^(?:chore|fix)\(deps\):\s\S/i;
const RENOVATE_BRANCH = /^renovate\//;
const BLOCKING_LABELS = new Set(['blocked', 'breaking', 'do not merge', 'major', 'superseded']);

function labelsFor(pr) {
  return new Set(
    (pr.labels ?? []).map((label) => (typeof label === 'string' ? label : label.name).toLowerCase())
  );
}

function isDependencyFile(path) {
  return (
    /(^|\/)package\.json$/.test(path) ||
    /(^|\/)(?:pnpm-lock\.yaml|pnpm-workspace\.yaml|package-lock\.json|yarn\.lock)$/.test(path) ||
    /(^|\/)Dockerfile(?:\.[^/]+)?$/.test(path) ||
    /^\.github\/actions\/.+\/action\.ya?ml$/.test(path) ||
    /^\.github\/workflows\/[^/]+\.ya?ml$/.test(path) ||
    path === '.nvmrc' ||
    path === '.tool-versions' ||
    path === 'renovate.json' ||
    path === '.github/renovate.json'
  );
}

function reject(reason) {
  return { eligible: false, reason };
}

export function classifyRenovateApproval(pr, files) {
  const labels = labelsFor(pr);
  const author = (pr.author ?? '').toLowerCase();
  const title = pr.title ?? '';
  const body = pr.body ?? '';
  const changedLines = files.reduce((total, file) => total + (file.changes ?? 0), 0);
  const nonLockfileLines = files
    .filter(
      (file) => !/(^|\/)(?:pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(file.filename)
    )
    .reduce((total, file) => total + (file.changes ?? 0), 0);

  if (pr.baseRef !== 'main') return reject('base branch is not main');
  if (pr.headRepo !== pr.baseRepo) return reject('pull request head is not in this repository');
  if (pr.draft) return reject('draft pull request');
  if (!RENOVATE_AUTHORS.has(author)) return reject('author is not Renovate');
  if (!RENOVATE_BRANCH.test(pr.headRef ?? ''))
    return reject('head branch is not a Renovate branch');
  if (!RENOVATE_TITLE.test(title))
    return reject('title is not an allowed dependency Conventional Commit');
  if (!labels.has('dependencies')) return reject('dependencies label is missing');

  const blockingLabel = [...labels].find((label) => BLOCKING_LABELS.has(label));
  if (blockingLabel) return reject(`blocking label is present: ${blockingLabel}`);
  if (/\|\s*(?:major|replacement)\s*\|/i.test(body))
    return reject('major, replacement, or breaking update');
  if (files.length === 0) return reject('pull request has no changed files');
  if (files.length > 50) return reject('pull request touches more than 50 files');
  if (changedLines > 10000 || nonLockfileLines > 500)
    return reject('pull request exceeds the review size limit');

  const unsafeFile = files.find((file) => !isDependencyFile(file.filename));
  if (unsafeFile) return reject(`non-dependency file changed: ${unsafeFile.filename}`);

  return { eligible: true, reason: 'bounded Renovate dependency-only update' };
}

function runCli() {
  const [pullPath, filesPath] = process.argv.slice(2);
  if (!pullPath || !filesPath) {
    throw new Error(
      'Usage: node renovate-approval-policy.mjs <pull-request.json> <pull-request-files.json>'
    );
  }

  const pull = JSON.parse(readFileSync(pullPath, 'utf8'));
  const files = JSON.parse(readFileSync(filesPath, 'utf8'));
  const result = classifyRenovateApproval(
    {
      author: pull.user.login,
      baseRef: pull.base.ref,
      baseRepo: pull.base.repo.full_name,
      body: pull.body,
      draft: pull.draft,
      headRef: pull.head.ref,
      headRepo: pull.head.repo.full_name,
      labels: pull.labels,
      title: pull.title,
    },
    files
  );

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `eligible=${result.eligible}\nreason=${result.reason.replace(/[\r\n]/g, ' ')}\n`
    );
  }
  console.log(JSON.stringify(result));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) runCli();
