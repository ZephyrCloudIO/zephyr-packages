#!/usr/bin/env node

const { Cloudflare } = require('cloudflare');
const { readFileSync } = require('node:fs');

const DEFAULT_RECORD_NAME = '_ze_version.zephyr-cloud.io';
const DEFAULT_TTL = 300;
const DEFAULT_SCHEMA = '1';
const DEFAULT_MSG = 'Upgrade recommended';

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeVersion(version) {
  return version.startsWith('v') ? version.slice(1) : version;
}

function inferPluginVersion() {
  const refName = process.env.GITHUB_REF_NAME;
  if (refName) {
    return normalizeVersion(refName);
  }

  const ref = process.env.GITHUB_REF;
  if (ref && ref.startsWith('refs/tags/')) {
    return normalizeVersion(ref.slice('refs/tags/'.length));
  }

  try {
    const rootPackageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
    if (rootPackageJson.version) {
      return normalizeVersion(String(rootPackageJson.version));
    }
  } catch {
    // Continue to hard failure below.
  }

  throw new Error('Could not infer plugin version from GitHub ref or package.json');
}

function parseTxtContent(content) {
  const fields = new Map();
  for (const part of String(content || '').split(';')) {
    const segment = part.trim();
    if (!segment) continue;

    const separatorIndex = segment.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = segment.slice(0, separatorIndex).trim();
    let value = segment.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      fields.set(key, value);
    }
  }

  return fields;
}

function buildTxtContent(fields) {
  const orderedKeys = ['schema', 'latest', 'msg'];
  const output = [];
  const seen = new Set();

  for (const key of orderedKeys) {
    if (!fields.has(key)) continue;
    output.push(`${key}=${fields.get(key)}`);
    seen.add(key);
  }

  for (const [key, value] of fields.entries()) {
    if (seen.has(key)) continue;
    output.push(`${key}=${value}`);
  }

  return output.join('; ');
}

async function main() {
  const apiToken = getRequiredEnv('CLOUDFLARE_API_TOKEN');
  const zoneId = getRequiredEnv('CLOUDFLARE_ZONE_ID');
  const pluginVersion = inferPluginVersion();
  const recordName = DEFAULT_RECORD_NAME;
  const ttl = DEFAULT_TTL;

  const client = new Cloudflare({ apiToken });

  let existingRecord = null;
  // SDK list is paginated and async iterable.
  for await (const record of client.dns.records.list({
    zone_id: zoneId,
    type: 'TXT',
    name: { exact: recordName },
  })) {
    if (record.type === 'TXT' && record.name.toLowerCase() === recordName.toLowerCase()) {
      existingRecord = record;
      break;
    }
  }

  const fields = existingRecord
    ? parseTxtContent(existingRecord.content)
    : new Map([
        ['schema', DEFAULT_SCHEMA],
        ['msg', DEFAULT_MSG],
      ]);

  if (!fields.has('schema')) {
    fields.set('schema', DEFAULT_SCHEMA);
  }
  if (!fields.has('msg')) {
    fields.set('msg', DEFAULT_MSG);
  }

  // Explicitly remove deprecated keys from the DNS value.
  fields.delete('min');
  fields.delete('urgent');
  fields.set('latest', pluginVersion);

  const content = buildTxtContent(fields);
  const basePayload = {
    type: 'TXT',
    name: recordName,
    content,
    ttl,
  };

  if (existingRecord) {
    await client.dns.records.edit(existingRecord.id, {
      zone_id: zoneId,
      ...basePayload,
    });
    console.log(`Updated TXT record ${recordName} -> ${content}`);
    return;
  }

  await client.dns.records.create({
    zone_id: zoneId,
    ...basePayload,
  });
  console.log(`Created TXT record ${recordName} -> ${content}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
