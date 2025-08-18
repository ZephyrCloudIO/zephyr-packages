// Shared helpers for virtual env module + import map

export const VIRTUAL_SPECIFIER = 'env:vars';

// Only match ZE_PUBLIC_* keys
const ZE_REGEX_SIMPLE = /\bprocess\.env\.(ZE_PUBLIC_[A-Z0-9_]+)/g;
const ZE_REGEX_QUOTED = /\bprocess\.env\[["'`](ZE_PUBLIC_[A-Z0-9_]+)["'`]\]/g;
const ZE_REGEX_IMPORT_META_SIMPLE = /\bimport\.meta\.env\.(ZE_PUBLIC_[A-Z0-9_]+)/g;
const ZE_REGEX_IMPORT_META_QUOTED = /\bimport\.meta\.env\[["'`](ZE_PUBLIC_[A-Z0-9_]+)["'`]\]/g;

// Destructuring patterns (declarations): const { ... } = process.env | import.meta.env
const ZE_DESTRUCT_DECL = /(const|let|var)\s*\{([^}]+)\}\s*=\s*(process\.env|import\.meta\.env)/g;
// Destructuring patterns (assignment): ({ ... } = process.env) or { ... } = import.meta.env
const ZE_DESTRUCT_ASSIGN = /\{([^}]+)\}\s*=\s*(process\.env|import\.meta\.env)/g;

function extractDestructuredKeys(raw: string): string[] {
  // raw is the inside of {...}
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((frag) => {
      // Handle patterns:
      // ZE_PUBLIC_FOO
      // ZE_PUBLIC_FOO: ALIAS
      // ZE_PUBLIC_FOO = 'x'
      // ZE_PUBLIC_FOO: ALIAS = 'x'
      const colonIdx = frag.indexOf(':');
      const eqIdx = frag.indexOf('=');
      let base = frag;
      if (colonIdx !== -1) base = frag.slice(0, colonIdx).trim();
      else if (eqIdx !== -1) base = frag.slice(0, eqIdx).trim();
      return base;
    });
}

export function detectEnvReads(source: string): Set<string> {
  const names = new Set<string>();
  const regs = [ZE_REGEX_SIMPLE, ZE_REGEX_QUOTED, ZE_REGEX_IMPORT_META_SIMPLE, ZE_REGEX_IMPORT_META_QUOTED];
  for (const r of regs) {
    source.replace(r, (_m, name) => {
      names.add(String(name));
      return _m;
    });
  }
  // Detect destructuring keys and add only ZE_PUBLIC_*
  source.replace(ZE_DESTRUCT_DECL, (_m, _decl, inner) => {
    for (const k of extractDestructuredKeys(String(inner))) {
      if (k.startsWith('ZE_PUBLIC_')) names.add(k);
    }
    return _m;
  });
  source.replace(ZE_DESTRUCT_ASSIGN, (_m, inner) => {
    for (const k of extractDestructuredKeys(String(inner))) {
      if (k.startsWith('ZE_PUBLIC_')) names.add(k);
    }
    return _m;
  });
  return names;
}

export function rewriteEnvReadsToVirtualModule(
  source: string,
  specifier: string = VIRTUAL_SPECIFIER
): { code: string; used: Set<string> } {
  const used = detectEnvReads(source);
  if (used.size === 0) return { code: source, used };

  let code = source
    .replace(ZE_REGEX_SIMPLE, (_m, name) => `__ZE_ENV__.${name}`)
    .replace(ZE_REGEX_QUOTED, (_m, name) => `__ZE_ENV__.${name}`)
    .replace(ZE_REGEX_IMPORT_META_SIMPLE, (_m, name) => `__ZE_ENV__.${name}`)
    .replace(ZE_REGEX_IMPORT_META_QUOTED, (_m, name) => `__ZE_ENV__.${name}`);

  // Replace destructuring RHS env object with __ZE_ENV__ when ZE_PUBLIC_* keys are present
  code = code.replace(ZE_DESTRUCT_DECL, (m, decl, inner, rhs) => {
    const keys = extractDestructuredKeys(String(inner));
    if (!keys.some((k) => k.startsWith('ZE_PUBLIC_'))) return m;
    return `${decl} {${inner}} = __ZE_ENV__`;
  });
  code = code.replace(ZE_DESTRUCT_ASSIGN, (m, inner, rhs) => {
    const keys = extractDestructuredKeys(String(inner));
    if (!keys.some((k) => k.startsWith('ZE_PUBLIC_'))) return m;
    return `{${inner}} = __ZE_ENV__`;
  });

  // Ensure an import of the virtual module exists; avoid duplicating if already present
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const importRe = new RegExp(`from\\s+['\"]${escaped}['\"];?|require\\(['\"]${escaped}['\"]\\)`, 'm');
  if (!importRe.test(code)) {
    code = `import __ZE_ENV__ from '${specifier}';\n` + code;
  }
  return { code, used };
}

export function buildImportMap(specifier: string, url: string): string {
  return JSON.stringify({ imports: { [specifier]: url } }, null, 0);
}

export function injectImportMap(html: string, importMapJson: string, opts?: { injectTo?: 'head-prepend' | 'head' | 'body' }) {
  const scriptTag = `<script type="importmap">${importMapJson}</script>`;
  if (html.includes(scriptTag)) return html;
  const injectTo = opts?.injectTo ?? 'head-prepend';
  if (injectTo === 'body') return html.replace('</body>', `${scriptTag}</body>`);
  return html.replace('</head>', `${scriptTag}</head>`);
}

export function buildModulePreload(url: string): string {
  return `<link rel="modulepreload" href="${url}">`;
}

export function injectBeforeHeadClose(html: string, snippet: string) {
  if (html.includes(snippet)) return html;
  return html.replace('</head>', `${snippet}</head>`);
}

export function buildEnvJsonAsset(env: Record<string, string | undefined>): { fileName: string; source: string } {
  const safe: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (!k.startsWith('ZE_PUBLIC_')) continue;
    if (typeof v === 'string') safe[k] = v;
  }
  const source = JSON.stringify(safe);
  // djb2
  let h = 5381;
  for (let i = 0; i < source.length; i++) h = ((h << 5) + h) ^ source.charCodeAt(i);
  const short = (h >>> 0).toString(36);
  return { fileName: `ze-env.${short}.json`, source };
}
