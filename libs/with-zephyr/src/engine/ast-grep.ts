import type { Edit, NapiConfig, SgNode } from '@ast-grep/napi';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

export type AstGrepLanguage = 'js' | 'ts' | 'json';

export interface AstGrepRunOptions {
  filePath: string;
  pattern: string;
  selector?: string;
  strictness?: 'cst' | 'smart' | 'ast' | 'relaxed' | 'signature' | 'template';
  language?: AstGrepLanguage;
}

export interface AstGrepRewriteOptions extends AstGrepRunOptions {
  rewrite: string;
  updateAll?: boolean;
}

export interface AstGrepResult {
  status: 'match' | 'no-match' | 'error';
  stderr: string;
  stdout: string;
}

export interface ExportedConfigCallOptions extends AstGrepRunOptions {
  propertyName: 'commands' | 'plugins';
  allowDirectExport?: boolean;
}

interface AstGrepRuntime {
  parse: (language: string, source: string) => { root: () => SgNode };
}

const require = createRequire(import.meta.url);

function getAstGrepRuntime(): AstGrepRuntime {
  return require('@ast-grep/napi') as AstGrepRuntime;
}

function detectLanguage(filePath: string): AstGrepLanguage {
  if (filePath.endsWith('.json') || path.basename(filePath) === '.parcelrc') {
    return 'json';
  }

  if (
    filePath.endsWith('.ts') ||
    filePath.endsWith('.mts') ||
    filePath.endsWith('.tsx')
  ) {
    return 'ts';
  }

  return 'js';
}

function toNapiLanguage(language: AstGrepLanguage): string {
  if (language === 'ts') {
    return 'TypeScript';
  }

  // ast-grep napi does not expose a dedicated JSON language. JavaScript parser
  // can still handle JSON-like documents and keeps behavior stable for current usage.
  return 'JavaScript';
}

function buildMatcher(options: AstGrepRunOptions): string | NapiConfig {
  if (!options.selector && !options.strictness) {
    return options.pattern;
  }

  const patternObject: Record<string, string> = {
    context: options.pattern,
  };

  if (options.selector) {
    patternObject['selector'] = options.selector;
  }

  if (options.strictness) {
    patternObject['strictness'] = options.strictness;
  }

  return {
    rule: {
      pattern: patternObject,
    },
  } as unknown as NapiConfig;
}

function sliceNodeText(source: string, node: SgNode | null): string {
  if (!node) {
    return '';
  }

  const range = node.range();
  return source.slice(range.start.index, range.end.index);
}

function sliceMultiMatchText(source: string, nodes: SgNode[]): string {
  if (nodes.length === 0) {
    return '';
  }

  // ast-grep includes trailing comma syntax tokens in multi-match captures (e.g.
  // the trailing "," in "{ plugins: [...], }"). Slice up to the last non-comma node
  // so the expansion doesn't produce ",," when the rewrite template adds its own
  // separator comma.
  let lastIndex = nodes.length - 1;
  while (lastIndex > 0 && nodes[lastIndex].kind() === ',') {
    lastIndex--;
  }

  const start = nodes[0].range().start.index;
  const end = nodes[lastIndex].range().end.index;
  return source.slice(start, end);
}

function renderRewriteTemplate(node: SgNode, source: string, rewrite: string): string {
  return rewrite.replace(
    /\$\$\$([A-Za-z_]\w*)|\$([A-Za-z_]\w*)/g,
    (_, multiName: string | undefined, singleName: string | undefined) => {
      if (multiName) {
        return sliceMultiMatchText(source, node.getMultipleMatches(multiName));
      }

      if (singleName) {
        return sliceNodeText(source, node.getMatch(singleName));
      }

      return '';
    }
  );
}

export function searchWithAstGrep(options: AstGrepRunOptions): AstGrepResult {
  try {
    const language = options.language ?? detectLanguage(options.filePath);
    const source = fs.readFileSync(options.filePath, 'utf8');
    const { parse } = getAstGrepRuntime();
    const root = parse(toNapiLanguage(language), source);
    const match = root.root().find(buildMatcher(options));

    return {
      status: match ? 'match' : 'no-match',
      stdout: '',
      stderr: '',
    };
  } catch (error) {
    return {
      status: 'error',
      stdout: '',
      stderr: (error as Error).message,
    };
  }
}

