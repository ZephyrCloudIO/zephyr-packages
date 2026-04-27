const fs = require('node:fs');

for (const path of ['dist', 'tsconfig.tsbuildinfo']) {
  fs.rmSync(path, { recursive: true, force: true });
}
