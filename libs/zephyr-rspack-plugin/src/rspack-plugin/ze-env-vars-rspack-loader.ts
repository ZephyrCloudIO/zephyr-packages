import { ze_log } from 'zephyr-agent';

// Global set para o plugin acessar depois
const GLOBAL_ENV_VARS = new Set<string>();

// Essa função substitui ZE_ vars por seus valores reais vindos do process.env
function replaceEnvVars(source: string, varsSet: Set<string>): string {
  return source.replace(
    /\b(import\.meta\.env|process\.env)\.(ZE_[a-zA-Z0-9_]+)/g,
    (_full, _type, varName) => {
      varsSet.add(varName);
      const value = process.env[varName];
      if (value === undefined) {
        ze_log(`⚠️  [ze-env-vars-loader] ${varName} não está definido no process.env`);
      }
      return JSON.stringify(value ?? '');
    }
  );
}

export default function loader(this: any, source: string): string {
  const { resourcePath } = this;
  if (!/\.(js|jsx|ts|tsx)$/.test(resourcePath)) return source;

  const varsSet = new Set<string>();
  const transformed = replaceEnvVars(source, varsSet);

  if (varsSet.size > 0) {
    ze_log(
      `✅ Substituídas ${varsSet.size} ZE_ env vars em ${resourcePath}: ${Array.from(varsSet).join(', ')}`
    );

    varsSet.forEach((v) => GLOBAL_ENV_VARS.add(v));
    this._module = this._module || {};
    this._module.buildInfo = this._module.buildInfo || {};
    this._module.buildInfo.zeEnvVars = Array.from(varsSet);
  }

  return transformed;
}

export function getGlobalEnvVars(): Set<string> {
  return GLOBAL_ENV_VARS;
}