export function hasExportedConfigCall(options: ExportedConfigCallOptions): boolean {
  try {
    const language = options.language ?? detectLanguage(options.filePath);
    const source = fs.readFileSync(options.filePath, 'utf8');
    const { parse } = getAstGrepRuntime();
    const root = parse(toNapiLanguage(language), source).root();
    const calls = root.findAll(buildMatcher(options));
    const exportedIdentifiers = new Set<string>();
    for (const pattern of ['module.exports = $IDENT', 'export default $IDENT']) {
      for (const exported of root.findAll(pattern)) {
        const identifier = exported.getMatch('IDENT');
        if (identifier?.kind() === 'identifier')
          exportedIdentifiers.add(identifier.text());
      }
    }

    const isExportedObject = (object: SgNode | null): boolean => {
      const parent = object?.parent();
      if (!parent) return false;
      if (
        parent.matches('module.exports = {$$$PROPS}') ||
        parent.matches('export default {$$$PROPS}')
      ) {
        return true;
      }
      if (parent.kind() !== 'variable_declarator') return false;
      const identifier = /^\s*([A-Za-z_$][\w$]*)\s*=/.exec(parent.text())?.[1];
      return Boolean(identifier && exportedIdentifiers.has(identifier));
    };

    return calls.some((call) => {
      if (options.allowDirectExport) {
        for (const ancestor of call.ancestors()) {
          for (const pattern of ['module.exports = $VALUE', 'export default $VALUE']) {
            if (ancestor.matches(pattern) && call.parent()?.id() === ancestor.id()) {
              return true;
            }
          }
        }
      }

      const property = call
        .ancestors()
        .find(
          (ancestor) =>
            ancestor.kind() === 'pair' &&
            new RegExp(
              `^\\s*(?:${options.propertyName}|["']${options.propertyName}["']|\\[\\s*["']${options.propertyName}["']\\s*\\])\\s*:`
            ).test(ancestor.text())
        );
      if (!property || !isExportedObject(property.parent())) return false;

      if (options.propertyName === 'plugins') {
        const array = call.parent();
        return Boolean(
          array?.kind() === 'array' && array.parent()?.id() === property.id()
        );
      }

      const member = call.parent();
      if (
        member?.kind() !== 'member_expression' ||
        !/\.\s*commands\s*$/.test(member.text())
      ) {
        return false;
      }
      if (member.parent()?.id() === property.id()) return true;
      const spread = member.parent();
      const array = spread?.parent();
      return Boolean(
        spread?.kind() === 'spread_element' &&
        array?.kind() === 'array' &&
        array.parent()?.id() === property.id()
      );
    });
  } catch {
    return false;
  }
}

export function findFirstMatchTextWithAstGrep(options: AstGrepRunOptions): string | null {
  const language = options.language ?? detectLanguage(options.filePath);
  const source = fs.readFileSync(options.filePath, 'utf8');
  const { parse } = getAstGrepRuntime();
  const root = parse(toNapiLanguage(language), source);
  const match = root.root().find(buildMatcher(options));

  if (!match) {
    return null;
  }

  return source.slice(match.range().start.index, match.range().end.index);
}

export function rewriteWithAstGrep(options: AstGrepRewriteOptions): AstGrepResult {
  try {
    const language = options.language ?? detectLanguage(options.filePath);
    const source = fs.readFileSync(options.filePath, 'utf8');
    const { parse } = getAstGrepRuntime();
    const root = parse(toNapiLanguage(language), source);
    const matches = root.root().findAll(buildMatcher(options));

    if (matches.length === 0) {
      return {
        status: 'no-match',
        stdout: '',
        stderr: '',
      };
    }

    if (options.updateAll) {
      const edits: Edit[] = matches.map((match) =>
        match.replace(renderRewriteTemplate(match, source, options.rewrite))
      );

      const nextSource = root.root().commitEdits(edits);
      if (nextSource !== source) {
        fs.writeFileSync(options.filePath, nextSource);
      }
    }

    return {
      status: 'match',
      stdout: '',
      stderr: '',
    };
  } catch (error) {
    return {
      status: 'error',
      stdout: '',
      stderr: (error as Error).message,
    };
  }
}
