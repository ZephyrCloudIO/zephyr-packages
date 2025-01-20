import fs from 'fs';
import path from 'path';

// import acorn from 'acorn';
//import * as walk from 'acorn-walk';

const targetFile = 'module-federation.config.ts';
const potentialFiles = 'module-federation';

export function findModuleFederationConfig(context: string): string | undefined {
  const files = fs.readdirSync(context);

  try {
    for (const file of files) {
      const filePath = path.join(context, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        const result = findModuleFederationConfig(filePath);
        if (result) return result;
      } else if (file === targetFile || file.toLowerCase().includes(potentialFiles)) {
        return filePath;
      }
    }
  } catch (err) {
    console.error(`Error searching in ${context}:`, err);
  }
  return undefined;
}
